import 'dotenv/config';
import cloudinaryPackage from 'cloudinary';

const cloudinary = cloudinaryPackage.v2;

// Configurar Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// Función para obtener URL optimizada
export function getOptimizedImageUrl(imageUrl, options = {}) {
    if (!imageUrl || !imageUrl.includes('cloudinary.com')) {
        return imageUrl;
    }
    
    // 1. Extraer el Public ID de la URL
    // Las URLs de Cloudinary tienen este formato: .../upload/v12345/folder/image.jpg
    const parts = imageUrl.split('/');
    const uploadIndex = parts.indexOf('upload');
    if (uploadIndex === -1) return imageUrl;

    // El public ID es todo lo que sigue después de la versión (vXXXXX)
    // O después de /upload/ si no hay versión
    const publicIdWithExtension = parts.slice(uploadIndex + 2).join('/');
    const publicId = publicIdWithExtension.split('.')[0];

    // 2. Usar el SDK oficial para generar la URL limpia
    return cloudinary.url(publicId, {
        width: options.width || 300,
        height: options.height || 300,
        crop: options.crop || 'fill',
        gravity: options.gravity || 'auto',
        quality: 'auto',
        fetch_format: 'auto',
        secure: true
    });
}

// Función para subir imagen
export async function uploadImage(filePath, folder = 'qrpass/alumnos') {
    try {
        const result = await cloudinary.uploader.upload(filePath, {
            folder: folder,
            resource_type: 'image'
        });
        return result;
    } catch (error) {
        console.error('Error subiendo imagen a Cloudinary:', error);
        throw error;
    }
}

// Exportar Cloudinary
export { cloudinary };