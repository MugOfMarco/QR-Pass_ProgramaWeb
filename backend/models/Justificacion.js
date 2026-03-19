import { supabaseAdmin } from '../database/supabase.js';

class Justificacion {

    static async crear(data) {
        const { data: result, error } = await supabaseAdmin
            .from('justificaciones')
            .insert({
                id_registro:        data.id_registro,
                motivo:             data.justificacion,
                id_usuario_autoriza: data.id_usuario_autoriza || null
            })
            .select()
            .single();

        if (error) return null;
        return { id_justificacion: result.id_justificacion, success: true };
    }

    static async obtenerPorAlumno(boleta) {
        const { data, error } = await supabaseAdmin
            .from('justificaciones')
            .select(`
                id_justificacion,
                motivo,
                fecha_justificacion,
                registros_acceso!inner ( boleta, fecha_hora )
            `)
            .eq('registros_acceso.boleta', parseInt(boleta))
            .order('fecha_justificacion', { ascending: false });

        if (error) throw error;
        return data || [];
    }
}

export default Justificacion;