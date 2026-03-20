// frontend/public/JS/gestionAlumnos.js
// ============================================================
// CRUD completo de alumnos — ModificarAlumno.html
// ─────────────────────────────────────────────────────────────
// Fixes aplicados:
//   · credentials:'include' en TODOS los fetch
//   · Grupos y estados se cargan dinámicamente desde la API
//   · form-grupo es ahora un <select> con id_grupo real
//   · form-estatus compara correctamente con los valores de BD
//   · recolectarHorario() usa los nombres reales de materias de BD
//   · eliminarAlumno() muestra el mensaje del servidor (403)
//   · handleFormSubmit() manda los campos que el backend espera
//   · uploadImage() con credentials
//   · Todos los errores HTTP se muestran al usuario
// ============================================================

class GestionAlumnos {
    constructor() {
        this.apiBase        = '/api';
        this.currentBoleta  = null;     // null = modo CREAR, string = modo EDITAR
        this.selectedFile   = null;     // archivo de imagen seleccionado
        this.currentImgUrl  = null;     // URL actual de la foto en BD
        this.grupos         = [];       // catálogo cargado desde BD
        this.estados        = [];       // catálogo cargado desde BD
        this.materias       = [];       // catálogo cargado desde BD

        this.dom = {};

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.init());
        } else {
            this.init();
        }
    }

    // ─────────────────────────────────────────────────────────
    // INICIALIZACIÓN
    // ─────────────────────────────────────────────────────────
    async init() {
        this.bindDom();
        if (!this.dom.studentForm) {
            console.error('No se encontró #student-form en el HTML');
            return;
        }

        // Cargar catálogos antes de mostrar el formulario
        await Promise.all([
            this.cargarGrupos(),
            this.cargarEstados(),
            this.cargarMaterias(),
        ]);

        this.bindEvents();
        this.modoCrear();
    }

    bindDom() {
        const ids = {
            searchBoleta:   'search-boleta',
            btnBuscar:      'btn-buscar',
            btnGuardar:     'btn-guardar',
            btnEliminar:    'btn-eliminar',
            btnCancelar:    'btn-cancelar',
            studentForm:    'student-form',
            formBoleta:     'form-boleta',
            formNombre:     'form-nombre',
            formGrupo:      'form-grupo',       // ahora es un <select>
            formEstatus:    'form-estatus',
            formPuertas:    'form-puertas-abiertas',
            formFoto:       'form-foto',
            formTitle:      'form-title',
            fieldsetLegend: 'fieldset-legend',
            previewImg:     'preview-image',
            photoPreview:   'photo-preview',
            noPhotoMsg:     'no-photo-message',
            btnRemovePhoto: 'btn-remove-photo',
            horarioDiv:     'contenedor-horario-dinamico',
            btnAgregarClase:'btn-agregar-clase',
        };
        for (const [key, id] of Object.entries(ids)) {
            this.dom[key] = document.getElementById(id);
        }
    }

    bindEvents() {
        this.dom.btnBuscar?.addEventListener('click', (e) => {
            e.preventDefault();
            this.buscarAlumno();
        });

        this.dom.searchBoleta?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') { e.preventDefault(); this.buscarAlumno(); }
        });

        // Solo números en boleta
        [this.dom.searchBoleta, this.dom.formBoleta].forEach(el => {
            el?.addEventListener('input', (e) => {
                e.target.value = e.target.value.replace(/\D/g, '').slice(0, 10);
            });
        });

        this.dom.formFoto?.addEventListener('change', (e) => this.handleImageSelect(e));
        this.dom.btnRemovePhoto?.addEventListener('click', (e) => {
            e.preventDefault(); this.quitarFoto();
        });

        this.dom.btnAgregarClase?.addEventListener('click', (e) => {
            e.preventDefault(); this.agregarFilaHorario();
        });

        this.dom.studentForm?.addEventListener('submit', (e) => this.handleSubmit(e));

        this.dom.btnCancelar?.addEventListener('click', (e) => {
            e.preventDefault(); this.modoCrear();
        });

        this.dom.btnEliminar?.addEventListener('click', (e) => {
            e.preventDefault(); this.eliminarAlumno();
        });
    }

    // ─────────────────────────────────────────────────────────
    // CARGAR CATÁLOGOS DESDE BD
    // ─────────────────────────────────────────────────────────
    async cargarGrupos() {
        try {
            const res  = await fetch(`${this.apiBase}/alumnos/grupos/lista`, { credentials: 'include' });
            const data = await res.json();
            if (!data.success) return;

            this.grupos = data.grupos;

            // Poblar el <select id="form-grupo">
            const sel = this.dom.formGrupo;
            if (!sel || sel.tagName !== 'SELECT') return;
            sel.innerHTML = '<option value="">— Selecciona grupo —</option>';
            this.grupos.forEach(g => {
                const opt = document.createElement('option');
                opt.value       = g.id_grupo;           // enviamos el ID numérico
                opt.textContent = g.nombre_grupo;
                sel.appendChild(opt);
            });
        } catch (e) {
            console.error('Error cargando grupos:', e);
        }
    }

    async cargarEstados() {
        try {
            const res  = await fetch(`${this.apiBase}/alumnos/estados/lista`, { credentials: 'include' });
            const data = await res.json();
            if (!data.success) return;

            this.estados = data.estados;

            const sel = this.dom.formEstatus;
            if (!sel || sel.tagName !== 'SELECT') return;
            sel.innerHTML = '<option value="">— Selecciona estado —</option>';
            this.estados.forEach(e => {
                const opt = document.createElement('option');
                opt.value       = e.id_estado;          // enviamos el ID numérico
                opt.textContent = e.estado;
                sel.appendChild(opt);
            });
        } catch (e) {
            console.error('Error cargando estados:', e);
        }
    }

    async cargarMaterias() {
        try {
            // Usamos la ruta de grupos/materias que ya existe en el backend
            // Si no existe una ruta de materias, la añadimos (ver alumnos.routes.js)
            const res = await fetch(`${this.apiBase}/alumnos/materias/lista`, { credentials: 'include' });
            if (!res.ok) return;   // la ruta es opcional — el horario extra puede estar vacío
            const data = await res.json();
            if (data.success) this.materias = data.materias || [];
        } catch (e) {
            // No es crítico — el selector de materias mostrará "sin materias" si falla
        }
    }

    // ─────────────────────────────────────────────────────────
    // BUSCAR ALUMNO
    // ─────────────────────────────────────────────────────────
    async buscarAlumno() {
        const boleta = (this.dom.searchBoleta?.value || '').trim();
        if (boleta.length < 5) {
            this.alerta('Ingresa una boleta válida (mínimo 5 dígitos)'); return;
        }

        try {
            const res = await fetch(`${this.apiBase}/alumnos/${boleta}`, {
                credentials: 'include',
            });

            if (res.status === 401) { window.location.href = '/login.html'; return; }
            if (res.status === 404) {
                this.alerta('Alumno no encontrado. Puedes registrarlo.');
                this.modoCrear();
                if (this.dom.formBoleta) this.dom.formBoleta.value = boleta;
                return;
            }
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                this.alerta(err.message || `Error del servidor (${res.status})`);
                return;
            }

            const data = await res.json();
            if (data.success && data.alumno) {
                this.llenarFormulario(data);
            } else {
                this.alerta(data.message || 'Alumno no encontrado');
                this.modoCrear();
            }
        } catch (e) {
            console.error('Error buscando alumno:', e);
            this.alerta('No se pudo conectar con el servidor');
        }
    }

    // ─────────────────────────────────────────────────────────
    // LLENAR FORMULARIO CON DATOS DEL ALUMNO
    // ─────────────────────────────────────────────────────────
    llenarFormulario(data) {
        const alumno  = data.alumno;
        const horario = data.horario || [];

        // Boleta y nombre
        if (this.dom.formBoleta) { this.dom.formBoleta.value = alumno.boleta; this.dom.formBoleta.readOnly = true; }
        if (this.dom.formNombre) this.dom.formNombre.value = alumno.nombre || '';

        // Grupo — buscar el id_grupo que corresponde al nombre_grupo
        if (this.dom.formGrupo && this.dom.formGrupo.tagName === 'SELECT') {
            const grupoMatch = this.grupos.find(g => g.nombre_grupo === alumno.nombre_grupo);
            this.dom.formGrupo.value = grupoMatch ? grupoMatch.id_grupo : '';
        }

        // Estado académico — buscar el id_estado que corresponde al nombre
        if (this.dom.formEstatus && this.dom.formEstatus.tagName === 'SELECT') {
            const estadoMatch = this.estados.find(
                e => e.estado.toLowerCase() === (alumno.estado || alumno.estado_academico || '').toLowerCase()
            );
            this.dom.formEstatus.value = estadoMatch ? estadoMatch.id_estado : '';
        }

        // Puertas abiertas
        if (this.dom.formPuertas) {
            this.dom.formPuertas.checked = alumno.puerta_abierta === true || alumno.puerta_abierta === 1;
        }

        // Foto
        if (alumno.url) {
            this.currentImgUrl = alumno.url;
            if (this.dom.previewImg) {
                this.dom.previewImg.src           = alumno.url.trim();
                this.dom.previewImg.style.display = 'block';
                this.dom.previewImg.crossOrigin   = 'anonymous';
            }
            if (this.dom.noPhotoMsg)   this.dom.noPhotoMsg.style.display   = 'none';
            if (this.dom.btnRemovePhoto) this.dom.btnRemovePhoto.style.display = 'inline-block';
            if (this.dom.photoPreview) this.dom.photoPreview.style.height  = '200px';
        } else {
            this.quitarFoto();
        }

        // Horario extra del alumno
        if (this.dom.horarioDiv) {
            this.dom.horarioDiv.innerHTML = '';
            if (horario.length > 0) {
                horario.forEach(c => this.agregarFilaHorario(c));
            } else {
                this.agregarFilaHorario();
            }
        }

        // Cambiar modo a EDITAR
        this.currentBoleta = String(alumno.boleta);
        this.modoEditar();
    }

    // ─────────────────────────────────────────────────────────
    // SUBMIT — CREAR O MODIFICAR
    // ─────────────────────────────────────────────────────────
    async handleSubmit(e) {
        e.preventDefault();

        const boleta  = (this.dom.formBoleta?.value || '').trim();
        const nombre  = (this.dom.formNombre?.value || '').trim();
        const idGrupo = this.dom.formGrupo?.value;
        const idEstado= this.dom.formEstatus?.value;

        if (boleta.length < 5)  { this.alerta('Boleta inválida');          return; }
        if (!nombre)            { this.alerta('El nombre es obligatorio'); return; }
        if (!idGrupo)           { this.alerta('Selecciona un grupo');      return; }
        if (!idEstado)          { this.alerta('Selecciona un estado');     return; }

        this.setBotonGuardar(true);

        try {
            // Subir imagen si se seleccionó una nueva
            let urlFoto = this.currentImgUrl;
            if (this.selectedFile) {
                urlFoto = await this.subirImagen(this.selectedFile);
                if (!urlFoto) { this.setBotonGuardar(false); return; }
            }

            const payload = {
                boleta,
                nombre,
                id_grupo_base:       parseInt(idGrupo),
                id_estado_academico: parseInt(idEstado),
                puertas_abiertas:    this.dom.formPuertas?.checked || false,
                url:                 urlFoto || '',
                horario:             this.recolectarHorario(),
            };

            const esEdicion = this.currentBoleta !== null;
            const url    = esEdicion
                ? `${this.apiBase}/alumnos/modificar/${boleta}`
                : `${this.apiBase}/alumnos/registrar`;
            const method = esEdicion ? 'PUT' : 'POST';

            const res = await fetch(url, {
                method,
                headers:     { 'Content-Type': 'application/json' },
                credentials: 'include',
                body:        JSON.stringify(payload),
            });

            if (res.status === 401) { window.location.href = '/login.html'; return; }

            const result = await res.json();

            if (!res.ok || !result.success) {
                this.alerta(result.message || `Error del servidor (${res.status})`);
                return;
            }

            alert(esEdicion ? '✅ Alumno actualizado correctamente' : '✅ Alumno registrado correctamente');
            this.modoCrear();

        } catch (err) {
            console.error('Error en submit:', err);
            this.alerta('Error de conexión con el servidor');
        } finally {
            this.setBotonGuardar(false);
        }
    }

    // ─────────────────────────────────────────────────────────
    // ELIMINAR — el servidor siempre devuelve 403
    // (política de no borrado — usar Baja Definitiva)
    // ─────────────────────────────────────────────────────────
    async eliminarAlumno() {
        if (!this.currentBoleta) return;
        if (!confirm(`¿Seguro que deseas eliminar al alumno con boleta ${this.currentBoleta}?\n\nNota: el sistema usa baja definitiva, no eliminación física.`)) return;

        try {
            const res = await fetch(`${this.apiBase}/alumnos/eliminar/${this.currentBoleta}`, {
                method:      'DELETE',
                credentials: 'include',
            });

            const result = await res.json().catch(() => ({}));

            // El servidor devuelve 403 con mensaje explicativo
            if (res.status === 403) {
                alert(`ℹ️ ${result.message || 'La eliminación está deshabilitada. Usa Baja Definitiva en el estado académico.'}`);
                return;
            }

            if (!res.ok || !result.success) {
                this.alerta(result.message || 'Error al intentar eliminar');
                return;
            }

            alert('Alumno eliminado');
            this.modoCrear();

        } catch (e) {
            this.alerta('Error de conexión');
        }
    }

    // ─────────────────────────────────────────────────────────
    // IMAGEN
    // ─────────────────────────────────────────────────────────
    handleImageSelect(event) {
        const file = event.target.files[0];
        if (!file) return;

        if (file.size > 5 * 1024 * 1024) {
            this.alerta('Imagen demasiado grande. Máximo 5 MB');
            event.target.value = ''; return;
        }
        if (!/^image\/(jpeg|jpg|png|gif|webp)$/.test(file.type)) {
            this.alerta('Formato inválido. Usa JPG, PNG, GIF o WebP');
            event.target.value = ''; return;
        }

        this.selectedFile = file;

        const reader = new FileReader();
        reader.onload = (ev) => {
            if (this.dom.previewImg) {
                this.dom.previewImg.src           = ev.target.result;
                this.dom.previewImg.style.display = 'block';
            }
            if (this.dom.noPhotoMsg)    this.dom.noPhotoMsg.style.display    = 'none';
            if (this.dom.btnRemovePhoto) this.dom.btnRemovePhoto.style.display = 'inline-block';
            if (this.dom.photoPreview)  this.dom.photoPreview.style.height   = '200px';
        };
        reader.readAsDataURL(file);
    }

    async subirImagen(file) {
        const formData = new FormData();
        formData.append('image', file);

        try {
            const res = await fetch(`${this.apiBase}/alumnos/upload`, {
                method:      'POST',
                credentials: 'include',
                body:        formData,
            });

            if (res.status === 401) { window.location.href = '/login.html'; return null; }

            const data = await res.json();
            if (!data.success || !data.url) {
                this.alerta(data.message || 'Error al subir la imagen');
                return null;
            }
            return data.url;
        } catch (e) {
            this.alerta('Error de conexión al subir imagen');
            return null;
        }
    }

    quitarFoto() {
        this.selectedFile  = null;
        this.currentImgUrl = null;
        if (this.dom.previewImg)   { this.dom.previewImg.src = ''; this.dom.previewImg.style.display = 'none'; }
        if (this.dom.noPhotoMsg)   this.dom.noPhotoMsg.style.display    = 'block';
        if (this.dom.btnRemovePhoto) this.dom.btnRemovePhoto.style.display = 'none';
        if (this.dom.formFoto)     this.dom.formFoto.value              = '';
        if (this.dom.photoPreview) this.dom.photoPreview.style.height   = '150px';
    }

    // ─────────────────────────────────────────────────────────
    // HORARIO DINÁMICO
    // ─────────────────────────────────────────────────────────
    agregarFilaHorario(datos = null) {
        if (!this.dom.horarioDiv) return;

        const div = document.createElement('div');
        div.className = 'fila-horario';

        // Construir opciones de materias dinámicamente desde BD
        const opcionesMaterias = this.materias.length
            ? this.materias.map(m => {
                const sel = datos?.materia === m.nombre_materia ? 'selected' : '';
                return `<option value="${m.nombre_materia}" ${sel}>${m.nombre_materia}</option>`;
              }).join('')
            : `<option value="${datos?.materia || ''}">${datos?.materia || 'Sin materias'}</option>`;

        const diaVal    = datos?.dia    || 'lunes';
        const inicioVal = datos?.inicio ? datos.inicio.substring(0,5) : '07:00';
        const finVal    = datos?.fin    ? datos.fin.substring(0,5)    : '08:30';

        div.innerHTML = `
            <select class="input-dia">
                ${['lunes','martes','miércoles','jueves','viernes','sábado'].map(d =>
                    `<option value="${d}" ${diaVal === d ? 'selected' : ''}>${d.charAt(0).toUpperCase()+d.slice(1)}</option>`
                ).join('')}
            </select>
            <input type="time" class="input-inicio" value="${inicioVal}">
            <input type="time" class="input-fin"    value="${finVal}">
            <select class="input-materia">
                <option value="">— Materia —</option>
                ${opcionesMaterias}
            </select>
            <button type="button" class="btn-eliminar-fila">×</button>
        `;

        div.querySelector('.btn-eliminar-fila')
           .addEventListener('click', () => div.remove());

        this.dom.horarioDiv.appendChild(div);
    }

    recolectarHorario() {
        const filas = document.querySelectorAll('.fila-horario');
        const resultado = [];

        filas.forEach(fila => {
            const materia = fila.querySelector('.input-materia')?.value?.trim();
            const dia     = fila.querySelector('.input-dia')?.value;
            const inicio  = fila.querySelector('.input-inicio')?.value;
            const fin     = fila.querySelector('.input-fin')?.value;

            if (!materia || !dia || !inicio || !fin) return;

            // Asegurar formato HH:mm:ss
            const fmt = t => t.length === 5 ? `${t}:00` : t;

            resultado.push({ dia, inicio: fmt(inicio), fin: fmt(fin), materia });
        });

        return resultado;
    }

    // ─────────────────────────────────────────────────────────
    // MODOS DE FORMULARIO
    // ─────────────────────────────────────────────────────────
    modoCrear() {
        this.currentBoleta = null;
        this.selectedFile  = null;
        this.currentImgUrl = null;

        this.dom.studentForm?.reset();
        this.quitarFoto();

        if (this.dom.formBoleta)    this.dom.formBoleta.readOnly = false;
        if (this.dom.formTitle)     this.dom.formTitle.textContent     = 'Registrar Nuevo Alumno';
        if (this.dom.fieldsetLegend) this.dom.fieldsetLegend.textContent = 'Datos del Alumno';
        if (this.dom.btnGuardar) {
            this.dom.btnGuardar.textContent = 'Registrar Alumno';
            this.dom.btnGuardar.disabled    = false;
        }
        if (this.dom.btnEliminar) this.dom.btnEliminar.style.display = 'none';

        if (this.dom.horarioDiv) {
            this.dom.horarioDiv.innerHTML = '';
            this.agregarFilaHorario();
        }

        if (this.dom.searchBoleta) this.dom.searchBoleta.value = '';
    }

    modoEditar() {
        if (this.dom.formTitle)     this.dom.formTitle.textContent     = 'Modificar Alumno';
        if (this.dom.fieldsetLegend) this.dom.fieldsetLegend.textContent = 'Modificar Datos';
        if (this.dom.btnGuardar) {
            this.dom.btnGuardar.textContent = 'Guardar Cambios';
            this.dom.btnGuardar.disabled    = false;
        }
        if (this.dom.btnEliminar) this.dom.btnEliminar.style.display = 'inline-block';
    }

    // ─────────────────────────────────────────────────────────
    // HELPERS
    // ─────────────────────────────────────────────────────────
    setBotonGuardar(loading) {
        if (!this.dom.btnGuardar) return;
        this.dom.btnGuardar.disabled    = loading;
        this.dom.btnGuardar.textContent = loading
            ? 'Guardando...'
            : (this.currentBoleta ? 'Guardar Cambios' : 'Registrar Alumno');
    }

    alerta(msg) { alert(`⚠️ ${msg}`); }
}

// Inicializar
document.addEventListener('DOMContentLoaded', () => {
    try { new GestionAlumnos(); }
    catch (e) { console.error('Error inicializando GestionAlumnos:', e); }
});