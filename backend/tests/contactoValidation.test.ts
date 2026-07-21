import assert from "node:assert/strict";
import test from "node:test";
import { validateContactPayload } from "../src/validation/contactoValidation.js";

const validPayload = () => ({
    nombre: "  Jose\u0301 Pérez  ",
    email: " Visitor@EXAMPLE.TEST ",
    mensaje: "  Primera línea\r\nSegunda línea  ",
    privacyNoticeVersion: "contact-v1",
    website: "",
});

test("normaliza el payload válido sin alterar el contrato", () => {
    const result = validateContactPayload(validPayload(), "contact-v1");

    assert.equal(result.success, true);
    if (!result.success || result.honeypot) assert.fail("Se esperaba un contacto válido.");
    assert.deepEqual(result.data, {
        nombre: "José Pérez",
        email: "Visitor@example.test",
        mensaje: "Primera línea\nSegunda línea",
        privacyNoticeVersion: "contact-v1",
    });
});

test("acepta exactamente los límites aprobados", () => {
    const result = validateContactPayload({
        nombre: "a".repeat(100),
        email: `${"a".repeat(241)}@example.test`,
        mensaje: "m".repeat(4_000),
        privacyNoticeVersion: "contact-v1",
    }, "contact-v1");

    assert.equal(result.success, true);
});

test("rechaza límites, tipos y versión incorrectos", () => {
    const cases: Array<[string, unknown]> = [
        ["nombre", { ...validPayload(), nombre: "a" }],
        ["nombre", { ...validPayload(), nombre: "a".repeat(101) }],
        ["email", { ...validPayload(), email: "invalid" }],
        ["mensaje", { ...validPayload(), mensaje: "corto" }],
        ["mensaje", { ...validPayload(), mensaje: "m".repeat(4_001) }],
        ["privacyNoticeVersion", { ...validPayload(), privacyNoticeVersion: "old-v1" }],
        ["website", { ...validPayload(), website: 42 }],
    ];

    for (const [field, payload] of cases) {
        const result = validateContactPayload(payload, "contact-v1");
        assert.equal(result.success, false);
        if (result.success) assert.fail("Se esperaba error de validación.");
        assert.ok(result.fields.includes(field));
    }
});

test("rechaza campos extra, id y created_at", () => {
    for (const field of ["extra", "id", "created_at"]) {
        const result = validateContactPayload({ ...validPayload(), [field]: "forbidden" }, "contact-v1");
        assert.equal(result.success, false);
        if (result.success) assert.fail("Se esperaba error de validación.");
        assert.deepEqual(result.fields, ["unexpected_fields"]);
    }
});

test("no refleja claves arbitrarias en fields", () => {
    const result = validateContactPayload({ ...validPayload(), "persona@example.com": "sensitive" }, "contact-v1");

    assert.equal(result.success, false);
    if (result.success) assert.fail("Se esperaba error de validación.");
    assert.deepEqual(result.fields, ["unexpected_fields"]);
    assert.doesNotMatch(JSON.stringify(result), /persona@example\.com|sensitive/);
});

test("rechaza NUL y controles antes de persistir", () => {
    const cases: Array<[string, unknown]> = [
        ["nombre", { ...validPayload(), nombre: "Nombre\u0000 inválido" }],
        ["nombre", { ...validPayload(), nombre: "Nombre\tinválido" }],
        ["nombre", { ...validPayload(), nombre: "Nombre\ninválido" }],
        ["nombre", { ...validPayload(), nombre: "\nNombre inválido" }],
        ["nombre", { ...validPayload(), nombre: "Nombre\u007finválido" }],
        ["email", { ...validPayload(), email: "persona\u0000@example.com" }],
        ["mensaje", { ...validPayload(), mensaje: "Mensaje\u0000 inválido" }],
        ["mensaje", { ...validPayload(), mensaje: "Mensaje\u000binválido" }],
        ["mensaje", { ...validPayload(), mensaje: "Mensaje\u007finválido" }],
        ["privacyNoticeVersion", { ...validPayload(), privacyNoticeVersion: "contact-v1\u0000" }],
    ];

    for (const [field, payload] of cases) {
        const result = validateContactPayload(payload, "contact-v1");
        assert.equal(result.success, false);
        if (result.success) assert.fail("Se esperaba error de validación.");
        assert.deepEqual(result.fields, [field]);
    }
});

test("mensaje permite tabulación y normaliza CRLF y CR a LF", () => {
    const result = validateContactPayload({
        ...validPayload(),
        mensaje: "Primera\tlínea\r\nSegunda\rlínea",
    }, "contact-v1");

    assert.equal(result.success, true);
    if (!result.success || result.honeypot) assert.fail("Se esperaba un contacto válido.");
    assert.equal(result.data.mensaje, "Primera\tlínea\nSegunda\nlínea");
});

test("el honeypot válido se detecta antes de exigir los campos humanos", () => {
    const result = validateContactPayload({ website: "https://spam.example" }, "contact-v1");

    assert.deepEqual(result, { success: true, honeypot: true });
});

test("rechaza cuerpos que no son objetos", () => {
    for (const payload of [null, [], "string", 42]) {
        const result = validateContactPayload(payload, "contact-v1");
        assert.equal(result.success, false);
    }
});
