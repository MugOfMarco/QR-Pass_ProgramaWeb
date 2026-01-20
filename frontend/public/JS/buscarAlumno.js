// frontend/public/JS/buscarAlumno.js - VERSIÓN MODIFICADA
class SistemaAlumnos {
    constructor() {
        this.apiBase = '/api';
        this.alumnoActual = null;
        this.incidencias = [];
        
        // Inicializar sistema
        this.initialize();
    }

    async initialize() {
        // 1. Verificar si está autenticado
        try {
            const response = await fetch(`${this.apiBase}/auth/check`, {
                credentials: 'include'  // Importante para sesiones
            });
            
            const data = await response.json();
            
            if (!data.success || !data.isAuthenticated) {
                alert('Debes iniciar sesión para acceder a esta página');
                window.location.href = '/login.html';
                return;
            }
            
            // 2. Verificar si es Administrador o Prefecto
            if (data.tipo !== 'Administrador' && data.tipo !== 'Prefecto') {
                alert('No tienes permisos para acceder a esta página');
                window.location.href = '/vista-profesor.html';
                return;
            }
            
            // 3. Guardar info del usuario
            this.userInfo = data.user;
            this.userType = data.tipo;
            
            console.log(`✅ Usuario: ${data.user.nombre} (${data.tipo})`);
            
            // 4. Inicializar interfaz
            this.showUserInfo();
            this.initEventListeners();
            
        } catch (error) {
            console.error('Error verificando autenticación:', error);
            window.location.href = '/login.html';
        }
    }
   
    showUserInfo() {
        // Mostrar nombre y tipo de usuario
        const userDisplay = document.getElementById('current-user-display');
        if (userDisplay) {
            userDisplay.textContent = `${this.userInfo.nombre} (${this.userType})`;
        }
        
        // Agregar botón de logout
        this.addLogoutButton();
    }

    addLogoutButton() {
        if (document.getElementById('logout-button')) return;
        
        const logoutBtn = document.createElement('button');
        logoutBtn.id = 'logout-button';
        logoutBtn.textContent = 'Cerrar Sesión';
        logoutBtn.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            padding: 8px 16px;
            background: #dc3545;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            z-index: 1000;
        `;
        
        logoutBtn.addEventListener('click', async () => {
            try {
                await fetch(`${this.apiBase}/auth/logout`, { 
                    method: 'POST',
                    credentials: 'include'
                });
            } finally {
                window.location.href = '/login.html';
            }
        });
        document.body.appendChild(logoutBtn);
    }

    async checkAuth() {
        try {
            const response = await fetch(`${this.apiBase}/auth/check`);
            const data = await response.json();
            
            if (data.success && data.isAuthenticated) {
                this.userInfo = data.user;
                this.isAuthenticated = true;
                this.userType = data.tipo;
                return true;
            } else {
                this.userInfo = null;
                this.isAuthenticated = false;
                this.userType = null;
                return false;
            }
        } catch (error) {
            console.error('Error verificando autenticación:', error);
            return false;
        }
    }
    
    isAdmin() {
        return this.userType === 'Administrador';
    }
    
    
    requireAuth(actionName = 'realizar esta acción') {
    // Ya no comprobamos this.isAuthenticated aquí.
    // Dejamos que el fetch intente la acción.
    // Si no hay sesión, el servidor responderá 401 y lo manejaremos en el catch.
    return true; 
}
    
    requireRole(allowedRoles, actionName = 'realizar esta acción') {
        if (!this.requireAuth(actionName)) return false;
        
        if (!allowedRoles.includes(this.userType)) {
            alert(`No tienes permisos de ${allowedRoles.join(' o ')} para ${actionName}`);
            return false;
        }
        
        return true;
    }
    
    showUserInfo() {
        if (!this.userInfo) return;
        
        // Mostrar info del usuario en la interfaz
        const userDisplay = document.getElementById('current-user-display');
        if (userDisplay) {
            userDisplay.textContent = `${this.userInfo.nombre} (${this.userType})`;
        }
        
        // Agregar botón de logout si no existe
        this.addLogoutButton();
    }
    
    addLogoutButton() {
        // Verificar si ya existe
        if (document.getElementById('logout-button')) return;
        
        const logoutBtn = document.createElement('button');
        logoutBtn.id = 'logout-button';
        logoutBtn.textContent = 'Cerrar Sesión';
        logoutBtn.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            padding: 8px 16px;
            background: #dc3545;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            z-index: 1000;
            font-size: 14px;
        `;
        
        logoutBtn.addEventListener('click', async () => {
            try {
                await fetch(`${this.apiBase}/auth/logout`, { method: 'POST' });
            } finally {
                window.location.href = '/login.html';
            }
        });
        
        document.body.appendChild(logoutBtn);
    }

    // ============================================
    // 2. MÉTODOS DE LA INTERFAZ (MODIFICADOS)
    // ============================================
    
    initEventListeners() {
        // Buscar alumno
        const searchInput = document.getElementById('search-boleta-inc');

        if (searchInput) {
        // Bloquear letras mientras el usuario escribe
        searchInput.addEventListener('input', (e) => {
            // Reemplaza cualquier cosa que NO sea un número (\D) por un vacío
            e.target.value = e.target.value.replace(/\D/g, '');
            
            // Una vez limpio, procedes a buscar el alumno
            this.buscarAlumno(e.target.value);
        });

        // Opcional: Bloquear teclas no numéricas desde el evento keydown
        searchInput.addEventListener('keydown', (e) => {
            const allowedKeys = ['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab'];
            if (!allowedKeys.includes(e.key) && isNaN(Number(e.key))) {
                e.preventDefault();
            }
        });
    }

        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.buscarAlumno(e.target.value);
            });
        }
        
        // Configurar botones según rol
        this.configureButtonsByRole();
        
        // Menú
        const menuBtn = document.getElementById('menu-toggle-btn');
        const overlay = document.getElementById('menu-overlay');
        
        if (menuBtn) menuBtn.addEventListener('click', () => this.toggleMenu());
        if (overlay) overlay.addEventListener('click', () => this.closeMenu());
    }

    configureButtonsByRole() {
        // Botones de justificación - SOLO ADMIN
        const btnJustSelec = document.getElementById('btn-justselec');
        const btnJustRet = document.getElementById('btn-justret');
        const btnJustSin = document.getElementById('btn-justsin');
        const btnJustAll = document.getElementById('btn-justall');
        
        // Botones de credencial - SOLO ADMIN
        const btnBloquear = document.getElementById('btn-bloquear-credencial');
        const btnDesbloquear = document.getElementById('btn-desbloquear-credencial');
        
        if (this.userType === 'Administrador') {
            // Mostrar y habilitar botones de administrador
            [btnJustSelec, btnJustRet, btnJustSin, btnJustAll, btnBloquear, btnDesbloquear].forEach(btn => {
                if (btn) {
                    btn.style.display = 'block';
                    btn.disabled = false;
                }
            });
            
            // Asignar eventos
            if (btnJustSelec) btnJustSelec.addEventListener('click', () => this.justificarSeleccionadas());
            if (btnJustRet) btnJustRet.addEventListener('click', () => this.justificarTodasRetardos());
            if (btnJustSin) btnJustSin.addEventListener('click', () => this.justificarTodasSinCredencial());
            if (btnJustAll) btnJustAll.addEventListener('click', () => this.justificarTodas());
            if (btnBloquear) btnBloquear.addEventListener('click', () => this.bloquearcredencial());
            if (btnDesbloquear) btnDesbloquear.addEventListener('click', () => this.desbloquearcredencial());
            
        } else {
            // Si es Prefecto, ocultar botones de administrador
            [btnJustSelec, btnJustRet, btnJustSin, btnJustAll, btnBloquear, btnDesbloquear].forEach(btn => {
                if (btn) {
                    btn.style.display = 'none';
                    btn.disabled = true;
                }
            });
        }
    }

    configureAdminButtons(...buttons) {
        buttons.forEach((btn, index) => {
            if (btn) {
                if (this.isAdmin()) {
                    btn.style.display = 'block';
                    btn.disabled = false;
                    
                    // Asignar eventos según el botón
                    const actions = [
                        () => this.justificarSeleccionadas(),
                        () => this.justificarTodasRetardos(),
                        () => this.justificarTodasSinCredencial(),
                        () => this.justificarTodas()
                    ];
                    
                    if (actions[index]) {
                        btn.addEventListener('click', actions[index]);
                    }
                } else {
                    // Si no es admin, ocultar o deshabilitar
                    btn.style.display = 'none';
                    btn.disabled = true;
                }
            }
        });
    }
    
    configureCredentialButtons(btnBloquear, btnDesbloquear) {
        if (btnBloquear) {
            if (this.isAdmin()) {
                btnBloquear.style.display = 'block';
                btnBloquear.addEventListener('click', () => this.bloquearcredencial());
            } else {
                btnBloquear.style.display = 'none';
                btnBloquear.disabled = true;
            }
        }
        
        if (btnDesbloquear) {
            if (this.isAdmin()) {
                btnDesbloquear.style.display = 'block';
                btnDesbloquear.addEventListener('click', () => this.desbloquearcredencial());
            } else {
                btnDesbloquear.style.display = 'none';
                btnDesbloquear.disabled = true;
            }
        }
    }

    // ============================================
    // 3. MÉTODOS CON VERIFICACIÓN DE PERMISOS
    // ============================================
    
    async justificarSeleccionadas() {
        if (!this.requireRole(['Administrador'], 'justificar incidencias')) return;
        // ... resto del código existente (sin cambios)
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
        if (!this.requireRole(['Administrador'], 'justificar retardos')) return;
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
        if (!this.requireRole(['Administrador'], 'justificar sin credencial')) return;
        const incidenciasSinCredencial = this.incidencias.filter(inc => 
            inc.tipo === 'sin_credencial'
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
        if (!this.requireRole(['Administrador'], 'justificar todas las incidencias')) return;
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

    async verificarEstadoInicial() {
    try {
        const response = await fetch(`${this.apiBase}/auth/check`, { credentials: 'include' });
        if (response.ok) {
            const data = await response.json();
            this.isAuthenticated = true;
            this.usuarioActual = data.user;
        } else {
            this.isAuthenticated = false;
        }
    } catch (error) {
        this.isAuthenticated = false;
    }
}   

    async bloquearcredencial() {
    //if (!this.requireRole(['Administrador'], 'bloquear credenciales')) return;
    if (!this.alumnoActual) {
        this.mostrarError('Primero busca un alumno');
        return;
    }

    if (!confirm(`¿Estás seguro de bloquear la credencial de ${this.alumnoActual.nombre}?`)) return;

    try {
        const response = await fetch(`${this.apiBase}/alumnos/bloquear/${this.alumnoActual.boleta}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include' // <--- ESENCIAL PARA LA SESIÓN
        });

        if (response.status === 401) {
            alert('Sesión expirada. Inicia sesión de nuevo.');
            window.location.href = '/login.html';
            return;
        }

        const data = await response.json();
        if (data.success) {
            this.mostrarExito('Credencial bloqueada');
            this.alumnoActual.bloqueado = true;
            this.actualizarEstadoCredencial();
        } else {
            this.mostrarError(data.message);
        }
    } catch (error) {
        console.error('Error:', error);
        this.mostrarError('Error al procesar la solicitud');
    }
}

    async desbloquearcredencial() {
        if (!this.requireRole(['Administrador'], 'desbloquear credenciales')) return;
        if (!this.alumnoActual) {
            this.mostrarError('Primero busca un alumno');
            return;
        }

        if (!confirm(`¿Estás seguro de desbloquear la credencial de ${this.alumnoActual.nombre}?`)) {
            return;
        }

        try {
            const response = await fetch(`${this.apiBase}/alumnos/desbloquear/${this.alumnoActual.boleta}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            const data = await response.json();
            
            if (data.success) {
                this.mostrarExito('Credencial desbloqueada exitosamente');
                // Actualizar estado local
                this.alumnoActual.bloqueado = false;
                this.actualizarEstadoCredencial();
                
                // Recargar datos para ver cambios
                await this.buscarAlumno(this.alumnoActual.boleta);
            } else {
                this.mostrarError(data.message);
            }
        } catch (error) {
            console.error('Error desbloqueando credencial:', error);
            this.mostrarError('Error al desbloquear credencial');
            
            // Si es error de autenticación, redirigir
            if (error.message.includes('401') || error.message.includes('403')) {
                window.location.href = '/login.html';
            }
        }
    }

    // ============================================
    // 4. MÉTODO PROCESAR JUSTIFICACIÓN CORREGIDO
    // ============================================
    
    async procesarJustificacion(incidencias, justificacion) {
    try {
        const justificacionTexto = this.obtenerTextoJustificacion(justificacion);
        
        for (const incidencia of incidencias) {
            if (incidencia.tipo !== 'retardo' && incidencia.tipo !== 'sin_credencial') continue;
            
            const response = await fetch(`${this.apiBase}/alumnos/justificaciones`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include', // <--- MANTIENE LA SESIÓN DENTRO DEL BUCLE
                body: JSON.stringify({
                    id_registro: incidencia.id_registro,
                    justificacion: justificacionTexto,
                    id_tipo_anterior: this.obtenerIdTipoAnterior(incidencia.tipo)
                })
            });

            if (response.status === 401) {
                alert('Tu sesión ha expirado.');
                window.location.href = '/login.html';
                return;
            }
            
            if (!response.ok) throw new Error(`Error en registro ${incidencia.id_registro}`);
        }
        
        this.mostrarExito('Justificaciones procesadas correctamente');
        await this.buscarAlumno(this.alumnoActual.boleta); // Recargar datos
        
    } catch (error) {
        console.error('Error:', error);
        this.mostrarError('Error al justificar: ' + error.message);
    }
}

    // ============================================
    // 5. MÉTODOS EXISTENTES (SIN CAMBIOS)
    // ============================================
    
    async buscarAlumno(boletaInput) {
    const boleta = String(boletaInput).replace(/\D/g, '').trim();
    
    if (boleta.length !== 10) {
        this.limpiarDatos();
        return;
    }
    
    try {
        const response = await fetch(`${this.apiBase}/alumnos/${boleta}`, {
            credentials: 'include'
        });
        
        // 1. Si es 401, el servidor REALMENTE dice que no hay sesión
        if (response.status === 401) {
            alert('Sesión expirada');
            window.location.href = '/login.html';
            return;
        }

        // 2. Si es 404, simplemente no existe el alumno
        if (response.status === 404) {
            this.limpiarDatos();
            console.warn("Alumno no encontrado");
            // Aquí puedes poner un mensaje en pantalla "Boleta no registrada"
            return;
        }

        // 3. Si es 500, hay un error en tu consulta SQL o Base de Datos
        if (response.status === 500) {
            console.error("Error 500 en el servidor");
            return;
        }

        const data = await response.json();
        
        // IMPORTANTE: Verifica qué devuelve tu API. 
        // Si tu API no manda "success: true", cambia esta línea:
        if (data.alumno || data.success) {
            this.alumnoActual = data.alumno;
            this.mostrarDatosAlumno();
            this.mostrarHorario(data.horario || []);
            this.mostrarFotoAlumno(data.alumno);
            
            // Cargar incidencias (usa también credentials include)
            await this.cargarIncidencias(boleta);
        } else {
            this.limpiarDatos();
        }

    } catch (error) {
        console.error('Error de red o parseo:', error);
    }
}

    async cargarIncidencias(boleta) {
        try {
            const response = await fetch(`${this.apiBase}/alumnos/${boleta}/registros`, {
                credentials: 'include'
            });
            
            if (response.status === 401) {
                alert('Tu sesión ha expirado. Por favor, inicia sesión nuevamente.');
                window.location.href = '/login.html';
                return;
            }
            
            if (response.status === 403) {
                alert('No tienes permisos para acceder a esta función');
                return;
            }
            
            if (!response.ok) {
                throw new Error(`Error HTTP: ${response.status}`);
            }
            
            const data = await response.json();
            
            if (data.success) {
                this.incidencias = data.registros || [];
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

    // ============================================
    // 6. MÉTODOS AUXILIARES (SIN CAMBIOS)
    // ============================================
    
    obtenerIdTipoAnterior(tipoIncidencia) {
        const tipos = {
            'retardo': 2,
            'sin_credencial': 3
        };
        return tipos[tipoIncidencia] || 2;
    }

    obtenerTextoJustificacion(valor) {
        const justificaciones = {
            'item2': 'Se habló con el tutor/a',
            'item3': 'Se habló con el estudiante',
            'item4': 'Error en el registro',
        };
        return justificaciones[valor] || valor;
    }

    formatearTipoIncidencia(tipo) {
        const tipos = {
            'retardo': 'Retardo',
            'sin_credencial': 'Sin credencial', 
            'entrada': 'Entrada normal',
            'salida': 'Salida'
        };
        return tipos[tipo] || tipo;
    }

    formatearNombrePuerta(puertaValue) {
        const puertas = {
            'mexico-tacuba': 'México-Tacuba',
            'mar': 'Mar Mediterráneo',
            'entrada_principal': 'Entrada Principal'
        };
        return puertas[puertaValue] || puertaValue;
    }

    obtenerIncidenciasSeleccionadas() {
        const checkboxes = document.querySelectorAll('.incidencia-checkbox:checked');
        return Array.from(checkboxes).map(checkbox => {
            const idRegistro = parseInt(checkbox.dataset.id);
            return this.incidencias.find(inc => inc.id_registro === idRegistro);
        }).filter(inc => inc !== undefined);
    }

    mostrarFotoAlumno(alumno) {
        const fotoElement = document.getElementById('student-photo');
        const photoBox = document.querySelector('.photo-box');
        
        if (!fotoElement || !photoBox) return;

        if (alumno && alumno.url) {
            fotoElement.src = alumno.url;
            fotoElement.alt = `Foto de ${alumno.nombre}`;
            fotoElement.style.display = 'block';
            
            if (alumno.bloqueado) {
                fotoElement.classList.add('bloqueado');
                photoBox.style.borderColor = '#dc3545';
            } else {
                fotoElement.classList.remove('bloqueado');
                photoBox.style.borderColor = '#dee2e6';
            }
            
            fotoElement.onerror = () => {
                fotoElement.src = 'https://res.cloudinary.com/depoh32sv/image/upload/v1765415709/vector-de-perfil-avatar-predeterminado-foto-usuario-medios-sociales-icono-183042379.jpg_jfpw3y.webp';
                fotoElement.style.display = 'block';
            };
        } else {
            fotoElement.src = '';
            fotoElement.style.display = 'none';
            fotoElement.classList.remove('bloqueado');
            if (photoBox) {
                photoBox.style.borderColor = '#dee2e6';
            }
        }
    }

    mostrarDatosAlumno() {
        if (!this.alumnoActual) return;

        document.getElementById('display-boleta').value = this.alumnoActual.boleta || '';
        document.getElementById('display-alumno').value = this.alumnoActual.nombre || '';
        document.getElementById('display-grupo').value = this.alumnoActual.nombre_grupo || '';
        
        document.getElementById('total-incidencias').textContent = this.alumnoActual.sin_credencial || '0';
        document.getElementById('total-retardos').textContent = this.alumnoActual.retardos || '0';
        
        this.actualizarEstadoCredencial();
    }

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

    limpiarDatos() {
        document.getElementById('display-boleta').value = '';
        document.getElementById('display-alumno').value = '';
        document.getElementById('display-grupo').value = '';
        
        document.getElementById('total-incidencias').textContent = '0';
        document.getElementById('total-retardos').textContent = '0';
        
        const horarioTbody = document.getElementById('horario-tbody');
        if (horarioTbody) horarioTbody.innerHTML = `
            <tr>
                <td colspan="3" style="text-align: center; padding: 1rem;">
                    Ingrese una boleta para cargar el horario
                </td>
            </tr>
        `;
        
        const incidentsTbody = document.getElementById('incidents-tbody');
        if (incidentsTbody) incidentsTbody.innerHTML = `
            <tr>
                <td colspan="4" style="text-align: center; padding: 2rem;">
                    Ingrese una boleta para buscar
                </td>
            </tr>
        `;
        
        const img = document.getElementById('student-photo');
        if (img) {
            img.src = '';
            img.style.display = 'none';
        }
        
        this.limpiarEstadoCredencial();
        
        const fotoElement = document.getElementById('student-photo');
        if (fotoElement) {
            fotoElement.src = '';
            fotoElement.style.display = 'none';
            fotoElement.classList.remove('bloqueado');
        }
        
        this.alumnoActual = null;
        this.incidencias = [];
    }

    actualizarEstadoCredencial() {
        if (!this.alumnoActual) return;
        
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
            estadoElement.textContent = '-';
            estadoElement.className = '';
        }
    }

    mostrarIncidencias() {
        const tbody = document.getElementById('incidents-tbody');
        if (!tbody) return;
        
        tbody.innerHTML = '';

        if (this.incidencias.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="4" style="text-align: center; padding: 2rem;">No se encontraron registros</td>
                </tr>
            `;
            return;
        }

        this.incidencias.forEach((incidencia) => {
            const tr = document.createElement('tr');
            tr.dataset.idRegistro = incidencia.id_registro;
            
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