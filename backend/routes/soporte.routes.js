// backend/routes/soporte.routes.js
import express from 'express';
import { requireAuth, requireRole } from '../middlewares/auth.middleware.js';
import {
    crearTicket,
    misTickets,
    detalleTicket,
    responderTicket,
    cerrarTicket,
    calificarTicket,
    todosTickets,
    tomarTicket,
    cambiarEstado,
    cambiarPrioridad,
    eliminarTicket,
    metricas,
} from '../controllers/soporte.controller.js';

const router = express.Router();
router.use(requireAuth);

// ── Rutas de usuario (cualquier rol autenticado) ───────────────
router.post('/tickets',                  crearTicket);
router.get('/tickets',                   misTickets);
router.get('/tickets/:id',               detalleTicket);
router.post('/tickets/:id/mensajes',     responderTicket);
router.patch('/tickets/:id/cerrar',      cerrarTicket);
router.patch('/tickets/:id/calificar',   calificarTicket);

// ── Rutas del panel de agente (Soporte / Administrador) ────────
router.get('/panel/tickets',                      requireRole('Soporte', 'Administrador'), todosTickets);
router.get('/panel/tickets/:id',                  requireRole('Soporte', 'Administrador'), detalleTicket);
router.patch('/panel/tickets/:id/tomar',          requireRole('Soporte', 'Administrador'), tomarTicket);
router.patch('/panel/tickets/:id/estado',         requireRole('Soporte', 'Administrador'), cambiarEstado);
router.patch('/panel/tickets/:id/prioridad',      requireRole('Soporte', 'Administrador'), cambiarPrioridad);
router.post('/panel/tickets/:id/mensajes',        requireRole('Soporte', 'Administrador'), responderTicket);
router.delete('/panel/tickets/:id',               requireRole('Soporte', 'Administrador'), eliminarTicket);
router.get('/panel/metricas',                     requireRole('Soporte', 'Administrador'), metricas);

export default router;
