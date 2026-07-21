import assert from "node:assert/strict";
import test from "node:test";
import { Router } from "express";
import request from "supertest";
import { createApp } from "../src/app.js";
import { ContactPersistenceError } from "../src/errors/contactoErrors.js";
import { createContactoRouter } from "../src/routes/contacto.js";
import type { ContactSubmissionService } from "../src/services/contactoService.js";

const validPayload = {
    nombre: "Persona de prueba",
    email: "visitor@example.test",
    mensaje: "Este es un mensaje de prueba.",
    privacyNoticeVersion: "contact-v1",
    website: "",
};

const createTestApp = (service: ContactSubmissionService, rateLimitMax = 50) => {
    const serviciosRouter = Router().get("/", (_req, res) => res.json({ route: "servicios" }));
    const authRouter = Router().post("/login", (_req, res) => res.json({ route: "admin" }));
    const contactoRouter = createContactoRouter({
        service,
        privacyNoticeVersion: "contact-v1",
        rateLimitWindowMs: 60_000,
        rateLimitMax,
    });

    return createApp({
        corsOrigins: ["https://frontend.example.test"],
        publicAssetsPath: "C:\\nonexistent-contact-assets",
        serviciosRouter,
        authRouter,
        contactoRouter,
    });
};

test("responde 201 cuando guarda y notifica", async () => {
    const service: ContactSubmissionService = { submit: async () => "created" };
    const response = await request(createTestApp(service)).post("/contacto").send(validPayload);

    assert.equal(response.status, 201);
    assert.deepEqual(response.body, { status: "success", message: "Mensaje recibido." });
    assert.doesNotMatch(
        JSON.stringify(response.body),
        /visitor@example\.test|Persona de prueba|[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}/i,
    );
});

test("responde 202 cuando el contacto queda guardado sin notificación", async () => {
    const service: ContactSubmissionService = { submit: async () => "accepted" };
    const response = await request(createTestApp(service)).post("/contacto").send(validPayload);

    assert.equal(response.status, 202);
    assert.deepEqual(response.body, { status: "accepted", message: "Mensaje recibido." });
});

test("el honeypot responde 202 sin invocar el servicio", async () => {
    let calls = 0;
    const service: ContactSubmissionService = {
        submit: async () => { calls += 1; return "created"; },
    };
    const response = await request(createTestApp(service))
        .post("/contacto")
        .send({ website: "https://spam.example" });

    assert.equal(response.status, 202);
    assert.equal(calls, 0);
    assert.deepEqual(response.body, { status: "accepted", message: "Mensaje recibido." });
});

test("rechaza Content-Type no JSON", async () => {
    const service: ContactSubmissionService = { submit: async () => "created" };
    const response = await request(createTestApp(service))
        .post("/contacto")
        .type("text")
        .send("plain text");

    assert.equal(response.status, 415);
    assert.equal(response.body.code, "UNSUPPORTED_MEDIA_TYPE");
});

test("mapea JSON inválido y payload excesivo", async () => {
    const service: ContactSubmissionService = { submit: async () => "created" };
    const app = createTestApp(service);

    const invalidJson = await request(app)
        .post("/contacto")
        .set("Content-Type", "application/json")
        .send('{"nombre":');
    assert.equal(invalidJson.status, 400);
    assert.equal(invalidJson.body.code, "INVALID_JSON");

    const tooLarge = await request(app)
        .post("/contacto")
        .send({ ...validPayload, mensaje: "x".repeat(21 * 1_024) });
    assert.equal(tooLarge.status, 413);
    assert.equal(tooLarge.body.code, "PAYLOAD_TOO_LARGE");
});

test("responde 422 para campos extra sin reflejar sus valores", async () => {
    const service: ContactSubmissionService = { submit: async () => "created" };
    const response = await request(createTestApp(service))
        .post("/contacto")
        .send({ ...validPayload, id: "secret-uuid", created_at: "secret-date" });

    assert.equal(response.status, 422);
    assert.equal(response.body.code, "VALIDATION_ERROR");
    assert.deepEqual(response.body.fields, ["unexpected_fields"]);
    assert.doesNotMatch(JSON.stringify(response.body), /secret-uuid|secret-date/);
});

test("no refleja claves arbitrarias en errores 422", async () => {
    const service: ContactSubmissionService = { submit: async () => "created" };
    const response = await request(createTestApp(service))
        .post("/contacto")
        .send({ ...validPayload, "persona@example.com": "sensitive" });

    assert.equal(response.status, 422);
    assert.deepEqual(response.body.fields, ["unexpected_fields"]);
    assert.doesNotMatch(JSON.stringify(response.body), /persona@example\.com|sensitive/);
});

test("NUL produce 422 y no invoca persistencia", async () => {
    let calls = 0;
    const service: ContactSubmissionService = {
        submit: async () => { calls += 1; return "created"; },
    };
    const response = await request(createTestApp(service))
        .post("/contacto")
        .send({ ...validPayload, mensaje: "Mensaje con\u0000 contenido inválido" });

    assert.equal(response.status, 422);
    assert.equal(calls, 0);
    assert.deepEqual(response.body.fields, ["mensaje"]);
});

test("mapea un fallo de persistencia a 503", async () => {
    const service: ContactSubmissionService = {
        submit: async () => { throw new ContactPersistenceError(); },
    };
    const response = await request(createTestApp(service)).post("/contacto").send(validPayload);

    assert.equal(response.status, 503);
    assert.equal(response.body.code, "SERVICE_UNAVAILABLE");
});

test("limita solicitudes y entrega Retry-After", async () => {
    const service: ContactSubmissionService = { submit: async () => "created" };
    const app = createTestApp(service, 2);

    assert.equal((await request(app).post("/contacto").send(validPayload)).status, 201);
    assert.equal((await request(app).post("/contacto").send(validPayload)).status, 201);
    const limited = await request(app).post("/contacto").send(validPayload);

    assert.equal(limited.status, 429);
    assert.equal(limited.body.code, "RATE_LIMITED");
    assert.ok(limited.headers["retry-after"]);
});

test("Content-Type incorrecto no consume cuota y el honeypot sí", async () => {
    const service: ContactSubmissionService = { submit: async () => "created" };
    const appForContentType = createTestApp(service, 1);

    assert.equal((await request(appForContentType).post("/contacto").type("text").send("plain")).status, 415);
    assert.equal((await request(appForContentType).post("/contacto").send(validPayload)).status, 201);
    assert.equal((await request(appForContentType).post("/contacto").send(validPayload)).status, 429);

    const appForHoneypot = createTestApp(service, 1);
    assert.equal((await request(appForHoneypot).post("/contacto").send({ website: "spam" })).status, 202);
    assert.equal((await request(appForHoneypot).post("/contacto").send(validPayload)).status, 429);
});

test("X-Forwarded-For distintos comparten la misma cuota global", async () => {
    const service: ContactSubmissionService = { submit: async () => "created" };
    const app = createTestApp(service, 2);

    assert.equal((await request(app).post("/contacto").set("X-Forwarded-For", "198.51.100.1").send(validPayload)).status, 201);
    assert.equal((await request(app).post("/contacto").set("X-Forwarded-For", "203.0.113.2").send(validPayload)).status, 201);
    const limited = await request(app).post("/contacto").set("X-Forwarded-For", "192.0.2.3").send(validPayload);

    assert.equal(limited.status, 429);
    assert.ok(limited.headers["retry-after"]);
});

test("no monta /contacto cuando el router está desactivado", async () => {
    const serviciosRouter = Router();
    const authRouter = Router();
    const app = createApp({
        corsOrigins: ["https://frontend.example.test"],
        publicAssetsPath: "C:\\nonexistent-contact-assets",
        serviciosRouter,
        authRouter,
    });

    assert.equal((await request(app).post("/contacto").send(validPayload)).status, 404);
});

test("conserva el montaje de las rutas existentes y CORS", async () => {
    const service: ContactSubmissionService = { submit: async () => "created" };
    const app = createTestApp(service);

    assert.equal((await request(app).get("/")).text, "Bienvenido al backend de ACA-Logos");
    assert.deepEqual((await request(app).get("/servicios")).body, { route: "servicios" });
    assert.deepEqual((await request(app).post("/admin/login")).body, { route: "admin" });

    const preflight = await request(app)
        .options("/contacto")
        .set("Origin", "https://frontend.example.test")
        .set("Access-Control-Request-Method", "POST");
    assert.equal(preflight.status, 204);
    assert.equal(preflight.headers["access-control-allow-origin"], "https://frontend.example.test");
});
