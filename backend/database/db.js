// backend/database/db.js

// Usamos 'mysql2/promise' para la sintaxis async/await
import mysql from 'mysql2/promise'; 
import dotenv from 'dotenv';

// Cargar las variables de entorno
dotenv.config();

// 1. Configuración de la Base de Datos (Lectura del .env)
const dbConfig = {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    port: process.env.DB_PORT, 
};

// 2. Usar un Pool de Conexiones (Mejora el rendimiento)
const pool = mysql.createPool(dbConfig);

// 3. Función para ejecutar Stored Procedures (CRUCIAL)
async function ejecutarSP(nombreSP, parametros = []) {
    // Obtener una conexión del pool y envolverla en promesas
    const connection = await pool.getConnection(); 
    try {
        const placeholders = parametros.map(() => '?').join(',');
        
        // Ejecutar el procedimiento almacenado
        const [results] = await connection.query(
            `CALL ${nombreSP}(${placeholders})`,
            parametros
        );
        return results;
    } catch (error) {
        console.error(`Error en SP ${nombreSP}:`, error.message);
        throw error; // Propagar el error al controlador
    } finally {
        // Liberar la conexión de vuelta al pool
        connection.release();
    }
}

// 4. Función de Verificación de Conexión (Para el inicio del servidor)
async function verificarConexion() {
    try {
        const connection = await pool.getConnection();
        console.log('Conexión a MySQL establecida y Pool creado.');
        connection.release();
        return true;
    } catch (error) {
        console.error('🔴 Error conectando a MySQL:', error.message);
        return false;
    }
}

// 5. Exportar las funciones y objetos necesarios (Usamos 'module.exports' por consistencia con Node.js CJS)
export default {
    ejecutarSP,
    verificarConexion,
    pool,
    dbConfig
};