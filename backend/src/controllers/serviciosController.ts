import type { Request, Response } from "express";
import {
    obtenerTodosLosServicios,
    obtenerServicioPorId,
    actualizarImagenPrincipal,
    eliminarImagenPrincipal,
    agregarImagenAdicional,
    eliminarImagenAdicional
} from "../services/serviciosService.js";
import { ImagenReferenciaNoEncontradaError, ServicioNoEncontradoError } from "../errors/serviciosErrors.js";

const sendKnownServiceError = (res: Response, error: unknown, fallbackMessage: string): void => {
    if (error instanceof ServicioNoEncontradoError) {
        res.status(404).json({ status: "error", message: "Servicio no encontrado." });
        return;
    }

    if (error instanceof ImagenReferenciaNoEncontradaError) {
        res.status(404).json({ status: "error", message: "Referencia de imagen no encontrada." });
        return;
    }

    res.status(500).json({ status: "error", message: fallbackMessage });
};

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

        const imagenPath = await actualizarImagenPrincipal(id, req.file.buffer);
        res.json({ status: "success", message: "Imagen principal actualizada correctamente.", image: imagenPath });
    } catch (error) {
        sendKnownServiceError(res, error, "No se pudo actualizar la imagen principal.");
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
        sendKnownServiceError(res, error, "No se pudo eliminar la imagen principal.");
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

        const nuevasImagenes = await agregarImagenAdicional(id, req.file.buffer);
        res.json({ status: "success", message: "Imagen adicional añadida con éxito.", imagenes_adicionales: nuevasImagenes });
    } catch (error) {
        sendKnownServiceError(res, error, "No se pudo agregar la imagen.");
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
        sendKnownServiceError(res, error, "No se pudo eliminar la imagen.");
    }
};
