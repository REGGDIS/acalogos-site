import { contactEmailSchema } from "./validation/contactoValidation.js";

export type LocalDatabaseConfig = {
    mode: "local";
    host: string;
    port: number;
    user: string;
    password: string;
    database: string;
};

export type UrlDatabaseConfig = {
    mode: "url";
    connectionString: string;
};

export type DatabaseConfig = LocalDatabaseConfig | UrlDatabaseConfig;

export type AppConfig = {
    adminUser: string;
    adminPass: string;
    jwtSecret: string;
    corsOrigins: string[];
    db: DatabaseConfig;
    directDatabaseUrl?: string;
    cloudinary: {
        cloudName: string;
        apiKey: string;
        apiSecret: string;
    };
    contact: {
        enabled: false;
    } | {
        enabled: true;
        toEmail: string;
        fromEmail: string;
        brevoApiKey: string;
        privacyNoticeVersion: string;
        emailTimeoutMs: number;
        rateLimitWindowMs: number;
        rateLimitMax: number;
    };
    port: string | number;
};

export class ConfigError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "ConfigError";
    }
}

type Environment = NodeJS.ProcessEnv;

const getOptionalNormalizedEnv = (env: Environment, name: string): string | undefined => {
    const value = env[name];
    if (value === undefined || value.trim() === "") {
        return undefined;
    }

    return value.trim();
};

const getRequiredRawEnv = (env: Environment, name: string): string => {
    const value = env[name];

    if (value === undefined || value.trim() === "") {
        throw new ConfigError(`Configuración inválida: falta la variable de entorno requerida ${name}.`);
    }

    return value;
};

const getRequiredNormalizedEnv = (env: Environment, name: string): string => (
    getRequiredRawEnv(env, name).trim()
);

const getRequiredEmailEnv = (env: Environment, name: string): string => {
    const value = getRequiredNormalizedEnv(env, name);
    const result = contactEmailSchema.safeParse(value);
    if (!result.success) {
        throw new ConfigError(`Configuración inválida: ${name} debe ser un correo electrónico válido.`);
    }

    return result.data;
};

const getContactEnabled = (env: Environment): boolean => {
    const value = getOptionalNormalizedEnv(env, "CONTACT_ENABLED");
    if (value === undefined || value === "false") return false;
    if (value === "true") return true;
    throw new ConfigError("Configuración inválida: CONTACT_ENABLED debe ser true o false.");
};

const getOptionalIntegerEnv = (
    env: Environment,
    name: string,
    defaultValue: number,
    minimum: number,
    maximum: number,
): number => {
    const rawValue = getOptionalNormalizedEnv(env, name);
    if (rawValue === undefined) return defaultValue;

    const value = Number(rawValue);
    if (!Number.isInteger(value) || value < minimum || value > maximum) {
        throw new ConfigError(
            `Configuración inválida: ${name} debe ser un entero entre ${minimum} y ${maximum}.`,
        );
    }

    return value;
};

const getPrivacyNoticeVersion = (env: Environment): string => {
    const value = getRequiredNormalizedEnv(env, "CONTACT_PRIVACY_NOTICE_VERSION");
    if (value.length > 32) {
        throw new ConfigError(
            "Configuración inválida: CONTACT_PRIVACY_NOTICE_VERSION debe tener como máximo 32 caracteres.",
        );
    }

    return value;
};

const loadContactConfig = (env: Environment): AppConfig["contact"] => {
    if (!getContactEnabled(env)) return { enabled: false };

    return {
        enabled: true,
        toEmail: getRequiredEmailEnv(env, "CONTACT_TO_EMAIL"),
        fromEmail: getRequiredEmailEnv(env, "CONTACT_FROM_EMAIL"),
        brevoApiKey: getRequiredRawEnv(env, "BREVO_API_KEY"),
        privacyNoticeVersion: getPrivacyNoticeVersion(env),
        emailTimeoutMs: getOptionalIntegerEnv(env, "CONTACT_EMAIL_TIMEOUT_MS", 5_000, 1_000, 10_000),
        rateLimitWindowMs: getOptionalIntegerEnv(
            env,
            "CONTACT_RATE_LIMIT_WINDOW_MS",
            15 * 60 * 1_000,
            60_000,
            3_600_000,
        ),
        rateLimitMax: getOptionalIntegerEnv(env, "CONTACT_RATE_LIMIT_MAX", 100, 1, 100),
    };
};

const validateDatabaseUrl = (name: "DATABASE_URL" | "DIRECT_DATABASE_URL", value: string): string => {
    let url: URL;

    try {
        url = new URL(value);
    } catch {
        throw new ConfigError(`Configuración inválida: ${name} no es una URL PostgreSQL válida.`);
    }

    if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") {
        throw new ConfigError(`Configuración inválida: ${name} debe usar el protocolo postgres o postgresql.`);
    }

    if (!url.hostname || !url.pathname || url.pathname === "/") {
        throw new ConfigError(`Configuración inválida: ${name} debe incluir host y base de datos.`);
    }

    const sslModes = url.searchParams.getAll("sslmode");
    if (sslModes.length !== 1 || sslModes[0] !== "verify-full") {
        throw new ConfigError(`Configuración inválida: ${name} debe incluir sslmode=verify-full.`);
    }

    return value;
};

const normalizeOrigin = (origin: string): string => origin.trim().replace(/\/+$/, "");

const parseCorsOrigins = (value: string): string[] => {
    const origins = value
        .split(",")
        .map(normalizeOrigin)
        .filter((origin) => origin.length > 0);

    if (origins.length === 0) {
        throw new ConfigError("Configuración inválida: CORS_ORIGIN debe incluir al menos un origen.");
    }

    for (const origin of origins) {
        try {
            const url = new URL(origin);
            if (url.protocol !== "http:" && url.protocol !== "https:") {
                throw new Error("Protocolo no permitido");
            }
        } catch {
            throw new ConfigError("Configuración inválida: CORS_ORIGIN contiene un origen no válido.");
        }
    }

    return origins;
};

const loadDatabaseConfig = (env: Environment): DatabaseConfig => {
    const databaseUrl = getOptionalNormalizedEnv(env, "DATABASE_URL");

    if (databaseUrl) {
        return {
            mode: "url",
            connectionString: validateDatabaseUrl("DATABASE_URL", databaseUrl),
        };
    }

    const port = Number(getRequiredNormalizedEnv(env, "DB_PORT"));
    if (!Number.isInteger(port) || port <= 0 || port > 65535) {
        throw new ConfigError("Configuración inválida: DB_PORT debe ser un número de puerto válido.");
    }

    return {
        mode: "local",
        host: getRequiredNormalizedEnv(env, "DB_HOST"),
        port,
        user: getRequiredNormalizedEnv(env, "DB_USER"),
        password: getRequiredRawEnv(env, "DB_PASSWORD"),
        database: getRequiredNormalizedEnv(env, "DB_NAME"),
    };
};

export const loadConfig = (env: Environment): AppConfig => {
    const directDatabaseUrl = getOptionalNormalizedEnv(env, "DIRECT_DATABASE_URL");

    return {
        adminUser: getRequiredNormalizedEnv(env, "ADMIN_USER"),
        adminPass: getRequiredRawEnv(env, "ADMIN_PASS"),
        jwtSecret: getRequiredRawEnv(env, "JWT_SECRET"),
        corsOrigins: parseCorsOrigins(getRequiredRawEnv(env, "CORS_ORIGIN")),
        db: loadDatabaseConfig(env),
        directDatabaseUrl: directDatabaseUrl
            ? validateDatabaseUrl("DIRECT_DATABASE_URL", directDatabaseUrl)
            : undefined,
        cloudinary: {
            cloudName: getRequiredNormalizedEnv(env, "CLOUDINARY_CLOUD_NAME"),
            apiKey: getRequiredRawEnv(env, "CLOUDINARY_API_KEY"),
            apiSecret: getRequiredRawEnv(env, "CLOUDINARY_API_SECRET"),
        },
        contact: loadContactConfig(env),
        port: getOptionalNormalizedEnv(env, "PORT") ?? 3000,
    };
};
