require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const session = require('express-session');

<<<<<<< HEAD
const authRoutes = require('./routes/auth.routes');
const alumnosRoutes = require('./routes/alumnos.routes');
const registrosRoutes = require('./routes/registros.routes');
const { verificarConexion } = require('./database/db');

const app = express();
const PORT = process.env.SERVER_PORT || 3000;

app.use(cors({
    origin: `http://localhost:${PORT}`,
    credentials: true
=======
//modelos es todas las querys, donde se define una clase y lo unico que hacemos es llamarla desde controller
//controller es la validación antes de pasasr a modelos
//router es el mtedodo (get, post, put, delete) y la ruta, tambien se pone el 


// 2. Configuración de la App
const app = express();
const PORT = process.env.SERVER_PORT || 3000;

const __dirname = path.resolve();

// 4. Middlewares
app.use(cors());
app.use(express.json()); // Para procesar req.body en formato JSON
app.use(express.urlencoded({ extended: true })); // Para procesar datos de formularios estándar

// Configuración de Sesión
app.use(session({
    secret: process.env.SESSION_SECRET, // Clave de seguridad CRÍTICA
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false } // 'false' para localhost
>>>>>>> 0c61e1fff00ddc1f7e6011bd3b1c125f2cad8337
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
    secret: process.env.SESSION_SECRET || 'mi_secreto_local',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false,
        maxAge: 24 * 60 * 60 * 1000
    }
}));

// ✅ CORREGIDO: Sirve archivos desde /frontend/public/
app.use(express.static(path.join(__dirname, '..', 'frontend', 'public'), {
    extensions: ['html', 'css', 'js'],
    index: false // No servir index.html automáticamente
}));

// Middleware de protección de rutas
app.use((req, res, next) => {
    const ruta = req.path;
    
    // Si es un archivo HTML
    if (ruta.endsWith('.html')) {
        // Páginas públicas
        const paginasPublicas = ['/login.html', '/index.html'];
        
        if (paginasPublicas.includes(ruta)) {
            return next();
        }
        
        // Verificar autenticación para otras páginas
        if (!req.session.user) {
            return res.redirect('/login.html');
        }

        const userType = req.session.user.tipo;

        if (ruta === '/Entrada_Salida.html') {
            if (userType !== 'Prefecto' && userType !== 'Administrador') {
                return res.status(403).send(`
                    <h1>Acceso Denegado</h1>
                    <p>No tienes permisos para acceder a esta página.</p>
                    <a href="/">Volver al inicio</a>
                `);
            }
        }

        if (ruta === '/admin-dashboard.html') {
            if (userType !== 'Administrador') {
                return res.status(403).send(`
                    <h1>Acceso Denegado</h1>
                    <p>Solo administradores pueden acceder a esta página.</p>
                    <a href="/">Volver al inicio</a>
                `);
            }
        }
    }
    
    next();
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/alumnos', alumnosRoutes);
app.use('/api/registros', registrosRoutes);

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

// ✅ CORREGIDO: Manejo de rutas HTML específicas
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

// Manejo de errores 404
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