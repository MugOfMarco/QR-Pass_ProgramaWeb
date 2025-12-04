const express = require('express');
const router = express.Router();
const alumnosController = require('../controllers/alumnos.controller');
const { requireAuth, requireRole } = require('../middlewares/auth.middleware');

// Ruta pública (para el escáner)
router.get('/:boleta', alumnosController.obtenerAlumno);

// Rutas protegidas
router.use(requireAuth);

// Obtener registros de alumno
router.get('/:boleta/registros', alumnosController.obtenerRegistrosAlumno);

// Obtener justificaciones de alumno
router.get('/:boleta/justificaciones', alumnosController.obtenerJustificacionesAlumno);

// Crear justificación
router.post('/justificaciones', 
    requireRole('Administrador', 'Prefecto'),
    alumnosController.crearJustificacion
);

// Rutas de administración (solo administradores)
router.put('/bloquear/:boleta', 
    requireRole('Administrador'),
    alumnosController.bloquearCredencial
);

router.put('/desbloquear/:boleta',
    requireRole('Administrador'),
    alumnosController.desbloquearCredencial
);

// Verificar bloqueo
router.get('/verificar-bloqueo/:boleta', alumnosController.verificarBloqueo);

// Buscar alumnos
router.get('/buscar/alumnos', alumnosController.buscarAlumnos);

module.exports = router;