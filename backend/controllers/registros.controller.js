import Registro from '../models/Registro.js';
import Alumno from '../models/Alumno.js';

// Función de sanitización manual (sin dependencias externas)
const sanitize = (data) => {
    if (typeof data === 'string') {
        return data
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#x27;')
            .replace(/\//g, '&#x2F;')
            .trim();
    }
    return data;
};

export const createAlumno = async (req, res) => {
    try {
        // Sanitizamos el nombre antes de guardar
        const nombreLimpio = sanitize(req.body.nombre);
        
        // Ahora guardas 'nombreLimpio' en tu base de datos
        const nuevoAlumno = await Alumno.create({ nombre: nombreLimpio });
        
        res.json({
            success: true,
            message: 'Alumno creado exitosamente',
            alumno: nuevoAlumno
        });
    } catch (error) {
        console.error('Error creando alumno:', error);
        res.status(500).json({
            success: false,
            message: 'Error creando alumno: ' + error.message
        });
    }
};

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

        const registro = await Registro.crear({
            boleta,
            puerta,
            id_tipo_registro
        });

        if (tieneRetardo) {
            await Registro.actualizarContadores(boleta, 'retardo', 'incrementar');
        }

        if (sinCredencial) {
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

export const obtenerRegistrosPorAlumno = async (req, res) => {
    try {
        const boleta = parseInt(req.params.boleta);
        
        const alumno = await Alumno.obtenerCompleto(boleta);
        if (!alumno) {
            return res.status(404).json({ 
                success: false, 
                message: 'Alumno no encontrado' 
            });
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
        res.status(500).json({ 
            success: false, 
            message: 'Error obteniendo registros' 
        });
    }
};

export const obtenerRegistrosPorFecha = async (req, res) => {
    try {
        const { fecha } = req.params;
        
        res.json({
            success: true,
            fecha,
            registros: []
        });
    } catch (error) {
        console.error('Error obteniendo registros por fecha:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error obteniendo registros por fecha' 
        });
    }
};

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
        res.status(500).json({ 
            success: false, 
            message: 'Error obteniendo estadísticas' 
        });
    }
};