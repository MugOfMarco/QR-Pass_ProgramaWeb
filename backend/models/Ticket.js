// backend/models/Ticket.js
// DAO — todo acceso a tickets_soporte, mensajes_ticket y eventos_ticket
// pasa por aquí. Ningún controller toca supabaseAdmin directamente.
import { supabaseAdmin } from '../database/supabase.js';

const ESTADOS_VALIDOS    = ['abierto', 'en_progreso', 'esperando_usuario', 'resuelto', 'cerrado'];
const PRIORIDADES_VALIDAS = ['urgente', 'alta', 'media', 'baja'];

class Ticket {

    // ─── Crear ticket ─────────────────────────────────────────
    static async crear({ id_usuario, asunto, descripcion, modulo, prioridad = 'media' }) {
        const { data, error } = await supabaseAdmin
            .from('tickets_soporte')
            .insert({
                id_usuario:  parseInt(id_usuario),
                asunto:      asunto.trim().substring(0, 120),
                descripcion: descripcion.trim().substring(0, 2000),
                modulo:      modulo || null,
                prioridad,
                estado:      'abierto',
            })
            .select('id_ticket, fecha_creacion')
            .single();

        if (error) return { success: false, message: error.message };

        await Ticket._registrarEvento(data.id_ticket, id_usuario, 'creado', 'Ticket creado');

        return { success: true, id_ticket: data.id_ticket, fecha_creacion: data.fecha_creacion };
    }

    // ─── Obtener tickets del usuario ──────────────────────────
    static async listarPorUsuario(id_usuario) {
        const { data, error } = await supabaseAdmin
            .from('tickets_soporte')
            .select(`
                id_ticket, asunto, estado, prioridad, modulo,
                fecha_creacion, fecha_actualizacion,
                usuarios_sistema!tickets_soporte_id_agente_fkey ( nombre_completo )
            `)
            .eq('id_usuario', parseInt(id_usuario))
            .order('fecha_creacion', { ascending: false });

        if (error) throw error;
        return (data || []).map(t => ({
            id_ticket:           t.id_ticket,
            asunto:              t.asunto,
            estado:              t.estado,
            prioridad:           t.prioridad,
            modulo:              t.modulo,
            fecha_creacion:      t.fecha_creacion,
            fecha_actualizacion: t.fecha_actualizacion,
            agente:              t.usuarios_sistema?.nombre_completo ?? null,
        }));
    }

    // ─── Obtener detalle de un ticket (con mensajes) ──────────
    static async obtenerDetalle(id_ticket, id_usuario = null) {
        let query = supabaseAdmin
            .from('tickets_soporte')
            .select(`
                id_ticket, asunto, descripcion, estado, prioridad, modulo,
                fecha_creacion, fecha_actualizacion, fecha_cierre,
                id_usuario, id_agente,
                usuarios_sistema!tickets_soporte_id_usuario_fkey ( nombre_completo ),
                agente:usuarios_sistema!tickets_soporte_id_agente_fkey ( nombre_completo )
            `)
            .eq('id_ticket', parseInt(id_ticket));

        if (id_usuario !== null) query = query.eq('id_usuario', parseInt(id_usuario));

        const { data: ticket, error: et } = await query.maybeSingle();
        if (et) throw et;
        if (!ticket) return null;

        const { data: mensajes, error: em } = await supabaseAdmin
            .from('mensajes_ticket')
            .select(`
                id_mensaje, contenido, es_nota_interna, url_evidencia,
                fecha_envio,
                usuarios_sistema ( nombre_completo, roles ( nombre_rol ) )
            `)
            .eq('id_ticket', parseInt(id_ticket))
            .eq('es_nota_interna', false)
            .order('fecha_envio');

        if (em) throw em;

        return {
            id_ticket:           ticket.id_ticket,
            asunto:              ticket.asunto,
            descripcion:         ticket.descripcion,
            estado:              ticket.estado,
            prioridad:           ticket.prioridad,
            modulo:              ticket.modulo,
            fecha_creacion:      ticket.fecha_creacion,
            fecha_actualizacion: ticket.fecha_actualizacion,
            fecha_cierre:        ticket.fecha_cierre,
            id_usuario:          ticket.id_usuario,
            id_agente:           ticket.id_agente,
            solicitante:         ticket.usuarios_sistema?.nombre_completo ?? '—',
            agente:              ticket.agente?.nombre_completo ?? null,
            mensajes: (mensajes || []).map(m => ({
                id_mensaje:    m.id_mensaje,
                contenido:     m.contenido,
                url_evidencia: m.url_evidencia ?? null,
                fecha_envio:   m.fecha_envio,
                autor:         m.usuarios_sistema?.nombre_completo ?? '—',
                rol_autor:     m.usuarios_sistema?.roles?.nombre_rol ?? '—',
            })),
        };
    }

    // ─── Agregar mensaje ──────────────────────────────────────
    static async agregarMensaje({ id_ticket, id_usuario, contenido, es_nota_interna = false, url_evidencia = null }) {
        const payload = {
            id_ticket:       parseInt(id_ticket),
            id_usuario:      parseInt(id_usuario),
            contenido:       contenido.trim().substring(0, 2000),
            es_nota_interna: Boolean(es_nota_interna),
        };
        if (url_evidencia) payload.url_evidencia = url_evidencia;

        const { data, error } = await supabaseAdmin
            .from('mensajes_ticket')
            .insert(payload)
            .select('id_mensaje, fecha_envio')
            .single();

        if (error) return { success: false, message: error.message };

        await supabaseAdmin
            .from('tickets_soporte')
            .update({ fecha_actualizacion: new Date().toISOString() })
            .eq('id_ticket', parseInt(id_ticket));

        return { success: true, id_mensaje: data.id_mensaje, fecha_envio: data.fecha_envio };
    }

    // ─── Listar todos (panel de soporte) ──────────────────────
    static async listarTodos({ estado = null, prioridad = null } = {}) {
        let query = supabaseAdmin
            .from('tickets_soporte')
            .select(`
                id_ticket, asunto, estado, prioridad, modulo,
                fecha_creacion, fecha_actualizacion,
                usuarios_sistema!tickets_soporte_id_usuario_fkey ( nombre_completo ),
                agente:usuarios_sistema!tickets_soporte_id_agente_fkey ( nombre_completo )
            `)
            .order('fecha_creacion', { ascending: false });

        if (estado)    query = query.eq('estado', estado);
        if (prioridad) query = query.eq('prioridad', prioridad);

        const { data, error } = await query;
        if (error) throw error;

        return (data || []).map(t => ({
            id_ticket:           t.id_ticket,
            asunto:              t.asunto,
            estado:              t.estado,
            prioridad:           t.prioridad,
            modulo:              t.modulo,
            fecha_creacion:      t.fecha_creacion,
            fecha_actualizacion: t.fecha_actualizacion,
            solicitante:         t.usuarios_sistema?.nombre_completo ?? '—',
            agente:              t.agente?.nombre_completo ?? null,
        }));
    }

    // ─── Tomar ticket (asignar agente) ────────────────────────
    static async asignar(id_ticket, id_agente) {
        const { error } = await supabaseAdmin
            .from('tickets_soporte')
            .update({
                id_agente: parseInt(id_agente),
                estado:    'en_progreso',
                fecha_actualizacion: new Date().toISOString(),
            })
            .eq('id_ticket', parseInt(id_ticket));

        if (error) return { success: false, message: error.message };

        await Ticket._registrarEvento(id_ticket, id_agente, 'asignado', 'Ticket tomado por agente');
        return { success: true };
    }

    // ─── Cambiar estado ───────────────────────────────────────
    static async cambiarEstado(id_ticket, id_usuario, estado) {
        if (!ESTADOS_VALIDOS.includes(estado)) {
            return { success: false, message: `Estado inválido: ${estado}` };
        }

        const patch = {
            estado,
            fecha_actualizacion: new Date().toISOString(),
        };
        if (estado === 'cerrado' || estado === 'resuelto') {
            patch.fecha_cierre = new Date().toISOString();
        }

        const { error } = await supabaseAdmin
            .from('tickets_soporte')
            .update(patch)
            .eq('id_ticket', parseInt(id_ticket));

        if (error) return { success: false, message: error.message };

        await Ticket._registrarEvento(id_ticket, id_usuario, 'estado_cambiado', `Estado → ${estado}`);
        return { success: true };
    }

    // ─── Cambiar prioridad ────────────────────────────────────
    static async cambiarPrioridad(id_ticket, id_usuario, prioridad) {
        if (!PRIORIDADES_VALIDAS.includes(prioridad)) {
            return { success: false, message: `Prioridad inválida: ${prioridad}` };
        }

        const { error } = await supabaseAdmin
            .from('tickets_soporte')
            .update({ prioridad, fecha_actualizacion: new Date().toISOString() })
            .eq('id_ticket', parseInt(id_ticket));

        if (error) return { success: false, message: error.message };

        await Ticket._registrarEvento(id_ticket, id_usuario, 'prioridad_cambiada', `Prioridad → ${prioridad}`);
        return { success: true };
    }

    // ─── Obtener detalle completo (panel agente) ──────────────
    static async obtenerDetalleAgente(id_ticket) {
        const { data: ticket, error: et } = await supabaseAdmin
            .from('tickets_soporte')
            .select(`
                id_ticket, asunto, descripcion, estado, prioridad, modulo,
                fecha_creacion, fecha_actualizacion, fecha_cierre,
                id_usuario, id_agente,
                usuarios_sistema!tickets_soporte_id_usuario_fkey ( nombre_completo, usuario, roles(nombre_rol) ),
                agente:usuarios_sistema!tickets_soporte_id_agente_fkey ( nombre_completo )
            `)
            .eq('id_ticket', parseInt(id_ticket))
            .maybeSingle();

        if (et) throw et;
        if (!ticket) return null;

        const { data: mensajes } = await supabaseAdmin
            .from('mensajes_ticket')
            .select(`
                id_mensaje, contenido, es_nota_interna, fecha_envio,
                usuarios_sistema ( nombre_completo, roles ( nombre_rol ) )
            `)
            .eq('id_ticket', parseInt(id_ticket))
            .order('fecha_envio');

        const { data: eventos } = await supabaseAdmin
            .from('eventos_ticket')
            .select(`
                id_evento, tipo_evento, descripcion, fecha_evento,
                usuarios_sistema ( nombre_completo )
            `)
            .eq('id_ticket', parseInt(id_ticket))
            .order('fecha_evento', { ascending: false })
            .limit(20);

        return {
            id_ticket:           ticket.id_ticket,
            asunto:              ticket.asunto,
            descripcion:         ticket.descripcion,
            estado:              ticket.estado,
            prioridad:           ticket.prioridad,
            modulo:              ticket.modulo,
            fecha_creacion:      ticket.fecha_creacion,
            fecha_actualizacion: ticket.fecha_actualizacion,
            fecha_cierre:        ticket.fecha_cierre,
            id_usuario:          ticket.id_usuario,
            id_agente:           ticket.id_agente,
            solicitante:         ticket.usuarios_sistema?.nombre_completo ?? '—',
            usuario_sistema:     ticket.usuarios_sistema?.usuario ?? '—',
            rol_solicitante:     ticket.usuarios_sistema?.roles?.nombre_rol ?? '—',
            agente:              ticket.agente?.nombre_completo ?? null,
            mensajes: (mensajes || []).map(m => ({
                id_mensaje:      m.id_mensaje,
                contenido:       m.contenido,
                es_nota_interna: m.es_nota_interna,
                url_evidencia:   m.url_evidencia ?? null,
                fecha_envio:     m.fecha_envio,
                autor:           m.usuarios_sistema?.nombre_completo ?? '—',
                rol_autor:       m.usuarios_sistema?.roles?.nombre_rol ?? '—',
            })),
            eventos: (eventos || []).map(e => ({
                tipo:        e.tipo_evento,
                descripcion: e.descripcion,
                fecha:       e.fecha_evento,
                autor:       e.usuarios_sistema?.nombre_completo ?? '—',
            })),
        };
    }

    // ─── Eliminar ticket ──────────────────────────────────────
    static async eliminar(id_ticket) {
        const { error } = await supabaseAdmin
            .from('tickets_soporte')
            .delete()
            .eq('id_ticket', parseInt(id_ticket));
        if (error) return { success: false, message: error.message };
        return { success: true };
    }

    // ─── Métricas de soporte ──────────────────────────────────
    static async obtenerMetricas() {
        const { data, error } = await supabaseAdmin
            .from('tickets_soporte')
            .select('estado, prioridad, fecha_creacion, fecha_cierre');

        if (error) throw error;
        const tickets = data || [];

        return {
            total:           tickets.length,
            abiertos:        tickets.filter(t => t.estado === 'abierto').length,
            en_progreso:     tickets.filter(t => t.estado === 'en_progreso').length,
            esperando:       tickets.filter(t => t.estado === 'esperando_usuario').length,
            resueltos:       tickets.filter(t => t.estado === 'resuelto' || t.estado === 'cerrado').length,
            urgentes:        tickets.filter(t => t.prioridad === 'urgente').length,
        };
    }

    // ─── Evento interno (privado) ─────────────────────────────
    static async _registrarEvento(id_ticket, id_usuario, tipo_evento, descripcion) {
        try {
            await supabaseAdmin.from('eventos_ticket').insert({
                id_ticket:   parseInt(id_ticket),
                id_usuario:  parseInt(id_usuario),
                tipo_evento,
                descripcion,
            });
        } catch { /* eventos son opcionales, no bloquean */ }
    }
}

export default Ticket;
