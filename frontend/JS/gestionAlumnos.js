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
        const boleta = this.dom.searchBoleta.value.trim();
        if (boleta.length < 5) return alert('Ingrese una boleta válida.');

        try {
            const response = await fetch(`${this.apiBase}/alumno/${boleta}`);

            if (response.status === 404) {
                alert(`Alumno con boleta ${boleta} no encontrado. Listo para registrar.`);
                this.clearForm(false);
                this.dom.formBoleta.value = boleta; // Precarga la boleta para registro
                return;
            }

            if (!response.ok) {
                throw new Error('Error al obtener datos del alumno.');
            }

            const data = await response.json();
            this.llenarFormulario(data.alumno);

        } catch (error) {
            console.error('Error en búsqueda:', error);
            alert('Error al conectar con el servidor o buscar al alumno.');
        }
    }

    // =========================================================
    // LÓGICA DE FORMULARIO
    // =========================================================
    
    async cargarSelectores() {
        // En una implementación real, esto llenaría los <select> de carrera y estatus
        // con datos obtenidos de tus endpoints /api/carreras y /api/estados_academicos
        console.log('Cargando datos para selectores...');
    }

    llenarFormulario(alumno) {
        // Asumiendo que el endpoint /api/alumno/:boleta devuelve:
        // boleta, nombre, nombre_grupo (grupo), estado_academico (estatus), puerta_abierta
        
        this.dom.formBoleta.value = alumno.boleta;
        this.dom.formBoleta.readOnly = true; // Bloquea la boleta para modificación
        this.dom.formTitle.textContent = 'Modificar Alumno Existente';
        this.dom.btnGuardar.textContent = 'Guardar Cambios';
        this.dom.btnEliminar.style.display = 'block';

        document.getElementById('form-nombre').value = alumno.nombre || '';
        document.getElementById('form-grupo').value = alumno.nombre_grupo || '';
        
        // Llenar el select de estatus
        const estatus = alumno.estado_academico.toLowerCase();
        Array.from(this.dom.formEstatus.options).forEach(opt => {
            if (opt.value === estatus) {
                opt.selected = true;
            }
        });
        
        // Checkbox para puertas abiertas
        document.getElementById('form-puertas-abiertas').checked = alumno.puerta_abierta || false;

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
    // LÓGICA DE ENVÍO DE DATOS
    // =========================================================

    async handleFormSubmit(e) {
        e.preventDefault();

        const boleta = this.dom.formBoleta.value.trim();
        const mode = this.dom.formBoleta.readOnly ? 'UPDATE' : 'REGISTER';

        // Recolectar todos los datos del formulario (FormData es ideal)
        const formData = new FormData(this.dom.studentForm);
        const alumnoData = Object.fromEntries(formData.entries());
        
        // Ajustar el estatus y el checkbox para el backend (true/false, id_estado)
        alumnoData.puerta_abierta = alumnoData['puertas-abiertas'] === 'on';
        // Nota: id_estado_academico y id_carrera deben mapearse desde los selectores

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

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || `Error ${response.status} en la operación.`);
            }

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

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || `Error ${response.status} al eliminar.`);
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