// backend/routes/faq.routes.js
import express from 'express';
import { requireAuth, requireRole } from '../middlewares/auth.middleware.js';
import { registrarClic, obtenerStats } from '../controllers/faq.controller.js';

const router = express.Router();

// Cualquier usuario autenticado puede registrar un clic
router.post('/clic', requireAuth, registrarClic);

// Solo Soporte o Administrador pueden ver las estadísticas
router.get('/stats', requireAuth, requireRole('Soporte', 'Administrador'), obtenerStats);

export default router;
