// backend/controllers/auth.controller.js

import bcrypt from 'bcrypt';
import Usuario from '../models/Usuario.js'; // Usamos la sintaxis ESM y añadimos la extensión .js

// Función: Iniciar Sesión (Login)
const login = async (req, res) => {
    try {
        const { username, password } = req.body;

        const usuario = await Usuario.obtenerPorUsername(username);

        if (!usuario) {
            return res.status(401).json({
                success: false,
                message: 'Usuario o contraseña incorrectos'
            });
        }

        const passwordValida = await bcrypt.compare(password, usuario.password);

        if (!passwordValida) {
            return res.status(401).json({
                success: false,
                message: 'Usuario o contraseña incorrectos'
            });
        }

        // Crea Sesión
        req.session.user = {
            id: usuario.id_usuario,
            usuario: usuario.usuario,
            tipo: usuario.tipo_usuario,
            nombre: usuario.nombre_completo
        };

        res.json({
            success: true,
            tipo: usuario.tipo_usuario,
            user: {
                nombre: usuario.nombre_completo,
                usuario: usuario.usuario
            }
        });

    } catch (error) {
        console.error('Error en login:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        });
    }
};

// Función: Cerrar Sesión (Logout)
const logout = (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({
                success: false,
                message: 'Error al cerrar sesión'
            });
        }
        res.json({
            success: true,
            message: 'Sesión cerrada correctamente'
        });
    });
};

// Función: Verificar el estado de autenticación (Para el frontend)
const checkAuth = (req, res) => {
    if (req.session.user) {
        res.json({
            isAuthenticated: true,
            user: req.session.user
        });
    } else {
        res.json({
            isAuthenticated: false
        });
    }
};

// =================================================================
// Exportación Final (ESM)
// =================================================================

export {
    login,
    logout,
    checkAuth
};