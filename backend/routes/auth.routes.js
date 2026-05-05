import express from 'express';
const router = express.Router();
import * as authController from '../controllers/auth.controller.js';

router.post('/login',  authController.login);
router.post('/logout', authController.logout);
router.get('/check',   authController.checkAuth);

router.post('/olvide-password',  authController.olvidePassword);
router.get('/reset/verificar',   authController.verificarTokenReset);
router.post('/reset',            authController.resetearPassword);

export default router;
