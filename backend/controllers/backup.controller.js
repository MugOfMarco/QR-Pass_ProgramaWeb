// backend/controllers/backup.controller.js
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

async function fetchAll(tabla) {
    let all = [];
    let from = 0;
    const PAGE = 1000;
    while (true) {
        const { data, error } = await supabaseAdmin
            .from(tabla)
            .select('*')
            .range(from, from + PAGE - 1);
        if (error) throw new Error(`${tabla}: ${error.message}`);
        if (!data?.length) break;
        all = all.concat(data);
        if (data.length < PAGE) break;
        from += PAGE;
    }
    return all;
}

export const descargarRespaldo = async (req, res) => {
    try {
        const respaldo = {
            metadata: {
                sistema:   'QR Pass — CECyT 9',
                fecha:     new Date().toISOString(),
                generadoPor: req.session.user?.usuario || 'admin',
                tablas:    TABLAS.length,
            },
            datos: {},
        };

        const resultados = await Promise.allSettled(
            TABLAS.map(t => fetchAll(t).then(rows => ({ tabla: t, rows })))
        );

        for (const r of resultados) {
            if (r.status === 'fulfilled') {
                respaldo.datos[r.value.tabla] = r.value.rows;
            } else {
                console.warn('Tabla inaccesible:', r.reason?.message);
                const nombre = r.reason?.message?.split(':')[0] || 'desconocida';
                respaldo.datos[nombre] = { _error: r.reason?.message };
            }
        }

        respaldo.metadata.totalRegistros = Object.values(respaldo.datos)
            .reduce((acc, v) => acc + (Array.isArray(v) ? v.length : 0), 0);

        const json     = JSON.stringify(respaldo, null, 2);
        const fechaStr = new Date().toISOString().split('T')[0].replace(/-/g, '');
        const filename = `respaldo_qrpass_${fechaStr}.json`;

        res.set({
            'Content-Type':        'application/json; charset=utf-8',
            'Content-Disposition': `attachment; filename="${filename}"`,
            'Content-Length':      Buffer.byteLength(json, 'utf8'),
        });

        return res.send(json);

    } catch (err) {
        console.error('Error generando respaldo:', err);
        return res.status(500).json({ success: false, message: 'Error al generar el respaldo: ' + err.message });
    }
};