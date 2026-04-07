// backend/controllers/reportes.controller.js
// ============================================================
// Genera el PDF de reporte de alumnos usando Python + reportlab.
//
// Flujo:
//   1. Consulta Supabase con los mismos filtros que buscarAlumnos
//   2. Serializa los datos como JSON
//   3. Llama al script Python que genera el PDF en memoria
//   4. Devuelve el PDF como stream de descarga
// ============================================================
import { supabaseAdmin } from '../database/supabase.js';
import sanitizeHtml      from 'sanitize-html';
import { execFile }      from 'child_process';
import { promisify }     from 'util';
import path              from 'path';
import { fileURLToPath } from 'url';

const execFileAsync = promisify(execFile);

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const sanitize = (v) => typeof v === 'string'
    ? sanitizeHtml(v, { allowedTags: [], allowedAttributes: {} })
    : v;

// ─────────────────────────────────────────────────────────────
// GET /api/reportes/alumnos-pdf
// ─────────────────────────────────────────────────────────────
export const generarReporteAlumnos = async (req, res) => {
    try {
        // ── 1. Leer y sanitizar filtros ───────────────────────
        const q       = sanitize(req.query.q       || '');
        const puertas = sanitize(req.query.puertas || '');
        const turno   = sanitize(req.query.turno   || '');
        const estado  = sanitize(req.query.estado  || '');

        // ── 2. Consultar Supabase (igual que buscarAlumnos) ───
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

        if (q) {
            if (!isNaN(q)) {
                query = query.eq('boleta', parseInt(q));
            } else {
                query = query.ilike('nombre_completo', `%${q}%`);
            }
        }

        if (puertas === 'true')  query = query.eq('puertas_abiertas', true);
        if (puertas === 'false') query = query.eq('puertas_abiertas', false);

        const { data: alumnosRaw, error } = await query;
        if (error) throw error;

        // ── 3. Mapear y filtrar en memoria ────────────────────
        let alumnos = alumnosRaw.map(al => ({
            boleta:           al.boleta,
            nombre_completo:  al.nombre_completo,
            puertas_abiertas: al.puertas_abiertas,
            estado_academico: al.estado_academico?.estado    || 'Desconocido',
            grupo:            al.grupos?.nombre_grupo         || 'Sin Grupo',
            turno:            al.grupos?.turnos?.nombre_turno || 'Sin Turno',
        }));

        if (turno)  alumnos = alumnos.filter(a => a.turno   === turno);
        if (estado) alumnos = alumnos.filter(a => a.estado_academico === estado);

        // ── 4. Llamar al script Python ────────────────────────
        const scriptPath = path.join(__dirname, '..', 'scripts', 'generar_reporte_pdf.py');
        const jsonInput  = JSON.stringify({ alumnos, filtros: { q, turno, puertas, estado } });

        const { stdout, stderr } = await execFileAsync(
            'python3',
            [scriptPath],
            {
                input:    jsonInput,
                encoding: 'buffer',   // stdout como Buffer (bytes del PDF)
                maxBuffer: 20 * 1024 * 1024,  // 20 MB máximo
            }
        );

        if (stderr && stderr.length > 0) {
            const errStr = stderr.toString();
            // Sólo advertencias de Python — ignorar si el PDF se generó
            console.warn('Python stderr:', errStr);
        }

        if (!stdout || stdout.length < 100) {
            throw new Error('El script Python no generó un PDF válido');
        }

        // Verificar cabecera PDF
        if (stdout.slice(0, 5).toString() !== '%PDF-') {
            const errMsg = stdout.toString('utf8').slice(0, 300);
            throw new Error(`Script Python devolvió error: ${errMsg}`);
        }

        // ── 5. Responder con el PDF ───────────────────────────
        const ahora    = new Date();
        const fechaStr = `${ahora.getFullYear()}${String(ahora.getMonth()+1).padStart(2,'0')}${String(ahora.getDate()).padStart(2,'0')}`;
        const filename = `reporte_alumnos_${fechaStr}.pdf`;

        res.set({
            'Content-Type':        'application/pdf',
            'Content-Disposition': `attachment; filename="${filename}"`,
            'Content-Length':      stdout.length,
        });

        return res.send(stdout);

    } catch (err) {
        console.error('Error generando reporte PDF:', err);
        return res.status(500).json({
            success: false,
            message: 'Error al generar el reporte PDF: ' + err.message,
        });
    }
};