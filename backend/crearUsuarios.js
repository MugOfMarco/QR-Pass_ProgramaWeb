const bcrypt = require('bcrypt');

const passwordPlana = 'asdfgh123'; // <--- Pon aquí la contraseña que quieras
const saltRounds = 10;

bcrypt.hash(passwordPlana, saltRounds, function(err, hash) {
    console.log("Copia este hash y úsalo en tu INSERT de SQL:");
    console.log(hash);
});