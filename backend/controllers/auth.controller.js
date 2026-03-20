// backend/controllers/auth.controller.js
import bcrypt  from 'bcryptjs';
import Usuario from '../models/Usuario.js';

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