<?php
/* =========================================================
   VALIDAR REGISTRO
   ========================================================= */
header('Content-Type: application/json; charset=utf-8');

include("conexion.php");

if ($_SERVER["REQUEST_METHOD"] !== "POST") {
    http_response_code(405);
    echo json_encode(['ok' => false, 'message' => 'Método no permitido']);
    exit;
}

$cedulaRecibida = $_POST['cedula'] ?? '';
if (!is_string($cedulaRecibida)) {
    echo json_encode(['ok' => false, 'message' => 'Ingrese una cédula o identificación válida.']);
    mysqli_close($conexion);
    exit;
}

$nombre    = trim($_POST['full-name'] ?? '');
$cedula    = trim($cedulaRecibida);
$correo    = trim($_POST['email'] ?? '');
$genero    = trim($_POST['genero'] ?? '');
$password  = $_POST['password'] ?? '';
$password2 = $_POST['password-confirm'] ?? '';

$generosPermitidos = ['Masculino', 'Femenino', 'Otro', 'Prefiero no decirlo'];

// Validaciones
if (!$nombre || $cedula === '' || !$correo || !$genero || !$password || !$password2) {
    echo json_encode(['ok' => false, 'message' => 'Complete todos los campos obligatorios.']);
    exit;
}

if (!in_array($genero, $generosPermitidos, true)) {
    echo json_encode(['ok' => false, 'message' => 'Seleccione un sexo o género válido.']);
    exit;
}

if (strlen($cedula) > 30) {
    echo json_encode(['ok' => false, 'message' => 'La cédula o identificación no puede superar 30 caracteres.']);
    exit;
}

if (!filter_var($correo, FILTER_VALIDATE_EMAIL)) {
    echo json_encode(['ok' => false, 'message' => 'Ingrese un correo válido.']);
    exit;
}

if (strlen($password) < 8) {
    echo json_encode(['ok' => false, 'message' => 'La contraseña debe tener al menos 8 caracteres.']);
    exit;
}

if ($password !== $password2) {
    echo json_encode(['ok' => false, 'message' => 'Las contraseñas no coinciden.']);
    exit;
}

// Verificar que el correo o la identificación no existan
$check = db_query(
    $conexion,
    "SELECT Correo, Cedula FROM Usuario WHERE Correo = ? OR Cedula = ?",
    [$correo, $cedula]
);

if ($check === false) {
    error_log('Error al verificar datos de registro: ' . mysqli_error($conexion));
    http_response_code(500);
    echo json_encode([
        'ok' => false,
        'message' => 'No se pudieron validar los datos. Inténtelo de nuevo.'
    ]);
    mysqli_close($conexion);
    exit;
}

while ($fila = db_fetch_assoc($check)) {
    if (strcasecmp($fila['Correo'], $correo) === 0) {
        echo json_encode(['ok' => false, 'message' => 'Este correo ya está registrado.']);
        db_free_stmt($check);
        mysqli_close($conexion);
        exit;
    }
    if (strcasecmp($fila['Cedula'], $cedula) === 0) {
        echo json_encode(['ok' => false, 'message' => 'Esta cédula o identificación ya está registrada.']);
        db_free_stmt($check);
        mysqli_close($conexion);
        exit;
    }
}
db_free_stmt($check);

// Preparar datos
$partes      = explode(" ", $nombre, 2);
$nombre_pila = $partes[0];
$apellidos   = $partes[1] ?? '';

$hash        = password_hash($password, PASSWORD_BCRYPT);

$columnGeneroExists = false;
$schemaResult = mysqli_query($conexion, "SHOW COLUMNS FROM Usuario LIKE 'Genero'");
if ($schemaResult !== false && mysqli_num_rows($schemaResult) > 0) {
    $columnGeneroExists = true;
}
if ($schemaResult !== false) {
    mysqli_free_result($schemaResult);
}

// Insertar (siempre Observador + Pendiente)
if ($columnGeneroExists) {
    $sql = "INSERT INTO Usuario 
            (Nombre, Apellidos, Cedula, Correo, Contrasena, Genero, Rol, Estado)
            VALUES (?, ?, ?, ?, ?, ?, 0, 0)";
    $params = [$nombre_pila, $apellidos, $cedula, $correo, $hash, $genero];
} else {
    $sql = "INSERT INTO Usuario 
            (Nombre, Apellidos, Cedula, Correo, Contrasena, Rol, Estado)
            VALUES (?, ?, ?, ?, ?, 0, 0)";
    $params = [$nombre_pila, $apellidos, $cedula, $correo, $hash];
}

$stmt   = db_query($conexion, $sql, $params);

if ($stmt === false) {
    error_log('Error al guardar registro: ' . mysqli_error($conexion));
    http_response_code(500);
    echo json_encode([
        'ok' => false,
        'message' => 'No se pudo guardar la solicitud. Verifique que el correo y la cédula no estén registrados.'
    ]);
    mysqli_close($conexion);
    exit;
}

echo json_encode([
    'ok'      => true,
    'message' => 'Solicitud enviada. Su cuenta será revisada por el Comité de IAAS.'
]);

db_free_stmt($stmt);
mysqli_close($conexion);
?>