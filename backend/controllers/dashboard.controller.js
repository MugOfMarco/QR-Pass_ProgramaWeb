// backend/controllers/dashboard.controller.js
// ============================================================
// FIX: normalizamos los nombres de puntos de acceso para que
//      siempre muestren "México-Tacuba" / "Mar-Mediterráneo"
// ============================================================
import { supabaseAdmin } from '../database/supabase.js';

function normalizarPuerta(nombre) {
    if (!nombre) return '—';
    const n = String(nombre).toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (n.includes('mexico') || n.includes('tacuba') || n.includes('norte')) return 'México-Tacuba';
    if (n.includes('mar') || n.includes('mediterraneo') || n.includes('sur')) return 'Mar-Mediterráneo';
    return nombre;
}

// ─────────────────────────────────────────────────────────────
// GET /api/dashboard
// ─────────────────────────────────────────────────────────────
export const obtenerDashboard = async (req, res) => {
    try {
        const ahora     = new Date();
        const hoyMX     = ahora.toLocaleDateString('sv-SE', { timeZone: 'America/Mexico_City' });
        const inicioHoy = `${hoyMX}T00:00:00-06:00`;
        const finHoy    = `${hoyMX}T23:59:59-06:00`;

        const [
            resRegistros,
            resBloqueadosSis,
            resBloqueadosMan,
            resProximos,
            resUltimos,
            resTotalAlumnos,
            resAlumnos,
            resUsuarios,
            resPuntosAcceso,
            resConfig,
        ] = await Promise.all([

            supabaseAdmin
                .from('registros_acceso')
                .select('id_tipo_registro, id_punto_acceso, fecha_hora')
                .gte('fecha_hora', inicioHoy)
                .lte('fecha_hora', finHoy),

            supabaseAdmin
                .from('info_alumno')
                .select('boleta, contador_sin_credencial')
                .eq('bloqueado_sistema', true)
                .limit(20),

            supabaseAdmin
                .from('info_alumno')
                .select('boleta, contador_sin_credencial')
                .eq('bloqueado_manual', true)
                .eq('bloqueado_sistema', false)
                .limit(20),

            supabaseAdmin
                .from('info_alumno')
                .select('boleta, contador_sin_credencial')
                .eq('bloqueado_sistema', false)
                .eq('bloqueado_manual', false)
                .gte('contador_sin_credencial', 2)
                .limit(15),

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

            supabaseAdmin
                .from('alumnos')
                .select('boleta', { count: 'exact', head: true }),

            supabaseAdmin
                .from('alumnos')
                .select(`
                    boleta, nombre_completo,
                    grupos:id_grupo_base(nombre_grupo)
                `),

            supabaseAdmin
                .from('usuarios_sistema')
                .select('id_usuario, usuario, nombre_completo, activo, roles(nombre_rol)')
                .eq('activo', true),

            // Cargar puntos de acceso para normalizar nombres
            supabaseAdmin
                .from('puntos_acceso')
                .select('id_punto_acceso, nombre_punto'),

            // Configuración del sistema (lógica de negocio)
            supabaseAdmin
                .from('configuracion_sistema')
                .select('minutos_tolerancia, max_olvidos_credencial, ultima_modificacion')
                .eq('id_config', 1)
                .maybeSingle(),
        ]);

        // ── Mapa id_punto_acceso → nombre normalizado ──────────
        const puntosMap = {};
        for (const p of (resPuntosAcceso.data || [])) {
            puntosMap[p.id_punto_acceso] = normalizarPuerta(p.nombre_punto);
        }

        // ── Mapa boleta → alumno ───────────────────────────────
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
            // Tratar siempre como UTC: añadir 'Z' si no tiene sufijo de zona
            const iso = r.fecha_hora;
            const isoUTC = /Z|[+-]\d{2}:\d{2}$/.test(iso) ? iso : iso + 'Z';
            const d = new Date(isoUTC);
            const h = d.toLocaleString('en-US', { timeZone: 'America/Mexico_City', hour: 'numeric', hour12: false });
            porHora[parseInt(h) % 24]++;
        });

        const horaActual = parseInt(
            new Date().toLocaleString('en-US', { timeZone: 'America/Mexico_City', hour: 'numeric', hour12: false })
        ) % 24;

        const graficoHoras = [];
        // Incluir todas las horas con actividad + rango escolar hasta hora actual
        for (let h = 0; h <= 23; h++) {
            const enRangoEscolar = h >= 6 && h <= Math.max(horaActual, 6);
            const tieneMovimiento = porHora[h] > 0;
            if (enRangoEscolar || tieneMovimiento) {
                graficoHoras.push({ hora: h, count: porHora[h] });
            }
        }

        // ── Actividad por puerta — usando nombres normalizados ─
        const puertas = {};
        registrosHoy.forEach(r => {
            const nombre = puntosMap[r.id_punto_acceso]
                || normalizarPuerta(`Puerta ${r.id_punto_acceso}`);
            puertas[nombre] = (puertas[nombre] || 0) + 1;
        });

        // ── Formatear bloqueados ───────────────────────────────
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
            puerta:      normalizarPuerta(r.puntos_acceso?.nombre_punto),
        }));

        // ── Usuarios ───────────────────────────────────────────
        const usuarios = (resUsuarios.data || []).map(u => ({
            id:      u.id_usuario,
            nombre:  u.nombre_completo,
            usuario: u.usuario,
            rol:     u.roles?.nombre_rol || '—',
        }));

        const config = resConfig.data
            ? {
                minutos_tolerancia:    resConfig.data.minutos_tolerancia,
                max_olvidos_credencial: resConfig.data.max_olvidos_credencial,
                ultima_modificacion:   resConfig.data.ultima_modificacion,
              }
            : { minutos_tolerancia: 20, max_olvidos_credencial: 3, ultima_modificacion: null };

        return res.json({
            success: true,
            fecha:   hoyMX,
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
            config,
        });

    } catch (err) {
        console.error('Error en dashboard:', err);
        return res.status(500).json({
            success: false,
            message: 'Error al cargar el dashboard.',
        });
    }
};

// ─────────────────────────────────────────────────────────────
// PUT /api/dashboard/config
// Actualiza los parámetros de lógica de negocio
// ─────────────────────────────────────────────────────────────
export const actualizarConfig = async (req, res) => {
    try {
        const minutos    = parseInt(req.body.minutos_tolerancia);
        const maxOlvidos = parseInt(req.body.max_olvidos_credencial);

        if (isNaN(minutos) || minutos < 0 || minutos > 120) {
            return res.status(400).json({ success: false, message: 'La tolerancia debe estar entre 0 y 120 minutos.' });
        }
        if (isNaN(maxOlvidos) || maxOlvidos < 1 || maxOlvidos > 10) {
            return res.status(400).json({ success: false, message: 'El máximo de olvidos debe estar entre 1 y 10.' });
        }

        const { error } = await supabaseAdmin
            .from('configuracion_sistema')
            .update({
                minutos_tolerancia:    minutos,
                max_olvidos_credencial: maxOlvidos,
                ultima_modificacion:   new Date().toISOString(),
            })
            .eq('id_config', 1);

        if (error) throw error;

        return res.json({ success: true, message: 'Configuración actualizada correctamente.' });
    } catch (err) {
        console.error('Error actualizando config:', err);
        return res.status(500).json({ success: false, message: 'Error al guardar la configuración.' });
    }
};