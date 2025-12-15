// backend/routes/alumnos.routes.js

import express from 'express';
const router = express.Router(); // Necesario para definir las rutas

// Importaciones ESM de Controladores y Middlewares (Añadimos la extensión .js)
import * as alumnosController from '../controllers/alumnos.controller.js';
import { requireAuth, requireRole } from '../middlewares/auth.middleware.js';

// =================================================================
// 1. RUTAS PÚBLICAS (Antes de requireAuth)
// =================================================================

// GET /api/alumnos/:boleta
// Usado por el Scanner/Registro Rápido. No requiere sesión.
router.get('/:boleta', alumnosController.obtenerAlumno);


// Aplica el Middleware de Autenticación para TODAS las rutas siguientes
router.use(requireAuth);

// =================================================================
// 2. RUTAS DE GESTIÓN (CRUD - Usadas por GestionAlumnos.js)
// Requieren rol de Administrador
// =================================================================

// POST /api/alumnos/registrar
router.post('/registrar', 
    requireRole('Administrador'),
    alumnosController.registrarAlumno
);

// PUT /api/alumnos/modificar/:boleta
router.put('/modificar/:boleta',
    requireRole('Administrador'),
    alumnosController.modificarAlumno
);

// DELETE /api/alumnos/eliminar/:boleta
router.delete('/eliminar/:boleta',
    requireRole('Administrador'),
    alumnosController.eliminarAlumno 
);

// =================================================================
// 3. OTRAS RUTAS PROTEGIDAS (Buscar, Bloqueo, Verificación)
// =================================================================

// PUT /api/alumnos/bloquear/:boleta (Solo Administrador)
router.put('/bloquear/:boleta', 
    requireRole('Administrador'),
    alumnosController.bloquearCredencial
);

// PUT /api/alumnos/desbloquear/:boleta (Solo Administrador)
router.put('/desbloquear/:boleta',
    requireRole('Administrador'),
    alumnosController.desbloquearCredencial
);

// GET /api/alumnos/buscar/alumnos (Consulta de búsqueda)
router.get('/buscar/alumnos', alumnosController.buscarAlumnos);

// GET /api/alumnos/verificar-bloqueo/:boleta
router.get('/verificar-bloqueo/:boleta', alumnosController.verificarBloqueo);

// =================================================================
// 4. RUTAS DE REGISTROS Y JUSTIFICACIONES
// =================================================================

// GET /api/alumnos/:boleta/registros (Obtener historial de asistencia)
router.get('/:boleta/registros', alumnosController.obtenerRegistrosAlumno);

// GET /api/alumnos/:boleta/justificaciones
router.get('/:boleta/justificaciones', alumnosController.obtenerJustificacionesAlumno);

// POST /api/alumnos/justificaciones (Crear justificación)
router.post('/justificaciones', 
    requireRole('Administrador', 'Prefecto'),
    alumnosController.crearJustificacion
);

// Exportación por defecto (ESM)
export default router;