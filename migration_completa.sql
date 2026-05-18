-- ============================================================================================================================
-- BASE DE DATOS: QR PASS V3.0 — CECYT 9 "JUAN DE DIOS BÁTIZ"
-- Motor: PostgreSQL (Supabase)
-- Versión: 3.0 | Arquitectura: 3FN
-- ============================================================================================================================
-- POLÍTICA DE INTEGRIDAD:
--   · NINGÚN dato operativo se elimina físicamente.
--   · ON DELETE RESTRICT protege el historial de registros y auditoría.
--   · ON DELETE SET NULL solo en campos donde la baja del referenciado
--     no invalida el registro (vigilante dado de baja, usuario autorizador).
-- ============================================================================================================================


-- ============================================================================================================================
-- BLOQUE 0 — LIMPIEZA COMPLETA (DROP IF EXISTS … CASCADE)
-- Elimina todas las tablas, funciones y triggers del esquema anterior.
-- CASCADE resuelve automáticamente FKs, índices, triggers y secuencias.
-- ¡ADVERTENCIA! Esto borra TODOS los datos existentes sin recuperación.
-- ============================================================================================================================

-- ── Tablas (orden: hijos antes que padres) ────────────────────────────────────
DROP TABLE IF EXISTS eventos_ticket          CASCADE;
DROP TABLE IF EXISTS mensajes_ticket         CASCADE;
DROP TABLE IF EXISTS tickets_soporte         CASCADE;
DROP TABLE IF EXISTS bitacora_auditoria      CASCADE;
DROP TABLE IF EXISTS justificaciones         CASCADE;
DROP TABLE IF EXISTS registros_acceso        CASCADE;
DROP TABLE IF EXISTS horario_alumno_extra    CASCADE;
DROP TABLE IF EXISTS materias_acreditadas    CASCADE;
DROP TABLE IF EXISTS info_alumno             CASCADE;
DROP TABLE IF EXISTS alumnos                 CASCADE;
DROP TABLE IF EXISTS horarios_grupo          CASCADE;
DROP TABLE IF EXISTS grupos                  CASCADE;
DROP TABLE IF EXISTS usuarios_sistema        CASCADE;
DROP TABLE IF EXISTS semestres               CASCADE;
DROP TABLE IF EXISTS dias_inhabiles          CASCADE;
DROP TABLE IF EXISTS puntos_acceso           CASCADE;
DROP TABLE IF EXISTS materias                CASCADE;
DROP TABLE IF EXISTS carreras                CASCADE;
DROP TABLE IF EXISTS turnos                  CASCADE;
DROP TABLE IF EXISTS estado_academico        CASCADE;
DROP TABLE IF EXISTS tipos_registro          CASCADE;
DROP TABLE IF EXISTS roles                   CASCADE;
DROP TABLE IF EXISTS configuracion_sistema   CASCADE;
DROP TABLE IF EXISTS sessions                CASCADE;

-- ── Funciones (CASCADE elimina los triggers que las referencian) ──────────────
DROP FUNCTION IF EXISTS fn_actualizar_ultima_modificacion() CASCADE;
DROP FUNCTION IF EXISTS fn_bloqueo_automatico_credencial()  CASCADE;
DROP FUNCTION IF EXISTS fn_incrementar_sin_credencial()     CASCADE;
DROP FUNCTION IF EXISTS fn_incrementar_retardo()            CASCADE;
DROP FUNCTION IF EXISTS fn_un_semestre_activo()             CASCADE;
DROP FUNCTION IF EXISTS fn_incrementar_falta()              CASCADE;


-- ============================================================================================================================
-- BLOQUE 1 — CATÁLOGOS DEL SISTEMA
-- ============================================================================================================================

CREATE TABLE configuracion_sistema (
    id_config              SERIAL       PRIMARY KEY,
    minutos_tolerancia     INT          NOT NULL DEFAULT 20,
    max_olvidos_credencial INT          NOT NULL DEFAULT 3,
    ultima_modificacion    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE roles (
    id_rol     SERIAL      PRIMARY KEY,
    nombre_rol VARCHAR(50) NOT NULL UNIQUE
);

CREATE TABLE tipos_registro (
    id_tipo     INT         PRIMARY KEY,
    descripcion VARCHAR(50) NOT NULL
);

CREATE TABLE estado_academico (
    id_estado INT         PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    estado    VARCHAR(50) NOT NULL UNIQUE
);

CREATE TABLE turnos (
    id_turno     INT         PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    nombre_turno VARCHAR(30) NOT NULL UNIQUE,
    hora_entrada TIME        NOT NULL,
    hora_salida  TIME        NOT NULL
);

CREATE TABLE carreras (
    id_carrera     INT          PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    nombre_carrera VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE materias (
    id_materia     INT          PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    nombre_materia VARCHAR(150) NOT NULL UNIQUE
);

CREATE TABLE puntos_acceso (
    id_punto     INT          PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    nombre_punto VARCHAR(100) NOT NULL,
    ubicacion    VARCHAR(150) DEFAULT NULL
);

-- Días que el sistema NO debe marcar falta automáticamente (festivos, puentes, vacaciones, etc.)
-- Se gestionan desde el módulo "Lógica de Negocio" con posibilidad de reiniciar por ciclo escolar.
CREATE TABLE dias_inhabiles (
    id_inhabil    INT          PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    fecha         DATE         NOT NULL UNIQUE,
    descripcion   VARCHAR(100) NOT NULL,
    tipo          VARCHAR(20)  NOT NULL DEFAULT 'festivo'
                      CHECK (tipo IN ('festivo', 'puente', 'vacaciones', 'institucional')),
    ciclo_escolar VARCHAR(10)  DEFAULT NULL   -- ej: '2025-2026'; NULL = permanente
);

CREATE INDEX idx_dias_inhabiles_fecha ON dias_inhabiles (fecha);


-- ============================================================================================================================
-- BLOQUE 2 — PERÍODOS ESCOLARES
-- ============================================================================================================================

CREATE TABLE semestres (
    id_semestre     INT         PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    nombre_semestre VARCHAR(20) NOT NULL UNIQUE,
    fecha_inicio    DATE        NOT NULL,
    fecha_fin       DATE        NOT NULL,
    activo          BOOLEAN     NOT NULL DEFAULT FALSE,
    CONSTRAINT ck_semestre_fechas CHECK (fecha_fin > fecha_inicio)
);


-- ============================================================================================================================
-- BLOQUE 3 — PERSONAL DEL SISTEMA (STAFF)
-- email: NULL por defecto; requerido para usar el módulo de recuperación de contraseña.
-- ============================================================================================================================

CREATE TABLE usuarios_sistema (
    id_usuario      INT          PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    usuario         VARCHAR(50)  NOT NULL UNIQUE,
    password_hash   VARCHAR(255) NOT NULL,
    nombre_completo VARCHAR(150) NOT NULL,
    email           VARCHAR(200) DEFAULT NULL,
    id_rol          INT          NOT NULL,
    activo          BOOLEAN      NOT NULL DEFAULT TRUE,
    fecha_creacion  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_usuario_rol FOREIGN KEY (id_rol)
        REFERENCES roles(id_rol) ON DELETE RESTRICT
);

CREATE UNIQUE INDEX uq_usuarios_email
    ON usuarios_sistema (email)
    WHERE email IS NOT NULL;


-- ============================================================================================================================
-- BLOQUE 4 — ESTRUCTURA ACADÉMICA
-- ============================================================================================================================

CREATE TABLE grupos (
    id_grupo     INT         PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    nombre_grupo VARCHAR(10) NOT NULL UNIQUE,
    id_carrera   INT         NOT NULL,
    id_turno     INT         NOT NULL,
    CONSTRAINT fk_grupo_carrera FOREIGN KEY (id_carrera)
        REFERENCES carreras(id_carrera) ON DELETE RESTRICT,
    CONSTRAINT fk_grupo_turno FOREIGN KEY (id_turno)
        REFERENCES turnos(id_turno) ON DELETE RESTRICT
);

CREATE TABLE horarios_grupo (
    id_horario  INT        PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    id_grupo    INT        NOT NULL,
    id_materia  INT        NOT NULL,
    id_semestre INT        NOT NULL,
    dia_semana  SMALLINT   NOT NULL CHECK (dia_semana BETWEEN 1 AND 7),
    hora_inicio TIME       NOT NULL,
    hora_fin    TIME       NOT NULL,
    CONSTRAINT fk_hg_grupo FOREIGN KEY (id_grupo)
        REFERENCES grupos(id_grupo) ON DELETE RESTRICT,
    CONSTRAINT fk_hg_mat FOREIGN KEY (id_materia)
        REFERENCES materias(id_materia) ON DELETE RESTRICT,
    CONSTRAINT fk_hg_sem FOREIGN KEY (id_semestre)
        REFERENCES semestres(id_semestre) ON DELETE RESTRICT,
    CONSTRAINT ck_hg_horas CHECK (hora_fin > hora_inicio)
);


-- ============================================================================================================================
-- BLOQUE 5 — ALUMNOS
-- ============================================================================================================================

CREATE TABLE alumnos (
    boleta              BIGINT       NOT NULL PRIMARY KEY,
    nombre_completo     VARCHAR(200) NOT NULL,
    id_grupo_base       INT          NOT NULL,
    id_estado_academico INT          NOT NULL,
    puertas_abiertas    BOOLEAN      NOT NULL DEFAULT FALSE,
    fecha_registro      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_alumno_grupo FOREIGN KEY (id_grupo_base)
        REFERENCES grupos(id_grupo) ON DELETE RESTRICT,
    CONSTRAINT fk_alumno_estado FOREIGN KEY (id_estado_academico)
        REFERENCES estado_academico(id_estado) ON DELETE RESTRICT
);

CREATE TABLE info_alumno (
    boleta                  BIGINT       NOT NULL PRIMARY KEY,
    url_foto                VARCHAR(500) NOT NULL DEFAULT 'https://res.cloudinary.com/depoh32sv/image/upload/v1765350850/default_avatar.jpg',
    contador_retardos       INT          NOT NULL DEFAULT 0,
    contador_sin_credencial INT          NOT NULL DEFAULT 0,
    contador_faltas         INT          NOT NULL DEFAULT 0,
    bloqueado_manual        BOOLEAN      NOT NULL DEFAULT FALSE,
    bloqueado_sistema       BOOLEAN      NOT NULL DEFAULT FALSE,
    CONSTRAINT fk_info_alumno_al FOREIGN KEY (boleta)
        REFERENCES alumnos(boleta) ON DELETE RESTRICT
);


-- ============================================================================================================================
-- BLOQUE 6 — MANEJO DE IRREGULARES
-- ============================================================================================================================

CREATE TABLE materias_acreditadas (
    id_acreditada      INT    PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    boleta             BIGINT NOT NULL,
    id_materia         INT    NOT NULL,
    id_semestre        INT    NOT NULL,
    fecha_acreditacion DATE   DEFAULT NULL,
    CONSTRAINT uq_mat_acred_alumno UNIQUE (boleta, id_materia),
    CONSTRAINT fk_mat_acred_al FOREIGN KEY (boleta)
        REFERENCES alumnos(boleta) ON DELETE RESTRICT,
    CONSTRAINT fk_mat_acred_mat FOREIGN KEY (id_materia)
        REFERENCES materias(id_materia) ON DELETE RESTRICT,
    CONSTRAINT fk_mat_acred_sem FOREIGN KEY (id_semestre)
        REFERENCES semestres(id_semestre) ON DELETE RESTRICT
);

CREATE TABLE horario_alumno_extra (
    id_extra         INT    PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    boleta           BIGINT NOT NULL,
    id_horario       INT    NOT NULL,
    fecha_asignacion DATE   NOT NULL DEFAULT CURRENT_DATE,
    CONSTRAINT uq_horario_extra_dup UNIQUE (boleta, id_horario),
    CONSTRAINT fk_horario_extra_al  FOREIGN KEY (boleta)
        REFERENCES alumnos(boleta) ON DELETE RESTRICT,
    CONSTRAINT fk_horario_extra_hor FOREIGN KEY (id_horario)
        REFERENCES horarios_grupo(id_horario) ON DELETE RESTRICT
);


-- ============================================================================================================================
-- BLOQUE 7 — OPERACIÓN
-- ============================================================================================================================

CREATE TABLE registros_acceso (
    id_registro          INT          PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    boleta               BIGINT       NOT NULL,
    id_punto_acceso      INT          DEFAULT NULL,
    id_tipo_registro     INT          NOT NULL,
    id_usuario_vigilante INT          DEFAULT NULL,
    observaciones        VARCHAR(200) DEFAULT NULL,
    fecha_hora           TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_reg_alumno FOREIGN KEY (boleta)
        REFERENCES alumnos(boleta) ON DELETE RESTRICT,
    CONSTRAINT fk_reg_punto FOREIGN KEY (id_punto_acceso)
        REFERENCES puntos_acceso(id_punto) ON DELETE RESTRICT,
    CONSTRAINT fk_reg_tipo FOREIGN KEY (id_tipo_registro)
        REFERENCES tipos_registro(id_tipo) ON DELETE RESTRICT,
    CONSTRAINT fk_reg_vigilante FOREIGN KEY (id_usuario_vigilante)
        REFERENCES usuarios_sistema(id_usuario) ON DELETE SET NULL
);

CREATE TABLE justificaciones (
    id_justificacion    INT       PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    id_registro         INT       NOT NULL,
    motivo              TEXT      NOT NULL,
    id_usuario_autoriza INT       DEFAULT NULL,
    fecha_justificacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_justificacion_reg UNIQUE (id_registro),
    CONSTRAINT fk_just_registro FOREIGN KEY (id_registro)
        REFERENCES registros_acceso(id_registro) ON DELETE RESTRICT,
    CONSTRAINT fk_just_autoriza FOREIGN KEY (id_usuario_autoriza)
        REFERENCES usuarios_sistema(id_usuario) ON DELETE SET NULL
);

CREATE TABLE bitacora_auditoria (
    id_auditoria      INT          PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    id_usuario_accion INT          DEFAULT NULL,
    accion            VARCHAR(100) NOT NULL,
    boleta_afectada   BIGINT       DEFAULT NULL,
    detalle           TEXT         DEFAULT NULL,
    fecha_hora        TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_bitacora_usuario FOREIGN KEY (id_usuario_accion)
        REFERENCES usuarios_sistema(id_usuario) ON DELETE SET NULL,
    CONSTRAINT fk_bitacora_alumno FOREIGN KEY (boleta_afectada)
        REFERENCES alumnos(boleta) ON DELETE RESTRICT
);


-- ============================================================================================================================
-- BLOQUE 8 — SESIONES PERSISTENTES
-- ============================================================================================================================

CREATE TABLE sessions (
    sid    VARCHAR     NOT NULL PRIMARY KEY,
    sess   JSONB       NOT NULL,
    expire TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_sessions_expire ON sessions (expire);


-- ============================================================================================================================
-- BLOQUE 9 — SISTEMA DE SOPORTE (TICKETS)
-- ============================================================================================================================

CREATE TABLE tickets_soporte (
    id_ticket            INT          PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    id_usuario           INT          NOT NULL,
    id_agente            INT          DEFAULT NULL,
    asunto               VARCHAR(120) NOT NULL,
    descripcion          TEXT         NOT NULL,
    modulo               VARCHAR(50)  DEFAULT NULL,
    prioridad            VARCHAR(10)  NOT NULL DEFAULT 'media'
                             CHECK (prioridad IN ('urgente','alta','media','baja')),
    estado               VARCHAR(25)  NOT NULL DEFAULT 'abierto'
                             CHECK (estado IN ('abierto','en_progreso','esperando_usuario','resuelto','cerrado')),
    fecha_creacion       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_cierre         TIMESTAMP    DEFAULT NULL,
    CONSTRAINT fk_ticket_usuario FOREIGN KEY (id_usuario)
        REFERENCES usuarios_sistema(id_usuario) ON DELETE RESTRICT,
    CONSTRAINT fk_ticket_agente  FOREIGN KEY (id_agente)
        REFERENCES usuarios_sistema(id_usuario) ON DELETE SET NULL
);

CREATE TABLE mensajes_ticket (
    id_mensaje       INT       PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    id_ticket        INT       NOT NULL,
    id_usuario       INT       NOT NULL,
    contenido        TEXT      NOT NULL,
    es_nota_interna  BOOLEAN   NOT NULL DEFAULT FALSE,
    url_evidencia    TEXT      NULL     DEFAULT NULL,   -- URL Cloudinary de imagen adjunta (opcional)
    fecha_envio      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_msg_ticket  FOREIGN KEY (id_ticket)
        REFERENCES tickets_soporte(id_ticket) ON DELETE RESTRICT,
    CONSTRAINT fk_msg_usuario FOREIGN KEY (id_usuario)
        REFERENCES usuarios_sistema(id_usuario) ON DELETE RESTRICT
);

CREATE TABLE eventos_ticket (
    id_evento    INT          PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    id_ticket    INT          NOT NULL,
    id_usuario   INT          DEFAULT NULL,
    tipo_evento  VARCHAR(50)  NOT NULL,
    descripcion  VARCHAR(200) DEFAULT NULL,
    fecha_evento TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_evt_ticket  FOREIGN KEY (id_ticket)
        REFERENCES tickets_soporte(id_ticket) ON DELETE RESTRICT,
    CONSTRAINT fk_evt_usuario FOREIGN KEY (id_usuario)
        REFERENCES usuarios_sistema(id_usuario) ON DELETE SET NULL
);


-- ============================================================================================================================
-- BLOQUE 10 — ÍNDICES DE RENDIMIENTO
-- ============================================================================================================================

CREATE INDEX idx_registros_boleta_fecha  ON registros_acceso   (boleta, fecha_hora);
CREATE INDEX idx_registros_punto_fecha   ON registros_acceso   (id_punto_acceso, fecha_hora);
CREATE INDEX idx_horarios_grupo_sem      ON horarios_grupo     (id_grupo, id_semestre);
CREATE INDEX idx_alumnos_estado          ON alumnos            (id_estado_academico);
CREATE INDEX idx_bitacora_usuario_fecha  ON bitacora_auditoria (id_usuario_accion, fecha_hora);
CREATE INDEX idx_tickets_usuario         ON tickets_soporte    (id_usuario, fecha_creacion);
CREATE INDEX idx_tickets_estado_prio     ON tickets_soporte    (estado, prioridad);


-- ============================================================================================================================
-- BLOQUE 11 — TRIGGERS
-- ============================================================================================================================

CREATE OR REPLACE FUNCTION fn_actualizar_ultima_modificacion()
RETURNS TRIGGER AS $$
BEGIN
    NEW.ultima_modificacion = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_config_ultima_modificacion
    BEFORE UPDATE ON configuracion_sistema
    FOR EACH ROW
    EXECUTE FUNCTION fn_actualizar_ultima_modificacion();

CREATE OR REPLACE FUNCTION fn_bloqueo_automatico_credencial()
RETURNS TRIGGER AS $$
DECLARE
    v_max INT;
BEGIN
    SELECT max_olvidos_credencial INTO v_max
    FROM configuracion_sistema
    LIMIT 1;

    IF NEW.contador_sin_credencial >= v_max THEN
        NEW.bloqueado_sistema = TRUE;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_bloqueo_automatico
    BEFORE UPDATE OF contador_sin_credencial ON info_alumno
    FOR EACH ROW
    EXECUTE FUNCTION fn_bloqueo_automatico_credencial();

CREATE OR REPLACE FUNCTION fn_incrementar_sin_credencial()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.id_tipo_registro = 4 THEN
        UPDATE info_alumno
        SET contador_sin_credencial = contador_sin_credencial + 1
        WHERE boleta = NEW.boleta;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_incrementar_sin_credencial
    AFTER INSERT ON registros_acceso
    FOR EACH ROW
    EXECUTE FUNCTION fn_incrementar_sin_credencial();

CREATE OR REPLACE FUNCTION fn_incrementar_retardo()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.id_tipo_registro = 3 THEN
        UPDATE info_alumno
        SET contador_retardos = contador_retardos + 1
        WHERE boleta = NEW.boleta;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_incrementar_retardo
    AFTER INSERT ON registros_acceso
    FOR EACH ROW
    EXECUTE FUNCTION fn_incrementar_retardo();

CREATE OR REPLACE FUNCTION fn_un_semestre_activo()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.activo = TRUE THEN
        UPDATE semestres
        SET activo = FALSE
        WHERE id_semestre <> NEW.id_semestre;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_un_semestre_activo
    BEFORE INSERT OR UPDATE OF activo ON semestres
    FOR EACH ROW
    WHEN (NEW.activo = TRUE)
    EXECUTE FUNCTION fn_un_semestre_activo();

CREATE OR REPLACE FUNCTION fn_incrementar_falta()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.id_tipo_registro = 5 THEN
        UPDATE info_alumno
        SET contador_faltas = contador_faltas + 1
        WHERE boleta = NEW.boleta;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_incrementar_falta
    AFTER INSERT ON registros_acceso
    FOR EACH ROW
    EXECUTE FUNCTION fn_incrementar_falta();


-- ============================================================================================================================
-- BLOQUE 12 — DATOS INICIALES
-- ============================================================================================================================

INSERT INTO configuracion_sistema (minutos_tolerancia, max_olvidos_credencial)
VALUES (20, 3);

INSERT INTO tipos_registro (id_tipo, descripcion) VALUES
(1, 'Entrada Normal'),
(2, 'Salida'),
(3, 'Retardo'),
(4, 'Entrada Sin Credencial'),
(5, 'Falta');

INSERT INTO roles (nombre_rol) VALUES
('Administrador'),
('Vigilante'),
('Prefecto'),
('Soporte');

INSERT INTO estado_academico (estado) VALUES
('Activo'),
('Baja Temporal'),
('Egresado'),
('Baja Definitiva');

INSERT INTO turnos (nombre_turno, hora_entrada, hora_salida) VALUES
('Matutino',   '07:00:00', '14:30:00'),
('Vespertino', '14:00:00', '21:30:00');

INSERT INTO carreras (nombre_carrera) VALUES
('Programación'),
('Sistemas Digitales'),
('Mecatrónica'),
('Tronco Común');

INSERT INTO semestres (nombre_semestre, fecha_inicio, fecha_fin, activo) VALUES
('2025-2', '2025-08-01', '2026-01-31', TRUE);

INSERT INTO puntos_acceso (nombre_punto, ubicacion) VALUES
('Entrada Principal Norte', 'Torniquetes Puerta 1'),
('Entrada Principal Sur',   'Torniquetes Puerta 2');

-- Días inhábiles ciclo 2025-2026 (IPN/CECyT — calendario SEP)
-- El admin puede ajustar desde Lógica de Negocio; botón "Reiniciar año" recalcula automáticamente.
INSERT INTO dias_inhabiles (fecha, descripcion, tipo, ciclo_escolar) VALUES
-- ── Semestre Ago 2025 – Ene 2026 ────────────────────────────────────────────
('2025-09-16', 'Día de la Independencia',                  'festivo',       '2025-2026'),
('2025-11-03', 'Puente Día de Muertos',                    'puente',        '2025-2026'),
('2025-11-17', 'Aniversario Revolución Mexicana',          'festivo',       '2025-2026'),
('2025-12-22', 'Vacaciones decembrinas',                   'vacaciones',    '2025-2026'),
('2025-12-23', 'Vacaciones decembrinas',                   'vacaciones',    '2025-2026'),
('2025-12-24', 'Vacaciones decembrinas',                   'vacaciones',    '2025-2026'),
('2025-12-25', 'Navidad',                                  'festivo',       '2025-2026'),
('2025-12-26', 'Vacaciones decembrinas',                   'vacaciones',    '2025-2026'),
('2025-12-29', 'Vacaciones decembrinas',                   'vacaciones',    '2025-2026'),
('2025-12-30', 'Vacaciones decembrinas',                   'vacaciones',    '2025-2026'),
('2025-12-31', 'Vacaciones decembrinas',                   'vacaciones',    '2025-2026'),
-- ── Semestre Feb 2026 – Jul 2026 ────────────────────────────────────────────
('2026-01-01', 'Año Nuevo',                                'festivo',       '2025-2026'),
('2026-01-02', 'Vacaciones decembrinas',                   'vacaciones',    '2025-2026'),
('2026-01-05', 'Vacaciones decembrinas',                   'vacaciones',    '2025-2026'),
('2026-02-02', 'Día de la Constitución Política',          'festivo',       '2025-2026'),
('2026-03-16', 'Natalicio de Benito Juárez',               'festivo',       '2025-2026'),
('2026-03-30', 'Semana Santa',                             'vacaciones',    '2025-2026'),
('2026-03-31', 'Semana Santa',                             'vacaciones',    '2025-2026'),
('2026-04-01', 'Semana Santa',                             'vacaciones',    '2025-2026'),
('2026-04-02', 'Semana Santa — Jueves Santo',              'vacaciones',    '2025-2026'),
('2026-04-03', 'Semana Santa — Viernes Santo',             'vacaciones',    '2025-2026'),
('2026-04-06', 'Semana Santa — Lunes de Pascua',           'vacaciones',    '2025-2026'),
('2026-04-07', 'Semana Santa',                             'vacaciones',    '2025-2026'),
('2026-04-08', 'Semana Santa',                             'vacaciones',    '2025-2026'),
('2026-04-09', 'Semana Santa',                             'vacaciones',    '2025-2026'),
('2026-04-10', 'Semana Santa',                             'vacaciones',    '2025-2026'),
('2026-05-01', 'Día del Trabajo',                          'festivo',       '2025-2026'),
('2026-05-15', 'Día del Maestro',                          'institucional', '2025-2026')
ON CONFLICT (fecha) DO NOTHING;

INSERT INTO usuarios_sistema (usuario, password_hash, nombre_completo, email, id_rol) VALUES
('admin',
 '$2b$10$bpNkCs4E0oeGTGPf.QlWUuMOrepW0bAIQX/A3r7g9m05GYxdynO3q',
 'Administrador Principal',
 NULL,
 1),
('vigilante',
 '$2b$10$CgZEIRcdMyDBJPwuSadVJOWQ2pN99fPKWeYjQCDbmkYxeXvMQrTXG',
 'Oficial de Puerta',
 NULL,
 2);


-- ============================================================================================================================
-- BLOQUE 12 — DATOS DE PRUEBA: GRUPO 6IV7
-- ============================================================================================================================

INSERT INTO materias (nombre_materia) VALUES
    ('P601 – Probabilidad y Estadística'),
    ('P602 – Física IV'),
    ('P603 – Química IV'),
    ('P604 – Inglés VI'),
    ('P605 – Orientación Juvenil y Profesional IV'),
    ('P606 – Ciberseguridad'),
    ('P607 – Introducción al Análisis de Datos'),
    ('P608 – Fundamentos de Inteligencia Artificial'),
    ('P609 – Laboratorio de Desarrollo de Software IV'),
    ('P610 – Proyecto Integrador')
ON CONFLICT (nombre_materia) DO NOTHING;

INSERT INTO grupos (nombre_grupo, id_carrera, id_turno)
VALUES ('6IV7', 1, 2)
ON CONFLICT (nombre_grupo) DO NOTHING;

-- dia_semana: 1=Lunes, 2=Martes, 3=Miércoles, 4=Jueves, 5=Viernes, 6=Sábado
INSERT INTO horarios_grupo (id_grupo, id_materia, id_semestre, dia_semana, hora_inicio, hora_fin)
VALUES
((SELECT id_grupo FROM grupos WHERE nombre_grupo = '6IV7'),
 (SELECT id_materia FROM materias WHERE nombre_materia = 'P601 – Probabilidad y Estadística'),
 (SELECT id_semestre FROM semestres WHERE activo = TRUE LIMIT 1),
 1, '15:00:00', '17:00:00'),
((SELECT id_grupo FROM grupos WHERE nombre_grupo = '6IV7'),
 (SELECT id_materia FROM materias WHERE nombre_materia = 'P601 – Probabilidad y Estadística'),
 (SELECT id_semestre FROM semestres WHERE activo = TRUE LIMIT 1),
 2, '14:00:00', '16:00:00'),
((SELECT id_grupo FROM grupos WHERE nombre_grupo = '6IV7'),
 (SELECT id_materia FROM materias WHERE nombre_materia = 'P601 – Probabilidad y Estadística'),
 (SELECT id_semestre FROM semestres WHERE activo = TRUE LIMIT 1),
 3, '17:00:00', '18:00:00'),
((SELECT id_grupo FROM grupos WHERE nombre_grupo = '6IV7'),
 (SELECT id_materia FROM materias WHERE nombre_materia = 'P602 – Física IV'),
 (SELECT id_semestre FROM semestres WHERE activo = TRUE LIMIT 1),
 1, '19:00:00', '21:00:00'),
((SELECT id_grupo FROM grupos WHERE nombre_grupo = '6IV7'),
 (SELECT id_materia FROM materias WHERE nombre_materia = 'P602 – Física IV'),
 (SELECT id_semestre FROM semestres WHERE activo = TRUE LIMIT 1),
 2, '18:00:00', '19:00:00'),
((SELECT id_grupo FROM grupos WHERE nombre_grupo = '6IV7'),
 (SELECT id_materia FROM materias WHERE nombre_materia = 'P602 – Física IV'),
 (SELECT id_semestre FROM semestres WHERE activo = TRUE LIMIT 1),
 5, '19:00:00', '21:00:00'),
((SELECT id_grupo FROM grupos WHERE nombre_grupo = '6IV7'),
 (SELECT id_materia FROM materias WHERE nombre_materia = 'P603 – Química IV'),
 (SELECT id_semestre FROM semestres WHERE activo = TRUE LIMIT 1),
 2, '13:00:00', '15:00:00'),
((SELECT id_grupo FROM grupos WHERE nombre_grupo = '6IV7'),
 (SELECT id_materia FROM materias WHERE nombre_materia = 'P603 – Química IV'),
 (SELECT id_semestre FROM semestres WHERE activo = TRUE LIMIT 1),
 4, '16:00:00', '18:00:00'),
((SELECT id_grupo FROM grupos WHERE nombre_grupo = '6IV7'),
 (SELECT id_materia FROM materias WHERE nombre_materia = 'P604 – Inglés VI'),
 (SELECT id_semestre FROM semestres WHERE activo = TRUE LIMIT 1),
 1, '13:00:00', '15:00:00'),
((SELECT id_grupo FROM grupos WHERE nombre_grupo = '6IV7'),
 (SELECT id_materia FROM materias WHERE nombre_materia = 'P604 – Inglés VI'),
 (SELECT id_semestre FROM semestres WHERE activo = TRUE LIMIT 1),
 3, '16:00:00', '17:00:00'),
((SELECT id_grupo FROM grupos WHERE nombre_grupo = '6IV7'),
 (SELECT id_materia FROM materias WHERE nombre_materia = 'P604 – Inglés VI'),
 (SELECT id_semestre FROM semestres WHERE activo = TRUE LIMIT 1),
 5, '14:00:00', '16:00:00'),
((SELECT id_grupo FROM grupos WHERE nombre_grupo = '6IV7'),
 (SELECT id_materia FROM materias WHERE nombre_materia = 'P605 – Orientación Juvenil y Profesional IV'),
 (SELECT id_semestre FROM semestres WHERE activo = TRUE LIMIT 1),
 4, '13:00:00', '15:00:00'),
((SELECT id_grupo FROM grupos WHERE nombre_grupo = '6IV7'),
 (SELECT id_materia FROM materias WHERE nombre_materia = 'P606 – Ciberseguridad'),
 (SELECT id_semestre FROM semestres WHERE activo = TRUE LIMIT 1),
 2, '19:00:00', '21:00:00'),
((SELECT id_grupo FROM grupos WHERE nombre_grupo = '6IV7'),
 (SELECT id_materia FROM materias WHERE nombre_materia = 'P606 – Ciberseguridad'),
 (SELECT id_semestre FROM semestres WHERE activo = TRUE LIMIT 1),
 3, '15:00:00', '16:00:00'),
((SELECT id_grupo FROM grupos WHERE nombre_grupo = '6IV7'),
 (SELECT id_materia FROM materias WHERE nombre_materia = 'P607 – Introducción al Análisis de Datos'),
 (SELECT id_semestre FROM semestres WHERE activo = TRUE LIMIT 1),
 1, '17:00:00', '19:00:00'),
((SELECT id_grupo FROM grupos WHERE nombre_grupo = '6IV7'),
 (SELECT id_materia FROM materias WHERE nombre_materia = 'P607 – Introducción al Análisis de Datos'),
 (SELECT id_semestre FROM semestres WHERE activo = TRUE LIMIT 1),
 5, '16:00:00', '17:00:00'),
((SELECT id_grupo FROM grupos WHERE nombre_grupo = '6IV7'),
 (SELECT id_materia FROM materias WHERE nombre_materia = 'P608 – Fundamentos de Inteligencia Artificial'),
 (SELECT id_semestre FROM semestres WHERE activo = TRUE LIMIT 1),
 2, '16:00:00', '18:00:00'),
((SELECT id_grupo FROM grupos WHERE nombre_grupo = '6IV7'),
 (SELECT id_materia FROM materias WHERE nombre_materia = 'P609 – Laboratorio de Desarrollo de Software IV'),
 (SELECT id_semestre FROM semestres WHERE activo = TRUE LIMIT 1),
 2, '18:00:00', '19:00:00'),
((SELECT id_grupo FROM grupos WHERE nombre_grupo = '6IV7'),
 (SELECT id_materia FROM materias WHERE nombre_materia = 'P609 – Laboratorio de Desarrollo de Software IV'),
 (SELECT id_semestre FROM semestres WHERE activo = TRUE LIMIT 1),
 3, '18:00:00', '21:00:00'),
((SELECT id_grupo FROM grupos WHERE nombre_grupo = '6IV7'),
 (SELECT id_materia FROM materias WHERE nombre_materia = 'P609 – Laboratorio de Desarrollo de Software IV'),
 (SELECT id_semestre FROM semestres WHERE activo = TRUE LIMIT 1),
 4, '18:00:00', '21:00:00'),
((SELECT id_grupo FROM grupos WHERE nombre_grupo = '6IV7'),
 (SELECT id_materia FROM materias WHERE nombre_materia = 'P610 – Proyecto Integrador'),
 (SELECT id_semestre FROM semestres WHERE activo = TRUE LIMIT 1),
 2, '19:00:00', '21:00:00'),
((SELECT id_grupo FROM grupos WHERE nombre_grupo = '6IV7'),
 (SELECT id_materia FROM materias WHERE nombre_materia = 'P610 – Proyecto Integrador'),
 (SELECT id_semestre FROM semestres WHERE activo = TRUE LIMIT 1),
 3, '15:00:00', '16:00:00'),
((SELECT id_grupo FROM grupos WHERE nombre_grupo = '6IV7'),
 (SELECT id_materia FROM materias WHERE nombre_materia = 'P610 – Proyecto Integrador'),
 (SELECT id_semestre FROM semestres WHERE activo = TRUE LIMIT 1),
 5, '17:00:00', '19:00:00');


-- ============================================================================================================================
-- BLOQUE 13 — DATOS DE PRUEBA: ALUMNOS GRUPO 6IV7
-- ============================================================================================================================

INSERT INTO alumnos (boleta, nombre_completo, id_grupo_base, id_estado_academico)
VALUES
    (2024090440, 'AXEL VILLEGAS BECERRA',
     (SELECT id_grupo FROM grupos WHERE nombre_grupo = '6IV7'), 1),
    (2024090471, 'Lorenzo Garcia Saul',
     (SELECT id_grupo FROM grupos WHERE nombre_grupo = '6IV7'), 1),
    (2024090530, 'Molina Garcia Alexander Nicolas',
     (SELECT id_grupo FROM grupos WHERE nombre_grupo = '6IV7'), 1),
    (2023090794, 'Sanchez Nuñez Juan Pablo',
     (SELECT id_grupo FROM grupos WHERE nombre_grupo = '6IV7'), 1),
    (2024090723, 'Rodriguez Ortiz Jonathan Obed',
     (SELECT id_grupo FROM grupos WHERE nombre_grupo = '6IV7'), 1),
    (2024090827, 'Tableros Garcia Enrique',
     (SELECT id_grupo FROM grupos WHERE nombre_grupo = '6IV7'), 1),
    (2024090190, 'Delena Caballero Jose Roberto',
     (SELECT id_grupo FROM grupos WHERE nombre_grupo = '6IV7'), 1),
    (2024090839, 'Torres Morales Emilio Manuel',
     (SELECT id_grupo FROM grupos WHERE nombre_grupo = '6IV7'), 1),
    (2024090406, 'Jimenez Verdejo Marco',
     (SELECT id_grupo FROM grupos WHERE nombre_grupo = '6IV7'), 1),
    (2024090809, 'Sanchez Rosete Bruno Gabriel',
     (SELECT id_grupo FROM grupos WHERE nombre_grupo = '6IV7'), 1),
    (2024090084, 'Betanzos Soto Jorge Alonso',
     (SELECT id_grupo FROM grupos WHERE nombre_grupo = '6IV7'), 1)
ON CONFLICT (boleta) DO NOTHING;

INSERT INTO info_alumno (boleta)
VALUES
    (2024090440), (2024090471), (2024090530), (2023090794),
    (2024090723), (2024090827), (2024090190), (2024090839),
    (2024090406), (2024090809), (2024090084)
ON CONFLICT (boleta) DO NOTHING;

INSERT INTO materias_acreditadas (boleta, id_materia, id_semestre, fecha_acreditacion)
VALUES
    (2023090794,
     (SELECT id_materia FROM materias WHERE nombre_materia = 'P604 – Inglés VI'),
     (SELECT id_semestre FROM semestres WHERE activo = TRUE LIMIT 1), NULL),
    (2024090827,
     (SELECT id_materia FROM materias WHERE nombre_materia = 'P604 – Inglés VI'),
     (SELECT id_semestre FROM semestres WHERE activo = TRUE LIMIT 1), NULL),
    (2024090839,
     (SELECT id_materia FROM materias WHERE nombre_materia = 'P604 – Inglés VI'),
     (SELECT id_semestre FROM semestres WHERE activo = TRUE LIMIT 1), NULL),
    (2024090406,
     (SELECT id_materia FROM materias WHERE nombre_materia = 'P604 – Inglés VI'),
     (SELECT id_semestre FROM semestres WHERE activo = TRUE LIMIT 1), NULL),
    (2024090809,
     (SELECT id_materia FROM materias WHERE nombre_materia = 'P604 – Inglés VI'),
     (SELECT id_semestre FROM semestres WHERE activo = TRUE LIMIT 1), NULL),
    (2024090084,
     (SELECT id_materia FROM materias WHERE nombre_materia = 'P604 – Inglés VI'),
     (SELECT id_semestre FROM semestres WHERE activo = TRUE LIMIT 1), NULL)
ON CONFLICT (boleta, id_materia) DO NOTHING;


-- ============================================================================================================================
-- FIN DEL SCRIPT
-- ============================================================================================================================
-- RESUMEN v3.0:
--   CATÁLOGOS   → configuracion_sistema, roles, tipos_registro, estado_academico,
--                 turnos, carreras, materias, puntos_acceso, dias_inhabiles
--   TEMPORAL    → semestres
--   PERSONAL    → usuarios_sistema  (columna email integrada + índice único parcial)
--   SESIONES    → sessions          (persistencia de sesiones en Supabase)
--   ACADÉMICO   → grupos, horarios_grupo
--   ALUMNOS     → alumnos, info_alumno
--   IRREGULARES → materias_acreditadas, horario_alumno_extra
--   OPERACIÓN   → registros_acceso, justificaciones, bitacora_auditoria
--   SOPORTE     → tickets_soporte, mensajes_ticket, eventos_ticket
--
--   TRIGGERS    → trg_config_ultima_modificacion
--                 trg_bloqueo_automatico          (bloqueo por olvidos de credencial)
--                 trg_incrementar_sin_credencial   (contador automático)
--                 trg_incrementar_retardo          (contador automático)
--                 trg_un_semestre_activo           (singleton de semestre activo)
--                 trg_incrementar_falta            (contador automático de faltas)
--
--   DATOS PRUEBA → Grupo 6IV7 con 11 alumnos, 10 materias y horario completo
--
--   TOTAL: 24 tablas | 6 triggers | 9 índices | 3FN | PostgreSQL / Supabase
--
--   CAMBIOS v2.1 (Paso 1 — bugfix correos):
--     · email integrado directamente en CREATE TABLE usuarios_sistema (sin ALTER TABLE suelto)
--     · Tabla sessions integrada en el script principal (sin script aparte)
--     · Todos los inserts de alumnos consolidados en un solo bloque
--     · Hotfixes de desbloqueo eliminados (no pertenecen al script de definición)
--
--   CAMBIOS v3.0 (Pasos 2, 3, 4):
--     · Paso 2 — Horarios por materia:
--         - Tabla renombrada horario_grupo → horarios_grupo; PK id_horario_grupo → id_horario
--         - Columna dia VARCHAR → dia_semana SMALLINT (1=Lunes … 6=Sábado)
--         - semestres.nombre → semestres.nombre_semestre
--         - Materias y semestres seleccionables desde la UI de gestión de grupos
--     · Paso 3 — Registro de Faltas:
--         - tipos_registro: añadido (5, 'Falta')
--         - registros_acceso.id_punto_acceso: NOT NULL → DEFAULT NULL (faltas sin punto físico)
--         - registros_acceso: añadida columna observaciones VARCHAR(200) DEFAULT NULL
--         - info_alumno: añadida columna contador_faltas INT NOT NULL DEFAULT 0
--         - Trigger trg_incrementar_falta actualiza contador_faltas automáticamente
--     · Paso 4 — Sistema de Soporte:
--         - Rol 'Soporte' añadido a la tabla roles
--         - Límite de usuarios: 20 → 30
--         - Tablas: tickets_soporte, mensajes_ticket (+ url_evidencia), eventos_ticket
--         - Índices: idx_tickets_usuario, idx_tickets_estado_prio
--         - Evidencia adjunta: columna url_evidencia TEXT NULL en mensajes_ticket (URL Cloudinary)
--     · Paso 5 — Días Inhábiles:
--         - Tabla dias_inhabiles (fecha UNIQUE, descripcion, tipo, ciclo_escolar)
--         - Índice idx_dias_inhabiles_fecha
--         - Seed ciclo 2025-2026: 28 registros (festivos + puentes + vacaciones + institucionales)
--         - UI en módulo "Lógica de Negocio" con botón "Reiniciar año escolar"
--         - El reinicio elimina el ciclo anterior y recalcula festivos por ley (Constitución = 1er
--           lunes feb, Juárez = 3er lunes mar, Revolución = 3er lunes nov)
-- ============================================================================================================================
