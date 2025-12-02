class SistemaAlumnos {
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
            // Usar tu stored procedure para obtener datos completos
            const response = await fetch(`${this.apiBase}/alumno/${boleta}`);
            
            if (!response.ok) {
                throw new Error(`Error HTTP: ${response.status}`);
            }
            
            const data = await response.json();
            
            if (data.success) {
                this.alumnoActual = data.alumno;
                this.mostrarDatosAlumno();
                this.mostrarHorario(data.horario);
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
        document.getElementById('display-boleta').value = this.alumnoActual.boleta || '';
        document.getElementById('display-alumno').value = this.alumnoActual.nombre || '';
        document.getElementById('display-grupo').value = this.alumnoActual.nombre_grupo || '';
        
        // Mostrar contadores
        document.getElementById('total-incidencias').textContent = this.alumnoActual.sin_credencial || '0';
        document.getElementById('total-retardos').textContent = this.alumnoActual.retardos || '0';
        
        // Estado de credencial
        this.actualizarEstadoCredencial();
    }

    // En tu clase SistemaAlumnos, actualiza el método mostrarHorario:
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
        
        // Formatear hora (quitar segundos si existen)
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

    formatearHorario(horario) {
        // Agrupar por día
        const horarioPorDia = {};
        horario.forEach(clase => {
            if (!horarioPorDia[clase.dia]) {
                horarioPorDia[clase.dia] = [];
            }
            horarioPorDia[clase.dia].push(clase);
        });

        // Formatear texto
        let texto = '';
        const dias = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes'];
        
        dias.forEach(dia => {
            if (horarioPorDia[dia]) {
                texto += `${dia.charAt(0).toUpperCase() + dia.slice(1)}:\n`;
                horarioPorDia[dia].forEach(clase => {
                    texto += `  ${clase.inicio} - ${clase.fin} | ${clase.materia}\n`;
                });
                texto += '\n';
            }
        });

        return texto.trim();
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
        
        // Limpiar estado de credencial
        this.limpiarEstadoCredencial();
        
        this.alumnoActual = null;
        this.incidencias = [];
    }

    actualizarEstadoCredencial() {
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
            estadoElement.textContent = '';
            estadoElement.className = '';
        }
    }

    async cargarIncidencias(boleta) {
        try {
            // Usar tu stored procedure para obtener incidencias
            const response = await fetch(`${this.apiBase}/incidencias/alumno/${boleta}`);
            
            if (!response.ok) {
                throw new Error(`Error HTTP: ${response.status}`);
            }
            
            const data = await response.json();
            
            if (data.success) {
                this.incidencias = data.incidencias || [];
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
                    <td colspan="4" style="text-align: center; padding: 2rem;">No se encontraron incidencias</td>
                </tr>
            `;
            return;
        }

        this.incidencias.forEach((incidencia) => {
            const tr = document.createElement('tr');
            tr.dataset.idRegistro = incidencia.id_registro;
            
            // Formatear fecha (ajustar por la diferencia de hora de México)
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
            'mar-mediterraneo': 'Mar Mediterráneo',
            'entrada_principal': 'Entrada Principal'
        };
        return puertas[puertaValue] || puertaValue;
    }

    formatearTipoIncidencia(tipo) {
        const tipos = {
            'retardo': 'Retardo',
            'entrada_sin_credencial': 'Sin credencial',
            'entrada': 'Entrada normal'
        };
        return tipos[tipo] || tipo;
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
            inc.tipo === 'entrada_sin_credencial'
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
                // Obtener id_tipo_anterior según el tipo de incidencia
                const idTipoAnterior = this.obtenerIdTipoAnterior(incidencia.tipo);
                
                await this.crearJustificacionBD(
                    incidencia.id_registro, 
                    justificacionTexto, 
                    idTipoAnterior
                );
            }

            this.mostrarExito(`Se justificaron ${incidencias.length} incidencia(s) correctamente`);
            
            // Recargar datos del alumno para actualizar contadores
            await this.buscarAlumno(this.alumnoActual.boleta);
            
        } catch (error) {
            console.error('Error justificando incidencias:', error);
            this.mostrarError('Error al justificar incidencias: ' + error.message);
        }
    }

    obtenerIdTipoAnterior(tipoIncidencia) {
        // Mapear tipos de incidencia a id_tipo_registro
        const tipos = {
            'retardo': 2,  // Asumiendo que 2 = retardo
            'entrada_sin_credencial': 3  // Asumiendo que 3 = entrada_sin_credencial
        };
        return tipos[tipoIncidencia] || 2;
    }

    async crearJustificacionBD(idRegistro, justificacion, idTipoAnterior) {
        const response = await fetch(`${this.apiBase}/justificaciones`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id_registro: idRegistro,
                justificacion: justificacion,
                id_tipo_anterior: idTipoAnterior
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
            'item4': 'Error en el registro',
            'item5': 'Actividad escolar',
            'item6': 'Problema de salud'
        };
        return justificaciones[valor] || valor;
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

// Funcionalidad para bloquear/desbloquear credenciales

// Obtener referencias a los botones
const btnBloquear = document.getElementById('btn-bloquear-credencial');
const btnDesbloquear = document.getElementById('btn-desbloquear-credencial');
const inputBoleta = document.getElementById('search-boleta-inc');
const estadoCredencialSpan = document.getElementById('estado-credencial');

// Variable para almacenar el estado actual de bloqueo
let credencialBloqueada = false;
let boletaActual = null;

// Función para bloquear credencial
btnBloquear.addEventListener('click', async () => {
    const boleta = inputBoleta.value.trim();
    
    if (!boleta) {
        alert('Por favor, ingrese una boleta primero');
        return;
    }
    
    try {
        // Verificar el estado actual
        const responseCheck = await fetch(`/api/verificar-estado-credencial/${boleta}`);
        const dataCheck = await responseCheck.json();
        
        if (dataCheck.bloqueado) {
            alert('La credencial ya está bloqueada');
            return;
        }
        
        // Bloquear la credencial
        const response = await fetch('/api/bloquear-credencial', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ boleta: boleta, bloqueado: 1 })
        });
        
        const data = await response.json();
        
        if (data.success) {
            alert('Credencial bloqueada exitosamente');
            credencialBloqueada = true;
            estadoCredencialSpan.textContent = 'Bloqueada';
            estadoCredencialSpan.style.color = 'red';
        } else {
            alert('Error al bloquear la credencial: ' + data.message);
        }
        
    } catch (error) {
        console.error('Error:', error);
        alert('Error al procesar la solicitud');
    }
});

// Función para desbloquear credencial
btnDesbloquear.addEventListener('click', async () => {
    const boleta = inputBoleta.value.trim();
    
    if (!boleta) {
        alert('Por favor, ingrese una boleta primero');
        return;
    }
    
    try {
        // Verificar el estado actual
        const responseCheck = await fetch(`/api/verificar-estado-credencial/${boleta}`);
        const dataCheck = await responseCheck.json();
        
        if (!dataCheck.bloqueado) {
            alert('La credencial ya está desbloqueada');
            return;
        }
        
        // Desbloquear la credencial
        const response = await fetch('/api/bloquear-credencial', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ boleta: boleta, bloqueado: 0 })
        });
        
        const data = await response.json();
        
        if (data.success) {
            alert('Credencial desbloqueada exitosamente');
            credencialBloqueada = false;
            estadoCredencialSpan.textContent = 'Activa';
            estadoCredencialSpan.style.color = 'green';
        } else {
            alert('Error al desbloquear la credencial: ' + data.message);
        }
        
    } catch (error) {
        console.error('Error:', error);
        alert('Error al procesar la solicitud');
    }
});

// API endpoints que necesitas en tu backend (Node.js/Express ejemplo):

/*
// Endpoint para verificar estado de credencial
app.get('/api/verificar-estado-credencial/:boleta', async (req, res) => {
    const { boleta } = req.params;
    
    try {
        const query = 'SELECT bloqueado FROM Info_alumno WHERE boleta = ?';
        const [results] = await connection.query(query, [boleta]);
        
        if (results.length > 0) {
            res.json({ bloqueado: results[0].bloqueado === 1 });
        } else {
            res.status(404).json({ error: 'Alumno no encontrado' });
        }
    } catch (error) {
        res.status(500).json({ error: 'Error en el servidor' });
    }
});

// Endpoint para bloquear/desbloquear credencial
app.post('/api/bloquear-credencial', async (req, res) => {
    const { boleta, bloqueado } = req.body;
    
    try {
        const query = 'UPDATE Info_alumno SET bloqueado = ? WHERE boleta = ?';
        const [result] = await connection.query(query, [bloqueado, boleta]);
        
        if (result.affectedRows > 0) {
            res.json({ success: true, message: 'Estado actualizado' });
        } else {
            res.status(404).json({ success: false, message: 'Alumno no encontrado' });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error en el servidor' });
    }
});
*/