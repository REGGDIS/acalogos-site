import * as serviciosController from "./controllers/serviciosController.js";
import { verifyToken } from "./middlewares/authMiddleware.js";
import upload, { handleUploadError, validateUploadedImage } from "./middlewares/uploadMiddleware.js";
import { createServiciosRouter } from "./routes/servicios.js";
import { createAuthRouter } from "./routes/auth.js";
import { createApp } from "./app.js";
import { config } from "./config.js";
import { pool } from "./db.js";
import { publicAssetsPath } from "./uploadConfig.js";
import { PostgresContactRepository } from "./repositories/contactosRepository.js";
import { BrevoContactNotifier } from "./services/brevoNotificationService.js";
import { ContactoService } from "./services/contactoService.js";
import { createContactoRouter } from "./routes/contacto.js";

const contactoRouter = config.contact.enabled
    ? createContactoRouter({
        service: new ContactoService(
            new PostgresContactRepository(pool),
            new BrevoContactNotifier({
                apiKey: config.contact.brevoApiKey,
                toEmail: config.contact.toEmail,
                fromEmail: config.contact.fromEmail,
                timeoutMs: config.contact.emailTimeoutMs,
            }),
        ),
        privacyNoticeVersion: config.contact.privacyNoticeVersion,
        rateLimitWindowMs: config.contact.rateLimitWindowMs,
        rateLimitMax: config.contact.rateLimitMax,
    })
    : undefined;

const serviciosRoutes = createServiciosRouter({
    ...serviciosController,
    verifyToken,
    uploadSingle: upload.single("imagen"),
    validateUploadedImage,
    handleUploadError,
});
const authRoutes = createAuthRouter({
    adminUser: config.adminUser,
    adminPass: config.adminPass,
    jwtSecret: config.jwtSecret,
});

const app = createApp({
    corsOrigins: config.corsOrigins,
    publicAssetsPath,
    serviciosRouter: serviciosRoutes,
    authRouter: authRoutes,
    contactoRouter,
});

console.log(`📂 Sirviendo archivos estáticos desde: ${publicAssetsPath}`);

app.listen(config.port, () => {
    console.log(`🚀 Servidor corriendo en http://localhost:${config.port}`);
});
