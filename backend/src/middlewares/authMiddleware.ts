import { Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { AuthRequest } from "../types.js";

export const verifyToken = (req: AuthRequest, res: Response, next: NextFunction): void => {
    const token = req.headers.authorization?.split(" ")[1];

    console.log("Verificando token:", token);

    if (!token) {
        console.log("⛔ No hay token en la petición.");
        res.status(403).json({ message: "Acceso denegado" });
        return;
    }

    try {
        // Decodificar el token sin verificar aún
        const decoded = jwt.decode(token, { complete: true }) as { payload: jwt.JwtPayload } | null;

        console.log("Token decodificado:", decoded);

        if (!decoded) {
            console.log("⛔ Token inválido (no se pudo decodificar).");
            res.status(401).json({ message: "Token inválido" });
            return;
        }

        // Validar manualmente la expiración
        const now = Math.floor(Date.now() / 1000); // Tiempo actual en segundos
        console.log("Tiempo actual:", now, "Expiración del token:", decoded.payload.exp);

        if (decoded.payload.exp && decoded.payload.exp < now) {
            console.log("⛔ Token expirado.");
            res.status(401).json({ message: "Token expirado" });
            return;
        }

        // Ahora verificamos con la clave secreta
        req.user = jwt.verify(token, process.env.JWT_SECRET as string);
        console.log("✅ Token válido. Acceso concedido.");

        next();
    } catch (error) {
        console.error("❌ Error en la validación del token:", error);
        res.status(401).json({ message: "Token inválido o expirado" });
        return;
    }
};
