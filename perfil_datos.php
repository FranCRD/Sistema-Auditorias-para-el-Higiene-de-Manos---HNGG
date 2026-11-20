<?php
session_start();
header('Content-Type: application/json; charset=utf-8');

if (!isset($_SESSION['ID_usuario'])) {
    http_response_code(401);
    echo json_encode([
        'ok' => false,
        'message' => 'Sesión no autenticada.'
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

include __DIR__ . '/conexion.php';

$userId = (int) $_SESSION['ID_usuario'];
$hasGeneroColumn = false;
$schema = mysqli_query($conexion, "SHOW COLUMNS FROM Usuario LIKE 'Genero'");
if ($schema !== false && mysqli_num_rows($schema) > 0) {
    $hasGeneroColumn = true;
}
if ($schema !== false) {
    mysqli_free_result($schema);
}

$sqlUser = "SELECT Nombre, Apellidos, Cedula, Correo, Rol, Estado" . ($hasGeneroColumn ? ', Genero' : ', NULL AS Genero') . "
            FROM Usuario
            WHERE ID_usuario = ?";

$stmt = db_query($conexion, $sqlUser, [$userId]);
$user = db_fetch_assoc($stmt);
db_free_stmt($stmt);

if (!$user) {
    http_response_code(404);
    echo json_encode([
        'ok' => false,
        'message' => 'Usuario no encontrado.'
    ], JSON_UNESCAPED_UNICODE);
    mysqli_close($conexion);
    exit;
}

$evalCount = 0;
$sessionCount = 0;
$momentosCount = 0;

$stmt = db_query($conexion, "SELECT COUNT(*) AS total FROM EvaluacionProfesional ep JOIN SesionObservacion so ON so.ID_sesion = ep.ID_sesion WHERE so.ID_usuario = ?", [$userId]);
$evalRow = db_fetch_assoc($stmt);
if ($evalRow) {
    $evalCount = (int) ($evalRow['total'] ?? 0);
}
db_free_stmt($stmt);

$stmt = db_query($conexion, "SELECT COUNT(*) AS total FROM SesionObservacion WHERE ID_usuario = ?", [$userId]);
$sessionRow = db_fetch_assoc($stmt);
if ($sessionRow) {
    $sessionCount = (int) ($sessionRow['total'] ?? 0);
}
db_free_stmt($stmt);

$stmt = db_query($conexion, "SELECT COUNT(*) AS total
    FROM MomentoHigiene mh
    JOIN EvaluacionProfesional ep ON ep.ID_evaluacion = mh.ID_evaluacion
    JOIN SesionObservacion so ON so.ID_sesion = ep.ID_sesion
    WHERE so.ID_usuario = ?", [$userId]);
$momentoRow = db_fetch_assoc($stmt);
if ($momentoRow) {
    $momentosCount = (int) ($momentoRow['total'] ?? 0);
}
db_free_stmt($stmt);

$stmt = db_query($conexion, "SELECT so.ID_sesion, so.Fecha, so.HoraInicio, so.HoraFin, so.DepartamentoServicio, so.Estado,
    COUNT(ep.ID_evaluacion) AS evaluaciones
    FROM SesionObservacion so
    LEFT JOIN EvaluacionProfesional ep ON ep.ID_sesion = so.ID_sesion
    WHERE so.ID_usuario = ?
    GROUP BY so.ID_sesion, so.Fecha, so.HoraInicio, so.HoraFin, so.DepartamentoServicio, so.Estado
    ORDER BY so.Fecha DESC, so.HoraInicio DESC
    LIMIT 12", [$userId]);

$historial = [];
while ($row = db_fetch_assoc($stmt)) {
    $historial[] = [
        'ID_sesion' => (int) ($row['ID_sesion'] ?? 0),
        'Fecha' => $row['Fecha'] ?? null,
        'HoraInicio' => $row['HoraInicio'] ?? null,
        'HoraFin' => $row['HoraFin'] ?? null,
        'DepartamentoServicio' => $row['DepartamentoServicio'] ?? '',
        'Estado' => $row['Estado'] ?? 'active',
        'evaluaciones' => (int) ($row['evaluaciones'] ?? 0)
    ];
}
db_free_stmt($stmt);

mysqli_close($conexion);

$rol = (int) ($user['Rol'] ?? 0);
$genero = isset($user['Genero']) ? trim((string) $user['Genero']) : '';

if (!$hasGeneroColumn || $genero === '' || $genero === 'NULL') {
    $genero = 'No especificado';
}

echo json_encode([
    'ok' => true,
    'usuario' => [
        'ID_usuario' => $userId,
        'Nombre' => (string) ($user['Nombre'] ?? ''),
        'Apellidos' => (string) ($user['Apellidos'] ?? ''),
        'Cedula' => (string) ($user['Cedula'] ?? ''),
        'Correo' => (string) ($user['Correo'] ?? ''),
        'Genero' => $genero,
        'Rol' => $rol,
        'Estado' => (int) ($user['Estado'] ?? 0),
    ],
    'estadisticas' => [
        'evaluaciones' => $evalCount,
        'sesiones' => $sessionCount,
        'momentos' => $momentosCount,
    ],
    'historial' => $historial,
], JSON_UNESCAPED_UNICODE);
