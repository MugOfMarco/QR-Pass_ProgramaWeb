// backend/models/Justificacion.js

// ANTES: const { ejecutarSP } = require('../database/db');
import { ejecutarSP } from '../database/db.js'; // Importación ESM y añadimos la extensión .js

class Justificacion {
    static async crear(data) {
        // Llama al SP para crear una nueva justificación
        const results = await ejecutarSP('sp_crear_justificacion', [
            data.id_registro,
            data.justificacion,
            data.id_tipo_anterior
        ]);
        return results[0] && results[0][0] ? results[0][0] : null;
    }

    static async obtenerPorAlumno(boleta) {
        // Llama al SP para obtener todas las justificaciones de un alumno
        const results = await ejecutarSP('sp_obtener_justificaciones_alumno', [boleta]);
        return results[0] || [];
    }
}

// ANTES: module.exports = Justificacion;
export default Justificacion;