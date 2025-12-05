import express from 'express';
const router = express.Router();
import * as alumnosController from '../controllers/alumnos.controller.js';
import { requireAuth, requireRole } from '../middlewares/auth.middleware.js';

router.get('/:boleta', alumnosController.obtenerAlumno);

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
router.get('/:boleta', alumnosController.obtenerAlumno); 

export default router;