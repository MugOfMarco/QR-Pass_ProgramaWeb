// ARCHIVO 1: backend/controllers/registros.controller.js
// ============================================================================================================================
// CAMBIOS VS VERSIÓN ANTERIOR:
//   · Registro.actualizarContadores() ELIMINADO — los triggers de Supabase lo hacen automáticamente
//   · id_tipo_registro: antes 0,1,2,3 — ahora 1,2,3,4 (ajustado en frontend también)
//   · Rol 'Policia' → 'Vigilante' en rutas
//   · id_usuario_vigilante se toma de la sesión automáticamente
// ============================================================================================================================
import Registro from '../models/Registro.js';
import Alumno   from '../models/Alumno.js';
 
// POST /api/registros
export const crearRegistro = async (req, res) => {
    try {
        const { boleta, puerta, id_tipo_registro, sinCredencial } = req.body;
 
        // Validaciones básicas
        if (!boleta || !puerta || !id_tipo_registro) {
            return res.status(400).json({
                success: false,
                message: 'Faltan datos requeridos: boleta, puerta o tipo de registro.'
            });
        }
 
        // Verificar que el alumno existe y no está bloqueado
        const alumno = await Alumno.obtenerBasico(boleta);
        if (!alumno) {
            return res.status(404).json({ success: false, message: 'Alumno no encontrado.' });
        }
 
        if (alumno.bloqueado) {
            return res.status(403).json({ success: false, message: 'Alumno bloqueado. No se puede registrar.' });
        }
 
        // Mapear nombre de puerta al id_punto_acceso en Supabase
        // Los puntos se insertaron en este orden: 1=Norte(Mexico-Tacuba), 2=Sur(Mar-Mediterraneo)
        const mapaPuertas = {
            'mexico-tacuba': 1,
            'mar':           2,
            'mar-mediterraneo': 2
        };
 
        const id_punto_acceso = mapaPuertas[puerta];
        if (!id_punto_acceso) {
            return res.status(400).json({ success: false, message: 'Puerta no reconocida.' });
        }
 
        // El vigilante que está logueado en sesión
        const id_usuario_vigilante = req.session.user?.id || null;
 
        // Crear el registro — los triggers de Supabase actualizan contadores automáticamente:
        //   · tipo 3 (Retardo)              → trg_incrementar_retardo
        //   · tipo 4 (Entrada Sin Credencial) → trg_incrementar_sin_credencial + trg_bloqueo_automatico
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
 
// GET /api/registros/alumno/:boleta
export const obtenerRegistrosPorAlumno = async (req, res) => {
    try {
        const boleta = parseInt(req.params.boleta);
 
        if (isNaN(boleta)) {
            return res.status(400).json({ success: false, message: 'Boleta inválida.' });
        }
 
        const registros = await Registro.obtenerDelDia(null);
 
        return res.json({ success: true, boleta, registros, total: registros.length });
 
    } catch (error) {
        console.error('Error obteniendo registros por alumno:', error);
        return res.status(500).json({ success: false, message: 'Error obteniendo registros.' });
    }
};
 
// GET /api/registros/fecha/:fecha
export const obtenerRegistrosPorFecha = async (req, res) => {
    try {
        const { fecha } = req.params;
        const registros = await Registro.obtenerDelDia(null);
 
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
 
 