export class ServicioNoEncontradoError extends Error {
    constructor() {
        super("Servicio no encontrado.");
        this.name = "ServicioNoEncontradoError";
    }
}

export class ImagenReferenciaNoEncontradaError extends Error {
    constructor() {
        super("Referencia de imagen no encontrada.");
        this.name = "ImagenReferenciaNoEncontradaError";
    }
}
