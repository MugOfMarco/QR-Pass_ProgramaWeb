const { ejecutarSP } = require('../database/db');

class Alumno {
    static async obtenerCompleto(boleta) {
        const results = await ejecutarSP('sp_obtener_alumno_completo', [boleta]);
        
        if (!results[0] || results[0].length === 0) {
            return null;
        }

        return {
            info: results[0][0],
            horario: results[1],
            materiasAcreditadas: results[2]
        };
    }

    static async buscar(query) {
        const results = await ejecutarSP('sp_buscar_alumnos', [`%${query}%`]);
        return results[0] || [];
    }

    static async bloquear(boleta) {
        const results = await ejecutarSP('sp_bloquear_alumno', [boleta, 1]);
        return results[0] && results[0][0] ? results[0][0] : null;
    }

    static async desbloquear(boleta) {
        const results = await ejecutarSP('sp_desbloquear_alumno', [boleta, 0]);
        return results[0] && results[0][0] ? results[0][0] : null;
    }

    static async verificarBloqueo(boleta) {
        const results = await ejecutarSP('sp_verificar_bloqueo_alumno', [boleta]);
        return results[0] && results[0][0] ? results[0][0] : null;
    }
}

module.exports = Alumno;