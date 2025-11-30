// backend/controllers/alumnos.controller.js

const { ejecutarSP } = require('../database/db'); 
const mysql = require('mysql2/promise'); // Necesario para la conexión directa en Registro
// Importar dbConfig directamente o re-crearla si es necesario para conexión interna
// Asumimos que dbConfig es accesible o que db.js la exporta. Usaremos la sintaxis directa para evitar errores:
const dbConfig = require('../database/db').dbConfig; // Asumiendo que db.js exporta dbConfig


// --- 1. LECTURA DE DATOS DE ALUMNO (R) ---
exports.obtenerAlumno = async (req, res) => {
    try {
        const boleta = parseInt(req.params.boleta);
        const results = await ejecutarSP('sp_obtener_alumno_completo', [boleta]);

        if (!results[0] || results[0].length === 0) {
            return res.status(404).json({ success: false, message: 'Alumno no encontrado' });
        }

        res.json({
            success: true,
            alumno: results[0][0],          // Info básica
            horario: results[1],            // Horario
            materiasAcreditadas: results[2] // Acreditadas
        });
    } catch (error) {
        console.error('Error obteniendo alumno (Controller):', error);
        res.status(500).json({ success: false, message: 'Error interno del servidor' });
    }
};

// --- 2. CREAR REGISTRO DE ASISTENCIA (C) ---
exports.crearRegistro = async (req, res) => {
    // Recibe boleta, puerta, id_tipo_registro, tieneRetardo, sinCredencial
    const { boleta, puerta, id_tipo_registro, tieneRetardo, sinCredencial } = req.body;
    
    // El registro es una transacción compleja: usamos conexión directa aquí
    const connection = await mysql.createConnection(dbConfig);
    
    try {
        // 1. Crear registro principal
        const [result] = await connection.query(
            'CALL sp_crear_registro(?, ?, ?)', 
            [boleta, puerta, id_tipo_registro]
        );
        
        // 2. Actualizar contadores DE FORMA INDIVIDUAL (CRÍTICO)
        if (tieneRetardo) {
            await connection.query(
                'CALL sp_actualizar_contadores_alumno(?, ?, ?)', 
                [boleta, 'retardo', 'incrementar']
            );
        }
        
        if (sinCredencial) {
            await connection.query(
                'CALL sp_actualizar_contadores_alumno(?, ?, ?)', 
                [boleta, 'sin_credencial', 'incrementar']
            );
        }
        
        res.json({ 
            success: true, 
            message: 'Registro creado correctamente',
            id_registro: result[0][0].id_registro
        });
        
    } catch (error) {
        console.error('❌ Error en el Controller de registro:', error);
        res.status(500).json({ success: false, message: 'Error creando registro: ' + error.message });
    } finally {
        await connection.end();
    }
};


// --- 3. BLOQUEO/DESBLOQUEO Y ESTADO (U) ---

// Bloquear Credencial
exports.bloquearCredencial = async (req, res) => {
    try {
        const boleta = parseInt(req.params.boleta);
        const connection = await mysql.createConnection(dbConfig);
        const [result] = await connection.query('UPDATE Info_alumno SET bloqueado = 1 WHERE boleta = ?', [boleta]);
        await connection.end();

        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'Alumno no encontrado.' });
        }
        res.json({ success: true, message: 'Credencial bloqueada correctamente.' });
    } catch (error) {
        console.error('Error al bloquear credencial:', error);
        res.status(500).json({ success: false, message: 'Error en el servidor al bloquear.' });
    }
};

// Desbloquear Credencial
exports.desbloquearCredencial = async (req, res) => {
    try {
        const boleta = parseInt(req.params.boleta);
        const connection = await mysql.createConnection(dbConfig);
        const [result] = await connection.query('UPDATE Info_alumno SET bloqueado = 0 WHERE boleta = ?', [boleta]);
        await connection.end();

        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'Alumno no encontrado.' });
        }
        res.json({ success: true, message: 'Credencial desbloqueada correctamente.' });
    } catch (error) {
        console.error('Error al desbloquear credencial:', error);
        res.status(500).json({ success: false, message: 'Error en el servidor al desbloquear.' });
    }
};

// Verificar Bloqueo
exports.verificarBloqueo = async (req, res) => {
    try {
        const boleta = parseInt(req.params.boleta);
        const connection = await mysql.createConnection(dbConfig);
        
        const [results] = await connection.query(
            'SELECT bloqueado FROM Info_alumno WHERE boleta = ?',
            [boleta]
        );
        await connection.end();

        if (results.length === 0) {
            return res.status(404).json({ success: false, message: 'Alumno no encontrado.' });
        }

        res.json({ 
            success: true,
            bloqueado: results[0].bloqueado === 1
        });
    } catch (error) {
        console.error('Error al verificar bloqueo:', error);
        res.status(500).json({ success: false, message: 'Error en el servidor al verificar.' });
    }
};