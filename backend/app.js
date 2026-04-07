// backend/app.js — ÚNICO punto de entrada
import 'dotenv/config';
import express      from 'express';
import cors         from 'cors';
import path         from 'path';
import session      from 'express-session';
import { fileURLToPath } from 'url';

import authRoutes      from './routes/auth.routes.js';
import alumnosRoutes   from './routes/alumnos.routes.js';
import registrosRoutes from './routes/registros.routes.js';
import uploadRoutes    from './routes/upload.routes.js';
import usuariosRoutes  from './routes/usuarios.routes.js';
import reportesRoutes  from './routes/reportes.routes.js';

import { supabaseAdmin } from './database/supabase.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const app  = express();
const PORT = process.env.SERVER_PORT || 3000;

// ── CORS ──────────────────────────────────────────────────────
app.use(cors({
    origin: [
        process.env.FRONTEND_URL || 'http://localhost:3000',
        'http://127.0.0.1:3000',
    ],
    credentials: true,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── SESIÓN ────────────────────────────────────────────────────
app.use(session({
    secret:            process.env.SESSION_SECRET || 'cecyt9_secret_2025',
    resave:            true,
    saveUninitialized: true,
    cookie: {
        httpOnly: true,
        secure:   false,
        sameSite: 'lax',
        maxAge:   1000 * 60 * 60 * 8,
    },
}));

// ── RUTAS API ─────────────────────────────────────────────────
app.use('/api/auth',      authRoutes);
app.use('/api/alumnos',   alumnosRoutes);
app.use('/api/registros', registrosRoutes);
app.use('/api/upload',    uploadRoutes);
app.use('/api/usuarios',  usuariosRoutes);
app.use('/api/reportes',  reportesRoutes);

// ── ARCHIVOS ESTÁTICOS ────────────────────────────────────────
app.use(express.static(path.join(__dirname, '..', 'frontend', 'public'), {
    extensions: ['html', 'css', 'js'],
    index:      false,
}));

// ── PROTECCIÓN DE VISTAS HTML POR ROL ────────────────────────
app.use((req, res, next) => {
    const ruta = req.path;
    if (!ruta.endsWith('.html')) return next();

    const publicas = ['/login.html', '/index.html'];
    if (publicas.includes(ruta)) return next();
    if (!req.session.user) return res.redirect('/login.html');

    const tipo = req.session.user.tipo;

    // Páginas que SOLO puede ver el Administrador
    const soloAdmin = [
        '/ModificarAlumno.html',
        '/RegistrarAlumno.html',
        '/DescargasBD.html',
        '/GestionUsuarios.html',
        '/FiltrarAlumnos.html',   // ← FIX: añadido
    ];

    if (soloAdmin.includes(ruta) && tipo !== 'Administrador') {
        return res.status(403).send('<h1>Acceso Denegado</h1><a href="/">Volver</a>');
    }

    next();
});

// ── RAÍZ ──────────────────────────────────────────────────────
app.get('/', (req, res) => {
    if (!req.session.user) return res.redirect('/login.html');
    return req.session.user.tipo === 'Administrador'
        ? res.redirect('/menu.html')
        : res.redirect('/Entrada_Salida.html');
});

// ── RUTAS HTML EXPLÍCITAS ─────────────────────────────────────
[
    '/login.html',
    '/Entrada_Salida.html',
    '/BuscarAlumno.html',
    '/DescargasBD.html',
    '/ModificarAlumno.html',
    '/RegistrarAlumno.html',
    '/GestionUsuarios.html',
    '/FiltrarAlumnos.html',   // ← FIX: añadido
    '/menu.html',
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
app.use((err, req, res, _next) => {
    console.error('Error Crítico:', err.stack);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
});

// ── ARRANQUE ──────────────────────────────────────────────────
async function iniciarServidor() {
    try {
        const { error } = await supabaseAdmin
            .from('configuracion_sistema')
            .select('id_config')
            .limit(1);

        if (error) throw new Error(`Supabase: ${error.message}`);

        console.log('✅ Conexión a Supabase establecida');
        app.listen(PORT, () =>
            console.log(`🚀 Servidor en http://localhost:${PORT}`)
        );
    } catch (err) {
        console.error('❌ Error al iniciar:', err.message);
        process.exit(1);
    }
}

iniciarServidor();