import Alumno from '../models/Alumno.js';
import { cloudinary, getOptimizedImageUrl } from '../database/cloudinary.js';

export const obtenerAlumno = async (req, res) => {
    try {
        const { boleta } = req.params;

        // CAMBIO IMPORTANTE: Usamos 'obtenerCompleto' en vez de 'obtenerBasico'
        // para traer también el horario.
        const datosCompletos = await Alumno.obtenerCompleto(boleta);

        // Verificamos si encontramos al alumno (la info está en datosCompletos.info)
        if (datosCompletos && datosCompletos.info) {
            res.json({
                success: true,
                // Enviamos los datos desglosados como el frontend los espera:
                alumno: datosCompletos.info,
                horario: datosCompletos.horario // <--- ESTO ES LO QUE FALTABA
            });
        } else {
            res.status(404).json({
                success: false,
                message: 'Alumno no encontrado'
            });
        }
    } catch (error) {
        console.error('Error obteniendo alumno:', error);
        res.status(500).json({
            success: false,
            message: 'Error obteniendo alumno: ' + error.message
        });
    }
};

// Función para buscar alumnos (FALTANTE)
export const buscarAlumnos = async (req, res) => {
    try {
        const { query } = req.query;
        const alumnos = await Alumno.buscar(query);
        
        res.json({
            success: true,
            alumnos: alumnos
        });
    } catch (error) {
        console.error('Error buscando alumnos:', error);
        res.status(500).json({
            success: false,
            message: 'Error buscando alumnos: ' + error.message
        });
    }
};

// Función para verificar bloqueo (FALTANTE)
export const verificarBloqueo = async (req, res) => {
    try {
        const { boleta } = req.params;
        const bloqueado = await Alumno.verificarBloqueo(boleta);
        
        res.json({
            success: true,
            bloqueado: bloqueado
        });
    } catch (error) {
        console.error('Error verificando bloqueo:', error);
        res.status(500).json({
            success: false,
            message: 'Error verificando bloqueo: ' + error.message
        });
    }
};

// Función para bloquear credencial (FALTANTE)
export const bloquearCredencial = async (req, res) => {
    try {
        const { boleta } = req.params;
        const result = await Alumno.bloquearCredencial(boleta);
        
        if (result.success) {
            res.json({
                success: true,
                message: result.message
            });
        } else {
            res.status(400).json({
                success: false,
                message: result.message
            });
        }
    } catch (error) {
        console.error('Error bloqueando credencial:', error);
        res.status(500).json({
            success: false,
            message: 'Error bloqueando credencial: ' + error.message
        });
    }
};

// Función para desbloquear credencial (FALTANTE)
export const desbloquearCredencial = async (req, res) => {
    try {
        const { boleta } = req.params;
        const result = await Alumno.desbloquearCredencial(boleta);
        
        if (result.success) {
            res.json({
                success: true,
                message: result.message
            });
        } else {
            res.status(400).json({
                success: false,
                message: result.message
            });
        }
    } catch (error) {
        console.error('Error desbloqueando credencial:', error);
        res.status(500).json({
            success: false,
            message: 'Error desbloqueando credencial: ' + error.message
        });
    }
};

// Función para obtener registros del alumno (FALTANTE)
export const obtenerRegistrosAlumno = async (req, res) => {
    try {
        const { boleta } = req.params;
        const registros = await Alumno.obtenerRegistros(boleta);
        
        res.json({
            success: true,
            registros: registros
        });
    } catch (error) {
        console.error('Error obteniendo registros del alumno:', error);
        res.status(500).json({
            success: false,
            message: 'Error obteniendo registros del alumno: ' + error.message
        });
    }
};

// Funciones que ya tienes (las que me mostraste)
export const registrarAlumno = async (req, res) => {
    try {
        const alumnoData = req.body;
        
        const result = await Alumno.registrar(alumnoData);
        
        if (result.success) {
            res.json({
                success: true,
                message: result.message,
                boleta: alumnoData.boleta
            });
        } else {
            res.status(400).json({
                success: false,
                message: result.message
            });
        }
    } catch (error) {
        console.error('Error registrando alumno:', error);
        res.status(500).json({
            success: false,
            message: 'Error registrando alumno: ' + error.message
        });
    }
};

export const modificarAlumno = async (req, res) => {
    try {
        const { boleta } = req.params;
        const alumnoData = req.body;
        
        const result = await Alumno.modificar(boleta, alumnoData);
        
        if (result.success) {
            res.json({
                success: true,
                message: result.message,
                boleta: boleta
            });
        } else {
            res.status(400).json({
                success: false,
                message: result.message
            });
        }
    } catch (error) {
        console.error('Error modificando alumno:', error);
        res.status(500).json({
            success: false,
            message: 'Error modificando alumno: ' + error.message
        });
    }
};

export const eliminarAlumno = async (req, res) => {
    try {
        const { boleta } = req.params;
        
        const result = await Alumno.eliminar(boleta);
        
        if (result.success) {
            res.json({
                success: true,
                message: result.message
            });
        } else {
            res.status(400).json({
                success: false,
                message: result.message
            });
        }
    } catch (error) {
        console.error('Error eliminando alumno:', error);
        res.status(500).json({
            success: false,
            message: 'Error eliminando alumno: ' + error.message
        });
    }
};

export const obtenerGrupos = async (req, res) => {
    try {
        const grupos = await Alumno.obtenerGrupos();
        
        res.json({
            success: true,
            grupos: grupos
        });
    } catch (error) {
        console.error('Error obteniendo grupos:', error);
        res.status(500).json({
            success: false,
            message: 'Error obteniendo grupos'
        });
    }
};

export const obtenerEstadosAcademicos = async (req, res) => {
    try {
        const estados = await Alumno.obtenerEstadosAcademicos();
        
        res.json({
            success: true,
            estados: estados
        });
    } catch (error) {
        console.error('Error obteniendo estados académicos:', error);
        res.status(500).json({
            success: false,
            message: 'Error obteniendo estados académicos'
        });
    }
};

export const obtenerCarreras = async (req, res) => {
    try {
        const carreras = await Alumno.obtenerCarreras();
        
        res.json({
            success: true,
            carreras: carreras
        });
    } catch (error) {
        console.error('Error obteniendo carreras:', error);
        res.status(500).json({
            success: false,
            message: 'Error obteniendo carreras'
        });
    }
};

// Funciones de upload que están en el mismo archivo
export const uploadImage = async (req, res) => {
    try {
        console.log('Subiendo imagen...');
        
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'No se proporcionó ninguna imagen'
            });
        }

        // Convertir buffer a base64 para Cloudinary
        const b64 = Buffer.from(req.file.buffer).toString('base64');
        const dataURI = `data:${req.file.mimetype};base64,${b64}`;

        // Subir a Cloudinary desde data URI
        const result = await cloudinary.uploader.upload(dataURI, {
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