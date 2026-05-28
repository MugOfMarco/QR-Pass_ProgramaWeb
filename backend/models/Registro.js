// backend/models/Registro.js
// ============================================================
// Modelo para registros_acceso
// FIX: normalizamos el nombre del punto de acceso para que
//      siempre muestre "México-Tacuba" o "Mar-Mediterráneo"
//      independientemente de cómo esté guardado en BD.
// ============================================================
import { supabaseAdmin } from '../database/supabase.js';

// fecha_hora almacena UTC. México = UTC-6 fijo. MX medianoche = UTC 06:00 mismo día.
const sigDia = s => { const d = new Date(`${s}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + 1); return d.toISOString().slice(0, 10); };

// Normalizar cualquier variante del nombre de puerta al nombre oficial
function normalizarPuerta(nombre) {
    if (!nombre) return '—';
    const n = String(nombre).toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (n.includes('mexico') || n.includes('tacuba') || n.includes('norte') || n === '1') {
        return 'México-Tacuba';
    }
    if (n.includes('mar') || n.includes('mediterraneo') || n.includes('sur') || n === '2') {
        return 'Mar-Mediterráneo';
    }
    return nombre; // devolver original si no coincide
}

class Registro {

    // ─────────────────────────────────────────────────────────
    // Crear un nuevo registro de acceso
    // ─────────────────────────────────────────────────────────
    static async crear({ boleta, id_punto_acceso, id_tipo_registro, id_usuario_vigilante, observaciones = null }) {
        const payload = {
            boleta:              parseInt(boleta),
            id_punto_acceso:     id_punto_acceso ?? null,
            id_tipo_registro,
            id_usuario_vigilante: id_usuario_vigilante || null,
        };
        if (observaciones) payload.observaciones = observaciones;

        const { data, error } = await supabaseAdmin
            .from('registros_acceso')
            .insert(payload)
            .select('id_registro, fecha_hora')
            .single();

        if (error) {
            console.error('Error creando registro en BD:', {
                code:    error.code,
                message: error.message,
                details: error.details,
                hint:    error.hint,
            });
            // Dar mensaje claro según el tipo de error
            let msg = error.message || 'Error al guardar el registro.';
            if (error.code === '23503') msg = `Error de FK en registros_acceso: ${error.details || error.message}`;
            if (error.code === '23502') msg = `Campo requerido vacío: ${error.details || error.message}`;
            if (error.code === '23514') msg = `Restricción CHECK violada: ${error.details || error.message}`;
            return { success: false, message: msg };
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
            id_registro:      r.id_registro,
            fecha_hora:       r.fecha_hora,
            id_tipo_registro: r.id_tipo_registro,
            tipo:             r.tipos_registro?.descripcion,
            punto_acceso:     normalizarPuerta(r.puntos_acceso?.nombre_punto),
            justificacion:    r.justificaciones?.motivo || null,
        }));
    }

    // ─────────────────────────────────────────────────────────
    // Obtener todos los registros de un día específico
    // ─────────────────────────────────────────────────────────
    static async obtenerDelDia(fecha) {
        let diaStr;

        if (fecha) {
            diaStr = fecha;
        } else {
            // Mexico City usa UTC-6 permanentemente desde noviembre 2022
            diaStr = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Mexico_City' });
        }

        const inicio = `${diaStr}T06:00:00`;
        const fin    = `${sigDia(diaStr)}T05:59:59`;

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
            punto_acceso:     normalizarPuerta(r.puntos_acceso?.nombre_punto),
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
            .gte('fecha_hora', `${fechaInicio}T06:00:00`)
            .lte('fecha_hora', `${sigDia(fechaFin)}T05:59:59`)
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
            punto_acceso:     normalizarPuerta(r.puntos_acceso?.nombre_punto),
            nombre_alumno:    r.alumnos?.nombre_completo,
        }));
    }
}

export default Registro;