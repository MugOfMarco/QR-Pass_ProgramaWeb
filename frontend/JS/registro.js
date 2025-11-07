// registro.js - VERSIÓN CORREGIDA PARA DETECTAR RETARDOS
class RegistroSystem {
    constructor() {
        this.apiBase = 'http://localhost:3000/api';
        this.initEventListeners();
    }

    initEventListeners() {
        document.getElementById('manual-input').addEventListener('change', (e) => {
            this.handleBoletaInput(e.target.value, 'manual');
        });

        document.getElementById('qr-input').addEventListener('change', (e) => {
            this.handleBoletaInput(e.target.value, 'qr');
        });
    }

    async handleBoletaInput(boletaInput, tipoEntrada) {
        const boleta = boletaInput.trim();
        if (boleta.length < 5) return;

        try {
            const response = await fetch(`${this.apiBase}/horarios/alumno/${boleta}`);
            
            if (!response.ok) {
                throw new Error(`Error HTTP: ${response.status}`);
            }
            
            const data = await response.json();
            
            if (data.success) {
                await this.procesarRegistro(data, tipoEntrada);
            } else {
                this.mostrarError('Alumno no encontrado');
            }
        } catch (error) {
            console.error('Error:', error);
            this.mostrarError('Error de conexión: ' + error.message);
        }
    }

    async procesarRegistro(alumnoData, tipoEntrada) {
        try {
            // OBTENER LA PUERTA SELECCIONADA
            const puertaSeleccionada = document.querySelector('input[name="puerta"]:checked');
            const puerta = puertaSeleccionada ? puertaSeleccionada.value : 'mexico-tacuba';
            
            // OBTENER EL TIPO SELECCIONADO (ENTRADA/SALIDA)
            const tipoSeleccionado = document.querySelector('input[name="tipo"]:checked');
            const tipo = tipoSeleccionado ? tipoSeleccionado.value : 'entrada';
            
            console.log('Datos seleccionados:', { puerta, tipo, tipoEntrada });
            
            const ahora = new Date();
            
            // Solo verificar retardo si es ENTRADA
            let tieneRetardo = false;
            let sinCredencial = false;
            
            if (tipo === 'entrada') {
                sinCredencial = tipoEntrada === 'manual';
                tieneRetardo = await this.verificarRetardoSimple(alumnoData.horario);
                console.log('Resultado verificación retardo:', { tieneRetardo, sinCredencial });
            }
            
            // Determinar el tipo final para la base de datos
            let tipoRegistro = tipo; // 'entrada' o 'salida'
            
            if (tipo === 'entrada') {
                if (tieneRetardo && sinCredencial) {
                    tipoRegistro = 'retardo_sin_credencial';
                } else if (tieneRetardo) {
                    tipoRegistro = 'retardo';
                } else if (sinCredencial) {
                    tipoRegistro = 'sin_credencial';
                }
            }
            
            console.log('Tipo de registro final:', tipoRegistro);
            
            // Crear registro en BD
            await this.crearRegistroBD(
                alumnoData.alumno.Boleta, 
                alumnoData.alumno.Grupo, 
                puerta,
                tipoRegistro,
                tieneRetardo, 
                sinCredencial
            );
            
            // Mostrar resultados
            this.mostrarResultado(alumnoData, tieneRetardo, sinCredencial, puerta, tipoRegistro);
            
        } catch (error) {
            console.error('Error en procesarRegistro:', error);
            this.mostrarError('Error al procesar registro: ' + error.message);
        }
    }

    async verificarRetardoSimple(horario) {
        console.log('🔍 Verificando retardo...');
        
        // Solo verificar retardo de lunes a viernes
        const hoy = new Date().getDay();
        console.log('Día de la semana:', hoy);
        
        if (hoy === 0 || hoy === 6) {
            console.log('Fin de semana, no hay retardos');
            return false;
        }
        
        const dias = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
        const diaActual = dias[hoy];
        console.log('Día actual:', diaActual);
        
        // Filtrar horario del día actual y materias activas
        const horarioHoy = horario.filter(h => h.Dia === diaActual && h.Activa);
        console.log('Horario activo hoy:', horarioHoy);
        
        if (horarioHoy.length === 0) {
            console.log('No hay clases hoy');
            return false;
        }
        
        // Encontrar la primera hora del día
        const primeraClase = horarioHoy.sort((a, b) => {
            const horaA = this.convertirHoraAMinutos(a.HoraInicio);
            const horaB = this.convertirHoraAMinutos(b.HoraInicio);
            return horaA - horaB;
        })[0];
        
        console.log('Primera clase del día:', primeraClase);
        
        const horaActual = new Date();
        const [horasClase, minutosClase] = primeraClase.HoraInicio.split(':').map(Number);
        
        // Crear objeto Date para la hora de inicio de clase
        const horaInicioClase = new Date();
        horaInicioClase.setHours(horasClase, minutosClase, 0, 0);
        
        console.log('Hora actual:', horaActual.toTimeString());
        console.log('Hora inicio clase:', horaInicioClase.toTimeString());
        
        // Calcular diferencia en minutos
        const diferenciaMs = horaActual - horaInicioClase;
        const diferenciaMinutos = Math.floor(diferenciaMs / (1000 * 60));
        
        console.log('Diferencia en minutos:', diferenciaMinutos);
        
        // Retardo si llega más de 20 minutos después del inicio de la primera clase
        const esRetardo = diferenciaMinutos > 20;
        
        console.log('¿Es retardo?', esRetardo);
        
        return esRetardo;
    }

    // Función auxiliar para convertir hora a minutos
    convertirHoraAMinutos(horaString) {
        const [horas, minutos] = horaString.split(':').map(Number);
        return horas * 60 + minutos;
    }

    async crearRegistroBD(boleta, grupo, puerta, tipo, tieneRetardo, sinCredencial) {
    const ahora = new Date();
    
    // CORRECCIÓN: Ajustar para hora local de México
    const offset = -6 * 60; // UTC-6 para zona central
    const horaLocal = new Date(ahora.getTime() + offset * 60 * 1000);
    
    console.log('Hora original:', ahora.toISOString());
    console.log('Hora local ajustada:', horaLocal.toISOString());
    
    const horaFormateada = this.formatearHora(ahora); // Usar la hora local real
    
    console.log('Enviando registro a BD:', {
        boleta, grupo, puerta, tipo, tieneRetardo, sinCredencial
    });
    
    const response = await fetch(`${this.apiBase}/registros`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            boleta: parseInt(boleta),
            grupo: grupo,
            puerta: puerta,
            registro: ahora.toISOString(), // Mantener ISO string para consistencia
            hora: horaFormateada, // Agregar hora formateada separadamente
            tipo: tipo,
            tieneRetardo: tieneRetardo,
            sinCredencial: sinCredencial
        })
    });

    const result = await response.json();
    
    if (!result.success) {
        throw new Error(result.message);
    }
    
    console.log('Registro creado exitosamente:', result);
    return result;
}

    mostrarResultado(alumnoData, tieneRetardo, sinCredencial, puerta, tipoRegistro) {
        const alumno = alumnoData.alumno;
        const ahora = new Date();
        const horaActual = this.formatearHora(ahora);
        
        // Llenar campos
        document.getElementById('nombre-output').value = alumno.Nombre;
        document.getElementById('boleta-output').value = alumno.Boleta;
        document.getElementById('grupo-output').value = alumno.Grupo;
        document.getElementById('horario-output').value = alumnoData.horarioFormateado || this.obtenerHorarioTexto(alumnoData.horario);
        
        // Solo actualizar contadores si es entrada
        if (tipoRegistro !== 'salida') {
            document.getElementById('retardos-output').value = (alumno.Retardos || 0) + (tieneRetardo ? 1 : 0);
            document.getElementById('sin-credencial-output').value = (alumno.Sin_credencial || 0) + (sinCredencial ? 1 : 0);
        } else {
            document.getElementById('retardos-output').value = alumno.Retardos || 0;
            document.getElementById('sin-credencial-output').value = alumno.Sin_credencial || 0;
        }

        // Mostrar estado con el tipo de registro
        let mensaje = this.generarMensajeResultado(tipoRegistro, puerta, horaActual);
        
        this.mostrarEstado(mensaje, 'success');
        
        // Limpiar inputs
        setTimeout(() => {
            document.getElementById('manual-input').value = '';
            document.getElementById('qr-input').value = '';
        }, 2000);
    }

    generarMensajeResultado(tipoRegistro, puerta, hora) {
        const puertaFormateada = this.formatearNombrePuerta(puerta);
        
        const mensajes = {
            'entrada': `✅ Entrada normal - Puerta: ${puertaFormateada} - Hora: ${hora}`,
            'retardo': `⚠️ ENTRADA CON RETARDO - Puerta: ${puertaFormateada} - Hora: ${hora}`,
            'sin_credencial': `📝 Entrada sin credencial - Puerta: ${puertaFormateada} - Hora: ${hora}`,
            'retardo_sin_credencial': `🚨 ENTRADA CON RETARDO Y SIN CREDENCIAL - Puerta: ${puertaFormateada} - Hora: ${hora}`,
            'salida': `🚪 Salida registrada - Puerta: ${puertaFormateada} - Hora: ${hora}`
        };
        
        return mensajes[tipoRegistro] || `📋 Registro - Puerta: ${puertaFormateada} - Hora: ${hora}`;
    }

    obtenerHorarioTexto(horario) {
        if (!horario || horario.length === 0) return 'Sin horario';
        
        const horas = horario.map(h => h.HoraInicio).sort();
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
            statusIndicator.style.backgroundColor = tipo === 'success' ? '#4CAF50' : '#f44336';
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