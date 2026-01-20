import Registro from '../models/Registro.js';
import Alumno from '../models/Alumno.js';

// 1. CREAR REGISTRO (Aquí está la corrección del BUG de Salida)
export const crearRegistro = async (req, res) => {
    try {
        const { boleta, puerta, id_tipo_registro, tieneRetardo, sinCredencial } = req.body;

        const alumno = await Alumno.obtenerCompleto(boleta);
        if (!alumno) {
            return res.status(404).json({
                success: false,
                message: 'Alumno no encontrado'
            });
        }

        // Crear el registro en la bitácora
        const registro = await Registro.crear({
            boleta,
            puerta,
            id_tipo_registro
        });

        // Actualizar contadores (Retardos)
        if (tieneRetardo) {
            await Registro.actualizarContadores(boleta, 'retardo', 'incrementar');
        }

        // CORRECCIÓN IMPORTANTE:
        // Solo aumentamos "sin credencial" si NO es una salida.
        // Asumimos que id_tipo_registro 1 es SALIDA.
        if (sinCredencial && id_tipo_registro !== 1) {
            await Registro.actualizarContadores(boleta, 'sin_credencial', 'incrementar');
        }

        res.json({
            success: true,
            message: 'Registro creado correctamente',
            id_registro: registro.id_registro
        });

    } catch (error) {
        console.error('Error creando registro:', error);
        res.status(500).json({
            success: false,
            message: 'Error creando registro: ' + error.message
        });
    }
};

// 2. OBTENER REGISTROS POR ALUMNO (Se mantiene igual)
export const obtenerRegistrosPorAlumno = async (req, res) => {
    try {
        const boleta = parseInt(req.params.boleta);
        
        const alumno = await Alumno.obtenerCompleto(boleta);
        if (!alumno) {
            return res.status(404).json({ success: false, message: 'Alumno no encontrado' });
        }

        const registros = await Registro.obtenerPorAlumno(boleta);

        res.json({
            success: true,
            boleta,
            registros,
            total: registros.length
        });

    } catch (error) {
        console.error('Error obteniendo registros por alumno:', error);
        res.status(500).json({ success: false, message: 'Error obteniendo registros' });
    }
};

// 3. OBTENER REGISTROS POR FECHA (Se mantiene igual)
export const obtenerRegistrosPorFecha = async (req, res) => {
    try {
        const { fecha } = req.params;
        
        // Aquí deberías implementar la lógica real si tienes el método en el modelo
        // Por ahora mantengo tu respuesta vacía original para no romper nada
        res.json({
            success: true,
            fecha,
            registros: [] 
        });

    } catch (error) {
        console.error('Error obteniendo registros por fecha:', error);
        res.status(500).json({ success: false, message: 'Error obteniendo registros por fecha' });
    }
};

// 4. OBTENER ESTADÍSTICAS (Se mantiene igual)
export const obtenerEstadisticas = async (req, res) => {
    try {
        res.json({
            success: true,
            estadisticas: {
                totalRegistrosHoy: 0,
                entradas: 0,
                salidas: 0,
                retardos: 0,
                sinCredencial: 0
            }
        });

    } catch (error) {
        console.error('Error obteniendo estadísticas:', error);
        res.status(500).json({ success: false, message: 'Error obteniendo estadísticas' });
    }
};