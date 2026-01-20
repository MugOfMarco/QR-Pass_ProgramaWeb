// back/controllers/auth.controller.js - VERSIÓN SOLO SESIONES
import bcrypt from 'bcryptjs';
import Usuario from '../models/Usuario.js';

// Función de sanitización manual (sin dependencias externas)
const sanitize = (data) => {
    if (typeof data === 'string') {
        return data
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#x27;')
            .replace(/\//g, '&#x2F;')
            .trim();
    }
    return data;
};

export const createAlumno = async (req, res) => {
    try {
        // Sanitizamos el nombre antes de guardar
        const nombreLimpio = sanitize(req.body.nombre);
        
        // Ahora guardas 'nombreLimpio' en tu base de datos
        const nuevoAlumno = await Alumno.create({ nombre: nombreLimpio });
        
        res.json({
            success: true,
            message: 'Alumno creado exitosamente',
            alumno: nuevoAlumno
        });
    } catch (error) {
        console.error('Error creando alumno:', error);
        res.status(500).json({
            success: false,
            message: 'Error creando alumno: ' + error.message
        });
    }
};

export const login = async (req, res) => {
    try {
        console.log('Datos recibidos en login:', {
            username: req.body.username ? req.body.username.substring(0, 3) + '...' : 'vacio',
            hasPassword: !!req.body.password
        });

        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({
                success: false,
                message: 'Usuario y contraseña son requeridos'
            });
        }

        // Sanitizar y limpiar inputs
        const cleanUsername = sanitize(username.trim());
        const cleanPassword = password.trim(); // No sanitizar password, solo trim

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

        // Crear sesión (sin token JWT)
        req.session.user = {
            id: usuario.id_usuario,
            usuario: usuario.usuario,
            tipo: usuario.tipo_usuario,
            nombre: usuario.nombre_completo
        };

        console.log('✅ Login exitoso para:', usuario.usuario, 'Tipo:', usuario.tipo_usuario);

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
            success: true,
            isAuthenticated: true,
            user: req.session.user,
            tipo: req.session.user.tipo,
            nombre: req.session.user.nombre
        });
    } else {
        res.json({
            success: true,
            isAuthenticated: false
        });
    }
};