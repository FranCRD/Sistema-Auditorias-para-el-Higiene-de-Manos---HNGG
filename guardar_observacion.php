<?php
/* =========================================================
   GUARDAR OBSERVACIÓN
   Maneja todo lo relacionado con evaluaciones y momentos:
   - crear_evaluacion     → crea una nueva evaluación
   - actualizar_categoria → actualiza categoría y subcategoría
   - guardar_momento      → guarda/actualiza un momento
   - guardar_notas        → actualiza las notas
   - eliminar_evaluacion  → borra una evaluación
   ========================================================= */
session_start();
header('Content-Type: application/json; charset=utf-8');
include("conexion.php");

if (!isset($_SESSION['ID_usuario'])) {
    echo json_encode(['ok' => false, 'message' => 'No autorizado']);
    exit;
}

$id_usuario = (int) $_SESSION['ID_usuario'];
$accion     = $_POST['accion'] ?? '';

/* =========================================================
   ACCIÓN: CREAR EVALUACIÓN
   ========================================================= */
if ($accion === 'crear_evaluacion') {

    $id_sesion = (int) ($_POST['id_sesion'] ?? 0);
    $categoria = trim($_POST['categoria'] ?? '');
    $subcategoria = trim($_POST['subcategoria'] ?? '');

    $categoriasValidas = ['Medicina', 'Enfermería', 'Otros'];
    if (!in_array($categoria, $categoriasValidas)) {
        echo json_encode(['ok' => false, 'message' => 'Categoría inválida']);
        exit;
    }

    // Verificar que la sesión pertenece al usuario y está activa
    $check = db_query(
        $conexion,
        "SELECT ID_sesion FROM SesionObservacion
         WHERE ID_sesion = ? AND ID_usuario = ? AND Estado = 'active'",
        [$id_sesion, $id_usuario]
    );
    if (!db_fetch_assoc($check)) {
        echo json_encode(['ok' => false, 'message' => 'Sesión no válida o ya cerrada']);
        exit;
    }
    db_free_stmt($check);

    // Calcular el siguiente número de evaluación en la sesión
    $stmt2 = db_query(
        $conexion,
        "SELECT COALESCE(MAX(NumeroProfesional), 0) + 1 AS siguiente
         FROM EvaluacionProfesional WHERE ID_sesion = ?",
        [$id_sesion]
    );
    $row = db_fetch_assoc($stmt2);
    $siguiente = (int) $row['siguiente'];
    db_free_stmt($stmt2);

    // Insertar
    $sqlInsert = "INSERT INTO EvaluacionProfesional
                    (CategoriaProfesional, SubcategoriaProfesional, CodigoProfesional,
                     NumeroProfesional, ID_sesion, Notas)
                  VALUES (?, ?, ?, ?, ?, NULL)";

    $codigoGen = "EVAL-" . str_pad($siguiente, 3, "0", STR_PAD_LEFT);
    $subcat    = $subcategoria !== '' ? $subcategoria : null;

    $stmt3 = db_query($conexion, $sqlInsert, [
        $categoria, $subcat, $codigoGen, $siguiente, $id_sesion
    ]);

    if ($stmt3 === false) {
        echo json_encode(['ok' => false, 'message' => 'No se pudo crear la evaluación.']);
        exit;
    }

    $nuevoId = (int) mysqli_insert_id($conexion);
    db_free_stmt($stmt3);

    echo json_encode([
        'ok'         => true,
        'evaluacion' => [
            'ID_evaluacion' => $nuevoId,
            'Categoria'     => $categoria,
            'Subcategoria'  => $subcat,
            'Codigo'        => $codigoGen,
            'Numero'        => $siguiente,
            'Notas'         => null,
            'Momentos'      => (object) []
        ]
    ]);
    mysqli_close($conexion);
    exit;
}

/* =========================================================
   ACCIÓN: ACTUALIZAR CATEGORÍA Y SUBCATEGORÍA
   ========================================================= */
if ($accion === 'actualizar_categoria') {

    $id_evaluacion = (int) ($_POST['id_evaluacion'] ?? 0);
    $categoria = trim($_POST['categoria'] ?? '');
    $subcategoria = trim($_POST['subcategoria'] ?? '');

    $subcategoriasValidas = [
        'Medicina' => ['', 'Residentes', 'Asistentes', 'Médicos internos'],
        'Enfermería' => ['', 'Asistente de pacientes', 'Auxiliar de enfermería', 'Enfermeros'],
        'Otros' => ['', 'Laboratorio', 'Terapia respiratoria', 'Terapia física', 'Psicología', 'Trabajo social', 'Nutrición']
    ];

    if ($id_evaluacion <= 0 || !isset($subcategoriasValidas[$categoria])) {
        echo json_encode(['ok' => false, 'message' => 'Evaluación o categoría inválida']);
        exit;
    }

    if (!in_array($subcategoria, $subcategoriasValidas[$categoria], true)) {
        echo json_encode(['ok' => false, 'message' => 'Subcategoría inválida para la categoría seleccionada']);
        exit;
    }

    $check = db_query(
        $conexion,
        "SELECT ep.ID_evaluacion
         FROM EvaluacionProfesional ep
         JOIN SesionObservacion so ON so.ID_sesion = ep.ID_sesion
         WHERE ep.ID_evaluacion = ? AND so.ID_usuario = ? AND so.Estado = 'active'",
        [$id_evaluacion, $id_usuario]
    );

    if ($check === false) {
        echo json_encode(['ok' => false, 'message' => 'No se pudo validar la evaluación.']);
        exit;
    }

    $evaluacion = db_fetch_assoc($check);
    db_free_stmt($check);
    if (!$evaluacion) {
        echo json_encode(['ok' => false, 'message' => 'Evaluación no válida o sesión ya cerrada']);
        exit;
    }

    $stmt = db_query(
        $conexion,
        "UPDATE EvaluacionProfesional
         SET CategoriaProfesional = ?, SubcategoriaProfesional = ?
         WHERE ID_evaluacion = ?",
        [$categoria, $subcategoria !== '' ? $subcategoria : null, $id_evaluacion]
    );

    if ($stmt === false) {
        echo json_encode(['ok' => false, 'message' => 'Error al actualizar la categoría.']);
        exit;
    }

    echo json_encode(['ok' => true, 'message' => 'Categoría actualizada']);
    db_free_stmt($stmt);
    mysqli_close($conexion);
    exit;
}

/* =========================================================
   ACCIÓN: GUARDAR MOMENTO
   ========================================================= */
if ($accion === 'guardar_momento') {

    $id_evaluacion = (int) ($_POST['id_evaluacion'] ?? 0);
    $tipo_momento  = (int) ($_POST['momento'] ?? 0);
    $accion_val    = trim($_POST['accion_valor'] ?? '');

    if ($tipo_momento < 1 || $tipo_momento > 5) {
        echo json_encode(['ok' => false, 'message' => 'Momento inválido']);
        exit;
    }

    $accionesValidas = ['Lavado', 'Alcohol', 'No realizado'];
    if (!in_array($accion_val, $accionesValidas)) {
        echo json_encode(['ok' => false, 'message' => 'Acción inválida']);
        exit;
    }

    // Verificar que la evaluación pertenece al usuario
    $check = db_query(
        $conexion,
        "SELECT ep.ID_evaluacion
         FROM EvaluacionProfesional ep
         JOIN SesionObservacion so ON so.ID_sesion = ep.ID_sesion
         WHERE ep.ID_evaluacion = ? AND so.ID_usuario = ?",
        [$id_evaluacion, $id_usuario]
    );
    if (!db_fetch_assoc($check)) {
        echo json_encode(['ok' => false, 'message' => 'Evaluación no válida']);
        exit;
    }
    db_free_stmt($check);

    // ¿Ya existe este momento?
    $check2 = db_query(
        $conexion,
        "SELECT ID_momento FROM MomentoHigiene
         WHERE ID_evaluacion = ? AND Tipo_momento = ?",
        [$id_evaluacion, $tipo_momento]
    );

    if (db_fetch_assoc($check2)) {
        // UPDATE
        $stmt = db_query(
            $conexion,
            "UPDATE MomentoHigiene SET Accion_Realizada = ?
             WHERE ID_evaluacion = ? AND Tipo_momento = ?",
            [$accion_val, $id_evaluacion, $tipo_momento]
        );
    } else {
        // INSERT
        $stmt = db_query(
            $conexion,
            "INSERT INTO MomentoHigiene (Tipo_momento, Accion_Realizada, ID_evaluacion)
             VALUES (?, ?, ?)",
            [$tipo_momento, $accion_val, $id_evaluacion]
        );
    }

    db_free_stmt($check2);

    if ($stmt === false) {
        echo json_encode(['ok' => false, 'message' => 'No se pudo guardar el momento.']);
        exit;
    }

    echo json_encode(['ok' => true, 'message' => 'Momento guardado']);
    db_free_stmt($stmt);
    mysqli_close($conexion);
    exit;
}

/* =========================================================
   ACCIÓN: GUARDAR NOTAS
   ========================================================= */
if ($accion === 'guardar_notas') {

    $id_evaluacion = (int) ($_POST['id_evaluacion'] ?? 0);
    $notas         = trim($_POST['notas'] ?? '');

    if (strlen($notas) > 500) {
        $notas = substr($notas, 0, 500);
    }

    // Verificar pertenencia
    $check = db_query(
        $conexion,
        "SELECT ep.ID_evaluacion
         FROM EvaluacionProfesional ep
         JOIN SesionObservacion so ON so.ID_sesion = ep.ID_sesion
         WHERE ep.ID_evaluacion = ? AND so.ID_usuario = ?",
        [$id_evaluacion, $id_usuario]
    );
    if (!db_fetch_assoc($check)) {
        echo json_encode(['ok' => false, 'message' => 'Evaluación no válida']);
        exit;
    }
    db_free_stmt($check);

    $stmt = db_query(
        $conexion,
        "UPDATE EvaluacionProfesional SET Notas = ? WHERE ID_evaluacion = ?",
        [$notas, $id_evaluacion]
    );

    if ($stmt === false) {
        echo json_encode(['ok' => false, 'message' => 'No se pudo guardar las notas.']);
        exit;
    }

    echo json_encode(['ok' => true, 'message' => 'Notas guardadas']);
    db_free_stmt($stmt);
    mysqli_close($conexion);
    exit;
}

/* =========================================================
   ACCIÓN: ELIMINAR EVALUACIÓN
   ========================================================= */
if ($accion === 'eliminar_evaluacion') {

    $id_evaluacion = (int) ($_POST['id_evaluacion'] ?? 0);

    // Verificar pertenencia + que no esté en sesión cerrada
    $check = db_query(
        $conexion,
        "SELECT ep.ID_evaluacion
         FROM EvaluacionProfesional ep
         JOIN SesionObservacion so ON so.ID_sesion = ep.ID_sesion
         WHERE ep.ID_evaluacion = ? AND so.ID_usuario = ? AND so.Estado = 'active'",
        [$id_evaluacion, $id_usuario]
    );
    if (!db_fetch_assoc($check)) {
        echo json_encode(['ok' => false, 'message' => 'Evaluación no válida']);
        exit;
    }
    db_free_stmt($check);

    // Los momentos se eliminan en cascada por el ON DELETE CASCADE
    $stmt = db_query(
        $conexion,
        "DELETE FROM EvaluacionProfesional WHERE ID_evaluacion = ?",
        [$id_evaluacion]
    );

    if ($stmt === false) {
        echo json_encode(['ok' => false, 'message' => 'No se pudo eliminar la evaluación.']);
        exit;
    }

    echo json_encode(['ok' => true, 'message' => 'Evaluación eliminada']);
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