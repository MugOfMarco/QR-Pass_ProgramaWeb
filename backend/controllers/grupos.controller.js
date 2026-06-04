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
import { cloudinary } from '../database/cloudinary.js';
import { logAuditoria } from '../utils/auditoria.js';

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

// ── GET /api/grupos/carreras ──────────────────────────────────
export const listarCarreras = async (_req, res) => {
    try {
        const carreras = await Grupo.listarCarreras();
        return res.json({ success: true, carreras });
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Error al cargar carreras.' });
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
        const { nombre_grupo, id_turno, id_carrera } = req.body;
        if (!nombre_grupo || !id_turno || !id_carrera) {
            return res.status(400).json({ success: false, message: 'Nombre, turno y carrera son obligatorios.' });
        }
        const r = await Grupo.crear(s(nombre_grupo), id_turno, id_carrera);
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
        const { nombre_grupo, id_turno, id_carrera } = req.body;
        if (!nombre_grupo || !id_turno || !id_carrera) {
            return res.status(400).json({ success: false, message: 'Nombre, turno y carrera son obligatorios.' });
        }
        const r = await Grupo.editar(req.params.id, s(nombre_grupo), id_turno, id_carrera);
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

// ── GET /api/grupos/materias ──────────────────────────────────
export const listarMaterias = async (_req, res) => {
    try {
        const materias = await Grupo.listarMaterias();
        return res.json({ success: true, materias });
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Error al cargar materias.' });
    }
};

// ── GET /api/grupos/semestres ─────────────────────────────────
export const listarSemestres = async (_req, res) => {
    try {
        const semestres = await Grupo.listarSemestres();
        return res.json({ success: true, semestres });
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Error al cargar semestres.' });
    }
};

// ── GET /api/grupos/:id/horarios ──────────────────────────────
export const listarHorarios = async (req, res) => {
    try {
        const horarios = await Grupo.listarHorarios(req.params.id);
        return res.json({ success: true, horarios });
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Error al cargar horarios.' });
    }
};

// ── POST /api/grupos/:id/horarios ─────────────────────────────
// Acepta:
//   · dias_semana: [1,3,5]   → crea N registros (uno por día)
//   · dia_semana:  3         → compatibilidad hacia atrás (crea 1 registro)
export const crearHorario = async (req, res) => {
    try {
        const { id_materia, id_semestre, hora_inicio, hora_fin } = req.body;
        // Normalizar días: puede llegar como array o valor único
        const raw  = req.body.dias_semana ?? req.body.dia_semana;
        const dias = Array.isArray(raw) ? raw.map(Number) : [Number(raw)];

        if (!id_materia || !id_semestre || !dias.length || dias.some(isNaN) || !hora_inicio || !hora_fin) {
            return res.status(400).json({ success: false, message: 'Todos los campos son obligatorios.' });
        }
        if (hora_fin <= hora_inicio) {
            return res.status(400).json({ success: false, message: 'La hora de fin debe ser mayor que la de inicio.' });
        }
        if (dias.some(d => d < 1 || d > 7)) {
            return res.status(400).json({ success: false, message: 'Día de semana inválido (1-7).' });
        }

        // Crear un horario por cada día seleccionado
        const resultados = await Promise.all(
            dias.map(dia_semana => Grupo.crearHorario({
                id_grupo: req.params.id,
                id_materia, id_semestre, dia_semana,
                hora_inicio: s(hora_inicio),
                hora_fin:    s(hora_fin),
            }))
        );

        const errores = resultados.filter(r => !r.success);
        if (errores.length) {
            return res.status(400).json({ success: false, message: errores[0].message });
        }
        return res.status(201).json({
            success: true,
            creados: resultados.length,
            message: `${resultados.length} horario${resultados.length !== 1 ? 's' : ''} creado${resultados.length !== 1 ? 's' : ''} correctamente.`,
        });
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Error al crear horario.' });
    }
};

// ── PUT /api/grupos/horarios/:id ──────────────────────────────
export const editarHorario = async (req, res) => {
    try {
        const { id_materia, id_semestre, dia_semana, hora_inicio, hora_fin } = req.body;
        if (!id_materia || !id_semestre || dia_semana === undefined || !hora_inicio || !hora_fin) {
            return res.status(400).json({ success: false, message: 'Todos los campos son obligatorios.' });
        }
        if (hora_fin <= hora_inicio) {
            return res.status(400).json({ success: false, message: 'La hora de fin debe ser mayor que la de inicio.' });
        }
        const r = await Grupo.editarHorario(req.params.id, {
            id_materia, id_semestre, dia_semana,
            hora_inicio: s(hora_inicio),
            hora_fin:    s(hora_fin),
        });
        return r.success ? res.json(r) : res.status(400).json(r);
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Error al editar horario.' });
    }
};

// ── DELETE /api/grupos/horarios/:id ──────────────────────────
export const eliminarHorario = async (req, res) => {
    try {
        const r = await Grupo.eliminarHorario(req.params.id);
        return r.success ? res.json(r) : res.status(400).json(r);
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Error al eliminar horario.' });
    }
};

// ── Helpers: procesamiento de foto desde URL ──────────────────
// Convierte URL de Google Drive a enlace de descarga directa
function gdriveToDirect(url) {
    // /file/d/FILE_ID/view  →  direct
    const m1 = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (m1) return `https://drive.google.com/uc?export=download&id=${m1[1]}`;
    // ?id=FILE_ID  →  direct
    const m2 = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (m2) return `https://drive.google.com/uc?export=download&id=${m2[1]}`;
    return url;
}

// Sube una URL de foto a Cloudinary; devuelve URL segura o null si falla
async function procesarFoto(urlFoto) {
    if (!urlFoto || typeof urlFoto !== 'string') return null;
    const url = urlFoto.trim();
    if (!url.startsWith('http://') && !url.startsWith('https://')) return null;
    try {
        const src    = url.includes('drive.google.com') ? gdriveToDirect(url) : url;
        const result = await cloudinary.uploader.upload(src, {
            folder:        'qrpass/alumnos',
            resource_type: 'image',
            timeout:       20000,   // 20 s máx por foto
        });
        return result.secure_url || null;
    } catch {
        return null;   // fallo silencioso → se usa el avatar por defecto
    }
}

// ── POST /api/grupos/carga-masiva ─────────────────────────────
// Body: { alumnos: [ { boleta, nombre_completo, nombre_grupo, estado_academico, puertas_abiertas, foto? } ] }
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
        const [gruposRes, estadosRes, materiasRes, semestreRes] = await Promise.all([
            supabaseAdmin.from('grupos').select('id_grupo, nombre_grupo'),
            supabaseAdmin.from('estado_academico').select('id_estado, estado'),
            supabaseAdmin.from('materias').select('id_materia, nombre_materia'),
            supabaseAdmin.from('semestres').select('id_semestre').eq('activo', true).maybeSingle(),
        ]);

        const grupoMap = {};
        for (const g of (gruposRes.data || [])) {
            grupoMap[g.nombre_grupo.toLowerCase().trim()] = g.id_grupo;
        }

        const estadoMap = {};
        for (const e of (estadosRes.data || [])) {
            estadoMap[e.estado.toLowerCase().trim()] = e.id_estado;
        }

        // Sinónimos: palabras alternativas que apuntan al mismo estado canónico
        const SINONIMOS_ESTADO = {
            'regular':          'activo',
            'normal':           'activo',
            'en regla':         'activo',
            'baja provisional': 'baja temporal',
            'suspendido':       'baja temporal',
            'dado de baja':     'baja definitiva',
            'graduado':         'egresado',
            'titulado':         'egresado',
        };
        for (const [sinonimo, canonico] of Object.entries(SINONIMOS_ESTADO)) {
            if (!estadoMap[sinonimo] && estadoMap[canonico]) {
                estadoMap[sinonimo] = estadoMap[canonico];
            }
        }

        const materiasMap = {};
        for (const m of (materiasRes.data || [])) {
            materiasMap[m.nombre_materia.toLowerCase().trim()] = m.id_materia;
        }
        const semestreActivo = semestreRes.data || null;

        // ── 2. Obtener boletas ya existentes ──────────────────
        const boletas = alumnos.map(a => parseInt(a.boleta)).filter(b => !isNaN(b));

        const { data: existentes } = await supabaseAdmin
            .from('alumnos')
            .select('boleta')
            .in('boleta', boletas);

        const boletasExistentes = new Set((existentes || []).map(e => e.boleta));

        // ── 3. Procesar fila por fila ─────────────────────────
        const resultados = { insertados: 0, actualizados: 0, errores: [], fotos_ok: 0, fotos_omitidas: 0 };

        const URL_FOTO_DEFAULT = 'https://res.cloudinary.com/dom8hse1a/image/upload/v1779354074/perfil_yi4zll.jpg';

        // Procesar en lotes de 50 para no saturar Supabase
        // (lotes pequeños porque cada fila puede subir una imagen a Cloudinary)
        const LOTE = 50;
        for (let i = 0; i < alumnos.length; i += LOTE) {
            const lote = alumnos.slice(i, i + LOTE);

            await Promise.all(lote.map(async (fila, idx) => {
                const fNum = i + idx + 1;
                const boleta = parseInt(fila.boleta);

                // Validaciones básicas — formato YYYY09XXXX (CECyT 9 obligatorio)
                const boletaStr = String(fila.boleta || '').trim();
                if (!/^\d{4}09\d{4}$/.test(boletaStr)) {
                    resultados.errores.push({
                        fila: fNum,
                        boleta: fila.boleta,
                        error: 'Boleta inválida: debe ser YYYY09XXXX (10 dígitos; posiciones 5-6 = "09", código del CECyT 9)',
                    });
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

                // Foto: intenta subir a Cloudinary si viene URL
                const urlFotoRaw = String(fila.foto || '').trim();
                let urlFoto = null;
                if (urlFotoRaw) {
                    urlFoto = await procesarFoto(urlFotoRaw);
                    if (urlFoto) resultados.fotos_ok++;
                    else          resultados.fotos_omitidas++;
                }

                const datosAlumno = {
                    nombre_completo:     s(fila.nombre_completo).substring(0, 200),
                    id_grupo_base:       idGrupo,
                    id_estado_academico: idEstado,
                    puertas_abiertas:    puertas,
                };

                if (boletasExistentes.has(boleta)) {
                    // UPDATE alumnos
                    const { error } = await supabaseAdmin
                        .from('alumnos')
                        .update(datosAlumno)
                        .eq('boleta', boleta);

                    if (error) {
                        resultados.errores.push({ fila: fNum, boleta, error: error.message });
                        return;
                    }

                    // UPDATE foto si vino una nueva
                    if (urlFoto) {
                        await supabaseAdmin
                            .from('info_alumno')
                            .update({ url_foto: urlFoto })
                            .eq('boleta', boleta);
                    }

                    resultados.actualizados++;
                } else {
                    // INSERT alumnos
                    const { error: e1 } = await supabaseAdmin
                        .from('alumnos')
                        .insert({ boleta, ...datosAlumno });

                    if (e1) {
                        resultados.errores.push({ fila: fNum, boleta, error: e1.message });
                        return;
                    }

                    // INSERT info_alumno con foto o avatar default
                    await supabaseAdmin
                        .from('info_alumno')
                        .insert({ boleta, url_foto: urlFoto || URL_FOTO_DEFAULT })
                        .select()
                        .maybeSingle();

                    resultados.insertados++;
                    boletasExistentes.add(boleta); // evitar duplicados dentro del mismo archivo
                }

                // ── Procesar columna ESPA ─────────────────────
                // Formato: nombres de materias separados por coma
                // Ej: "P604 – Inglés VI, P603 – Química IV"
                const espaRaw = String(fila.espa || '').trim();
                if (espaRaw && semestreActivo) {
                    const espaNombres = espaRaw.split(',').map(n => n.trim()).filter(Boolean);
                    for (const nombre of espaNombres) {
                        const idMat = materiasMap[nombre.toLowerCase().trim()];
                        if (idMat) {
                            await supabaseAdmin
                                .from('materias_acreditadas')
                                .upsert(
                                    { boleta, id_materia: idMat, id_semestre: semestreActivo.id_semestre },
                                    { onConflict: 'boleta,id_materia', ignoreDuplicates: true }
                                );
                        }
                    }
                }
            }));
        }

        logAuditoria({
            id_usuario: req.session.user?.id,
            accion:     'carga_masiva_alumnos',
            boleta:     null,
            detalle:    `insertados=${resultados.insertados} actualizados=${resultados.actualizados} errores=${resultados.errores.length} total=${alumnos.length}`,
        });

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

// ── POST /api/grupos/carga-masiva-horarios ────────────────────
// Body: { horarios: [ { grupo, materia, dia, hora_inicio, hora_fin } ] }
// Hoja "Grupos y Horarios" del Excel. Crea la materia si no existe.
// Usa el semestre activo. Omite duplicados (mismo grupo+materia+semestre+día).
export const cargaMasivaHorarios = async (req, res) => {
    try {
        const { horarios } = req.body;
        if (!Array.isArray(horarios) || !horarios.length) {
            return res.status(400).json({ success: false, message: 'No se recibieron datos de horarios.' });
        }
        if (horarios.length > 5000) {
            return res.status(400).json({ success: false, message: 'Máximo 5000 filas por carga.' });
        }

        // Precargar catálogos
        const [gruposRes, materiasRes, semestreRes] = await Promise.all([
            supabaseAdmin.from('grupos').select('id_grupo, nombre_grupo'),
            supabaseAdmin.from('materias').select('id_materia, nombre_materia'),
            supabaseAdmin.from('semestres').select('id_semestre').eq('activo', true).maybeSingle(),
        ]);

        if (!semestreRes.data) {
            return res.status(400).json({ success: false, message: 'No hay semestre activo configurado.' });
        }
        const idSemestre = semestreRes.data.id_semestre;

        const grupoMap = {};
        for (const g of (gruposRes.data || [])) {
            grupoMap[g.nombre_grupo.toLowerCase().trim()] = g.id_grupo;
        }

        const materiasMapLocal = {};
        for (const m of (materiasRes.data || [])) {
            materiasMapLocal[m.nombre_materia.toLowerCase().trim()] = m.id_materia;
        }

        // Precargar horarios existentes del semestre activo para detectar duplicados
        const { data: horariosExistentes } = await supabaseAdmin
            .from('horarios_grupo')
            .select('id_grupo, id_materia, dia_semana')
            .eq('id_semestre', idSemestre);

        const existentesSet = new Set(
            (horariosExistentes || []).map(h => `${h.id_grupo}-${h.id_materia}-${h.dia_semana}`)
        );

        const DIA_NOMBRE = {
            'lunes': 1, 'martes': 2, 'miercoles': 3, 'miércoles': 3,
            'jueves': 4, 'viernes': 5, 'sabado': 6, 'sábado': 6,
        };

        const resultado = { insertados: 0, omitidos: 0, errores: [] };

        for (let idx = 0; idx < horarios.length; idx++) {
            const fila = horarios[idx];
            const fNum = idx + 1;

            // Validar grupo
            const idGrupo = grupoMap[(fila.grupo || '').toLowerCase().trim()];
            if (!idGrupo) {
                resultado.errores.push({ fila: fNum, error: `Grupo "${fila.grupo}" no encontrado` });
                continue;
            }

            // Validar/crear materia
            const nombreMat = s(fila.materia || '').trim();
            if (!nombreMat) {
                resultado.errores.push({ fila: fNum, error: 'Columna "materia" vacía' });
                continue;
            }
            let idMateria = materiasMapLocal[nombreMat.toLowerCase()];
            if (!idMateria) {
                const { data: newMat, error: matErr } = await supabaseAdmin
                    .from('materias')
                    .insert({ nombre_materia: nombreMat })
                    .select('id_materia')
                    .single();
                if (matErr) {
                    resultado.errores.push({ fila: fNum, error: `No se pudo crear materia: ${matErr.message}` });
                    continue;
                }
                idMateria = newMat.id_materia;
                materiasMapLocal[nombreMat.toLowerCase()] = idMateria;
            }

            // Validar día
            const diaNorm = (fila.dia || '')
                .toLowerCase().trim()
                .normalize('NFD').replace(/[̀-ͯ]/g, '');
            const diaSemana = DIA_NOMBRE[diaNorm] || DIA_NOMBRE[(fila.dia || '').toLowerCase().trim()];
            if (!diaSemana) {
                resultado.errores.push({ fila: fNum, error: `Día "${fila.dia}" inválido (usa Lunes-Viernes)` });
                continue;
            }

            // Validar horas
            const horaInicio = String(fila.hora_inicio || '').trim();
            const horaFin    = String(fila.hora_fin    || '').trim();
            if (!horaInicio || !horaFin) {
                resultado.errores.push({ fila: fNum, error: 'hora_inicio y hora_fin son obligatorias' });
                continue;
            }
            if (horaFin <= horaInicio) {
                resultado.errores.push({ fila: fNum, error: 'hora_fin debe ser mayor que hora_inicio' });
                continue;
            }

            // Omitir duplicados
            const key = `${idGrupo}-${idMateria}-${diaSemana}`;
            if (existentesSet.has(key)) { resultado.omitidos++; continue; }

            const { error: insErr } = await supabaseAdmin
                .from('horarios_grupo')
                .insert({ id_grupo: idGrupo, id_materia: idMateria, id_semestre: idSemestre, dia_semana: diaSemana, hora_inicio: horaInicio, hora_fin: horaFin });

            if (insErr) {
                resultado.errores.push({ fila: fNum, error: insErr.message });
                continue;
            }
            existentesSet.add(key);
            resultado.insertados++;
        }

        logAuditoria({
            id_usuario: req.session.user?.id,
            accion:     'carga_masiva_horarios',
            boleta:     null,
            detalle:    `insertados=${resultado.insertados} omitidos=${resultado.omitidos} errores=${resultado.errores.length} total=${horarios.length}`,
        });

        return res.json({
            success: true,
            message: `${resultado.insertados} horarios insertados, ${resultado.omitidos} omitidos (ya existían), ${resultado.errores.length} errores.`,
            ...resultado,
        });

    } catch (err) {
        console.error('Error en carga masiva de horarios:', err);
        return res.status(500).json({ success: false, message: 'Error interno en la carga de horarios.' });
    }
};