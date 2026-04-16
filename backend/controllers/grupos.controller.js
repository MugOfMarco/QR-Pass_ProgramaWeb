// backend/controllers/grupos.controller.js
// ============================================================
// Gestión de grupos + carga masiva de alumnos desde Excel.
// El frontend parsea el Excel con SheetJS y manda un array JSON.
// Este controller recibe ese array y hace upsert en Supabase.
// ============================================================
import Grupo from '../models/Grupo.js';
import Alumno from '../models/Alumno.js';
import sanitizeHtml from 'sanitize-html';
import { supabaseAdmin } from '../database/supabase.js';

const s = (v) => typeof v === 'string'
    ? sanitizeHtml(v, { allowedTags: [], allowedAttributes: {} }).trim()
    : v;

// ── GET /api/grupos ───────────────────────────────────────────
export const listarGrupos = async (_req, res) => {
    try {
        const grupos = await Grupo.listarConAlumnos();
        return res.json({ success: true, grupos });
    } catch (err) {
        console.error('Error listando grupos:', err);
        return res.status(500).json({ success: false, message: 'Error al cargar grupos.' });
    }
};

// ── GET /api/grupos/turnos ────────────────────────────────────
export const listarTurnos = async (_req, res) => {
    try {
        const turnos = await Grupo.obtenerTurnos();
        return res.json({ success: true, turnos });
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Error al cargar turnos.' });
    }
};

// ── POST /api/grupos ──────────────────────────────────────────
export const crearGrupo = async (req, res) => {
    try {
        const { nombre_grupo, id_turno } = req.body;
        if (!nombre_grupo || !id_turno) {
            return res.status(400).json({ success: false, message: 'Nombre y turno son obligatorios.' });
        }
        const r = await Grupo.crear(s(nombre_grupo), id_turno);
        return r.success
            ? res.status(201).json(r)
            : res.status(400).json(r);
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Error al crear grupo.' });
    }
};

// ── PUT /api/grupos/:id ───────────────────────────────────────
export const editarGrupo = async (req, res) => {
    try {
        const { nombre_grupo, id_turno } = req.body;
        if (!nombre_grupo || !id_turno) {
            return res.status(400).json({ success: false, message: 'Nombre y turno son obligatorios.' });
        }
        const r = await Grupo.editar(req.params.id, s(nombre_grupo), id_turno);
        return r.success ? res.json(r) : res.status(400).json(r);
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Error al editar grupo.' });
    }
};

// ── POST /api/grupos/accion-masiva ────────────────────────────
export const accionMasiva = async (req, res) => {
    try {
        const { boletas, tipo, valor } = req.body;
        if (!boletas?.length || !tipo) {
            return res.status(400).json({ success: false, message: 'Faltan datos.' });
        }
        const r = await Grupo.accionMasiva(boletas, tipo, valor);
        return r.success ? res.json(r) : res.status(400).json(r);
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Error en acción masiva.' });
    }
};

// ── POST /api/grupos/carga-masiva ─────────────────────────────
// Body: { alumnos: [ { boleta, nombre_completo, nombre_grupo, estado_academico, puertas_abiertas } ] }
// Hace upsert: si boleta existe → UPDATE, si no → INSERT
export const cargaMasiva = async (req, res) => {
    try {
        const { alumnos } = req.body;

        if (!Array.isArray(alumnos) || !alumnos.length) {
            return res.status(400).json({ success: false, message: 'No se recibieron datos.' });
        }
        if (alumnos.length > 2000) {
            return res.status(400).json({ success: false, message: 'Máximo 2000 alumnos por carga.' });
        }

        // ── 1. Precargar catálogos una sola vez ───────────────
        const [gruposRes, estadosRes] = await Promise.all([
            supabaseAdmin.from('grupos').select('id_grupo, nombre_grupo'),
            supabaseAdmin.from('estado_academico').select('id_estado, estado'),
        ]);

        const grupoMap = {};
        for (const g of (gruposRes.data || [])) {
            grupoMap[g.nombre_grupo.toLowerCase().trim()] = g.id_grupo;
        }

        const estadoMap = {};
        for (const e of (estadosRes.data || [])) {
            estadoMap[e.estado.toLowerCase().trim()] = e.id_estado;
        }

        // ── 2. Obtener boletas ya existentes ──────────────────
        const boletas = alumnos.map(a => parseInt(a.boleta)).filter(b => !isNaN(b));

        const { data: existentes } = await supabaseAdmin
            .from('alumnos')
            .select('boleta')
            .in('boleta', boletas);

        const boletasExistentes = new Set((existentes || []).map(e => e.boleta));

        // ── 3. Procesar fila por fila ─────────────────────────
        const resultados = { insertados: 0, actualizados: 0, errores: [] };

        const URL_FOTO_DEFAULT = 'https://res.cloudinary.com/depoh32sv/image/upload/v1765415709/vector-de-perfil-avatar-predeterminado-foto-usuario-medios-sociales-icono-183042379.jpg_jfpw3y.webp';

        // Procesar en lotes de 50 para no saturar Supabase
        const LOTE = 50;
        for (let i = 0; i < alumnos.length; i += LOTE) {
            const lote = alumnos.slice(i, i + LOTE);

            await Promise.all(lote.map(async (fila, idx) => {
                const fNum = i + idx + 1;
                const boleta = parseInt(fila.boleta);

                // Validaciones básicas
                if (isNaN(boleta) || String(boleta).length < 5) {
                    resultados.errores.push({ fila: fNum, boleta: fila.boleta, error: 'Boleta inválida' });
                    return;
                }
                if (!fila.nombre_completo?.trim()) {
                    resultados.errores.push({ fila: fNum, boleta, error: 'Nombre vacío' });
                    return;
                }

                // Resolver IDs de catálogo
                const nombreGrupo = (fila.nombre_grupo || '').toLowerCase().trim();
                const idGrupo = grupoMap[nombreGrupo];
                if (!idGrupo) {
                    resultados.errores.push({ fila: fNum, boleta, error: `Grupo "${fila.nombre_grupo}" no encontrado` });
                    return;
                }

                const nombreEstado = (fila.estado_academico || 'regular').toLowerCase().trim();
                const idEstado = estadoMap[nombreEstado] || estadoMap['regular'];
                if (!idEstado) {
                    resultados.errores.push({ fila: fNum, boleta, error: `Estado "${fila.estado_academico}" no encontrado` });
                    return;
                }

                // Puertas abiertas: acepta SI/NO/TRUE/FALSE/1/0
                const pv = String(fila.puertas_abiertas || '').toLowerCase().trim();
                const puertas = pv === 'si' || pv === 'sí' || pv === 'true' || pv === '1';

                const datosAlumno = {
                    nombre_completo:    s(fila.nombre_completo).substring(0, 200),
                    id_grupo_base:      idGrupo,
                    id_estado_academico: idEstado,
                    puertas_abiertas:   puertas,
                };

                if (boletasExistentes.has(boleta)) {
                    // UPDATE
                    const { error } = await supabaseAdmin
                        .from('alumnos')
                        .update(datosAlumno)
                        .eq('boleta', boleta);

                    if (error) {
                        resultados.errores.push({ fila: fNum, boleta, error: error.message });
                    } else {
                        resultados.actualizados++;
                    }
                } else {
                    // INSERT alumnos
                    const { error: e1 } = await supabaseAdmin
                        .from('alumnos')
                        .insert({ boleta, ...datosAlumno });

                    if (e1) {
                        resultados.errores.push({ fila: fNum, boleta, error: e1.message });
                        return;
                    }

                    // INSERT info_alumno (defaults)
                    await supabaseAdmin
                        .from('info_alumno')
                        .insert({ boleta, url_foto: URL_FOTO_DEFAULT })
                        .select()
                        .maybeSingle();

                    resultados.insertados++;
                    boletasExistentes.add(boleta); // evitar duplicados dentro del mismo archivo
                }
            }));
        }

        return res.json({
            success: true,
            message: `Carga completada: ${resultados.insertados} insertados, ${resultados.actualizados} actualizados, ${resultados.errores.length} errores.`,
            ...resultados,
        });

    } catch (err) {
        console.error('Error en carga masiva:', err);
        return res.status(500).json({ success: false, message: 'Error interno en la carga masiva.' });
    }
};