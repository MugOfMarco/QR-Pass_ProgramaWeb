// backend/routes/usuarios.routes.js
import express from 'express';
import * as ctrl from '../controllers/usuarios.controller.js';
import { requireAuth, requireRole } from '../middlewares/auth.middleware.js';

const router = express.Router();

router.use(requireAuth);

// Roles — cualquier autenticado lo necesita para llenar el select
router.get('/roles', ctrl.listarRoles);

// CRUD — solo Administrador
router.get('/',    requireRole('Administrador'), ctrl.listarUsuarios);
router.get('/:id', requireRole('Administrador'), ctrl.obtenerUsuario);
router.post('/',   requireRole('Administrador'), ctrl.crearUsuario);
router.put('/:id', requireRole('Administrador'), ctrl.modificarUsuario);

// Desactivar / Reactivar — solo Admin
router.put('/:id/desactivar', requireRole('Administrador'), ctrl.desactivarUsuario);
router.put('/:id/reactivar',  requireRole('Administrador'), ctrl.reactivarUsuario);

// Cambiar contraseña — admin cambia cualquiera, usuario cambia la suya
router.put('/:id/password', ctrl.cambiarPassword);

export default router;