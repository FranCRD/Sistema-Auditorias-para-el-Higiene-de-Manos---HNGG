<?php
session_start();
header('Content-Type: application/json; charset=utf-8');

if (!isset($_SESSION['ID_usuario'], $_SESSION['Rol'])) {
    http_response_code(401);
    echo json_encode(['ok' => false, 'message' => 'Sesión no autenticada.']);
    exit;
}

require __DIR__ . '/conexion.php';
mysqli_close($conexion);

echo json_encode([
    'ok' => true,
    'usuario' => [
        'Rol' => (int) $_SESSION['Rol']
    ]
]);
?>
