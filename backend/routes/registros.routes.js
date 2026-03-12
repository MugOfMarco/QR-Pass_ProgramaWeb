// ARCHIVO 2: backend/routes/registros.routes.js
// ============================================================================================================================
// CAMBIO: Rol 'Policia' → 'Vigilante'
// ============================================================================================================================
import express                   from 'express';
import * as registrosController  from '../controllers/registros.controller.js';
import { requireAuth, requireRole } from '../middlewares/auth.middleware.js';
 
const router = express.Router();
 
router.use(requireAuth);
 
// POST /api/registros — Crear entrada/salida (Vigilante, Prefecto y Admin)
router.post('/',
    requireRole('Vigilante', 'Prefecto', 'Administrador'),
    registrosController.crearRegistro
);
 
// GET /api/registros/alumno/:boleta
router.get('/alumno/:boleta', registrosController.obtenerRegistrosPorAlumno);
 
// GET /api/registros/fecha/:fecha
router.get('/fecha/:fecha', registrosController.obtenerRegistrosPorFecha);
 
// GET /api/registros/estadisticas
router.get('/estadisticas', registrosController.obtenerEstadisticas);
 
export default router;