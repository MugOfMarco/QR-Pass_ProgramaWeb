// backend/server.js - VERSIÓN FINAL Y CONSOLIDADA

// 1. Importaciones y Configuración de DOTENV
require('dotenv').config(); // Lee el archivo .env
const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcrypt');
const session = require('express-session');

// 2. Configuración de la App
const app = express();
const PORT = process.env.SERVER_PORT || 3000;

// 3. Configuración de la Base de Datos (Leyendo del .env)
const dbConfig = {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD, 
    database: process.env.DB_DATABASE,
    port: process.env.DB_PORT
};

// 4. Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Configuración de Sesión
app.use(session({
    secret: process.env.SESSION_SECRET, // Clave de seguridad crítica
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false } // 'false' para localhost
}));

// Archivos Estáticos (Frontend)
// Asumimos que los archivos están en la raíz y/o una carpeta 'frontend'
app.use(express.static(path.join(__dirname, '..'))); 
app.use(express.static(path.join(__dirname, '..', 'frontend')));


// 5. FUNCIÓN HELPER para ejecutar Stored Procedures
async function ejecutarSP(nombreSP, parametros = []) {
    const connection = await mysql.createConnection(dbConfig);
    try {
        // Genera la cadena de ? basándose en la cantidad de parámetros
        const placeholders = parametros.map(() => '?').join(',');
        // La sintaxis 'CALL nombreSP(?, ?, ?)' se construye dinámicamente
        const [results] = await connection.query(`CALL ${nombreSP}(${placeholders})`, parametros);
        return results;
    } finally {
        await connection.end();
    }
}


// =================================================================
// RUTAS DE NAVEGACIÓN (Protección y Redirección)
// =================================================================

// Ruta Raíz ('/') -> ACTÚA COMO REDIRECTOR INTELIGENTE
app.get('/', (req, res) => {
    // 1. Verificar si ya hay una sesión activa
    if (req.session.user) {
        
        // Redirigir según el rol
        if (req.session.user.tipo === 'Administrador') {
            return res.redirect('/admin-dashboard.html');
        } 
        else if (req.session.user.tipo === 'Prefecto') {
            return res.redirect('/Entrada_Salida.html');
        }
    }

    // 2. Si NO hay sesión activa, servir la página de Login (index.html)
    res.sendFile(path.join(__dirname, '..', 'index.html')); 
});


// Ruta Protegida: ESCÁNER (Entrada_Salida.html)
app.get('/Entrada_Salida.html', (req, res) => {
    // 1. Requerir Login
    if (!req.session.user) {
        return res.redirect('/'); 
    }
    
    // 2. Verificar Permisos (Prefecto o Administrador)
    const userType = req.session.user.tipo;
    if (userType === 'Prefecto' || userType === 'Administrador') {
        res.sendFile(path.join(__dirname, '..', 'Entrada_Salida.html'));
    } else {
        res.status(403).send('Permiso Denegado: Rol insuficiente.');
    }
});

// Ruta Protegida: DASHBOARD ADMIN (admin-dashboard.html)
app.get('/admin-dashboard.html', (req, res) => {
    // 1. Requerir Login
    if (!req.session.user) {
        return res.redirect('/');
    }
    
    // 2. Verificar Permisos (Solo Administrador)
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

// --- 1. AUTENTICACIÓN (LOGIN) ---
app.post('/api/login', async (req, res) => {
    // Coincide con las claves que el frontend envía: 'username' y 'password'
    const { username, password } = req.body; 

    try {
        // 1. Buscar usuario en BD usando SP
        // El SP espera el username
        const results = await ejecutarSP('sp_obtener_usuario_login', [username]); 
        const usuariosEncontrados = results[0];

        if (!usuariosEncontrados || usuariosEncontrados.length === 0) {
            return res.status(401).json({ success: false, message: 'Usuario o contraseña incorrectos' });
        }

        const userDb = usuariosEncontrados[0];

        // 2. Verificar contraseña encriptada (bcrypt)
        const passwordValida = await bcrypt.compare(password, userDb.password);

        if (!passwordValida) {
            return res.status(401).json({ success: false, message: 'Usuario o contraseña incorrectos' });
        }

        // 3. Crear Sesión
        req.session.user = {
            id: userDb.id_usuario,
            usuario: userDb.usuario,
            tipo: userDb.tipo_usuario,
            nombre: userDb.nombre_completo
        };

        res.json({ 
            success: true, 
            message: 'Login exitoso', 
            tipo: userDb.tipo_usuario 
        });

    } catch (error) {
        console.error('Error en login:', error);
        res.status(500).json({ success: false, message: 'Error interno del servidor' });
    }
});

// --- 2. LOGOUT ---
app.post('/api/logout', (req, res) => {
    req.session.destroy();
    res.json({ success: true, message: 'Sesión cerrada correctamente' });
});

// --- LÓGICA DE ALUMNOS (Usando tus SPs) ---

// Obtener datos completos del alumno
app.get('/api/alumno/:boleta', async (req, res) => {
    try {
        const boleta = parseInt(req.params.boleta);
        
        const results = await ejecutarSP('sp_obtener_alumno_completo', [boleta]);

        // results[0] es el primer result set (info alumno)
        if (!results[0] || results[0].length === 0) {
            return res.status(404).json({ success: false, message: 'Alumno no encontrado' });
        }

        res.json({
            success: true,
            alumno: results[0][0],          // Info básica
            horario: results[1],            // Segundo result set (Horario)
            materiasAcreditadas: results[2] // Tercer result set (Acreditadas)
        });

    } catch (error) {
        console.error('Error obteniendo alumno:', error);
        res.status(500).json({ success: false, message: 'Error interno del servidor' });
    }
});

// Crear registro de entrada/salida
app.post('/api/registros', async (req, res) => {
    try {
        const { boleta, puerta, id_tipo_registro } = req.body;
        
        console.log('[REGISTRO] Datos recibidos:', { boleta, puerta, id_tipo_registro });
        
        const connection = await mysql.createConnection(dbConfig);
        
        try {
            // 1. Crear registro
            const [result] = await connection.query(
                'CALL sp_crear_registro(?, ?, ?)', 
                [boleta, puerta, id_tipo_registro]
            );
            
            const id_registro = result[0][0].id_registro;
            
            // 2. Actualizar contadores si es incidencia
            // Tipos: 2 = Retardo, 4 = Justificado (pero aquí debe ser Sin Credencial, id 3 según tu SQL)
            // REVISIÓN: En tu SQL pusiste: 2='retardo', 3='sin_credencial'. Ajusto la lógica:
            
            if (id_tipo_registro === 2 || id_tipo_registro === 3) { 
                const tipo_incidencia = id_tipo_registro === 2 ? 'retardo' : 'sin_credencial';
                
                await connection.query(
                    'CALL sp_actualizar_contadores_alumno(?, ?, ?)',
                    [boleta, tipo_incidencia, 'incrementar']
                );
            }
            
            res.json({ 
                success: true, 
                message: 'Registro creado correctamente',
                id_registro: id_registro
            });
            
        } finally {
            await connection.end();
        }
        
    } catch (error) {
        console.error('❌ Error creando registro:', error);
        res.status(500).json({ success: false, message: 'Error creando registro: ' + error.message });
    }
});

// Obtener incidencias
app.get('/api/incidencias/alumno/:boleta', async (req, res) => {
    try {
        const boleta = parseInt(req.params.boleta);
        const results = await ejecutarSP('sp_obtener_incidencias_alumno', [boleta]);

        res.json({ 
            success: true, 
            incidencias: results[0] 
        });
        
    } catch (error) {
        console.error('Error obteniendo incidencias:', error);
        res.status(500).json({ success: false, message: 'Error obteniendo incidencias' });
    }
});

// Crear justificación
app.post('/api/justificaciones', async (req, res) => {
    try {
        const { id_registro, justificacion, id_tipo_anterior } = req.body;
        
        const connection = await mysql.createConnection(dbConfig);
        try {
            const [result] = await connection.query(
                'CALL sp_crear_justificacion(?, ?, ?)', 
                [id_registro, justificacion, id_tipo_anterior]
            );
            
            res.json({ 
                success: true, 
                message: 'Justificación creada',
                id_justificacion: result[0][0].id_justificacion
            });
        } finally {
            await connection.end();
        }
        
    } catch (error) {
        console.error('Error creando justificación:', error);
        res.status(500).json({ success: false, message: 'Error: ' + error.message });
    }
});

// Bloquear/Desbloquear credencial
app.put('/api/alumnos/bloquear/:boleta', async (req, res) => {
    // ... (Lógica para bloquear usando SP existente)
    /* Nota: Usamos sp_actualizar_contadores_alumno con un "truco" si el SP lo soporta, 
       o idealmente crearías un SP específico 'sp_bloquear_alumno' en SQL.
       Por ahora usaré lógica directa para mantener compatibilidad con tu código previo */
    try {
        const boleta = parseInt(req.params.boleta);
        // Aquí idealmente llamarías a un SP. Si no tienes uno específico, 
        // asegúrate de que tu SQL tenga un UPDATE para el campo 'bloqueado'.
        // Ejemplo Genérico:
        const connection = await mysql.createConnection(dbConfig);
        await connection.query('UPDATE Info_alumno SET bloqueado = 1 WHERE boleta = ?', [boleta]);
        await connection.end();

        res.json({ success: true, message: 'Alumno bloqueado' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error al bloquear' });
    }
});

app.put('/api/alumnos/desbloquear/:boleta', async (req, res) => {
    try {
        const boleta = parseInt(req.params.boleta);
        const connection = await mysql.createConnection(dbConfig);
        await connection.query('UPDATE Info_alumno SET bloqueado = 0 WHERE boleta = ?', [boleta]);
        await connection.end();
        res.json({ success: true, message: 'Alumno desbloqueado' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error al desbloquear' });
    }
});

// Diagnóstico
app.get('/api/diagnostico/alumno/:boleta', async (req, res) => {
    try {
        const boleta = parseInt(req.params.boleta);
        const results = await ejecutarSP('sp_obtener_alumno_completo', [boleta]);
        
        const alumno = results[0][0] || null;
        // Lógica simple de ejemplo para incidencias
        const incidenciasSinJustificar = (alumno && alumno.retardos + alumno.sin_credencial) || 0;

        res.json({ 
            success: true,
            alumno: alumno,
            incidencias_sin_justificar: incidenciasSinJustificar
        });
        
    } catch (error) {
        console.error('Error en diagnóstico:', error);
        res.status(500).json({ success: false, message: 'Error en diagnóstico' });
    }
});


// 6. Iniciar Servidor
app.listen(PORT, () => {
    console.log(`✅ Servidor API corriendo en http://localhost:${PORT}`);
    console.log(`   - Login: http://localhost:${PORT}/`);
});