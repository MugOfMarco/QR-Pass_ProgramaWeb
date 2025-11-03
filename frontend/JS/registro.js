// registro.js - Versión simplificada para tu servidor actual
class RegistroSystem {
    constructor() {
        this.apiBase = 'http://localhost:3000/api';
        this.initEventListeners();
    }

    initEventListeners() {
        document.getElementById('manual-input').addEventListener('input', (e) => {
            this.handleBoletaInput(e.target.value, 'manual');
        });

        document.getElementById('qr-input').addEventListener('input', (e) => {
            this.handleBoletaInput(e.target.value, 'qr');
        });
    }

    async handleBoletaInput(boleta, tipo) {
        if (boleta.length < 5) return;

        try {
            const response = await fetch(`${this.apiBase}/horarios/alumno/${boleta}`);
            const data = await response.json();
            
            if (data.success) {
                await this.procesarRegistro(data, tipo);
            } else {
                this.mostrarError('Alumno no encontrado');
            }
        } catch (error) {
            console.error('Error:', error);
            this.mostrarError('Error de conexión');
        }
    }

    async procesarRegistro(alumnoData, tipo) {
        const puerta = document.querySelector('input[name="puerta"]:checked').value;
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
            puerta, 
            tieneRetardo, 
            sinCredencial
        );
        
        // Mostrar resultados
        this.mostrarResultado(alumnoData, tieneRetardo, sinCredencial);
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

    mostrarResultado(alumnoData, tieneRetardo, sinCredencial) {
        const alumno = alumnoData.alumno;
        
        // Llenar campos
        document.getElementById('nombre-output').value = alumno.Nombre;
        document.getElementById('boleta-output').value = alumno.Boleta;
        document.getElementById('grupo-output').value = alumno.Grupo;
        document.getElementById('horario-output').value = this.obtenerHorarioTexto(alumnoData.horario);
        document.getElementById('retardos-output').value = (alumno.Retardos || 0) + (tieneRetardo ? 1 : 0);
        document.getElementById('sin-credencial-output').value = (alumno.Sin_credencial || 0) + (sinCredencial ? 1 : 0);

        // Mostrar estado
        let mensaje = 'Registro exitoso';
        if (tieneRetardo && sinCredencial) {
            mensaje = 'Registro con retardo y sin credencial';
        } else if (tieneRetardo) {
            mensaje = 'Registro con retardo';
        } else if (sinCredencial) {
            mensaje = 'Registro sin credencial';
        }
        
        this.mostrarEstado(mensaje, 'success');
        
        // Limpiar inputs
        setTimeout(() => {
            document.getElementById('manual-input').value = '';
            document.getElementById('qr-input').value = '';
        }, 2000);
    }

    obtenerHorarioTexto(horario) {
        const hoy = new Date().getDay();
        const dias = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
        const horarioHoy = horario.filter(h => h.Dia === dias[hoy] && h.Activa);
        
        if (horarioHoy.length === 0) return 'Sin horario hoy';
        
        return horarioHoy.map(h => 
            `${h.HoraInicio.substring(0,5)}-${h.HoraFin.substring(0,5)} ${h.materia}`
        ).join(' / ');
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
}

// Inicializar
document.addEventListener('DOMContentLoaded', () => {
    new RegistroSystem();
});