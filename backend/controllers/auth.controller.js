// backend/controllers/auth.controller.js
import bcrypt  from 'bcryptjs';
import Usuario from '../models/Usuario.js';
import { crearToken, consumirToken, verificarToken } from '../services/passwordReset.service.js';
import { enviarCorreoRecuperacion } from '../services/email.service.js';

// ── POST /api/auth/login ──────────────────────────────────────
export const login = async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({
                success: false,
                message: 'Usuario y contraseña son requeridos',
            });
        }

        const cleanUsername = String(username).trim();
        const cleanPassword = String(password).trim();

        const usuario = await Usuario.obtenerPorUsername(cleanUsername);

        if (!usuario) {
            return res.status(401).json({
                success: false,
                message: 'Usuario o contraseña incorrectos',
            });
        }

        const passwordValida = await bcrypt.compare(cleanPassword, usuario.password);

        if (!passwordValida) {
            return res.status(401).json({
                success: false,
                message: 'Usuario o contraseña incorrectos',
            });
        }

        req.session.user = {
            id:      usuario.id_usuario,
            usuario: usuario.usuario,
            tipo:    usuario.tipo_usuario,
            nombre:  usuario.nombre_completo,
        };

        console.log(`✅ Login: ${usuario.usuario} (${usuario.tipo_usuario})`);

        return res.json({
            success: true,
            tipo:    usuario.tipo_usuario,
            user: {
                nombre:  usuario.nombre_completo,
                usuario: usuario.usuario,
            },
        });
    } catch (error) {
        console.error('Error en login:', error);
        return res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
        });
    }
};

// ── POST /api/auth/logout ─────────────────────────────────────
export const logout = (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({
                success: false,
                message: 'Error al cerrar sesión',
            });
        }
        res.json({ success: true, message: 'Sesión cerrada correctamente' });
    });
};

// ── GET /api/auth/check ───────────────────────────────────────
export const checkAuth = (req, res) => {
    if (req.session?.user) {
        return res.json({
            success:         true,
            isAuthenticated: true,
            user:            req.session.user,
            tipo:            req.session.user.tipo,
            nombre:          req.session.user.nombre,
        });
    }
    return res.json({ success: true, isAuthenticated: false });
};

// ── POST /api/auth/olvide-password ────────────────────────────
// Mensaje genérico para no revelar si el correo existe
const MSG_GENERICO = 'Si el correo está registrado, recibirás un enlace para restablecer tu contraseña.';

export const olvidePassword = async (req, res) => {
    try {
        const email = String(req.body?.email ?? '').trim().toLowerCase();
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return res.status(400).json({ success: false, message: 'Correo inválido.' });
        }

        const usuario = await Usuario.obtenerPorEmail(email);

        if (usuario && usuario.activo) {
            const token = crearToken(usuario.id_usuario);
            const base  = process.env.FRONTEND_URL?.replace(/\/$/, '') || `${req.protocol}://${req.get('host')}`;
            const url   = `${base}/RecuperarPassword.html?token=${token}`;

            try {
                await enviarCorreoRecuperacion(usuario.email, usuario.nombre_completo, url);
            } catch (e) {
                console.error('Error enviando correo de recuperación:', e.message);
            }
        }

        return res.json({ success: true, message: MSG_GENERICO });
    } catch (err) {
        console.error('Error en olvidePassword:', err);
        return res.json({ success: true, message: MSG_GENERICO });
    }
};

// ── GET /api/auth/reset/verificar?token=... ───────────────────
export const verificarTokenReset = (req, res) => {
    const token = String(req.query?.token ?? '');
    const idUsuario = verificarToken(token);
    if (!idUsuario) {
        return res.status(400).json({ success: false, message: 'El enlace es inválido o ha caducado.' });
    }
    return res.json({ success: true });
};

// ── POST /api/auth/reset ──────────────────────────────────────
export const resetearPassword = async (req, res) => {
    try {
        const { token, password } = req.body || {};
        const idUsuario = consumirToken(String(token ?? ''));
        if (!idUsuario) {
            return res.status(400).json({ success: false, message: 'El enlace es inválido o ha caducado.' });
        }
        if (!password || password.length < 6) {
            return res.status(400).json({ success: false, message: 'La contraseña debe tener al menos 6 caracteres.' });
        }
        if (password.length > 50) {
            return res.status(400).json({ success: false, message: 'La contraseña no puede superar 50 caracteres.' });
        }

        const result = await Usuario.restablecerPassword(idUsuario, password);
        return result.success
            ? res.json({ success: true, message: 'Contraseña restablecida. Ya puedes iniciar sesión.' })
            : res.status(400).json({ success: false, message: result.message });
    } catch (err) {
        console.error('Error reseteando contraseña:', err);
        return res.status(500).json({ success: false, message: 'Error interno.' });
    }
};
