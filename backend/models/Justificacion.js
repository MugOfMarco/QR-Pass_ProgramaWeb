const { ejecutarSP } = require('../database/db');

class Justificacion {
    static async crear(data) {
        const results = await ejecutarSP('sp_crear_justificacion', [
            data.id_registro,
            data.justificacion,
            data.id_tipo_anterior
        ]);
        return results[0] && results[0][0] ? results[0][0] : null;
    }

    static async obtenerPorAlumno(boleta) {
        const results = await ejecutarSP('sp_obtener_justificaciones_alumno', [boleta]);
        return results[0] || [];
    }
}

module.exports = Justificacion;