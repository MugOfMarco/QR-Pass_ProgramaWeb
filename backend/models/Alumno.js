import { ejecutarSP } from '../database/db.js';

class Alumno {
    static async obtenerCompleto(boleta) {
        const results = await ejecutarSP('sp_obtener_alumno_completo', [boleta]);

        if (!results[0] || results[0].length === 0) {
            return null;
        }

        const alumnoInfo = {
            info: results[0][0],
            horario: results[1],
            materiasAcreditadas: results[2]
        };

        return alumnoInfo;
    }

    static async buscar(query) {
        const results = await ejecutarSP('sp_buscar_alumnos', [query]);
        return results[0] || [];
    }

    static async bloquear(boleta) {
        const results = await ejecutarSP('sp_bloquear_alumno', [boleta]);
        return {
            filas_afectadas: results[0] && results[0][0] ? results[0][0].filas_afectadas : 0
        };
    }

    static async registrarJustificacion(id_registro, justificacion, id_tipo_anterior) {
        try {
            const [result] = await pool.query(
                'CALL sp_crear_justificacion(?, ?, ?)',
                [id_registro, justificacion, id_tipo_anterior]
            );
            
            return {
                success: true,
                id_justificacion: result[0].id_justificacion
            };
        } catch (error) {
            console.error('Error registrando justificación:', error);
            throw error;
        }
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

    static async registrar(alumnoData) {
        const { boleta, nombre, nombre_grupo, estado_academico, url } = alumnoData;
        
        const results = await ejecutarSP('sp_registrar_alumno', [
            parseInt(boleta),
            nombre,
            nombre_grupo,
            estado_academico,
            url || 'https://res.cloudinary.com/depoh32sv/image/upload/v1765415709/vector-de-perfil-avatar-predeterminado-foto-usuario-medios-sociales-icono-183042379.jpg_jfpw3y.webp'
        ]);
        
        return {
            success: results[0] && results[0][0] ? results[0][0].success : false,
            message: results[0] && results[0][0] ? results[0][0].message : 'Error desconocido'
        };
    }

    static async modificar(boleta, alumnoData) {
        const { nombre, nombre_grupo, estado_academico, puerta_abierta, url } = alumnoData;
        
        const results = await ejecutarSP('sp_modificar_alumno', [
            parseInt(boleta),
            nombre,
            nombre_grupo,
            estado_academico,
            puerta_abierta || false,
            url
        ]);
        
        return {
            success: results[0] && results[0][0] ? results[0][0].success : false,
            message: results[0] && results[0][0] ? results[0][0].message : 'Error desconocido'
        };
    }

    static async eliminar(boleta) {
        const results = await ejecutarSP('sp_eliminar_alumno', [parseInt(boleta)]);
        
        return {
            success: results[0] && results[0][0] ? results[0][0].success : false,
            message: results[0] && results[0][0] ? results[0][0].message : 'Error desconocido'
        };
    }

    static async obtenerGrupos() {
        const sql = 'SELECT id_grupo, nombre_grupo FROM grupo ORDER BY nombre_grupo';
        const results = await ejecutarSP('', [], sql);
        return results[0] || [];
    }

    static async obtenerEstadosAcademicos() {
        const sql = 'SELECT id_estado, estado FROM estado_academico ORDER BY estado';
        const results = await ejecutarSP('', [], sql);
        return results[0] || [];
    }

    static async obtenerCarreras() {
        const sql = 'SELECT id_carrera, nombre FROM carrera ORDER BY nombre';
        const results = await ejecutarSP('', [], sql);
        return results[0] || [];
    }

    static async asignarHorario(boleta, idGrupo) {
        const results = await ejecutarSP('sp_asignar_horario_grupo', [
            parseInt(boleta),
            parseInt(idGrupo)
        ]);
        
        return {
            success: results[0] && results[0][0] ? results[0][0].success : false,
            message: results[0] && results[0][0] ? results[0][0].message : 'Error desconocido'
        };
    }
}

export default Alumno;