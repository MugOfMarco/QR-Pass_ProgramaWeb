// frontend/public/JS/logicaNegocio.js — Gestión de días inhábiles
'use strict';

const esc = s => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const $   = id => document.getElementById(id);

const TIPO_LABEL = {
    festivo:       'Festivo',
    puente:        'Puente',
    vacaciones:    'Vacaciones',
    institucional: 'Institucional',
};

// ── Init ────────────────────────────────────────────────────
(async function init() {
    try {
        const r    = await fetch('/api/auth/check', { credentials: 'include' });
        const data = await r.json();
        if (!data.isAuthenticated) { location.href = '/login.html'; return; }
        if (data.tipo !== 'Administrador') { location.href = '/Dashboard.html'; return; }
    } catch { location.href = '/login.html'; return; }

    await cargarDias();
    bindForm();
    bindReiniciar();
    bindFiltros();
})();

// ── Cargar lista ────────────────────────────────────────────
async function cargarDias() {
    const ciclo  = $('filtro-ciclo').value || null;
    let url = '/api/config/dias-inhabiles';
    if (ciclo) url += `?ciclo=${encodeURIComponent(ciclo)}`;

    try {
        const r    = await fetch(url, { credentials: 'include' });
        const data = await r.json();
        if (!data.success) return;

        // Rellenar select de ciclos
        const selCiclo = $('filtro-ciclo');
        const actual   = selCiclo.value;
        selCiclo.innerHTML = '<option value="">Todos los ciclos</option>';
        (data.ciclos || []).forEach(c => {
            const opt = document.createElement('option');
            opt.value       = c;
            opt.textContent = c;
            if (c === actual) opt.selected = true;
            selCiclo.appendChild(opt);
        });

        renderTabla(data.dias || []);
    } catch (e) {
        console.error(e);
    }
}

function renderTabla(dias) {
    const tbody   = $('tbody-dias');
    const emptyEl = $('ln-empty');

    if (!dias.length) {
        tbody.innerHTML  = '';
        emptyEl.style.display = '';
        return;
    }
    emptyEl.style.display = 'none';

    tbody.innerHTML = dias.map(d => `
        <tr>
            <td class="ln-td-fecha">${fmtFecha(d.fecha)}</td>
            <td>${esc(d.descripcion)}</td>
            <td><span class="tipo-chip tipo-${esc(d.tipo)}">${esc(TIPO_LABEL[d.tipo] || d.tipo)}</span></td>
            <td class="ln-td-ciclo">${d.ciclo_escolar ? esc(d.ciclo_escolar) : '<span style="color:#bbb">—</span>'}</td>
            <td>
                <button class="ln-btn-del" onclick="eliminarDia(${d.id_inhabil})"
                        title="Eliminar este día">✕</button>
            </td>
        </tr>`).join('');
}

function fmtFecha(iso) {
    // "2025-11-17" → "lun 17 nov 2025"
    const d = new Date(iso + 'T12:00:00');
    return d.toLocaleDateString('es-MX', { weekday:'short', day:'2-digit', month:'short', year:'numeric' });
}

// ── Eliminar día ────────────────────────────────────────────
window.eliminarDia = async function (id) {
    if (!confirm('¿Eliminar este día inhábil?')) return;
    try {
        const r    = await fetch(`/api/config/dias-inhabiles/${id}`, {
            method: 'DELETE', credentials: 'include',
        });
        const data = await r.json();
        if (data.success) await cargarDias();
        else alert(data.message || 'Error al eliminar.');
    } catch { alert('Error de conexión.'); }
};

// ── Formulario agregar ──────────────────────────────────────
function bindForm() {
    $('form-dia').addEventListener('submit', async e => {
        e.preventDefault();
        const fecha    = $('f-fecha').value;
        const desc     = $('f-desc').value.trim();
        const tipo     = $('f-tipo').value;
        const ciclo    = $('f-ciclo').value.trim();
        const msgEl    = $('form-dia-msg');

        if (!fecha) { setMsg(msgEl, 'Selecciona una fecha.', false); return; }
        if (!desc)  { setMsg(msgEl, 'Escribe una descripción.', false); return; }

        const btn = $('btn-agregar');
        btn.disabled = true; btn.textContent = 'Guardando…';
        msgEl.style.display = 'none';

        try {
            const r = await fetch('/api/config/dias-inhabiles', {
                method:      'POST',
                headers:     { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ fecha, descripcion: desc, tipo, ciclo_escolar: ciclo || null }),
            });
            const data = await r.json();
            if (data.success) {
                setMsg(msgEl, 'Día agregado correctamente.', true);
                $('form-dia').reset();
                await cargarDias();
            } else {
                setMsg(msgEl, data.message || 'Error al agregar.', false);
            }
        } catch { setMsg(msgEl, 'Error de conexión.', false); }
        finally  { btn.disabled = false; btn.textContent = 'Agregar'; }
    });
}

// ── Reiniciar año escolar ───────────────────────────────────
function bindReiniciar() {
    $('btn-abrir-reiniciar').addEventListener('click', () => {
        $('modal-ciclo').value             = '';
        $('modal-reiniciar-msg').style.display = 'none';
        $('modal-reiniciar').style.display     = 'flex';
        $('modal-ciclo').focus();
    });

    $('btn-cancelar-reiniciar').addEventListener('click', cerrarModal);

    $('modal-reiniciar').addEventListener('click', e => {
        if (e.target === $('modal-reiniciar')) cerrarModal();
    });

    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') cerrarModal();
    });

    $('btn-confirmar-reiniciar').addEventListener('click', async () => {
        const ciclo  = $('modal-ciclo').value.trim();
        const msgEl  = $('modal-reiniciar-msg');
        if (!ciclo)  { setMsg(msgEl, 'Escribe el ciclo escolar. Ej: 2026-2027', false); return; }

        const btn = $('btn-confirmar-reiniciar');
        btn.disabled = true; btn.textContent = 'Reiniciando…';
        msgEl.style.display = 'none';

        try {
            const r = await fetch('/api/config/dias-inhabiles/reiniciar', {
                method:      'POST',
                headers:     { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ ciclo_escolar: ciclo }),
            });
            const data = await r.json();
            if (data.success) {
                cerrarModal();
                await cargarDias();
                // Seleccionar el ciclo recién reiniciado
                $('filtro-ciclo').value = ciclo;
                await cargarDias();
                alert(data.message);
            } else {
                setMsg(msgEl, data.message || 'Error al reiniciar.', false);
            }
        } catch { setMsg(msgEl, 'Error de conexión.', false); }
        finally  { btn.disabled = false; btn.textContent = 'Reiniciar'; }
    });
}

function cerrarModal() {
    $('modal-reiniciar').style.display = 'none';
}

// ── Filtros ─────────────────────────────────────────────────
function bindFiltros() {
    $('btn-refrescar').addEventListener('click', cargarDias);
    $('filtro-ciclo').addEventListener('change',   cargarDias);
}

// ── Helper ──────────────────────────────────────────────────
function setMsg(el, text, ok) {
    el.textContent   = text;
    el.style.color   = ok ? '#16a34a' : '#dc2626';
    el.style.display = '';
}
