const express = require('express');
const router = express.Router();
const registrosController = require('../controllers/registros.controller');
const { requireAuth, requireRole } = require('../middlewares/auth.middleware');

// Todas estas rutas requieren autenticación
router.use(requireAuth);

// Registrar entrada/salida (solo prefectos y administradores)
router.post('/',
    requireRole('Prefecto', 'Administrador'),
    registrosController.crearRegistro
);

// Obtener registros de un alumno
router.get('/alumno/:boleta', registrosController.obtenerRegistrosPorAlumno);

// Obtener registros por fecha
router.get('/fecha/:fecha', registrosController.obtenerRegistrosPorFecha);

// Obtener estadísticas
router.get('/estadisticas', registrosController.obtenerEstadisticas);

module.exports = router;