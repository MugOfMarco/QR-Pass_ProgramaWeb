import 'dotenv/config'; 
import express from 'express';
import cors from 'cors';
import path from 'path';
import session from 'express-session';
import { fileURLToPath } from 'url'; 

import authRoutes from './routes/auth.routes.js'; 
import alumnosRoutes from './routes/alumnos.routes.js';
import registrosRoutes from './routes/registros.routes.js';
import { verificarConexion } from './database/db.js';
import uploadRoutes from './routes/upload.routes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.SERVER_PORT || 3000;

app.use(cors({
    origin: 'http://localhost:3000', // o tu dominio
    credentials: true // IMPORTANTE
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
    secret: 'tu_secreto',
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        secure: false, // true en producción con HTTPS
        maxAge: 1000 * 60 * 60 * 8 // 8 horas
    }
}));

app.use(express.static(path.join(__dirname, '..', 'frontend', 'public'), {
    extensions: ['html', 'css', 'js'],
    index: false
}));

app.use((req, res, next) => {
    const ruta = req.path;
    
    if (ruta.endsWith('.html')) {
        const paginasPublicas = ['/login.html', '/index.html']; 
        
        if (paginasPublicas.includes(ruta)) {
            return next();
        }
        
        if (!req.session.user) {
            return res.redirect('/login.html');
        }

        const userType = req.session.user.tipo;

        if (ruta === '/Entrada_Salida.html') {
            if (userType !== 'Prefecto' && userType !== 'Administrador') {
                return res.status(403).send('<h1>Acceso Denegado</h1><p>No tienes permisos.</p><a href="/">Volver al inicio</a>');
            }
        }
    }
    
    next();
});

app.use('/api/auth', authRoutes);
app.use('/api/alumnos', alumnosRoutes);
app.use('/api/registros', registrosRoutes);
app.use('/api/upload', uploadRoutes);

app.get('/', (req, res) => {
    if (req.session.user) {
        if (req.session.user.tipo === 'Administrador') {
            return res.redirect('/menu.html');
        } else if (req.session.user.tipo === 'Prefecto') {
            return res.redirect('/Entrada_Salida.html');
        }
    }
    res.redirect('/login.html');
});

const rutasHTML = [
    '/login.html',
    '/Entrada_Salida.html',
    '/BuscarAlumno.html',
    '/DescargasBD.html',
    '/ModificarAlumno.html',
    '/RegistrarAlumno.html',
    '/menu.html'
];

rutasHTML.forEach(ruta => {
    app.get(ruta, (req, res) => {
        const filePath = path.join(__dirname, '..', 'frontend', 'public', ruta);
        res.sendFile(filePath);
    });
});

app.use((req, res) => {
    if (req.accepts('html')) {
        const filePath = path.join(__dirname, '..', 'frontend', 'public', '404.html');
        res.status(404).sendFile(filePath);
    } else if (req.accepts('json')) {
        res.status(404).json({
            success: false,
            message: 'Ruta no encontrada'
        });
    } else {
        res.status(404).send('Página no encontrada');
    }
});

app.use((err, req, res, next) => {
    console.error('Error:', err.stack);

    if (err.code === 'ECONNREFUSED') {
        return res.status(503).json({
            success: false,
            message: 'Error de conexión con la base de datos'
        });
    }

    res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
    });
});

async function iniciarServidor() {
    try {
        const dbConectada = await verificarConexion();

        if (!dbConectada) {
            console.error('ERROR: No se pudo conectar a la base de datos');
            process.exit(1);
        }

        app.listen(PORT, () => {
            console.log(`Servidor iniciado en http://localhost:${PORT}`);
        });
    } catch (error) {
        console.error('Error al iniciar el servidor:', error);
        process.exit(1);
    }
}

iniciarServidor();