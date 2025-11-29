// backend/routers/auth.router.js

const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');

// Mapea POST /api/login a la función loginUsuario del controlador
router.post('/login', authController.loginUsuario);

// Mapea POST /api/logout a la función logoutUsuario del controlador
router.post('/logout', authController.logoutUsuario);

module.exports = router;