// backend/controllers/usuarios.controller.js
import Usuario from '../models/Usuario.js';
import sanitizeHtml from 'sanitize-html';

const s = (v) => typeof v === 'string'
    ? sanitizeHtml(v, { allowedTags: [], allowedAttributes: {} }).trim()
    : v;

// ── GET /api/usuarios ─────────────────────────────────────────
export const listarUsuarios = async (_req, res) => {
    try {
        const usuarios = await Usuario.listar();
        return res.json({ success: true, usuarios });
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Error cargando usuarios.' });
    }
};

// ── GET /api/usuarios/roles ───────────────────────────────────
export const listarRoles = async (_req, res) => {
    try {
        const roles = await Usuario.obtenerRoles();
        return res.json({ success: true, roles });
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Error cargando roles.' });
    }
};

// ── GET /api/usuarios/:id ─────────────────────────────────────
export const obtenerUsuario = async (req, res) => {
    try {
        const usuario = await Usuario.obtenerPorId(req.params.id);
        if (!usuario) return res.status(404).json({ success: false, message: 'Usuario no encontrado.' });
        return res.json({ success: true, usuario });
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Error obteniendo usuario.' });
    }
};

// ── POST /api/usuarios ────────────────────────────────────────
export const crearUsuario = async (req, res) => {
    try {
        const { usuario, password, nombre_completo, email, id_rol } = req.body;

        if (!usuario || !password || !nombre_completo || !id_rol) {
            return res.status(400).json({ success: false, message: 'Faltan campos obligatorios.' });
        }
        if (password.length < 6) {
            return res.status(400).json({ success: false, message: 'La contraseña debe tener al menos 6 caracteres.' });
        }

        const result = await Usuario.crear({
            usuario:         s(usuario),
            password,                       // no sanitizar — es la contraseña
            nombre_completo: s(nombre_completo),
            email:           email ? s(email) : null,
            id_rol,
        });

        return result.success
            ? res.status(201).json({ success: true, message: result.message, id_usuario: result.id_usuario })
            : res.status(400).json({ success: false, message: result.message });
    } catch (err) {
        console.error('Error creando usuario:', err);
        return res.status(500).json({ success: false, message: 'Error interno.' });
    }
};

// ── PUT /api/usuarios/:id ─────────────────────────────────────
export const modificarUsuario = async (req, res) => {
    try {
        const { nombre_completo, email, id_rol, activo } = req.body;

        if (!nombre_completo || !id_rol) {
            return res.status(400).json({ success: false, message: 'Faltan campos obligatorios.' });
        }

        // Un usuario no puede cambiar su propio rol ni desactivarse a sí mismo
        const esElMismo = req.session.user?.id === parseInt(req.params.id);
        if (esElMismo && activo === false) {
            return res.status(400).json({ success: false, message: 'No puedes desactivarte a ti mismo.' });
        }

        const result = await Usuario.modificar(req.params.id, {
            nombre_completo: s(nombre_completo),
            email:           email ? s(email) : null,
            id_rol,
            activo,
        });

        return result.success
            ? res.json({ success: true, message: result.message })
            : res.status(400).json({ success: false, message: result.message });
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Error modificando usuario.' });
    }
};

// ── PUT /api/usuarios/:id/password ───────────────────────────
// Admin cambia la de cualquiera sin verificar actual
// Usuario cambia la suya verificando la actual
export const cambiarPassword = async (req, res) => {
    try {
        const { password_actual, password_nueva } = req.body;
        const idSolicitado = parseInt(req.params.id);
        const esAdmin      = req.session.user?.tipo === 'Administrador';
        const esElMismo    = req.session.user?.id   === idSolicitado;

        // Solo el admin o el propio usuario pueden cambiar una contraseña
        if (!esAdmin && !esElMismo) {
            return res.status(403).json({ success: false, message: 'Sin permisos.' });
        }

        if (!password_nueva) {
            return res.status(400).json({ success: false, message: 'La nueva contraseña es requerida.' });
        }

        const result = await Usuario.cambiarPassword(idSolicitado, {
            password_actual,
            password_nueva,
            esAdmin,
        });

        return result.success
            ? res.json({ success: true, message: result.message })
            : res.status(400).json({ success: false, message: result.message });
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Error cambiando contraseña.' });
    }
};

// ── PUT /api/usuarios/:id/desactivar ─────────────────────────
export const desactivarUsuario = async (req, res) => {
    try {
        if (req.session.user?.id === parseInt(req.params.id)) {
            return res.status(400).json({ success: false, message: 'No puedes desactivarte a ti mismo.' });
        }
        const result = await Usuario.desactivar(req.params.id);
        return result.success
            ? res.json({ success: true, message: result.message })
            : res.status(400).json({ success: false, message: result.message });
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Error desactivando usuario.' });
    }
};

// ── PUT /api/usuarios/:id/reactivar ──────────────────────────
export const reactivarUsuario = async (req, res) => {
    try {
        const result = await Usuario.reactivar(req.params.id);
        return result.success
            ? res.json({ success: true, message: result.message })
            : res.status(400).json({ success: false, message: result.message });
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Error reactivando usuario.' });
    }
};