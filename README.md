# Sistema de Auditoría de Higiene de Manos

Aplicación web para registrar y consultar auditorías de higiene de manos. Esta es la versión que utiliza **PHP y MySQL**; está pensada para apoyar el registro de observaciones y la revisión de resultados mediante paneles y comparativas.

> Proyecto académico/técnico. No contiene cuentas de prueba ni datos reales de usuarios. Antes de usarlo en un entorno institucional, se deben configurar la base de datos, los permisos y el despliegue de acuerdo con las políticas de la organización.

## Funcionalidades

- Registro e inicio de sesión de usuarios, con aprobación y administración de cuentas.
- Registro de sesiones de observación, evaluaciones profesionales y momentos de higiene.
- Panel de resultados con filtros, comparativas y exportación de datos a Excel.
- Gestión del contenido de la página de inicio: banner, videos y documentos PDF.
- Perfiles de usuario y consulta de la actividad propia.

## Tecnologías

- PHP con `mysqli` para el servidor y el acceso a datos.
- MySQL para persistencia.
- HTML, CSS y JavaScript para la interfaz.
- Apache para servir la aplicación (por ejemplo, mediante XAMPP en desarrollo local).

## Requisitos

- Apache con PHP habilitado y la extensión `mysqli`.
- MySQL.
- Un navegador moderno.

## Instalación local

1. Clona o descarga este repositorio dentro del directorio público de Apache.
2. Crea una base de datos vacía en MySQL.
3. Ejecuta [`Base de Datos/Sistema_Autorias_BD.sql`](Base%20de%20Datos/Sistema_Autorias_BD.sql) en esa base de datos.
4. Configura la conexión de PHP con estas variables de entorno:

   - `MYSQL_ADDON_HOST`
   - `MYSQL_ADDON_PORT`
   - `MYSQL_ADDON_USER`
   - `MYSQL_ADDON_PASSWORD`
   - `MYSQL_ADDON_DB`

   Para XAMPP, puedes definirlas en la configuración del entorno que inicia Apache. No escribas contraseñas reales en el código ni las subas a GitHub. `conexion.php` conserva valores de respaldo para instalaciones locales; configura credenciales propias antes de usar la aplicación.

5. Inicia Apache y MySQL, y abre el proyecto desde `http://localhost/<carpeta-del-proyecto>/`.
6. Registra una cuenta desde `registro.html`. Las cuentas nuevas quedan pendientes de aprobación y sin rol administrador. Para habilitar una cuenta propia en desarrollo, ejecuta manualmente en tu base:

   ```sql
   UPDATE Usuario
   SET Rol = 1, Estado = 1
   WHERE Correo = 'tu-correo-de-desarrollo@example.com';
   ```

   Cambia el correo por el de la cuenta que registraste. No uses este procedimiento para conceder permisos a una cuenta ajena.

## Base de datos y migración

- [`Base de Datos/Sistema_Autorias_BD.sql`](Base%20de%20Datos/Sistema_Autorias_BD.sql) crea las tablas principales y el contenido inicial del inicio. Está destinado a una base nueva.
- [`Base de Datos/Migracion_inicio.sql`](Base%20de%20Datos/Migracion_inicio.sql) actualiza una base existente para admitir el contenido administrable del inicio y almacenamiento de PDFs. Úsalo solo en una base que ya tenga la estructura previa de la aplicación; no sustituye el esquema inicial.

Los PDFs administrados desde el inicio se guardan en MySQL. El archivo `.user.ini` establece límites de carga de PHP para ese flujo.

## Estructura

- Archivos `.html`, `.css` y `.js`: vistas, estilos y comportamiento de la interfaz.
- Archivos `.php`: autenticación, gestión, consultas y escritura de datos.
- `Base de Datos/`: esquema inicial y migración para bases existentes.
- `images/`: imágenes utilizadas por la interfaz.
- `tests/`: pruebas manuales en navegador. `dashboard-export.test.html` valida la consolidación y exportación del dashboard.

## Prueba manual de exportación

Abre `tests/dashboard-export.test.html` en un navegador para revisar la prueba manual de exportación del dashboard. No es una suite automatizada.

## Seguridad y publicación

- Usa únicamente datos ficticios o anonimizados en capturas, demostraciones y bases de prueba.
- No publiques archivos `.env`, respaldos de bases de datos, credenciales ni PDFs con contenido restringido.
- Revisa que tienes autorización para compartir imágenes, logotipos, documentos y contenido institucional incluidos en `images/` y en el banner inicial.
- Configura credenciales propias y permisos apropiados antes de desplegar la aplicación.

## Autoría

Desarrollado por Franco Córdoba Campos. Consulta el perfil del repositorio para información de autoría y contribuciones.
