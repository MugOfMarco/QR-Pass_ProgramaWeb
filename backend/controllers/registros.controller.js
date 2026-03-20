// backend/controllers/registros.controller.js
// ============================================================
// LÓGICA ENTRADA/SALIDA AUTOMÁTICA
// ─────────────────────────────────────────────────────────────
// El frontend YA NO decide si es entrada o salida.
// El servidor consulta el último registro del alumno HOY:
//
//   Último registro HOY = ENTRADA (tipo 1, 3 o 4)
//     → este registro es SALIDA (tipo 2)
//
//   Último registro HOY = SALIDA (tipo 2)
//   o no hay registro hoy
//     → este registro es ENTRADA
//       (el frontend sugiere si es retardo o sin credencial)
//
// El frontend solo puede sugerir el subtipo de ENTRADA:
//   1 = Normal | 3 = Retardo | 4 = Sin credencial
// Si el servidor decide SALIDA, ignora la sugerencia del frontend.
// ============================================================

import Registro from '../models/Registro.js';
import Alumno   from '../models/Alumno.js';
import { supabaseAdmin } from '../database/supabase.js';

const TIPO = {
    ENTRADA_NORMAL:   1,
    SALIDA:           2,
    RETARDO:          3,
    SIN_CREDENCIAL:   4,
};

// Tipos que cuentan como "el alumno está dentro"
const TIPOS_ENTRADA = new Set([
    TIPO.ENTRADA_NORMAL,
    TIPO.RETARDO,
    TIPO.SIN_CREDENCIAL,
]);

// ─────────────────────────────────────────────────────────────
// Obtiene el último registro del alumno en el día de hoy.
// Devuelve null si no hay ninguno.
// ─────────────────────────────────────────────────────────────
async function ultimoRegistroHoy(boleta) {
    const ahora  = new Date();
    const inicio = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate(),  0,  0,  0);
    const fin    = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate(), 23, 59, 59);

    const { data, error } = await supabaseAdmin
        .from('registros_acceso')
        .select('id_registro, id_tipo_registro, fecha_hora')
        .eq('boleta', parseInt(boleta))
        .gte('fecha_hora', inicio.toISOString())
        .lte('fecha_hora', fin.toISOString())
        .order('fecha_hora', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (error) throw new Error(`Error consultando registros del día: ${error.message}`);
    return data || null;
}

// ─────────────────────────────────────────────────────────────
// POST /api/registros
// ─────────────────────────────────────────────────────────────
export const crearRegistro = async (req, res) => {
    try {
        const {
            boleta,
            puerta,
            sinCredencial,
            id_tipo_registro: tipoSugerido,
        } = req.body;

        // ── Validaciones básicas ──────────────────────────────
        if (!boleta || !puerta) {
            return res.status(400).json({
                success: false,
                message: 'Faltan datos requeridos: boleta o puerta.',
            });
        }

        // ── Verificar alumno ──────────────────────────────────
        const alumno = await Alumno.obtenerBasico(boleta);
        if (!alumno) {
            return res.status(404).json({ success: false, message: 'Alumno no encontrado.' });
        }
        if (alumno.bloqueado) {
            return res.status(403).json({ success: false, message: 'Alumno bloqueado. No puede registrar entrada.' });
        }

        // ── Mapear puerta → id_punto_acceso ───────────────────
        const mapaPuertas = {
            'mexico-tacuba':    1,
            'mar':              2,
            'mar-mediterraneo': 2,
        };
        const id_punto_acceso = mapaPuertas[String(puerta).toLowerCase()];
        if (!id_punto_acceso) {
            return res.status(400).json({ success: false, message: `Puerta "${puerta}" no reconocida.` });
        }

        // ── NÚCLEO: decidir si es entrada o salida ─────────────
        //
        // Consultamos la BD directamente aquí (no delegamos al modelo)
        // para tener control absoluto sobre la lógica.
        //
        // Regla:
        //   último registro del día es ENTRADA → ahora registra SALIDA
        //   último registro del día es SALIDA  → ahora registra ENTRADA
        //   sin registros hoy                  → registra ENTRADA
        // ──────────────────────────────────────────────────────
        const ultimo   = await ultimoRegistroHoy(boleta);
        const esSalida = ultimo !== null && TIPOS_ENTRADA.has(ultimo.id_tipo_registro);

        let id_tipo_registro;

        if (esSalida) {
            // El servidor decide SALIDA — el frontend no puede override esto
            id_tipo_registro = TIPO.SALIDA;
        } else {
            // Es ENTRADA — aceptar la sugerencia del frontend para el subtipo
            const sugerenciaValida = [
                TIPO.ENTRADA_NORMAL,
                TIPO.RETARDO,
                TIPO.SIN_CREDENCIAL,
            ].includes(parseInt(tipoSugerido));

            if (sugerenciaValida) {
                id_tipo_registro = parseInt(tipoSugerido);
            } else if (sinCredencial) {
                id_tipo_registro = TIPO.SIN_CREDENCIAL;
            } else {
                id_tipo_registro = TIPO.ENTRADA_NORMAL;
            }
        }

        // ── Guardar en BD ─────────────────────────────────────
        const id_usuario_vigilante = req.session?.user?.id || null;

        const registro = await Registro.crear({
            boleta,
            id_punto_acceso,
            id_tipo_registro,
            id_usuario_vigilante,
        });

        if (!registro.success) {
            return res.status(500).json({ success: false, message: registro.message });
        }

        // ── Respuesta ─────────────────────────────────────────
        return res.json({
            success:         true,
            message:         'Registro creado correctamente.',
            id_registro:     registro.id_registro,
            fecha_hora:      registro.fecha_hora,
            id_tipo_registro,
            tipo_detectado:  esSalida ? 'salida' : 'entrada',
            _debug: {
                ultimo_previo: ultimo
                    ? { tipo: ultimo.id_tipo_registro, hora: ultimo.fecha_hora }
                    : null,
            },
        });

    } catch (error) {
        console.error('Error creando registro:', error);
        return res.status(500).json({ success: false, message: 'Error interno al crear el registro.' });
    }
};

// ─────────────────────────────────────────────────────────────
// GET /api/registros/alumno/:boleta
// ─────────────────────────────────────────────────────────────
export const obtenerRegistrosPorAlumno = async (req, res) => {
    try {
        const boleta = parseInt(req.params.boleta);
        if (isNaN(boleta)) {
            return res.status(400).json({ success: false, message: 'Boleta inválida.' });
        }
        const registros = await Registro.obtenerPorAlumno(boleta);
        return res.json({ success: true, boleta, registros, total: registros.length });
    } catch (error) {
        console.error('Error obteniendo registros por alumno:', error);
        return res.status(500).json({ success: false, message: 'Error obteniendo registros.' });
    }
};

// ─────────────────────────────────────────────────────────────
// GET /api/registros/fecha/:fecha  (YYYY-MM-DD)
// ─────────────────────────────────────────────────────────────
export const obtenerRegistrosPorFecha = async (req, res) => {
    try {
        const { fecha } = req.params;
        const registros  = await Registro.obtenerDelDia(fecha || null);
        return res.json({ success: true, fecha, registros, total: registros.length });
    } catch (error) {
        console.error('Error obteniendo registros por fecha:', error);
        return res.status(500).json({ success: false, message: 'Error obteniendo registros por fecha.' });
    }
};

// ─────────────────────────────────────────────────────────────
// GET /api/registros/estadisticas
// ─────────────────────────────────────────────────────────────
export const obtenerEstadisticas = async (req, res) => {
    try {
        const registrosHoy = await Registro.obtenerDelDia(null);
        const stats = {
            totalRegistrosHoy: registrosHoy.length,
            entradas:      registrosHoy.filter(r => r.id_tipo_registro === TIPO.ENTRADA_NORMAL).length,
            salidas:       registrosHoy.filter(r => r.id_tipo_registro === TIPO.SALIDA).length,
            retardos:      registrosHoy.filter(r => r.id_tipo_registro === TIPO.RETARDO).length,
            sinCredencial: registrosHoy.filter(r => r.id_tipo_registro === TIPO.SIN_CREDENCIAL).length,
        };
        return res.json({ success: true, estadisticas: stats });
    } catch (error) {
        console.error('Error obteniendo estadísticas:', error);
        return res.status(500).json({ success: false, message: 'Error obteniendo estadísticas.' });
    }
};