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