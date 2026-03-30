// frontend/public/JS/navigation.js
// ============================================================
// MENÚ LATERAL DESLIZANTE — Panel que se abre de izquierda a derecha
//
// Funcionamiento:
//   · Añade/quita la clase "nav-open" en .menu-navegacion y .menu-overlay
//   · No usa "display:none" para el menú — la animación usa transform
//   · También verifica autenticación y oculta enlaces de admin si aplica
// ============================================================

document.addEventListener('DOMContentLoaded', async () => {

    // ── 1. VERIFICACIÓN DE AUTENTICACIÓN ─────────────────────
    try {
        const res  = await fetch('/api/auth/check', { credentials: 'include' });
        const data = await res.json();

        if (!data.isAuthenticated) {
            // Si la página actual no es login, redirigir
            const esLogin = window.location.pathname.endsWith('login.html')
                         || window.location.pathname === '/';
            if (!esLogin) {
                window.location.href = '/login.html';
                return;
            }
        }

        // Ocultar enlaces que son sólo para administrador
        if (data.isAuthenticated && data.tipo !== 'Administrador') {
            document.querySelectorAll('.admin-only-link').forEach(el => {
                el.style.display = 'none';
            });
        }

    } catch (err) {
        console.warn('navigation.js: No se pudo verificar auth:', err.message);
    }

    // ── 2. REFERENCIAS AL DOM ─────────────────────────────────
    const toggleBtn  = document.getElementById('menu-toggle-btn');
    const navPanel   = document.querySelector('.menu-navegacion');
    const overlay    = document.getElementById('menu-overlay');
    const menuLinks  = document.querySelectorAll('.menu-lista a');

    if (!toggleBtn || !navPanel || !overlay) {
        // La página no tiene menú (ej. login.html) → salir silenciosamente
        return;
    }

    // ── 3. FUNCIONES OPEN / CLOSE ────────────────────────────
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

    // ── 4. EVENTOS ───────────────────────────────────────────
    toggleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleNav();
    });

    overlay.addEventListener('click', closeNav);

    menuLinks.forEach(link => {
        link.addEventListener('click', () => {
            // Pequeño delay para que la animación de cierre sea visible
            setTimeout(closeNav, 120);
        });
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeNav();
    });
});