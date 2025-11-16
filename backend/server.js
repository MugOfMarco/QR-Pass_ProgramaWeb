// backend/server.js - VERSIÓN SIMPLIFICADA CON STORED PROCEDURES
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

// --- ENDPOINTS SIMPLIFICADOS ---

// Endpoint básico para probar
app.get('/api/test', (req, res) => {
    res.json({ message: 'API funcionando correctamente' });
});

// Obtener datos completos del alumno
app.get('/api/alumno/:boleta', async (req, res) => {
    try {
        const boleta = parseInt(req.params.boleta);
        
        const connection = await mysql.createConnection(dbConfig);
        
        const [results] = await connection.query('CALL sp_obtener_alumno_completo(?)', [boleta]);
        
        await connection.end();

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

// Crear registro de entrada/salida
app.post('/api/registros', async (req, res) => {
    try {
        const { boleta, puerta, id_tipo_registro } = req.body;
        
        console.log('[REGISTRO] Datos recibidos:', { boleta, puerta, id_tipo_registro });
        
        const connection = await mysql.createConnection(dbConfig);
        
        // Crear registro
        const [result] = await connection.query(
            'CALL sp_crear_registro(?, ?, ?)', 
            [boleta, puerta, id_tipo_registro]
        );
        
        const id_registro = result[0][0].id_registro;
        
        // Si es incidencia, incrementar contador
        if (id_tipo_registro === 2 || id_tipo_registro === 4) { // 2=retardo, 4=sin_credencial
            const tipo_incidencia = id_tipo_registro === 2 ? 'retardo' : 'sin_credencial';
            await connection.query(
                'CALL sp_actualizar_contadores_alumno(?, ?, ?)',
                [boleta, tipo_incidencia, 'incrementar']
            );
        }
        
        await connection.end();

        res.json({ 
            success: true, 
            message: 'Registro creado correctamente',
            id_registro: id_registro
        });
        
    } catch (error) {
        console.error('❌ Error creando registro:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error creando registro: ' + error.message
        });
    }
});

// Obtener incidencias del alumno
app.get('/api/incidencias/alumno/:boleta', async (req, res) => {
    try {
        const boleta = parseInt(req.params.boleta);
        
        const connection = await mysql.createConnection(dbConfig);
        
        const [results] = await connection.query('CALL sp_obtener_incidencias_alumno(?)', [boleta]);
        
        await connection.end();

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

// Crear justificación
app.post('/api/justificaciones', async (req, res) => {
    try {
        const { id_registro, justificacion, id_tipo_anterior } = req.body;
        
        console.log('[JUSTIFICACION] Datos recibidos:', { id_registro, justificacion, id_tipo_anterior });
        
        const connection = await mysql.createConnection(dbConfig);
        
        const [result] = await connection.query(
            'CALL sp_crear_justificacion(?, ?, ?)', 
            [id_registro, justificacion, id_tipo_anterior]
        );
        
        const id_justificacion = result[0][0].id_justificacion;
        
        await connection.end();

        res.json({ 
            success: true, 
            message: 'Justificación creada correctamente',
            id_justificacion: id_justificacion
        });
        
    } catch (error) {
        console.error('❌ Error creando justificación:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error creando justificación: ' + error.message
        });
    }
});

// Endpoint para diagnóstico
app.get('/api/diagnostico/alumno/:boleta', async (req, res) => {
    try {
        const boleta = parseInt(req.params.boleta);
        
        const connection = await mysql.createConnection(dbConfig);
        
        // Datos del alumno
        const [alumnoRows] = await connection.query(
            'SELECT a.boleta, a.nombre, g.nombre_grupo, ia.sin_credencial, ia.retardos FROM Alumnos a JOIN Grupo g ON a.id_grupo = g.id_grupo JOIN Info_alumno ia ON a.boleta = ia.boleta WHERE a.boleta = ?',
            [boleta]
        );
        
        // Incidencias sin justificar
        const [incidenciasRows] = await connection.query(
            `SELECT COUNT(*) as count FROM Registros r
             LEFT JOIN Justificacion j ON r.id_registro = j.id_registro
             WHERE r.boleta = ? AND r.id_tipo_registro IN (2, 4)
             AND j.id_justificacion IS NULL`,
            [boleta]
        );

        await connection.end();

        res.json({ 
            success: true,
            alumno: alumnoRows[0] || null,
            incidencias_sin_justificar: incidenciasRows[0].count
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