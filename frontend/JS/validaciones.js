document.addEventListener('DOMContentLoaded', () => {

    // 1. Define el prefijo que esperas de los QRs
    const urlPrefix = 'https://coatl.cecyt9.ipn.mx/app/qr_system/accessprocess.php?boleta=';

    // 2. Apunta específicamente a tu campo de entrada de boleta
    const boletaField = document.getElementById('boletaInput');

    // Función para manejar la entrada (sea tecleo, pegado o escáner)
    function manejarEntradaBoleta(evento) {
        const input = evento.target;
        let valor = input.value;

        // 3. Revisa si la entrada es una URL de QR
        if (valor.startsWith(urlPrefix)) {
            // SÍ es un QR. Extrae solo la boleta.
            let boletaExtraida = valor.substring(urlPrefix.length);
            
            // Limpia por si el QR trae algo extra al final
            boletaExtraida = boletaExtraida.replace(/[^0-9]/g, '');

            // Actualiza el campo para que solo muestre la boleta
            // Usamos requestAnimationFrame para asegurar que el navegador
            // actualice el valor correctamente después del evento 'input'.
            requestAnimationFrame(() => {
                input.value = boletaExtraida;
            });

        } else {
            // NO es un QR. Asumimos que es entrada manual.
            // Simplemente limpiamos el valor para que solo contenga números.
            const soloNumeros = valor.replace(/[^0-9]/g, '');

            // Si el valor cambió (porque tenía letras), lo actualizamos
            if (valor !== soloNumeros) {
                requestAnimationFrame(() => {
                    input.value = soloNumeros;
                });
            }
        }
    }

    // 4. Asigna el manejador al evento 'input'
    // El evento 'input' captura tecleo, pegado y lecturas de escáner.
    if (boletaField) {
        boletaField.addEventListener('input', manejarEntradaBoleta);
    }

});

    // Si deseas manejar eventos de pegado por separado, puedes hacerlo así:

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
    const menuOverlay = document.getElementById('menu-overlay');

    // 3. Verifica que ambos elementos existan
    if (menuButton && menuList && menuOverlay) {

        // 4. Asigna la función al evento 'click' del botón
        menuButton.addEventListener('click', function(e) {
            e.stopPropagation();
            menuList.classList.toggle('menu-visible');
            menuOverlay.classList.toggle('menu-visible');
        });

        menuOverlay.addEventListener('click', function() {
            menuList.classList.remove('menu-visible');
            menuOverlay.classList.remove('menu-visible');
        });

        menuList.addEventListener('click', function(e) {
            if (e.target.tagName === 'A') {
                menuList.classList.remove('menu-visible');
                menuOverlay.classList.remove('menu-visible');
            }
        });

        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') {
                menuList.classList.remove('menu-visible');
                menuOverlay.classList.remove('menu-visible');
            }
        });

    } else {
        console.warn('Elementos del menú no encontrados.');
    }
});