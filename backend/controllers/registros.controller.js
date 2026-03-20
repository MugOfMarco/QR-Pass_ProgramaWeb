// ============================================================
// backend/controllers/registros.controller.js
// ============================================================
import Registro from '../models/Registro.js';
import Alumno   from '../models/Alumno.js';

// POST /api/registros
export const crearRegistro = async (req, res) => {
    try {
        const { boleta, puerta, id_tipo_registro, sinCredencial } = req.body;

        if (!boleta || !puerta || !id_tipo_registro) {
            return res.status(400).json({
                success: false,
                message: 'Faltan datos requeridos: boleta, puerta o tipo de registro.'
            });
        }

        const alumno = await Alumno.obtenerBasico(boleta);
        if (!alumno) {
            return res.status(404).json({ success: false, message: 'Alumno no encontrado.' });
        }
        if (alumno.bloqueado) {
            return res.status(403).json({ success: false, message: 'Alumno bloqueado. No se puede registrar.' });
        }

        const mapaPuertas = {
            'mexico-tacuba':    1,
            'mar':              2,
            'mar-mediterraneo': 2
        };

        const id_punto_acceso = mapaPuertas[puerta];
        if (!id_punto_acceso) {
            return res.status(400).json({ success: false, message: 'Puerta no reconocida.' });
        }

        const id_usuario_vigilante = req.session.user?.id || null;

        const registro = await Registro.crear({
            boleta,
            id_punto_acceso,
            id_tipo_registro: parseInt(id_tipo_registro),
            id_usuario_vigilante
        });

        if (!registro.success) {
            return res.status(500).json({ success: false, message: registro.message });
        }

        return res.json({
            success:     true,
            message:     'Registro creado correctamente.',
            id_registro: registro.id_registro,
            fecha_hora:  registro.fecha_hora
        });

    } catch (error) {
        console.error('Error creando registro:', error);
        return res.status(500).json({ success: false, message: 'Error interno al crear el registro.' });
    }
};

// GET /api/registros/alumno/:boleta  — historial real del alumno
export const obtenerRegistrosPorAlumno = async (req, res) => {
    try {
        const boleta = parseInt(req.params.boleta);
        if (isNaN(boleta)) {
            return res.status(400).json({ success: false, message: 'Boleta inválida.' });
        }

        const registros = await Registro.obtenerPorAlumno(boleta);
        return res.json({ success: true, boleta, registros, total: registros.length });

    } catch (error) {
        console.error('Error obteniendo registros por alumno:', error);
        return res.status(500).json({ success: false, message: 'Error obteniendo registros.' });
    }
};

// GET /api/registros/fecha/:fecha  — registros del día indicado (YYYY-MM-DD)
export const obtenerRegistrosPorFecha = async (req, res) => {
    try {
        const { fecha } = req.params;

        // Validación básica del formato
        if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
            return res.status(400).json({ success: false, message: 'Formato de fecha inválido. Use YYYY-MM-DD.' });
        }

        const registros = await Registro.obtenerDelDia(fecha);
        return res.json({ success: true, fecha, registros, total: registros.length });

    } catch (error) {
        console.error('Error obteniendo registros por fecha:', error);
        return res.status(500).json({ success: false, message: 'Error obteniendo registros por fecha.' });
    }
};

// GET /api/registros/estadisticas
export const obtenerEstadisticas = async (req, res) => {
    try {
        const registrosHoy = await Registro.obtenerDelDia(null);

        const stats = {
            totalRegistrosHoy: registrosHoy.length,
            entradas:          registrosHoy.filter(r => r.id_tipo_registro === 1).length,
            salidas:           registrosHoy.filter(r => r.id_tipo_registro === 2).length,
            retardos:          registrosHoy.filter(r => r.id_tipo_registro === 3).length,
            sinCredencial:     registrosHoy.filter(r => r.id_tipo_registro === 4).length
        };

        return res.json({ success: true, estadisticas: stats });

    } catch (error) {
        console.error('Error obteniendo estadísticas:', error);
        return res.status(500).json({ success: false, message: 'Error obteniendo estadísticas.' });
    }
};