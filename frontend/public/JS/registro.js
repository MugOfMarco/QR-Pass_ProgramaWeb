// registro.js - VERSIÓN CON IMAGEN Y LIMPIEZA AUTOMÁTICA
class RegistroSystem {
    constructor() {
        this.apiBase = '/api';
        this.urlPrefix = 'https://coatl.cecyt9.ipn.mx/app/qr_system/accessprocess.php?boleta=';
        this.initEventListeners();
        
        this.tiposRegistro = {
            'entrada_normal': 0,
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
            console.log('Obteniendo alumno:', boleta);
            
            const response = await fetch(`${this.apiBase}/alumnos/${boleta}`);

            if (!response.ok) {
                if (response.status === 404) {
                    throw new Error('Alumno no encontrado');
                }
                throw new Error(`Error HTTP: ${response.status}`);
            }

            const data = await response.json();
            console.log('Datos recibidos:', data);

            if (data.success) {
                // Mostrar la imagen del alumno
                this.mostrarFotoAlumno(data.alumno);
                
                if (data.bloqueado) {
                    alert('ALUMNO BLOQUEADO - No se puede registrar entrada/salida');
                    this.mostrarError('ALUMNO BLOQUEADO - Contacte con administración');
                    // Limpiar después de 2 segundos
                    setTimeout(() => {
                        this.limpiarDatos();
                    }, 3000);
                    return;
                }
                
                await this.procesarRegistro(data, tipoEntrada);
            } else {
                this.mostrarError('Alumno no encontrado');
                this.limpiarFotoAlumno();
                // Limpiar todo después de 2 segundos
                setTimeout(() => {
                    this.limpiarDatos();
                }, 2000);
            }
        } catch (error) {
            console.error('Error:', error);
            this.mostrarError(error.message);
            this.limpiarFotoAlumno();
            // Limpiar todo después de 2 segundos
            setTimeout(() => {
                this.limpiarDatos();
            }, 2000);
        }
    }

    mostrarFotoAlumno(alumno) {
        const fotoElement = document.getElementById('student-photo');
        const infoBox = document.getElementById('info-box');
        
        if (fotoElement && alumno && alumno.url) {
            fotoElement.src = alumno.url;
            fotoElement.alt = `Foto de ${alumno.nombre}`;
            fotoElement.style.display = 'block';
            
            // Agregar clase si está bloqueado
            if (alumno.bloqueado) {
                fotoElement.classList.add('bloqueado');
                infoBox.style.borderColor = '#dc3545';
            } else {
                fotoElement.classList.remove('bloqueado');
                infoBox.style.borderColor = '#dee2e6';
            }
            
            // Manejar error de imagen
            fotoElement.onerror = () => {
                fotoElement.src = 'https://res.cloudinary.com/depoh32sv/image/upload/v1765415709/vector-de-perfil-avatar-predeterminado-foto-usuario-medios-sociales-icono-183042379.jpg_jfpw3y.webp';
            };
        } else if (fotoElement) {
            this.limpiarFotoAlumno();
        }
    }

    limpiarFotoAlumno() {
        const fotoElement = document.getElementById('student-photo');
        const infoBox = document.getElementById('info-box');
        
        if (fotoElement) {
            fotoElement.src = '';
            fotoElement.style.display = 'none';
            fotoElement.classList.remove('bloqueado');
            if (infoBox) {
                infoBox.style.borderColor = '#dee2e6';
            }
        }
    }

    limpiarDatos() {
        // 1. Limpiar foto del alumno
        const fotoElement = document.getElementById('student-photo');
        const infoBox = document.getElementById('info-box');
        
        if (fotoElement) {
            fotoElement.src = '';
            fotoElement.style.display = 'none';
            fotoElement.classList.remove('bloqueado');
        }
        
        if (infoBox) {
            infoBox.style.borderColor = '#dee2e6';
        }
        
        // 2. Limpiar los campos de datos
        document.getElementById('nombre-output').value = '';
        document.getElementById('boleta-output').value = '';
        document.getElementById('grupo-output').value = '';
        document.getElementById('horario-output').value = '';
        document.getElementById('retardos-output').value = '';
        document.getElementById('sin-credencial-output').value = '';
        
        // 3. Limpiar el mensaje de registro
        const innerBox = document.querySelector('.inner-box');
        if (innerBox) {
            innerBox.textContent = '';
            innerBox.style.backgroundColor = '';
            innerBox.style.color = '';
            innerBox.style.padding = '';
            innerBox.style.borderRadius = '';
            innerBox.style.display = 'none';
        }
        
        // 4. Limpiar el campo de entrada
        document.getElementById('boleta-input').value = '';
        
        // 5. Restablecer el mensaje de estado
        const statusMessage = document.getElementById('status-message');
        if (statusMessage) {
            statusMessage.textContent = 'Esperando registro...';
        }
        
        const statusIndicator = document.getElementById('status-indicator');
        if (statusIndicator) {
            statusIndicator.style.backgroundColor = '#ffc107'; // Color amarillo de espera
        }
        
        console.log('Datos limpiados después del registro');
    }

    async procesarRegistro(alumnoData, tipoEntrada) {
        try {
            const puertaSeleccionada = document.querySelector('input[name="puerta"]:checked');
            const puerta = puertaSeleccionada ? puertaSeleccionada.value : 'mexico-tacuba';

            const tipoSeleccionado = document.querySelector('input[name="tipo"]:checked');
            const tipo = tipoSeleccionado ? tipoSeleccionado.value : 'entrada';

            const hoy = new Date();
            const diaSemana = hoy.getDay();
            
            if (diaSemana === 0 || diaSemana === 6) {
                this.mostrarResultadoFinSemana(alumnoData, puerta, tipo);
                return;
            }

            let idTipoRegistro;
            let tieneRetardo = false;
            let sinCredencial = false;

            if (tipo === 'entrada') {
                sinCredencial = tipoEntrada === 'manual';
                
                if (sinCredencial) {
                    const contadorActual = alumnoData.alumno.sin_credencial || 0;
                    console.log('Contador actual sin credencial:', contadorActual);
                    
                    if (contadorActual >= 3) {
                        alert('DEMASIADAS ENTRADAS SIN CREDENCIAL - EL ALUMNO NO PASA');
                        this.mostrarError('DEMASIADAS ENTRADAS SIN CREDENCIAL - EL ALUMNO NO PASA');
                        document.getElementById('boleta-input').value = '';
                        return;
                    }
                }
                
                tieneRetardo = await this.verificarRetardoSimple(alumnoData.horario);
                
                if (tieneRetardo && sinCredencial) {
                    await this.crearRegistroBD(
                        alumnoData.alumno.boleta,
                        puerta,
                        this.tiposRegistro.retardo,
                        true,
                        false
                    );
                    
                    await this.crearRegistroBD(
                        alumnoData.alumno.boleta,
                        puerta,
                        this.tiposRegistro.entrada_sin_credencial,
                        false,
                        true
                    );
                    
                    idTipoRegistro = this.tiposRegistro.retardo;
                } else {
                    if (tieneRetardo) {
                        idTipoRegistro = this.tiposRegistro.retardo;
                    } else if (sinCredencial) {
                        idTipoRegistro = this.tiposRegistro.entrada_sin_credencial;
                    } else {
                        idTipoRegistro = this.tiposRegistro.entrada_normal;
                    }
                    
                    await this.crearRegistroBD(
                        alumnoData.alumno.boleta,
                        puerta,
                        idTipoRegistro,
                        tieneRetardo,
                        sinCredencial
                    );
                }
            } else if (tipo === 'salida') {
                sinCredencial = tipoEntrada === 'manual';
                idTipoRegistro = this.tiposRegistro.salida;
                
                await this.crearRegistroBD(
                    alumnoData.alumno.boleta,
                    puerta,
                    idTipoRegistro,
                    false,
                    sinCredencial
                );
            }

            const contadorActual = alumnoData.alumno.sin_credencial || 0;
            this.mostrarResultado(alumnoData, tieneRetardo, sinCredencial, puerta, idTipoRegistro, contadorActual);

        } catch (error) {
            console.error('Error en procesarRegistro:', error);
            this.mostrarError('Error al procesar registro: ' + error.message);
        }
    }

    mostrarResultado(alumnoData, tieneRetardo, sinCredencial, puerta, idTipoRegistro, contadorActual) {
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
        let tipoColor = 'success';

        if (sinCredencial && idTipoRegistro !== this.tiposRegistro.salida) {
            if (contadorActual === 0) {
                mensaje += ' - PRIMERA ENTRADA SIN CREDENCIAL';
            } else if (contadorActual === 1) {
                mensaje += ' - SEGUNDA ENTRADA SIN CREDENCIAL';
            } else if (contadorActual === 2) {
                mensaje += ' - TERCERA Y ULTIMA ENTRADA SIN CREDENCIAL - PROXIMA VEZ NO PASA';
                tipoColor = 'warning';
            }
        }

        this.mostrarEstado(mensaje, tipoColor);

        // Limpiar después de 2 segundos
        setTimeout(() => {
            this.limpiarDatos();
        }, 2000);
    }

    mostrarResultadoFinSemana(alumnoData, puerta, tipo) {
        const alumno = alumnoData.alumno;
        const ahora = new Date();
        const horaActual = this.formatearHora(ahora);
        const diaSemana = ahora.getDay();
        const nombreDia = this.diasSemana[diaSemana];

        this.mostrarFotoAlumno(alumno);

        document.getElementById('nombre-output').value = alumno.nombre;
        document.getElementById('boleta-output').value = alumno.boleta;
        document.getElementById('grupo-output').value = alumno.nombre_grupo;
        document.getElementById('horario-output').value = 'FIN DE SEMANA - SIN CLASES';
        document.getElementById('retardos-output').value = alumno.retardos || 0;
        document.getElementById('sin-credencial-output').value = alumno.sin_credencial || 0;

        const puertaFormateada = this.formatearNombrePuerta(puerta);
        const mensaje = `${nombreDia.toUpperCase()} - SIN CLASES - ${tipo.toUpperCase()} registrada - Puerta: ${puertaFormateada} - Hora: ${horaActual}`;
        
        this.mostrarEstado(mensaje, 'warning');

        // Limpiar después de 2 segundos
        setTimeout(() => {
            this.limpiarDatos();
        }, 2000);
    }

    async verificarRetardoSimple(horario) {
        const hoy = new Date();
        const diaSemana = hoy.getDay();
        const diaActualConAcentos = this.diasSemana[diaSemana];
        
        const diaActual = diaActualConAcentos
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "");

        const horarioHoy = horario.filter(h => h.dia === diaActual);

        if (horarioHoy.length === 0) {
            return false;
        }

        const primeraClase = horarioHoy.sort((a, b) => {
            const horaA = this.convertirHoraAMinutos(a.inicio);
            const horaB = this.convertirHoraAMinutos(b.inicio);
            return horaA - horaB;
        })[0];

        const [horasClase, minutosClase] = primeraClase.inicio.split(':').map(Number);
        const horaInicioClase = new Date();
        horaInicioClase.setHours(horasClase, minutosClase, 0, 0);

        const diferenciaMs = hoy - horaInicioClase;
        const diferenciaMinutos = Math.floor(diferenciaMs / (1000 * 60));

        return diferenciaMinutos > 20;
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

    convertirHoraAMinutos(horaString) {
        const [horas, minutos] = horaString.split(':').map(Number);
        return horas * 60 + minutos;
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
        
        if (tieneRetardo && sinCredencial) {
            return 'retardo_sin_credencial';
        }
        
        if (tipo === 'salida' && sinCredencial) {
            return 'salida_sin_credencial';
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
            'salida': `Salida registrada - Puerta: ${puertaFormateada} - Hora: ${hora}`,
            'salida_sin_credencial': `Salida sin credencial registrada - Puerta: ${puertaFormateada} - Hora: ${hora}`
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

            const innerBox = document.querySelector('.inner-box');
            if (innerBox) {
                innerBox.textContent = mensaje;
                innerBox.style.backgroundColor = colores[tipo] || '#4CAF50';
                innerBox.style.color = 'white';
                innerBox.style.padding = '20px';
                innerBox.style.borderRadius = '8px';
                innerBox.style.textAlign = 'center';
                innerBox.style.fontSize = '16px';
                innerBox.style.fontWeight = 'bold';
                innerBox.style.display = 'flex';
                innerBox.style.alignItems = 'center';
                innerBox.style.justifyContent = 'center';
            }
        }
    }

    mostrarError(mensaje) {
        this.mostrarEstado(mensaje, 'error');
    }

    formatearNombrePuerta(puertaValue) {
        const puertas = {
            'mexico-tacuba': 'Mexico-Tacuba',
            'mar-mediterraneo': 'Mar-Mediterraneo'
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

document.addEventListener('DOMContentLoaded', () => {
    new RegistroSystem();
});