// back/routes/alumnos.router.js - CORREGIDO
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

// ====================
// RUTAS PÚBLICAS
// ====================
router.get('/:boleta', alumnosController.obtenerAlumno);
router.get('/buscar/alumnos', alumnosController.buscarAlumnos);
router.get('/verificar-bloqueo/:boleta', alumnosController.verificarBloqueo);

// ====================
// RUTAS CON AUTENTICACIÓN
// ====================

// 1. Rutas que requieren SOLO autenticación (cualquier usuario logueado)
router.get('/:boleta/registros', 
    requireAuth,  // ← AGREGAR ESTO
    alumnosController.obtenerRegistrosAlumno
);

// 2. Rutas que requieren SER Administrador
router.put('/bloquear/:boleta', 
    requireAuth,  // ← PRIMERO verificar autenticación
    requireRole('Administrador'),  // ← LUEGO verificar rol
    alumnosController.bloquearCredencial
);

router.put('/desbloquear/:boleta',
    requireAuth,
    requireRole('Administrador'),
    alumnosController.desbloquearCredencial
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

// Ruta para justificaciones - SOLO ADMIN
router.post('/justificaciones',
    requireAuth,
    requireRole('Administrador'),
    alumnosController.registrarJustificacion
);

// Ruta para obtener registros pendientes de justificación - SOLO ADMIN
router.get('/:boleta/registros/justificar',
    requireAuth,
    requireRole('Administrador'),
    alumnosController.obtenerRegistrosParaJustificar
);

// Rutas para listas desplegables (cualquier autenticado)
router.get('/grupos/lista', 
    requireAuth,
    alumnosController.obtenerGrupos
);

router.get('/estados/lista', 
    requireAuth,
    alumnosController.obtenerEstadosAcademicos
);

router.get('/carreras/lista', 
    requireAuth,
    alumnosController.obtenerCarreras
);

// Ruta para upload de imágenes (cualquier autenticado)
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