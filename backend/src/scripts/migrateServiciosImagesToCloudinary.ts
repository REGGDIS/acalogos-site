import { createHash } from "crypto";
import { createReadStream } from "fs";
import { open, readFile, stat } from "fs/promises";
import path from "path";
import type { Pool, PoolClient } from "pg";
import { MAX_IMAGE_SIZE_BYTES, uploadPath } from "../uploadConfig.js";

const LOCAL_PREFIX = "/assets/images/servicios/";
const PROPOSED_PUBLIC_ID_PREFIX = "acalogos/servicios";

type ServicioRow = {
    id: number;
    nombre: string;
    imagen: string | null;
    imagenes_adicionales: string[] | null;
    imagen_public_id: string | null;
    imagenes_adicionales_public_ids: unknown;
};

type ReferenceKind = "principal" | "adicional";
type ReferenceStatus = "valid-local" | "valid-remote" | "invalid";

type ReferenceReport = {
    serviceId: number;
    serviceName: string;
    kind: ReferenceKind;
    referenceLabel: string;
    status: ReferenceStatus;
    reason?: string;
    format?: string;
    sizeBytes?: number;
    shortHash?: string;
    proposedPublicId?: string;
    fullHash?: string;
    metadataIssues?: string[];
    filePath?: string;
};

type StoredMigrationImage = {
    secureUrl: string;
    publicId: string;
    format: string;
    bytes: number;
};

type UploadedMigrationImage = StoredMigrationImage & {
    kind: ReferenceKind;
    originalReference: string;
    shortHash: string;
    proposedPublicId: string;
    createdInThisRun: boolean;
};

type ScriptMode =
    | { name: "dry-run" }
    | { name: "apply"; serviceId: number };

type DiagnosticStage =
    | "pool-connect"
    | "begin"
    | "lock-read"
    | "concurrency-check"
    | "build-values"
    | "update"
    | "commit"
    | "commit-verification"
    | "cleanup";

class MigrationStageError extends Error {
    constructor(
        readonly stage: DiagnosticStage,
        readonly sqlState: string = "-",
        readonly cleanupAllowed: boolean = true,
    ) {
        super("migration-stage-error");
    }
}

type PersistMigrationResult =
    | { status: "confirmed" }
    | { status: "failed-cleanup-allowed"; diagnostic: MigrationStageError }
    | { status: "manual-review"; diagnostic: MigrationStageError };

type Counters = {
    services: number;
    totalReferences: number;
    primaryLocal: number;
    primaryRemote: number;
    additionalLocal: number;
    additionalRemote: number;
    validFiles: number;
    missingFiles: number;
    invalidFiles: number;
    inconsistentMetadata: number;
    duplicateWithinServiceGroups: number;
    duplicateAcrossServicesGroups: number;
    totalLocalBytes: number;
    migrationCandidates: number;
};

type AdditionalPublicIdsValidation = {
    values: Record<string, string>;
    isValid: boolean;
};

const args = process.argv.slice(2);

if (args.includes("--apply") || process.env.npm_config_apply !== undefined || process.env.npm_config_all === "true") {
    console.error("Este inventario es solo dry-run. El argumento --apply no esta permitido en esta fase.");
    process.exit(2);
}

const parseMode = (): ScriptMode => {
    if (args.length === 0) {
        return { name: "dry-run" };
    }

    if (args[0] !== "apply" || args.length !== 2) {
        console.error("Uso invalido. Esta fase solo permite dry-run sin argumentos o apply <serviceId> con confirmacion explicita.");
        process.exit(2);
    }

    const serviceId = Number(args[1]);
    if (!Number.isInteger(serviceId) || serviceId <= 0) {
        console.error("Uso invalido. Debe indicar un ID de servicio entero positivo.");
        process.exit(2);
    }

    if (process.env.MIGRATE_IMAGES_CONFIRM !== "MIGRATE_ONE_SERVICE") {
        console.error("Confirmacion requerida. La migracion controlada exige MIGRATE_IMAGES_CONFIRM=MIGRATE_ONE_SERVICE.");
        process.exit(2);
    }

    return { name: "apply", serviceId };
};

const mode = parseMode();

const initialCounters = (): Counters => ({
    services: 0,
    totalReferences: 0,
    primaryLocal: 0,
    primaryRemote: 0,
    additionalLocal: 0,
    additionalRemote: 0,
    validFiles: 0,
    missingFiles: 0,
    invalidFiles: 0,
    inconsistentMetadata: 0,
    duplicateWithinServiceGroups: 0,
    duplicateAcrossServicesGroups: 0,
    totalLocalBytes: 0,
    migrationCandidates: 0,
});

const normalizeAdditionalPublicIds = (value: unknown): AdditionalPublicIdsValidation => {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return { values: {}, isValid: false };
    }

    const entries = Object.entries(value);
    const validEntries = entries.filter((entry): entry is [string, string] => typeof entry[1] === "string" && entry[1].trim() !== "");

    return {
        values: Object.fromEntries(validEntries),
        isValid: validEntries.length === entries.length,
    };
};

const isHttpsUrl = (reference: string): boolean => reference.startsWith("https://");

const isOtherProtocol = (reference: string): boolean => /^[a-z][a-z0-9+.-]*:\/\//i.test(reference) && !isHttpsUrl(reference);

const resolveLocalReference = (reference: string): { filePath?: string; error?: string } => {
    if (!reference.startsWith(LOCAL_PREFIX)) {
        return { error: "ruta local no autorizada" };
    }

    const relativePath = reference.slice(LOCAL_PREFIX.length);
    if (!relativePath || relativePath.includes("\\")) {
        return { error: "ruta local no autorizada" };
    }

    const resolvedPath = path.resolve(uploadPath, relativePath);
    const relativeToUploadPath = path.relative(uploadPath, resolvedPath);

    if (relativeToUploadPath === "" || relativeToUploadPath.startsWith("..") || path.isAbsolute(relativeToUploadPath)) {
        return { error: "ruta fuera del directorio autorizado" };
    }

    return { filePath: resolvedPath };
};

const detectImageFormat = (signature: Buffer): string | null => {
    if (signature.length >= 3 && signature[0] === 0xff && signature[1] === 0xd8 && signature[2] === 0xff) {
        return "JPEG";
    }

    if (
        signature.length >= 8 &&
        signature[0] === 0x89 &&
        signature[1] === 0x50 &&
        signature[2] === 0x4e &&
        signature[3] === 0x47 &&
        signature[4] === 0x0d &&
        signature[5] === 0x0a &&
        signature[6] === 0x1a &&
        signature[7] === 0x0a
    ) {
        return "PNG";
    }

    if (
        signature.length >= 12 &&
        signature.subarray(0, 4).toString("ascii") === "RIFF" &&
        signature.subarray(8, 12).toString("ascii") === "WEBP"
    ) {
        return "WebP";
    }

    return null;
};

const readSignature = async (filePath: string): Promise<Buffer> => {
    const file = await open(filePath, "r");
    try {
        const buffer = Buffer.alloc(12);
        const result = await file.read(buffer, 0, buffer.length, 0);
        return buffer.subarray(0, result.bytesRead);
    } finally {
        await file.close();
    }
};

const calculateSha256 = (filePath: string): Promise<string> => new Promise((resolve, reject) => {
    const hash = createHash("sha256");
    const stream = createReadStream(filePath);

    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("error", reject);
    stream.on("end", () => resolve(hash.digest("hex")));
});

const buildProposedPublicId = (serviceId: number, kind: ReferenceKind, shortHash: string): string => {
    const imageName = kind === "principal" ? "principal" : "adicional";
    return `${PROPOSED_PUBLIC_ID_PREFIX}/servicio-${serviceId}/${imageName}-${shortHash}`;
};

const analyzeLocalReference = async (
    service: ServicioRow,
    kind: ReferenceKind,
    reference: string,
    counters: Counters,
    metadataIssues: string[],
): Promise<ReferenceReport> => {
    const resolved = resolveLocalReference(reference);
    if (!resolved.filePath) {
        counters.invalidFiles += 1;
        return buildInvalidReport(service, kind, reference, resolved.error ?? "referencia invalida", metadataIssues);
    }

    let fileStat;
    try {
        fileStat = await stat(resolved.filePath);
    } catch {
        counters.missingFiles += 1;
        return buildInvalidReport(service, kind, reference, "archivo inexistente", metadataIssues);
    }

    if (!fileStat.isFile()) {
        counters.invalidFiles += 1;
        return buildInvalidReport(service, kind, reference, "no es un archivo regular", metadataIssues);
    }

    if (fileStat.size === 0) {
        counters.invalidFiles += 1;
        return buildInvalidReport(service, kind, reference, "archivo vacio", metadataIssues);
    }

    if (fileStat.size > MAX_IMAGE_SIZE_BYTES) {
        counters.invalidFiles += 1;
        return buildInvalidReport(service, kind, reference, "archivo mayor de 5 MiB", metadataIssues, undefined, fileStat.size);
    }

    const format = detectImageFormat(await readSignature(resolved.filePath));
    if (!format) {
        counters.invalidFiles += 1;
        return buildInvalidReport(service, kind, reference, "firma no permitida", metadataIssues, undefined, fileStat.size);
    }

    const fullHash = await calculateSha256(resolved.filePath);
    const shortHash = fullHash.slice(0, 12);

    counters.validFiles += 1;
    counters.totalLocalBytes += fileStat.size;
    counters.migrationCandidates += 1;

    return {
        serviceId: service.id,
        serviceName: service.nombre,
        kind,
        referenceLabel: reference,
        status: "valid-local",
        format,
        sizeBytes: fileStat.size,
        shortHash,
        fullHash,
        proposedPublicId: buildProposedPublicId(service.id, kind, shortHash),
        metadataIssues,
        filePath: resolved.filePath,
    };
};

const buildInvalidReport = (
    service: ServicioRow,
    kind: ReferenceKind,
    reference: string,
    reason: string,
    metadataIssues: string[] = [],
    format?: string,
    sizeBytes?: number,
): ReferenceReport => ({
    serviceId: service.id,
    serviceName: service.nombre,
    kind,
    referenceLabel: reference || "[vacio]",
    status: "invalid",
    reason,
    format,
    sizeBytes,
    metadataIssues,
});

const analyzeReference = async (
    service: ServicioRow,
    kind: ReferenceKind,
    reference: string | null | undefined,
    additionalPublicIds: Record<string, string>,
    counters: Counters,
): Promise<ReferenceReport> => {
    counters.totalReferences += 1;

    const trimmedReference = reference?.trim() ?? "";
    if (!trimmedReference) {
        counters.invalidFiles += 1;
        return buildInvalidReport(service, kind, trimmedReference, "valor vacio");
    }

    const metadataIssues: string[] = [];

    if (isHttpsUrl(trimmedReference)) {
        if (kind === "principal") {
            counters.primaryRemote += 1;
            if (!service.imagen_public_id || service.imagen_public_id.trim() === "") {
                counters.inconsistentMetadata += 1;
                metadataIssues.push("URL remota sin imagen_public_id");
            }
        } else {
            counters.additionalRemote += 1;
            if (!additionalPublicIds[trimmedReference]) {
                counters.inconsistentMetadata += 1;
                metadataIssues.push("URL remota sin metadata correspondiente");
            }
        }

        return {
            serviceId: service.id,
            serviceName: service.nombre,
            kind,
            referenceLabel: "[URL remota]",
            status: "valid-remote",
            metadataIssues,
        };
    }

    if (isOtherProtocol(trimmedReference)) {
        counters.invalidFiles += 1;
        return buildInvalidReport(service, kind, trimmedReference, "protocolo distinto de HTTPS");
    }

    if (kind === "principal") {
        counters.primaryLocal += 1;
        if (service.imagen_public_id && service.imagen_public_id.trim() !== "") {
            counters.inconsistentMetadata += 1;
            metadataIssues.push("referencia local con imagen_public_id existente");
        }
    } else {
        counters.additionalLocal += 1;
        if (additionalPublicIds[trimmedReference]) {
            counters.inconsistentMetadata += 1;
            metadataIssues.push("referencia local con metadata remota asociada");
        }
    }

    return analyzeLocalReference(service, kind, trimmedReference, counters, metadataIssues);
};

const buildMetadataReport = (service: ServicioRow, reason: string): ReferenceReport => ({
    serviceId: service.id,
    serviceName: service.nombre,
    kind: "adicional",
    referenceLabel: "[metadata adicionales]",
    status: "invalid",
    reason,
    metadataIssues: [reason],
});

const formatBytes = (value: number | undefined): string => value === undefined ? "-" : `${value}`;

const printReference = (report: ReferenceReport): void => {
    const detail = report.reason ? ` (${report.reason})` : "";
    const metadata = report.metadataIssues && report.metadataIssues.length > 0
        ? report.metadataIssues.join("; ")
        : "-";
    console.log(
        [
            `servicio=${report.serviceId}`,
            `nombre="${report.serviceName}"`,
            `tipo=${report.kind}`,
            `referencia=${report.referenceLabel}`,
            `estado=${report.status}${detail}`,
            `formato=${report.format ?? "-"}`,
            `tamano_bytes=${formatBytes(report.sizeBytes)}`,
            `hash_corto=${report.shortHash ?? "-"}`,
            `public_id_propuesto=${report.proposedPublicId ?? "-"}`,
            `metadata=${metadata}`,
        ].join(" | "),
    );
};

const printSummary = (counters: Counters): void => {
    console.log("\nResumen dry-run");
    console.log(`servicios: ${counters.services}`);
    console.log(`referencias totales: ${counters.totalReferences}`);
    console.log(`imagenes principales locales: ${counters.primaryLocal}`);
    console.log(`imagenes principales remotas: ${counters.primaryRemote}`);
    console.log(`imagenes adicionales locales: ${counters.additionalLocal}`);
    console.log(`imagenes adicionales remotas: ${counters.additionalRemote}`);
    console.log(`archivos validos: ${counters.validFiles}`);
    console.log(`archivos faltantes: ${counters.missingFiles}`);
    console.log(`archivos invalidos: ${counters.invalidFiles}`);
    console.log(`referencias con metadata inconsistente: ${counters.inconsistentMetadata}`);
    console.log(`grupos duplicados dentro del mismo servicio: ${counters.duplicateWithinServiceGroups}`);
    console.log(`grupos duplicados entre servicios distintos: ${counters.duplicateAcrossServicesGroups}`);
    console.log(`bytes locales totales: ${counters.totalLocalBytes}`);
    console.log(`elementos candidatos a migracion: ${counters.migrationCandidates}`);
};

const markDuplicateContents = (reports: ReferenceReport[], counters: Counters): void => {
    const byServiceAndHash = new Map<string, ReferenceReport[]>();
    const byHash = new Map<string, ReferenceReport[]>();

    for (const report of reports) {
        if (!report.fullHash) continue;

        const key = `${report.serviceId}:${report.fullHash}`;
        const current = byServiceAndHash.get(key) ?? [];
        current.push(report);
        byServiceAndHash.set(key, current);

        const currentGlobal = byHash.get(report.fullHash) ?? [];
        currentGlobal.push(report);
        byHash.set(report.fullHash, currentGlobal);
    }

    for (const duplicates of byServiceAndHash.values()) {
        if (duplicates.length <= 1) continue;

        counters.duplicateWithinServiceGroups += 1;
        const refs = duplicates.map((item) => `${item.kind}:${item.referenceLabel}`).join("; ");
        console.log(`ADVERTENCIA duplicado_por_hash servicio=${duplicates[0].serviceId} hash_corto=${duplicates[0].shortHash} referencias=${refs}`);
    }

    for (const duplicates of byHash.values()) {
        const serviceIds = new Set(duplicates.map((item) => item.serviceId));
        if (serviceIds.size <= 1) continue;

        counters.duplicateAcrossServicesGroups += 1;
        const ids = [...serviceIds].sort((a, b) => a - b).join(",");
        const roles = duplicates.map((item) => `${item.serviceId}:${item.kind}`).join(",");
        console.log(
            `ADVERTENCIA duplicado_global_por_hash servicios=${ids} roles=${roles} hash_corto=${duplicates[0].shortHash} tamano_bytes=${duplicates[0].sizeBytes ?? "-"}`,
        );
    }
};

const validateAdditionalMetadataKeys = (
    service: ServicioRow,
    additionalReferences: string[],
    additionalPublicIds: Record<string, string>,
    counters: Counters,
): ReferenceReport[] => {
    const reports: ReferenceReport[] = [];
    const remoteReferences = new Set(additionalReferences.map((reference) => reference.trim()).filter(isHttpsUrl));

    for (const key of Object.keys(additionalPublicIds)) {
        if (!remoteReferences.has(key)) {
            counters.inconsistentMetadata += 1;
            reports.push(buildMetadataReport(service, "imagenes_adicionales_public_ids contiene clave sin referencia remota actual"));
        }
    }

    return reports;
};

const analyzeServices = async (services: ServicioRow[], counters: Counters): Promise<ReferenceReport[]> => {
    const reports: ReferenceReport[] = [];
    counters.services = services.length;

    for (const service of services) {
        const additionalPublicIds = normalizeAdditionalPublicIds(service.imagenes_adicionales_public_ids);
        const additionalReferences = service.imagenes_adicionales ?? [];

        if (!additionalPublicIds.isValid) {
            counters.inconsistentMetadata += 1;
            reports.push(buildMetadataReport(service, "imagenes_adicionales_public_ids no es un objeto JSON valido para metadata remota"));
        }

        reports.push(await analyzeReference(service, "principal", service.imagen, additionalPublicIds.values, counters));

        for (const additionalReference of additionalReferences) {
            reports.push(await analyzeReference(service, "adicional", additionalReference, additionalPublicIds.values, counters));
        }

        reports.push(...validateAdditionalMetadataKeys(service, additionalReferences, additionalPublicIds.values, counters));
    }

    return reports;
};

const hasBlockingErrors = (counters: Counters): boolean => (
    counters.missingFiles > 0 || counters.invalidFiles > 0 || counters.inconsistentMetadata > 0
);

const sameAdditionalReferences = (left: string[] | null, right: string[] | null): boolean => {
    const leftValues = left ?? [];
    const rightValues = right ?? [];

    return leftValues.length === rightValues.length && leftValues.every((value, index) => value === rightValues[index]);
};

const getSafeSqlState = (error: unknown): string => {
    if (!error || typeof error !== "object") return "-";

    const code = (error as { code?: unknown }).code;
    return typeof code === "string" && /^[a-z0-9]{5}$/i.test(code) ? code : "-";
};

const toMigrationStageError = (stage: DiagnosticStage, error: unknown, cleanupAllowed = true): MigrationStageError => {
    if (error instanceof MigrationStageError) {
        return error;
    }

    return new MigrationStageError(stage, getSafeSqlState(error), cleanupAllowed);
};

const printDiagnostic = (error: MigrationStageError): void => {
    console.error(`etapa=${error.stage} codigo_postgres=${error.sqlState}`);
};

const normalizeImageFormat = (format: string | undefined): string => {
    const normalized = format?.trim().toLowerCase();
    return normalized === "jpg" ? "jpeg" : normalized ?? "";
};

const isValidHttpsUrl = (value: string): boolean => {
    try {
        return new URL(value).protocol === "https:";
    } catch {
        return false;
    }
};

const validateExistingImage = (
    serviceId: number,
    candidate: ReferenceReport,
    existingImage: StoredMigrationImage,
): void => {
    if (
        existingImage.publicId !== candidate.proposedPublicId
        || !isValidHttpsUrl(existingImage.secureUrl)
        || existingImage.bytes !== candidate.sizeBytes
        || normalizeImageFormat(existingImage.format) !== normalizeImageFormat(candidate.format)
    ) {
        console.error(
            `Recurso remoto preexistente incompatible servicio=${serviceId} tipo=${candidate.kind} hash_corto=${candidate.shortHash ?? "-"}.`,
        );
        throw new Error("recurso remoto preexistente incompatible");
    }
};

const findDuplicateGroupsWithinService = (reports: ReferenceReport[]): ReferenceReport[][] => {
    const byHash = new Map<string, ReferenceReport[]>();

    for (const report of reports) {
        if (!report.fullHash) continue;

        const current = byHash.get(report.fullHash) ?? [];
        current.push(report);
        byHash.set(report.fullHash, current);
    }

    return [...byHash.values()].filter((group) => group.length > 1);
};

const printDuplicateGroupsWithinService = (groups: ReferenceReport[][]): void => {
    for (const group of groups) {
        const roles = group.map((item) => item.kind).join(",");
        console.error(
            `Duplicado local dentro del servicio roles=${roles} hash_corto=${group[0].shortHash ?? "-"} tamano_bytes=${group[0].sizeBytes ?? "-"}.`,
        );
    }
};

const cleanupCreatedImages = async (
    createdImages: UploadedMigrationImage[],
    deleteImage: (publicId: string) => Promise<void>,
): Promise<void> => {
    for (const image of createdImages) {
        if (!image.createdInThisRun) continue;

        try {
            await deleteImage(image.publicId);
        } catch {
            printDiagnostic(new MigrationStageError("cleanup"));
            console.warn("ADVERTENCIA: no se pudo completar la limpieza compensatoria de un recurso remoto creado en esta ejecucion.");
        }
    }
};

const printApplyItem = (serviceId: number, image: UploadedMigrationImage, status: "reutilizado" | "creado"): void => {
    console.log(
        [
            `servicio=${serviceId}`,
            `tipo=${image.kind}`,
            `hash_corto=${image.shortHash}`,
            `public_id_propuesto=${image.proposedPublicId}`,
            `estado=${status}`,
        ].join(" | "),
    );
};

const uploadMigrationCandidates = async (
    serviceId: number,
    candidates: ReferenceReport[],
): Promise<{
    uploadedImages: UploadedMigrationImage[];
    deleteImage: (publicId: string) => Promise<void>;
}> => {
    const storage = await import("../services/imageStorageService.js");
    const uploadedImages: UploadedMigrationImage[] = [];

    try {
        for (const candidate of candidates) {
            if (!candidate.filePath || !candidate.proposedPublicId || !candidate.shortHash) {
                throw new Error("candidato invalido");
            }

            const existingImage = await storage.getImageByPublicId(candidate.proposedPublicId);
            if (existingImage) {
                validateExistingImage(serviceId, candidate, existingImage);
                const reusedImage: UploadedMigrationImage = {
                    ...existingImage,
                    kind: candidate.kind,
                    originalReference: candidate.referenceLabel,
                    shortHash: candidate.shortHash,
                    proposedPublicId: candidate.proposedPublicId,
                    createdInThisRun: false,
                };
                uploadedImages.push(reusedImage);
                printApplyItem(serviceId, reusedImage, "reutilizado");
                continue;
            }

            const uploadedImage = await storage.uploadImage(await readFile(candidate.filePath), {
                publicId: candidate.proposedPublicId,
                overwrite: false,
            });
            const createdImage: UploadedMigrationImage = {
                ...uploadedImage,
                kind: candidate.kind,
                originalReference: candidate.referenceLabel,
                shortHash: candidate.shortHash,
                proposedPublicId: candidate.proposedPublicId,
                createdInThisRun: true,
            };
            uploadedImages.push(createdImage);
            printApplyItem(serviceId, createdImage, "creado");
        }

        return { uploadedImages, deleteImage: storage.deleteImage };
    } catch {
        await cleanupCreatedImages(uploadedImages, storage.deleteImage);
        throw new Error("No se pudo completar la carga remota de imagenes.");
    }
};

const buildMigratedValues = (
    service: ServicioRow,
    uploadedImages: UploadedMigrationImage[],
): {
    imagen: string | null;
    imagenPublicId: string | null;
    imagenesAdicionales: string[];
    imagenesAdicionalesPublicIds: Record<string, string>;
} => {
    const byOriginalReference = new Map(uploadedImages.map((image) => [image.originalReference, image]));
    const primaryUpload = service.imagen ? byOriginalReference.get(service.imagen) : undefined;
    const currentAdditionalPublicIds = normalizeAdditionalPublicIds(service.imagenes_adicionales_public_ids).values;
    const imagenesAdicionalesPublicIds: Record<string, string> = {};

    const imagen = primaryUpload?.secureUrl ?? service.imagen;
    const imagenPublicId = primaryUpload?.publicId ?? service.imagen_public_id;
    const imagenesAdicionales = (service.imagenes_adicionales ?? []).map((reference) => {
        const uploaded = byOriginalReference.get(reference);
        if (uploaded) {
            imagenesAdicionalesPublicIds[uploaded.secureUrl] = uploaded.publicId;
            return uploaded.secureUrl;
        }

        if (isHttpsUrl(reference)) {
            imagenesAdicionalesPublicIds[reference] = currentAdditionalPublicIds[reference];
        }

        return reference;
    });

    return {
        imagen,
        imagenPublicId,
        imagenesAdicionales,
        imagenesAdicionalesPublicIds,
    };
};

type MigratedValues = ReturnType<typeof buildMigratedValues>;

const samePublicIdMap = (left: Record<string, string>, right: Record<string, string>): boolean => {
    const leftEntries = Object.entries(left).sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey));
    const rightEntries = Object.entries(right).sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey));

    return leftEntries.length === rightEntries.length
        && leftEntries.every(([key, value], index) => key === rightEntries[index][0] && value === rightEntries[index][1]);
};

const isSerializablePublicIdMap = (value: Record<string, string>): boolean => {
    try {
        if (!Object.entries(value).every(([key, publicId]) => isValidHttpsUrl(key) && typeof publicId === "string" && publicId.trim() !== "")) {
            return false;
        }

        const serialized = JSON.stringify(value);
        if (!serialized) return false;

        const parsed: unknown = JSON.parse(serialized);
        return !!parsed && typeof parsed === "object" && !Array.isArray(parsed);
    } catch {
        return false;
    }
};

const isOriginalServicePersisted = (service: ServicioRow, original: ServicioRow): boolean => (
    service.imagen === original.imagen
    && service.imagen_public_id === original.imagen_public_id
    && sameAdditionalReferences(service.imagenes_adicionales, original.imagenes_adicionales)
    && samePublicIdMap(
        normalizeAdditionalPublicIds(service.imagenes_adicionales_public_ids).values,
        normalizeAdditionalPublicIds(original.imagenes_adicionales_public_ids).values,
    )
);

const isMigrationPersisted = (service: ServicioRow, migratedValues: MigratedValues): boolean => (
    service.imagen === migratedValues.imagen
    && service.imagen_public_id === migratedValues.imagenPublicId
    && sameAdditionalReferences(service.imagenes_adicionales, migratedValues.imagenesAdicionales)
    && samePublicIdMap(normalizeAdditionalPublicIds(service.imagenes_adicionales_public_ids).values, migratedValues.imagenesAdicionalesPublicIds)
);

const readServiceForVerification = async (pool: Pool, serviceId: number): Promise<ServicioRow | null> => {
    const result = await pool.query<ServicioRow>(`
        SELECT id, nombre, imagen, imagenes_adicionales, imagen_public_id, imagenes_adicionales_public_ids
        FROM public.servicios
        WHERE id = $1
    `, [serviceId]);

    return result.rows[0] ?? null;
};

const persistMigratedService = async (
    pool: Pool,
    service: ServicioRow,
    uploadedImages: UploadedMigrationImage[],
): Promise<PersistMigrationResult> => {
    let client: PoolClient | null = null;
    let phase: "before-transaction" | "transaction-started" | "update-executed" | "commit-sent" | "commit-confirmed" = "before-transaction";
    let currentStage: DiagnosticStage = "pool-connect";
    let migratedValues: MigratedValues | null = null;

    try {
        try {
            client = await pool.connect();
        } catch (error) {
            throw toMigrationStageError("pool-connect", error);
        }

        currentStage = "begin";
        try {
            await client.query("BEGIN");
        } catch (error) {
            throw toMigrationStageError("begin", error);
        }
        phase = "transaction-started";

        currentStage = "lock-read";
        let lockedResult;
        try {
            lockedResult = await client.query<ServicioRow>(`
                SELECT id, nombre, imagen, imagenes_adicionales, imagen_public_id, imagenes_adicionales_public_ids
                FROM public.servicios
                WHERE id = $1
                FOR UPDATE
            `, [service.id]);
        } catch (error) {
            throw toMigrationStageError("lock-read", error);
        }
        const lockedService = lockedResult.rows[0];

        currentStage = "concurrency-check";
        if (!lockedService || !isOriginalServicePersisted(lockedService, service)) {
            throw new MigrationStageError("concurrency-check", "-", true);
        }

        currentStage = "build-values";
        try {
            migratedValues = buildMigratedValues(service, uploadedImages);
            if (!Array.isArray(migratedValues.imagenesAdicionales)
                || !migratedValues.imagenesAdicionales.every((value) => typeof value === "string")
                || !isSerializablePublicIdMap(migratedValues.imagenesAdicionalesPublicIds)
            ) {
                throw new MigrationStageError("build-values", "-", true);
            }
        } catch (error) {
            throw toMigrationStageError("build-values", error);
        }

        currentStage = "update";
        let updateResult;
        try {
            updateResult = await client.query(`
            UPDATE public.servicios
            SET imagen = $1::text,
                imagen_public_id = $2::text,
                imagenes_adicionales = $3::text[],
                imagenes_adicionales_public_ids = $4::jsonb,
                updated_at = NOW()
            WHERE id = $5
            `, [
                migratedValues.imagen,
                migratedValues.imagenPublicId,
                migratedValues.imagenesAdicionales,
                JSON.stringify(migratedValues.imagenesAdicionalesPublicIds),
                service.id,
            ]);
        } catch (error) {
            throw toMigrationStageError("update", error);
        }

        if (updateResult.rowCount !== 1) {
            throw new MigrationStageError("update", "-", true);
        }
        phase = "update-executed";

        phase = "commit-sent";
        currentStage = "commit";
        try {
            await client.query("COMMIT");
        } catch (error) {
            throw toMigrationStageError("commit", error, false);
        }
        phase = "commit-confirmed";
        return { status: "confirmed" };
    } catch (error) {
        if (phase === "commit-sent") {
            currentStage = "commit-verification";
            const commitDiagnostic = toMigrationStageError("commit", error, false);
            try {
                const verifiedService = await readServiceForVerification(pool, service.id);
                if (verifiedService && migratedValues && isMigrationPersisted(verifiedService, migratedValues)) {
                    console.warn("ADVERTENCIA: se recupero una confirmacion ambigua de PostgreSQL; no se eliminaran recursos remotos.");
                    return { status: "confirmed" };
                }

                if (verifiedService && isOriginalServicePersisted(verifiedService, service)) {
                    return { status: "failed-cleanup-allowed", diagnostic: commitDiagnostic };
                }
            } catch {
                console.warn("ADVERTENCIA: no se pudo verificar el resultado del COMMIT; se requiere revision manual.");
                return { status: "manual-review", diagnostic: new MigrationStageError("commit-verification", "-", false) };
            }

            console.warn("ADVERTENCIA: resultado de COMMIT ambiguo; se requiere revision manual.");
            return { status: "manual-review", diagnostic: new MigrationStageError("commit-verification", "-", false) };
        }

        if (client && phase !== "before-transaction" && phase !== "commit-confirmed") {
            try {
                await client.query("ROLLBACK");
            } catch {
                console.warn("ADVERTENCIA: no se pudo confirmar el rollback de PostgreSQL.");
            }
        }

        throw toMigrationStageError(currentStage, error);
    } finally {
        client?.release();
    }
};

const runDryRun = async (pool: Pool): Promise<number> => {
    const counters = initialCounters();

    const result = await pool.query<ServicioRow>(`
        SELECT id, nombre, imagen, imagenes_adicionales, imagen_public_id, imagenes_adicionales_public_ids
        FROM public.servicios
        ORDER BY id
    `);

    const reports = await analyzeServices(result.rows, counters);

    console.log("Inventario de imagenes de servicios (dry-run)\n");
    for (const report of reports) {
        printReference(report);
    }

    markDuplicateContents(reports, counters);
    printSummary(counters);

    return hasBlockingErrors(counters) ? 1 : 0;
};

const runApply = async (pool: Pool, serviceId: number): Promise<number> => {
    const counters = initialCounters();

    const result = await pool.query<ServicioRow>(`
        SELECT id, nombre, imagen, imagenes_adicionales, imagen_public_id, imagenes_adicionales_public_ids
        FROM public.servicios
        WHERE id = $1
    `, [serviceId]);

    if (result.rows.length === 0) {
        console.error("No se encontro el servicio solicitado para migracion.");
        return 1;
    }

    const service = result.rows[0];
    const reports = await analyzeServices(result.rows, counters);
    const localCandidates = reports.filter((report) => (
        report.status === "valid-local"
        && report.metadataIssues?.length === 0
        && report.filePath
        && report.proposedPublicId
    ));

    console.log(`Migracion controlada de imagenes de servicio (apply) servicio=${serviceId}\n`);
    for (const report of reports) {
        printReference(report);
    }

    if (hasBlockingErrors(counters)) {
        console.error("Migracion detenida: el servicio tiene referencias invalidas o metadata inconsistente.");
        printSummary(counters);
        return 1;
    }

    const duplicateGroupsWithinService = findDuplicateGroupsWithinService(localCandidates);
    if (duplicateGroupsWithinService.length > 0) {
        printDuplicateGroupsWithinService(duplicateGroupsWithinService);
        console.error("Migracion detenida: existen contenidos locales duplicados dentro del servicio solicitado.");
        return 1;
    }

    if (localCandidates.length === 0) {
        console.log("No hay candidatos locales para migrar en este servicio.");
        printSummary(counters);
        return 0;
    }

    let uploadedImages: UploadedMigrationImage[] = [];
    let deleteImage: ((publicId: string) => Promise<void>) | null = null;

    try {
        const uploadResult = await uploadMigrationCandidates(serviceId, localCandidates);
        uploadedImages = uploadResult.uploadedImages;
        deleteImage = uploadResult.deleteImage;

        const persistResult = await persistMigratedService(pool, service, uploadedImages);
        if (persistResult.status === "manual-review") {
            printDiagnostic(persistResult.diagnostic);
            console.error("Error en migracion controlada: resultado de PostgreSQL ambiguo; se requiere revision manual.");
            return 1;
        }

        if (persistResult.status === "failed-cleanup-allowed") {
            printDiagnostic(persistResult.diagnostic);
            await cleanupCreatedImages(uploadedImages, deleteImage);
            console.error("Error en migracion controlada: PostgreSQL no confirmo los cambios y se ejecuto limpieza compensatoria.");
            return 1;
        }

        console.log("Migracion del servicio confirmada en PostgreSQL.");
        return 0;
    } catch (error) {
        const migrationError = error instanceof MigrationStageError ? error : null;
        if (migrationError) {
            printDiagnostic(migrationError);
        }

        if (deleteImage && (!migrationError || migrationError.cleanupAllowed)) {
            await cleanupCreatedImages(uploadedImages, deleteImage);
        }

        console.error("Error en migracion controlada: no se pudo completar la migracion del servicio.");
        return 1;
    }
};

const run = async (): Promise<number> => {
    let pool: Pool | null = null;

    try {
        const db = await import("../db.js");
        pool = db.pool;

        const exitCode = mode.name === "dry-run"
            ? await runDryRun(pool)
            : await runApply(pool, mode.serviceId);

        return exitCode;
    } catch {
        console.error("Error en migracion de imagenes: no se pudo consultar PostgreSQL o completar la operacion.");
        return 1;
    } finally {
        if (pool) {
            await pool.end();
        }
    }
};

const exitCode = await run();
process.exit(exitCode);
