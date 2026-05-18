// frontend/public/JS/soporte.js — Sistema de tickets de usuario
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
const PRIO_LABEL = { urgente:'Urgente', alta:'Alta', media:'Media', baja:'Baja' };

let ticketsData       = [];
let ticketActivo      = null;
let usuarioActual     = null;
let replyEvidenciaUrl = null;   // URL Cloudinary pendiente de adjuntar
let starSeleccionada  = 0;      // Calificación seleccionada (0 = ninguna)

// ── Init ───────────────────────────────────────────────────────
(async function init() {
    try {
        const r    = await fetch('/api/auth/check', { credentials: 'include' });
        const data = await r.json();
        if (!data.isAuthenticated) { location.href = '/login.html'; return; }
        // Normalizar: la sesión devuelve data.user.id (número de id_usuario)
        usuarioActual = { ...data, id: parseInt(data.user?.id ?? 0) };
    } catch { location.href = '/login.html'; return; }

    await cargarTickets();
    bindFaq();
    bindFormTicket();
    bindDetalle();
    bindCalificacion();
})();

// ── Cargar mis tickets ─────────────────────────────────────────
async function cargarTickets() {
    try {
        const r    = await fetch('/api/soporte/tickets', { credentials: 'include' });
        const data = await r.json();
        ticketsData = data.success ? data.tickets : [];
        renderLista();
    } catch { renderLista(); }
}

function renderLista() {
    const wrap = $('tickets-lista');
    if (!ticketsData.length) {
        wrap.innerHTML = '<p class="sop-muted">No tienes tickets. Usa el formulario para crear uno.</p>';
        return;
    }
    wrap.innerHTML = ticketsData.map(t => `
        <div class="ticket-item" data-id="${t.id_ticket}" onclick="abrirDetalle(${t.id_ticket})">
            <div class="ticket-asunto">${esc(t.asunto)}</div>
            <div class="ticket-meta">
                <span class="tk-estado tk-${esc(t.estado)}">${esc(ESTADO_LABEL[t.estado] || t.estado)}</span>
                <span class="tk-prio tk-${esc(t.prioridad)}">${esc(PRIO_LABEL[t.prioridad] || t.prioridad)}</span>
                ${t.agente ? `<span style="font-size:.7rem;color:#777">Agente: ${esc(t.agente)}</span>` : ''}
                <span class="tk-fecha">${new Date(t.fecha_creacion).toLocaleDateString('es-MX')}</span>
            </div>
        </div>`).join('');
}

// ── Abrir detalle ──────────────────────────────────────────────
async function abrirDetalle(id) {
    ticketActivo = id;
    document.querySelectorAll('.ticket-item').forEach(el => {
        el.classList.toggle('activo', parseInt(el.dataset.id) === id);
    });

    $('tickets-lista').style.display        = 'none';
    $('ticket-detalle-panel').style.display = '';

    try {
        const r    = await fetch(`/api/soporte/tickets/${id}`, { credentials: 'include' });
        const data = await r.json();
        if (!data.success) { mostrarDetalleError('No se pudo cargar el ticket.'); return; }
        renderDetalle(data.ticket);
    } catch { mostrarDetalleError('Error de conexión.'); }
}

function mostrarDetalleError(msg) {
    $('detalle-asunto').textContent  = 'Error';
    $('detalle-meta').innerHTML      = `<span style="color:#dc2626">${esc(msg)}</span>`;
    $('detalle-descripcion').textContent = '';
    $('mensajes-lista').innerHTML    = '';
}

function renderDetalle(t) {
    $('detalle-asunto').textContent = t.asunto;
    $('detalle-meta').innerHTML = `
        <span class="tk-estado tk-${esc(t.estado)}">${esc(ESTADO_LABEL[t.estado] || t.estado)}</span>
        <span class="tk-prio tk-${esc(t.prioridad)}">${esc(PRIO_LABEL[t.prioridad] || t.prioridad)}</span>
        ${t.modulo ? `<span style="font-size:.75rem;color:#888">Módulo: ${esc(t.modulo)}</span>` : ''}
        ${t.agente ? `<span style="font-size:.75rem;color:#888">Agente: ${esc(t.agente)}</span>` : ''}
        <span style="font-size:.75rem;color:#aaa">${new Date(t.fecha_creacion).toLocaleString('es-MX')}</span>
    `;
    $('detalle-descripcion').textContent = t.descripcion;

    const lista = $('mensajes-lista');
    lista.innerHTML = t.mensajes?.length
        ? t.mensajes.map(m => {
            const esAgente  = m.rol_autor === 'Soporte' || m.rol_autor === 'Administrador';
            const evidencia = m.url_evidencia
                ? `<div class="msg-evidencia">
                       <img src="${esc(m.url_evidencia)}" alt="Evidencia adjunta"
                            onclick="window.open('${esc(m.url_evidencia)}','_blank')">
                       <a href="${esc(m.url_evidencia)}" target="_blank" rel="noopener">Ver imagen ↗</a>
                   </div>` : '';
            return `<div class="msg-burbuja ${esAgente ? 'msg-agente' : 'msg-usuario'}">
                <div class="msg-autor">${esc(m.autor)} · ${new Date(m.fecha_envio).toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit'})}</div>
                ${esc(m.contenido)}${evidencia}
            </div>`;
        }).join('')
        : '<p class="sop-muted" style="font-size:.82rem">Sin mensajes aún.</p>';

    lista.scrollTop = lista.scrollHeight;

    const terminado = t.estado === 'cerrado' || t.estado === 'resuelto';
    $('btn-cerrar-ticket').style.display = terminado ? 'none' : '';
    $('reply-msg').style.display         = 'none';

    // ── Widget de calificación ────────────────────────────────
    const esOwner   = usuarioActual && (t.id_usuario === usuarioActual.id);
    const calWrap   = $('calificacion-wrap');
    const calYa     = $('calificacion-ya');

    if (terminado && esOwner) {
        if (t.calificacion) {
            // Ya calificado → mostrar readonly
            calWrap.style.display = 'none';
            calYa.style.display   = '';
            $('stars-readonly').textContent = '★'.repeat(t.calificacion) + '☆'.repeat(5 - t.calificacion);
            $('cal-valor').textContent      = `${t.calificacion}/5`;
            $('cal-comentario-readonly').textContent = t.comentario_calificacion || '';
        } else {
            // No calificado → mostrar widget interactivo
            calWrap.style.display = '';
            calYa.style.display   = 'none';
            initStarWidget();
        }
    } else {
        calWrap.style.display = 'none';
        calYa.style.display   = 'none';
    }
}

// ── Botón volver ───────────────────────────────────────────────
$('btn-volver-lista').addEventListener('click', () => {
    ticketActivo = null;
    $('ticket-detalle-panel').style.display = 'none';
    $('tickets-lista').style.display        = '';
    document.querySelectorAll('.ticket-item').forEach(el => el.classList.remove('activo'));
});

// ── Bind detalle ───────────────────────────────────────────────
function bindDetalle() {

    // ── Evidencia: vista previa ──────────────────────────────────
    $('reply-evidencia').addEventListener('change', function () {
        const file = this.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = e => {
            $('reply-evidencia-img').src   = e.target.result;
            $('reply-evidencia-preview').style.display = '';
        };
        reader.readAsDataURL(file);
        replyEvidenciaUrl = null;   // se sube al enviar
    });

    $('btn-quitar-evidencia').addEventListener('click', () => {
        $('reply-evidencia').value           = '';
        $('reply-evidencia-img').src         = '';
        $('reply-evidencia-preview').style.display = 'none';
        replyEvidenciaUrl = null;
    });

    $('btn-enviar-reply').addEventListener('click', async () => {
        const contenido = $('reply-contenido').value.trim();
        const msg       = $('reply-msg');
        if (!contenido) { setMsg(msg, 'Escribe un mensaje.', false); return; }

        const btn = $('btn-enviar-reply');
        btn.disabled = true; btn.textContent = 'Enviando…';
        msg.style.display = 'none';

        try {
            // 1. Subir evidencia si hay archivo seleccionado
            const archivoEl = $('reply-evidencia');
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
                replyEvidenciaUrl = upData.url;
            }

            // 2. Enviar mensaje
            const body = { contenido };
            if (replyEvidenciaUrl) body.url_evidencia = replyEvidenciaUrl;

            const r = await fetch(`/api/soporte/tickets/${ticketActivo}/mensajes`, {
                method:      'POST',
                headers:     { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(body),
            });
            const data = await r.json();
            if (data.success) {
                $('reply-contenido').value              = '';
                $('reply-evidencia').value              = '';
                $('reply-evidencia-img').src            = '';
                $('reply-evidencia-preview').style.display = 'none';
                replyEvidenciaUrl = null;
                await abrirDetalle(ticketActivo);
            } else {
                setMsg(msg, data.message || 'Error al enviar.', false);
            }
        } catch { setMsg(msg, 'Error de conexión.', false); }
        finally  { btn.disabled = false; btn.textContent = 'Enviar respuesta'; }
    });

    $('btn-cerrar-ticket').addEventListener('click', async () => {
        if (!confirm('¿Cerrar este ticket?')) return;
        try {
            await fetch(`/api/soporte/tickets/${ticketActivo}/cerrar`, {
                method: 'PATCH', credentials: 'include',
            });
            await cargarTickets();
            await abrirDetalle(ticketActivo);
        } catch {}
    });
}

// ── Formulario nuevo ticket ────────────────────────────────────
function bindFormTicket() {
    $('form-ticket').addEventListener('submit', async e => {
        e.preventDefault();
        const asunto      = $('tk-asunto').value.trim();
        const descripcion = $('tk-descripcion').value.trim();
        const modulo      = $('tk-modulo').value;
        const prioridad   = $('tk-prioridad').value;
        const msgEl       = $('form-ticket-msg');

        if (!asunto)      { setMsg(msgEl, 'El asunto es obligatorio.', false);      return; }
        if (!descripcion) { setMsg(msgEl, 'La descripción es obligatoria.', false); return; }

        const btn = $('btn-enviar-ticket');
        btn.disabled = true; btn.textContent = 'Enviando…';
        msgEl.style.display = 'none';

        try {
            const r = await fetch('/api/soporte/tickets', {
                method:      'POST',
                headers:     { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ asunto, descripcion, modulo, prioridad }),
            });
            const data = await r.json();
            if (data.success) {
                setMsg(msgEl, `Ticket #${data.id_ticket} creado correctamente.`, true);
                $('form-ticket').reset();
                await cargarTickets();
            } else {
                setMsg(msgEl, data.message || 'Error al crear.', false);
            }
        } catch { setMsg(msgEl, 'Error de conexión.', false); }
        finally  { btn.disabled = false; btn.textContent = 'Enviar ticket'; }
    });
}

// ── FAQ ────────────────────────────────────────────────────────
function bindFaq() {
    document.querySelectorAll('.faq-btn').forEach(btn => {
        btn.addEventListener('click', () => btn.closest('.faq-item').classList.toggle('open'));
    });
}

function setMsg(el, text, ok) {
    el.textContent   = text;
    el.style.color   = ok ? '#16a34a' : '#dc2626';
    el.style.display = '';
}

// ── Estrellas interactivas ─────────────────────────────────────
function initStarWidget() {
    starSeleccionada = 0;
    $('btn-calificar').disabled  = true;
    $('star-hint').textContent   = 'Selecciona una calificación';
    $('cal-comentario').value    = '';
    $('cal-msg').style.display   = 'none';

    const labels = ['', 'Muy malo', 'Malo', 'Regular', 'Bueno', 'Excelente'];
    const stars  = document.querySelectorAll('#stars-widget .star');

    stars.forEach(btn => {
        btn.classList.remove('active');
        // Clonar para eliminar listeners viejos
        const clone = btn.cloneNode(true);
        btn.parentNode.replaceChild(clone, btn);
    });

    // Re-seleccionar tras clonar
    document.querySelectorAll('#stars-widget .star').forEach(btn => {
        const val = parseInt(btn.dataset.val);

        btn.addEventListener('mouseenter', () => {
            document.querySelectorAll('#stars-widget .star').forEach(s => {
                s.classList.toggle('active', parseInt(s.dataset.val) <= val);
            });
            $('star-hint').textContent = labels[val];
        });

        btn.addEventListener('mouseleave', () => {
            document.querySelectorAll('#stars-widget .star').forEach(s => {
                s.classList.toggle('active', parseInt(s.dataset.val) <= starSeleccionada);
            });
            $('star-hint').textContent = starSeleccionada ? labels[starSeleccionada] : 'Selecciona una calificación';
        });

        btn.addEventListener('click', () => {
            starSeleccionada = val;
            $('btn-calificar').disabled = false;
            $('star-hint').textContent  = `${labels[val]} (${val}/5)`;
            document.querySelectorAll('#stars-widget .star').forEach(s => {
                s.classList.toggle('active', parseInt(s.dataset.val) <= val);
            });
        });
    });
}

// ── Bind: envío de calificación ────────────────────────────────
function bindCalificacion() {
    $('btn-calificar').addEventListener('click', async () => {
        if (!starSeleccionada || !ticketActivo) return;
        const msg        = $('cal-msg');
        const btn        = $('btn-calificar');
        const comentario = $('cal-comentario').value.trim();

        btn.disabled = true; btn.textContent = 'Enviando…';
        msg.style.display = 'none';

        try {
            const r = await fetch(`/api/soporte/tickets/${ticketActivo}/calificar`, {
                method:      'PATCH',
                headers:     { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ calificacion: starSeleccionada, comentario }),
            });
            const data = await r.json();
            if (data.success) {
                setMsg(msg, '¡Gracias por tu calificación!', true);
                await cargarTickets();
                setTimeout(() => abrirDetalle(ticketActivo), 800);
            } else {
                setMsg(msg, data.message || 'Error al calificar.', false);
                btn.disabled = false;
                btn.textContent = 'Enviar calificación';
            }
        } catch {
            setMsg(msg, 'Error de conexión.', false);
            btn.disabled = false;
            btn.textContent = 'Enviar calificación';
        }
    });
}
