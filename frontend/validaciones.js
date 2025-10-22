document.addEventListener('DOMContentLoaded', () => {
    const inputCampo = document.getElementById('soloNumeros-input');

    inputCampo.addEventListener('keypress', function (evento) {
        const charCode = (evento.which) ? evento.which : evento.keyCode;

        if (charCode > 31 && (charCode < 48 || charCode > 57)) {
            evento.preventDefault();
        }
    });

    inputCampo.addEventListener('paste', function (evento) {
    
        evento.preventDefault();

        const textoPegado = (evento.clipboardData || window.clipboardData).getData('text');


        const soloNumeros = textoPegado.replace(/[^0-9]/g, '');

        this.value += soloNumeros;
    });
});

