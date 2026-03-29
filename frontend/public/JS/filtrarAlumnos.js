document.addEventListener('DOMContentLoaded', () => {
    // 1. Capturamos los elementos por su ID correcto
    const searchInput = document.getElementById('search-input');
    const formFiltros = document.getElementById('filtros-form');
    const containerAlumnos = document.getElementById('student-list-container');

    // 2. Función Antirrebote (Debounce)
    let timeoutId;
    const debounce = (func, delay) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(func, delay);
    };

    // 3. Función principal para traer los datos
    async function cargarAlumnos() {
        containerAlumnos.innerHTML = '<div class="student-row"><div class="student-data" style="text-align: center; width: 100%;">Cargando alumnos...</div></div>';

        const params = new URLSearchParams();
        
        const q = searchInput.value.trim();
        if (q) params.append('q', q);

        const turno = document.querySelector('input[name="turno"]:checked');
        if (turno) params.append('turno', turno.value);

        const puertas = document.querySelector('input[name="puertas"]:checked');
        if (puertas) params.append('puertas', puertas.value);

        const estado = document.querySelector('input[name="estado"]:checked');
        if (estado) params.append('estado', estado.value);

        try {
            const respuesta = await fetch(`/api/alumnos/buscar/alumnos?${params.toString()}`);
            const resultado = await respuesta.json();

            if (resultado.success && resultado.data.length > 0) {
                let htmlCajitas = '';
                
                resultado.data.forEach(alumno => {
                    // AQUÍ ESTÁ LA MAGIA DEL CLIC (window.location.href)
                    htmlCajitas += `
                        <div class="student-row" 
                             style="cursor: pointer; transition: background 0.2s ease-in-out;" 
                             onmouseover="this.style.background='#f0f0f0'" 
                             onmouseout="this.style.background='white'" 
                             onclick="window.location.href='/BuscarAlumno.html?boleta=${alumno.boleta}'">
                             
                            <div class="student-icon">
                                <svg viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                                    <circle cx="12" cy="7" r="4"></circle>
                                </svg>
                            </div>
                            <div class="student-data">
                                <div><strong>Nombre:</strong> ${alumno.nombre_completo}</div>
                                <div><strong>Situacion Academica:</strong> ${alumno.estado_academico}</div>
                                <div><strong>Grupo:</strong> ${alumno.grupo}</div>
                                <div><strong>Turno:</strong> ${alumno.turno}</div>
                                <div><strong>Boleta:</strong> ${alumno.boleta}</div>
                                <div><strong>Puertas Abiertas:</strong> ${alumno.puertas_abiertas ? 'Si' : 'No'}</div>
                            </div>
                        </div>
                    `;
                });
                
                containerAlumnos.innerHTML = htmlCajitas;
            } else {
                containerAlumnos.innerHTML = `
                    <div class="student-row">
                        <div class="student-data" style="text-align: center; width: 100%; color: #d32f2f; font-weight: bold;">
                            No se encontraron alumnos con estos filtros.
                        </div>
                    </div>`;
            }
        } catch (error) {
            console.error("Error de conexión:", error);
            containerAlumnos.innerHTML = '<div class="student-row"><div class="student-data" style="text-align: center; width: 100%;">Error al conectar con el servidor. Verifica la consola (F12).</div></div>';
        }
    }

    // 4. Asignamos los eventos
    if (searchInput) searchInput.addEventListener('input', () => debounce(cargarAlumnos, 300));
    if (formFiltros) formFiltros.addEventListener('change', cargarAlumnos);

    // 5. Carga inicial
    cargarAlumnos();
});