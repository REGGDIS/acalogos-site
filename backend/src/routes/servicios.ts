import { Router, Request, Response } from "express";
import { pool } from "../db.js";
import multer from "multer";
import { fileURLToPath } from "url";
import path from "path";
import fs from "fs";

const router = Router();

// Definir __dirname manualmente
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ruta absoluta para guardar imágenes
const uploadPath = path.join(__dirname, "../../frontend/public/assets/images/servicios");

// Verificar si la carpeta existe, si no, crearla
if (!fs.existsSync(uploadPath)) {
    fs.mkdirSync(uploadPath, { recursive: true });
}

// Configura multer
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        cb(null, `${Date.now()}-${file.originalname}`);
    },
});

const upload = multer({ storage });

// Ruta para obtener todos los servicios
router.get("/", async (req: Request, res: Response) => {
    try {
        const result = await pool.query("SELECT * FROM servicios ORDER BY id");
        res.json({ status: "success", data: result.rows });
    } catch (error) {
        console.error("Error al consultar la base de datos:", error);
        res.status(500).json({ status: "error", message: "No se pudieron obtener los servicios." });
    }
});

// Ruta para subir imágenes a un servicio
router.put("/:id/imagenes", upload.single("imagen"), async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;

        if (!req.file) {
            res.status(400).json({ status: "error", message: "Debe subir una imagen." });
            return;
        }

        // Construir la ruta donde se guardó la imagen
        const imagenPath = `/assets/images/servicios/${req.file.filename}`;

        // Obtener imágenes actuales
        const result = await pool.query("SELECT imagenes_adicionales FROM servicios WHERE id = $1", [id]);

        if (result.rows.length === 0) {
            res.status(404).json({ status: "error", message: "Servicio no encontrado." });
            return;
        }

        const imagenesActuales: string[] = result.rows[0].imagenes_adicionales || [];

        // Agregar la nueva imagen a la lista y actualizar en la base de datos
        const nuevasImagenes = [...imagenesActuales, imagenPath];

        await pool.query("UPDATE servicios SET imagenes_adicionales = $1, updated_at = NOW() WHERE id = $2", [
            nuevasImagenes,
            id,
        ]);

        res.json({ status: "success", message: "Imagen añadida con éxito.", imagenes_adicionales: nuevasImagenes });
    } catch (error) {
        console.error("Error al actualizar las imágenes:", error);
        res.status(500).json({ status: "error", message: "No se pudo actualizar las imágenes." });
    }
});

export default router;
