// backend/server.js - VERSIÓN FINAL COMPLETA (Login + SPs)

// 1. Importaciones
const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcrypt');
const session = require('express-session');

// 2. Configuración de la App
const app = express();
const PORT = 3000;

// 3. Configuración de la Base de Datos
const dbConfig = {
    host: 'localhost',
    user: 'root',
    password: 'n0m3l0', // Tu contraseña actual
    database: 'cecyt9',
    port: 3306
};

// 4. Middlewares
app.use(cors());
app.use(express.json());

// Configuración de Sesión (Para el Login)
app.use(session({
    secret: 'cecyt9_clave_secreta_super_segura', // Puedes cambiar esto
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false } // 'false' porque estamos en localhost (http)
}));

// 5. Archivos Estáticos (Frontend)
// Sirve archivos desde la carpeta 'frontend' (donde está index.html, css, js)
app.use(express.static(path.join(__dirname, '../frontend')));
// Sirve archivos desde la raíz (donde tienes login.html y login.js)
app.use(express.static(path.join(__dirname, '..')));


// 6. Función Helper para ejecutar Stored Procedures (Limpia el código)
async function ejecutarSP(nombreSP, parametros = []) {
    const connection = await mysql.createConnection(dbConfig);
    try {
        // Prepara los signos de interrogación según la cantidad de parámetros
        const placeholders = parametros.map(() => '?').join(',');
        const [results] = await connection.query(`CALL ${nombreSP}(${placeholders})`, parametros);
        return results;
    } finally {
        await connection.end();
    }
}


// ==========================================
// RUTAS DE NAVEGACIÓN (VISTAS HTML)
// ==========================================

// Ruta Raíz -> Manda al Login
app.get('/', (req, res) => {
    // Si ya hay sesión iniciada, redirigir según rol (Opcional, por ahora mandamos al login)
    res.sendFile(path.join(__dirname, '../login.html')); 
});

// Ruta Protegida -> El Escáner QR (Solo Prefectos)
app.get('/index.html', (req, res) => {
    // Verificar si el usuario está logueado y es Prefecto
    if (req.session.user && req.session.user.tipo === 'Prefecto') {
        res.sendFile(path.join(__dirname, '../frontend/index.html'));
    } else {
        // Si no tiene permiso, regresar al login
        res.redirect('/');
    }
});


// ==========================================
// API ENDPOINTS (LÓGICA)
// ==========================================

// --- AUTENTICACIÓN (LOGIN / LOGOUT) ---

app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;

    // --- AÑADE ESTA LÍNEA (1) ---
    console.log(`[DEBUG LOGIN] Intento de: ${usuario}`);

    try {
        // 1. Buscar usuario en BD usando SP
        const results = await ejecutarSP('sp_obtener_usuario_login', [usuario]);
        const usuariosEncontrados = results[0];

        if (usuariosEncontrados.length === 0) {
            // --- AÑADE ESTA LÍNEA (2) ---
            console.log(`[DEBUG LOGIN] 🛑 Error: Usuario ${usuario} no encontrado en BD.`);
            return res.status(401).json({ success: false, message: 'Usuario no encontrado' });
        }

        const userDb = usuariosEncontrados[0];

        // --- AÑADE ESTA LÍNEA (3) ---
        console.log(`[DEBUG LOGIN] Hash BD recuperado: ${userDb.password}`);

        // 2. Verificar contraseña encriptada
        // NOTA: Asegúrate de haber insertado usuarios con contraseñas hasheada en la BD
        const passwordValida = await bcrypt.compare(password, userDb.password);

        if (!passwordValida) {
            return res.status(401).json({ success: false, message: 'Contraseña incorrecta' });
        }

        // 3. Guardar sesión
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


// 7. Iniciar Servidor
app.listen(PORT, () => {
    console.log(`✅ Servidor API corriendo en http://localhost:${PORT}`);
    console.log(`   - Login: http://localhost:${PORT}/`);
    console.log(`   - Scanner: http://localhost:${PORT}/index.html`);
});