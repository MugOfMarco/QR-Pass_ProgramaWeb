// frontend/public/JS/soporte.js
document.addEventListener('DOMContentLoaded', () => {

    // ─── Acordeón ─────────────────────────────────────────
    document.querySelectorAll('.accordion-header').forEach(button => {
        button.addEventListener('click', () => {
            const item     = button.closest('.accordion-item');
            const content  = button.nextElementSibling;
            const yaAbierto = item.classList.contains('abierto');

            // Cerrar todos los demás (acordeón único)
            document.querySelectorAll('.accordion-item.abierto').forEach(it => {
                it.classList.remove('abierto');
                const c = it.querySelector('.accordion-content');
                if (c) c.style.maxHeight = null;
            });

            if (!yaAbierto) {
                item.classList.add('abierto');
                // Esperar al siguiente frame para que el padding interno cuente
                requestAnimationFrame(() => {
                    content.style.maxHeight = content.scrollHeight + 'px';
                });
            }
        });
    });

    // ─── Formulario de contacto (sin lógica real, solo visual) ─
    const form = document.getElementById('form-soporte');
    form?.addEventListener('submit', (e) => {
        e.preventDefault();
        // Mensaje visual; el módulo no envía datos al backend.
        alert('Solicitud registrada localmente. (Esta sección es informativa y no envía la solicitud al servidor.)');
        form.reset();
    });
});
