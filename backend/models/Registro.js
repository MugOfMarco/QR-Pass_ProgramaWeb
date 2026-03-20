// backend/models/Registro.js
// ============================================================
// Modelo para registros_acceso
// IMPORTANTE: export default (ESM) — no module.exports
// ============================================================
import { supabaseAdmin } from '../database/supabase.js';

class Registro {

    // ─────────────────────────────────────────────────────────
    // Crear un nuevo registro de acceso
    // Devuelve { success, id_registro, fecha_hora } o { success: false, message }
    // ─────────────────────────────────────────────────────────
    static async crear({ boleta, id_punto_acceso, id_tipo_registro, id_usuario_vigilante }) {
        const { data, error } = await supabaseAdmin
            .from('registros_acceso')
            .insert({
                boleta:              parseInt(boleta),
                id_punto_acceso,
                id_tipo_registro,
                id_usuario_vigilante: id_usuario_vigilante || null,
            })
            .select('id_registro, fecha_hora')
            .single();

        if (error) {
            console.error('Error creando registro:', error.message);
            return { success: false, message: error.message };
        }

        return {
            success:     true,
            id_registro: data.id_registro,
            fecha_hora:  data.fecha_hora,
        };
    }

    // ─────────────────────────────────────────────────────────
    // Obtener todos los registros de un alumno
    // ─────────────────────────────────────────────────────────
    static async obtenerPorAlumno(boleta) {
        const { data, error } = await supabaseAdmin
            .from('registros_acceso')
            .select(`
                id_registro,
                fecha_hora,
                id_tipo_registro,
                tipos_registro ( descripcion ),
                puntos_acceso  ( nombre_punto ),
                justificaciones ( motivo )
            `)
            .eq('boleta', parseInt(boleta))
            .order('fecha_hora', { ascending: false });

        if (error) throw error;

        return (data || []).map(r => ({
            id_registro:   r.id_registro,
            fecha_hora:    r.fecha_hora,
            id_tipo_registro: r.id_tipo_registro,
            tipo:          r.tipos_registro?.descripcion,
            punto_acceso:  r.puntos_acceso?.nombre_punto,
            justificacion: r.justificaciones?.motivo || null,
        }));
    }

    // ─────────────────────────────────────────────────────────
    // Obtener todos los registros de un día específico
    // Si fecha es null → usa el día de hoy
    // fecha formato: 'YYYY-MM-DD'
    // ─────────────────────────────────────────────────────────
    static async obtenerDelDia(fecha) {
        let diaStr;

        if (fecha) {
            diaStr = fecha;
        } else {
            const hoy = new Date();
            diaStr = hoy.toISOString().split('T')[0];
        }

        const inicio = `${diaStr}T00:00:00`;
        const fin    = `${diaStr}T23:59:59`;

        const { data, error } = await supabaseAdmin
            .from('registros_acceso')
            .select(`
                id_registro,
                boleta,
                fecha_hora,
                id_tipo_registro,
                tipos_registro ( descripcion ),
                puntos_acceso  ( nombre_punto ),
                alumnos        ( nombre_completo )
            `)
            .gte('fecha_hora', inicio)
            .lte('fecha_hora', fin)
            .order('fecha_hora', { ascending: false });

        if (error) throw error;

        return (data || []).map(r => ({
            id_registro:      r.id_registro,
            boleta:           r.boleta,
            fecha_hora:       r.fecha_hora,
            id_tipo_registro: r.id_tipo_registro,
            tipo:             r.tipos_registro?.descripcion,
            punto_acceso:     r.puntos_acceso?.nombre_punto,
            nombre_alumno:    r.alumnos?.nombre_completo,
        }));
    }

    // ─────────────────────────────────────────────────────────
    // Obtener registros en un rango de fechas (para reportes)
    // ─────────────────────────────────────────────────────────
    static async obtenerPorRango(fechaInicio, fechaFin, boleta = null) {
        let query = supabaseAdmin
            .from('registros_acceso')
            .select(`
                id_registro,
                boleta,
                fecha_hora,
                id_tipo_registro,
                tipos_registro ( descripcion ),
                puntos_acceso  ( nombre_punto ),
                alumnos        ( nombre_completo )
            `)
            .gte('fecha_hora', `${fechaInicio}T00:00:00`)
            .lte('fecha_hora', `${fechaFin}T23:59:59`)
            .order('fecha_hora', { ascending: false });

        if (boleta) query = query.eq('boleta', parseInt(boleta));

        const { data, error } = await query;
        if (error) throw error;

        return (data || []).map(r => ({
            id_registro:      r.id_registro,
            boleta:           r.boleta,
            fecha_hora:       r.fecha_hora,
            id_tipo_registro: r.id_tipo_registro,
            tipo:             r.tipos_registro?.descripcion,
            punto_acceso:     r.puntos_acceso?.nombre_punto,
            nombre_alumno:    r.alumnos?.nombre_completo,
        }));
    }
}

export default Registro;