<?php
session_start();
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');

function responder_inicio($status, array $data)
{
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
    exit;
}

function validar_id_inicio($value)
{
    $id = filter_var($value, FILTER_VALIDATE_INT);
    return $id !== false && $id > 0 ? $id : null;
}

function validar_texto_inicio(array $data, $key, $maxChars, $required = false)
{
    $value = $data[$key] ?? '';
    if (!is_string($value)) {
        return null;
    }

    $value = trim($value);
    $characterCount = preg_match_all('/./us', $value);
    if (($required && $value === '') || $characterCount === false ||
        $characterCount > $maxChars) {
        return null;
    }

    return $value;
}

function validar_url_inicio($value, $allowRelative = false)
{
    if (!is_string($value) || $value === '' || strlen($value) > 2048 ||
        preg_match('/[\x00-\x20\x7f\\\\]/', $value) || strpos($value, '//') === 0 ||
        preg_match('~(^|/)\.\.(/|$)~', $value)) {
        return false;
    }

    $parts = parse_url($value);
    if ($parts === false) {
        return false;
    }

    if (isset($parts['scheme']) || isset($parts['host'])) {
        return filter_var($value, FILTER_VALIDATE_URL) !== false &&
            strtolower($parts['scheme'] ?? '') === 'https' &&
            isset($parts['host']);
    }

    return $allowRelative && isset($parts['path']) && $parts['path'] !== '';
}

function obtener_filas_inicio($conexion, $sql)
{
    $stmt = db_query($conexion, $sql);
    $rows = [];
    while ($row = db_fetch_assoc($stmt)) {
        $rows[] = $row;
    }
    db_free_stmt($stmt);
    return $rows;
}

function ejecutar_inicio_blob($conexion, $sql, array $params, $types, $blobIndex, $blob)
{
    $stmt = mysqli_prepare($conexion, $sql);
    if (!$stmt) {
        error_log('Error al preparar la carga del documento: ' . mysqli_error($conexion));
        responder_inicio(500, ['ok' => false, 'message' => 'No se pudo guardar el documento.']);
    }

    $bindParams = [$stmt, $types];
    foreach ($params as $index => $value) {
        $bindParams[] = &$params[$index];
    }
    if (!call_user_func_array('mysqli_stmt_bind_param', $bindParams) ||
        !mysqli_stmt_send_long_data($stmt, $blobIndex, $blob) ||
        !mysqli_stmt_execute($stmt)) {
        error_log('Error al guardar el documento: ' . mysqli_stmt_error($stmt));
        mysqli_stmt_close($stmt);
        responder_inicio(500, ['ok' => false, 'message' => 'No se pudo guardar el documento.']);
    }

    return $stmt;
}

function almacenamiento_pdf_inicio_disponible($conexion)
{
    $stmt = db_query(
        $conexion,
        "SELECT COUNT(*) AS total
         FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = 'inicio_documentos'
           AND COLUMN_NAME IN ('archivo_pdf', 'archivo_nombre')"
    );
    $row = db_fetch_assoc($stmt);
    db_free_stmt($stmt);
    return (int) ($row['total'] ?? 0) === 2;
}

$autenticado = isset($_SESSION['ID_usuario'], $_SESSION['Rol']);
$esAdmin = $autenticado && (int) $_SESSION['Rol'] === 1;
$metodo = $_SERVER['REQUEST_METHOD'] ?? '';

if ($metodo === 'GET') {
    if (!$autenticado) {
        responder_inicio(401, ['ok' => false, 'message' => 'Sesión no autenticada.']);
    }

    require __DIR__ . '/conexion.php';
    $almacenamientoPdfDisponible = almacenamiento_pdf_inicio_disponible($conexion);

    if (isset($_GET['archivo_documento'])) {
        $documentId = validar_id_inicio($_GET['archivo_documento']);
        if ($documentId === null) {
            mysqli_close($conexion);
            responder_inicio(400, ['ok' => false, 'message' => 'Identificador inválido.']);
        }
        if (!$almacenamientoPdfDisponible) {
            mysqli_close($conexion);
            responder_inicio(404, ['ok' => false, 'message' => 'El documento no está disponible.']);
        }

        $query = 'SELECT archivo_pdf, archivo_nombre
                  FROM inicio_documentos
                  WHERE id = ? AND archivo_pdf IS NOT NULL';
        if (!$esAdmin) {
            $query .= ' AND activo = 1';
        }
        $fileStmt = db_query($conexion, $query, [$documentId]);
        $file = db_fetch_assoc($fileStmt);
        db_free_stmt($fileStmt);
        mysqli_close($conexion);

        if (!$file) {
            responder_inicio(404, ['ok' => false, 'message' => 'El documento no está disponible.']);
        }

        $filename = preg_replace('/[\x00-\x1f\x7f]/', '', basename($file['archivo_nombre'] ?: 'documento.pdf'));
        header('Content-Type: application/pdf');
        header('Content-Disposition: attachment; filename="documento.pdf"; filename*=UTF-8\'\'' . rawurlencode($filename));
        header('X-Content-Type-Options: nosniff');
        header('Content-Length: ' . strlen($file['archivo_pdf']));
        echo $file['archivo_pdf'];
        exit;
    }

    $stmt = db_query($conexion, 'SELECT titulo, descripcion, imagen_url FROM inicio_banner WHERE id = 1');
    $banner = db_fetch_assoc($stmt);
    db_free_stmt($stmt);
    if (!$banner) {
        error_log('No se encontró el banner principal de inicio.');
        responder_inicio(500, ['ok' => false, 'message' => 'No se pudo cargar el contenido del inicio.']);
    }

    $videoFilter = $esAdmin ? '' : ' WHERE activo = 1';
    $documentFilter = $esAdmin ? '' : ' WHERE activo = 1';
    $videos = obtener_filas_inicio(
        $conexion,
        'SELECT id, titulo, descripcion, categoria_tag, duracion, url_video,
                thumbnail_url, activo
         FROM inicio_videos' . $videoFilter . '
         ORDER BY id DESC'
    );
    $documentos = obtener_filas_inicio(
        $conexion,
        'SELECT id, nombre_doc, tamano_mb, url_archivo_pdf, tipo_icon, orden, activo,
                ' . ($almacenamientoPdfDisponible ? 'archivo_pdf IS NOT NULL' : '0') . ' AS tiene_archivo
         FROM inicio_documentos' . $documentFilter . '
         ORDER BY orden ASC, id ASC'
    );
    foreach ($documentos as &$documento) {
        $documento['tiene_archivo'] = (int) $documento['tiene_archivo'];
        if ($documento['tiene_archivo'] === 1) {
            $documento['url_archivo_pdf'] = 'contenido_inicio.php?archivo_documento=' . (int) $documento['id'];
        }
    }
    unset($documento);

    mysqli_close($conexion);

    $usuario = [
        'Nombre' => (string) ($_SESSION['Nombre'] ?? ''),
        'Apellidos' => (string) ($_SESSION['Apellidos'] ?? ''),
        'Genero' => (string) ($_SESSION['Genero'] ?? ''),
        'Rol' => (int) $_SESSION['Rol']
    ];
    $response = [
        'ok' => true,
        'usuario' => $usuario,
        'banner' => $banner,
        'videos' => $videos,
        'documentos' => $documentos
    ];

    if ($esAdmin) {
        if (empty($_SESSION['csrf_token'])) {
            $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
        }
        $response['csrf_token'] = $_SESSION['csrf_token'];
    }

    responder_inicio(200, $response);
}

if ($metodo !== 'POST') {
    header('Allow: GET, POST');
    responder_inicio(405, ['ok' => false, 'message' => 'Método no permitido.']);
}

if (!$autenticado) {
    responder_inicio(401, ['ok' => false, 'message' => 'Sesión no autenticada.']);
}

if (!$esAdmin) {
    responder_inicio(403, ['ok' => false, 'message' => 'No autorizado.']);
}

$csrf = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
$csrfSesion = $_SESSION['csrf_token'] ?? '';
if (!is_string($csrf) || !is_string($csrfSesion) || $csrfSesion === '' ||
    !hash_equals($csrfSesion, $csrf)) {
    responder_inicio(403, ['ok' => false, 'message' => 'Token CSRF inválido.']);
}

$contentType = strtolower($_SERVER['CONTENT_TYPE'] ?? '');
if (strpos($contentType, 'multipart/form-data') === 0) {
    $data = $_POST;
} else {
    $body = file_get_contents('php://input');
    $data = json_decode($body, true);
}
if (!is_array($data)) {
    responder_inicio(400, ['ok' => false, 'message' => 'No se pudo leer el formulario. Si el PDF es grande, pega un enlace en su lugar.']);
}

$action = $data['action'] ?? '';
if (!is_string($action)) {
    responder_inicio(400, ['ok' => false, 'message' => 'Acción inválida.']);
}

require __DIR__ . '/conexion.php';

if ($action === 'save_banner') {
    $title = validar_texto_inicio($data, 'titulo', 180, true);
    $description = validar_texto_inicio($data, 'descripcion', 2000, true);
    $image = validar_texto_inicio($data, 'imagen_url', 2048, true);

    if ($title === null || $description === null || $image === null ||
        !validar_url_inicio($image, true)) {
        responder_inicio(400, ['ok' => false, 'message' => 'Revise los datos del banner.']);
    }

    db_query(
        $conexion,
        'UPDATE inicio_banner SET titulo = ?, descripcion = ?, imagen_url = ? WHERE id = 1',
        [$title, $description, $image]
    );
    mysqli_close($conexion);
    responder_inicio(200, ['ok' => true]);
}

if ($action === 'save_video') {
    $hasId = array_key_exists('id', $data);
    $id = $hasId ? validar_id_inicio($data['id']) : null;
    $title = validar_texto_inicio($data, 'titulo', 180, true);
    $description = validar_texto_inicio($data, 'descripcion', 2000);
    $videoUrl = validar_texto_inicio($data, 'url_video', 2048, true);

    if (($hasId && $id === null) || $title === null ||
        $description === null || $videoUrl === null || !validar_url_inicio($videoUrl)) {
        responder_inicio(400, ['ok' => false, 'message' => 'Revise los datos y enlaces del video.']);
    }

    if ($id === null) {
        db_query(
            $conexion,
            'INSERT INTO inicio_videos
                (titulo, descripcion, categoria_tag, duracion, url_video, thumbnail_url, activo)
             VALUES (?, ?, ?, NULL, ?, NULL, 1)',
            [$title, $description, 'Capacitación', $videoUrl]
        );
    } else {
        $exists = db_query($conexion, 'SELECT id FROM inicio_videos WHERE id = ?', [$id]);
        $videoExists = db_fetch_assoc($exists);
        db_free_stmt($exists);
        if (!$videoExists) {
            responder_inicio(404, ['ok' => false, 'message' => 'El video no existe.']);
        }

        db_query(
            $conexion,
            'UPDATE inicio_videos
             SET titulo = ?, descripcion = ?, categoria_tag = ?, duracion = NULL,
                 url_video = ?, thumbnail_url = NULL
             WHERE id = ?',
            [$title, $description, 'Capacitación', $videoUrl, $id]
        );
    }

    mysqli_close($conexion);
    responder_inicio(200, ['ok' => true]);
}

if ($action === 'save_documento') {
    $hasId = array_key_exists('id', $data);
    $id = $hasId ? validar_id_inicio($data['id']) : null;
    $name = validar_texto_inicio($data, 'nombre_doc', 180, true);
    $url = validar_texto_inicio($data, 'url_archivo_pdf', 2048);
    $upload = $_FILES['archivo_pdf'] ?? null;
    $hasUpload = is_array($upload) && $upload['error'] !== UPLOAD_ERR_NO_FILE;
    $almacenamientoPdfDisponible = almacenamiento_pdf_inicio_disponible($conexion);

    if (($hasId && $id === null) || $name === null || $url === null ||
        ($url !== '' && !validar_url_inicio($url, true))) {
        responder_inicio(400, ['ok' => false, 'message' => 'Revise los datos del documento.']);
    }

    if ($hasUpload && $upload['error'] !== UPLOAD_ERR_OK) {
        $message = $upload['error'] === UPLOAD_ERR_INI_SIZE || $upload['error'] === UPLOAD_ERR_FORM_SIZE
            ? 'El PDF supera el límite de carga del servidor. Prueba con un archivo más pequeño o pega un enlace.'
            : 'No se pudo leer el archivo seleccionado. Inténtalo de nuevo o pega un enlace.';
        responder_inicio(400, ['ok' => false, 'message' => $message]);
    }
    if ($hasUpload && !$almacenamientoPdfDisponible) {
        responder_inicio(409, [
            'ok' => false,
            'message' => 'La base de datos necesita una actualización antes de aceptar archivos. Usa un enlace o aplica Migracion_inicio.sql.'
        ]);
    }
    if ($hasUpload && $url !== '') {
        responder_inicio(400, ['ok' => false, 'message' => 'Selecciona un archivo o pega un enlace, no ambos.']);
    }

    $fileContent = null;
    $filename = null;
    if ($hasUpload) {
        $maxBytes = 8 * 1024 * 1024;
        $originalName = (string) ($upload['name'] ?? '');
        if (!isset($upload['tmp_name'], $upload['size']) ||
            !is_uploaded_file($upload['tmp_name']) ||
            (int) $upload['size'] < 1 || (int) $upload['size'] > $maxBytes ||
            strtolower(pathinfo($originalName, PATHINFO_EXTENSION)) !== 'pdf') {
            responder_inicio(400, ['ok' => false, 'message' => 'Selecciona un PDF válido de hasta 8 MB.']);
        }

        $fileContent = file_get_contents($upload['tmp_name']);
        if ($fileContent === false || strpos(substr($fileContent, 0, 1024), '%PDF-') === false) {
            responder_inicio(400, ['ok' => false, 'message' => 'El archivo no parece ser un PDF válido.']);
        }
        $filename = basename(str_replace('\\', '/', $originalName));
        $filename = substr(preg_replace('/[\x00-\x1f\x7f]/', '', $filename), 0, 255);
        $url = '';
    }

    if ($id === null) {
        $orderResult = db_query($conexion, 'SELECT COALESCE(MAX(orden), 0) + 1 AS siguiente FROM inicio_documentos');
        $nextOrder = (int) (db_fetch_assoc($orderResult)['siguiente'] ?? 1);
        db_free_stmt($orderResult);
        if ($hasUpload) {
            $stmt = ejecutar_inicio_blob(
                $conexion,
                "INSERT INTO inicio_documentos
                    (nombre_doc, tamano_mb, url_archivo_pdf, tipo_icon, orden, activo, archivo_pdf, archivo_nombre)
                 VALUES (?, 0, ?, 'picture_as_pdf', ?, 1, ?, ?)",
                [$name, $url, $nextOrder, '', $filename],
                'ssibs',
                3,
                $fileContent
            );
            db_free_stmt($stmt);
        } else {
            if ($url === '') {
                responder_inicio(400, ['ok' => false, 'message' => 'Selecciona un PDF o pega un enlace al documento.']);
            }
            db_query(
                $conexion,
                "INSERT INTO inicio_documentos
                    (nombre_doc, tamano_mb, url_archivo_pdf, tipo_icon, orden, activo)
                 VALUES (?, 0, ?, 'picture_as_pdf', ?, 1)",
                [$name, $url, $nextOrder]
            );
        }
    } else {
        $exists = db_query($conexion, 'SELECT id FROM inicio_documentos WHERE id = ?', [$id]);
        $documentExists = db_fetch_assoc($exists);
        db_free_stmt($exists);
        if (!$documentExists) {
            responder_inicio(404, ['ok' => false, 'message' => 'El documento no existe.']);
        }

        if ($hasUpload) {
            $stmt = ejecutar_inicio_blob(
                $conexion,
                "UPDATE inicio_documentos
                 SET nombre_doc = ?, tamano_mb = 0, url_archivo_pdf = ?, tipo_icon = 'picture_as_pdf',
                     archivo_pdf = ?, archivo_nombre = ?
                 WHERE id = ?",
                [$name, $url, '', $filename, $id],
                'ssbsi',
                2,
                $fileContent
            );
            db_free_stmt($stmt);
        } elseif ($url !== '') {
            if ($almacenamientoPdfDisponible) {
                db_query(
                    $conexion,
                    "UPDATE inicio_documentos
                     SET nombre_doc = ?, tamano_mb = 0, url_archivo_pdf = ?, tipo_icon = 'picture_as_pdf',
                         archivo_pdf = NULL, archivo_nombre = NULL
                     WHERE id = ?",
                    [$name, $url, $id]
                );
            } else {
                db_query(
                    $conexion,
                    "UPDATE inicio_documentos
                     SET nombre_doc = ?, tamano_mb = 0, url_archivo_pdf = ?, tipo_icon = 'picture_as_pdf'
                     WHERE id = ?",
                    [$name, $url, $id]
                );
            }
        } else {
            db_query(
                $conexion,
                'UPDATE inicio_documentos SET nombre_doc = ? WHERE id = ?',
                [$name, $id]
            );
        }
    }

    mysqli_close($conexion);
    responder_inicio(200, ['ok' => true]);
}

if (preg_match('/^(delete|restore)_(video|documento)$/', $action, $matches)) {
    $id = validar_id_inicio($data['id'] ?? null);
    if ($id === null) {
        responder_inicio(400, ['ok' => false, 'message' => 'Identificador inválido.']);
    }

    $table = $matches[2] === 'video' ? 'inicio_videos' : 'inicio_documentos';
    $active = $matches[1] === 'restore' ? 1 : 0;
    $expected = $matches[1] === 'restore' ? 0 : 1;
    $stmt = db_query(
        $conexion,
        "UPDATE {$table} SET activo = ? WHERE id = ? AND activo = ?",
        [$active, $id, $expected]
    );
    $changed = mysqli_stmt_affected_rows($stmt);
    db_free_stmt($stmt);
    mysqli_close($conexion);

    if ($changed !== 1) {
        responder_inicio(404, ['ok' => false, 'message' => 'El contenido no existe o ya cambió de estado.']);
    }
    responder_inicio(200, ['ok' => true]);
}

mysqli_close($conexion);
responder_inicio(400, ['ok' => false, 'message' => 'Acción desconocida.']);
