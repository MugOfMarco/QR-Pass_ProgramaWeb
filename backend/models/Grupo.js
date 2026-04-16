// backend/models/Grupo.js
// ============================================================
// Operaciones sobre grupos y alumnos por grupo.
// ============================================================
import { supabaseAdmin } from '../database/supabase.js';

class Grupo {

    // ─── Listar todos los grupos con conteo de alumnos ────────
    static async listarConAlumnos() {
        // 1. Grupos + turno
        const { data: grupos, error: eg } = await supabaseAdmin
            .from('grupos')
            .select('id_grupo, nombre_grupo, turnos(nombre_turno)')
            .order('nombre_grupo');
        if (eg) throw eg;

        if (!grupos?.length) return [];

        // 2. Alumnos básicos para cada grupo (en paralelo)
        const idsGrupos = grupos.map(g => g.id_grupo);

        const { data: alumnos, error: ea } = await supabaseAdmin
            .from('alumnos')
            .select(`
                boleta, nombre_completo, puertas_abiertas,
                id_grupo_base,
                estado_academico(estado),
                info_alumno(bloqueado_manual, bloqueado_sistema, contador_retardos, contador_sin_credencial)
            `)
            .in('id_grupo_base', idsGrupos)
            .order('nombre_completo');

        if (ea) throw ea;

        // 3. Agrupar alumnos por grupo
        const alumnosPorGrupo = {};
        for (const a of (alumnos || [])) {
            const gid = a.id_grupo_base;
            if (!alumnosPorGrupo[gid]) alumnosPorGrupo[gid] = [];
            const info = a.info_alumno || {};
            alumnosPorGrupo[gid].push({
                boleta:        a.boleta,
                nombre:        a.nombre_completo,
                estado:        a.estado_academico?.estado || '—',
                puertas:       a.puertas_abiertas,
                bloqueado:     info.bloqueado_manual || info.bloqueado_sistema || false,
                retardos:      info.contador_retardos ?? 0,
                sin_credencial:info.contador_sin_credencial ?? 0,
            });
        }

        return grupos.map(g => ({
            id_grupo:    g.id_grupo,
            nombre:      g.nombre_grupo,
            turno:       g.turnos?.nombre_turno || '—',
            alumnos:     alumnosPorGrupo[g.id_grupo] || [],
            total:       (alumnosPorGrupo[g.id_grupo] || []).length,
        }));
    }

    // ─── Crear grupo ──────────────────────────────────────────
    static async crear(nombre_grupo, id_turno) {
        const { data: existe } = await supabaseAdmin
            .from('grupos')
            .select('id_grupo')
            .ilike('nombre_grupo', nombre_grupo.trim())
            .maybeSingle();
        if (existe) return { success: false, message: `El grupo "${nombre_grupo}" ya existe.` };

        const { data, error } = await supabaseAdmin
            .from('grupos')
            .insert({ nombre_grupo: nombre_grupo.trim(), id_turno: parseInt(id_turno) })
            .select('id_grupo')
            .single();
        if (error) return { success: false, message: error.message };
        return { success: true, id_grupo: data.id_grupo, message: 'Grupo creado correctamente.' };
    }

    // ─── Editar grupo ─────────────────────────────────────────
    static async editar(id_grupo, nombre_grupo, id_turno) {
        const { error } = await supabaseAdmin
            .from('grupos')
            .update({ nombre_grupo: nombre_grupo.trim(), id_turno: parseInt(id_turno) })
            .eq('id_grupo', parseInt(id_grupo));
        if (error) return { success: false, message: error.message };
        return { success: true, message: 'Grupo actualizado correctamente.' };
    }

    // ─── Obtener turnos ───────────────────────────────────────
    static async obtenerTurnos() {
        const { data, error } = await supabaseAdmin
            .from('turnos')
            .select('id_turno, nombre_turno')
            .order('id_turno');
        if (error) throw error;
        return data || [];
    }

    // ─── Acción masiva sobre alumnos ──────────────────────────
    // tipo: 'estado' | 'grupo' | 'bloquear' | 'desbloquear'
    static async accionMasiva(boletas, tipo, valor) {
        if (!boletas?.length) return { success: false, message: 'No hay alumnos seleccionados.' };

        const boletasInt = boletas.map(b => parseInt(b));
        let error;

        if (tipo === 'estado') {
            // valor = id_estado_academico (número)
            ({ error } = await supabaseAdmin
                .from('alumnos')
                .update({ id_estado_academico: parseInt(valor) })
                .in('boleta', boletasInt));

        } else if (tipo === 'grupo') {
            // valor = id_grupo (número)
            ({ error } = await supabaseAdmin
                .from('alumnos')
                .update({ id_grupo_base: parseInt(valor) })
                .in('boleta', boletasInt));

        } else if (tipo === 'bloquear') {
            ({ error } = await supabaseAdmin
                .from('info_alumno')
                .update({ bloqueado_manual: true })
                .in('boleta', boletasInt));

        } else if (tipo === 'desbloquear') {
            ({ error } = await supabaseAdmin
                .from('info_alumno')
                .update({
                    bloqueado_manual: false,
                    bloqueado_sistema: false,
                    contador_sin_credencial: 0,
                })
                .in('boleta', boletasInt));

        } else {
            return { success: false, message: `Tipo de acción desconocido: ${tipo}` };
        }

        if (error) return { success: false, message: error.message };
        return { success: true, message: `Acción "${tipo}" aplicada a ${boletas.length} alumno(s).` };
    }
}

export default Grupo;