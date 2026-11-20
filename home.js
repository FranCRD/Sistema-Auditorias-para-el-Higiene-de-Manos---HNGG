(() => {
  const endpoint = "contenido_inicio.php";
  const videoContainer = document.getElementById("video-container");
  const documentContainer = document.getElementById("document-container");
  const dialog = document.getElementById("content-dialog");
  const form = document.getElementById("content-form");
  const fieldsContainer = document.getElementById("content-dialog-fields");
  const errorMessage = document.getElementById("content-dialog-error");
  const toast = document.getElementById("content-toast");
  const saveButton = form.querySelector(".content-dialog__save");
  let csrfToken = "";
  let admin = false;
  let content = { videos: [], documentos: [], banner: {} };
  let toastTimer;

  const fieldDefinitions = {
    banner: [
      { name: "titulo", label: "Título", required: true, maxLength: 180 },
      { name: "descripcion", label: "Descripción", type: "textarea", required: true, maxLength: 2000 },
      { name: "imagen_url", label: "Ruta de imagen (relativa) o URL HTTPS", required: true, maxLength: 2048 }
    ],
    video: [
      { name: "titulo", label: "Título", required: true, maxLength: 180 },
      { name: "descripcion", label: "Descripción", type: "textarea", maxLength: 2000 },
      {
        name: "url_video",
        label: "Enlace del video",
        type: "url",
        required: true,
        maxLength: 2048,
        placeholder: "Pega aquí el enlace de YouTube"
      }
    ],
    documento: [
      {
        name: "nombre_doc",
        label: "Nombre del documento",
        required: true,
        maxLength: 180,
        placeholder: "Ej. Guía de higiene de manos"
      },
      {
        name: "archivo_pdf",
        label: "Archivo PDF (máximo 8 MB)",
        type: "file",
        accept: "application/pdf,.pdf",
        help: "Puedes subir un PDF o pegar un enlace al documento."
      },
      {
        name: "url_archivo_pdf",
        label: "O pega un enlace (opcional)",
        type: "url",
        maxLength: 2048,
        placeholder: "https://..."
      }
    ]
  };

  function makeElement(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  }

  function youtubeThumbnail(value) {
    const safeUrl = safeDisplayUrl(value);
    if (!safeUrl) return "";

    try {
      const url = new URL(safeUrl);
      const host = url.hostname.toLowerCase().replace(/^www\./, "");
      let videoId = "";

      if (host === "youtu.be") {
        videoId = url.pathname.split("/").filter(Boolean)[0] || "";
      } else if (["youtube.com", "m.youtube.com", "youtube-nocookie.com"].includes(host)) {
        videoId = url.searchParams.get("v") || "";
        if (!videoId) {
          videoId = url.pathname.match(/^\/(?:embed|shorts)\/([^/?]+)/)?.[1] || "";
        }
      }

      return /^[\w-]{11}$/.test(videoId)
        ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
        : "";
    } catch {
      return "";
    }
  }

  function makeIcon(name) {
    return makeElement("span", "material-symbols-outlined", name);
  }

  function makeActionButton(label, icon, action, id, className) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = className;
    button.dataset.action = action;
    button.dataset.id = String(id);
    button.append(makeIcon(icon), document.createTextNode(label));
    return button;
  }

  function showMessage(target, text, className) {
    target.replaceChildren(makeElement("p", className, text));
  }

  function resolveWelcomeLabel(sexo) {
    const normalized = String(sexo || "").trim().toLowerCase();
    if (normalized === "femenino") return "Bienvenida";
    if (normalized === "masculino") return "Bienvenido";
    if (normalized === "prefiero no decirlo" || normalized === "otro" || normalized === "no especificado") return "Bienvenida/o";
    return "Bienvenida";
  }

  function addAdminActions(parent, type, item) {
    if (!admin) return;

    const actions = makeElement("div", "content-admin-actions");
    actions.append(
      makeActionButton("Editar", "edit", `edit-${type}`, item.id, "content-edit-button")
    );

    if (Number(item.activo) === 1) {
      actions.append(
        makeActionButton("Eliminar", "delete", `delete-${type}`, item.id, "content-delete-button")
      );
    } else {
      actions.append(
        makeActionButton("Reactivar", "restart_alt", `restore-${type}`, item.id, "content-restore-button")
      );
    }
    parent.append(actions);
  }

  function renderVideos(videos) {
    videoContainer.replaceChildren();
    if (!videos.length) {
      showMessage(videoContainer, admin
        ? "Todavía no hay videos. Agrega el primero con el botón de arriba."
        : "No hay videos publicados por el momento.", "content-empty");
      return;
    }

    videos.forEach(video => {
      const inactive = Number(video.activo) !== 1;
      const card = makeElement("article", `media-card${inactive ? " media-card--inactive" : ""}`);
      const preview = makeElement("div", "media-card__preview");
      const image = document.createElement("img");
      image.src = youtubeThumbnail(video.url_video) ||
        safeDisplayUrl(video.thumbnail_url) ||
        "images/HNGG_Nuevo.webp";
      image.alt = `Miniatura: ${video.titulo}`;
      image.loading = "lazy";
      image.addEventListener("error", () => {
        if (image.dataset.fallback) {
          image.hidden = true;
        } else {
          image.dataset.fallback = "true";
          image.src = "images/HNGG_Nuevo.webp";
        }
      });
      preview.append(image);

      if (!inactive) {
        const overlay = makeElement("div", "media-card__overlay");
        const playLink = document.createElement("a");
        playLink.className = "play-trigger";
        playLink.href = safeDisplayUrl(video.url_video) || "#";
        playLink.target = "_blank";
        playLink.rel = "noopener noreferrer";
        playLink.setAttribute("aria-label", `Abrir video: ${video.titulo}`);
        playLink.append(makeIcon("play_arrow"));
        overlay.append(playLink);
        preview.append(overlay);
      }

      card.append(preview);

      const info = makeElement("div", "media-card__info");
      if (video.categoria_tag) info.append(makeElement("span", "video-tag", video.categoria_tag));
      info.append(makeElement("h3", "", video.titulo));
      if (video.descripcion) info.append(makeElement("p", "", video.descripcion));
      if (inactive) info.append(makeElement("p", "content-inactive-label", "No publicado"));
      card.append(info);
      addAdminActions(card, "video", video);
      videoContainer.append(card);
    });
  }

  function renderDocuments(documents) {
    documentContainer.replaceChildren();
    if (!documents.length) {
      showMessage(documentContainer, admin
        ? "Todavía no hay documentos. Agrega el primero con el botón de arriba."
        : "No hay documentos publicados por el momento.", "content-empty");
      return;
    }

    documents.forEach(documentData => {
      const inactive = Number(documentData.activo) !== 1;
      const row = makeElement("article", `doc-item${inactive ? " doc-item--inactive" : ""}`);
      const icon = makeElement("div", "doc-item__icon doc-item__icon--generic");
      icon.append(makeIcon(documentData.tipo_icon || "picture_as_pdf"));
      const details = makeElement("div", "doc-item__details");
      details.append(makeElement("h4", "", documentData.nombre_doc));
      details.append(makeElement("span", "", "Documento PDF"));
      row.append(icon, details);

      if (!inactive) {
        const link = document.createElement("a");
        link.className = "download-btn";
        link.href = safeDisplayUrl(documentData.url_archivo_pdf) || "#";
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.setAttribute("aria-label", `Abrir documento: ${documentData.nombre_doc}`);
        link.append(makeIcon("download"), document.createTextNode("Descargar"));
        row.append(link);
      } else {
        details.append(makeElement("span", "content-inactive-label", "No publicado"));
      }

      addAdminActions(row, "documento", documentData);
      documentContainer.append(row);
    });
  }

  function safeDisplayUrl(value) {
    if (typeof value !== "string" || /[\u0000-\u001f\\]/.test(value) || value.startsWith("//")) {
      return "";
    }
    try {
      const parsed = new URL(value, window.location.href);
      if (parsed.protocol !== "https:" && parsed.origin !== window.location.origin) return "";
      return parsed.href;
    } catch {
      return "";
    }
  }

  function render(data) {
    content = data;
    admin = data.usuario.Rol === 1;
    csrfToken = data.csrf_token || "";

    const userName = [data.usuario.Nombre, data.usuario.Apellidos].filter(Boolean).join(" ");
    document.getElementById("user-name").textContent = userName || "Usuario";
    document.getElementById("hero-name").textContent = userName || "Usuario";
    document.getElementById("welcome-pronoun").textContent = resolveWelcomeLabel(data.usuario.Genero);
    document.getElementById("admin-link").hidden = !admin;
    document.getElementById("dashboard-link").hidden = !admin;
    document.querySelector("[data-edit-banner]").hidden = !admin;
    document.querySelector("[data-add-video]").hidden = !admin;
    document.querySelector("[data-add-document]").hidden = !admin;

    document.getElementById("banner-title").textContent = data.banner.titulo;
    document.getElementById("banner-description").textContent = data.banner.descripcion;
    const imageUrl = safeDisplayUrl(data.banner.imagen_url);
    if (imageUrl) {
      document.querySelector(".hero-banner").style.backgroundImage = `url(${JSON.stringify(imageUrl)})`;
    }

    renderVideos(data.videos);
    renderDocuments(data.documentos);
  }

  async function request(url, options = {}) {
    const response = await fetch(url, {
      credentials: "same-origin",
      ...options
    });
    const data = await response.json().catch(() => null);
    if (response.status === 401) {
      window.location.replace("login.html");
      throw new Error("La sesión ha vencido. Inicia sesión nuevamente.");
    }
    if (!response.ok || !data || data.ok !== true) {
      throw new Error(data && data.message ? data.message : "No se pudo completar la solicitud.");
    }
    return data;
  }

  function showToast(message, isError = false) {
    window.clearTimeout(toastTimer);
    toast.textContent = message;
    toast.classList.toggle("content-toast--error", isError);
    toast.hidden = false;
    toastTimer = window.setTimeout(() => { toast.hidden = true; }, 3500);
  }

  function setSaveState(isSaving) {
    const originalText = saveButton.dataset.originalText || "Guardar";
    saveButton.disabled = isSaving;
    saveButton.textContent = isSaving ? "Guardando..." : originalText;
  }

  function addFormField(definition, value = "") {
    const wrapper = makeElement(
      definition.type === "file" ? "div" : "label",
      "content-dialog__field"
    );
    if (definition.type === "file") {
      wrapper.append(makeElement("span", "content-dialog__field-label", definition.label));
    } else {
      wrapper.append(document.createTextNode(definition.label));
    }
    let input;

    if (definition.type === "textarea") {
      input = document.createElement("textarea");
    } else if (definition.type === "select") {
      input = document.createElement("select");
      definition.options.forEach(([optionValue, optionLabel]) => {
        const option = document.createElement("option");
        option.value = optionValue;
        option.textContent = optionLabel;
        input.append(option);
      });
    } else {
      input = document.createElement("input");
      input.type = definition.type || "text";
    }

    input.name = definition.name;
    if (input.type !== "file") input.value = value ?? "";
    if (definition.required) input.required = true;
    if (definition.maxLength) input.maxLength = definition.maxLength;
    if (definition.accept) input.accept = definition.accept;
    if (definition.placeholder) input.placeholder = definition.placeholder;
    ["min", "max", "step"].forEach(attribute => {
      if (definition[attribute]) input.setAttribute(attribute, definition[attribute]);
    });
    if (definition.type === "file") {
      const picker = makeElement("div", "content-dialog__file-picker");
      const chooseButton = document.createElement("button");
      chooseButton.type = "button";
      chooseButton.className = "content-dialog__file-button";
      chooseButton.append(makeIcon("upload_file"), document.createTextNode("Elegir archivo"));
      const filename = makeElement("span", "content-dialog__filename", "Ningún archivo seleccionado");
      input.hidden = true;
      input.addEventListener("change", () => {
        filename.textContent = input.files[0]?.name || "Ningún archivo seleccionado";
      });
      chooseButton.addEventListener("click", () => input.click());
      picker.append(chooseButton, filename, input);
      wrapper.append(picker);
    } else {
      wrapper.append(input);
    }
    if (definition.help) wrapper.append(makeElement("small", "content-dialog__hint", definition.help));
    fieldsContainer.append(wrapper);
  }

  function openEditor(type, item = {}) {
    const definitions = fieldDefinitions[type];
    const title = type === "banner" ? "Editar banner" :
      `${item.id ? "Editar" : "Agregar"} ${type === "video" ? "video" : "documento"}`;
    document.getElementById("content-dialog-title").textContent = title;
    fieldsContainer.replaceChildren();
    errorMessage.hidden = true;
    errorMessage.textContent = "";
    form.dataset.type = type;
    form.dataset.id = item.id ? String(item.id) : "";

    definitions.forEach(definition => {
      const value = type === "documento" && definition.name === "url_archivo_pdf" && item.tiene_archivo
        ? ""
        : item[definition.name] ?? "";
      addFormField(definition, value);
    });

    if (type === "documento" && item.tiene_archivo) {
      fieldsContainer.prepend(makeElement(
        "p",
        "content-dialog__notice",
        "Este documento ya tiene un PDF guardado. Selecciona otro archivo para reemplazarlo."
      ));
    }

    if (type === "documento") {
      const fileInput = form.elements.namedItem("archivo_pdf");
      const urlInput = form.elements.namedItem("url_archivo_pdf");
      fileInput.addEventListener("change", () => {
        if (fileInput.files.length) urlInput.value = "";
      });
      urlInput.addEventListener("input", () => {
        if (urlInput.value) fileInput.value = "";
      });
    }

    dialog.showModal();
    fieldsContainer.querySelector("input, textarea, select")?.focus();
  }

  function findItem(type, id) {
    const collection = type === "video" ? content.videos : content.documentos;
    return collection.find(item => String(item.id) === String(id));
  }

  async function deleteItem(type, id) {
    const item = findItem(type, id);
    const confirmed = await confirmarAccion({
      titulo: "¿Retirar contenido?",
      mensaje: `Se ocultará "${item ? (item.titulo || item.nombre_doc) : "este elemento"}" de la página pública.`,
      confirmar: "Retirar",
      peligro: true
    });
    if (!confirmed) return;
    await saveAction({ action: `delete_${type}`, id: Number(id) });
    showToast("Contenido retirado.");
    await loadContent();
  }

  async function saveAction(payload, isFormData = false) {
    const data = await request(endpoint, {
      method: "POST",
      headers: {
        ...(isFormData ? {} : { "Content-Type": "application/json" }),
        "X-CSRF-Token": csrfToken
      },
      body: isFormData ? payload : JSON.stringify(payload)
    });
    return data;
  }

  async function loadContent() {
    try {
      render(await request(endpoint));
    } catch (error) {
      showMessage(videoContainer, error.message, "content-error");
      showMessage(documentContainer, error.message, "content-error");
    }
  }

  document.querySelector("[data-edit-banner]").addEventListener("click", () => {
    openEditor("banner", content.banner);
  });
  document.querySelector("[data-add-video]").addEventListener("click", () => openEditor("video"));
  document.querySelector("[data-add-document]").addEventListener("click", () => openEditor("documento"));

  [videoContainer, documentContainer].forEach(container => {
    container.addEventListener("click", async event => {
      const button = event.target.closest("button[data-action]");
      if (!button) return;

      const [, action, type] = button.dataset.action.match(/^(edit|delete|restore)-(video|documento)$/) || [];
      if (!action || !type) return;
      try {
        const item = findItem(type, button.dataset.id);
        if (!item) throw new Error("El contenido solicitado ya no está disponible.");
        if (action === "edit") {
          openEditor(type, item);
        } else if (action === "delete") {
          await deleteItem(type, button.dataset.id);
        } else {
          await saveAction({ action: `restore_${type}`, id: Number(button.dataset.id) });
          showToast("Contenido publicado nuevamente.");
          await loadContent();
        }
      } catch (error) {
        showToast(error.message, true);
      }
    });
  });

  document.querySelectorAll("[data-close-dialog]").forEach(button => {
    button.addEventListener("click", () => dialog.close());
  });

  dialog.addEventListener("click", event => {
    if (event.target === dialog) dialog.close();
  });

  form.addEventListener("submit", async event => {
    event.preventDefault();
    errorMessage.hidden = true;
    saveButton.dataset.originalText = saveButton.dataset.originalText || saveButton.textContent;
    setSaveState(true);
    showToast("Guardando cambios...");

    const type = form.dataset.type;
    const id = form.dataset.id;
    try {
      if (type === "documento") {
        const fileInput = form.elements.namedItem("archivo_pdf");
        const urlInput = form.elements.namedItem("url_archivo_pdf");
        if (!id && !fileInput.files.length && !urlInput.value.trim()) {
          throw new Error("Selecciona un PDF o pega un enlace al documento.");
        }

        const payload = new FormData(form);
        payload.set("action", "save_documento");
        if (id) payload.set("id", id);
        await saveAction(payload, true);
      } else {
        const payload = Object.fromEntries(new FormData(form).entries());
        payload.action = type === "banner" ? "save_banner" : `save_${type}`;
        if (id) payload.id = Number(id);
        await saveAction(payload);
      }
      dialog.close();
      showToast("Cambios guardados.");
      await loadContent();
    } catch (error) {
      errorMessage.textContent = error.message;
      errorMessage.hidden = false;
      showToast(error.message, true);
    } finally {
      setSaveState(false);
    }
  });

  document.getElementById("logout-btn").addEventListener("click", async () => {
    if (await confirmarAccion({
      titulo: "¿Cerrar sesión?",
      mensaje: "Se cerrará su sesión en el sistema.",
      confirmar: "Cerrar sesión"
    })) {
      sessionStorage.removeItem("hm_user");
      window.location.href = "cerrar_sesion.php";
    }
  });

  loadContent();
})();
