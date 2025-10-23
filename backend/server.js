
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
    password: 'tu_contraseña_de_mysql', // CAMBIA ESTO
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

// --- Inicia el servidor ---
app.listen(PORT, () => {
    console.log(`Servidor API corriendo en http://localhost:${PORT}`);
});