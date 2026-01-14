import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken'; 
import Usuario from '../models/Usuario.js';

// Función: Iniciar Sesión (Login)
export const login = async (req, res) => {
    try {
        console.log('Datos recibidos en login:', {
            username: req.body.username ? req.body.username.substring(0, 3) + '...' : 'vacio',
            hasPassword: !!req.body.password
        });

        const { username, password } = req.body;

        // Validación
        if (!username || !password) {
            return res.status(400).json({
                success: false,
                message: 'Usuario y contraseña son requeridos'
            });
        }

        const cleanUsername = username.trim();
        const cleanPassword = password.trim();

        const usuario = await Usuario.obtenerPorUsername(cleanUsername);
        console.log('Usuario encontrado:', usuario ? 'Sí' : 'No');

        if (!usuario) {
            return res.status(401).json({
                success: false,
                message: 'Usuario o contraseña incorrectos'
            });
        }

        const passwordValida = await bcrypt.compare(cleanPassword, usuario.password);
        console.log('Contraseña válida:', passwordValida);

        if (!passwordValida) {
            return res.status(401).json({
                success: false,
                message: 'Usuario o contraseña incorrectos'
            });
        }

        // GENERAR TOKEN JWT
        const token = jwt.sign(
            {
                id: usuario.id_usuario,
                usuario: usuario.usuario,
                tipo: usuario.tipo_usuario,
                nombre: usuario.nombre_completo
            },
            process.env.JWT_SECRET || 'secreto_temporal', // Usa una variable de entorno
            { expiresIn: '8h' }
        );

        console.log('Login exitoso para:', usuario.usuario, 'Tipo:', usuario.tipo_usuario);

        // También mantén la sesión si quieres
        req.session.user = {
            id: usuario.id_usuario,
            usuario: usuario.usuario,
            tipo: usuario.tipo_usuario,
            nombre: usuario.nombre_completo
        };

        res.json({
            success: true,
            tipo: usuario.tipo_usuario,
            token: token, // ← ENVIAR EL TOKEN
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
export const logout = (req, res) => {
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
export const checkAuth = (req, res) => {
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