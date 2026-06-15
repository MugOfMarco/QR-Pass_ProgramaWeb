// frontend/public/JS/registro.js
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

        this._input = input;

        // Indicador en idle al arrancar
        const statusInd = document.getElementById('status-indicator');
        if (statusInd) statusInd.classList.add('idle');

        input.focus();

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

        // Re-enfocar si el usuario hace clic fuera del input
        // EXCEPCIÓN: no robamos el foco cuando el clic es dentro del panel de falta manual
        document.addEventListener('click', (e) => {
            const panelFalta = document.getElementById('panel-falta');
            const dentroFalta = panelFalta && panelFalta.contains(e.target);
            if (e.target !== input && !dentroFalta) {
                input.focus();
            }
        });
    }

    async procesar(boleta, esQR) {
        try {
            // ── 1. Obtener alumno + horario ───────────────────
            const respAlumno = await fetch(`${this.apiBase}/alumnos/${boleta}`, {
                credentials: 'include',
            });

            if (respAlumno.status === 401) { window.location.href = '/login.html'; return; }
            if (respAlumno.status === 404) {
                this.mostrarEstado('Alumno no encontrado — boleta no registrada', 'error');
                return;
            }
            if (!respAlumno.ok) {
                let errMsg = `Error del servidor (${respAlumno.status})`;
                try {
                    const errBody = await respAlumno.json();
                    if (errBody.message) errMsg = errBody.message;
                } catch { /* ignorar */ }
                this.mostrarEstado(errMsg, 'error');
                console.error('Error al obtener alumno:', respAlumno.status, errMsg);
                return;
            }

            const dataAlumno = await respAlumno.json();
            if (!dataAlumno.success) {
                this.mostrarEstado(dataAlumno.message || 'Alumno no encontrado', 'error');
                return;
            }

            const alumno  = dataAlumno.alumno;
            const horario = dataAlumno.horario || [];

            this.mostrarFoto(alumno);

            if (alumno.bloqueado || dataAlumno.bloqueado) {
                this.mostrarEstado('⛔ ALUMNO BLOQUEADO — Contacte administración', 'error');
                setTimeout(() => this.limpiar(), 3000);
                return;
            }

            // ── 2. Calcular subtipo de ENTRADA ────────────────
            const sinCredencial = !esQR;

            if (sinCredencial && (alumno.sin_credencial || 0) >= 3) {
                this.mostrarEstado('⛔ DEMASIADAS ENTRADAS SIN CREDENCIAL', 'error');
                this.limpiar();
                return;
            }

            const estadoHorario = this.verificarRetardo(horario);
            const esRetardo     = estadoHorario?.esRetardo ?? false;

            let tipoSugerido;
            if (sinCredencial)    tipoSugerido = this.TIPO.SIN_CREDENCIAL;
            else if (esRetardo)   tipoSugerido = this.TIPO.RETARDO;
            else                  tipoSugerido = this.TIPO.ENTRADA_NORMAL;

            const diaSemana   = new Date().getDay();
            const esFinSemana = diaSemana === 0 || diaSemana === 6;

            // ── 3. Enviar al servidor ─────────────────────────
            const puerta = document.querySelector('input[name="puerta"]:checked')?.value
                        || 'mexico-tacuba';

            const respRegistro = await fetch(`${this.apiBase}/registros`, {
                method:      'POST',
                headers:     { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    boleta:           parseInt(boleta),
                    puerta,
                    sinCredencial,
                    id_tipo_registro: tipoSugerido,
                }),
            });

            if (respRegistro.status === 401) { window.location.href = '/login.html'; return; }

            let resultado;
            try {
                resultado = await respRegistro.json();
            } catch {
                this.mostrarEstado(`Error HTTP ${respRegistro.status} — respuesta inválida del servidor`, 'error');
                console.error('Respuesta no-JSON del servidor:', respRegistro.status, respRegistro.statusText);
                return;
            }

            if (!respRegistro.ok || !resultado.success) {
                // Mostrar el mensaje exacto que devuelve el servidor
                const msg = resultado.message || `Error ${respRegistro.status} al registrar`;
                this.mostrarEstado(msg, 'error');
                console.error('Error del servidor al registrar:', respRegistro.status, resultado);
                return;
            }

            // ── 4. Mostrar resultado ──────────────────────────
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

    // Determina la categoría especial del alumno para el color/badge.
    // Orden de prioridad: bloqueado > puerta_abierta > dictamen > créditos > null
    _categoriaAlumno(alumno) {
        if (!alumno) return null;
        if (alumno.puerta_abierta) return 'puerta_abierta';
        const norm = s => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
        const est  = norm(alumno.estado_academico || alumno.estado || '');
        if (est.includes('dictamen')) return 'dictamen';
        if (est.includes('credito')) return 'creditos';
        return null;
    }

    verificarRetardo(horario) {
        if (!horario?.length) return null;

        const ahora  = new Date();
        const diaStr = this.diasSemana[ahora.getDay()]
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

        if (menorDiff > 480) return null;

        const retraso = minutosAhora - this.hhmm(mejor.inicio);
        return { esRetardo: retraso > 20, clase: mejor, retraso };
    }

    mostrarDatos(alumno, horario) {
        this.set('nombre-output',          alumno.nombre         || '');
        this.set('boleta-output',          alumno.boleta         || '');
        this.set('grupo-output',           alumno.nombre_grupo   || '');
        this.set('horario-output',         this.rangoHorario(horario));
        this.set('retardos-output',        alumno.retardos       ?? 0);
        this.set('sin-credencial-output',  alumno.sin_credencial ?? 0);
    }

    mostrarMensajeFinal(tipoDetectado, idTipo, alumno, puerta, sinCredencial, esFinSemana) {
        const hora      = this.formatHora(new Date());
        const puertaFmt = this.nombrePuerta(puerta);
        const contador  = alumno.sin_credencial ?? 0;
        let mensaje, color;

        if (tipoDetectado === 'salida') {
            mensaje = `✅ SALIDA — ${puertaFmt} — ${hora}`;
            color   = 'success';
            if (sinCredencial) mensaje += ' (sin credencial)';
        } else {
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

        const cat = this._categoriaAlumno(alumno);
        if (cat === 'puerta_abierta') { mensaje += ' — 🔓 PUERTAS ABIERTAS'; }
        else if (cat === 'dictamen')  { mensaje += ' — 📋 DICTAMEN'; }
        else if (cat === 'creditos')  { mensaje += ' — 🎓 CRÉDITOS'; }

        if (esFinSemana) {
            mensaje += ` (${this.diasSemana[new Date().getDay()].toUpperCase()} — sin clases)`;
            color = 'warning';
        }

        this.mostrarEstado(mensaje, color);
        this.actualizarBadge(tipoDetectado, idTipo, alumno);
    }

    actualizarBadge(tipoDetectado, idTipo, alumno) {
        const badge    = document.getElementById('tipo-badge');
        const texto    = document.getElementById('tipo-texto');
        const catBadge = document.getElementById('categoria-badge');
        const catTexto = document.getElementById('categoria-texto');
        if (!badge || !texto) return;

        badge.className = 'badge-movimiento';

        if (tipoDetectado === 'salida') {
            badge.classList.add('badge-salida');
            texto.textContent = '↑ SALIDA';
        } else {
            switch (idTipo) {
                case this.TIPO.RETARDO:
                    badge.classList.add('badge-retardo');
                    texto.textContent = '↓ RETARDO';
                    break;
                case this.TIPO.SIN_CREDENCIAL:
                    badge.classList.add('badge-retardo');
                    texto.textContent = '↓ SIN CREDENCIAL';
                    break;
                default:
                    badge.classList.add('badge-entrada');
                    texto.textContent = '↓ ENTRADA';
            }
        }

        if (!catBadge || !catTexto) return;
        const cat = this._categoriaAlumno(alumno);
        if (cat) {
            const LABELS = {
                puerta_abierta: '🔓 PUERTAS ABIERTAS',
                dictamen:       '📋 DICTAMEN',
                creditos:       '🎓 CRÉDITOS',
            };
            catBadge.className = `badge-categoria badge-cat--${cat}`;
            catTexto.textContent = LABELS[cat];
            catBadge.style.display = '';
        } else {
            catBadge.style.display = 'none';
        }
    }

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

        foto.classList.remove('bloqueado');
        if (infoBox) {
            infoBox.className = 'placeholder-box info-box';
            infoBox.style.borderColor = '';
            if (alumno?.bloqueado) {
                foto.classList.add('bloqueado');
                infoBox.classList.add('info-box--bloqueado');
            } else {
                const cat = this._categoriaAlumno(alumno);
                if (cat) infoBox.classList.add(`info-box--${cat.replace('_', '-')}`);
            }
        }
    }

    limpiarFoto() {
        const foto    = document.getElementById('student-photo');
        const infoBox = document.getElementById('info-box');
        if (foto) { foto.src = ''; foto.style.display = 'none'; foto.classList.remove('bloqueado'); }
        if (infoBox) {
            infoBox.className = 'placeholder-box info-box';
            infoBox.style.borderColor = '';
        }
    }

    mostrarEstado(mensaje, tipo) {
        const colores   = { success: '#4CAF50', error: '#f44336', warning: '#ff9800' };
        const color     = colores[tipo] || '#4CAF50';
        const statusMsg = document.getElementById('status-message');
        const statusInd = document.getElementById('status-indicator');
        const innerBox  = document.querySelector('.inner-box');

        if (statusMsg)  statusMsg.textContent = mensaje;
        if (statusInd)  { statusInd.style.backgroundColor = color; statusInd.classList.remove('idle'); }
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

    limpiar() {
        this.limpiarFoto();
        ['nombre-output','boleta-output','grupo-output','horario-output',
         'retardos-output','sin-credencial-output'].forEach(id => this.set(id, ''));
        this.set('boleta-input', '');
        if (this._input) this._input.focus();

        const statusMsg = document.getElementById('status-message');
        if (statusMsg) statusMsg.textContent = 'Esperando registro...';
        const statusInd = document.getElementById('status-indicator');
        if (statusInd) { statusInd.style.backgroundColor = '#ffc107'; statusInd.classList.add('idle'); }

        const innerBox = document.querySelector('.inner-box');
        if (innerBox) { innerBox.textContent = ''; innerBox.style.removeProperty('background-color'); }

        const badge = document.getElementById('tipo-badge');
        const texto = document.getElementById('tipo-texto');
        if (badge) badge.className = 'badge-movimiento badge-idle';
        if (texto) texto.textContent = '— esperando —';

        const catBadge = document.getElementById('categoria-badge');
        if (catBadge) catBadge.style.display = 'none';
    }

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