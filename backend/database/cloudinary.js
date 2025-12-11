require('dotenv').config();
const cloudinary = require('cloudinary').v2;

// Configurar Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// Función para obtener URL optimizada
function getOptimizedImageUrl(imageUrl, options = {}) {
    if (!imageUrl || !imageUrl.includes('cloudinary.com')) {
        return imageUrl;
    }
    
    // Si ya es una URL de Cloudinary, aplicar transformaciones
    const baseUrl = imageUrl.split('/upload/')[0];
    const imagePath = imageUrl.split('/upload/')[1];
    
    // Transformaciones por defecto
    const defaultTransformations = {
        width: options.width || 300,
        height: options.height || 300,
        crop: options.crop || 'fill',
        gravity: options.gravity || 'auto',
        quality: 'auto',
        fetch_format: 'auto'
    };
    
    // Crear string de transformaciones
    const transformations = Object.entries(defaultTransformations)
        .map(([key, value]) => `${key}_${value}`)
        .join(',');
    
    return `${baseUrl}/upload/${transformations}/${imagePath}`;
}

// Función para subir imagen (si necesitas subir desde el backend)
async function uploadImage(filePath, folder = 'qrpass/alumnos') {
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

// Exportar
module.exports = {
    cloudinary,
    getOptimizedImageUrl,
    uploadImage
};