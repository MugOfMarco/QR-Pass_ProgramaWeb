// footer-legal.js — Inyecta los enlaces legales en el footer de cada página.
// Agregar <script src="../JS/footer-legal.js"></script> antes de </body> en cada HTML.
(function () {
  document.addEventListener('DOMContentLoaded', function () {
    const footer = document.querySelector('footer');
    if (!footer) return;

    // Determinar ruta relativa correcta según si estamos en /public o en /public/subcarpeta
    const path = window.location.pathname;
    const inRoot = !path.includes('/JS/') && (
      path.endsWith('login.html') || path.endsWith('menu.html') ||
      path.endsWith('Entrada_Salida.html') || path.endsWith('RecuperarPassword.html') ||
      path.endsWith('Dashboard.html') || path === '/' || path.endsWith('/')
    );
    const base = './';

    const legalHtml = `
      <div class="footer-legal-links" style="
        display:flex;flex-wrap:wrap;justify-content:center;
        gap:8px 20px;padding:6px 16px 2px;
        border-top:1px solid rgba(255,255,255,.15);margin-top:6px;font-size:.78rem;">
        <a href="${base}AvisoPrivacidad.html"
           style="color:inherit;text-decoration:underline;opacity:.75;"
           target="_blank" rel="noopener">Aviso de Privacidad</a>
        <span style="opacity:.4;">·</span>
        <a href="${base}TerminosCondiciones.html"
           style="color:inherit;text-decoration:underline;opacity:.75;"
           target="_blank" rel="noopener">Términos y Condiciones</a>
        <span style="opacity:.4;">·</span>
        <span style="opacity:.5;">Datos protegidos — LFPDPPP &amp; LGDNNA</span>
      </div>`;

    const container = footer.querySelector('.footer-container-main, .footer-container');
    if (container) {
      container.insertAdjacentHTML('beforeend', legalHtml);
    } else {
      footer.insertAdjacentHTML('beforeend', legalHtml);
    }
  });
})();
