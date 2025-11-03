app.use(express.json());
// Importa las librerías necesarias
const express = require('express');
const mysql = require('mysql2/promise'); // Usamos la versión con Promesas
const cors = require('cors');

// Configuración de la App
const app = express();
app.use(cors()); // Permite que tu HTML (en otro dominio/puerto) llame a este API
const PORT = 3000;

// Configuración de la Base de Datos
// (Usa los datos de tu MySQL Workbench)
const dbConfig = {
    host: 'localhost',
    user: 'root', // O tu usuario
    password: '', // CAMBIA ESTO
    database: 'CECYT9' // El nombre de tu base de datos
};

// --- Definición del API ---

// Este endpoint (URL) escucha peticiones GET en '/api/alumno/:boleta'
// :boleta es una variable que captura lo que venga en la URL
app.get('/api/alumno/:boleta', async (req, res) => {
    
    // 1. Obtiene la boleta de la URL
    const boleta = req.params.boleta;

    try {
        // 2. Conecta a la base de datos
        const connection = await mysql.createConnection(dbConfig);
        
        // 3. Prepara la consulta SQL (¡Importante! usa '?' para evitar inyección SQL)
        const sqlQuery = "SELECT Nombre, Grupo FROM ALumnos WHERE Boleta = ?";
        
        // 4. Ejecuta la consulta
        const [rows] = await connection.query(sqlQuery, [boleta]);
        
        await connection.end(); // Cierra la conexión

        // 5. Revisa si se encontró un alumno
        if (rows.length > 0) {
            // Si se encontró, devuelve el primer resultado como JSON
            const alumno = rows[0];
            res.json({
                nombre: alumno.Nombre,
                grupo: alumno.Grupo,
                boleta: boleta // Devolvemos la boleta para rellenar el campo
            });
        } else {
            // Si no hay resultados, devuelve un error 404 (No Encontrado)
            res.status(404).json({ message: 'Alumno no encontrado' });
        }
    } catch (error) {
        // Si algo falla en la base de datos
        console.error('Error en la consulta:', error);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
});

// Ruta para obtener datos completos del alumno con horario
app.get('/api/horarios/alumno/:boleta', async (req, res) => {
    const boleta = req.params.boleta;

    try {
        const connection = await mysql.createConnection(dbConfig);
        
        // Consulta para información del alumno
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

        // Consulta para horario del alumno
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

        // Consulta para materias acreditadas
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

// Ruta para actualizar contadores de alumno
app.post('/api/alumnos/:boleta/actualizar', async (req, res) => {
    try {
        const { boleta } = req.params;
        const { retardos, sin_credencial } = req.body;
        
        const connection = await mysql.createConnection(dbConfig);
        
        let updateQuery = 'UPDATE ALumnos SET ';
        const updates = [];
        const params = [];
        
        if (retardos) {
            updates.push('Retardos = Retardos + ?');
            params.push(1);
        }
        if (sin_credencial) {
            updates.push('Sin_credencial = Sin_credencial + ?');
            params.push(1);
        }
        
        if (updates.length > 0) {
            updateQuery += updates.join(', ') + ' WHERE Boleta = ?';
            params.push(boleta);
            
            await connection.query(updateQuery, params);
        }
        
        await connection.end();
        
        res.json({ success: true, message: 'Contadores actualizados' });
    } catch (error) {
        console.error('Error actualizando contadores:', error);
        res.status(500).json({ success: false, message: 'Error actualizando contadores' });
    }
});

// Ruta para crear registros
app.post('/api/registros', async (req, res) => {
    try {
        const { boleta, grupo, puerta, registro, tieneRetardo, sinCredencial } = req.body;
        
        const connection = await mysql.createConnection(dbConfig);
        
        // Insertar registro principal
        await connection.query(
            'INSERT INTO Registros (Boleta, Grupo, Puerta, Registro) VALUES (?, ?, ?, ?)',
            [boleta, grupo, puerta, registro]
        );

        // Crear reporte si hay incidencias
        if (tieneRetardo || sinCredencial) {
            const [registroInsertado] = await connection.query(
                'SELECT id_registro FROM Registros WHERE Boleta = ? ORDER BY id_registro DESC LIMIT 1',
                [boleta]
            );

            let tipoIncidencia = '';
            if (tieneRetardo && sinCredencial) {
                tipoIncidencia = 'Retardo y sin credencial';
            } else if (tieneRetardo) {
                tipoIncidencia = 'Retardo';
            } else {
                tipoIncidencia = 'Entrada sin credencial';
            }

            await connection.query(
                'INSERT INTO Reportes (id_registro, tipo_incidencia, fecha_incidencia, justificacion, fecha_reporte) VALUES (?, ?, ?, ?, ?)',
                [
                    registroInsertado[0].id_registro,
                    tipoIncidencia,
                    registro,
                    'Registro automático del sistema',
                    new Date()
                ]
            );
        }

        await connection.end();

        res.json({ success: true, message: 'Registro creado' });
    } catch (error) {
        console.error('Error creando registro:', error);
        res.status(500).json({ success: false, message: 'Error creando registro' });
    }
});

// --- Inicia el servidor ---
app.listen(PORT, () => {
    console.log(`Servidor API corriendo en http://localhost:${PORT}`);
});