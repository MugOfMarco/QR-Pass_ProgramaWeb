// registro.js - VERSIÓN FINAL RESUELTA (con límite de 4 sin credencial)

class RegistroSystem {
    constructor() {
        this.apiBase = 'http://localhost:3000/api';
        this.urlPrefix = 'https://coatl.cecyt9.ipn.mx/app/qr_system/accessprocess.php?boleta=';
        this.initEventListeners();
        
        this.tiposRegistro = {
            'entrada': 0,
            'salida': 1, 
            'retardo': 2,
            'entrada_sin_credencial': 3,
            'justificado': 4
        };

        this.diasSemana = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
    }

    initEventListeners() {
        const boletaInput = document.getElementById('boleta-input');

        if (!boletaInput) {
            console.error('Error: No se encontró el campo id="boleta-input"');
            return;
        }

        boletaInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.keyCode === 13) {
                e.preventDefault();

                let valor = boletaInput.value;
                let tipoEntrada;
                let boletaLimpia;

                if (valor.startsWith(this.urlPrefix)) {
                    boletaLimpia = valor.substring(this.urlPrefix.length).replace(/[^0-9]/g, '');
                    tipoEntrada = 'qr';
                } else {
                    boletaLimpia = valor.replace(/[^0-9]/g, '');
                    tipoEntrada = 'manual';
                }

                requestAnimationFrame(() => {
                    boletaInput.value = boletaLimpia;
                });

                this.handleBoletaInput(boletaLimpia, tipoEntrada);
            }
        });
    }

    async handleBoletaInput(boletaInput, tipoEntrada) {
        const boleta = boletaInput.trim();
        if (boleta.length < 5) return;

        try {
            // Obtener datos del alumno
            const response = await fetch(`${this.apiBase}/alumnos/${boleta}`);

            if (!response.ok) {
                if (response.status === 404) {
                    throw new Error('Alumno no encontrado');
                }
                throw new Error(`Error HTTP: ${response.status}`);
            }

            const data = await response.json();

            if (data.success) {
                // ✅ VALIDACIÓN 1: Verificar bloqueo
                if (data.bloqueado) {
                    this.mostrarError('CREDENCIAL BLOQUEADA - No se puede registrar entrada/salida');
                    document.getElementById('boleta-input').value = '';
                    return;
                }

                // ✅ VALIDACIÓN 2: Verificar 3+ incidencias sin credencial
                if (data.sinCredencial >= 3 && tipoEntrada === 'manual') {
                    this.mostrarError('ACCESO DENEGADO - 3+ incidencias sin credencial');
                    document.getElementById('boleta-input').value = '';
                    return;
                }
                
                await this.procesarRegistro(data, tipoEntrada);
            } else {
                this.mostrarError('Alumno no encontrado');
            }
        } catch (error) {
            console.error('Error:', error);
            this.mostrarError(error.message);
        }
    }

    // =================================================================
    // FUNCIÓN DE PROCESAMIENTO (LÓGICA CONFLICTIVA RESUELTA)
    // =================================================================

    async procesarRegistro(alumnoData, tipoEntrada) {
        try {
            const puertaSeleccionada = document.querySelector('input[name="puerta"]:checked');
            const puerta = puertaSeleccionada ? puertaSeleccionada.value : 'mexico-tacuba';

            const tipoSeleccionado = document.querySelector('input[name="tipo"]:checked');
            const tipo = tipoSeleccionado ? tipoSeleccionado.value : 'entrada';

            const hoy = new Date();
            const diaSemana = hoy.getDay();
            
            // Validar fin de semana
            if (diaSemana === 0 || diaSemana === 6) {
                this.mostrarResultadoFinSemana(alumnoData, puerta, tipo);
                return;
            }

            let idTipoRegistro;
            let tieneRetardo = false;
            let sinCredencial = false;

            // 2. LÓGICA DE INCIDENCIA Y VALIDACIÓN DE LÍMITE (DE AMBAS VERSIONES)
            if (tipo === 'entrada') {
                sinCredencial = tipoEntrada === 'manual';
                tieneRetardo = await this.verificarRetardoConHorario(alumnoData.horario);
                
                // ASIGNACIÓN DE ID (Prioridad: Retardo > Sin Credencial > Normal)
                if (tieneRetardo) {
                    idTipoRegistro = this.tiposRegistro.retardo; // ID 2
                } else if (sinCredencial) {
                    idTipoRegistro = this.tiposRegistro.entrada_sin_credencial; // ID 3
                } else {
                    idTipoRegistro = this.tiposRegistro.entrada;
                }
            } else if (tipo === 'salida') {
                idTipoRegistro = this.tiposRegistro.salida; // ID 1
            }

            await this.crearRegistroBD(
                alumnoData.alumno.boleta,
                puerta,
                idTipoRegistro,
                tieneRetardo,
                sinCredencial
            );

            // 4. Mostrar resultado con advertencia si aplica (Lógica de tu versión)
            this.mostrarResultado(alumnoData, tieneRetardo, sinCredencial, puerta, idTipoRegistro, contadorActual);

        } catch (error) {
            console.error('Error en procesarRegistro:', error);
            this.mostrarError('Error al procesar registro: ' + error.message);
        }
    }

    async verificarRetardoConHorario(horario) {
        const hoy = new Date();
        const diaSemana = hoy.getDay();
        
        // Si es domingo o sábado, no hay retardo
        if (diaSemana === 0 || diaSemana === 6) {
            return false;
        }
        
        const diaActualConAcentos = this.diasSemana[diaSemana];
        const diaActual = diaActualConAcentos
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "");

        const horarioHoy = horario.filter(h => h.dia === diaActual);

        if (horarioHoy.length === 0) {
            return false; // No tiene clases hoy
        }

        // Encontrar la primera clase del día
        const primeraClase = horarioHoy.sort((a, b) => {
            const horaA = this.convertirHoraAMinutos(a.inicio);
            const horaB = this.convertirHoraAMinutos(b.inicio);
            return horaA - horaB;
        })[0];

        const [horasClase, minutosClase] = primeraClase.inicio.split(':').map(Number);
        const horaInicioClase = new Date();
        horaInicioClase.setHours(horasClase, minutosClase, 0, 0);

        const horaActual = new Date();
        const diferenciaMs = horaActual - horaInicioClase;
        const diferenciaMinutos = Math.floor(diferenciaMs / (1000 * 60));

        // Retardo si llega 10 minutos después de la primera clase
        return diferenciaMinutos > 10;
    }

    async crearRegistroBD(boleta, puerta, id_tipo_registro, tieneRetardo, sinCredencial) {
        const response = await fetch(`${this.apiBase}/registros`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                boleta: parseInt(boleta),
                puerta: puerta,
                id_tipo_registro: id_tipo_registro,
                tieneRetardo: tieneRetardo, 
                sinCredencial: sinCredencial
            })
        });

        const result = await response.json();

        if (!result.success) {
            throw new Error(result.message);
        }

        return result;
    }

    mostrarResultado(alumnoData, tieneRetardo, sinCredencial, puerta, idTipoRegistro, contadorActual) {
        const alumno = alumnoData.alumno;
        const ahora = new Date();
        const horaActual = this.formatearHora(ahora);

        document.getElementById('nombre-output').value = alumno.nombre;
        document.getElementById('boleta-output').value = alumno.boleta;
        document.getElementById('grupo-output').value = alumno.nombre_grupo;
        this.obtenerHorarioTexto(alumnoData.horario);
        
        // Los contadores no se actualizan en el frontend, se leen como están
        document.getElementById('retardos-output').value = alumno.retardos || 0; 
        document.getElementById('sin-credencial-output').value = alumno.sin_credencial || 0; 

        const tipoRegistroTexto = this.obtenerTipoRegistroTexto(idTipoRegistro, tieneRetardo, sinCredencial);
        let mensaje = this.generarMensajeResultado(tipoRegistroTexto, puerta, horaActual);

        // ADVERTENCIA AL LLEGAR AL LÍMITE (Si es la tercera falta)
        // Se asume que el contador actual AÚN NO incluye la falta que se acaba de registrar.
        if (sinCredencial && contadorActual === 3) {
            mensaje += ' ⚠️ PRÓXIMO SIN CREDENCIAL, NO PASA';
            alert('⚠️ ADVERTENCIA: Próximo sin credencial, NO PASA');
        }

        this.mostrarEstado(mensaje, 'success');

        setTimeout(() => {
            document.getElementById('boleta-input').value = '';
        }, 2000);
    }
    
    // ... (El resto de métodos auxiliares va aquí: mostrarEstado, formatearHora, etc.)

    convertirHoraAMinutos(horaString) {
        const [horas, minutos] = horaString.split(':').map(Number);
        return horas * 60 + minutos;
    }

    mostrarResultadoFinSemana(alumnoData, puerta, tipo) {
        const alumno = alumnoData.alumno;
        const ahora = new Date();
        const horaActual = this.formatearHora(ahora);
        const diaSemana = ahora.getDay();
        const nombreDia = this.diasSemana[diaSemana];

        // Mostrar datos del alumno
        document.getElementById('nombre-output').value = alumno.nombre;
        document.getElementById('boleta-output').value = alumno.boleta;
        document.getElementById('grupo-output').value = alumno.nombre_grupo;
        document.getElementById('horario-output').value = 'FIN DE SEMANA - SIN CLASES';
        document.getElementById('retardos-output').value = alumno.retardos || 0;
        document.getElementById('sin-credencial-output').value = alumno.sin_credencial || 0;

        // Mensaje especial para fin de semana
        const puertaFormateada = this.formatearNombrePuerta(puerta);
        const mensaje = `${nombreDia.toUpperCase()} - SIN CLASES - ${tipo.toUpperCase()} registrada - Puerta: ${puertaFormateada} - Hora: ${horaActual}`;
        
        this.mostrarEstado(mensaje, 'warning');

        setTimeout(() => {
            document.getElementById('boleta-input').value = '';
        }, 2000);
    }

    mostrarResultado(alumnoData, tieneRetardo, sinCredencial, puerta, idTipoRegistro) {
        const alumno = alumnoData.alumno;
        const ahora = new Date();
        const horaActual = this.formatearHora(ahora);

        document.getElementById('nombre-output').value = alumno.nombre;
        document.getElementById('boleta-output').value = alumno.boleta;
        document.getElementById('grupo-output').value = alumno.nombre_grupo;
        document.getElementById('horario-output').value = this.obtenerHorarioTexto(alumnoData.horario);
        document.getElementById('retardos-output').value = alumno.retardos || 0;
        document.getElementById('sin-credencial-output').value = alumno.sin_credencial || 0;

        const tipoRegistroTexto = this.obtenerTipoRegistroTexto(idTipoRegistro, tieneRetardo, sinCredencial);
        let mensaje = this.generarMensajeResultado(tipoRegistroTexto, puerta, horaActual);

        this.mostrarEstado(mensaje, 'success');

        setTimeout(() => {
            document.getElementById('boleta-input').value = '';
        }, 2000);
    }

    obtenerTipoRegistroTexto(idTipoRegistro, tieneRetardo, sinCredencial) {
        const tipos = {
            0: 'entrada',
            1: 'salida', 
            2: 'retardo',
            3: 'entrada_sin_credencial',
            4: 'justificado'
        };
        
        let tipo = tipos[idTipoRegistro] || 'entrada';
        
        if (tieneRetardo && sinCredencial) {
            return 'retardo_sin_credencial';
        }
        
        return tipo;
    }

    generarMensajeResultado(tipoRegistro, puerta, hora) {
        const puertaFormateada = this.formatearNombrePuerta(puerta);

        const mensajes = {
            'entrada': `Entrada normal - Puerta: ${puertaFormateada} - Hora: ${hora}`,
            'retardo': `ENTRADA CON RETARDO - Puerta: ${puertaFormateada} - Hora: ${hora}`,
            'entrada_sin_credencial': `Entrada sin credencial - Puerta: ${puertaFormateada} - Hora: ${hora}`,
            'retardo_sin_credencial': `ENTRADA CON RETARDO Y SIN CREDENCIAL - Puerta: ${puertaFormateada} - Hora: ${hora}`,
            'salida': `Salida registrada - Puerta: ${puertaFormateada} - Hora: ${hora}`
        };

        return mensajes[tipoRegistro] || `Registro - Puerta: ${puertaFormateada} - Hora: ${hora}`;
    }

    obtenerHorarioTexto(horario) {
        if (!horario || horario.length === 0) return 'Sin horario';

        const horas = horario.map(h => h.inicio).sort();
        if (horas.length === 0) return 'Sin horario';

        const primeraHora = horas[0].substring(0, 5);
        const ultimaHora = horas[horas.length - 1].substring(0, 5);

        return `${primeraHora} - ${ultimaHora}`;
    }

    mostrarEstado(mensaje, tipo) {
        const statusIndicator = document.getElementById('status-indicator');
        const statusMessage = document.getElementById('status-message');

        if (statusIndicator && statusMessage) {
            statusMessage.textContent = mensaje;
            
            const colores = {
                'success': '#4CAF50',
                'error': '#f44336',
                'warning': '#ff9800'
            };
            
            statusIndicator.style.backgroundColor = colores[tipo] || '#4CAF50';
        }
    }

    mostrarError(mensaje) {
        this.mostrarEstado(mensaje, 'error');
    }

    formatearNombrePuerta(puertaValue) {
        const puertas = {
            'mexico-tacuba': 'México-Tacuba',
            'mar': 'Mar-Mediterráneo'
        };
        return puertas[puertaValue] || puertaValue;
    }

    formatearHora(fecha) {
        const horas = fecha.getHours().toString().padStart(2, '0');
        const minutos = fecha.getMinutes().toString().padStart(2, '0');
        const segundos = fecha.getSeconds().toString().padStart(2, '0');
        return `${horas}:${minutos}:${segundos}`;
    }
}

// Inicializar
document.addEventListener('DOMContentLoaded', () => {
    new RegistroSystem();
});