import { cloudinary, getOptimizedImageUrl } from '../database/cloudinary.js';
import Alumno from '../models/Alumno.js';


// Función de sanitización manual (sin dependencias externas)
const sanitize = (data) => {
    if (typeof data === 'string') {
        return data
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#x27;')
            .replace(/\//g, '&#x2F;')
            .trim();
    }
    return data;
};

export const createAlumno = async (req, res) => {
    try {
        // Sanitizamos el nombre antes de guardar
        const nombreLimpio = sanitize(req.body.nombre);
        
        // Ahora guardas 'nombreLimpio' en tu base de datos
        const nuevoAlumno = await Alumno.create({ nombre: nombreLimpio });
        
        res.json({
            success: true,
            message: 'Alumno creado exitosamente',
            alumno: nuevoAlumno
        });
    } catch (error) {
        console.error('Error creando alumno:', error);
        res.status(500).json({
            success: false,
            message: 'Error creando alumno: ' + error.message
        });
    }
};

export const uploadImage = async (req, res) => {
    try {
        console.log('Subiendo imagen...');
        
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'No se proporcionó ninguna imagen'
            });
        }

        // 1. Subir a Cloudinary
        const result = await cloudinary.uploader.upload(req.file.path, {
            folder: 'qrpass/alumnos',
            resource_type: 'image'
        });

        console.log('Imagen subida a Cloudinary:', result.secure_url);

        // 2. Obtener URL optimizada usando el método OFICIAL (esto evita espacios)
        const optimizedUrl = cloudinary.url(result.public_id, {
            width: 300,
            height: 300,
            crop: 'fill',
            gravity: 'auto',
            quality: 'auto',
            fetch_format: 'auto',
            secure: true
        });

        // 3. Respuesta al frontend
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