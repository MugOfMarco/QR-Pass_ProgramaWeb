import Alumno from '../models/Alumno.js';
import { cloudinary, getOptimizedImageUrl } from '../database/cloudinary.js';
import sanitizeHtml from 'sanitize-html';

// ==========================================
// FUNCIONES AUXILIARES
// ==========================================

const sanitize = (data) => {
    if (typeof data === 'string') {
        return sanitizeHtml(data, {
            allowedTags: [],
            allowedAttributes: {},
            disallowedTagsMode: 'recursiveEscape'
        });
    }
    return data;
};

const sanitizeObject = (obj) => {
    const sanitized = {};
    for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
            sanitized[key] = sanitize(obj[key]);
        }
    }
    return sanitized;
};

// ==========================================
// CONTROLADORES
// ==========================================

export const createAlumno = async (req, res) => {
    try {
        const nombreLimpio = sanitize(req.body.nombre);
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
            message: 'Error al crear el alumno. Intente nuevamente.'
        });
    }
};

// === CORRECCIÓN AQUÍ: Mensaje amigable para el cliente ===
export const obtenerAlumno = async (req, res) => {
    try {
        const { boleta } = req.params;
        const datosCompletos = await Alumno.obtenerCompleto(boleta);

        if (datosCompletos && datosCompletos.info) {
            res.json({
                success: true,
                alumno: datosCompletos.info,
                horario: datosCompletos.horario
            });
        } else {
            res.status(404).json({
                success: false,
                message: 'No se encontró ningún alumno con esa boleta.'
            });
        }
    } catch (error) {
        console.error('Error obteniendo alumno:', error);

        // Detectar si el número es demasiado grande para la base de datos
        if (error.code === 'ER_WARN_DATA_OUT_OF_RANGE' || error.errno === 1264) {
             return res.status(400).json({
                success: false,
                // MENSAJE AMIGABLE PARA EL CLIENTE:
                message: 'El número de boleta ingresado no es válido. Por favor verifique el dato.'
            });
        }

        res.status(500).json({
            success: false,
            message: 'Error interno al buscar el alumno.'
        });
    }
};

export const registrarJustificacion = async (req, res) => {
    try {
        const id_registro = parseInt(req.body.id_registro);
        const justificacion = sanitize(req.body.justificacion);
        const id_tipo_anterior = parseInt(req.body.id_tipo_anterior);
        
        if (!id_registro || !justificacion || !id_tipo_anterior) {
            return res.status(400).json({
                success: false,
                message: 'Faltan datos para registrar la justificación.'
            });
        }

        const resultado = await Alumno.registrarJustificacion(
            id_registro,
            justificacion,
            id_tipo_anterior
        );

        res.json({
            success: true,
            message: 'Justificación registrada correctamente.',
            data: resultado
        });
    } catch (error) {
        console.error('Error en registrarJustificacion:', error);
        res.status(500).json({
            success: false,
            message: 'No se pudo registrar la justificación.'
        });
    }
};

export const obtenerRegistrosParaJustificar = async (req, res) => {
    try {
        const { boleta } = req.params;
        if (!boleta || isNaN(boleta)) {
            return res.status(400).json({ success: false, message: 'La boleta no es válida.' });
        }
        const registros = await Alumno.obtenerRegistrosParaJustificar(boleta);
        res.json({ success: true, data: registros });
    } catch (error) {
        console.error('Error obteniendo registros:', error);
        res.status(500).json({ success: false, message: 'Error al obtener el historial.' });
    }
};

export const buscarAlumnos = async (req, res) => {
    try {
        const query = sanitize(req.query.query);
        const alumnos = await Alumno.buscar(query);
        res.json({ success: true, alumnos: alumnos });
    } catch (error) {
        console.error('Error buscando:', error);
        res.status(500).json({ success: false, message: 'Error al realizar la búsqueda.' });
    }
};

export const verificarBloqueo = async (req, res) => {
    try {
        const { boleta } = req.params;
        const bloqueado = await Alumno.verificarBloqueo(boleta);
        res.json({ success: true, bloqueado: bloqueado });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error al verificar estado del alumno.' });
    }
};

export const bloquearcredencial = async (req, res) => {
    try {
        const { boleta } = req.params;
        const result = await Alumno.bloquearcredencial(boleta);
        if (result.success) res.json({ success: true, message: result.message });
        else res.status(400).json({ success: false, message: result.message });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error al intentar bloquear.' });
    }
};

export const desbloquearcredencial = async (req, res) => {
    try {
        const { boleta } = req.params;
        const result = await Alumno.desbloquearcredencial(boleta);
        if (result.success) res.json({ success: true, message: result.message });
        else res.status(400).json({ success: false, message: result.message });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error al intentar desbloquear.' });
    }
};

export const obtenerRegistrosAlumno = async (req, res) => {
    try {
        const { boleta } = req.params;
        const registros = await Alumno.obtenerRegistros(boleta);
        res.json({ success: true, registros: registros });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error al cargar registros.' });
    }
};

export const registrarAlumno = async (req, res) => {
    try {
        const alumnoData = sanitizeObject(req.body);
        const result = await Alumno.registrar(alumnoData);
        if (result.success) {
            res.json({ success: true, message: result.message, boleta: alumnoData.boleta });
        } else {
            res.status(400).json({ success: false, message: result.message });
        }
    } catch (error) {
        console.error('Error registrando:', error);
        res.status(500).json({ success: false, message: 'Error al registrar el alumno.' });
    }
};

export const modificarAlumno = async (req, res) => {
    try {
        const { boleta } = req.params;
        
        // 1. Separar el horario para NO sanitizarlo como texto
        const { horario, ...restoDatos } = req.body;
        
        // 2. Sanitizar datos planos
        const datosLimpios = sanitizeObject(restoDatos);
        
        // 3. Reintegrar horario original (Array)
        const alumnoData = {
            ...datosLimpios,
            horario: horario 
        };
        
        console.log('Modificando alumno:', boleta);
        
        const result = await Alumno.modificar(boleta, alumnoData);
        
        if (result.success) {
            res.json({ success: true, message: result.message, boleta: boleta });
        } else {
            res.status(400).json({ success: false, message: result.message });
        }
    } catch (error) {
        console.error('Error modificando:', error);
        res.status(500).json({ success: false, message: 'Error al modificar los datos.' });
    }
};

export const eliminarAlumno = async (req, res) => {
    try {
        const { boleta } = req.params;
        const result = await Alumno.eliminar(boleta);
        if (result.success) res.json({ success: true, message: result.message });
        else res.status(400).json({ success: false, message: result.message });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error al eliminar el alumno.' });
    }
};

export const obtenerGrupos = async (req, res) => {
    try {
        const grupos = await Alumno.obtenerGrupos();
        res.json({ success: true, grupos: grupos });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error cargando grupos.' });
    }
};

export const obtenerEstadosAcademicos = async (req, res) => {
    try {
        const estados = await Alumno.obtenerEstadosAcademicos();
        res.json({ success: true, estados: estados });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error cargando estados.' });
    }
};

export const obtenerCarreras = async (req, res) => {
    try {
        const carreras = await Alumno.obtenerCarreras();
        res.json({ success: true, carreras: carreras });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error cargando carreras.' });
    }
};

export const uploadImage = async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ success: false, message: 'No se seleccionó ninguna imagen.' });

        const b64 = Buffer.from(req.file.buffer).toString('base64');
        const dataURI = `data:${req.file.mimetype};base64,${b64}`;

        const result = await cloudinary.uploader.upload(dataURI, {
            folder: 'qrpass/alumnos',
            resource_type: 'image',
            transformation: [
                { width: 300, height: 300, crop: 'fill', gravity: 'auto' },
                { quality: 'auto', fetch_format: 'auto' }
            ]
        });

        const optimizedUrl = getOptimizedImageUrl(result.secure_url, { width: 300, height: 300, crop: 'fill' });

        res.json({
            success: true,
            url: optimizedUrl,
            public_id: result.public_id,
            message: 'Imagen subida exitosamente'
        });
    } catch (error) {
        console.error('Error subiendo imagen:', error);
        res.status(500).json({ success: false, message: 'Error al subir la imagen.' });
    }
};

export const deleteImage = async (req, res) => {
    try {
        const { public_id } = req.body;
        if (!public_id) return res.status(400).json({ success: false, message: 'Falta identificador de imagen.' });

        await cloudinary.uploader.destroy(public_id);
        res.json({ success: true, message: 'Imagen eliminada correctamente.' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error al eliminar la imagen.' });
    }
};