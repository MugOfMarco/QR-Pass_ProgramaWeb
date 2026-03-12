// ARCHIVO 4: backend/routes/alumnos.routes.js  (MIGRADO)
// ============================================================================================================================
// CAMBIO: Rol 'Policia' → 'Vigilante' eliminado de rutas de escritura
// ============================================================================================================================
import express               from 'express';
import * as alumnosController from '../controllers/alumnos.controller.js';
import { requireAuth, requireRole } from '../middlewares/auth.middleware.js';
import multer from 'multer';
 
const router  = express.Router();
const storage = multer.memoryStorage();
const upload  = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });
 
// Lectura — cualquier usuario autenticado
router.get('/buscar/alumnos',           requireAuth, alumnosController.buscarAlumnos);
router.get('/verificar-bloqueo/:boleta',requireAuth, alumnosController.verificarBloqueo);
router.get('/grupos/lista',             requireAuth, alumnosController.obtenerGrupos);
router.get('/estados/lista',            requireAuth, alumnosController.obtenerEstadosAcademicos);
router.get('/carreras/lista',           requireAuth, alumnosController.obtenerCarreras);
router.get('/:boleta/registros',        requireAuth, alumnosController.obtenerRegistrosAlumno);
router.get('/:boleta',                  requireAuth, alumnosController.obtenerAlumno);
 
// Escritura — solo Administrador
router.put('/bloquear/:boleta',   requireAuth, requireRole('Administrador'), alumnosController.bloquearcredencial);
router.put('/desbloquear/:boleta',requireAuth, requireRole('Administrador'), alumnosController.desbloquearcredencial);
router.post('/registrar',         requireAuth, requireRole('Administrador'), alumnosController.registrarAlumno);
router.put('/modificar/:boleta',  requireAuth, requireRole('Administrador'), alumnosController.modificarAlumno);
router.delete('/eliminar/:boleta',requireAuth, requireRole('Administrador'), alumnosController.eliminarAlumno);
 
// Justificaciones — Admin y Prefecto
router.post('/justificaciones',
    requireAuth, requireRole('Administrador', 'Prefecto'),
    alumnosController.registrarJustificacion
);
router.get('/:boleta/registros/justificar',
    requireAuth, requireRole('Administrador', 'Prefecto'),
    alumnosController.obtenerRegistrosParaJustificar
);
 
// Imágenes — solo Admin
router.post('/upload',  requireAuth, requireRole('Administrador'), upload.single('image'), alumnosController.uploadImage);
router.delete('/image', requireAuth, requireRole('Administrador'), alumnosController.deleteImage);
 
export default router;