// backend/controllers/dashboard.controller.js
// ============================================================
// Datos para el dashboard del Administrador.
// Los joins info_alumno → alumnos se hacen en JS (no en Supabase)
// para evitar depender de la nomenclatura exacta de las FKs.
// ============================================================
import { supabaseAdmin } from '../database/supabase.js';

// ─────────────────────────────────────────────────────────────
// GET /api/dashboard
// ─────────────────────────────────────────────────────────────
export const obtenerDashboard = async (req, res) => {
    try {
        const ahora     = new Date();
        const hoyStr    = ahora.toISOString().split('T')[0];
        const inicioHoy = `${hoyStr}T00:00:00`;
        const finHoy    = `${hoyStr}T23:59:59`;

        // ── Consultas en paralelo ──────────────────────────────
        const [
            resRegistros,
            resBloqueadosSis,
            resBloqueadosMan,
            resProximos,
            resUltimos,
            resTotalAlumnos,
            resAlumnos,         // para enriquecer bloqueados con nombre/grupo
            resUsuarios,
        ] = await Promise.all([

            // 1. Todos los registros de hoy (para KPIs + gráfica + puertas)
            supabaseAdmin
                .from('registros_acceso')
                .select('id_tipo_registro, id_punto_acceso, fecha_hora')
                .gte('fecha_hora', inicioHoy)
                .lte('fecha_hora', finHoy),

            // 2. Boletas bloqueadas por sistema
            supabaseAdmin
                .from('info_alumno')
                .select('boleta, contador_sin_credencial')
                .eq('bloqueado_sistema', true)
                .limit(20),

            // 3. Boletas bloqueadas manualmente (sin duplicar los de sistema)
            supabaseAdmin
                .from('info_alumno')
                .select('boleta, contador_sin_credencial')
                .eq('bloqueado_manual', true)
                .eq('bloqueado_sistema', false)
                .limit(20),

            // 4. Próximos a bloquearse
            supabaseAdmin
                .from('info_alumno')
                .select('boleta, contador_sin_credencial')
                .eq('bloqueado_sistema', false)
                .eq('bloqueado_manual', false)
                .gte('contador_sin_credencial', 2)
                .limit(15),

            // 5. Últimos 10 registros con joins que SÍ funcionan (desde alumnos)
            supabaseAdmin
                .from('registros_acceso')
                .select(`
                    id_registro, fecha_hora, id_tipo_registro,
                    alumnos(nombre_completo),
                    puntos_acceso(nombre_punto),
                    tipos_registro(descripcion)
                `)
                .gte('fecha_hora', inicioHoy)
                .lte('fecha_hora', finHoy)
                .order('fecha_hora', { ascending: false })
                .limit(10),

            // 6. Total de alumnos
            supabaseAdmin
                .from('alumnos')
                .select('boleta', { count: 'exact', head: true }),

            // 7. Datos de alumnos para enriquecer bloqueados (nombre + grupo)
            // Se carga completo y se filtra en memoria — más robusto que join anidado
            supabaseAdmin
                .from('alumnos')
                .select(`
                    boleta, nombre_completo,
                    grupos:id_grupo_base(nombre_grupo)
                `),

            // 8. Usuarios activos
            supabaseAdmin
                .from('usuarios_sistema')
                .select('id_usuario, usuario, nombre_completo, activo, roles(nombre_rol)')
                .eq('activo', true),
        ]);

        // ── Mapa rápido boleta → alumno ────────────────────────
        const alumnoMap = {};
        for (const a of (resAlumnos.data || [])) {
            alumnoMap[a.boleta] = {
                nombre: a.nombre_completo,
                grupo:  a.grupos?.nombre_grupo || '—',
            };
        }

        // ── KPIs del día ───────────────────────────────────────
        const registrosHoy = resRegistros.data || [];
        const kpis = {
            entradas:      registrosHoy.filter(r => r.id_tipo_registro === 1).length,
            salidas:       registrosHoy.filter(r => r.id_tipo_registro === 2).length,
            retardos:      registrosHoy.filter(r => r.id_tipo_registro === 3).length,
            sinCredencial: registrosHoy.filter(r => r.id_tipo_registro === 4).length,
            totalHoy:      registrosHoy.length,
        };

        // ── Actividad por hora ─────────────────────────────────
        const porHora = Array(24).fill(0);
        registrosHoy.forEach(r => {
            const h = new Date(r.fecha_hora).getHours();
            porHora[h]++;
        });

        const horaActual = ahora.getHours();
        const graficoHoras = [];
        for (let h = 6; h <= Math.min(horaActual + 1, 22); h++) {
            graficoHoras.push({ hora: h, count: porHora[h] });
        }

        // ── Actividad por puerta ───────────────────────────────
        // puntos_acceso: 1=México-Tacuba, 2=Mar-Mediterráneo (fallback por ID)
        const nombrePuerta = { 1: 'México-Tacuba', 2: 'Mar-Mediterráneo' };
        const puertas = {};
        registrosHoy.forEach(r => {
            const nombre = nombrePuerta[r.id_punto_acceso] || `Puerta ${r.id_punto_acceso}`;
            puertas[nombre] = (puertas[nombre] || 0) + 1;
        });

        // ── Formatear bloqueados (join con alumnoMap) ──────────
        const formatBloqueado = (lista) => (lista || []).map(b => ({
            boleta:        b.boleta,
            nombre:        alumnoMap[b.boleta]?.nombre || '—',
            grupo:         alumnoMap[b.boleta]?.grupo  || '—',
            sinCredencial: b.contador_sin_credencial ?? 0,
        }));

        // ── Últimos registros ──────────────────────────────────
        const ultimosFormateados = (resUltimos.data || []).map(r => ({
            id_registro: r.id_registro,
            fecha_hora:  r.fecha_hora,
            tipo:        r.tipos_registro?.descripcion || '—',
            id_tipo:     r.id_tipo_registro,
            nombre:      r.alumnos?.nombre_completo    || '—',
            puerta:      r.puntos_acceso?.nombre_punto || '—',
        }));

        // ── Usuarios ───────────────────────────────────────────
        const usuarios = (resUsuarios.data || []).map(u => ({
            id:      u.id_usuario,
            nombre:  u.nombre_completo,
            usuario: u.usuario,
            rol:     u.roles?.nombre_rol || '—',
        }));

        // ── Respuesta ──────────────────────────────────────────
        return res.json({
            success: true,
            fecha:   hoyStr,
            hora:    ahora.toISOString(),
            kpis,
            notificaciones: {
                bloqueadosSistema:  formatBloqueado(resBloqueadosSis.data),
                bloqueadosManuales: formatBloqueado(resBloqueadosMan.data),
                proximosBloqueo:    formatBloqueado(resProximos.data),
            },
            graficoHoras,
            actividadPorPuerta: puertas,
            ultimosRegistros:   ultimosFormateados,
            totalAlumnos:       resTotalAlumnos.count || 0,
            usuarios,
        });

    } catch (err) {
        console.error('Error en dashboard:', err);
        return res.status(500).json({
            success: false,
            message: 'Error al cargar el dashboard.',
        });
    }
};