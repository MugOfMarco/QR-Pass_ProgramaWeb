// backend/server.js

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const session = require('express-session');

// 1. IMPORTACIÓN DE RUTAS (Routers) y Base de Datos (Core)
// Ahora server.js sabe dónde encontrar los endpoints de la API
const authRoutes = require('./routes/auth.routes'); 
const alumnosRoutes = require('./routes/alumnos.routes');
const registrosRoutes = require('./routes/registros.routes');
const { verificarConexion } = require('./database/db'); // Necesario para el chequeo inicial

const app = express();
const PORT = process.env.SERVER_PORT || 3000;

// Necesario para que path.join funcione correctamente
const __dirname = path.resolve(); 

// 2. Middlewares Globales
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Configuración de Sesión
app.use(session({
    secret: process.env.SESSION_SECRET || 'mi_secreto_local', // Clave de seguridad CRÍTICA
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: false, // Usar 'true' si usas HTTPS
        maxAge: 24 * 60 * 60 * 1000 // 24 horas
    }
}));

// ✅ Sirve archivos estáticos desde /frontend/public/
app.use(express.static(path.join(__dirname, '..', 'frontend', 'public'), {
    extensions: ['html', 'css', 'js'],
    index: false 
}));

// 3. Middleware de Protección de Rutas (Lógica de Navegación)
// Este es el middleware de tu compañero, que es excelente para proteger las páginas .html
app.use((req, res, next) => {
    const ruta = req.path;
    
    // Si es un archivo HTML (protegido)
    if (ruta.endsWith('.html')) {
        const paginasPublicas = ['/login.html', '/index.html']; 
        
        if (paginasPublicas.includes(ruta)) {
            return next();
        }
        
        if (!req.session.user) {
            return res.redirect('/login.html');
        }

        const userType = req.session.user.tipo;

        // Reglas de acceso a páginas específicas
        if (ruta === '/Entrada_Salida.html') {
            if (userType !== 'Prefecto' && userType !== 'Administrador') {
                return res.status(403).send('<h1>Acceso Denegado</h1><p>No tienes permisos.</p><a href="/">Volver al inicio</a>');
            }
        }

        // Puedes agregar más reglas aquí para otras páginas de admin (ej: /RegistrarAlumno.html)
        // if (ruta === '/admin-dashboard.html' || ruta === '/RegistrarAlumno.html' || ruta === '/ModificarAlumno.html') {
        //     if (userType !== 'Administrador') {
        //         return res.status(403).send('<h1>Acceso Denegado</h1><p>Solo administradores.</p><a href="/">Volver al inicio</a>');
        //     }
        // }
    }
    
    next();
});

// 4. USO DE ROUTERS DE API (El enlace principal a los Controladores)
app.use('/api/auth', authRoutes); // Maneja /api/auth/login, /api/auth/logout
app.use('/api/alumnos', alumnosRoutes); // Maneja /api/alumnos/:boleta, /api/alumnos/bloquear/:boleta
app.use('/api/registros', registrosRoutes); // Maneja /api/registros/ y consultas

// 5. Rutas de Navegación HTML (Redirecciones y Servido de Páginas)

// Ruta raíz - Redirección inteligente
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

// ✅ Manejo de rutas HTML específicas (Para que el Middleware las evalúe)
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
        // El middleware superior ya chequeó los permisos
        res.sendFile(filePath);
    });
});


// 6. Manejo de Errores (404 y 500)
app.use((req, res) => {
    // ... (Tu manejo de 404 está bien)
    if (req.accepts('html')) {
        const filePath = path.join(__dirname, '..', 'frontend', 'public', '404.html');
        res.status(404).sendFile(filePath);
    } else if (req.accepts('json')) {
        res.status(404).json({ success: false, message: 'Ruta no encontrada' });
    } else {
        res.status(404).send('Página no encontrada');
    }
});

app.use((err, req, res, next) => {
    // ... (Tu manejo de errores 500 está bien)
    console.error('Error:', err.stack);
    if (err.code === 'ECONNREFUSED') {
        return res.status(503).json({ success: false, message: 'Error de conexión con la base de datos' });
    }
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
});


// 7. INICIO DEL SERVIDOR (Chequeo de DB + Listen)
async function iniciarServidor() {
    try {
        const dbConectada = await verificarConexion(); // Llama a la función de db.js

        if (!dbConectada) {
            console.error('ERROR: No se pudo conectar a la base de datos');
            process.exit(1);
        }

        app.listen(PORT, () => {
            console.log(`✅ Servidor iniciado en http://localhost:${PORT}`);
        });
    } catch (error) {
        console.error('Error al iniciar el servidor:', error);
        process.exit(1);
    }
}

iniciarServidor();