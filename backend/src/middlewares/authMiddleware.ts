import type { Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import type { AuthRequest } from "../types.js";
import { config } from "../config.js";

export const verifyToken = (req: AuthRequest, res: Response, next: NextFunction): void => {
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
        res.status(401).json({ message: "Token requerido" });
        return;
    }

    try {
        req.user = jwt.verify(token, config.jwtSecret);
        next();
    } catch (error) {
        res.status(403).json({ message: "Token inválido o expirado" });
        return;
    }
};
