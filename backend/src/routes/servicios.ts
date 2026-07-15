import { Router } from "express";
import * as serviciosController from "../controllers/serviciosController.js";
import upload from "../middlewares/uploadMiddleware.js"
import { verifyToken } from "../middlewares/authMiddleware.js";

const router = Router();

/* 📌 Definición de rutas */

// ✅ Obtener todos los servicios
router.get("/", serviciosController.obtenerServicios);

// ✅ Obtener detalles de un servicio por ID
router.get("/:id", serviciosController.obtenerServicio);

// ✅ Subir imagen principal de un servicio
router.put("/:id/imagen-principal", verifyToken, upload.single("imagen"), serviciosController.subirImagenPrincipal);

// ✅ Eliminar imagen principal de un servicio
router.delete("/:id/imagen-principal", verifyToken, serviciosController.borrarImagenPrincipal);

// ✅ Subir imagen adicional a un servicio
router.put("/:id/imagenes", verifyToken, upload.single("imagen"), serviciosController.subirImagenAdicional);

// ✅ Eliminar imagen adicional de un servicio
router.delete("/:id/imagenes", verifyToken, serviciosController.borrarImagenAdicional);

export default router;
