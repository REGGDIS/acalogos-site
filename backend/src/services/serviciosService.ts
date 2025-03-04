import { pool } from "../db.js";
import path from "path";
import fs from "fs-extra";

const uploadPath = path.resolve("dist/public/assets/images/servicios");

if (!fs.existsSync(uploadPath)) {
    fs.mkdirSync(uploadPath, { recursive: true });
}

export const obtenerTodosLosServicios = async () => {
    try {
        const result = await pool.query("SELECT * FROM servicios ORDER BY id");
        return result.rows;
    } catch (error) {
        throw new Error(`Error al obtener los servicios: ${error}`);
    }
};

export const obtenerServicioPorId = async (id: string) => {
    try {
        const result = await pool.query("SELECT * FROM servicios WHERE id = $1", [id]);
        return result.rows[0] || null;
    } catch (error) {
        throw new Error(`Error al obtener el servicio con ID ${id}: ${error}`);
    }
};

export const actualizarImagenPrincipal = async (id: string, filename: string) => {
    try {
        const imagenPath = `/assets/images/servicios/${filename}`;
        const result = await pool.query("SELECT imagen FROM servicios WHERE id = $1", [id]);

        if (result.rows.length > 0 && result.rows[0].imagen) {
            const oldImagePath = path.join(uploadPath, path.basename(result.rows[0].imagen));
            if (fs.existsSync(oldImagePath)) {
                fs.unlinkSync(oldImagePath);
            }
        }

        await pool.query("UPDATE servicios SET imagen = $1, updated_at = NOW() WHERE id = $2", [imagenPath, id]);

        return imagenPath;
    } catch (error) {
        throw new Error(`Error al actualizar la imagen principal: ${error}`);
    }
};

export const eliminarImagenPrincipal = async (id: string) => {
    try {
        const result = await pool.query("SELECT imagen FROM servicios WHERE id = $1", [id]);
        if (result.rows.length === 0 || !result.rows[0].imagen) return;

        const imagePath = path.join(uploadPath, path.basename(result.rows[0].imagen));
        if (fs.existsSync(imagePath)) {
            fs.unlinkSync(imagePath);
        }

        await pool.query("UPDATE servicios SET imagen = NULL, updated_at = NOW() WHERE id = $1", [id]);
    } catch (error) {
        throw new Error(`Error al eliminar la imagen principal: ${error}`);
    }
};

export const agregarImagenAdicional = async (id: string, filename: string) => {
    try {
        const imagenPath = `/assets/images/servicios/${filename}`;
        const result = await pool.query("SELECT imagenes_adicionales FROM servicios WHERE id = $1", [id]);

        if (result.rows.length === 0) {
            throw new Error(`El servicio con ID ${id} no existe`);
        }

        const imagenesActuales: string[] = result.rows[0]?.imagenes_adicionales || [];
        const nuevasImagenes = [...imagenesActuales, imagenPath];

        await pool.query("UPDATE servicios SET imagenes_adicionales = $1, updated_at = NOW() WHERE id = $2", [
            nuevasImagenes,
            id,
        ]);

        return nuevasImagenes;
    } catch (error) {
        throw new Error(`Error al agregar imagen adicional: ${error}`);
    }
};

export const eliminarImagenAdicional = async (id: string, imagen: string) => {
    try {
        const result = await pool.query("SELECT imagenes_adicionales FROM servicios WHERE id = $1", [id]);
        if (result.rows.length === 0) {
            throw new Error(`El servicio con ID ${id} no existe`);
        }

        const nuevasImagenes = result.rows[0].imagenes_adicionales.filter((img: string) => img !== imagen);
        await pool.query("UPDATE servicios SET imagenes_adicionales = $1, updated_at = NOW() WHERE id = $2", [
            nuevasImagenes,
            id,
        ]);

        return nuevasImagenes;
    } catch (error) {
        throw new Error(`Error al eliminar imagen adicional: ${error}`);
    }
};