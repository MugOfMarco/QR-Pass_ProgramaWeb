// backend/models/DiasInhabiles.js
// DAO — todo acceso a dias_inhabiles pasa por aquí.
import { supabaseAdmin } from '../database/supabase.js';

class DiasInhabiles {

    // ── Listar ─────────────────────────────────────────────────
    static async listar({ ciclo = null, anio = null } = {}) {
        let q = supabaseAdmin
            .from('dias_inhabiles')
            .select('id_inhabil, fecha, descripcion, tipo, ciclo_escolar')
            .order('fecha');

        if (ciclo) q = q.eq('ciclo_escolar', ciclo);
        if (anio)  q = q.gte('fecha', `${anio}-01-01`).lte('fecha', `${anio}-12-31`);

        const { data, error } = await q;
        if (error) throw error;
        return data || [];
    }

    // ── Crear un día ───────────────────────────────────────────
    static async crear({ fecha, descripcion, tipo = 'festivo', ciclo_escolar = null }) {
        const { data, error } = await supabaseAdmin
            .from('dias_inhabiles')
            .insert({
                fecha,
                descripcion: descripcion.trim().substring(0, 100),
                tipo,
                ciclo_escolar: ciclo_escolar || null,
            })
            .select('*')
            .single();

        if (error) return { success: false, message: error.message };
        return { success: true, dia: data };
    }

    // ── Eliminar un día ────────────────────────────────────────
    static async eliminar(id_inhabil) {
        const { error } = await supabaseAdmin
            .from('dias_inhabiles')
            .delete()
            .eq('id_inhabil', parseInt(id_inhabil));

        if (error) return { success: false, message: error.message };
        return { success: true };
    }

    // ── Reiniciar ciclo escolar ────────────────────────────────
    // Borra todos los registros del ciclo y re-inserta los días base.
    static async reiniciarCiclo(ciclo_escolar, diasBase = []) {
        // 1. Borrar registros del ciclo
        const { error: delErr } = await supabaseAdmin
            .from('dias_inhabiles')
            .delete()
            .eq('ciclo_escolar', ciclo_escolar);

        if (delErr) return { success: false, message: delErr.message };
        if (!diasBase.length) return { success: true, insertados: 0 };

        // 2. Insertar nuevos festivos base
        const payload = diasBase.map(d => ({ ...d, ciclo_escolar }));
        const { data, error: insErr } = await supabaseAdmin
            .from('dias_inhabiles')
            .insert(payload)
            .select('id_inhabil');

        if (insErr) return { success: false, message: insErr.message };
        return { success: true, insertados: data?.length ?? 0 };
    }

    // ── Verificar si una fecha es inhábil ──────────────────────
    // Usado por la lógica de faltas automáticas.
    static async esDiaInhabil(fecha) {
        const { data } = await supabaseAdmin
            .from('dias_inhabiles')
            .select('id_inhabil')
            .eq('fecha', fecha)
            .maybeSingle();
        return !!data;
    }

    // ── Obtener ciclos distintos ───────────────────────────────
    static async listarCiclos() {
        const { data, error } = await supabaseAdmin
            .from('dias_inhabiles')
            .select('ciclo_escolar')
            .not('ciclo_escolar', 'is', null)
            .order('ciclo_escolar', { ascending: false });

        if (error) throw error;
        const uniq = [...new Set((data || []).map(r => r.ciclo_escolar))];
        return uniq;
    }
}

export default DiasInhabiles;
