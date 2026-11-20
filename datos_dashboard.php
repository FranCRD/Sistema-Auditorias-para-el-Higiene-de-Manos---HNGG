<?php
/* =========================================================
   DATOS DEL DASHBOARD
   Devuelve en un solo JSON todo lo que el dashboard necesita:
   - KPIs generales
   - Datos por momento (gráfico + tabla consolidada)
   - Datos por categoría y subcategoría (tabla de tabs)
   - Datos agrupados por ÁREA (para el Excel con formato IAAS)
   ========================================================= */
session_start();
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');

if (!isset($_SESSION['ID_usuario'], $_SESSION['Rol'])) {
    http_response_code(401);
    echo json_encode(['ok' => false, 'message' => 'No autorizado']);
    exit;
}

if ((int) $_SESSION['Rol'] !== 1) {
    http_response_code(403);
    echo json_encode(['ok' => false, 'message' => 'No tiene permiso para consultar los reportes.']);
    exit;
}

$AREAS = ['I Este', 'II Este', 'I Oeste', 'II Oeste', 'UCI'];
$areaFiltro = $_GET['area'] ?? '';
$fechaDesde = $_GET['desde'] ?? '';
$fechaHasta = $_GET['hasta'] ?? '';

function fechaDashboardValida($fecha)
{
    if ($fecha === '') return true;
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/D', $fecha)) return false;
    $valor = DateTimeImmutable::createFromFormat('!Y-m-d', $fecha);
    return $valor !== false && $valor->format('Y-m-d') === $fecha;
}

if (!is_string($areaFiltro) || ($areaFiltro !== '' && !in_array($areaFiltro, $AREAS, true))) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'message' => 'El área seleccionada no es válida.']);
    exit;
}

if (!is_string($fechaDesde) || !is_string($fechaHasta)
    || !fechaDashboardValida($fechaDesde) || !fechaDashboardValida($fechaHasta)
    || ($fechaDesde !== '' && $fechaHasta !== '' && $fechaDesde > $fechaHasta)) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'message' => 'El periodo de fechas no es válido.']);
    exit;
}

$condicionesFiltro = [];
$parametrosFiltro = [];
if ($areaFiltro !== '') {
    $condicionesFiltro[] = 'so.DepartamentoServicio = ?';
    $parametrosFiltro[] = $areaFiltro;
}
if ($fechaDesde !== '') {
    $condicionesFiltro[] = 'so.Fecha >= ?';
    $parametrosFiltro[] = $fechaDesde;
}
if ($fechaHasta !== '') {
    $condicionesFiltro[] = 'so.Fecha <= ?';
    $parametrosFiltro[] = $fechaHasta;
}
$whereFiltro = $condicionesFiltro ? 'WHERE ' . implode(' AND ', $condicionesFiltro) : '';

include("conexion.php");

/* =========================================================
   1. CATÁLOGOS
   ========================================================= */
$CATALOGO_SUBCATS = [
    'Medicina'   => ['Residentes', 'Asistentes', 'Médicos internos'],
    'Enfermería' => ['Asistente de pacientes', 'Auxiliar de enfermería', 'Enfermeros'],
    'Otros'      => ['Laboratorio', 'Terapia respiratoria', 'Terapia física', 'Psicología', 'Trabajo social', 'Nutrición']
];

/* =========================================================
   2. CONSULTAS GENERALES (KPIs + gráfico + tablas pantalla)
   ========================================================= */

// --- Consolidado por momento ---
$sqlPorMomento = "
    SELECT 
        mh.Tipo_momento,
        SUM(CASE WHEN mh.Accion_Realizada = 'Lavado'       THEN 1 ELSE 0 END) AS Lavado,
        SUM(CASE WHEN mh.Accion_Realizada = 'Alcohol'      THEN 1 ELSE 0 END) AS Alcohol,
        SUM(CASE WHEN mh.Accion_Realizada = 'No realizado' THEN 1 ELSE 0 END) AS NoRealiza
    FROM MomentoHigiene mh
    JOIN EvaluacionProfesional ep ON ep.ID_evaluacion = mh.ID_evaluacion
    JOIN SesionObservacion so     ON so.ID_sesion = ep.ID_sesion
    $whereFiltro
    GROUP BY mh.Tipo_momento
    ORDER BY mh.Tipo_momento
";

// --- Por categoría + subcategoría ---
$sqlPorCategoria = "
    SELECT 
        ep.CategoriaProfesional,
        ep.SubcategoriaProfesional,
        mh.Tipo_momento,
        SUM(CASE WHEN mh.Accion_Realizada = 'Lavado'       THEN 1 ELSE 0 END) AS Lavado,
        SUM(CASE WHEN mh.Accion_Realizada = 'Alcohol'      THEN 1 ELSE 0 END) AS Alcohol,
        SUM(CASE WHEN mh.Accion_Realizada = 'No realizado' THEN 1 ELSE 0 END) AS NoRealiza
    FROM MomentoHigiene mh
    JOIN EvaluacionProfesional ep ON ep.ID_evaluacion = mh.ID_evaluacion
    JOIN SesionObservacion so     ON so.ID_sesion = ep.ID_sesion
    $whereFiltro
    GROUP BY ep.CategoriaProfesional, ep.SubcategoriaProfesional, mh.Tipo_momento
    ORDER BY ep.CategoriaProfesional, ep.SubcategoriaProfesional, mh.Tipo_momento
";

/* =========================================================
   3. CONSULTAS POR ÁREA (para el Excel)
   Agrupadas por area y categoria_profesional
   ========================================================= */

// --- Por área y momento (consolidado) ---
$sqlPorArea = "
    SELECT 
        so.DepartamentoServicio AS Area,
        mh.Tipo_momento,
        SUM(CASE WHEN mh.Accion_Realizada = 'Lavado'       THEN 1 ELSE 0 END) AS Lavado,
        SUM(CASE WHEN mh.Accion_Realizada = 'Alcohol'      THEN 1 ELSE 0 END) AS Alcohol,
        SUM(CASE WHEN mh.Accion_Realizada = 'No realizado' THEN 1 ELSE 0 END) AS NoRealiza
    FROM MomentoHigiene mh
    JOIN EvaluacionProfesional ep ON ep.ID_evaluacion = mh.ID_evaluacion
    JOIN SesionObservacion so     ON so.ID_sesion = ep.ID_sesion
    $whereFiltro
    GROUP BY so.DepartamentoServicio, mh.Tipo_momento
    ORDER BY so.DepartamentoServicio, mh.Tipo_momento
";

// --- Por área y categoría profesional ---
$sqlPorAreaCategoria = "
    SELECT 
        so.DepartamentoServicio AS Area,
        ep.CategoriaProfesional,
        mh.Tipo_momento,
        SUM(CASE WHEN mh.Accion_Realizada = 'Lavado'       THEN 1 ELSE 0 END) AS Lavado,
        SUM(CASE WHEN mh.Accion_Realizada = 'Alcohol'      THEN 1 ELSE 0 END) AS Alcohol,
        SUM(CASE WHEN mh.Accion_Realizada = 'No realizado' THEN 1 ELSE 0 END) AS NoRealiza
    FROM MomentoHigiene mh
    JOIN EvaluacionProfesional ep ON ep.ID_evaluacion = mh.ID_evaluacion
    JOIN SesionObservacion so     ON so.ID_sesion = ep.ID_sesion
    $whereFiltro
    GROUP BY so.DepartamentoServicio, ep.CategoriaProfesional, mh.Tipo_momento
    ORDER BY so.DepartamentoServicio, ep.CategoriaProfesional, mh.Tipo_momento
";

// --- Cantidad de profesionales evaluados y momentos respondidos por área ---
$sqlConteosArea = "
    SELECT
        so.DepartamentoServicio AS Area,
        COUNT(DISTINCT ep.ID_evaluacion) AS ProfesionalesEvaluados,
        SUM(CASE WHEN mh.Accion_Realizada IS NOT NULL THEN 1 ELSE 0 END) AS MomentosRespondidos
    FROM SesionObservacion so
    JOIN EvaluacionProfesional ep ON ep.ID_sesion = so.ID_sesion
    LEFT JOIN MomentoHigiene mh   ON mh.ID_evaluacion = ep.ID_evaluacion
    $whereFiltro
    GROUP BY so.DepartamentoServicio
";

/* =========================================================
   4. EJECUTAR CONSULTAS
   ========================================================= */

// --- Por momento ---
$stmt = db_query($conexion, $sqlPorMomento, $parametrosFiltro);
if ($stmt === false) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'message' => 'Error consultando por momento.']);
    exit;
}

$porMomento = [];
$totalLavado = 0; $totalAlcohol = 0; $totalNoRealiza = 0;

while ($fila = db_fetch_assoc($stmt)) {
    $m = (int) $fila['Tipo_momento'];
    $porMomento[$m] = [
        'lavado'    => (int) $fila['Lavado'],
        'alcohol'   => (int) $fila['Alcohol'],
        'noRealiza' => (int) $fila['NoRealiza']
    ];
    $totalLavado    += (int) $fila['Lavado'];
    $totalAlcohol   += (int) $fila['Alcohol'];
    $totalNoRealiza += (int) $fila['NoRealiza'];
}
db_free_stmt($stmt);

$totalObservaciones = $totalLavado + $totalAlcohol + $totalNoRealiza;

// --- Por categoría + subcategoría ---
$stmt2 = db_query($conexion, $sqlPorCategoria, $parametrosFiltro);
if ($stmt2 === false) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'message' => 'Error consultando por categoría.']);
    exit;
}

$temp = [];
while ($fila = db_fetch_assoc($stmt2)) {
    $cat = $fila['CategoriaProfesional'];
    $sub = $fila['SubcategoriaProfesional'];
    $m   = (int) $fila['Tipo_momento'];
    $subKey = ($sub === null || $sub === '') ? '__sin__' : $sub;

    if (!isset($temp[$cat]))              $temp[$cat] = [];
    if (!isset($temp[$cat][$subKey]))     $temp[$cat][$subKey] = [];
    if (!isset($temp[$cat][$subKey][$m])) $temp[$cat][$subKey][$m] = ['lavado' => 0, 'alcohol' => 0, 'noRealiza' => 0];

    $temp[$cat][$subKey][$m]['lavado']    += (int) $fila['Lavado'];
    $temp[$cat][$subKey][$m]['alcohol']   += (int) $fila['Alcohol'];
    $temp[$cat][$subKey][$m]['noRealiza'] += (int) $fila['NoRealiza'];
}
db_free_stmt($stmt2);

// Armar estructura por categoría
$porCategoria = [];
foreach ($CATALOGO_SUBCATS as $cat => $subcats) {
    $subsFinal = [];
    $consolidadoCat = [];
    for ($m = 1; $m <= 5; $m++) {
        $consolidadoCat[$m] = ['lavado' => 0, 'alcohol' => 0, 'noRealiza' => 0];
    }

    foreach ($subcats as $sub) {
        $dataSub = $temp[$cat][$sub] ?? [];
        $consolidadoSub = [];
        for ($m = 1; $m <= 5; $m++) {
            $row = $dataSub[$m] ?? ['lavado' => 0, 'alcohol' => 0, 'noRealiza' => 0];
            $consolidadoSub[$m] = $row;
            $consolidadoCat[$m]['lavado']    += $row['lavado'];
            $consolidadoCat[$m]['alcohol']   += $row['alcohol'];
            $consolidadoCat[$m]['noRealiza'] += $row['noRealiza'];
        }
        $subsFinal[$sub] = ['consolidado' => $consolidadoSub];
    }

    $dataSin = $temp[$cat]['__sin__'] ?? [];
    $consolidadoSin = [];
    for ($m = 1; $m <= 5; $m++) {
        $row = $dataSin[$m] ?? ['lavado' => 0, 'alcohol' => 0, 'noRealiza' => 0];
        $consolidadoSin[$m] = $row;
        $consolidadoCat[$m]['lavado']    += $row['lavado'];
        $consolidadoCat[$m]['alcohol']   += $row['alcohol'];
        $consolidadoCat[$m]['noRealiza'] += $row['noRealiza'];
    }
    $subsFinal['__sin__'] = ['consolidado' => $consolidadoSin];

    $porCategoria[$cat] = [
        'consolidado'   => $consolidadoCat,
        'subcategorias' => $subsFinal
    ];
}

/* =========================================================
   5. PROCESAR DATOS POR ÁREA
   ========================================================= */

// --- Por área: momento × acción ---
$stmt3 = db_query($conexion, $sqlPorArea, $parametrosFiltro);
if ($stmt3 === false) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'message' => 'Error consultando por área.']);
    exit;
}

$areasData = [];
foreach ($AREAS as $area) {
    $areasData[$area] = [
        'porMomento'        => [],
        'porCategoria'      => ['Medicina' => [], 'Enfermería' => [], 'Otros' => []],
        'totalLavado'       => 0,
        'totalAlcohol'      => 0,
        'totalNoRealiza'    => 0,
        'profesionalesEvaluados' => 0,
        'momentosRespondidos' => 0
    ];
    for ($m = 1; $m <= 5; $m++) {
        $areasData[$area]['porMomento'][$m] = ['lavado' => 0, 'alcohol' => 0, 'noRealiza' => 0];
        $areasData[$area]['porCategoria']['Medicina'][$m]  = ['lavado' => 0, 'alcohol' => 0, 'noRealiza' => 0];
        $areasData[$area]['porCategoria']['Enfermería'][$m] = ['lavado' => 0, 'alcohol' => 0, 'noRealiza' => 0];
        $areasData[$area]['porCategoria']['Otros'][$m]     = ['lavado' => 0, 'alcohol' => 0, 'noRealiza' => 0];
    }
}

while ($fila = db_fetch_assoc($stmt3)) {
    $area = $fila['Area'];
    $m = (int) $fila['Tipo_momento'];
    if (!isset($areasData[$area])) continue;

    $areasData[$area]['porMomento'][$m] = [
        'lavado'    => (int) $fila['Lavado'],
        'alcohol'   => (int) $fila['Alcohol'],
        'noRealiza' => (int) $fila['NoRealiza']
    ];
    $areasData[$area]['totalLavado']    += (int) $fila['Lavado'];
    $areasData[$area]['totalAlcohol']   += (int) $fila['Alcohol'];
    $areasData[$area]['totalNoRealiza'] += (int) $fila['NoRealiza'];
}
db_free_stmt($stmt3);

// --- Por área + categoría ---
$stmt4 = db_query($conexion, $sqlPorAreaCategoria, $parametrosFiltro);
if ($stmt4 === false) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'message' => 'Error consultando por área/categoría.']);
    exit;
}

while ($fila = db_fetch_assoc($stmt4)) {
    $area = $fila['Area'];
    $cat  = $fila['CategoriaProfesional'];
    $m    = (int) $fila['Tipo_momento'];
    if (!isset($areasData[$area]['porCategoria'][$cat])) continue;

    $areasData[$area]['porCategoria'][$cat][$m] = [
        'lavado'    => (int) $fila['Lavado'],
        'alcohol'   => (int) $fila['Alcohol'],
        'noRealiza' => (int) $fila['NoRealiza']
    ];
}
db_free_stmt($stmt4);

// --- Conteos distintos a las acciones para que no se confundan evaluaciones con momentos ---
$stmt5 = db_query($conexion, $sqlConteosArea, $parametrosFiltro);
if ($stmt5 === false) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'message' => 'Error consultando la cantidad de profesionales observados.']);
    exit;
}

while ($fila = db_fetch_assoc($stmt5)) {
    $area = $fila['Area'];
    if (!isset($areasData[$area])) continue;
    $areasData[$area]['profesionalesEvaluados'] = (int) $fila['ProfesionalesEvaluados'];
    $areasData[$area]['momentosRespondidos'] = (int) $fila['MomentosRespondidos'];
}
db_free_stmt($stmt5);

$profesionalesEvaluados = 0;
$momentosRespondidos = 0;
foreach ($areasData as $areaData) {
    $profesionalesEvaluados += $areaData['profesionalesEvaluados'];
    $momentosRespondidos += $areaData['momentosRespondidos'];
}

/* =========================================================
   6. CALCULAR KPIs GENERALES
   ========================================================= */

$cumplidas = $totalLavado + $totalAlcohol;
$pctCumplimiento = $totalObservaciones > 0
    ? round(($cumplidas / $totalObservaciones) * 100, 1) : 0;
$pctNoRealizado = $totalObservaciones > 0
    ? round(($totalNoRealiza / $totalObservaciones) * 100, 1) : 0;

$momentoCriticoId = null;
$momentoCriticoCasos = 0;
foreach ($porMomento as $id => $datos) {
    if ($datos['noRealiza'] > $momentoCriticoCasos) {
        $momentoCriticoCasos = $datos['noRealiza'];
        $momentoCriticoId = $id;
    }
}

/* =========================================================
   7. RESPUESTA
   ========================================================= */
echo json_encode([
    'ok' => true,
    'kpis' => [
        'cumplimiento'    => $pctCumplimiento,
        'cumplidas'       => $cumplidas,
        'totalAcciones'   => $totalObservaciones,
        'noRealizado'     => $pctNoRealizado,
        'omitidas'        => $totalNoRealiza,
        'momentoCritico'  => [
            'id'    => $momentoCriticoId,
            'casos' => $momentoCriticoCasos
        ]
    ],
    'porMomento'         => $porMomento,
    'porCategoria'       => $porCategoria,
    'porArea'            => $areasData,
    'profesionalesEvaluados' => $profesionalesEvaluados,
    'momentosRespondidos' => $momentosRespondidos,
    'catalogoSubcats'    => $CATALOGO_SUBCATS,
    'areas'              => $AREAS,
    'filtros'            => [
        'area' => $areaFiltro,
        'desde' => $fechaDesde,
        'hasta' => $fechaHasta
    ],
    'totalObservaciones' => $totalObservaciones
], JSON_UNESCAPED_UNICODE);

mysqli_close($conexion);
?>