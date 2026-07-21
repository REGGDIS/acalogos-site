import { ContactNotificationError } from "../errors/contactoErrors.js";
import type { ContactSubmission } from "../validation/contactoValidation.js";

const BREVO_EMAIL_API_URL = "https://api.brevo.com/v3/smtp/email";

export interface ContactNotifier {
    send(submission: ContactSubmission): Promise<void>;
}

export type BrevoNotificationConfig = {
    apiKey: string;
    toEmail: string;
    fromEmail: string;
    timeoutMs: number;
};

export type FetchImplementation = typeof fetch;

const escapeHtml = (value: string): string => value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const buildHtml = (submission: ContactSubmission): string => {
    const nombre = escapeHtml(submission.nombre);
    const email = escapeHtml(submission.email);
    const mensaje = escapeHtml(submission.mensaje).replace(/\n/g, "<br>");

    return `<p><strong>Nombre:</strong> ${nombre}</p>`
        + `<p><strong>Correo:</strong> ${email}</p>`
        + `<p><strong>Mensaje:</strong><br>${mensaje}</p>`;
};

const buildText = (submission: ContactSubmission): string => [
    `Nombre: ${submission.nombre}`,
    `Correo: ${submission.email}`,
    "Mensaje:",
    submission.mensaje,
].join("\n");

export class BrevoContactNotifier implements ContactNotifier {
    constructor(
        private readonly config: BrevoNotificationConfig,
        private readonly fetchImplementation: FetchImplementation = fetch,
    ) {}

    async send(submission: ContactSubmission): Promise<void> {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);

        try {
            const response = await this.fetchImplementation(BREVO_EMAIL_API_URL, {
                method: "POST",
                headers: {
                    accept: "application/json",
                    "api-key": this.config.apiKey,
                    "content-type": "application/json",
                },
                body: JSON.stringify({
                    sender: { name: "Acalogos", email: this.config.fromEmail },
                    to: [{ email: this.config.toEmail }],
                    replyTo: { email: submission.email },
                    subject: "Nuevo mensaje desde el formulario de Acalogos",
                    textContent: buildText(submission),
                    htmlContent: buildHtml(submission),
                }),
                signal: controller.signal,
            });

            if (response.status !== 201) {
                throw new ContactNotificationError("provider_http");
            }
        } catch (error) {
            if (error instanceof ContactNotificationError) throw error;
            if (controller.signal.aborted) throw new ContactNotificationError("timeout");
            throw new ContactNotificationError("provider_http");
        } finally {
            clearTimeout(timeout);
        }
    }
}
