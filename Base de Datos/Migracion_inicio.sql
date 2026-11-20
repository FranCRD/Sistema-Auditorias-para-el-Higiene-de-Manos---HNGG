-- Migration for the home page content tables.
-- Run against the existing Clever Cloud MySQL database.
-- Safe to run more than once; existing banner content is preserved.

ALTER TABLE Usuario
    ADD COLUMN IF NOT EXISTS Genero VARCHAR(30) NULL;

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
    creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    actualizado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY IX_inicio_documentos_publicados (activo, orden, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Add durable PDF storage to databases that already have the home tables.
SET @inicio_pdf_column_exists = (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'inicio_documentos'
      AND COLUMN_NAME = 'archivo_pdf'
);
SET @inicio_pdf_sql = IF(
    @inicio_pdf_column_exists = 0,
    'ALTER TABLE inicio_documentos ADD COLUMN archivo_pdf MEDIUMBLOB NULL',
    'SELECT 1'
);
PREPARE inicio_pdf_stmt FROM @inicio_pdf_sql;
EXECUTE inicio_pdf_stmt;
DEALLOCATE PREPARE inicio_pdf_stmt;

SET @inicio_nombre_column_exists = (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'inicio_documentos'
      AND COLUMN_NAME = 'archivo_nombre'
);
SET @inicio_nombre_sql = IF(
    @inicio_nombre_column_exists = 0,
    'ALTER TABLE inicio_documentos ADD COLUMN archivo_nombre VARCHAR(255) NULL',
    'SELECT 1'
);
PREPARE inicio_nombre_stmt FROM @inicio_nombre_sql;
EXECUTE inicio_nombre_stmt;
DEALLOCATE PREPARE inicio_nombre_stmt;

-- Verify that all three tables were created and the banner is initialized.
SHOW TABLES LIKE 'inicio_%';
SHOW COLUMNS FROM inicio_documentos LIKE 'archivo_%';
SELECT id, titulo, imagen_url FROM inicio_banner WHERE id = 1;
