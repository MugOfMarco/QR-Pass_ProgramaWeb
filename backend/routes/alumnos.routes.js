const express = require('express');
const router = express.Router();
const alumnosController = require('../controllers/alumnos.controller');
const { requireAuth, requireRole } = require('../middlewares/auth.middleware');

// Ruta pública (para el escáner)
router.get('/:boleta', alumnosController.obtenerAlumno);

// Rutas protegidas
router.use(requireAuth);

// Rutas de administración (solo administradores)
router.put('/bloquear/:boleta', 
    requireRole('Administrador'),
    alumnosController.bloquearCredencial
);

router.put('/desbloquear/:boleta',
    requireRole('Administrador'),
    alumnosController.desbloquearCredencial
);

router.get('/verificar-bloqueo/:boleta', alumnosController.verificarBloqueo);
router.get('/buscar/alumnos', alumnosController.buscarAlumnos);

module.exports = router;