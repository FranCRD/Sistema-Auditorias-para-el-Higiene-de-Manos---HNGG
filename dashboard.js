/* =========================================================
   1. ETIQUETAS DE LOS MOMENTOS
   ========================================================= */
const MOMENTS_LABELS = {
  1: { short: "M1", name: "Antes del contacto" },
  2: { short: "M2", name: "Antes de tarea aséptica" },
  3: { short: "M3", name: "Post-fluidos" },
  4: { short: "M4", name: "Post-paciente" },
  5: { short: "M5", name: "Post-entorno" }
};

const TAB_A_CATEGORIA = {
  doctors: "Medicina",
  nurses:  "Enfermería",
  techs:   "Otros"
};

/* =========================================================
   2. DATOS GLOBALES
   ========================================================= */
let DATOS = null;
let TAB_ACTIVA = "doctors";
let TABS_CONFIGURADOS = false;
let DASHBOARD_REQUEST_ID = 0;

/* =========================================================
   3. UTILIDADES
   ========================================================= */
function rowTotal(row) {
  return (row?.lavado || 0) + (row?.alcohol || 0) + (row?.noRealiza || 0);
}

function columnTotals(data) {
  const totals = { lavado: 0, alcohol: 0, noRealiza: 0 };
  for (let m = 1; m <= 5; m++) {
    const row = data[m] || { lavado: 0, alcohol: 0, noRealiza: 0 };
    totals.lavado    += row.lavado;
    totals.alcohol   += row.alcohol;
    totals.noRealiza += row.noRealiza;
  }
  totals.total = totals.lavado + totals.alcohol + totals.noRealiza;
  return totals;
}

function pct(value, total) {
  if (!total) return "0%";
  return `${((value / total) * 100).toFixed(0)}%`;
}

/* =========================================================
   4. RENDER DE KPIs
   ========================================================= */
function renderKPIs() {
  const { kpis } = DATOS;

  const kpi1 = document.querySelector(".kpi--success");
  if (kpi1) {
    const numero = kpi1.querySelector(".kpi__number");
    const hint   = kpi1.querySelector(".kpi__hint");
    const bar    = kpi1.querySelector(".kpi__bar-fill");
    if (numero) numero.textContent = kpis.cumplimiento.toFixed(1);
    if (hint)   hint.textContent = `${kpis.cumplidas} de ${kpis.totalAcciones} acciones`;
    if (bar)    bar.style.width = `${kpis.cumplimiento}%`;
  }

  const kpi2 = document.querySelector(".kpi--error");
  if (kpi2) {
    const numero = kpi2.querySelector(".kpi__number");
    const hint   = kpi2.querySelector(".kpi__hint");
    const bar    = kpi2.querySelector(".kpi__bar-fill");
    if (numero) numero.textContent = kpis.noRealizado.toFixed(1);
    if (hint)   hint.textContent = `${kpis.omitidas} oportunidades omitidas`;
    if (bar)    bar.style.width = `${kpis.noRealizado}%`;
  }

  const kpi3 = document.querySelector(".kpi--warning");
  if (kpi3) {
    const numero = kpi3.querySelector(".kpi__number");
    const hints  = kpi3.querySelectorAll(".kpi__hint");
    if (kpis.momentoCritico.id) {
      const label = MOMENTS_LABELS[kpis.momentoCritico.id];
      if (numero) numero.textContent = label ? label.short : `M${kpis.momentoCritico.id}`;
      if (hints[0]) hints[0].textContent = `${label ? label.name : ""} · ${kpis.momentoCritico.casos} casos`;
    } else {
      if (numero) numero.textContent = "—";
      if (hints[0]) hints[0].textContent = "Sin datos suficientes";
    }
  }
}

/* =========================================================
   5. RENDER DEL GRÁFICO DE MOMENTOS
   ========================================================= */
function renderChart() {
  const container = document.getElementById("chart-moments");
  if (!container) return;

  const porMomento = DATOS.porMomento;

  let max = 0;
  for (let m = 1; m <= 5; m++) {
    const row = porMomento[m] || { lavado: 0, alcohol: 0, noRealiza: 0 };
    max = Math.max(max, row.lavado, row.alcohol, row.noRealiza);
  }
  max = max || 1;

  const groupsHTML = [1, 2, 3, 4, 5]
    .map((m) => {
      const row   = porMomento[m] || { lavado: 0, alcohol: 0, noRealiza: 0 };
      const hWash    = (row.lavado    / max) * 100;
      const hAlcohol = (row.alcohol   / max) * 100;
      const hMiss    = (row.noRealiza / max) * 100;
      const label    = MOMENTS_LABELS[m];

      const bar = (value, height, type) => `
        <div class="chart__bar chart__bar--${type}" style="height: ${height}%">
          ${value ? `<span class="chart__bar-value">${value}</span>` : ""}
        </div>
      `;

      return `
        <div class="chart__group">
          <div class="chart__bars">
            ${bar(row.lavado,    hWash,    "wash")}
            ${bar(row.alcohol,   hAlcohol, "alcohol")}
            ${bar(row.noRealiza, hMiss,    "miss")}
          </div>
          <div class="chart__label">
            ${label.short}
            <span>${label.name}</span>
          </div>
        </div>
      `;
    })
    .join("");

  container.innerHTML = groupsHTML;
}

/* =========================================================
   6. TABLA CONSOLIDADA
   ========================================================= */
function renderMomentsTable() {
  const tbody = document.getElementById("table-moments");
  const tfoot = document.getElementById("table-moments-footer");
  const chip  = document.getElementById("table-total-chip");
  if (!tbody || !tfoot) return;

  const porMomento = DATOS.porMomento;

  tbody.innerHTML = [1, 2, 3, 4, 5]
    .map((m) => {
      const row = porMomento[m] || { lavado: 0, alcohol: 0, noRealiza: 0 };
      const label = MOMENTS_LABELS[m];
      return `
        <tr>
          <td>
            <span class="momento-badge">
              <span class="momento-badge__num">${m}</span>
              ${label.name}
            </span>
          </td>
          <td class="table__num table__num--wash" data-label="Lavado">${row.lavado}</td>
          <td class="table__num table__num--alcohol" data-label="Alcohol">${row.alcohol}</td>
          <td class="table__num table__num--miss" data-label="No realizado">${row.noRealiza}</td>
          <td class="table__num table__num--total" data-label="Total">${rowTotal(row)}</td>
        </tr>
      `;
    })
    .join("");

  const t = columnTotals(porMomento);
  tfoot.innerHTML = `
    <tr>
      <td>Total</td>
      <td class="table__num table__num--wash" data-label="Lavado">${t.lavado}</td>
      <td class="table__num table__num--alcohol" data-label="Alcohol">${t.alcohol}</td>
      <td class="table__num table__num--miss" data-label="No realizado">${t.noRealiza}</td>
      <td class="table__num table__num--total" data-label="Total">${t.total}</td>
    </tr>
    <tr>
      <td>Porcentaje</td>
      <td class="table__num" data-label="Lavado">${pct(t.lavado, t.total)}</td>
      <td class="table__num" data-label="Alcohol">${pct(t.alcohol, t.total)}</td>
      <td class="table__num" data-label="No realizado">${pct(t.noRealiza, t.total)}</td>
      <td class="table__num" data-label="Total">${t.total ? "100%" : "0%"}</td>
    </tr>
  `;

  if (chip) chip.textContent = `Total: ${t.total} obs.`;
}

/* =========================================================
   7. SELECTOR DE SUBCATEGORÍA
   ========================================================= */
function poblarSubcategorias(tabKey) {
  const select = document.getElementById("subcat-select");
  if (!select) return;

  const categoria = TAB_A_CATEGORIA[tabKey] || "Medicina";
  const catData   = DATOS.porCategoria[categoria];
  const subcats   = DATOS.catalogoSubcats[categoria] || [];

  let html = `<option value="__all__">Todas las subcategorías</option>`;

  subcats.forEach((sub) => {
    const dataSub = catData?.subcategorias?.[sub]?.consolidado || {};
    const total = columnTotals(dataSub).total;
    html += `<option value="${sub}">${sub} (${total})</option>`;
  });

  const dataSin = catData?.subcategorias?.["__sin__"]?.consolidado || {};
  const totalSin = columnTotals(dataSin).total;
  html += `<option value="__sin__">(Sin especificar) (${totalSin})</option>`;

  select.innerHTML = html;
  select.value = "__all__";
}

/* =========================================================
   8. TABLA POR CATEGORÍA (con filtro de subcategoría)
   ========================================================= */
function renderCategoryTable(tabKey, subcatValue = "__all__") {
  const tbody = document.getElementById("table-category");
  const tfoot = document.getElementById("table-category-footer");
  if (!tbody || !tfoot) return;

  const categoria = TAB_A_CATEGORIA[tabKey] || "Medicina";
  const catData   = DATOS.porCategoria[categoria];

  let data = {};
  if (subcatValue === "__all__") {
    data = catData?.consolidado || {};
  } else {
    data = catData?.subcategorias?.[subcatValue]?.consolidado || {};
  }

  tbody.innerHTML = [1, 2, 3, 4, 5]
    .map((m) => {
      const row = data[m] || { lavado: 0, alcohol: 0, noRealiza: 0 };
      const label = MOMENTS_LABELS[m];
      return `
        <tr>
          <td>
            <span class="momento-badge">
              <span class="momento-badge__num">${m}</span>
              ${label.name}
            </span>
          </td>
          <td class="table__num table__num--wash" data-label="Lavado">${row.lavado}</td>
          <td class="table__num table__num--alcohol" data-label="Alcohol">${row.alcohol}</td>
          <td class="table__num table__num--miss" data-label="No realizado">${row.noRealiza}</td>
          <td class="table__num table__num--total" data-label="Total">${rowTotal(row)}</td>
        </tr>
      `;
    })
    .join("");

  const t = columnTotals(data);
  tfoot.innerHTML = `
    <tr>
      <td>Total</td>
      <td class="table__num table__num--wash" data-label="Lavado">${t.lavado}</td>
      <td class="table__num table__num--alcohol" data-label="Alcohol">${t.alcohol}</td>
      <td class="table__num table__num--miss" data-label="No realizado">${t.noRealiza}</td>
      <td class="table__num table__num--total" data-label="Total">${t.total}</td>
    </tr>
  `;
}

function renderCategoryPrintTables() {
  const container = document.getElementById("print-category-tables");
  if (!container) return;

  container.innerHTML = Object.entries(DATOS.porCategoria || {}).map(([category, categoryData]) => {
    const data = categoryData?.consolidado || {};
    const rows = [1, 2, 3, 4, 5].map((moment) => {
      const row = data[moment] || { lavado: 0, alcohol: 0, noRealiza: 0 };
      return `
        <tr>
          <td>${moment}. ${MOMENTS_LABELS[moment].name}</td>
          <td class="table__num table__num--wash">${row.lavado}</td>
          <td class="table__num table__num--alcohol">${row.alcohol}</td>
          <td class="table__num table__num--miss">${row.noRealiza}</td>
          <td class="table__num table__num--total">${rowTotal(row)}</td>
        </tr>
      `;
    }).join("");
    const totals = columnTotals(data);

    return `
      <section class="print-category-table">
        <h3 class="print-category-table__title">${category}</h3>
        <div class="table-wrap">
          <table class="table">
            <thead>
              <tr>
                <th>Momento</th>
                <th class="ta-c">Lavado</th>
                <th class="ta-c">Solución de alcohol</th>
                <th class="ta-c">No lo realiza</th>
                <th class="ta-c">Total</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
            <tfoot>
              <tr>
                <td>Total</td>
                <td class="table__num table__num--wash">${totals.lavado}</td>
                <td class="table__num table__num--alcohol">${totals.alcohol}</td>
                <td class="table__num table__num--miss">${totals.noRealiza}</td>
                <td class="table__num table__num--total">${totals.total}</td>
              </tr>
              <tr>
                <td>Porcentaje</td>
                <td class="table__num">${pct(totals.lavado, totals.total)}</td>
                <td class="table__num">${pct(totals.alcohol, totals.total)}</td>
                <td class="table__num">${pct(totals.noRealiza, totals.total)}</td>
                <td class="table__num">${totals.total ? "100%" : "0%"}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>
    `;
  }).join("");
}

/* =========================================================
   9. TABS + SUBCATEGORÍAS
   ========================================================= */
function setupTabs() {
  if (TABS_CONFIGURADOS) return;
  TABS_CONFIGURADOS = true;
  const tabs = document.querySelectorAll(".tab[data-tab]");
  const select = document.getElementById("subcat-select");

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      tabs.forEach((t) => t.classList.remove("is-active"));
      tab.classList.add("is-active");

      TAB_ACTIVA = tab.dataset.tab;
      poblarSubcategorias(TAB_ACTIVA);
      renderCategoryTable(TAB_ACTIVA, "__all__");
    });
  });

  if (select) {
    select.addEventListener("change", () => {
      renderCategoryTable(TAB_ACTIVA, select.value);
    });
  }
}

/* =========================================================
   10. EXPORTAR PDF
   ========================================================= */
function setupExportPDF() {
  const btn = document.getElementById("export-pdf");
  if (!btn) return;
  btn.addEventListener("click", () => window.print());
}

/* =========================================================
   10.1 EXPORTAR EXCEL — Formato IAAS HNGG con ExcelJS
   ========================================================= */
function setupExportExcel() {
  const btn = document.getElementById("export-excel");
  if (!btn) return;

  btn.addEventListener("click", async () => {
    if (!DATOS) {
      alert("Aún no hay datos cargados. Espere un momento e intente de nuevo.");
      return;
    }

    if (typeof ExcelJS === "undefined") {
      alert("No se pudo cargar la librería de Excel. Recargue la página e intente de nuevo.");
      return;
    }

    try {
      const workbook = await crearLibroExportacionExcel();

      // Descargar
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      });
      const fecha = new Date().toISOString().split("T")[0];
      const areaNombre = DATOS.filtros?.area
        ? DATOS.filtros.area.replace(/\s+/g, "_")
        : "Todas_las_areas";
      const desde = DATOS.filtros?.desde || "inicio";
      const hasta = DATOS.filtros?.hasta || "actualidad";
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Evaluacion_Higiene_Manos_${areaNombre}_${desde}_${hasta}_${fecha}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);

    } catch (err) {
      console.error("Error al exportar Excel:", err);
      alert("Error al generar el archivo Excel: " + err.message);
    }
  });
}

async function crearLibroExportacionExcel() {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Sistema de Auditoría de Higiene de Manos - HNGG";
  workbook.created = new Date();
  const areas = DATOS.filtros?.area ? [DATOS.filtros.area] : (DATOS.areas || []);
  const periodo = etiquetaPeriodo(DATOS.filtros || {});

  for (const area of areas) {
    const worksheet = crearHojaExcel(workbook, area.substring(0, 31));
    construirHojaArea(worksheet, area);
    await insertarGraficaProfesionalEnHoja(workbook, worksheet, area, periodo);
  }

  const conglomerado = consolidarAreasParaExcel(areas);
  const hojaConglomerado = crearHojaExcel(workbook, "Conglomerado");
  construirHojaArea(hojaConglomerado, "Conglomerado", conglomerado);
  await insertarGraficaProfesionalEnHoja(workbook, hojaConglomerado, "Conglomerado", periodo, conglomerado, {
    profesionalesEvaluados: conglomerado.profesionalesEvaluados,
    momentosRespondidos: conglomerado.momentosRespondidos
  });
  await insertarGraficasConglomerado(workbook, hojaConglomerado, areas, conglomerado, periodo);
  hojaConglomerado.pageSetup.printArea = "B2:AD102";
  return workbook;
}

function crearHojaExcel(workbook, nombre) {
  const ws = workbook.addWorksheet(nombre, {
    views: [{ showGridLines: false, zoomScale: 60 }],
    pageSetup: {
      paperSize: 9,
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: { left: 0.5, right: 0.5, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 }
    }
  });
  ws.columns = Array.from({ length: 30 }, () => ({ width: 10.9 }));
  [26.1, 22.8, 33.7, 24.7, 30.9].forEach((width, index) => { ws.getColumn(index + 2).width = width; });
  [14.9, 14, 26.6, 17.4, 21.6].forEach((width, index) => { ws.getColumn(index + 8).width = width; });
  ws.getColumn(15).width = 23.1;
  [16, 17, 18, 19, 20].forEach((column) => { ws.getColumn(column).width = 10.9; });
  ws.getColumn(21).width = 10.9;
  ws.getColumn(22).width = 16.1;
  [23, 24, 25, 26, 27, 28].forEach((column) => { ws.getColumn(column).width = 10.9; });
  ws.getColumn(29).width = 13.9;
  ws.getColumn(30).width = 13.5;
  return ws;
}

function consolidarAreasParaExcel(areas) {
  const categorias = ["Medicina", "Enfermería", "Otros"];
  const total = {
    porMomento: {},
    porCategoria: Object.fromEntries(categorias.map((categoria) => [categoria, {}])),
    totalLavado: 0, totalAlcohol: 0, totalNoRealiza: 0,
    profesionalesEvaluados: 0, momentosRespondidos: 0
  };
  for (let momento = 1; momento <= 5; momento++) {
    total.porMomento[momento] = { lavado: 0, alcohol: 0, noRealiza: 0 };
    categorias.forEach((categoria) => {
      total.porCategoria[categoria][momento] = { lavado: 0, alcohol: 0, noRealiza: 0 };
    });
  }
  areas.forEach((area) => {
    const data = DATOS.porArea?.[area];
    if (!data) return;
    ["totalLavado", "totalAlcohol", "totalNoRealiza", "profesionalesEvaluados", "momentosRespondidos"].forEach((key) => {
      total[key] += Number(data[key]) || 0;
    });
    for (let momento = 1; momento <= 5; momento++) {
      ["lavado", "alcohol", "noRealiza"].forEach((accion) => {
        total.porMomento[momento][accion] += Number(data.porMomento?.[momento]?.[accion]) || 0;
        categorias.forEach((categoria) => {
          total.porCategoria[categoria][momento][accion] += Number(data.porCategoria?.[categoria]?.[momento]?.[accion]) || 0;
        });
      });
    }
  });
  return total;
}

function crearSvgGraficaResumen(titulo, etiquetas, series, sufijo = "") {
  const width = 1100, height = 480, x0 = 90, x1 = 1070, y0 = 105, y1 = 385;
  const maxValor = Math.max(1, ...series.flatMap((serie) => serie.valores.map((valor) => Number(valor) || 0)));
  const maxEje = sufijo === "%" ? 100 : Math.ceil(maxValor / 4) * 4 || 1;
  const groupWidth = (x1 - x0) / Math.max(1, etiquetas.length);
  const barWidth = Math.min(34, Math.max(12, groupWidth / (series.length * 1.8)));
  const colors = ["#0369a1", "#d97706", "#dc2626"];
  let bars = "";
  etiquetas.forEach((etiqueta, index) => {
    const center = x0 + groupWidth * (index + 0.5);
    const fullWidth = series.length * barWidth + (series.length - 1) * 6;
    series.forEach((serie, serieIndex) => {
      const value = Number(serie.valores[index]) || 0;
      const barHeight = value / maxEje * (y1 - y0);
      const x = center - fullWidth / 2 + serieIndex * (barWidth + 6);
      const y = y1 - barHeight;
      bars += `<rect x="${x}" y="${y}" width="${barWidth}" height="${barHeight}" rx="3" fill="${colors[serieIndex % colors.length]}"/>`;
      if (value > 0) bars += `<text x="${x + barWidth / 2}" y="${Math.max(y0 - 4, y - 5)}" text-anchor="middle" class="value">${Math.round(value * 10) / 10}${sufijo}</text>`;
    });
    bars += `<text x="${center}" y="410" text-anchor="middle" class="label">${escaparXml(etiqueta)}</text>`;
  });
  const tick = maxEje / 4;
  const grid = [0, 1, 2, 3, 4].map((index) => {
    const value = tick * index, y = y1 - (value / maxEje) * (y1 - y0);
    return `<line x1="${x0}" y1="${y}" x2="${x1}" y2="${y}" class="grid"/><text x="${x0 - 12}" y="${y + 4}" text-anchor="end" class="axis">${Math.round(value * 10) / 10}${sufijo}</text>`;
  }).join("");
  const legend = series.map((serie, index) => {
    const x = x0 + index * 205;
    return `<rect x="${x}" y="61" width="13" height="13" rx="2" fill="${colors[index % colors.length]}"/><text x="${x + 20}" y="72" class="legend">${escaparXml(serie.nombre)}</text>`;
  }).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}"><style>text{font-family:Arial,sans-serif;fill:#243b53}.title{font-size:19px;font-weight:bold}.axis{font-size:12px;fill:#526579}.label{font-size:13px;font-weight:bold}.legend{font-size:13px}.value{font-size:11px;font-weight:bold}.grid{stroke:#dbe5ed;stroke-width:1}</style><rect width="100%" height="100%" fill="#fff"/><text x="${x0}" y="34" class="title">${escaparXml(titulo)}</text>${legend}${grid}${bars}</svg>`;
}

async function insertarGraficasConglomerado(workbook, worksheet, areas, data, periodo) {
  const momentos = [1, 2, 3, 4, 5];
  const acciones = [
    { key: "lavado", nombre: "Lavado" },
    { key: "alcohol", nombre: "Solución alcohólica" },
    { key: "noRealiza", nombre: "No realiza" }
  ];
  const svgMomentos = crearSvgGraficaResumen(
    `Acciones observadas por momento OMS · ${periodo}`,
    momentos.map((momento) => `Momento ${momento}`),
    acciones.map(({ key, nombre }) => ({ nombre, valores: momentos.map((m) => data.porMomento[m][key]) }))
  );
  const areaCumplimiento = areas.map((area) => {
    const resumen = DATOS.porArea?.[area];
    const realizadas = (Number(resumen?.totalLavado) || 0) + (Number(resumen?.totalAlcohol) || 0);
    const total = realizadas + (Number(resumen?.totalNoRealiza) || 0);
    return { area, cumplidas: total ? realizadas / total * 100 : null };
  });
  const svgAreas = crearSvgGraficaResumen(
    `Cumplimiento global por departamento · ${periodo}`,
    areaCumplimiento.map((item) => item.area),
    [
      { nombre: "Cumplimiento", valores: areaCumplimiento.map((item) => item.cumplidas) },
      { nombre: "No realizado", valores: areaCumplimiento.map((item) => item.cumplidas == null ? null : 100 - item.cumplidas) }
    ], "%"
  );
  const areaAcciones = areas.map((area) => {
    const resumen = DATOS.porArea?.[area];
    const total = ["totalLavado", "totalAlcohol", "totalNoRealiza"]
      .reduce((suma, key) => suma + (Number(resumen?.[key]) || 0), 0);
    return {
      area,
      porcentajes: acciones.map(({ key }) => {
        const totalKey = `total${key[0].toUpperCase()}${key.slice(1)}`;
        return total ? (Number(resumen?.[totalKey]) || 0) / total * 100 : null;
      })
    };
  });
  const svgAccionesAreas = crearSvgGraficaResumen(
    `Distribución porcentual de acciones por departamento · ${periodo}`,
    areaAcciones.map((item) => item.area),
    acciones.map(({ nombre }, accionIndex) => ({
      nombre,
      valores: areaAcciones.map((item) => item.porcentajes[accionIndex])
    })), "%"
  );
  const categories = ["Medicina", "Enfermería", "Otros"];
  const categoryRates = categories.map((categoria) => {
    let cumplidas = 0, total = 0;
    momentos.forEach((momento) => {
      const row = data.porCategoria[categoria][momento];
      cumplidas += row.lavado + row.alcohol;
      total += row.lavado + row.alcohol + row.noRealiza;
    });
    return total ? cumplidas / total * 100 : null;
  });
  const svgCategorias = crearSvgGraficaResumen(
    `Cumplimiento por categoría profesional · ${periodo}`,
    categories,
    [
      { nombre: "Cumplimiento", valores: categoryRates },
      { nombre: "No realizado", valores: categoryRates.map((value) => value == null ? null : 100 - value) }
    ], "%"
  );
  const categoryActions = categories.map((categoria) => {
    const conteos = acciones.map(({ key }) => momentos.reduce(
      (suma, momento) => suma + (Number(data.porCategoria[categoria][momento][key]) || 0), 0
    ));
    const total = conteos.reduce((suma, conteo) => suma + conteo, 0);
    return { categoria, porcentajes: conteos.map((conteo) => total ? conteo / total * 100 : null) };
  });
  const svgAccionesCategorias = crearSvgGraficaResumen(
    `Distribución porcentual de acciones por categoría profesional · ${periodo}`,
    categories,
    acciones.map(({ nombre }, accionIndex) => ({
      nombre,
      valores: categoryActions.map((item) => item.porcentajes[accionIndex])
    })), "%"
  );
  const charts = [
    { svg: svgMomentos, col: 1, row: 43 },
    { svg: svgAreas, col: 16, row: 43 },
    { svg: svgAccionesAreas, col: 1, row: 63 },
    { svg: svgCategorias, col: 16, row: 63 },
    { svg: svgAccionesCategorias, col: 8, row: 83 }
  ];
  for (const chart of charts) {
    const image = await svgGraficaAImagen(chart.svg);
    const imageId = workbook.addImage({ base64: image, extension: "png" });
    worksheet.addImage(imageId, {
      tl: { col: chart.col, row: chart.row },
      ext: { width: 860, height: 375 }
    });
  }
}

function datosCategoriasParaGrafica(area) {
  const categorias = ["Medicina", "Enfermería", "Otros"];
  const resultado = Object.fromEntries(categorias.map((categoria) => [
    categoria,
    Object.fromEntries([1, 2, 3, 4, 5].map((momento) => [
      momento,
      { lavado: 0, alcohol: 0, noRealiza: 0 }
    ]))
  ]));

  const areas = area
    ? [DATOS.porArea?.[area]].filter(Boolean)
    : Object.values(DATOS.porArea || {});

  areas.forEach((areaData) => {
    categorias.forEach((categoria) => {
      [1, 2, 3, 4, 5].forEach((momento) => {
        const fila = areaData.porCategoria?.[categoria]?.[momento] || {};
        ["lavado", "alcohol", "noRealiza"].forEach((accion) => {
          resultado[categoria][momento][accion] += Number(fila[accion]) || 0;
        });
      });
    });
  });

  return resultado;
}

function etiquetaPeriodo(filtros) {
  const formatearFecha = (valor) => {
    if (!valor) return "";
    const [year, month, day] = valor.split("-");
    return `${day}/${month}/${year}`;
  };

  if (!filtros.desde && !filtros.hasta) return "Todo el historial";
  if (filtros.desde && filtros.hasta) {
    return `${formatearFecha(filtros.desde)} al ${formatearFecha(filtros.hasta)}`;
  }
  return filtros.desde
    ? `Desde ${formatearFecha(filtros.desde)}`
    : `Hasta ${formatearFecha(filtros.hasta)}`;
}

function escaparXml(texto) {
  return String(texto).replace(/[&<>"']/g, (caracter) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;"
  })[caracter]);
}

function crearSvgGraficaProfesional(porCategoria, area, periodo, metricas = {}) {
  const ancho = 1200;
  const alto = 480;
  const xInicio = 92;
  const xFinal = 1175;
  const yInicio = 105;
  const yFinal = 365;
  const anchoGrafica = xFinal - xInicio;
  const altoGrafica = yFinal - yInicio;
  const categorias = ["Medicina", "Enfermería", "Otros"];
  const acciones = [
    { key: "lavado", clase: "wash" },
    { key: "alcohol", clase: "alcohol" },
    { key: "noRealiza", clase: "miss" }
  ];

  let maxValor = 0;
  categorias.forEach((categoria) => {
    [1, 2, 3, 4, 5].forEach((momento) => {
      acciones.forEach(({ key }) => {
        maxValor = Math.max(maxValor, Number(porCategoria?.[categoria]?.[momento]?.[key]) || 0);
      });
    });
  });
  const paso = Math.max(1, Math.ceil(maxValor / 4));
  const maxEje = paso * 4;
  const grupoAncho = anchoGrafica / categorias.length;
  const pasoMomento = (grupoAncho - 36) / 5;
  const anchoBarra = 10;
  const separacionBarras = 3;

  const lineas = [0, 1, 2, 3, 4].map((indice) => {
    const valor = indice * paso;
    const y = yFinal - (valor / maxEje) * altoGrafica;
    return `
      <line class="professional-chart__grid" x1="${xInicio}" y1="${y}" x2="${xFinal}" y2="${y}"/>
      <text class="professional-chart__tick" x="${xInicio - 12}" y="${y + 4}" text-anchor="end">${valor}</text>`;
  }).join("");

  let grupos = "";
  categorias.forEach((categoria, categoriaIndex) => {
    const grupoInicio = xInicio + categoriaIndex * grupoAncho;
    const grupoCentro = grupoInicio + grupoAncho / 2;
    if (categoriaIndex > 0) {
      grupos += `<line class="professional-chart__separator" x1="${grupoInicio}" y1="${yInicio}" x2="${grupoInicio}" y2="430"/>`;
    }

    [1, 2, 3, 4, 5].forEach((momento) => {
      const centro = grupoInicio + 18 + (momento - 0.5) * pasoMomento;
      const anchoGrupoBarras = acciones.length * anchoBarra
        + (acciones.length - 1) * separacionBarras;
      const xPrimerBarra = centro - anchoGrupoBarras / 2;

      acciones.forEach(({ key, clase }, accionIndex) => {
        const valor = Number(porCategoria?.[categoria]?.[momento]?.[key]) || 0;
        const barraAlto = (valor / maxEje) * altoGrafica;
        const x = xPrimerBarra + accionIndex * (anchoBarra + separacionBarras);
        const y = yFinal - barraAlto;
        grupos += `<rect class="professional-chart__bar--${clase}" x="${x}" y="${y}" width="${anchoBarra}" height="${barraAlto}" rx="1"/>`;
        if (valor > 0) {
          grupos += `<text class="professional-chart__bar-value" x="${x + anchoBarra / 2}" y="${Math.max(yInicio - 4, y - 4)}" text-anchor="middle">${valor}</text>`;
        }
      });

      grupos += `<text class="professional-chart__moment" x="${centro}" y="389" text-anchor="middle">${momento}</text>`;
    });

    grupos += `<text class="professional-chart__category" x="${grupoCentro}" y="420" text-anchor="middle">${escaparXml(categoria)}</text>`;
  });

  const leyenda = [
    { label: "Lavado", clase: "wash" },
    { label: "Solución alcohólica", clase: "alcohol" },
    { label: "No realiza", clase: "miss" }
  ].map(({ label, clase }, index) => {
    const x = 700 + index * 165;
    return `<rect class="professional-chart__bar--${clase}" x="${x}" y="73" width="12" height="12" rx="2"/><text class="professional-chart__legend" x="${x + 18}" y="83">${label}</text>`;
  }).join("");

  const titulo = `Acciones realizadas por categoría profesional — ${area} — ${periodo}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" class="professional-chart" viewBox="0 0 ${ancho} ${alto}" role="img" aria-label="${escaparXml(titulo)}">
    <style>
      .professional-chart__grid{stroke:#dbe3ed;stroke-width:1}
      .professional-chart__axis{stroke:#64748b;stroke-width:1.25}
      .professional-chart__tick,.professional-chart__category,.professional-chart__moment,.professional-chart__legend,.professional-chart__title{fill:#334155;font-family:Arial,sans-serif}
      .professional-chart__tick{font-size:12px}
      .professional-chart__category{font-size:15px;font-weight:700}
      .professional-chart__moment{font-size:11px}
      .professional-chart__title{font-size:17px;font-weight:700}
      .professional-chart__legend{font-size:12px}
      .professional-chart__bar--wash{fill:#0369a1}
      .professional-chart__bar--alcohol{fill:#d97706}
      .professional-chart__bar--miss{fill:#dc2626}
      .professional-chart__separator{stroke:#94a3b8;stroke-dasharray:4 4}
    </style>
    <title>${escaparXml(titulo)}</title>
    <text class="professional-chart__title" x="${xInicio}" y="34">${escaparXml(titulo)}</text>
    <text class="professional-chart__legend" x="${xInicio}" y="58">Evaluaciones de profesionales: ${Number(metricas.profesionalesEvaluados) || 0} · Momentos con respuesta: ${Number(metricas.momentosRespondidos) || 0}</text>
    ${leyenda}
    ${lineas}
    <line class="professional-chart__axis" x1="${xInicio}" y1="${yInicio}" x2="${xInicio}" y2="${yFinal}"/>
    <line class="professional-chart__axis" x1="${xInicio}" y1="${yFinal}" x2="${xFinal}" y2="${yFinal}"/>
    <text class="professional-chart__legend" x="25" y="${(yInicio + yFinal) / 2}" text-anchor="middle" transform="rotate(-90 25 ${(yInicio + yFinal) / 2})">Número de observaciones</text>
    ${grupos}
    <text class="professional-chart__legend" x="${(xInicio + xFinal) / 2}" y="462" text-anchor="middle">Momento de la estrategia multimodal de higiene de manos</text>
  </svg>`;
}

function metricasReporteParaArea(area) {
  const areas = area
    ? [DATOS.porArea?.[area]].filter(Boolean)
    : Object.values(DATOS.porArea || {});
  return areas.reduce((totales, areaData) => {
    totales.profesionalesEvaluados += Number(areaData.profesionalesEvaluados) || 0;
    totales.momentosRespondidos += Number(areaData.momentosRespondidos) || 0;
    return totales;
  }, { profesionalesEvaluados: 0, momentosRespondidos: 0 });
}

function renderProfessionalChart() {
  if (!DATOS) return;
  const areaSeleccionada = document.getElementById("report-area")?.value || "";
  const area = areaSeleccionada || "Todas las áreas";
  const categorias = datosCategoriasParaGrafica(areaSeleccionada);
  const metricas = metricasReporteParaArea(areaSeleccionada);
  const periodo = etiquetaPeriodo(DATOS.filtros || {});
  const chart = document.getElementById("professional-chart");
  const subtitle = document.getElementById("professional-chart-subtitle");
  const label = document.getElementById("report-footer-filter");
  const summary = document.getElementById("report-period-summary");

  if (chart) chart.innerHTML = crearSvgGraficaProfesional(categorias, area, periodo, metricas);
  if (subtitle) {
    subtitle.textContent = `${area} · ${periodo} · ${metricas.profesionalesEvaluados} evaluaciones · ${metricas.momentosRespondidos} momentos respondidos`;
  }
  const professionalsCount = document.getElementById("report-professionals-count");
  const actionsCount = document.getElementById("report-actions-count");
  if (professionalsCount) professionalsCount.textContent = metricas.profesionalesEvaluados.toLocaleString("es-CR");
  if (actionsCount) actionsCount.textContent = metricas.momentosRespondidos.toLocaleString("es-CR");
  if (label) label.textContent = `Área: ${area} · Periodo: ${periodo}`;
  if (summary) {
    summary.textContent = `Área: ${area} · Periodo: ${periodo}`;
  }
}

function obtenerFiltrosReporte() {
  return {
    area: document.getElementById("report-area")?.value || "",
    desde: document.getElementById("report-date-from")?.value || "",
    hasta: document.getElementById("report-date-to")?.value || ""
  };
}

async function aplicarFiltrosReporte() {
  const { desde, hasta } = obtenerFiltrosReporte();
  const loadError = document.getElementById("dashboard-load-error");
  if (desde && hasta && desde > hasta) {
    DASHBOARD_REQUEST_ID++;
    if (loadError) {
      loadError.textContent = "La fecha Desde no puede ser posterior a la fecha Hasta.";
      loadError.hidden = false;
    }
    return;
  }
  if (loadError) {
    loadError.textContent = "";
    loadError.hidden = true;
  }
  await cargarDashboard();
}

async function svgGraficaAImagen(svg) {
  const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  const objectUrl = URL.createObjectURL(blob);
  try {
    const image = new Image();
    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = () => reject(new Error("No se pudo preparar la gráfica para Excel."));
      image.src = objectUrl;
    });

    const viewBox = svg.match(/viewBox=["']\s*[-\d.]+\s+[-\d.]+\s+([\d.]+)\s+([\d.]+)\s*["']/i);
    const aspectRatio = viewBox ? Number(viewBox[1]) / Number(viewBox[2]) : 2.5;
    const canvas = document.createElement("canvas");
    canvas.width = 1800;
    canvas.height = Math.round(canvas.width / aspectRatio);
    const context = canvas.getContext("2d");
    if (!context) throw new Error("No se pudo crear la imagen de la gráfica para Excel.");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/png");
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

async function insertarGraficaProfesionalEnHoja(workbook, worksheet, area, periodo, dataOverride = null, metricasOverride = null) {
  const data = dataOverride || DATOS.porArea?.[area];
  if (!data) return;

  const metricas = metricasOverride || metricasReporteParaArea(area);
  worksheet.mergeCells("O10:AD10");
  const periodoCell = worksheet.getCell("O10");
  periodoCell.value = `Área: ${area} · Periodo: ${periodo} · Evaluaciones de profesionales: ${metricas.profesionalesEvaluados} · Momentos con respuesta: ${metricas.momentosRespondidos}`;
  periodoCell.font = { name: "Arial", size: 12, bold: true, color: { argb: "FF00507D" } };
  periodoCell.alignment = { horizontal: "left", vertical: "middle" };

  const svg = crearSvgGraficaProfesional(data.porCategoria, area, periodo, metricas);
  const imagen = await svgGraficaAImagen(svg);
  const imageId = workbook.addImage({ base64: imagen, extension: "png" });
  worksheet.addImage(imageId, {
    tl: { col: 14, row: 10 },
    ext: { width: 950, height: 380 }
  });
}

/* =========================================================
   CONSTRUIR UNA HOJA POR ÁREA CON FORMATO IAAS
   ========================================================= */
function validarDatosAreaParaExcel(data, area) {
  const acciones = ["lavado", "alcohol", "noRealiza"];
  const totales = { lavado: 0, alcohol: 0, noRealiza: 0 };

  for (let moment = 1; moment <= 5; moment++) {
    const observaciones = data.porMomento[moment] || { lavado: 0, alcohol: 0, noRealiza: 0 };
    const sumaCategorias = { lavado: 0, alcohol: 0, noRealiza: 0 };

    ["Medicina", "Enfermería", "Otros"].forEach((category) => {
      const row = data.porCategoria[category]?.[moment] || { lavado: 0, alcohol: 0, noRealiza: 0 };
      acciones.forEach((accion) => { sumaCategorias[accion] += row[accion]; });
    });

    acciones.forEach((accion) => {
      if (sumaCategorias[accion] !== observaciones[accion]) {
        throw new Error(`Los datos de ${area}, momento M${moment}, no coinciden entre el total y las categorías.`);
      }
      totales[accion] += observaciones[accion];
    });
  }

  acciones.forEach((accion) => {
    if (totales[accion] !== data[`total${accion[0].toUpperCase()}${accion.slice(1)}`]) {
      throw new Error(`El total de ${accion} en ${area} no coincide con el detalle por momento.`);
    }
  });
}

function construirHojaArea(ws, area, dataOverride = null) {
  const data = dataOverride || DATOS.porArea[area] || {
    porMomento: {}, porCategoria: {}, totalLavado: 0, totalAlcohol: 0, totalNoRealiza: 0
  };
  validarDatosAreaParaExcel(data, area);
  const font = { name: "Times New Roman", size: 14, color: { argb: "FF0B1C30" } };
  const border = {
    top: { style: "thin", color: { argb: "FF9AAFC2" } },
    bottom: { style: "thin", color: { argb: "FF9AAFC2" } },
    left: { style: "thin", color: { argb: "FF9AAFC2" } },
    right: { style: "thin", color: { argb: "FF9AAFC2" } }
  };
  const titleStyle = {
    font: { ...font, bold: true, color: { argb: "FFFFFFFF" } },
    fill: { type: "pattern", pattern: "solid", fgColor: { argb: "FF00507D" } },
    alignment: { horizontal: "center", vertical: "middle", wrapText: true }, border
  };
  const subtitleStyle = {
    font: { ...font, italic: true, color: { argb: "FF40474F" } },
    fill: { type: "pattern", pattern: "solid", fgColor: { argb: "FFEFF4FF" } },
    alignment: { horizontal: "left", vertical: "middle", wrapText: true }, border
  };
  const headerStyle = {
    font: { ...font, bold: true },
    fill: { type: "pattern", pattern: "solid", fgColor: { argb: "FFCDE5FF" } },
    alignment: { horizontal: "center", vertical: "middle", wrapText: true }, border
  };
  const textStyle = {
    font, alignment: { horizontal: "left", vertical: "middle", wrapText: true }, border
  };
  const numberStyle = {
    font, alignment: { horizontal: "center", vertical: "middle" }, border, numFmt: "0"
  };
  const totalStyle = {
    ...numberStyle,
    font: { ...font, bold: true },
    fill: { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF2CC" } },
    border: {
      ...border,
      top: { style: "medium", color: { argb: "FF00507D" } },
      bottom: { style: "medium", color: { argb: "FF00507D" } }
    }
  };
  const percentageStyle = {
    ...numberStyle,
    font: { ...font, bold: true, color: { argb: "FF00573A" } },
    fill: { type: "pattern", pattern: "solid", fgColor: { argb: "FFD1FAE5" } },
    numFmt: "0%"
  };
  const sourceStyle = {
    font: { ...font, italic: true, size: 11, color: { argb: "FF707881" } },
    alignment: { horizontal: "left", vertical: "middle" }
  };
  const mergeTitle = (row, firstCol, lastCol, value, style) => {
    ws.mergeCells(row, firstCol, row, lastCol);
    for (let col = firstCol; col <= lastCol; col++) ws.getCell(row, col).style = style;
    ws.getCell(row, firstCol).value = value;
    ws.getRow(row).height = style === titleStyle ? 24 : 18;
  };
  const setRow = (row, firstCol, values, style) => {
    values.forEach((value, offset) => {
      const cell = ws.getCell(row, firstCol + offset);
      const cellStyle = typeof style === "function" ? style(offset, cell) : style;
      cell.value = value;
      cell.style = JSON.parse(JSON.stringify(cellStyle));
    });
  };
  const percentage = (value, total) => total > 0 ? value / total : 0;

  const totalCumplidas = data.totalLavado + data.totalAlcohol;
  const totalGeneral = totalCumplidas + data.totalNoRealiza;
  mergeTitle(2, 2, 4, `Cuadro 3. Total de Observaciones en ${area} por N\u00famero y Porcentaje del Cumplimiento`, titleStyle);
  mergeTitle(3, 2, 4, "de la Estrategia de Higiene Multimodal durante Evaluaci\u00f3n", subtitleStyle);
  setRow(4, 2, ["Actividad", "N\u00famero de observaciones", "Porcentaje"], headerStyle);
  ws.getRow(4).height = 31;
  setRow(5, 2, ["Higiene de las manos", totalCumplidas, percentage(totalCumplidas, totalGeneral)],
    (offset) => offset === 0 ? textStyle : offset === 1 ? numberStyle : percentageStyle);
  setRow(6, 2, ["No lo realiza", data.totalNoRealiza, percentage(data.totalNoRealiza, totalGeneral)],
    (offset) => offset === 0 ? textStyle : offset === 1 ? numberStyle : percentageStyle);
  setRow(7, 2, ["Total", totalGeneral, percentage(totalGeneral, totalGeneral)],
    (offset) => offset === 0
      ? { ...totalStyle, alignment: { horizontal: "left", vertical: "middle" } }
      : offset === 1 ? totalStyle : percentageStyle);
  ws.getCell("B8").value = "Fuente: Comit\u00e9 de IAAS HNGG";
  ws.getCell("B8").style = sourceStyle;

  mergeTitle(12, 2, 6, `Cuadro 3. N\u00famero de Observaciones en ${area}, por momento de higiene y acci\u00f3n`, titleStyle);
  mergeTitle(13, 2, 6, "realizada durante Evaluaci\u00f3n de Estrategia Multimodal", subtitleStyle);
  setRow(14, 2, ["Momento", "Lavado", "Soluci\u00f3n de Alcohol", "No lo realiza", "Total"], headerStyle);
  ws.getRow(14).height = 27;
  let washTotal = 0, alcoholTotal = 0, missTotal = 0;
  for (let moment = 1; moment <= 5; moment++) {
    const values = data.porMomento[moment] || { lavado: 0, alcohol: 0, noRealiza: 0 };
    setRow(14 + moment, 2, [moment, values.lavado, values.alcohol, values.noRealiza,
      values.lavado + values.alcohol + values.noRealiza], numberStyle);
    washTotal += values.lavado;
    alcoholTotal += values.alcohol;
    missTotal += values.noRealiza;
  }
  const momentTotal = washTotal + alcoholTotal + missTotal;
  setRow(20, 2, ["Total", washTotal, alcoholTotal, missTotal, momentTotal],
    (offset) => offset === 0 ? { ...totalStyle, alignment: { horizontal: "left", vertical: "middle" } } : totalStyle);
  setRow(21, 2, ["Porcentaje", percentage(washTotal, momentTotal), percentage(alcoholTotal, momentTotal),
    percentage(missTotal, momentTotal), percentage(momentTotal, momentTotal)], percentageStyle);
  ws.getCell("B22").value = "Fuente: Comit\u00e9 de IAAS HNGG";
  ws.getCell("B22").style = sourceStyle;

  const categories = [
    { key: "Medicina", title: "Observaciones en personal m\u00e9dico por momento de higiene y acci\u00f3n realizada", startRow: 2 },
    { key: "Enfermer\u00eda", title: "Observaciones en personal de enfermer\u00eda por momento de higiene y acci\u00f3n realizada", startRow: 16 },
    { key: "Otros", title: "Observaciones en terapeutas, t\u00e9cnicos y otros por momento de higiene y acci\u00f3n realizada", startRow: 31 }
  ];
  categories.forEach(({ key, title, startRow }) => {
    const headerRow = startRow + 2;
    const dataStartRow = headerRow + 1;
    const dataCat = data.porCategoria[key] || {};
    mergeTitle(startRow, 8, 12, title, titleStyle);
    mergeTitle(startRow + 1, 8, 12, "realizada durante Evaluaci\u00f3n de Estrategia Multimodal", subtitleStyle);
    setRow(headerRow, 8, ["Momento", "Lavado", "Soluci\u00f3n de Alcohol", "No lo realiza", "Total"], headerStyle);
    ws.getRow(headerRow).height = 27;
    let categoryWash = 0, categoryAlcohol = 0, categoryMiss = 0;
    for (let moment = 1; moment <= 5; moment++) {
      const values = dataCat[moment] || { lavado: 0, alcohol: 0, noRealiza: 0 };
      setRow(dataStartRow + moment - 1, 8, [moment, values.lavado, values.alcohol, values.noRealiza,
        values.lavado + values.alcohol + values.noRealiza], numberStyle);
      categoryWash += values.lavado;
      categoryAlcohol += values.alcohol;
      categoryMiss += values.noRealiza;
    }
    const totalRow = dataStartRow + 5;
    const percentageRow = totalRow + 1;
    const categoryTotal = categoryWash + categoryAlcohol + categoryMiss;
    setRow(totalRow, 8, ["Total", categoryWash, categoryAlcohol, categoryMiss, categoryTotal],
      (offset) => offset === 0 ? { ...totalStyle, alignment: { horizontal: "left", vertical: "middle" } } : totalStyle);
    setRow(percentageRow, 8, ["Porcentaje", percentage(categoryWash, categoryTotal),
      percentage(categoryAlcohol, categoryTotal), percentage(categoryMiss, categoryTotal),
      percentage(categoryTotal, categoryTotal)], percentageStyle);
    ws.getCell(percentageRow + 1, 8).value = "Fuente: Comit\u00e9 de IAAS HNGG";
    ws.getCell(percentageRow + 1, 8).style = sourceStyle;
  });

  mergeTitle(2, 15, 30, `N\u00famero de observaciones por momento de higiene y acci\u00f3n realizada durante Evaluaci\u00f3n de Estrategia Multimodal \u2014 ${area}`, titleStyle);
  setRow(3, 15, ["Acciones"], headerStyle);
  ["Medicina", "Enfermer\u00eda", "Otros"].forEach((category, index) => {
    const firstCol = 16 + index * 5;
    ws.mergeCells(3, firstCol, 3, firstCol + 4);
    for (let col = firstCol; col <= firstCol + 4; col++) ws.getCell(3, col).style = headerStyle;
    ws.getCell(3, firstCol).value = category;
  });
  setRow(4, 15, ["Momento de higiene de manos", ...Array(3).fill([1, 2, 3, 4, 5]).flat()], headerStyle);
  ws.getRow(4).height = 27;
  const actions = [
    { key: "lavado", label: "Lavado" },
    { key: "alcohol", label: "Soluci\u00f3n alcoh\u00f3lica" },
    { key: "noRealiza", label: "No realiza" }
  ];
  actions.forEach(({ key, label }, actionIndex) => {
    const values = [label];
    categories.forEach(({ key: categoryKey }) => {
      for (let moment = 1; moment <= 5; moment++) {
        const momentData = data.porCategoria[categoryKey]?.[moment] || { lavado: 0, alcohol: 0, noRealiza: 0 };
        values.push(momentData[key]);
      }
    });
    setRow(5 + actionIndex, 15, values, (offset) => offset === 0 ? textStyle : numberStyle);
  });
  const matrixTotals = ["Total"];
  categories.forEach(({ key }) => {
    for (let moment = 1; moment <= 5; moment++) {
      const values = data.porCategoria[key]?.[moment] || { lavado: 0, alcohol: 0, noRealiza: 0 };
      matrixTotals.push(values.lavado + values.alcohol + values.noRealiza);
    }
  });
  setRow(8, 15, matrixTotals, totalStyle);
  ws.getCell("O9").value = "Fuente: Comit\u00e9 de IAAS HNGG";
  ws.getCell("O9").style = sourceStyle;
  ws.getRow(3).height = 18;
  ws.getRow(32).height = 18;
  ws.pageSetup.printArea = "B2:AD41";
}

/* =========================================================
   11. CARGA DE DATOS
   ========================================================= */
async function cargarDashboard() {
  const requestId = ++DASHBOARD_REQUEST_ID;
  try {
    const parametros = new URLSearchParams();
    const filtros = obtenerFiltrosReporte();
    Object.entries(filtros).forEach(([clave, valor]) => {
      if (valor) parametros.set(clave, valor);
    });
    const query = parametros.toString();
    const response = await fetch(`datos_dashboard.php${query ? `?${query}` : ""}`, {
      cache: "no-store"
    });
    if (requestId !== DASHBOARD_REQUEST_ID) return;
    const data = await response.json();
    if (requestId !== DASHBOARD_REQUEST_ID) return;

    if (response.status === 401) {
      sessionStorage.removeItem("hm_user");
      window.location.replace("login.html");
      return;
    }
    if (response.status === 403) {
      const dashboardContent = document.getElementById("dashboard-content");
      if (dashboardContent) dashboardContent.hidden = true;
      window.location.replace("index.html");
      return;
    }
    if (!response.ok || !data.ok) {
      throw new Error(data.message || "No se pudieron cargar los datos del dashboard.");
    }

    DATOS = data;
    const emptyState = document.querySelector(".dashboard-empty-state");
    if (DATOS.totalObservaciones === 0) {
      if (!emptyState) {
        const main = document.querySelector("main.container");
        if (main) {
          const state = document.createElement("div");
          state.className = "empty-state dashboard-empty-state";
          state.innerHTML = `
            <span class="material-symbols-outlined">analytics</span>
            <p>No hay observaciones para el área y periodo seleccionados.</p>
          `;
          main.insertBefore(state, main.children[1] || null);
        }
      }
    } else if (emptyState) {
      emptyState.remove();
    }

    const loadError = document.getElementById("dashboard-load-error");
    if (loadError) {
      loadError.hidden = true;
      loadError.textContent = "";
    }

    renderKPIs();
    renderChart();
    renderProfessionalChart();
    renderMomentsTable();

    TAB_ACTIVA = "doctors";
    poblarSubcategorias(TAB_ACTIVA);
    renderCategoryTable(TAB_ACTIVA, "__all__");
    renderCategoryPrintTables();
    setupTabs();

    console.log("Dashboard cargado con datos reales:", DATOS);

  } catch (err) {
    if (requestId !== DASHBOARD_REQUEST_ID) return;
    console.error("Error al cargar dashboard:", err);

    const loadError = document.getElementById("dashboard-load-error");
    if (loadError) {
      const detail = err.message === "No autorizado"
        ? "La sesión del servidor expiró; cierre sesión y vuelva a ingresar"
        : `Error: ${err.message}`;
      loadError.textContent = `No se pudieron cargar los reportes. ${detail}.`;
      loadError.hidden = false;
    }
  }
}

/* =========================================================
   12. INICIALIZACIÓN
   ========================================================= */
document.addEventListener("DOMContentLoaded", async () => {
  if (window.SKIP_DASHBOARD_INIT) return;

  try {
    const response = await fetch("sesion_actual.php", { cache: "no-store" });
    if (response.status === 401) {
      sessionStorage.removeItem("hm_user");
      window.location.replace("login.html");
      return;
    }
    if (!response.ok) {
      throw new Error(`No se pudo validar la sesión (${response.status}).`);
    }

    const data = await response.json();
    if (!data.ok) throw new Error(data.message || "No se pudo validar la sesión.");
    if (data.usuario.Rol !== 1) {
      window.location.replace("index.html");
      return;
    }

    const session = JSON.parse(sessionStorage.getItem("hm_user") || "{}");
    const userNameEl = document.getElementById("user-name");
    if (userNameEl && session.Nombre) {
      userNameEl.textContent = session.Nombre;
    }

    const adminLink = document.getElementById("admin-link");
    if (adminLink) adminLink.hidden = false;
    const exportButtons = document.getElementById("header-export");
    if (exportButtons) exportButtons.hidden = false;
    const dashboardContent = document.getElementById("dashboard-content");
    if (dashboardContent) dashboardContent.hidden = false;

    setupExportPDF();
    setupExportExcel();
    const reportFilters = [
      document.getElementById("report-area"),
      document.getElementById("report-date-from"),
      document.getElementById("report-date-to")
    ];
    reportFilters.forEach((filter) => {
      if (filter) filter.addEventListener("change", aplicarFiltrosReporte);
    });
    const fechaDesde = document.getElementById("report-date-from");
    const fechaHasta = document.getElementById("report-date-to");
    if (fechaDesde && fechaHasta) {
      fechaDesde.addEventListener("change", () => {
        fechaHasta.min = fechaDesde.value;
        fechaDesde.max = fechaHasta.value;
      });
      fechaHasta.addEventListener("change", () => {
        fechaDesde.max = fechaHasta.value;
        fechaHasta.min = fechaDesde.value;
      });
    }
    setupTabs();
    await cargarDashboard();
  } catch (err) {
    console.error("Error al validar permisos del dashboard:", err);
    const accessError = document.getElementById("dashboard-access-error");
    if (accessError) {
      accessError.textContent = "No se pudo validar el acceso al histórico. Recargue la página o vuelva a iniciar sesión.";
      accessError.hidden = false;
    }
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
});
