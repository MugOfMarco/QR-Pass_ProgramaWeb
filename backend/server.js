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

// --- 1. CONFIGURACIÓN DE CORS ---
app.use(cors({
    origin: 'http://localhost:3000', // Asegúrate que coincida con lo que pones en el navegador
    credentials: true 
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- 2. CONFIGURACIÓN DE SESIÓN OPTIMIZADA ---
app.use(session({
    secret: 'tu_secreto', // En producción usa una variable de entorno
    resave: true,         // Forzamos el guardado para evitar pérdida de sesión
    saveUninitialized: true, // Asegura que la cookie se cree desde el primer contacto
    cookie: {
        httpOnly: true,
        secure: false,    // Cambiar a true solo si usas HTTPS
        sameSite: 'lax',  // Ayuda a la persistencia en navegadores modernos
        maxAge: 1000 * 60 * 60 * 8 // 8 horas
    }
}));

// --- 3. MIDDLEWARE DE PROTECCIÓN PARA API ---
const protegerAPI = (req, res, next) => {
    console.log("Verificando sesión para:", req.path);
    console.log("ID de sesión:", req.sessionID);
    console.log("Datos del usuario:", req.session.user);

    if (!req.session || !req.session.user) {
        console.log("Acceso denegado: No hay usuario en sesión");
        return res.status(401).json({
            success: false,
            message: 'Sesión no válida o expirada. Por favor, inicie sesión.'
        });
    }
    next();
};

// --- 4. RUTAS DE LA API ---
// authRoutes no se protege porque incluye el login
app.use('/api/auth', authRoutes); 

// Estas rutas requieren que el usuario esté logueado
app.use('/api/alumnos', protegerAPI, alumnosRoutes);
app.use('/api/registros', protegerAPI, registrosRoutes);
app.use('/api/upload', protegerAPI, uploadRoutes);

// --- 5. ARCHIVOS ESTÁTICOS ---
app.use(express.static(path.join(__dirname, '..', 'frontend', 'public'), {
    extensions: ['html', 'css', 'js'],
    index: false
}));

// --- 6. MIDDLEWARE DE PROTECCIÓN PARA VISTAS HTML ---
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

        // Reglas de acceso por rol
        if (ruta === '/Entrada_Salida.html') {
            if (userType !== 'Prefecto' && userType !== 'Administrador') {
                return res.status(403).send('<h1>Acceso Denegado</h1><p>No tienes permisos.</p><a href="/">Volver al inicio</a>');
            }
        }
    }
    next();
});

// --- 7. MANEJO DE RUTAS HTML ---
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

// --- 8. MANEJO DE ERRORES 404 ---
app.use((req, res) => {
    if (req.accepts('html')) {
        const filePath = path.join(__dirname, '..', 'frontend', 'public', '404.html');
        res.status(404).sendFile(filePath);
    } else {
        res.status(404).json({ success: false, message: 'Ruta no encontrada' });
    }
});

// --- 9. MANEJO GLOBAL DE ERRORES ---
app.use((err, req, res, next) => {
    console.error('Error Crítico:', err.stack);
    res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
    });
});

// --- 10. INICIO DEL SERVIDOR ---
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