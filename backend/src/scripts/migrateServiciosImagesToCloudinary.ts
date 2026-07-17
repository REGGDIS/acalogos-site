import { createHash } from "crypto";
import { createReadStream } from "fs";
import { open, stat } from "fs/promises";
import path from "path";
import type { Pool } from "pg";
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
};

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

const run = async (): Promise<number> => {
    let pool: Pool | null = null;
    const counters = initialCounters();
    const reports: ReferenceReport[] = [];

    try {
        const db = await import("../db.js");
        pool = db.pool;

        const result = await pool.query<ServicioRow>(`
            SELECT id, nombre, imagen, imagenes_adicionales, imagen_public_id, imagenes_adicionales_public_ids
            FROM public.servicios
            ORDER BY id
        `);

        counters.services = result.rows.length;

        for (const service of result.rows) {
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

        console.log("Inventario de imagenes de servicios (dry-run)\n");
        for (const report of reports) {
            printReference(report);
        }

        markDuplicateContents(reports, counters);
        printSummary(counters);

        const hasErrors = counters.missingFiles > 0 || counters.invalidFiles > 0 || counters.inconsistentMetadata > 0;
        return hasErrors ? 1 : 0;
    } catch {
        console.error("Error en inventario dry-run: no se pudo consultar PostgreSQL o completar el inventario.");
        return 1;
    } finally {
        if (pool) {
            await pool.end();
        }
    }
};

const exitCode = await run();
process.exit(exitCode);
