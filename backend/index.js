import express from 'express';
import cors from 'cors';

const app = express();
const port = 3000;

// Middleware para habilitar CORS
app.use(cors());

// Middleware para parsear el cuerpo de las solicitudes como JSON
app.use(express.json());

// Ruta raíz para comprobar si el servidor está funcionando
app.get('/', (req, res) => {
    res.send('Bienvenido al backend de ACA-Logos');
});

// Ruta para obtener servicios de impresión
app.get('/servicios', (req, res) => {
    const servicios = [
        { id: 1, nombre: 'Impresión de pendones', descripción: 'Impresión de alta calidad para pendones en todo tipo de materiales.' },
        { id: 2, nombre: 'Corte de letras en plotter', descripción: 'Corte de letras y figuras en plotter para decoración de interiores y exteriores.' },
        { id: 3, nombre: 'Impresión de autoadhesivos', descripción: 'Impresión de autoadhesivos en alta calidad para decoración y publicidad.' }
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

// Ruta para obtener contacto
app.get('/contacto', (req, res) => {
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
    // Guardar el proyecto en una base de datos (simulado aqui)
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