import Alumno from '../models/Alumno.js';
import Justificacion from '../models/Justificacion.js';

export const obtenerAlumno = async (req, res) => {
    try {
        const boleta = parseInt(req.params.boleta);
        const alumno = await Alumno.obtenerCompleto(boleta);

        if (!alumno) {
            return res.status(404).json({
                success: false,
                message: 'Alumno no encontrado'
            });
        }

        const bloqueado = alumno.info.bloqueado;
        const sinCredencial = alumno.info.sin_credencial;
        
        let mensajeAcceso = '';
        if (bloqueado) {
            mensajeAcceso = 'CREDENCIAL BLOQUEADA';
        } else if (sinCredencial >= 3) {
            mensajeAcceso = 'ACCESO DENEGADO - 3+ incidencias sin credencial';
        }

        res.json({
            success: true,
            alumno: alumno.info,
            horario: alumno.horario,
            materiasAcreditadas: alumno.materiasAcreditadas,
            bloqueado: bloqueado,
            sinCredencial: sinCredencial,
            mensajeAcceso: mensajeAcceso
        });

    } catch (error) {
        console.error('Error obteniendo alumno:', error);
        res.status(500).json({
            success: false,
            message: 'Error obteniendo datos del alumno'
        });
    }
};

export const obtenerRegistrosAlumno = async (req, res) => {
    try {
        const boleta = parseInt(req.params.boleta);
        const registros = await Alumno.obtenerRegistros(boleta);

        res.json({
            success: true,
            boleta: boleta,
            registros: registros,
            total: registros.length
        });

    } catch (error) {
        console.error('Error obteniendo registros:', error);
        res.status(500).json({
            success: false,
            message: 'Error obteniendo registros'
        });
    }
};

export const bloquearCredencial = async (req, res) => {
    try {
        const boleta = parseInt(req.params.boleta);
        const result = await Alumno.bloquear(boleta);

        if (result.filas_afectadas > 0) {
            res.json({
                success: true,
                message: 'Credencial bloqueada exitosamente'
            });
        } else {
            res.status(404).json({
                success: false,
                message: 'Alumno no encontrado'
            });
        }

    } catch (error) {
        console.error('Error bloqueando credencial:', error);
        res.status(500).json({
            success: false,
            message: 'Error bloqueando credencial'
        });
    }
};

export const desbloquearCredencial = async (req, res) => {
    try {
        const boleta = parseInt(req.params.boleta);
        const result = await Alumno.desbloquear(boleta);

        if (result.filas_afectadas > 0) {
            res.json({
                success: true,
                message: 'Credencial desbloqueada exitosamente'
            });
        } else {
            res.status(404).json({
                success: false,
                message: 'Alumno no encontrado'
            });
        }

    } catch (error) {
        console.error('Error desbloqueando credencial:', error);
        res.status(500).json({
            success: false,
            message: 'Error desbloqueando credencial'
        });
    }
};

export const verificarBloqueo = async (req, res) => {
    try {
        const boleta = parseInt(req.params.boleta);
        const result = await Alumno.verificarBloqueo(boleta);

        if (result) {
            res.json({
                success: true,
                bloqueado: result.bloqueado,
                nombre: result.nombre
            });
        } else {
            res.status(404).json({
                success: false,
                message: 'Alumno no encontrado'
            });
        }

    } catch (error) {
        console.error('Error verificando bloqueo:', error);
        res.status(500).json({
            success: false,
            message: 'Error verificando estado de credencial'
        });
    }
};

export const buscarAlumnos = async (req, res) => {
    try {
        const query = req.query.q || '';
        const alumnos = await Alumno.buscar(query);

        res.json({
            success: true,
            alumnos: alumnos,
            total: alumnos.length
        });

    } catch (error) {
        console.error('Error buscando alumnos:', error);
        res.status(500).json({
            success: false,
            message: 'Error buscando alumnos'
        });
    }
};

// En alumnos.controller.js
export const crearJustificacion = async (req, res) => {
    try {
        const { id_registro, justificacion, id_tipo_anterior } = req.body;
        
        console.log('📝 Creando justificación:', { id_registro, justificacion, id_tipo_anterior });

        const result = await Justificacion.crear({
            id_registro: id_registro,
            justificacion: justificacion,
            id_tipo_anterior: id_tipo_anterior
        });

        console.log('✅ Resultado:', result);

        if (result) {
            res.json({
                success: true,
                message: 'Incidencia justificada correctamente',
                id_justificacion: result.id_justificacion
            });
        } else {
            console.error('❌ No se obtuvo resultado del SP');
            res.status(400).json({
                success: false,
                message: 'Error al crear justificación'
            });
        }

    } catch (error) {
        console.error('❌ Error creando justificación:', error);
        res.status(500).json({
            success: false,
            message: 'Error creando justificación: ' + error.message
        });
    }
};

export const obtenerJustificacionesAlumno = async (req, res) => {
    try {
        const boleta = parseInt(req.params.boleta);
        const justificaciones = await Justificacion.obtenerPorAlumno(boleta);

        res.json({
            success: true,
            boleta: boleta,
            justificaciones: justificaciones,
            total: justificaciones.length
        });

    } catch (error) {
        console.error('Error obteniendo justificaciones:', error);
        res.status(500).json({
            success: false,
            message: 'Error obteniendo justificaciones'
        });
    }
};

const registrarAlumno = async (req, res) => {
    try {
        const alumnoData = req.body;
        
        // PENDIENTE: Validar datos
        
        const nuevoAlumno = await Alumno.crear(alumnoData); 

        res.status(201).json({ 
            success: true, 
            message: 'Alumno registrado exitosamente.',
            data: nuevoAlumno
        });

    } catch (error) {
        console.error('Error al registrar alumno:', error);
        res.status(500).json({ success: false, message: error.message || 'Error interno del servidor al registrar.' });
    }
};

const modificarAlumno = async (req, res) => {
    try {
        const boleta = req.params.boleta;
        const alumnoData = req.body;
        
        // PENDIENTE: Validar datos y llamar a Alumno.modificar(boleta, alumnoData)
        
        // Simulación de éxito
        res.json({ 
            success: true, 
            message: `Alumno ${boleta} modificado exitosamente.` 
        });

    } catch (error) {
        console.error('Error al modificar alumno:', error);
        res.status(500).json({ success: false, message: 'Error interno del servidor al modificar.' });
    }
};

const eliminarAlumno = async (req, res) => {
    try {
        const boleta = req.params.boleta;
        
        // PENDIENTE: Llamar a Alumno.eliminar(boleta)
        
        // Simulación de éxito
        res.status(204).json(); // 204 No Content, estándar para DELETE exitoso

    } catch (error) {
        console.error('Error al eliminar alumno:', error);
        res.status(500).json({ success: false, message: 'Error interno del servidor al eliminar.' });
    }
};

// backend/controllers/alumnos.controller.js (BLOQUE FINAL DE EXPORTACIÓN)

export {
    // ... (tus funciones existentes)
    obtenerAlumno,
    bloquearCredencial,
    desbloquearCredencial,
    verificarBloqueo,
    buscarAlumnos,
    
    // 🚨 ASEGÚRATE DE QUE ESTÉN ESTAS TRES 🚨
    registrarAlumno,
    modificarAlumno,
    eliminarAlumno,

    // ... (otras funciones como obtenerRegistrosAlumno, crearJustificacion, etc.)
};