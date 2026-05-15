// backend/controllers/soporte.controller.js
import Ticket from '../models/Ticket.js';
import sanitizeHtml from 'sanitize-html';

const s = v => typeof v === 'string'
    ? sanitizeHtml(v, { allowedTags: [], allowedAttributes: {} }).trim()
    : v;

const uid = req => req.session?.user?.id;
const rol = req => req.session?.user?.tipo;

// ── POST /api/soporte/tickets ─────────────────────────────────
export const crearTicket = async (req, res) => {
    try {
        const { asunto, descripcion, modulo, prioridad } = req.body;
        if (!asunto?.trim() || !descripcion?.trim()) {
            return res.status(400).json({ success: false, message: 'El asunto y la descripción son obligatorios.' });
        }
        const r = await Ticket.crear({
            id_usuario:  uid(req),
            asunto:      s(asunto),
            descripcion: s(descripcion),
            modulo:      modulo ? s(modulo) : null,
            prioridad:   ['urgente','alta','media','baja'].includes(prioridad) ? prioridad : 'media',
        });
        return r.success ? res.status(201).json(r) : res.status(400).json(r);
    } catch (err) {
        console.error('crearTicket:', err);
        return res.status(500).json({ success: false, message: 'Error al crear el ticket.' });
    }
};

// ── GET /api/soporte/tickets ──────────────────────────────────
export const misTickets = async (req, res) => {
    try {
        const tickets = await Ticket.listarPorUsuario(uid(req));
        return res.json({ success: true, tickets });
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Error al cargar tickets.' });
    }
};

// ── GET /api/soporte/tickets/:id ──────────────────────────────
export const detalleTicket = async (req, res) => {
    try {
        const esAgente = ['Soporte', 'Administrador'].includes(rol(req));
        const ticket   = esAgente
            ? await Ticket.obtenerDetalleAgente(req.params.id)
            : await Ticket.obtenerDetalle(req.params.id, uid(req));

        if (!ticket) return res.status(404).json({ success: false, message: 'Ticket no encontrado.' });
        return res.json({ success: true, ticket });
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Error al cargar el ticket.' });
    }
};

// ── POST /api/soporte/tickets/:id/mensajes ────────────────────
export const responderTicket = async (req, res) => {
    try {
        const { contenido, es_nota_interna } = req.body;
        if (!contenido?.trim()) {
            return res.status(400).json({ success: false, message: 'El mensaje no puede estar vacío.' });
        }
        const esAgente       = ['Soporte', 'Administrador'].includes(rol(req));
        const notaInterna    = esAgente && Boolean(es_nota_interna);

        const r = await Ticket.agregarMensaje({
            id_ticket:       req.params.id,
            id_usuario:      uid(req),
            contenido:       s(contenido),
            es_nota_interna: notaInterna,
        });
        return r.success ? res.status(201).json(r) : res.status(400).json(r);
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Error al enviar el mensaje.' });
    }
};

// ── PATCH /api/soporte/tickets/:id/cerrar ─────────────────────
export const cerrarTicket = async (req, res) => {
    try {
        const r = await Ticket.cambiarEstado(req.params.id, uid(req), 'cerrado');
        return r.success ? res.json(r) : res.status(400).json(r);
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Error al cerrar el ticket.' });
    }
};

// ── GET /api/soporte/panel/tickets ────────────────────────────
export const todosTickets = async (req, res) => {
    try {
        const { estado, prioridad } = req.query;
        const tickets = await Ticket.listarTodos({
            estado:    estado    || null,
            prioridad: prioridad || null,
        });
        return res.json({ success: true, tickets });
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Error al cargar tickets.' });
    }
};

// ── PATCH /api/soporte/panel/tickets/:id/tomar ────────────────
export const tomarTicket = async (req, res) => {
    try {
        const r = await Ticket.asignar(req.params.id, uid(req));
        return r.success ? res.json(r) : res.status(400).json(r);
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Error al tomar el ticket.' });
    }
};

// ── PATCH /api/soporte/panel/tickets/:id/estado ───────────────
export const cambiarEstado = async (req, res) => {
    try {
        const { estado } = req.body;
        if (!estado) return res.status(400).json({ success: false, message: 'Estado requerido.' });
        const r = await Ticket.cambiarEstado(req.params.id, uid(req), estado);
        return r.success ? res.json(r) : res.status(400).json(r);
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Error al cambiar estado.' });
    }
};

// ── PATCH /api/soporte/panel/tickets/:id/prioridad ────────────
export const cambiarPrioridad = async (req, res) => {
    try {
        const { prioridad } = req.body;
        if (!prioridad) return res.status(400).json({ success: false, message: 'Prioridad requerida.' });
        const r = await Ticket.cambiarPrioridad(req.params.id, uid(req), prioridad);
        return r.success ? res.json(r) : res.status(400).json(r);
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Error al cambiar prioridad.' });
    }
};

// ── DELETE /api/soporte/panel/tickets/:id ─────────────────────
export const eliminarTicket = async (req, res) => {
    try {
        const r = await Ticket.eliminar(req.params.id);
        return r.success ? res.json(r) : res.status(400).json(r);
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Error al eliminar el ticket.' });
    }
};

// ── GET /api/soporte/panel/metricas ──────────────────────────
export const metricas = async (req, res) => {
    try {
        const data = await Ticket.obtenerMetricas();
        return res.json({ success: true, metricas: data });
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Error al obtener métricas.' });
    }
};
