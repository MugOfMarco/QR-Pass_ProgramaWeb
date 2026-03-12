// ============================================================
// ARCHIVO 2: backend/models/Usuario.js
// ============================================================
import { supabaseAdmin } from '../database/supabase.js';

class Usuario {
    static async obtenerPorUsername(usuario) {
        const { data, error } = await supabaseAdmin
            .from('usuarios_sistema')
            .select(`
                id_usuario,
                usuario,
                password_hash,
                nombre_completo,
                activo,
                roles ( nombre_rol )
            `)
            .eq('usuario', usuario)
            .eq('activo', true)
            .single();

        if (error || !data) return null;

        return {
            id_usuario:      data.id_usuario,
            usuario:         data.usuario,
            password:        data.password_hash,
            nombre_completo: data.nombre_completo,
            tipo_usuario:    data.roles.nombre_rol  // 'Administrador', 'Vigilante', 'Prefecto'
        };
    }
}

export default Usuario;