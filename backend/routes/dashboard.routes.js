// backend/routes/dashboard.routes.js
import express from 'express';
import { obtenerDashboard, actualizarConfig } from '../controllers/dashboard.controller.js';
import { requireAuth, requireRole } from '../middlewares/auth.middleware.js';

const router = express.Router();

router.use(requireAuth);
router.get('/',       requireRole('Administrador'), obtenerDashboard);
router.put('/config', requireRole('Administrador'), actualizarConfig);

export default router;
