// backend/routes/auth.routes.js

import express from 'express'; // Importación ESM de Express
const router = express.Router();

// ANTES: const authController = require('../controllers/auth.controller');
import * as authController from '../controllers/auth.controller.js'; // Importación ESM del controlador (usando *)

// =================================================================
// RUTAS
// =================================================================

// POST /api/auth/login
router.post('/login', authController.login);

// POST /api/auth/logout
router.post('/logout', authController.logout);

// GET /api/auth/check (Para verificar la sesión desde el frontend)
router.get('/check', authController.checkAuth);

// Exportación Final (ESM)
// ANTES: module.exports = router;
export default router;