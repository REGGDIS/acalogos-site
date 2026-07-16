import path from "path";
import { fileURLToPath } from "url";

const currentFilePath = fileURLToPath(import.meta.url);
const currentDirPath = path.dirname(currentFilePath);
const backendRootPath = path.basename(currentDirPath) === "src" || path.basename(currentDirPath) === "dist"
    ? path.dirname(currentDirPath)
    : currentDirPath;

export const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;
export const publicAssetsPath = path.join(backendRootPath, "src", "public", "assets");
export const uploadPath = path.join(publicAssetsPath, "images", "servicios");

export const allowedImageTypes = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
} as const;

export type AllowedMimeType = keyof typeof allowedImageTypes;

export const allowedMimeTypes = new Set<string>(Object.keys(allowedImageTypes));
