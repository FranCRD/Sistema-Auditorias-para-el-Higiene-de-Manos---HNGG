<?php
/* =========================================================
   LISTAR SOLICITUDES PENDIENTES (Estado = 0)
   Solo accesible por admins
   ========================================================= */
session_start();
header('Content-Type: application/json; charset=utf-8');

include("conexion.php");

// Solo admins (Rol = 1)
if (!isset($_SESSION['Rol']) || $_SESSION['Rol'] != 1) {
    echo json_encode(['ok' => false, 'message' => 'No autorizado']);
    exit;
}

$sql = "SELECT ID_usuario, Nombre, Apellidos, Cedula, Correo, Rol
        FROM Usuario
        WHERE Estado = 0
        ORDER BY ID_usuario DESC";

$stmt = db_query($conexion, $sql);

if ($stmt === false) {
    echo json_encode([
        'ok'      => false,
        'message' => 'Error en la consulta',
    ]);
    exit;
}

$solicitudes = [];
while ($fila = db_fetch_assoc($stmt)) {
    $solicitudes[] = [
        'ID_usuario' => (int) $fila['ID_usuario'],
        'Nombre'     => $fila['Nombre'] . ' ' . $fila['Apellidos'],
        'Cedula'     => $fila['Cedula'],
        'Correo'     => $fila['Correo'],
        'Rol'        => (int) $fila['Rol']
    ];
}

echo json_encode([
    'ok'          => true,
    'solicitudes' => $solicitudes
]);

db_free_stmt($stmt);
mysqli_close($conexion);
?>