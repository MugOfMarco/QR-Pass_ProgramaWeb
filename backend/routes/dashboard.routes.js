// backend/routes/dashboard.routes.js
import express from 'express';
import { obtenerDashboard } from '../controllers/dashboard.controller.js';
import { requireAuth, requireRole } from '../middlewares/auth.middleware.js';

const router = express.Router();

router.use(requireAuth);
router.get('/', requireRole('Administrador'), obtenerDashboard);

export default router;