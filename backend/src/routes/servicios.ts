import { Router } from "express";
import type { ErrorRequestHandler, RequestHandler } from "express";

export type ServiciosRouterDependencies = {
    obtenerServicios: RequestHandler;
    obtenerServicio: RequestHandler;
    subirImagenPrincipal: RequestHandler;
    borrarImagenPrincipal: RequestHandler;
    subirImagenAdicional: RequestHandler;
    borrarImagenAdicional: RequestHandler;
    verifyToken: RequestHandler;
    uploadSingle: RequestHandler;
    validateUploadedImage: RequestHandler;
    handleUploadError: ErrorRequestHandler;
};

export const createServiciosRouter = (dependencies: ServiciosRouterDependencies): Router => {
    const router = Router();

    // ✅ Obtener todos los servicios
    router.get("/", dependencies.obtenerServicios);

    // ✅ Obtener detalles de un servicio por ID
    router.get("/:id", dependencies.obtenerServicio);

    // ✅ Subir imagen principal de un servicio
    router.put("/:id/imagen-principal", dependencies.verifyToken, dependencies.uploadSingle, dependencies.validateUploadedImage, dependencies.subirImagenPrincipal);

    // ✅ Eliminar imagen principal de un servicio
    router.delete("/:id/imagen-principal", dependencies.verifyToken, dependencies.borrarImagenPrincipal);

    // ✅ Subir imagen adicional a un servicio
    router.put("/:id/imagenes", dependencies.verifyToken, dependencies.uploadSingle, dependencies.validateUploadedImage, dependencies.subirImagenAdicional);

    // ✅ Eliminar imagen adicional de un servicio
    router.delete("/:id/imagenes", dependencies.verifyToken, dependencies.borrarImagenAdicional);

    router.use(dependencies.handleUploadError);

    return router;
};
