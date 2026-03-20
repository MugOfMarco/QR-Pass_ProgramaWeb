// backend/routes/alumnos.routes.js
// ============================================================
// ORDEN IMPORTANTE:
//   Las rutas con path fijo (/buscar/alumnos, /grupos/lista, etc.)
//   deben ir ANTES de las rutas con parámetro (/:boleta)
//   para que Express no interprete "buscar" como una boleta.
// ============================================================
import express               from 'express';
import * as ctrl             from '../controllers/alumnos.controller.js';
import { requireAuth, requireRole } from '../middlewares/auth.middleware.js';
import multer                from 'multer';

const router  = express.Router();

// Multer en memoria — no guarda en disco, manda buffer a Cloudinary
const upload  = multer({
    storage: multer.memoryStorage(),
    limits:  { fileSize: 5 * 1024 * 1024 },   // 5 MB
});

// ── Todas las rutas requieren sesión ─────────────────────────
router.use(requireAuth);

// ── Catálogos (rutas fijas — van PRIMERO) ────────────────────
router.get('/buscar/alumnos',    ctrl.buscarAlumnos);
router.get('/grupos/lista',      ctrl.obtenerGrupos);
router.get('/estados/lista',     ctrl.obtenerEstadosAcademicos);
router.get('/carreras/lista',    ctrl.obtenerCarreras);
router.get('/materias/lista',    ctrl.obtenerMaterias);       // ← NUEVO

// ── Bloqueo ───────────────────────────────────────────────────
router.put('/bloquear/:boleta',
    requireRole('Administrador'),
    ctrl.bloquearcredencial
);
router.put('/desbloquear/:boleta',
    requireRole('Administrador'),
    ctrl.desbloquearcredencial
);
router.get('/verificar-bloqueo/:boleta', ctrl.verificarBloqueo);

// ── CRUD de alumnos ───────────────────────────────────────────
router.post('/registrar',
    requireRole('Administrador'),
    ctrl.registrarAlumno
);
router.put('/modificar/:boleta',
    requireRole('Administrador'),
    ctrl.modificarAlumno
);
router.delete('/eliminar/:boleta',
    requireRole('Administrador'),
    ctrl.eliminarAlumno
);

// ── Imagen ────────────────────────────────────────────────────
router.post('/upload',
    requireRole('Administrador'),
    upload.single('image'),
    ctrl.uploadImage
);
router.delete('/image',
    requireRole('Administrador'),
    ctrl.deleteImage
);

// ── Justificaciones ───────────────────────────────────────────
router.post('/justificaciones',
    requireRole('Administrador', 'Prefecto'),
    ctrl.registrarJustificacion
);

// ── Registros del alumno ──────────────────────────────────────
router.get('/:boleta/registros/justificar',
    requireRole('Administrador', 'Prefecto'),
    ctrl.obtenerRegistrosParaJustificar
);
router.get('/:boleta/registros', ctrl.obtenerRegistrosAlumno);

// ── Obtener alumno por boleta (va AL FINAL — es la más genérica) ──
router.get('/:boleta', ctrl.obtenerAlumno);

export default router;