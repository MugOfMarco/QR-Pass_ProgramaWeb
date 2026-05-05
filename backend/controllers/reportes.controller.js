// backend/controllers/reportes.controller.js
// ============================================================
// Genera el PDF de reporte de alumnos con pdfkit (Node.js puro).
// Reemplaza la implementación anterior que dependía de Python.
//
// Flujo:
//   1. Consulta Supabase con los mismos filtros que buscarAlumnos
//   2. Aplica filtros adicionales (grupo, dentro, bloqueado)
//   3. Genera PDF en memoria con pdfkit
//   4. Devuelve el PDF como stream de descarga
// ============================================================
import { supabaseAdmin } from '../database/supabase.js';
import sanitizeHtml      from 'sanitize-html';
import PDFDocument       from 'pdfkit';

const sanitize = (v) => typeof v === 'string'
    ? sanitizeHtml(v, { allowedTags: [], allowedAttributes: {} })
    : v;

function normalizarPuerta(nombre) {
    if (!nombre) return '—';
    const n = String(nombre).toLowerCase()
        .normalize('NFD').replace(/[̀-ͯ]/g, '');
    if (n.includes('mexico') || n.includes('tacuba') || n.includes('norte') || n === '1') return 'México-Tacuba';
    if (n.includes('mar') || n.includes('mediterraneo') || n.includes('sur') || n === '2') return 'Mar-Mediterráneo';
    return nombre;
}

const TZ             = 'America/Mexico_City';
const TIPOS_ENTRADA  = new Set([1, 3, 4]);
const COLOR_GUINDA   = '#5c1f33';
const COLOR_ALT      = '#fdf8f9';
const COLOR_GRID     = '#cccccc';

// ── Helpers de filtros ────────────────────────────────────────

async function boletasDentro() {
    const diaMX = new Date().toLocaleDateString('sv-SE', { timeZone: TZ });
    const { data } = await supabaseAdmin
        .from('registros_acceso')
        .select('boleta, id_tipo_registro')
        .gte('fecha_hora', `${diaMX}T00:00:00-06:00`)
        .lte('fecha_hora', `${diaMX}T23:59:59-06:00`)
        .order('fecha_hora', { ascending: true });

    const ultimo = {};
    for (const r of (data || [])) ultimo[r.boleta] = r.id_tipo_registro;
    return new Set(
        Object.entries(ultimo)
            .filter(([, t]) => TIPOS_ENTRADA.has(t))
            .map(([b]) => parseInt(b))
    );
}

async function boletasBloqueadas() {
    const { data } = await supabaseAdmin
        .from('info_alumno')
        .select('boleta')
        .or('bloqueado_manual.eq.true,bloqueado_sistema.eq.true');
    return new Set((data || []).map(b => b.boleta));
}

// ── Dibuja tabla en el PDF ────────────────────────────────────

function dibujarTabla(doc, headers, rows, colWidths, alignments) {
    const HEADER_H    = 24;
    const ROW_H       = 20;
    const PAD_X       = 5;
    const totalW      = colWidths.reduce((a, b) => a + b, 0);
    const x0          = doc.page.margins.left;
    const bottomLimit = doc.page.height - doc.page.margins.bottom;

    function dibujarEncabezado(yPos) {
        doc.save().rect(x0, yPos, totalW, HEADER_H).fill(COLOR_GUINDA).restore();
        doc.fontSize(10).font('Helvetica-Bold').fillColor('white');
        let xPos = x0;
        headers.forEach((h, i) => {
            doc.text(h, xPos + PAD_X, yPos + 7,
                { width: colWidths[i] - PAD_X * 2, align: 'center', lineBreak: false });
            xPos += colWidths[i];
        });
        return yPos + HEADER_H;
    }

    function dibujarFila(row, yPos, idx) {
        if (idx % 2 === 1) {
            doc.save().rect(x0, yPos, totalW, ROW_H).fill(COLOR_ALT).restore();
        }
        doc.fontSize(9.5).font('Helvetica').fillColor('black');
        let xPos = x0;
        row.forEach((cell, i) => {
            doc.text(String(cell ?? '—'), xPos + PAD_X, yPos + 5,
                { width: colWidths[i] - PAD_X * 2, align: alignments[i] || 'left', lineBreak: false });
            xPos += colWidths[i];
        });
        doc.save()
            .moveTo(x0, yPos + ROW_H).lineTo(x0 + totalW, yPos + ROW_H)
            .strokeColor(COLOR_GRID).lineWidth(0.5).stroke()
            .restore();
        return yPos + ROW_H;
    }

    let y = doc.y;
    y = dibujarEncabezado(y);

    rows.forEach((row, idx) => {
        if (y + ROW_H > bottomLimit) {
            doc.addPage();
            y = doc.page.margins.top;
            y = dibujarEncabezado(y);
        }
        y = dibujarFila(row, y, idx);
    });

    doc.y = y;
}

// ── Descripción legible de filtros activos ────────────────────

function describir_filtros(filtros) {
    const partes = [];
    if (filtros.q)                    partes.push(`Búsqueda: "${filtros.q}"`);
    if (filtros.turno)                partes.push(`Turno: ${filtros.turno}`);
    if (filtros.estado)               partes.push(`Situación: ${filtros.estado}`);
    if (filtros.grupo)                partes.push(`Grupo: ${filtros.grupo}`);
    if (filtros.puertas === 'true')   partes.push('Puertas: Sí');
    if (filtros.puertas === 'false')  partes.push('Puertas: No');
    if (filtros.dentro === 'true')    partes.push('Presencia: Dentro del plantel');
    if (filtros.dentro === 'false')   partes.push('Presencia: Fuera del plantel');
    if (filtros.bloqueado === 'true') partes.push('Credencial: Bloqueados');
    return partes.length ? partes.join(' | ') : 'Sin filtros aplicados (todos los alumnos)';
}

// ─────────────────────────────────────────────────────────────
// GET /api/reportes/alumnos-pdf
// ─────────────────────────────────────────────────────────────
export const generarReporteAlumnos = async (req, res) => {
    try {
        // ── 1. Leer y sanitizar filtros ───────────────────────
        const q        = sanitize(req.query.q        || '');
        const puertas  = sanitize(req.query.puertas  || '');
        const turno    = sanitize(req.query.turno    || '');
        const estado   = sanitize(req.query.estado   || '');
        const grupo    = sanitize(req.query.grupo    || '');
        const dentro   = sanitize(req.query.dentro   || '');
        const bloqueado = sanitize(req.query.bloqueado || '');
        const boletas  = sanitize(req.query.boletas  || '');

        // ── 2. Consultar Supabase ─────────────────────────────
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
            if (!isNaN(q)) query = query.eq('boleta', parseInt(q));
            else           query = query.ilike('nombre_completo', `%${q}%`);
        }
        if (puertas === 'true')  query = query.eq('puertas_abiertas', true);
        if (puertas === 'false') query = query.eq('puertas_abiertas', false);

        const { data: raw, error } = await query;
        if (error) throw error;

        // ── 3. Mapear y aplicar filtros en memoria ────────────
        let alumnos = raw.map(al => ({
            boleta:           al.boleta,
            nombre_completo:  al.nombre_completo,
            puertas_abiertas: al.puertas_abiertas,
            estado_academico: al.estado_academico?.estado    || 'Desconocido',
            grupo:            al.grupos?.nombre_grupo         || 'Sin Grupo',
            turno:            al.grupos?.turnos?.nombre_turno || 'Sin Turno',
        }));

        if (turno)  alumnos = alumnos.filter(a => a.turno  === turno);
        if (estado) alumnos = alumnos.filter(a => a.estado_academico === estado);
        if (grupo)  alumnos = alumnos.filter(a => a.grupo  === grupo);

        if (bloqueado === 'true') {
            const set = await boletasBloqueadas();
            alumnos = alumnos.filter(a => set.has(a.boleta));
        }

        if (dentro === 'true' || dentro === 'false') {
            const set = await boletasDentro();
            if (dentro === 'true')  alumnos = alumnos.filter(a => set.has(a.boleta));
            else                    alumnos = alumnos.filter(a => !set.has(a.boleta));
        }

        if (boletas) {
            const set = new Set(boletas.split(',').map(b => parseInt(b.trim())).filter(n => !isNaN(n)));
            alumnos = alumnos.filter(a => set.has(a.boleta));
        }

        // ── 4. Generar PDF con pdfkit ─────────────────────────
        const ahora   = new Date();
        const fechaMX = ahora.toLocaleDateString('es-MX', {
            timeZone: TZ, day: 'numeric', month: 'long', year: 'numeric',
        });
        const horaMX  = ahora.toLocaleTimeString('es-MX', {
            timeZone: TZ, hour: '2-digit', minute: '2-digit',
        });
        const fechaStr = ahora.toLocaleDateString('sv-SE', { timeZone: TZ }).replace(/-/g, '');

        const doc = new PDFDocument({
            size:    'LETTER',
            margins: { top: 70, bottom: 70, left: 85, right: 85 },
            info:    {
                Title:  'Reporte de Gestión de Alumnos — QR Pass',
                Author: 'CECyT 9 — IPN',
            },
        });

        const chunks = [];
        doc.on('data', chunk => chunks.push(chunk));
        const pdfFin = new Promise((resolve, reject) => {
            doc.on('end',   resolve);
            doc.on('error', reject);
        });

        // ── Encabezado institucional ──────────────────────────
        doc.fontSize(16).font('Helvetica-Bold').fillColor(COLOR_GUINDA)
           .text('INSTITUTO POLITÉCNICO NACIONAL', { align: 'center' });
        doc.fontSize(14).font('Helvetica').fillColor('black')
           .text('CECyT 9 "JUAN DE DIOS BÁTIZ"', { align: 'center' });
        doc.fontSize(12)
           .text('SISTEMA DE CONTROL DE ACCESO — QR PASS', { align: 'center' });
        doc.moveDown(0.3);
        doc.fontSize(12).font('Helvetica')
           .text('REPORTE DE GESTIÓN DE ALUMNOS', { align: 'center', underline: true });
        doc.moveDown(0.4);

        // Línea separadora
        const x0    = doc.page.margins.left;
        const pageW = doc.page.width - doc.page.margins.left - doc.page.margins.right;
        doc.save()
           .moveTo(x0, doc.y).lineTo(x0 + pageW, doc.y)
           .strokeColor(COLOR_GUINDA).lineWidth(1).stroke()
           .restore();
        doc.moveDown(0.6);

        // Fecha de emisión y filtros activos
        doc.fontSize(11).font('Helvetica').fillColor('black')
           .text(`Emitido el: ${fechaMX}, ${horaMX} hrs`);
        doc.fontSize(9).fillColor('#666666')
           .text(describir_filtros({ q, turno, estado, grupo, puertas, dentro, bloqueado }));
        doc.moveDown(0.5);

        // ── Tabla de alumnos ──────────────────────────────────
        const colWidths = [
            pageW * 0.13,  // Boleta
            pageW * 0.32,  // Nombre
            pageW * 0.13,  // Grupo
            pageW * 0.12,  // Turno
            pageW * 0.17,  // Situación
            pageW * 0.13,  // Puertas
        ];
        const alignments = ['center', 'left', 'left', 'center', 'left', 'center'];
        const headers    = ['Boleta', 'Nombre completo', 'Grupo', 'Turno', 'Situación', 'Puertas'];

        const filas = alumnos.length
            ? alumnos.map(a => [
                String(a.boleta),
                a.nombre_completo,
                a.grupo,
                a.turno,
                a.estado_academico,
                a.puertas_abiertas ? 'Sí' : 'No',
              ])
            : [['—', 'No se encontraron alumnos con estos filtros', '—', '—', '—', '—']];

        dibujarTabla(doc, headers, filas, colWidths, alignments);

        // ── Total ─────────────────────────────────────────────
        doc.moveDown(0.5)
           .fontSize(11).font('Helvetica').fillColor('black')
           .text(`Total de alumnos en el reporte: `, { continued: true })
           .font('Helvetica-Bold').text(String(alumnos.length));

        doc.end();
        await pdfFin;

        // ── 5. Enviar respuesta ───────────────────────────────
        const pdfBuffer = Buffer.concat(chunks);
        const filename  = `reporte_alumnos_${fechaStr}.pdf`;

        res.set({
            'Content-Type':        'application/pdf',
            'Content-Disposition': `attachment; filename="${filename}"`,
            'Content-Length':      pdfBuffer.length,
        });
        return res.send(pdfBuffer);

    } catch (err) {
        console.error('Error generando reporte PDF:', err);
        return res.status(500).json({
            success: false,
            message: 'Error al generar el reporte PDF: ' + err.message,
        });
    }
};

// ─────────────────────────────────────────────────────────────
// GET /api/reportes/incidencias-pdf
// ─────────────────────────────────────────────────────────────
export const generarReporteIncidencias = async (req, res) => {
    try {
        // ── 1. Leer y sanitizar filtros ───────────────────────
        const q        = sanitize(req.query.q        || '');
        const puertas  = sanitize(req.query.puertas  || '');
        const turno    = sanitize(req.query.turno    || '');
        const estado   = sanitize(req.query.estado   || '');
        const grupo    = sanitize(req.query.grupo    || '');
        const dentro   = sanitize(req.query.dentro   || '');
        const bloqueado = sanitize(req.query.bloqueado || '');
        const boletas  = sanitize(req.query.boletas  || '');

        // ── 2. Obtener alumnos filtrados (mismo flujo que alumnos-pdf) ──
        let query = supabaseAdmin
            .from('alumnos')
            .select(`
                boleta,
                nombre_completo,
                estado_academico:id_estado_academico (estado),
                grupos:id_grupo_base (
                    nombre_grupo,
                    turnos:id_turno (nombre_turno)
                )
            `);

        if (q) {
            if (!isNaN(q)) query = query.eq('boleta', parseInt(q));
            else           query = query.ilike('nombre_completo', `%${q}%`);
        }
        if (puertas === 'true')  query = query.eq('puertas_abiertas', true);
        if (puertas === 'false') query = query.eq('puertas_abiertas', false);

        const { data: raw, error } = await query;
        if (error) throw error;

        let alumnos = raw.map(al => ({
            boleta:           al.boleta,
            nombre_completo:  al.nombre_completo,
            estado_academico: al.estado_academico?.estado    || 'Desconocido',
            grupo:            al.grupos?.nombre_grupo         || 'Sin Grupo',
            turno:            al.grupos?.turnos?.nombre_turno || 'Sin Turno',
        }));

        if (turno)  alumnos = alumnos.filter(a => a.turno  === turno);
        if (estado) alumnos = alumnos.filter(a => a.estado_academico === estado);
        if (grupo)  alumnos = alumnos.filter(a => a.grupo  === grupo);

        if (bloqueado === 'true') {
            const set = await boletasBloqueadas();
            alumnos = alumnos.filter(a => set.has(a.boleta));
        }

        if (dentro === 'true' || dentro === 'false') {
            const set = await boletasDentro();
            if (dentro === 'true')  alumnos = alumnos.filter(a => set.has(a.boleta));
            else                    alumnos = alumnos.filter(a => !set.has(a.boleta));
        }

        if (boletas) {
            const set = new Set(boletas.split(',').map(b => parseInt(b.trim())).filter(n => !isNaN(n)));
            alumnos = alumnos.filter(a => set.has(a.boleta));
        }

        if (!alumnos.length) {
            return res.status(404).json({ success: false, message: 'No se encontraron alumnos con los filtros aplicados.' });
        }

        // ── 3. Obtener todos los registros de los alumnos filtrados ──
        const boletasArray = alumnos.map(a => a.boleta);

        const { data: registrosRaw, error: regErr } = await supabaseAdmin
            .from('registros_acceso')
            .select(`
                id_registro,
                boleta,
                fecha_hora,
                tipos_registro (descripcion),
                puntos_acceso  (nombre_punto),
                justificaciones (motivo)
            `)
            .in('boleta', boletasArray)
            .order('fecha_hora', { ascending: false });

        if (regErr) throw regErr;

        const registrosPorBoleta = {};
        for (const r of (registrosRaw || [])) {
            if (!registrosPorBoleta[r.boleta]) registrosPorBoleta[r.boleta] = [];
            registrosPorBoleta[r.boleta].push({
                fecha_hora:    r.fecha_hora,
                tipo:          r.tipos_registro?.descripcion || '—',
                punto_acceso:  normalizarPuerta(r.puntos_acceso?.nombre_punto),
                justificacion: r.justificaciones?.motivo || null,
            });
        }

        // ── 4. Generar PDF ────────────────────────────────────
        const ahora   = new Date();
        const fechaMX = ahora.toLocaleDateString('es-MX', {
            timeZone: TZ, day: 'numeric', month: 'long', year: 'numeric',
        });
        const horaMX  = ahora.toLocaleTimeString('es-MX', {
            timeZone: TZ, hour: '2-digit', minute: '2-digit',
        });
        const fechaStr = ahora.toLocaleDateString('sv-SE', { timeZone: TZ }).replace(/-/g, '');

        const doc = new PDFDocument({
            size:    'LETTER',
            margins: { top: 70, bottom: 70, left: 85, right: 85 },
            info:    {
                Title:  'Reporte de Incidencias — QR Pass',
                Author: 'CECyT 9 — IPN',
            },
        });

        const chunks = [];
        doc.on('data', chunk => chunks.push(chunk));
        const pdfFin = new Promise((resolve, reject) => {
            doc.on('end',   resolve);
            doc.on('error', reject);
        });

        const x0    = doc.page.margins.left;
        const pageW = doc.page.width - doc.page.margins.left - doc.page.margins.right;

        // ── Encabezado institucional ──────────────────────────
        doc.fontSize(16).font('Helvetica-Bold').fillColor(COLOR_GUINDA)
           .text('INSTITUTO POLITÉCNICO NACIONAL', { align: 'center' });
        doc.fontSize(14).font('Helvetica').fillColor('black')
           .text('CECyT 9 "JUAN DE DIOS BÁTIZ"', { align: 'center' });
        doc.fontSize(12)
           .text('SISTEMA DE CONTROL DE ACCESO — QR PASS', { align: 'center' });
        doc.moveDown(0.3);
        doc.fontSize(12).font('Helvetica')
           .text('REPORTE DE INCIDENCIAS Y JUSTIFICACIONES', { align: 'center', underline: true });
        doc.moveDown(0.4);

        doc.save()
           .moveTo(x0, doc.y).lineTo(x0 + pageW, doc.y)
           .strokeColor(COLOR_GUINDA).lineWidth(1).stroke()
           .restore();
        doc.moveDown(0.6);

        doc.fontSize(11).font('Helvetica').fillColor('black')
           .text(`Emitido el: ${fechaMX}, ${horaMX} hrs`);
        doc.fontSize(9).fillColor('#666666')
           .text(describir_filtros({ q, turno, estado, grupo, puertas, dentro, bloqueado }));
        doc.moveDown(0.8);

        // ── Columnas de la tabla de registros ────────────────
        const colWidths = [
            pageW * 0.14,   // Fecha
            pageW * 0.11,   // Hora
            pageW * 0.22,   // Puerta
            pageW * 0.23,   // Tipo
            pageW * 0.30,   // Justificación
        ];
        const alignments = ['center', 'center', 'left', 'left', 'left'];
        const headers    = ['Fecha', 'Hora', 'Puerta', 'Tipo', 'Justificación'];
        const bottomLimit = doc.page.height - doc.page.margins.bottom;

        // ── Sección por alumno ────────────────────────────────
        for (const alumno of alumnos) {
            const registros = registrosPorBoleta[alumno.boleta] || [];

            if (doc.y + 60 > bottomLimit) {
                doc.addPage();
            }

            // Barra de encabezado del alumno
            const barY = doc.y;
            doc.save().rect(x0, barY, pageW, 22).fill(COLOR_GUINDA).restore();
            doc.fontSize(9.5).font('Helvetica-Bold').fillColor('white')
               .text(
                   `${alumno.boleta}  ·  ${alumno.nombre_completo}  ·  ${alumno.grupo}  ·  ${alumno.turno}  ·  ${alumno.estado_academico}`,
                   x0 + 5, barY + 6,
                   { width: pageW - 10, align: 'left', lineBreak: false }
               );
            doc.y = barY + 26;

            if (!registros.length) {
                doc.fontSize(9).font('Helvetica').fillColor('#888888')
                   .text('Sin registros de acceso.', x0 + 5, doc.y);
                doc.moveDown(0.9);
                continue;
            }

            const filas = registros.map(r => {
                const d   = new Date(r.fecha_hora);
                const dMX = new Date(d.getTime() - 6 * 60 * 60 * 1000);
                return [
                    `${String(dMX.getUTCDate()).padStart(2,'0')}/${String(dMX.getUTCMonth()+1).padStart(2,'0')}/${dMX.getUTCFullYear()}`,
                    `${String(dMX.getUTCHours()).padStart(2,'0')}:${String(dMX.getUTCMinutes()).padStart(2,'0')}`,
                    r.punto_acceso,
                    r.tipo,
                    r.justificacion || '—',
                ];
            });

            dibujarTabla(doc, headers, filas, colWidths, alignments);
            doc.moveDown(0.9);
        }

        // ── Total ─────────────────────────────────────────────
        if (doc.y + 30 > bottomLimit) doc.addPage();
        doc.moveDown(0.3)
           .fontSize(11).font('Helvetica').fillColor('black')
           .text(`Total de alumnos en el reporte: `, { continued: true })
           .font('Helvetica-Bold').text(String(alumnos.length));

        doc.end();
        await pdfFin;

        // ── 5. Enviar respuesta ───────────────────────────────
        const pdfBuffer = Buffer.concat(chunks);
        const filename  = `incidencias_alumnos_${fechaStr}.pdf`;

        res.set({
            'Content-Type':        'application/pdf',
            'Content-Disposition': `attachment; filename="${filename}"`,
            'Content-Length':      pdfBuffer.length,
        });
        return res.send(pdfBuffer);

    } catch (err) {
        console.error('Error generando reporte incidencias:', err);
        return res.status(500).json({
            success: false,
            message: 'Error al generar el reporte de incidencias: ' + err.message,
        });
    }
};
