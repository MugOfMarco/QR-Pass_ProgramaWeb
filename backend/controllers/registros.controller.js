const Registro = require('../models/Registro');
const Alumno = require('../models/Alumno');

exports.crearRegistro = async (req, res) => {
    try {
        const { boleta, puerta, id_tipo_registro, tieneRetardo, sinCredencial } = req.body;

        // Validar que el alumno existe
        const alumno = await Alumno.obtenerCompleto(boleta);
        if (!alumno) {
            return res.status(404).json({
                success: false,
                message: 'Alumno no encontrado'
            });
        }

        // Crear registro principal
        const registro = await Registro.crear({
            boleta,
            puerta,
            id_tipo_registro
        });

        // Actualizar contadores si es necesario
        if (tieneRetardo) {
            await Registro.actualizarContadores(boleta, 'retardo', 'incrementar');
        }

        if (sinCredencial) {
            await Registro.actualizarContadores(boleta, 'sin_credencial', 'incrementar');
        }

        res.json({
            success: true,
            message: 'Registro creado correctamente',
            id_registro: registro.id_registro,
            data: {
                boleta,
                puerta,
                tipo_registro: id_tipo_registro,
                tieneRetardo,
                sinCredencial,
                fecha: new Date().toISOString()
            }
        });

    } catch (error) {
        console.error('Error creando registro:', error);
        res.status(500).json({
            success: false,
            message: 'Error creando registro: ' + error.message
        });
    }
};

exports.obtenerRegistrosPorAlumno = async (req, res) => {
    try {
        const boleta = parseInt(req.params.boleta);
        
        // Verificar que el alumno existe
        const alumno = await Alumno.obtenerCompleto(boleta);
        if (!alumno) {
            return res.status(404).json({
                success: false,
                message: 'Alumno no encontrado'
            });
        }

        const registros = await Registro.obtenerPorAlumno(boleta);

        res.json({
            success: true,
            boleta,
            registros,
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

exports.obtenerRegistrosPorFecha = async (req, res) => {
    try {
        const { fecha } = req.params;
        // Necesitarías un SP para esto
        // const registros = await Registro.obtenerPorFecha(fecha);
        
        res.json({
            success: true,
            fecha,
            registros: [] // Placeholder
        });

    } catch (error) {
        console.error('Error obteniendo registros por fecha:', error);
        res.status(500).json({
            success: false,
            message: 'Error obteniendo registros por fecha'
        });
    }
};

exports.obtenerEstadisticas = async (req, res) => {
    try {
        const { fecha } = req.query;
        
        // Aquí podrías agregar lógica para estadísticas
        // Ej: total registros, entradas vs salidas, etc.
        
        res.json({
            success: true,
            estadisticas: {
                totalRegistrosHoy: 0,
                entradas: 0,
                salidas: 0,
                retardos: 0,
                sinCredencial: 0
            }
        });

    } catch (error) {
        console.error('Error obteniendo estadísticas:', error);
        res.status(500).json({
            success: false,
            message: 'Error obteniendo estadísticas'
        });
    }
};