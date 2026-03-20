// backend/models/Alumno.js
// ─────────────────────────────────────────────────────────────
// CORRECCIÓN PRINCIPAL:
//   desbloquearCredencial() ahora resetea contador_sin_credencial = 0
//   para que el trigger fn_bloqueo_automatico no vuelva a bloquear
//   de inmediato al hacer el UPDATE.
// ─────────────────────────────────────────────────────────────
import { supabaseAdmin } from '../database/supabase.js';

class Alumno {

    static async _resolverGrupo(raw) {
        if (!raw) return null;
        const n = parseInt(raw);
        if (!isNaN(n) && String(n) === String(raw)) return n;
        const { data } = await supabaseAdmin
            .from('grupos').select('id_grupo')
            .ilike('nombre_grupo', String(raw).trim()).maybeSingle();
        return data?.id_grupo ?? null;
    }

    static async _resolverEstado(raw) {
        if (!raw) return null;
        const n = parseInt(raw);
        if (!isNaN(n) && String(n) === String(raw)) return n;
        const { data } = await supabaseAdmin
            .from('estado_academico').select('id_estado, estado');
        const match = (data || []).find(
            e => e.estado.toLowerCase() === String(raw).trim().toLowerCase()
        );
        return match?.id_estado ?? null;
    }

    // ─── Datos básicos ────────────────────────────────────────
    static async obtenerBasico(boleta) {
        const { data, error } = await supabaseAdmin
            .from('alumnos')
            .select(`
                boleta, nombre_completo, puertas_abiertas, id_grupo_base,
                grupos ( nombre_grupo, carreras ( nombre_carrera ) ),
                estado_academico ( estado ),
                info_alumno (
                    url_foto, contador_retardos, contador_sin_credencial,
                    bloqueado_manual, bloqueado_sistema
                )
            `)
            .eq('boleta', parseInt(boleta))
            .single();

        if (error || !data) return null;
        const info = data.info_alumno || {};
        return {
            boleta:           data.boleta,
            nombre:           data.nombre_completo,
            nombre_grupo:     data.grupos?.nombre_grupo,
            carrera:          data.grupos?.carreras?.nombre_carrera,
            estado_academico: data.estado_academico?.estado,
            puerta_abierta:   data.puertas_abiertas,
            bloqueado:        info.bloqueado_manual || info.bloqueado_sistema,
            retardos:         info.contador_retardos       ?? 0,
            sin_credencial:   info.contador_sin_credencial ?? 0,
            url:              info.url_foto,
        };
    }

    // ─── Búsqueda ─────────────────────────────────────────────
    static async buscar(query) {
        const { data, error } = await supabaseAdmin
            .from('alumnos')
            .select(`boleta, nombre_completo, grupos(nombre_grupo), estado_academico(estado)`)
            .or(`nombre_completo.ilike.%${query}%,boleta.eq.${parseInt(query) || 0}`)
            .limit(20);
        if (error) throw error;
        return (data || []).map(a => ({
            boleta:       a.boleta,
            nombre:       a.nombre_completo,
            nombre_grupo: a.grupos?.nombre_grupo,
            estado:       a.estado_academico?.estado,
        }));
    }

    // ─── Bloqueo ──────────────────────────────────────────────
    static async verificarBloqueo(boleta) {
        const { data } = await supabaseAdmin
            .from('info_alumno')
            .select('bloqueado_manual, bloqueado_sistema')
            .eq('boleta', parseInt(boleta)).single();
        if (!data) return false;
        return data.bloqueado_manual || data.bloqueado_sistema;
    }

    static async bloquearCredencial(boleta) {
        const { error } = await supabaseAdmin
            .from('info_alumno')
            .update({ bloqueado_manual: true })
            .eq('boleta', parseInt(boleta));
        if (error) return { success: false, message: error.message };
        return { success: true, message: 'Alumno bloqueado correctamente.' };
    }

    // ─────────────────────────────────────────────────────────
    // desbloquearCredencial — CORRECCIÓN
    // ─────────────────────────────────────────────────────────
    // El trigger fn_bloqueo_automatico_credencial evalúa:
    //   IF NEW.contador_sin_credencial >= max_olvidos THEN bloqueado_sistema = TRUE
    //
    // Si solo reseteamos los flags de bloqueo pero dejamos el contador en 3,
    // el trigger se dispara en el primer UPDATE posterior y vuelve a bloquear.
    //
    // Solución: resetear el contador al mismo tiempo que los flags.
    // Esto hace un solo UPDATE, el trigger ve contador=0 >= 3 → FALSE, no bloquea.
    // ─────────────────────────────────────────────────────────
    static async desbloquearCredencial(boleta) {
        const { error } = await supabaseAdmin
            .from('info_alumno')
            .update({
                bloqueado_manual:        false,
                bloqueado_sistema:       false,
                contador_sin_credencial: 0,     // ← reset para que el trigger no reactive
            })
            .eq('boleta', parseInt(boleta));

        if (error) return { success: false, message: error.message };
        return {
            success: true,
            message: 'Alumno desbloqueado. Contador de sin credencial reseteado a 0.',
        };
    }

    // ─── Historial ────────────────────────────────────────────
    static async obtenerRegistros(boleta) {
        const { data, error } = await supabaseAdmin
            .from('registros_acceso')
            .select(`
                id_registro, fecha_hora,
                tipos_registro ( descripcion ),
                puntos_acceso ( nombre_punto ),
                justificaciones ( motivo )
            `)
            .eq('boleta', parseInt(boleta))
            .order('fecha_hora', { ascending: false });
        if (error) throw error;
        return (data || []).map(r => ({
            id_registro:   r.id_registro,
            fecha_hora:    r.fecha_hora,
            tipo:          r.tipos_registro?.descripcion,
            punto_acceso:  r.puntos_acceso?.nombre_punto,
            justificacion: r.justificaciones?.motivo || null,
        }));
    }

    // ─── Justificaciones ──────────────────────────────────────
    static async registrarJustificacion(id_registro, justificacion, id_usuario_autoriza) {
        const { data, error } = await supabaseAdmin
            .from('justificaciones')
            .insert({ id_registro, motivo: justificacion, id_usuario_autoriza })
            .select().single();
        if (error) throw error;
        return { success: true, id_justificacion: data.id_justificacion };
    }

    // ─── Registrar nuevo alumno ───────────────────────────────
    static async registrar(alumnoData) {
        const { boleta, nombre, id_grupo_base, nombre_grupo,
                id_estado_academico, estado_academico, url } = alumnoData;

        const idGrupo = await Alumno._resolverGrupo(id_grupo_base || nombre_grupo);
        if (!idGrupo) return { success: false, message: `Grupo "${id_grupo_base || nombre_grupo}" no encontrado.` };

        const idEstado = await Alumno._resolverEstado(id_estado_academico || estado_academico);
        if (!idEstado) return { success: false, message: 'Estado académico no encontrado.' };

        const { error: e1 } = await supabaseAdmin.from('alumnos').insert({
            boleta: parseInt(boleta), nombre_completo: nombre,
            id_grupo_base: idGrupo, id_estado_academico: idEstado,
        });
        if (e1) return { success: false, message: e1.message };

        const { error: e2 } = await supabaseAdmin.from('info_alumno').insert({
            boleta: parseInt(boleta),
            url_foto: url || 'https://res.cloudinary.com/depoh32sv/image/upload/v1765415709/vector-de-perfil-avatar-predeterminado-foto-usuario-medios-sociales-icono-183042379.jpg_jfpw3y.webp',
        });
        if (e2) return { success: false, message: e2.message };

        return { success: true, message: 'Alumno registrado correctamente.' };
    }

    // ─── Modificar alumno ─────────────────────────────────────
    static async modificar(boleta, alumnoData) {
        const { nombre, id_grupo_base, nombre_grupo, id_estado_academico,
                estado_academico, puertas_abiertas, url, horario } = alumnoData;
        const boletaInt = parseInt(boleta);

        const idGrupo = await Alumno._resolverGrupo(id_grupo_base || nombre_grupo);
        if (!idGrupo) return { success: false, message: 'Grupo no encontrado.' };

        const idEstado = await Alumno._resolverEstado(id_estado_academico || estado_academico);
        if (!idEstado) return { success: false, message: 'Estado académico no encontrado.' };

        const { error: e1 } = await supabaseAdmin.from('alumnos').update({
            nombre_completo: nombre, id_grupo_base: idGrupo,
            id_estado_academico: idEstado, puertas_abiertas: puertas_abiertas || false,
        }).eq('boleta', boletaInt);
        if (e1) return { success: false, message: e1.message };

        if (url) {
            await supabaseAdmin.from('info_alumno')
                .update({ url_foto: url }).eq('boleta', boletaInt);
        }

        if (Array.isArray(horario)) {
            await supabaseAdmin.from('horario_alumno_extra').delete().eq('boleta', boletaInt);

            for (const clase of horario) {
                if (!clase.dia || !clase.inicio || !clase.fin || !clase.materia) continue;
                const { data: mat } = await supabaseAdmin.from('materias')
                    .select('id_materia').ilike('nombre_materia', clase.materia.trim()).maybeSingle();
                if (!mat) continue;
                const { data: sem } = await supabaseAdmin.from('semestres')
                    .select('id_semestre').eq('activo', true).maybeSingle();
                if (!sem) continue;
                const { data: slot } = await supabaseAdmin.from('horario_grupo')
                    .select('id_horario_grupo')
                    .eq('id_grupo', idGrupo).eq('id_materia', mat.id_materia)
                    .eq('id_semestre', sem.id_semestre).eq('dia', clase.dia)
                    .eq('hora_inicio', clase.inicio).eq('hora_fin', clase.fin)
                    .maybeSingle();
                if (!slot) continue;
                await supabaseAdmin.from('horario_alumno_extra').upsert(
                    { boleta: boletaInt, id_horario_grupo: slot.id_horario_grupo,
                      fecha_asignacion: new Date().toISOString().split('T')[0] },
                    { onConflict: 'boleta,id_horario_grupo' }
                );
            }
        }
        return { success: true, message: 'Alumno modificado correctamente.' };
    }

    // ─── Catálogos ────────────────────────────────────────────
    static async obtenerGrupos() {
        const { data, error } = await supabaseAdmin
            .from('grupos').select('id_grupo, nombre_grupo').order('nombre_grupo');
        if (error) throw error;
        return data || [];
    }

    static async obtenerEstadosAcademicos() {
        const { data, error } = await supabaseAdmin
            .from('estado_academico').select('id_estado, estado').order('estado');
        if (error) throw error;
        return data || [];
    }

    static async obtenerCarreras() {
        const { data, error } = await supabaseAdmin
            .from('carreras').select('id_carrera, nombre_carrera').order('nombre_carrera');
        if (error) throw error;
        return data || [];
    }
}

export default Alumno;