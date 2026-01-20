// backend/routes/registros.routes.js

import express from 'express';
const router = express.Router();

import * as registrosController from '../controllers/registros.controller.js';
import { requireAuth, requireRole } from '../middlewares/auth.middleware.js'; 

// =================================================================
// RUTAS
// =================================================================

router.use(requireAuth);

// POST /api/registros/
// Registrar entrada/salida 
// CAMBIO AQUÍ: Se agrega 'Policia' para que pueda usar el escáner
router.post('/',
    requireRole('Prefecto', 'Administrador', 'Policia'), 
    registrosController.crearRegistro
);

// GET /api/registros/alumno/:boleta
router.get('/alumno/:boleta', 
    registrosController.obtenerRegistrosPorAlumno
);

// GET /api/registros/fecha/:fecha
router.get('/fecha/:fecha', registrosController.obtenerRegistrosPorFecha);

// GET /api/registros/estadisticas
router.get('/estadisticas', registrosController.obtenerEstadisticas);

export default router;