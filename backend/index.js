import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import path from 'path';
import nodemailer from 'nodemailer';

// Configurar __dirname manualmente
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

// Verificar que las variables de entorno se están cargando correctamente
console.log('Usuario de Etheral:', process.env.ETHEREAL_USER);
console.log('Contraseña de Etheral:', process.env.ETHEREAL_PASS);

// Validar variables de entorno
if (!process.env.ETHEREAL_USER || !process.env.ETHEREAL_PASS) {
    console.error('ERROR: Las variables ETHEREAL_USER y ETHEREAL_PASS no están definidas en el archivo .env');
    process.exit(1);
}

const app = express();
const port = process.env.PORT || 3000;

// Middleware para habilitar CORS y parsear JSON
app.use(cors({ origin: 'http://localhost:5173' }));
app.use(express.json());

// Middleware para servir archivos estáticos
app.use('/assets', express.static(path.join(__dirname, '../frontend/public/assets')));

// Ruta raíz
app.get('/', (req, res) => {
    res.send('Bienvenido al backend de ACA-Logos');
});

// Ruta para enviar correos
app.post('/contacto', async (req, res) => {
    const { nombre, email, mensaje } = req.body;

    // Verificar si los datos están llegando correctamente
    console.log('Solicitud recibida:', req.body); // Log de los datos recibidos

    if (!nombre || !email || !mensaje) {
        console.error('Error: Faltan datos en la solicitud:', req.body);
        return res.status(400).json({ status: 'error', message: 'Por favor, completa todos los campos.' });
    }

    try {
        // Configuración de transporte de Modemailer con Ethereal
        const transporter = nodemailer.createTransport({
            host: 'smtp.ethereal.email',
            port: 587,
            auth: {
                user: process.env.ETHEREAL_USER,
                pass: process.env.ETHEREAL_PASS,
            }
        });

        // Opciones del correo
        const mailOptions = {
            from: email,
            to: 'regdis@gmail.com', // Cambiar este correo en producción
            subject: `Nuevo mensaje de contacto de ${nombre}`,
            text: mensaje,
            html: `<p><strong>Nombre:</strong> ${nombre}</p>
                   <p><strong>Email:</strong> ${email}</p>
                   <p><strong>Mensaje:</strong> ${mensaje}</p>`
        };

        // Enviar correo
        const info = await transporter.sendMail(mailOptions);

        // Log de la respuesta de Nodemailer
        console.log('Correo enviado con éxito:', info.messageId);

        res.status(200).json({
            status: 'success',
            message: 'Correo enviado con éxito.',
            info: info.messageId
        });
    } catch (error) {
        console.error('Error al enviar el correo:', error);
        res.status(500).json({ status: 'error', message: 'No se pudo enviar el correo, intenta nuevamente.' });
    }
});

// Ruta para obtener servicios de impresión
app.get('/servicios', (req, res) => {
    const servicios = [
        {
            id: 1,
            nombre: 'Impresión de pendones',
            descripcion: 'Impresión de alta calidad para pendones en todo tipo de materiales.',
            precio: 'Consultar',
            imagen: '/assets/images/servicios/pendones-fullsize.webp'
        },
        {
            id: 2,
            nombre: 'Corte de letras en plotter',
            descripcion: 'Corte de letras y figuras en plotter para decoración de interiores y exteriores.',
            precio: 'Consultar',
            imagen: '/assets/images/servicios/corte-plotter-fullsize.webp'
        },
        {
            id: 3,
            nombre: 'Impresión de autoadhesivos',
            descripcion: 'Impresión de autoadhesivos de alta calidad para decoración y publicidad.',
            precio: 'Consultar',
            imagen: '/assets/images/servicios/autoadhesivos-fullsize.webp'
        },
        {
            id: 4,
            nombre: 'Impresión de letreros',
            descripcion: 'Impresión personalizada de letreros para empresas y eventos.',
            precio: 'Consultar',
            imagen: '/assets/images/servicios/impresiones-fullsize.webp'
        },
        {
            id: 5,
            nombre: 'Empavonado de vidrios (vinilado)',
            descripcion: 'Decoración y privacidad con vinilos empavonados para ventanas y oficinas.',
            precio: 'Consultar',
            imagen: '/assets/images/servicios/empavonado-fullsize.webp'
        }
    ];
    res.json({ status: 'success', data: servicios });
});

// Ruta para consultar sobre proyectos personalizados
app.get('/proyectos', (req, res) => {
    const proyectos = [
        { id: 1, nombre: 'Decoración de oficinas', descripción: 'Decoración de oficinas corporativas con impresiones personalizadas.' },
        { id: 2, nombre: 'Publicidad en eventos', descripción: 'Impresiones personalizadas para publicidad en eventos y ferias.' },
    ];
    res.json({ status: 'success', data: proyectos });
});

// Ruta para obtener información de contacto (GET)
app.get('/contacto-info', (req, res) => {
    const contacto = {
        telefono: '123-456-7890',
        email: 'contacto@empresa.com',
        direccion: 'Calle Ejemplo, Ciudad, País'
    };
    res.json({ status: 'success', data: contacto });
});

// Ruta para crear un nuevo proyecto (POST)
app.post('/proyectos', (req, res) => {
    const nuevoProyecto = req.body; // Aquí recibiríamos la data enviada por el cliente
    console.log('Nuevo proyecto recibido:', nuevoProyecto);
    res.status(201).json({ status: 'success', message: 'Proyecto creado con éxito', data: nuevoProyecto });
});

// Middleware para manejo de errores
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ status: 'error', message: 'Algo salió mal, por favor intenta nuevamente.' });
})

// Iniciar servidor
app.listen(port, () => {
    console.log(`Servidor corriendo en http://localhost:${port}`);
});