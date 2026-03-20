// backend/models/Usuario.js
import { supabaseAdmin } from '../database/supabase.js';
import bcrypt from 'bcryptjs';

class Usuario {

    // ── Login ─────────────────────────────────────────────────
    static async obtenerPorUsername(usuario) {
        const { data, error } = await supabaseAdmin
            .from('usuarios_sistema')
            .select(`
                id_usuario, usuario, password_hash,
                nombre_completo, email, activo,
                roles ( nombre_rol )
            `)
            .eq('usuario', usuario.trim())
            .eq('activo', true)
            .single();

        if (error || !data) return null;

        // FIX: null-safe — si la FK de rol está rota no crashea
        const rol = data.roles?.nombre_rol ?? 'Vigilante';

        return {
            id_usuario:      data.id_usuario,
            usuario:         data.usuario,
            password:        data.password_hash,
            nombre_completo: data.nombre_completo,
            email:           data.email ?? null,
            tipo_usuario:    rol,
        };
    }

    // ── Listar todos ──────────────────────────────────────────
    static async listar() {
        const { data, error } = await supabaseAdmin
            .from('usuarios_sistema')
            .select(`
                id_usuario, usuario, nombre_completo,
                email, activo, fecha_creacion,
                roles ( id_rol, nombre_rol )
            `)
            .order('fecha_creacion', { ascending: false });

        if (error) throw error;
        return (data || []).map(u => ({
            id_usuario:      u.id_usuario,
            usuario:         u.usuario,
            nombre_completo: u.nombre_completo,
            email:           u.email ?? null,
            activo:          u.activo,
            fecha_creacion:  u.fecha_creacion,
            id_rol:          u.roles?.id_rol   ?? null,
            rol:             u.roles?.nombre_rol ?? '—',
        }));
    }

    // ── Obtener por ID ────────────────────────────────────────
    static async obtenerPorId(id) {
        const { data, error } = await supabaseAdmin
            .from('usuarios_sistema')
            .select(`
                id_usuario, usuario, nombre_completo,
                email, activo, fecha_creacion,
                roles ( id_rol, nombre_rol )
            `)
            .eq('id_usuario', parseInt(id))
            .single();

        if (error || !data) return null;
        return {
            id_usuario:      data.id_usuario,
            usuario:         data.usuario,
            nombre_completo: data.nombre_completo,
            email:           data.email ?? null,
            activo:          data.activo,
            id_rol:          data.roles?.id_rol    ?? null,
            rol:             data.roles?.nombre_rol ?? '—',
        };
    }

    // ── Crear ─────────────────────────────────────────────────
    static async crear({ usuario, password, nombre_completo, email, id_rol }) {
        const { data: existe } = await supabaseAdmin
            .from('usuarios_sistema')
            .select('id_usuario')
            .eq('usuario', usuario.trim())
            .maybeSingle();
        if (existe) return { success: false, message: `El usuario "${usuario}" ya existe.` };

        if (email) {
            const { data: emailExiste } = await supabaseAdmin
                .from('usuarios_sistema')
                .select('id_usuario')
                .eq('email', email.trim().toLowerCase())
                .maybeSingle();
            if (emailExiste) return { success: false, message: 'Ese correo ya está registrado.' };
        }

        const hash = await bcrypt.hash(password, 10);

        const { data, error } = await supabaseAdmin
            .from('usuarios_sistema')
            .insert({
                usuario:         usuario.trim(),
                password_hash:   hash,
                nombre_completo: nombre_completo.trim(),
                email:           email ? email.trim().toLowerCase() : null,
                id_rol:          parseInt(id_rol),
                activo:          true,
            })
            .select('id_usuario')
            .single();

        if (error) return { success: false, message: error.message };
        return { success: true, message: 'Usuario creado correctamente.', id_usuario: data.id_usuario };
    }

    // ── Modificar ─────────────────────────────────────────────
    static async modificar(id, { nombre_completo, email, id_rol, activo }) {
        if (email) {
            const { data: emailExiste } = await supabaseAdmin
                .from('usuarios_sistema')
                .select('id_usuario')
                .eq('email', email.trim().toLowerCase())
                .neq('id_usuario', parseInt(id))
                .maybeSingle();
            if (emailExiste) return { success: false, message: 'Ese correo ya está en otro usuario.' };
        }

        const patch = {
            nombre_completo: nombre_completo.trim(),
            email:           email ? email.trim().toLowerCase() : null,
            id_rol:          parseInt(id_rol),
        };
        if (activo !== undefined) patch.activo = Boolean(activo);

        const { error } = await supabaseAdmin
            .from('usuarios_sistema')
            .update(patch)
            .eq('id_usuario', parseInt(id));

        if (error) return { success: false, message: error.message };
        return { success: true, message: 'Usuario actualizado.' };
    }

    // ── Cambiar contraseña ────────────────────────────────────
    static async cambiarPassword(id, { password_actual, password_nueva, esAdmin = false }) {
        if (!esAdmin) {
            const { data } = await supabaseAdmin
                .from('usuarios_sistema')
                .select('password_hash')
                .eq('id_usuario', parseInt(id))
                .single();

            if (!data) return { success: false, message: 'Usuario no encontrado.' };

            const valida = await bcrypt.compare(password_actual ?? '', data.password_hash);
            if (!valida) return { success: false, message: 'La contraseña actual es incorrecta.' };
        }

        if (!password_nueva || password_nueva.length < 6) {
            return { success: false, message: 'La nueva contraseña debe tener al menos 6 caracteres.' };
        }

        const hash = await bcrypt.hash(password_nueva, 10);
        const { error } = await supabaseAdmin
            .from('usuarios_sistema')
            .update({ password_hash: hash })
            .eq('id_usuario', parseInt(id));

        if (error) return { success: false, message: error.message };
        return { success: true, message: 'Contraseña actualizada correctamente.' };
    }

    // ── Desactivar / Reactivar ────────────────────────────────
    static async desactivar(id) {
        const { error } = await supabaseAdmin
            .from('usuarios_sistema')
            .update({ activo: false })
            .eq('id_usuario', parseInt(id));
        if (error) return { success: false, message: error.message };
        return { success: true, message: 'Usuario desactivado.' };
    }

    static async reactivar(id) {
        const { error } = await supabaseAdmin
            .from('usuarios_sistema')
            .update({ activo: true })
            .eq('id_usuario', parseInt(id));
        if (error) return { success: false, message: error.message };
        return { success: true, message: 'Usuario reactivado.' };
    }

    // ── Roles ─────────────────────────────────────────────────
    static async obtenerRoles() {
        const { data, error } = await supabaseAdmin
            .from('roles')
            .select('id_rol, nombre_rol')
            .order('id_rol');
        if (error) throw error;
        return data || [];
    }
}

export default Usuario;