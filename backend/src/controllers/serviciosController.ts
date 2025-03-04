import { Request, Response } from "express";
import {
    obtenerTodosLosServicios,
    obtenerServicioPorId,
    actualizarImagenPrincipal,
    eliminarImagenPrincipal,
    agregarImagenAdicional,
    eliminarImagenAdicional
} from "../services/serviciosService.js";

/**
 * Controlador para obtener todos los servicios
 */
export const obtenerServicios = async (req: Request, res: Response): Promise<void> => {
    try {
        const servicios = await obtenerTodosLosServicios();
        res.json({ status: "success", data: servicios });
    } catch (error) {
        console.error("Error al consultar los servicios:", error);
        res.status(500).json({ status: "error", message: "No se pudieron obtener los servicios." });
    }
};

/**
 * Controlador para obtener un servicio por ID
 */
export const obtenerServicio = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        if (isNaN(Number(id))) {
            res.status(400).json({ status: "error", message: "ID inválido." });
            return;
        }
        
        const servicio = await obtenerServicioPorId(id);
        if (!servicio) {
            res.status(404).json({ status: "error", message: "Servicio no encontrado." });
            return;
        }
        res.json({ status: "success", data: servicio });
    } catch (error) {
        console.error("Error al obtener el servicio:", error);
        res.status(500).json({ status: "error", message: "No se pudo obtener el servicio. "});
    }
};

/**
 * Controlador para actualizar la imagen principal
 */
export const subirImagenPrincipal = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        if (!req.file) {
            res.status(400).json({ status: "error", message: "Debe subir una imagen." });
            return;
        }

        const imagenPath = await actualizarImagenPrincipal(id, req.file.filename);
        res.json({ status: "success", message: "Imagen principal actualizada correctamente.", image: imagenPath });
    } catch (error) {
        console.error("Error al actualizar la imagen principal:", error);
        res.status(500).json({ status: "error", message: "No se pudo actualizar la imagen principal." });
    }
};

/**
 * Controlador para eliminar la imagen principal
 */
export const borrarImagenPrincipal = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        await eliminarImagenPrincipal(id);
        res.json({ status: "success", message: "Imagen principal eliminada correctamente." });
    } catch (error) {
        console.error("Error al eliminar la imagen principal:", error);
        res.status(500).json({ status: "error", message: "No se pudo eliminar la imagen principal." });
    }
};

/**
 * Controlador para agregar una imagen adicional
 */
export const subirImagenAdicional = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        if (!req.file) {
            res.status(400).json({ status: "error", message: "Debe subir una imagen." });
            return;
        }

        const nuevasImagenes = await agregarImagenAdicional(id, req.file.filename);
        res.json({ status: "success", message: "Imagen adicional añadida con éxito.", imagenes_adicionales: nuevasImagenes });
    } catch (error) {
        console.error("Error al agregar la imagen adicional:", error);
        res.status(500).json({ status: "error", message: "No se pudo agregar la imagen." });
    }
};

/**
 * Controlador para eliminar una imagen adicional
 */
export const borrarImagenAdicional = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const { imagen } = req.body;

        const nuevasImagenes = await eliminarImagenAdicional(id, imagen);
        res.json({ status: "success", message: "Imagen eliminada correctamente.", imagenes_adicionales: nuevasImagenes });
    } catch (error) {
        console.error("Error al eliminar la imagen adicional:", error);
        res.status(500).json({ status: "error", message: "No se pudo eliminar la imagen." });
    }
};