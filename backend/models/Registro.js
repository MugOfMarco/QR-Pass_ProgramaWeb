import { supabaseAdmin } from '../database/supabase.js';

class Registro {

    static async crear(data) {
        const { boleta, id_punto_acceso, id_tipo_registro, id_usuario_vigilante } = data;

        const { data: result, error } = await supabaseAdmin
            .from('registros_acceso')
            .insert({
                boleta:              parseInt(boleta),
                id_punto_acceso,
                id_tipo_registro,
                id_usuario_vigilante: id_usuario_vigilante || null
            })
            .select('id_registro, fecha_hora')
            .single();

        if (error) return { success: false, message: error.message };
        return { success: true, id_registro: result.id_registro, fecha_hora: result.fecha_hora };
    }

    static async obtenerDelDia(fecha) {
        const inicio = fecha
            ? new Date(`${fecha}T00:00:00`)
            : new Date(new Date().setHours(0, 0, 0, 0));

        const fin = fecha
            ? new Date(`${fecha}T23:59:59`)
            : new Date(new Date().setHours(23, 59, 59, 999));

        const { data, error } = await supabaseAdmin
            .from('registros_acceso')
            .select(`
                id_registro,
                boleta,
                fecha_hora,
                id_tipo_registro,
                tipos_registro ( descripcion ),
                puntos_acceso ( nombre_punto )
            `)
            .gte('fecha_hora', inicio.toISOString())
            .lte('fecha_hora', fin.toISOString())
            .order('fecha_hora', { ascending: false });

        if (error) throw error;
        return data || [];
    }

    static async obtenerPorAlumno(boleta) {
        const { data, error } = await supabaseAdmin
            .from('registros_acceso')
            .select(`
                id_registro,
                fecha_hora,
                id_tipo_registro,
                tipos_registro ( descripcion ),
                puntos_acceso ( nombre_punto )
            `)
            .eq('boleta', parseInt(boleta))
            .order('fecha_hora', { ascending: false });

        if (error) throw error;
        return data || [];
    }
}

export default Registro;