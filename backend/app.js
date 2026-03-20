// ============================================================
// backend/app.js — VERSIÓN LIMPIA (sin MySQL, sin server.js)
// ============================================================
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import session from 'express-session';
import { fileURLToPath } from 'url';

import authRoutes      from './routes/auth.routes.js';
import alumnosRoutes   from './routes/alumnos.routes.js';
import registrosRoutes from './routes/registros.routes.js';
import uploadRoutes    from './routes/upload.routes.js';


import { supabaseAdmin } from './database/supabase.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const app  = express();
const PORT = process.env.SERVER_PORT || 3000;

// ── CORS ──────────────────────────────────────────────────────
app.use(cors({
    origin: [
        process.env.FRONTEND_URL || 'http://localhost:3000',
        'http://127.0.0.1:3000'   // dev: cubre ambos orígenes
    ],
    credentials: true
}));

// ── BODY PARSERS ──────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── SESIÓN ────────────────────────────────────────────────────
app.use(session({
    secret:            process.env.SESSION_SECRET || 'cecyt9_secret_2025',
    resave:            true,
    saveUninitialized: true,
    cookie: {
        httpOnly: true,
        secure:   false,            // cambiar a true en producción con HTTPS
        sameSite: 'lax',
        maxAge:   1000 * 60 * 60 * 8  // 8 horas
    }
}));

// ── RUTAS API ─────────────────────────────────────────────────
// Auth pública (contiene el login)
app.use('/api/auth',      authRoutes);

// Las demás tienen requireAuth + requireRole internos en cada ruta
app.use('/api/alumnos',   alumnosRoutes);
app.use('/api/registros', registrosRoutes);
app.use('/api/upload',    uploadRoutes);
app.use('/api/usuarios', usuariosRoutes);

// ── ARCHIVOS ESTÁTICOS DEL FRONTEND ──────────────────────────
app.use(express.static(path.join(__dirname, '..', 'frontend', 'public'), {
    extensions: ['html', 'css', 'js'],
    index:      false
}));

// ── PROTECCIÓN DE VISTAS HTML POR ROL ────────────────────────
app.use((req, res, next) => {
    const ruta = req.path;
    if (!ruta.endsWith('.html')) return next();

    const paginasPublicas = ['/login.html', '/index.html'];
    if (paginasPublicas.includes(ruta)) return next();

    if (!req.session.user) return res.redirect('/login.html');

    const { tipo } = req.session.user;
    const soloAdmin = ['/ModificarAlumno.html', '/RegistrarAlumno.html', '/DescargasBD.html'];
    if (soloAdmin.includes(ruta) && tipo !== 'Administrador') {
        return res.status(403).send('<h1>Acceso Denegado</h1><a href="/">Volver</a>');
    }

    next();
});

// ── RAÍZ: REDIRIGE SEGÚN ROL ──────────────────────────────────
app.get('/', (req, res) => {
    if (!req.session.user) return res.redirect('/login.html');
    if (req.session.user.tipo === 'Administrador') return res.redirect('/menu.html');
    return res.redirect('/Entrada_Salida.html');
});

// ── RUTAS HTML EXPLÍCITAS ─────────────────────────────────────
[
    '/login.html', '/Entrada_Salida.html', '/BuscarAlumno.html',
    '/DescargasBD.html', '/ModificarAlumno.html', '/RegistrarAlumno.html', '/menu.html'
].forEach(ruta => {
    app.get(ruta, (req, res) =>
        res.sendFile(path.join(__dirname, '..', 'frontend', 'public', ruta))
    );
});

// ── 404 ───────────────────────────────────────────────────────
app.use((req, res) => {
    if (req.accepts('html')) {
        res.status(404).sendFile(
            path.join(__dirname, '..', 'frontend', 'public', '404.html')
        );
    } else {
        res.status(404).json({ success: false, message: 'Ruta no encontrada' });
    }
});

// ── ERROR GLOBAL ──────────────────────────────────────────────
app.use((err, req, res, next) => {
    console.error('Error Crítico:', err.stack);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
});

// ── ARRANQUE CON PING A SUPABASE ─────────────────────────────
async function iniciarServidor() {
    try {
        const { error } = await supabaseAdmin
            .from('configuracion_sistema')
            .select('id_config')
            .limit(1);

        if (error) throw new Error(`Supabase no responde: ${error.message}`);

        console.log('✅ Conexión a Supabase establecida');
        app.listen(PORT, () => {
            console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
        });

    } catch (err) {
        console.error('❌ Error al iniciar el servidor:', err.message);
        process.exit(1);
    }
}

iniciarServidor();