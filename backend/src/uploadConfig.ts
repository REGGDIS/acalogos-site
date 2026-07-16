import path from "path";

export const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;
export const uploadPath = path.resolve("dist/public/assets/images/servicios");

export const allowedImageTypes = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
} as const;

export type AllowedMimeType = keyof typeof allowedImageTypes;

export const allowedMimeTypes = new Set<string>(Object.keys(allowedImageTypes));
