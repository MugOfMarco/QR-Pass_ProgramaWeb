// gestionAlumnos.js - VERSIÓN FINAL CORREGIDA
// Corrección: El botón "Agregar Clase" ya no envía el formulario accidentalmente.

class GestionAlumnos {
    constructor() {
        this.apiBase = '/api';
        this.currentBoleta = null;
        this.selectedImageFile = null;
        this.currentImageUrl = null;
        
        console.log('🚀 Inicializando Gestión de Alumnos...');
        
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.initialize());
        } else {
            this.initialize();
        }
    }

    initialize() {
        this.initDomElements();
        
        if (this.hasRequiredElements()) {
            this.initEventListeners();
            this.safeclearform(true);
            console.log('Gestión de Alumnos lista');
        } else {
            console.warn('Elementos requeridos no encontrados en el HTML.');
        }
    }

    hasRequiredElements() {
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
                this.dom[id.replace(/-/g, '')] = element;
                foundCount++;
            }
        });
        
        console.log(`📋 Encontrados ${foundCount}/${elementIds.length} elementos`);
    }

    initEventListeners() {
        console.log('🔗 Inicializando event listeners...');
        
        if (this.dom.btnbuscar) {
            this.dom.btnbuscar.addEventListener('click', (e) => {
                e.preventDefault(); // Evita submit accidental
                this.buscarAlumno();
            });
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
            this.dom.btnremovephoto.addEventListener('click', (e) => {
                e.preventDefault();
                this.RemovePhoto();
            });
        }

        // === CORRECCIÓN IMPORTANTE AQUÍ ===
        if (this.dom.btnagregarclase) {
            this.dom.btnagregarclase.addEventListener('click', (e) => {
                e.preventDefault(); // ¡ESTO EVITA QUE SE ENVÍE EL FORMULARIO!
                this.agregarFilaHorario();
            });
        }

        if (this.dom.studentform) {
            this.dom.studentform.addEventListener('submit', (e) => this.handleFormSubmit(e));
        }

        if (this.dom.btncancelar) {
            this.dom.btncancelar.addEventListener('click', (e) => {
                e.preventDefault();
                this.safeclearform(true);
            });
        }
        
        if (this.dom.btneliminar) {
            this.dom.btneliminar.addEventListener('click', (e) => {
                e.preventDefault();
                this.eliminarAlumno();
            });
        }

        const inputsNumeros = [this.dom.searchboleta, this.dom.formboleta];
        inputsNumeros.forEach(input => {
            if (input) {
                input.addEventListener('input', (e) => {
                    e.target.value = e.target.value.replace(/[^0-9]/g, '');
                    if (e.target.value.length > 10) {
                        e.target.value = e.target.value.slice(0, 10);
                    }
                });
            }
        });

        if (this.dom.formgrupo) {
            this.dom.formgrupo.addEventListener('input', (e) => {
                e.target.value = e.target.value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
                if (e.target.value.length > 5) {
                    e.target.value = e.target.value.slice(0, 5);
                }
            });
        }
        
        console.log('✅ Event listeners configurados');
    }

    safeclearform(fullClear = false) {
        if (this.dom.studentform) this.dom.studentform.reset();
        this.safeRemovePhoto();
        
        if (this.dom.contenedorhorariodinamico) {
            this.dom.contenedorhorariodinamico.innerHTML = '';
            this.agregarFilaHorario(); // Agrega una fila vacía inicial
        }
        
        if (this.dom.formboleta) this.dom.formboleta.readOnly = false;
        if (this.dom.formtitle) this.dom.formtitle.textContent = 'Registrar Nuevo Alumno';
        if (this.dom.btnguardar) {
            this.dom.btnguardar.textContent = 'Registrar Alumno';
            this.dom.btnguardar.disabled = false;
        }
        if (this.dom.btneliminar) this.dom.btneliminar.style.display = 'none';
        if (this.dom.fieldsetlegend) this.dom.fieldsetlegend.textContent = 'Datos del Alumno';
        
        if (fullClear && this.dom.searchboleta) {
            this.dom.searchboleta.value = '';
        }
        
        this.currentBoleta = null;
        this.selectedImageFile = null;
        this.currentImageUrl = null;
    }

    safeRemovePhoto() {
        if (this.dom.previewimage) {
            this.dom.previewimage.src = '';
            this.dom.previewimage.style.display = 'none';
        }
        if (this.dom.nophotomessage) this.dom.nophotomessage.style.display = 'block';
        if (this.dom.btnremovephoto) this.dom.btnremovephoto.style.display = 'none';
        if (this.dom.formfoto) this.dom.formfoto.value = '';
        if (this.dom.photopreview) this.dom.photopreview.style.height = '150px';
        
        this.selectedImageFile = null;
        this.currentImageUrl = null;
    }

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
            if (this.dom.nophotomessage) this.dom.nophotomessage.style.display = 'none';
            if (this.dom.btnremovephoto) this.dom.btnremovephoto.style.display = 'inline-block';
            if (this.dom.photopreview) this.dom.photopreview.style.height = '200px';
        };
        reader.readAsDataURL(file);
    }

    RemovePhoto() {
        this.safeRemovePhoto();
    }

    async uploadImageToCloudinary(file) {
        try {
            const formData = new FormData();
            formData.append('image', file);
            
            const response = await fetch(`${this.apiBase}/upload/image`, {
                method: 'POST',
                body: formData,
                credentials: 'include' // Incluir cookies si es necesario
            });
            
            if (!response.ok) {
            // Esto nos dirá si es error 401, 403, 500, etc.
            const errorText = await response.text();
            throw new Error(`Error ${response.status}: ${errorText}`);
        }
            
            const result = await response.json();
            if (!result.success || !result.url) throw new Error(result.message || 'URL no recibida');
            
            return result.url;
        } catch (error) {
            console.error('Error subiendo imagen:', error);
            throw error;
        }
    }

    // =========================================================
    // 2. HORARIO DINÁMICO
    // =========================================================

    agregarFilaHorario(datos = null) {
        const div = document.createElement('div');
        div.className = 'fila-horario';

        const diaVal = datos ? datos.dia : 'lunes';
        const inicioVal = datos ? datos.inicio : '07:00';
        const finVal = datos ? datos.fin : '08:30';
        const materiaVal = datos ? datos.materia : '';

        // Generamos el HTML con las clases correctas
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

        // Listener para eliminar esta fila específica
        div.querySelector('.btn-eliminar-fila').addEventListener('click', () => {
            div.remove();
        });

        // Agregamos al contenedor
        this.dom.contenedorhorariodinamico.appendChild(div);
    }

    recolectarHorario() {
    // Seleccionamos todas las filas actuales en el DOM
    const filas = document.querySelectorAll('.fila-horario');
    const horarioArray = [];

    filas.forEach(fila => {
        const materiaSelect = fila.querySelector('.input-materia');
        const materia = materiaSelect ? materiaSelect.value.trim() : '';
        
        // Solo procesamos si hay una materia seleccionada
        if (materia !== '') {
            let inicio = fila.querySelector('.input-inicio').value;
            let fin = fila.querySelector('.input-fin').value;
            const dia = fila.querySelector('.input-dia').value;
            
            // 1. Validar que las horas no estén vacías
            if (!inicio || !fin) return; 

            // 2. Asegurar formato HH:mm:ss para la base de datos
            // Si el input solo trae HH:mm, le concatenamos :00
            const formatTime = (time) => {
                if (!time.includes(':')) return '00:00:00';
                return time.length === 5 ? `${time}:00` : time;
            };

            const horaInicioClean = formatTime(inicio);
            const horaFinClean = formatTime(fin);

            // 3. Insertar objeto limpio en el array
            horarioArray.push({
                dia: dia,
                inicio: horaInicioClean,
                fin: horaFinClean,
                materia: materia
            });
        }
    });

    // Log para depurar en consola qué estás enviando exactamente
    console.log('Horario recolectado para enviar:', horarioArray);
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
                alert(`Alumno no encontrado. El formulario se ha limpiado para registrar uno nuevo.`);
                this.safeclearform(false);
                this.dom.formboleta.value = boleta;
                return;
            }

            if (!response.ok) {
                const errorData = await response.json();
                const mensajeError = errorData.message || `Error del servidor (${response.status})`;
                throw new Error(mensajeError);
            }
            
            const data = await response.json();
            
            if (data.success && data.alumno) {
                this.llenarFormulario(data); 
            } else {
                alert('Alumno no encontrado en la base de datos.');
                this.safeclearform(false);
            }

        } catch (error) {
            console.error('Error en búsqueda:', error);
            
            if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
                alert('No hay conexión con el servidor. Verifique que el servidor (Node.js) esté encendido.');
            } else {
                alert('Atención: ' + error.message);
            }
        }
    }

    llenarFormulario(data) {
    const alumno = data.alumno || {};
    const horario = data.horario || alumno.horario || []; 

    this.dom.formboleta.value = alumno.boleta || '';
    this.dom.formnombre.value = alumno.nombre || '';
    this.dom.formgrupo.value = alumno.nombre_grupo || alumno.grupo || '';

    if (alumno.url && alumno.url !== '') {
        const cleanUrl = alumno.url.trim().replace(/ /g, '');
        this.currentImageUrl = cleanUrl;
        
        // --- ESTA ES LA CORRECCIÓN CLAVE ---
        this.dom.previewimage.crossOrigin = "anonymous"; // Evita el bloqueo de seguridad
        this.dom.previewimage.src = cleanUrl;
        // ------------------------------------

        this.dom.previewimage.style.display = 'block';
        this.dom.nophotomessage.style.display = 'none';
        this.dom.btnremovephoto.style.display = 'inline-block';
        
        if(this.dom.photopreview) { // Corregido: photopreview (según tu initDomElements)
            this.dom.photopreview.style.height = '200px';
        }
    } else {
        this.RemovePhoto();
    }

    // --- LÍNEAS NUEVAS PARA QUE NO SE QUEDE A MEDIAS EL FORMULARIO ---
    if (alumno.estado_academico) this.dom.formestatus.value = alumno.estado_academico.toLowerCase();
    this.dom.formpuertasabiertas.checked = (alumno.puerta_abierta === 1 || alumno.puerta_abierta === true);
    // ----------------------------------------------------------------

    this.dom.contenedorhorariodinamico.innerHTML = '';
    if (horario.length > 0) {
        if (Array.isArray(horario)) {
            horario.forEach(clase => this.agregarFilaHorario(clase));
        } else {
            this.agregarFilaHorario(); 
        }
    } else {
        this.agregarFilaHorario(); 
    }

    this.dom.formboleta.readOnly = true;
    this.dom.formtitle.textContent = 'Modificar Alumno Existente';
    this.dom.btnguardar.textContent = 'Guardar Cambios';
    this.dom.btneliminar.style.display = 'block';
    if (this.dom.fieldsetlegend) this.dom.fieldsetlegend.textContent = 'Modificar Datos del Alumno';
    
    this.currentBoleta = alumno.boleta;
}
    async handleFormSubmit(e) {
        e.preventDefault();
        
        this.dom.btnguardar.disabled = true;
        this.dom.btnguardar.textContent = 'Procesando...';

        try {
            let imageUrl = this.currentImageUrl;

            if (this.selectedImageFile) {
                console.log('Subiendo imagen...');
                imageUrl = await this.uploadImageToCloudinary(this.selectedImageFile);
            }

            const alumnoData = {
                boleta: this.dom.formboleta.value.trim(),
                nombre: this.dom.formnombre.value.trim(),
                nombre_grupo: this.dom.formgrupo.value.trim(),
                estado_academico: this.dom.formestatus.value,
                puerta_abierta: this.dom.formpuertasabiertas.checked,
                url: imageUrl || '',
                horario: this.recolectarHorario()
            };

            if (alumnoData.boleta.length < 5) throw new Error('Boleta inválida');
            if (!alumnoData.nombre) throw new Error('Nombre obligatorio');

            const isUpdate = this.currentBoleta !== null;
            const url = isUpdate 
                ? `${this.apiBase}/alumnos/modificar/${alumnoData.boleta}`
                : `${this.apiBase}/alumnos/registrar`;
            
            const method = isUpdate ? 'PUT' : 'POST';

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

document.addEventListener('DOMContentLoaded', () => {
    try {
        new GestionAlumnos();
    } catch (error) {
        console.error('Error inicializando GestionAlumnos:', error);
    }
});