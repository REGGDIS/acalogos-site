import express, { Request, Response, NextFunction } from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import serviciosRoutes from './routes/servicios.js';
import authRoutes from "./routes/auth.js";

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// 📌 Definir __dirname en ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ✅ Middleware para procesar JSON y datos de formularios
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ✅ Configurar CORS para permitir solicitudes del frontend
app.use(cors({
    origin: 'http://localhost:5173',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// ✅ Servir archivos estáticos desde `public/assets`
const staticPath = path.resolve(__dirname, './public/assets');
console.log(`📂 Sirviendo archivos estáticos desde: ${staticPath}`);

app.use('/assets', express.static(staticPath, {
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
    console.error(err.stack);
    res.status(500).json({ status: 'error', message: 'Algo salió mal, por favor intenta nuevamente.' });
});

// ✅ Iniciar servidor
app.listen(port, () => {
    console.log(`🚀 Servidor corriendo en http://localhost:${port}`);
});
