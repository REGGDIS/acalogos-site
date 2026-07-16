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

export const uploadImage = async (
    buffer: Buffer,
    options?: {
        publicId?: string;
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
