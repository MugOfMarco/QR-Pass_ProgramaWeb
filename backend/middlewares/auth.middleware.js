const requireAuth = (req, res, next) => {
    if (!req.session.user) {
        if (req.originalUrl.startsWith('/api')) {
            return res.status(401).json({
                success: false,
                message: 'No autorizado. Inicia sesión primero.'
            });
        }
        return res.redirect('/');
    }
    next();
};

const requireRole = (...allowedRoles) => {
    return (req, res, next) => {
        if (!req.session.user) {
            return res.status(401).json({
                success: false,
                message: 'No autorizado'
            });
        }

        if (!allowedRoles.includes(req.session.user.tipo)) {
            return res.status(403).json({
                success: false,
                message: `Permiso denegado. Se requiere uno de estos roles: ${allowedRoles.join(', ')}`
            });
        }

        next();
    };
};

module.exports = {
    requireAuth,
    requireRole
};