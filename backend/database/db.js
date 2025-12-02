import mysql from 'mysql2';
import dotenv from 'dotenv';

// Cargar las variables de entorno
dotenv.config();

// Configuración de la Base de Datos (Leyendo del .env)
const dbConfig = {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    port: process.env.DB_PORT, // El puerto no es necesario
};

// Usar un pool de conexiones para mejorar el rendimiento
const pool = mysql.createPool(dbConfig);

// Crear una función para ejecutar Stored Procedures
async function ejecutarSP(nombreSP, parametros = []) {
    const connection = await pool.promise().getConnection(); // Usar promesas con el pool de conexiones
    try {
        const placeholders = parametros.map(() => '?').join(',');
        const [results] = await connection.query(`CALL ${nombreSP}(${placeholders})`, parametros);
        return results;
    } catch (error) {
        console.error(`Error al ejecutar SP ${nombreSP}:`, error);
        throw error;
    } finally {
        connection.release(); // Liberar la conexión de vuelta al pool
    }
}

// Exportar la función para usarla en otras partes del proyecto
export { ejecutarSP, pool };
