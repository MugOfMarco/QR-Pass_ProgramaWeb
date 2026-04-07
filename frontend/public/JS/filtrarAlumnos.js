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
    const seleccionBar      = document.getElementById('seleccion-bar');
    const seleccionContador = document.getElementById('seleccion-contador');
    const btnDeselectBar    = document.getElementById('btn-deselect-bar');

    // ── Estado ────────────────────────────────────────────────
    let alumnosActuales = [];       // cache de alumnos renderizados
    let seleccionados   = new Set(); // boletas seleccionadas
    let filtrosActivos  = {};        // filtros aplicados en la última carga

    // ── Debounce ──────────────────────────────────────────────
    let timeoutId;
    const debounce = (fn, ms) => { clearTimeout(timeoutId); timeoutId = setTimeout(fn, ms); };

    // ── Construir query params actuales ───────────────────────
    function obtenerParams() {
        const params = new URLSearchParams();
        const q = searchInput?.value.trim();
        if (q) params.append('q', q);

        const turno   = document.querySelector('input[name="turno"]:checked');
        const puertas = document.querySelector('input[name="puertas"]:checked');
        const estado  = document.querySelector('input[name="estado"]:checked');
        if (turno)   params.append('turno',   turno.value);
        if (puertas) params.append('puertas', puertas.value);
        if (estado)  params.append('estado',  estado.value);

        // Guardar filtros activos para el PDF
        filtrosActivos = { q, turno: turno?.value, puertas: puertas?.value, estado: estado?.value };

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

    // ── Descargar PDF ─────────────────────────────────────────
    // El backend genera el PDF y lo devuelve como blob.
    // El navegador muestra el diálogo "Guardar como" nativo.
    async function descargarPDF() {
        if (!btnPdf) return;

        btnPdf.disabled     = true;
        btnPdf.textContent  = '⏳ Generando PDF…';

        try {
            // Usar los mismos filtros activos de la lista actual
            const params = obtenerParams();
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
        searchInput.addEventListener('input', () => debounce(cargarAlumnos, 300));
    }
    if (formFiltros) {
        formFiltros.addEventListener('change', cargarAlumnos);
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

    // ── Carga inicial ─────────────────────────────────────────
    cargarAlumnos();
});