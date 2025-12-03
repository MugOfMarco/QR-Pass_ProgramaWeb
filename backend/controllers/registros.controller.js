// backend/controllers/registros.controller.js

const Registro = require('../models/Registro');
const Alumno = require('../models/Alumno'); // Necesario para la validación de existencia de alumno

// ===============================================
// FUNCIÓN PRINCIPAL: CREAR REGISTRO DE ASISTENCIA
// (Migración de la lógica de app.post('/api/registros'))
// ===============================================

exports.crearRegistro = async (req, res) => {
    try {
        // Los datos vienen del frontend (registro.js)
        const { boleta, puerta, id_tipo_registro, tieneRetardo, sinCredencial } = req.body;

        // 1. Validar que el alumno existe antes de registrar
        // Aunque el frontend lo hace, el backend DEBE asegurar la existencia del ID.
        const alumno = await Alumno.obtenerCompleto(boleta);
        if (!alumno) {
            return res.status(404).json({
                success: false,
                message: 'Alumno no encontrado'
            });
        }

        // 2. Crear registro principal (Llamando al Modelo de Registro)
        const registro = await Registro.crear({
            boleta,
            puerta,
            id_tipo_registro
        });

        // 3. Actualizar contadores si aplica (Llamando al Modelo de Registro)
        // El modelo se encarga de llamar a 'sp_actualizar_contadores_alumno'
        if (tieneRetardo) {
            await Registro.actualizarContadores(boleta, 'retardo', 'incrementar');
        }

        if (sinCredencial) {
            await Registro.actualizarContadores(boleta, 'sin_credencial', 'incrementar');
        }

        // 4. Respuesta de éxito
        res.json({
            success: true,
            message: 'Registro creado correctamente',
            id_registro: registro.id_registro
        });

    } catch (error) {
        console.error('Error creando registro:', error);
        res.status(500).json({
            success: false,
            message: 'Error creando registro: ' + error.message
        });
    }
};

// ===============================================
// FUNCIONES DE CONSULTA (R)
// ===============================================

// Coincide con la ruta GET /api/registros/alumno/:boleta
exports.obtenerRegistrosPorAlumno = async (req, res) => {
    try {
        const boleta = parseInt(req.params.boleta);
        
        // El controlador valida la existencia del alumno
        const alumno = await Alumno.obtenerCompleto(boleta);
        if (!alumno) {
            return res.status(404).json({ success: false, message: 'Alumno no encontrado' });
        }

        // El modelo trae los registros
        const registros = await Registro.obtenerPorAlumno(boleta);

        res.json({
            success: true,
            boleta,
            registros,
            total: registros.length
        });

    } catch (error) {
        console.error('Error obteniendo registros por alumno:', error);
        res.status(500).json({ success: false, message: 'Error obteniendo registros' });
    }
};

// Coincide con la ruta GET /api/registros/fecha/:fecha
exports.obtenerRegistrosPorFecha = async (req, res) => {
    try {
        const { fecha } = req.params; 
        
        // Lógica: La fecha debe ser validada aquí.
        // const registros = await Registro.obtenerPorFecha(fecha); // El método debe existir en el Modelo
        
        // Placeholder
        res.json({
            success: true,
            fecha,
            registros: [] 
        });

    } catch (error) {
        console.error('Error obteniendo registros por fecha:', error);
        res.status(500).json({ success: false, message: 'Error obteniendo registros por fecha' });
    }
};

// Coincide con la ruta GET /api/registros/estadisticas
exports.obtenerEstadisticas = async (req, res) => {
    try {
        // Lógica: Llamar a un SP que haga COUNT y SUM para las estadísticas del dashboard
        
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
        res.status(500).json({ success: false, message: 'Error obteniendo estadísticas' });
    }
};