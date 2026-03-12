// frontend/public/JS/registro.js — MIGRADO A SUPABASE
// ============================================================================================================================
// CAMBIOS VS VERSIÓN ANTERIOR:
//   · tiposRegistro: 0,1,2,3 → 1,2,3,4  (nueva BD empieza en 1)
//   · SALIDA es id 2 (antes era 1)
//   · Contadores NO se tocan aquí — triggers de Supabase los manejan solos
//   · Respuesta del backend: data.alumno y data.horario (misma estructura)
//   · HTML sin cambios — mismos IDs de siempre
// ============================================================================================================================
 
class RegistroSystem {
    constructor() {
        this.apiBase   = '/api';
        this.urlPrefix = 'https://coatl.cecyt9.ipn.mx/app/qr_system/accessprocess.php?boleta=';
        this.diasSemana = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
 
        // =====================================================
        // IDs ACTUALIZADOS — ahora empiezan en 1 (nueva BD)
        // =====================================================
        this.tiposRegistro = {
            entrada_normal:         1,  // antes 0
            salida:                 2,  // antes 1
            retardo:                3,  // antes 2
            entrada_sin_credencial: 4   // antes 3
            // "justificado" ya NO es un tipo de registro
            // se detecta consultando la tabla justificaciones
        };
 
        this.initEventListeners();
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
                    tipoEntrada  = 'qr';
                } else {
                    boletaLimpia = valor.replace(/[^0-9]/g, '');
                    tipoEntrada  = 'manual';
                }
 
                requestAnimationFrame(() => { boletaInput.value = boletaLimpia; });
 
                this.handleBoletaInput(boletaLimpia, tipoEntrada);
            }
        });
    }
 
    async handleBoletaInput(boletaInput, tipoEntrada) {
        const boleta = boletaInput.trim();
        if (boleta.length < 5) return;
 
        try {
            const response = await fetch(`${this.apiBase}/alumnos/${boleta}`);
 
            if (!response.ok) {
                this.limpiarDatos();
                if (response.status === 404) throw new Error('Alumno no encontrado');
                throw new Error(`Error HTTP: ${response.status}`);
            }
 
            const data = await response.json();
 
            if (!data.success) {
                this.limpiarDatos();
                this.mostrarError(data.message || 'Alumno no encontrado');
                this.limpiarFotoAlumno();
                return;
            }
 
            // Mostrar foto inmediatamente
            this.mostrarFotoAlumno(data.alumno);
 
            // Verificar bloqueo (el backend ya lo revisa, pero mostramos UI aquí)
            if (data.bloqueado) {
                this.mostrarError('ALUMNO BLOQUEADO — Contacte con administración');
                setTimeout(() => { this.limpiarDatos(); }, 3000);
                return;
            }
 
            await this.procesarRegistro(data, tipoEntrada);
 
        } catch (error) {
            console.error('Error:', error);
            this.limpiarDatos();
            this.mostrarError(error.message);
            this.limpiarFotoAlumno();
        }
    }
 
    async procesarRegistro(data, tipoEntrada) {
        try {
            const puertaSeleccionada = document.querySelector('input[name="puerta"]:checked');
            const puerta = puertaSeleccionada ? puertaSeleccionada.value : 'mexico-tacuba';
 
            const tipoSeleccionado = document.querySelector('input[name="tipo"]:checked');
            const tipo = tipoSeleccionado ? tipoSeleccionado.value : 'entrada';
 
            const hoy        = new Date();
            const diaSemana  = hoy.getDay();
 
            // Fin de semana — registrar igual pero avisar
            if (diaSemana === 0 || diaSemana === 6) {
                this.mostrarResultadoFinSemana(data.alumno, puerta, tipo);
                return;
            }
 
            let idTipoRegistro;
            let tieneRetardo   = false;
            let sinCredencial  = false;
 
            if (tipo === 'entrada') {
                sinCredencial = (tipoEntrada === 'manual');
 
                // Verificar límite de sin credencial ANTES de registrar
                // (los triggers bloquean automáticamente, pero avisamos en UI)
                if (sinCredencial) {
                    const contadorActual = data.alumno.sin_credencial || 0;
                    if (contadorActual >= 3) {
                        this.mostrarError('DEMASIADAS ENTRADAS SIN CREDENCIAL — EL ALUMNO NO PASA');
                        this.limpiarDatos();
                        return;
                    }
                }
 
                const estadoHorario = this.verificarEstadoHorario(data.horario);
                tieneRetardo = estadoHorario ? estadoHorario.esRetardo : false;
 
                if (sinCredencial) {
                    idTipoRegistro = this.tiposRegistro.entrada_sin_credencial; // 4
                } else if (tieneRetardo) {
                    idTipoRegistro = this.tiposRegistro.retardo;                // 3
                } else {
                    idTipoRegistro = this.tiposRegistro.entrada_normal;         // 1
                }
 
            } else {
                // SALIDA
                sinCredencial  = (tipoEntrada === 'manual');
                idTipoRegistro = this.tiposRegistro.salida;                     // 2
            }
 
            await this.crearRegistroBD(data.alumno.boleta, puerta, idTipoRegistro, sinCredencial);
 
            const contadorActual = data.alumno.sin_credencial || 0;
            this.mostrarResultado(data, tieneRetardo, sinCredencial, puerta, idTipoRegistro, contadorActual);
 
        } catch (error) {
            console.error('Error en procesarRegistro:', error);
            this.mostrarError('Error al procesar registro: ' + error.message);
        }
    }
 
    async crearRegistroBD(boleta, puerta, id_tipo_registro, sinCredencial) {
        const response = await fetch(`${this.apiBase}/registros`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                boleta:           parseInt(boleta),
                puerta:           puerta,
                id_tipo_registro: id_tipo_registro,
                sinCredencial:    sinCredencial
                // tieneRetardo YA NO se manda — el trigger lo detecta por el id_tipo
            })
        });
 
        const result = await response.json();
 
        if (!result.success) throw new Error(result.message);
        return result;
    }
 
    // Lógica de retardo — sin cambios, funciona igual
    verificarEstadoHorario(horario) {
        if (!horario || horario.length === 0) return null;
 
        const hoy          = new Date();
        const diaSemanaStr = this.diasSemana[hoy.getDay()];
        const diaActual    = diaSemanaStr.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
 
        const clasesHoy = horario.filter(h =>
            h.dia.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '') === diaActual
        );
 
        if (clasesHoy.length === 0) return null;
 
        const minutosActuales = hoy.getHours() * 60 + hoy.getMinutes();
        let claseObjetivo     = null;
        let diferenciaMinima  = Infinity;
 
        for (const clase of clasesHoy) {
            const inicioMin = this.convertirHoraAMinutos(clase.inicio);
            const diff      = Math.abs(minutosActuales - inicioMin);
            if (diff < diferenciaMinima) {
                diferenciaMinima = diff;
                claseObjetivo    = clase;
            }
        }
 
        if (diferenciaMinima > 480) return null;
 
        const inicioObjetivo = this.convertirHoraAMinutos(claseObjetivo.inicio);
        const tolerancia     = 20;
        const retraso        = minutosActuales - inicioObjetivo;
 
        return { esRetardo: retraso > tolerancia, clase: claseObjetivo };
    }
 
    // ================================================================
    // UI — sin cambios estructurales, mismos IDs del HTML
    // ================================================================
 
    mostrarFotoAlumno(alumno) {
        const fotoElement = document.getElementById('student-photo');
        const infoBox     = document.getElementById('info-box');
 
        if (fotoElement && alumno?.url) {
            fotoElement.src           = alumno.url;
            fotoElement.alt           = `Foto de ${alumno.nombre}`;
            fotoElement.style.display = 'block';
 
            if (alumno.bloqueado) {
                fotoElement.classList.add('bloqueado');
                if (infoBox) infoBox.style.borderColor = '#dc3545';
            } else {
                fotoElement.classList.remove('bloqueado');
                if (infoBox) infoBox.style.borderColor = '#dee2e6';
            }
 
            fotoElement.onerror = () => {
                fotoElement.src = 'https://res.cloudinary.com/depoh32sv/image/upload/v1765415709/vector-de-perfil-avatar-predeterminado-foto-usuario-medios-sociales-icono-183042379.jpg_jfpw3y.webp';
            };
        }
    }
 
    limpiarFotoAlumno() {
        const fotoElement = document.getElementById('student-photo');
        const infoBox     = document.getElementById('info-box');
        if (fotoElement) {
            fotoElement.src           = '';
            fotoElement.style.display = 'none';
            fotoElement.classList.remove('bloqueado');
            if (infoBox) infoBox.style.borderColor = '#dee2e6';
        }
    }
 
    limpiarDatos() {
        this.limpiarFotoAlumno();
 
        document.getElementById('nombre-output').value        = '';
        document.getElementById('boleta-output').value        = '';
        document.getElementById('grupo-output').value         = '';
        document.getElementById('horario-output').value       = '';
        document.getElementById('retardos-output').value      = '';
        document.getElementById('sin-credencial-output').value = '';
 
        const innerBox = document.querySelector('.inner-box');
        if (innerBox) { innerBox.textContent = ''; innerBox.style.display = 'none'; }
 
        document.getElementById('boleta-input').value = '';
 
        const statusMessage = document.getElementById('status-message');
        if (statusMessage) statusMessage.textContent = 'Esperando registro...';
 
        const statusIndicator = document.getElementById('status-indicator');
        if (statusIndicator) statusIndicator.style.backgroundColor = '#ffc107';
    }
 
    mostrarResultado(data, tieneRetardo, sinCredencial, puerta, idTipoRegistro, contadorActual) {
        const alumno     = data.alumno;
        const horaActual = this.formatearHora(new Date());
 
        document.getElementById('nombre-output').value         = alumno.nombre;
        document.getElementById('boleta-output').value         = alumno.boleta;
        document.getElementById('grupo-output').value          = alumno.nombre_grupo;
        document.getElementById('horario-output').value        = this.obtenerHorarioTexto(data.horario);
        document.getElementById('retardos-output').value       = alumno.retardos || 0;
        document.getElementById('sin-credencial-output').value = alumno.sin_credencial || 0;
 
        const tipoTexto = this.obtenerTipoRegistroTexto(idTipoRegistro, tieneRetardo, sinCredencial);
        let mensaje     = this.generarMensajeResultado(tipoTexto, puerta, horaActual);
        let tipoColor   = 'success';
 
        // Avisos de sin credencial
        if (sinCredencial && idTipoRegistro !== this.tiposRegistro.salida) {
            if      (contadorActual === 0) mensaje += ' — PRIMERA ENTRADA SIN CREDENCIAL';
            else if (contadorActual === 1) mensaje += ' — SEGUNDA ENTRADA SIN CREDENCIAL';
            else if (contadorActual >= 2)  { mensaje += ' — TERCERA Y ÚLTIMA ENTRADA SIN CREDENCIAL'; tipoColor = 'warning'; }
        }
 
        if (tieneRetardo) tipoColor = 'warning';
 
        this.mostrarEstado(mensaje, tipoColor);
        setTimeout(() => { this.limpiarDatos(); }, 2500);
    }
 
    mostrarResultadoFinSemana(alumno, puerta, tipo) {
        const hoy        = new Date();
        const nombreDia  = this.diasSemana[hoy.getDay()];
        const horaActual = this.formatearHora(hoy);
 
        document.getElementById('nombre-output').value         = alumno.nombre;
        document.getElementById('boleta-output').value         = alumno.boleta;
        document.getElementById('grupo-output').value          = alumno.nombre_grupo;
        document.getElementById('horario-output').value        = 'FIN DE SEMANA';
        document.getElementById('retardos-output').value       = alumno.retardos || 0;
        document.getElementById('sin-credencial-output').value = alumno.sin_credencial || 0;
 
        this.mostrarEstado(
            `${nombreDia.toUpperCase()} — SIN CLASES — ${tipo.toUpperCase()} — Hora: ${horaActual}`,
            'warning'
        );
        setTimeout(() => { this.limpiarDatos(); }, 2500);
    }
 
    obtenerTipoRegistroTexto(idTipoRegistro, tieneRetardo, sinCredencial) {
        // IDs nuevos: 1=entrada_normal, 2=salida, 3=retardo, 4=sin_credencial
        const tipos = {
            1: 'entrada_normal',
            2: 'salida',
            3: 'retardo',
            4: 'entrada_sin_credencial'
        };
 
        const tipo = tipos[idTipoRegistro] || 'entrada_normal';
 
        if (tieneRetardo && sinCredencial) return 'retardo_sin_credencial';
        if (tipo === 'salida' && sinCredencial) return 'salida_sin_credencial';
        return tipo;
    }
 
    generarMensajeResultado(tipoRegistro, puerta, hora) {
        const puertaFormateada = this.formatearNombrePuerta(puerta);
 
        const mensajes = {
            entrada_normal:          `Entrada normal — Puerta: ${puertaFormateada} — Hora: ${hora}`,
            retardo:                 `ENTRADA CON RETARDO — Puerta: ${puertaFormateada} — Hora: ${hora}`,
            entrada_sin_credencial:  `Entrada sin credencial — Puerta: ${puertaFormateada} — Hora: ${hora}`,
            retardo_sin_credencial:  `RETARDO Y SIN CREDENCIAL — Puerta: ${puertaFormateada} — Hora: ${hora}`,
            salida:                  `Salida registrada — Puerta: ${puertaFormateada} — Hora: ${hora}`,
            salida_sin_credencial:   `Salida sin credencial — Puerta: ${puertaFormateada} — Hora: ${hora}`
        };
 
        return mensajes[tipoRegistro] || `Registro — Puerta: ${puertaFormateada} — Hora: ${hora}`;
    }
 
    obtenerHorarioTexto(horario) {
        if (!horario || horario.length === 0) return 'Sin horario';
        const horas        = horario.map(h => h.inicio).sort();
        const primeraHora  = horas[0]?.substring(0, 5) || '';
        const ultimaHora   = horas[horas.length - 1]?.substring(0, 5) || '';
        return `${primeraHora} — ${ultimaHora}`;
    }
 
    mostrarEstado(mensaje, tipo) {
        const statusMessage   = document.getElementById('status-message');
        const statusIndicator = document.getElementById('status-indicator');
        const innerBox        = document.querySelector('.inner-box');
 
        const colores = { success: '#4CAF50', error: '#f44336', warning: '#ff9800' };
        const color   = colores[tipo] || '#4CAF50';
 
        if (statusMessage)   statusMessage.textContent          = mensaje;
        if (statusIndicator) statusIndicator.style.backgroundColor = color;
 
        if (innerBox) {
            innerBox.textContent              = mensaje;
            innerBox.style.backgroundColor    = color;
            innerBox.style.color              = 'white';
            innerBox.style.padding            = '20px';
            innerBox.style.borderRadius       = '8px';
            innerBox.style.textAlign          = 'center';
            innerBox.style.fontSize           = '16px';
            innerBox.style.fontWeight         = 'bold';
            innerBox.style.display            = 'flex';
            innerBox.style.alignItems         = 'center';
            innerBox.style.justifyContent     = 'center';
        }
    }
 
    mostrarError(mensaje) { this.mostrarEstado(mensaje, 'error'); }
 
    formatearNombrePuerta(puertaValue) {
        const puertas = { 'mexico-tacuba': 'México-Tacuba', 'mar': 'Mar-Mediterráneo', 'mar-mediterraneo': 'Mar-Mediterráneo' };
        return puertas[puertaValue] || puertaValue;
    }
 
    convertirHoraAMinutos(horaString) {
        if (!horaString) return 0;
        const [horas, minutos] = horaString.split(':').map(Number);
        return horas * 60 + minutos;
    }
 
    formatearHora(fecha) {
        return [
            fecha.getHours().toString().padStart(2, '0'),
            fecha.getMinutes().toString().padStart(2, '0'),
            fecha.getSeconds().toString().padStart(2, '0')
        ].join(':');
    }
}
 
document.addEventListener('DOMContentLoaded', () => { new RegistroSystem(); });
 