import { Router } from "express";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
dotenv.config();
const router = Router();
// Leer credenciales desde variables de entorno
const ADMIN_EMAIL = process.env.ADMIN_USER || "admin@acalogos.com";
const ADMIN_PASSWORD = process.env.ADMIN_PASS || "123456";
const JWT_SECRET = process.env.JWT_SECRET || "clave_secreta";
// Verifica que JWT_SECRET está definido
if (!JWT_SECRET) {
    console.error("ERROR: JWT_SECRET no está definido en .env");
    process.exit(1);
}
// Middleware para capturar errores async automáticamente
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
// Ruta para el login de administrador
router.post("/login", asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        res.status(400).json({ status: "error", message: "Faltan datos" });
        return;
    }
    if (email !== ADMIN_EMAIL || password !== ADMIN_PASSWORD) {
        res.status(401).json({ status: "error", message: "Credenciales incorrectas" });
        return;
    }
    // Generar token
    const token = jwt.sign({ email }, JWT_SECRET, { expiresIn: "2h" });
    res.json({ status: "success", token });
}));
export default router;
