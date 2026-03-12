
// ============================================================
// ARCHIVO 6: backend/app.js  (MIGRADO — quita db.js, entra supabase)
// ============================================================
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import session from 'express-session';
import { fileURLToPath } from 'url';
 
import authRoutes     from './routes/auth.routes.js';
import alumnosRoutes  from './routes/alumnos.routes.js';
import registrosRoutes from './routes/registros.routes.js';
import uploadRoutes   from './routes/upload.routes.js';
 
// Verificamos que Supabase responde al arrancar
import { supabaseAdmin } from './database/supabase.js';
 
const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
 
const app  = express();
const PORT = process.env.SERVER_PORT || 3000;
 
app.use(cors({
    origin:      process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true
}));
 
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
 
app.use(session({
    secret:            process.env.SESSION_SECRET || 'cecyt9_secret_2025',
    resave:            true,
    saveUninitialized: true,
    cookie: {
        httpOnly: true,
        secure:   false,   // true solo con HTTPS en producción
        sameSite: 'lax',
        maxAge:   1000 * 60 * 60 * 8  // 8 horas
    }
}));
 
// Middleware de protección de rutas API
const protegerAPI = (req, res, next) => {
    if (!req.session || !req.session.user) {
        return res.status(401).json({
            success: false,
            message: 'Sesión no válida o expirada. Por favor, inicie sesión.'
        });
    }
    next();
};
 
// Rutas
app.use('/api/auth',      authRoutes);
app.use('/api/alumnos',   protegerAPI, alumnosRoutes);
app.use('/api/registros', protegerAPI, registrosRoutes);
app.use('/api/upload',    uploadRoutes);
 
// Archivos estáticos del frontend
app.use(express.static(path.join(__dirname, '..', 'frontend', 'public'), {
    extensions: ['html', 'css', 'js'],
    index: false
}));
 
// Protección de vistas HTML por rol
app.use((req, res, next) => {
    const ruta = req.path;
    if (ruta.endsWith('.html')) {
        const paginasPublicas = ['/login.html', '/index.html'];
        if (paginasPublicas.includes(ruta)) return next();
        if (!req.session.user) return res.redirect('/login.html');
 
        const userType = req.session.user.tipo;
        if (ruta === '/Entrada_Salida.html') {
            if (userType !== 'Prefecto' && userType !== 'Administrador') {
                return res.status(403).send('<h1>Acceso Denegado</h1><a href="/">Volver</a>');
            }
        }
    }
    next();
});
 
app.get('/', (req, res) => {
    if (req.session.user) {
        if (req.session.user.tipo === 'Administrador') return res.redirect('/menu.html');
        if (req.session.user.tipo === 'Prefecto')       return res.redirect('/Entrada_Salida.html');
    }
    res.redirect('/login.html');
});
 
const rutasHTML = [
    '/login.html', '/Entrada_Salida.html', '/BuscarAlumno.html',
    '/DescargasBD.html', '/ModificarAlumno.html', '/RegistrarAlumno.html', '/menu.html'
];
 
rutasHTML.forEach(ruta => {
    app.get(ruta, (req, res) => {
        res.sendFile(path.join(__dirname, '..', 'frontend', 'public', ruta));
    });
});
 
app.use((req, res) => {
    if (req.accepts('html')) {
        res.status(404).sendFile(path.join(__dirname, '..', 'frontend', 'public', '404.html'));
    } else {
        res.status(404).json({ success: false, message: 'Ruta no encontrada' });
    }
});
 
app.use((err, req, res, next) => {
    console.error('Error Crítico:', err.stack);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
});
 
// Arranque con verificación de Supabase
async function iniciarServidor() {
    try {
        // Verificar conexión a Supabase consultando un catálogo simple
        const { error } = await supabaseAdmin
            .from('configuracion_sistema')
            .select('id_config')
            .limit(1);
 
        if (error) throw new Error(`Supabase no responde: ${error.message}`);
 
        console.log('✅ Conexión a Supabase establecida');
 
        app.listen(PORT, () => {
            console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
        });
 
    } catch (error) {
        console.error('❌ Error al iniciar el servidor:', error.message);
        process.exit(1);
    }
}
 
iniciarServidor();