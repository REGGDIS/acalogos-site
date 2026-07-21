import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import type { ErrorRequestHandler, RequestHandler } from "express";
import request from "supertest";
import { createApp } from "../src/app.js";
import { createAuthRouter } from "../src/routes/auth.js";
import { createServiciosRouter, type ServiciosRouterDependencies } from "../src/routes/servicios.js";
import upload, { handleUploadError, validateUploadedImage } from "../src/middlewares/uploadMiddleware.js";

const pass: RequestHandler = (_req, _res, next) => next();
const passError: ErrorRequestHandler = (error, _req, _res, next) => next(error);

const handler = (route: string): RequestHandler => (_req, res) => {
    res.json({ route });
};

const serviciosDependencies = (overrides: Partial<ServiciosRouterDependencies> = {}): ServiciosRouterDependencies => ({
    obtenerServicios: handler("servicios"),
    obtenerServicio: handler("servicio"),
    subirImagenPrincipal: handler("imagen-principal-put"),
    borrarImagenPrincipal: handler("imagen-principal-delete"),
    subirImagenAdicional: handler("imagenes-put"),
    borrarImagenAdicional: handler("imagenes-delete"),
    verifyToken: pass,
    uploadSingle: pass,
    validateUploadedImage: pass,
    handleUploadError: passError,
    ...overrides,
});

const createExistingRoutesApp = (publicAssetsPath: string, dependencies = serviciosDependencies()) => createApp({
    corsOrigins: ["https://frontend.example.test"],
    publicAssetsPath,
    serviciosRouter: createServiciosRouter(dependencies),
    authRouter: createAuthRouter({
        adminUser: "admin@example.test",
        adminPass: "test-password",
        jwtSecret: "test-jwt-secret",
    }),
});

test("createApp no escucha, conecta ni ejecuta handlers al construirse", () => {
    let handlerCalls = 0;
    const countedHandler: RequestHandler = (_req, res) => {
        handlerCalls += 1;
        res.end();
    };

    const app = createExistingRoutesApp("C:\\nonexistent-assets", serviciosDependencies({
        obtenerServicios: countedHandler,
    }));

    assert.equal(handlerCalls, 0);
    assert.equal((app as unknown as { listening?: boolean }).listening, undefined);
});

test("conserva raíz, servicios por lista e id y login administrativo", async () => {
    const app = createExistingRoutesApp("C:\\nonexistent-assets");

    assert.equal((await request(app).get("/")).text, "Bienvenido al backend de ACA-Logos");
    assert.deepEqual((await request(app).get("/servicios")).body, { route: "servicios" });
    assert.deepEqual((await request(app).get("/servicios/7")).body, { route: "servicio" });

    const login = await request(app).post("/admin/login").send({
        email: "admin@example.test",
        password: "test-password",
        padding: "x".repeat(21 * 1_024),
    });
    assert.equal(login.status, 200);
    assert.equal(login.body.status, "success");
    assert.equal(typeof login.body.token, "string");
});

test("conserva protección y las cuatro rutas de imágenes", async () => {
    const protectedApp = createExistingRoutesApp("C:\\nonexistent-assets", serviciosDependencies({
        verifyToken: (_req, res) => { res.status(401).json({ message: "Token requerido" }); },
    }));
    assert.equal((await request(protectedApp).put("/servicios/1/imagen-principal")).status, 401);

    const app = createExistingRoutesApp("C:\\nonexistent-assets");
    assert.deepEqual((await request(app).put("/servicios/1/imagen-principal")).body, { route: "imagen-principal-put" });
    assert.deepEqual((await request(app).delete("/servicios/1/imagen-principal")).body, { route: "imagen-principal-delete" });
    assert.deepEqual((await request(app).put("/servicios/1/imagenes")).body, { route: "imagenes-put" });
    assert.deepEqual((await request(app).delete("/servicios/1/imagenes")).body, { route: "imagenes-delete" });
});

test("conserva un error Multer representativo", async () => {
    const app = createExistingRoutesApp("C:\\nonexistent-assets", serviciosDependencies({
        uploadSingle: upload.single("imagen"),
        validateUploadedImage,
        handleUploadError,
    }));

    const response = await request(app)
        .put("/servicios/1/imagen-principal")
        .attach("imagen", Buffer.from("not-an-image"), { filename: "file.txt", contentType: "text/plain" });

    assert.equal(response.status, 415);
    assert.deepEqual(response.body, { status: "error", message: "Formato de imagen no permitido." });
});

test("conserva assets, CORS y preflight", async () => {
    const assetsPath = await mkdtemp(path.join(tmpdir(), "acalogos-assets-"));
    try {
        await writeFile(path.join(assetsPath, "sample.png"), Buffer.from([0x89, 0x50, 0x4e, 0x47]));
        const app = createExistingRoutesApp(assetsPath);

        const asset = await request(app).get("/assets/sample.png");
        assert.equal(asset.status, 200);
        assert.match(asset.headers["content-type"], /^image\/png/);
        assert.equal(asset.headers["cross-origin-resource-policy"], "cross-origin");

        const preflight = await request(app)
            .options("/servicios")
            .set("Origin", "https://frontend.example.test")
            .set("Access-Control-Request-Method", "GET");
        assert.equal(preflight.status, 204);
        assert.equal(preflight.headers["access-control-allow-origin"], "https://frontend.example.test");
    } finally {
        await rm(assetsPath, { recursive: true, force: true });
    }
});
