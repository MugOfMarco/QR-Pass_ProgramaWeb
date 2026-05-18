// backend/routes/config.routes.js
import express from 'express';
import { requireAuth, requireRole } from '../middlewares/auth.middleware.js';
import * as cfg from '../controllers/config.controller.js';

const router = express.Router();

// Todos los endpoints de configuración son exclusivos del Administrador
router.use(requireAuth, requireRole('Administrador'));

router.get('/dias-inhabiles',              cfg.listarDias);
router.post('/dias-inhabiles',             cfg.agregarDia);
router.delete('/dias-inhabiles/:id',       cfg.eliminarDia);
router.post('/dias-inhabiles/reiniciar',   cfg.reiniciarCiclo);

export default router;
