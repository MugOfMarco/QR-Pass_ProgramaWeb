// Espera a que todo el HTML esté cargado
document.addEventListener('DOMContentLoaded', function() {

    // Busca el formulario y el campo de mensaje de error
    const loginForm = document.getElementById('login-form');
    const errorMessage = document.getElementById('error-message');

    if (loginForm) {
        // 1. Escucha el evento "submit" (cuando el usuario da Enter o clic en "Entrar")
        loginForm.addEventListener('submit', async function(e) {
            
            // 2. Evita que el formulario recargue la página (comportamiento por defecto)
            e.preventDefault();

            // 3. Obtiene los valores que el usuario escribió
            const usernameInput = document.getElementById('username').value;
            const passwordInput = document.getElementById('password').value;
            errorMessage.textContent = ''; // Limpia errores previos

            try {
                // 4. Envía los datos al SERVIDOR (al server.js)
                const response = await fetch('http://localhost:3000/api/login', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    // Convierte los datos a JSON.
                    // 'username' y 'password' son las claves que el server.js espera recibir
                    body: JSON.stringify({
                        username: usernameInput, 
                        password: passwordInput  
                    })
                });

                // 5. Procesa la respuesta del SERVIDOR
                if (response.ok) {
                    // Si el servidor dijo "OK" (código 200)
                    console.log('Login exitoso');
                    
                    // Redirige al usuario a la página principal de la aplicación
                    window.location.href = 'Entrada&Salida.html'; 
                
                } else {
                    // Si el servidor dijo "Error" (código 401 o 500)
                    // Muestra el mensaje de error que envió el servidor
                    const errorData = await response.json();
                    errorMessage.textContent = errorData.message || 'Error al iniciar sesión';
                }

            } catch (error) {
                // Error de red (servidor caído, sin internet, etc.)
                console.error('Error de red:', error);
                errorMessage.textContent = 'No se pudo conectar al servidor.';
            }
        });
    }
});