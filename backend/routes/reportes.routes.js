// backend/routes/reportes.routes.js
// ============================================================
// Genera PDFs de reportes para descargar desde el frontend.
// Requiere: pip install reportlab  (en el entorno Python del servidor)
//
// RUTA: GET /api/reportes/alumnos-pdf?<filtros>
//   Acepta los mismos query params que /api/alumnos/buscar/alumnos:
//     q, turno, puertas, estado
//   Devuelve application/pdf para descarga directa.
// ============================================================
import express from 'express';
import { requireAuth, requireRole } from '../middlewares/auth.middleware.js';
import { generarReporteAlumnos } from '../controllers/reportes.controller.js';

const router = express.Router();

router.use(requireAuth);

// Solo administrador puede descargar reportes
router.get('/alumnos-pdf',
    requireRole('Administrador'),
    generarReporteAlumnos
);

export default router;