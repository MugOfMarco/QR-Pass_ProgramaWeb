import express from 'express';
const router = express.Router();
import * as alumnosController from '../controllers/alumnos.controller.js';
import { requireAuth, requireRole } from '../middlewares/auth.middleware.js';

router.get('/:boleta', alumnosController.obtenerAlumno);

// Nueva ruta para información básica con URL
router.get('/:boleta/basico', alumnosController.obtenerAlumnoBasico);

router.use(requireAuth);

router.put('/bloquear/:boleta', 
    requireRole('Administrador'),
    alumnosController.bloquearCredencial
);

router.put('/desbloquear/:boleta',
    requireRole('Administrador'),
    alumnosController.desbloquearCredencial
);

router.get('/:boleta/registros', alumnosController.obtenerRegistrosAlumno);

router.get('/:boleta/justificaciones', alumnosController.obtenerJustificacionesAlumno);

router.post('/justificaciones', 
    requireRole('Administrador', 'Prefecto'),
    alumnosController.crearJustificacion
);

router.get('/buscar/alumnos', alumnosController.buscarAlumnos);
router.get('/verificar-bloqueo/:boleta', alumnosController.verificarBloqueo);

export default router;