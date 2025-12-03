// backend/models/Usuario.js

// ANTES: const { ejecutarSP } = require('../database/db');
import { ejecutarSP } from '../database/db.js'; // Importación ESM y añadimos la extensión .js

class Usuario {
    static async obtenerPorUsername(username) {
        // Llama al SP para obtener los datos de login del usuario.
        const results = await ejecutarSP('sp_obtener_usuario_login', [username]);
        // Devuelve el objeto de usuario o null.
        return results[0] && results[0][0] ? results[0][0] : null;
    }

    static async crear(data) {
        // Llama al SP para crear un nuevo usuario en el sistema.
        const results = await ejecutarSP('sp_crear_usuario', [
            data.usuario,
            data.password, // NOTA: La contraseña DEBE ser hasheada en el Controller antes de este punto.
            data.tipo_usuario,
            data.nombre_completo
        ]);
        // Devuelve el resultado de la creación.
        return results[0] && results[0][0] ? results[0][0] : null;
    }
}

// ANTES: module.exports = Usuario;
export default Usuario;