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
    password: 'n0m3l0',
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
// Obtener incidencias de un alumno (actualizado)
app.get('/api/incidencias/alumno/:boleta', async (req, res) => {
    try {
        const { boleta } = req.params;
        
        const connection = await mysql.createConnection(dbConfig);
        
        // ✅ Obtener registros que son incidencias (no salidas ni entradas normales)
        // Y que NO tengan reporte de justificación
        const [rows] = await connection.query(
            `SELECT r.* 
             FROM Registros r
             LEFT JOIN Reportes rep ON r.id_registro = rep.id_registro
             WHERE r.Boleta = ? 
             AND r.tipo IN ('retardo', 'sin_credencial')  -- ← Solo tipos individuales ahora
             AND rep.id_registro IS NULL  -- Solo incidencias no justificadas
             ORDER BY r.Registro DESC`,
            [boleta]
        );

        await connection.end();

        res.json({ 
            success: true, 
            incidencias: rows 
        });
        
    } catch (error) {
        console.error('Error obteniendo incidencias:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error obteniendo incidencias' 
        });
    }
});

// Crear reporte de justificación
// Endpoint corregido para crear reportes
app.post('/api/reportes', async (req, res) => {
    try {
        const { id_registro, tipo_incidencia, fecha_incidencia, justificacion, fecha_reporte } = req.body;
        
        console.log('[REPORTE] Datos recibidos:', {
            id_registro, tipo_incidencia, fecha_incidencia, justificacion, fecha_reporte
        });
        
        const connection = await mysql.createConnection(dbConfig);

        // Convertir fechas ISO a formato MySQL
        const convertirFechaMySQL = (fechaISO) => {
            if (!fechaISO) return new Date().toISOString().slice(0, 19).replace('T', ' ');
            
            const fecha = new Date(fechaISO);
            // Ajustar a zona horaria México (UTC-6)
            const offsetMexico = -6 * 60 * 60 * 1000; // UTC-6 en milisegundos
            const fechaMexico = new Date(fecha.getTime() + offsetMexico);
            
            return fechaMexico.toISOString().slice(0, 19).replace('T', ' ');
        };

        const fechaIncidenciaMySQL = convertirFechaMySQL(fecha_incidencia);
        const fechaReporteMySQL = convertirFechaMySQL(fecha_reporte);
        
        console.log('[REPORTE] Fechas convertidas:', {
            fechaIncidenciaMySQL,
            fechaReporteMySQL
        });
        
        const [result] = await connection.query(
            `INSERT INTO Reportes (id_registro, tipo_incidencia, fecha_incidencia, justificacion, fecha_reporte) 
             VALUES (?, ?, ?, ?, ?)`,
            [id_registro, tipo_incidencia, fechaIncidenciaMySQL, justificacion, fechaReporteMySQL]
        );

        await connection.end();

        res.json({ 
            success: true, 
            message: 'Reporte creado correctamente',
            id_reporte: result.insertId
        });
        
    } catch (error) {
        console.error('❌ Error creando reporte:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error creando reporte: ' + error.message,
            sql: error.sql
        });
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

// ✅ ENDPOINT MODIFICADO - Crear registros separados para retardo_sin_credencial
app.post('/api/registros', async (req, res) => {
    try {
        const { boleta, grupo, puerta, registro, tipo, tieneRetardo, sinCredencial } = req.body;
        
        console.log(`[REGISTRO] Datos recibidos:`, {
            boleta, grupo, puerta, tipo, tieneRetardo, sinCredencial
        });
        
        const connection = await mysql.createConnection(dbConfig);
        
        // CONVERTIR fecha ISO a formato MySQL
        const fechaMySQL = new Date(registro).toISOString().slice(0, 19).replace('T', ' ');
        
        let resultados = [];
        
        // ✅ MODIFICACIÓN: Si es retardo_sin_credencial, crear 2 registros separados
        if (tipo === 'retardo_sin_credencial') {
            console.log(`[REGISTRO] Creando 2 registros separados para retardo_sin_credencial`);
            
            // Registro 1: Retardo
            const [result1] = await connection.query(
                'INSERT INTO Registros (Boleta, Grupo, Puerta, Registro, tipo) VALUES (?, ?, ?, ?, ?)',
                [boleta, grupo, puerta, fechaMySQL, 'retardo']
            );
            resultados.push(result1);
            
            // Registro 2: Sin credencial
            const [result2] = await connection.query(
                'INSERT INTO Registros (Boleta, Grupo, Puerta, Registro, tipo) VALUES (?, ?, ?, ?, ?)',
                [boleta, grupo, puerta, fechaMySQL, 'sin_credencial']
            );
            resultados.push(result2);
            
            console.log(`[REGISTRO] Creados 2 registros: Retardo(ID:${result1.insertId}), SinCredencial(ID:${result2.insertId})`);
            
        } else {
            // Registro normal (entrada, salida, retardo individual, sin_credencial individual)
            const [result] = await connection.query(
                'INSERT INTO Registros (Boleta, Grupo, Puerta, Registro, tipo) VALUES (?, ?, ?, ?, ?)',
                [boleta, grupo, puerta, fechaMySQL, tipo]
            );
            resultados.push(result);
            console.log(`[REGISTRO] Insertado con ID: ${result.insertId}`);
        }

        // ✅ ACTUALIZAR CONTADORES SOLO AL REGISTRAR (NO al justificar)
        if (tipo !== 'salida') {
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
            message: 'Registro(s) creado(s) correctamente',
            tipo: tipo,
            ids_registros: resultados.map(r => r.insertId),
            registros_creados: resultados.length
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