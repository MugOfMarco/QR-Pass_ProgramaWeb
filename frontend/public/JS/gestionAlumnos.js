// gestionAlumnos.js - VERSIÓN FINAL (Cloudinary + Horario Dinámico)

class GestionAlumnos {
    constructor() {
        this.apiBase = '/api';
        this.currentBoleta = null;
        this.selectedImageFile = null;
        this.currentImageUrl = null;
        
        console.log('🚀 Inicializando Gestión de Alumnos...');
        
        // Esperar a que el DOM esté completamente cargado
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.initialize());
        } else {
            this.initialize();
        }
    }

    initialize() {
        // Inicializar elementos del DOM
        this.initDomElements();
        
        // Solo inicializar si hay elementos necesarios
        if (this.hasRequiredElements()) {
            this.initEventListeners();
            this.safeclearform(true);
            console.log('Gestión de Alumnos lista');
        } else {
            console.warn('Elementos requeridos no encontrados. ¿El formulario está en el HTML?');
        }
    }

    hasRequiredElements() {
        // Verificar que al menos algunos elementos clave existan
        const requiredIds = ['student-form', 'form-boleta', 'form-nombre'];
        const missing = requiredIds.filter(id => !document.getElementById(id));
        
        if (missing.length > 0) {
            console.error('❌ Elementos faltantes:', missing);
            return false;
        }
        return true;
    }

    initDomElements() {
        console.log('🔍 Buscando elementos DOM...');
        
        const elementIds = [
            'search-boleta', 'btn-buscar', 'btn-guardar', 'btn-eliminar', 'btn-cancelar',
            'student-form', 'form-boleta', 'form-nombre', 'form-grupo', 'form-estatus',
            'form-puertas-abiertas', 'form-title', 'fieldset-legend', 'form-foto',
            'preview-image', 'photo-preview', 'no-photo-message', 'btn-remove-photo',
            'contenedor-horario-dinamico', 'btn-agregar-clase'
        ];
        
        this.dom = {};
        let foundCount = 0;
        
        elementIds.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                this.dom[id.replace(/-/g, '')] = element; // search-boleta -> searchboleta
                foundCount++;
            } else {
                console.warn(`⚠️ Elemento no encontrado: ${id}`);
            }
        });
        
        console.log(`📋 Encontrados ${foundCount}/${elementIds.length} elementos`);
    }

    initEventListeners() {
        console.log('🔗 Inicializando event listeners...');
        
        // Solo agregar listeners a elementos que existen
        if (this.dom.btnbuscar) {
            this.dom.btnbuscar.addEventListener('click', () => this.buscarAlumno());
        }
        
        if (this.dom.searchboleta) {
            this.dom.searchboleta.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this.buscarAlumno();
                }
            });
        }

        if (this.dom.formfoto) {
            this.dom.formfoto.addEventListener('change', (e) => this.handleImageSelect(e));
        }
        
        if (this.dom.btnremovephoto) {
            this.dom.btnremovephoto.addEventListener('click', () => this.RemovePhoto());
        }

        if (this.dom.btnagregarclase) {
            this.dom.btnagregarclase.addEventListener('click', () => this.agregarFilaHorario());
        }

        if (this.dom.studentform) {
            this.dom.studentform.addEventListener('submit', (e) => this.handleFormSubmit(e));
        }

        if (this.dom.btncancelar) {
            this.dom.btncancelar.addEventListener('click', () => this.safeclearform(true));
        }
        
        if (this.dom.btneliminar) {
            this.dom.btneliminar.addEventListener('click', () => this.eliminarAlumno());
        }

        const inputsNumeros = [this.dom.searchboleta, this.dom.formboleta];
    inputsNumeros.forEach(input => {
        if (input) {
            input.addEventListener('input', (e) => {
                // Elimina cualquier cosa que no sea número
                e.target.value = e.target.value.replace(/[^0-9]/g, '');
                // Forzar máximo 5 caracteres por si falla el atributo maxlength
                if (e.target.value.length > 10) {
                    e.target.value = e.target.value.slice(0, 10);
                }
            });
        }
    });

    // 2. Restricción para Grupo (Letras y Números, máx 5)
    if (this.dom.formgrupo) {
        this.dom.formgrupo.addEventListener('input', (e) => {
            // Elimina caracteres especiales, permite solo A-Z, a-z y 0-9
            e.target.value = e.target.value.replace(/[^a-zA-Z0-9]/g, '');
            // Convertir a mayúsculas automáticamente (opcional, muy común en grupos)
            e.target.value = e.target.value.toUpperCase();
            
            if (e.target.value.length > 5) {
                e.target.value = e.target.value.slice(0, 5);
            }
        });
    }
        
        console.log('✅ Event listeners configurados');
    }

    safeclearform(fullClear = false) {
        console.log('🧹 Limpiando formulario...');
        
        // Resetear formulario si existe
        if (this.dom.studentform) {
            this.dom.studentform.reset();
        }
        
        // Limpiar foto de forma segura
        this.safeRemovePhoto();
        
        // Limpiar horario dinámico
        if (this.dom.contenedorhorariodinamico) {
            this.dom.contenedorhorariodinamico.innerHTML = '';
            this.agregarFilaHorario();
        }
        
        // Restaurar estado UI
        if (this.dom.formboleta) {
            this.dom.formboleta.readOnly = false;
        }
        
        if (this.dom.formtitle) {
            this.dom.formtitle.textContent = 'Registrar Nuevo Alumno';
        }
        
        if (this.dom.btnguardar) {
            this.dom.btnguardar.textContent = 'Registrar Alumno';
            this.dom.btnguardar.disabled = false;
        }
        
        if (this.dom.btneliminar) {
            this.dom.btneliminar.style.display = 'none';
        }
        
        if (this.dom.fieldsetlegend) {
            this.dom.fieldsetlegend.textContent = 'Datos del Alumno';
        }
        
        // Limpiar búsqueda
        if (fullClear && this.dom.searchboleta) {
            this.dom.searchboleta.value = '';
        }
        
        // Resetear variables
        this.currentBoleta = null;
        this.selectedImageFile = null;
        this.currentImageUrl = null;
        
        console.log('✅ Formulario limpiado');
    }

    safeRemovePhoto() {
        // Método seguro que no falla si los elementos no existen
        if (this.dom.previewimage) {
            this.dom.previewimage.src = '';
            this.dom.previewimage.style.display = 'none';
        }
        
        if (this.dom.nophotomessage) {
            this.dom.nophotomessage.style.display = 'block';
        }
        
        if (this.dom.btnremovephoto) {
            this.dom.btnremovephoto.style.display = 'none';
        }
        
        if (this.dom.formfoto) {
            this.dom.formfoto.value = '';
        }
        
        if (this.dom.photopreview) {
            this.dom.photopreview.style.height = '150px';
        }
        
        this.selectedImageFile = null;
        this.currentImageUrl = null;
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
            if (this.dom.previewimage) {
                this.dom.previewimage.src = e.target.result;
                this.dom.previewimage.style.display = 'block';
            }
            
            if (this.dom.nophotomessage) {
                this.dom.nophotomessage.style.display = 'none';
            }
            
            if (this.dom.btnremovephoto) {
                this.dom.btnremovephoto.style.display = 'inline-block';
            }
            
            if (this.dom.photopreview) {
                this.dom.photopreview.style.height = '200px';
            }
        };
        reader.readAsDataURL(file);
    }

    RemovePhoto() {
        this.selectedImageFile = null;
        this.dom.formfoto.value = '';
        this.dom.previewimage.src = '';
        this.dom.previewimage.style.display = 'none';
        this.dom.nophotomessage.style.display = 'block';
        this.dom.btnremovephoto.style.display = 'none';
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

        this.dom.contenedorhorariodinamico.appendChild(div);
    }

    recolectarHorario() {
    const filas = document.querySelectorAll('.fila-horario');
    const horarioArray = [];
    filas.forEach(fila => {
        const materia = fila.querySelector('.input-materia').value;
        if (materia) {
            // Asegurar formato correcto de horas
            let inicio = fila.querySelector('.input-inicio').value;
            let fin = fila.querySelector('.input-fin').value;
            
            // Asegurar que tenga segundos
            if (!inicio.includes(':')) inicio = '00:00';
            if (!fin.includes(':')) fin = '00:00';
            
            // Formatear como HH:MM:SS
            inicio = inicio.length === 5 ? inicio + ':00' : inicio;
            fin = fin.length === 5 ? fin + ':00' : fin;
            
            horarioArray.push({
                dia: fila.querySelector('.input-dia').value,
                inicio: inicio,
                fin: fin,
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
        const boleta = this.dom.searchboleta.value.trim();
        if (boleta.length < 5) {
            alert('Ingrese una boleta válida (mínimo 5 dígitos)');
            return;
        }

        try {
            const response = await fetch(`${this.apiBase}/alumnos/${boleta}`);
            
            if (response.status === 404) {
                alert(`Alumno no encontrado. Puede registrar uno nuevo.`);
                this.safeclearform(false);
                this.dom.formboleta.value = boleta;
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
                this.safeclearform(false);
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
        this.dom.formboleta.value = alumno.boleta || '';
        this.dom.formnombre.value = alumno.nombre || '';
        this.dom.formgrupo.value = alumno.nombre_grupo || alumno.grupo || ''; // Soporta ambos nombres

        // Estatus
        if (alumno.estado_academico) {
            const estatusLower = alumno.estado_academico.toLowerCase();
            Array.from(this.dom.formestatus.options).forEach(opt => {
                if (opt.value === estatusLower) opt.selected = true;
            });
        }

        // Puertas abiertas
        this.dom.formpuertasabiertas.checked = (alumno.puerta_abierta === 1 || alumno.puerta_abierta === true);

        // Foto (Cloudinary Logic)
        if (alumno.url && alumno.url !== '') {
            this.currentImageUrl = alumno.url;
            this.dom.previewimage.src = alumno.url;
            this.dom.previewimage.style.display = 'block';
            this.dom.nophotomessage.style.display = 'none';
            this.dom.btnremovephoto.style.display = 'inline-block';
            if(this.dom.photoPreview) this.dom.photoPreview.style.height = '200px';
        } else {
            this.RemovePhoto();
        }

        // Horario (Dynamic Logic)
        this.dom.contenedorhorariodinamico.innerHTML = ''; // Limpiar
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
        this.dom.formboleta.readOnly = true;
        this.dom.formtitle.textContent = 'Modificar Alumno Existente';
        this.dom.btnguardar.textContent = 'Guardar Cambios';
        this.dom.btneliminar.style.display = 'block';
        if (this.dom.fieldsetLegend) this.dom.fieldsetLegend.textContent = 'Modificar Datos del Alumno';
        
        this.currentBoleta = alumno.boleta;
    }

    safeclearform(fullClear = false) {
        console.log('🧹 Limpiando formulario...');
        
        // 1. Reset seguro del formulario
        if (this.dom.studentForm) {
            this.dom.studentForm.reset();
        } else {
            // Fallback: buscar directamente
            const form = document.getElementById('student-form');
            if (form) form.reset();
        }
        
        // 2. Limpiar foto
        this.RemovePhoto();
        
        // 3. Resetear variables
        this.selectedImageFile = null;
        this.currentImageUrl = null;
        this.currentBoleta = null;
        
        // 4. Limpiar horario
        if (this.dom.contenedorhorariodinamico) {
            this.dom.contenedorhorariodinamico.innerHTML = '';
            this.agregarFilaHorario(); // Fila vacía por defecto
        }
        
        // 5. Restaurar estado UI
        if (this.dom.formboleta) {
            this.dom.formboleta.readOnly = false;
        }
        
        if (this.dom.formtitle) {
            this.dom.formtitle.textContent = 'Registrar Nuevo Alumno';
        }
        
        if (this.dom.btnguardar) {
            this.dom.btnguardar.textContent = 'Registrar Alumno';
            this.dom.btnguardar.disabled = false;
        }
        
        if (this.dom.btneliminar) {
            this.dom.btneliminar.style.display = 'none';
        }
        
        if (this.dom.fieldsetLegend) {
            this.dom.fieldsetLegend.textContent = 'Datos del Alumno';
        }
        
        // 6. Limpiar búsqueda si es necesario
        if (fullClear && this.dom.searchboleta) {
            this.dom.searchboleta.value = '';
        }
        
        console.log('Formulario limpiado');
    }


    // =========================================================
    // 4. SUBMIT (FUSIÓN DE LÓGICAS)
    // =========================================================

    async handleFormSubmit(e) {
        e.preventDefault();
        
        this.dom.btnguardar.disabled = true;
        this.dom.btnguardar.textContent = 'Procesando...';

        try {
            let imageUrl = this.currentImageUrl;

            // 1. Subir imagen si hay una nueva seleccionada
            if (this.selectedImageFile) {
                console.log('Subiendo imagen...');
                imageUrl = await this.uploadImageToCloudinary(this.selectedImageFile);
            }

            // 2. Construir objeto de datos
            const alumnoData = {
                boleta: this.dom.formboleta.value.trim(),
                nombre: this.dom.formnombre.value.trim(),
                nombre_grupo: this.dom.formgrupo.value.trim(),
                estado_academico: this.dom.formestatus.value,  // Asegúrate que esto sea correcto
                puerta_abierta: this.dom.formpuertasabiertas.checked,
                url: imageUrl || '',
                horario: this.recolectarHorario()  // Esto debe devolver un array
            };

            console.log('Datos a enviar:', alumnoData);
            console.log('Estado académico seleccionado:', this.dom.formestatus.value);
            console.log('Horario recolectado:', alumnoData.horario);

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
            this.safeclearform(true);

        } catch (error) {
            console.error('Error:', error);
            alert('Error: ' + error.message);
        } finally {
            this.dom.btnguardar.disabled = false;
            this.dom.btnguardar.textContent = this.currentBoleta ? 'Guardar Cambios' : 'Registrar Alumno';
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
                this.safeclearform(true);
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
    try {
        new GestionAlumnos();
    } catch (error) {
        console.error('Error inicializando GestionAlumnos:', error);
        alert('Error al cargar la página. Recarga o contacta al administrador.');
    }
});