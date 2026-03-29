// frontend/public/JS/buscarAlumno.js
class SistemaAlumnos {
    constructor() {
        this.apiBase      = '/api';
        this.alumnoActual = null;
        this.incidencias  = [];
        this.userType     = null;
        this.userInfo     = null;
        this.initialize();
    }

    // ─────────────────────────────────────────────────────────
    // INIT — verificar sesión
    // ─────────────────────────────────────────────────────────
    async initialize() {
        try {
            const res  = await fetch(`${this.apiBase}/auth/check`, { credentials: 'include' });
            const data = await res.json();

            if (!data.success || !data.isAuthenticated) {
                alert('Debes iniciar sesión');
                window.location.href = '/login.html';
                return;
            }
            if (data.tipo !== 'Administrador' && data.tipo !== 'Prefecto') {
                alert('Sin permisos para esta página');
                window.location.href = '/menu.html';
                return;
            }

            this.userInfo = data.user;
            this.userType = data.tipo;

            this.initEventListeners();
            this.configureButtonsByRole();

            // =========================================================
            // NUEVO: LEER LA BOLETA DESDE LA URL (Query String)
            // =========================================================
            const urlParams = new URLSearchParams(window.location.search);
            const boletaParam = urlParams.get('boleta'); // Extrae "12345" de ?boleta=12345
            
            if (boletaParam) {
                // 1. Llenamos el input visualmente para que el admin lo vea
                const inputBoleta = document.getElementById('search-boleta-inc');
                if (inputBoleta) inputBoleta.value = boletaParam;
                
                // 2. Disparamos la búsqueda automáticamente
                this.buscarAlumno(boletaParam);
            }
            // =========================================================

        } catch (e) {
            console.error('Error verificando auth:', e);
            window.location.href = '/login.html';
        }
    }
    // ─────────────────────────────────────────────────────────
    // EVENTOS
    // ─────────────────────────────────────────────────────────
    initEventListeners() {
        const input = document.getElementById('search-boleta-inc');
        if (!input) return;

        input.addEventListener('input', (e) => {
            e.target.value = e.target.value.replace(/\D/g, '');
            this.buscarAlumno(e.target.value);
        });

        input.addEventListener('keydown', (e) => {
            const allow = ['Backspace','Delete','ArrowLeft','ArrowRight','Tab'];
            if (!allow.includes(e.key) && isNaN(Number(e.key))) e.preventDefault();
        });
    }

    configureButtonsByRole() {
        const btnBloquear    = document.getElementById('btn-bloquear-credencial');
        const btnDesbloquear = document.getElementById('btn-desbloquear-credencial');
        const btnJustSelec   = document.getElementById('btn-justselec');
        const btnJustRet     = document.getElementById('btn-justret');
        const btnJustSin     = document.getElementById('btn-justsin');
        const btnJustAll     = document.getElementById('btn-justall');

        const esAdmin = this.userType === 'Administrador';
        const todos   = [btnBloquear, btnDesbloquear, btnJustSelec, btnJustRet, btnJustSin, btnJustAll];

        todos.forEach(b => {
            if (!b) return;
            b.style.display = esAdmin ? '' : 'none';
            b.disabled = !esAdmin;
        });

        if (esAdmin) {
            btnBloquear   ?.addEventListener('click', () => this.bloquear());
            btnDesbloquear?.addEventListener('click', () => this.desbloquear());
            btnJustSelec  ?.addEventListener('click', () => this.justificarSeleccion());
            btnJustRet    ?.addEventListener('click', () => this.justificarPorTipo('Retardo'));
            btnJustSin    ?.addEventListener('click', () => this.justificarPorTipo('Entrada Sin Credencial'));
            btnJustAll    ?.addEventListener('click', () => this.justificarTodas());
        }
    }

    // ─────────────────────────────────────────────────────────
    // BUSCAR ALUMNO
    // ─────────────────────────────────────────────────────────
    async buscarAlumno(valor) {
        const boleta = String(valor).replace(/\D/g, '').trim();
        if (boleta.length !== 10) { this.limpiarDatos(); return; }

        try {
            const res = await fetch(`${this.apiBase}/alumnos/${boleta}`, {
                credentials: 'include',
            });

            if (res.status === 401) { window.location.href = '/login.html'; return; }
            if (res.status === 404) { this.limpiarDatos(); return; }
            if (!res.ok)            { this.limpiarDatos(); return; }

            const data = await res.json();
            if (!data.success || !data.alumno) { this.limpiarDatos(); return; }

            this.alumnoActual = data.alumno;
            this.mostrarDatosAlumno();
            this.mostrarHorario(data.horario || []);
            this.mostrarFoto(data.alumno);
            await this.cargarIncidencias(boleta);
        } catch (e) {
            console.error('Error buscando alumno:', e);
        }
    }

    // ─────────────────────────────────────────────────────────
    // INCIDENCIAS
    // ─────────────────────────────────────────────────────────
    async cargarIncidencias(boleta) {
        try {
            const res = await fetch(`${this.apiBase}/alumnos/${boleta}/registros`, {
                credentials: 'include',
            });
            if (res.status === 401) { window.location.href = '/login.html'; return; }
            if (!res.ok) return;

            const data = await res.json();
            this.incidencias = data.registros || [];
            this.mostrarIncidencias();
        } catch (e) {
            console.error('Error cargando incidencias:', e);
        }
    }

    mostrarIncidencias() {
        const tbody = document.getElementById('incidents-tbody');
        if (!tbody) return;
        tbody.innerHTML = '';

        if (!this.incidencias.length) {
            tbody.innerHTML = `<tr>
                <td colspan="4" style="text-align:center;padding:2rem">
                    No se encontraron registros
                </td></tr>`;
            return;
        }

        this.incidencias.forEach(inc => {
            const tr = document.createElement('tr');
            tr.dataset.idRegistro = inc.id_registro;

            // FIX: usar fecha_hora (no "fecha") y punto_acceso (no "puerta")
            const fechaObj  = inc.fecha_hora ? new Date(inc.fecha_hora) : null;
            const fechaFmt  = fechaObj
                ? fechaObj.toLocaleDateString('es-MX')
                : '—';
            const horaFmt   = fechaObj
                ? fechaObj.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
                : '—';
            const puertaFmt = inc.punto_acceso || '—';
            const yaJust    = inc.justificacion
                ? `<span title="${this.esc(inc.justificacion)}" style="color:#2e7d32">✔</span> `
                : '';
            const tipoClase = (inc.tipo || '').toLowerCase().replace(/\s+/g, '_');

            tr.innerHTML = `
                <td>
                    <input type="checkbox" class="incidencia-checkbox"
                           data-id="${inc.id_registro}"
                           ${inc.justificacion ? 'disabled' : ''}>
                    ${this.esc(puertaFmt)}
                </td>
                <td>${fechaFmt}</td>
                <td>${horaFmt}</td>
                <td class="tipo-${tipoClase}">
                    ${yaJust}${this.esc(inc.tipo || '—')}
                </td>`;
            tbody.appendChild(tr);
        });
    }

    // ─────────────────────────────────────────────────────────
    // BLOQUEO / DESBLOQUEO
    // ─────────────────────────────────────────────────────────
    async bloquear() {
        if (!this.alumnoActual) { this.notif('Busca un alumno primero', 'error'); return; }
        if (!confirm(`¿Bloquear a ${this.alumnoActual.nombre}?`)) return;

        try {
            const res = await fetch(
                `${this.apiBase}/alumnos/bloquear/${this.alumnoActual.boleta}`,
                { method: 'PUT', credentials: 'include' }
            );
            if (res.status === 401) { window.location.href = '/login.html'; return; }
            const data = await res.json();
            if (data.success) {
                this.notif('Credencial bloqueada', 'success');
                this.alumnoActual.bloqueado = true;
                this.actualizarEstadoCredencial();
            } else {
                this.notif(data.message, 'error');
            }
        } catch { this.notif('Error de conexión', 'error'); }
    }

    async desbloquear() {
        if (!this.alumnoActual) { this.notif('Busca un alumno primero', 'error'); return; }
        if (!confirm(`¿Desbloquear a ${this.alumnoActual.nombre}?`)) return;

        try {
            const res = await fetch(
                `${this.apiBase}/alumnos/desbloquear/${this.alumnoActual.boleta}`,
                { method: 'PUT', credentials: 'include' }   // FIX: faltaba credentials
            );
            if (res.status === 401) { window.location.href = '/login.html'; return; }
            const data = await res.json();
            if (data.success) {
                this.notif(data.message, 'success');
                this.alumnoActual.bloqueado      = false;
                this.alumnoActual.sin_credencial = 0;
                this.actualizarEstadoCredencial();
                this.mostrarDatosAlumno();
            } else {
                this.notif(data.message, 'error');
            }
        } catch { this.notif('Error de conexión', 'error'); }
    }

    // ─────────────────────────────────────────────────────────
    // JUSTIFICACIONES
    // ─────────────────────────────────────────────────────────
    obtenerTextoJustificacion() {
        const mapa = {
            item2: 'Se habló con el tutor/a',
            item3: 'Se habló con el estudiante',
            item4: 'Error en el registro',
        };
        return mapa[document.getElementById('item-selector')?.value] ?? null;
    }

    obtenerIncidenciasSeleccionadas() {
        return Array.from(document.querySelectorAll('.incidencia-checkbox:checked'))
            .map(c => this.incidencias.find(i => i.id_registro === parseInt(c.dataset.id)))
            .filter(Boolean);
    }

    async justificarSeleccion() {
        const seleccion = this.obtenerIncidenciasSeleccionadas();
        if (!seleccion.length) { this.notif('Selecciona al menos una incidencia', 'error'); return; }
        await this.procesarJustificaciones(seleccion);
    }

    async justificarPorTipo(tipo) {
        const lista = this.incidencias.filter(i => i.tipo === tipo && !i.justificacion);
        if (!lista.length) { this.notif(`No hay registros de "${tipo}" sin justificar`, 'error'); return; }
        await this.procesarJustificaciones(lista);
    }

    async justificarTodas() {
        const lista = this.incidencias.filter(i => !i.justificacion);
        if (!lista.length) { this.notif('No hay incidencias pendientes', 'error'); return; }
        await this.procesarJustificaciones(lista);
    }

    async procesarJustificaciones(lista) {
        const texto = this.obtenerTextoJustificacion();
        if (!texto) { this.notif('Selecciona una justificación del selector', 'error'); return; }

        let ok = 0, fail = 0;
        for (const inc of lista) {
            try {
                const res = await fetch(`${this.apiBase}/alumnos/justificaciones`, {
                    method:      'POST',
                    headers:     { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({ id_registro: inc.id_registro, justificacion: texto }),
                });
                if (res.status === 401) { window.location.href = '/login.html'; return; }
                const data = await res.json();
                data.success ? ok++ : fail++;
            } catch { fail++; }
        }

        this.notif(
            `${ok} justificada(s)${fail ? ` · ${fail} error(es)` : ''}`,
            fail ? 'error' : 'success'
        );
        await this.cargarIncidencias(this.alumnoActual.boleta);
    }

    // ─────────────────────────────────────────────────────────
    // UI
    // ─────────────────────────────────────────────────────────
    mostrarDatosAlumno() {
        if (!this.alumnoActual) return;
        const a = this.alumnoActual;
        this.set('display-boleta', a.boleta);
        this.set('display-alumno', a.nombre);
        this.set('display-grupo',  a.nombre_grupo);
        document.getElementById('total-incidencias').textContent  = a.sin_credencial ?? 0;
        document.getElementById('total-retardos').textContent     = a.retardos        ?? 0;
        this.actualizarEstadoCredencial();
    }

    mostrarHorario(horario) {
        const tbody = document.getElementById('horario-tbody');
        if (!tbody) return;

        if (!horario.length) {
            tbody.innerHTML = `<tr><td colspan="3" style="text-align:center;padding:1rem">Sin horario</td></tr>`;
            return;
        }

        const orden = ['lunes','martes','miércoles','jueves','viernes'];
        tbody.innerHTML = '';
        horario
            .sort((a, b) => orden.indexOf(a.dia) - orden.indexOf(b.dia)
                            || (a.inicio > b.inicio ? 1 : -1))
            .forEach(c => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${this.cap(c.dia)}</td>
                    <td>${(c.inicio||'').slice(0,5)} – ${(c.fin||'').slice(0,5)}</td>
                    <td>${this.esc(c.materia || '—')}</td>`;
                tbody.appendChild(tr);
            });
    }

    mostrarFoto(alumno) {
        const foto     = document.getElementById('student-photo');
        const photoBox = document.querySelector('.photo-box');
        if (!foto) return;

        if (alumno?.url) {
            foto.src           = alumno.url;
            foto.style.display = 'block';
            foto.onerror       = () => {
                foto.src = 'https://res.cloudinary.com/depoh32sv/image/upload/v1765415709/vector-de-perfil-avatar-predeterminado-foto-usuario-medios-sociales-icono-183042379.jpg_jfpw3y.webp';
            };
        } else {
            foto.src           = '';
            foto.style.display = 'none';
        }

        if (alumno?.bloqueado) {
            foto.classList.add('bloqueado');
            if (photoBox) photoBox.style.borderColor = '#dc3545';
        } else {
            foto.classList.remove('bloqueado');
            if (photoBox) photoBox.style.borderColor = '';
        }
    }

    actualizarEstadoCredencial() {
        const el = document.getElementById('estado-credencial');
        if (!el || !this.alumnoActual) return;
        const bloq = this.alumnoActual.bloqueado;
        el.textContent = bloq ? 'BLOQUEADA' : 'ACTIVA';
        el.className   = bloq
            ? 'counter-value estado-bloqueada'
            : 'counter-value estado-activa';
    }

    limpiarDatos() {
        ['display-boleta','display-alumno','display-grupo'].forEach(id => this.set(id, ''));

        const el = document.getElementById('total-incidencias');
        if (el) el.textContent = '0';
        const er = document.getElementById('total-retardos');
        if (er) er.textContent = '0';

        const horarioTbody = document.getElementById('horario-tbody');
        if (horarioTbody) horarioTbody.innerHTML = `<tr>
            <td colspan="3" style="text-align:center;padding:1rem">Ingresa una boleta</td></tr>`;

        const incTbody = document.getElementById('incidents-tbody');
        if (incTbody) incTbody.innerHTML = `<tr>
            <td colspan="4" style="text-align:center;padding:2rem">Ingresa una boleta</td></tr>`;

        const foto = document.getElementById('student-photo');
        if (foto) { foto.src = ''; foto.style.display = 'none'; }

        const ec = document.getElementById('estado-credencial');
        if (ec) { ec.textContent = '—'; ec.className = 'counter-value'; }

        this.alumnoActual = null;
        this.incidencias  = [];
    }

    // ─────────────────────────────────────────────────────────
    // HELPERS
    // ─────────────────────────────────────────────────────────
    set(id, val) {
        const el = document.getElementById(id);
        if (el) el.value = val;
    }

    notif(msg, tipo) {
        const n = document.createElement('div');
        n.textContent = msg;
        n.style.cssText = `
            position:fixed;top:20px;right:20px;padding:12px 20px;
            border-radius:8px;color:white;font-weight:700;z-index:9999;
            background:${tipo === 'success' ? '#2e7d32' : '#b71c1c'};
            box-shadow:0 4px 12px rgba(0,0,0,.2);font-size:.9rem;`;
        document.body.appendChild(n);
        setTimeout(() => n.remove(), 3000);
    }

    cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : ''; }
    esc(s) {
        if (!s) return '';
        return String(s)
            .replace(/&/g,'&amp;').replace(/</g,'&lt;')
            .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }
}

document.addEventListener('DOMContentLoaded', () => { new SistemaAlumnos(); });