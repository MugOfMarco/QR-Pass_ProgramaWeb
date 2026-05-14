-- ============================================================
-- QR Pass · CECyT 9
-- MIGRACIÓN COMPLETA — todos los cambios de esquema acumulados
-- ============================================================
-- Ejecutar en el SQL Editor de Supabase (o psql).
-- Es seguro volver a ejecutar: usa IF NOT EXISTS / IF EXISTS donde aplica.
-- ============================================================


-- ============================================================
-- 1. TIMESTAMP → TIMESTAMPTZ
--    Motivo: las columnas TIMESTAMP WITHOUT TIME ZONE almacenan
--    UTC pero el cliente JS (y el navegador) las interpreta como
--    hora local si no llevan sufijo de zona.  Con TIMESTAMPTZ el
--    valor siempre lleva '+00:00' y new Date() lo parsea bien.
-- ============================================================

-- registros_acceso.fecha_hora  (columna crítica — afecta dashboard y búsquedas)
ALTER TABLE registros_acceso
    ALTER COLUMN fecha_hora
    TYPE TIMESTAMPTZ
    USING fecha_hora AT TIME ZONE 'UTC';

-- bitacora_auditoria.fecha_hora  (registros de auditoría del sistema)
ALTER TABLE bitacora_auditoria
    ALTER COLUMN fecha_hora
    TYPE TIMESTAMPTZ
    USING fecha_hora AT TIME ZONE 'UTC';

-- justificaciones.fecha_justificacion
ALTER TABLE justificaciones
    ALTER COLUMN fecha_justificacion
    TYPE TIMESTAMPTZ
    USING fecha_justificacion AT TIME ZONE 'UTC';

-- usuarios_sistema.fecha_creacion
ALTER TABLE usuarios_sistema
    ALTER COLUMN fecha_creacion
    TYPE TIMESTAMPTZ
    USING fecha_creacion AT TIME ZONE 'UTC';

-- configuracion_sistema.ultima_modificacion
ALTER TABLE configuracion_sistema
    ALTER COLUMN ultima_modificacion
    TYPE TIMESTAMPTZ
    USING ultima_modificacion AT TIME ZONE 'UTC';

-- alumnos.fecha_registro  (si existe)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'alumnos' AND column_name = 'fecha_registro'
    ) THEN
        ALTER TABLE alumnos
            ALTER COLUMN fecha_registro
            TYPE TIMESTAMPTZ
            USING fecha_registro AT TIME ZONE 'UTC';
    END IF;
END $$;


-- ============================================================
-- 2. COLUMNA id_usuario_vigilante en registros_acceso
--    Permite registrar qué vigilante/prefecto escaneó la credencial.
--    El backend ya la usa para mostrar el nombre en el historial
--    de incidencias y en la tabla de accesos del alumno.
-- ============================================================

ALTER TABLE registros_acceso
    ADD COLUMN IF NOT EXISTS id_usuario_vigilante INTEGER
        REFERENCES usuarios_sistema(id_usuario)
        ON DELETE SET NULL;

-- Índice para agilizar los JOINs por vigilante
CREATE INDEX IF NOT EXISTS idx_registros_id_usuario_vigilante
    ON registros_acceso(id_usuario_vigilante);


-- ============================================================
-- 3. TIPO DE REGISTRO — verificación de catálogo
--    Los tipos usados por el backend son:
--      1 = Entrada
--      2 = Salida
--      3 = Retardo
--      4 = Sin Credencial
--    Las "Faltas" son calculadas virtualmente (días hábiles sin
--    ningún registro), NO se almacenan en esta tabla.
-- ============================================================

-- Asegurarse de que los 4 tipos base existen
INSERT INTO tipos_registro (id_tipo_registro, descripcion)
VALUES
    (1, 'Entrada'),
    (2, 'Salida'),
    (3, 'Retardo'),
    (4, 'Sin Credencial')
ON CONFLICT (id_tipo_registro) DO NOTHING;


-- ============================================================
-- 4. ÍNDICES DE RENDIMIENTO adicionales
--    Mejoran las consultas por rango de fecha que usa el dashboard
--    y el endpoint de incidencias por período.
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_registros_fecha_hora
    ON registros_acceso(fecha_hora);

CREATE INDEX IF NOT EXISTS idx_registros_boleta_fecha
    ON registros_acceso(boleta, fecha_hora DESC);

CREATE INDEX IF NOT EXISTS idx_registros_tipo_fecha
    ON registros_acceso(id_tipo_registro, fecha_hora);


-- ============================================================
-- 5. TABLA sessions — sesiones persistentes del servidor
--    El backend Node.js guarda las sesiones de usuario aquí
--    para que los reinicios del servidor (Render free tier)
--    no destruyan las sesiones activas de vigilantes y prefectos.
--
--    IMPORTANTE: ejecutar esto ANTES de reiniciar el servidor
--    con la nueva versión del código.
-- ============================================================

CREATE TABLE IF NOT EXISTS sessions (
    sid    VARCHAR NOT NULL PRIMARY KEY,
    sess   JSONB   NOT NULL,
    expire TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_expire ON sessions(expire);

-- ============================================================
-- FIN DE LA MIGRACIÓN
-- ============================================================
