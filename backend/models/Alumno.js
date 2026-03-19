import { supabase, supabaseAdmin } from '../database/supabase.js';

class Alumno {

    static async obtenerBasico(boleta) {
        const { data, error } = await supabaseAdmin
            .from('alumnos')
            .select(`
                boleta,
                nombre_completo,
                puertas_abiertas,
                id_grupo_base,
                grupos ( nombre_grupo, carreras ( nombre_carrera ) ),
                estado_academico ( estado ),
                info_alumno (
                    url_foto,
                    contador_retardos,
                    contador_sin_credencial,
                    bloqueado_manual,
                    bloqueado_sistema
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
            retardos:         info.contador_retardos,
            sin_credencial:   info.contador_sin_credencial,
            url:              info.url_foto
        };
    }

    static async buscar(query) {
        const { data, error } = await supabaseAdmin
            .from('alumnos')
            .select(`
                boleta,
                nombre_completo,
                grupos ( nombre_grupo ),
                estado_academico ( estado )
            `)
            .or(`nombre_completo.ilike.%${query}%,boleta.eq.${parseInt(query) || 0}`)
            .limit(20);

        if (error) throw error;
        return (data || []).map(a => ({
            boleta:       a.boleta,
            nombre:       a.nombre_completo,
            nombre_grupo: a.grupos?.nombre_grupo,
            estado:       a.estado_academico?.estado
        }));
    }

    static async verificarBloqueo(boleta) {
        const { data, error } = await supabaseAdmin
            .from('info_alumno')
            .select('bloqueado_manual, bloqueado_sistema')
            .eq('boleta', parseInt(boleta))
            .single();

        if (error || !data) return false;
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

    static async desbloquearCredencial(boleta) {
        const { error } = await supabaseAdmin
            .from('info_alumno')
            .update({ bloqueado_manual: false, bloqueado_sistema: false })
            .eq('boleta', parseInt(boleta));

        if (error) return { success: false, message: error.message };
        return { success: true, message: 'Alumno desbloqueado correctamente.' };
    }

    static async obtenerRegistros(boleta) {
        const { data, error } = await supabaseAdmin
            .from('registros_acceso')
            .select(`
                id_registro,
                fecha_hora,
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
            justificacion: r.justificaciones?.motivo || null
        }));
    }

    static async registrarJustificacion(id_registro, justificacion, id_usuario_autoriza) {
        const { data, error } = await supabaseAdmin
            .from('justificaciones')
            .insert({
                id_registro,
                motivo: justificacion,
                id_usuario_autoriza
            })
            .select()
            .single();

        if (error) throw error;
        return { success: true, id_justificacion: data.id_justificacion };
    }

    static async registrar(alumnoData) {
        const { boleta, nombre, id_grupo_base, id_estado_academico, url } = alumnoData;

        const { error: errorAlumno } = await supabaseAdmin
            .from('alumnos')
            .insert({
                boleta:              parseInt(boleta),
                nombre_completo:     nombre,
                id_grupo_base:       parseInt(id_grupo_base),
                id_estado_academico: parseInt(id_estado_academico)
            });

        if (errorAlumno) return { success: false, message: errorAlumno.message };

        const { error: errorInfo } = await supabaseAdmin
            .from('info_alumno')
            .insert({
                boleta:    parseInt(boleta),
                url_foto:  url || 'https://res.cloudinary.com/depoh32sv/image/upload/v1765415709/vector-de-perfil-avatar-predeterminado-foto-usuario-medios-sociales-icono-183042379.jpg_jfpw3y.webp'
            });

        if (errorInfo) return { success: false, message: errorInfo.message };
        return { success: true, message: 'Alumno registrado correctamente.' };
    }

    static async modificar(boleta, alumnoData) {
        const { nombre, id_grupo_base, id_estado_academico, puertas_abiertas, url } = alumnoData;

        const { error: errorAlumno } = await supabaseAdmin
            .from('alumnos')
            .update({
                nombre_completo:     nombre,
                id_grupo_base:       parseInt(id_grupo_base),
                id_estado_academico: parseInt(id_estado_academico),
                puertas_abiertas:    puertas_abiertas || false
            })
            .eq('boleta', parseInt(boleta));

        if (errorAlumno) return { success: false, message: errorAlumno.message };

        if (url) {
            await supabaseAdmin
                .from('info_alumno')
                .update({ url_foto: url })
                .eq('boleta', parseInt(boleta));
        }

        return { success: true, message: 'Alumno modificado correctamente.' };
    }

    static async obtenerGrupos() {
        const { data, error } = await supabaseAdmin
            .from('grupos')
            .select('id_grupo, nombre_grupo')
            .order('nombre_grupo');

        if (error) throw error;
        return data || [];
    }

    static async obtenerEstadosAcademicos() {
        const { data, error } = await supabaseAdmin
            .from('estado_academico')
            .select('id_estado, estado')
            .order('estado');

        if (error) throw error;
        return data || [];
    }

    static async obtenerCarreras() {
        const { data, error } = await supabaseAdmin
            .from('carreras')
            .select('id_carrera, nombre_carrera')
            .order('nombre_carrera');

        if (error) throw error;
        return data || [];
    }
}

export default Alumno;