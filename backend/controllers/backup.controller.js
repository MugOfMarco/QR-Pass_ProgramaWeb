// backend/controllers/backup.controller.js
// Genera un dump SQL con INSERT ... ON CONFLICT DO NOTHING
// para cada tabla, en el orden correcto de dependencias FK.
import { supabaseAdmin } from '../database/supabase.js';

const TABLAS = [
    'configuracion_sistema',
    'semestres',
    'carreras',
    'turnos',
    'grupos',
    'estado_academico',
    'roles',
    'materias',
    'alumnos',
    'info_alumno',
    'usuarios_sistema',
    'puntos_acceso',
    'tipos_registro',
    'registros_acceso',
    'justificaciones',
    'horario_grupo',
    'horario_alumno_extra',
    'materias_acreditadas',
];

// ── Paginación para tablas grandes ────────────────────────────
async function fetchAll(tabla) {
    let all  = [];
    let from = 0;
    const PAGE = 1000;
    while (true) {
        const { data, error } = await supabaseAdmin
            .from(tabla).select('*').range(from, from + PAGE - 1);
        if (error) throw new Error(`${tabla}: ${error.message}`);
        if (!data?.length) break;
        all = all.concat(data);
        if (data.length < PAGE) break;
        from += PAGE;
    }
    return all;
}

// ── Escapar un valor para SQL ─────────────────────────────────
function sqlVal(v) {
    if (v === null || v === undefined) return 'NULL';
    if (typeof v === 'boolean')        return v ? 'TRUE' : 'FALSE';
    if (typeof v === 'number')         return String(v);
    if (typeof v === 'object')         return `'${JSON.stringify(v).replace(/'/g, "''")}'`;
    // string (incluyendo fechas/timestamps)
    return `'${String(v).replace(/'/g, "''")}'`;
}

// ── Convertir filas de una tabla a bloque SQL ─────────────────
function tablaSql(nombre, rows) {
    const sep = '-- ' + '─'.repeat(60);
    if (!rows.length) {
        return `${sep}\n-- Tabla: ${nombre}  (sin datos)\n${sep}\n\n`;
    }

    const cols    = Object.keys(rows[0]);
    const colList = cols.join(', ');
    const inserts = rows.map(row => {
        const vals = cols.map(c => sqlVal(row[c])).join(', ');
        return `INSERT INTO ${nombre} (${colList})\nVALUES (${vals})\nON CONFLICT DO NOTHING;`;
    });

    return [
        sep,
        `-- Tabla: ${nombre}  (${rows.length} fila${rows.length !== 1 ? 's' : ''})`,
        sep,
        '',
        ...inserts,
        '',
    ].join('\n');
}

// ── Controlador principal ─────────────────────────────────────
export const descargarRespaldo = async (req, res) => {
    try {
        const fechaISO = new Date().toISOString();
        const fechaStr = fechaISO.split('T')[0].replace(/-/g, '');
        const usuario  = req.session.user?.usuario || 'admin';

        const resultados = await Promise.allSettled(
            TABLAS.map(t => fetchAll(t).then(rows => ({ tabla: t, rows })))
        );

        let totalRegistros = 0;
        const bloques = [];

        for (const r of resultados) {
            if (r.status === 'fulfilled') {
                totalRegistros += r.value.rows.length;
                bloques.push(tablaSql(r.value.tabla, r.value.rows));
            } else {
                const nombre = r.reason?.message?.split(':')[0] || 'desconocida';
                console.warn('Tabla inaccesible:', r.reason?.message);
                bloques.push(`-- ⚠ Tabla ${nombre} no accesible: ${r.reason?.message}\n`);
            }
        }

        const header = [
            '-- ============================================================',
            `-- QR Pass · CECyT 9 — Respaldo de Base de Datos`,
            `-- Fecha      : ${fechaISO}`,
            `-- Generado por: ${usuario}`,
            `-- Tablas     : ${TABLAS.length}`,
            `-- Registros  : ${totalRegistros}`,
            '--',
            '-- Para restaurar: ejecuta este script en el SQL Editor de',
            '-- Supabase (o psql). Los INSERT usan ON CONFLICT DO NOTHING',
            '-- por lo que es seguro ejecutar sobre una BD existente.',
            '-- ============================================================',
            '',
            'SET client_encoding = \'UTF8\';',
            '',
        ].join('\n');

        const sql      = header + bloques.join('\n');
        const filename = `respaldo_qrpass_${fechaStr}.sql`;

        res.set({
            'Content-Type':        'application/sql; charset=utf-8',
            'Content-Disposition': `attachment; filename="${filename}"`,
            'Content-Length':      Buffer.byteLength(sql, 'utf8'),
        });

        return res.send(sql);

    } catch (err) {
        console.error('Error generando respaldo:', err);
        return res.status(500).json({
            success: false,
            message: 'Error al generar el respaldo: ' + err.message,
        });
    }
};
