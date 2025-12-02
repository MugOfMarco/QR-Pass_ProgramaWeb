document.addEventListener('DOMContentLoaded', function() {
    const loginForm = document.getElementById('login-form');
    const errorMessage = document.getElementById('error-message');
    const passwordInput = document.getElementById('password');
    const toggleButton = document.getElementById('togglePassword');

    if (passwordInput && toggleButton) {
        toggleButton.addEventListener('click', function(e) {
            const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
            passwordInput.setAttribute('type', type);
            this.textContent = type === 'password' ? '👁️' : '🔒';
        });
    }

    if (loginForm) {
        loginForm.addEventListener('submit', async function(e) {
            e.preventDefault();

            const usernameInput = document.getElementById('username').value;
            const passwordInput = document.getElementById('password').value;
            errorMessage.textContent = '';

            try {
                const response = await fetch('/api/auth/login', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        username: usernameInput,
                        password: passwordInput
                    })
                });

                const data = await response.json();

                if (response.ok) {
                    if (data.tipo === 'Administrador') {
                        window.location.href = '/menu.html';
                    } else if (data.tipo === 'Prefecto') {
                        window.location.href = '/Entrada_Salida.html';
                    } else {
                        window.location.href = '/vista-profesor.html';
                    }
                } else {
                    errorMessage.textContent = data.message || 'Error al iniciar sesión';
                }
            } catch (error) {
                console.error('Error de red:', error);
                errorMessage.textContent = 'No se pudo conectar al servidor.';
            }
        });
    }
});