-- MySQL - BASE DE DATOS PARA HNGG
-- Franco Córdoba Campos

-- =========================================================
-- 1) USUARIO 
-- =========================================================
CREATE TABLE IF NOT EXISTS Usuario (
    ID_usuario INT NOT NULL AUTO_INCREMENT,
    Nombre VARCHAR(80) NOT NULL,
    Apellidos VARCHAR(120) NOT NULL,
    Cedula VARCHAR(30) NOT NULL,
    Correo VARCHAR(150) NOT NULL,
    Genero VARCHAR(30) NULL,
    Contrasena VARCHAR(255) NOT NULL,
    Rol TINYINT UNSIGNED NOT NULL DEFAULT 0,
    -- 0 = pendiente de aprobación, 1 = activo, 2 = inactivo.
    Estado TINYINT UNSIGNED NOT NULL DEFAULT 0,
    PRIMARY KEY (ID_usuario),
    UNIQUE KEY UQ_Usuario_Cedula (Cedula),
    UNIQUE KEY UQ_Usuario_Correo (Correo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Para usuarios ya creados:
ALTER TABLE Usuario
    ADD COLUMN IF NOT EXISTS Genero VARCHAR(30) NULL;

UPDATE Usuario
SET Genero = 'Prefiero no decirlo'
WHERE Genero IS NULL OR TRIM(Genero) = '';

-- =========================================================
-- 2) HOME / INICIO
-- =========================================================
CREATE TABLE IF NOT EXISTS inicio_banner (
    id TINYINT UNSIGNED NOT NULL,
    titulo VARCHAR(180) NOT NULL,
    descripcion TEXT NOT NULL,
    imagen_url VARCHAR(2048) NOT NULL,
    actualizado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    CONSTRAINT CK_inicio_banner_singleton CHECK (id = 1)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO inicio_banner (id, titulo, descripcion, imagen_url)
VALUES (
    1,
    'Estrategia Multimodal de Higiene de Manos',
    'Sistema de vigilancia epidemiológica para la prevención y control de infecciones intrahospitalarias en el Hospital Nacional de Geriatría y Gerontología.',
    'images/HNGG_Nuevo.png'
);

CREATE TABLE IF NOT EXISTS inicio_videos (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    titulo VARCHAR(180) NOT NULL,
    descripcion TEXT NULL,
    categoria_tag VARCHAR(60) NULL,
    duracion VARCHAR(20) NULL,
    url_video VARCHAR(2048) NOT NULL,
    thumbnail_url VARCHAR(2048) NULL,
    activo TINYINT(1) NOT NULL DEFAULT 1,
    creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    actualizado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY IX_inicio_videos_publicados (activo, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS inicio_documentos (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    nombre_doc VARCHAR(180) NOT NULL,
    tamano_mb DECIMAL(8,2) NOT NULL DEFAULT 0,
    url_archivo_pdf VARCHAR(2048) NOT NULL,
    tipo_icon VARCHAR(40) NOT NULL DEFAULT 'picture_as_pdf',
    orden INT UNSIGNED NOT NULL DEFAULT 0,
    activo TINYINT(1) NOT NULL DEFAULT 1,
    archivo_pdf MEDIUMBLOB NULL,
    archivo_nombre VARCHAR(255) NULL,
    creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    actualizado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY IX_inicio_documentos_publicados (activo, orden, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Si lo ejecutas en una BD que ya tiene la tabla creada pero sin esos campos:
ALTER TABLE inicio_documentos
    ADD COLUMN IF NOT EXISTS archivo_pdf MEDIUMBLOB NULL,
    ADD COLUMN IF NOT EXISTS archivo_nombre VARCHAR(255) NULL;

-- =========================================================
-- 3) SESIONES Y EVALUACIONES
-- =========================================================
CREATE TABLE IF NOT EXISTS SesionObservacion (
    ID_sesion INT NOT NULL AUTO_INCREMENT,
    Fecha DATE NOT NULL,
    HoraInicio TIME NOT NULL,
    HoraFin TIME NOT NULL,
    Duracion SMALLINT GENERATED ALWAYS AS (
        TIME_TO_SEC(TIMEDIFF(HoraFin, HoraInicio)) DIV 60
    ) STORED,
    NumeroSesion INT NOT NULL,
    DepartamentoServicio VARCHAR(100) NOT NULL,
    NombreSala VARCHAR(100) NULL,
    ID_usuario INT NOT NULL,
    Estado VARCHAR(20) NOT NULL DEFAULT 'active',
    PRIMARY KEY (ID_sesion),
    KEY IX_SesionObservacion_Usuario_Estado (ID_usuario, Estado),
    CONSTRAINT FK_Sesion_Usuario FOREIGN KEY (ID_usuario)
        REFERENCES Usuario(ID_usuario),
    CONSTRAINT CK_Sesion_Departamento CHECK (
        DepartamentoServicio IN ('I Este', 'II Este', 'I Oeste', 'II Oeste', 'UCI')
    )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS EvaluacionProfesional (
    ID_evaluacion INT NOT NULL AUTO_INCREMENT,
    CategoriaProfesional VARCHAR(60) NOT NULL,
    SubcategoriaProfesional VARCHAR(60) NULL,
    CodigoProfesional VARCHAR(40) NOT NULL,
    NumeroProfesional INT NOT NULL,
    ID_sesion INT NOT NULL,
    Notas VARCHAR(500) NULL,
    PRIMARY KEY (ID_evaluacion),
    KEY IX_EvaluacionProfesional_Sesion (ID_sesion),
    CONSTRAINT FK_Evaluacion_Sesion FOREIGN KEY (ID_sesion)
        REFERENCES SesionObservacion(ID_sesion) ON DELETE CASCADE,
    CONSTRAINT CK_Evaluacion_Categoria CHECK (
        CategoriaProfesional IN ('Medicina', 'Enfermería', 'Otros')
    )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS MomentoHigiene (
    ID_momento INT NOT NULL AUTO_INCREMENT,
    Tipo_momento INT NOT NULL,
    Accion_Realizada VARCHAR(40) NULL,
    ID_evaluacion INT NOT NULL,
    PRIMARY KEY (ID_momento),
    UNIQUE KEY UQ_Momento_UnicoPorEvaluacion (ID_evaluacion, Tipo_momento),
    CONSTRAINT FK_Momento_Evaluacion FOREIGN KEY (ID_evaluacion)
        REFERENCES EvaluacionProfesional(ID_evaluacion) ON DELETE CASCADE,
    CONSTRAINT CK_Momento_Tipo CHECK (Tipo_momento BETWEEN 1 AND 5),
    CONSTRAINT CK_Momento_Accion CHECK (
        Accion_Realizada IS NULL OR Accion_Realizada IN ('Lavado', 'Alcohol', 'No realizado')
    )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =========================================================
-- 4) VIEWS
-- =========================================================
CREATE OR REPLACE VIEW vw_CumplimientoPorSesion AS
SELECT
    so.ID_sesion,
    so.Fecha,
    so.DepartamentoServicio,
    so.NombreSala,
    CONCAT(u.Nombre, ' ', u.Apellidos) AS Observador,
    COUNT(mh.ID_momento) AS TotalObservaciones,
    SUM(CASE WHEN mh.Accion_Realizada IN ('Lavado', 'Alcohol') THEN 1 ELSE 0 END) AS Cumplidas,
    SUM(CASE WHEN mh.Accion_Realizada = 'No realizado' THEN 1 ELSE 0 END) AS Omitidas,
    CAST(100.0 * SUM(CASE WHEN mh.Accion_Realizada IN ('Lavado', 'Alcohol') THEN 1 ELSE 0 END)
         / NULLIF(COUNT(mh.ID_momento), 0) AS DECIMAL(5,2)) AS PorcentajeCumplimiento
FROM SesionObservacion so
JOIN Usuario u ON u.ID_usuario = so.ID_usuario
LEFT JOIN EvaluacionProfesional ep ON ep.ID_sesion = so.ID_sesion
LEFT JOIN MomentoHigiene mh ON mh.ID_evaluacion = ep.ID_evaluacion
GROUP BY so.ID_sesion, so.Fecha, so.DepartamentoServicio, so.NombreSala, u.Nombre, u.Apellidos;

CREATE OR REPLACE VIEW vw_MatrizMomentoCategoria AS
SELECT
    so.DepartamentoServicio,
    ep.CategoriaProfesional,
    ep.SubcategoriaProfesional,
    mh.Tipo_momento,
    mh.Accion_Realizada,
    COUNT(*) AS Cantidad
FROM MomentoHigiene mh
JOIN EvaluacionProfesional ep ON ep.ID_evaluacion = mh.ID_evaluacion
JOIN SesionObservacion so ON so.ID_sesion = ep.ID_sesion
GROUP BY so.DepartamentoServicio, ep.CategoriaProfesional, ep.SubcategoriaProfesional,
         mh.Tipo_momento, mh.Accion_Realizada;

CREATE OR REPLACE VIEW vw_CumplimientoPorDepartamento AS
SELECT
    so.DepartamentoServicio,
    COUNT(mh.ID_momento) AS TotalObservaciones,
    SUM(CASE WHEN mh.Accion_Realizada IN ('Lavado', 'Alcohol') THEN 1 ELSE 0 END) AS Cumplidas,
    SUM(CASE WHEN mh.Accion_Realizada = 'No realizado' THEN 1 ELSE 0 END) AS Omitidas,
    CAST(100.0 * SUM(CASE WHEN mh.Accion_Realizada IN ('Lavado', 'Alcohol') THEN 1 ELSE 0 END)
         / NULLIF(COUNT(mh.ID_momento), 0) AS DECIMAL(5,2)) AS PorcentajeCumplimiento
FROM SesionObservacion so
LEFT JOIN EvaluacionProfesional ep ON ep.ID_sesion = so.ID_sesion
LEFT JOIN MomentoHigiene mh ON mh.ID_evaluacion = ep.ID_evaluacion
GROUP BY so.DepartamentoServicio;

CREATE OR REPLACE VIEW vw_CumplimientoPorCategoria AS
SELECT
    ep.CategoriaProfesional,
    ep.SubcategoriaProfesional,
    COUNT(mh.ID_momento) AS TotalObservaciones,
    SUM(CASE WHEN mh.Accion_Realizada IN ('Lavado', 'Alcohol') THEN 1 ELSE 0 END) AS Cumplidas,
    SUM(CASE WHEN mh.Accion_Realizada = 'No realizado' THEN 1 ELSE 0 END) AS Omitidas,
    CAST(100.0 * SUM(CASE WHEN mh.Accion_Realizada IN ('Lavado', 'Alcohol') THEN 1 ELSE 0 END)
         / NULLIF(COUNT(mh.ID_momento), 0) AS DECIMAL(5,2)) AS PorcentajeCumplimiento
FROM EvaluacionProfesional ep
LEFT JOIN MomentoHigiene mh ON mh.ID_evaluacion = ep.ID_evaluacion
GROUP BY ep.CategoriaProfesional, ep.SubcategoriaProfesional;

-- =========================================================
-- 5) PROMOCIÓN DE ADMIN PARA PRUEBA
-- =========================================================
-- UPDATE Usuario SET Rol = 1, Estado = 1 WHERE Correo = 'admin@example.com';

-- =========================================================
-- 6) EJEMPLO PARA ASIGNAR GÉNERO A USUARIOS EXISTENTES
-- =========================================================
-- UPDATE Usuario SET Genero = 'Masculino' WHERE ID_usuario = 1;
-- UPDATE Usuario SET Genero = 'Femenino' WHERE ID_usuario = 2;
-- UPDATE Usuario SET Genero = 'Otro' WHERE ID_usuario = 3;
-- UPDATE Usuario SET Genero = 'Prefiero no decirlo' WHERE Genero IS NULL;
