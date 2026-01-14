document.addEventListener('DOMContentLoaded', function() {
    const loginForm = document.getElementById('login-form');
    const errorMessage = document.getElementById('error-message');
    
    // Encuentra elementos de manera más segura
    const usernameInput = loginForm ? loginForm.querySelector('[name="username"]') : null;
    const passwordInput = loginForm ? loginForm.querySelector('[name="password"]') : null;
    const toggleButton = document.getElementById('togglePassword');

    // Función para mostrar/ocultar contraseña
    if (passwordInput && toggleButton) {
        toggleButton.addEventListener('click', function(e) {
            e.preventDefault();
            const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
            passwordInput.setAttribute('type', type);
            this.textContent = type === 'password' ? '👁️' : '🔒';
        });
    }

    if (loginForm) {
        loginForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            // Validar que los inputs existan
            if (!usernameInput || !passwordInput) {
                if (errorMessage) {
                    errorMessage.textContent = 'Error: Campos de formulario no encontrados';
                }
                console.error('No se encontraron los campos del formulario');
                return;
            }

            const username = usernameInput.value.trim();
            const password = passwordInput.value.trim();
            
            if (errorMessage) {
                errorMessage.textContent = '';
            }

            // Validaciones básicas en el frontend
            if (!username || !password) {
                if (errorMessage) {
                    errorMessage.textContent = 'Por favor, complete todos los campos';
                }
                return;
            }

            try {
                const response = await fetch('/api/auth/login', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        username: username,
                        password: password
                    })
                });

                const data = await response.json();
                console.log('📥 Respuesta login:', data); // Debug

                if (response.ok && data.success) {
                    //CRÍTICO: GUARDAR EL TOKEN
                    if (data.token) {
                        // Guardar en localStorage (recomendado)
                        localStorage.setItem('token', data.token);
                        localStorage.setItem('userType', data.tipo);
                        localStorage.setItem('userName', data.nombre || username);
                        
                        console.log('Token guardado en localStorage:', data.token.substring(0, 20) + '...');
                    } else {
                        console.warn('El backend no devolvió un token');
                    }
                    
                    // Redirigir según el tipo de usuario
                    switch(data.tipo) {
                        case 'Administrador':
                        case 'Prefecto':
                            window.location.href = '/Entrada_Salida.html';
                            break;
                        default:
                            window.location.href = '/vista-profesor.html';
                    }
                } else {
                    if (errorMessage) {
                        errorMessage.textContent = data.message || 'Error al iniciar sesión';
                    }
                }
            } catch (error) {
                console.error('Error de red:', error);
                if (errorMessage) {
                    errorMessage.textContent = 'No se pudo conectar al servidor.';
                }
            }
        });
    }
});