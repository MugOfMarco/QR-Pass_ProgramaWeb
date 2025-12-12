import express from 'express';
const router = express.Router();
import * as alumnosController from '../controllers/alumnos.controller.js';
import { requireAuth, requireRole } from '../middlewares/auth.middleware.js';
import multer from 'multer';

// Usar memoryStorage para evitar guardar archivos en disco
const storage = multer.memoryStorage();
const upload = multer({ 
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB límite
    }
});

// Rutas públicas
router.get('/:boleta', alumnosController.obtenerAlumno);
router.get('/buscar/alumnos', alumnosController.buscarAlumnos);
router.get('/verificar-bloqueo/:boleta', alumnosController.verificarBloqueo);

// Rutas que requieren autenticación
router.use(requireAuth);

// Rutas con roles específicos
router.put('/bloquear/:boleta', 
    requireRole('Administrador'),
    alumnosController.bloquearCredencial
);

router.put('/desbloquear/:boleta',
    requireRole('Administrador'),
    alumnosController.desbloquearCredencial
);

router.get('/:boleta/registros', alumnosController.obtenerRegistrosAlumno);

router.post('/registrar',
    requireRole('Administrador'),
    alumnosController.registrarAlumno
);

router.put('/modificar/:boleta',
    requireRole('Administrador'),
    alumnosController.modificarAlumno
);

router.delete('/eliminar/:boleta',
    requireRole('Administrador'),
    alumnosController.eliminarAlumno
);

// Rutas para listas desplegables
router.get('/grupos/lista', alumnosController.obtenerGrupos);
router.get('/estados/lista', alumnosController.obtenerEstadosAcademicos);
router.get('/carreras/lista', alumnosController.obtenerCarreras);

// Ruta para upload de imágenes desde buffer
router.post('/upload', 
    upload.single('image'),
    alumnosController.uploadImage
);

router.delete('/image', alumnosController.deleteImage);

export default router;