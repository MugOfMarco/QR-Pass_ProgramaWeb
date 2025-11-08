// validaciones.js (Versión limpia y combinada)

document.addEventListener('DOMContentLoaded', () => {

    // --- LÓGICA 1: PREFIJO QR (para qr-input) ---
    const urlPrefix = 'https://coatl.cecyt9.ipn.mx/app/qr_system/accessprocess.php?boleta=';
    const boletaField = document.getElementById('qr-input');

    function manejarEntradaBoleta(evento) {
        // (Tu código de manejarEntradaBoleta va aquí...)
        const input = evento.target;
        let valor = input.value;
        if (valor.startsWith(urlPrefix)) {
            let boletaExtraida = valor.substring(urlPrefix.length).replace(/[^0-9]/g, '');
            requestAnimationFrame(() => { input.value = boletaExtraida; });
        } else {
            const soloNumeros = valor.replace(/[^0-9]/g, '');
            if (valor !== soloNumeros) {
                requestAnimationFrame(() => { input.value = soloNumeros; });
            }
        }
    }

    if (boletaField) {
        boletaField.addEventListener('input', manejarEntradaBoleta);
    }

    // --- LÓGICA 2: SOLO NÚMEROS (para .input-solo-numeros) ---
    const camposNumericos = document.querySelectorAll('.input-solo-numeros');

    function bloquearLetras(evento) {
        // (Tu código de bloquearLetras va aquí...)
        const charCode = (evento.which) ? evento.which : evento.keyCode;
        if (charCode > 31 && (charCode < 48 || charCode > 57)) {
            evento.preventDefault();
        }
    }

    function limpiarPegadoNumeros(evento) {
        // (Tu código de limpiarPegado va aquí...)
        evento.preventDefault();
        const textoPegado = (evento.clipboardData || window.clipboardData).getData('text');
        const soloNumeros = textoPegado.replace(/[^0-9]/g, '');
        this.value += soloNumeros;
    }

    camposNumericos.forEach(campo => {
        campo.addEventListener('keypress', bloquearLetras);
        campo.addEventListener('paste', limpiarPegadoNumeros);
    });

    // --- LÓGICA 3: SOLO LETRAS (para .input-solo-letras) ---
    const camposLetras = document.querySelectorAll('.input-solo-letras');

    function bloquearNoLetras(evento) {
        // (Tu código de bloquearNoLetras va aquí...)
        const patron = /[a-zA-ZáéíóúüñÁÉÍÓÚÜÑ\s]/;
        const tecla = String.fromCharCode(evento.charCode);
        if (!patron.test(tecla) && evento.charCode !== 0) {
            evento.preventDefault();
        }
    }

    function procesarEntradaLetras() {
        // (Tu código de procesarEntrada va aquí...)
        let valor = this.value;
        const valorLimpio = valor.replace(/[^a-zA-ZáéíóúüñÁÉÍÓÚÜÑ\s]/g, '');
        this.value = valorLimpio.toUpperCase();
    }

    function limpiarPegadoLetras(evento) {
        // (Tu código de limpiarPegado va aquí...)
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

    // --- LÓGICA 4: MENÚ ---
    const menuButton = document.getElementById('menu-toggle-btn');
    const menuList = document.getElementById('lista-opciones');
    const menuOverlay = document.getElementById('menu-overlay');

    if (menuButton && menuList && menuOverlay) {
        // (Todo tu código de listeners del menú va aquí...)
        menuButton.addEventListener('click', function (e) {
            e.stopPropagation();
            menuList.classList.toggle('menu-visible');
            menuOverlay.classList.toggle('menu-visible');
        });
        menuOverlay.addEventListener('click', function () {
            menuList.classList.remove('menu-visible');
            menuOverlay.classList.remove('menu-visible');
        });
        // ...etc.
    } else {
        console.warn('Elementos del menú no encontrados.');
    }

}); // <-- FIN DEL ÚNICO DOMContentLoaded