import assert from "node:assert/strict";
import test from "node:test";
import { ContactNotificationError, ContactPersistenceError } from "../src/errors/contactoErrors.js";
import type { ContactRepository } from "../src/repositories/contactosRepository.js";
import type { ContactNotifier } from "../src/services/brevoNotificationService.js";
import { ContactoService, type ContactLogger } from "../src/services/contactoService.js";
import type { ContactSubmission } from "../src/validation/contactoValidation.js";

const submission: ContactSubmission = {
    nombre: "Prueba",
    email: "visitor@example.test",
    mensaje: "Mensaje de prueba",
    privacyNoticeVersion: "contact-v1",
};

const silentLogger = (): ContactLogger => ({
    persistenceFailed: () => undefined,
    notificationFailed: () => undefined,
});

test("persiste antes de notificar", async () => {
    const calls: string[] = [];
    const repository: ContactRepository = { insert: async () => { calls.push("insert"); } };
    const notifier: ContactNotifier = { send: async () => { calls.push("notify"); } };

    const result = await new ContactoService(repository, notifier, silentLogger()).submit(submission);

    assert.equal(result, "created");
    assert.deepEqual(calls, ["insert", "notify"]);
});

test("un fallo de Neon impide notificar", async () => {
    let notificationCalls = 0;
    const repository: ContactRepository = { insert: async () => { throw new Error("db"); } };
    const notifier: ContactNotifier = { send: async () => { notificationCalls += 1; } };

    await assert.rejects(
        () => new ContactoService(repository, notifier, silentLogger()).submit(submission),
        ContactPersistenceError,
    );
    assert.equal(notificationCalls, 0);
});

test("un fallo de Brevo conserva la aceptación y no reintenta", async () => {
    let notificationCalls = 0;
    const repository: ContactRepository = { insert: async () => undefined };
    const notifier: ContactNotifier = {
        send: async () => {
            notificationCalls += 1;
            throw new ContactNotificationError("provider_http");
        },
    };

    const result = await new ContactoService(repository, notifier, silentLogger()).submit(submission);

    assert.equal(result, "accepted");
    assert.equal(notificationCalls, 1);
});

test("un timeout de Brevo produce aceptación parcial y categoría segura", async () => {
    const reasons: string[] = [];
    const logger: ContactLogger = {
        persistenceFailed: () => undefined,
        notificationFailed: (reason) => { reasons.push(reason); },
    };
    const repository: ContactRepository = { insert: async () => undefined };
    const notifier: ContactNotifier = {
        send: async () => { throw new ContactNotificationError("timeout"); },
    };

    const result = await new ContactoService(repository, notifier, logger).submit(submission);

    assert.equal(result, "accepted");
    assert.deepEqual(reasons, ["timeout"]);
});
