import assert from "node:assert/strict";
import test from "node:test";
import { ConfigError, loadConfig } from "../src/configLoader.js";

const baseEnvironment = (): NodeJS.ProcessEnv => ({
    ADMIN_USER: "admin@example.test",
    ADMIN_PASS: "admin-password",
    JWT_SECRET: "jwt-secret",
    CORS_ORIGIN: "http://localhost:5173",
    DB_HOST: "localhost",
    DB_PORT: "5432",
    DB_USER: "local-user",
    DB_PASSWORD: "local-password",
    DB_NAME: "local-database",
    CLOUDINARY_CLOUD_NAME: "cloud-name",
    CLOUDINARY_API_KEY: "api-key",
    CLOUDINARY_API_SECRET: "api-secret",
});

const expectConfigError = (env: NodeJS.ProcessEnv, expectedMessage: string): void => {
    assert.throws(
        () => loadConfig(env),
        (error: unknown) => error instanceof ConfigError && error.message === expectedMessage,
    );
};

test("DATABASE_URL válida tiene precedencia sobre DB_*", () => {
    const env = baseEnvironment();
    env.DATABASE_URL = "postgresql://remote-user:remote-password@example.test/neondb?sslmode=verify-full";
    delete env.DB_HOST;

    const result = loadConfig(env);

    assert.deepEqual(result.db, {
        mode: "url",
        connectionString: env.DATABASE_URL,
    });
});

test("DATABASE_URL válida ignora un DB_PORT local inválido", () => {
    const env = baseEnvironment();
    env.DATABASE_URL = "postgresql://remote-user:remote-password@example.test/neondb?sslmode=verify-full";
    env.DB_PORT = "invalid-port";

    const result = loadConfig(env);

    assert.equal(result.db.mode, "url");
});

test("DATABASE_URL vacía usa la configuración PostgreSQL local", () => {
    const env = baseEnvironment();
    env.DATABASE_URL = "   ";

    const result = loadConfig(env);

    assert.deepEqual(result.db, {
        mode: "local",
        host: "localhost",
        port: 5432,
        user: "local-user",
        password: "local-password",
        database: "local-database",
    });
});

test("DATABASE_URL exige sslmode=verify-full", () => {
    const env = baseEnvironment();
    env.DATABASE_URL = "postgresql://user:password@example.test/neondb?sslmode=require";

    expectConfigError(
        env,
        "Configuración inválida: DATABASE_URL debe incluir sslmode=verify-full.",
    );
});

test("acepta el protocolo postgres", () => {
    const env = baseEnvironment();
    env.DATABASE_URL = "postgres://user:password@example.test/neondb?sslmode=verify-full";

    const result = loadConfig(env);

    assert.equal(result.db.mode, "url");
});

test("rechaza DATABASE_URL sintácticamente inválida", () => {
    const env = baseEnvironment();
    env.DATABASE_URL = "not-a-url";

    expectConfigError(
        env,
        "Configuración inválida: DATABASE_URL no es una URL PostgreSQL válida.",
    );
});

test("rechaza DATABASE_URL sin host", () => {
    const env = baseEnvironment();
    env.DATABASE_URL = "postgresql:///neondb?sslmode=verify-full";

    expectConfigError(
        env,
        "Configuración inválida: DATABASE_URL debe incluir host y base de datos.",
    );
});

test("rechaza DATABASE_URL sin base de datos", () => {
    const env = baseEnvironment();
    env.DATABASE_URL = "postgresql://user:password@example.test/?sslmode=verify-full";

    expectConfigError(
        env,
        "Configuración inválida: DATABASE_URL debe incluir host y base de datos.",
    );
});

test("acepta una URL Neon pooled con verify-full y channel_binding conservado", () => {
    const env = baseEnvironment();
    env.DATABASE_URL = "postgresql://user:password@ep-example-123456-pooler.us-east-2.aws.neon.tech/neondb?sslmode=verify-full&channel_binding=require";

    const result = loadConfig(env);

    assert.deepEqual(result.db, {
        mode: "url",
        connectionString: env.DATABASE_URL,
    });
});

test("DATABASE_URL rechaza parámetros sslmode duplicados", () => {
    const env = baseEnvironment();
    env.DATABASE_URL = "postgresql://user:password@example.test/neondb?sslmode=verify-full&sslmode=disable";

    expectConfigError(
        env,
        "Configuración inválida: DATABASE_URL debe incluir sslmode=verify-full.",
    );
});

test("DATABASE_URL rechaza protocolos no PostgreSQL sin exponer su contenido", () => {
    const env = baseEnvironment();
    env.DATABASE_URL = "https://secret-user:secret-password@example.test/neondb?sslmode=verify-full";

    expectConfigError(
        env,
        "Configuración inválida: DATABASE_URL debe usar el protocolo postgres o postgresql.",
    );
});

test("DIRECT_DATABASE_URL queda disponible y se valida de forma independiente", () => {
    const env = baseEnvironment();
    env.DIRECT_DATABASE_URL = "postgresql://direct-user:direct-password@example.test/neondb?sslmode=verify-full";

    const result = loadConfig(env);

    assert.equal(result.directDatabaseUrl, env.DIRECT_DATABASE_URL);
    assert.equal(result.db.mode, "local");
});

test("DIRECT_DATABASE_URL vacía se considera ausente", () => {
    const env = baseEnvironment();
    env.DIRECT_DATABASE_URL = " ";

    const result = loadConfig(env);

    assert.equal(result.directDatabaseUrl, undefined);
});

test("DIRECT_DATABASE_URL rechaza un protocolo incorrecto", () => {
    const env = baseEnvironment();
    env.DIRECT_DATABASE_URL = "https://user:password@example.test/neondb?sslmode=verify-full";

    expectConfigError(
        env,
        "Configuración inválida: DIRECT_DATABASE_URL debe usar el protocolo postgres o postgresql.",
    );
});

test("DIRECT_DATABASE_URL exige sslmode=verify-full", () => {
    const env = baseEnvironment();
    env.DIRECT_DATABASE_URL = "postgresql://user:password@example.test/neondb?sslmode=require";

    expectConfigError(
        env,
        "Configuración inválida: DIRECT_DATABASE_URL debe incluir sslmode=verify-full.",
    );
});

test("preserva espacios iniciales y finales en contraseñas y secretos", () => {
    const env = baseEnvironment();
    env.ADMIN_PASS = " admin-password ";
    env.JWT_SECRET = " jwt-secret ";
    env.DB_PASSWORD = " local-password ";
    env.CLOUDINARY_API_KEY = " api-key ";
    env.CLOUDINARY_API_SECRET = " api-secret ";

    const result = loadConfig(env);

    assert.equal(result.adminPass, env.ADMIN_PASS);
    assert.equal(result.jwtSecret, env.JWT_SECRET);
    assert.equal(result.cloudinary.apiKey, env.CLOUDINARY_API_KEY);
    assert.equal(result.cloudinary.apiSecret, env.CLOUDINARY_API_SECRET);
    assert.equal(result.db.mode, "local");
    if (result.db.mode === "local") {
        assert.equal(result.db.password, env.DB_PASSWORD);
    }
});

test("la configuración local exige todas las variables DB_*", () => {
    const env = baseEnvironment();
    delete env.DB_PASSWORD;

    expectConfigError(
        env,
        "Configuración inválida: falta la variable de entorno requerida DB_PASSWORD.",
    );
});

test("DB_PORT debe estar dentro del rango válido", () => {
    const env = baseEnvironment();
    env.DB_PORT = "70000";

    expectConfigError(
        env,
        "Configuración inválida: DB_PORT debe ser un número de puerto válido.",
    );
});
