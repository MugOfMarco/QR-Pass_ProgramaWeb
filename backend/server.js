// backend/server.js - VERSIÓN CORREGIDA PARA HORA LOCAL
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
    database: 'CECYT9',
    port: 3306,
    timezone: '-06:00' // ← ¡IMPORTANTE! Agregar timezone de México
};

// --- ENDPOINTS ---

// Endpoint básico para probar
app.get('/api/test', (req, res) => {
    res.json({ message: '✅ API funcionando correctamente' });
});

// Endpoint para obtener alumno básico
app.get('/api/alumno/:boleta', async (req, res) => {
    const boleta = req.params.boleta;

    try {
        const connection = await mysql.createConnection(dbConfig);
        const sqlQuery = "SELECT Nombre, Grupo FROM ALumnos WHERE Boleta = ?";
        const [rows] = await connection.query(sqlQuery, [boleta]);
        await connection.end();

        if (rows.length > 0) {
            const alumno = rows[0];
            res.json({
                nombre: alumno.Nombre,
                grupo: alumno.Grupo,
                boleta: boleta
            });
        } else {
            res.status(404).json({ message: 'Alumno no encontrado' });
        }
    } catch (error) {
        console.error('Error en la consulta:', error);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
});

// Ruta para obtener datos completos del alumno con horario
app.get('/api/horarios/alumno/:boleta', async (req, res) => {
    const boleta = req.params.boleta;

    console.log(`[DEBUG] Recibí boleta: [${boleta}] (Tipo: ${typeof boleta})`);

    try {
        const connection = await mysql.createConnection(dbConfig);
        
        const [alumnoRows] = await connection.query(
            `SELECT a.Boleta, a.Nombre, a.Grupo, a.Sin_credencial, a.Retardos, 
                    a.Puerta_abierta, c.nombre as carrera, ea.estado as estado_academico
             FROM ALumnos a 
             LEFT JOIN Carrera c ON a.id_carrera = c.id_carrera 
             LEFT JOIN EstadoAcademico ea ON a.id_estado_academico = ea.id_estado
             WHERE a.Boleta = ?`,
            [boleta]
        );

        if (alumnoRows.length === 0) {
            await connection.end();
            return res.status(404).json({ 
                success: false, 
                message: 'Alumno no encontrado' 
            });
        }

        const alumno = alumnoRows[0];

        const [horarioRows] = await connection.query(
            `SELECT ha.Dia, ha.Hora, ha.HoraInicio, ha.HoraFin, 
                    m.nombre as materia, ha.Activa
             FROM HorarioAlumno ha
             JOIN Materia m ON ha.id_materia = m.id_materia
             WHERE ha.Boleta = ?
             ORDER BY 
                 FIELD(ha.Dia, 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'),
                 ha.Hora`,
            [boleta]
        );

        // CALCULAR PRIMERA Y ÚLTIMA HORA
        let primeraHora = null;
        let ultimaHora = null;

        if (horarioRows.length > 0) {
            const horasOrdenadas = horarioRows
                .map(h => h.HoraInicio)
                .sort();
            
            primeraHora = horasOrdenadas[0];
            ultimaHora = horasOrdenadas[horasOrdenadas.length - 1];
            
            alumno.horarioFormateado = `${primeraHora.substring(0, 5)} - ${ultimaHora.substring(0, 5)}`;
        } else {
            alumno.horarioFormateado = "Sin horario";
        }

        const [acreditadasRows] = await connection.query(
            `SELECT m.nombre, ma.fecha_acreditacion
             FROM MateriasAcreditadas ma
             JOIN Materia m ON ma.id_materia = m.id_materia
             WHERE ma.boleta = ?`,
            [boleta]
        );

        await connection.end();

        res.json({
            success: true,
            alumno: alumno,
            horario: horarioRows,
            horarioFormateado: alumno.horarioFormateado,
            materiasAcreditadas: acreditadasRows
        });

    } catch (error) {
        console.error('Error en la consulta:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error interno del servidor' 
        });
    }
});

// ✅ ENDPOINT CORREGIDO - VERSIÓN CON HORA LOCAL MÉXICO
app.post('/api/registros', async (req, res) => {
    try {
        const { boleta, grupo, puerta, registro, tipo, tieneRetardo, sinCredencial } = req.body;
        
        console.log(`[REGISTRO] Datos recibidos:`, {
            boleta, grupo, puerta, tipo, tieneRetardo, sinCredencial,
            registroRecibido: registro
        });
        
        const connection = await mysql.createConnection(dbConfig);
        
        // ✅ CORRECCIÓN: USAR HORA LOCAL DE MÉXICO
        let fechaMySQL;
        
        if (registro) {
            // Si viene la fecha del frontend, convertir a hora local México
            const fecha = new Date(registro);
            // Ajustar a UTC-6 (México)
            const offsetMexico = -6 * 60; // minutos
            const fechaMexico = new Date(fecha.getTime() + offsetMexico * 60 * 1000);
            fechaMySQL = fechaMexico.toISOString().slice(0, 19).replace('T', ' ');
        } else {
            // Si no viene fecha, usar hora actual del servidor (ya debería ser local)
            fechaMySQL = new Date().toISOString().slice(0, 19).replace('T', ' ');
        }
        
        console.log(`[REGISTRO] Fecha para MySQL: ${fechaMySQL}`);
        
        // ✅ INSERTAR EN BD
        const [result] = await connection.query(
            'INSERT INTO Registros (Boleta, Grupo, Puerta, Registro, tipo) VALUES (?, ?, ?, ?, ?)',
            [boleta, grupo, puerta, fechaMySQL, tipo]
        );

        console.log(`[REGISTRO] Insertado con ID: ${result.insertId}`);

        // ✅ ACTUALIZAR CONTADORES SOLO PARA ENTRADAS CON INCIDENCIAS
        if (tipo !== 'salida' && (tieneRetardo || sinCredencial)) {
            console.log(`[REGISTRO] Actualizando contadores para boleta ${boleta}`);
            
            let updateQuery = 'UPDATE ALumnos SET ';
            const updates = [];
            const params = [];
            
            if (tieneRetardo) {
                updates.push('Retardos = Retardos + 1');
            }
            if (sinCredencial) {
                updates.push('Sin_credencial = Sin_credencial + 1');
            }
            
            if (updates.length > 0) {
                updateQuery += updates.join(', ') + ' WHERE Boleta = ?';
                params.push(boleta);
                
                await connection.query(updateQuery, params);
                console.log(`[REGISTRO] Contadores actualizados: ${updates.join(', ')}`);
            }
        }

        await connection.end();

        res.json({ 
            success: true, 
            message: 'Registro creado correctamente',
            tipo: tipo,
            id_registro: result.insertId,
            fecha_registro: fechaMySQL // Para debug
        });
        
    } catch (error) {
        console.error('❌ Error creando registro:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error creando registro: ' + error.message,
            sql: error.sql
        });
    }
});

// Endpoint para ver registros recientes (para debug)
app.get('/api/registros/recientes', async (req, res) => {
    try {
        const connection = await mysql.createConnection(dbConfig);
        const [rows] = await connection.query(
            'SELECT * FROM Registros ORDER BY id_registro DESC LIMIT 10'
        );
        await connection.end();
        
        res.json({ success: true, registros: rows });
    } catch (error) {
        console.error('Error obteniendo registros:', error);
        res.status(500).json({ success: false, message: 'Error obteniendo registros' });
    }
});

// --- Inicia el servidor ---
app.listen(PORT, () => {
    console.log(`✅ Servidor API corriendo en http://localhost:${PORT}`);
    console.log(`📊 Endpoints disponibles:`);
    console.log(`   http://localhost:${PORT}/api/test`);
    console.log(`   http://localhost:${PORT}/api/alumno/12345`);
    console.log(`   http://localhost:${PORT}/api/horarios/alumno/12345`);
    console.log(`   http://localhost:${PORT}/api/registros`);
    console.log(`   http://localhost:${PORT}/api/registros/recientes ← Para debug`);
});