// backend/models/Registro.js

// ANTES: const { ejecutarSP } = require('../database/db');
import { ejecutarSP } from '../database/db.js'; // Importación ESM y añadimos la extensión .js

class Registro {
    static async crear(data) {
        // Llama al SP para crear un nuevo registro de asistencia
        const results = await ejecutarSP('sp_crear_registro', [
            data.boleta,
            data.puerta,
            data.id_tipo_registro
        ]);
        return results[0] && results[0][0] ? results[0][0] : null; // Devuelve el ID del registro creado
    }

    static async actualizarContadores(boleta, tipo, accion) {
        // Llama al SP para incrementar/decrementar contadores de retardo/sin_credencial
        const results = await ejecutarSP('sp_actualizar_contadores_alumno', [
            boleta,
            tipo, // 'retardo' o 'sin_credencial'
            accion // 'incrementar' o 'decrementar'
        ]);
        return results[0] && results[0][0] ? results[0][0] : null;
    }

    static async obtenerPorAlumno(boleta) {
        // Llama al SP para obtener el historial de registros de un alumno
        const results = await ejecutarSP('sp_obtener_registros_alumno', [boleta]);
        return results[0] || [];
    }
}

// ANTES: module.exports = Registro;
export default Registro;