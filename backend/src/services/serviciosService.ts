import { pool } from "../db.js";
import path from "path";
import fs from "fs-extra";
import type { PoolClient } from "pg";
import { ImagenReferenciaNoEncontradaError, ServicioNoEncontradoError } from "../errors/serviciosErrors.js";
import { deleteImage, uploadImage, type StoredImage } from "./imageStorageService.js";

const dataFilePath = path.resolve("src/data/services.json");

type ServicioFallback = {
    id: number;
    nombre: string;
    descripcion: string;
    precio: string;
    categoria: string[];
    imagen: string;
    imagenes_adicionales?: string[];
    imagenesAdicionales?: string[];
};

const normalizeServicio = (servicio: ServicioFallback) => {
    const { imagenesAdicionales, ...normalizedServicio } = servicio;

    return {
        ...normalizedServicio,
        imagenes_adicionales: servicio.imagenes_adicionales ?? imagenesAdicionales ?? [],
    };
};

const readFallbackData = async (): Promise<ReturnType<typeof normalizeServicio>[]> => {
    try {
        const raw = await fs.readFile(dataFilePath, "utf-8");
        const servicios = JSON.parse(raw) as ServicioFallback[];
        return servicios.map(normalizeServicio);
    } catch (err) {
        throw new Error(`No se pudo leer el fallback de datos: ${err}`);
    }
};

type ImagenesAdicionalesPublicIds = Record<string, string>;

const warnRemoteCleanupFailed = (): void => {
    console.warn("No se pudo completar el cleanup remoto de imagen.");
};

const warnCommitVerificationFailed = (): void => {
    console.warn("No se pudo verificar el resultado del commit de imagen; se conserva el recurso remoto.");
};

const normalizeImagenesAdicionalesPublicIds = (value: unknown): ImagenesAdicionalesPublicIds => {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return {};
    }

    return Object.fromEntries(
        Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
    );
};

const cleanupNewImage = async (): Promise<void> => {
    warnRemoteCleanupFailed();
};

const deleteNewImage = async (publicId: string): Promise<void> => {
    try {
        await deleteImage(publicId);
    } catch {
        await cleanupNewImage();
    }
};

const isPublicIdReferenced = async (publicId: string): Promise<boolean> => {
    const result = await pool.query<{ referenced: boolean }>(
        `SELECT EXISTS (
            SELECT 1
            FROM servicios
            WHERE imagen_public_id = $1
                OR EXISTS (
                    SELECT 1
                    FROM jsonb_each_text(imagenes_adicionales_public_ids) AS refs(key, value)
                    WHERE refs.value = $1
                )
        ) AS referenced`,
        [publicId],
    );

    return result.rows[0]?.referenced ?? true;
};

const deleteImageIfUnreferenced = async (publicId: string | null | undefined): Promise<void> => {
    if (!publicId) return;

    try {
        const referenced = await isPublicIdReferenced(publicId);
        if (!referenced) {
            await deleteImage(publicId);
        }
    } catch {
        warnRemoteCleanupFailed();
    }
};

const isPrimaryImagePersisted = async (id: string, image: StoredImage): Promise<boolean | null> => {
    try {
        const result = await pool.query<{ exists: boolean }>(
            "SELECT EXISTS (SELECT 1 FROM servicios WHERE id = $1 AND imagen = $2 AND imagen_public_id = $3) AS exists",
            [id, image.secureUrl, image.publicId],
        );

        return result.rows[0]?.exists ?? false;
    } catch {
        warnCommitVerificationFailed();
        return null;
    }
};

const isAdditionalImagePersisted = async (id: string, image: StoredImage): Promise<boolean | null> => {
    try {
        const result = await pool.query<{ exists: boolean }>(
            `SELECT EXISTS (
                SELECT 1
                FROM servicios
                WHERE id = $1
                    AND $2 = ANY(imagenes_adicionales)
                    AND imagenes_adicionales_public_ids ->> $2 = $3
            ) AS exists`,
            [id, image.secureUrl, image.publicId],
        );

        return result.rows[0]?.exists ?? false;
    } catch {
        warnCommitVerificationFailed();
        return null;
    }
};

const rollbackIfNeeded = async (client: PoolClient | null, transactionStarted: boolean): Promise<boolean> => {
    if (!client || !transactionStarted) return true;

    try {
        await client.query("ROLLBACK");
        return true;
    } catch {
        console.warn("No se pudo revertir la transaccion de imagen.");
        return false;
    }
};

const discardClient = (client: PoolClient, reason: string): void => {
    client.release(new Error(reason));
};

export const obtenerTodosLosServicios = async () => {
    try {
        const result = await pool.query("SELECT * FROM servicios ORDER BY id");
        return result.rows;
    } catch (error) {
        // Si falla la BD, devolver datos de ejemplo desde JSON
        console.warn("DB error al obtener todos los servicios:", error);
        try {
            const fallback = await readFallbackData();
            console.info("Usando datos de fallback desde:", dataFilePath);
            return fallback;
        } catch (err) {
            console.error("No se pudo leer el fallback, devolviendo array vacío:", err);
            return [];
        }
    }
};

export const obtenerServicioPorId = async (id: string) => {
    try {
        const result = await pool.query("SELECT * FROM servicios WHERE id = $1", [id]);
        return result.rows[0] || null;
    } catch (error) {
        // Fallback a JSON
        try {
            const fallback = await readFallbackData();
            const found = fallback.find((servicio) => String(servicio.id) === String(id));
            return found || null;
        } catch (err) {
            throw new Error(`Error al obtener el servicio con ID ${id}: ${error}`);
        }
    }
};

export const actualizarImagenPrincipal = async (id: string, buffer: Buffer): Promise<string> => {
    const nuevaImagen = await uploadImage(buffer);
    let client: PoolClient | null = null;
    let transactionStarted = false;
    let commitAttempted = false;
    let commitConfirmed = false;
    let previousPublicId: string | null = null;

    try {
        client = await pool.connect();
        await client.query("BEGIN");
        transactionStarted = true;

        const result = await client.query<{ imagen: string | null; imagen_public_id: string | null }>(
            "SELECT imagen, imagen_public_id FROM servicios WHERE id = $1 FOR UPDATE",
            [id],
        );

        if (result.rows.length === 0) {
            throw new ServicioNoEncontradoError();
        }

        previousPublicId = result.rows[0].imagen_public_id;

        await client.query(
            "UPDATE servicios SET imagen = $1, imagen_public_id = $2, updated_at = NOW() WHERE id = $3",
            [nuevaImagen.secureUrl, nuevaImagen.publicId, id],
        );

        commitAttempted = true;
        await client.query("COMMIT");
        commitConfirmed = true;
    } catch (error) {
        if (!commitAttempted) {
            const rollbackSucceeded = await rollbackIfNeeded(client, transactionStarted);
            if (!rollbackSucceeded && client) {
                discardClient(client, "Rollback de imagen fallido.");
                client = null;
            }
            await deleteNewImage(nuevaImagen.publicId);
        } else if (!commitConfirmed) {
            client?.release(error instanceof Error ? error : new Error("Commit de imagen incierto."));
            client = null;

            const persisted = await isPrimaryImagePersisted(id, nuevaImagen);
            if (persisted === false) {
                await deleteNewImage(nuevaImagen.publicId);
            }
        }

        throw error;
    } finally {
        client?.release();
    }

    await deleteImageIfUnreferenced(previousPublicId);
    return nuevaImagen.secureUrl;
};

export const eliminarImagenPrincipal = async (id: string): Promise<void> => {
    let client: PoolClient | null = null;
    let oldPublicId: string | null = null;
    let commitAttempted = false;
    let commitConfirmed = false;

    try {
        client = await pool.connect();
        await client.query("BEGIN");

        const result = await client.query<{ imagen: string | null; imagen_public_id: string | null }>(
            "SELECT imagen, imagen_public_id FROM servicios WHERE id = $1 FOR UPDATE",
            [id],
        );

        if (result.rows.length === 0) {
            throw new ServicioNoEncontradoError();
        }

        oldPublicId = result.rows[0].imagen_public_id;

        await client.query(
            "UPDATE servicios SET imagen = NULL, imagen_public_id = NULL, updated_at = NOW() WHERE id = $1",
            [id],
        );

        commitAttempted = true;
        await client.query("COMMIT");
        commitConfirmed = true;
    } catch (error) {
        if (!commitAttempted) {
            const rollbackSucceeded = await rollbackIfNeeded(client, true);
            if (!rollbackSucceeded && client) {
                discardClient(client, "Rollback de imagen fallido.");
                client = null;
            }
        } else if (!commitConfirmed) {
            client?.release(error instanceof Error ? error : new Error("Commit de imagen incierto."));
            client = null;
        }

        throw error;
    } finally {
        client?.release();
    }

    await deleteImageIfUnreferenced(oldPublicId);
};

export const agregarImagenAdicional = async (id: string, buffer: Buffer): Promise<string[]> => {
    const nuevaImagen = await uploadImage(buffer);
    let client: PoolClient | null = null;
    let transactionStarted = false;
    let commitAttempted = false;
    let commitConfirmed = false;
    let nuevasImagenes: string[] = [];

    try {
        client = await pool.connect();
        await client.query("BEGIN");
        transactionStarted = true;

        const result = await client.query<{
            imagenes_adicionales: string[] | null;
            imagenes_adicionales_public_ids: unknown;
        }>(
            "SELECT imagenes_adicionales, imagenes_adicionales_public_ids FROM servicios WHERE id = $1 FOR UPDATE",
            [id],
        );

        if (result.rows.length === 0) {
            throw new ServicioNoEncontradoError();
        }

        const imagenesActuales = result.rows[0].imagenes_adicionales ?? [];
        nuevasImagenes = Array.from(new Set([...imagenesActuales, nuevaImagen.secureUrl]));
        const nuevosPublicIds = {
            ...normalizeImagenesAdicionalesPublicIds(result.rows[0].imagenes_adicionales_public_ids),
            [nuevaImagen.secureUrl]: nuevaImagen.publicId,
        };

        await client.query(
            `UPDATE servicios
            SET imagenes_adicionales = $1,
                imagenes_adicionales_public_ids = $2::jsonb,
                updated_at = NOW()
            WHERE id = $3`,
            [nuevasImagenes, JSON.stringify(nuevosPublicIds), id],
        );

        commitAttempted = true;
        await client.query("COMMIT");
        commitConfirmed = true;
    } catch (error) {
        if (!commitAttempted) {
            const rollbackSucceeded = await rollbackIfNeeded(client, transactionStarted);
            if (!rollbackSucceeded && client) {
                discardClient(client, "Rollback de imagen fallido.");
                client = null;
            }
            await deleteNewImage(nuevaImagen.publicId);
        } else if (!commitConfirmed) {
            client?.release(error instanceof Error ? error : new Error("Commit de imagen incierto."));
            client = null;

            const persisted = await isAdditionalImagePersisted(id, nuevaImagen);
            if (persisted === false) {
                await deleteNewImage(nuevaImagen.publicId);
            }
        }

        throw error;
    } finally {
        client?.release();
    }

    return nuevasImagenes;
};

export const eliminarImagenAdicional = async (id: string, imagen: string): Promise<string[]> => {
    const imagenNormalizada = typeof imagen === "string" ? imagen.trim() : "";
    if (!imagenNormalizada) {
        throw new ImagenReferenciaNoEncontradaError();
    }

    let client: PoolClient | null = null;
    let oldPublicId: string | null = null;
    let nuevasImagenes: string[] = [];
    let commitAttempted = false;
    let commitConfirmed = false;

    try {
        client = await pool.connect();
        await client.query("BEGIN");

        const result = await client.query<{
            imagenes_adicionales: string[] | null;
            imagenes_adicionales_public_ids: unknown;
        }>(
            "SELECT imagenes_adicionales, imagenes_adicionales_public_ids FROM servicios WHERE id = $1 FOR UPDATE",
            [id],
        );

        if (result.rows.length === 0) {
            throw new ServicioNoEncontradoError();
        }

        const imagenesActuales = result.rows[0].imagenes_adicionales ?? [];
        if (!imagenesActuales.includes(imagenNormalizada)) {
            throw new ImagenReferenciaNoEncontradaError();
        }

        const publicIdsActuales = normalizeImagenesAdicionalesPublicIds(result.rows[0].imagenes_adicionales_public_ids);
        oldPublicId = publicIdsActuales[imagenNormalizada] ?? null;
        delete publicIdsActuales[imagenNormalizada];
        nuevasImagenes = imagenesActuales.filter((img) => img !== imagenNormalizada);

        await client.query(
            `UPDATE servicios
            SET imagenes_adicionales = $1,
                imagenes_adicionales_public_ids = $2::jsonb,
                updated_at = NOW()
            WHERE id = $3`,
            [nuevasImagenes, JSON.stringify(publicIdsActuales), id],
        );

        commitAttempted = true;
        await client.query("COMMIT");
        commitConfirmed = true;
    } catch (error) {
        if (!commitAttempted) {
            const rollbackSucceeded = await rollbackIfNeeded(client, true);
            if (!rollbackSucceeded && client) {
                discardClient(client, "Rollback de imagen fallido.");
                client = null;
            }
        } else if (!commitConfirmed) {
            client?.release(error instanceof Error ? error : new Error("Commit de imagen incierto."));
            client = null;
        }

        throw error;
    } finally {
        client?.release();
    }

    await deleteImageIfUnreferenced(oldPublicId);
    return nuevasImagenes;
};
