// backend/routes/faq.routes.js
import express from 'express';
import { requireAuth, requireRole } from '../middlewares/auth.middleware.js';
import { registrarClic, obtenerStats, actualizarFaq, eliminarFaq } from '../controllers/faq.controller.js';

const router = express.Router();

// Cualquier usuario autenticado puede registrar un clic
router.post('/clic', requireAuth, registrarClic);

// Solo Soporte o Administrador pueden ver estadísticas, editar y eliminar preguntas
router.get   ('/stats',   requireAuth, requireRole('Soporte', 'Administrador'), obtenerStats);
router.patch ('/:id',     requireAuth, requireRole('Soporte', 'Administrador'), actualizarFaq);
router.delete('/:id',     requireAuth, requireRole('Soporte', 'Administrador'), eliminarFaq);

export default router;
