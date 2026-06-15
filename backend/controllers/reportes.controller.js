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

const sigDia = s => { const d = new Date(`${s}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + 1); return d.toISOString().slice(0, 10); };

async function boletasDentro() {
    const diaMX = new Date().toLocaleDateString('sv-SE', { timeZone: TZ });
    const { data } = await supabaseAdmin
        .from('registros_acceso')
        .select('boleta, id_tipo_registro')
        .gte('fecha_hora', `${diaMX}T06:00:00`)
        .lte('fecha_hora', `${sigDia(diaMX)}T05:59:59`)
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
                { width: colWidths[i] - PAD_X * 2, align: alignments[i] || 'left', lineBreak: false, ellipsis: true });
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
            pageW * 0.16,  // Boleta (ampliado para 10 dígitos)
            pageW * 0.29,  // Nombre
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

// ── Formato de fecha en zona horaria MX ──────────────────────
function fmtFechaMX(isoStr) {
    const d  = new Date(isoStr);
    return d.toLocaleDateString('es-MX', { timeZone: TZ, day: '2-digit', month: '2-digit', year: 'numeric' });
}
// Fecha corta DD/MM/AA (2 dígitos año) — para tablas con muchas columnas
function fmtFechaCorta(isoStr) {
    const d = new Date(isoStr);
    return d.toLocaleDateString('es-MX', { timeZone: TZ, day: '2-digit', month: '2-digit', year: '2-digit' });
}
function fmtHoraMX(isoStr) {
    const d = new Date(isoStr);
    return d.toLocaleTimeString('es-MX', { timeZone: TZ, hour: '2-digit', minute: '2-digit' });
}

// ── Gráfica de pastel (PDFKit path SVG) ──────────────────────
function dibujarPastel(doc, cx, cy, radio, segmentos) {
    // segmentos: [{pct, color, label}]  pct en 0..100
    let angulo = -Math.PI / 2;          // empieza desde arriba

    for (const seg of segmentos) {
        if (seg.pct < 0.5) continue;    // slice demasiado pequeño
        const delta = (seg.pct / 100) * 2 * Math.PI;
        const fin   = angulo + delta;

        const x1 = cx + radio * Math.cos(angulo);
        const y1 = cy + radio * Math.sin(angulo);
        const x2 = cx + radio * Math.cos(fin);
        const y2 = cy + radio * Math.sin(fin);
        const gran = delta > Math.PI ? 1 : 0;

        doc.save()
           .path(`M ${cx} ${cy} L ${x1} ${y1} A ${radio} ${radio} 0 ${gran} 1 ${x2} ${y2} Z`)
           .fill(seg.color)
           .restore();

        angulo = fin;
    }

    // Borde del pastel
    doc.save()
       .circle(cx, cy, radio)
       .lineWidth(0.6)
       .strokeColor('#cccccc')
       .stroke()
       .restore();
}

function dibujarLeyendaPastel(doc, cx, cy, radio, segmentos) {
    const startX = cx + radio + 18;
    let   startY = cy - radio * 0.5;
    const boxSize = 10;

    for (const seg of segmentos) {
        if (seg.pct < 0.5) continue;
        doc.save().rect(startX, startY, boxSize, boxSize).fill(seg.color).restore();
        doc.fontSize(8.5).font('Helvetica').fillColor('#333')
           .text(`${seg.label} (${seg.pct.toFixed(1)} %)`, startX + boxSize + 5, startY + 1);
        startY += 16;
    }
}

// ─────────────────────────────────────────────────────────────
// GET /api/reportes/registros-dia-pdf?fecha=YYYY-MM-DD
// Descarga PDF con TODOS los registros de acceso de un día.
// Columnas: Hora | Boleta | Nombre | Puertas | Puerta | Tipo
// ─────────────────────────────────────────────────────────────
export const generarRegistrosDia = async (req, res) => {
    try {
        // ── 1. Fecha objetivo (default: hoy en MX) ─────────────
        const rawFecha = sanitize(req.query.fecha || '');
        const fecha = rawFecha.match(/^\d{4}-\d{2}-\d{2}$/)
            ? rawFecha
            : new Date().toLocaleDateString('sv-SE', { timeZone: TZ });

        // ── 2. Consultar registros del día ─────────────────────
        const { data: registros, error } = await supabaseAdmin
            .from('registros_acceso')
            .select(`
                id_registro,
                boleta,
                fecha_hora,
                id_tipo_registro,
                tipos_registro  ( descripcion ),
                puntos_acceso   ( nombre_punto ),
                alumnos         ( nombre_completo ),
                usuarios_sistema:id_usuario_vigilante ( nombre_completo )
            `)
            .gte('fecha_hora', `${fecha}T06:00:00`)
            .lte('fecha_hora', `${sigDia(fecha)}T05:59:59`)
            .order('fecha_hora', { ascending: true });

        if (error) throw error;

        const filas = (registros || []).map(r => [
            fmtHoraMX(r.fecha_hora),
            String(r.boleta),
            r.alumnos?.nombre_completo || '—',
            normalizarPuerta(r.puntos_acceso?.nombre_punto),
            r.tipos_registro?.descripcion || '—',
            r.usuarios_sistema?.nombre_completo || '—',
        ]);

        // ── 3. Datos del encabezado ────────────────────────────
        const ahora   = new Date();
        const [yy, mm, dd] = fecha.split('-');
        const fechaLegible = new Date(fecha + 'T12:00:00').toLocaleDateString('es-MX', {
            day: 'numeric', month: 'long', year: 'numeric',
        });
        const horaMX  = ahora.toLocaleTimeString('es-MX', {
            timeZone: TZ, hour: '2-digit', minute: '2-digit',
        });
        const fechaStr = fecha.replace(/-/g, '');

        // ── 4. Generar PDF ─────────────────────────────────────
        const doc = new PDFDocument({
            size:    'LETTER',
            margins: { top: 70, bottom: 70, left: 60, right: 60 },
            info:    { Title: `Registros del ${fechaLegible} — QR Pass`, Author: 'CECyT 9 — IPN' },
        });

        const chunks = [];
        doc.on('data', chunk => chunks.push(chunk));
        const pdfFin = new Promise((resolve, reject) => {
            doc.on('end',   resolve);
            doc.on('error', reject);
        });

        const x0    = doc.page.margins.left;
        const pageW = doc.page.width - doc.page.margins.left - doc.page.margins.right;

        // Encabezado institucional
        doc.fontSize(15).font('Helvetica-Bold').fillColor(COLOR_GUINDA)
           .text('INSTITUTO POLITECNICO NACIONAL', { align: 'center' });
        doc.fontSize(13).font('Helvetica').fillColor('black')
           .text('CECyT 9 "JUAN DE DIOS BATIZ"', { align: 'center' });
        doc.fontSize(11)
           .text('SISTEMA DE CONTROL DE ACCESO — QR PASS', { align: 'center' });
        doc.moveDown(0.3);
        doc.fontSize(12).font('Helvetica-Bold').fillColor(COLOR_GUINDA)
           .text('REGISTRO DIARIO DE ACCESOS', { align: 'center', underline: true });
        doc.moveDown(0.35);

        // Línea separadora
        doc.save()
           .moveTo(x0, doc.y).lineTo(x0 + pageW, doc.y)
           .strokeColor(COLOR_GUINDA).lineWidth(1.2).stroke()
           .restore();
        doc.moveDown(0.6);

        // Subtítulo fecha
        doc.fontSize(11).font('Helvetica').fillColor('black')
           .text(`Fecha del reporte: `, { continued: true })
           .font('Helvetica-Bold').text(fechaLegible);
        doc.font('Helvetica').fontSize(9).fillColor('#666')
           .text(`Generado: ${ahora.toLocaleDateString('es-MX', { timeZone: TZ })} ${horaMX} hrs`);
        doc.moveDown(0.6);

        // ── Tabla principal ────────────────────────────────────
        const colWidths = [
            pageW * 0.09,   // Hora
            pageW * 0.16,   // Boleta (ampliado para 10 dígitos)
            pageW * 0.27,   // Nombre
            pageW * 0.16,   // Puerta acceso
            pageW * 0.16,   // Tipo
            pageW * 0.16,   // Vigilante
        ];
        const alignments = ['center', 'center', 'left', 'left', 'left', 'left'];
        const headers    = ['Hora', 'Boleta', 'Nombre alumno', 'Puerta acceso', 'Tipo', 'Vigilante'];

        const filasRender = filas.length
            ? filas
            : [['—', '—', 'Sin registros para este dia', '—', '—', '—']];

        dibujarTabla(doc, headers, filasRender, colWidths, alignments);

        // Total
        doc.moveDown(0.5)
           .fontSize(11).font('Helvetica').fillColor('black')
           .text('Total de registros: ', { continued: true })
           .font('Helvetica-Bold').text(String(filas.length));

        doc.end();
        await pdfFin;

        const pdfBuffer = Buffer.concat(chunks);
        const filename  = `registros_${fechaStr}.pdf`;

        res.set({
            'Content-Type':        'application/pdf',
            'Content-Disposition': `attachment; filename="${filename}"`,
            'Content-Length':      pdfBuffer.length,
        });
        return res.send(pdfBuffer);

    } catch (err) {
        console.error('Error generando registros dia:', err);
        return res.status(500).json({
            success: false,
            message: 'Error al generar el PDF: ' + err.message,
        });
    }
};

// ─────────────────────────────────────────────────────────────
// GET /api/reportes/incidencias-pdf
// Parámetros opcionales: fecha_inicio=YYYY-MM-DD & fecha_fin=YYYY-MM-DD
// ─────────────────────────────────────────────────────────────
export const generarReporteIncidencias = async (req, res) => {
    try {
        // ── 1. Leer y sanitizar filtros ───────────────────────
        const q          = sanitize(req.query.q          || '');
        const puertas    = sanitize(req.query.puertas    || '');
        const turno      = sanitize(req.query.turno      || '');
        const estado     = sanitize(req.query.estado     || '');
        const grupo      = sanitize(req.query.grupo      || '');
        const dentro     = sanitize(req.query.dentro     || '');
        const bloqueado  = sanitize(req.query.bloqueado  || '');
        const boletas    = sanitize(req.query.boletas    || '');
        // Rango de fechas (opcionales)
        const fechaInicio = sanitize(req.query.fecha_inicio || '');
        const fechaFin    = sanitize(req.query.fecha_fin    || '');

        // ── 2. Obtener alumnos filtrados ──────────────────────
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

        // ── 3. Obtener registros con filtro de fechas ─────────
        const boletasArray = alumnos.map(a => a.boleta);

        let regQuery = supabaseAdmin
            .from('registros_acceso')
            .select(`
                id_registro,
                boleta,
                fecha_hora,
                id_tipo_registro,
                tipos_registro (descripcion),
                puntos_acceso  (nombre_punto),
                justificaciones (motivo),
                usuarios_sistema:id_usuario_vigilante (nombre_completo)
            `)
            .in('boleta', boletasArray)
            .order('fecha_hora', { ascending: false });

        if (fechaInicio) regQuery = regQuery.gte('fecha_hora', `${fechaInicio}T06:00:00`);
        if (fechaFin)    regQuery = regQuery.lte('fecha_hora', `${sigDia(fechaFin)}T05:59:59`);

        const { data: registrosRaw, error: regErr } = await regQuery;
        if (regErr) throw regErr;

        const registrosPorBoleta = {};
        // Contadores para gráfica de pastel
        const conRetardo  = new Set();
        const conFalta    = new Set();

        for (const r of (registrosRaw || [])) {
            if (!registrosPorBoleta[r.boleta]) registrosPorBoleta[r.boleta] = [];
            registrosPorBoleta[r.boleta].push({
                fecha_hora:    r.fecha_hora,
                tipo:          r.tipos_registro?.descripcion || '—',
                id_tipo:       r.id_tipo_registro,
                punto_acceso:  normalizarPuerta(r.puntos_acceso?.nombre_punto),
                justificacion: r.justificaciones?.motivo || null,
                vigilante:     r.usuarios_sistema?.nombre_completo || '—',
            });
            if (r.id_tipo_registro === 3) conRetardo.add(r.boleta);
            if (r.id_tipo_registro === 5) conFalta.add(r.boleta);
        }

        // ── 4. Calcular datos para la gráfica ─────────────────
        const total     = alumnos.length;
        const nFaltas   = [...conFalta].filter(b => alumnos.some(a => a.boleta === b)).length;
        const nRetardos = [...conRetardo].filter(b => !conFalta.has(b) && alumnos.some(a => a.boleta === b)).length;
        const nNormales = total - nFaltas - nRetardos;

        const segmentos = [
            { pct: (nNormales / total) * 100, color: '#4caf50', label: 'Sin incidencias' },
            { pct: (nRetardos / total) * 100, color: '#f59e0b', label: 'Con retardo(s)'  },
            { pct: (nFaltas   / total) * 100, color: '#dc2626', label: 'Con falta(s)'    },
        ];

        // ── 5. Generar PDF ────────────────────────────────────
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
            margins: { top: 60, bottom: 60, left: 60, right: 60 },
            info:    { Title: 'Reporte de Incidencias — QR Pass', Author: 'CECyT 9 — IPN' },
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
        if (fechaInicio || fechaFin) {
            const desde = fechaInicio || 'inicio';
            const hasta = fechaFin    || 'hoy';
            doc.fontSize(9).fillColor('#1a5e20')
               .text(`Periodo: ${desde}  →  ${hasta}`);
        }
        doc.fontSize(9).fillColor('#666666')
           .text(describir_filtros({ q, turno, estado, grupo, puertas, dentro, bloqueado }));
        doc.moveDown(0.6);

        // ── Gráfica de pastel ─────────────────────────────────
        const radioP = 48;
        const cxP    = x0 + radioP + 2;
        const cyP    = doc.y + radioP + 8;

        dibujarPastel(doc, cxP, cyP, radioP, segmentos);
        dibujarLeyendaPastel(doc, cxP, cyP, radioP, segmentos);

        // Estadísticas numéricas junto al pastel
        const statsX = cxP + radioP + 130;
        const statsY = cyP - radioP + 4;
        doc.fontSize(9).font('Helvetica-Bold').fillColor('#333')
           .text('Resumen del período:', statsX, statsY);
        doc.fontSize(9).font('Helvetica').fillColor('#333')
           .text(`Total alumnos:     ${total}`,    statsX, statsY + 14)
           .text(`Sin incidencias:   ${nNormales}`, statsX, statsY + 26)
           .text(`Con retardo(s):    ${nRetardos}`, statsX, statsY + 38)
           .text(`Con falta(s):      ${nFaltas}`,   statsX, statsY + 50);

        doc.y = cyP + radioP + 14;
        doc.moveDown(0.4);

        // Separador
        doc.save()
           .moveTo(x0, doc.y).lineTo(x0 + pageW, doc.y)
           .strokeColor('#dddddd').lineWidth(0.5).stroke()
           .restore();
        doc.moveDown(0.5);

        // ── Columnas de la tabla de registros ────────────────
        const colWidths = [
            pageW * 0.12,   // Fecha (DD/MM/AA)
            pageW * 0.09,   // Hora
            pageW * 0.17,   // Puerta
            pageW * 0.17,   // Tipo
            pageW * 0.19,   // Vigilante
            pageW * 0.26,   // Justificación
        ];
        const alignments = ['center', 'center', 'left', 'left', 'left', 'left'];
        const headers    = ['Fecha', 'Hora', 'Puerta', 'Tipo', 'Vigilante', 'Justificación'];
        const bottomLimit = doc.page.height - doc.page.margins.bottom;

        // ── Sección por alumno (solo los que tienen registros) ──
        const alumnosConRegistros = alumnos.filter(a => (registrosPorBoleta[a.boleta]?.length ?? 0) > 0);

        for (const alumno of alumnosConRegistros) {
            const registros = registrosPorBoleta[alumno.boleta] || [];

            if (doc.y + 70 > bottomLimit) doc.addPage();

            // Barra del alumno — 2 líneas: boleta+nombre / grupo+turno+estado
            const barH = 40;
            const barY = doc.y;
            doc.save().rect(x0, barY, pageW, barH).fill(COLOR_GUINDA).restore();

            // Línea 1: boleta (bold) + nombre con ellipsis si es largo
            doc.fontSize(9.5).font('Helvetica-Bold').fillColor('white')
               .text(String(alumno.boleta), x0 + 6, barY + 6,
                     { width: 82, lineBreak: false });
            doc.font('Helvetica').fillColor('white')
               .text(alumno.nombre_completo, x0 + 92, barY + 6,
                     { width: pageW - 98, lineBreak: false, ellipsis: true });

            // Línea 2: grupo · turno · estado (más pequeño, color suave)
            doc.fontSize(8.5).font('Helvetica').fillColor('#f4c2d0')
               .text(`${alumno.grupo}  ·  ${alumno.turno}  ·  ${alumno.estado_academico}`,
                     x0 + 6, barY + 22,
                     { width: pageW - 12, lineBreak: false, ellipsis: true });

            doc.y = barY + barH + 3;

            const filas = registros.map(r => [
                fmtFechaCorta(r.fecha_hora),
                fmtHoraMX(r.fecha_hora),
                r.punto_acceso,
                r.tipo,
                r.vigilante,
                r.justificacion || '—',
            ]);

            dibujarTabla(doc, headers, filas, colWidths, alignments);
            doc.moveDown(0.9);
        }

        // ── Total ─────────────────────────────────────────────
        if (doc.y + 30 > bottomLimit) doc.addPage();
        doc.moveDown(0.3)
           .fontSize(11).font('Helvetica').fillColor('black')
           .text(`Alumnos con registros en el período: `, { continued: true })
           .font('Helvetica-Bold').text(String(alumnosConRegistros.length));

        doc.end();
        await pdfFin;

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

// ─────────────────────────────────────────────────────────────
// GET /api/reportes/historial-alumno-pdf?boleta=XXXXXXXXXX
//     &fecha_inicio=YYYY-MM-DD  (opcional)
//     &fecha_fin=YYYY-MM-DD     (opcional)
// PDF con el historial completo de accesos de un alumno.
// ─────────────────────────────────────────────────────────────
export const generarHistorialAlumnoPdf = async (req, res) => {
    try {
        const boleta      = parseInt(sanitize(req.query.boleta || ''));
        const fechaInicio = sanitize(req.query.fecha_inicio || '');
        const fechaFin    = sanitize(req.query.fecha_fin    || '');

        if (!boleta || isNaN(boleta)) {
            return res.status(400).json({ success: false, message: 'Boleta inválida.' });
        }

        // ── 1. Datos del alumno ───────────────────────────────
        const { data: alumnoRaw, error: e0 } = await supabaseAdmin
            .from('alumnos')
            .select(`
                boleta, nombre_completo,
                grupos:id_grupo_base ( nombre_grupo, turnos:id_turno ( nombre_turno ) ),
                estado_academico:id_estado_academico ( estado )
            `)
            .eq('boleta', boleta)
            .maybeSingle();

        if (e0) throw e0;
        if (!alumnoRaw) {
            return res.status(404).json({ success: false, message: 'Alumno no encontrado.' });
        }

        const alumno = {
            boleta:           alumnoRaw.boleta,
            nombre_completo:  alumnoRaw.nombre_completo,
            grupo:            alumnoRaw.grupos?.nombre_grupo         || 'Sin Grupo',
            turno:            alumnoRaw.grupos?.turnos?.nombre_turno || 'Sin Turno',
            estado_academico: alumnoRaw.estado_academico?.estado     || 'Desconocido',
        };

        // ── 2. Registros del alumno ───────────────────────────
        let regQuery = supabaseAdmin
            .from('registros_acceso')
            .select(`
                id_registro, fecha_hora, id_tipo_registro,
                tipos_registro  ( descripcion ),
                puntos_acceso   ( nombre_punto ),
                justificaciones ( motivo ),
                usuarios_sistema:id_usuario_vigilante ( nombre_completo )
            `)
            .eq('boleta', boleta)
            .order('fecha_hora', { ascending: false });

        if (fechaInicio) regQuery = regQuery.gte('fecha_hora', `${fechaInicio}T06:00:00`);
        if (fechaFin)    regQuery = regQuery.lte('fecha_hora', `${sigDia(fechaFin)}T05:59:59`);

        const { data: registros, error: e1 } = await regQuery;
        if (e1) throw e1;

        // ── 3. Generar PDF ────────────────────────────────────
        const ahora   = new Date();
        const fechaMX = ahora.toLocaleDateString('es-MX', { timeZone: TZ, day: 'numeric', month: 'long', year: 'numeric' });
        const horaMX  = ahora.toLocaleTimeString('es-MX', { timeZone: TZ, hour: '2-digit', minute: '2-digit' });
        const fechaStr = ahora.toLocaleDateString('sv-SE', { timeZone: TZ }).replace(/-/g, '');

        const doc = new PDFDocument({
            size:    'LETTER',
            margins: { top: 60, bottom: 60, left: 60, right: 60 },
            info:    { Title: `Historial — ${alumno.nombre_completo}`, Author: 'CECyT 9 — IPN' },
        });

        const chunks = [];
        doc.on('data', chunk => chunks.push(chunk));
        const pdfFin = new Promise((resolve, reject) => { doc.on('end', resolve); doc.on('error', reject); });

        const x0    = doc.page.margins.left;
        const pageW = doc.page.width - doc.page.margins.left - doc.page.margins.right;

        // Encabezado institucional
        doc.fontSize(15).font('Helvetica-Bold').fillColor(COLOR_GUINDA)
           .text('INSTITUTO POLITÉCNICO NACIONAL', { align: 'center' });
        doc.fontSize(13).font('Helvetica').fillColor('black')
           .text('CECyT 9 "JUAN DE DIOS BÁTIZ"', { align: 'center' });
        doc.fontSize(11)
           .text('SISTEMA DE CONTROL DE ACCESO — QR PASS', { align: 'center' });
        doc.moveDown(0.3);
        doc.fontSize(12).font('Helvetica-Bold').fillColor(COLOR_GUINDA)
           .text('HISTORIAL DE ACCESOS — ALUMNO', { align: 'center', underline: true });
        doc.moveDown(0.4);

        // Línea separadora
        doc.save()
           .moveTo(x0, doc.y).lineTo(x0 + pageW, doc.y)
           .strokeColor(COLOR_GUINDA).lineWidth(1.2).stroke()
           .restore();
        doc.moveDown(0.5);

        // Barra de datos del alumno
        const barH = 42;
        const barY = doc.y;
        doc.save().rect(x0, barY, pageW, barH).fill(COLOR_GUINDA).restore();
        doc.fontSize(10).font('Helvetica-Bold').fillColor('white')
           .text(String(alumno.boleta), x0 + 6, barY + 6, { width: 90, lineBreak: false });
        doc.font('Helvetica').fillColor('white')
           .text(alumno.nombre_completo, x0 + 100, barY + 6,
                 { width: pageW - 106, lineBreak: false, ellipsis: true });
        doc.fontSize(8.5).font('Helvetica').fillColor('#f4c2d0')
           .text(`${alumno.grupo}  ·  ${alumno.turno}  ·  ${alumno.estado_academico}`,
                 x0 + 6, barY + 24, { width: pageW - 12, lineBreak: false, ellipsis: true });
        doc.y = barY + barH + 8;

        // Período y fecha de emisión
        doc.fontSize(9).font('Helvetica').fillColor('#444')
           .text(`Emitido: ${fechaMX}, ${horaMX} hrs`);
        if (fechaInicio || fechaFin) {
            doc.fontSize(9).fillColor('#1a5e20')
               .text(`Período: ${fechaInicio || '—'}  →  ${fechaFin || '—'}`);
        }
        doc.moveDown(0.6);

        // Tabla de registros
        const colWidths = [
            pageW * 0.12,   // Fecha
            pageW * 0.09,   // Hora
            pageW * 0.18,   // Puerta
            pageW * 0.16,   // Tipo
            pageW * 0.20,   // Vigilante
            pageW * 0.25,   // Justificación
        ];
        const alignments = ['center', 'center', 'left', 'left', 'left', 'left'];
        const headers    = ['Fecha', 'Hora', 'Puerta', 'Tipo', 'Vigilante', 'Justificación'];

        const filas = (registros || []).map(r => [
            fmtFechaCorta(r.fecha_hora),
            fmtHoraMX(r.fecha_hora),
            normalizarPuerta(r.puntos_acceso?.nombre_punto),
            r.tipos_registro?.descripcion || '—',
            r.usuarios_sistema?.nombre_completo || '—',
            r.justificaciones?.motivo || '—',
        ]);

        if (filas.length) {
            dibujarTabla(doc, headers, filas, colWidths, alignments);
        } else {
            doc.fontSize(10).font('Helvetica').fillColor('#888')
               .text('Sin registros en el período seleccionado.', x0, doc.y);
        }

        // Total
        doc.moveDown(0.5)
           .fontSize(10).font('Helvetica').fillColor('black')
           .text('Total de registros: ', { continued: true })
           .font('Helvetica-Bold').text(String(filas.length));

        doc.end();
        await pdfFin;

        const pdfBuffer = Buffer.concat(chunks);
        res.set({
            'Content-Type':        'application/pdf',
            'Content-Disposition': `attachment; filename="historial_${boleta}_${fechaStr}.pdf"`,
            'Content-Length':      pdfBuffer.length,
        });
        return res.send(pdfBuffer);

    } catch (err) {
        console.error('Error generando historial PDF:', err);
        return res.status(500).json({ success: false, message: 'Error al generar el PDF: ' + err.message });
    }
};
