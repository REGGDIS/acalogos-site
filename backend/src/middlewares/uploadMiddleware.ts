import multer from "multer";
import type { NextFunction, Request, Response } from "express";
import {
    allowedMimeTypes,
    MAX_IMAGE_SIZE_BYTES,
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

const sendUploadError = (res: Response, statusCode: number, message: string): void => {
    res.status(statusCode).json({ status: "error", message });
};

const detectImageMimeType = (buffer: Buffer): AllowedMimeType | null => {
    if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
        return "image/jpeg";
    }

    if (
        buffer.length >= 8
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
        buffer.length >= 12
        && buffer.toString("ascii", 0, 4) === "RIFF"
        && buffer.toString("ascii", 8, 12) === "WEBP"
    ) {
        return "image/webp";
    }

    return null;
};

export const validateUploadedImage = (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.file) {
        next();
        return;
    }

    try {
        if (req.file.size === 0 || req.file.buffer.length === 0) {
            throw new UploadHttpError(400, "El archivo subido está vacío.");
        }

        if (req.file.size > MAX_IMAGE_SIZE_BYTES || req.file.buffer.length > MAX_IMAGE_SIZE_BYTES) {
            throw new UploadHttpError(413, "El archivo supera el tamaño máximo permitido.");
        }

        if (!allowedMimeTypes.has(req.file.mimetype)) {
            throw new UploadHttpError(415, "Formato de imagen no permitido.");
        }

        const detectedMimeType = detectImageMimeType(req.file.buffer);
        if (!detectedMimeType || req.file.mimetype !== detectedMimeType) {
            throw new UploadHttpError(415, "Formato de imagen no permitido.");
        }

        req.file.mimetype = detectedMimeType;
        next();
    } catch (error) {
        next(error);
    }
};

export const handleUploadError = (err: Error, _req: Request, res: Response, next: NextFunction): void => {
    if (res.headersSent) {
        next(err);
        return;
    }

    if (err instanceof UploadHttpError) {
        sendUploadError(res, err.statusCode, err.message);
        return;
    }

    if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
            sendUploadError(res, 413, "La imagen supera el tamaño máximo permitido de 5 MiB.");
            return;
        }

        sendUploadError(res, 400, "Solicitud de archivo inválida.");
        return;
    }

    sendUploadError(res, 500, "Error interno del servidor.");
};

const upload = multer({
    storage: multer.memoryStorage(),
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
