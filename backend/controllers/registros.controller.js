// backend/controllers/registros.controller.js
// Lógica para crear registros y obtener reportes de asistencia.

import Registro from '../models/Registro.js'; // Importación ESM del Modelo
import Alumno from '../models/Alumno.js'; // Importación ESM para validar existencia


// ===============================================
// FUNCIÓN PRINCIPAL: CREAR REGISTRO DE ASISTENCIA
// ===============================================

const crearRegistro = async (req, res) => {
    try {
        // Los datos vienen del frontend (registro.js)
        const { boleta, puerta, id_tipo_registro, tieneRetardo, sinCredencial } = req.body;

        // 1. Validar que el alumno existe antes de registrar
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

const obtenerRegistrosPorAlumno = async (req, res) => {
    try {
        const boleta = parseInt(req.params.boleta);
        
        const alumno = await Alumno.obtenerCompleto(boleta);
        if (!alumno) {
            return res.status(404).json({ success: false, message: 'Alumno no encontrado' });
        }

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

const obtenerRegistrosPorFecha = async (req, res) => {
    try {
        const { fecha } = req.params; 
        
        // **PENDIENTE** Aquí se llamaría a un método del Modelo: Registro.obtenerPorFecha(fecha);
        
        res.json({
            success: true,
            fecha,
            registros: [] // Placeholder
        });

    } catch (error) {
        console.error('Error obteniendo registros por fecha:', error);
        res.status(500).json({ success: false, message: 'Error obteniendo registros por fecha' });
    }
};

const obtenerEstadisticas = async (req, res) => {
    try {
        // **PENDIENTE** Aquí se llamaría a un método del Modelo para obtener estadísticas.
        
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

// ===============================================
// EXPORTACIÓN FINAL (ESM)
// ===============================================

export {
    crearRegistro,
    obtenerRegistrosPorAlumno,
    obtenerRegistrosPorFecha,
    obtenerEstadisticas
};