document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.nav-mobile-toggle').forEach(toggle => {
    const headerInner = toggle.closest('.app-header__inner');
    if (!headerInner) return;

    const nav = headerInner.querySelector('.header-navigation');
    const panel = headerInner.querySelector('.mobile-nav-panel');
    if (!nav || !panel) return;

    const syncMobileLinks = () => {
      panel.replaceChildren();
      Array.from(nav.querySelectorAll('a')).filter(link => !link.hidden).forEach(link => {
        const clone = link.cloneNode(true);
        clone.removeAttribute('hidden');
        clone.classList.add('btn');
        clone.setAttribute('aria-label', link.textContent.trim());
        clone.addEventListener('click', () => {
          panel.hidden = true;
          toggle.classList.remove('is-open');
          toggle.setAttribute('aria-expanded', 'false');
        });
        panel.appendChild(clone);
      });
    };

    syncMobileLinks();

    toggle.addEventListener('click', () => {
      const isOpen = toggle.classList.toggle('is-open');
      if (isOpen) syncMobileLinks();
      panel.hidden = !isOpen;
      toggle.setAttribute('aria-expanded', String(isOpen));
    });
  });
});

function confirmarAccion({
  titulo,
  mensaje,
  confirmar = "Confirmar",
  cancelar = "Cancelar",
  peligro = false
}) {
  let dialog = document.getElementById("action-confirm-dialog");
  if (!dialog) {
    dialog = document.createElement("dialog");
    dialog.id = "action-confirm-dialog";
    dialog.className = "action-confirm";
    dialog.setAttribute("aria-labelledby", "action-confirm-title");
    dialog.setAttribute("aria-describedby", "action-confirm-message");
    dialog.innerHTML = `
      <div class="action-confirm__content">
        <div class="action-confirm__icon" aria-hidden="true">
          <span class="material-symbols-outlined"></span>
        </div>
        <h2 class="action-confirm__title" id="action-confirm-title"></h2>
        <p class="action-confirm__message" id="action-confirm-message"></p>
      </div>
      <footer class="action-confirm__actions">
        <button class="btn btn--ghost" type="button" data-confirm-cancel></button>
        <button class="btn btn--primary" type="button" data-confirm-accept></button>
      </footer>
    `;
    document.body.append(dialog);
  }

  const icon = dialog.querySelector(".action-confirm__icon");
  const iconText = icon.querySelector(".material-symbols-outlined");
  const title = dialog.querySelector(".action-confirm__title");
  const messageText = dialog.querySelector(".action-confirm__message");
  const cancelButton = dialog.querySelector("[data-confirm-cancel]");
  const acceptButton = dialog.querySelector("[data-confirm-accept]");

  dialog.classList.toggle("action-confirm--danger", peligro);
  iconText.textContent = peligro ? "warning" : "help";
  title.textContent = titulo;
  messageText.textContent = mensaje;
  cancelButton.textContent = cancelar;
  acceptButton.textContent = confirmar;
  acceptButton.classList.toggle("btn--danger", peligro);

  return new Promise(resolve => {
    let resolved = false;
    const cleanup = () => {
      cancelButton.removeEventListener("click", onCancel);
      acceptButton.removeEventListener("click", onAccept);
      dialog.removeEventListener("cancel", onCancel);
      dialog.removeEventListener("close", onClose);
    };
    const finish = result => {
      if (resolved) return;
      resolved = true;
      cleanup();
      if (dialog.open) dialog.close(result ? "confirm" : "cancel");
      resolve(result);
    };
    const onCancel = event => {
      event.preventDefault();
      finish(false);
    };
    const onAccept = () => finish(true);
    const onClose = () => finish(dialog.returnValue === "confirm");

    cancelButton.addEventListener("click", onCancel);
    acceptButton.addEventListener("click", onAccept);
    dialog.addEventListener("cancel", onCancel);
    dialog.addEventListener("close", onClose);
    dialog.showModal();
    cancelButton.focus();
  });
}
