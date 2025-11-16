// backend/server.js - VERSIÓN SOLO STORED PROCEDURES
const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const path = require('path'); 

const app = express();

// MIDDLEWARES
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../index.html'));
});

const PORT = 3000;

// Configuración de la Base de Datos
const dbConfig = {
    host: 'localhost',
    user: 'root',
    password: 'Qeqrqt131415',
    database: 'cecyt9',
    port: 3306
};

// --- FUNCIÓN HELPER PARA EJECUTAR STORED PROCEDURES ---
async function ejecutarSP(nombreSP, parametros = []) {
    const connection = await mysql.createConnection(dbConfig);
    try {
        const [results] = await connection.query(`CALL ${nombreSP}(?)`, parametros);
        return results;
    } finally {
        await connection.end();
    }
}

// --- ENDPOINTS EXCLUSIVAMENTE CON STORED PROCEDURES ---

// Endpoint básico para probar
app.get('/api/test', (req, res) => {
    res.json({ message: 'API funcionando correctamente' });
});

// Obtener datos completos del alumno usando SP
app.get('/api/alumno/:boleta', async (req, res) => {
    try {
        const boleta = parseInt(req.params.boleta);
        
        const results = await ejecutarSP('sp_obtener_alumno_completo', [boleta]);

        if (results[0].length === 0) {
            return res.status(404).json({ 
                success: false, 
                message: 'Alumno no encontrado' 
            });
        }

        res.json({
            success: true,
            alumno: results[0][0],
            horario: results[1],
            materiasAcreditadas: results[2]
        });

    } catch (error) {
        console.error('Error obteniendo alumno:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error interno del servidor' 
        });
    }
});

// Crear registro de entrada/salida usando SP
app.post('/api/registros', async (req, res) => {
    try {
        const { boleta, puerta, id_tipo_registro } = req.body;
        
        console.log('[REGISTRO] Datos recibidos:', { boleta, puerta, id_tipo_registro });
        
        const connection = await mysql.createConnection(dbConfig);
        
        try {
            // Crear registro usando SP
            const [result] = await connection.query(
                'CALL sp_crear_registro(?, ?, ?)', 
                [boleta, puerta, id_tipo_registro]
            );
            
            const id_registro = result[0][0].id_registro;
            
            // Si es incidencia, incrementar contador usando SP
            if (id_tipo_registro === 2 || id_tipo_registro === 4) {
                const tipo_incidencia = id_tipo_registro === 2 ? 'retardo' : 'sin_credencial';
                await connection.query(
                    'CALL sp_actualizar_contadores_alumno(?, ?, ?)',
                    [boleta, tipo_incidencia, 'incrementar']
                );
            }
            
            res.json({ 
                success: true, 
                message: 'Registro creado correctamente',
                id_registro: id_registro
            });
            
        } finally {
            await connection.end();
        }
        
    } catch (error) {
        console.error('❌ Error creando registro:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error creando registro: ' + error.message
        });
    }
});

// Obtener incidencias del alumno usando SP
app.get('/api/incidencias/alumno/:boleta', async (req, res) => {
    try {
        const boleta = parseInt(req.params.boleta);
        
        const results = await ejecutarSP('sp_obtener_incidencias_alumno', [boleta]);

        res.json({ 
            success: true, 
            incidencias: results[0] 
        });
        
    } catch (error) {
        console.error('Error obteniendo incidencias:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error obteniendo incidencias' 
        });
    }
});

// Crear justificación usando SP
app.post('/api/justificaciones', async (req, res) => {
    try {
        const { id_registro, justificacion, id_tipo_anterior } = req.body;
        
        console.log('[JUSTIFICACION] Datos recibidos:', { id_registro, justificacion, id_tipo_anterior });
        
        const connection = await mysql.createConnection(dbConfig);
        
        try {
            const [result] = await connection.query(
                'CALL sp_crear_justificacion(?, ?, ?)', 
                [id_registro, justificacion, id_tipo_anterior]
            );
            
            const id_justificacion = result[0][0].id_justificacion;
            
            res.json({ 
                success: true, 
                message: 'Justificación creada correctamente',
                id_justificacion: id_justificacion
            });
            
        } finally {
            await connection.end();
        }
        
    } catch (error) {
        console.error('❌ Error creando justificación:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error creando justificación: ' + error.message
        });
    }
});

// Bloquear/Desbloquear credencial usando SP
app.put('/api/alumnos/bloquear/:boleta', async (req, res) => {
    try {
        const boleta = parseInt(req.params.boleta);
        
        const connection = await mysql.createConnection(dbConfig);
        
        try {
            await connection.query(
                'CALL sp_actualizar_contadores_alumno(?, ?, ?)',
                [boleta, 'bloqueado', 'incrementar'] // Usamos el mismo SP para bloquear
            );
            
            res.json({ 
                success: true, 
                message: 'Credencial bloqueada correctamente'
            });
            
        } finally {
            await connection.end();
        }
        
    } catch (error) {
        console.error('Error bloqueando credencial:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error bloqueando credencial' 
        });
    }
});

app.put('/api/alumnos/desbloquear/:boleta', async (req, res) => {
    try {
        const boleta = parseInt(req.params.boleta);
        
        const connection = await mysql.createConnection(dbConfig);
        
        try {
            await connection.query(
                'CALL sp_actualizar_contadores_alumno(?, ?, ?)',
                [boleta, 'bloqueado', 'decrementar'] // Usamos el mismo SP para desbloquear
            );
            
            res.json({ 
                success: true, 
                message: 'Credencial desbloqueada correctamente'
            });
            
        } finally {
            await connection.end();
        }
        
    } catch (error) {
        console.error('Error desbloqueando credencial:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error desbloqueando credencial' 
        });
    }
});

// Obtener foto del alumno (si tienes un SP para esto)
app.get('/api/alumnos/foto/:boleta', async (req, res) => {
    try {
        const boleta = parseInt(req.params.boleta);
        
        // Si tienes un SP para fotos, úsalo aquí
        // const results = await ejecutarSP('sp_obtener_foto_alumno', [boleta]);
        
        // Por ahora retornamos un placeholder
        res.json({ 
            success: true, 
            foto: null // o la URL de la foto si la obtienes del SP
        });
        
    } catch (error) {
        console.error('Error obteniendo foto:', error);
        res.json({ 
            success: false, 
            message: 'Error obteniendo foto' 
        });
    }
});

// Endpoint para diagnóstico usando SPs
app.get('/api/diagnostico/alumno/:boleta', async (req, res) => {
    try {
        const boleta = parseInt(req.params.boleta);
        
        // Usamos el SP principal para obtener datos del alumno
        const results = await ejecutarSP('sp_obtener_alumno_completo', [boleta]);
        
        const alumno = results[0][0] || null;
        const incidenciasSinJustificar = results[0].filter(row => 
            !row.justificado // Asumiendo que tu SP retorna este campo
        ).length;

        res.json({ 
            success: true,
            alumno: alumno,
            incidencias_sin_justificar: incidenciasSinJustificar
        });
        
    } catch (error) {
        console.error('Error en diagnóstico:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error en diagnóstico' 
        });
    }
});

// --- Inicia el servidor ---
app.listen(PORT, () => {
    console.log(`Servidor API corriendo en http://localhost:${PORT}`);
});