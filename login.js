// login.js - Versión Final con Redirección y Correciones

// Espera a que todo el HTML esté cargado
document.addEventListener('DOMContentLoaded', function() {

    const loginForm = document.getElementById('login-form');
    const errorMessage = document.getElementById('error-message'); // Asume que el ID existe

    if (loginForm) {
        loginForm.addEventListener('submit', async function(e) {
            
            e.preventDefault();

            // Los IDs de tus inputs son 'username' y 'password'
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
                    // Claves enviadas que coinciden con el destructuring del backend
                    body: JSON.stringify({
                        username: usernameInput, // Clave que el servidor espera recibir
                        password: passwordInput  // Clave que el servidor espera recibir
                    })
                });

                // 5. Procesa la respuesta del SERVIDOR
                const data = await response.json();

                if (response.ok) {
                    // LOGIN EXITOSO: Redirección Basada en Rol
                    console.log(`Login exitoso como: ${data.tipo}`);
                    
                    if (data.tipo === 'Administrador') {
                        window.location.href = '/admin-dashboard.html'; 
                    } 
                    else if (data.tipo === 'Prefecto') {
                        window.location.href = '/Entrada_Salida.html'; 
                    } 
                    else {
                        // Rol de fallback (ej. Profesor)
                        window.location.href = '/vista-profesor.html';
                    }

                } else {
                    // Muestra el mensaje de error que envió el servidor (401 Unauthorized)
                    errorMessage.textContent = data.message || 'Error al iniciar sesión';
                }

            } catch (error) {
                // Error de red (servidor caído)
                console.error('Error de red:', error);
                errorMessage.textContent = 'No se pudo conectar al servidor.';
            }
        });
    }
});