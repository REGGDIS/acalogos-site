import { Router, Request, Response, RequestHandler } from "express";
import { pool } from "../db.js";
import { ImagenBody } from "../types.js";

const router = Router();

// Ruta para obtener todos los servicios
router.get('/', async (req: Request, res: Response) => {
    try {
        const result = await pool.query('SELECT * FROM servicios ORDER BY id');
        res.json({ status: 'success', data: result.rows });
    } catch (error) {
        console.error('Error al consultar la base de datos:', error);
        res.status(500).json({ status: 'error', message: 'No se pudieron obtener los servicios.' });
    }
});

// Ruta para actualizar imágenes adicionales de un servicio
const actualizarImagenes: RequestHandler = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { imagen } = req.body as ImagenBody;

        if (!imagen) {
            res.status(400).json({ status: 'error', message: 'Debe proporcionar una imagen.' });
            return;
        }

        const result = await pool.query('SELECT imagenes_adicionales FROM servicios WHERE id = $1', [id]);

        if (result.rows.length === 0) {
            res.status(404).json({ status: 'error', message: 'Servicio no encontrado.' });
            return;
        }

        const imagenesActuales: string[] = result.rows[0].imagenes_adicionales || [];

        // Evitar duplicados
        if (imagenesActuales.includes(imagen)) {
            res.status(400).json({ status: 'error', message: 'La imagen ya está en la lista.'});
            return;
        }

        // Agregar la nueva imagen y actualizar en la base de datos
        const nuevasImagenes = [...imagenesActuales, imagen];

        await pool.query('UPDATE servicios SET imagenes_adicionales = $1, updated_at = NOW() WHERE id = $2', [nuevasImagenes, id]);

        res.json({ status: 'success', message: 'Imagen añadida con éxito.', imagenes_adicionales: nuevasImagenes });
    } catch (error) {
        console.error('Error al actualizar las imágenes:', error);
        res.status(500).json({ status: 'error', message: 'No se pudo actualizar las imágenes.' });
    }
};

// Asigna la función al endpoint
router.put('/:id/imagenes', actualizarImagenes);

export default router;
