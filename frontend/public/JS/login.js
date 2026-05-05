// frontend/public/JS/login.js
document.addEventListener('DOMContentLoaded', () => {

    // ─── Login ────────────────────────────────────────────────
    const loginForm     = document.getElementById('login-form');
    const errorMessage  = document.getElementById('error-message');
    const btnSubmit     = document.getElementById('btn-login-submit');

    const usernameInput = loginForm?.querySelector('[name="username"]');
    const passwordInput = loginForm?.querySelector('[name="password"]');
    const toggleButton  = document.getElementById('togglePassword');

    if (passwordInput && toggleButton) {
        const toggle = (e) => {
            if (e) e.preventDefault();
            const visible = passwordInput.getAttribute('type') === 'text';
            passwordInput.setAttribute('type', visible ? 'password' : 'text');
            toggleButton.textContent = visible ? '👁️' : '🔒';
        };
        toggleButton.addEventListener('click', toggle);
        toggleButton.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') toggle(e);
        });
    }

    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = usernameInput?.value.trim();
            const password = passwordInput?.value.trim();
            if (errorMessage) errorMessage.textContent = '';

            if (!username || !password) {
                if (errorMessage) errorMessage.textContent = 'Por favor, completa todos los campos.';
                return;
            }

            btnSubmit.disabled = true;
            btnSubmit.textContent = 'Iniciando sesión…';

            try {
                const response = await fetch('/api/auth/login', {
                    method:  'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({ username, password }),
                });
                const data = await response.json();

                if (response.ok && data.success) {
                    switch (data.tipo) {
                        case 'Administrador': window.location.href = '/Dashboard.html';      break;
                        case 'Prefecto':       window.location.href = '/Entrada_Salida.html'; break;
                        case 'Vigilante':      window.location.href = '/Entrada_Salida.html'; break;
                        default:               window.location.href = '/Entrada_Salida.html';
                    }
                } else {
                    if (errorMessage) errorMessage.textContent = data.message || 'Error al iniciar sesión.';
                    btnSubmit.disabled = false;
                    btnSubmit.textContent = 'Iniciar sesión';
                }
            } catch (error) {
                console.error('Error de red:', error);
                if (errorMessage) errorMessage.textContent = 'No se pudo conectar al servidor.';
                btnSubmit.disabled = false;
                btnSubmit.textContent = 'Iniciar sesión';
            }
        });
    }

    // ─── Modal: Olvidé mi contraseña ──────────────────────────
    const btnAbrir   = document.getElementById('btn-olvide-password');
    const modal      = document.getElementById('modal-olvide');
    const btnCerrar  = document.getElementById('btn-cerrar-modal');
    const formOlvide = document.getElementById('form-olvide');
    const inputEmail = document.getElementById('email-recuperacion');
    const btnEnviar  = document.getElementById('btn-enviar-recuperacion');
    const feedback   = document.getElementById('modal-feedback');

    function abrirModal() {
        if (!modal) return;
        modal.classList.add('visible');
        feedback.classList.remove('visible', 'ok', 'err');
        feedback.textContent = '';
        inputEmail.value = '';
        setTimeout(() => inputEmail.focus(), 80);
    }
    function cerrarModal() {
        if (!modal) return;
        modal.classList.remove('visible');
    }

    btnAbrir?.addEventListener('click', abrirModal);
    btnCerrar?.addEventListener('click', cerrarModal);
    modal?.addEventListener('click', (e) => { if (e.target === modal) cerrarModal(); });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal?.classList.contains('visible')) cerrarModal();
    });

    formOlvide?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = inputEmail.value.trim();
        feedback.classList.remove('visible', 'ok', 'err');
        feedback.textContent = '';

        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            feedback.textContent = 'Ingresa un correo válido.';
            feedback.classList.add('visible', 'err');
            return;
        }

        btnEnviar.disabled = true;
        btnEnviar.textContent = 'Enviando…';

        try {
            const r = await fetch('/api/auth/olvide-password', {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify({ email }),
            });
            const data = await r.json();

            if (r.ok && data.success) {
                feedback.textContent = data.message || 'Si el correo existe, recibirás un enlace para restablecer.';
                feedback.classList.add('visible', 'ok');
                setTimeout(cerrarModal, 3500);
            } else {
                feedback.textContent = data.message || 'No se pudo procesar la solicitud.';
                feedback.classList.add('visible', 'err');
            }
        } catch {
            feedback.textContent = 'Error de conexión. Intenta de nuevo.';
            feedback.classList.add('visible', 'err');
        } finally {
            btnEnviar.disabled = false;
            btnEnviar.textContent = 'Enviar enlace';
        }
    });
});
