// frontend/public/js/navigation.js
// Control de autenticación + menú lateral

document.addEventListener('DOMContentLoaded', async () => {
    console.log('🔧 Inicializando navigation.js...');
    
    // =========================================================
    // 1. VERIFICACIÓN DE AUTENTICACIÓN Y PERMISOS
    // =========================================================
    try {
        const response = await fetch('/api/auth/check'); 
        const authData = await response.json();
        
        if (authData.isAuthenticated && authData.user.tipo !== 'Administrador') {
            console.log('👤 Usuario autenticado:', authData.user.tipo);
            
            // El usuario NO es Administrador (es Prefecto/Policía)
            // Oculta todos los elementos con la clase 'admin-only-link'
            const enlacesAdmin = document.querySelectorAll('.admin-only-link'); 
            
            enlacesAdmin.forEach(link => {
                link.style.display = 'none';
            });
            
            console.log(`🔒 ${enlacesAdmin.length} enlaces de administrador ocultados`);
        } else if (authData.isAuthenticated) {
            console.log('👑 Usuario Administrador - Acceso completo');
        }
    } catch (error) {
        console.error('❌ Error verificando autenticación:', error);
    }
    
    // =========================================================
    // 2. CONTROL DEL MENÚ LATERAL DESLIZANTE
    // =========================================================
    
    // Obtener elementos del menú
    const menuToggleBtn = document.getElementById('menu-toggle-btn');
    const menuNavegacion = document.querySelector('.menu-navegacion');
    const menuOverlay = document.getElementById('menu-overlay');
    const menuLinks = document.querySelectorAll('.menu-lista a');
    
    // Verificar que existan los elementos del menú
    if (!menuToggleBtn) {
        console.warn('⚠️ No se encontró el botón del menú (#menu-toggle-btn)');
        return;
    }
    
    if (!menuNavegacion) {
        console.warn('⚠️ No se encontró el contenedor del menú (.menu-navegacion)');
        return;
    }
    
    if (!menuOverlay) {
        console.warn('⚠️ No se encontró el overlay (#menu-overlay)');
        return;
    }
    
    console.log('✅ Elementos del menú encontrados');
    
    // Función para abrir el menú
    function abrirMenu() {
        menuNavegacion.classList.add('menu-visible');
        menuOverlay.classList.add('menu-visible');
        console.log('📂 Menú abierto');
    }
    
    // Función para cerrar el menú
    function cerrarMenu() {
        menuNavegacion.classList.remove('menu-visible');
        menuOverlay.classList.remove('menu-visible');
        console.log('📁 Menú cerrado');
    }
    
    // Toggle del menú al hacer click en el botón hamburguesa
    menuToggleBtn.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        
        if (menuNavegacion.classList.contains('menu-visible')) {
            cerrarMenu();
        } else {
            abrirMenu();
        }
    });
    
    // Cerrar menú al hacer click en el overlay
    menuOverlay.addEventListener('click', function() {
        cerrarMenu();
    });
    
    // Cerrar menú al hacer click en cualquier link del menú
    menuLinks.forEach(link => {
        link.addEventListener('click', function() {
            // Pequeño delay para que se vea la animación antes de navegar
            setTimeout(() => {
                cerrarMenu();
            }, 150);
        });
    });
    
    // Cerrar menú con la tecla ESC
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && menuNavegacion.classList.contains('menu-visible')) {
            cerrarMenu();
        }
    });
    
    console.log('✅ Menú de navegación inicializado correctamente');
});