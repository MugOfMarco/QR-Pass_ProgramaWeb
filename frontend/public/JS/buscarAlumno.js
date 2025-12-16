class SistemaAlumnos {
    constructor() {
        this.apiBase = '/api';
        this.alumnoActual = null;
        this.incidencias = [];
        this.initEventListeners();
    }

    initEventListeners() {
        // Buscar alumno por boleta
        const searchInput = document.getElementById('search-boleta-inc');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.buscarAlumno(e.target.value);
            });
        }

        // Botones de justificación
        const btnJustSelec = document.getElementById('btn-justselec');
        const btnJustRet = document.getElementById('btn-justret');
        const btnJustSin = document.getElementById('btn-justsin');
        const btnJustAll = document.getElementById('btn-justall');

        if (btnJustSelec) btnJustSelec.addEventListener('click', () => this.justificarSeleccionadas());
        if (btnJustRet) btnJustRet.addEventListener('click', () => this.justificarTodasRetardos());
        if (btnJustSin) btnJustSin.addEventListener('click', () => this.justificarTodasSinCredencial());
        if (btnJustAll) btnJustAll.addEventListener('click', () => this.justificarTodas());

        // Botones de credencial
        const btnBloquear = document.getElementById('btn-bloquear-credencial');
        const btnDesbloquear = document.getElementById('btn-desbloquear-credencial');

        if (btnBloquear) btnBloquear.addEventListener('click', () => this.bloquearCredencial());
        if (btnDesbloquear) btnDesbloquear.addEventListener('click', () => this.desbloquearCredencial());

        // Menú navegación
        const menuBtn = document.getElementById('menu-toggle-btn');
        const overlay = document.getElementById('menu-overlay');

        if (menuBtn) menuBtn.addEventListener('click', () => this.toggleMenu());
        if (overlay) overlay.addEventListener('click', () => this.closeMenu());
    }

    async buscarAlumno(boletaInput) {
        const boleta = String(boletaInput).trim();
    
        if (boleta.length < 10) {
            this.limpiarDatos();
            return;
        }

        try {
            const response = await fetch(`${this.apiBase}/alumnos/${boleta}`);
            
            if (!response.ok) {
                throw new Error(`Error HTTP: ${response.status}`);
            }
            
            const data = await response.json();
            
            if (data.success) {
                this.alumnoActual = data.alumno;
                this.mostrarDatosAlumno();
                this.mostrarHorario(data.horario);
                await this.cargarIncidencias(boleta);
                // Cargar la foto del alumno
                this.mostrarFotoAlumno(data.alumno);
            } else {
                this.mostrarError('Alumno no encontrado');
                this.limpiarDatos();
            }
        } catch (error) {
            console.error('Error:', error);
            this.mostrarError('Error de conexión: ' + error.message);
            this.limpiarDatos();
        }
    }

    mostrarFotoAlumno(alumno) {
        const fotoElement = document.getElementById('student-photo');
        const photoBox = document.querySelector('.photo-box');
        
        if (!fotoElement || !photoBox) return;

        if (alumno && alumno.url) {
            fotoElement.src = alumno.url;
            fotoElement.alt = `Foto de ${alumno.nombre}`;
            fotoElement.style.display = 'block';
            
            // Agregar clase si está bloqueado
            if (alumno.bloqueado) {
                fotoElement.classList.add('bloqueado');
                photoBox.style.borderColor = '#dc3545';
            } else {
                fotoElement.classList.remove('bloqueado');
                photoBox.style.borderColor = '#dee2e6';
            }
            
            // Manejar error de imagen
            fotoElement.onerror = () => {
                fotoElement.src = 'https://res.cloudinary.com/depoh32sv/image/upload/v1765350850/default_avatar.jpg';
                fotoElement.style.display = 'block';
            };
        } else {
            fotoElement.src = '';
            fotoElement.style.display = 'none';
            fotoElement.classList.remove('bloqueado');
            if (photoBox) {
                photoBox.style.borderColor = '#dee2e6';
            }
        }
    }

    mostrarDatosAlumno() {
        if (!this.alumnoActual) return;

        // Datos básicos
        document.getElementById('display-boleta').value = this.alumnoActual.boleta || '';
        document.getElementById('display-alumno').value = this.alumnoActual.nombre || '';
        document.getElementById('display-grupo').value = this.alumnoActual.nombre_grupo || '';
        
        // Mostrar contadores
        document.getElementById('total-incidencias').textContent = this.alumnoActual.sin_credencial || '0';
        document.getElementById('total-retardos').textContent = this.alumnoActual.retardos || '0';
        
        // Estado de credencial
        this.actualizarEstadoCredencial();
    }

    mostrarHorario(horario) {
        const tbody = document.getElementById('horario-tbody');
        
        if (!horario || horario.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="3" style="text-align: center; padding: 1rem;">
                        No hay horario disponible
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = '';
        
        // Ordenar por día y hora
        const diasOrden = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes'];
        const horarioOrdenado = horario.sort((a, b) => {
            const diaA = diasOrden.indexOf(a.dia);
            const diaB = diasOrden.indexOf(b.dia);
            if (diaA !== diaB) return diaA - diaB;
            return a.hora - b.hora;
        });

        horarioOrdenado.forEach(clase => {
            const tr = document.createElement('tr');
            tr.className = `dia-${clase.dia}`;
            
            // Formatear hora
            const horaInicio = clase.inicio.substring(0, 5);
            const horaFin = clase.fin.substring(0, 5);
            
            tr.innerHTML = `
                <td>${this.capitalizeFirstLetter(clase.dia)}</td>
                <td>${horaInicio} - ${horaFin}</td>
                <td>${clase.materia}</td>
            `;
            
            tbody.appendChild(tr);
        });
    }

    capitalizeFirstLetter(string) {
        return string.charAt(0).toUpperCase() + string.slice(1);
    }

    async cargarFotoAlumno(boleta) {
        try {
            const response = await fetch(`${this.apiBase}/alumnos/foto/${boleta}`);
            if (response.ok) {
                const data = await response.json();
                if (data.success && data.foto) {
                    const img = document.getElementById('student-photo');
                    if (img) {
                        img.src = data.foto;
                        img.style.display = 'block';
                    }
                }
            }
        } catch (error) {
            console.log('No se pudo cargar la foto del alumno');
        }
    }

    limpiarDatos() {
        // Limpiar campos
        document.getElementById('display-boleta').value = '';
        document.getElementById('display-alumno').value = '';
        document.getElementById('display-grupo').value = '';
        
        // Limpiar contadores
        document.getElementById('total-incidencias').textContent = '0';
        document.getElementById('total-retardos').textContent = '0';
        
        // Limpiar tablas
        const horarioTbody = document.getElementById('horario-tbody');
        if (horarioTbody) horarioTbody.innerHTML = `
            <tr>
                <td colspan="3" style="text-align: center; padding: 1rem;">
                    Ingrese una boleta para cargar el horario
                </td>
            </tr>
        `;
        
        const incidentsTbody = document.getElementById('incidents-tbody');
        if (incidentsTbody) incidentsTbody.innerHTML = `
            <tr>
                <td colspan="4" style="text-align: center; padding: 2rem;">
                    Ingrese una boleta para buscar
                </td>
            </tr>
        `;
        
        // Limpiar foto
        const img = document.getElementById('student-photo');
        if (img) {
            img.src = '';
            img.style.display = 'none';
        }
        
        // Limpiar estado de credencial
        this.limpiarEstadoCredencial();
        
        const fotoElement = document.getElementById('student-photo');
        if (fotoElement) {
            fotoElement.src = '';
            fotoElement.style.display = 'none';
            fotoElement.classList.remove('bloqueado');
        }
        
        this.alumnoActual = null;
        this.incidencias = [];
    }

    actualizarEstadoCredencial() {
        if (!this.alumnoActual) return;
        
        const bloqueado = this.alumnoActual.bloqueado || false;
        const estadoElement = document.getElementById('estado-credencial');
        
        if (estadoElement) {
            estadoElement.textContent = bloqueado ? 'BLOQUEADA' : 'ACTIVA';
            estadoElement.className = bloqueado ? 'estado-bloqueada' : 'estado-activa';
        }
    }

    limpiarEstadoCredencial() {
        const estadoElement = document.getElementById('estado-credencial');
        if (estadoElement) {
            estadoElement.textContent = '-';
            estadoElement.className = '';
        }
    }

  async cargarIncidencias(boleta) {
    try {
        console.log('🔍 Cargando incidencias para boleta:', boleta);
        
        const response = await fetch(`${this.apiBase}/alumnos/${boleta}/registros`);
        
        if (!response.ok) {
            throw new Error(`Error HTTP: ${response.status}`);
        }
        
        const data = await response.json();
        
        console.log('📊 Registros recibidos del backend:', data.registros);
        
        if (data.success) {
            this.incidencias = data.registros || [];
            console.log('✅ Incidencias cargadas:', this.incidencias.length);
            console.log('📋 Tipos de incidencias:', this.incidencias.map(i => `ID: ${i.id_registro}, Tipo: ${i.tipo} (${i.id_tipo_registro})`));
            this.mostrarIncidencias();
        } else {
            this.mostrarError('No se pudieron cargar las incidencias');
            this.incidencias = [];
            this.mostrarIncidencias();
        }
    } catch (error) {
        console.error('Error cargando incidencias:', error);
        this.mostrarError('Error al cargar incidencias');
        this.incidencias = [];
        this.mostrarIncidencias();
    }
}

    mostrarIncidencias() {
        const tbody = document.getElementById('incidents-tbody');
        if (!tbody) return;
        
        tbody.innerHTML = '';

        if (this.incidencias.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="4" style="text-align: center; padding: 2rem;">No se encontraron registros</td>
                </tr>
            `;
            return;
        }

        this.incidencias.forEach((incidencia) => {
            const tr = document.createElement('tr');
            tr.dataset.idRegistro = incidencia.id_registro;
            
            // Formatear fecha y hora
            const fecha = new Date(incidencia.fecha);
            const fechaFormateada = fecha.toLocaleDateString('es-MX');
            const horaFormateada = fecha.toLocaleTimeString('es-MX', { 
                hour: '2-digit', 
                minute: '2-digit'
            });

            tr.innerHTML = `
                <td>
                    <input type="checkbox" class="incidencia-checkbox" data-id="${incidencia.id_registro}">
                    ${this.formatearNombrePuerta(incidencia.puerta)}
                </td>
                <td>${fechaFormateada}</td>
                <td>${horaFormateada}</td>
                <td class="tipo-${incidencia.tipo}">${this.formatearTipoIncidencia(incidencia.tipo)}</td>
            `;

            tbody.appendChild(tr);
        });
    }

    formatearNombrePuerta(puertaValue) {
        const puertas = {
            'mexico-tacuba': 'México-Tacuba',
            'mar': 'Mar Mediterráneo',
            'entrada_principal': 'Entrada Principal'
        };
        return puertas[puertaValue] || puertaValue;
    }

    formatearTipoIncidencia(tipo) {
    const tipos = {
        'retardo': 'Retardo',
        // Cambiar esta línea si usas 'sin_credencial' como clave en el JS
        'sin_credencial': 'Sin credencial', 
        'entrada': 'Entrada normal',
        'salida': 'Salida'
    };
    return tipos[tipo] || tipo;
}

    obtenerIncidenciasSeleccionadas() {
        const checkboxes = document.querySelectorAll('.incidencia-checkbox:checked');
        return Array.from(checkboxes).map(checkbox => {
            const idRegistro = parseInt(checkbox.dataset.id);
            return this.incidencias.find(inc => inc.id_registro === idRegistro);
        }).filter(inc => inc !== undefined);
    }

    async justificarSeleccionadas() {
        const incidenciasSeleccionadas = this.obtenerIncidenciasSeleccionadas();
        
        if (incidenciasSeleccionadas.length === 0) {
            this.mostrarError('Selecciona al menos una incidencia para justificar');
            return;
        }

        const justificacion = document.getElementById('item-selector').value;
        if (!justificacion || justificacion === 'item1') {
            this.mostrarError('Selecciona una justificación válida');
            return;
        }

        await this.procesarJustificacion(incidenciasSeleccionadas, justificacion);
    }

    async justificarTodasRetardos() {
        const incidenciasRetardo = this.incidencias.filter(inc => 
            inc.tipo === 'retardo'
        );
        
        if (incidenciasRetardo.length === 0) {
            this.mostrarError('No hay incidencias de retardo para justificar');
            return;
        }

        const justificacion = document.getElementById('item-selector').value;
        if (!justificacion || justificacion === 'item1') {
            this.mostrarError('Selecciona una justificación válida');
            return;
        }

        await this.procesarJustificacion(incidenciasRetardo, justificacion);
    }

    async justificarTodasSinCredencial() {
        const incidenciasSinCredencial = this.incidencias.filter(inc => 
            inc.tipo === 'sin_credencial'
        );
        
        if (incidenciasSinCredencial.length === 0) {
            this.mostrarError('No hay incidencias sin credencial para justificar');
            return;
        }

        const justificacion = document.getElementById('item-selector').value;
        if (!justificacion || justificacion === 'item1') {
            this.mostrarError('Selecciona una justificación válida');
            return;
        }

        await this.procesarJustificacion(incidenciasSinCredencial, justificacion);
    }

    async justificarTodas() {
        if (this.incidencias.length === 0) {
            this.mostrarError('No hay incidencias para justificar');
            return;
        }

        const justificacion = document.getElementById('item-selector').value;
        if (!justificacion || justificacion === 'item1') {
            this.mostrarError('Selecciona una justificación válida');
            return;
        }

        await this.procesarJustificacion(this.incidencias, justificacion);
    }

    async procesarJustificacion(incidencias, justificacion) {
    try {
        const justificacionTexto = this.obtenerTextoJustificacion(justificacion);
        
        for (const incidencia of incidencias) {
            if (incidencia.tipo !== 'retardo' && incidencia.tipo !== 'sin_credencial') {
                continue;
            }
            
            const idTipoAnterior = this.obtenerIdTipoAnterior(incidencia.tipo);
            
            // 🔍 LOG CRÍTICO: Ver qué datos se están envi
            
            const response = await fetch(`${this.apiBase}/alumnos/justificaciones`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id_registro: incidencia.id_registro,
                    justificacion: justificacionTexto,
                    id_tipo_anterior: idTipoAnterior
                })
            });
            
            const result = await response.json();
            console.log('📥 RESPUESTA BACKEND:', result);
        }

        this.mostrarExito(`Se justificaron ${incidencias.length} incidencia(s) correctamente`);
        
        await new Promise(resolve => setTimeout(resolve, 500));
        await this.buscarAlumno(String(this.alumnoActual.boleta));
        
    } catch (error) {
        console.error('Error justificando incidencias:', error);
        this.mostrarError('Error al justificar incidencias: ' + error.message);
    }
}

    // ✅ Modificación en buscarAlumno.js

obtenerIdTipoAnterior(tipoIncidencia) {
    // Los valores provienen del campo 'tipo' de la BD
    const tipos = {
        'retardo': 2,
        'sin_credencial': 3 // CORREGIDO: Usar el valor exacto de la columna 'tipo'
    };
    
    // Si tipoIncidencia es 'sin_credencial', ahora mapea correctamente a 3.
    const id = tipos[tipoIncidencia] || 2; 
    return id;
}

    obtenerTextoJustificacion(valor) {
        const justificaciones = {
            'item2': 'Se habló con el tutor/a',
            'item3': 'Se habló con el estudiante',
            'item4': 'Error en el registro',
            'item5': 'Actividad escolar',
            'item6': 'Problema de salud'
        };
        return justificaciones[valor] || valor;
    }

    async bloquearCredencial() {
    if (!this.alumnoActual) {
        this.mostrarError('Primero busca un alumno');
        return;
    }

    if (!confirm(`¿Estás seguro de bloquear la credencial de ${this.alumnoActual.nombre}?`)) {
        return;
    }

    try {
        const response = await fetch(`${this.apiBase}/alumnos/bloquear/${this.alumnoActual.boleta}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        const data = await response.json();
        
        if (data.success) {
            this.mostrarExito('Credencial bloqueada exitosamente');
            // Actualizar estado local
            this.alumnoActual.bloqueado = true;
            this.actualizarEstadoCredencial();
            
            // Recargar datos para ver cambios
            await this.buscarAlumno(this.alumnoActual.boleta);
        } else {
            this.mostrarError(data.message);
        }
    } catch (error) {
        console.error('Error bloqueando credencial:', error);
        this.mostrarError('Error al bloquear credencial');
    }
}

async desbloquearCredencial() {
    if (!this.alumnoActual) {
        this.mostrarError('Primero busca un alumno');
        return;
    }

    if (!confirm(`¿Estás seguro de desbloquear la credencial de ${this.alumnoActual.nombre}?`)) {
        return;
    }

    try {
        const response = await fetch(`${this.apiBase}/alumnos/desbloquear/${this.alumnoActual.boleta}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        const data = await response.json();
        
        if (data.success) {
            this.mostrarExito('Credencial desbloqueada exitosamente');
            // Actualizar estado local
            this.alumnoActual.bloqueado = false;
            this.actualizarEstadoCredencial();
            
            // Recargar datos para ver cambios
            await this.buscarAlumno(this.alumnoActual.boleta);
        } else {
            this.mostrarError(data.message);
        }
    } catch (error) {
        console.error('Error desbloqueando credencial:', error);
        this.mostrarError('Error al desbloquear credencial');
    }
}

    mostrarExito(mensaje) {
        this.mostrarNotificacion(mensaje, 'success');
    }

    mostrarError(mensaje) {
        this.mostrarNotificacion(mensaje, 'error');
    }

    mostrarNotificacion(mensaje, tipo) {
        const notification = document.createElement('div');
        notification.className = `notification ${tipo}`;
        notification.textContent = mensaje;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 20px;
            border-radius: 5px;
            color: white;
            font-weight: bold;
            z-index: 1000;
            background-color: ${tipo === 'success' ? '#4CAF50' : '#f44336'};
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        `;

        document.body.appendChild(notification);

        setTimeout(() => {
            notification.remove();
        }, 3000);
    }

    toggleMenu() {
        const lista = document.getElementById('lista-opciones');
        const overlay = document.getElementById('menu-overlay');
        
        if (lista && overlay) {
            lista.classList.toggle('menu-visible');
            overlay.classList.toggle('menu-visible');
        }
    }

    closeMenu() {
        const lista = document.getElementById('lista-opciones');
        const overlay = document.getElementById('menu-overlay');
        
        if (lista && overlay) {
            lista.classList.remove('menu-visible');
            overlay.classList.remove('menu-visible');
        }
    }
}

// Inicializar sistema
document.addEventListener('DOMContentLoaded', () => {
    new SistemaAlumnos();
});