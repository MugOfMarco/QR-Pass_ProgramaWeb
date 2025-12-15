// gestionAlumnos.js - Lógica para Registrar, Buscar y Modificar Alumnos

class GestionAlumnos {
    constructor() {
        this.apiBase = 'http://localhost:3000/api';
        this.currentBoleta = null; // Almacena la boleta del alumno actualmente cargado
        
        // Mapeo de elementos del DOM
        this.dom = {
            searchBoleta: document.getElementById('search-boleta'),
            btnBuscar: document.getElementById('btn-buscar'),
            btnGuardar: document.getElementById('btn-guardar'),
            btnEliminar: document.getElementById('btn-eliminar'),
            btnCancelar: document.getElementById('btn-cancelar'),
            studentForm: document.getElementById('student-form'),
            formBoleta: document.getElementById('form-boleta'),
            formTitle: document.getElementById('form-title'),
            menuToggle: document.getElementById('menu-toggle-btn'),
            menuLista: document.getElementById('lista-opciones'),
            menuOverlay: document.getElementById('menu-overlay'),
            // Selectores (Se asume que necesitan IDs de Carrera/Estado)
            formEstatus: document.getElementById('form-estatus'),
            formCarrera: document.getElementById('form-carrera') // Asumo que existe un selector de carrera
        };

        this.initEventListeners();
        this.clearForm(true); // Inicializa el formulario en modo registro
        this.cargarSelectores(); // Carga datos iniciales (carreras, estados)
    }

    initEventListeners() {
        // --- 1. Lógica de Menú (Toggle) ---
        if (this.dom.menuToggle) {
            this.dom.menuToggle.addEventListener('click', () => this.toggleMenu());
            this.dom.menuOverlay.addEventListener('click', () => this.toggleMenu());
        }

        // --- 2. Lógica de Búsqueda ---
        if (this.dom.btnBuscar) {
            this.dom.btnBuscar.addEventListener('click', () => this.buscarAlumno());
            this.dom.searchBoleta.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this.buscarAlumno();
                }
            });
        }

        // --- 3. Lógica del Formulario (Guardar/Modificar) ---
        if (this.dom.studentForm) {
            this.dom.studentForm.addEventListener('submit', (e) => this.handleFormSubmit(e));
        }

        // --- 4. Botones de Acción ---
        if (this.dom.btnCancelar) {
            this.dom.btnCancelar.addEventListener('click', () => this.clearForm(true));
        }
        if (this.dom.btnEliminar) {
            this.dom.btnEliminar.addEventListener('click', () => this.eliminarAlumno());
        }
    }

    toggleMenu() {
        this.dom.menuLista.classList.toggle('menu-visible');
        this.dom.menuOverlay.classList.toggle('menu-visible');
    }

    // =========================================================
    // LÓGICA DE BÚSQUEDA
    // =========================================================

    async buscarAlumno() {
        // Validación básica de input
        const boleta = this.dom.searchBoleta.value.trim();
        if (boleta.length < 5 || isNaN(parseInt(boleta))) { 
             alert('Ingrese una boleta válida (solo números, mínimo 5 dígitos).');
             return;
        }

        try {
            const response = await fetch(`${this.apiBase}/alumnos/${boleta}`);

            // Manejo de errores de autenticación o permiso (401/403)
            if (response.status === 401 || response.status === 403) {
                 alert('Su sesión ha expirado o no tiene permisos. Por favor, inicie sesión.');
                 window.location.href = '/login.html'; 
                 return;
            }

            if (response.status === 404) {
                alert(`Alumno con boleta ${boleta} no encontrado. Listo para registrar.`);
                this.clearForm(false);
                this.dom.formBoleta.value = boleta; // Precarga la boleta para registro
                return;
            }

            if (!response.ok) {
                throw new Error(`Error ${response.status} al obtener datos del alumno.`);
            }

            // El servidor debe devolver JSON en caso de éxito o 404
            const data = await response.json();
            this.llenarFormulario(data.alumno.info); // Asumo que el alumno viene en data.alumno.info

        } catch (error) {
            console.error('Error en búsqueda o parsing:', error);
            // Si el error fue un JSON.parse, el servidor mandó algo inesperado (HTML, etc.)
            alert('Error al conectar con el servidor o buscar al alumno. Verifique su sesión.');
        }
    }

    // =========================================================
    // LÓGICA DE FORMULARIO
    // =========================================================
    
    async cargarSelectores() {
        console.log('Cargando datos para selectores...');
        // Aquí iría la lógica para cargar carreras y estatus de la DB
    }

    llenarFormulario(alumno) {
        // Los IDs del formulario deben coincidir con las propiedades del objeto 'alumno'
        
        this.dom.formBoleta.value = alumno.boleta || '';
        this.dom.formBoleta.readOnly = true; // Bloquea la boleta para modificación
        this.dom.formTitle.textContent = 'Modificar Alumno Existente';
        this.dom.btnGuardar.textContent = 'Guardar Cambios';
        this.dom.btnEliminar.style.display = 'block';

        // Asegúrate de que estos IDs existan en tu HTML
        document.getElementById('form-nombre').value = alumno.nombre_completo || '';
        document.getElementById('form-grupo').value = alumno.grupo || '';
        document.getElementById('form-horario').value = alumno.horario || ''; // Asumo que existe un campo horario

        // Llenar el select de estatus (requiere lógica de mapeo de IDs/valores)
        const estatus = alumno.estatus ? alumno.estatus.toLowerCase() : '';
        Array.from(this.dom.formEstatus.options).forEach(opt => {
            if (opt.value.toLowerCase() === estatus) { // Comparar con el estatus real de la DB
                opt.selected = true;
            }
        });
        
        // Checkbox para puertas abiertas
        const puertaAbiertaCheckbox = document.getElementById('form-puertas-abiertas');
        if (puertaAbiertaCheckbox) {
            puertaAbiertaCheckbox.checked = alumno.puerta_abierta === 1; // Asumo que la DB usa 1/0
        }

        this.currentBoleta = alumno.boleta;
    }

    clearForm(fullClear = false) {
        this.dom.studentForm.reset();
        this.dom.formBoleta.readOnly = false; // Permite editar la boleta para registro
        this.dom.formTitle.textContent = 'Registrar Nuevo Alumno';
        this.dom.btnGuardar.textContent = 'Registrar Alumno';
        this.dom.btnEliminar.style.display = 'none';
        this.currentBoleta = null;

        if (fullClear) {
            this.dom.searchBoleta.value = '';
        }
    }

    // =========================================================
    // LÓGICA DE ENVÍO DE DATOS (Registro/Modificación)
    // =========================================================

    async handleFormSubmit(e) {
        e.preventDefault();

        const boleta = this.dom.formBoleta.value.trim();
        const mode = this.dom.formBoleta.readOnly ? 'UPDATE' : 'REGISTER';

        // Recolectar datos y preparar para JSON
        const formData = new FormData(this.dom.studentForm);
        const alumnoData = Object.fromEntries(formData.entries());
        
        // Ajustar el checkbox a boolean o 1/0 para el backend
        alumnoData.puerta_abierta = alumnoData['puertas-abiertas'] === 'on' ? 1 : 0;
        
        let url;
        let method;

        if (mode === 'REGISTER') {
            url = `${this.apiBase}/alumnos/registrar`;
            method = 'POST';
        } else { // UPDATE
            url = `${this.apiBase}/alumnos/modificar/${boleta}`;
            method = 'PUT';
        }

        try {
            const response = await fetch(url, {
                method: method,
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(alumnoData)
            });

            // Manejo de error de sesión/permisos (401/403)
            if (response.status === 401 || response.status === 403) {
                 alert('Su sesión expiró o no tiene permisos. Redirigiendo...');
                 window.location.href = '/login.html'; 
                 return;
            }
            
            let responseData;
            
            // Si la respuesta es OK (200, 201)
            if (response.ok) {
                 // Intentar parsear JSON solo si hay contenido y es JSON
                 const contentType = response.headers.get("content-type");
                 
                 if (contentType && contentType.includes("application/json")) {
                     responseData = await response.json();
                 } else {
                     // Caso raro: 200/201 sin JSON (ej. DELETE/PUT exitoso)
                     responseData = {};
                 }
            } 
            // Si la respuesta es de ERROR (4xx, 5xx) y no se manejó antes
            else {
                 const contentType = response.headers.get("content-type");
                 
                 if (contentType && contentType.includes("application/json")) {
                     responseData = await response.json();
                 } else {
                     // El servidor devolvió HTML/Texto. Evita el JSON.parse:
                     throw new Error(`Error ${response.status}: Respuesta inesperada del servidor (no JSON).`);
                 }
                 
                 // Lanzar el error con el mensaje del backend
                 throw new Error(responseData.message || `Error ${response.status} en la operación.`);
            }
            
            // --- Operación Exitosa ---
            alert(`Operación exitosa: Alumno ${boleta} ${mode === 'REGISTER' ? 'registrado' : 'modificado'}.`);
            this.clearForm(true);

        } catch (error) {
            console.error('Error al guardar datos:', error);
            alert('Fallo en la operación: ' + error.message);
        }
    }

    // =========================================================
    // LÓGICA DE ELIMINACIÓN
    // =========================================================

    async eliminarAlumno() {
        const boleta = this.currentBoleta;
        if (!boleta || !confirm(`¿Está seguro de eliminar al alumno con boleta ${boleta}? Esta acción es irreversible.`)) {
            return;
        }

        try {
            const response = await fetch(`${this.apiBase}/alumnos/eliminar/${boleta}`, {
                method: 'DELETE',
            });

            // Manejo de error de sesión/permisos (401/403)
            if (response.status === 401 || response.status === 403) {
                 alert('Su sesión expiró o no tiene permisos. Redirigiendo...');
                 window.location.href = '/login.html'; 
                 return;
            }
            
            // La respuesta DELETE puede no tener cuerpo JSON (204 No Content)
            if (!response.ok) {
                 let errorMessage = `Error ${response.status} al eliminar.`;
                 try {
                     const errorJson = await response.json();
                     errorMessage = errorJson.message || errorMessage;
                 } catch (e) {
                     // Si falla el JSON.parse (porque es HTML/Texto), usa el mensaje de estado HTTP
                 }
                 throw new Error(errorMessage);
            }

            alert(`Alumno con boleta ${boleta} eliminado exitosamente.`);
            this.clearForm(true);

        } catch (error) {
            console.error('Error al eliminar alumno:', error);
            alert('Fallo al eliminar: ' + error.message);
        }
    }
}

// Inicialización del sistema al cargar la página
document.addEventListener('DOMContentLoaded', () => {
    new GestionAlumnos();
});