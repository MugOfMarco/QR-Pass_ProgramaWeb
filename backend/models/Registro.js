const { ejecutarSP } = require('../database/db');

class Registro {
    static async crear(data) {
        const results = await ejecutarSP('sp_crear_registro', [
            data.boleta,
            data.puerta,
            data.id_tipo_registro
        ]);
        return results[0] && results[0][0] ? results[0][0] : null;
    }

    static async actualizarContadores(boleta, tipo, accion) {
        const results = await ejecutarSP('sp_actualizar_contadores_alumno', [
            boleta,
            tipo,
            accion
        ]);
        return results[0] && results[0][0] ? results[0][0] : null;
    }

    static async obtenerPorAlumno(boleta) {
        const results = await ejecutarSP('sp_obtener_registros_alumno', [boleta]);
        return results[0] || [];
    }
}

module.exports = Registro;