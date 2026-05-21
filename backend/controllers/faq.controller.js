// backend/controllers/faq.controller.js
import { supabaseAdmin } from '../database/supabase.js';

// POST /api/faq/clic — registrar clic en una pregunta frecuente
// Silencioso: nunca bloquea la experiencia del usuario aunque falle
export const registrarClic = async (req, res) => {
    const { id_faq } = req.body;
    if (!id_faq) return res.status(400).json({ success: false });
    try {
        await supabaseAdmin.rpc('fn_faq_clic', { p_id_faq: String(id_faq) });
        return res.json({ success: true });
    } catch {
        // Fallo silencioso — el contador es analytics, no funcional
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
