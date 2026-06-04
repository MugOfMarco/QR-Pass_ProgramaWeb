// frontend/public/JS/filtrarAlumnos.js
// ============================================================
// FIXES y nuevas funcionalidades:
//   · credentials:'include' en fetch → resuelve el 401
//   · Selección individual con checkbox
//   · Botón "Seleccionar todos los visibles" (toggle)
//   · Botón "Limpiar filtros"
//   · Barra de selección que aparece/desaparece
//   · El clic en la fila navega SOLO si no fue en el checkbox
//   · Botón "Descargar PDF" → llama al backend y abre diálogo Guardar como
// ============================================================

document.addEventListener('DOMContentLoaded', () => {

    // ── Referencias ──────────────────────────────────────────
    const searchInput       = document.getElementById('search-input');
    const formFiltros       = document.getElementById('filtros-form');
    const containerAlumnos  = document.getElementById('student-list-container');
    const btnSelAll         = document.getElementById('btn-select-all');
    const btnClearFilters   = document.getElementById('btn-clear-filters');
    const btnPdf            = document.querySelector('.btn-pdf');
    const btnPdfInc         = document.querySelector('.btn-pdf-inc');
    const refreshIndicador  = document.getElementById('refresh-indicador');
    const seleccionBar      = document.getElementById('seleccion-bar');
    const seleccionContador = document.getElementById('seleccion-contador');
    const btnDeselectBar    = document.getElementById('btn-deselect-bar');
    const filtroGrupo       = document.getElementById('filtro-grupo');
    const tabDatos          = document.getElementById('tab-datos');
    const tabIncidencias    = document.getElementById('tab-incidencias');
    const btnPeriodo        = document.getElementById('btn-periodo');
    const periodoPanel      = document.getElementById('periodo-panel');
    const fechaInicioInput  = document.getElementById('fecha-inicio');
    const fechaFinInput     = document.getElementById('fecha-fin');
    const btnAplicar        = document.getElementById('btn-aplicar-periodo');
    const incInfoBar        = document.getElementById('inc-info-bar');
    const incInfoText       = document.getElementById('inc-info-text');
    const periodoLabel      = document.getElementById('periodo-label');

    // ── Estado ────────────────────────────────────────────────
    let alumnosActuales = [];        // cache de alumnos renderizados
    let seleccionados   = new Set(); // boletas seleccionadas
    let filtrosActivos  = {};        // filtros aplicados en la última carga
    let modoVista       = 'datos';   // 'datos' | 'incidencias'
    let fechaInicio     = '';
    let fechaFin        = '';

    // ── Debounce ──────────────────────────────────────────────
    let timeoutId;
    const debounce = (fn, ms) => { clearTimeout(timeoutId); timeoutId = setTimeout(fn, ms); };

    // ── Cargar grupos desde la API ────────────────────────────
    async function cargarGrupos() {
        try {
            const res = await fetch('/api/alumnos/grupos/lista', { credentials: 'include' });
            if (!res.ok) return;
            const data = await res.json();
            if (!data.success || !filtroGrupo) return;

            (data.grupos || []).forEach(g => {
                const opt = document.createElement('option');
                opt.value       = g.nombre_grupo;
                opt.textContent = g.nombre_grupo;
                filtroGrupo.appendChild(opt);
            });
        } catch (_) { /* silencioso: los filtros siguen funcionando sin grupos */ }
    }

    // ── Cargar estados académicos dinámicamente ───────────────
    async function cargarEstados() {
        try {
            const res = await fetch('/api/alumnos/estados/lista', { credentials: 'include' });
            if (!res.ok) return;
            const data = await res.json();
            if (!data.success) return;

            const container = document.getElementById('filtro-estados-container');
            if (!container) return;

            (data.estados || []).forEach(e => {
                const lbl = document.createElement('label');
                lbl.className = 'filter-label';
                lbl.innerHTML = `<input type="radio" name="estado" value="${e.estado}"> ${e.estado}`;
                container.appendChild(lbl);
            });
        } catch (_) { /* silencioso */ }
    }

    // ── Construir query params actuales ───────────────────────
    function obtenerParams() {
        const params = new URLSearchParams();
        const q = searchInput?.value.trim();
        if (q) params.append('q', q);

        const turno    = document.querySelector('input[name="turno"]:checked');
        const puertas  = document.querySelector('input[name="puertas"]:checked');
        const estado   = document.querySelector('input[name="estado"]:checked');
        const dentro   = document.querySelector('input[name="dentro"]:checked');
        const bloqueado = document.querySelector('input[name="bloqueado"]:checked');
        const grupo    = filtroGrupo?.value || '';

        if (turno?.value)    params.append('turno',    turno.value);
        if (puertas?.value)  params.append('puertas',  puertas.value);
        if (estado?.value)   params.append('estado',   estado.value);
        if (dentro?.value)   params.append('dentro',   dentro.value);
        if (bloqueado?.value) params.append('bloqueado', bloqueado.value);
        if (grupo)    params.append('grupo',    grupo);

        filtrosActivos = {
            q,
            turno:    turno?.value    || '',
            puertas:  puertas?.value  || '',
            estado:   estado?.value   || '',
            dentro:   dentro?.value   || '',
            bloqueado: bloqueado?.value || '',
            grupo,
        };

        return params;
    }

    // ── Cargar alumnos ────────────────────────────────────────
    async function cargarAlumnos() {
        containerAlumnos.innerHTML = `
            <div class="student-row">
                <div class="student-data" style="text-align:center;width:100%;padding:1.5rem;color:#666;">
                    Cargando alumnos…
                </div>
            </div>`;

        const params = obtenerParams();

        try {
            // FIX CRÍTICO: credentials:'include' para que la sesión viaje
            const res = await fetch(`/api/alumnos/buscar/alumnos?${params}`, {
                credentials: 'include',
            });

            if (res.status === 401) { window.location.href = '/login.html'; return; }
            if (!res.ok) throw new Error(`HTTP ${res.status}`);

            const resultado = await res.json();
            if (!resultado.success) throw new Error(resultado.message || 'Error del servidor');

            alumnosActuales = resultado.data || [];
            seleccionados.clear();
            actualizarBarraSeleccion();
            renderizarAlumnos();

        } catch (err) {
            console.error('Error cargando alumnos:', err);
            containerAlumnos.innerHTML = `
                <div class="student-row">
                    <div class="student-data" style="text-align:center;width:100%;color:#d32f2f;font-weight:700;padding:1.5rem;">
                        Error al conectar. Verifica la consola (F12).
                    </div>
                </div>`;
        }
    }

    // ── Renderizar lista ──────────────────────────────────────
    function renderizarAlumnos() {
        if (!alumnosActuales.length) {
            containerAlumnos.innerHTML = `
                <div class="student-row">
                    <div class="student-data" style="text-align:center;width:100%;color:#d32f2f;font-weight:700;padding:1.5rem;">
                        No se encontraron alumnos con estos filtros.
                    </div>
                </div>`;
            actualizarBtnSelAll();
            return;
        }

        containerAlumnos.innerHTML = '';

        alumnosActuales.forEach(alumno => {
            const estaSeleccionado = seleccionados.has(alumno.boleta);

            const fila = document.createElement('div');
            fila.className = 'student-row' + (estaSeleccionado ? ' row-seleccionada' : '');
            fila.dataset.boleta = alumno.boleta;

            fila.innerHTML = `
                <div class="student-checkbox-col">
                    <input type="checkbox"
                           class="alumno-checkbox"
                           data-boleta="${alumno.boleta}"
                           ${estaSeleccionado ? 'checked' : ''}
                           onclick="event.stopPropagation()">
                </div>
                <div class="student-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                         stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                        <circle cx="12" cy="7" r="4"/>
                    </svg>
                </div>
                <div class="student-data">
                    <div><strong>Nombre:</strong> ${esc(alumno.nombre_completo)}</div>
                    <div><strong>Situación Académica:</strong> ${esc(alumno.estado_academico)}</div>
                    <div><strong>Grupo:</strong> ${esc(alumno.grupo)}</div>
                    <div><strong>Turno:</strong> ${esc(alumno.turno)}</div>
                    <div><strong>Boleta:</strong> ${esc(String(alumno.boleta))}</div>
                    <div><strong>Puertas Abiertas:</strong> ${alumno.puertas_abiertas ? 'Sí' : 'No'}</div>
                </div>`;

            // Clic en FILA → navegar (excepto si fue en el checkbox)
            fila.addEventListener('click', (e) => {
                if (e.target.classList.contains('alumno-checkbox')) return;
                window.location.href = `/BuscarAlumno.html?boleta=${alumno.boleta}`;
            });

            // Clic en CHECKBOX → toggle selección
            const cb = fila.querySelector('.alumno-checkbox');
            cb.addEventListener('change', () => {
                if (cb.checked) {
                    seleccionados.add(alumno.boleta);
                    fila.classList.add('row-seleccionada');
                } else {
                    seleccionados.delete(alumno.boleta);
                    fila.classList.remove('row-seleccionada');
                }
                actualizarBarraSeleccion();
                actualizarBtnSelAll();
            });

            containerAlumnos.appendChild(fila);
        });

        actualizarBtnSelAll();
    }

    // ── Seleccionar / deseleccionar todos ─────────────────────
    function toggleSeleccionarTodos() {
        const todosSeleccionados = alumnosActuales.length > 0 &&
            alumnosActuales.every(a => seleccionados.has(a.boleta));

        if (todosSeleccionados) {
            alumnosActuales.forEach(a => seleccionados.delete(a.boleta));
        } else {
            alumnosActuales.forEach(a => seleccionados.add(a.boleta));
        }

        renderizarAlumnos();
        actualizarBarraSeleccion();
    }

    function actualizarBtnSelAll() {
        if (!btnSelAll) return;
        if (!alumnosActuales.length) {
            btnSelAll.textContent = '☐ Seleccionar todos';
            return;
        }
        const todosSeleccionados = alumnosActuales.every(a => seleccionados.has(a.boleta));
        btnSelAll.textContent = todosSeleccionados
            ? '☑ Deseleccionar todos'
            : '☐ Seleccionar todos';
    }

    // ── Barra de selección ────────────────────────────────────
    function actualizarBarraSeleccion() {
        if (!seleccionBar || !seleccionContador) return;
        const n = seleccionados.size;
        if (n > 0) {
            seleccionBar.style.display    = 'flex';
            seleccionContador.textContent = `${n} alumno${n !== 1 ? 's' : ''} seleccionado${n !== 1 ? 's' : ''}`;
        } else {
            seleccionBar.style.display    = 'none';
            seleccionContador.textContent = '';
        }
    }

    // ── Limpiar filtros ───────────────────────────────────────
    function limpiarFiltros() {
        formFiltros?.reset();
        if (searchInput) searchInput.value = '';
        seleccionados.clear();
        cargarAlumnos();
    }

    // ── Actualizar indicador de hora de refresco ──────────────
    function actualizarHoraRefresh() {
        if (!refreshIndicador) return;
        const ahora = new Date();
        const hora  = ahora.toLocaleTimeString('es-MX', {
            timeZone: 'America/Mexico_City', hour: '2-digit', minute: '2-digit', second: '2-digit',
        });
        refreshIndicador.textContent = `Actualizado: ${hora}`;
    }

    // ── Descargar PDF ─────────────────────────────────────────
    async function descargarPDF() {
        if (!btnPdf) return;

        btnPdf.disabled     = true;
        btnPdf.textContent  = '⏳ Generando PDF…';

        try {
            const params = obtenerParams();
            if (seleccionados.size > 0) {
                params.append('boletas', Array.from(seleccionados).join(','));
            }
            const url    = `/api/reportes/alumnos-pdf?${params}`;

            const res = await fetch(url, { credentials: 'include' });

            if (res.status === 401) { window.location.href = '/login.html'; return; }
            if (res.status === 403) {
                alert('No tienes permisos para descargar reportes.');
                return;
            }
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.message || `Error ${res.status}`);
            }

            // Convertir la respuesta a Blob y forzar descarga
            const blob = await res.blob();
            const blobUrl = URL.createObjectURL(blob);

            // Crear <a> temporal con el nombre del archivo
            const ahora    = new Date();
            const fechaStr = `${ahora.getFullYear()}${String(ahora.getMonth()+1).padStart(2,'0')}${String(ahora.getDate()).padStart(2,'0')}`;
            const filename = `reporte_alumnos_${fechaStr}.pdf`;

            const a  = document.createElement('a');
            a.href   = blobUrl;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);

            // Liberar la URL del blob después de un momento
            setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);

        } catch (err) {
            console.error('Error descargando PDF:', err);
            alert(`Error al generar el PDF: ${err.message}`);
        } finally {
            btnPdf.disabled    = false;
            btnPdf.textContent = 'Descargar PDF';
        }
    }

    // ── Descargar PDF de incidencias ──────────────────────────
    async function descargarPDFIncidencias() {
        if (!btnPdfInc) return;

        btnPdfInc.disabled    = true;
        btnPdfInc.textContent = '⏳ Generando PDF…';

        try {
            const params = obtenerParams();
            if (seleccionados.size > 0) {
                params.append('boletas', Array.from(seleccionados).join(','));
            }
            // Pasar rango de fechas si está activo
            if (fechaInicio) params.append('fecha_inicio', fechaInicio);
            if (fechaFin)    params.append('fecha_fin',    fechaFin);

            const url = `/api/reportes/incidencias-pdf?${params}`;

            const res = await fetch(url, { credentials: 'include' });

            if (res.status === 401) { window.location.href = '/login.html'; return; }
            if (res.status === 403) {
                alert('No tienes permisos para descargar reportes.');
                return;
            }
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.message || `Error ${res.status}`);
            }

            const blob    = await res.blob();
            const blobUrl = URL.createObjectURL(blob);

            const ahora    = new Date();
            const fechaStr = `${ahora.getFullYear()}${String(ahora.getMonth()+1).padStart(2,'0')}${String(ahora.getDate()).padStart(2,'0')}`;
            const filename = `incidencias_alumnos_${fechaStr}.pdf`;

            const a      = document.createElement('a');
            a.href       = blobUrl;
            a.download   = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);

            setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);

        } catch (err) {
            console.error('Error descargando PDF incidencias:', err);
            alert(`Error al generar el PDF: ${err.message}`);
        } finally {
            btnPdfInc.disabled    = false;
            btnPdfInc.textContent = 'PDF Incidencias';
        }
    }

    // ── Cambiar entre modo Datos e Incidencias ────────────────
    function cambiarModo(modo) {
        modoVista = modo;

        if (modo === 'datos') {
            tabDatos?.classList.add('tab-activo');
            tabIncidencias?.classList.remove('tab-activo');
            if (btnSelAll)   btnSelAll.style.display   = '';
            if (btnPeriodo)  btnPeriodo.style.display  = 'none';
            if (periodoPanel) periodoPanel.style.display = 'none';
            if (incInfoBar)  incInfoBar.classList.remove('visible');
            seleccionados.clear();
            cargarAlumnos();
        } else {
            tabDatos?.classList.remove('tab-activo');
            tabIncidencias?.classList.add('tab-activo');
            if (btnSelAll)   btnSelAll.style.display   = 'none';
            if (btnPeriodo)  btnPeriodo.style.display  = '';
            if (periodoPanel) periodoPanel.style.display = 'flex';
            seleccionados.clear();
            actualizarBarraSeleccion();

            // Pre-rellenar con la semana actual si no hay fechas
            if (!fechaInicio || !fechaFin) {
                const hoy   = new Date();
                const dow   = hoy.getDay();                      // 0=Dom
                const lunes = new Date(hoy);
                lunes.setDate(hoy.getDate() - ((dow + 6) % 7)); // retroceder al lunes
                const viernes = new Date(lunes);
                viernes.setDate(lunes.getDate() + 4);

                fechaInicio = lunes.toISOString().split('T')[0];
                fechaFin    = viernes.toISOString().split('T')[0];

                if (fechaInicioInput) fechaInicioInput.value = fechaInicio;
                if (fechaFinInput)    fechaFinInput.value    = fechaFin;
            }
            actualizarLabelPeriodo();
            cargarIncidencias();
        }
    }

    // ── Formatear etiqueta del período ────────────────────────
    const MESES_ABREV = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];

    function actualizarLabelPeriodo() {
        if (!periodoLabel || !fechaInicio || !fechaFin) return;
        const fi = new Date(fechaInicio + 'T12:00:00');
        const ff = new Date(fechaFin    + 'T12:00:00');
        periodoLabel.textContent =
            `${fi.getDate()}/${MESES_ABREV[fi.getMonth()]}–${ff.getDate()}/${MESES_ABREV[ff.getMonth()]}`;
    }

    // ── Cargar incidencias del período ────────────────────────
    async function cargarIncidencias() {
        if (!fechaInicio || !fechaFin) return;

        containerAlumnos.innerHTML = `
            <div class="student-row">
                <div class="student-data" style="text-align:center;width:100%;padding:1.5rem;color:#666;">
                    Cargando incidencias…
                </div>
            </div>`;

        const params = new URLSearchParams();
        params.append('fecha_inicio', fechaInicio);
        params.append('fecha_fin',    fechaFin);

        const q = searchInput?.value.trim();
        if (q) params.append('q', q);

        const grupo = filtroGrupo?.value || '';
        if (grupo) params.append('grupo', grupo);

        const turno = document.querySelector('input[name="turno"]:checked');
        if (turno) params.append('turno', turno.value);

        try {
            const res = await fetch(`/api/alumnos/incidencias/periodo?${params}`, {
                credentials: 'include',
            });
            if (res.status === 401) { window.location.href = '/login.html'; return; }
            if (!res.ok) throw new Error(`HTTP ${res.status}`);

            const data = await res.json();
            if (!data.success) throw new Error(data.message || 'Error del servidor');

            if (incInfoBar && incInfoText) {
                const n = data.data.length;
                incInfoText.textContent =
                    `Período de ${data.dias_habiles} día(s) hábil(es) · ${n} alumno${n !== 1 ? 's' : ''} con incidencia${n !== 1 ? 's' : ''}`;
                incInfoBar.classList.add('visible');
            }

            renderizarIncidencias(data.data);

        } catch (err) {
            console.error('Error cargando incidencias:', err);
            containerAlumnos.innerHTML = `
                <div class="student-row">
                    <div class="student-data" style="text-align:center;width:100%;color:#d32f2f;font-weight:700;padding:1.5rem;">
                        Error al cargar incidencias. Verifica la consola (F12).
                    </div>
                </div>`;
        }
    }

    // ── Renderizar filas de incidencias ───────────────────────
    function renderizarIncidencias(lista) {
        containerAlumnos.innerHTML = '';

        if (!lista.length) {
            containerAlumnos.innerHTML = `
                <div class="student-row">
                    <div class="student-data" style="text-align:center;width:100%;color:#2e7d32;font-weight:700;padding:1.5rem;">
                        Sin incidencias en el período seleccionado.
                    </div>
                </div>`;
            return;
        }

        lista.forEach(alumno => {
            const fila = document.createElement('div');
            fila.className = 'student-row incidencia-row';
            fila.dataset.boleta = alumno.boleta;

            const badges = [
                alumno.retardos      > 0 ? `<span class="badge badge-retardo">Retardos: ${alumno.retardos}</span>`            : '',
                alumno.sin_credencial > 0 ? `<span class="badge badge-credencial">Sin Credencial: ${alumno.sin_credencial}</span>` : '',
                alumno.faltas        > 0 ? `<span class="badge badge-falta">Faltas: ${alumno.faltas}</span>`                   : '',
            ].filter(Boolean).join('');

            fila.innerHTML = `
                <div class="student-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                         stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                        <circle cx="12" cy="7" r="4"/>
                    </svg>
                </div>
                <div class="student-data">
                    <div><strong>Nombre:</strong> ${esc(alumno.nombre_completo)}</div>
                    <div class="badge-total">Total: ${alumno.total_incidencias} incidencia(s)</div>
                    <div><strong>Grupo:</strong> ${esc(alumno.grupo)} &nbsp;|&nbsp; <strong>Turno:</strong> ${esc(alumno.turno)}</div>
                    <div><strong>Boleta:</strong> ${esc(String(alumno.boleta))}</div>
                    <div class="inc-badges">${badges}</div>
                </div>`;

            fila.addEventListener('click', () => {
                window.location.href = `/BuscarAlumno.html?boleta=${alumno.boleta}`;
            });

            containerAlumnos.appendChild(fila);
        });
    }

    // ── Escape HTML ───────────────────────────────────────────
    function esc(s) {
        if (!s) return '';
        return String(s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    // ── Eventos ───────────────────────────────────────────────
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            debounce(() => modoVista === 'datos' ? cargarAlumnos() : cargarIncidencias(), 300);
        });
    }
    if (formFiltros) {
        formFiltros.addEventListener('change', () => {
            modoVista === 'datos' ? cargarAlumnos() : cargarIncidencias();
        });
    }
    if (filtroGrupo) {
        filtroGrupo.addEventListener('change', () => {
            modoVista === 'datos' ? cargarAlumnos() : cargarIncidencias();
        });
    }
    if (btnSelAll) {
        btnSelAll.addEventListener('click', toggleSeleccionarTodos);
    }
    if (btnClearFilters) {
        btnClearFilters.addEventListener('click', limpiarFiltros);
    }
    if (btnDeselectBar) {
        btnDeselectBar.addEventListener('click', () => {
            alumnosActuales.forEach(a => seleccionados.delete(a.boleta));
            renderizarAlumnos();
            actualizarBarraSeleccion();
        });
    }
    if (btnPdf) {
        btnPdf.addEventListener('click', descargarPDF);
    }
    if (btnPdfInc) {
        btnPdfInc.addEventListener('click', descargarPDFIncidencias);
    }

    // ── Tabs Datos / Incidencias ──────────────────────────────
    if (tabDatos) {
        tabDatos.addEventListener('click', () => cambiarModo('datos'));
    }
    if (tabIncidencias) {
        tabIncidencias.addEventListener('click', () => cambiarModo('incidencias'));
    }

    // ── Selector de período ───────────────────────────────────
    if (btnPeriodo) {
        btnPeriodo.addEventListener('click', () => {
            if (periodoPanel) {
                const visible = periodoPanel.style.display === 'flex';
                periodoPanel.style.display = visible ? 'none' : 'flex';
            }
        });
    }
    if (btnAplicar) {
        btnAplicar.addEventListener('click', () => {
            fechaInicio = fechaInicioInput?.value || '';
            fechaFin    = fechaFinInput?.value    || '';
            if (!fechaInicio || !fechaFin) {
                alert('Selecciona ambas fechas.');
                return;
            }
            if (fechaFin < fechaInicio) {
                alert('La fecha final no puede ser anterior a la inicial.');
                return;
            }
            actualizarLabelPeriodo();
            cargarIncidencias();
        });
    }

    // ── Carga inicial ─────────────────────────────────────────
    cargarGrupos();
    cargarEstados();
    cargarAlumnos().then(actualizarHoraRefresh);

    // Auto-refresco cada 30 s solo en modo Datos
    setInterval(() => {
        if (modoVista === 'datos') cargarAlumnos().then(actualizarHoraRefresh);
    }, 30000);
});