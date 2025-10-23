document.addEventListener('DOMContentLoaded', () => {
    const camposNumericos = document.querySelectorAll('.input-solo-numeros');

    function bloquearLetras(evento) {
        const charCode = (evento.which) ? evento.which : evento.keyCode;
        if (charCode > 31 && (charCode < 48 || charCode > 57)) {
            evento.preventDefault();
        }
    }

    function limpiarPegado(evento) {
        evento.preventDefault();
        const textoPegado = (evento.clipboardData || window.clipboardData).getData('text');
        const soloNumeros = textoPegado.replace(/[^0-9]/g, '');
        this.value += soloNumeros;
    }

    camposNumericos.forEach(campo => {
        campo.addEventListener('keypress', bloquearLetras);
        campo.addEventListener('paste', limpiarPegado);
    });
});

document.addEventListener('DOMContentLoaded', () => {
    const camposLetras = document.querySelectorAll('.input-solo-letras');

    function bloquearNoLetras(evento) {
        const patron = /[a-zA-ZáéíóúüñÁÉÍÓÚÜÑ\s]/;
        const tecla = String.fromCharCode(evento.charCode);

        if (!patron.test(tecla) && evento.charCode !== 0) {
            evento.preventDefault();
        }
    }

    function procesarEntrada() {
        let valor = this.value;
        const valorLimpio = valor.replace(/[^a-zA-ZáéíóúüñÁÉÍÓÚÜÑ\s]/g, '');
        this.value = valorLimpio.toUpperCase();
    }
    
    function limpiarPegado(evento) {
        evento.preventDefault();
        const textoPegado = (evento.clipboardData || window.clipboardData).getData('text');
        
        const soloLetrasMayus = textoPegado
            .replace(/[^a-zA-ZáéíóúüñÁÉÍÓÚÜÑ\s]/g, '')
            .toUpperCase();
            
        this.value += soloLetrasMayus;
    }

    camposLetras.forEach(campo => {
        campo.addEventListener('keypress', bloquearNoLetras);
        campo.addEventListener('input', procesarEntrada);
        campo.addEventListener('paste', limpiarPegado);
    });
});

// Espera a que todo el HTML esté cargado
document.addEventListener('DOMContentLoaded', function() {
    
    // 1. Encuentra el botón que agregaste
    const menuButton = document.getElementById('menu-toggle-btn');

    // 2. Encuentra tu lista de opciones por su ID
    const menuList = document.getElementById('lista-opciones');

    // 3. Verifica que ambos elementos existan
    if (menuButton && menuList) {
        
        // 4. Asigna la función al evento 'click' del botón
        menuButton.addEventListener('click', function() {
            
            // 5. Alterna (agrega/quita) la clase 'menu-visible' 
            //    directamente en la LISTA (el <ul>).
            menuList.classList.toggle('menu-visible');
        });
    } else {
        console.warn('No se encontró el botón de menú o la lista de opciones.');
    }
});