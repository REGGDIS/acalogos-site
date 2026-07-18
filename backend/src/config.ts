import dotenv from "dotenv";
import { ConfigError, loadConfig } from "./configLoader.js";

dotenv.config();

const loadRuntimeConfig = () => {
    try {
        return loadConfig(process.env);
    } catch (error) {
        const message = error instanceof ConfigError
            ? error.message
            : "Configuración inválida: no se pudo cargar la configuración.";

        console.error(message);
        process.exit(1);
    }
};

export const config = loadRuntimeConfig();
