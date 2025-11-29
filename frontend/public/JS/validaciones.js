
document.addEventListener('DOMContentLoaded', function () {
    
    // --- LÓGICA 3: SOLO LETRAS (para otros campos) ---
    const camposLetras = document.querySelectorAll('.input-solo-letras');

    function bloquearNoLetras(evento) {
        const patron = /[a-zA-ZáéíóúüñÁÉÍÓÚÜÑ\s]/;
        const tecla = String.fromCharCode(evento.charCode);

        if (!patron.test(tecla) && evento.charCode !== 0) {
            evento.preventDefault();
        }
    }

    function procesarEntradaLetras() {
        let valor = this.value;
        const valorLimpio = valor.replace(/[^a-zA-ZáéíóúüñÁÉÍÓÚÜÑ\s]/g, '');
        this.value = valorLimpio.toUpperCase();
    }

    function limpiarPegadoLetras(evento) {
        evento.preventDefault();
        const textoPegado = (evento.clipboardData || window.clipboardData).getData('text');

        const soloLetrasMayus = textoPegado
            .replace(/[^a-zA-ZáéíóúüñÁÉÍÓÚÜÑ\s]/g, '')
            .toUpperCase();

        this.value += soloLetrasMayus;
    }

    camposLetras.forEach(campo => {
        campo.addEventListener('keypress', bloquearNoLetras);
        campo.addEventListener('input', procesarEntradaLetras);
        campo.addEventListener('paste', limpiarPegadoLetras);
    });
    // --- FIN DE LA LÓGICA 3 ---


    // --- LÓGICA 4: MENÚ HAMBURGUESA ---
    const menuButton = document.getElementById('menu-toggle-btn');
    const menuList = document.getElementById('lista-opciones');
    const menuOverlay = document.getElementById('menu-overlay');

    if (menuButton && menuList && menuOverlay) {

        menuButton.addEventListener('click', function (e) {
            e.stopPropagation();
            menuList.classList.toggle('menu-visible');
            menuOverlay.classList.toggle('menu-visible');
        });

        menuOverlay.addEventListener('click', function () {
            menuList.classList.remove('menu-visible');
            menuOverlay.classList.remove('menu-visible');
        });

        menuList.addEventListener('click', function (e) {
            if (e.target.tagName === 'A') {
                menuList.classList.remove('menu-visible');
                menuOverlay.classList.remove('menu-visible');
            }
        });

        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') {
                menuList.classList.remove('menu-visible');
                menuOverlay.classList.remove('menu-visible');
            }
        });

    } else {
        console.warn('Elementos del menú no encontrados.');
    }
    // --- FIN DE LA LÓGICA 4 ---

}); // <-- FIN DEL ÚNICO DOMContentLoaded