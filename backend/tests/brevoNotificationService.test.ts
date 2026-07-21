import assert from "node:assert/strict";
import test from "node:test";
import { ContactNotificationError } from "../src/errors/contactoErrors.js";
import {
    BrevoContactNotifier,
    type FetchImplementation,
} from "../src/services/brevoNotificationService.js";
import type { ContactSubmission } from "../src/validation/contactoValidation.js";

const submission: ContactSubmission = {
    nombre: "<Nombre & Co>",
    email: "visitor@example.test",
    mensaje: "Mensaje <script>\nsegunda línea",
    privacyNoticeVersion: "contact-v1",
};

const config = {
    apiKey: "test-api-key",
    toEmail: "contact@example.test",
    fromEmail: "sender@example.test",
    timeoutMs: 1_000,
};

test("envía el contrato Brevo sin exponer UUID y escapa el HTML", async () => {
    let capturedUrl = "";
    let capturedInit: RequestInit | undefined;
    const fetchMock: FetchImplementation = async (input, init) => {
        capturedUrl = String(input);
        capturedInit = init;
        return new Response(null, { status: 201 });
    };

    await new BrevoContactNotifier(config, fetchMock).send(submission);

    assert.equal(capturedUrl, "https://api.brevo.com/v3/smtp/email");
    assert.equal(capturedInit?.method, "POST");
    assert.equal((capturedInit?.headers as Record<string, string>)["api-key"], "test-api-key");

    const payload = JSON.parse(String(capturedInit?.body)) as Record<string, unknown>;
    assert.deepEqual(payload.sender, { name: "Acalogos", email: "sender@example.test" });
    assert.deepEqual(payload.to, [{ email: "contact@example.test" }]);
    assert.deepEqual(payload.replyTo, { email: "visitor@example.test" });
    assert.match(String(payload.htmlContent), /&lt;Nombre &amp; Co&gt;/);
    assert.match(String(payload.htmlContent), /&lt;script&gt;<br>segunda línea/);
    assert.doesNotMatch(JSON.stringify(payload), /\"id\"/);
});

test("una respuesta distinta de 201 falla sin leer su body", async () => {
    let bodyRead = false;
    const fetchMock: FetchImplementation = async () => ({
        status: 400,
        text: async () => { bodyRead = true; return "sensitive-provider-response"; },
    } as Response);

    await assert.rejects(
        () => new BrevoContactNotifier(config, fetchMock).send(submission),
        (error: unknown) => error instanceof ContactNotificationError && error.reason === "provider_http",
    );
    assert.equal(bodyRead, false);
});

test("aborta al vencer el timeout", async () => {
    const fetchMock: FetchImplementation = async (_input, init) => new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
            reject(new DOMException("Aborted", "AbortError"));
        });
    });

    await assert.rejects(
        () => new BrevoContactNotifier({ ...config, timeoutMs: 5 }, fetchMock).send(submission),
        (error: unknown) => error instanceof ContactNotificationError && error.reason === "timeout",
    );
});
