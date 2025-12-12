// backend/routes/upload.routes.js
import express from 'express';
import upload from '../config/multer.js';
import * as uploadController from '../controllers/upload.controller.js';
import { requireAuth, requireRole } from '../middlewares/auth.middleware.js';

const router = express.Router();

router.post('/image',
    requireAuth,
    requireRole('Administrador'),
    upload.single('image'),
    uploadController.uploadImage
);

router.delete('/image',
    requireAuth,
    requireRole('Administrador'),
    uploadController.deleteImage
);

export default router;