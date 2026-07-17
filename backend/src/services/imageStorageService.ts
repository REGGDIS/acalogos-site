import { v2 as cloudinary, type UploadApiOptions, type UploadApiResponse } from "cloudinary";
import { config } from "../config.js";

const CLOUDINARY_BASE_FOLDER = "acalogos/servicios";

cloudinary.config({
    cloud_name: config.cloudinary.cloudName,
    api_key: config.cloudinary.apiKey,
    api_secret: config.cloudinary.apiSecret,
});

export interface StoredImage {
    secureUrl: string;
    publicId: string;
    width: number;
    height: number;
    format: string;
    bytes: number;
}

const toStoredImage = (result: UploadApiResponse): StoredImage => ({
    secureUrl: result.secure_url,
    publicId: result.public_id,
    width: result.width,
    height: result.height,
    format: result.format,
    bytes: result.bytes,
});

type CloudinaryExistingResource = {
    secure_url: string;
    public_id: string;
    width: number;
    height: number;
    format: string;
    bytes: number;
};

const toStoredExistingImage = (result: CloudinaryExistingResource): StoredImage => ({
    secureUrl: result.secure_url,
    publicId: result.public_id,
    width: result.width,
    height: result.height,
    format: result.format,
    bytes: result.bytes,
});

const isExistingResource = (value: unknown): value is CloudinaryExistingResource => {
    if (!value || typeof value !== "object") return false;

    const resource = value as Record<string, unknown>;
    return typeof resource.secure_url === "string"
        && typeof resource.public_id === "string"
        && typeof resource.width === "number"
        && typeof resource.height === "number"
        && typeof resource.format === "string"
        && typeof resource.bytes === "number";
};

const getCloudinaryHttpCode = (error: unknown): unknown => {
    if (!error || typeof error !== "object") return undefined;

    const topLevelError = error as { http_code?: unknown; error?: unknown };
    if (topLevelError.http_code !== undefined) {
        return topLevelError.http_code;
    }

    if (!topLevelError.error || typeof topLevelError.error !== "object") {
        return undefined;
    }

    return (topLevelError.error as { http_code?: unknown }).http_code;
};

export const uploadImage = async (
    buffer: Buffer,
    options?: {
        publicId?: string;
        overwrite?: boolean;
    },
): Promise<StoredImage> => {
    if (buffer.length === 0) {
        throw new Error("No se pudo almacenar la imagen.");
    }

    const publicId = options?.publicId?.trim();
    if (options?.publicId !== undefined && !publicId) {
        throw new Error("No se pudo almacenar la imagen.");
    }

    const uploadOptions: UploadApiOptions = {
        resource_type: "image",
    };

    if (publicId) {
        uploadOptions.public_id = publicId;
        if (options?.overwrite !== undefined) {
            uploadOptions.overwrite = options.overwrite;
        }
    } else {
        uploadOptions.folder = CLOUDINARY_BASE_FOLDER;
    }

    return new Promise<StoredImage>((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(uploadOptions, (error, result) => {
            if (error || !result) {
                reject(new Error("No se pudo almacenar la imagen."));
                return;
            }

            resolve(toStoredImage(result));
        });

        uploadStream.on("error", () => {
            reject(new Error("No se pudo almacenar la imagen."));
        });

        uploadStream.end(buffer);
    });
};

export const getImageByPublicId = async (publicId: string): Promise<StoredImage | null> => {
    const trimmedPublicId = publicId.trim();
    if (!trimmedPublicId) {
        throw new Error("No se pudo consultar la imagen.");
    }

    try {
        const result: unknown = await cloudinary.api.resource(trimmedPublicId, {
            resource_type: "image",
        });

        if (!isExistingResource(result)) {
            throw new Error("No se pudo consultar la imagen.");
        }

        return toStoredExistingImage(result);
    } catch (error) {
        if (getCloudinaryHttpCode(error) === 404) {
            return null;
        }

        throw new Error("No se pudo consultar la imagen.");
    }
};

export const deleteImage = async (publicId: string): Promise<void> => {
    const trimmedPublicId = publicId.trim();
    if (!trimmedPublicId) {
        throw new Error("No se pudo eliminar la imagen.");
    }

    try {
        const result = await cloudinary.uploader.destroy(trimmedPublicId, {
            resource_type: "image",
        });

        if (result.result === "ok" || result.result === "not found") {
            return;
        }
    } catch {
        throw new Error("No se pudo eliminar la imagen.");
    }

    throw new Error("No se pudo eliminar la imagen.");
};
