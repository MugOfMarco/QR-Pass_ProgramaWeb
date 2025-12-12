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
    
    const baseUrl = imageUrl.split('/upload/')[0];
    const imagePath = imageUrl.split('/upload/')[1];
    
    const defaultTransformations = {
        width: options.width || 300,
        height: options.height || 300,
        crop: options.crop || 'fill',
        gravity: options.gravity || 'auto',
        quality: 'auto',
        fetch_format: 'auto'
    };
    
    const transformations = Object.entries(defaultTransformations)
        .map(([key, value]) => `${key}_${value}`)
        .join(',');
    
    return `${baseUrl}/upload/${transformations}/${imagePath}`;
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