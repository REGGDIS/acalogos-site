import dotenv from "dotenv";

dotenv.config();

const requiredEnvVars = [
    "ADMIN_USER",
    "ADMIN_PASS",
    "JWT_SECRET",
    "DB_HOST",
    "DB_PORT",
    "DB_USER",
    "DB_PASSWORD",
    "DB_NAME",
] as const;

const getRequiredEnv = (name: (typeof requiredEnvVars)[number]): string => {
    const value = process.env[name];

    if (!value || value.trim() === "") {
        console.error(`Configuración inválida: falta la variable de entorno requerida ${name}.`);
        process.exit(1);
    }

    return value;
};

export const config = {
    adminUser: getRequiredEnv("ADMIN_USER"),
    adminPass: getRequiredEnv("ADMIN_PASS"),
    jwtSecret: getRequiredEnv("JWT_SECRET"),
    db: {
        host: getRequiredEnv("DB_HOST"),
        port: Number(getRequiredEnv("DB_PORT")),
        user: getRequiredEnv("DB_USER"),
        password: getRequiredEnv("DB_PASSWORD"),
        database: getRequiredEnv("DB_NAME"),
    },
    port: process.env.PORT || 3000,
};

if (!Number.isInteger(config.db.port) || config.db.port <= 0) {
    console.error("Configuración inválida: DB_PORT debe ser un número de puerto válido.");
    process.exit(1);
}
