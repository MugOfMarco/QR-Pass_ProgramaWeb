// backend/routes/backup.routes.js
import express from 'express';
import { requireAuth, requireRole } from '../middlewares/auth.middleware.js';
import {
    descargarRespaldo,
    resetearContadores,
    resetearCompleto,
} from '../controllers/backup.controller.js';

const router = express.Router();
router.use(requireAuth, requireRole('Administrador'));

router.get('/',                    descargarRespaldo);
router.post('/reset-contadores',   resetearContadores);
router.post('/reset-completo',     resetearCompleto);

export default router;
 
