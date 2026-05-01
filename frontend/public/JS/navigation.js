// frontend/public/JS/navigation.js
document.addEventListener('DOMContentLoaded', async () => {

    // ── 1. VERIFICACIÓN DE AUTENTICACIÓN ─────────────────────
    let userTipo = null;

    try {
        const res  = await fetch('/api/auth/check', { credentials: 'include' });
        const data = await res.json();

        if (!data.isAuthenticated) {
            const esLogin = window.location.pathname.endsWith('login.html')
                         || window.location.pathname === '/';
            if (!esLogin) {
                window.location.href = '/login.html';
                return;
            }
        }

        userTipo = data.tipo;

    } catch (err) {
        console.warn('navigation.js: No se pudo verificar auth:', err.message);
    }

    // ── 2. CONSTRUIR MENÚ SEGÚN ROL ──────────────────────────
    const listaOpciones = document.getElementById('lista-opciones');

    if (listaOpciones && userTipo) {

        const menuAdmin = [
            { href: '/Dashboard.html',            label: 'Dashboard' },
            { href: '/Entrada_Salida.html',        label: 'Registro entrada / salida' },
            { href: '/BuscarAlumno.html',          label: 'Buscar alumno' },
            { href: '/ModificarAlumno.html',       label: 'Modificar alumno' },
            { href: '/FiltrarAlumnos.html',        label: 'Filtrar alumnos' },
            { href: '/GestionGrupos.html',         label: 'Gestión de grupos' },
            { href: '/GestionUsuarios.html',       label: 'Gestión de usuarios' },
            { href: '/Descargasbd.html',           label: 'Descargar respaldo' },
            { href: '/Soporte.html',               label: 'Soporte QRPASS' },

        ];

        const menuVigilante = [
            { href: '/Entrada_Salida.html',        label: 'Entrada / Salida' },
            { href: '/BuscarAlumnoVigilante.html', label: 'Buscar alumno' },
            { href: '/FiltrarAlumnos.html',        label: 'Filtrar alumnos' },
            { href: '/Soporte.html',               label: 'Soporte QRPASS' },

        ];

        const items = userTipo === 'Administrador' ? menuAdmin : menuVigilante;

        listaOpciones.innerHTML = '';

        const currentPath = window.location.pathname;

        items.forEach(item => {
            const li = document.createElement('li');
            const a  = document.createElement('a');
            a.href        = item.href;
            a.textContent = item.label;

            const itemPath = item.href.replace(/^\//, '');
            if (currentPath.endsWith(itemPath) || currentPath.endsWith(item.href)) {
                a.classList.add('active');
            }

            li.appendChild(a);
            listaOpciones.appendChild(li);
        });

        // ── Botón de cerrar sesión al final del menú ──────────
        const liSep = document.createElement('li');
        liSep.style.cssText = 'border-top: 2px solid #f0e8ea; margin-top: .5rem;';

        const aCerrar = document.createElement('a');
        aCerrar.href             = '#';
        aCerrar.textContent      = '🚪 Cerrar sesión';
        aCerrar.style.cssText    = 'color: #b71c1c; font-weight: 700;';
        aCerrar.addEventListener('click', async (e) => {
            e.preventDefault();
            try {
                await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
            } catch { /* ignorar */ }
            window.location.href = '/login.html';
        });

        liSep.appendChild(aCerrar);
        listaOpciones.appendChild(liSep);
    }

    // ── 3. REFERENCIAS AL DOM ─────────────────────────────────
    const toggleBtn = document.getElementById('menu-toggle-btn');
    const navPanel  = document.querySelector('.menu-navegacion');
    const overlay   = document.getElementById('menu-overlay');

    if (!toggleBtn || !navPanel || !overlay) return;

    // ── 4. OPEN / CLOSE ───────────────────────────────────────
    function openNav() {
        navPanel.classList.add('nav-open');
        overlay.classList.add('nav-open');
        toggleBtn.setAttribute('aria-expanded', 'true');
    }

    function closeNav() {
        navPanel.classList.remove('nav-open');
        overlay.classList.remove('nav-open');
        toggleBtn.setAttribute('aria-expanded', 'false');
    }

    function toggleNav() {
        navPanel.classList.contains('nav-open') ? closeNav() : openNav();
    }

    // ── 5. EVENTOS ───────────────────────────────────────────
    toggleBtn.addEventListener('click', (e) => { e.stopPropagation(); toggleNav(); });
    overlay.addEventListener('click', closeNav);

    document.querySelectorAll('.menu-lista a').forEach(link => {
        link.addEventListener('click', () => { setTimeout(closeNav, 120); });
    });

    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeNav(); });
});