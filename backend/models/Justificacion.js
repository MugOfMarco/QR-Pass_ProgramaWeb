// backend/models/Justificacion.js

// ANTES: const { ejecutarSP } = require('../database/db');
import { ejecutarSP } from '../database/db.js'; // Importación ESM y añadimos la extensión .js

class Justificacion {
    static async crear(data) {
        const results = await ejecutarSP('sp_crear_justificacion', [
            data.id_registro,
            data.justificacion,
            data.id_tipo_anterior
        ]);
        
        // 1. Verificar si el SP devolvió una fila con el ID (Manejo de SELECT final en el SP)
        if (results && results[0] && results[0][0]) {
            return results[0][0]; // Devuelve la fila de datos si existe (e.g., { id_justificacion: X })
        }

        // 2. Si el SP se ejecutó sin errores pero no devolvió filas de datos (solo metadatos de UPDATE/INSERT),
        // devolvemos un objeto de éxito simple. Esto garantiza que el controlador no falle.
        if (results && results.length > 0) {
            // Devolvemos un objeto 'truthy' con un ID nulo, suficiente para que el controller asuma el éxito
            return { id_justificacion: null, success: true };
        }
        
        // 3. Fallo total (Si results es null o vacío)
        return null;
    }

    static async obtenerPorAlumno(boleta) {
        // Llama al SP para obtener todas las justificaciones de un alumno
        const results = await ejecutarSP('sp_obtener_justificaciones_alumno', [boleta]);
        return results[0] || [];
    }
}

// ANTES: module.exports = Justificacion;
export default Justificacion;