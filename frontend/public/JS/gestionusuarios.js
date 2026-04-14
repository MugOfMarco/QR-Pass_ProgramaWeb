// frontend/public/JS/gestionUsuarios.js
// ============================================================
// FIXES:
//   · new GestionUsuarios() envuelto en DOMContentLoaded
//     → elimina race condition con el select#f-rol
//   · init() ya no duplica el check de auth con navigation.js
//     porque navigation.js corre primero y redirige si no hay sesión.
//     init() solo verifica que el rol sea Administrador.
//   · cargarRoles() ahora tiene manejo de error visible
// ============================================================

class GestionUsuarios {
    constructor() {
        this.api           = '/api/usuarios';
        this.usuarioSesion = null;
        this.modoEdicion   = false;
        this.idEditando    = null;
        this.idPassword    = null;

        // init() se llama tras DOMContentLoaded (ver abajo)
        this.init();
    }

    async init() {
        // ── Verificar sesión y rol ─────────────────────────
        try {
            const r    = await fetch('/api/auth/check', { credentials: 'include' });
            const data = await r.json();

            if (!data.isAuthenticated) { location.href = '/login.html'; return; }
            if (data.tipo !== 'Administrador') { location.href = '/Entrada_Salida.html'; return; }

            this.usuarioSesion      = data.user;
            this.usuarioSesion.tipo = data.tipo;
            this.usuarioSesion.id   = data.user?.id;

        } catch { location.href = '/login.html'; return; }

        // ── Cargar datos y eventos ─────────────────────────
        // Paralelo: roles y usuarios al mismo tiempo
        await Promise.all([
            this.cargarRoles(),
            this.cargarUsuarios(),
        ]);

        this.bindEvents();
    }

    // ─────────────────────────────────────────────────────────
    // CARGAR DATOS
    // ─────────────────────────────────────────────────────────
    async cargarUsuarios() {
        try {
            const r    = await fetch(this.api, { credentials: 'include' });
            const data = await r.json();
            if (!data.success) { this.toast('Error cargando usuarios', 'err'); return; }
            this.renderTabla(data.usuarios);
        } catch { this.toast('Error de conexión al cargar usuarios', 'err'); }
    }

    async cargarRoles() {
        const sel = document.getElementById('f-rol');
        if (!sel) return;   // por si acaso el DOM aún no tiene el elemento

        try {
            const r    = await fetch(`${this.api}/roles`, { credentials: 'include' });
            if (!r.ok) throw new Error(`HTTP ${r.status}`);

            const data = await r.json();
            if (!data.success || !data.roles?.length) {
                sel.innerHTML = '<option value="">Sin roles disponibles</option>';
                return;
            }

            sel.innerHTML = '<option value="">— Selecciona rol —</option>';
            data.roles.forEach(rol => {
                const opt       = document.createElement('option');
                opt.value       = rol.id_rol;
                opt.textContent = rol.nombre_rol;
                sel.appendChild(opt);
            });
        } catch (e) {
            console.error('Error cargando roles:', e);
            sel.innerHTML = '<option value="">Error al cargar roles</option>';
        }
    }

    // ─────────────────────────────────────────────────────────
    // RENDERIZAR TABLA
    // ─────────────────────────────────────────────────────────
    renderTabla(usuarios) {
        const tbody = document.getElementById('tbody-usuarios');
        if (!usuarios.length) {
            tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:2rem;color:#999">Sin usuarios registrados</td></tr>`;
            return;
        }

        tbody.innerHTML = usuarios.map(u => {
            const badgeRol = {
                'Administrador': 'badge-admin',
                'Prefecto':      'badge-prefecto',
                'Vigilante':     'badge-vigilante',
            }[u.rol] || 'badge-vigilante';

            const esMismo = u.usuario === this.usuarioSesion?.usuario;

            return `
            <tr>
                <td>
                    <strong>${this.esc(u.usuario)}</strong>
                    ${esMismo ? '<span class="tag-tu">(tú)</span>' : ''}
                </td>
                <td>${this.esc(u.nombre_completo)}</td>
                <td class="col-email">${u.email ? this.esc(u.email) : '—'}</td>
                <td><span class="badge ${badgeRol}">${this.esc(u.rol)}</span></td>
                <td>
                    <span class="badge ${u.activo ? 'badge-activo' : 'badge-inactivo'}">
                        ${u.activo ? 'Activo' : 'Inactivo'}
                    </span>
                </td>
                <td class="col-acciones">
                    <button class="btn-accion btn-editar"
                            onclick="app.abrirEdicion(${u.id_usuario})">
                        Editar
                    </button>
                    <button class="btn-accion btn-pass"
                            onclick="app.abrirModalPassword(${u.id_usuario}, '${this.esc(u.nombre_completo)}', ${esMismo})">
                        Contraseña
                    </button>
                    ${!esMismo ? `
                    <button class="btn-accion btn-toggle"
                            onclick="app.toggleActivo(${u.id_usuario}, ${u.activo})">
                        ${u.activo ? 'Desactivar' : 'Activar'}
                    </button>` : ''}
                </td>
            </tr>`;
        }).join('');
    }

    // ─────────────────────────────────────────────────────────
    // FORMULARIO LATERAL
    // ─────────────────────────────────────────────────────────
    bindEvents() {
        document.getElementById('btn-nuevo-usuario')
            ?.addEventListener('click', () => this.abrirCreacion());

        document.getElementById('btn-cancelar-usuario')
            ?.addEventListener('click', () => this.abrirCreacion());

        document.getElementById('form-usuario')
            ?.addEventListener('submit', (e) => { e.preventDefault(); this.guardarUsuario(); });

        document.getElementById('btn-confirmar-pass')
            ?.addEventListener('click', () => this.guardarPassword());

        document.getElementById('btn-cerrar-modal')
            ?.addEventListener('click', () => this.cerrarModal());

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') this.cerrarModal();
        });
    }

    abrirCreacion() {
        this.modoEdicion = false;
        this.idEditando  = null;

        document.getElementById('panel-titulo').textContent        = 'Nuevo usuario';
        document.getElementById('btn-guardar-usuario').textContent = 'Crear usuario';
        document.getElementById('f-id').value       = '';
        document.getElementById('f-nombre').value   = '';
        document.getElementById('f-usuario').value  = '';
        document.getElementById('f-email').value    = '';
        document.getElementById('f-rol').value      = '';
        document.getElementById('f-password').value = '';
        document.getElementById('f-usuario').readOnly              = false;
        document.getElementById('seccion-password').style.display  = '';
        document.getElementById('seccion-activo').style.display    = 'none';
        document.getElementById('f-password').required             = true;
    }

    async abrirEdicion(id) {
        try {
            const r    = await fetch(`${this.api}/${id}`, { credentials: 'include' });
            const data = await r.json();
            if (!data.success) { this.toast(data.message, 'err'); return; }

            const u = data.usuario;
            this.modoEdicion = true;
            this.idEditando  = id;

            document.getElementById('panel-titulo').textContent        = 'Editar usuario';
            document.getElementById('btn-guardar-usuario').textContent = 'Guardar cambios';
            document.getElementById('f-id').value      = u.id_usuario;
            document.getElementById('f-nombre').value  = u.nombre_completo;
            document.getElementById('f-usuario').value = u.usuario;
            document.getElementById('f-email').value   = u.email || '';
            document.getElementById('f-rol').value     = u.id_rol;
            document.getElementById('f-activo').value  = String(u.activo);

            document.getElementById('f-usuario').readOnly             = true;
            document.getElementById('seccion-password').style.display = 'none';
            document.getElementById('seccion-activo').style.display   = '';
            document.getElementById('f-password').required            = false;

            document.querySelector('.panel')?.scrollIntoView({ behavior: 'smooth' });
        } catch { this.toast('Error cargando usuario', 'err'); }
    }

    async guardarUsuario() {
        const nombre   = document.getElementById('f-nombre').value.trim();
        const usuario  = document.getElementById('f-usuario').value.trim();
        const email    = document.getElementById('f-email').value.trim();
        const idRol    = document.getElementById('f-rol').value;
        const password = document.getElementById('f-password').value;
        const activo   = document.getElementById('f-activo').value;

        if (!nombre || !idRol) { this.toast('Nombre y rol son obligatorios', 'err'); return; }

        const btn = document.getElementById('btn-guardar-usuario');
        btn.disabled = true; btn.textContent = 'Guardando…';

        try {
            let r, data;

            if (!this.modoEdicion) {
                if (!usuario)            { this.toast('El nombre de usuario es obligatorio', 'err'); return; }
                if (password.length < 6) { this.toast('Mínimo 6 caracteres en la contraseña', 'err'); return; }

                r    = await fetch(this.api, {
                    method:      'POST',
                    headers:     { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({ usuario, password, nombre_completo: nombre, email, id_rol: idRol }),
                });
                data = await r.json();
            } else {
                r    = await fetch(`${this.api}/${this.idEditando}`, {
                    method:      'PUT',
                    headers:     { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({
                        nombre_completo: nombre,
                        email,
                        id_rol:  idRol,
                        activo:  activo === 'true',
                    }),
                });
                data = await r.json();
            }

            if (!r.ok || !data.success) { this.toast(data.message || 'Error del servidor', 'err'); return; }

            this.toast(data.message, 'ok');
            this.abrirCreacion();
            await this.cargarUsuarios();

        } catch { this.toast('Error de conexión', 'err'); }
        finally {
            btn.disabled    = false;
            btn.textContent = this.modoEdicion ? 'Guardar cambios' : 'Crear usuario';
        }
    }

    // ─────────────────────────────────────────────────────────
    // ACTIVAR / DESACTIVAR
    // ─────────────────────────────────────────────────────────
    async toggleActivo(id, estaActivo) {
        const accion = estaActivo ? 'desactivar' : 'reactivar';
        if (!confirm(`¿Seguro que deseas ${accion} este usuario?`)) return;

        try {
            const r    = await fetch(`${this.api}/${id}/${accion}`, {
                method: 'PUT', credentials: 'include',
            });
            const data = await r.json();
            this.toast(data.message || (data.success ? 'Hecho' : 'Error'), data.success ? 'ok' : 'err');
            if (data.success) await this.cargarUsuarios();
        } catch { this.toast('Error de conexión', 'err'); }
    }

    // ─────────────────────────────────────────────────────────
    // MODAL CONTRASEÑA
    // ─────────────────────────────────────────────────────────
    abrirModalPassword(id, nombre, esMismo) {
        this.idPassword = id;
        document.getElementById('modal-titulo').textContent = `Cambiar contraseña — ${nombre}`;

        const secActual = document.getElementById('seccion-pass-actual');
        secActual.style.display      = esMismo ? '' : 'none';
        document.getElementById('m-actual').required = esMismo;

        document.getElementById('m-actual').value    = '';
        document.getElementById('m-nueva').value     = '';
        document.getElementById('m-confirmar').value = '';

        document.getElementById('modal-password').classList.add('visible');
    }

    cerrarModal() {
        document.getElementById('modal-password').classList.remove('visible');
        this.idPassword = null;
    }

    async guardarPassword() {
        const actual    = document.getElementById('m-actual').value;
        const nueva     = document.getElementById('m-nueva').value;
        const confirmar = document.getElementById('m-confirmar').value;

        if (!nueva)              { this.toast('Escribe la nueva contraseña', 'err'); return; }
        if (nueva.length < 6)    { this.toast('Mínimo 6 caracteres', 'err'); return; }
        if (nueva !== confirmar) { this.toast('Las contraseñas no coinciden', 'err'); return; }

        const btn = document.getElementById('btn-confirmar-pass');
        btn.disabled = true; btn.textContent = 'Guardando…';

        try {
            const r    = await fetch(`${this.api}/${this.idPassword}/password`, {
                method:      'PUT',
                headers:     { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ password_actual: actual, password_nueva: nueva }),
            });
            const data = await r.json();
            this.toast(data.message || (data.success ? 'Contraseña actualizada' : 'Error'), data.success ? 'ok' : 'err');
            if (data.success) this.cerrarModal();
        } catch { this.toast('Error de conexión', 'err'); }
        finally { btn.disabled = false; btn.textContent = 'Guardar contraseña'; }
    }

    // ─────────────────────────────────────────────────────────
    // HELPERS
    // ─────────────────────────────────────────────────────────
    toast(msg, tipo = 'ok') {
        const el = document.getElementById('toast');
        if (!el) return;
        el.textContent = msg;
        el.className   = `toast ${tipo} visible`;
        clearTimeout(this._toastTimer);
        this._toastTimer = setTimeout(() => el.classList.remove('visible'), 3200);
    }

    esc(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g,'&amp;').replace(/</g,'&lt;')
            .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }
}

// ── Instanciar SOLO cuando el DOM esté listo ─────────────────
// Esto elimina la race condition con el select#f-rol
// y con los fetch concurrentes de navigation.js
let app;
document.addEventListener('DOMContentLoaded', () => {
    app = new GestionUsuarios();
});