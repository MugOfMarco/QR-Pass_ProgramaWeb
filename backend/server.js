// backend/server.js - VERSIÓN FINAL CONSOLIDADA Y FUNCIONAL

// 1. Importaciones y Configuración de DOTENV
require('dotenv').config(); // Lee el archivo .env
const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcrypt');
const session = require('express-session');

//modelos es todas las querys, donde se define una clase y lo unico que hacemos es llamarla desde controller
//controller es la validación antes de pasasr a modelos
//router es el mtedodo (get, post, put, delete) y la ruta, tambien se pone el 


// 2. Configuración de la App
const app = express();
const PORT = process.env.SERVER_PORT || 3000;

const __dirname = path.resolve();

// 4. Middlewares
app.use(cors());
app.use(express.json()); // Para procesar req.body en formato JSON
app.use(express.urlencoded({ extended: true })); // Para procesar datos de formularios estándar

// Configuración de Sesión
app.use(session({
    secret: process.env.SESSION_SECRET, // Clave de seguridad CRÍTICA
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false } // 'false' para localhost
}));

// Archivos Estáticos (Frontend)
// Asumimos que los archivos están en la raíz y/o una carpeta 'frontend'
app.use(express.static(path.join(__dirname, '..')));
app.use(express.static(path.join(__dirname, '..', 'frontend')));


// 5. FUNCIÓN HELPER para ejecutar Stored Procedures (Soporta N parámetros)
async function ejecutarSP(nombreSP, parametros = []) {
    const connection = await mysql.createConnection(dbConfig);
    try {
        const placeholders = parametros.map(() => '?').join(',');
        const [results] = await connection.query(`CALL ${nombreSP}(${placeholders})`, parametros);
        return results;
    } finally {
        await connection.end();
    }
}


// =================================================================
// RUTAS DE NAVEGACIÓN (Protección y Redirección)
// =================================================================

// Ruta Raíz ('/') -> ACTÚA COMO REDIRECTOR INTELIGENTE (Puente)
app.get('/', (req, res) => {
    if (req.session.user) {
        if (req.session.user.tipo === 'Administrador') {
            return res.redirect('/admin-dashboard.html');
        }
        else if (req.session.user.tipo === 'Prefecto') {
            return res.redirect('/Entrada_Salida.html'); // Escáner
        }
    }

    // Si NO hay sesión, servir la página de Login (index.html)
    res.sendFile(path.join(__dirname, '..', 'index.html'));
});


// Ruta Protegida: ESCÁNER (Entrada_Salida.html)
app.get('/Entrada_Salida.html', (req, res) => {
    if (!req.session.user) {
        return res.redirect('/');
    }

    const userType = req.session.user.tipo;
    // Permiso si es Prefecto O Administrador
    if (userType === 'Prefecto' || userType === 'Administrador') {
        res.sendFile(path.join(__dirname, '..', 'Entrada_Salida.html'));
    } else {
        res.status(403).send('Permiso Denegado: Rol insuficiente.');
    }
});

// Ruta Protegida: DASHBOARD ADMIN (admin-dashboard.html)
app.get('/admin-dashboard.html', (req, res) => {
    if (!req.session.user) {
        return res.redirect('/');
    }

    const userType = req.session.user.tipo;
    if (userType === 'Administrador') {
        res.sendFile(path.join(__dirname, '..', 'admin-dashboard.html'));
    } else {
        res.status(403).send('Permiso Denegado. Solo administradores pueden acceder.');
    }
});


// =================================================================
// API ENDPOINTS (LÓGICA)
// =================================================================

// --- 1. AUTENTICACIÓN (LOGIN / LOGOUT) ---

app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;

    try {
        const results = await ejecutarSP('sp_obtener_usuario_login', [username]);
        const usuariosEncontrados = results[0];

        if (!usuariosEncontrados || usuariosEncontrados.length === 0) {
            return res.status(401).json({ success: false, message: 'Usuario o contraseña incorrectos' });
        }

        const userDb = usuariosEncontrados[0];
        const passwordValida = await bcrypt.compare(password, userDb.password);

        if (!passwordValida) {
            return res.status(401).json({ success: false, message: 'Usuario o contraseña incorrectos' });
        }

        req.session.user = {
            id: userDb.id_usuario,
            usuario: userDb.usuario,
            tipo: userDb.tipo_usuario,
            nombre: userDb.nombre_completo
        };

        res.json({ success: true, tipo: userDb.tipo_usuario });

    } catch (error) {
        console.error('Error en login:', error);
        res.status(500).json({ success: false, message: 'Error interno del servidor' });
    }
});

app.post('/api/logout', (req, res) => {
    req.session.destroy();
    res.json({ success: true, message: 'Sesión cerrada correctamente' });
});


// --- 2. LÓGICA DE ALUMNOS (SP) ---

// Obtener datos completos del alumno (usado en el escáner)
app.get('/api/alumno/:boleta', async (req, res) => {
    try {
        const boleta = parseInt(req.params.boleta);
        const results = await ejecutarSP('sp_obtener_alumno_completo', [boleta]);

        if (!results[0] || results[0].length === 0) {
            return res.status(404).json({ success: false, message: 'Alumno no encontrado' });
        }

        res.json({
            success: true,
            alumno: results[0][0],
            horario: results[1],
            materiasAcreditadas: results[2]
        });

    } catch (error) {
        console.error('Error obteniendo alumno:', error);
        res.status(500).json({ success: false, message: 'Error interno del servidor' });
    }
});

// Crear registro de entrada/salida (con actualización de contadores)
app.post('/api/registros', async (req, res) => {
    // Recibe las banderas booleanas del frontend (registro.js)
    const { boleta, puerta, id_tipo_registro, tieneRetardo, sinCredencial } = req.body;

    const connection = await mysql.createConnection(dbConfig);

    try {
        // 1. Crear registro principal
        const [result] = await connection.query(
            'CALL sp_crear_registro(?, ?, ?)',
            [boleta, puerta, id_tipo_registro]
        );

        // 2. Actualizar contadores DE FORMA INDIVIDUAL (según las banderas)
        if (tieneRetardo) {
            await connection.query(
                'CALL sp_actualizar_contadores_alumno(?, ?, ?)',
                [boleta, 'retardo', 'incrementar']
            );
        }

        if (sinCredencial) {
            await connection.query(
                'CALL sp_actualizar_contadores_alumno(?, ?, ?)',
                [boleta, 'sin_credencial', 'incrementar']
            );
        }

        res.json({
            success: true,
            message: 'Registro creado correctamente',
            id_registro: result[0][0].id_registro
        });

    } catch (error) {
        console.error('❌ Error creando registro:', error);
        res.status(500).json({ success: false, message: 'Error creando registro: ' + error.message });
    } finally {
        await connection.end();
    }
});

// --- 3. BLOQUEO/DESBLOQUEO Y ESTADO ---

// Endpoint para Bloquear Credencial
app.put('/api/alumnos/bloquear/:boleta', async (req, res) => {
    try {
        const boleta = parseInt(req.params.boleta);
        const connection = await mysql.createConnection(dbConfig);
        const [result] = await connection.query('UPDATE Info_alumno SET bloqueado = 1 WHERE boleta = ?', [boleta]);
        await connection.end();

        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'Alumno no encontrado para bloquear.' });
        }
        res.json({ success: true, message: 'Credencial bloqueada correctamente.' });
    } catch (error) {
        console.error('Error al bloquear credencial:', error);
        res.status(500).json({ success: false, message: 'Error en el servidor al bloquear.' });
    }
});

// Endpoint para Desbloquear Credencial
app.put('/api/alumnos/desbloquear/:boleta', async (req, res) => {
    try {
        const boleta = parseInt(req.params.boleta);
        const connection = await mysql.createConnection(dbConfig);
        const [result] = await connection.query('UPDATE Info_alumno SET bloqueado = 0 WHERE boleta = ?', [boleta]);
        await connection.end();

        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'Alumno no encontrado para desbloquear.' });
        }
        res.json({ success: true, message: 'Credencial desbloqueada correctamente.' });
    } catch (error) {
        console.error('Error al desbloquear credencial:', error);
        res.status(500).json({ success: false, message: 'Error en el servidor al desbloquear.' });
    }
});

// Endpoint para verificar el estado de bloqueo
app.get('/api/verificar-bloqueo/:boleta', async (req, res) => {
    try {
        const boleta = parseInt(req.params.boleta);
        const connection = await mysql.createConnection(dbConfig);

        const [results] = await connection.query(
            'SELECT bloqueado FROM Info_alumno WHERE boleta = ?',
            [boleta]
        );
        await connection.end();

        if (results.length === 0) {
            return res.status(404).json({ success: false, message: 'Alumno no encontrado.' });
        }

        res.json({
            success: true,
            bloqueado: results[0].bloqueado === 1 // Devuelve true/false
        });
    } catch (error) {
        console.error('Error al verificar bloqueo:', error);
        res.status(500).json({ success: false, message: 'Error en el servidor al verificar.' });
    }
});


// ... Resto de tus endpoints de incidencias y justificaciones van aquí.

// 6. Iniciar Servidor
app.listen(PORT, () => {
    console.log(`✅ Servidor API corriendo en http://localhost:${PORT}`);
    console.log(`   - Login: http://localhost:${PORT}/`);
});