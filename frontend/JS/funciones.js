function iniciarDescarga() {
    // 1. Contenido a descargar (esto sería un Blob o la URL del archivo real)
    const contenido = "ID,Fecha,Hora\n123,2025-10-21,11:00";
    const blob = new Blob([contenido], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);

    // 2. Crear un elemento de enlace invisible
    const a = document.createElement('a');
    a.href = url;
    a.download = 'registros_qrpass.csv'; // Nombre predefinido para el archivo
    
    // 3. Simular el clic para forzar el diálogo de "Guardar como"
    document.body.appendChild(a);
    a.click();

    // Limpieza
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// Espera a que todo el contenido del HTML esté cargado
document.addEventListener('DOMContentLoaded', function() {

    // 1. Identifica los campos del formulario por su ID
    const qrInput = document.getElementById('qr-input');
    const nombreOutput = document.getElementById('nombre');
    const boletaOutput = document.getElementById('boleta');
    const grupoOutput = document.getElementById('grupo');
    // ...puedes agregar los demás campos si los necesitas

    // 2. Añade un "escuchador" al campo qr-input
    // El evento 'input' se dispara cada vez que el valor cambia
    qrInput.addEventListener('input', function() {
        const boleta = qrInput.value;

        // 3. Si el campo tiene una boleta, intenta buscarla
        if (boleta && boleta.length > 4) { // Un mínimo para no buscar en cada tecla
            buscarAlumno(boleta);
        } else {
            // Si se borra el campo, limpia los otros campos
            limpiarCampos();
        }
    });

    // 4. Función que llama a tu API para buscar al alumno
    async function buscarAlumno(boleta) {
        try {
            // Esta es la URL de tu API (ver Parte 2)
            const response = await fetch('http://localhost:3000/api/alumno/' + boleta);

            if (response.ok) {
                // Si el servidor encontró al alumno
                const alumno = await response.json();
                
                // Rellena los campos con los datos recibidos
                nombreOutput.value = alumno.nombre;
                boletaOutput.value = alumno.boleta;
                grupoOutput.value = alumno.grupo;
                
            } else {
                // Si el servidor NO encontró al alumno (error 404)
                console.warn('Alumno no encontrado:', boleta);
                limpiarCampos();
            }
        } catch (error) {
            // Si hay un error de red (ej. el servidor no responde)
            console.error('Error al conectar con el API:', error);
            limpiarCampos();
        }
    }

    // 5. Función para limpiar los campos si no se encuentra nada
    function limpiarCampos() {
        nombreOutput.value = '';
        boletaOutput.value = '';
        grupoOutput.value = '';
    }

});