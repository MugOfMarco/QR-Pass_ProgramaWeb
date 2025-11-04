// 1. IMPORTACIONES (Las herramientas que necesitamos)
const express = require('express');
const mysql = require('mysql2/promise'); // MySQL con promesas
const cors = require('cors');           // Para permitir la conexión desde el frontend
const bcrypt = require('bcrypt');       // Para comparar contraseñas

// 2. CONFIGURACIÓN INICIAL
const app = express();
app.use(cors());           // Permite peticiones
app.use(express.json());   // Permite leer el JSON que envía el login.js

// 3. CONFIGURACIÓN DE LA BASE DE DATOS
// ¡Esta es la "llave de la despensa" que NUNCA sale de este archivo!
const dbConfig = {
    host: 'localhost',
    user: 'root',
    password: 'tu_contraseña_de_mysql', // <-- ¡CAMBIA ESTO POR TU CONTRASEÑA!
    database: 'CECYT9'
};

// ---------------------------------------------------
// ENDPOINT #1: BUSCAR ALUMNO (el que ya tenías)
// ---------------------------------------------------
app.get('/api/alumno/:boleta', async (req, res) => {
    
    const boleta = req.params.boleta;

    try {
        const connection = await mysql.createConnection(dbConfig);
        
        // Consulta para buscar al alumno por boleta
        const sqlQuery = "SELECT Nombre, Grupo FROM ALumnos WHERE Boleta = ?";
        
        const [rows] = await connection.query(sqlQuery, [boleta]);
        
        await connection.end(); // Cierra la conexión

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
        console.error('Error en API /api/alumno:', error);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
});

// ---------------------------------------------------
// ENDPOINT #2: LOGIN (el nuevo)
// ---------------------------------------------------
app.post('/api/login', async (req, res) => {
    
    // Recibe el 'username' y 'password' que envió el login.js
    // CAMBIO: 'username' se recibe del body, no 'usuario'
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ message: 'Usuario y contraseña son requeridos' });
    }

    try {
        const connection = await mysql.createConnection(dbConfig);
        
        // Buscamos al usuario en la tabla 'UsuariosSistema' por la columna 'usuario'
        // Y verificamos que esté activo
        const sqlQuery = "SELECT * FROM UsuariosSistema WHERE usuario = ? AND activo = TRUE";
        
        // Usamos 'username' (lo que recibimos) para buscar en la columna 'usuario' (de la BD)
        const [rows] = await connection.query(sqlQuery, [username]);
        
        await connection.end();

        // Si no encontramos un usuario ACTIVO con ese nombre
        if (rows.length === 0) {
            return res.status(401).json({ message: 'Credenciales incorrectas o usuario inactivo' });
        }

        const user = rows[0]; // El usuario encontrado en la BD

        // Comparamos la contraseña del formulario (password) 
        // con la contraseña hasheada de la BD (user.contraseña)
        const passwordMatch = await bcrypt.compare(password, user.contraseña);

        if (passwordMatch) {
            // ¡ÉXITO! La contraseña coincide
            res.status(200).json({ 
                message: 'Login exitoso',
                tipo: user.tipo_usuario 
            });
        } else {
            // FRACASO. La contraseña no coincide
            res.status(401).json({ message: 'Credenciales incorrectas' });
        }

    } catch (error) {
        console.error('Error en API /api/login:', error);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
});

// ---------------------------------------------------
// 4. INICIAR EL SERVIDOR (La cocina "abre sus puertas")
// ---------------------------------------------------
const PORT = 3000; // El puerto donde correrá el servidor
app.listen(PORT, () => {
    console.log(`Servidor API (la cocina) corriendo en http://localhost:${PORT}`);
});