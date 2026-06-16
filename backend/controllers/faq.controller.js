// backend/controllers/faq.controller.js
import { supabaseAdmin } from '../database/supabase.js';
import sanitizeHtml      from 'sanitize-html';

const s = v => typeof v === 'string'
    ? sanitizeHtml(v, { allowedTags: [], allowedAttributes: {} }).trim()
    : v;

// POST /api/faq/clic — registrar clic en una pregunta frecuente
// Silencioso: nunca bloquea la experiencia del usuario aunque falle
export const registrarClic = async (req, res) => {
    const { id_faq } = req.body;
    if (!id_faq) return res.status(400).json({ success: false });
    try {
        await supabaseAdmin.rpc('fn_faq_clic', { p_id_faq: String(id_faq) });
        return res.json({ success: true });
    } catch {
        return res.json({ success: false });
    }
};

// GET /api/faq/stats — estadísticas de clics para el panel de soporte
export const obtenerStats = async (req, res) => {
    try {
        const { data, error } = await supabaseAdmin
            .from('faq_clics')
            .select('id_faq, pregunta, total_clics, ultimo_clic')
            .order('total_clics', { ascending: false });

        if (error) throw error;
        return res.json({ success: true, stats: data || [] });
    } catch (err) {
        console.error('faq.stats:', err);
        return res.status(500).json({ success: false, message: 'Error al obtener estadísticas FAQ.' });
    }
};

// PATCH /api/faq/:id — actualizar el texto de una pregunta frecuente
export const actualizarFaq = async (req, res) => {
    const id       = parseInt(req.params.id);
    const pregunta = s(req.body.pregunta || '');

    if (!id || isNaN(id))    return res.status(400).json({ success: false, message: 'ID inválido.' });
    if (!pregunta)            return res.status(400).json({ success: false, message: 'El texto de la pregunta es requerido.' });
    if (pregunta.length > 300) return res.status(400).json({ success: false, message: 'Pregunta demasiado larga (máx 300 chars).' });

    try {
        const { error } = await supabaseAdmin
            .from('faq_clics')
            .update({ pregunta })
            .eq('id_faq', id);

        if (error) throw error;
        return res.json({ success: true, message: 'Pregunta actualizada.' });
    } catch (err) {
        console.error('faq.actualizar:', err);
        return res.status(500).json({ success: false, message: 'Error al actualizar la pregunta.' });
    }
};

// DELETE /api/faq/:id — eliminar una pregunta frecuente
export const eliminarFaq = async (req, res) => {
    const id = parseInt(req.params.id);
    if (!id || isNaN(id)) return res.status(400).json({ success: false, message: 'ID inválido.' });

    try {
        const { error } = await supabaseAdmin
            .from('faq_clics')
            .delete()
            .eq('id_faq', id);

        if (error) throw error;
        return res.json({ success: true, message: 'Pregunta eliminada.' });
    } catch (err) {
        console.error('faq.eliminar:', err);
        return res.status(500).json({ success: false, message: 'Error al eliminar la pregunta.' });
    }
};
