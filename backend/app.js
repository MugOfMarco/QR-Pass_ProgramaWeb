// backend/app.js — ÚNICO punto de entrada
import 'dotenv/config';
import express      from 'express';
import cors         from 'cors';
import path         from 'path';
import session      from 'express-session';
import { fileURLToPath } from 'url';

import { smtpConfigurado } from './services/email.service.js';
import authRoutes      from './routes/auth.routes.js';
import alumnosRoutes   from './routes/alumnos.routes.js';
import registrosRoutes from './routes/registros.routes.js';
import uploadRoutes    from './routes/upload.routes.js';
import usuariosRoutes  from './routes/usuarios.routes.js';
import reportesRoutes  from './routes/reportes.routes.js';
import dashboardRoutes from './routes/dashboard.routes.js';
import gruposRoutes    from './routes/grupos.routes.js';
import backupRoutes    from './routes/backup.routes.js';
import soporteRoutes   from './routes/soporte.routes.js';
import configRoutes    from './routes/config.routes.js';

import { supabaseAdmin } from './database/supabase.js';

// ─────────────────────────────────────────────────────────────────────────────
// SESIONES PERSISTENTES EN SUPABASE
// Evita que los reinicios de Render (free tier) destruyan las sesiones activas.
// Las sesiones se guardan en la tabla `sessions` de Supabase.
// ─────────────────────────────────────────────────────────────────────────────
class SupabaseSessionStore extends session.Store {
    constructor() {
        super();
        // Limpiar sesiones expiradas cada 20 minutos
        setInterval(() => this._purgeExpired(), 20 * 60 * 1000);
    }

    async get(sid, callback) {
        try {
            const { data } = await supabaseAdmin
                .from('sessions')
                .select('sess, expire')
                .eq('sid', sid)
                .maybeSingle();

            if (!data) return callback(null, null);
            if (new Date(data.expire) < new Date()) return callback(null, null);
            callback(null, data.sess);
        } catch (err) {
            callback(null, null); // sesión inválida → usuario tendrá que re-loguearse
        }
    }

    async set(sid, sessionData, callback) {
        try {
            const maxAge  = sessionData.cookie?.maxAge ?? (8 * 60 * 60 * 1000);
            const expire  = new Date(Date.now() + maxAge).toISOString();
            await supabaseAdmin
                .from('sessions')
                .upsert({ sid, sess: sessionData, expire }, { onConflict: 'sid' });
        } catch { /* tabla no existe aún — la sesión continúa en memoria sin persistencia */ }
        callback(null); // nunca falla: si la tabla no existe simplemente no persiste
    }

    async destroy(sid, callback) {
        try {
            await supabaseAdmin.from('sessions').delete().eq('sid', sid);
            callback(null);
        } catch (err) {
            callback(null); // ignorar errores en destroy
        }
    }

    async _purgeExpired() {
        try {
            await supabaseAdmin
                .from('sessions')
                .delete()
                .lt('expire', new Date().toISOString());
        } catch { /* ignorar */ }
    }
}

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const app  = express();
const PORT = process.env.SERVER_PORT || 3000;

app.set('trust proxy', 1);

app.use(cors({
    origin: (origin, callback) => {
        const permitidos = [
            process.env.FRONTEND_URL || 'http://localhost:3000',
            'http://127.0.0.1:3000',
        ];
        // Apps nativas (React Native / Expo) no envían Origin header
        if (!origin || permitidos.includes(origin)) return callback(null, true);
        callback(new Error('CORS: origen no permitido'));
    },
    credentials: true,
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.use(session({
    store:             new SupabaseSessionStore(),
    secret:            process.env.SESSION_SECRET || 'cecyt9_secret_2025',
    resave:            false,       // SupabaseSessionStore maneja la persistencia
    saveUninitialized: false,       // no crear sesiones vacías
    cookie: {
        httpOnly: true,
        secure:   false,
        sameSite: 'lax',
        maxAge:   1000 * 60 * 60 * 8,  // 8 horas
    },
}));

app.use('/api/auth',      authRoutes);
app.use('/api/alumnos',   alumnosRoutes);
app.use('/api/registros', registrosRoutes);
app.use('/api/upload',    uploadRoutes);
app.use('/api/usuarios',  usuariosRoutes);
app.use('/api/reportes',  reportesRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/grupos',    gruposRoutes);
app.use('/api/backup',    backupRoutes);
app.use('/api/soporte',   soporteRoutes);
app.use('/api/config',    configRoutes);

app.use(express.static(path.join(__dirname, '..', 'frontend', 'public'), {
    extensions: ['html', 'css', 'js'],
    index:      false,
}));

app.use((req, res, next) => {
    const ruta = req.path;
    if (!ruta.endsWith('.html')) return next();

    const publicas = ['/login.html', '/index.html', '/RecuperarPassword.html'];
    if (publicas.includes(ruta)) return next();
    if (!req.session.user) return res.redirect('/login.html');

    const tipo = req.session.user.tipo;
    const soloAdmin = [
        '/modificaralumno.html',
        '/registraralumno.html',
        '/descargasbd.html',
        '/gestionusuarios.html',
        '/dashboard.html',
        '/gestiongrupos.html',
        '/logicanegocio.html',
    ];

    const adminOSoporte = ['/soportepanel.html'];

    if (soloAdmin.includes(ruta.toLowerCase()) && tipo !== 'Administrador') {
        return res.status(403).send('<h1>Acceso Denegado</h1><a href="/">Volver</a>');
    }
    if (adminOSoporte.includes(ruta.toLowerCase()) && !['Administrador', 'Soporte'].includes(tipo)) {
        return res.status(403).send('<h1>Acceso Denegado</h1><a href="/">Volver</a>');
    }
    // Rol Soporte: acceso exclusivo a SoportePanel.html
    if (tipo === 'Soporte' && !adminOSoporte.includes(ruta.toLowerCase())) {
        return res.redirect('/SoportePanel.html');
    }
    next();
});

app.get('/', (req, res) => {
    if (!req.session.user) return res.redirect('/login.html');
    const tipo = req.session.user.tipo;
    if (tipo === 'Administrador') return res.redirect('/Dashboard.html');
    if (tipo === 'Soporte')       return res.redirect('/SoportePanel.html');
    return res.redirect('/Entrada_Salida.html');
});

[
    '/login.html',
    '/RecuperarPassword.html',
    '/Entrada_Salida.html',
    '/BuscarAlumno.html',
    '/DescargasBD.html',
    '/ModificarAlumno.html',
    '/RegistrarAlumno.html',
    '/GestionUsuarios.html',
    '/FiltrarAlumnos.html',
    '/Dashboard.html',
    '/BuscarAlumnoVigilante.html',
    '/GestionGrupos.html',
    '/Soporte.html',
    '/SoportePanel.html',
    '/LogicaNegocio.html',
    '/menu.html',
].forEach(ruta => {
    app.get(ruta, (req, res) =>
        res.sendFile(path.join(__dirname, '..', 'frontend', 'public', ruta))
    );
});

app.use((req, res) => {
    if (req.accepts('html')) {
        res.status(404).sendFile(
            path.join(__dirname, '..', 'frontend', 'public', '404.html')
        );
    } else {
        res.status(404).json({ success: false, message: 'Ruta no encontrada' });
    }
});

app.use((err, req, res, _next) => {
    console.error('Error Crítico:', err.stack);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
});

async function iniciarServidor() {
    try {
        // Verificar conexión a Supabase
        const { error } = await supabaseAdmin
            .from('configuracion_sistema')
            .select('id_config')
            .limit(1);

        if (error) throw new Error(`Supabase: ${error.message}`);
        console.log('✅ Conexión a Supabase establecida');

        // Verificar que la tabla sessions existe (creada via SQL Editor de Supabase)
        const { error: sesErr } = await supabaseAdmin
            .from('sessions')
            .select('sid')
            .limit(1);

        if (sesErr) {
            console.warn(
                '⚠  Tabla "sessions" no encontrada en Supabase. ' +
                'Las sesiones se perderán al reiniciar el servidor. ' +
                'Ejecuta el SQL de creación de la tabla sessions en Supabase.'
            );
        } else {
            console.log('✅ Sesiones persistentes en Supabase activadas');
        }

        if (smtpConfigurado()) {
            console.log('✅ SMTP configurado — envío de correos activo');
        } else {
            console.warn('⚠️  SMTP no configurado — define SMTP_HOST, SMTP_USER y SMTP_PASS en .env');
        }

        app.listen(PORT, () =>
            console.log(`🚀 Servidor en http://localhost:${PORT}`)
        );
    } catch (err) {
        console.error('❌ Error al iniciar:', err.message);
        process.exit(1);
    }
}

iniciarServidor();