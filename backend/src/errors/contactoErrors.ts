export type ContactNotificationFailureReason = "timeout" | "provider_http";

export class ContactPersistenceError extends Error {
    constructor() {
        super("No se pudo persistir el contacto.");
        this.name = "ContactPersistenceError";
    }
}

export class ContactNotificationError extends Error {
    constructor(public readonly reason: ContactNotificationFailureReason) {
        super("No se pudo enviar la notificación del contacto.");
        this.name = "ContactNotificationError";
    }
}
