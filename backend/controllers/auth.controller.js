// backend/controllers/auth.controller.js

const { ejecutarSP } = require('../database/db'); // Necesario para la BD
const bcrypt = require('bcrypt'); // Necesario para verificar el hash

// El antiguo POST /api/login se convierte en esta función
exports.loginUsuario = async (req, res) => {
    const { username, password } = req.body; 

    try {
        // 1. Buscar usuario en BD usando SP
        const results = await ejecutarSP('sp_obtener_usuario_login', [username]); 
        const usuariosEncontrados = results[0];

        if (!usuariosEncontrados || usuariosEncontrados.length === 0) {
            return res.status(401).json({ success: false, message: 'Usuario o contraseña incorrectos' });
        }

        const userDb = usuariosEncontrados[0];
        const passwordValida = await bcrypt.compare(password, userDb.password);

        if (!passwordValida) {
            return res.status(401).json({ success: false, message: 'Usuario o contraseña incorrectos' });
        }

        // 2. Crear Sesión (Adjuntamos los datos importantes a la sesión)
        req.session.user = {
            id: userDb.id_usuario,
            usuario: userDb.usuario,
            tipo: userDb.tipo_usuario,
            nombre: userDb.nombre_completo
        };

        // 3. Respuesta de éxito
        return res.json({ success: true, tipo: userDb.tipo_usuario });

    } catch (error) {
        console.error('Error en login del controlador:', error);
        return res.status(500).json({ success: false, message: 'Error interno del servidor' });
    }
};

// El antiguo POST /api/logout se convierte en esta función
exports.logoutUsuario = (req, res) => {
    req.session.destroy(err => {
        if (err) {
            console.error('Error al cerrar sesión:', err);
            return res.status(500).json({ success: false, message: 'Error al cerrar sesión' });
        }
        res.json({ success: true, message: 'Sesión cerrada correctamente' });
    });
};