<?php
session_start();
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'message' => 'Método no permitido.']);
    exit;
}

if (!isset($_SESSION['ID_usuario'])) {
    http_response_code(401);
    echo json_encode(['ok' => false, 'message' => 'Sesión no autenticada.']);
    exit;
}

if (!isset($_POST['current_password'], $_POST['new_password'], $_POST['confirm_password']) ||
    !is_string($_POST['current_password']) ||
    !is_string($_POST['new_password']) ||
    !is_string($_POST['confirm_password'])) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'message' => 'Faltan campos obligatorios.']);
    exit;
}

$current = trim((string) $_POST['current_password']);
$new = (string) $_POST['new_password'];
$confirm = (string) $_POST['confirm_password'];

if ($current === '' || $new === '' || $confirm === '') {
    http_response_code(400);
    echo json_encode(['ok' => false, 'message' => 'Complete la contraseña actual y la nueva contraseña.']);
    exit;
}

if (function_exists('mb_strlen')) {
    $newLength = mb_strlen($new, 'UTF-8');
} else {
    $newLength = preg_match_all('/./us', $new, $characters);
}
if ($newLength === false || $newLength < 8) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'message' => 'La nueva contraseña debe tener al menos 8 caracteres.']);
    exit;
}

if ($new !== $confirm) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'message' => 'La nueva contraseña y su confirmación no coinciden.']);
    exit;
}

include __DIR__ . '/conexion.php';

$userId = (int) $_SESSION['ID_usuario'];
$stmt = db_query($conexion, 'SELECT Contrasena FROM Usuario WHERE ID_usuario = ?', [$userId]);
$user = db_fetch_assoc($stmt);
db_free_stmt($stmt);

if (!$user || !isset($user['Contrasena'])) {
    http_response_code(404);
    echo json_encode(['ok' => false, 'message' => 'No se pudo localizar el usuario.']);
    mysqli_close($conexion);
    exit;
}

if (!password_verify($current, $user['Contrasena'])) {
    http_response_code(401);
    echo json_encode(['ok' => false, 'message' => 'La contraseña actual no es correcta.']);
    mysqli_close($conexion);
    exit;
}

$hash = password_hash($new, PASSWORD_DEFAULT);
$stmt = db_query($conexion, 'UPDATE Usuario SET Contrasena = ? WHERE ID_usuario = ?', [$hash, $userId]);
db_free_stmt($stmt);
mysqli_close($conexion);

echo json_encode(['ok' => true, 'message' => 'Contraseña actualizada correctamente.'], JSON_UNESCAPED_UNICODE);
