import crypto from "crypto";
import fs from "fs/promises";
import multer from "multer";
import path from "path";
import type { NextFunction, Request, Response } from "express";
import {
    allowedImageTypes,
    allowedMimeTypes,
    MAX_IMAGE_SIZE_BYTES,
    uploadPath,
    type AllowedMimeType,
} from "../uploadConfig.js";

export class UploadHttpError extends Error {
    constructor(
        public readonly statusCode: number,
        message: string,
    ) {
        super(message);
        this.name = "UploadHttpError";
    }
}

const ensureUploadPath = async (): Promise<void> => {
    await fs.mkdir(uploadPath, { recursive: true });
};

const storage = multer.diskStorage({
    destination: (_req, _file, cb) => {
        ensureUploadPath()
            .then(() => cb(null, uploadPath))
            .catch((error: Error) => cb(error, uploadPath));
    },
    filename: (_req, _file, cb) => cb(null, `${crypto.randomUUID()}.upload`),
});

const detectImageMimeType = async (filePath: string): Promise<AllowedMimeType | null> => {
    const handle = await fs.open(filePath, "r");

    try {
        const buffer = Buffer.alloc(12);
        const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);

        if (bytesRead >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
            return "image/jpeg";
        }

        if (
            bytesRead >= 8
            && buffer[0] === 0x89
            && buffer[1] === 0x50
            && buffer[2] === 0x4e
            && buffer[3] === 0x47
            && buffer[4] === 0x0d
            && buffer[5] === 0x0a
            && buffer[6] === 0x1a
            && buffer[7] === 0x0a
        ) {
            return "image/png";
        }

        if (
            bytesRead >= 12
            && buffer.toString("ascii", 0, 4) === "RIFF"
            && buffer.toString("ascii", 8, 12) === "WEBP"
        ) {
            return "image/webp";
        }

        return null;
    } finally {
        await handle.close();
    }
};

export const deleteUploadedFile = async (file?: Express.Multer.File): Promise<void> => {
    if (!file) return;

    try {
        await fs.unlink(file.path);
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
            console.error("No se pudo eliminar el archivo subido:", error);
        }
    }
};

export const validateUploadedImage = async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    if (!req.file) {
        next();
        return;
    }

    try {
        if (req.file.size === 0) {
            throw new UploadHttpError(400, "El archivo subido está vacío.");
        }

        const detectedMimeType = await detectImageMimeType(req.file.path);
        if (!detectedMimeType || !allowedMimeTypes.has(req.file.mimetype) || req.file.mimetype !== detectedMimeType) {
            throw new UploadHttpError(415, "Formato de imagen no permitido.");
        }

        const extension = allowedImageTypes[detectedMimeType];
        const filename = `${crypto.randomUUID()}.${extension}`;
        const finalPath = path.join(uploadPath, filename);

        await fs.rename(req.file.path, finalPath);

        req.file.filename = filename;
        req.file.path = finalPath;
        req.file.mimetype = detectedMimeType;

        next();
    } catch (error) {
        await deleteUploadedFile(req.file);
        next(error);
    }
};

const upload = multer({
    storage,
    limits: {
        fileSize: MAX_IMAGE_SIZE_BYTES,
        files: 1,
    },
    fileFilter: (_req, file, cb) => {
        if (!allowedMimeTypes.has(file.mimetype)) {
            cb(new UploadHttpError(415, "Formato de imagen no permitido."));
            return;
        }

        cb(null, true);
    },
});

export default upload;
