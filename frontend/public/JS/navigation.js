// frontend/public/js/navigation.js

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Llama al endpoint de verificación
    const response = await fetch('/api/auth/check'); 
    const authData = await response.json();

    if (authData.isAuthenticated && authData.user.tipo !== 'Administrador') {
        
        // El usuario NO es Administrador (es Prefecto/Policía)
        
        // Oculta todos los elementos HTML que tengan la clase 'admin-only-link'
        const enlacesAdmin = document.querySelectorAll('.admin-only-link'); 
        
        enlacesAdmin.forEach(link => {
            link.style.display = 'none';
        });
        
    }
});