// backend/routes/grupos.routes.js
import express from 'express';
import { requireAuth, requireRole } from '../middlewares/auth.middleware.js';
import {
    listarGrupos,
    listarTurnos,
    listarCarreras,
    listarMaterias,
    listarSemestres,
    listarHorarios,
    crearGrupo,
    editarGrupo,
    accionMasiva,
    cargaMasiva,
    cargaMasivaHorarios,
    crearHorario,
    editarHorario,
    eliminarHorario,
} from '../controllers/grupos.controller.js';

const router = express.Router();
router.use(requireAuth);

// Cualquier usuario autenticado puede ver grupos y catálogos
router.get('/',           listarGrupos);
router.get('/turnos',     listarTurnos);
router.get('/carreras',   listarCarreras);
router.get('/materias',   listarMaterias);
router.get('/semestres',  listarSemestres);

// Horarios por grupo — solo Admin
router.get('/:id/horarios',  requireRole('Administrador'), listarHorarios);
router.post('/:id/horarios', requireRole('Administrador'), crearHorario);

// Solo Administrador puede modificar grupos y horarios sueltos
router.post('/',                    requireRole('Administrador'), crearGrupo);
router.put('/:id',                  requireRole('Administrador'), editarGrupo);
router.post('/accion-masiva',       requireRole('Administrador'), accionMasiva);
router.post('/carga-masiva',          requireRole('Administrador'), cargaMasiva);
router.post('/carga-masiva-horarios', requireRole('Administrador'), cargaMasivaHorarios);
router.put('/horarios/:id',         requireRole('Administrador'), editarHorario);
router.delete('/horarios/:id',      requireRole('Administrador'), eliminarHorario);

export default router;
