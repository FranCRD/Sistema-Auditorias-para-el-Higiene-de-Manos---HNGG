/* Lógica compartida para inicio de sesión y registro. */
(() => {
  const passwordInput = document.getElementById("password");
  const passwordToggle = document.getElementById("toggle-password");

  if (passwordInput && passwordToggle) {
    passwordToggle.addEventListener("click", () => {
      const show = passwordInput.type === "password";
      passwordInput.type = show ? "text" : "password";
      const icon = passwordToggle.querySelector(".material-symbols-outlined");
      if (icon) icon.textContent = show ? "visibility_off" : "visibility";
      passwordToggle.setAttribute("aria-label", show ? "Ocultar contraseña" : "Mostrar contraseña");
    });
  }

  function showMessage(element, text, type = "info") {
    element.textContent = text;
    element.className = `form__message is-visible is-${type}`;
  }

  function hideMessage(element) {
    element.className = "form__message";
  }

  function setLoading(button, loading) {
    button.disabled = loading;
    button.classList.toggle("is-loading", loading);
    button.setAttribute("aria-busy", String(loading));
  }

  const loginForm = document.getElementById("login-form");
  if (loginForm) {
    const password = passwordInput;
    const message = document.getElementById("login-message");
    const submit = document.getElementById("login-submit");
    const credential = document.getElementById("credential");
    const viewLogin = document.getElementById("view-login");
    const viewRecovery = document.getElementById("view-recovery");
    const recoveryLink = document.getElementById("goto-recovery");
    const backLink = document.getElementById("back-to-login");

    loginForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      hideMessage(message);

      const userCredential = credential.value.trim();
      const userPassword = password.value;

      if (!userCredential || !userPassword) {
        credential.classList.toggle("is-invalid", !userCredential);
        password.classList.toggle("is-invalid", !userPassword);
        credential.setAttribute("aria-invalid", String(!userCredential));
        password.setAttribute("aria-invalid", String(!userPassword));
        showMessage(message, "Complete todos los campos obligatorios.", "error");
        (!userCredential ? credential : password).focus();
        return;
      }

      setLoading(submit, true);
      try {
        const formData = new FormData();
        formData.append("credential", userCredential);
        formData.append("password", userPassword);

        const response = await fetch("validar_Login.php", { method: "POST", body: formData });
        if (!response.ok) {
          showMessage(message, "No se pudo completar el acceso. Intente de nuevo; si el problema continúa, contacte al administrador.", "error");
          setLoading(submit, false);
          return;
        }

        const data = await response.json();
        if (!data.ok) {
          showMessage(message, data.message || "Error al iniciar sesión.", "error");
          setLoading(submit, false);
          return;
        }

        showMessage(message, "Acceso concedido. Redirigiendo…", "success");
        sessionStorage.setItem("hm_user", JSON.stringify(data.usuario));
        setTimeout(() => { window.location.href = "home.html"; }, 700);
      } catch (error) {
        showMessage(message, "No se pudo conectar con el sistema. Revise su conexión e intente de nuevo.", "error");
        console.error(error);
        setLoading(submit, false);
      }
    });

    recoveryLink.addEventListener("click", () => {
      viewLogin.classList.add("is-hidden");
      viewRecovery.classList.remove("is-hidden");
      backLink.focus();
    });

    backLink.addEventListener("click", () => {
      viewRecovery.classList.add("is-hidden");
      viewLogin.classList.remove("is-hidden");
      credential.focus();
    });

    credential.addEventListener("input", (event) => {
      event.target.classList.remove("is-invalid");
      event.target.removeAttribute("aria-invalid");
    });
    password.addEventListener("input", (event) => {
      event.target.classList.remove("is-invalid");
      event.target.removeAttribute("aria-invalid");
    });
  }

  const registerForm = document.getElementById("register-form");
  if (registerForm) {
    const password = passwordInput;
    const strengthBar = document.getElementById("password-strength-bar");
    const strengthText = document.getElementById("password-strength-text");
    const message = document.getElementById("register-message");
    const submit = document.getElementById("register-submit");

    password.addEventListener("input", () => {
      const value = password.value;
      let score = 0;
      if (value.length >= 8) score += 1;
      if (/[A-Z]/.test(value)) score += 1;
      if (/[a-z]/.test(value)) score += 1;
      if (/\d/.test(value)) score += 1;
      if (/[^A-Za-z0-9]/.test(value)) score += 1;

      const level = score <= 2 ? "Débil" : score <= 4 ? "Buena" : "Fuerte";
      const color = score <= 2 ? "#dc2626" : score <= 4 ? "#f59e0b" : "#059669";
      strengthBar.style.width = `${Math.min((score / 5) * 100, 100)}%`;
      strengthBar.style.background = color;
      strengthText.textContent = value ? `Seguridad: ${level}` : "Introduzca una contraseña segura.";
      strengthText.style.color = value ? color : "#64748b";
    });

    registerForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      hideMessage(message);

      const nombre = document.getElementById("full-name").value.trim();
      const cedula = document.getElementById("cedula").value.trim();
      const correo = document.getElementById("email").value.trim();
      const genero = document.getElementById("genero").value.trim();
      const userPassword = password.value;
      const passwordConfirm = document.getElementById("password-confirm").value;
      const acceptsTerms = document.getElementById("terms").checked;

      if (!nombre || !cedula || !correo || !genero || !userPassword || !passwordConfirm) {
        showMessage(message, "Complete todos los campos obligatorios.", "error");
        return;
      }
      if (cedula.length > 30) {
        showMessage(message, "La cédula o identificación no puede superar 30 caracteres.", "error");
        return;
      }
      if (userPassword.length < 8) {
        showMessage(message, "La contraseña debe tener al menos 8 caracteres.", "error");
        return;
      }
      if (userPassword !== passwordConfirm) {
        showMessage(message, "Las contraseñas no coinciden.", "error");
        return;
      }
      if (!acceptsTerms) {
        showMessage(message, "Debe aceptar el uso de datos institucionales.", "error");
        return;
      }

      setLoading(submit, true);
      try {
        const formData = new FormData();
        formData.append("full-name", nombre);
        formData.append("cedula", cedula);
        formData.append("email", correo);
        formData.append("genero", genero);
        formData.append("password", userPassword);
        formData.append("password-confirm", passwordConfirm);

        const response = await fetch("validar_registro.php", { method: "POST", body: formData });
        const data = await response.json();
        if (!data.ok) {
          showMessage(message, data.message || "Error al registrarse.", "error");
          setLoading(submit, false);
          return;
        }

        showMessage(message, "Solicitud enviada. Redirigiendo al inicio de sesión…", "success");
        setTimeout(() => { window.location.href = "login.html"; }, 2000);
      } catch (error) {
        showMessage(message, "Error de conexión con el servidor.", "error");
        console.error(error);
        setLoading(submit, false);
      }
    });
  }
})();
