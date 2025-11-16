// registro.js - VERSIÓN ACTUALIZADA PARA NUEVA BD
class RegistroSystem {
    constructor() {
        this.apiBase = 'http://localhost:3000/api';
        this.urlPrefix = 'https://coatl.cecyt9.ipn.mx/app/qr_system/accessprocess.php?boleta=';
        this.initEventListeners();
        
        // Mapeo de tipos de registro a IDs
        this.tiposRegistro = {
            'entrada_normal': 0,
            'salida': 1,            
            'retardo': 2,
            'entrada_sin_credencial': 3,
            'justificado': 4
        };
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
            // ✅ CAMBIO: Usar nuevo endpoint
            const response = await fetch(`${this.apiBase}/alumno/${boleta}`);

            if (!response.ok) {
                if (response.status === 404) {
                    throw new Error('Alumno no encontrado');
                }
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
            this.mostrarError(error.message);
        }
    }

    async procesarRegistro(alumnoData, tipoEntrada) {
        try {
            const puertaSeleccionada = document.querySelector('input[name="puerta"]:checked');
            const puerta = puertaSeleccionada ? puertaSeleccionada.value : 'mexico-tacuba';

            const tipoSeleccionado = document.querySelector('input[name="tipo"]:checked');
            const tipo = tipoSeleccionado ? tipoSeleccionado.value : 'entrada';

            console.log('Datos seleccionados:', { puerta, tipo, tipoEntrada });

            let idTipoRegistro;
            let tieneRetardo = false;
            let sinCredencial = false;

            // ✅ LÓGICA CORREGIDA con IDs correctos
            if (tipo === 'entrada') {
                sinCredencial = tipoEntrada === 'manual';
                tieneRetardo = await this.verificarRetardoSimple(alumnoData.horario);
                
                if (tieneRetardo && sinCredencial) {
                    // Para retardo + sin_credencial, creamos DOS registros
                    idTipoRegistro = this.tiposRegistro.retardo; // ID 2
                } else if (tieneRetardo) {
                    idTipoRegistro = this.tiposRegistro.retardo; // ID 2
                } else if (sinCredencial) {
                    idTipoRegistro = this.tiposRegistro.entrada_sin_credencial; // ID 3
                } else {
                    idTipoRegistro = this.tiposRegistro.entrada_normal; // ID 0
                }
            } else if (tipo === 'salida') {
                idTipoRegistro = this.tiposRegistro.salida; // ID 1
            }

            console.log('Tipo de registro final (ID):', idTipoRegistro);

            // Crear el registro principal
            const resultado = await this.crearRegistroBD(
                alumnoData.alumno.boleta,
                puerta,
                idTipoRegistro
            );

            console.log('Resultado del registro:', resultado);

            // ✅ Si es retardo + sin_credencial, crear registro adicional para sin_credencial
            if (tieneRetardo && sinCredencial && tipo === 'entrada') {
                await this.crearRegistroBD(
                    alumnoData.alumno.boleta,
                    puerta,
                    this.tiposRegistro.entrada_sin_credencial // ID 3
                );
                console.log('Registro adicional de sin_credencial creado (ID 3)');
            }

            this.mostrarResultado(alumnoData, tieneRetardo, sinCredencial, puerta, idTipoRegistro);

        } catch (error) {
            console.error('Error en procesarRegistro:', error);
            this.mostrarError('Error al procesar registro: ' + error.message);
        }
    }

    async verificarRetardoSimple(horario) {
        console.log('🔍 Verificando retardo...');

        const hoy = new Date().getDay();
        if (hoy === 0 || hoy === 6) {
            console.log('Fin de semana, no hay retardos');
            return false;
        }

        const dias = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
        const diaActual = dias[hoy];

        // ✅ CAMBIO: Usar nueva estructura de horario
        const horarioHoy = horario.filter(h => h.dia === diaActual);

        if (horarioHoy.length === 0) {
            console.log('No hay clases hoy');
            return false;
        }

        const primeraClase = horarioHoy.sort((a, b) => {
            const horaA = this.convertirHoraAMinutos(a.inicio);
            const horaB = this.convertirHoraAMinutos(b.inicio);
            return horaA - horaB;
        })[0];

        const horaActual = new Date();
        const [horasClase, minutosClase] = primeraClase.inicio.split(':').map(Number);

        const horaInicioClase = new Date();
        horaInicioClase.setHours(horasClase, minutosClase, 0, 0);

        const diferenciaMs = horaActual - horaInicioClase;
        const diferenciaMinutos = Math.floor(diferenciaMs / (1000 * 60));

        const esRetardo = diferenciaMinutos > 20;

        console.log('¿Es retardo?', esRetardo);
        return esRetardo;
    }

    convertirHoraAMinutos(horaString) {
        const [horas, minutos] = horaString.split(':').map(Number);
        return horas * 60 + minutos;
    }

    async crearRegistroBD(boleta, puerta, id_tipo_registro) {
        console.log('Enviando registro a BD:', {
            boleta, puerta, id_tipo_registro
        });

        // ✅ CAMBIO: Usar nuevo formato de datos
        const response = await fetch(`${this.apiBase}/registros`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                boleta: parseInt(boleta),
                puerta: puerta,
                id_tipo_registro: id_tipo_registro
            })
        });

        const result = await response.json();

        if (!result.success) {
            throw new Error(result.message);
        }

        console.log('Registro creado exitosamente:', result);
        return result;
    }

    mostrarResultado(alumnoData, tieneRetardo, sinCredencial, puerta, idTipoRegistro) {
        const alumno = alumnoData.alumno;
        const ahora = new Date();
        const horaActual = this.formatearHora(ahora);

        // ✅ CAMBIO: Usar nuevos nombres de campos
        document.getElementById('nombre-output').value = alumno.nombre;
        document.getElementById('boleta-output').value = alumno.boleta;
        document.getElementById('grupo-output').value = alumno.nombre_grupo;
        document.getElementById('horario-output').value = this.obtenerHorarioTexto(alumnoData.horario);

        // ✅ CAMBIO: Usar info_alumno para contadores
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
            0: 'entrada_normal',
            1: 'salida', 
            2: 'retardo',
            3: 'entrada_sin_credencial',
            4: 'justificado'
        };
        
        let tipo = tipos[idTipoRegistro] || 'entrada_normal';
        
        // Si tenemos retardo y sin credencial, mostrar ambos
        if (tieneRetardo && sinCredencial) {
            return 'retardo_sin_credencial';
        }
        
        return tipo;
    }

    generarMensajeResultado(tipoRegistro, puerta, hora) {
        const puertaFormateada = this.formatearNombrePuerta(puerta);

        const mensajes = {
            'entrada_normal': `Entrada normal - Puerta: ${puertaFormateada} - Hora: ${hora}`,
            'retardo': `ENTRADA CON RETARDO - Puerta: ${puertaFormateada} - Hora: ${hora}`,
            'entrada_sin_credencial': `Entrada sin credencial - Puerta: ${puertaFormateada} - Hora: ${hora}`,
            'retardo_sin_credencial': `ENTRADA CON RETARDO Y SIN CREDENCIAL - Puerta: ${puertaFormateada} - Hora: ${hora}`,
            'salida': `Salida registrada - Puerta: ${puertaFormateada} - Hora: ${hora}`
        };

        return mensajes[tipoRegistro] || `📋 Registro - Puerta: ${puertaFormateada} - Hora: ${hora}`;
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
            statusIndicator.style.backgroundColor = tipo === 'success' ? '#4CAF50' : '#f44336';
        }
    }

    mostrarError(mensaje) {
        this.mostrarEstado(mensaje, 'error');
    }

    formatearNombrePuerta(puertaValue) {
        const puertas = {
            'mexico-tacuba': 'México-Tacuba',
            'mar-mediterraneo': 'Mar-Mediterráneo'
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