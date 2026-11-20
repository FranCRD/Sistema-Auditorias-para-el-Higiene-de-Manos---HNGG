/* =========================================================
   0. GUARDIA DE SESIÓN
   ========================================================= */
(function guardSession() {
  const session = sessionStorage.getItem("hm_user");
  if (!session) {
    window.location.replace("login.html");
  }
})();

/* =========================================================
   1. ESTADO GLOBAL
   ========================================================= */
let ID_SESION     = null;   // ID de la sesión activa
let EVALUACIONES  = [];     // Array de evaluaciones
let INDICE_ACTUAL = 0;      // Índice de la evaluación visible
let AREA_SESION   = "UCI";  // Área actual

const MOMENTS = [
  { id: 1, name: "Pre-paciente" },
  { id: 2, name: "Pre-asepsia" },
  { id: 3, name: "Post-líquido" },
  { id: 4, name: "Post-paciente" },
  { id: 5, name: "Post-entorno" }
];

const SUBCATEGORIAS = {
  Medicina: ["", "Residentes", "Asistentes", "Médicos internos"],
  Enfermería: ["", "Asistente de pacientes", "Auxiliar de enfermería", "Enfermeros"],
  Otros: ["", "Laboratorio", "Terapia respiratoria", "Terapia física", "Psicología", "Trabajo social", "Nutrición"]
};

const CATEGORIAS = Object.keys(SUBCATEGORIAS);

/* =========================================================
   2. UTILIDADES
   ========================================================= */
function renderSelectOptions(options, selectedValue) {
  return options.map(option => {
    const label = option || "(sin especificar)";
    const selected = option === selectedValue ? " selected" : "";
    return `<option value="${option}"${selected}>${label}</option>`;
  }).join("");
}

function contarMomentosObservados(ev) {
  const accionesObservadas = ["Alcohol", "Lavado", "No realizado"];
  return MOMENTS.filter(momento =>
    accionesObservadas.includes((ev.Momentos || {})[momento.id])
  ).length;
}

function showSaveStatus(status, message) {
  const el = document.getElementById("save-status");
  if (!el) return;

  el.classList.remove("is-saving", "is-saved", "is-error");
  if (status === "saving") el.classList.add("is-saving");
  if (status === "saved")  el.classList.add("is-saved");
  if (status === "error")  el.classList.add("is-error");

  el.textContent = message;
}

function debounce(fn, delay) {
  let timer = null;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

function parseApiResponse(responseText, status) {
  try {
    return JSON.parse(responseText);
  } catch {
    console.error("El servidor devolvió una respuesta no válida.", status);
    const error = new Error("No se pudo confirmar la operación. Verifique su conexión e inténtelo de nuevo.");
    error.name = "InvalidApiResponseError";
    throw error;
  }
}

async function apiPost(url, data) {
  const formData = new FormData();
  for (const key in data) {
    formData.append(key, data[key]);
  }
  const response = await fetch(url, { method: "POST", body: formData });
  return parseApiResponse(await response.text(), response.status);
}

async function apiGet(url) {
  const response = await fetch(url);
  return parseApiResponse(await response.text(), response.status);
}

/* =========================================================
   3. INICIALIZACIÓN
   ========================================================= */
document.addEventListener("DOMContentLoaded", async () => {

  /* ----- 3.1 Datos del usuario logueado ----- */
  const session = JSON.parse(sessionStorage.getItem("hm_user") || "{}");
  const userNameEl = document.getElementById("user-name");
  if (userNameEl && session.Nombre) {
    userNameEl.textContent = session.Nombre;
  }

  const adminLink = document.getElementById("admin-link");
  const dashboardLink = document.getElementById("dashboard-link");
  const thankYouReports = document.getElementById("thank-you-reports");
  if (adminLink || dashboardLink) {
    fetch("sesion_actual.php")
      .then(response => {
        if (!response.ok) throw new Error(`No se pudo validar la sesión (${response.status}).`);
        return response.json();
      })
      .then(data => {
        if (data.ok && data.usuario.Rol === 1) {
          if (adminLink) adminLink.hidden = false;
          if (dashboardLink) dashboardLink.hidden = false;
          if (thankYouReports) thankYouReports.hidden = false;
        }
      })
      .catch(err => console.error("Error al validar permisos de administración:", err));
  }

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

  /* ----- 3.2 Iniciar/recuperar sesión de observación ----- */
  try {
    showSaveStatus("saving", "Cargando sesión...");
    const data = await apiGet("sesion_observacion.php?accion=iniciar");

    if (!data.ok) {
      showSaveStatus("error", "Error: " + (data.message || "No se pudo cargar sesión"));
      return;
    }

    ID_SESION = data.sesion.ID_sesion;
    AREA_SESION = data.sesion.DepartamentoServicio;

    const areaSelect = document.getElementById("area-select");
    if (areaSelect) {
      areaSelect.value = AREA_SESION;
      areaSelect.addEventListener("change", onCambiarArea);
    }

    // Cargar evaluaciones existentes
    await cargarSesionCompleta();

    showSaveStatus("saved", "Sesión lista");
    setTimeout(() => showSaveStatus("saved", "Cambios se guardan automáticamente"), 1500);

  } catch (err) {
    console.error(err);
    showSaveStatus("error", "Error de conexión");
  }

  /* ----- 3.3 Botones del header y footer ----- */
  const btnNuevaEval = document.getElementById("btn-add-eval");
  if (btnNuevaEval) btnNuevaEval.addEventListener("click", onNuevaEvaluacion);

  const btnPrev = document.getElementById("nav-prev");
  if (btnPrev) btnPrev.addEventListener("click", () => navegar(-1));

  const btnNext = document.getElementById("nav-next");
  if (btnNext) btnNext.addEventListener("click", () => navegar(1));

  const btnFinish = document.getElementById("btn-finish");
  if (btnFinish) btnFinish.addEventListener("click", onFinalizarSesion);

  const btnCancel = document.getElementById("btn-cancel");
  if (btnCancel) {
    btnCancel.addEventListener("click", () => {
      const evaluacionActual = EVALUACIONES[INDICE_ACTUAL];
      if (evaluacionActual) eliminarEvaluacion(evaluacionActual);
    });
  }

  const finishDialog = document.getElementById("finish-dialog");
  const finishCancel = document.getElementById("finish-cancel");
  const finishConfirm = document.getElementById("finish-confirm");
  const thankYouView = document.getElementById("finish-thank-you-view");
  const thankYouReturn = document.getElementById("thank-you-return");
  if (thankYouReturn) {
    thankYouReturn.addEventListener("click", () => window.location.reload());
  }
  if (finishDialog) {
    finishCancel.addEventListener("click", () => finishDialog.close());
    finishDialog.addEventListener("click", event => {
      if (event.target === finishDialog && thankYouView.hidden) finishDialog.close();
    });
    finishDialog.addEventListener("keydown", event => {
      if (event.key === "Escape") {
        event.preventDefault();
        if (thankYouView.hidden) finishDialog.close();
      }
    });
    finishDialog.addEventListener("cancel", event => {
      if (thankYouView.hidden) finishDialog.close();
      else event.preventDefault();
    });
    finishDialog.addEventListener("close", () => {
      if (btnFinish) btnFinish.focus();
    });
    finishConfirm.addEventListener("click", finalizarSesion);
  }
});

/* =========================================================
   4. CARGAR SESIÓN COMPLETA
   ========================================================= */
async function cargarSesionCompleta() {
  const data = await apiGet(`sesion_observacion.php?accion=cargar&id_sesion=${ID_SESION}`);

  if (!data.ok) {
    showSaveStatus("error", "Error al cargar sesión");
    return;
  }

  EVALUACIONES = data.evaluaciones || [];
  INDICE_ACTUAL = EVALUACIONES.length > 0 ? 0 : -1;

  renderFicha();
  actualizarResumen();
  actualizarNavBar();
}

/* =========================================================
   5. RENDER DE LA FICHA
   ========================================================= */
function renderFicha() {
  const container = document.getElementById("ficha-container");
  if (!container) return;

  if (EVALUACIONES.length === 0 || INDICE_ACTUAL < 0) {
    container.innerHTML = `
      <div class="ficha-empty">
        <span class="material-symbols-outlined">checklist</span>
        <p>Aún no hay evaluaciones. Haga click en "Nueva evaluación" para comenzar.</p>
      </div>
    `;
    return;
  }

  const ev = EVALUACIONES[INDICE_ACTUAL];
  container.innerHTML = renderEvaluacion(ev);
  adjuntarEventosFicha(ev);
}

function renderEvaluacion(ev) {
  const completados = contarMomentosObservados(ev);
  const total = MOMENTS.length;
  const avance = Math.round((completados / total) * 100);

  const momentosHTML = MOMENTS.map(m => renderMomento(m, ev)).join("");
  const categoria = CATEGORIAS.includes(ev.Categoria) ? ev.Categoria : "Medicina";
  const subcategoria = (SUBCATEGORIAS[categoria] || []).includes(ev.Subcategoria || "")
    ? (ev.Subcategoria || "")
    : "";

  return `
    <article class="card card--active">
      <header class="card__header">
        <div class="card__id">
          <div class="card__number card__number--primary">${String(INDICE_ACTUAL + 1).padStart(2, "0")}</div>
          <div>
            <div class="card__title-row">
              <h3 class="card__title">Evaluación #${String(INDICE_ACTUAL + 1).padStart(2, "0")}</h3>
            </div>
          </div>
        </div>
      </header>

      <section class="evaluation-progress" aria-label="Avance de la evaluación">
        <div class="evaluation-progress__copy">
          <span class="evaluation-progress__count">${completados} de ${total} momentos observados</span>
        </div>
        <div
          class="evaluation-progress__track"
          role="progressbar"
          aria-label="Momentos observados"
          aria-valuemin="0"
          aria-valuemax="${total}"
          aria-valuenow="${completados}"
        >
          <span class="evaluation-progress__fill" style="width: ${avance}%"></span>
        </div>
        <p class="evaluation-progress__hint">
          Los momentos sin marcar quedan como no observados; no es necesario completar los cinco.
        </p>
      </section>

      <div class="ficha-header">
        <div class="ficha-header__left">
          <div class="ficha-header__field">
            <label class="ficha-header__label" for="categoria-select">Categoría</label>
            <select class="ficha-header__select" id="categoria-select">
              ${renderSelectOptions(CATEGORIAS, categoria)}
            </select>
          </div>
          <div class="ficha-header__field">
            <label class="ficha-header__label" for="subcategoria-select">Subcategoría</label>
            <select class="ficha-header__select" id="subcategoria-select">
              ${renderSelectOptions(SUBCATEGORIAS[categoria], subcategoria)}
            </select>
          </div>
        </div>
        <button class="icon-btn" type="button" title="Eliminar evaluación" id="btn-delete-eval">
          <span class="material-symbols-outlined">delete</span>
        </button>
      </div>

      <div class="moments">${momentosHTML}</div>

      <div class="ficha-notes">
        <label class="ficha-notes__label" for="notas-textarea">Notas de la evaluación</label>
        <textarea
          class="ficha-notes__textarea"
          id="notas-textarea"
          placeholder="Observaciones adicionales (opcional, máx. 500 caracteres)..."
          maxlength="500"
        >${ev.Notas || ""}</textarea>
      </div>
    </article>
  `;
}

function renderMomento(momento, ev) {
  const respuesta = (ev.Momentos || {})[momento.id];

  let blockClass = "moment";
  if (respuesta === "No realizado") blockClass += " moment--error";

  let numClass = "moment__num";
  if (respuesta === "No realizado") numClass += " moment__num--error";
  else if (respuesta) numClass += " moment__num--primary";

  const tiposAccion = [
    { tipo: "Alcohol",      icon: "sanitizer", texto: "Alcohol", clase: "alcohol"  },
    { tipo: "Lavado",       icon: "wash",      texto: "Lavado",  clase: "tertiary" },
    { tipo: "No realizado", icon: "close",     texto: "Omitido", clase: "error"    }
  ];

  const actionsHTML = tiposAccion.map(a => {
    const seleccionado = respuesta === a.tipo;
    let btnClass = "action";
    if (seleccionado) btnClass += ` action--${a.clase}`;
    else              btnClass += " action--ghost";

    return `
      <button class="${btnClass}" type="button"
              data-momento="${momento.id}"
              data-accion="${a.tipo}">
        <span class="material-symbols-outlined">${a.icon}</span> ${a.texto}
      </button>
    `;
  }).join("");

  return `
    <div class="${blockClass}">
      <div class="moment__label">
        <span class="${numClass}">${momento.id}</span>
        <div>
          <span class="moment__name">${momento.name}</span>
          <span class="moment__state${respuesta ? " moment__state--observed" : ""}">
            ${respuesta ? "Observado" : "Sin observar"}
          </span>
        </div>
      </div>
      <div class="moment__actions">${actionsHTML}</div>
    </div>
  `;
}

/* =========================================================
   6. EVENTOS DE LA FICHA
   ========================================================= */
function adjuntarEventosFicha(ev) {

  const container = document.getElementById("ficha-container");

  const categoriaSelect = container.querySelector("#categoria-select");
  const subcategoriaSelect = container.querySelector("#subcategoria-select");

  if (categoriaSelect && subcategoriaSelect) {
    categoriaSelect.addEventListener("change", () => {
      const categoria = categoriaSelect.value;
      subcategoriaSelect.innerHTML = renderSelectOptions(SUBCATEGORIAS[categoria], "");
      actualizarCategoria(ev, categoria, "");
    });

    subcategoriaSelect.addEventListener("change", () => {
      actualizarCategoria(ev, categoriaSelect.value, subcategoriaSelect.value);
    });
  }

  // --- Botones de momento ---
  container.querySelectorAll(".action").forEach(btn => {
    btn.addEventListener("click", async () => {
      const momento = parseInt(btn.dataset.momento);
      const accion  = btn.dataset.accion;

      showSaveStatus("saving", "Guardando...");

      const res = await apiPost("guardar_observacion.php", {
        accion: "guardar_momento",
        id_evaluacion: ev.ID_evaluacion,
        momento: momento,
        accion_valor: accion
      });

      if (res.ok) {
        if (!ev.Momentos) ev.Momentos = {};
        ev.Momentos[momento] = accion;
        renderFicha();
        actualizarResumen();
        showSaveStatus("saved", "Guardado");
        setTimeout(() => showSaveStatus("saved", "Cambios se guardan automáticamente"), 1500);
      } else {
        showSaveStatus("error", "Error al guardar");
      }
    });
  });

  // --- Notas con debounce ---
  const textarea = document.getElementById("notas-textarea");
  if (textarea) {
    const guardarNotas = debounce(async () => {
      showSaveStatus("saving", "Guardando notas...");
      const res = await apiPost("guardar_observacion.php", {
        accion: "guardar_notas",
        id_evaluacion: ev.ID_evaluacion,
        notas: textarea.value
      });
      if (res.ok) {
        ev.Notas = textarea.value;
        showSaveStatus("saved", "Notas guardadas");
        setTimeout(() => showSaveStatus("saved", "Cambios se guardan automáticamente"), 1500);
      } else {
        showSaveStatus("error", "Error al guardar notas");
      }
    }, 800);

    textarea.addEventListener("input", guardarNotas);
  }

  // --- Eliminar evaluación ---
  const btnDelete = document.getElementById("btn-delete-eval");
  if (btnDelete) {
    btnDelete.addEventListener("click", () => eliminarEvaluacion(ev));
  }
}

async function eliminarEvaluacion(ev) {
  const confirmado = await confirmarAccion({
    titulo: "¿Descartar esta evaluación?",
    mensaje: "Se eliminarán esta evaluación y los datos registrados en ella.",
    confirmar: "Descartar evaluación",
    peligro: true
  });
  if (!confirmado) return;

  showSaveStatus("saving", "Descartando evaluación...");
  try {
    const res = await apiPost("guardar_observacion.php", {
      accion: "eliminar_evaluacion",
      id_evaluacion: ev.ID_evaluacion
    });

    if (!res.ok) {
      showSaveStatus("error", res.message || "No se pudo descartar la evaluación");
      return;
    }

    const indiceEliminado = EVALUACIONES.findIndex(
      evaluacion => evaluacion.ID_evaluacion === ev.ID_evaluacion
    );
    if (indiceEliminado === -1) {
      showSaveStatus("error", "La evaluación ya no está en la lista. Recargue la página.");
      return;
    }

    EVALUACIONES.splice(indiceEliminado, 1);
    if (INDICE_ACTUAL > indiceEliminado) {
      INDICE_ACTUAL--;
    } else if (INDICE_ACTUAL >= EVALUACIONES.length) {
      INDICE_ACTUAL = EVALUACIONES.length - 1;
    }

    renderFicha();
    actualizarResumen();
    actualizarNavBar();
    showSaveStatus("saved", "Evaluación descartada");
  } catch (err) {
    console.error("Error al descartar la evaluación:", err);
    showSaveStatus("error", "Error de conexión al descartar la evaluación");
  }
}

async function actualizarCategoria(ev, categoria, subcategoria) {
  const categoriaSelect = document.getElementById("categoria-select");
  const subcategoriaSelect = document.getElementById("subcategoria-select");

  if (!CATEGORIAS.includes(categoria) || !SUBCATEGORIAS[categoria].includes(subcategoria)) {
    showSaveStatus("error", "Categoría o subcategoría inválida");
    renderFicha();
    return;
  }

  if (categoriaSelect) categoriaSelect.disabled = true;
  if (subcategoriaSelect) subcategoriaSelect.disabled = true;
  showSaveStatus("saving", "Guardando categoría...");

  try {
    const res = await apiPost("guardar_observacion.php", {
      accion: "actualizar_categoria",
      id_evaluacion: ev.ID_evaluacion,
      categoria,
      subcategoria
    });

    if (!res.ok) {
      showSaveStatus("error", res.message || "Error al guardar la categoría");
      renderFicha();
      return;
    }

    ev.Categoria = categoria;
    ev.Subcategoria = subcategoria || null;
    showSaveStatus("saved", "Categoría guardada");
    setTimeout(() => showSaveStatus("saved", "Cambios se guardan automáticamente"), 1500);
  } catch (err) {
    console.error("Error al guardar la categoría:", err);
    showSaveStatus("error", "Error de conexión al guardar la categoría");
    renderFicha();
  } finally {
    if (categoriaSelect && categoriaSelect.isConnected) categoriaSelect.disabled = false;
    if (subcategoriaSelect && subcategoriaSelect.isConnected) subcategoriaSelect.disabled = false;
  }
}

/* =========================================================
   7. NUEVA EVALUACIÓN
   ========================================================= */
async function onNuevaEvaluacion() {
  showSaveStatus("saving", "Creando evaluación...");

  const res = await apiPost("guardar_observacion.php", {
    accion: "crear_evaluacion",
    id_sesion: ID_SESION,
    categoria: "Medicina",
    subcategoria: ""
  });

  if (res.ok) {
    EVALUACIONES.push(res.evaluacion);
    INDICE_ACTUAL = EVALUACIONES.length - 1;
    renderFicha();
    actualizarResumen();
    actualizarNavBar();
    showSaveStatus("saved", "Evaluación creada");
  } else {
    showSaveStatus("error", res.message || "Error al crear evaluación");
    alert("Error: " + (res.message || "No se pudo crear la evaluación"));
  }
}

/* =========================================================
   8. NAVEGACIÓN ENTRE EVALUACIONES
   ========================================================= */
function navegar(direccion) {
  const nuevo = INDICE_ACTUAL + direccion;
  if (nuevo < 0 || nuevo >= EVALUACIONES.length) return;
  INDICE_ACTUAL = nuevo;
  renderFicha();
  actualizarNavBar();
}

function actualizarNavBar() {
  const counter = document.getElementById("nav-counter");
  const prevBtn = document.getElementById("nav-prev");
  const nextBtn = document.getElementById("nav-next");

  if (!counter) return;

  if (EVALUACIONES.length === 0) {
    counter.textContent = "Evaluación 0 de 0";
  } else {
    counter.textContent = `Evaluación ${INDICE_ACTUAL + 1} de ${EVALUACIONES.length}`;
  }

  if (prevBtn) prevBtn.disabled = INDICE_ACTUAL <= 0;
  if (nextBtn) nextBtn.disabled = INDICE_ACTUAL >= EVALUACIONES.length - 1;
  const cancelBtn = document.getElementById("btn-cancel");
  if (cancelBtn) cancelBtn.disabled = EVALUACIONES.length === 0;
}

/* =========================================================
   9. RESUMEN EN VIVO
   ========================================================= */
function actualizarResumen() {
  const totalEval = EVALUACIONES.length;
  let totalMomentos = 0;
  let cumplidos = 0;

  EVALUACIONES.forEach(ev => {
    const m = ev.Momentos || {};
    const total = contarMomentosObservados(ev);
    totalMomentos += total;

    Object.values(m).forEach(accion => {
      if (accion === "Lavado" || accion === "Alcohol") cumplidos++;
    });
  });

  const elEval = document.getElementById("stat-evaluaciones");
  if (elEval) elEval.textContent = totalEval;

  const elMom = document.getElementById("stat-momentos");
  if (elMom) elMom.textContent = `${totalMomentos} / ${totalEval * MOMENTS.length}`;

  const pct = totalMomentos > 0 ? Math.round((cumplidos / totalMomentos) * 100) : 0;
  const elPct = document.getElementById("stat-cumplimiento");
  if (elPct) elPct.textContent = totalMomentos > 0 ? `${pct}%` : "—";

  const barT = document.getElementById("stat-bar-tertiary");
  const barE = document.getElementById("stat-bar-error");
  if (barT) barT.style.width = `${pct}%`;
  if (barE) barE.style.width = `${100 - pct}%`;
}

/* =========================================================
   10. CAMBIAR ÁREA
   ========================================================= */
async function onCambiarArea(e) {
  const nuevaArea = e.target.value;
  if (!nuevaArea || !ID_SESION) return;

  showSaveStatus("saving", "Cambiando área...");

  const res = await apiPost("sesion_observacion.php?accion=cambiar_area", {
    id_sesion: ID_SESION,
    area: nuevaArea
  });

  if (res.ok) {
    AREA_SESION = nuevaArea;
    showSaveStatus("saved", "Área actualizada");
    setTimeout(() => showSaveStatus("saved", "Cambios se guardan automáticamente"), 1500);
  } else {
    showSaveStatus("error", res.message || "Error al cambiar área");
  }
}

/* =========================================================
   11. FINALIZAR SESIÓN
   ========================================================= */
async function onFinalizarSesion() {
  const finishDialog = document.getElementById("finish-dialog");
  if (!finishDialog) {
    console.error("No se encontró el diálogo para finalizar la sesión.");
    return;
  }

  const totalEvaluaciones = EVALUACIONES.length;
  const totalMomentosPosibles = totalEvaluaciones * MOMENTS.length;
  const momentosObservados = EVALUACIONES.reduce(
    (total, ev) => total + contarMomentosObservados(ev),
    0
  );
  const momentosSinObservar = totalMomentosPosibles - momentosObservados;

  document.getElementById("finish-evaluations-count").textContent = totalEvaluaciones;
  document.getElementById("finish-observed-count").textContent = momentosObservados;
  document.getElementById("finish-unobserved-count").textContent = momentosSinObservar;
  document.getElementById("finish-empty-message").hidden = totalEvaluaciones !== 0;
  document.getElementById("finish-summary").hidden = totalEvaluaciones === 0;
  document.getElementById("finish-confirm").disabled = totalEvaluaciones === 0;
  document.getElementById("finish-error").hidden = true;

  finishDialog.showModal();
  document.getElementById("finish-cancel").focus();
}

async function finalizarSesion() {
  const finishConfirm = document.getElementById("finish-confirm");
  const finishCancel = document.getElementById("finish-cancel");
  const finishError = document.getElementById("finish-error");

  finishConfirm.disabled = true;
  finishCancel.disabled = true;
  finishError.hidden = true;
  showSaveStatus("saving", "Finalizando sesión...");

  try {
    let res;
    try {
      res = await apiPost("sesion_observacion.php?accion=finalizar", {
        id_sesion: ID_SESION
      });
    } catch (requestError) {
      let estado;
      try {
        estado = await apiGet(`sesion_observacion.php?accion=estado&id_sesion=${encodeURIComponent(ID_SESION)}`);
      } catch (verificationError) {
        console.error("No se pudo verificar si la sesión se finalizó:", verificationError);
        throw requestError;
      }
      if (!estado.ok || !estado.finalizada) throw requestError;
      res = { ok: true };
    }

    if (!res.ok) {
      throw new Error(res.message || "No se pudo finalizar la sesión.");
    }

    document.getElementById("finish-confirm-view").hidden = true;
    document.getElementById("finish-thank-you-view").hidden = false;
    document.getElementById("finish-confirm-actions").hidden = true;
    document.getElementById("finish-thank-you-actions").hidden = false;
    document.getElementById("finish-dialog").setAttribute("aria-labelledby", "thank-you-title");
    document.getElementById("thank-you-return").focus();
    showSaveStatus("saved", "Sesión finalizada");
  } catch (err) {
    console.error("Error al finalizar la sesión:", err);
    finishError.textContent = err.name === "TypeError"
      ? "No se pudo conectar con el servidor. Verifique su conexión e inténtelo de nuevo."
      : (err.message || "Ocurrió un error al finalizar la sesión. Inténtelo de nuevo.");
    finishError.hidden = false;
    finishConfirm.disabled = false;
    finishCancel.disabled = false;
    showSaveStatus("error", "No se pudo finalizar la sesión");
  }
}