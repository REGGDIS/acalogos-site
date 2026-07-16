import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import cors, { type CorsOptions } from 'cors';
import multer from 'multer';
import path from 'path';
import serviciosRoutes from './routes/servicios.js';
import authRoutes from "./routes/auth.js";
import { config } from './config.js';
import { UploadHttpError } from './middlewares/uploadMiddleware.js';
import { publicAssetsPath } from './uploadConfig.js';

const app = express();
const port = config.port;

// ✅ Middleware para procesar JSON y datos de formularios
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ✅ Configurar CORS para permitir solicitudes del frontend
const corsOptions: CorsOptions = {
    origin: (origin, callback) => {
        if (!origin) {
            callback(null, true);
            return;
        }

        const normalizedOrigin = origin.trim().replace(/\/+$/, '');
        if (config.corsOrigins.includes(normalizedOrigin)) {
            callback(null, true);
            return;
        }

        callback(new Error('Origen CORS no autorizado.'));
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// ✅ Servir archivos estáticos desde la carpeta canónica de assets administrados
console.log(`📂 Sirviendo archivos estáticos desde: ${publicAssetsPath}`);

app.use('/assets', express.static(publicAssetsPath, {
    setHeaders: (res, filePath) => {
        const extension = path.extname(filePath).toLowerCase();
        const mimeTypes: { [key: string]: string } = {
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.png': 'image/png',
            '.webp': 'image/webp',
            '.gif': 'image/gif'
        };
        if (mimeTypes[extension]) {
            res.setHeader('Content-Type', mimeTypes[extension]);
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
            res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        }
    }
}));

// ✅ Rutas protegidas
app.use('/servicios', serviciosRoutes);

// ✅ Rutas públicas
app.use("/admin", authRoutes);

// ✅ Ruta raíz
app.get('/', (req: Request, res: Response) => {
    res.send('Bienvenido al backend de ACA-Logos');
});

// ✅ Middleware para manejo de errores
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    if (res.headersSent) {
        next(err);
        return;
    }

    if (err instanceof UploadHttpError) {
        res.status(err.statusCode).json({ status: 'error', message: err.message });
        return;
    }

    if (err instanceof multer.MulterError) {
        const statusCode = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
        const message = err.code === 'LIMIT_FILE_SIZE'
            ? 'La imagen supera el tamaño máximo permitido de 5 MiB.'
            : 'Solicitud de archivo inválida.';

        res.status(statusCode).json({ status: 'error', message });
        return;
    }

    if (err.message === 'Origen CORS no autorizado.') {
        res.status(403).json({ status: 'error', message: 'Origen no autorizado.' });
        return;
    }

    console.error('Error interno inesperado:', err);
    res.status(500).json({ status: 'error', message: 'Error interno del servidor.' });
});

// ✅ Iniciar servidor
app.listen(port, () => {
    console.log(`🚀 Servidor corriendo en http://localhost:${port}`);
});
