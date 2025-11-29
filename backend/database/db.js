// backend/database/db.js

const mysql = require('mysql2/promise');
require('dotenv').config(); 

// Configuración de la Base de Datos (Leyendo del .env)
const dbConfig = {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD, 
    database: process.env.DB_DATABASE,
    port: process.env.DB_PORT
};

// FUNCIÓN HELPER para ejecutar Stored Procedures
async function ejecutarSP(nombreSP, parametros = []) {
    const connection = await mysql.createConnection(dbConfig);
    try {
        const placeholders = parametros.map(() => '?').join(',');
        const [results] = await connection.query(`CALL ${nombreSP}(${placeholders})`, parametros);
        return results;
    } catch (error) {
        // Enviar errores específicos del SP a la consola para debug
        console.error(`Error al ejecutar SP ${nombreSP}:`, error);
        throw error;
    } finally {
        await connection.end();
    }
}

module.exports = {
    ejecutarSP
};