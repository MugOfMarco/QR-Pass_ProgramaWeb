// registro.js - Versión simplificada para tu servidor actual
class RegistroSystem {
    constructor() {
        this.apiBase = 'http://localhost:3000/api';
        this.initEventListeners();
    }

    initEventListeners() {
        // EN TU FUNCIÓN initEventListeners()

// RECOMENDADO
document.getElementById('manual-input').addEventListener('change', (e) => {
    this.handleBoletaInput(e.target.value, 'manual');
});

document.getElementById('qr-input').addEventListener('change', (e) => {
    this.handleBoletaInput(e.target.value, 'qr');
});
    }

    async handleBoletaInput(boletaInput, tipo) { // 1. Renombré la variable de entrada
    
    // 2. ¡ESTA ES LA CORRECCIÓN!
    // .trim() elimina espacios y saltos de línea al inicio y al final
    const boleta = boletaInput.trim(); 

    // 3. Usar la boleta limpia para la validación
    if (boleta.length < 5) return;

    try {
        const response = await fetch(`${this.apiBase}/horarios/alumno/${boleta}`);
        const text = await response.text(); // Obtén la respuesta como texto
        console.log('Respuesta del servidor:', text); // Imprime la respuesta para verificar su contenido
    
        const data = JSON.parse(text); // Intenta convertirlo a JSON
        if (data.success) {
            await this.procesarRegistro(data, tipo);
        } else {
            this.mostrarError('Alumno no encontrado');
        }
    } catch (error) {
        console.error('Error:', error);
        this.mostrarError('Error de conexión: ' + error.message);
    }
    }

    async procesarRegistro(alumnoData, tipo) {
    // OBTENER LA PUERTA SELECCIONADA DE LOS RADIO BUTTONS EXISTENTES
    const puertaSeleccionada = document.querySelector('input[name="puerta"]:checked');
    const puerta = puertaSeleccionada ? puertaSeleccionada.value : 'mexico-tacuba';
    
    const ahora = new Date();
    
    // Verificar si es sin credencial
    const sinCredencial = tipo === 'manual';
    
    // Verificar retardo (simplificado)
    const tieneRetardo = await this.verificarRetardoSimple(alumnoData.horario);
    
    // Actualizar contadores
    if (tieneRetardo || sinCredencial) {
        await this.actualizarContadores(alumnoData.alumno.Boleta, tieneRetardo, sinCredencial);
    }
    
    // Crear registro
    await this.crearRegistroBD(
        alumnoData.alumno.Boleta, 
        alumnoData.alumno.Grupo, 
        puerta,  // ← Usar la puerta seleccionada de los radio buttons
        tieneRetardo, 
        sinCredencial
    );
    
    // Mostrar resultados
    this.mostrarResultado(alumnoData, tieneRetardo, sinCredencial, puerta);
}

    async verificarRetardoSimple(horario) {
        const hoy = new Date().getDay();
        const dias = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
        const horarioHoy = horario.filter(h => h.Dia === dias[hoy] && h.Activa);
        
        if (horarioHoy.length === 0) return false;
        
        const primeraHora = horarioHoy.sort((a, b) => a.Hora - b.Hora)[0];
        const horaActual = new Date();
        const horaClase = new Date(`${horaActual.toDateString()} ${primeraHora.HoraInicio}`);
        
        return (horaActual - horaClase) > (20 * 60 * 1000); // 20 minutos
    }

    async actualizarContadores(boleta, tieneRetardo, sinCredencial) {
        const updates = {};
        if (tieneRetardo) updates.retardos = true;
        if (sinCredencial) updates.sin_credencial = true;

        await fetch(`${this.apiBase}/alumnos/${boleta}/actualizar`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updates)
        });
    }

    async crearRegistroBD(boleta, grupo, puerta, tieneRetardo, sinCredencial) {
        await fetch(`${this.apiBase}/registros`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                boleta: boleta,
                grupo: grupo,
                puerta: puerta,
                registro: new Date().toISOString(),
                tieneRetardo: tieneRetardo,
                sinCredencial: sinCredencial
            })
        });
    }

    mostrarResultado(alumnoData, tieneRetardo, sinCredencial, puerta) {
    const alumno = alumnoData.alumno;
    
    // Llenar campos
    document.getElementById('nombre-output').value = alumno.Nombre;
    document.getElementById('boleta-output').value = alumno.Boleta;
    document.getElementById('grupo-output').value = alumno.Grupo;
    
    // USAR EL HORARIO FORMATEADO DEL BACKEND
    document.getElementById('horario-output').value = alumnoData.horarioFormateado || this.obtenerHorarioTexto(alumnoData.horario);
    
    document.getElementById('retardos-output').value = (alumno.Retardos || 0) + (tieneRetardo ? 1 : 0);
    document.getElementById('sin-credencial-output').value = (alumno.Sin_credencial || 0) + (sinCredencial ? 1 : 0);

    // Mostrar estado - INCLUIR LA PUERTA USADA
    let mensaje = `Registro exitoso - Puerta: ${this.formatearNombrePuerta(puerta)}`;
    if (tieneRetardo && sinCredencial) {
        mensaje = `Registro con retardo y sin credencial - Puerta: ${this.formatearNombrePuerta(puerta)}`;
    } else if (tieneRetardo) {
        mensaje = `Registro con retardo - Puerta: ${this.formatearNombrePuerta(puerta)}`;
    } else if (sinCredencial) {
        mensaje = `Registro sin credencial - Puerta: ${this.formatearNombrePuerta(puerta)}`;
    }
    
    this.mostrarEstado(mensaje, 'success');
    
    // Limpiar inputs
    setTimeout(() => {
        document.getElementById('manual-input').value = '';
        document.getElementById('qr-input').value = '';
    }, 2000);
}
    obtenerHorarioTexto(horario) {
    if (!horario || horario.length === 0) return 'Sin horario';
    
    // Si ya viene formateado del backend, usarlo
    if (this.horarioFormateado) return this.horarioFormateado;
    
    // Si no, calcular primera y última hora
    const horas = horario.map(h => h.HoraInicio).sort();
    if (horas.length === 0) return 'Sin horario';
    
    const primeraHora = horas[0].substring(0, 5);
    const ultimaHora = horas[horas.length - 1].substring(0, 5);
    
    return `${primeraHora} - ${ultimaHora}`;
}

    mostrarEstado(mensaje, tipo) {
        const statusIndicator = document.getElementById('status-indicator');
        const statusMessage = document.getElementById('status-message');
        
        statusMessage.textContent = mensaje;
        statusIndicator.style.backgroundColor = tipo === 'success' ? '#4CAF50' : '#f44336';
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
};
}

// Inicializar
document.addEventListener('DOMContentLoaded', () => {
    new RegistroSystem();
});

// AGREGAR ESTA FUNCIÓN AL FINAL DE LA CLASE
