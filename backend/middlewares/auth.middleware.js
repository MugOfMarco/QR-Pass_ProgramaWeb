// backend/middlewares/auth.middleware.js

export const requireAuth = (req, res, next) => {
    if (!req.session.user) {
        if (req.originalUrl.startsWith('/api')) {
            return res.status(401).json({ success: false, message: 'No autorizado. Inicia sesión primero.' });
        }
        // Si no es una llamada API, redirige al login
        return res.redirect('/');
    }
    next();
};

export const requireRole = (...allowedRoles) => {
    return (req, res, next) => {
        // En un escenario real, 'requireAuth' debería correr primero
        if (!req.session.user) { 
            return res.status(401).json({ success: false, message: 'No autorizado' });
        }

        // Si el rol del usuario NO está en la lista de roles permitidos
        if (!allowedRoles.includes(req.session.user.tipo)) {
            // Error 403: Prohibido.
            return res.status(403).json({ 
                success: false, 
                message: `Permiso denegado. Se requiere uno de estos roles: ${allowedRoles.join(', ')}` 
            });
        }

        next();
    };
};

// NOTA: Con ESM, exportamos cada función individualmente y no usamos module.exports.
// La sintaxis 'export const' es la más limpia aquí.