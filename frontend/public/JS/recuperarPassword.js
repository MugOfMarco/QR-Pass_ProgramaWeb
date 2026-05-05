// frontend/public/JS/recuperarPassword.js
document.addEventListener('DOMContentLoaded', async () => {

    const params = new URLSearchParams(window.location.search);
    const token  = params.get('token') || '';

    const elVerif    = document.getElementById('estado-verificando');
    const elInvalido = document.getElementById('estado-invalido');
    const elForm     = document.getElementById('form-reset');
    const elOk       = document.getElementById('estado-ok');
    const errorMsg   = document.getElementById('error-message');
    const btnGuardar = document.getElementById('btn-guardar-password');
    const inputPass  = document.getElementById('password');
    const inputConf  = document.getElementById('password-confirm');
    const toggleBtn  = document.getElementById('togglePassword');

    // ─── Toggle ojo ───────────────────────────────────────
    toggleBtn?.addEventListener('click', () => {
        const visible = inputPass.getAttribute('type') === 'text';
        inputPass.setAttribute('type', visible ? 'password' : 'text');
        toggleBtn.textContent = visible ? '👁️' : '🔒';
    });

    // ─── Verificar token al cargar ────────────────────────
    if (!token) { mostrarInvalido(); return; }

    try {
        const r = await fetch(`/api/auth/reset/verificar?token=${encodeURIComponent(token)}`);
        const data = await r.json();
        if (r.ok && data.success) {
            elVerif.style.display = 'none';
            elForm.style.display  = '';
        } else {
            mostrarInvalido();
        }
    } catch {
        mostrarInvalido();
    }

    function mostrarInvalido() {
        elVerif.style.display = 'none';
        elInvalido.style.display = '';
    }

    // ─── Submit ───────────────────────────────────────────
    elForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        errorMsg.textContent = '';

        const pass = inputPass.value;
        const conf = inputConf.value;

        if (!pass || pass.length < 6) {
            errorMsg.textContent = 'La contraseña debe tener al menos 6 caracteres.';
            return;
        }
        if (pass.length > 50) {
            errorMsg.textContent = 'La contraseña no puede superar 50 caracteres.';
            return;
        }
        if (pass !== conf) {
            errorMsg.textContent = 'Las contraseñas no coinciden.';
            return;
        }

        btnGuardar.disabled = true;
        btnGuardar.textContent = 'Guardando…';

        try {
            const r = await fetch('/api/auth/reset', {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify({ token, password: pass }),
            });
            const data = await r.json();

            if (r.ok && data.success) {
                elForm.style.display = 'none';
                elOk.style.display   = '';
                setTimeout(() => { window.location.href = '/login.html'; }, 2200);
            } else {
                errorMsg.textContent = data.message || 'No se pudo restablecer la contraseña.';
                btnGuardar.disabled = false;
                btnGuardar.textContent = 'Guardar nueva contraseña';
            }
        } catch {
            errorMsg.textContent = 'Error de conexión.';
            btnGuardar.disabled = false;
            btnGuardar.textContent = 'Guardar nueva contraseña';
        }
    });
});
