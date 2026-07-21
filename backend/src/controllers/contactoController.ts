import type { NextFunction, Request, Response } from "express";
import { ContactPersistenceError } from "../errors/contactoErrors.js";
import type { ContactSubmissionService } from "../services/contactoService.js";
import { validateContactPayload } from "../validation/contactoValidation.js";

const ACCEPTED_RESPONSE = { status: "accepted", message: "Mensaje recibido." } as const;

export const createContactoController = (
    service: ContactSubmissionService,
    privacyNoticeVersion: string,
) => async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const validation = validateContactPayload(req.body, privacyNoticeVersion);

    if (!validation.success) {
        res.status(422).json({
            status: "error",
            code: "VALIDATION_ERROR",
            message: "Revisa los campos enviados.",
            fields: validation.fields,
        });
        return;
    }

    if (validation.honeypot) {
        res.status(202).json(ACCEPTED_RESPONSE);
        return;
    }

    try {
        const outcome = await service.submit(validation.data);
        if (outcome === "created") {
            res.status(201).json({ status: "success", message: "Mensaje recibido." });
            return;
        }

        res.status(202).json(ACCEPTED_RESPONSE);
    } catch (error) {
        if (error instanceof ContactPersistenceError) {
            res.status(503).json({
                status: "error",
                code: "SERVICE_UNAVAILABLE",
                message: "No pudimos recibir el mensaje. Inténtalo más tarde.",
            });
            return;
        }

        next(error);
    }
};
