// backend/controllers/config.controller.js
// Gestión de Lógica de Negocio: días inhábiles del ciclo escolar.
import sanitizeHtml from 'sanitize-html';
import DiasInhabiles from '../models/DiasInhabiles.js';

const s = v => typeof v === 'string'
    ? sanitizeHtml(v, { allowedTags: [], allowedAttributes: {} }).trim()
    : v;

const TIPOS_VALIDOS = ['festivo', 'puente', 'vacaciones', 'institucional'];

// ── Helpers: cálculo automático de festivos por ley ──────────
// Los festivos mexicanos con fecha dinámica se transfieren al lunes más cercano.

function primerLunesDeMes(anio, mes) {
    const d = new Date(anio, mes - 1, 1);
    const dow = d.getDay();                         // 0=dom … 6=sáb
    const diff = dow === 1 ? 0 : (dow === 0 ? 1 : 8 - dow);
    d.setDate(1 + diff);
    return d;
}

function nthLunesDeMes(anio, mes, n) {
    const primero = primerLunesDeMes(anio, mes);
    primero.setDate(primero.getDate() + (n - 1) * 7);
    return primero;
}

function fmtDate(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function esFindeSemana(fecha) {
    const d = new Date(fecha + 'T12:00:00');
    return d.getDay() === 0 || d.getDay() === 6;
}

function generarFestivosBase(anioInicio, anioFin) {
    const dias = [];

    for (let anio = anioInicio; anio <= anioFin; anio++) {
        // Festivos de fecha fija
        const fijos = [
            { mes: 1,  dia: 1,  descripcion: 'Año Nuevo',                tipo: 'festivo' },
            { mes: 5,  dia: 1,  descripcion: 'Día del Trabajo',           tipo: 'festivo' },
            { mes: 9,  dia: 16, descripcion: 'Día de la Independencia',   tipo: 'festivo' },
            { mes: 12, dia: 25, descripcion: 'Navidad',                   tipo: 'festivo' },
            { mes: 5,  dia: 15, descripcion: 'Día del Maestro',           tipo: 'institucional' },
        ];
        for (const f of fijos) {
            const fecha = `${anio}-${String(f.mes).padStart(2, '0')}-${String(f.dia).padStart(2, '0')}`;
            if (!esFindeSemana(fecha)) {
                dias.push({ fecha, descripcion: f.descripcion, tipo: f.tipo });
            }
        }

        // Festivos de fecha dinámica (primer/tercer lunes)
        const dinamicos = [
            { fecha: fmtDate(primerLunesDeMes(anio, 2)),  descripcion: 'Día de la Constitución Política', tipo: 'festivo' },
            { fecha: fmtDate(nthLunesDeMes(anio, 3, 3)),  descripcion: 'Natalicio de Benito Juárez',      tipo: 'festivo' },
            { fecha: fmtDate(nthLunesDeMes(anio, 11, 3)), descripcion: 'Aniversario Revolución Mexicana', tipo: 'festivo' },
        ];
        dias.push(...dinamicos);
    }

    // Deduplicar por fecha (si un festivo cae en el mismo día en ambos años del ciclo)
    const mapa = {};
    for (const d of dias) mapa[d.fecha] = d;
    return Object.values(mapa).sort((a, b) => a.fecha.localeCompare(b.fecha));
}

// ── GET /api/config/dias-inhabiles ──────────────────────────
export const listarDias = async (req, res) => {
    try {
        const { ciclo, anio } = req.query;
        const dias   = await DiasInhabiles.listar({ ciclo, anio });
        const ciclos = await DiasInhabiles.listarCiclos();
        return res.json({ success: true, dias, ciclos });
    } catch (err) {
        console.error('listarDias:', err);
        return res.status(500).json({ success: false, message: 'Error al cargar días inhábiles.' });
    }
};

// ── POST /api/config/dias-inhabiles ─────────────────────────
export const agregarDia = async (req, res) => {
    try {
        const { fecha, descripcion, tipo, ciclo_escolar } = req.body;

        if (!fecha)              return res.status(400).json({ success: false, message: 'La fecha es obligatoria.' });
        if (!descripcion?.trim()) return res.status(400).json({ success: false, message: 'La descripción es obligatoria.' });
        if (tipo && !TIPOS_VALIDOS.includes(tipo))
            return res.status(400).json({ success: false, message: `Tipo inválido. Valores: ${TIPOS_VALIDOS.join(', ')}` });

        const r = await DiasInhabiles.crear({
            fecha,
            descripcion: s(descripcion),
            tipo:         tipo || 'festivo',
            ciclo_escolar: ciclo_escolar ? s(ciclo_escolar) : null,
        });
        return r.success ? res.status(201).json(r) : res.status(400).json(r);
    } catch (err) {
        console.error('agregarDia:', err);
        return res.status(500).json({ success: false, message: 'Error al agregar día inhábil.' });
    }
};

// ── DELETE /api/config/dias-inhabiles/:id ───────────────────
export const eliminarDia = async (req, res) => {
    try {
        const r = await DiasInhabiles.eliminar(req.params.id);
        return r.success ? res.json(r) : res.status(400).json(r);
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Error al eliminar día inhábil.' });
    }
};

// ── POST /api/config/dias-inhabiles/reiniciar ────────────────
// Elimina todo el ciclo y recarga festivos por ley.
export const reiniciarCiclo = async (req, res) => {
    try {
        const { ciclo_escolar } = req.body;
        if (!ciclo_escolar)
            return res.status(400).json({ success: false, message: 'El campo ciclo_escolar es requerido. Ejemplo: 2026-2027' });

        // Validar formato "AAAA-AAAA"
        const partes = String(ciclo_escolar).split('-').map(Number);
        if (partes.length !== 2 || partes.some(n => isNaN(n) || n < 2020 || n > 2100))
            return res.status(400).json({ success: false, message: 'Formato inválido. Ejemplo: 2026-2027' });

        const [anioInicio, anioFin] = partes;
        if (anioFin !== anioInicio + 1)
            return res.status(400).json({ success: false, message: 'El ciclo debe abarcar dos años consecutivos. Ej: 2026-2027' });

        const festivos = generarFestivosBase(anioInicio, anioFin);
        const r        = await DiasInhabiles.reiniciarCiclo(s(ciclo_escolar), festivos);

        return r.success
            ? res.json({ ...r, message: `Ciclo ${ciclo_escolar} reiniciado. ${r.insertados} festivos cargados. Agrega puentes y vacaciones manualmente.` })
            : res.status(400).json(r);
    } catch (err) {
        console.error('reiniciarCiclo:', err);
        return res.status(500).json({ success: false, message: 'Error al reiniciar ciclo.' });
    }
};
