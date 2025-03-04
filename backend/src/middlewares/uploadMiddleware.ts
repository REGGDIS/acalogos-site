import multer from "multer";
import path from "path";
import fs from "fs";

// Definir la carpeta donde se guardarán las imágenes
const uploadPath = "dist/public/assets/images/servicios";

// Verificar si la carpeta existe, si no, crearla
if (!fs.existsSync(uploadPath)) {
    fs.mkdirSync(uploadPath, { recursive: true });
}

// Configurar multer
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadPath),
    filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});

const upload = multer({ storage });

export default upload;