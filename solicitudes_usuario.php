<?php
/* =========================================================
   GESTIONAR SOLICITUDES (aprobar o rechazar)
   ========================================================= */
session_start();
header('Content-Type: application/json; charset=utf-8');

include("conexion.php");

if (!isset($_SESSION['Rol']) || $_SESSION['Rol'] != 1) {
    echo json_encode(['ok' => false, 'message' => 'No autorizado']);
    exit;
}

$accion = $_POST['accion'] ?? '';
$id = intval($_POST['id'] ?? 0);

if (!in_array($accion, ['aprobar', 'rechazar'], true)) {
    echo json_encode(['ok' => false, 'message' => 'Acción inválida']);
    exit;
}

if ($id <= 0) {
    echo json_encode(['ok' => false, 'message' => 'ID inválido']);
    exit;
}

if ($accion === 'aprobar') {
    $sql = "UPDATE Usuario SET Estado = 1 WHERE ID_usuario = ?";
    $error = 'Error al aprobar';
    $success = 'Usuario aprobado correctamente.';
    $failure = 'No se pudo aprobar el usuario.';
} else {
    $sql = "DELETE FROM Usuario WHERE ID_usuario = ? AND Estado = 0";
    $error = 'Error al rechazar';
    $success = 'Solicitud rechazada.';
    $failure = 'No se pudo rechazar la solicitud.';
}

$stmt = db_query($conexion, $sql, [$id]);
if ($stmt === false) {
    echo json_encode(['ok' => false, 'message' => $error]);
    exit;
}

$rows = mysqli_stmt_affected_rows($stmt);
if ($rows > 0) {
    echo json_encode(['ok' => true, 'message' => $success]);
} else {
    echo json_encode(['ok' => false, 'message' => $failure]);
}

db_free_stmt($stmt);
mysqli_close($conexion);
?>
