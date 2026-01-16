// frontend/public/JS/menu.js

class MenuManager {
    constructor() {
        this.menuBtn = document.getElementById('menu-toggle-btn');
        this.menuList = document.getElementById('lista-opciones');
        this.overlay = document.getElementById('menu-overlay');
        
        console.log('🔄 Inicializando menú...');
        console.log('Botón:', this.menuBtn);
        console.log('Lista:', this.menuList);
        console.log('Overlay:', this.overlay);
        
        if (this.menuBtn && this.menuList && this.overlay) {
            this.init();
        } else {
            console.error('❌ Elementos del menú no encontrados');
        }
    }
    
    init() {
        // Event listener para abrir/cerrar menú
        this.menuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleMenu();
        });
        
        // Event listener para cerrar con overlay
        this.overlay.addEventListener('click', () => this.closeMenu());
        
        // Cerrar menú al hacer clic en un enlace
        const menuLinks = this.menuList.querySelectorAll('a');
        menuLinks.forEach(link => {
            link.addEventListener('click', () => this.closeMenu());
        });
        
        // Cerrar menú con tecla ESC
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isMenuOpen()) {
                this.closeMenu();
            }
        });
        
        // Cerrar menú al hacer clic fuera
        document.addEventListener('click', (e) => {
            if (this.isMenuOpen() && 
                !this.menuList.contains(e.target) && 
                !this.menuBtn.contains(e.target)) {
                this.closeMenu();
            }
        });
        
        console.log('✅ Menú inicializado correctamente');
    }
    
    toggleMenu() {
        console.log('🔄 Cambiando estado del menú');
        this.menuList.classList.toggle('menu-visible');
        this.overlay.classList.toggle('menu-visible');
        
        // Prevenir scroll del body cuando el menú está abierto
        if (this.menuList.classList.contains('menu-visible')) {
            document.body.style.overflow = 'hidden';
            console.log('📱 Menú abierto');
        } else {
            document.body.style.overflow = '';
            console.log('📱 Menú cerrado');
        }
    }
    
    closeMenu() {
        console.log('🔒 Cerrando menú');
        this.menuList.classList.remove('menu-visible');
        this.overlay.classList.remove('menu-visible');
        document.body.style.overflow = '';
    }
    
    isMenuOpen() {
        return this.menuList && this.menuList.classList.contains('menu-visible');
    }
}

// Inicializar automáticamente cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    // Verificar que estamos en una página con menú
    if (document.getElementById('menu-toggle-btn')) {
        window.menuManager = new MenuManager();
    }
});