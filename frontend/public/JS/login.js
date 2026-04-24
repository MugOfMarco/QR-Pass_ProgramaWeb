// frontend/public/JS/login.js
document.addEventListener('DOMContentLoaded', function() {
    const loginForm   = document.getElementById('login-form');
    const errorMessage = document.getElementById('error-message');

    const usernameInput = loginForm?.querySelector('[name="username"]');
    const passwordInput = loginForm?.querySelector('[name="password"]');
    const toggleButton  = document.getElementById('togglePassword');

    if (passwordInput && toggleButton) {
        toggleButton.addEventListener('click', function(e) {
            e.preventDefault();
            const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
            passwordInput.setAttribute('type', type);
            this.textContent = type === 'password' ? '👁️' : '🔒';
        });
    }

    if (!loginForm) return;

    loginForm.addEventListener('submit', async function(e) {
        e.preventDefault();

        const username = usernameInput?.value.trim();
        const password = passwordInput?.value.trim();

        if (errorMessage) errorMessage.textContent = '';

        if (!username || !password) {
            if (errorMessage) errorMessage.textContent = 'Por favor, complete todos los campos';
            return;
        }

        try {
            const response = await fetch('/api/auth/login', {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ username, password }),
            });

            const data = await response.json();

            if (response.ok && data.success) {
                // ── Redirigir según rol ────────────────────────
                switch (data.tipo) {
                    case 'Administrador':
                        window.location.href = '/Dashboard.html';      // ← dashboard admin
                        break;
                    case 'Prefecto':
                        window.location.href = '/Entrada_Salida.html';
                        break;
                    case 'Vigilante':
                        window.location.href = '/Entrada_Salida.html';
                        break;
                    default:
                        window.location.href = '/Entrada_Salida.html';
                }
            } else {
                if (errorMessage) errorMessage.textContent = data.message || 'Error al iniciar sesión';
            }
        } catch (error) {
            console.error('Error de red:', error);
            if (errorMessage) errorMessage.textContent = 'No se pudo conectar al servidor.';
        }
    });
});