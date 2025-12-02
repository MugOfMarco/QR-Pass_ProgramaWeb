const Alumno = require('../models/Alumno');

exports.obtenerAlumno = async (req, res) => {
    try {
        const boleta = parseInt(req.params.boleta);
        const alumnoData = await Alumno.obtenerCompleto(boleta);

        if (!alumnoData) {
            return res.status(404).json({
                success: false,
                message: 'Alumno no encontrado'
            });
        }

        res.json({
            success: true,
            alumno: alumnoData.info,
            horario: alumnoData.horario,
            materiasAcreditadas: alumnoData.materiasAcreditadas
        });

    } catch (error) {
        console.error('Error obteniendo alumno:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        });
    }
};

exports.bloquearCredencial = async (req, res) => {
    try {
        const boleta = parseInt(req.params.boleta);
        const result = await Alumno.bloquear(boleta);

        if (!result) {
            return res.status(404).json({
                success: false,
                message: 'Alumno no encontrado'
            });
        }

        res.json({
            success: true,
            message: 'Credencial bloqueada correctamente'
        });

    } catch (error) {
        console.error('Error al bloquear credencial:', error);
        res.status(500).json({
            success: false,
            message: 'Error en el servidor al bloquear'
        });
    }
};

exports.desbloquearCredencial = async (req, res) => {
    try {
        const boleta = parseInt(req.params.boleta);
        const result = await Alumno.desbloquear(boleta);

        if (!result) {
            return res.status(404).json({
                success: false,
                message: 'Alumno no encontrado'
            });
        }

        res.json({
            success: true,
            message: 'Credencial desbloqueada correctamente'
        });

    } catch (error) {
        console.error('Error al desbloquear credencial:', error);
        res.status(500).json({
            success: false,
            message: 'Error en el servidor al desbloquear'
        });
    }
};

exports.verificarBloqueo = async (req, res) => {
    try {
        const boleta = parseInt(req.params.boleta);
        const result = await Alumno.verificarBloqueo(boleta);

        if (!result) {
            return res.status(404).json({
                success: false,
                message: 'Alumno no encontrado'
            });
        }

        res.json({
            success: true,
            bloqueado: result.bloqueado === 1
        });

    } catch (error) {
        console.error('Error al verificar bloqueo:', error);
        res.status(500).json({
            success: false,
            message: 'Error en el servidor al verificar'
        });
    }
};

exports.buscarAlumnos = async (req, res) => {
    try {
        const { query } = req.query;
        const alumnos = await Alumno.buscar(query);

        res.json({
            success: true,
            alumnos
        });

    } catch (error) {
        console.error('Error buscando alumnos:', error);
        res.status(500).json({
            success: false,
            message: 'Error en la búsqueda'
        });
    }
};

// Si necesitas obtener registros desde el controller de alumnos
exports.obtenerRegistrosAlumno = async (req, res) => {
    try {
        const boleta = parseInt(req.params.boleta);
        const alumno = await Alumno.obtenerCompleto(boleta);

        if (!alumno) {
            return res.status(404).json({
                success: false,
                message: 'Alumno no encontrado'
            });
        }

        // Aquí necesitarías importar el modelo Registro o tener un método en Alumno
        res.json({
            success: true,
            registros: [] // Placeholder
        });

    } catch (error) {
        console.error('Error obteniendo registros:', error);
        res.status(500).json({
            success: false,
            message: 'Error obteniendo registros'
        });
    }
};