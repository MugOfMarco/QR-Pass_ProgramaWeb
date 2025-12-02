const { ejecutarSP } = require('../database/db');

class Usuario {
    static async obtenerPorUsername(username) {
        const results = await ejecutarSP('sp_obtener_usuario_login', [username]);
        return results[0] && results[0][0] ? results[0][0] : null;
    }

    static async crear(data) {
        const results = await ejecutarSP('sp_crear_usuario', [
            data.usuario,
            data.password,
            data.tipo_usuario,
            data.nombre_completo
        ]);
        return results[0] && results[0][0] ? results[0][0] : null;
    }
}

module.exports = Usuario;