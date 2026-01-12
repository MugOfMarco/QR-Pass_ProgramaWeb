// gestionAlumnos.js - VERSIÓN FINAL (Cloudinary + Horario Dinámico)

class GestionAlumnos {
    constructor() {
        this.apiBase = '/api'; // Asegúrate que tu backend responda aquí
        this.currentBoleta = null;
        this.selectedImageFile = null;
        this.currentImageUrl = null;

        // Inicializar elementos del DOM
        this.dom = {
            // Buscador
            searchBoleta: document.getElementById('search-boleta'),
            btnBuscar: document.getElementById('btn-buscar'),
            
            // Botones de Acción Global
            btnGuardar: document.getElementById('btn-guardar'),
            btnEliminar: document.getElementById('btn-eliminar'),
            btnCancelar: document.getElementById('btn-cancelar'),
            
            // Formulario Datos Básicos
            studentForm: document.getElementById('student-form'),
            formBoleta: document.getElementById('form-boleta'),
            formNombre: document.getElementById('form-nombre'),
            formGrupo: document.getElementById('form-grupo'),
            formEstatus: document.getElementById('form-estatus'),
            formPuertasAbiertas: document.getElementById('form-puertas-abiertas'),
            formTitle: document.getElementById('form-title'),
            fieldsetLegend: document.getElementById('fieldset-legend'),

            // --- ELEMENTOS DE FOTO (Cloudinary) ---
            formFoto: document.getElementById('form-foto'),
            previewImage: document.getElementById('preview-image'),
            photoPreview: document.getElementById('photo-preview'),
            noPhotoMessage: document.getElementById('no-photo-message'),
            btnRemovePhoto: document.getElementById('btn-remove-photo'),

            // --- ELEMENTOS DE HORARIO DINÁMICO ---
            // Nota: Ya no usamos 'form-horario', usamos el contenedor y el botón
            contenedorHorario: document.getElementById('contenedor-horario-dinamico'),
            btnAgregarClase: document.getElementById('btn-agregar-clase'),

            // Menú
            menuToggle: document.getElementById('menu-toggle-btn'),
            menuLista: document.getElementById('lista-opciones'),
            menuOverlay: document.getElementById('menu-overlay')
        };

        this.initEventListeners();
        this.clearForm(true);
    }

    initEventListeners() {
        // --- Menú ---
        if (this.dom.menuToggle) {
            this.dom.menuToggle.addEventListener('click', () => this.toggleMenu());
            this.dom.menuOverlay.addEventListener('click', () => this.toggleMenu());
        }

        // --- Búsqueda ---
        if (this.dom.btnBuscar) {
            this.dom.btnBuscar.addEventListener('click', () => this.buscarAlumno());
            this.dom.searchBoleta.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this.buscarAlumno();
                }
            });
        }

        // --- Foto ---
        if (this.dom.formFoto) {
            this.dom.formFoto.addEventListener('change', (e) => this.handleImageSelect(e));
        }
        if (this.dom.btnRemovePhoto) {
            this.dom.btnRemovePhoto.addEventListener('click', () => this.removePhoto());
        }

        // --- Horario Dinámico ---
        if (this.dom.btnAgregarClase) {
            this.dom.btnAgregarClase.addEventListener('click', () => this.agregarFilaHorario());
        }

        // --- Formulario Submit ---
        if (this.dom.studentForm) {
            this.dom.studentForm.addEventListener('submit', (e) => this.handleFormSubmit(e));
        }

        // --- Botones Cancelar/Eliminar ---
        if (this.dom.btnCancelar) this.dom.btnCancelar.addEventListener('click', () => this.clearForm(true));
        if (this.dom.btnEliminar) this.dom.btnEliminar.addEventListener('click', () => this.eliminarAlumno());
    }

    toggleMenu() {
        if (this.dom.menuLista && this.dom.menuOverlay) {
            this.dom.menuLista.classList.toggle('menu-visible');
            this.dom.menuOverlay.classList.toggle('menu-visible');
        }
    }

    // =========================================================
    // 1. MANEJO DE FOTOS (Cloudinary Logic)
    // =========================================================

    handleImageSelect(event) {
        const file = event.target.files[0];
        if (!file) return;

        if (file.size > 5 * 1024 * 1024) {
            alert('La imagen es demasiado grande. Máximo 5MB.');
            event.target.value = '';
            return;
        }

        const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
        if (!validTypes.includes(file.type)) {
            alert('Formato no válido. Use JPG, PNG, GIF o WebP.');
            event.target.value = '';
            return;
        }

        this.selectedImageFile = file;

        const reader = new FileReader();
        reader.onload = (e) => {
            this.dom.previewImage.src = e.target.result;
            this.dom.previewImage.style.display = 'block';
            this.dom.noPhotoMessage.style.display = 'none';
            this.dom.btnRemovePhoto.style.display = 'inline-block';
            if(this.dom.photoPreview) this.dom.photoPreview.style.height = '200px';
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
        if(this.dom.photoPreview) this.dom.photoPreview.style.height = '150px';
    }

    async uploadImageToCloudinary(file) {
        try {
            const formData = new FormData();
            formData.append('image', file);
            
            const response = await fetch(`${this.apiBase}/upload/image`, {
                method: 'POST',
                body: formData
            });
            
            if (!response.ok) throw new Error('Error al subir imagen al servidor');
            
            const result = await response.json();
            if (!result.success || !result.url) throw new Error(result.message || 'URL no recibida');
            
            return result.url;
        } catch (error) {
            console.error('Error subiendo imagen:', error);
            throw error;
        }
    }

    // =========================================================
    // 2. MANEJO DE HORARIO DINÁMICO
    // =========================================================

    agregarFilaHorario(datos = null) {
        const div = document.createElement('div');
        div.className = 'fila-horario';

        // Valores por defecto o datos cargados
        const diaVal = datos ? datos.dia : 'lunes';
        const inicioVal = datos ? datos.inicio : '07:00';
        const finVal = datos ? datos.fin : '08:30';
        const materiaVal = datos ? datos.materia : '';

        div.innerHTML = `
            <select class="input-dia">
                <option value="lunes" ${diaVal === 'lunes' ? 'selected' : ''}>Lun</option>
                <option value="martes" ${diaVal === 'martes' ? 'selected' : ''}>Mar</option>
                <option value="miercoles" ${diaVal === 'miercoles' || diaVal === 'miércoles' ? 'selected' : ''}>Mié</option>
                <option value="jueves" ${diaVal === 'jueves' ? 'selected' : ''}>Jue</option>
                <option value="viernes" ${diaVal === 'viernes' ? 'selected' : ''}>Vie</option>
            </select>
            <input type="time" class="input-inicio" value="${inicioVal}">
            <input type="time" class="input-fin" value="${finVal}">
            <select class="input-materia">
                <option value="">Seleccionar Materia...</option>
                <option value="Matemáticas IV" ${materiaVal === 'Matemáticas IV' ? 'selected' : ''}>Matemáticas IV</option>
                <option value="Física III" ${materiaVal === 'Física III' ? 'selected' : ''}>Física III</option>
                <option value="Programación Orientada a Objetos" ${materiaVal === 'Programación Orientada a Objetos' ? 'selected' : ''}>Prog. Orientada a Objetos</option>
                <option value="Bases de Datos" ${materiaVal === 'Bases de Datos' ? 'selected' : ''}>Bases de Datos</option>
                <option value="Inglés IV" ${materiaVal === 'Inglés IV' ? 'selected' : ''}>Inglés IV</option>
                <option value="Ética Profesional" ${materiaVal === 'Ética Profesional' ? 'selected' : ''}>Ética Profesional</option>
            </select>
            <button type="button" class="btn-eliminar-fila">×</button>
        `;

        div.querySelector('.btn-eliminar-fila').addEventListener('click', () => {
            div.remove();
        });

        this.dom.contenedorHorario.appendChild(div);
    }

    recolectarHorario() {
        const filas = document.querySelectorAll('.fila-horario');
        const horarioArray = [];
        filas.forEach(fila => {
            const materia = fila.querySelector('.input-materia').value;
            if (materia) {
                horarioArray.push({
                    dia: fila.querySelector('.input-dia').value,
                    inicio: fila.querySelector('.input-inicio').value,
                    fin: fila.querySelector('.input-fin').value,
                    materia: materia
                });
            }
        });
        return horarioArray;
    }

    // =========================================================
    // 3. BÚSQUEDA Y LLENADO
    // =========================================================

    async buscarAlumno() {
        const boleta = this.dom.searchBoleta.value.trim();
        if (boleta.length < 5) {
            alert('Ingrese una boleta válida (mínimo 5 dígitos)');
            return;
        }

        try {
            const response = await fetch(`${this.apiBase}/alumnos/${boleta}`);
            
            if (response.status === 404) {
                alert(`Alumno no encontrado. Puede registrar uno nuevo.`);
                this.clearForm(false);
                this.dom.formBoleta.value = boleta;
                return;
            }

            if (!response.ok) throw new Error(`Error HTTP: ${response.status}`);
            
            const data = await response.json();
            
            if (data.success && data.alumno) {
                // Pasamos data completo porque el horario puede venir fuera del objeto alumno
                // dependiendo de tu controlador. Asumimos data.alumno y data.horario
                this.llenarFormulario(data); 
            } else {
                alert('Alumno no encontrado');
                this.clearForm(false);
            }
        } catch (error) {
            console.error('Error en búsqueda:', error);
            alert('Error al conectar con el servidor.');
        }
    }

    llenarFormulario(data) {
        const alumno = data.alumno || {};
        // Intentar obtener horario de data.horario, si no, buscar en alumno.horario
        const horario = data.horario || alumno.horario || []; 

        // Datos básicos
        this.dom.formBoleta.value = alumno.boleta || '';
        this.dom.formNombre.value = alumno.nombre || '';
        this.dom.formGrupo.value = alumno.nombre_grupo || alumno.grupo || ''; // Soporta ambos nombres

        // Estatus
        if (alumno.estado_academico) {
            const estatusLower = alumno.estado_academico.toLowerCase();
            Array.from(this.dom.formEstatus.options).forEach(opt => {
                if (opt.value === estatusLower) opt.selected = true;
            });
        }

        // Puertas abiertas
        this.dom.formPuertasAbiertas.checked = (alumno.puerta_abierta === 1 || alumno.puerta_abierta === true);

        // Foto (Cloudinary Logic)
        if (alumno.url && alumno.url !== '') {
            this.currentImageUrl = alumno.url;
            this.dom.previewImage.src = alumno.url;
            this.dom.previewImage.style.display = 'block';
            this.dom.noPhotoMessage.style.display = 'none';
            this.dom.btnRemovePhoto.style.display = 'inline-block';
            if(this.dom.photoPreview) this.dom.photoPreview.style.height = '200px';
        } else {
            this.removePhoto();
        }

        // Horario (Dynamic Logic)
        this.dom.contenedorHorario.innerHTML = ''; // Limpiar
        if (horario.length > 0) {
            // Si el horario viene como string (formato antiguo), ignorarlo o intentar parsear
            if (Array.isArray(horario)) {
                horario.forEach(clase => this.agregarFilaHorario(clase));
            } else {
                this.agregarFilaHorario(); 
            }
        } else {
            this.agregarFilaHorario(); // Fila vacía
        }

        // Modo Edición
        this.dom.formBoleta.readOnly = true;
        this.dom.formTitle.textContent = 'Modificar Alumno Existente';
        this.dom.btnGuardar.textContent = 'Guardar Cambios';
        this.dom.btnEliminar.style.display = 'block';
        if (this.dom.fieldsetLegend) this.dom.fieldsetLegend.textContent = 'Modificar Datos del Alumno';
        
        this.currentBoleta = alumno.boleta;
    }

    clearForm(fullClear = false) {
        this.dom.studentForm.reset();
        this.removePhoto();
        this.currentImageUrl = null;
        
        // Limpiar Horario Dinámico
        if(this.dom.contenedorHorario) {
            this.dom.contenedorHorario.innerHTML = '';
            this.agregarFilaHorario(); // Agregar una fila vacía por defecto
        }

        this.dom.formBoleta.readOnly = false;
        this.dom.formTitle.textContent = 'Registrar Nuevo Alumno';
        this.dom.btnGuardar.textContent = 'Registrar Alumno';
        this.dom.btnEliminar.style.display = 'none';
        if (this.dom.fieldsetLegend) this.dom.fieldsetLegend.textContent = 'Datos del Alumno';
        
        this.currentBoleta = null;
        if (fullClear) this.dom.searchBoleta.value = '';
    }

    // =========================================================
    // 4. SUBMIT (FUSIÓN DE LÓGICAS)
    // =========================================================

    async handleFormSubmit(e) {
        e.preventDefault();
        
        this.dom.btnGuardar.disabled = true;
        this.dom.btnGuardar.textContent = 'Procesando...';

        try {
            let imageUrl = this.currentImageUrl;

            // 1. Subir imagen si hay una nueva seleccionada
            if (this.selectedImageFile) {
                console.log('Subiendo imagen...');
                imageUrl = await this.uploadImageToCloudinary(this.selectedImageFile);
            }

            // 2. Construir objeto de datos
            const alumnoData = {
                boleta: this.dom.formBoleta.value.trim(),
                nombre: this.dom.formNombre.value.trim(),
                nombre_grupo: this.dom.formGrupo.value.trim(),
                estado_academico: this.dom.formEstatus.value,
                puerta_abierta: this.dom.formPuertasAbiertas.checked,
                url: imageUrl || '',
                // AQUÍ ESTÁ EL CAMBIO IMPORTANTE: Recolectar Array, no String
                horario: this.recolectarHorario() 
            };

            // Validaciones
            if (alumnoData.boleta.length < 5) throw new Error('Boleta inválida');
            if (!alumnoData.nombre) throw new Error('Nombre obligatorio');

            const isUpdate = this.currentBoleta !== null;
            const url = isUpdate 
                ? `${this.apiBase}/alumnos/modificar/${alumnoData.boleta}`
                : `${this.apiBase}/alumnos/registrar`;
            
            const method = isUpdate ? 'PUT' : 'POST';

            // 3. Enviar al Backend
            const response = await fetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(alumnoData)
            });

            const result = await response.json();

            if (!response.ok || !result.success) {
                throw new Error(result.message || 'Error en el servidor');
            }

            alert(isUpdate ? 'Alumno actualizado correctamente' : 'Alumno registrado correctamente');
            this.clearForm(true);

        } catch (error) {
            console.error('Error:', error);
            alert('Error: ' + error.message);
        } finally {
            this.dom.btnGuardar.disabled = false;
            this.dom.btnGuardar.textContent = this.currentBoleta ? 'Guardar Cambios' : 'Registrar Alumno';
        }
    }

    // =========================================================
    // 5. ELIMINAR
    // =========================================================
    async eliminarAlumno() {
        if (!this.currentBoleta) return;
        if (!confirm('¿Seguro que deseas eliminar este alumno?')) return;

        try {
            const response = await fetch(`${this.apiBase}/alumnos/eliminar/${this.currentBoleta}`, {
                method: 'DELETE'
            });
            const result = await response.json();
            
            if (result.success) {
                alert('Alumno eliminado');
                this.clearForm(true);
            } else {
                throw new Error(result.message);
            }
        } catch (error) {
            alert('Error al eliminar: ' + error.message);
        }
    }
}

// Inicialización
document.addEventListener('DOMContentLoaded', () => {
    new GestionAlumnos();
});