// ARCHIVO 3: backend/controllers/alumnos.controller.js  (MIGRADO A SUPABASE)
// ============================================================================================================================
// CAMBIOS:
//   · Todos los métodos usan el nuevo modelo Alumno.js (Supabase)
//   · obtenerAlumno devuelve estructura nueva: { alumno, horario } compatible con el frontend
//   · eliminarAlumno DESHABILITADO — política de no borrar datos
// ============================================================================================================================
import Alumno from '../models/Alumno.js';
import { cloudinary, getOptimizedImageUrl } from '../database/cloudinary.js';
import sanitizeHtml from 'sanitize-html';
import { supabaseAdmin } from '../database/supabase.js';
 
// Sanitización
const sanitize = (data) => {
    if (typeof data === 'string') {
        return sanitizeHtml(data, {
            allowedTags: [],
            allowedAttributes: {},
            disallowedTagsMode: 'recursiveEscape'
        });
    }
    return data;
};
 
const sanitizeObject = (obj) => {
    const sanitized = {};
    for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
            sanitized[key] = sanitize(obj[key]);
        }
    }
    return sanitized;
};
 
// ------------------------------------------------------------------
// GET /api/alumnos/:boleta
// Devuelve alumno + horario calculado (base - acreditadas + extras)
// Compatible con registro.js del frontend sin cambiar nada allá
// ------------------------------------------------------------------
export const obtenerAlumno = async (req, res) => {
    try {
        const { boleta } = req.params;
 
        if (!boleta || isNaN(boleta)) {
            return res.status(400).json({ success: false, message: 'Boleta inválida.' });
        }
 
        const alumno = await Alumno.obtenerBasico(boleta);
 
        if (!alumno) {
            return res.status(404).json({
                success: false,
                message: 'No se encontró ningún alumno con esa boleta.'
            });
        }
 
        // Obtener semestre activo
        const { data: semestre } = await supabaseAdmin
            .from('semestres')
            .select('id_semestre')
            .eq('activo', true)
            .single();
 
        // Obtener id_grupo_base real
        const { data: alumnoRaw } = await supabaseAdmin
            .from('alumnos')
            .select('id_grupo_base')
            .eq('boleta', parseInt(boleta))
            .single();
 
        let horario = [];
 
        if (semestre && alumnoRaw) {
            // 1. Horario base del grupo
            const { data: horarioBase } = await supabaseAdmin
                .from('horario_grupo')
                .select('id_horario_grupo, dia, hora_inicio, hora_fin, id_materia, materias(nombre_materia)')
                .eq('id_grupo', alumnoRaw.id_grupo_base)
                .eq('id_semestre', semestre.id_semestre);
 
            // 2. Materias acreditadas (excluir del horario base)
            const { data: acreditadas } = await supabaseAdmin
                .from('materias_acreditadas')
                .select('id_materia')
                .eq('boleta', parseInt(boleta));
 
            const idsAcreditadas = (acreditadas || []).map(a => a.id_materia);
 
            // 3. Horario extra (agregar)
            const { data: extras } = await supabaseAdmin
                .from('horario_alumno_extra')
                .select(`
                    horario_grupo (
                        id_horario_grupo, dia, hora_inicio, hora_fin, id_materia,
                        materias ( nombre_materia )
                    )
                `)
                .eq('boleta', parseInt(boleta));
 
            // Construir horario final
            const horarioFiltrado = (horarioBase || [])
                .filter(h => !idsAcreditadas.includes(h.id_materia))
                .map(h => ({
                    id_horario_grupo: h.id_horario_grupo,
                    dia:    h.dia,
                    inicio: h.hora_inicio,   // 'inicio' para compatibilidad con registro.js frontend
                    fin:    h.hora_fin,
                    materia: h.materias?.nombre_materia
                }));
 
            const horarioExtra = (extras || [])
                .map(e => e.horario_grupo)
                .filter(Boolean)
                .map(h => ({
                    id_horario_grupo: h.id_horario_grupo,
                    dia:    h.dia,
                    inicio: h.hora_inicio,
                    fin:    h.hora_fin,
                    materia: h.materias?.nombre_materia
                }));
 
            horario = [...horarioFiltrado, ...horarioExtra];
        }
 
        return res.json({
            success:  true,
            bloqueado: alumno.bloqueado,
            alumno: {
                boleta:        alumno.boleta,
                nombre:        alumno.nombre,
                nombre_grupo:  alumno.nombre_grupo,
                carrera:       alumno.carrera,
                estado:        alumno.estado_academico,
                puerta_abierta: alumno.puerta_abierta,
                bloqueado:     alumno.bloqueado,
                retardos:      alumno.retardos,
                sin_credencial: alumno.sin_credencial,
                url:           alumno.url
            },
            horario
        });
 
    } catch (error) {
        console.error('Error obteniendo alumno:', error);
        return res.status(500).json({ success: false, message: 'Error interno al buscar el alumno.' });
    }
};
 
export const buscarAlumnos = async (req, res) => {
    try {
        const query = sanitize(req.query.query || '');
        const alumnos = await Alumno.buscar(query);
        return res.json({ success: true, alumnos });
    } catch (error) {
        console.error('Error buscando:', error);
        return res.status(500).json({ success: false, message: 'Error al realizar la búsqueda.' });
    }
};
 
export const verificarBloqueo = async (req, res) => {
    try {
        const { boleta } = req.params;
        const estado = await Alumno.verificarBloqueo(boleta);
        return res.json({ success: true, bloqueado: estado });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Error al verificar estado del alumno.' });
    }
};
 
export const bloquearcredencial = async (req, res) => {
    try {
        const { boleta } = req.params;
        const result = await Alumno.bloquearCredencial(boleta);
        return result.success
            ? res.json({ success: true, message: result.message })
            : res.status(400).json({ success: false, message: result.message });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Error al intentar bloquear.' });
    }
};
 
export const desbloquearcredencial = async (req, res) => {
    try {
        const { boleta } = req.params;
        const result = await Alumno.desbloquearCredencial(boleta);
        return result.success
            ? res.json({ success: true, message: result.message })
            : res.status(400).json({ success: false, message: result.message });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Error al intentar desbloquear.' });
    }
};
 
export const registrarJustificacion = async (req, res) => {
    try {
        const id_registro          = parseInt(req.body.id_registro);
        const justificacion        = sanitize(req.body.justificacion);
        const id_usuario_autoriza  = req.session.user?.id;
 
        if (!id_registro || !justificacion) {
            return res.status(400).json({ success: false, message: 'Faltan datos para la justificación.' });
        }
 
        const resultado = await Alumno.registrarJustificacion(id_registro, justificacion, id_usuario_autoriza);
        return res.json({ success: true, message: 'Justificación registrada.', data: resultado });
    } catch (error) {
        console.error('Error en justificación:', error);
        return res.status(500).json({ success: false, message: 'No se pudo registrar la justificación.' });
    }
};
 
export const obtenerRegistrosParaJustificar = async (req, res) => {
    try {
        const { boleta } = req.params;
        if (!boleta || isNaN(boleta)) {
            return res.status(400).json({ success: false, message: 'Boleta inválida.' });
        }
        const registros = await Alumno.obtenerRegistros(boleta);
        return res.json({ success: true, data: registros });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Error al obtener historial.' });
    }
};
 
export const obtenerRegistrosAlumno = async (req, res) => {
    try {
        const { boleta } = req.params;
        const registros = await Alumno.obtenerRegistros(boleta);
        return res.json({ success: true, registros });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Error al cargar registros.' });
    }
};
 
export const registrarAlumno = async (req, res) => {
    try {
        const alumnoData = sanitizeObject(req.body);
        const result     = await Alumno.registrar(alumnoData);
        return result.success
            ? res.json({ success: true, message: result.message, boleta: alumnoData.boleta })
            : res.status(400).json({ success: false, message: result.message });
    } catch (error) {
        console.error('Error registrando:', error);
        return res.status(500).json({ success: false, message: 'Error al registrar el alumno.' });
    }
};
 
export const modificarAlumno = async (req, res) => {
    try {
        const { boleta }          = req.params;
        const { horario, ...rest } = req.body;
        const datosLimpios        = sanitizeObject(rest);
        const result = await Alumno.modificar(boleta, { ...datosLimpios, horario });
        return result.success
            ? res.json({ success: true, message: result.message, boleta })
            : res.status(400).json({ success: false, message: result.message });
    } catch (error) {
        console.error('Error modificando:', error);
        return res.status(500).json({ success: false, message: 'Error al modificar los datos.' });
    }
};
 
// DESHABILITADO — política de no borrar datos en producción
export const eliminarAlumno = async (req, res) => {
    return res.status(403).json({
        success: false,
        message: 'La eliminación de alumnos está deshabilitada. Use Baja Definitiva en estado académico.'
    });
};
 
export const obtenerGrupos = async (req, res) => {
    try {
        const grupos = await Alumno.obtenerGrupos();
        return res.json({ success: true, grupos });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Error cargando grupos.' });
    }
};
 
export const obtenerEstadosAcademicos = async (req, res) => {
    try {
        const estados = await Alumno.obtenerEstadosAcademicos();
        return res.json({ success: true, estados });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Error cargando estados.' });
    }
};
 
export const obtenerCarreras = async (req, res) => {
    try {
        const carreras = await Alumno.obtenerCarreras();
        return res.json({ success: true, carreras });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Error cargando carreras.' });
    }
};
 
export const uploadImage = async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ success: false, message: 'No se seleccionó imagen.' });
 
        const b64     = Buffer.from(req.file.buffer).toString('base64');
        const dataURI = `data:${req.file.mimetype};base64,${b64}`;
 
        const result = await cloudinary.uploader.upload(dataURI, {
            folder:        'qrpass/alumnos',
            resource_type: 'image',
            transformation: [
                { width: 300, height: 300, crop: 'fill', gravity: 'auto' },
                { quality: 'auto', fetch_format: 'auto' }
            ]
        });
 
        const optimizedUrl = getOptimizedImageUrl(result.secure_url, { width: 300, height: 300, crop: 'fill' });
 
        return res.json({ success: true, url: optimizedUrl, public_id: result.public_id });
    } catch (error) {
        console.error('Error subiendo imagen:', error);
        return res.status(500).json({ success: false, message: 'Error al subir la imagen.' });
    }
};
 
export const deleteImage = async (req, res) => {
    try {
        const { public_id } = req.body;
        if (!public_id) return res.status(400).json({ success: false, message: 'Falta identificador de imagen.' });
        await cloudinary.uploader.destroy(public_id);
        return res.json({ success: true, message: 'Imagen eliminada.' });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Error al eliminar la imagen.' });
    }
};
 
// Stub para mantener compatibilidad con rutas existentes
export const createAlumno = registrarAlumno;

