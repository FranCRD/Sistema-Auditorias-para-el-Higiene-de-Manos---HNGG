<?php
/* =========================================================
   CONEXIÓN A MYSQL (Clever Cloud)
   Sistema de Auditoría de Higiene de Manos — HNGG
   ========================================================= */

$host = getenv("MYSQL_ADDON_HOST")     ?: "localhost";
$port = getenv("MYSQL_ADDON_PORT")     ?: "3306";
$user = getenv("MYSQL_ADDON_USER")     ?: "root";
$pass = getenv("MYSQL_ADDON_PASSWORD") ?: "";
$db   = getenv("MYSQL_ADDON_DB")       ?: "higiene_manos";

mysqli_report(MYSQLI_REPORT_OFF);
$conexion = mysqli_connect($host, $user, $pass, $db, (int) $port);

if (!$conexion) {
    error_log('Error de conexión a MySQL: ' . mysqli_connect_error());
    http_response_code(500);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode([
        'ok'      => false,
        'message' => 'Error de conexión a la base de datos.'
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

mysqli_set_charset($conexion, "utf8mb4");
date_default_timezone_set('America/Costa_Rica');

// Una cuenta desactivada pierde acceso en su siguiente solicitud autenticada.
$scriptActual = basename($_SERVER['SCRIPT_FILENAME'] ?? '');
if (isset($_SESSION['ID_usuario']) && !in_array($scriptActual, ['validar_Login.php', 'validar_registro.php'], true)) {
    $estadoSesion = mysqli_prepare($conexion, 'SELECT Estado FROM Usuario WHERE ID_usuario = ?');
    if ($estadoSesion) {
        $idSesion = (int) $_SESSION['ID_usuario'];
        mysqli_stmt_bind_param($estadoSesion, 'i', $idSesion);
        mysqli_stmt_execute($estadoSesion);
        mysqli_stmt_bind_result($estadoSesion, $estadoCuenta);
        $cuentaEncontrada = mysqli_stmt_fetch($estadoSesion);
        mysqli_stmt_close($estadoSesion);
        if (!$cuentaEncontrada || (int) $estadoCuenta !== 1) {
            mysqli_close($conexion);
            $_SESSION = [];
            session_destroy();
            http_response_code(401);
            header('Content-Type: application/json; charset=utf-8');
            echo json_encode(['ok' => false, 'message' => 'La cuenta ya no está activa. Inicie sesión nuevamente.'], JSON_UNESCAPED_UNICODE);
            exit;
        }
    }
}

function db_query($conexion, $sql, $params = [])
{
    $stmt = mysqli_prepare($conexion, $sql);
    if (!$stmt) {
        error_log('Error al preparar consulta MySQL: ' . mysqli_error($conexion));
        http_response_code(500);
        echo json_encode(['ok' => false, 'message' => 'Error al procesar la solicitud en la base de datos.']);
        exit;
    }

    if ($params) {
        $types = '';
        foreach ($params as $value) {
            $types .= is_int($value) ? 'i' : (is_float($value) ? 'd' : 's');
        }
        $bindParams = [$stmt, $types];
        foreach ($params as $index => $value) {
            $bindParams[] = &$params[$index];
        }

        if (!call_user_func_array('mysqli_stmt_bind_param', $bindParams)) {
            error_log('Error al enlazar parámetros MySQL: ' . mysqli_stmt_error($stmt));
            mysqli_stmt_close($stmt);
            http_response_code(500);
            echo json_encode(['ok' => false, 'message' => 'Error al procesar la solicitud en la base de datos.']);
            exit;
        }
    }

    if (!mysqli_stmt_execute($stmt)) {
        error_log('Error al ejecutar consulta MySQL: ' . mysqli_stmt_error($stmt));
        mysqli_stmt_close($stmt);
        http_response_code(500);
        echo json_encode(['ok' => false, 'message' => 'Error al procesar la solicitud en la base de datos.']);
        exit;
    }

    return $stmt;
}

function db_result_store()
{
    static $results;
    if ($results === null) {
        $results = new WeakMap();
    }
    return $results;
}

function db_fetch_assoc($stmt)
{
    $results = db_result_store();
    if (!isset($results[$stmt])) {
        $result = mysqli_stmt_get_result($stmt);
        if (!$result) {
            error_log('Error al obtener resultados MySQL: ' . mysqli_stmt_error($stmt));
            http_response_code(500);
            echo json_encode(['ok' => false, 'message' => 'Error al leer los datos de la base de datos.']);
            exit;
        }
        $results[$stmt] = $result;
    }

    return $results[$stmt]->fetch_assoc();
}

function db_free_stmt($stmt)
{
    $results = db_result_store();
    if (isset($results[$stmt])) {
        $results[$stmt]->free();
        unset($results[$stmt]);
    }
    mysqli_stmt_close($stmt);
}
?>
