// gestionAlumnos.js - CON SUBIDA DE IMÁGENES A CLOUDINARY
class GestionAlumnos {
    constructor() {
        this.apiBase = '/api';
        this.currentBoleta = null;
        this.selectedImageFile = null;
        this.currentImageUrl = null;
        
        // Inicializar elementos del DOM
        this.dom = {
            searchBoleta: document.getElementById('search-boleta'),
            btnBuscar: document.getElementById('btn-buscar'),
            btnGuardar: document.getElementById('btn-guardar'),
            btnEliminar: document.getElementById('btn-eliminar'),
            btnCancelar: document.getElementById('btn-cancelar'),
            btnRemovePhoto: document.getElementById('btn-remove-photo'),
            studentForm: document.getElementById('student-form'),
            formFoto: document.getElementById('form-foto'),
            formBoleta: document.getElementById('form-boleta'),
            formNombre: document.getElementById('form-nombre'),
            formGrupo: document.getElementById('form-grupo'),
            formHorario: document.getElementById('form-horario'),
            formEstatus: document.getElementById('form-estatus'),
            formPuertasAbiertas: document.getElementById('form-puertas-abiertas'),
            formTitle: document.getElementById('form-title'),
            fieldsetLegend: document.getElementById('fieldset-legend'),
            menuToggle: document.getElementById('menu-toggle-btn'),
            menuLista: document.getElementById('lista-opciones'),
            menuOverlay: document.getElementById('menu-overlay'),
            previewImage: document.getElementById('preview-image'),
            photoPreview: document.getElementById('photo-preview'),
            noPhotoMessage: document.getElementById('no-photo-message')
        };

        this.initEventListeners();
        this.clearForm(true);
    }

    initEventListeners() {
        // --- Menú de navegación ---
        if (this.dom.menuToggle) {
            this.dom.menuToggle.addEventListener('click', () => this.toggleMenu());
        }
        if (this.dom.menuOverlay) {
            this.dom.menuOverlay.addEventListener('click', () => this.toggleMenu());
        }

        // --- Búsqueda de alumno ---
        if (this.dom.btnBuscar) {
            this.dom.btnBuscar.addEventListener('click', () => this.buscarAlumno());
        }
        
        if (this.dom.searchBoleta) {
            this.dom.searchBoleta.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this.buscarAlumno();
                }
            });
        }

        // --- Manejo de la foto ---
        if (this.dom.formFoto) {
            this.dom.formFoto.addEventListener('change', (e) => this.handleImageSelect(e));
        }
        
        if (this.dom.btnRemovePhoto) {
            this.dom.btnRemovePhoto.addEventListener('click', () => this.removePhoto());
        }

        // --- Formulario ---
        if (this.dom.studentForm) {
            this.dom.studentForm.addEventListener('submit', (e) => this.handleFormSubmit(e));
        }

        // --- Botones de acción ---
        if (this.dom.btnCancelar) {
            this.dom.btnCancelar.addEventListener('click', () => this.clearForm(true));
        }
        
        if (this.dom.btnEliminar) {
            this.dom.btnEliminar.addEventListener('click', () => this.eliminarAlumno());
        }
    }

    toggleMenu() {
        if (this.dom.menuLista && this.dom.menuOverlay) {
            this.dom.menuLista.classList.toggle('menu-visible');
            this.dom.menuOverlay.classList.toggle('menu-visible');
        }
    }

    // =========================================================
    // MANEJO DE IMÁGENES
    // =========================================================

    handleImageSelect(event) {
        const file = event.target.files[0];
        if (!file) return;

        // Validar tamaño (5MB máximo)
        if (file.size > 5 * 1024 * 1024) {
            alert('La imagen es demasiado grande. Máximo 5MB.');
            event.target.value = '';
            return;
        }

        // Validar tipo de archivo
        const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
        if (!validTypes.includes(file.type)) {
            alert('Formato no válido. Use JPG, PNG, GIF o WebP.');
            event.target.value = '';
            return;
        }

        this.selectedImageFile = file;

        // Mostrar vista previa
        const reader = new FileReader();
        reader.onload = (e) => {
            this.dom.previewImage.src = e.target.result;
            this.dom.previewImage.style.display = 'block';
            this.dom.noPhotoMessage.style.display = 'none';
            this.dom.btnRemovePhoto.style.display = 'inline-block';
            
            // Ajustar tamaño de la vista previa
            this.dom.photoPreview.style.height = '200px';
        };
        reader.readAsDataURL(file);
    }

    removePhoto() {
        this.selectedImageFile = null;
        this.dom.formFoto.value = '';
        this.dom.previewImage.src = '';
        this.dom.previewImage.style.display = 'none';
        this.dom.noPhotoMessage.style.display = 'block';
        this.dom.btnRemovePhoto.style.display = 'none';
        this.dom.photoPreview.style.height = '150px';
    }

    // =========================================================
    // BÚSQUEDA DE ALUMNO
    // =========================================================

    async buscarAlumno() {
        const boleta = this.dom.searchBoleta.value.trim();
        
        if (boleta.length < 5) {
            alert('Ingrese una boleta válida (mínimo 5 dígitos)');
            return;
        }

        console.log('Buscando alumno con boleta:', boleta);

        try {
            const response = await fetch(`${this.apiBase}/alumnos/${boleta}`);

            if (response.status === 404) {
                alert(`Alumno con boleta ${boleta} no encontrado. Puede registrar uno nuevo.`);
                this.clearForm(false);
                this.dom.formBoleta.value = boleta;
                return;
            }

            if (!response.ok) {
                throw new Error(`Error HTTP: ${response.status}`);
            }

            const data = await response.json();
            console.log('Datos recibidos del alumno:', data);

            if (data.success && data.alumno) {
                this.llenarFormulario(data.alumno);
            } else {
                alert('Alumno no encontrado');
                this.clearForm(false);
                this.dom.formBoleta.value = boleta;
            }

        } catch (error) {
            console.error('Error en búsqueda:', error);
            alert('Error al conectar con el servidor: ' + error.message);
        }
    }

    // =========================================================
    // MANEJO DEL FORMULARIO
    // =========================================================

    llenarFormulario(alumno) {
        console.log('Llenando formulario con datos:', alumno);
        
        // Datos básicos
        this.dom.formBoleta.value = alumno.boleta || '';
        this.dom.formNombre.value = alumno.nombre || '';
        this.dom.formGrupo.value = alumno.nombre_grupo || '';
        
        // Horario
        if (alumno.horario && alumno.horario.length > 0) {
            const horas = alumno.horario.map(h => h.inicio).sort();
            const primeraHora = horas[0].substring(0, 5);
            const ultimaHora = horas[horas.length - 1].substring(0, 5);
            this.dom.formHorario.value = `${primeraHora} - ${ultimaHora}`;
        } else {
            this.dom.formHorario.value = '';
        }
        
        // Estatus académico
        if (alumno.estado_academico) {
            const estatusLower = alumno.estado_academico.toLowerCase();
            Array.from(this.dom.formEstatus.options).forEach(opt => {
                if (opt.value === estatusLower) {
                    opt.selected = true;
                }
            });
        }
        
        // Puertas abiertas
        this.dom.formPuertasAbiertas.checked = alumno.puerta_abierta || false;
        
        // Foto del alumno
        if (alumno.url) {
            this.currentImageUrl = alumno.url;
            this.dom.previewImage.src = alumno.url;
            this.dom.previewImage.style.display = 'block';
            this.dom.noPhotoMessage.style.display = 'none';
            this.dom.btnRemovePhoto.style.display = 'inline-block';
            this.dom.photoPreview.style.height = '200px';
        }
        
        // Cambiar interfaz a modo edición
        this.dom.formBoleta.readOnly = true;
        this.dom.formTitle.textContent = 'Modificar Alumno Existente';
        this.dom.btnGuardar.textContent = 'Guardar Cambios';
        this.dom.btnEliminar.style.display = 'block';
        
        if (this.dom.fieldsetLegend) {
            this.dom.fieldsetLegend.textContent = 'Modificar Datos del Alumno';
        }
        
        this.currentBoleta = alumno.boleta;
        
        console.log('Formulario llenado correctamente');
    }

    clearForm(fullClear = false) {
        console.log('Limpiando formulario');
        
        // Resetear formulario
        this.dom.studentForm.reset();
        
        // Limpiar imagen
        this.removePhoto();
        this.selectedImageFile = null;
        this.currentImageUrl = null;
        
        // Restablecer interfaz
        this.dom.formBoleta.readOnly = false;
        this.dom.formTitle.textContent = 'Registrar Nuevo Alumno';
        this.dom.btnGuardar.textContent = 'Registrar Alumno';
        this.dom.btnEliminar.style.display = 'none';
        
        if (this.dom.fieldsetLegend) {
            this.dom.fieldsetLegend.textContent = 'Datos del Alumno';
        }
        
        this.currentBoleta = null;
        
        if (fullClear) {
            this.dom.searchBoleta.value = '';
        }
    }

    // =========================================================
    // SUBIDA DE IMAGEN A CLOUDINARY
    // =========================================================

    async uploadImageToCloudinary(file) {
        try {
            // Crear FormData para enviar la imagen
            const formData = new FormData();
            formData.append('image', file);
            
            // Usar el endpoint de tu backend que subirá a Cloudinary
            const response = await fetch(`${this.apiBase}/upload/image`, {
                method: 'POST',
                body: formData
            });
            
            if (!response.ok) {
                throw new Error('Error al subir imagen');
            }
            
            const result = await response.json();
            
            if (!result.success || !result.url) {
                throw new Error(result.message || 'URL no recibida');
            }
            
            console.log('Imagen subida exitosamente:', result.url);
            return result.url;
            
        } catch (error) {
            console.error('Error subiendo imagen:', error);
            throw error;
        }
    }

    // =========================================================
    // ENVÍO DEL FORMULARIO (REGISTRAR/MODIFICAR)
    // =========================================================

    async handleFormSubmit(e) {
        e.preventDefault();
        
        console.log('Procesando envío del formulario');
        
        // Deshabilitar botón para evitar múltiples envíos
        this.dom.btnGuardar.disabled = true;
        this.dom.btnGuardar.textContent = 'Procesando...';
        
        try {
            let imageUrl = this.currentImageUrl;
            
            // Subir nueva imagen si se seleccionó una
            if (this.selectedImageFile) {
                console.log('Subiendo nueva imagen a Cloudinary...');
                imageUrl = await this.uploadImageToCloudinary(this.selectedImageFile);
            }
            
            // Recolectar datos del formulario
            const alumnoData = {
                boleta: this.dom.formBoleta.value.trim(),
                nombre: this.dom.formNombre.value.trim(),
                nombre_grupo: this.dom.formGrupo.value.trim(),
                horario: this.dom.formHorario.value.trim(),
                estado_academico: this.dom.formEstatus.value,
                puerta_abierta: this.dom.formPuertasAbiertas.checked,
                url: imageUrl || '' // Incluir URL de la imagen
            };
            
            console.log('Datos a enviar:', alumnoData);
            
            // Validaciones básicas
            if (!alumnoData.boleta || alumnoData.boleta.length < 5) {
                throw new Error('La boleta debe tener al menos 5 dígitos');
            }
            
            if (!alumnoData.nombre) {
                throw new Error('El nombre es obligatorio');
            }
            
            const isUpdate = this.currentBoleta !== null;
            const url = isUpdate 
                ? `${this.apiBase}/alumnos/modificar/${alumnoData.boleta}`
                : `${this.apiBase}/alumnos/registrar`;
            
            const method = isUpdate ? 'PUT' : 'POST';
            
            console.log(`Enviando ${isUpdate ? 'actualización' : 'registro'} a:`, url);
            
            const response = await fetch(url, {
                method: method,
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(alumnoData)
            });
            
            const result = await response.json();
            console.log('Respuesta del servidor:', result);
            
            if (!response.ok || !result.success) {
                throw new Error(result.message || `Error ${response.status}`);
            }
            
            alert(result.message || (isUpdate ? 'Alumno modificado exitosamente' : 'Alumno registrado exitosamente'));
            this.clearForm(true);
            
        } catch (error) {
            console.error('Error al guardar datos:', error);
            alert('Error: ' + error.message);
        } finally {
            // Rehabilitar botón
            this.dom.btnGuardar.disabled = false;
            this.dom.btnGuardar.textContent = this.currentBoleta ? 'Guardar Cambios' : 'Registrar Alumno';
        }
    }

    // =========================================================
    // ELIMINACIÓN DE ALUMNO
    // =========================================================

    async eliminarAlumno() {
        if (!this.currentBoleta) {
            alert('No hay alumno seleccionado para eliminar');
            return;
        }
        
        const confirmacion = confirm(`¿Está seguro de eliminar al alumno con boleta ${this.currentBoleta}?\nEsta acción es irreversible.`);
        
        if (!confirmacion) {
            return;
        }
        
        console.log('Eliminando alumno con boleta:', this.currentBoleta);
        
        try {
            const response = await fetch(`${this.apiBase}/alumnos/eliminar/${this.currentBoleta}`, {
                method: 'DELETE'
            });
            
            const result = await response.json();
            console.log('Respuesta de eliminación:', result);
            
            if (!response.ok || !result.success) {
                throw new Error(result.message || `Error ${response.status}`);
            }
            
            alert(result.message || 'Alumno eliminado exitosamente');
            this.clearForm(true);
            
        } catch (error) {
            console.error('Error al eliminar alumno:', error);
            alert('Error: ' + error.message);
        }
    }
}

// Inicialización del sistema
document.addEventListener('DOMContentLoaded', () => {
    console.log('Inicializando GestionAlumnos...');
    try {
        new GestionAlumnos();
        console.log('GestionAlumnos inicializado correctamente');
    } catch (error) {
        console.error('Error al inicializar GestionAlumnos:', error);
        alert('Error al cargar la página. Por favor, recarga.');
    }
});