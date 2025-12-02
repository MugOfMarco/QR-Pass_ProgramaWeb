const mysql = require('mysql2/promise');
require('dotenv').config();

const dbConfig = {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    port: process.env.DB_PORT,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
};

const pool = mysql.createPool(dbConfig);

async function ejecutarSP(nombreSP, parametros = []) {
    const connection = await pool.getConnection();
    try {
        const placeholders = parametros.map(() => '?').join(',');
        const [results] = await connection.query(
            `CALL ${nombreSP}(${placeholders})`,
            parametros
        );
        return results;
    } catch (error) {
        console.error(`Error en SP ${nombreSP}:`, error.message);
        throw error;
    } finally {
        connection.release();
    }
}

async function verificarConexion() {
    try {
        const connection = await pool.getConnection();
        console.log('Conexión a MySQL establecida');
        connection.release();
        return true;
    } catch (error) {
        console.error('Error conectando a MySQL:', error.message);
        return false;
    }
}

module.exports = {
    ejecutarSP,
    verificarConexion,
    pool,
    dbConfig
};