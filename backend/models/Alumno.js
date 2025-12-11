import { ejecutarSP } from '../database/db.js';

class Alumno {
    static async obtenerCompleto(boleta) {
        const results = await ejecutarSP('sp_obtener_alumno_completo', [boleta]);

        if (!results[0] || results[0].length === 0) {
            return null;
        }

        // Aseguramos que la estructura de datos sea limpia para el Controller
        const alumnoInfo = {
            info: results[0][0],
            horario: results[1],
            materiasAcreditadas: results[2]
        };

        // Log para debug
        console.log('Datos del alumno obtenidos:');
        console.log('Boleta:', alumnoInfo.info.boleta);
        console.log('Nombre:', alumnoInfo.info.nombre);
        console.log('URL de imagen:', alumnoInfo.info.url);

        return alumnoInfo;
    }

    static async buscar(query) {
        const results = await ejecutarSP('sp_buscar_alumnos', [query]);
        
        // Obtener la URL para cada alumno encontrado
        const alumnosConURL = await Promise.all(
            (results[0] || []).map(async (alumno) => {
                try {
                    // Obtener información completa para tener la URL
                    const infoCompleta = await this.obtenerCompleto(alumno.boleta);
                    return {
                        ...alumno,
                        url: infoCompleta?.info?.url || null
                    };
                } catch (error) {
                    console.error(`Error obteniendo URL para boleta ${alumno.boleta}:`, error);
                    return {
                        ...alumno,
                        url: null
                    };
                }
            })
        );
        
        return alumnosConURL;
    }

    static async bloquear(boleta) {
        const results = await ejecutarSP('sp_bloquear_alumno', [boleta]);
        return {
            filas_afectadas: results[0] && results[0][0] ? results[0][0].filas_afectadas : 0
        };
    }

    static async desbloquear(boleta) {
        const results = await ejecutarSP('sp_desbloquear_alumno', [boleta]);
        return {
            filas_afectadas: results[0] && results[0][0] ? results[0][0].filas_afectadas : 0
        };
    }

    static async verificarBloqueo(boleta) {
        const results = await ejecutarSP('sp_verificar_bloqueo_alumno', [boleta]);
        return results[0] && results[0][0] ? results[0][0] : null;
    }

    static async obtenerRegistros(boleta) {
        const results = await ejecutarSP('sp_obtener_registros_alumno', [boleta]);
        return results[0] || [];
    }

    // NUEVO: Método para obtener solo información básica con URL
    static async obtenerBasico(boleta) {
        const results = await ejecutarSP('sp_obtener_alumno_completo', [boleta]);
        
        if (!results[0] || results[0].length === 0) {
            return null;
        }

        return {
            boleta: results[0][0].boleta,
            nombre: results[0][0].nombre,
            nombre_grupo: results[0][0].nombre_grupo,
            carrera: results[0][0].carrera,
            estado_academico: results[0][0].estado_academico,
            sin_credencial: results[0][0].sin_credencial,
            retardos: results[0][0].retardos,
            puerta_abierta: results[0][0].puerta_abierta,
            bloqueado: results[0][0].bloqueado,
            url: results[0][0].url
        };
    }
}

export default Alumno;