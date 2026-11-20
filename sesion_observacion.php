<?php
/* =========================================================
   SESIÓN DE OBSERVACIÓN
   Maneja todo lo relacionado con la sesión activa:
   - iniciar    → crea o recupera la sesión activa
   - cargar     → devuelve la sesión + evaluaciones + momentos
   - cambiar_area → actualiza el área
   - finalizar  → cierra la sesión
   ========================================================= */
session_start();
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
include("conexion.php");

/* ---------- Verificar autenticación ---------- */
if (!isset($_SESSION['ID_usuario'], $_SESSION['Rol'])) {
    http_response_code(401);
    echo json_encode(['ok' => false, 'message' => 'No autorizado']);
    exit;
}

$id_usuario = (int) $_SESSION['ID_usuario'];
$esAdmin    = (int) $_SESSION['Rol'] === 1;
$accion     = $_POST['accion'] ?? $_GET['accion'] ?? '';

/* =========================================================
   ACCIÓN: INICIAR
   Crea o recupera la sesión activa
   ========================================================= */
if ($accion === 'iniciar') {

    $sql = "SELECT ID_sesion, Fecha, HoraInicio, NumeroSesion,
                   DepartamentoServicio, NombreSala, Estado
            FROM SesionObservacion
            WHERE ID_usuario = ? AND Estado = 'active'
            ORDER BY ID_sesion DESC
            LIMIT 1";

    $stmt = db_query($conexion, $sql, [$id_usuario]);

    if ($stmt === false) {
        echo json_encode(['ok' => false, 'message' => 'No se pudo consultar la sesión.']);
        exit;
    }

    $sesion = db_fetch_assoc($stmt);
    db_free_stmt($stmt);

    if ($sesion) {
        echo json_encode([
            'ok'     => true,
            'nueva'  => false,
            'sesion' => [
                'ID_sesion'            => (int) $sesion['ID_sesion'],
                'Fecha'                => $sesion['Fecha'],
                'HoraInicio'           => substr($sesion['HoraInicio'], 0, 5),
                'NumeroSesion'         => (int) $sesion['NumeroSesion'],
                'DepartamentoServicio' => $sesion['DepartamentoServicio'],
                'NombreSala'           => $sesion['NombreSala']
            ]
        ]);
        mysqli_close($conexion);
        exit;
    }

    // No hay activa → crear una nueva
    $fecha      = date('Y-m-d');
    $horaInicio = date('H:i:s');

    $stmt2 = db_query(
        $conexion,
        "SELECT COUNT(*) AS total FROM SesionObservacion WHERE ID_usuario = ?",
        [$id_usuario]
    );
    $row = db_fetch_assoc($stmt2);
    $numSesion = ((int) $row['total']) + 1;
    db_free_stmt($stmt2);

    $sqlInsert = "INSERT INTO SesionObservacion 
                    (Fecha, HoraInicio, HoraFin, NumeroSesion,
                     DepartamentoServicio, NombreSala, ID_usuario, Estado)
                  VALUES (?, ?, ?, ?, 'UCI', NULL, ?, 'active')";

    $stmt3 = db_query($conexion, $sqlInsert, [$fecha, $horaInicio, $horaInicio, $numSesion, $id_usuario]);

    if ($stmt3 === false) {
        echo json_encode(['ok' => false, 'message' => 'No se pudo iniciar la sesión de observación.']);
        exit;
    }

    $nuevoId = (int) mysqli_insert_id($conexion);
    db_free_stmt($stmt3);

    echo json_encode([
        'ok'     => true,
        'nueva'  => true,
        'sesion' => [
            'ID_sesion'            => $nuevoId,
            'Fecha'                => $fecha,
            'HoraInicio'           => substr($horaInicio, 0, 5),
            'NumeroSesion'         => $numSesion,
            'DepartamentoServicio' => 'UCI',
            'NombreSala'           => null
        ]
    ]);
    mysqli_close($conexion);
    exit;
}

/* =========================================================
   ACCIÓN: CARGAR
   Devuelve la sesión completa con evaluaciones y momentos
   ========================================================= */
if ($accion === 'cargar') {

    $id_sesion = (int) ($_GET['id_sesion'] ?? 0);
    if ($id_sesion <= 0) {
        echo json_encode(['ok' => false, 'message' => 'ID de sesión inválido']);
        exit;
    }

    // 1. Cabecera de la sesión
    $stmt = db_query(
        $conexion,
        "SELECT ID_sesion, Fecha, HoraInicio, NumeroSesion,
                DepartamentoServicio, NombreSala, Estado
         FROM SesionObservacion
         WHERE ID_sesion = ? AND ID_usuario = ?",
        [$id_sesion, $id_usuario]
    );
    $sesion = db_fetch_assoc($stmt);
    db_free_stmt($stmt);

    if (!$sesion) {
        echo json_encode(['ok' => false, 'message' => 'Sesión no encontrada']);
        exit;
    }

    if (!$esAdmin && $sesion['Estado'] !== 'active') {
        http_response_code(403);
        echo json_encode(['ok' => false, 'message' => 'No tiene permiso para consultar sesiones finalizadas.']);
        exit;
    }

    // 2. Evaluaciones
    $stmt2 = db_query(
        $conexion,
        "SELECT ID_evaluacion, CategoriaProfesional, SubcategoriaProfesional,
                CodigoProfesional, NumeroProfesional, Notas
         FROM EvaluacionProfesional
         WHERE ID_sesion = ?
         ORDER BY NumeroProfesional",
        [$id_sesion]
    );

    $evaluaciones = [];
    while ($e = db_fetch_assoc($stmt2)) {
        $idEval = (int) $e['ID_evaluacion'];

        // 3. Momentos de cada evaluación
        $stmt3 = db_query(
            $conexion,
            "SELECT Tipo_momento, Accion_Realizada
             FROM MomentoHigiene
             WHERE ID_evaluacion = ?",
            [$idEval]
        );

        $momentos = [];
        while ($m = db_fetch_assoc($stmt3)) {
            $momentos[(int) $m['Tipo_momento']] = $m['Accion_Realizada'];
        }
        db_free_stmt($stmt3);

        $evaluaciones[] = [
            'ID_evaluacion'          => $idEval,
            'Categoria'              => $e['CategoriaProfesional'],
            'Subcategoria'           => $e['SubcategoriaProfesional'],
            'Codigo'                 => $e['CodigoProfesional'],
            'Numero'                 => (int) $e['NumeroProfesional'],
            'Notas'                  => $e['Notas'],
            'Momentos'               => $momentos
        ];
    }
    db_free_stmt($stmt2);

    echo json_encode([
        'ok'          => true,
        'sesion'      => [
            'ID_sesion'            => (int) $sesion['ID_sesion'],
            'Fecha'                => $sesion['Fecha'],
            'HoraInicio'           => substr($sesion['HoraInicio'], 0, 5),
            'NumeroSesion'         => (int) $sesion['NumeroSesion'],
            'DepartamentoServicio' => $sesion['DepartamentoServicio'],
            'NombreSala'           => $sesion['NombreSala']
        ],
        'evaluaciones' => $evaluaciones
    ]);
    mysqli_close($conexion);
    exit;
}

/* =========================================================
   ACCIÓN: CAMBIAR ÁREA
   ========================================================= */
if ($accion === 'cambiar_area') {

    $id_sesion = (int) ($_POST['id_sesion'] ?? 0);
    $area      = trim($_POST['area'] ?? '');

    $areasValidas = ['I Este', 'II Este', 'I Oeste', 'II Oeste', 'UCI'];
    if (!in_array($area, $areasValidas)) {
        echo json_encode(['ok' => false, 'message' => 'Área inválida']);
        exit;
    }

    $stmt = db_query(
        $conexion,
        "UPDATE SesionObservacion SET DepartamentoServicio = ?
         WHERE ID_sesion = ? AND ID_usuario = ?",
        [$area, $id_sesion, $id_usuario]
    );

    if ($stmt === false) {
        echo json_encode(['ok' => false, 'message' => 'No se pudo cambiar el área.']);
        exit;
    }

    echo json_encode(['ok' => true, 'message' => 'Área actualizada']);
    db_free_stmt($stmt);
    mysqli_close($conexion);
    exit;
}

/* =========================================================
   ACCIÓN: CONSULTAR ESTADO DE SESIÓN
   ========================================================= */
if ($accion === 'estado') {
    $id_sesion = (int) ($_GET['id_sesion'] ?? 0);
    if ($id_sesion <= 0) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'message' => 'La sesión indicada no es válida.']);
        exit;
    }

    $stmt = db_query(
        $conexion,
        "SELECT Estado FROM SesionObservacion WHERE ID_sesion = ? AND ID_usuario = ?",
        [$id_sesion, $id_usuario]
    );
    $sesion = db_fetch_assoc($stmt);
    db_free_stmt($stmt);

    if (!$sesion) {
        http_response_code(404);
        echo json_encode(['ok' => false, 'message' => 'No se encontró la sesión indicada.']);
        exit;
    }

    echo json_encode([
        'ok' => true,
        'finalizada' => $sesion['Estado'] === 'finished'
    ]);
    mysqli_close($conexion);
    exit;
}

/* =========================================================
   ACCIÓN: FINALIZAR
   ========================================================= */
if ($accion === 'finalizar') {

    $id_sesion = (int) ($_POST['id_sesion'] ?? 0);
    if ($id_sesion <= 0) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'message' => 'La sesión indicada no es válida.']);
        exit;
    }

    $stmtActual = db_query(
        $conexion,
        "SELECT Estado FROM SesionObservacion WHERE ID_sesion = ? AND ID_usuario = ?",
        [$id_sesion, $id_usuario]
    );
    $sesionActual = db_fetch_assoc($stmtActual);
    db_free_stmt($stmtActual);

    if (!$sesionActual) {
        http_response_code(404);
        echo json_encode(['ok' => false, 'message' => 'No se encontró la sesión que desea finalizar.']);
        exit;
    }

    if ($sesionActual['Estado'] === 'finished') {
        echo json_encode(['ok' => true, 'message' => 'Sesión finalizada']);
        mysqli_close($conexion);
        exit;
    }

    if ($sesionActual['Estado'] !== 'active') {
        http_response_code(409);
        echo json_encode(['ok' => false, 'message' => 'La sesión no se encuentra activa.']);
        exit;
    }

    $horaFin   = date('H:i:s');

    $stmt = db_query(
        $conexion,
        "UPDATE SesionObservacion SET Estado = 'finished', HoraFin = ?
         WHERE ID_sesion = ? AND ID_usuario = ?",
        [$horaFin, $id_sesion, $id_usuario]
    );

    if ($stmt === false) {
        echo json_encode(['ok' => false, 'message' => 'No se pudo finalizar la sesión.']);
        exit;
    }

    echo json_encode(['ok' => true, 'message' => 'Sesión finalizada']);
    db_free_stmt($stmt);
    mysqli_close($conexion);
    exit;
}

/* =========================================================
   ACCIÓN NO RECONOCIDA
   ========================================================= */
echo json_encode(['ok' => false, 'message' => 'Acción no reconocida']);
mysqli_close($conexion);
?>