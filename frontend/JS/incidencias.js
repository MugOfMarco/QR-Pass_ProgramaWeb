class IncidenciasSystem {
    constructor() {
        this.apiBase = 'http://localhost:3000/api';
        this.alumnoActual = null;
        this.incidencias = [];
        this.initEventListeners();
    }

    initEventListeners() {
        // Buscar alumno por boleta
        document.getElementById('search-boleta-inc').addEventListener('input', (e) => {
            this.buscarAlumno(e.target.value);
        });

        // Botones de justificación
        document.getElementById('btn-justselec').addEventListener('click', () => {
            this.justificarSeleccionadas();
        });

        document.getElementById('btn-justret').addEventListener('click', () => {
            this.justificarTodasRetardos();
        });

        document.getElementById('btn-justsin').addEventListener('click', () => {
            this.justificarTodasSinCredencial();
        });

        document.getElementById('btn-justall').addEventListener('click', () => {
            this.justificarTodas();
        });

        // Menú navegación
        document.getElementById('menu-toggle-btn').addEventListener('click', () => {
            this.toggleMenu();
        });

        document.getElementById('menu-overlay').addEventListener('click', () => {
            this.closeMenu();
        });
    }

    async buscarAlumno(boletaInput) {
        const boleta = boletaInput.trim();
        if (boleta.length < 10) return;

        try {
            const response = await fetch(`${this.apiBase}/horarios/alumno/${boleta}`);
            
            if (!response.ok) {
                throw new Error(`Error HTTP: ${response.status}`);
            }
            
            const data = await response.json();
            
            if (data.success) {
                this.alumnoActual = data.alumno;
                this.mostrarDatosAlumno();
                await this.cargarIncidencias(boleta);
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

    mostrarDatosAlumno() {
        if (!this.alumnoActual) return;

        document.getElementById('display-boleta').value = this.alumnoActual.Boleta;
        document.getElementById('display-alumno').value = this.alumnoActual.Nombre;
        document.getElementById('display-grupo').value = this.alumnoActual.Grupo;
    }

    limpiarDatos() {
        document.getElementById('display-boleta').value = '';
        document.getElementById('display-alumno').value = '';
        document.getElementById('display-grupo').value = '';
        
        const tbody = document.querySelector('.incidents-table tbody');
        tbody.innerHTML = '';
        
        this.alumnoActual = null;
        this.incidencias = [];
    }

    async cargarIncidencias(boleta) {
        try {
            const response = await fetch(`${this.apiBase}/incidencias/alumno/${boleta}`);
            
            if (!response.ok) {
                throw new Error(`Error HTTP: ${response.status}`);
            }
            
            const data = await response.json();
            
            if (data.success) {
                this.incidencias = data.incidencias;
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
        const tbody = document.querySelector('.incidents-table tbody');
        tbody.innerHTML = '';

        if (this.incidencias.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="3" style="text-align: center;">No se encontraron incidencias</td>
                </tr>
            `;
            return;
        }

        this.incidencias.forEach((incidencia, index) => {
            const tr = document.createElement('tr');
            tr.dataset.idRegistro = incidencia.id_registro;
            tr.dataset.index = index;
            
            // Formatear fecha
            const fecha = new Date(incidencia.Registro);
            const fechaFormateada = fecha.toLocaleDateString('es-MX');
            const horaFormateada = fecha.toLocaleTimeString('es-MX', { 
                hour: '2-digit', 
                minute: '2-digit' 
            });

            // Determinar tipo de incidencia
            let tipoIncidencia = 'Entrada normal';
            let claseTipo = '';

            if (incidencia.tipo === 'retardo') {
                tipoIncidencia = 'Retardo';
                claseTipo = 'tipo-retardo';
            } else if (incidencia.tipo === 'sin_credencial') {
                tipoIncidencia = 'Sin credencial';
                claseTipo = 'tipo-sin-credencial';
            } else if (incidencia.tipo === 'retardo_sin_credencial') {
                tipoIncidencia = 'Retardo sin credencial';
                claseTipo = 'tipo-retardo-sin-credencial';
            }

            tr.innerHTML = `
                <td>
                    <input type="checkbox" class="incidencia-checkbox" data-id="${incidencia.id_registro}">
                    ${this.formatearNombrePuerta(incidencia.Puerta)}
                </td>
                <td>${fechaFormateada} ${horaFormateada}</td>
                <td class="${claseTipo}">${tipoIncidencia}</td>
            `;

            tbody.appendChild(tr);
        });
    }

    formatearNombrePuerta(puertaValue) {
        const puertas = {
            'mexico-tacuba': 'México-Tacuba',
            'mar': 'Mar-Mediterráneo'
        };
        return puertas[puertaValue] || puertaValue;
    }

    // Obtener incidencias seleccionadas
    obtenerIncidenciasSeleccionadas() {
        const checkboxes = document.querySelectorAll('.incidencia-checkbox:checked');
        return Array.from(checkboxes).map(checkbox => {
            const idRegistro = parseInt(checkbox.dataset.id);
            return this.incidencias.find(inc => inc.id_registro === idRegistro);
        }).filter(inc => inc !== undefined);
    }

    // Justificar incidencias seleccionadas
    async justificarSeleccionadas() {
        const incidenciasSeleccionadas = this.obtenerIncidenciasSeleccionadas();
        
        if (incidenciasSeleccionadas.length === 0) {
            this.mostrarError('Selecciona al menos una incidencia para justificar');
            return;
        }

        const justificacion = document.getElementById('item-selector').value;
        if (justificacion === 'item1') {
            this.mostrarError('Selecciona una justificación válida');
            return;
        }

        await this.procesarJustificacion(incidenciasSeleccionadas, justificacion);
    }

    // Justificar todas las de retardo
    async justificarTodasRetardos() {
        const incidenciasRetardo = this.incidencias.filter(inc => 
            inc.tipo === 'retardo' || inc.tipo === 'retardo_sin_credencial'
        );
        
        if (incidenciasRetardo.length === 0) {
            this.mostrarError('No hay incidencias de retardo para justificar');
            return;
        }

        const justificacion = document.getElementById('item-selector').value;
        if (justificacion === 'item1') {
            this.mostrarError('Selecciona una justificación válida');
            return;
        }

        await this.procesarJustificacion(incidenciasRetardo, justificacion);
    }

    // Justificar todas las de sin credencial
    async justificarTodasSinCredencial() {
        const incidenciasSinCredencial = this.incidencias.filter(inc => 
            inc.tipo === 'sin_credencial' || inc.tipo === 'retardo_sin_credencial'
        );
        
        if (incidenciasSinCredencial.length === 0) {
            this.mostrarError('No hay incidencias sin credencial para justificar');
            return;
        }

        const justificacion = document.getElementById('item-selector').value;
        if (justificacion === 'item1') {
            this.mostrarError('Selecciona una justificación válida');
            return;
        }

        await this.procesarJustificacion(incidenciasSinCredencial, justificacion);
    }

    // Justificar todas las incidencias
    async justificarTodas() {
        if (this.incidencias.length === 0) {
            this.mostrarError('No hay incidencias para justificar');
            return;
        }

        const justificacion = document.getElementById('item-selector').value;
        if (justificacion === 'item1') {
            this.mostrarError('Selecciona una justificación válida');
            return;
        }

        await this.procesarJustificacion(this.incidencias, justificacion);
    }

    async procesarJustificacion(incidencias, justificacion) {
    try {
        const justificacionTexto = this.obtenerTextoJustificacion(justificacion);
        
        for (const incidencia of incidencias) {
            // ✅ SOLO crear el reporte, NO actualizar contadores
            await this.crearReporte(incidencia, justificacionTexto);
        }

        this.mostrarExito(`Se justificaron ${incidencias.length} incidencia(s) correctamente`);
        
        // Recargar incidencias (las justificadas ya no aparecerán)
        await this.cargarIncidencias(this.alumnoActual.Boleta);
        
    } catch (error) {
        console.error('Error justificando incidencias:', error);
        this.mostrarError('Error al justificar incidencias: ' + error.message);
    }
}

    async crearReporte(incidencia, justificacion) {
        const response = await fetch(`${this.apiBase}/reportes`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id_registro: incidencia.id_registro,
                tipo_incidencia: incidencia.tipo,
                fecha_incidencia: incidencia.Registro,
                justificacion: justificacion,
                fecha_reporte: new Date().toISOString()
            })
        });

        const result = await response.json();
        
        if (!result.success) {
            throw new Error(result.message);
        }

        return result;
    }

    obtenerTextoJustificacion(valor) {
        const justificaciones = {
            'item2': 'Se habló con el tutor/a',
            'item3': 'Se habló con el estudiante',
            'item4': 'Error en el registro'
        };
        return justificaciones[valor] || valor;
    }

    mostrarExito(mensaje) {
        this.mostrarEstado(mensaje, 'success');
    }

    mostrarError(mensaje) {
        this.mostrarEstado(mensaje, 'error');
    }

    mostrarEstado(mensaje, tipo) {
        // Crear notificación temporal
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
        `;

        document.body.appendChild(notification);

        setTimeout(() => {
            notification.remove();
        }, 3000);
    }

    toggleMenu() {
        const menu = document.querySelector('.menu-navegacion');
        const overlay = document.getElementById('menu-overlay');
        
        menu.classList.toggle('active');
        overlay.classList.toggle('active');
    }

    closeMenu() {
        const menu = document.querySelector('.menu-navegacion');
        const overlay = document.getElementById('menu-overlay');
        
        menu.classList.remove('active');
        overlay.classList.remove('active');
    }
}

// Inicializar sistema
document.addEventListener('DOMContentLoaded', () => {
    new IncidenciasSystem();
});