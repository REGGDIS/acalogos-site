import { Router } from "express";
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
        cb(null, file.originalname);
    },
});
const upload = multer({ storage });
// Ruta para obtener todos los servicios
router.get("/", async (req, res) => {
    try {
        const result = await pool.query("SELECT * FROM servicios ORDER BY id");
        res.json({ status: "success", data: result.rows });
    }
    catch (error) {
        console.error("Error al consultar la base de datos:", error);
        res.status(500).json({ status: "error", message: "No se pudieron obtener los servicios." });
    }
});
// Ruta para subir imágenes a un servicio
router.put("/:id/imagenes", upload.single("imagen"), async (req, res) => {
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
        const imagenesActuales = result.rows[0].imagenes_adicionales || [];
        // Agregar la nueva imagen a la lista y actualizar en la base de datos
        const nuevasImagenes = [...imagenesActuales, imagenPath];
        await pool.query("UPDATE servicios SET imagenes_adicionales = $1, updated_at = NOW() WHERE id = $2", [
            nuevasImagenes,
            id,
        ]);
        res.json({ status: "success", message: "Imagen añadida con éxito.", imagenes_adicionales: nuevasImagenes });
    }
    catch (error) {
        console.error("Error al actualizar las imágenes:", error);
        res.status(500).json({ status: "error", message: "No se pudo actualizar las imágenes." });
    }
});
// Endpoint para eliminar una imagen adicional de un servicio
router.delete("/:id/imagenes", async (req, res) => {
    try {
        const { id } = req.params;
        const { imagen } = req.body;
        // Obtener las imágenes actuales del servicio
        const result = await pool.query("SELECT imagenes_adicionales FROM servicios WHERE id = $1", [id]);
        if (result.rows.length === 0) {
            res.status(404).json({ status: "error", message: "Servicio no encontrado." });
            return;
        }
        const imagenesActuales = result.rows[0].imagenes_adicionales || [];
        // Verificar que la imagen a eliminar exista
        if (!imagenesActuales.includes(imagen)) {
            res.status(404).json({ status: "error", message: "Imagen no encontrada en el servicio" });
            return;
        }
        // Filtrar la imagen a eliminar y actualizar la base de datos
        const nuevasImagenes = imagenesActuales.filter(img => img !== imagen);
        await pool.query("UPDATE servicios SET imagenes_adicionales = $1, updated_at = NOW() WHERE id = $2", [nuevasImagenes, id]);
        // Eliminar el archivo físico de la imagen del sistema de archivos
        const imagenPath = path.join(uploadPath, path.basename(imagen));
        fs.unlink(imagenPath, (err) => {
            if (err)
                console.error("Error al eliminar el archivo:", err);
        });
        res.json({ status: "success", message: "Imagen eliminada correctamente.", imagenes_adicionales: nuevasImagenes });
    }
    catch (error) {
        console.error("Error al eliminar la imagen:", error);
        res.status(500).json({ status: "error", message: "No se pudo eliminar la imagen." });
    }
});
// Endpoint para obtener los detalles de un servicio por ID
router.get("/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query("SELECT * FROM servicios WHERE id = $1", [id]);
        if (result.rows.length === 0) {
            res.status(404).json({ status: "error", message: "Servicio no encontrado." });
            return;
        }
        res.json({ status: "success", data: result.rows[0] });
    }
    catch (error) {
        console.error("Error al obtener el servicio:", error);
        res.status(500).json({ status: "error", message: "No se pudo obtener el servicio." });
    }
});
export default router;
