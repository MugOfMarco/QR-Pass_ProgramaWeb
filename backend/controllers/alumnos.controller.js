import Alumno from '../models/Alumno.js';
import { cloudinary, getOptimizedImageUrl } from '../database/cloudinary.js';

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

// Función para registrar justificaciones
export const registrarJustificacion = async (req, res) => {
    try {
        const { id_registro, justificacion, id_tipo_anterior } = req.body;
        
        console.log('Controlador - Datos recibidos para justificación:', {
            id_registro,
            justificacion,
            id_tipo_anterior
        });

        if (!id_registro || !justificacion || !id_tipo_anterior) {
            return res.status(400).json({
                success: false,
                message: 'Faltan campos requeridos: id_registro, justificacion, id_tipo_anterior'
            });
        }

        // Usa el método de la clase Alumno
        const resultado = await Alumno.registrarJustificacion(
            id_registro,
            justificacion,
            id_tipo_anterior
        );

        res.json({
            success: true,
            message: 'Justificación registrada exitosamente',
            data: resultado
        });
    } catch (error) {
        console.error('Error en controlador registrarJustificacion:', error);
        
        // Maneja errores específicos
        let mensajeError = 'Error al registrar justificación';
        
        if (error.code === 'ER_SP_DOES_NOT_EXIST') {
            mensajeError = 'Error en el servidor: Procedimiento no encontrado';
        } else if (error.code === 'ER_NO_REFERENCED_ROW_2') {
            mensajeError = 'El registro no existe en la base de datos';
        } else if (error.message && error.message.includes('Registro no encontrado')) {
            mensajeError = error.message;
        }

        res.status(500).json({
            success: false,
            message: mensajeError,
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

export const obtenerRegistrosParaJustificar = async (req, res) => {
    try {
        const { boleta } = req.params;
        
        console.log('Obteniendo registros para justificar del alumno:', boleta);

        if (!boleta || isNaN(boleta)) {
            return res.status(400).json({
                success: false,
                message: 'Boleta inválida'
            });
        }

        // Usa el método de la clase Alumno
        const registros = await Alumno.obtenerRegistrosParaJustificar(boleta);

        res.json({
            success: true,
            data: registros
        });
    } catch (error) {
        console.error('Error obteniendo registros para justificar:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener registros',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// Las otras funciones que ya tenías...
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

export const uploadImage = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'No se proporcionó ninguna imagen'
            });
        }

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