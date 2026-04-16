// backend/routes/grupos.routes.js
import express from 'express';
import { requireAuth, requireRole } from '../middlewares/auth.middleware.js';
import {
    listarGrupos,
    listarTurnos,
    crearGrupo,
    editarGrupo,
    accionMasiva,
    cargaMasiva,
} from '../controllers/grupos.controller.js';

const router = express.Router();
router.use(requireAuth);

// Cualquier usuario autenticado puede ver grupos
router.get('/',        listarGrupos);
router.get('/turnos',  listarTurnos);

// Solo Administrador puede modificar
router.post('/',               requireRole('Administrador'), crearGrupo);
router.put('/:id',             requireRole('Administrador'), editarGrupo);
router.post('/accion-masiva',  requireRole('Administrador'), accionMasiva);
router.post('/carga-masiva',   requireRole('Administrador'), cargaMasiva);

export default router;