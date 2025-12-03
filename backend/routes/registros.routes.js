// backend/routes/registros.routes.js

import express from 'express'; // Importación ESM de Express
const router = express.Router();

// Importación ESM de Controladores y Middlewares (Añadimos la extensión .js)
import * as registrosController from '../controllers/registros.controller.js';
import { requireAuth, requireRole } from '../middlewares/auth.middleware.js'; 

// =================================================================
// RUTAS
// =================================================================

// Todas estas rutas requieren autenticación
// NOTA: Usa 'router.use(requireAuth);' para aplicar la autenticación a todas las rutas siguientes
router.use(requireAuth);

// POST /api/registros/
// Registrar entrada/salida (solo prefectos y administradores)
router.post('/',
    requireRole('Prefecto', 'Administrador'),
    registrosController.crearRegistro
);

// GET /api/registros/alumno/:boleta
// Obtener registros de un alumno
router.get('/alumno/:boleta', 
    // NOTA: Esta ruta solo requiere requireAuth (verificado arriba), pero si debe ser restringida a Admin,
    // se debe agregar requireRole('Administrador') aquí.
    registrosController.obtenerRegistrosPorAlumno
);

// GET /api/registros/fecha/:fecha
// Obtener registros por fecha
router.get('/fecha/:fecha', registrosController.obtenerRegistrosPorFecha);

// GET /api/registros/estadisticas
// Obtener estadísticas (usualmente solo Administradores)
router.get('/estadisticas', registrosController.obtenerEstadisticas);

// Exportación Final (ESM)
export default router;