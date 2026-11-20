<?php
session_start();
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');

function respond($status, $payload)
{
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE);
    exit;
}

if (!isset($_SESSION['ID_usuario'], $_SESSION['Rol'])) {
    respond(401, ['ok' => false, 'message' => 'No autorizado.']);
}
if ((int) $_SESSION['Rol'] !== 1) {
    respond(403, ['ok' => false, 'message' => 'No tiene permiso para consultar comparativas.']);
}
date_default_timezone_set('America/Costa_Rica');
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    header('Allow: POST');
    respond(405, ['ok' => false, 'message' => 'Método no permitido.']);
}

$input = json_decode(file_get_contents('php://input'), true);
if (!is_array($input)) {
    respond(400, ['ok' => false, 'message' => 'Solicitud no válida.']);
}

$areas = ['I Este', 'II Este', 'I Oeste', 'II Oeste', 'UCI'];
$area = $input['area'] ?? '';
$periods = $input['periods'] ?? null;
$validDate = static function ($value) {
    if (!is_string($value) || !preg_match('/^\d{4}-\d{2}-\d{2}$/D', $value)) {
        return false;
    }
    $date = DateTimeImmutable::createFromFormat('!Y-m-d', $value);
    return $date !== false && $date->format('Y-m-d') === $value;
};

if (!is_string($area) || ($area !== '' && !in_array($area, $areas, true))) {
    respond(400, ['ok' => false, 'message' => 'El área seleccionada no es válida.']);
}
if (!is_array($periods) || count($periods) !== 2) {
    respond(400, ['ok' => false, 'message' => 'Se requieren dos períodos para comparar.']);
}

foreach ($periods as $period) {
    if (!is_array($period)
        || !$validDate($period['from'] ?? null)
        || !$validDate($period['to'] ?? null)
        || $period['from'] > $period['to']
        || !is_string($period['label'] ?? null)
        || strlen($period['label']) > 40) {
        respond(400, ['ok' => false, 'message' => 'El rango de fechas no es válido.']);
    }
    if ($period['to'] > date('Y-m-d')) {
        respond(400, ['ok' => false, 'message' => 'La fecha final no puede ser posterior a hoy.']);
    }
}
include 'conexion.php';
$areaCondition = $area !== '' ? ' AND so.DepartamentoServicio = ?' : '';
$sessionSql = "SELECT COUNT(DISTINCT so.ID_sesion) AS sesiones,
                      COUNT(DISTINCT ep.ID_evaluacion) AS evaluaciones
               FROM SesionObservacion so
               LEFT JOIN EvaluacionProfesional ep ON ep.ID_sesion = so.ID_sesion
               WHERE so.Fecha >= ? AND so.Fecha <= ?$areaCondition";
$sql = "SELECT
            so.DepartamentoServicio AS area,
            ep.CategoriaProfesional AS categoria,
            mh.Tipo_momento AS momento,
            SUM(CASE WHEN mh.Accion_Realizada IN ('Lavado', 'Alcohol') THEN 1 ELSE 0 END) AS cumplidas,
            SUM(CASE WHEN mh.Accion_Realizada IN ('Lavado', 'Alcohol', 'No realizado') THEN 1 ELSE 0 END) AS oportunidades
        FROM MomentoHigiene mh
        JOIN EvaluacionProfesional ep ON ep.ID_evaluacion = mh.ID_evaluacion
        JOIN SesionObservacion so ON so.ID_sesion = ep.ID_sesion
        WHERE so.Fecha >= ? AND so.Fecha <= ?$areaCondition
        GROUP BY so.DepartamentoServicio, ep.CategoriaProfesional, mh.Tipo_momento";
$result = [];
foreach ($periods as $period) {
    $params = [$period['from'], $period['to']];
    if ($area !== '') {
        $params[] = $area;
    }

    $sessionStatement = db_query($conexion, $sessionSql, $params);
    if ($sessionStatement === false) {
        respond(500, ['ok' => false, 'message' => 'No se pudieron contar las sesiones del período.']);
    }
    $sessionCounts = db_fetch_assoc($sessionStatement) ?: [];
    db_free_stmt($sessionStatement);

    $statement = db_query($conexion, $sql, $params);
    if ($statement === false) {
        respond(500, ['ok' => false, 'message' => 'No se pudieron consultar las observaciones del período.']);
    }
    $data = [
        'label' => $period['label'],
        'from' => $period['from'],
        'to' => $period['to'],
        'cumplidas' => 0,
        'oportunidades' => 0,
        'sesiones' => (int) ($sessionCounts['sesiones'] ?? 0),
        'evaluaciones' => (int) ($sessionCounts['evaluaciones'] ?? 0),
        'momentos' => [],
        'areas' => [],
        'categorias' => []
    ];

    while ($row = db_fetch_assoc($statement)) {
        $completed = (int) $row['cumplidas'];
        $opportunities = (int) $row['oportunidades'];
        $moment = (int) $row['momento'];
        $department = (string) ($row['area'] ?? '');
        $category = (string) ($row['categoria'] ?? '');
        $data['cumplidas'] += $completed;
        $data['oportunidades'] += $opportunities;

        foreach ([['momentos', $moment], ['areas', $department], ['categorias', $category]] as [$dimension, $key]) {
            if (!isset($data[$dimension][$key])) {
                $data[$dimension][$key] = ['cumplidas' => 0, 'oportunidades' => 0];
            }
            $data[$dimension][$key]['cumplidas'] += $completed;
            $data[$dimension][$key]['oportunidades'] += $opportunities;
        }
    }
    db_free_stmt($statement);
    $data['cumplimiento'] = $data['oportunidades']
        ? round(100 * $data['cumplidas'] / $data['oportunidades'], 2)
        : null;
    $result[] = $data;
}

echo json_encode([
    'ok' => true,
    'periods' => $result,
    'filtros' => ['area' => $area]
], JSON_UNESCAPED_UNICODE);
mysqli_close($conexion);
?>
