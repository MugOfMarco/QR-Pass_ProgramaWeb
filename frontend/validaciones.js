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

document.addEventListener('DOMContentLoaded', () => {
    const boton = document.getElementById('btn-menu-principal');
    const menu = document.getElementById('lista-opciones');

    boton.addEventListener('click', () => {

        menu.classList.toggle('activo');

        const estaAbierto = menu.classList.contains('activo');
        boton.setAttribute('aria-expanded', estaAbierto);
    });
});