<?php
session_start();
header('Content-Type: application/json; charset=utf-8');

if (!isset($_SESSION['ID_usuario'], $_SESSION['Rol']) || (int) $_SESSION['Rol'] !== 1) {
    http_response_code(403);
    echo json_encode(['ok' => false, 'message' => 'No autorizado']);
    exit;
}

include("conexion.php");

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $sql = "SELECT u.ID_usuario, u.Nombre, u.Apellidos, u.Correo,
                   u.Rol, u.Estado,
                   (SELECT so.DepartamentoServicio
                    FROM SesionObservacion so
                    WHERE so.ID_usuario = u.ID_usuario
                    ORDER BY so.Fecha DESC, so.ID_sesion DESC
                    LIMIT 1) AS Servicio
            FROM Usuario u
            ORDER BY u.Apellidos, u.Nombre, u.ID_usuario";

    $stmt = db_query($conexion, $sql);
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
            'Nombre' => $fila['Nombre'],
            'Apellidos' => $fila['Apellidos'],
            'Correo' => $fila['Correo'],
            'Rol' => (int) $fila['Rol'],
            'Estado' => (int) $fila['Estado'],
            'Servicio' => $fila['Servicio']
        ];
    }

    db_free_stmt($stmt);
    mysqli_close($conexion);
    echo json_encode(['ok' => true, 'usuarios' => $usuarios], JSON_UNESCAPED_UNICODE);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'message' => 'Método no permitido']);
    mysqli_close($conexion);
    exit;
}

$id = filter_var($_POST['id'] ?? null, FILTER_VALIDATE_INT);
$nombre = trim($_POST['nombre'] ?? '');
$apellidos = trim($_POST['apellidos'] ?? '');
$correo = trim($_POST['correo'] ?? '');
$rol = $_POST['rol'] ?? '';
$estado = $_POST['estado'] ?? '';

if (!$id || $id <= 0 || $nombre === '' || $apellidos === '' || strlen($nombre) > 80 ||
    strlen($apellidos) > 120 || strlen($correo) > 150 || !filter_var($correo, FILTER_VALIDATE_EMAIL)) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'message' => 'Revise el nombre, apellidos y correo ingresados.']);
    mysqli_close($conexion);
    exit;
}

if (!in_array($rol, ['0', '1'], true) || !in_array($estado, ['0', '1', '2'], true)) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'message' => 'El rol o estado seleccionado no es válido.']);
    mysqli_close($conexion);
    exit;
}

$id = (int) $id;
$rol = (int) $rol;
$estado = (int) $estado;

if ($id === (int) $_SESSION['ID_usuario'] && ($rol !== 1 || $estado !== 1)) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'message' => 'No puede quitarse sus propios permisos de administrador ni desactivar su cuenta.']);
    mysqli_close($conexion);
    exit;
}

$check = db_query(
    $conexion,
    "SELECT ID_usuario FROM Usuario WHERE ID_usuario = ?",
    [$id]
);

if ($check === false) {
    error_log('Error al validar usuario para actualización: ' . mysqli_error($conexion));
    http_response_code(500);
    echo json_encode(['ok' => false, 'message' => 'No se pudo validar la cuenta seleccionada.']);
    mysqli_close($conexion);
    exit;
}

$existe = db_fetch_assoc($check);
db_free_stmt($check);
if (!$existe) {
    http_response_code(404);
    echo json_encode(['ok' => false, 'message' => 'La cuenta seleccionada ya no existe.']);
    mysqli_close($conexion);
    exit;
}

$correoCheck = db_query(
    $conexion,
    "SELECT ID_usuario FROM Usuario WHERE Correo = ? AND ID_usuario <> ?",
    [$correo, $id]
);

if ($correoCheck === false) {
    error_log('Error al validar correo para actualización: ' . mysqli_error($conexion));
    http_response_code(500);
    echo json_encode(['ok' => false, 'message' => 'No se pudo validar el correo ingresado.']);
    mysqli_close($conexion);
    exit;
}

$correoDuplicado = db_fetch_assoc($correoCheck);
db_free_stmt($correoCheck);
if ($correoDuplicado) {
    http_response_code(409);
    echo json_encode(['ok' => false, 'message' => 'Ese correo ya está asignado a otra cuenta.']);
    mysqli_close($conexion);
    exit;
}

$stmt = db_query(
    $conexion,
    "UPDATE Usuario
     SET Nombre = ?, Apellidos = ?, Correo = ?, Rol = ?, Estado = ?
     WHERE ID_usuario = ?",
    [$nombre, $apellidos, $correo, $rol, $estado, $id]
);

if ($stmt === false) {
    error_log('Error al actualizar usuario: ' . mysqli_error($conexion));
    http_response_code(500);
    echo json_encode(['ok' => false, 'message' => 'No se pudieron guardar los cambios. Verifique que el correo no esté asignado a otra cuenta.']);
    mysqli_close($conexion);
    exit;
}

db_free_stmt($stmt);
mysqli_close($conexion);
echo json_encode(['ok' => true, 'message' => 'Usuario actualizado correctamente.']);
?>
