// frontend/public/JS/soportePanel.js — Panel Kanban agente de soporte
'use strict';

const esc = s => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const $ = id => document.getElementById(id);

const ESTADO_LABEL = {
    abierto:           'Abierto',
    en_progreso:       'En progreso',
    esperando_usuario: 'Esperando usuario',
    resuelto:          'Resuelto',
    cerrado:           'Cerrado',
};
const PRIO_LABEL   = { urgente:'Urgente', alta:'Alta', media:'Media', baja:'Baja' };

const COLUMNAS = ['abierto', 'en_progreso', 'esperando_usuario', 'resuelto'];

let ticketsData      = [];
let ticketActivo     = null;
let tabActivo        = 'reply';
let detEvidenciaUrl  = null;   // URL Cloudinary pendiente de adjuntar

// ── Init ───────────────────────────────────────────────────────
(async function init() {
    try {
        const r    = await fetch('/api/auth/check', { credentials: 'include' });
        const data = await r.json();
        if (!data.isAuthenticated) { location.href = '/login.html'; return; }
        const roles = ['Soporte', 'Administrador'];
        if (!roles.includes(data.tipo)) { location.href = '/Entrada_Salida.html'; return; }
    } catch { location.href = '/login.html'; return; }

    await Promise.all([ cargarTickets(), cargarMetricas() ]);
    bindFiltros();
    bindDetalle();
    bindFaqStats();
})();

// ── Carga tickets ──────────────────────────────────────────────
async function cargarTickets() {
    const estado    = $('filtro-estado').value    || null;
    const prioridad = $('filtro-prioridad').value || null;

    let url = '/api/soporte/panel/tickets';
    const params = [];
    if (estado)    params.push(`estado=${encodeURIComponent(estado)}`);
    if (prioridad) params.push(`prioridad=${encodeURIComponent(prioridad)}`);
    if (params.length) url += '?' + params.join('&');

    try {
        const r    = await fetch(url, { credentials: 'include' });
        const data = await r.json();
        ticketsData = data.success ? data.tickets : [];
    } catch { ticketsData = []; }

    renderKanban();
}

async function cargarMetricas() {
    try {
        const r    = await fetch('/api/soporte/panel/metricas', { credentials: 'include' });
        const data = await r.json();
        if (!data.success) return;
        const m = data.metricas;
        $('met-total').textContent    = `${m.total} total`;
        $('met-abiertos').textContent = `${m.abiertos} abiertos`;
        $('met-progreso').textContent = `${m.en_progreso} en progreso`;
        $('met-espera').textContent   = `${m.esperando} esperando`;
        $('met-resueltos').textContent= `${m.resueltos} resueltos`;
        $('met-urgentes').textContent = `${m.urgentes} urgentes`;
        $('met-rating').textContent   = m.promedio_calificacion
            ? `⭐ ${m.promedio_calificacion}/5 (${m.calificados})`
            : '⭐ Sin calificaciones';
    } catch {}
}

// ── Render Kanban ──────────────────────────────────────────────
function renderKanban() {
    COLUMNAS.forEach(col => {
        const lista  = ticketsData.filter(t => t.estado === col);
        const cards  = $(`col-${col}`);
        const count  = $(`col-count-${col}`);
        if (count) count.textContent = lista.length;

        if (!cards) return;
        cards.innerHTML = lista.length
            ? lista.map(t => crearKCard(t)).join('')
            : `<div class="kanban-vacio">Sin tickets</div>`;
    });

    // Si hay un ticket activo, mantener el highlight
    if (ticketActivo) {
        document.querySelectorAll(`.kcard[data-id="${ticketActivo}"]`).forEach(el => {
            el.classList.add('activo');
        });
    }
}

function crearKCard(t) {
    return `
        <div class="kcard" data-id="${t.id_ticket}" data-prio="${esc(t.prioridad)}" onclick="abrirDetalle(${t.id_ticket})">
            <div class="kcard-asunto">${esc(t.asunto)}</div>
            <div class="kcard-meta">
                <span class="prio-badge prio-${esc(t.prioridad)}">${esc(PRIO_LABEL[t.prioridad] || t.prioridad)}</span>
                <span class="kcard-sol">${esc(t.solicitante)}</span>
            </div>
        </div>`;
}

// ── Abrir detalle ──────────────────────────────────────────────
async function abrirDetalle(id) {
    ticketActivo = id;
    document.querySelectorAll('.kcard').forEach(el => {
        el.classList.toggle('activo', parseInt(el.dataset.id) === id);
    });

    const panel = $('detalle-panel');
    panel.style.display = '';

    try {
        const r    = await fetch(`/api/soporte/panel/tickets/${id}`, { credentials: 'include' });
        const data = await r.json();
        if (!data.success) return;
        renderDetalle(data.ticket);
    } catch {}
}

function renderDetalle(t) {
    // Badges
    $('det-prio-badge').className   = `prio-badge prio-${esc(t.prioridad)}`;
    $('det-prio-badge').textContent = PRIO_LABEL[t.prioridad] || t.prioridad;
    $('det-estado-badge').className   = `estado-badge est-${esc(t.estado)}`;
    $('det-estado-badge').textContent = ESTADO_LABEL[t.estado] || t.estado;

    $('det-asunto').textContent = t.asunto;

    $('det-meta').innerHTML = `
        <span>📋 #${t.id_ticket}</span>
        <span>👤 ${esc(t.solicitante)} (${esc(t.rol_solicitante)})</span>
        ${t.agente ? `<span>🛠 Agente: ${esc(t.agente)}</span>` : ''}
        <span>📅 ${new Date(t.fecha_creacion).toLocaleString('es-MX')}</span>
        ${t.modulo ? `<span>🔧 Módulo: ${esc(t.modulo)}</span>` : ''}
    `;

    $('det-descripcion').textContent = t.descripcion;

    // Calificación del usuario
    const calWrap = $('det-calificacion-wrap');
    if (t.calificacion) {
        calWrap.style.display       = '';
        $('det-cal-stars').textContent  = '★'.repeat(t.calificacion) + '☆'.repeat(5 - t.calificacion);
        $('det-cal-valor').textContent  = ` ${t.calificacion}/5`;
        $('det-cal-comentario').textContent = t.comentario_calificacion || '';
    } else {
        calWrap.style.display = 'none';
    }

    // Botón tomar
    const btnTomar = $('btn-tomar-ticket');
    btnTomar.style.display = t.id_agente ? 'none' : '';

    // Mensajes
    const mensajes = $('det-mensajes');
    mensajes.innerHTML = t.mensajes?.length
        ? t.mensajes.map(m => {
            const esAgente  = m.rol_autor === 'Soporte' || m.rol_autor === 'Administrador';
            const notaClass = m.es_nota_interna ? 'det-msg-nota' : (esAgente ? 'det-msg-agent' : 'det-msg-user');
            const evidencia = m.url_evidencia
                ? `<div class="det-msg-evidencia">
                       <img src="${esc(m.url_evidencia)}" alt="Evidencia adjunta"
                            onclick="window.open('${esc(m.url_evidencia)}','_blank')">
                       <a href="${esc(m.url_evidencia)}" target="_blank" rel="noopener">Ver imagen ↗</a>
                   </div>` : '';
            return `<div class="det-msg ${notaClass}">
                <div class="det-msg-autor">${esc(m.autor)} · ${new Date(m.fecha_envio).toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit'})}</div>
                ${esc(m.contenido)}${evidencia}
            </div>`;
        }).join('')
        : '<p style="font-size:.8rem;color:#aaa">Sin mensajes.</p>';

    mensajes.scrollTop = mensajes.scrollHeight;

    // Eventos
    $('det-reply-msg').style.display = 'none';
}

// ── Bind controles del detalle ─────────────────────────────────
function bindDetalle() {
    $('btn-cerrar-detalle').addEventListener('click', () => {
        $('detalle-panel').style.display = 'none';
        ticketActivo = null;
        document.querySelectorAll('.kcard').forEach(el => el.classList.remove('activo'));
    });

    $('btn-tomar-ticket').addEventListener('click', async () => {
        if (!ticketActivo) return;
        try {
            const r = await fetch(`/api/soporte/panel/tickets/${ticketActivo}/tomar`, {
                method: 'PATCH', credentials: 'include',
            });
            const data = await r.json();
            if (data.success) { await refrescar(); await abrirDetalle(ticketActivo); }
        } catch {}
    });

    $('btn-aplicar-estado').addEventListener('click', async () => {
        const estado = $('det-estado-sel').value;
        if (!estado || !ticketActivo) return;
        try {
            const r = await fetch(`/api/soporte/panel/tickets/${ticketActivo}/estado`, {
                method:  'PATCH',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ estado }),
            });
            const data = await r.json();
            if (data.success) { await refrescar(); await abrirDetalle(ticketActivo); }
        } catch {}
    });

    $('btn-aplicar-prio').addEventListener('click', async () => {
        const prioridad = $('det-prio-sel').value;
        if (!prioridad || !ticketActivo) return;
        try {
            const r = await fetch(`/api/soporte/panel/tickets/${ticketActivo}/prioridad`, {
                method:  'PATCH',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ prioridad }),
            });
            const data = await r.json();
            if (data.success) { await refrescar(); await abrirDetalle(ticketActivo); }
        } catch {}
    });

    $('btn-eliminar-ticket').addEventListener('click', async () => {
        if (!ticketActivo || !confirm('¿Eliminar este ticket definitivamente?')) return;
        try {
            await fetch(`/api/soporte/panel/tickets/${ticketActivo}`, {
                method: 'DELETE', credentials: 'include',
            });
            $('detalle-panel').style.display = 'none';
            ticketActivo = null;
            await refrescar();
        } catch {}
    });

    // Tabs reply / nota interna
    document.querySelectorAll('.det-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            tabActivo = tab.dataset.tab;
            document.querySelectorAll('.det-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            $('det-reply-text').placeholder = tabActivo === 'nota'
                ? 'Nota interna (no visible al usuario)…'
                : 'Escribe tu respuesta al usuario…';
        });
    });

    // ── Evidencia (panel agente): vista previa ───────────────────
    $('det-evidencia').addEventListener('change', function () {
        const file = this.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = e => {
            $('det-evidencia-img').src               = e.target.result;
            $('det-evidencia-preview').style.display = '';
        };
        reader.readAsDataURL(file);
        detEvidenciaUrl = null;
    });

    $('btn-det-quitar-evidencia').addEventListener('click', () => {
        $('det-evidencia').value                    = '';
        $('det-evidencia-img').src                  = '';
        $('det-evidencia-preview').style.display    = 'none';
        detEvidenciaUrl = null;
    });

    $('btn-enviar-det-reply').addEventListener('click', async () => {
        const contenido = $('det-reply-text').value.trim();
        const msg       = $('det-reply-msg');
        if (!contenido) { setMsg(msg, 'Escribe un mensaje.', false); return; }

        const btn = $('btn-enviar-det-reply');
        btn.disabled = true; btn.textContent = 'Enviando…';

        try {
            // 1. Subir evidencia si hay archivo seleccionado
            const archivoEl = $('det-evidencia');
            if (archivoEl.files[0]) {
                btn.textContent = 'Subiendo imagen…';
                const fd = new FormData();
                fd.append('evidencia', archivoEl.files[0]);
                const upRes  = await fetch('/api/upload/evidencia', {
                    method: 'POST', credentials: 'include', body: fd,
                });
                const upData = await upRes.json();
                if (!upData.success) {
                    setMsg(msg, 'Error al subir la imagen: ' + (upData.message || ''), false);
                    return;
                }
                detEvidenciaUrl = upData.url;
            }

            // 2. Enviar mensaje
            const body = { contenido, es_nota_interna: tabActivo === 'nota' };
            if (detEvidenciaUrl) body.url_evidencia = detEvidenciaUrl;

            const r = await fetch(`/api/soporte/panel/tickets/${ticketActivo}/mensajes`, {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(body),
            });
            const data = await r.json();
            if (data.success) {
                $('det-reply-text').value               = '';
                $('det-evidencia').value                = '';
                $('det-evidencia-img').src              = '';
                $('det-evidencia-preview').style.display = 'none';
                detEvidenciaUrl = null;
                msg.style.display = 'none';
                await abrirDetalle(ticketActivo);
            } else {
                setMsg(msg, data.message || 'Error al enviar.', false);
            }
        } catch { setMsg(msg, 'Error de conexión.', false); }
        finally  { btn.disabled = false; btn.textContent = 'Enviar'; }
    });
}

// ── FAQ Stats ─────────────────────────────────────────────────
function bindFaqStats() {
    const btn   = $('btn-toggle-faq-stats');
    const panel = $('faq-stats-panel');
    const close = $('btn-cerrar-faq-stats');
    if (!btn || !panel) return;

    btn.addEventListener('click', async () => {
        const visible = panel.style.display !== 'none';
        panel.style.display = visible ? 'none' : '';
        if (!visible) await cargarFaqStats();
    });

    if (close) {
        close.addEventListener('click', () => {
            panel.style.display = 'none';
        });
    }
}

async function cargarFaqStats() {
    try {
        const r    = await fetch('/api/faq/stats', { credentials: 'include' });
        const data = await r.json();
        renderFaqStats(data.success ? data.stats : []);
    } catch { renderFaqStats([]); }
}

function renderFaqStats(stats) {
    const wrap = $('faq-stats-list');
    if (!wrap) return;
    if (!stats.length) {
        wrap.innerHTML = '<p style="font-size:.82rem;color:#aaa;text-align:center;padding:.5rem">Sin clics registrados aún.</p>';
        return;
    }
    const max = Math.max(1, stats[0]?.total_clics || 0);
    wrap.innerHTML = stats.map(s => `
        <div class="faq-stat-item" data-id="${s.id_faq}">
            <div class="faq-stat-pregunta" title="${esc(s.pregunta)}">${esc(s.pregunta)}</div>
            <div class="faq-stat-barra">
                <div class="faq-stat-fill" style="width:${Math.round((s.total_clics / max) * 100)}%"></div>
                <span class="faq-stat-num">${s.total_clics} clic${s.total_clics !== 1 ? 's' : ''}</span>
            </div>
            <div class="faq-stat-acciones">
                <button class="faq-btn-editar" data-id="${s.id_faq}" data-pregunta="${esc(s.pregunta)}" title="Editar pregunta">✏️</button>
                <button class="faq-btn-eliminar" data-id="${s.id_faq}" title="Eliminar pregunta">🗑️</button>
            </div>
        </div>`).join('');

    // Bind botones editar
    wrap.querySelectorAll('.faq-btn-editar').forEach(btn => {
        btn.addEventListener('click', async () => {
            const id       = btn.dataset.id;
            const actual   = btn.dataset.pregunta;
            const nuevo    = prompt('Editar pregunta frecuente:', actual);
            if (!nuevo || nuevo.trim() === actual) return;
            try {
                const r = await fetch(`/api/faq/${id}`, {
                    method:  'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({ pregunta: nuevo.trim() }),
                });
                const data = await r.json();
                if (data.success) await cargarFaqStats();
                else alert('Error: ' + (data.message || 'No se pudo actualizar.'));
            } catch { alert('Error de conexión.'); }
        });
    });

    // Bind botones eliminar
    wrap.querySelectorAll('.faq-btn-eliminar').forEach(btn => {
        btn.addEventListener('click', async () => {
            const id = btn.dataset.id;
            const item = wrap.querySelector(`.faq-stat-item[data-id="${id}"] .faq-stat-pregunta`);
            const texto = item?.textContent || '(esta pregunta)';
            if (!confirm(`¿Eliminar la pregunta frecuente?\n\n"${texto}"\n\nEsta acción no se puede deshacer.`)) return;
            try {
                const r = await fetch(`/api/faq/${id}`, {
                    method: 'DELETE', credentials: 'include',
                });
                const data = await r.json();
                if (data.success) await cargarFaqStats();
                else alert('Error: ' + (data.message || 'No se pudo eliminar.'));
            } catch { alert('Error de conexión.'); }
        });
    });
}

// ── Filtros ────────────────────────────────────────────────────
function bindFiltros() {
    $('btn-refrescar').addEventListener('click', refrescar);
    $('filtro-estado').addEventListener('change',    cargarTickets);
    $('filtro-prioridad').addEventListener('change', cargarTickets);
}

async function refrescar() {
    await Promise.all([ cargarTickets(), cargarMetricas() ]);
}

function setMsg(el, text, ok) {
    el.textContent   = text;
    el.style.color   = ok ? '#16a34a' : '#dc2626';
    el.style.display = '';
}
