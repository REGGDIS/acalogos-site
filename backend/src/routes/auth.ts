import { Router } from "express";
import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config.js";

const router = Router();

// Middleware para capturar errores async automáticamente
const asyncHandler =
    (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) =>
    (req: Request, res: Response, next: NextFunction) =>
        Promise.resolve(fn(req, res, next)).catch(next);

// Ruta para el login de administrador
router.post(
    "/login",
    asyncHandler(async (req: Request, res: Response): Promise<void> => {
        const { email, password } = req.body;

        if (!email || !password) {
            res.status(400).json({ status: "error", message: "Faltan datos" });
            return;
        }

        if (email !== config.adminUser || password !== config.adminPass) {
            res.status(401).json({ status: "error", message: "Credenciales incorrectas" });
            return;
        }

        // Generar token
        const token = jwt.sign({ email }, config.jwtSecret, { expiresIn: "2h" });

        res.json({ status: "success", token });
    })
);

export default router;
