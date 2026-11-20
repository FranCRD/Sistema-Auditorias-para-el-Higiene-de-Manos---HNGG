<?php
/* =========================================================
   LISTAR USUARIOS
   Solo admins. Soporta búsqueda, rol y estado.
   ========================================================= */
session_start();
header('Content-Type: application/json; charset=utf-8');

if (!isset($_SESSION['Rol']) || (int) $_SESSION['Rol'] !== 1) {
    http_response_code(403);
    echo json_encode(['ok' => false, 'message' => 'No autorizado']);
    exit;
}

include("conexion.php");

$filtro_estado = $_GET['estado'] ?? '';
$filtro_rol = $_GET['rol'] ?? '';
$filtro_buscar = $_GET['buscar'] ?? '';

if (($filtro_estado !== '' && !in_array($filtro_estado, ['0', '1', '2'], true)) ||
    ($filtro_rol !== '' && !in_array($filtro_rol, ['0', '1'], true)) ||
    !is_string($filtro_buscar)) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'message' => 'El filtro de rol o estado no es válido.']);
    mysqli_close($conexion);
    exit;
}

$filtro_buscar = trim($filtro_buscar);
$sql = "SELECT ID_usuario, Nombre, Apellidos, Cedula, Correo,
               Rol, Estado
        FROM Usuario
        WHERE 1 = 1";
$params = [];

if ($filtro_estado !== '') {
    $sql .= " AND Estado = ?";
    $params[] = (int) $filtro_estado;
}

if ($filtro_rol !== '') {
    $sql .= " AND Rol = ?";
    $params[] = (int) $filtro_rol;
}

if ($filtro_buscar !== '') {
    $sql .= " AND (Nombre LIKE ? OR Apellidos LIKE ? OR Cedula LIKE ? OR Correo LIKE ?)";
    $buscar = '%' . $filtro_buscar . '%';
    array_push($params, $buscar, $buscar, $buscar, $buscar);
}

$sql .= " ORDER BY ID_usuario DESC";
$stmt = db_query($conexion, $sql, $params);

if ($stmt === false) {
    error_log('Error al listar usuarios: ' . mysqli_error($conexion));
    http_response_code(500);
    echo json_encode(['ok' => false, 'message' => 'No se pudieron cargar los usuarios.']);
    mysqli_close($conexion);
    exit;
}

$usuarios = [];
while ($fila = db_fetch_assoc($stmt)) {
    $usuarios[] = [
        'ID_usuario' => (int) $fila['ID_usuario'],
        'Nombre' => $fila['Nombre'] . ' ' . $fila['Apellidos'],
        'NombrePila' => $fila['Nombre'],
        'Apellidos' => $fila['Apellidos'],
        'Cedula' => $fila['Cedula'],
        'Correo' => $fila['Correo'],
        'Rol' => (int) $fila['Rol'],
        'Estado' => (int) $fila['Estado']
    ];
}

db_free_stmt($stmt);
mysqli_close($conexion);
echo json_encode(['ok' => true, 'usuarios' => $usuarios], JSON_UNESCAPED_UNICODE);
?>
