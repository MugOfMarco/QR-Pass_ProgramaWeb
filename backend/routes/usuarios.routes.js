// backend/routes/usuarios.routes.js
import express from 'express';
import * as ctrl from '../controllers/usuarios.controller.js';
import { requireAuth, requireRole } from '../middlewares/auth.middleware.js';

const router = express.Router();

router.use(requireAuth);

// Catálogos (cualquier autenticado los necesita para el formulario)
router.get('/roles', ctrl.listarRoles);

// CRUD — solo Administrador
router.get('/',    requireRole('Administrador'), ctrl.listarUsuarios);
router.get('/:id', requireRole('Administrador'), ctrl.obtenerUsuario);
router.post('/',   requireRole('Administrador'), ctrl.crearUsuario);
router.put('/:id', requireRole('Administrador'), ctrl.modificarUsuario);

// Desactivar / reactivar — solo Admin
router.put('/:id/desactivar', requireRole('Administrador'), ctrl.desactivarUsuario);
router.put('/:id/reactivar',  requireRole('Administrador'), ctrl.reactivarUsuario);

// Cambiar contraseña — Admin puede cambiar cualquiera,
// cualquier usuario autenticado puede cambiar la suya
// (el controller valida quién es quién)
router.put('/:id/password', ctrl.cambiarPassword);

export default router;