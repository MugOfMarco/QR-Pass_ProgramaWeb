// backend/index.js (El nuevo server.js)

const express = require('express');
const path = require('path');
const session = require('express-session');
const cors = require('cors');
const bcrypt = require('bcrypt');
require('dotenv').config();

// Importar Routers
const authRouter = require('./routers/auth.router'); 
// const alumnosRouter = require('./routers/alumnos.router'); // Cuando lo crees

const app = express();
const PORT = process.env.SERVER_PORT || 3000;

// ==========================================
// MIDDLEWARES GENERALES
// ==========================================
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Configuración de Sesión
app.use(session({
    secret: process.env.SESSION_SECRET, 
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false }
}));

// Archivos Estáticos (Frontend)
app.use(express.static(path.join(__dirname, '..'))); 
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// ==========================================
// USO DE ROUTERS
// ==========================================
// Todas las rutas de autenticación definidas en auth.router.js se prefijan con /api
app.use('/api', authRouter); 
// app.use('/api', alumnosRouter); // Descomentar al crear el router de alumnos


// ==========================================
// RUTAS DE NAVEGACIÓN Y PROTECCIÓN
// ==========================================

// Ruta Raíz ('/') -> ACTÚA COMO REDIRECTOR INTELIGENTE
app.get('/', (req, res) => {
    // La lógica de protección se mantiene aquí, pero ahora usa la sesión establecida
    if (req.session.user) {
        if (req.session.user.tipo === 'Administrador') {
            return res.redirect('/admin-dashboard.html');
        } 
        else if (req.session.user.tipo === 'Prefecto') {
            return res.redirect('/Entrada_Salida.html'); 
        }
    }
    res.sendFile(path.join(__dirname, '..', 'index.html')); // index.html es el login
});

// Ruta Protegida: ESCÁNER (Ejemplo, usa la misma lógica de server.js)
app.get('/Entrada_Salida.html', (req, res) => {
    if (!req.session.user) {
        return res.redirect('/');
    }
    const userType = req.session.user.tipo;
    if (userType === 'Prefecto' || userType === 'Administrador') {
        res.sendFile(path.join(__dirname, '..', 'Entrada_Salida.html'));
    } else {
        res.status(403).send('Permiso Denegado.');
    }
});

// INICIAR SERVIDOR
app.listen(PORT, () => {
    console.log(`✅ Servidor API corriendo en http://localhost:${PORT}`);
});