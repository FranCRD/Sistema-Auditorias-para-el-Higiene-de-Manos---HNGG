/* =========================================================
   ADMIN — Lógica del panel de administración
   ========================================================= */

/* =========================================================
   0. GUARDIA DE ADMIN
   Solo permite acceso a usuarios con Rol = 1
   ========================================================= */
(function guardAdmin() {
  const session = sessionStorage.getItem("hm_user");

  // 1. Si no hay sesión → al login
  if (!session) {
    window.location.replace("login.html");
    return;
  }

  // 2. Si hay sesión pero no es admin → a index.html
  try {
    const user = JSON.parse(session);
    if (parseInt(user.Rol) !== 1) {
      alert("No tiene permisos para acceder a esta sección.");
      window.location.replace("index.html");
    }
  } catch (e) {
    // Si el JSON está corrupto
    sessionStorage.removeItem("hm_user");
    window.location.replace("login.html");
  }
})();


/* =========================================================
   1. UTILIDADES
   ========================================================= */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text ?? '';
  return div.innerHTML;
}

let usuarios = [];
let controlCargaUsuarios = null;
let temporizadorBusqueda = null;

function mostrarErrorUsuarios(message) {
  const error = document.getElementById("users-error");
  const emptyState = document.getElementById("users-empty");
  if (error) {
    error.textContent = message;
    error.hidden = false;
  }
  if (emptyState) emptyState.classList.add("is-hidden");
}

function actualizarBotonLimpiarFiltros() {
  const search = document.getElementById("filter-search").value.trim();
  const role = document.getElementById("filter-role").value;
  const status = document.getElementById("filter-status").value;
  document.getElementById("clear-user-filters").disabled = !search && !role && !status;
}

function renderUsuarios(lista) {
  const usersTbody = document.getElementById("users-tbody");
  const emptyState = document.getElementById("users-empty");
  const emptyMessage = document.getElementById("users-empty-message");
  const error = document.getElementById("users-error");
  const count = document.getElementById("users-count");

  if (!usersTbody || !emptyState) return;
  usersTbody.innerHTML = lista.map(usuario => {
    const esAdmin = usuario.Rol === 1;
    const estados = {
      0: { label: "Pendiente de aprobación", tag: "tag--warning" },
      1: { label: "Activo", tag: "tag--success" },
      2: { label: "Inactivo", tag: "tag--neutral" }
    };
    const estado = estados[usuario.Estado] || estados[0];
    const nombreCompleto = usuario.Nombre || `${usuario.NombrePila} ${usuario.Apellidos}`;
    return `
      <tr>
        <td class="cell-name" data-label="Nombre">${escapeHtml(nombreCompleto)}</td>
        <td class="cell-email" data-label="Correo">${escapeHtml(usuario.Correo)}</td>
        <td data-label="Rol"><span class="tag ${esAdmin ? "tag--info" : "tag--neutral"}">${esAdmin ? "Administrador IAAS" : "Observador"}</span></td>
        <td class="ta-c" data-label="Estado"><span class="tag ${estado.tag}">${estado.label}</span></td>
        <td class="ta-c" data-label="Acciones">
          <div class="actions-cell">
            <button class="btn btn--ghost btn--sm btn--icon" type="button"
                    data-edit-user="${usuario.ID_usuario}"
                    aria-label="Editar ${escapeHtml(nombreCompleto)}"
                    title="Editar usuario">
              <span class="material-symbols-outlined">edit</span>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join("");

  if (count) count.textContent = `${lista.length} usuarios`;
  if (error) error.hidden = true;
  if (lista.length === 0) {
    const hayFiltros = document.getElementById("filter-search").value.trim() !== "" ||
      document.getElementById("filter-role").value !== "" ||
      document.getElementById("filter-status").value !== "";
    emptyMessage.textContent = !hayFiltros
      ? "Aún no hay cuentas registradas."
      : "No hay usuarios que coincidan con los filtros.";
    emptyState.classList.remove("is-hidden");
  } else {
    emptyState.classList.add("is-hidden");
  }
}

async function cargarUsuarios() {
  const usersTbody = document.getElementById("users-tbody");
  const error = document.getElementById("users-error");
  if (!usersTbody) return;

  if (controlCargaUsuarios) controlCargaUsuarios.abort();
  const controller = new AbortController();
  controlCargaUsuarios = controller;
  usersTbody.innerHTML = '<tr><td colspan="5" class="table-message">Cargando usuarios…</td></tr>';
  if (error) error.hidden = true;
  actualizarBotonLimpiarFiltros();

  try {
    const query = new URLSearchParams({
      buscar: document.getElementById("filter-search").value.trim(),
      rol: document.getElementById("filter-role").value,
      estado: document.getElementById("filter-status").value
    });
    const response = await fetch(`listar_usuarios.php?${query.toString()}`, {
      signal: controller.signal
    });
    const data = await response.json();
    if (!response.ok || !data.ok) {
      throw new Error(data.message || "No se pudieron cargar los usuarios.");
    }
    usuarios = data.usuarios;
    const usersBadge = document.getElementById("tab-users-count");
    if (usersBadge) usersBadge.textContent = data.usuarios.length;
    renderUsuarios(usuarios);
  } catch (err) {
    if (err.name === "AbortError") return;
    console.error("Error al cargar usuarios:", err);
    usersTbody.innerHTML = "";
    mostrarErrorUsuarios(err.message || "Error de conexión al cargar usuarios.");
  } finally {
    if (controlCargaUsuarios === controller) controlCargaUsuarios = null;
  }
}

function abrirEdicionUsuario(id) {
  const usuario = usuarios.find(item => item.ID_usuario === Number(id));
  if (!usuario) return;

  document.getElementById("edit-id").value = usuario.ID_usuario;
  document.getElementById("edit-name").value = usuario.NombrePila;
  document.getElementById("edit-surname").value = usuario.Apellidos;
  document.getElementById("edit-email").value = usuario.Correo;
  document.getElementById("edit-role").value = String(usuario.Rol);
  document.getElementById("edit-status").value = String(usuario.Estado);
  document.getElementById("edit-error").hidden = true;
  document.getElementById("modal-edit").classList.add("is-open");
  document.getElementById("modal-edit").setAttribute("aria-hidden", "false");
  document.getElementById("edit-name").focus();
}

function cerrarModal(modal) {
  modal.classList.remove("is-open");
  modal.setAttribute("aria-hidden", "true");
}

/* =========================================================
   2. LOGOUT
   ========================================================= */
const logoutBtn = document.getElementById("logout-btn");
if (logoutBtn) {
  logoutBtn.addEventListener("click", async () => {
    if (await confirmarAccion({
      titulo: "¿Cerrar sesión?",
      mensaje: "Se cerrará tu sesión actual.",
      confirmar: "Cerrar sesión"
    })) {
      sessionStorage.removeItem("hm_user");
      window.location.href = "cerrar_sesion.php";
    }
  });
}

/* =========================================================
   3. CARGAR SOLICITUDES PENDIENTES
   ========================================================= */
const tbody = document.getElementById("requests-tbody");
const empty = document.getElementById("requests-empty");
const modalConfirmacionSolicitud = document.getElementById("modal-confirm");
let resolverConfirmacionSolicitud = null;

function confirmarSolicitud({ titulo, mensaje, textoBoton, icono, tipo, mostrarCancelar = true }) {
  if (!modalConfirmacionSolicitud || resolverConfirmacionSolicitud) {
    console.error("No se pudo abrir la confirmación de solicitud.");
    return Promise.resolve(false);
  }

  document.getElementById("confirm-title").textContent = titulo;
  document.getElementById("confirm-text").textContent = mensaje;
  const iconoConfirmacion = document.getElementById("confirm-icon");
  iconoConfirmacion.querySelector(".material-symbols-outlined").textContent = icono;
  iconoConfirmacion.classList.toggle("modal__icon--success", tipo === "approve");
  iconoConfirmacion.classList.toggle("modal__icon--danger", tipo === "reject");
  iconoConfirmacion.classList.toggle("modal__icon--info", tipo === "info");

  const botonConfirmar = document.getElementById("confirm-action");
  const botonCancelar = document.getElementById("confirm-cancel");
  botonConfirmar.textContent = textoBoton;
  botonConfirmar.classList.toggle("btn--success", tipo === "approve");
  botonConfirmar.classList.toggle("btn--danger", tipo === "reject");
  botonConfirmar.classList.toggle("btn--primary", tipo === "info");
  botonCancelar.hidden = !mostrarCancelar;

  modalConfirmacionSolicitud.classList.add("is-open");
  modalConfirmacionSolicitud.setAttribute("aria-hidden", "false");
  (mostrarCancelar ? botonCancelar : botonConfirmar).focus();

  return new Promise(resolve => {
    resolverConfirmacionSolicitud = resolve;
  });
}

function mostrarAvisoSolicitud({ titulo, mensaje, icono = "info", tipo = "info" }) {
  return confirmarSolicitud({
    titulo,
    mensaje,
    textoBoton: "Entendido",
    icono,
    tipo,
    mostrarCancelar: false
  });
}

function cerrarConfirmacionSolicitud(confirmado) {
  if (!resolverConfirmacionSolicitud) return;
  const resolver = resolverConfirmacionSolicitud;
  resolverConfirmacionSolicitud = null;
  cerrarModal(modalConfirmacionSolicitud);
  resolver(confirmado);
}

async function cargarSolicitudes() {
  if (!tbody) return;

  try {
    const response = await fetch("listar_solicitudes.php");
    const data = await response.json();

    if (!data.ok) {
      console.error("Error:", data.message);
      return;
    }

    // Actualizar badge del tab
    const badge = document.getElementById("tab-requests-count");
    if (badge) badge.textContent = data.solicitudes.length;

    // Si no hay solicitudes, mostrar empty state
    if (data.solicitudes.length === 0) {
      tbody.innerHTML = "";
      if (empty) {
        empty.hidden = false;
        empty.classList.remove("is-hidden");
      }
      return;
    }

    if (empty) {
      empty.hidden = true;
      empty.classList.add("is-hidden");
    }

    // Renderizar tabla
    tbody.innerHTML = data.solicitudes.map(s => `
      <tr>
        <td class="cell-name" data-label="Nombre">${escapeHtml(s.Nombre)}</td>
        <td class="cell-email" data-label="Correo institucional">${escapeHtml(s.Correo)}</td>
        <td data-label="Rol solicitado"><span class="tag tag--info">Observador</span></td>
        <td data-label="Fecha">${new Date().toLocaleDateString('es-CR')}</td>
        <td class="ta-c" data-label="Acciones">
          <div class="actions-cell">
            <button class="btn btn--success btn--sm btn--icon" type="button" title="Aprobar solicitud" aria-label="Aprobar solicitud" data-request-action="approve" data-user-id="${s.ID_usuario}">
              <span class="material-symbols-outlined">check</span>
            </button>
            <button class="btn btn--danger btn--sm btn--icon" type="button" title="Rechazar solicitud" aria-label="Rechazar solicitud" data-request-action="reject" data-user-id="${s.ID_usuario}">
              <span class="material-symbols-outlined">close</span>
            </button>
          </div>
        </td>
      </tr>
    `).join("");

  } catch (err) {
    console.error("Error al cargar solicitudes:", err);
  }
}

/* =========================================================
   4. APROBAR USUARIO
   ========================================================= */
async function aprobarUsuario(id) {
  const confirmado = await confirmarSolicitud({
    titulo: "¿Aprobar esta solicitud?",
    mensaje: "Al aprobarla, la persona podrá iniciar sesión y usar el sistema.",
    textoBoton: "Sí, aprobar",
    icono: "person_check",
    tipo: "approve"
  });
  if (!confirmado) return;

  const formData = new FormData();
  formData.append("id", id);
  formData.append("accion", "aprobar");

  try {
    const response = await fetch("solicitudes_usuario.php", {
      method: "POST",
      body: formData
    });
    const data = await response.json();

    if (data.ok) {
      await mostrarAvisoSolicitud({
        titulo: "Solicitud aprobada",
        mensaje: "La cuenta ya está activa y la persona puede iniciar sesión.",
        icono: "person_check",
        tipo: "approve"
      });
      await Promise.all([cargarSolicitudes(), cargarUsuarios()]);
    } else {
      await mostrarAvisoSolicitud({
        titulo: "No se pudo aprobar",
        mensaje: data.message || "Inténtelo de nuevo.",
        icono: "error",
        tipo: "danger"
      });
    }
  } catch (err) {
    console.error(err);
    await mostrarAvisoSolicitud({
      titulo: "Error de conexión",
      mensaje: "No fue posible comunicarse con el servidor. Revise su conexión e inténtelo de nuevo.",
      icono: "cloud_off",
      tipo: "danger"
    });
  }
}

/* =========================================================
   5. RECHAZAR USUARIO
   ========================================================= */
async function rechazarUsuario(id) {
  const confirmado = await confirmarSolicitud({
    titulo: "¿Rechazar esta solicitud?",
    mensaje: "La cuenta pendiente se eliminará permanentemente. Esta acción no se puede deshacer.",
    textoBoton: "Sí, rechazar",
    icono: "person_remove",
    tipo: "reject"
  });
  if (!confirmado) return;

  const formData = new FormData();
  formData.append("id", id);
  formData.append("accion", "rechazar");

  try {
    const response = await fetch("solicitudes_usuario.php", {
      method: "POST",
      body: formData
    });
    const data = await response.json();

    if (data.ok) {
      await mostrarAvisoSolicitud({
        titulo: "Solicitud rechazada",
        mensaje: "La cuenta pendiente se eliminó.",
        icono: "person_remove",
        tipo: "info"
      });
      await cargarSolicitudes();
    } else {
      await mostrarAvisoSolicitud({
        titulo: "No se pudo rechazar",
        mensaje: data.message || "Inténtelo de nuevo.",
        icono: "error",
        tipo: "danger"
      });
    }
  } catch (err) {
    console.error(err);
    await mostrarAvisoSolicitud({
      titulo: "Error de conexión",
      mensaje: "No fue posible comunicarse con el servidor. Revise su conexión e inténtelo de nuevo.",
      icono: "cloud_off",
      tipo: "danger"
    });
  }
}

/* =========================================================
   6. TABS
   ========================================================= */
const tabs = document.querySelectorAll(".tab");
const panels = document.querySelectorAll(".panel");

tabs.forEach(tab => {
  tab.addEventListener("click", () => {
    const target = tab.dataset.tab;

    // Quitar activo de todos los tabs y paneles
    tabs.forEach(t => t.classList.remove("is-active"));
    panels.forEach(p => p.classList.remove("is-active"));

    // Activar el tab clickeado y su panel
    tab.classList.add("is-active");
    const panel = document.getElementById("panel-" + target);
    if (panel) panel.classList.add("is-active");
    if (target === "users") cargarUsuarios();
  });
});

/* =========================================================
   7. USUARIOS Y FILTROS
   ========================================================= */
const refreshBtn = document.getElementById("refresh-requests");
if (refreshBtn) {
  refreshBtn.addEventListener("click", cargarSolicitudes);
}

tbody.addEventListener("click", event => {
  const button = event.target.closest("[data-request-action]");
  if (!button) return;
  const id = Number(button.dataset.userId);
  if (!Number.isInteger(id) || id <= 0) return;
  if (button.dataset.requestAction === "approve") aprobarUsuario(id);
  if (button.dataset.requestAction === "reject") rechazarUsuario(id);
});

document.getElementById("refresh-users").addEventListener("click", cargarUsuarios);
document.getElementById("filter-search").addEventListener("input", () => {
  actualizarBotonLimpiarFiltros();
  clearTimeout(temporizadorBusqueda);
  temporizadorBusqueda = setTimeout(cargarUsuarios, 300);
});
document.getElementById("filter-role").addEventListener("change", cargarUsuarios);
document.getElementById("filter-status").addEventListener("change", cargarUsuarios);
document.getElementById("clear-user-filters").addEventListener("click", () => {
  clearTimeout(temporizadorBusqueda);
  document.getElementById("filter-search").value = "";
  document.getElementById("filter-role").value = "";
  document.getElementById("filter-status").value = "";
  cargarUsuarios();
});
document.getElementById("users-tbody").addEventListener("click", event => {
  const button = event.target.closest("[data-edit-user]");
  if (button) abrirEdicionUsuario(button.dataset.editUser);
});

document.querySelectorAll("[data-close-modal]").forEach(button => {
  button.addEventListener("click", () => {
    const modal = button.closest(".modal");
    if (modal === modalConfirmacionSolicitud) {
      cerrarConfirmacionSolicitud(false);
    } else if (modal) {
      cerrarModal(modal);
    }
  });
});

document.getElementById("confirm-action").addEventListener("click", () => {
  cerrarConfirmacionSolicitud(true);
});

document.addEventListener("keydown", event => {
  if (event.key === "Escape" && modalConfirmacionSolicitud.classList.contains("is-open")) {
    cerrarConfirmacionSolicitud(false);
  }
});

document.getElementById("edit-form").addEventListener("submit", async event => {
  event.preventDefault();
  const submit = document.querySelector('[form="edit-form"][type="submit"]');
  const error = document.getElementById("edit-error");
  submit.disabled = true;
  error.hidden = true;

  const formData = new FormData();
  formData.append("accion", "actualizar");
  formData.append("id", document.getElementById("edit-id").value);
  formData.append("nombre", document.getElementById("edit-name").value.trim());
  formData.append("apellidos", document.getElementById("edit-surname").value.trim());
  formData.append("correo", document.getElementById("edit-email").value.trim());
  formData.append("rol", document.getElementById("edit-role").value);
  formData.append("estado", document.getElementById("edit-status").value);

  try {
    const response = await fetch("gestionar_usuarios.php", { method: "POST", body: formData });
    const data = await response.json();
    if (!response.ok || !data.ok) {
      throw new Error(data.message || "No se pudieron guardar los cambios.");
    }
    cerrarModal(document.getElementById("modal-edit"));
    await cargarUsuarios();
  } catch (err) {
    console.error("Error al actualizar usuario:", err);
    error.textContent = err.message || "Error de conexión al guardar los cambios.";
    error.hidden = false;
  } finally {
    submit.disabled = false;
  }
});

/* =========================================================
   8. INICIALIZACIÓN
   ========================================================= */
document.addEventListener("DOMContentLoaded", () => {
  cargarSolicitudes();
  cargarUsuarios();
});
