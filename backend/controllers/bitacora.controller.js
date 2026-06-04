// backend/controllers/bitacora.controller.js
// Dos endpoints de solo lectura para la pantalla "Historial y Bitácora":
//   GET /api/bitacora/accesos   — registros_acceso con filtros multi-fecha/vigilante
//   GET /api/bitacora/acciones  — bitacora_auditoria (acciones admin)
//   GET /api/bitacora/catalogos — datos para poblar los <select> de filtros
import sanitizeHtml from 'sanitize-html';
import { supabaseAdmin } from '../database/supabase.js';

const s   = v => (typeof v === 'string' ? sanitizeHtml(v, { allowedTags: [], allowedAttributes: {} }).trim() : v);
const int = v => { const n = parseInt(v); return isNaN(n) ? null : n; };

const LIMITE_MAX  = 100;
const LIMITE_DEF  = 50;

// Avanza un día calendario (para definir fin de rango)
const siguienteDia = fecha => {
    const d = new Date(`${fecha}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + 1);
    return d.toISOString().slice(0, 10);
};

// Valida formato YYYY-MM-DD
const esFormatoFecha = s => /^\d{4}-\d{2}-\d{2}$/.test(s);

// Calcula la fecha de hace N días (timezone México)
function hace7Dias() {
    const d = new Date(new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Mexico_City' }));
    d.setDate(d.getDate() - 6);
    return d.toISOString().slice(0, 10);
}
function hoy() {
    return new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Mexico_City' });
}

// ── GET /api/bitacora/accesos ─────────────────────────────────
// Registros de entrada/salida de todos los alumnos con filtros.
// Query params: fecha_inicio, fecha_fin, id_vigilante, id_tipo, q, page, limit
export const getAccesos = async (req, res) => {
    try {
        const fechaInicio = esFormatoFecha(req.query.fecha_inicio) ? req.query.fecha_inicio : hace7Dias();
        const fechaFin    = esFormatoFecha(req.query.fecha_fin)    ? req.query.fecha_fin    : hoy();
        const idVigilante = int(req.query.id_vigilante);
        const idTipo      = int(req.query.id_tipo);
        const q           = s(req.query.q || '');
        const page        = Math.max(1, int(req.query.page) || 1);
        const limit       = Math.min(LIMITE_MAX, Math.max(1, int(req.query.limit) || LIMITE_DEF));
        const offset      = (page - 1) * limit;

        const desde = `${fechaInicio}T00:00:00`;
        const hasta  = `${siguienteDia(fechaFin)}T00:00:00`;

        let query = supabaseAdmin
            .from('registros_acceso')
            .select(`
                id_registro, fecha_hora, boleta, observaciones,
                tipos_registro ( descripcion ),
                puntos_acceso  ( nombre_punto ),
                justificaciones ( motivo ),
                usuarios_sistema:id_usuario_vigilante ( id_usuario, nombre_completo )
            `, { count: 'exact' })
            .gte('fecha_hora', desde)
            .lt('fecha_hora', hasta)
            .order('fecha_hora', { ascending: false })
            .range(offset, offset + limit - 1);

        if (idVigilante) query = query.eq('id_usuario_vigilante', idVigilante);
        if (idTipo)      query = query.eq('id_tipo_registro', idTipo);

        const { data, error, count } = await query;
        if (error) throw error;

        // Si hay búsqueda por alumno, necesita filtrado post-consulta con nombres.
        // Para evitar doble round-trip, obtenemos boletas del filtro textual.
        let rows = (data || []);

        if (q) {
            const esNumero = /^\d+$/.test(q);
            if (esNumero) {
                // Filtrar inline por boleta parcial
                rows = rows.filter(r => String(r.boleta).includes(q));
            } else {
                // Necesitamos nombres — hacemos join manual vía batch
                const boletas = [...new Set(rows.map(r => r.boleta))];
                if (boletas.length) {
                    const { data: alumnos } = await supabaseAdmin
                        .from('alumnos')
                        .select('boleta, nombre_completo')
                        .in('boleta', boletas)
                        .ilike('nombre_completo', `%${q}%`);
                    const boletasMatch = new Set((alumnos || []).map(a => a.boleta));
                    rows = rows.filter(r => boletasMatch.has(r.boleta));
                } else {
                    rows = [];
                }
            }
        }

        // Batch-fetch nombres de alumnos para las boletas presentes
        const boletas = [...new Set(rows.map(r => r.boleta))];
        let nombreMap = {};
        if (boletas.length) {
            const { data: alumnos } = await supabaseAdmin
                .from('alumnos').select('boleta, nombre_completo').in('boleta', boletas);
            (alumnos || []).forEach(a => { nombreMap[a.boleta] = a.nombre_completo; });
        }

        const resultado = rows.map(r => ({
            id_registro:   r.id_registro,
            fecha_hora:    r.fecha_hora,
            boleta:        r.boleta,
            nombre_alumno: nombreMap[r.boleta] || '—',
            tipo:          r.tipos_registro?.descripcion       || '—',
            puerta:        r.puntos_acceso?.nombre_punto       || '—',
            vigilante:     r.usuarios_sistema?.nombre_completo || '—',
            id_vigilante:  r.usuarios_sistema?.id_usuario      || null,
            justificacion: r.justificaciones?.motivo           || null,
            observaciones: r.observaciones                     || null,
        }));

        return res.json({
            success: true,
            data:    resultado,
            total:   q ? resultado.length : (count ?? 0),
            page,
            limit,
            filtros: { fechaInicio, fechaFin },
        });
    } catch (err) {
        console.error('Error en getAccesos:', err);
        return res.status(500).json({ success: false, message: 'Error al obtener registros.' });
    }
};

// ── GET /api/bitacora/acciones ────────────────────────────────
// Acciones administrativas desde bitacora_auditoria.
// Query params: fecha_inicio, fecha_fin, id_usuario, accion, boleta, page, limit
export const getAcciones = async (req, res) => {
    try {
        const fechaInicio = esFormatoFecha(req.query.fecha_inicio) ? req.query.fecha_inicio : hace7Dias();
        const fechaFin    = esFormatoFecha(req.query.fecha_fin)    ? req.query.fecha_fin    : hoy();
        const idUsuario   = int(req.query.id_usuario);
        const accion      = s(req.query.accion || '');
        const boletaFilt  = int(req.query.boleta);
        const page        = Math.max(1, int(req.query.page) || 1);
        const limit       = Math.min(LIMITE_MAX, Math.max(1, int(req.query.limit) || LIMITE_DEF));
        const offset      = (page - 1) * limit;

        const desde = `${fechaInicio}T00:00:00`;
        const hasta  = `${siguienteDia(fechaFin)}T00:00:00`;

        let query = supabaseAdmin
            .from('bitacora_auditoria')
            .select(`
                id_auditoria, fecha_hora, accion, boleta_afectada, detalle,
                usuarios_sistema:id_usuario_accion ( id_usuario, nombre_completo )
            `, { count: 'exact' })
            .gte('fecha_hora', desde)
            .lt('fecha_hora', hasta)
            .order('fecha_hora', { ascending: false })
            .range(offset, offset + limit - 1);

        if (idUsuario)  query = query.eq('id_usuario_accion', idUsuario);
        if (accion)     query = query.eq('accion', accion);
        if (boletaFilt) query = query.eq('boleta_afectada', boletaFilt);

        const { data, error, count } = await query;
        if (error) throw error;

        // Batch-fetch nombres de alumnos afectados
        const boletas = [...new Set((data || []).map(r => r.boleta_afectada).filter(Boolean))];
        let nombreMap = {};
        if (boletas.length) {
            const { data: alumnos } = await supabaseAdmin
                .from('alumnos').select('boleta, nombre_completo').in('boleta', boletas);
            (alumnos || []).forEach(a => { nombreMap[a.boleta] = a.nombre_completo; });
        }

        const resultado = (data || []).map(r => ({
            id_auditoria:  r.id_auditoria,
            fecha_hora:    r.fecha_hora,
            accion:        r.accion,
            boleta:        r.boleta_afectada || null,
            nombre_alumno: r.boleta_afectada ? (nombreMap[r.boleta_afectada] || '—') : null,
            usuario:       r.usuarios_sistema?.nombre_completo || '—',
            id_usuario:    r.usuarios_sistema?.id_usuario      || null,
            detalle:       r.detalle || null,
        }));

        return res.json({
            success: true,
            data:    resultado,
            total:   count ?? 0,
            page,
            limit,
            filtros: { fechaInicio, fechaFin },
        });
    } catch (err) {
        console.error('Error en getAcciones:', err);
        return res.status(500).json({ success: false, message: 'Error al obtener bitácora.' });
    }
};

// ── GET /api/bitacora/catalogos ───────────────────────────────
// Devuelve usuarios del sistema y tipos de registro para poblar los <select>.
export const getCatalogos = async (_req, res) => {
    try {
        const [usuariosRes, tiposRes] = await Promise.all([
            supabaseAdmin.from('usuarios_sistema').select('id_usuario, nombre_completo, tipo').eq('activo', true).order('nombre_completo'),
            supabaseAdmin.from('tipos_registro').select('id_tipo, descripcion').order('id_tipo'),
        ]);

        const ETIQUETAS_ACCION = {
            'bloquear_credencial':    'Bloqueó credencial',
            'desbloquear_credencial': 'Desbloqueó credencial',
            'justificar_incidencia':  'Justificó incidencia',
            'modificar_alumno':       'Modificó datos alumno',
            'crear_alumno':           'Creó alumno',
            'carga_masiva_alumnos':   'Carga masiva alumnos',
            'carga_masiva_horarios':  'Carga masiva horarios',
        };

        return res.json({
            success:   true,
            usuarios:  (usuariosRes.data || []),
            tipos:     (tiposRes.data    || []),
            acciones:  Object.entries(ETIQUETAS_ACCION).map(([value, label]) => ({ value, label })),
        });
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Error al cargar catálogos.' });
    }
};
