document.querySelectorAll('.accordion-header').forEach(button => {
    button.addEventListener('click', () => {
        const content = button.nextElementSibling;
        const isActive = button.classList.contains('active');

        // Cerrar todos los acordeones abiertos
        document.querySelectorAll('.accordion-header').forEach(btn => {
            btn.classList.remove('active');
            btn.nextElementSibling.style.maxHeight = null;
            btn.nextElementSibling.style.padding = "0 15px";
        });

        // Abrir el acordeón seleccionado si no estaba activo
        if (!isActive) {
            button.classList.add('active');
            // Usar scrollHeight para obtener la altura dinámica del contenido
            content.style.maxHeight = content.scrollHeight + "px";
        }
    });
});