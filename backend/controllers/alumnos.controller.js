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
            .from('semestres').select('id_semestre').eq('activo', true).single();

        const { data: alumnoRaw } = await supabaseAdmin
            .from('alumnos').select('id_grupo_base').eq('boleta', parseInt(boleta)).single();

        let horario = [];
        if (semestre && alumnoRaw) {
            const { data: base } = await supabaseAdmin
                .from('horario_grupo')
                .select('id_horario_grupo, dia, hora_inicio, hora_fin, id_materia, materias(nombre_materia)')
                .eq('id_grupo', alumnoRaw.id_grupo_base)
                .eq('id_semestre', semestre.id_semestre);

            const { data: acred } = await supabaseAdmin
                .from('materias_acreditadas').select('id_materia').eq('boleta', parseInt(boleta));
            const idsAcred = (acred || []).map(a => a.id_materia);

            const { data: extras } = await supabaseAdmin
                .from('horario_alumno_extra')
                .select('horario_grupo(id_horario_grupo, dia, hora_inicio, hora_fin, id_materia, materias(nombre_materia))')
                .eq('boleta', parseInt(boleta));

            const baseMap = (base || [])
                .filter(h => !idsAcred.includes(h.id_materia))
                .map(h => ({ id_horario_grupo: h.id_horario_grupo, dia: h.dia,
                             inicio: h.hora_inicio, fin: h.hora_fin,
                             materia: h.materias?.nombre_materia }));

            const extraMap = (extras || []).map(e => e.horario_grupo).filter(Boolean)
                .map(h => ({ id_horario_grupo: h.id_horario_grupo, dia: h.dia,
                             inicio: h.hora_inicio, fin: h.hora_fin,
                             materia: h.materias?.nombre_materia }));

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

// ── GET /api/alumnos/buscar/alumnos?query= ───────────────────
export const buscarAlumnos = async (req, res) => {
    try {
        const alumnos = await Alumno.buscar(sanitize(req.query.query || ''));
        return res.json({ success: true, alumnos });
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Error al buscar.' });
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
        return r.success
            ? res.json({ success: true, message: r.message })
            : res.status(400).json({ success: false, message: r.message });
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Error al bloquear.' });
    }
};

// ── PUT /api/alumnos/desbloquear/:boleta ─────────────────────
export const desbloquearcredencial = async (req, res) => {
    try {
        const r = await Alumno.desbloquearCredencial(req.params.boleta);
        return r.success
            ? res.json({ success: true, message: r.message })
            : res.status(400).json({ success: false, message: r.message });
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Error al desbloquear.' });
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
export const obtenerRegistrosAlumno = async (req, res) => {
    try {
        const registros = await Alumno.obtenerRegistros(req.params.boleta);
        return res.json({ success: true, registros });
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Error al cargar registros.' });
    }
};

// ── POST /api/alumnos/registrar ──────────────────────────────
export const registrarAlumno = async (req, res) => {
    try {
        const datos = sanitizeObj(req.body);
        const r     = await Alumno.registrar(datos);
        return r.success
            ? res.json({ success: true, message: r.message, boleta: datos.boleta })
            : res.status(400).json({ success: false, message: r.message });
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
        return r.success
            ? res.json({ success: true, message: r.message, boleta })
            : res.status(400).json({ success: false, message: r.message });
    } catch (err) {
        console.error('Error modificando:', err);
        return res.status(500).json({ success: false, message: 'Error al modificar.' });
    }
};

// ── DELETE /api/alumnos/eliminar/:boleta ─────────────────────
// Política: nunca se borra físicamente
export const eliminarAlumno = (_req, res) => res.status(403).json({
    success: false,
    message: 'La eliminación física está deshabilitada. Usa el estado "Baja Definitiva" para dar de baja al alumno.',
});

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