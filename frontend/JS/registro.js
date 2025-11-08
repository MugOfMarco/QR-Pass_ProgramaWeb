// registro.js - VERSIÓN FINAL (con limpieza integrada)
class RegistroSystem {
    constructor() {
        this.apiBase = 'http://localhost:3000/api';
        this.urlPrefix = 'https://coatl.cecyt9.ipn.mx/app/qr_system/accessprocess.php?boleta=';
        this.initEventListeners();
    }

    initEventListeners() {
        const boletaInput = document.getElementById('boleta-input');

        if (!boletaInput) {
            console.error('Error: No se encontró el campo id="boleta-input"');
            return;
        }

        // --- INICIO DE MODIFICACIÓN ---
        // Eliminamos el listener de 'input' y ponemos TODA la lógica en 'keydown'
        // para evitar la condición de carrera.
        boletaInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.keyCode === 13) {
                e.preventDefault();

                // 1. Leemos el valor RAW (sucio) del input
                let valor = boletaInput.value;
                let tipoEntrada;
                let boletaLimpia;

                // 2. Aplicamos la lógica de limpieza (que estaba en validaciones.js)
                if (valor.startsWith(this.urlPrefix)) {
                    // SÍ es un QR
                    boletaLimpia = valor.substring(this.urlPrefix.length).replace(/[^0-9]/g, '');
                    tipoEntrada = 'qr';
                } else {
                    // NO es un QR, asumimos que es manual
                    boletaLimpia = valor.replace(/[^0-9]/g, '');
                    tipoEntrada = 'manual';
                }

                // 3. Actualizamos el campo visualmente (opcional pero bueno)
                // Usamos requestAnimationFrame para asegurar que se actualice
                requestAnimationFrame(() => {
                    boletaInput.value = boletaLimpia;
                });

                // 4. Llamamos a tu lógica de siempre con los datos LIMPIOS
                this.handleBoletaInput(boletaLimpia, tipoEntrada);
            }
        });
        // --- FIN DE MODIFICACIÓN ---
    }

    async handleBoletaInput(boletaInput, tipoEntrada) {
        // (Esta función ahora recibe la boleta YA LIMPIA)
        const boleta = boletaInput.trim();
        if (boleta.length < 5) return;

        try {
            // Esta URL ahora será correcta: /api/horarios/alumno/2024090001
            const response = await fetch(`${this.apiBase}/horarios/alumno/${boleta}`);

            if (!response.ok) {
                // El error 404 ahora sí significaría "Alumno no encontrado"
                if (response.status === 404) {
                    throw new Error('Alumno no encontrado (404)');
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
            this.mostrarError(error.message); // Muestra el mensaje de error real
        }
    }

    // (EL RESTO DE TU ARCHIVO 'registro.js' SE QUEDA EXACTAMENTE IGUAL)
    // ... procesarRegistro, verificarRetardoSimple, crearRegistroBD, etc. ...
    async procesarRegistro(alumnoData, tipoEntrada) {
        try {
            const puertaSeleccionada = document.querySelector('input[name="puerta"]:checked');
            const puerta = puertaSeleccionada ? puertaSeleccionada.value : 'mexico-tacuba';

            const tipoSeleccionado = document.querySelector('input[name="tipo"]:checked');
            const tipo = tipoSeleccionado ? tipoSeleccionado.value : 'entrada';

            console.log('Datos seleccionados:', { puerta, tipo, tipoEntrada });

            const ahora = new Date();

            let tieneRetardo = false;
            let sinCredencial = false;

            if (tipo === 'entrada') {
                sinCredencial = tipoEntrada === 'manual';
                tieneRetardo = await this.verificarRetardoSimple(alumnoData.horario);
                console.log('Resultado verificación retardo:', { tieneRetardo, sinCredencial });
            }

            let tipoRegistro = tipo;

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

            const resultado = await this.crearRegistroBD(
                alumnoData.alumno.Boleta,
                alumnoData.alumno.Grupo,
                puerta,
                tipoRegistro,
                tieneRetardo,
                sinCredencial
            );

            console.log('Resultado del registro:', resultado);

            this.mostrarResultado(alumnoData, tieneRetardo, sinCredencial, puerta, tipoRegistro);

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

        const dias = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
        const diaActual = dias[hoy];

        const horarioHoy = horario.filter(h => h.Dia === diaActual && h.Activa);

        if (horarioHoy.length === 0) {
            console.log('No hay clases hoy');
            return false;
        }

        const primeraClase = horarioHoy.sort((a, b) => {
            const horaA = this.convertirHoraAMinutos(a.HoraInicio);
            const horaB = this.convertirHoraAMinutos(b.HoraInicio);
            return horaA - horaB;
        })[0];

        const horaActual = new Date();
        const [horasClase, minutosClase] = primeraClase.HoraInicio.split(':').map(Number);

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

    async crearRegistroBD(boleta, grupo, puerta, tipo, tieneRetardo, sinCredencial) {
        const ahora = new Date();
        const horaFormateada = this.formatearHora(ahora);
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
                registro: ahora.toISOString(),
                hora: horaFormateada,
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

        document.getElementById('nombre-output').value = alumno.Nombre;
        document.getElementById('boleta-output').value = alumno.Boleta;
        document.getElementById('grupo-output').value = alumno.Grupo;
        document.getElementById('horario-output').value = alumnoData.horarioFormateado || this.obtenerHorarioTexto(alumnoData.horario);

        if (tipoRegistro !== 'salida') {
            document.getElementById('retardos-output').value = (alumno.Retardos || 0) + (tieneRetardo ? 1 : 0);
            document.getElementById('sin-credencial-output').value = (alumno.Sin_credencial || 0) + (sinCredencial ? 1 : 0);
        } else {
            document.getElementById('retardos-output').value = alumno.Retardos || 0;
            document.getElementById('sin-credencial-output').value = alumno.Sin_credencial || 0;
        }

        let mensaje = this.generarMensajeResultado(tipoRegistro, puerta, horaActual);

        this.mostrarEstado(mensaje, 'success');

        setTimeout(() => {
            // --- CAMBIO ---
            // Apunta al ID correcto
            document.getElementById('boleta-input').value = '';
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