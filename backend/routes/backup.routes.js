// backend/routes/backup.routes.js
import express from 'express';
import { requireAuth, requireRole } from '../middlewares/auth.middleware.js';
import { descargarRespaldo } from '../controllers/backup.controller.js';
 
const router = express.Router();
router.use(requireAuth);
router.get('/', requireRole('Administrador'), descargarRespaldo);
 
export default router;
 
