// frontend/public/JS/registro.js
// ============================================================
// FLUJO:
//   1. Alumno escanea QR o escribe boleta + Enter
//   2. Frontend obtiene datos del alumno (foto, horario, etc.)
//   3. Frontend calcula el SUBTIPO de entrada si aplica:
//        · ¿Sin QR?  → sinCredencial = true
//        · ¿Retardo? → id_tipo_registro = 3
//        · Normal    → id_tipo_registro = 1
//   4. Manda todo al servidor
//   5. El SERVIDOR consulta la BD y decide si es ENTRADA o SALIDA
//      (el frontend no lo decide — nunca)
//   6. El servidor responde con tipo_detectado: 'entrada' | 'salida'
//   7. El frontend muestra el resultado según lo que respondió el servidor
// ============================================================

class RegistroSystem {
    constructor() {
        this.apiBase    = '/api';
        this.urlPrefix  = 'https://coatl.cecyt9.ipn.mx/app/qr_system/accessprocess.php?boleta=';
        this.diasSemana = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];

        this.TIPO = {
            ENTRADA_NORMAL: 1,
            SALIDA:         2,
            RETARDO:        3,
            SIN_CREDENCIAL: 4,
        };

        this.initEventListeners();
    }

    initEventListeners() {
        const input = document.getElementById('boleta-input');
        if (!input) { console.error('No se encontró #boleta-input'); return; }

        input.addEventListener('keydown', (e) => {
            if (e.key !== 'Enter' && e.keyCode !== 13) return;
            e.preventDefault();

            const valor = input.value.trim();
            let boleta, esQR;

            if (valor.startsWith(this.urlPrefix)) {
                boleta = valor.substring(this.urlPrefix.length).replace(/\D/g, '');
                esQR   = true;
            } else {
                boleta = valor.replace(/\D/g, '');
                esQR   = false;
            }

            requestAnimationFrame(() => { input.value = boleta; });
            if (boleta.length >= 5) this.procesar(boleta, esQR);
        });
    }

    async procesar(boleta, esQR) {
        try {
            // ── 1. Obtener alumno + horario ───────────────────
            const respAlumno = await fetch(`${this.apiBase}/alumnos/${boleta}`);

            if (respAlumno.status === 404) {
                this.mostrarEstado('Alumno no encontrado', 'error');
                return;
            }
            if (!respAlumno.ok) {
                this.mostrarEstado(`Error del servidor (${respAlumno.status})`, 'error');
                return;
            }

            const dataAlumno = await respAlumno.json();
            if (!dataAlumno.success) {
                this.mostrarEstado(dataAlumno.message || 'Alumno no encontrado', 'error');
                return;
            }

            const alumno  = dataAlumno.alumno;
            const horario = dataAlumno.horario || [];

            // Mostrar foto inmediatamente
            this.mostrarFoto(alumno);

            // Alumno bloqueado — no registrar
            if (alumno.bloqueado || dataAlumno.bloqueado) {
                this.mostrarEstado('⛔ ALUMNO BLOQUEADO — Contacte administración', 'error');
                setTimeout(() => this.limpiar(), 3000);
                return;
            }

            // ── 2. Calcular subtipo de ENTRADA (si aplica) ────
            // El servidor decide si es entrada o salida.
            // Nosotros solo calculamos el subtipo en caso de que sea entrada.
            const sinCredencial = !esQR;

            // Aviso preventivo antes de mandar la petición
            if (sinCredencial && (alumno.sin_credencial || 0) >= 3) {
                this.mostrarEstado('⛔ DEMASIADAS ENTRADAS SIN CREDENCIAL', 'error');
                this.limpiar();
                return;
            }

            // Calcular si hay retardo (solo relevante para entradas)
            const estadoHorario  = this.verificarRetardo(horario);
            const esRetardo      = estadoHorario?.esRetardo ?? false;

            let tipoSugerido;
            if (sinCredencial) {
                tipoSugerido = this.TIPO.SIN_CREDENCIAL;
            } else if (esRetardo) {
                tipoSugerido = this.TIPO.RETARDO;
            } else {
                tipoSugerido = this.TIPO.ENTRADA_NORMAL;
            }

            // Fin de semana — igual registramos pero lo indicamos
            const diaSemana = new Date().getDay();
            const esFinSemana = diaSemana === 0 || diaSemana === 6;

            // ── 3. Enviar al servidor ─────────────────────────
            const puerta = document.querySelector('input[name="puerta"]:checked')?.value
                        || 'mexico-tacuba';

            const respRegistro = await fetch(`${this.apiBase}/registros`, {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    boleta:           parseInt(boleta),
                    puerta,
                    sinCredencial,
                    id_tipo_registro: tipoSugerido,
                }),
            });

            const resultado = await respRegistro.json();

            if (!respRegistro.ok || !resultado.success) {
                this.mostrarEstado(resultado.message || 'Error al registrar', 'error');
                return;
            }

            // ── 4. Mostrar resultado ──────────────────────────
            // tipo_detectado viene del servidor: 'entrada' | 'salida'
            // id_tipo_registro también viene del servidor (definitivo)
            this.mostrarDatos(alumno, horario);
            this.mostrarMensajeFinal(
                resultado.tipo_detectado,
                resultado.id_tipo_registro,
                alumno,
                puerta,
                sinCredencial,
                esFinSemana,
            );

            setTimeout(() => this.limpiar(), 3000);

        } catch (err) {
            console.error('Error en procesar():', err);
            this.mostrarEstado('Error de conexión con el servidor', 'error');
            this.limpiarFoto();
        }
    }

    // ── Verificar retardo contra horario ─────────────────────
    verificarRetardo(horario) {
        if (!horario?.length) return null;

        const ahora     = new Date();
        const diaStr    = this.diasSemana[ahora.getDay()]
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

        const clasesHoy = horario.filter(h =>
            h.dia.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase() === diaStr
        );
        if (!clasesHoy.length) return null;

        const minutosAhora = ahora.getHours() * 60 + ahora.getMinutes();
        let mejor = null, menorDiff = Infinity;

        for (const clase of clasesHoy) {
            const inicioMin = this.hhmm(clase.inicio);
            const diff      = Math.abs(minutosAhora - inicioMin);
            if (diff < menorDiff) { menorDiff = diff; mejor = clase; }
        }

        if (menorDiff > 480) return null;  // más de 8 horas de diferencia → irrelevante

        const retraso = minutosAhora - this.hhmm(mejor.inicio);
        return { esRetardo: retraso > 20, clase: mejor, retraso };
    }

    // ── Mostrar datos del alumno en los campos ────────────────
    mostrarDatos(alumno, horario) {
        this.set('nombre-output',          alumno.nombre         || '');
        this.set('boleta-output',          alumno.boleta         || '');
        this.set('grupo-output',           alumno.nombre_grupo   || '');
        this.set('horario-output',         this.rangoHorario(horario));
        this.set('retardos-output',        alumno.retardos       ?? 0);
        this.set('sin-credencial-output',  alumno.sin_credencial ?? 0);
    }

    // ── Construir mensaje final según lo que respondió el servidor
    mostrarMensajeFinal(tipoDetectado, idTipo, alumno, puerta, sinCredencial, esFinSemana) {
        const hora       = this.formatHora(new Date());
        const puertaFmt  = this.nombrePuerta(puerta);
        const contador   = alumno.sin_credencial ?? 0;
        let mensaje, color;

        if (tipoDetectado === 'salida') {
            // SALIDA
            mensaje = `✅ SALIDA — ${puertaFmt} — ${hora}`;
            color   = 'success';
            if (sinCredencial) mensaje += ' (sin credencial)';

        } else {
            // ENTRADA — el subtipo ya viene del servidor
            switch (idTipo) {
                case this.TIPO.RETARDO:
                    mensaje = `⚠ RETARDO — ${puertaFmt} — ${hora}`;
                    color   = 'warning';
                    break;
                case this.TIPO.SIN_CREDENCIAL:
                    mensaje = `⚠ Sin credencial — ${puertaFmt} — ${hora}`;
                    color   = 'warning';
                    if      (contador === 0) mensaje += ' — 1ª vez';
                    else if (contador === 1) mensaje += ' — 2ª vez';
                    else                     mensaje += ' — ⛔ ÚLTIMA PERMITIDA';
                    break;
                default:
                    mensaje = `✅ ENTRADA — ${puertaFmt} — ${hora}`;
                    color   = 'success';
            }
        }

        if (esFinSemana) {
            mensaje += ` (${this.diasSemana[new Date().getDay()].toUpperCase()} — sin clases)`;
            color = 'warning';
        }

        this.mostrarEstado(mensaje, color);
        this.actualizarBadge(tipoDetectado, idTipo);
    }

    // ── Badge de tipo (arriba a la derecha) ───────────────────
    actualizarBadge(tipoDetectado, idTipo) {
        const badge = document.getElementById('tipo-badge');
        const texto = document.getElementById('tipo-texto');
        if (!badge || !texto) return;

        badge.className = 'tipo-badge';

        if (tipoDetectado === 'salida') {
            badge.classList.add('tipo-salida');
            texto.textContent = '↑ SALIDA';
        } else {
            switch (idTipo) {
                case this.TIPO.RETARDO:
                    badge.classList.add('tipo-retardo');
                    texto.textContent = '↓ RETARDO';
                    break;
                case this.TIPO.SIN_CREDENCIAL:
                    badge.classList.add('tipo-retardo');
                    texto.textContent = '↓ SIN CREDENCIAL';
                    break;
                default:
                    badge.classList.add('tipo-entrada');
                    texto.textContent = '↓ ENTRADA';
            }
        }
    }

    // ── Foto ─────────────────────────────────────────────────
    mostrarFoto(alumno) {
        const foto    = document.getElementById('student-photo');
        const infoBox = document.getElementById('info-box');
        if (!foto) return;

        if (alumno?.url) {
            foto.src           = alumno.url;
            foto.alt           = alumno.nombre || '';
            foto.style.display = 'block';
            foto.onerror       = () => {
                foto.src = 'https://res.cloudinary.com/depoh32sv/image/upload/v1765415709/vector-de-perfil-avatar-predeterminado-foto-usuario-medios-sociales-icono-183042379.jpg_jfpw3y.webp';
            };
        }
        if (alumno?.bloqueado) {
            foto.classList.add('bloqueado');
            if (infoBox) infoBox.style.borderColor = '#dc3545';
        } else {
            foto.classList.remove('bloqueado');
            if (infoBox) infoBox.style.borderColor = '#dee2e6';
        }
    }

    limpiarFoto() {
        const foto    = document.getElementById('student-photo');
        const infoBox = document.getElementById('info-box');
        if (foto) { foto.src = ''; foto.style.display = 'none'; foto.classList.remove('bloqueado'); }
        if (infoBox) infoBox.style.borderColor = '#dee2e6';
    }

    // ── Estado visual (status bar + inner box) ────────────────
    mostrarEstado(mensaje, tipo) {
        const colores  = { success: '#4CAF50', error: '#f44336', warning: '#ff9800' };
        const color    = colores[tipo] || '#4CAF50';
        const statusMsg = document.getElementById('status-message');
        const statusInd = document.getElementById('status-indicator');
        const innerBox  = document.querySelector('.inner-box');

        if (statusMsg)  statusMsg.textContent = mensaje;
        if (statusInd)  statusInd.style.backgroundColor = color;
        if (innerBox) {
            Object.assign(innerBox.style, {
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                backgroundColor: color, color: 'white', padding: '20px',
                borderRadius: '8px', textAlign: 'center',
                fontSize: '16px', fontWeight: 'bold',
            });
            innerBox.textContent = mensaje;
        }
    }

    // ── Limpiar pantalla ──────────────────────────────────────
    limpiar() {
        this.limpiarFoto();
        ['nombre-output','boleta-output','grupo-output','horario-output',
         'retardos-output','sin-credencial-output'].forEach(id => this.set(id, ''));
        this.set('boleta-input', '');

        const statusMsg = document.getElementById('status-message');
        if (statusMsg) statusMsg.textContent = 'Esperando registro...';
        const statusInd = document.getElementById('status-indicator');
        if (statusInd) statusInd.style.backgroundColor = '#ffc107';

        const innerBox = document.querySelector('.inner-box');
        if (innerBox) { innerBox.textContent = ''; innerBox.style.removeProperty('background-color'); }

        const badge = document.getElementById('tipo-badge');
        const texto = document.getElementById('tipo-texto');
        if (badge) badge.className = 'tipo-badge tipo-espera';
        if (texto) texto.textContent = '— esperando —';
    }

    // ── Utilidades ────────────────────────────────────────────
    set(id, val) {
        const el = document.getElementById(id);
        if (el) el.value = val;
    }

    hhmm(str) {
        if (!str) return 0;
        const [h, m] = str.split(':').map(Number);
        return h * 60 + m;
    }

    rangoHorario(horario) {
        if (!horario?.length) return 'Sin horario';
        const horas = horario.map(h => h.inicio).sort();
        return `${horas[0]?.slice(0,5) || ''} — ${horas[horas.length-1]?.slice(0,5) || ''}`;
    }

    formatHora(d) {
        return [d.getHours(), d.getMinutes(), d.getSeconds()]
            .map(n => String(n).padStart(2,'0')).join(':');
    }

    nombrePuerta(v) {
        return { 'mexico-tacuba':'México-Tacuba', 'mar':'Mar-Mediterráneo',
                 'mar-mediterraneo':'Mar-Mediterráneo' }[v] || v;
    }
}

document.addEventListener('DOMContentLoaded', () => { new RegistroSystem(); });