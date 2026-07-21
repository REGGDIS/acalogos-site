import express, { Router } from "express";
import type { Request, Response, NextFunction } from "express";
import { rateLimit } from "express-rate-limit";
import { createContactoController } from "../controllers/contactoController.js";
import type { ContactSubmissionService } from "../services/contactoService.js";

export type ContactoRouterOptions = {
    service: ContactSubmissionService;
    privacyNoticeVersion: string;
    rateLimitWindowMs: number;
    rateLimitMax: number;
};

const requireJson = (req: Request, res: Response, next: NextFunction): void => {
    if (req.is("application/json") !== "application/json") {
        res.status(415).json({
            status: "error",
            code: "UNSUPPORTED_MEDIA_TYPE",
            message: "Formato no soportado.",
        });
        return;
    }

    next();
};

export const createContactoRouter = (options: ContactoRouterOptions): Router => {
    const router = Router();
    const limiter = rateLimit({
        windowMs: options.rateLimitWindowMs,
        limit: options.rateLimitMax,
        keyGenerator: () => "contact-global",
        standardHeaders: true,
        legacyHeaders: false,
        handler: (_req, res) => {
            res.status(429).json({
                status: "error",
                code: "RATE_LIMITED",
                message: "Demasiados intentos. Inténtalo más tarde.",
            });
        },
    });

    router.post(
        "/",
        requireJson,
        express.json({ limit: "20kb" }),
        limiter,
        createContactoController(options.service, options.privacyNoticeVersion),
    );

    return router;
};
