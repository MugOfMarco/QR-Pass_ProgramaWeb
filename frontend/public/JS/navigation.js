// frontend/public/JS/navigation.js
// ============================================================
// MENÚ LATERAL DESLIZANTE — Construye el menú dinámicamente
// según el rol del usuario autenticado.
//
// Vigilante    → Entrada/Salida, Buscar Alumno, Filtrar Alumnos
// Administrador → Dashboard + todos los módulos de gestión
//
// El menú se genera en JS para que no dependamos de los
// atributos hardcodeados en cada HTML.
// ============================================================

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

        userTipo = data.tipo; // 'Administrador' | 'Vigilante' | 'Prefecto'

    } catch (err) {
        console.warn('navigation.js: No se pudo verificar auth:', err.message);
    }

    // ── 2. CONSTRUIR MENÚ SEGÚN ROL ──────────────────────────
    const listaOpciones = document.getElementById('lista-opciones');

    if (listaOpciones && userTipo) {

        // Módulos de cada rol
        const menuAdmin = [
            { href: '/Dashboard.html',              label: 'Dashboard' },
            { href: '/Entrada_Salida.html',          label: 'Registro entrada / salida' },
            { href: '/BuscarAlumno.html',            label: 'Buscar alumno' },
            { href: '/ModificarAlumno.html',         label: 'Modificar alumno' },
            { href: '/FiltrarAlumnos.html',          label: 'Filtrar alumnos' },
            { href: '/GestionGrupos.html',           label: 'Gestión de grupos' },
            { href: '/GestionUsuarios.html',         label: 'Gestión de usuarios' },
            { href: '/DescargasBD.html',             label: 'Descargar respaldo' },
        ];

        const menuVigilante = [
            { href: '/Entrada_Salida.html',          label: 'Entrada / Salida' },
            { href: '/BuscarAlumnoVigilante.html',   label: 'Buscar alumno' },
            { href: '/FiltrarAlumnos.html',          label: 'Filtrar alumnos' },
        ];

        // Prefecto comparte la vista de vigilante en web
        const items = userTipo === 'Administrador' ? menuAdmin : menuVigilante;

        // Limpiar ítems hardcodeados del HTML y reconstruir
        listaOpciones.innerHTML = '';

        const currentPath = window.location.pathname;

        items.forEach(item => {
            const li = document.createElement('li');
            const a  = document.createElement('a');
            a.href        = item.href;
            a.textContent = item.label;

            // Marcar enlace activo según la ruta actual
            const itemPath = item.href.replace(/^\//, '');
            if (currentPath.endsWith(itemPath) || currentPath.endsWith(item.href)) {
                a.classList.add('active');
            }

            li.appendChild(a);
            listaOpciones.appendChild(li);
        });
    }

    // ── 3. REFERENCIAS AL DOM ─────────────────────────────────
    const toggleBtn = document.getElementById('menu-toggle-btn');
    const navPanel  = document.querySelector('.menu-navegacion');
    const overlay   = document.getElementById('menu-overlay');

    if (!toggleBtn || !navPanel || !overlay) {
        // Página sin menú (ej. login.html) → salir silenciosamente
        return;
    }

    // ── 4. FUNCIONES OPEN / CLOSE ────────────────────────────
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
    toggleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleNav();
    });

    overlay.addEventListener('click', closeNav);

    // Re-query después de construir el menú para capturar los nuevos <a>
    document.querySelectorAll('.menu-lista a').forEach(link => {
        link.addEventListener('click', () => {
            setTimeout(closeNav, 120);
        });
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeNav();
    });
});