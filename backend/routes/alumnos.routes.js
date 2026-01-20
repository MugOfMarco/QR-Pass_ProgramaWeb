// back/routes/alumnos.router.js
import express from 'express';
const router = express.Router();
import * as alumnosController from '../controllers/alumnos.controller.js';
import { requireAuth, requireRole } from '../middlewares/auth.middleware.js';
import multer from 'multer';

const storage = multer.memoryStorage();
const upload = multer({ 
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }
});

// ==========================================
// CONFIGURACIÓN DE RUTAS
// ==========================================

// 1. Rutas de búsqueda y consulta (Lectura)
// Se mantienen con requireAuth para que el Policía pueda buscar alumnos al escanear
router.get('/buscar/alumnos', requireAuth, alumnosController.buscarAlumnos);
router.get('/verificar-bloqueo/:boleta', requireAuth, alumnosController.verificarBloqueo);
router.get('/:boleta', requireAuth, alumnosController.obtenerAlumno);
router.get('/:boleta/registros', requireAuth, alumnosController.obtenerRegistrosAlumno);

// 2. Catálogos para formularios (Lectura)
router.get('/grupos/lista', requireAuth, alumnosController.obtenerGrupos);
router.get('/estados/lista', requireAuth, alumnosController.obtenerEstadosAcademicos);
router.get('/carreras/lista', requireAuth, alumnosController.obtenerCarreras);

// 3. Acciones de Modificación (Solo Administrador)
// El Policía NO tiene acceso aquí
router.put('/bloquear/:boleta', 
    requireAuth, 
    requireRole('Administrador'), 
    alumnosController.bloquearcredencial
);

router.put('/desbloquear/:boleta',
    requireAuth,
    requireRole('Administrador'),
    alumnosController.desbloquearcredencial
);

router.post('/registrar',
    requireAuth,
    requireRole('Administrador'),
    alumnosController.registrarAlumno
);

router.put('/modificar/:boleta',
    requireAuth,
    requireRole('Administrador'),
    alumnosController.modificarAlumno
);

router.delete('/eliminar/:boleta',
    requireAuth,
    requireRole('Administrador'),
    alumnosController.eliminarAlumno
);

// 4. Justificaciones (Solo Administrador/Prefecto si aplica, pero NO Policía)
router.post('/justificaciones',
    requireAuth,
    requireRole('Administrador'),
    alumnosController.registrarJustificacion
);

router.get('/:boleta/registros/justificar',
    requireAuth,
    requireRole('Administrador'),
    alumnosController.obtenerRegistrosParaJustificar
);

// 5. Gestión de Imágenes
// CAMBIO AQUÍ: Se restringe para que el Policía NO pueda cambiar fotos
router.post('/upload', 
    requireAuth,
    requireRole('Administrador'), // Solo Admin puede subir/cambiar fotos
    upload.single('image'),
    alumnosController.uploadImage
);

router.delete('/image', 
    requireAuth,
    requireRole('Administrador'), // Solo Admin puede borrar fotos
    alumnosController.deleteImage
);

export default router;