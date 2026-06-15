// backend/controllers/alumnos.controller.js
// ============================================================
// Fixes:
//   · modificarAlumno() — horario separado antes de sanitizar
//   · eliminarAlumno()  — 403 con mensaje útil
//   · obtenerMaterias() — nuevo endpoint para el select de horario
//   · uploadImage()     — usa buffer de multer memoryStorage
// ============================================================
import Alumno    from '../models/Alumno.js';
import { cloudinary, getOptimizedImageUrl } from '../database/cloudinary.js';
import sanitizeHtml from 'sanitize-html';
import { supabaseAdmin } from '../database/supabase.js';
import { logAuditoria } from '../utils/auditoria.js';

const sanitize = (v) => typeof v === 'string'
    ? sanitizeHtml(v, { allowedTags: [], allowedAttributes: {} })
    : v;

const sanitizeObj = (obj) => {
    const out = {};
    for (const k in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, k)) out[k] = sanitize(obj[k]);
    }
    return out;
};

// ── GET /api/alumnos/:boleta ──────────────────────────────────
export const obtenerAlumno = async (req, res) => {
    try {
        const { boleta } = req.params;
        if (!boleta || isNaN(boleta)) {
            return res.status(400).json({ success: false, message: 'Boleta inválida.' });
        }

        const alumno = await Alumno.obtenerBasico(boleta);
        if (!alumno) {
            return res.status(404).json({ success: false, message: 'Alumno no encontrado.' });
        }

        const { data: semestre } = await supabaseAdmin
            .from('semestres').select('id_semestre').eq('activo', true).maybeSingle();

        const { data: alumnoRaw } = await supabaseAdmin
            .from('alumnos').select('id_grupo_base').eq('boleta', parseInt(boleta)).single();

        const DIA_MAP = { 1:'lunes', 2:'martes', 3:'miércoles', 4:'jueves', 5:'viernes', 6:'sábado', 7:'domingo' };

        let horario = [];
        if (semestre && alumnoRaw) {
            const { data: base } = await supabaseAdmin
                .from('horarios_grupo')
                .select('id_horario, dia_semana, hora_inicio, hora_fin, id_materia, materias(nombre_materia)')
                .eq('id_grupo', alumnoRaw.id_grupo_base)
                .eq('id_semestre', semestre.id_semestre);

            const { data: acred } = await supabaseAdmin
                .from('materias_acreditadas').select('id_materia').eq('boleta', parseInt(boleta));
            const idsAcred = (acred || []).map(a => a.id_materia);

            const { data: extras } = await supabaseAdmin
                .from('horario_alumno_extra')
                .select('horarios_grupo(id_horario, dia_semana, hora_inicio, hora_fin, id_materia, materias(nombre_materia))')
                .eq('boleta', parseInt(boleta));

            const baseMap = (base || [])
                .map(h => ({
                    id_horario: h.id_horario,
                    dia:        DIA_MAP[h.dia_semana] || String(h.dia_semana),
                    inicio:     h.hora_inicio,
                    fin:        h.hora_fin,
                    materia:    h.materias?.nombre_materia,
                    espa:       idsAcred.includes(h.id_materia),
                }));

            const extraMap = (extras || []).map(e => e.horarios_grupo).filter(Boolean)
                .map(h => ({
                    id_horario: h.id_horario,
                    dia:        DIA_MAP[h.dia_semana] || String(h.dia_semana),
                    inicio:     h.hora_inicio,
                    fin:        h.hora_fin,
                    materia:    h.materias?.nombre_materia,
                    espa:       false,
                }));

            horario = [...baseMap, ...extraMap];
        }

        return res.json({
            success:   true,
            bloqueado: alumno.bloqueado,
            alumno: {
                boleta:           alumno.boleta,
                nombre:           alumno.nombre,
                nombre_grupo:     alumno.nombre_grupo,
                carrera:          alumno.carrera,
                estado:           alumno.estado_academico,
                estado_academico: alumno.estado_academico,
                puerta_abierta:   alumno.puerta_abierta,
                bloqueado:        alumno.bloqueado,
                retardos:         alumno.retardos,
                sin_credencial:   alumno.sin_credencial,
                url:              alumno.url,
            },
            horario,
        });
    } catch (err) {
        console.error('Error obteniendo alumno:', err);
        return res.status(500).json({ success: false, message: 'Error interno.' });
    }
};

// ── GET /api/alumnos/buscar/alumnos ──────────────────────────
export const buscarAlumnos = async (req, res) => {
    try {
        // 1. Extraemos y sanitizamos todos los posibles filtros del frontend
        const q        = sanitize(req.query.q        || '');
        const puertas  = sanitize(req.query.puertas  || '');
        const turno    = sanitize(req.query.turno    || '');
        const estado   = sanitize(req.query.estado   || '');
        const grupo    = sanitize(req.query.grupo    || '');
        const dentro   = sanitize(req.query.dentro   || '');
        const bloqueado = sanitize(req.query.bloqueado || '');

        // 2. Iniciamos la consulta base a Supabase uniendo las tablas necesarias
        // Usamos inner joins y left joins explícitos para traer nombres y no solo IDs
        let query = supabaseAdmin
            .from('alumnos')
            .select(`
                boleta, 
                nombre_completo, 
                puertas_abiertas,
                estado_academico:id_estado_academico (estado),
                grupos:id_grupo_base (
                    nombre_grupo,
                    turnos:id_turno (nombre_turno)
                )
            `);

        // 3. Aplicamos el filtro de búsqueda por texto (Nombre o Boleta)
        if (q) {
            // Verifica si el texto es un número para buscar exactamente por boleta
            if (!isNaN(q)) {
                query = query.eq('boleta', parseInt(q));
            } else {
                query = query.ilike('nombre_completo', `%${q}%`);
            }
        }
        
        // 4. Aplicamos los filtros de los Checkboxes
        if (puertas === 'true') query = query.eq('puertas_abiertas', true);
        if (puertas === 'false') query = query.eq('puertas_abiertas', false);

        // Para filtrar por estado académico, como es una tabla relacionada, 
        // filtramos después en memoria o usamos la sintaxis de Supabase para foreign tables
        // En este caso, para el nivel de Supabase free, es más seguro y rápido traer los datos
        // y filtrarlos mediante la API.

        // 5. Ejecutar consulta
        const { data: alumnosRaw, error } = await query;

        if (error) throw error;

        // 6. Post-procesamiento: Limpiar el JSON para que el frontend lo lea fácil
        // y aplicar los filtros complejos (Turno y Estado) que vienen de las tablas unidas
        let alumnosMapeados = alumnosRaw.map(al => ({
            boleta: al.boleta,
            nombre_completo: al.nombre_completo,
            puertas_abiertas: al.puertas_abiertas,
            estado_academico: al.estado_academico?.estado || 'Desconocido',
            grupo: al.grupos?.nombre_grupo || 'Sin Grupo',
            turno: al.grupos?.turnos?.nombre_turno || 'Sin Turno'
        }));

        // Filtrado en memoria de las relaciones complejas
        if (turno)  alumnosMapeados = alumnosMapeados.filter(al => al.turno === turno);
        if (estado) alumnosMapeados = alumnosMapeados.filter(al => al.estado_academico === estado);
        if (grupo)  alumnosMapeados = alumnosMapeados.filter(al => al.grupo === grupo);

        // Filtro: alumnos con credencial bloqueada
        if (bloqueado === 'true') {
            const { data: bloqueadosData } = await supabaseAdmin
                .from('info_alumno')
                .select('boleta')
                .or('bloqueado_manual.eq.true,bloqueado_sistema.eq.true');
            const bloqueadosSet = new Set((bloqueadosData || []).map(b => b.boleta));
            alumnosMapeados = alumnosMapeados.filter(al => bloqueadosSet.has(al.boleta));
        }

        // Filtro: alumnos actualmente dentro del plantel (última entrada hoy sin salida)
        if (dentro === 'true' || dentro === 'false') {
            const diaMX = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Mexico_City' });
            const sigDia = s => { const d = new Date(`${s}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + 1); return d.toISOString().slice(0, 10); };
            const { data: registrosHoy } = await supabaseAdmin
                .from('registros_acceso')
                .select('boleta, id_tipo_registro')
                .gte('fecha_hora', `${diaMX}T06:00:00`)
                .lte('fecha_hora', `${sigDia(diaMX)}T05:59:59`)
                .order('fecha_hora', { ascending: true });

            const ultimoPorBoleta = {};
            for (const r of (registrosHoy || [])) {
                ultimoPorBoleta[r.boleta] = r.id_tipo_registro;
            }
            const TIPOS_ENTRADA = new Set([1, 3, 4]);
            const boletasDentro = new Set(
                Object.entries(ultimoPorBoleta)
                    .filter(([, t]) => TIPOS_ENTRADA.has(t))
                    .map(([b]) => parseInt(b))
            );

            if (dentro === 'true') {
                alumnosMapeados = alumnosMapeados.filter(al => boletasDentro.has(al.boleta));
            } else {
                alumnosMapeados = alumnosMapeados.filter(al => !boletasDentro.has(al.boleta));
            }
        }

        // 7. Responder al Frontend
        return res.json({
            success: true,
            data: alumnosMapeados
        });

    } catch (err) {
        console.error('❌ Error en buscarAlumnos:', err);
        return res.status(500).json({ 
            success: false, 
            message: 'Error al ejecutar la búsqueda en la base de datos.' 
        });
    }
};

// ── GET /api/alumnos/verificar-bloqueo/:boleta ───────────────
export const verificarBloqueo = async (req, res) => {
    try {
        const bloqueado = await Alumno.verificarBloqueo(req.params.boleta);
        return res.json({ success: true, bloqueado });
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Error verificando.' });
    }
};

// ── PUT /api/alumnos/bloquear/:boleta ────────────────────────
export const bloquearcredencial = async (req, res) => {
    try {
        const r = await Alumno.bloquearCredencial(req.params.boleta);
        if (r.success) {
            logAuditoria({ id_usuario: req.session.user?.id, accion: 'bloquear_credencial', boleta: parseInt(req.params.boleta) });
            return res.json({ success: true, message: r.message });
        }
        return res.status(400).json({ success: false, message: r.message });
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Error al bloquear.' });
    }
};

// ── PUT /api/alumnos/desbloquear/:boleta ─────────────────────
export const desbloquearcredencial = async (req, res) => {
    try {
        const r = await Alumno.desbloquearCredencial(req.params.boleta);
        if (r.success) {
            logAuditoria({ id_usuario: req.session.user?.id, accion: 'desbloquear_credencial', boleta: parseInt(req.params.boleta) });
            return res.json({ success: true, message: r.message });
        }
        return res.status(400).json({ success: false, message: r.message });
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Error al desbloquear.' });
    }
};

// ── GET /api/alumnos/:boleta/historial-bloqueos ───────────────
export const historialBloqueos = async (req, res) => {
    try {
        const boleta = parseInt(req.params.boleta);
        const { data, error } = await supabaseAdmin
            .from('bitacora_auditoria')
            .select(`
                id_auditoria, fecha_hora, accion, detalle,
                usuarios_sistema:id_usuario_accion ( nombre_completo )
            `)
            .eq('boleta_afectada', boleta)
            .in('accion', ['bloquear_credencial', 'desbloquear_credencial'])
            .order('fecha_hora', { ascending: false });
        if (error) throw error;
        return res.json({
            success: true,
            historial: (data || []).map(r => ({
                id:        r.id_auditoria,
                fecha_hora: r.fecha_hora,
                accion:    r.accion,
                detalle:   r.detalle || null,
                usuario:   r.usuarios_sistema?.nombre_completo || null,
            })),
        });
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Error al cargar historial de bloqueos.' });
    }
};

// ── POST /api/alumnos/justificaciones ────────────────────────
export const registrarJustificacion = async (req, res) => {
    try {
        const id_registro   = parseInt(req.body.id_registro);
        const justificacion = sanitize(req.body.justificacion);
        const id_usuario    = req.session.user?.id;
        if (!id_registro || !justificacion) {
            return res.status(400).json({ success: false, message: 'Faltan datos.' });
        }
        const r = await Alumno.registrarJustificacion(id_registro, justificacion, id_usuario);

        // Obtener boleta y tipo del registro para la bitácora y el decremento
        const { data: regRow } = await supabaseAdmin
            .from('registros_acceso')
            .select('boleta, id_tipo_registro')
            .eq('id_registro', id_registro)
            .maybeSingle();

        logAuditoria({
            id_usuario,
            accion:  'justificar_incidencia',
            boleta:  regRow?.boleta || null,
            detalle: `id_registro=${id_registro} | motivo: ${justificacion}`,
        });

        // Decrementar el contador activo (para bloqueo) sin tocar el total histórico
        if (regRow?.boleta) {
            const { data: info } = await supabaseAdmin
                .from('info_alumno')
                .select('contador_sin_credencial, contador_retardos')
                .eq('boleta', regRow.boleta)
                .maybeSingle();

            if (info) {
                if (regRow.id_tipo_registro === 4) {
                    await supabaseAdmin.from('info_alumno')
                        .update({ contador_sin_credencial: Math.max(0, info.contador_sin_credencial - 1) })
                        .eq('boleta', regRow.boleta);
                } else if (regRow.id_tipo_registro === 3) {
                    await supabaseAdmin.from('info_alumno')
                        .update({ contador_retardos: Math.max(0, info.contador_retardos - 1) })
                        .eq('boleta', regRow.boleta);
                }
            }
        }

        return res.json({ success: true, message: 'Justificación registrada.', data: r });
    } catch (err) {
        return res.status(500).json({ success: false, message: 'No se pudo registrar.' });
    }
};

// ── GET /api/alumnos/:boleta/registros/justificar ────────────
export const obtenerRegistrosParaJustificar = async (req, res) => {
    try {
        const { boleta } = req.params;
        if (!boleta || isNaN(boleta)) {
            return res.status(400).json({ success: false, message: 'Boleta inválida.' });
        }
        const registros = await Alumno.obtenerRegistros(boleta);
        return res.json({ success: true, data: registros });
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Error al obtener historial.' });
    }
};

// ── GET /api/alumnos/:boleta/registros ───────────────────────
// Acepta ?fecha_inicio=YYYY-MM-DD&fecha_fin=YYYY-MM-DD opcionales
export const obtenerRegistrosAlumno = async (req, res) => {
    try {
        const { boleta } = req.params;
        const fechaInicio = sanitize(req.query.fecha_inicio || '');
        const fechaFin    = sanitize(req.query.fecha_fin    || '');
        const registros = await Alumno.obtenerRegistros(boleta, fechaInicio, fechaFin);
        return res.json({ success: true, registros });
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Error al cargar registros.' });
    }
};

// ── POST /api/alumnos/registrar ──────────────────────────────
export const registrarAlumno = async (req, res) => {
    try {
        const datos = sanitizeObj(req.body);

        // Validar formato de boleta: YYYY09XXXX (10 dígitos, pos 5-6 = "09" → CECyT 9)
        const boletaStr = String(datos.boleta || '').trim();
        if (!/^\d{4}09\d{4}$/.test(boletaStr)) {
            return res.status(400).json({
                success: false,
                message: 'Boleta inválida. Debe tener 10 dígitos con "09" en las posiciones 5-6 (ej: 2024090406). Los dígitos 5 y 6 son el código obligatorio del CECyT 9.',
            });
        }

        const r = await Alumno.registrar(datos);
        if (r.success) {
            logAuditoria({
                id_usuario: req.session.user?.id,
                accion:     'crear_alumno',
                boleta:     parseInt(datos.boleta),
                detalle:    datos.nombre_completo || null,
            });
            return res.json({ success: true, message: r.message, boleta: datos.boleta });
        }
        return res.status(400).json({ success: false, message: r.message });
    } catch (err) {
        console.error('Error registrando:', err);
        return res.status(500).json({ success: false, message: 'Error al registrar.' });
    }
};

// ── PUT /api/alumnos/modificar/:boleta ───────────────────────
// FIX: horario se extrae ANTES de sanitizeObj porque es un array
// sanitizeObj lo convertiría en string '[object Object]'
export const modificarAlumno = async (req, res) => {
    try {
        const { boleta }           = req.params;
        const { horario, ...rest } = req.body;          // ← separar primero
        const datosLimpios         = sanitizeObj(rest); // sanitizar solo los strings

        const r = await Alumno.modificar(boleta, { ...datosLimpios, horario });
        if (r.success) {
            const camposModificados = Object.keys(rest).filter(k => rest[k] !== undefined && rest[k] !== '').join(', ');
            logAuditoria({
                id_usuario: req.session.user?.id,
                accion:     'modificar_alumno',
                boleta:     parseInt(boleta),
                detalle:    camposModificados ? `campos: ${camposModificados}` : null,
            });
            return res.json({ success: true, message: r.message, boleta });
        }
        return res.status(400).json({ success: false, message: r.message });
    } catch (err) {
        console.error('Error modificando:', err);
        return res.status(500).json({ success: false, message: 'Error al modificar.' });
    }
};

// ── DELETE /api/alumnos/eliminar/:boleta ─────────────────────
export const eliminarAlumno = async (req, res) => {
    try {
        const boletaInt = parseInt(req.params.boleta);
        if (isNaN(boletaInt)) {
            return res.status(400).json({ success: false, message: 'Boleta inválida.' });
        }

        // Verificar que el alumno existe y obtener datos para auditoría
        const { data: alumno } = await supabaseAdmin
            .from('alumnos').select('boleta, nombre_completo').eq('boleta', boletaInt).single();
        if (!alumno) {
            return res.status(404).json({ success: false, message: 'Alumno no encontrado.' });
        }

        // Intentar eliminar foto de Cloudinary antes de borrar el registro
        const { data: infoFoto } = await supabaseAdmin
            .from('info_alumno').select('url_foto').eq('boleta', boletaInt).single();
        if (infoFoto?.url_foto?.includes('cloudinary')) {
            try {
                const partes = infoFoto.url_foto.split('/upload/')[1]?.split('.');
                if (partes) {
                    const public_id = partes.slice(0, -1).join('.');
                    await cloudinary.uploader.destroy(public_id);
                }
            } catch (_) { /* silencioso: no bloqueamos el delete por esto */ }
        }

        // Eliminar registros dependientes en el orden correcto
        await supabaseAdmin.from('materias_acreditadas').delete().eq('boleta', boletaInt);
        await supabaseAdmin.from('horario_alumno_extra').delete().eq('boleta', boletaInt);
        await supabaseAdmin.from('justificaciones').delete().eq('boleta', boletaInt);
        await supabaseAdmin.from('registros_acceso').delete().eq('boleta', boletaInt);
        await supabaseAdmin.from('bitacora_auditoria').delete().eq('boleta', boletaInt);
        await supabaseAdmin.from('info_alumno').delete().eq('boleta', boletaInt);

        const { error } = await supabaseAdmin.from('alumnos').delete().eq('boleta', boletaInt);
        if (error) {
            return res.status(500).json({ success: false, message: 'Error al eliminar: ' + error.message });
        }

        logAuditoria({
            id_usuario: req.session.user?.id,
            accion:     'eliminar_alumno',
            boleta:     boletaInt,
            detalle:    alumno.nombre_completo,
        });

        return res.json({ success: true, message: `Alumno ${boletaInt} (${alumno.nombre_completo}) eliminado.` });

    } catch (err) {
        console.error('Error eliminando alumno:', err);
        return res.status(500).json({ success: false, message: 'Error interno.' });
    }
};

// ── GET /api/alumnos/grupos/lista ────────────────────────────
export const obtenerGrupos = async (_req, res) => {
    try {
        const grupos = await Alumno.obtenerGrupos();
        return res.json({ success: true, grupos });
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Error cargando grupos.' });
    }
};

// ── GET /api/alumnos/estados/lista ───────────────────────────
export const obtenerEstadosAcademicos = async (_req, res) => {
    try {
        const estados = await Alumno.obtenerEstadosAcademicos();
        return res.json({ success: true, estados });
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Error cargando estados.' });
    }
};

// ── GET /api/alumnos/carreras/lista ──────────────────────────
export const obtenerCarreras = async (_req, res) => {
    try {
        const carreras = await Alumno.obtenerCarreras();
        return res.json({ success: true, carreras });
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Error cargando carreras.' });
    }
};

// ── GET /api/alumnos/materias/lista ── NUEVO ─────────────────
// Para poblar el <select> de materias en el horario dinámico
export const obtenerMaterias = async (_req, res) => {
    try {
        const { data, error } = await supabaseAdmin
            .from('materias').select('id_materia, nombre_materia').order('nombre_materia');
        if (error) throw error;
        return res.json({ success: true, materias: data || [] });
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Error cargando materias.' });
    }
};

// ── POST /api/alumnos/upload ─────────────────────────────────
export const uploadImage = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'No se seleccionó imagen.' });
        }
        const b64     = Buffer.from(req.file.buffer).toString('base64');
        const dataURI = `data:${req.file.mimetype};base64,${b64}`;

        const result = await cloudinary.uploader.upload(dataURI, {
            folder: 'qrpass/alumnos', resource_type: 'image',
            transformation: [
                { width: 300, height: 300, crop: 'fill', gravity: 'auto' },
                { quality: 'auto', fetch_format: 'auto' },
            ],
        });

        const url = getOptimizedImageUrl(result.secure_url, { width: 300, height: 300, crop: 'fill' });
        return res.json({ success: true, url, public_id: result.public_id });
    } catch (err) {
        console.error('Error subiendo imagen:', err);
        return res.status(500).json({ success: false, message: 'Error al subir imagen.' });
    }
};

// ── DELETE /api/alumnos/image ────────────────────────────────
export const deleteImage = async (req, res) => {
    try {
        const { public_id } = req.body;
        if (!public_id) return res.status(400).json({ success: false, message: 'Falta public_id.' });
        await cloudinary.uploader.destroy(public_id);
        return res.json({ success: true, message: 'Imagen eliminada.' });
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Error al eliminar imagen.' });
    }
};

export const createAlumno = registrarAlumno;

// ── Helpers privados ──────────────────────────────────────────
function _normalizarPuerta(nombre) {
    if (!nombre) return null;
    const n = String(nombre).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    if (n.includes('mexico') || n.includes('tacuba') || n.includes('norte') || n === '1') return 'México-Tacuba';
    if (n.includes('mar') || n.includes('mediterraneo') || n.includes('sur') || n === '2') return 'Mar-Mediterráneo';
    return nombre;
}

function _getDiasHabiles(inicio, fin) {
    const dias = [];
    const current = new Date(`${inicio}T12:00:00`);
    const end     = new Date(`${fin}T12:00:00`);
    while (current <= end) {
        const dow = current.getDay(); // 0=Dom, 6=Sab
        if (dow >= 1 && dow <= 5) {
            const yyyy = current.getFullYear();
            const mm   = String(current.getMonth() + 1).padStart(2, '0');
            const dd   = String(current.getDate()).padStart(2, '0');
            dias.push(`${yyyy}-${mm}-${dd}`);
        }
        current.setDate(current.getDate() + 1);
    }
    return dias;
}

// ── GET /api/alumnos/incidencias/periodo ──────────────────────
// Devuelve solo alumnos con al menos una incidencia (retardo,
// sin credencial o falta) en el rango de fechas indicado.
// Query params: fecha_inicio, fecha_fin, q, grupo, turno
export const obtenerIncidenciasPeriodo = async (req, res) => {
    try {
        const { fecha_inicio, fecha_fin } = req.query;
        const qSan     = sanitize(req.query.q     || '');
        const grupoSan = sanitize(req.query.grupo  || '');
        const turnoSan = sanitize(req.query.turno  || '');

        if (!fecha_inicio || !fecha_fin) {
            return res.status(400).json({ success: false, message: 'Se requieren fecha_inicio y fecha_fin.' });
        }
        if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha_inicio) || !/^\d{4}-\d{2}-\d{2}$/.test(fecha_fin)) {
            return res.status(400).json({ success: false, message: 'Formato de fecha inválido. Usa YYYY-MM-DD.' });
        }

        const sigDia = s => { const d = new Date(`${s}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + 1); return d.toISOString().slice(0, 10); };
        const desde = `${fecha_inicio}T06:00:00`;
        const hasta = `${sigDia(fecha_fin)}T05:59:59`;

        // 1. Registros de incidencias (retardo=3, sin credencial=4) con vigilante
        const { data: registrosInc, error: e1 } = await supabaseAdmin
            .from('registros_acceso')
            .select(`
                id_registro, boleta, fecha_hora, id_tipo_registro,
                tipos_registro ( descripcion ),
                puntos_acceso ( nombre_punto ),
                usuarios_sistema:id_usuario_vigilante ( nombre_completo ),
                justificaciones ( motivo )
            `)
            .in('id_tipo_registro', [3, 4])
            .gte('fecha_hora', desde)
            .lte('fecha_hora', hasta);

        if (e1) throw e1;

        // 2. Todos los registros (cualquier tipo) para detectar días de asistencia
        const { data: registrosTodos, error: e2 } = await supabaseAdmin
            .from('registros_acceso')
            .select('boleta, fecha_hora')
            .gte('fecha_hora', desde)
            .lte('fecha_hora', hasta);

        if (e2) throw e2;

        // 3. Lista de alumnos con filtros opcionales
        let queryAlumnos = supabaseAdmin
            .from('alumnos')
            .select(`
                boleta, nombre_completo,
                grupos:id_grupo_base ( nombre_grupo, turnos:id_turno ( nombre_turno ) )
            `);

        if (qSan) {
            if (!isNaN(qSan)) queryAlumnos = queryAlumnos.eq('boleta', parseInt(qSan));
            else queryAlumnos = queryAlumnos.ilike('nombre_completo', `%${qSan}%`);
        }

        const { data: alumnos, error: e3 } = await queryAlumnos;
        if (e3) throw e3;

        // 4. Días hábiles (lunes-viernes) en el rango
        const diasHabiles = _getDiasHabiles(fecha_inicio, fecha_fin);

        // 5. Mapa de asistencia: boleta → Set de fechas México con cualquier registro
        const asistenciaPorBoleta = {};
        for (const r of (registrosTodos || [])) {
            const diaMX = new Date(r.fecha_hora).toLocaleDateString('sv-SE', { timeZone: 'America/Mexico_City' });
            if (!asistenciaPorBoleta[r.boleta]) asistenciaPorBoleta[r.boleta] = new Set();
            asistenciaPorBoleta[r.boleta].add(diaMX);
        }

        // 6. Mapa de incidencias reales: boleta → array
        const incidenciasPorBoleta = {};
        for (const r of (registrosInc || [])) {
            if (!incidenciasPorBoleta[r.boleta]) incidenciasPorBoleta[r.boleta] = [];
            incidenciasPorBoleta[r.boleta].push({
                id_registro:   r.id_registro,
                fecha_hora:    r.fecha_hora,
                tipo:          r.tipos_registro?.descripcion,
                punto_acceso:  _normalizarPuerta(r.puntos_acceso?.nombre_punto),
                vigilante:     r.usuarios_sistema?.nombre_completo || null,
                justificacion: r.justificaciones?.motivo || null,
            });
        }

        // 7. Construir resultado por alumno
        const resultado = [];
        for (const al of (alumnos || [])) {
            const grupoNombre = al.grupos?.nombre_grupo || 'Sin Grupo';
            const turnoNombre = al.grupos?.turnos?.nombre_turno || 'Sin Turno';

            if (grupoSan && grupoNombre !== grupoSan) continue;
            if (turnoSan && turnoNombre !== turnoSan) continue;

            const incidencias   = incidenciasPorBoleta[al.boleta] || [];
            const asistencia    = asistenciaPorBoleta[al.boleta]  || new Set();

            const retardos      = incidencias.filter(i => /retardo/i.test(i.tipo || '')).length;
            const sinCredencial = incidencias.filter(i => /credencial/i.test(i.tipo || '')).length;

            // Faltas: días hábiles sin ningún registro de acceso
            const diasFalta  = diasHabiles.filter(d => !asistencia.has(d));
            const faltas     = diasFalta.length;

            const total = retardos + sinCredencial + faltas;
            if (total === 0) continue;

            // Agregar faltas como entradas virtuales (sin id_registro)
            const incFaltas = diasFalta.map(d => ({
                id_registro:   null,
                fecha_hora:    `${d}T00:00:00`,
                tipo:          'Falta',
                punto_acceso:  null,
                vigilante:     null,
                justificacion: null,
            }));

            const detalle = [...incidencias, ...incFaltas]
                .sort((a, b) => new Date(b.fecha_hora) - new Date(a.fecha_hora));

            resultado.push({
                boleta:            al.boleta,
                nombre_completo:   al.nombre_completo,
                grupo:             grupoNombre,
                turno:             turnoNombre,
                total_incidencias: total,
                retardos,
                sin_credencial:    sinCredencial,
                faltas,
                detalle,
            });
        }

        resultado.sort((a, b) => b.total_incidencias - a.total_incidencias);

        return res.json({
            success:      true,
            data:         resultado,
            dias_habiles: diasHabiles.length,
            periodo:      { inicio: fecha_inicio, fin: fecha_fin },
        });

    } catch (err) {
        console.error('Error en obtenerIncidenciasPeriodo:', err);
        return res.status(500).json({ success: false, message: 'Error al obtener incidencias del período.' });
    }
};