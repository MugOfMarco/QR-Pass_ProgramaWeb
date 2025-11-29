// Funcionalidad para bloquear/desbloquear credenciales

// Obtener referencias a los botones
const btnBloquear = document.getElementById('btn-bloquear-credencial');
const btnDesbloquear = document.getElementById('btn-desbloquear-credencial');
const inputBoleta = document.getElementById('search-boleta-inc');
const estadoCredencialSpan = document.getElementById('estado-credencial');

// Variable para almacenar el estado actual de bloqueo
let credencialBloqueada = false;
let boletaActual = null;

// Función para bloquear credencial
btnBloquear.addEventListener('click', async () => {
    const boleta = inputBoleta.value.trim();
    
    if (!boleta) {
        alert('Por favor, ingrese una boleta primero');
        return;
    }
    
    try {
        // Verificar el estado actual
        const responseCheck = await fetch(`/api/verificar-estado-credencial/${boleta}`);
        const dataCheck = await responseCheck.json();
        
        if (dataCheck.bloqueado) {
            alert('La credencial ya está bloqueada');
            return;
        }
        
        // Bloquear la credencial
        const response = await fetch('/api/bloquear-credencial', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ boleta: boleta, bloqueado: 1 })
        });
        
        const data = await response.json();
        
        if (data.success) {
            alert('Credencial bloqueada exitosamente');
            credencialBloqueada = true;
            estadoCredencialSpan.textContent = 'Bloqueada';
            estadoCredencialSpan.style.color = 'red';
        } else {
            alert('Error al bloquear la credencial: ' + data.message);
        }
        
    } catch (error) {
        console.error('Error:', error);
        alert('Error al procesar la solicitud');
    }
});

// Función para desbloquear credencial
btnDesbloquear.addEventListener('click', async () => {
    const boleta = inputBoleta.value.trim();
    
    if (!boleta) {
        alert('Por favor, ingrese una boleta primero');
        return;
    }
    
    try {
        // Verificar el estado actual
        const responseCheck = await fetch(`/api/verificar-estado-credencial/${boleta}`);
        const dataCheck = await responseCheck.json();
        
        if (!dataCheck.bloqueado) {
            alert('La credencial ya está desbloqueada');
            return;
        }
        
        // Desbloquear la credencial
        const response = await fetch('/api/bloquear-credencial', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ boleta: boleta, bloqueado: 0 })
        });
        
        const data = await response.json();
        
        if (data.success) {
            alert('Credencial desbloqueada exitosamente');
            credencialBloqueada = false;
            estadoCredencialSpan.textContent = 'Activa';
            estadoCredencialSpan.style.color = 'green';
        } else {
            alert('Error al desbloquear la credencial: ' + data.message);
        }
        
    } catch (error) {
        console.error('Error:', error);
        alert('Error al procesar la solicitud');
    }
});

// API endpoints que necesitas en tu backend (Node.js/Express ejemplo):

/*
// Endpoint para verificar estado de credencial
app.get('/api/verificar-estado-credencial/:boleta', async (req, res) => {
    const { boleta } = req.params;
    
    try {
        const query = 'SELECT bloqueado FROM Info_alumno WHERE boleta = ?';
        const [results] = await connection.query(query, [boleta]);
        
        if (results.length > 0) {
            res.json({ bloqueado: results[0].bloqueado === 1 });
        } else {
            res.status(404).json({ error: 'Alumno no encontrado' });
        }
    } catch (error) {
        res.status(500).json({ error: 'Error en el servidor' });
    }
});

// Endpoint para bloquear/desbloquear credencial
app.post('/api/bloquear-credencial', async (req, res) => {
    const { boleta, bloqueado } = req.body;
    
    try {
        const query = 'UPDATE Info_alumno SET bloqueado = ? WHERE boleta = ?';
        const [result] = await connection.query(query, [bloqueado, boleta]);
        
        if (result.affectedRows > 0) {
            res.json({ success: true, message: 'Estado actualizado' });
        } else {
            res.status(404).json({ success: false, message: 'Alumno no encontrado' });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error en el servidor' });
    }
});
*/