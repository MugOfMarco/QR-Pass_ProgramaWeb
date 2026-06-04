// backend/routes/bitacora.routes.js
import express from 'express';
import { requireAuth, requireRole } from '../middlewares/auth.middleware.js';
import { getAccesos, getAcciones, getCatalogos } from '../controllers/bitacora.controller.js';

const router = express.Router();
router.use(requireAuth);
router.use(requireRole('Administrador'));

router.get('/accesos',    getAccesos);
router.get('/acciones',   getAcciones);
router.get('/catalogos',  getCatalogos);

export default router;
