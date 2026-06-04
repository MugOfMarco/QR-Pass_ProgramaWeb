// backend/utils/auditoria.js
// Helper fire-and-forget para registrar acciones administrativas en bitacora_auditoria.
// Nunca lanza excepción: si el log falla, la acción principal sigue sin interrumpirse.
import { supabaseAdmin } from '../database/supabase.js';

/**
 * @param {object} opts
 * @param {number|null}  opts.id_usuario   - ID del usuario que ejecutó la acción
 * @param {string}       opts.accion       - Nombre corto de la acción (ej. "bloquear_credencial")
 * @param {number|null}  opts.boleta       - Boleta del alumno afectado (null si no aplica)
 * @param {string|null}  opts.detalle      - Descripción adicional libre
 */
export async function logAuditoria({ id_usuario, accion, boleta = null, detalle = null }) {
    try {
        await supabaseAdmin.from('bitacora_auditoria').insert({
            id_usuario_accion: id_usuario || null,
            accion,
            boleta_afectada: boleta || null,
            detalle: detalle || null,
        });
    } catch (err) {
        // Log silencioso — no interrumpe el flujo principal
        console.warn('[auditoria] No se pudo registrar:', accion, err?.message);
    }
}
