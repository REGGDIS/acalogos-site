import express from "express";
import type { NextFunction, Request, Response, Router } from "express";
import cors, { type CorsOptions } from "cors";
import multer from "multer";
import path from "path";
import { UploadHttpError } from "./middlewares/uploadMiddleware.js";

export type AppDependencies = {
    corsOrigins: string[];
    publicAssetsPath: string;
    serviciosRouter: Router;
    authRouter: Router;
    contactoRouter?: Router;
};

type BodyParserError = Error & {
    type?: string;
};

const isBodyParserError = (error: unknown, type: string): boolean => (
    error instanceof Error
    && (error as BodyParserError).type === type
);

export const createApp = (dependencies: AppDependencies) => {
    const app = express();

    const corsOptions: CorsOptions = {
        origin: (origin, callback) => {
            if (!origin) {
                callback(null, true);
                return;
            }

            const normalizedOrigin = origin.trim().replace(/\/+$/, "");
            if (dependencies.corsOrigins.includes(normalizedOrigin)) {
                callback(null, true);
                return;
            }

            callback(new Error("Origen CORS no autorizado."));
        },
        methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization"],
    };

    if (dependencies.contactoRouter) {
        app.use("/contacto", cors(corsOptions), dependencies.contactoRouter);
    }

    // Se conserva el parser JSON histórico para las rutas existentes.
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));

    app.use(cors(corsOptions));
    app.options("*", cors(corsOptions));

    app.use("/assets", express.static(dependencies.publicAssetsPath, {
        setHeaders: (res, filePath) => {
            const extension = path.extname(filePath).toLowerCase();
            const mimeTypes: Record<string, string> = {
                ".jpg": "image/jpeg",
                ".jpeg": "image/jpeg",
                ".png": "image/png",
                ".webp": "image/webp",
                ".gif": "image/gif",
            };
            if (mimeTypes[extension]) {
                res.setHeader("Content-Type", mimeTypes[extension]);
                res.setHeader("Access-Control-Allow-Origin", "*");
                res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
                res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
            }
        },
    }));

    app.use("/servicios", dependencies.serviciosRouter);
    app.use("/admin", dependencies.authRouter);
    app.get("/", (_req: Request, res: Response) => {
        res.send("Bienvenido al backend de ACA-Logos");
    });

    app.use((err: unknown, _req: Request, res: Response, next: NextFunction) => {
        if (res.headersSent) {
            next(err);
            return;
        }

        if (isBodyParserError(err, "entity.parse.failed")) {
            res.status(400).json({ status: "error", code: "INVALID_JSON", message: "Solicitud inválida." });
            return;
        }

        if (isBodyParserError(err, "entity.too.large")) {
            res.status(413).json({
                status: "error",
                code: "PAYLOAD_TOO_LARGE",
                message: "Solicitud demasiado grande.",
            });
            return;
        }

        if (err instanceof UploadHttpError) {
            res.status(err.statusCode).json({ status: "error", message: err.message });
            return;
        }

        if (err instanceof multer.MulterError) {
            const statusCode = err.code === "LIMIT_FILE_SIZE" ? 413 : 400;
            const message = err.code === "LIMIT_FILE_SIZE"
                ? "La imagen supera el tamaño máximo permitido de 5 MiB."
                : "Solicitud de archivo inválida.";
            res.status(statusCode).json({ status: "error", message });
            return;
        }

        if (err instanceof Error && err.message === "Origen CORS no autorizado.") {
            res.status(403).json({ status: "error", message: "Origen no autorizado." });
            return;
        }

        console.error("unexpected_error", {
            category: err instanceof Error ? err.name : "unknown",
        });
        res.status(500).json({
            status: "error",
            code: "INTERNAL_ERROR",
            message: "Error interno del servidor.",
        });
    });

    return app;
};
