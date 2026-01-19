// back/routes/alumnos.router.js
import express from 'express';
const router = express.Router();
// Importamos todo como un objeto para evitar errores de nombres individuales
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

// Usamos nombres extraídos directamente de tu console.log:
// 'obtenerAlumno', 'bloquearcredencial', 'buscarAlumnos', etc.

// 1. Rutas de búsqueda y consulta (Acceso general logueado)
router.get('/buscar/alumnos', requireAuth, alumnosController.buscarAlumnos);
router.get('/verificar-bloqueo/:boleta', requireAuth, alumnosController.verificarBloqueo);
router.get('/:boleta', requireAuth, alumnosController.obtenerAlumno);
router.get('/:boleta/registros', requireAuth, alumnosController.obtenerRegistrosAlumno);

// 2. Catálogos para formularios
router.get('/grupos/lista', requireAuth, alumnosController.obtenerGrupos);
router.get('/estados/lista', requireAuth, alumnosController.obtenerEstadosAcademicos);
router.get('/carreras/lista', requireAuth, alumnosController.obtenerCarreras);

// 3. Acciones de Administrador (Bloqueo / Registro / Modificación)
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

// 4. Justificaciones y Registros específicos
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
router.post('/upload', 
    requireAuth,
    upload.single('image'),
    alumnosController.uploadImage
);

router.delete('/image', 
    requireAuth,
    alumnosController.deleteImage
);

export default router;