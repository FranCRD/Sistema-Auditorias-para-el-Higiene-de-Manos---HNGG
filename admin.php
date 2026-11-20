<?php
session_start();
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');

if (!isset($_SESSION['ID_usuario'])) {
  header('Location: login.html');
  exit;
}

if (!isset($_SESSION['Rol']) || (int) $_SESSION['Rol'] !== 1) {
  header('Location: index.html');
  exit;
}

$nombreUsuario = trim(($_SESSION['Nombre'] ?? '') . ' ' . ($_SESSION['Apellidos'] ?? ''));
?>
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Administración de Usuarios — Auditoría Higiene de Manos</title>
  <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0" rel="stylesheet">
  <link href="https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@400;600;700&family=Plus+Jakarta+Sans:wght@600;700;800&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="comun.css?v=20261105-4">
  <link rel="stylesheet" href="admin.css?v=20261105-1">
</head>
<body>

  <!-- ============ HEADER ============ -->
  <header class="app-header">
    <div class="app-header__inner">
      <div class="brand">
        <div class="brand__logo">
          <img src="images/ccss.jpg" alt="CCSS">
        </div>
        <div class="brand__text">
          <span class="brand__name">Auditoría de Higiene de Manos</span>
          <span class="brand__tag">Higiene de Manos · OMS</span>
        </div>
      </div>

      <button class="nav-mobile-toggle" type="button" aria-label="Abrir menú" aria-expanded="false" aria-controls="mobile-nav-panel">
        <span class="material-symbols-outlined">menu</span>
      </button>

      <nav class="header-navigation" aria-label="Navegación principal">
        <a class="btn btn--ghost" href="home.html">
          <span class="material-symbols-outlined">home</span>
          <span class="btn__label">Inicio</span>
        </a>
        <a class="btn btn--ghost" href="index.html">
          <span class="material-symbols-outlined">checklist</span>
          <span class="btn__label">Observaciones</span>
        </a>
        <a class="btn btn--ghost" href="dashboard.html">
          <span class="material-symbols-outlined">analytics</span>
          <span class="btn__label">Reportes</span>
        </a>
        <a class="btn btn--active" href="admin.php" aria-current="page">
          <span class="material-symbols-outlined">shield_person</span>
          <span class="btn__label">Administración</span>
        </a>
        <a class="btn btn--ghost" href="perfil.html">
          <span class="material-symbols-outlined">account_circle</span>
          <span class="btn__label">Mi perfil</span>
        </a>
      </nav>
      <div class="mobile-nav-panel" id="mobile-nav-panel" hidden></div>

      <div class="header-profile">
        <div class="user">
          <span class="user__name" id="user-name"><?= htmlspecialchars($nombreUsuario, ENT_QUOTES, 'UTF-8') ?></span>
          <div class="user__avatar">
            <span class="material-symbols-outlined">person</span>
          </div>
          <button id="logout-btn" type="button" class="icon-btn" title="Cerrar sesión" aria-label="Cerrar sesión">
            <span class="material-symbols-outlined">logout</span>
          </button>
        </div>
      </div>
    </div>
  </header>

  <main class="container">

    <header class="admin-page-heading">
      <div class="admin-page-heading__icon" aria-hidden="true">
        <span class="material-symbols-outlined">admin_panel_settings</span>
      </div>
      <div>
        <p class="admin-page-heading__eyebrow">Gestión del sistema</p>
        <h1 class="admin-page-heading__title">Administración</h1>
        <p class="admin-page-heading__subtitle">Gestione solicitudes, usuarios y permisos de acceso.</p>
      </div>
    </header>

    <!-- ============ TABS ============ -->
    <nav class="tabs" role="tablist">
      <button class="tab is-active" data-tab="requests" type="button" role="tab">
        <span class="material-symbols-outlined">pending_actions</span>
        Solicitudes
        <span class="tab__badge" id="tab-requests-count">0</span>
      </button>
      <button class="tab" data-tab="users" type="button" role="tab">
        <span class="material-symbols-outlined">group</span>
        Usuarios
        <span class="tab__badge tab__badge--neutral" id="tab-users-count">0</span>
      </button>
      <button class="tab" data-tab="roles" type="button" role="tab">
        <span class="material-symbols-outlined">shield_person</span>
        Roles y permisos
      </button>
    </nav>

    <!-- ============ TAB 1: SOLICITUDES ============ -->
    <section class="panel is-active" id="panel-requests">

      <div class="panel__header">
        <div>
          <h2 class="panel__title">Solicitudes pendientes</h2>
          <p class="panel__subtitle">Cuentas registradas que esperan aprobación para acceder al sistema.</p>
        </div>
        <button class="btn btn--ghost" type="button" id="refresh-requests">
          <span class="material-symbols-outlined">refresh</span>
          <span class="btn__label">Actualizar</span>
        </button>
      </div>

      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Correo institucional</th>
              <th>Rol solicitado</th>
              <th>Fecha</th>
              <th class="ta-c">Acciones</th>
            </tr>
          </thead>
          <tbody id="requests-tbody">
            <!-- Dinámico -->
          </tbody>
        </table>
      </div>

      <div class="empty-state is-hidden" id="requests-empty" hidden>
        <span class="material-symbols-outlined">inbox</span>
        <p>No hay solicitudes pendientes.</p>
      </div>

    </section>

    <!-- ============ TAB 2: USUARIOS ============ -->
    <section class="panel" id="panel-users">

      <div class="panel__header">
        <div>
          <h2 class="panel__title">Usuarios del sistema</h2>
          <p class="panel__subtitle">Busque cuentas por nombre, correo o cédula, y filtre por rol o estado.</p>
        </div>
        <span class="users-count" id="users-count" aria-live="polite"></span>
        <button class="btn btn--ghost" type="button" id="refresh-users">
          <span class="material-symbols-outlined">refresh</span>
          <span class="btn__label">Actualizar</span>
        </button>
      </div>

      <!-- Filtros -->
      <div class="filters">
        <div class="select">
          <span class="material-symbols-outlined select__icon">search</span>
          <input type="search" id="filter-search" class="select__input" aria-label="Buscar usuarios" placeholder="Nombre, correo o cédula…">
        </div>

        <div class="select">
          <span class="material-symbols-outlined select__icon">badge</span>
          <select id="filter-role" class="select__input" aria-label="Filtrar por rol">
            <option value="">Todos los roles</option>
            <option value="0">Observador</option>
            <option value="1">Administrador IAAS</option>
          </select>
          <span class="material-symbols-outlined select__chevron">expand_more</span>
        </div>

        <div class="select">
          <span class="material-symbols-outlined select__icon">toggle_on</span>
          <select id="filter-status" class="select__input" aria-label="Filtrar por estado">
            <option value="">Todos los estados</option>
            <option value="1">Activo</option>
            <option value="0">Pendiente de aprobación</option>
            <option value="2">Inactivo</option>
          </select>
          <span class="material-symbols-outlined select__chevron">expand_more</span>
        </div>
        <button class="btn btn--ghost clear-filters" type="button" id="clear-user-filters" disabled>
          <span class="material-symbols-outlined">filter_alt_off</span>
          <span class="btn__label">Limpiar filtros</span>
        </button>
      </div>

      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Correo</th>
              <th>Rol</th>
              <th class="ta-c">Estado</th>
              <th class="ta-c">Acciones</th>
            </tr>
          </thead>
          <tbody id="users-tbody">
            <!-- Dinámico -->
          </tbody>
        </table>
      </div>

      <p class="users-error" id="users-error" role="alert" hidden></p>
      <div class="empty-state is-hidden" id="users-empty">
        <span class="material-symbols-outlined">group_off</span>
        <p id="users-empty-message">No hay usuarios que coincidan con los filtros.</p>
      </div>

    </section>

    <!-- ============ TAB 3: ROLES ============ -->
    <section class="panel" id="panel-roles">

      <div class="panel__header">
        <div>
          <h2 class="panel__title">Roles y permisos</h2>
          <p class="panel__subtitle">Referencia de las capacidades que tiene cada rol en el sistema.</p>
        </div>
      </div>

      <div class="roles-grid">
        <article class="role-card">
          <header class="role-card__header">
            <div class="role-card__icon role-card__icon--observer">
              <span class="material-symbols-outlined">visibility</span>
            </div>
            <div>
              <h3 class="role-card__title">Observador</h3>
              <span class="role-card__count">Rol operativo</span>
            </div>
          </header>
          <ul class="role-card__list">
            <li><span class="material-symbols-outlined">check</span> Registrar observaciones de higiene</li>
            <li><span class="material-symbols-outlined">check</span> Consultar sus propias sesiones</li>
            <li><span class="material-symbols-outlined">check</span> Ver reportes generales</li>
            <li><span class="material-symbols-outlined">close</span> No puede gestionar usuarios</li>
          </ul>
        </article>

        <article class="role-card">
          <header class="role-card__header">
            <div class="role-card__icon role-card__icon--admin">
              <span class="material-symbols-outlined">shield_person</span>
            </div>
            <div>
              <h3 class="role-card__title">Administrador IAAS</h3>
              <span class="role-card__count">Acceso total</span>
            </div>
          </header>
          <ul class="role-card__list">
            <li><span class="material-symbols-outlined">check</span> Todas las funciones de observación y reportes</li>
            <li><span class="material-symbols-outlined">check</span> Crear, editar y eliminar usuarios</li>
            <li><span class="material-symbols-outlined">check</span> Aprobar o rechazar solicitudes</li>
            <li><span class="material-symbols-outlined">check</span> Configurar servicios y protocolos</li>
          </ul>
        </article>
      </div>

    </section>

  </main>

  <!-- ============ MODAL DE EDICIÓN ============ -->
  <div class="modal" id="modal-edit" aria-hidden="true">
    <div class="modal__backdrop" data-close-modal></div>
    <div class="modal__dialog" role="dialog" aria-modal="true" aria-labelledby="edit-modal-title">
      <header class="modal__header">
        <h3 class="modal__title" id="edit-modal-title">Editar usuario</h3>
        <button class="modal__close" type="button" data-close-modal aria-label="Cerrar">
          <span class="material-symbols-outlined">close</span>
        </button>
      </header>

      <form class="modal__body" id="edit-form">
        <input type="hidden" id="edit-id">

        <div class="field">
          <label class="field__label" for="edit-name">Nombre</label>
          <div class="field__control">
            <span class="material-symbols-outlined field__icon">person</span>
            <input id="edit-name" class="field__input" type="text" maxlength="80" required>
          </div>
        </div>

        <div class="field">
          <label class="field__label" for="edit-surname">Apellidos</label>
          <div class="field__control">
            <span class="material-symbols-outlined field__icon">person</span>
            <input id="edit-surname" class="field__input" type="text" maxlength="120" required>
          </div>
        </div>

        <div class="field">
          <label class="field__label" for="edit-email">Correo institucional</label>
          <div class="field__control">
            <span class="material-symbols-outlined field__icon">mail</span>
            <input id="edit-email" class="field__input" type="email" maxlength="150" required>
          </div>
        </div>

        <div class="field-row">
          <div class="field">
            <label class="field__label" for="edit-role">Rol</label>
            <div class="field__control">
              <span class="material-symbols-outlined field__icon">badge</span>
              <select id="edit-role" class="field__input field__input--select">
                <option value="0">Observador</option>
                <option value="1">Administrador IAAS</option>
              </select>
              <span class="material-symbols-outlined field__chevron">expand_more</span>
            </div>
          </div>

          <div class="field">
            <label class="field__label" for="edit-status">Estado de la cuenta</label>
            <div class="field__control">
              <span class="material-symbols-outlined field__icon">toggle_on</span>
              <select id="edit-status" class="field__input field__input--select">
                <option value="1">Activo</option>
                <option value="0">Pendiente de aprobación</option>
            <option value="2">Inactivo</option>
              </select>
              <span class="material-symbols-outlined field__chevron">expand_more</span>
            </div>
          </div>
        </div>
      </form>
      <p class="modal__error" id="edit-error" role="alert" hidden></p>

      <footer class="modal__footer">
        <button class="btn btn--ghost" type="button" data-close-modal>Cancelar</button>
        <button class="btn btn--primary" type="submit" form="edit-form">
          <span class="material-symbols-outlined">save</span>
          Guardar cambios
        </button>
      </footer>
    </div>
  </div>

  <!-- ============ MODAL DE CONFIRMACIÓN ============ -->
  <div class="modal" id="modal-confirm" aria-hidden="true">
    <div class="modal__backdrop" data-close-modal></div>
    <div class="modal__dialog modal__dialog--sm" role="dialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-text">
      <div class="modal__body modal__body--center">
        <div class="modal__icon" id="confirm-icon">
          <span class="material-symbols-outlined">warning</span>
        </div>
        <h3 class="modal__title" id="confirm-title">Confirmar acción</h3>
        <p class="modal__text" id="confirm-text">¿Está seguro?</p>
      </div>
      <footer class="modal__footer">
        <button class="btn btn--ghost" type="button" id="confirm-cancel" data-close-modal>Cancelar</button>
        <button class="btn btn--primary" type="button" id="confirm-action">Confirmar</button>
      </footer>
    </div>
  </div>

  <script src="comun.js?v=20261105-2"></script>
  <script src="admin.js?v=20261112-2"></script>
</body>
</html>
