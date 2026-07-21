import { z } from "zod";

export type ContactSubmission = {
    nombre: string;
    email: string;
    mensaje: string;
    privacyNoticeVersion: string;
};

export type ContactValidationResult =
    | { success: true; honeypot: true }
    | { success: true; honeypot: false; data: ContactSubmission }
    | { success: false; fields: string[] };

export const normalizeContactEmail = (value: string): string => {
    const trimmed = value.trim();
    const separatorIndex = trimmed.lastIndexOf("@");
    if (separatorIndex < 0) return trimmed;

    return `${trimmed.slice(0, separatorIndex)}@${trimmed.slice(separatorIndex + 1).toLowerCase()}`;
};

const containsNul = (value: string): boolean => value.includes("\u0000");
const containsNameControl = (value: string): boolean => /[\u0000-\u001f\u007f]/u.test(value);
const containsMessageControl = (value: string): boolean => /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(value);

export const contactEmailSchema = z.string()
    .refine((value) => !containsNul(value))
    .transform(normalizeContactEmail)
    .pipe(z.string().email().max(254));

const envelopeSchema = z.strictObject({
    nombre: z.unknown().optional(),
    email: z.unknown().optional(),
    mensaje: z.unknown().optional(),
    privacyNoticeVersion: z.unknown().optional(),
    website: z.string().max(200).optional(),
});

const validationFields = (error: z.ZodError): string[] => {
    const fields = new Set<string>();
    const allowedFields = new Set(["nombre", "email", "mensaje", "privacyNoticeVersion", "website"]);

    for (const issue of error.issues) {
        if (issue.code === "unrecognized_keys") {
            fields.add("unexpected_fields");
            continue;
        }

        const field = issue.path[0];
        fields.add(typeof field === "string" && allowedFields.has(field) ? field : "unexpected_fields");
    }

    return [...fields].sort();
};

const createSubmissionSchema = (privacyNoticeVersion: string) => z.strictObject({
    nombre: z.string()
        .refine((value) => !containsNameControl(value))
        .transform((value) => value.normalize("NFC").trim())
        .pipe(z.string().min(2).max(100)),
    email: contactEmailSchema,
    mensaje: z.string()
        .transform((value) => value.replace(/\r\n?/g, "\n").normalize("NFC").trim())
        .refine((value) => !containsMessageControl(value))
        .pipe(z.string().min(10).max(4_000)),
    privacyNoticeVersion: z.string()
        .refine((value) => !containsNul(value))
        .refine(
            (value) => value === privacyNoticeVersion,
            { message: "Versión del aviso de privacidad no válida." },
        ),
    website: z.string().max(200).optional(),
});

export const validateContactPayload = (
    payload: unknown,
    privacyNoticeVersion: string,
): ContactValidationResult => {
    const envelopeResult = envelopeSchema.safeParse(payload);
    if (!envelopeResult.success) {
        return { success: false, fields: validationFields(envelopeResult.error) };
    }

    if ((envelopeResult.data.website ?? "").trim().length > 0) {
        return { success: true, honeypot: true };
    }

    const submissionResult = createSubmissionSchema(privacyNoticeVersion).safeParse(payload);
    if (!submissionResult.success) {
        return { success: false, fields: validationFields(submissionResult.error) };
    }

    const { nombre, email, mensaje, privacyNoticeVersion: acceptedVersion } = submissionResult.data;
    return {
        success: true,
        honeypot: false,
        data: {
            nombre,
            email,
            mensaje,
            privacyNoticeVersion: acceptedVersion,
        },
    };
};
