<?php
/* =========================================================
   VALIDAR LOGIN
   ========================================================= */
session_start();
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER["REQUEST_METHOD"] !== "POST") {
    http_response_code(405);
    echo json_encode(['ok' => false, 'message' => 'Método no permitido']);
    exit;
}

if (!isset($_POST['credential'], $_POST['password']) ||
    !is_string($_POST['credential']) ||
    !is_string($_POST['password'])) {
    echo json_encode(['ok' => false, 'message' => 'Complete todos los campos.']);
    exit;
}

$correo   = trim($_POST['credential']);
$password = $_POST['password'];

if (!$correo || !$password) {
    echo json_encode(['ok' => false, 'message' => 'Complete todos los campos.']);
    exit;
}

include("conexion.php");

$columnGeneroExists = false;
$schemaResult = mysqli_query($conexion, "SHOW COLUMNS FROM Usuario LIKE 'Genero'");
if ($schemaResult !== false && mysqli_num_rows($schemaResult) > 0) {
    $columnGeneroExists = true;
}
if ($schemaResult !== false) {
    mysqli_free_result($schemaResult);
}

// Buscar usuario por correo
$sql = "SELECT ID_usuario, Nombre, Apellidos, Correo, Contrasena, Rol, Estado" .
       ($columnGeneroExists ? ', Genero' : '') . "
        FROM Usuario
        WHERE Correo = ?";

$stmt = db_query($conexion, $sql, [$correo]);
$usuario = db_fetch_assoc($stmt);
db_free_stmt($stmt);

if (!$usuario) {
    mysqli_close($conexion);
    echo json_encode(['ok' => false, 'message' => 'Credencial no reconocida en el sistema.']);
    exit;
}

// Verificar contraseña
if (!password_verify($password, $usuario['Contrasena'])) {
    mysqli_close($conexion);
    echo json_encode(['ok' => false, 'message' => 'Contraseña incorrecta.']);
    exit;
}

// Verificar estado de la cuenta: 0 pendiente, 1 activa, 2 inactiva.
if ((int) $usuario['Estado'] !== 1) {
    $estadoInactivo = (int) $usuario['Estado'] === 2;
    mysqli_close($conexion);
    echo json_encode([
        'ok' => false,
        'message' => $estadoInactivo
            ? 'Su cuenta está inactiva. Contacte al administrador del sistema.'
            : 'Su cuenta está pendiente de aprobación por el Comité de IAAS.'
    ]);
    exit;
}

// Crear sesión PHP
session_regenerate_id(true);
$_SESSION['ID_usuario'] = (int) $usuario['ID_usuario'];
$_SESSION['Nombre']     = $usuario['Nombre'];
$_SESSION['Apellidos']  = $usuario['Apellidos'];
$_SESSION['Correo']     = $usuario['Correo'];
$_SESSION['Genero']     = $columnGeneroExists ? (isset($usuario['Genero']) ? trim((string) $usuario['Genero']) : '') : '';
$_SESSION['Rol']        = (int) $usuario['Rol'];
echo json_encode([
    'ok'      => true,
    'message' => 'Acceso concedido.',
    'usuario' => [
        'ID_usuario' => (int) $usuario['ID_usuario'],
        'Nombre'     => $usuario['Nombre'] . ' ' . $usuario['Apellidos'],
        'Correo'     => $usuario['Correo'],
        'Genero'     => $columnGeneroExists ? (isset($usuario['Genero']) ? trim((string) $usuario['Genero']) : '') : '',
        'Rol'        => (int) $usuario['Rol']
    ]
]);

mysqli_close($conexion);
?>