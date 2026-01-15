import mysql from 'mysql2/promise'; // O la importación de tu BD
import dotenv from 'dotenv';
import bcrypt from 'bcrypt'; // <--- ESTA ES LA QUE TE FALTA

dotenv.config();

const passwordPlana = 'Root123'; // <--- Pon aquí la contraseña que quieras
const saltRounds = 10;

bcrypt.hash(passwordPlana, saltRounds, function(err, hash) {
    console.log("Copia este hash y úsalo en tu INSERT de SQL:");
    console.log(hash);
});