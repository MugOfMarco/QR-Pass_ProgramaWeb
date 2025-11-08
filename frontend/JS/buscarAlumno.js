class BuscarAlumnoSystem {
    constructor() {
        this.apiBase = 'http://localhost:3000/api';
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
        const boleta = boletaInput.trim();
        if (boleta.length < 10) {
            this.limpiarDatos();
            return;
        }

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
                await this.cargarFotoAlumno(boleta);
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

        // Datos básicos
        document.getElementById('display-boleta').value = this.alumnoActual.Boleta || '';
        document.getElementById('display-alumno').value = this.alumnoActual.Nombre || '';
        document.getElementById('display-grupo').value = this.alumnoActual.Grupo || '';
        
        // Horario
        const horario = this.formatearHorario(this.alumnoActual);
        document.getElementById('display-horario').value = horario;
    }

    formatearHorario(alumno) {
        if (!alumno.HoraEntrada || !alumno.HoraSalida) return 'No disponible';
        
        // Convertir formato de tiempo si es necesario
        const entrada = this.formatearHora(alumno.HoraEntrada);
        const salida = this.formatearHora(alumno.HoraSalida);
        
        return `${entrada} - ${salida}`;
    }

    formatearHora(hora) {
        // Si viene en formato HH:MM:SS, tomar solo HH:MM
        if (typeof hora === 'string') {
            const partes = hora.split(':');
            if (partes.length >= 2) {
                return `${partes[0]}:${partes[1]}`;
            }
        }
        return hora;
    }

    async cargarFotoAlumno(boleta) {
        try {
            const response = await fetch(`${this.apiBase}/alumnos/foto/${boleta}`);
            
            if (response.ok) {
                const data = await response.json();
                
                if (data.success && data.foto) {
                    const img = document.getElementById('student-photo');
                    if (img) {
                        img.src = data.foto; // Asumiendo que la API retorna la URL o base64
                        img.style.display = 'block';
                    }
                }
            }
        } catch (error) {
            console.log('No se pudo cargar la foto del alumno');
            // No mostramos error, simplemente no se muestra la foto
        }
    }

    limpiarDatos() {
        // Limpiar campos
        document.getElementById('display-boleta').value = '';
        document.getElementById('display-alumno').value = '';
        document.getElementById('display-grupo').value = '';
        document.getElementById('display-horario').value = '';
        
        // Limpiar contadores
        document.getElementById('total-incidencias').textContent = '0';
        document.getElementById('total-retardos').textContent = '0';
        
        // Limpiar tabla
        const tbody = document.getElementById('incidents-tbody');
        if (tbody) tbody.innerHTML = '';
        
        // Limpiar foto
        const img = document.getElementById('student-photo');
        if (img) {
            img.src = '';
            img.style.display = 'none';
        }
        
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
                this.incidencias = data.incidencias || [];
                this.actualizarContadores();
                this.mostrarIncidencias();
            } else {
                this.mostrarError('No se pudieron cargar las incidencias');
                this.incidencias = [];
                this.actualizarContadores();
                this.mostrarIncidencias();
            }
        } catch (error) {
            console.error('Error cargando incidencias:', error);
            this.mostrarError('Error al cargar incidencias');
            this.incidencias = [];
            this.actualizarContadores();
            this.mostrarIncidencias();
        }
    }

    actualizarContadores() {
        // Contar total de incidencias (sin credencial)
        const totalSinCredencial = this.incidencias.filter(inc => 
            inc.tipo === 'sin_credencial' || inc.tipo === 'retardo_sin_credencial'
        ).length;
        
        // Contar total de retardos
        const totalRetardos = this.incidencias.filter(inc => 
            inc.tipo === 'retardo' || inc.tipo === 'retardo_sin_credencial'
        ).length;
        
        document.getElementById('total-incidencias').textContent = totalSinCredencial;
        document.getElementById('total-retardos').textContent = totalRetardos;
    }

    mostrarIncidencias() {
        const tbody = document.getElementById('incidents-tbody');
        if (!tbody) return;
        
        tbody.innerHTML = '';

        if (this.incidencias.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="3" style="text-align: center; padding: 2rem;">No se encontraron incidencias</td>
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
                minute: '2-digit',
                second: '2-digit'
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
                await this.crearReporte(incidencia, justificacionTexto);
            }

            this.mostrarExito(`Se justificaron ${incidencias.length} incidencia(s) correctamente`);
            
            // Recargar incidencias
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

    // Bloquear credencial
    async bloquearCredencial() {
        if (!this.alumnoActual) {
            this.mostrarError('Selecciona un alumno primero');
            return;
        }

        if (!confirm(`¿Estás seguro de bloquear la credencial de ${this.alumnoActual.Nombre}?`)) {
            return;
        }

        try {
            const response = await fetch(`${this.apiBase}/alumnos/bloquear/${this.alumnoActual.Boleta}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' }
            });

            const result = await response.json();
            
            if (result.success) {
                this.mostrarExito('Credencial bloqueada correctamente');
            } else {
                this.mostrarError('Error al bloquear credencial');
            }
        } catch (error) {
            console.error('Error:', error);
            this.mostrarError('Error de conexión al bloquear credencial');
        }
    }

    // Desbloquear credencial
    async desbloquearCredencial() {
        if (!this.alumnoActual) {
            this.mostrarError('Selecciona un alumno primero');
            return;
        }

        if (!confirm(`¿Estás seguro de desbloquear la credencial de ${this.alumnoActual.Nombre}?`)) {
            return;
        }

        try {
            const response = await fetch(`${this.apiBase}/alumnos/desbloquear/${this.alumnoActual.Boleta}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' }
            });

            const result = await response.json();
            
            if (result.success) {
                this.mostrarExito('Credencial desbloqueada correctamente');
            } else {
                this.mostrarError('Error al desbloquear credencial');
            }
        } catch (error) {
            console.error('Error:', error);
            this.mostrarError('Error de conexión al desbloquear credencial');
        }
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
    new BuscarAlumnoSystem();
});