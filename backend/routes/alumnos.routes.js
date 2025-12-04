// backend/routes/alumnos.routes.js

import express from 'express'; // Importación ESM de Express
const router = express.Router();

// Importación ESM de Controladores y Middlewares
import * as alumnosController from '../controllers/alumnos.controller.js';
import { requireAuth, requireRole } from '../middlewares/auth.middleware.js'; // Añadimos .js a las rutas relativas

// =================================================================
// RUTAS
// =================================================================

// Ruta pública (para el escáner)
// NOTA: Esta ruta no usa 'requireAuth' ni 'requireRole' porque es la primera verificación rápida
router.get('/:boleta', alumnosController.obtenerAlumno); 

// Rutas protegidas: Todas las rutas que vienen después de aquí requieren autenticación
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
    requireRole('Administrador'), // Bloquea el acceso a Prefectos/otros
    alumnosController.bloquearCredencial
);

router.put('/desbloquear/:boleta',
    requireRole('Administrador'), // Bloquea el acceso a Prefectos/otros
    alumnosController.desbloquearCredencial
);

// Verificar bloqueo
router.get('/verificar-bloqueo/:boleta', alumnosController.verificarBloqueo);

// Buscar alumnos
router.get('/buscar/alumnos', alumnosController.buscarAlumnos);

// Exportación Final (ESM)
export default router;