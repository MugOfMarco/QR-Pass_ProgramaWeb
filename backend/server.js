

const express = require('express');
const mysql = require('mysql'); 
const app = express();
app.use(express.json()); 


const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'tu_password',
    database: 'tu_base_de_datos'
});

db.connect(err => {
    if (err) throw err;
    console.log('Conectado a la base de datos MySQL.');
});


app.post('/api/registrar', (req, res) => {

    //Recibimos los datos del frontend
    const { boleta, tipo, puerta, esManual } = req.body;

    // 2. Buscamos al alumno (como en tu código)
    const queryAlumno = "SELECT * FROM Alumnos WHERE boleta = ?";
    db.query(queryAlumno, [boleta], (err, alumnos) => {
        if (err) return res.status(500).json({ message: 'Error en el servidor' });

        if (alumnos.length === 0) {
            return res.status(404).json({ message: 'Alumno no inscrito' });
        }

        const alumno = alumnos[0];

        if (alumno.bloqueado) {
            return res.status(403).json({ message: 'Boleta bloqueada', alumno });
        }


        if (tipo === 'entrada') {
            // Lógica específica del registro manual
            if (esManual) {
                const newSinCredencial = alumno.sin_credencial + 1;
                if (newSinCredencial >= 4) {
                    return res.status(403).json({ message: 'Límite de incidencias sin credencial alcanzado', alumno });
                }

                db.query("UPDATE Alumnos SET sin_credencial = ? WHERE boleta = ?", [newSinCredencial, boleta]);
            }
            

            const tipoRegistro = esManual ? 'Entrada sin credencial' : 'Entrada exitosa';

            //insertar registro
            const queryInsert = "INSERT INTO Registros (boleta, nombre, grupo, puerta, fecha, tipo) VALUES (?, ?, ?, ?, NOW(), ?)";
            db.query(queryInsert, [boleta, alumno.nombre, alumno.grupo, puerta, tipoRegistro], (err, result) => {
                if (err) return res.status(500).json({ message: 'Error al guardar el registro' });

                //respuesta que ira al frontend
                return res.status(200).json({ message: tipoRegistro, alumno });
            });

             //salida
        } else { 
            const queryInsert = "INSERT INTO Registros (boleta, nombre, grupo, puerta, fecha, tipo) VALUES (?, ?, ?, ?, NOW(), 'Salida')";
            db.query(queryInsert, [boleta, alumno.nombre, alumno.grupo, puerta], (err, result) => {
                 if (err) return res.status(500).json({ message: 'Error al guardar el registro de salida' });

                return res.status(200).json({ message: 'Salida exitosa', alumno });
            });
        }
    });
});


app.listen(3000, () => {
    console.log('Servidor escuchando en el puerto 3000');
});