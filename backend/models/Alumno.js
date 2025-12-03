// backend/models/Alumno.js

// ANTES: const { ejecutarSP } = require('../database/db');
import { ejecutarSP } from '../database/db.js'; // Importación ESM y añadimos la extensión .js

class Alumno {
    static async obtenerCompleto(boleta) {
        const results = await ejecutarSP('sp_obtener_alumno_completo', [boleta]);
        
        if (!results[0] || results[0].length === 0) {
            return null;
        }

        // Aseguramos que la estructura de datos sea limpia para el Controller
        return {
            info: results[0][0],
            horario: results[1],
            materiasAcreditadas: results[2]
        };
    }

    static async buscar(query) {
        // Utilizamos el comodín % en la consulta, como lo tenías definido.
        const results = await ejecutarSP('sp_buscar_alumnos', [`%${query}%`]);
        return results[0] || [];
    }

    static async bloquear(boleta) {
        // Lógica: Llama al SP para bloquear (valor 1)
        const results = await ejecutarSP('sp_bloquear_alumno', [boleta, 1]);
        // Devuelve el primer resultado (o null si el alumno no existe/no se modificó)
        return results[0] && results[0][0] ? results[0][0] : null; 
    }

    static async desbloquear(boleta) {
        // Lógica: Llama al SP para desbloquear (valor 0)
        const results = await ejecutarSP('sp_desbloquear_alumno', [boleta, 0]);
        return results[0] && results[0][0] ? results[0][0] : null;
    }

    static async verificarBloqueo(boleta) {
        // Lógica: Llama al SP para obtener el estado de bloqueo
        const results = await ejecutarSP('sp_verificar_bloqueo_alumno', [boleta]);
        return results[0] && results[0][0] ? results[0][0] : null;
    }
}

// ANTES: module.exports = Alumno;
export default Alumno;