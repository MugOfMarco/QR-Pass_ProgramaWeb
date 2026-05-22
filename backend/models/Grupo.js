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
            .select('id_grupo, nombre_grupo, id_turno, id_carrera, turnos(nombre_turno)')
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
            id_turno:    g.id_turno,
            id_carrera:  g.id_carrera,
            alumnos:     alumnosPorGrupo[g.id_grupo] || [],
            total:       (alumnosPorGrupo[g.id_grupo] || []).length,
        }));
    }

    // ─── Listar carreras ──────────────────────────────────────
    static async listarCarreras() {
        const { data, error } = await supabaseAdmin
            .from('carreras')
            .select('id_carrera, nombre_carrera, codigo_carrera')
            .order('nombre_carrera');
        if (error) throw error;
        return data || [];
    }

    // ─── Crear grupo ──────────────────────────────────────────
    // id_carrera se fija en 1 (único plantel — la "I" del nombre es constante)
    static async crear(nombre_grupo, id_turno) {
        const { data: existe } = await supabaseAdmin
            .from('grupos')
            .select('id_grupo')
            .ilike('nombre_grupo', nombre_grupo.trim())
            .maybeSingle();
        if (existe) return { success: false, message: `El grupo "${nombre_grupo}" ya existe.` };

        const { data, error } = await supabaseAdmin
            .from('grupos')
            .insert({ nombre_grupo: nombre_grupo.trim(), id_turno: parseInt(id_turno), id_carrera: 1 })
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

    // ─── Horarios: listar por grupo ───────────────────────────
    static async listarHorarios(id_grupo) {
        const { data, error } = await supabaseAdmin
            .from('horarios_grupo')
            .select(`
                id_horario, dia_semana, hora_inicio, hora_fin,
                materias ( id_materia, nombre_materia ),
                semestres ( id_semestre, nombre_semestre )
            `)
            .eq('id_grupo', parseInt(id_grupo))
            .order('dia_semana')
            .order('hora_inicio');
        if (error) throw error;
        return (data || []).map(h => ({
            id_horario:      h.id_horario,
            dia_semana:      h.dia_semana,
            hora_inicio:     h.hora_inicio,
            hora_fin:        h.hora_fin,
            id_materia:      h.materias?.id_materia ?? null,
            nombre_materia:  h.materias?.nombre_materia ?? '—',
            id_semestre:     h.semestres?.id_semestre ?? null,
            nombre_semestre: h.semestres?.nombre_semestre ?? '—',
        }));
    }

    // ─── Horarios: crear ──────────────────────────────────────
    static async crearHorario({ id_grupo, id_materia, id_semestre, dia_semana, hora_inicio, hora_fin }) {
        const { data, error } = await supabaseAdmin
            .from('horarios_grupo')
            .insert({
                id_grupo:    parseInt(id_grupo),
                id_materia:  parseInt(id_materia),
                id_semestre: parseInt(id_semestre),
                dia_semana:  parseInt(dia_semana),
                hora_inicio,
                hora_fin,
            })
            .select('id_horario')
            .single();
        if (error) return { success: false, message: error.message };
        return { success: true, id_horario: data.id_horario };
    }

    // ─── Horarios: editar ─────────────────────────────────────
    static async editarHorario(id_horario, { id_materia, id_semestre, dia_semana, hora_inicio, hora_fin }) {
        const { error } = await supabaseAdmin
            .from('horarios_grupo')
            .update({
                id_materia:  parseInt(id_materia),
                id_semestre: parseInt(id_semestre),
                dia_semana:  parseInt(dia_semana),
                hora_inicio,
                hora_fin,
            })
            .eq('id_horario', parseInt(id_horario));
        if (error) return { success: false, message: error.message };
        return { success: true };
    }

    // ─── Horarios: eliminar ───────────────────────────────────
    static async eliminarHorario(id_horario) {
        const { error } = await supabaseAdmin
            .from('horarios_grupo')
            .delete()
            .eq('id_horario', parseInt(id_horario));
        if (error) return { success: false, message: error.message };
        return { success: true };
    }

    // ─── Catálogo de materias ─────────────────────────────────
    static async listarMaterias() {
        const { data, error } = await supabaseAdmin
            .from('materias')
            .select('id_materia, nombre_materia')
            .order('nombre_materia');
        if (error) throw error;
        return data || [];
    }

    // ─── Catálogo de semestres ────────────────────────────────
    static async listarSemestres() {
        const { data, error } = await supabaseAdmin
            .from('semestres')
            .select('id_semestre, nombre_semestre')
            .order('id_semestre');
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