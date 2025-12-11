import { cloudinary, getOptimizedImageUrl } from '../database/cloudinary.js';

export const uploadImage = async (req, res) => {
    try {
        console.log('Subiendo imagen...');
        
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'No se proporcionó ninguna imagen'
            });
        }

        // Subir a Cloudinary
        const result = await cloudinary.uploader.upload(req.file.path, {
            folder: 'qrpass/alumnos',
            resource_type: 'image',
            transformation: [
                { width: 300, height: 300, crop: 'fill', gravity: 'auto' },
                { quality: 'auto', fetch_format: 'auto' }
            ]
        });

        console.log('Imagen subida a Cloudinary:', result.secure_url);

        // Obtener URL optimizada
        const optimizedUrl = getOptimizedImageUrl(result.secure_url, {
            width: 300,
            height: 300,
            crop: 'fill'
        });

        res.json({
            success: true,
            url: optimizedUrl,
            public_id: result.public_id,
            message: 'Imagen subida exitosamente'
        });

    } catch (error) {
        console.error('Error subiendo imagen:', error);
        res.status(500).json({
            success: false,
            message: 'Error subiendo imagen: ' + error.message
        });
    }
};

export const deleteImage = async (req, res) => {
    try {
        const { public_id } = req.body;
        
        if (!public_id) {
            return res.status(400).json({
                success: false,
                message: 'Se requiere public_id'
            });
        }

        await cloudinary.uploader.destroy(public_id);
        
        res.json({
            success: true,
            message: 'Imagen eliminada de Cloudinary'
        });

    } catch (error) {
        console.error('Error eliminando imagen:', error);
        res.status(500).json({
            success: false,
            message: 'Error eliminando imagen: ' + error.message
        });
    }
};