import assert from "node:assert/strict";
import test from "node:test";
import type { DatabaseConfig } from "../src/configLoader.js";
import { ensureServiciosJsonFallbackAllowed } from "../src/services/serviciosFallbackPolicy.js";

test("permite continuar hacia services.json con PostgreSQL local", () => {
    const databaseConfig: DatabaseConfig = {
        mode: "local",
        host: "localhost",
        port: 5432,
        user: "local-user",
        password: "local-password",
        database: "local-database",
    };

    assert.doesNotThrow(() => ensureServiciosJsonFallbackAllowed(databaseConfig, new Error("database-error")));
});

test("propaga el error original cuando se utiliza DATABASE_URL", () => {
    const databaseConfig: DatabaseConfig = {
        mode: "url",
        connectionString: "postgresql://example.test/neondb?sslmode=verify-full",
    };
    const databaseError = new Error("database-error");

    assert.throws(
        () => ensureServiciosJsonFallbackAllowed(databaseConfig, databaseError),
        (error: unknown) => error === databaseError,
    );
});
