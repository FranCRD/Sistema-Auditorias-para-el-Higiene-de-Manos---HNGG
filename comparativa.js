(() => {
  const $ = (id) => document.getElementById(id);
  const momentLabels = {
    1: "Antes del contacto con el paciente",
    2: "Antes de tarea limpia/aséptica",
    3: "Después del riesgo de exposición a fluidos",
    4: "Después del contacto con el paciente",
    5: "Después del contacto con el entorno"
  };
  const areas = ["I Este", "II Este", "I Oeste", "II Oeste", "UCI"];
  let periods = [];
  let current = null;
  let requestId = 0;

  const getLocalISODate = (date) => {
    const adjusted = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return adjusted.toISOString().slice(0, 10);
  };
  const parseDate = (value) => {
    const [year, month, day] = value.split("-").map(Number);
    return new Date(year, month - 1, day, 12);
  };
  const formatDate = (value) => parseDate(value).toLocaleDateString("es-CR", {
    day: "numeric",
    month: "short",
    year: "numeric"
  });
  const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character]);
  const formatPercent = (value) => value == null ? "Sin datos" : `${Number(value).toFixed(1)}%`;
  const formatCount = (value) => Number(value || 0).toLocaleString("es-CR");
  const compliance = (row) => row && row.oportunidades
    ? 100 * row.cumplidas / row.oportunidades
    : null;
  const difference = (value, baseline) => value == null || baseline == null
    ? null
    : value - baseline;
  const relativeChange = (value, baseline) => value == null || baseline == null || baseline === 0
    ? null
    : 100 * (value - baseline) / Math.abs(baseline);

  function setMessage(message, type = "info") {
    const node = $("comparison-message");
    node.textContent = message;
    node.className = `notice notice--${type}`;
    node.hidden = !message;
  }

  function setValidationError(message, invalidIds = []) {
    const hint = $("validation-hint");
    hint.textContent = message;
    hint.hidden = !message;
    hint.className = `field__hint${message ? " is-error" : ""}`;
    ["period-a-from", "period-a-to", "period-b-from", "period-b-to"].forEach((id) => {
      $(id).closest(".field").classList.toggle("is-invalid", invalidIds.includes(id));
    });
  }

  function setExportEnabled(enabled) {
    $("export-excel").disabled = !enabled;
    $("export-pdf").disabled = !enabled;
  }

  function selectedPeriods() {
    const dateIds = ["period-a-from", "period-a-to", "period-b-from", "period-b-to"];
    const [aFrom, aTo, bFrom, bTo] = dateIds.map((id) => $(id).value);
    const today = getLocalISODate(new Date());
    if (!aFrom || !aTo || !bFrom || !bTo || aFrom > aTo || bFrom > bTo || aTo > today || bTo > today) return null;
    return [
      { from: aFrom, to: aTo, label: "Período Base" },
      { from: bFrom, to: bTo, label: "Período a Comparar" }
    ];
  }

  function updatePeriodHint() {
    const nextPeriods = selectedPeriods();
    if (!nextPeriods) {
      $("comparison-explainer-text").textContent = "Selecciona un área y los dos períodos de fechas.";
      return;
    }
    periods = nextPeriods;
    $("comparison-explainer-text").textContent =
      `Comparando: ${formatDate(periods[0].from)} al ${formatDate(periods[0].to)} VS ` +
      `${formatDate(periods[1].from)} al ${formatDate(periods[1].to)}.`;
  }

  function renderTable(headId, bodyId, entries, dimension) {
    const [baseline, selected] = current;
    $(headId).innerHTML = `
      <tr>
        <th>Indicador</th>
        <th>${escapeHtml(baseline.label)}</th>
        <th>${escapeHtml(selected.label)}</th>
        <th>Cambio</th>
      </tr>`;

    if (!entries.length) {
      $(bodyId).innerHTML = '<tr><td colspan="4" class="muted">Sin observaciones para este desglose.</td></tr>';
      return;
    }

    $(bodyId).innerHTML = entries.map(({ key, label }) => {
      const beforeRow = baseline[dimension]?.[key];
      const afterRow = selected[dimension]?.[key];
      const before = compliance(beforeRow);
      const after = compliance(afterRow);
      const change = difference(after, before);
      const relative = relativeChange(after, before);
      const changeClass = change == null ? "muted" : change >= 0 ? "positive" : "negative";
      const changeLabel = change == null
        ? "—"
        : `${change > 0 ? "+" : ""}${change.toFixed(1)} pp` +
          (relative == null ? "" : ` (${relative > 0 ? "+" : ""}${relative.toFixed(1)}%)`);

      return `<tr>
        <th scope="row">${escapeHtml(label)}</th>
        <td>${formatPercent(before)}<span class="table-count">${formatCount(beforeRow?.cumplidas)} de ${formatCount(beforeRow?.oportunidades)} oportunidades</span></td>
        <td>${formatPercent(after)}<span class="table-count">${formatCount(afterRow?.cumplidas)} de ${formatCount(afterRow?.oportunidades)} oportunidades</span></td>
        <td class="${changeClass}">${changeLabel}</td>
      </tr>`;
    }).join("");
  }

  function renderKpis() {
    const [baseline, selected] = current;
    const periodCard = (period, index) => {
      const progress = period.cumplimiento == null ? 0 : Math.max(0, Math.min(100, period.cumplimiento));
      const label = index === 0 ? "PERÍODO BASE" : "PERÍODO COMPARADO";
      return `<article class="kpi-card ${index === 0 ? "kpi-card--base" : "kpi-card--selected"}">
        <div class="kpi-top">
          <span class="kpi-label">${escapeHtml(period.label)}</span>
          <span class="kpi-tag">${label}</span>
        </div>
        <span class="kpi-range">${formatDate(period.from)} — ${formatDate(period.to)}</span>
        <strong class="kpi-value">${formatPercent(period.cumplimiento)}</strong>
        <span class="kpi-caption">Cumplimiento global</span>
        <div class="progress-track" aria-hidden="true"><span style="width:${progress}%"></span></div>
        <div class="kpi-bottom">
          <span>${formatCount(period.cumplidas)} de ${formatCount(period.oportunidades)}<small> oportunidades cumplidas</small><small>${formatCount(period.sesiones)} sesiones · ${formatCount(period.evaluaciones)} evaluaciones</small></span>
        </div>
      </article>`;
    };

    const delta = difference(selected.cumplimiento, baseline.cumplimiento);
    const relative = relativeChange(selected.cumplimiento, baseline.cumplimiento);
    const tone = delta == null ? "neutral" : delta > 0 ? "positive" : delta < 0 ? "negative" : "neutral";
    const arrow = delta == null ? "—" : delta > 0 ? "▲" : delta < 0 ? "▼" : "＝";
    const deltaText = delta == null ? "Sin base" : `${delta > 0 ? "+" : ""}${delta.toFixed(1)}`;
    const deltaUnit = delta == null ? "Cambio no calculable" : "pp (puntos porcentuales)";
    const relativeText = relative == null
      ? "Variación relativa no disponible"
      : `${relative > 0 ? "+" : ""}${relative.toFixed(1)}% de variación relativa`;
    const deltaCard = `<article class="kpi-card kpi-card--delta ${tone}">
      <span class="kpi-label">Cambio en el cumplimiento</span>
      <div class="kpi-delta"><span class="kpi-delta__arrow" aria-hidden="true">${arrow}</span><strong class="kpi-delta__value">${deltaText}</strong></div>
      <span class="kpi-delta__unit">${deltaUnit}</span>
      <span class="kpi-delta__relative">${relativeText}</span>
      <span class="kpi-delta__caption">Período a comparar frente al período base</span>
    </article>`;
    $("kpi-grid").innerHTML = [periodCard(baseline, 0), periodCard(selected, 1), deltaCard].join("");
  }

  function renderChart() {
    const values = current.map((period) => period.cumplimiento);
    $("chart-legend").innerHTML = `
      <span><i class="legend-dot"></i>Período A</span>
      <span><i class="legend-dot legend-dot--selected"></i>Período B</span>
      <span><i class="legend-line"></i>Meta 80%</span>`;
    $("trend-chart").innerHTML = `
      <div class="chart-y"><span>100%</span><span>80%</span><span>60%</span><span>40%</span><span>20%</span><span>0%</span></div>
      <div class="chart-plot">
        <div class="goal-line"><span>Meta 80%</span></div>
        <div class="bars">${current.map((period, index) => {
          const value = values[index];
          const height = value == null ? 0 : Math.max(0, Math.min(100, value));
          return `<div class="bar-column">
            <span class="bar-value" style="--value:${height}%">${formatPercent(value)}</span>
            <div class="bar ${index === 1 ? "bar--selected" : ""}" style="height:${height}%"></div>
            <span class="bar-label">${escapeHtml(period.label)}</span>
          </div>`;
        }).join("")}</div>
      </div>`;
  }

  function dimensionEntries(dimension, order) {
    const keys = new Set(current.flatMap((period) => Object.keys(period[dimension] || {})));
    return [...keys]
      .sort((left, right) => {
        const leftIndex = order.indexOf(left);
        const rightIndex = order.indexOf(right);
        return (leftIndex < 0 ? order.length : leftIndex) - (rightIndex < 0 ? order.length : rightIndex);
      })
      .map((key) => ({ key, label: key }));
  }

  function renderFindings() {
    const [baseline, selected] = current;
    const findings = [];
    const add = (parts, tone = "neutral") => findings.push({ parts, tone });
    const globalDelta = difference(selected.cumplimiento, baseline.cumplimiento);

    if (globalDelta == null) {
      const missing = [
        ...(baseline.oportunidades ? [] : ["A"]),
        ...(selected.oportunidades ? [] : ["B"])
      ];
      add(["No se puede comparar el cumplimiento global: faltan oportunidades respondidas en el período ", { strong: missing.join(" y ") }, "."]);
    } else if (Math.abs(globalDelta) < 0.5) {
      add(["El cumplimiento global se mantuvo estable en torno a ", { strong: `${selected.cumplimiento.toFixed(1)}%` }, "."]);
    } else {
      const improved = globalDelta > 0;
      add([
        "El cumplimiento global ",
        { strong: improved ? "mejoró" : "empeoró" },
        ` ${Math.abs(globalDelta).toFixed(1)} puntos porcentuales (${baseline.cumplimiento.toFixed(1)}% → ${selected.cumplimiento.toFixed(1)}%).`
      ], improved ? "positive" : "negative");
    }

    const momentResults = Object.entries(selected.momentos || {})
      .map(([key, row]) => ({ key: Number(key), row, value: compliance(row) }))
      .filter((item) => item.value != null && item.row.oportunidades >= 1)
      .sort((left, right) => right.value - left.value);
    const bestMoment = momentResults[0];
    const worstMoment = momentResults[momentResults.length - 1];
    if (bestMoment) {
      const label = momentLabels[bestMoment.key] || "Momento OMS";
      add(["El momento con mejor desempeño fue M", { strong: String(bestMoment.key) }, ` (${label}) con ${bestMoment.value.toFixed(1)}%.`], "positive");
    }
    if (worstMoment && (!bestMoment || worstMoment.key !== bestMoment.key)) {
      const belowGoal = worstMoment.value < 80;
      const label = momentLabels[worstMoment.key] || "Momento OMS";
      add([
        "El punto de mejora es M", { strong: String(worstMoment.key) },
        ` (${label}) con ${worstMoment.value.toFixed(1)}%.`,
        ...(belowGoal ? [" Está por debajo de la meta institucional de 80%."] : [])
      ], belowGoal ? "negative" : "neutral");
    } else if (worstMoment && worstMoment.value < 80) {
      add([`El único momento con datos está por debajo de la meta institucional de 80% (${worstMoment.value.toFixed(1)}%).`], "negative");
    }

    if ($("filter-area").value === "") {
      const areasWithBothPeriods = Object.keys(selected.areas || {})
        .map((key) => ({
          key,
          before: compliance(baseline.areas?.[key]),
          after: compliance(selected.areas?.[key])
        }))
        .filter((item) => item.before != null && item.after != null);
      if (areasWithBothPeriods.length >= 2) {
        const mostImproved = areasWithBothPeriods.sort((left, right) =>
          (right.after - right.before) - (left.after - left.before)
        )[0];
        const areaDelta = mostImproved.after - mostImproved.before;
        if (areaDelta > 0) {
          add(["El área ", { strong: mostImproved.key }, ` fue la que más mejoró (+${areaDelta.toFixed(1)} pp).`], "positive");
        }
      }
    }

    const categoriesWithData = Object.entries(selected.categorias || {})
      .map(([key, row]) => ({ key, value: compliance(row) }))
      .filter((item) => item.value != null);
    if (categoriesWithData.length >= 2) {
      const lowest = categoriesWithData.sort((left, right) => left.value - right.value)[0];
      add(["La categoría ", { strong: lowest.key }, ` requiere refuerzo (cumplimiento ${lowest.value.toFixed(1)}%).`], "neutral");
    }

    // En períodos con pocos registros, prioriza contexto verificable sobre rellenar con conclusiones.
    if (findings.length < 3) {
      add([`${baseline.label} tuvo ${formatCount(baseline.sesiones)} sesiones y ${formatCount(baseline.evaluaciones)} evaluaciones.`]);
    }
    if (findings.length < 3) {
      add([`${selected.label} tuvo ${formatCount(selected.sesiones)} sesiones y ${formatCount(selected.evaluaciones)} evaluaciones.`]);
    }

    const list = $("findings-list");
    list.replaceChildren();
    findings.slice(0, 5).forEach(({ parts, tone }) => {
      const item = document.createElement("li");
      item.className = `finding--${tone}`;
      parts.forEach((part) => {
        if (typeof part === "string") item.append(document.createTextNode(part));
        else {
          const strong = document.createElement("strong");
          strong.textContent = part.strong;
          item.append(strong);
        }
      });
      list.append(item);
    });
    $("findings").hidden = findings.length === 0;
  }

  function renderResults() {
    const [baseline, selected] = current;
    const area = $("filter-area").value || "Todas las áreas";
    $("filter-summary").textContent = `${area} · A: ${formatDate(baseline.from)} – ${formatDate(baseline.to)} · B: ${formatDate(selected.from)} – ${formatDate(selected.to)}`;
    $("results").hidden = false;
    renderKpis();
    renderChart();

    renderTable("moments-head", "moments-body",
      Object.entries(momentLabels).map(([key, label]) => ({ key, label: `M${key} · ${label}` })),
      "momentos");
    renderTable("area-head", "area-body", dimensionEntries("areas", areas), "areas");
    renderTable("category-head", "category-body",
      dimensionEntries("categorias", ["Medicina", "Enfermería", "Otros"]), "categorias");
    renderFindings();

    const missingA = !baseline.oportunidades;
    const missingB = !selected.oportunidades;
    const dataNote = $("data-note");
    dataNote.className = `data-note${missingA && missingB ? " data-note--warning" : ""}`;
    const explainMissing = (period) => {
      if (!period.sesiones) return `En ${period.label} no hay sesiones registradas para el área y las fechas elegidas.`;
      return `En ${period.label} hay ${formatCount(period.sesiones)} sesiones y ${formatCount(period.evaluaciones)} evaluaciones, pero ninguna oportunidad respondida para calcular cumplimiento.`;
    };
    dataNote.textContent = [
      ...(missingA ? [explainMissing(baseline)] : []),
      ...(missingB ? [explainMissing(selected)] : [])
    ].join(' ');
    dataNote.hidden = !dataNote.textContent;
    setMessage("");
  }

  async function load() {
    const id = ++requestId;
    current = null;
    periods = [];
    $("results").hidden = true;
    $("findings").hidden = true;
    setExportEnabled(false);
    setMessage("");
    setValidationError("");
    updatePeriodHint();
    periods = selectedPeriods();
    if (!periods) {
      const today = getLocalISODate(new Date());
      const pairs = [
        ["period-a-from", "period-a-to"],
        ["period-b-from", "period-b-to"]
      ];
      const invalidIds = pairs.flatMap(([fromId, toId]) => {
        const from = $(fromId).value;
        const to = $(toId).value;
        if (!from || !to) return [fromId, toId].filter((fieldId) => !$(fieldId).value);
        if (from > to) return [fromId, toId];
        if (to > today) return [toId];
        return [];
      });
      const hasFutureDate = pairs.some(([, toId]) => $(toId).value > today);
      setValidationError(
        hasFutureDate ? "Las fechas no pueden ser posteriores a hoy." : "Completa todas las fechas correctamente.",
        invalidIds
      );
      const firstInvalid = invalidIds[0];
      if (firstInvalid) $(firstInvalid).focus();
      return;
    }

    setMessage("Calculando la comparación…");

    try {
      const response = await fetch("comparativa_datos.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ periods, area: $("filter-area").value })
      });
      const data = await response.json();
      if (id !== requestId) return;
      if (response.status === 401) {
        sessionStorage.removeItem("hm_user");
        window.location.replace("login.html");
        return;
      }
      if (response.status === 403) {
        window.location.replace("index.html");
        return;
      }
      if (!response.ok || !data.ok) throw new Error(data.message || "No se pudo calcular la comparación.");

      current = data.periods;
      renderResults();
      setExportEnabled(true);
    } catch (error) {
      if (id === requestId) setMessage(error.message || "No se pudo calcular la comparación.", "error");
    }
  }

  async function exportExcel() {
    if (!current) return;
    if (!window.ExcelJS) {
      setMessage("No se pudo cargar el exportador de Excel. Recarga la página e inténtalo de nuevo.", "error");
      return;
    }

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Comité de IAAS HNGG";
    workbook.created = new Date();
    const sheet = workbook.addWorksheet("Comparativa", { views: [{ state: "frozen", ySplit: 4 }] });
    const headers = ["Indicador", ...current.map((period) => period.label), "Cambio (pp)", "Variación relativa (%)"];
    sheet.addRow(["Comparativa de reportes — Higiene de manos"]);
    sheet.mergeCells(1, 1, 1, headers.length);
    sheet.addRow(["Área", $("filter-area").value || "Todas las áreas"]);
    sheet.addRow([`Períodos: ${current.map((period) => `${period.label} (${period.from} a ${period.to})`).join(" · ")}`]);
    sheet.mergeCells(3, 1, 3, headers.length);
    sheet.addRow(headers);

    const percentRows = [];
    const addRow = (label, before, after) => {
      const change = difference(after, before);
      const relative = relativeChange(after, before);
      const row = sheet.addRow([label, before, after, change, relative]);
      percentRows.push(row.number);
    };
    addRow("Cumplimiento global", current[0].cumplimiento, current[1].cumplimiento);
    const addSection = (title, dimension, entries) => {
      const section = sheet.addRow([]);
      sheet.mergeCells(section.number, 1, section.number, headers.length);
      section.getCell(1).value = title;
      section.font = { bold: true, color: { argb: "FF075985" } };
      section.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEAF4F7" } };
      entries.forEach(({ key, label }) => {
        addRow(label, compliance(current[0][dimension]?.[key]), compliance(current[1][dimension]?.[key]));
      });
    };
    addSection("Momentos OMS", "momentos",
      Object.entries(momentLabels).map(([key, label]) => ({ key, label: `M${key} · ${label}` })));
    addSection("Departamentos", "areas", dimensionEntries("areas", areas));
    addSection("Categorías profesionales", "categorias",
      dimensionEntries("categorias", ["Medicina", "Enfermería", "Otros"]));
    sheet.addRow(["Oportunidades respondidas", current[0].oportunidades, current[1].oportunidades]);
    sheet.addRow(["Sesiones registradas", current[0].sesiones, current[1].sesiones]);
    sheet.addRow(["Evaluaciones registradas", current[0].evaluaciones, current[1].evaluaciones]);
    sheet.columns = [{ width: 43 }, { width: 24 }, { width: 24 }, { width: 20 }, { width: 24 }];
    sheet.getRow(1).height = 28;
    sheet.getRow(1).font = { bold: true, size: 16, color: { argb: "FFFFFFFF" } };
    sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF075985" } };
    sheet.getRow(4).font = { bold: true, color: { argb: "FFFFFFFF" } };
    sheet.getRow(4).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0879A4" } };
    sheet.eachRow((row) => row.eachCell((cell) => {
      cell.alignment = { vertical: "middle", wrapText: true };
    }));
    percentRows.forEach((rowNumber) => {
      sheet.getRow(rowNumber).eachCell((cell, column) => {
        if (typeof cell.value === "number") cell.numFmt = column <= 3 ? '0.0"%"' : "0.0";
      });
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const url = URL.createObjectURL(new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "comparativa-higiene-manos.xlsx";
    link.click();
    URL.revokeObjectURL(url);
  }

  function setDefaultDates() {
    const today = new Date();
    const todayValue = getLocalISODate(today);
    const currentMonthStart = new Date(today.getFullYear(), today.getMonth(), 1, 12);
    const periodBEnd = new Date(currentMonthStart);
    periodBEnd.setDate(0);
    const periodBStart = new Date(periodBEnd.getFullYear(), periodBEnd.getMonth(), 1, 12);
    const periodAEnd = new Date(periodBStart);
    periodAEnd.setDate(0);
    const periodAStart = new Date(periodAEnd.getFullYear(), periodAEnd.getMonth(), 1, 12);

    $("period-a-from").value = getLocalISODate(periodAStart);
    $("period-a-to").value = getLocalISODate(periodAEnd);
    $("period-b-from").value = getLocalISODate(periodBStart);
    $("period-b-to").value = getLocalISODate(periodBEnd);
    ["period-a-from", "period-a-to", "period-b-from", "period-b-to"].forEach((id) => {
      $(id).max = todayValue;
    });
  }

  async function init() {
    try {
      const response = await fetch("sesion_actual.php", { cache: "no-store" });
      if (response.status === 401) {
        window.location.replace("login.html");
        return;
      }
      const session = await response.json();
      if (!response.ok || !session.ok || Number(session.usuario.Rol) !== 1) {
        window.location.replace("index.html");
        return;
      }

      $("comparison-content").hidden = false;
      const savedUser = JSON.parse(sessionStorage.getItem("hm_user") || "{}");
      $("user-name").textContent = [savedUser.Nombre, savedUser.Apellidos].filter(Boolean).join(" ") || "Usuario";
      $("admin-link").hidden = false;

      setDefaultDates();
      updatePeriodHint();
      ["period-a-from", "period-a-to", "period-b-from", "period-b-to"].forEach((id) => {
        $(id).addEventListener("change", load);
      });
      $("filter-area").addEventListener("change", load);
      $("export-excel").addEventListener("click", exportExcel);
      $("export-pdf").addEventListener("click", () => window.print());
      $("logout-btn").addEventListener("click", async () => {
        if (await window.confirmarAccion({
          titulo: "¿Cerrar sesión?",
          mensaje: "Se cerrará tu sesión actual.",
          confirmar: "Cerrar sesión"
        })) {
          sessionStorage.removeItem("hm_user");
          window.location.href = "cerrar_sesion.php";
        }
      });
      await load();
    } catch (error) {
      $("access-error").textContent = error.message || "No se pudo cargar la comparativa.";
      $("access-error").hidden = false;
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
