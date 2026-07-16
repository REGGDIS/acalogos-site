import dotenv from "dotenv";

dotenv.config();

const requiredEnvVars = [
    "ADMIN_USER",
    "ADMIN_PASS",
    "JWT_SECRET",
    "CORS_ORIGIN",
    "DB_HOST",
    "DB_PORT",
    "DB_USER",
    "DB_PASSWORD",
    "DB_NAME",
    "CLOUDINARY_CLOUD_NAME",
    "CLOUDINARY_API_KEY",
    "CLOUDINARY_API_SECRET",
] as const;

const getRequiredEnv = (name: (typeof requiredEnvVars)[number]): string => {
    const value = process.env[name];

    if (!value || value.trim() === "") {
        console.error(`Configuración inválida: falta la variable de entorno requerida ${name}.`);
        process.exit(1);
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
        console.error("Configuración inválida: CORS_ORIGIN debe incluir al menos un origen.");
        process.exit(1);
    }

    for (const origin of origins) {
        try {
            const url = new URL(origin);
            if (url.protocol !== "http:" && url.protocol !== "https:") {
                throw new Error("Protocolo no permitido");
            }
        } catch {
            console.error("Configuración inválida: CORS_ORIGIN contiene un origen no válido.");
            process.exit(1);
        }
    }

    return origins;
};

export const config = {
    adminUser: getRequiredEnv("ADMIN_USER"),
    adminPass: getRequiredEnv("ADMIN_PASS"),
    jwtSecret: getRequiredEnv("JWT_SECRET"),
    corsOrigins: parseCorsOrigins(getRequiredEnv("CORS_ORIGIN")),
    db: {
        host: getRequiredEnv("DB_HOST"),
        port: Number(getRequiredEnv("DB_PORT")),
        user: getRequiredEnv("DB_USER"),
        password: getRequiredEnv("DB_PASSWORD"),
        database: getRequiredEnv("DB_NAME"),
    },
    cloudinary: {
        cloudName: getRequiredEnv("CLOUDINARY_CLOUD_NAME"),
        apiKey: getRequiredEnv("CLOUDINARY_API_KEY"),
        apiSecret: getRequiredEnv("CLOUDINARY_API_SECRET"),
    },
    port: process.env.PORT || 3000,
};

if (!Number.isInteger(config.db.port) || config.db.port <= 0) {
    console.error("Configuración inválida: DB_PORT debe ser un número de puerto válido.");
    process.exit(1);
}
