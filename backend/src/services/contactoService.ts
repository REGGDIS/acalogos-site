import {
    ContactNotificationError,
    ContactPersistenceError,
    type ContactNotificationFailureReason,
} from "../errors/contactoErrors.js";
import type { ContactRepository } from "../repositories/contactosRepository.js";
import type { ContactSubmission } from "../validation/contactoValidation.js";
import type { ContactNotifier } from "./brevoNotificationService.js";

export type ContactSubmissionOutcome = "created" | "accepted";

export interface ContactLogger {
    persistenceFailed(): void;
    notificationFailed(reason: ContactNotificationFailureReason): void;
}

const defaultLogger: ContactLogger = {
    persistenceFailed: () => console.error("contact_failed", { category: "database" }),
    notificationFailed: (reason) => console.warn("contact_notification_failed", { category: reason }),
};

export interface ContactSubmissionService {
    submit(submission: ContactSubmission): Promise<ContactSubmissionOutcome>;
}

export class ContactoService implements ContactSubmissionService {
    constructor(
        private readonly repository: ContactRepository,
        private readonly notifier: ContactNotifier,
        private readonly logger: ContactLogger = defaultLogger,
    ) {}

    async submit(submission: ContactSubmission): Promise<ContactSubmissionOutcome> {
        try {
            await this.repository.insert(submission);
        } catch {
            this.logger.persistenceFailed();
            throw new ContactPersistenceError();
        }

        try {
            await this.notifier.send(submission);
            return "created";
        } catch (error) {
            const reason = error instanceof ContactNotificationError
                ? error.reason
                : "provider_http";
            this.logger.notificationFailed(reason);
            return "accepted";
        }
    }
}
