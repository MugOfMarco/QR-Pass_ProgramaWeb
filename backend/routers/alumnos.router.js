// backend/routers/alumnos.router.js

const express = require('express');
const router = express.Router();
const alumnosController = require('../controllers/alumnos.controller');
// Puedes añadir aquí un middleware para proteger todas estas rutas de usuarios no logueados


// --- RUTAS DE LECTURA Y REGISTRO ---

// GET /api/alumno/:boleta (Obtener datos para el escáner)
router.get('/alumno/:boleta', alumnosController.obtenerAlumno); 

// POST /api/registros (Crear registro de entrada/salida)
router.post('/registros', alumnosController.crearRegistro); 

// GET /api/verificar-bloqueo/:boleta (Verifica el estado antes de registrar)
router.get('/verificar-bloqueo/:boleta', alumnosController.verificarBloqueo); 


// --- RUTAS DE ADMINISTRACIÓN (CRUD) ---

// PUT /api/alumnos/bloquear/:boleta
router.put('/alumnos/bloquear/:boleta', alumnosController.bloquearCredencial); 

// PUT /api/alumnos/desbloquear/:boleta
router.put('/alumnos/desbloquear/:boleta', alumnosController.desbloquearCredencial); 

// Pendiente: router.post('/alumnos/crear', alumnosController.crearAlumno);

module.exports = router;