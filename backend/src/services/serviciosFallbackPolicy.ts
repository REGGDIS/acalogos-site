import type { DatabaseConfig } from "../configLoader.js";

export const ensureServiciosJsonFallbackAllowed = (
    databaseConfig: DatabaseConfig,
    databaseError: unknown,
): void => {
    if (databaseConfig.mode === "url") {
        throw databaseError;
    }
};
