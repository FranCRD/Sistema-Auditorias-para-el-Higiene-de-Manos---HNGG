document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('logout-btn')?.addEventListener('click', async () => {
    const accepted = await window.confirmarAccion({
      titulo: '¿Cerrar sesión?',
      mensaje: 'Se cerrará su sesión actual y volverá a la pantalla de acceso.',
      confirmar: 'Cerrar sesión'
    });
    if (!accepted) return;
    sessionStorage.removeItem('hm_user');
    window.location.href = 'cerrar_sesion.php';
  });

  const fullName = document.getElementById('perfil-nombre-completo');
  const initialsEl = document.getElementById('perfil-iniciales');
  const correoEl = document.getElementById('perfil-correo');
  const rolBadge = document.getElementById('perfil-rol-badge');
  const rolLabel = document.getElementById('perfil-rol-label');
  const rolIcon = document.getElementById('perfil-rol-icon');
  const datoNombre = document.getElementById('dato-nombre');
  const datoCedula = document.getElementById('dato-cedula');
  const datoCorreo = document.getElementById('dato-correo');
  const datoGenero = document.getElementById('dato-genero');
  const accountStatus = document.getElementById('dato-estado-cuenta');
  const datoRolBadge = document.getElementById('dato-rol-badge');
  const datoRolLabel = document.getElementById('dato-rol-label');
  const datoRolIcon = document.getElementById('dato-rol-icon');
  const activityCard = document.getElementById('activity-card');
  const historyCard = document.getElementById('history-card');
  const adminShortcutsCard = document.getElementById('admin-shortcuts-card');
  const historyTbody = document.getElementById('history-tbody');
  const historyEmpty = document.getElementById('history-empty');
  const historyError = document.getElementById('history-error');
  const passwordForm = document.getElementById('password-form');
  const passwordMessage = document.getElementById('password-message');
  const passwordStrengthBar = document.getElementById('password-strength-bar');
  const passwordStrengthText = document.getElementById('password-strength-text');
  const newPasswordInput = document.getElementById('new-password');

  function setMessage(el, text, type = 'info', visible = true) {
    if (!el) return;
    el.textContent = text;
    el.className = 'form__message';
    el.hidden = !visible;
    if (visible) {
      el.classList.add('is-visible', `is-${type}`);
    }
  }

  function normalizeRoleLabel(rol) {
    return Number(rol) === 1 ? 'Administrador' : 'Observador';
  }

  function roleClasses(rol) {
    const base = 'badge badge--role';
    return Number(rol) === 1 ? `${base} badge--role--admin` : `${base} badge--role--observer`;
  }

  function roleIcon(rol) {
    return Number(rol) === 1 ? 'shield_person' : 'visibility';
  }

  function updateRoleVisual(rol) {
    const normalized = normalizeRoleLabel(rol);
    const badgeClasses = roleClasses(rol);
    const iconName = roleIcon(rol);

    [rolBadge, datoRolBadge].forEach((badge) => {
      if (badge) {
        badge.className = badgeClasses;
      }
    });

    [rolLabel, datoRolLabel].forEach((label) => {
      if (label) label.textContent = normalized;
    });

    [rolIcon, datoRolIcon].forEach((icon) => {
      if (icon) icon.textContent = iconName;
    });
  }

  function renderInitials(name, lastName) {
    const initials = `${(name || '').trim().charAt(0) || 'U'}${(lastName || '').trim().charAt(0) || ''}`.toUpperCase();
    initialsEl.textContent = initials || 'U';
  }

  function renderProfile(user) {
    const full = `${user.Nombre || ''} ${user.Apellidos || ''}`.trim() || 'Usuario';
    const rol = Number(user.Rol ?? 0);

    fullName.textContent = full;
    renderInitials(user.Nombre || '', user.Apellidos || '');
    correoEl.textContent = user.Correo || '—';
    document.getElementById('user-name').textContent = full;

    datoNombre.textContent = full;
    datoCedula.textContent = user.Cedula || '—';
    datoCorreo.textContent = user.Correo || '—';
    datoGenero.textContent = user.Genero || 'No especificado';
    const isActive = Number(user.Estado) === 1;
    accountStatus.className = `status ${isActive ? 'status--active' : 'status--inactive'}`;
    accountStatus.setAttribute('aria-label', `Estado de la cuenta: ${isActive ? 'activa' : 'inactiva'}`);
    accountStatus.innerHTML = `<span class="status__dot" aria-hidden="true"></span>${isActive ? 'Activa' : 'Inactiva'}`;
    updateRoleVisual(rol);

    if (rol === 1) {
      adminShortcutsCard.hidden = false;
      activityCard.hidden = true;
      historyCard.hidden = true;
    } else {
      adminShortcutsCard.hidden = true;
      activityCard.hidden = false;
      historyCard.hidden = false;
    }
  }

  function renderStats(stats) {
    const evaluations = document.getElementById('stat-evaluaciones');
    const sessions = document.getElementById('stat-sesiones');
    const moments = document.getElementById('stat-momentos');

    if (evaluations) evaluations.textContent = stats.evaluaciones ?? '0';
    if (sessions) sessions.textContent = stats.sesiones ?? '0';
    if (moments) moments.textContent = stats.momentos ?? '0';
  }

  function renderHistory(rows) {
    historyTbody.innerHTML = '';

    if (!rows.length) {
      historyEmpty.hidden = false;
      historyTbody.innerHTML = '<tr><td colspan="7" class="ta-c" style="color: var(--c-on-surface-var);">Sin registros</td></tr>';
      return;
    }

    historyEmpty.hidden = true;

    rows.forEach((row) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>#${row.ID_sesion}</td>
        <td>${row.Fecha || '—'}</td>
        <td>${row.HoraInicio || '—'}</td>
        <td>${row.HoraFin || '—'}</td>
        <td>${row.DepartamentoServicio || '—'}</td>
        <td class="ta-c">${row.evaluaciones || 0}</td>
        <td class="ta-c"><span class="status ${row.Estado === 'active' ? 'status--active' : 'status--finished'}"><span class="status__dot"></span>${row.Estado === 'active' ? 'Activa' : 'Finalizada'}</span></td>
      `;
      historyTbody.appendChild(tr);
    });
  }

  async function loadProfile() {
    try {
      const response = await fetch('perfil_datos.php', {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      });

      const data = await response.json();
      if (!response.ok || !data.ok) {
        throw new Error(data.message || 'No se pudo cargar el perfil.');
      }

      renderProfile(data.usuario);
      renderStats(data.estadisticas || {});
      renderHistory(data.historial || []);
    } catch (error) {
      historyError.hidden = false;
      setMessage(historyError, error.message || 'No se pudo cargar la información.', 'error');
      if (historyTbody) {
        historyTbody.innerHTML = '<tr><td colspan="7" class="ta-c" style="color: var(--c-error);">Error al cargar historial</td></tr>';
      }
    }
  }

  function updateStrengthMeter(value) {
    const length = value.length;
    if (!length) {
      passwordStrengthBar.style.width = '0%';
      passwordStrengthBar.style.background = 'var(--c-surface-2)';
      passwordStrengthText.textContent = 'Use al menos 8 caracteres. No necesita combinar mayúsculas, números ni símbolos.';
      return;
    }

    const width = Math.min((length / 12) * 100, 100);
    passwordStrengthBar.style.width = `${width}%`;

    if (length < 8) {
      passwordStrengthBar.style.background = '#dc2626';
      const remaining = 8 - length;
      passwordStrengthText.textContent = `Aún no cumple el mínimo: agrega ${remaining} ${remaining === 1 ? 'carácter' : 'caracteres'}.`;
    } else {
      passwordStrengthBar.style.background = '#059669';
      passwordStrengthText.textContent = 'Cumple el mínimo de 8 caracteres. Una frase larga y única es más difícil de adivinar.';
    }
  }

  function bindPasswordToggles() {
    document.querySelectorAll('[data-toggle]').forEach((button) => {
      button.addEventListener('click', () => {
        const inputId = button.getAttribute('data-toggle');
        const input = document.getElementById(inputId);
        if (!input) return;

        const isPassword = input.type === 'password';
        input.type = isPassword ? 'text' : 'password';
        button.querySelector('.material-symbols-outlined').textContent = isPassword ? 'visibility_off' : 'visibility';
        button.setAttribute('aria-label', isPassword ? 'Ocultar contraseña' : 'Mostrar contraseña');
      });
    });
  }

  function bindPasswordCard() {
    const togglePasswordCard = document.getElementById('toggle-password-card');
    const passwordFormWrapper = document.getElementById('password-form');
    const togglePasswordIcon = document.getElementById('toggle-password-icon');

    if (!togglePasswordCard || !passwordFormWrapper) return;

    togglePasswordCard.addEventListener('click', () => {
      const isHidden = passwordFormWrapper.hasAttribute('hidden');
      passwordFormWrapper.toggleAttribute('hidden', !isHidden);
      togglePasswordCard.setAttribute('aria-expanded', String(isHidden));
      togglePasswordIcon.textContent = isHidden ? 'lock' : 'lock_open';
    });

    document.querySelector('[data-cancel-password]')?.addEventListener('click', () => {
      passwordFormWrapper.setAttribute('hidden', 'hidden');
      togglePasswordCard.setAttribute('aria-expanded', 'false');
      togglePasswordIcon.textContent = 'lock_open';
      passwordForm.reset();
      setMessage(passwordMessage, '', 'info', false);
      updateStrengthMeter('');
    });
  }

  passwordForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    setMessage(passwordMessage, '', 'info', false);

    const currentPassword = document.getElementById('current-password').value;
    const newPassword = document.getElementById('new-password').value;
    const confirmPassword = document.getElementById('confirm-password').value;

    if (!currentPassword || !newPassword || !confirmPassword) {
      setMessage(passwordMessage, 'Complete todos los campos de contraseña.', 'error');
      return;
    }

    if (newPassword !== confirmPassword) {
      setMessage(passwordMessage, 'La contraseña nueva y la confirmación no coinciden.', 'error');
      return;
    }

    if (newPassword.length < 8) {
      setMessage(passwordMessage, 'La contraseña nueva debe tener al menos 8 caracteres.', 'error');
      newPasswordInput.focus();
      return;
    }

    const submitButton = document.getElementById('password-submit');
    const originalText = submitButton.innerHTML;
    submitButton.disabled = true;
    submitButton.innerHTML = '<span class="material-symbols-outlined">sync</span> Guardando...';

    const formData = new FormData();
    formData.append('current_password', currentPassword);
    formData.append('new_password', newPassword);
    formData.append('confirm_password', confirmPassword);

    try {
      const response = await fetch('perfil_password.php', {
        method: 'POST',
        body: formData
      });
      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(data.message || 'No se pudo actualizar la contraseña.');
      }

      setMessage(passwordMessage, data.message || 'Contraseña actualizada correctamente.', 'success');
      passwordForm.reset();
      updateStrengthMeter('');
    } catch (error) {
      setMessage(passwordMessage, error.message || 'No se pudo actualizar la contraseña.', 'error');
    } finally {
      submitButton.disabled = false;
      submitButton.innerHTML = originalText;
    }
  });

  newPasswordInput?.addEventListener('input', (event) => updateStrengthMeter(event.target.value));
  bindPasswordToggles();
  bindPasswordCard();
  loadProfile();
});
