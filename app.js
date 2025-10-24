// ===================================================================
// app.js - Front para Relatório de Ocorrências
// ===================================================================

// 1) Base da API (vem do config.js). Em dev local, usa 127.0.0.1:5000 se não setado
const API_BASE = (window.API_BASE || "http://127.0.0.1:5000").replace(/\/$/, "");

// 2) Elementos
const $turmas      = document.getElementById("turmas");
const $ocorrencias = document.getElementById("ocorrencias");
const $dataInicio  = document.getElementById("dataInicio");
const $dataFim     = document.getElementById("dataFim");
const $btnCSV      = document.getElementById("btnExportarCSV");
const $btnXLSX     = document.getElementById("btnExportarXLSX");
const $msg         = document.getElementById("msg");

// --- habilita botões caso venham com disabled no HTML
(function enableButtonsOnLoad() {
  [$btnCSV, $btnXLSX].forEach(b => { if (b) b.removeAttribute("disabled"); });
})();

// 3) Utilidades
function setMsg(texto, tipo = "info") {
  if (!$msg) return;
  $msg.textContent = texto || "";
  $msg.className = "";
  if (texto) $msg.classList.add(tipo === "erro" ? "msg-erro" : "msg-ok");
}

function selectedValues(selectEl) {
  if (!selectEl) return [];
  return Array.from(selectEl.selectedOptions || [])
    .map(o => (o.value ?? "").trim())
    .filter(Boolean);
}

function selectedDataAttr(selectEl, attr) {
  if (!selectEl) return [];
  const key = (attr || "cod");
  return Array.from(selectEl.selectedOptions || [])
    .map(o => (o.dataset && o.dataset[key]) ? String(o.dataset[key]).trim() : "")
    .filter(Boolean);
}

function readISODate(inputEl) {
  if (!inputEl) return "";
  return (inputEl.value || "").trim();
}

function downloadBlob(blob, filenameFallback) {
  const a = document.createElement("a");
  const url = URL.createObjectURL(blob);
  a.href = url;
  a.download = filenameFallback;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function getFilenameFromDisposition(resp) {
  const cd = resp.headers.get("Content-Disposition") || resp.headers.get("content-disposition");
  if (!cd) return null;
  const m = cd.match(/filename\*=UTF-8''([^;]+)|filename="?([^"]+)"?/i);
  if (!m) return null;
  return decodeURIComponent(m[1] || m[2] || "").replace(/\s+/g, " ").trim();
}

function validarFiltro() {
  const turmas = selectedValues($turmas);
  const tipos  = selectedValues($ocorrencias);
  const di     = readISODate($dataInicio);
  const df     = readISODate($dataFim);

  if (!turmas.length) throw new Error("Selecione ao menos 1 turma.");
  if (!tipos.length)  throw new Error("Selecione ao menos 1 tipo de ocorrência.");
  if (!di || !df)     throw new Error("Informe as datas (início e fim).");
  if (di > df)        throw new Error("A data inicial não pode ser maior que a final.");
}

function montarQueryString() {
  const turmas     = selectedValues($turmas);
  const turmasCod  = selectedDataAttr($turmas, "cod"); // se existir data-cod no <option>
  const tipos      = selectedValues($ocorrencias);
  const di         = readISODate($dataInicio);
  const df         = readISODate($dataFim);

  const qs = new URLSearchParams();
  turmas.forEach(t => qs.append("turmas", t));
  if (turmasCod.length) turmasCod.forEach(c => qs.append("turmas_cod", c));
  tipos.forEach(o => qs.append("ocorrencias", o));
  qs.set("data_inicio", di);
  qs.set("data_fim", df);

  return qs;
}

function setBusy(b) {
  [$btnCSV, $btnXLSX].forEach(btn => { if (btn) btn.disabled = !!b; });
}

// 4) Exportações
async function exportar(endpoint, nomeFallbackExt) {
  try {
    setMsg("");
    validarFiltro();
  } catch (e) {
    setMsg(e.message || "Preencha os filtros corretamente.", "erro");
    return;
  }

  const qs = montarQueryString();
  const url = `${API_BASE}${endpoint}?${qs.toString()}`;

  try {
    setBusy(true);
    setMsg("Gerando arquivo…");

    const resp = await fetch(url, { method: "GET" });
    if (!resp.ok) {
      const txt = await resp.text().catch(() => "");
      throw new Error(`Erro ao gerar arquivo (${resp.status}). ${txt || ""}`.trim());
    }

    const blob = await resp.blob();
    const di = readISODate($dataInicio);
    const df = readISODate($dataFim);
    const fallback = `ocorrencias_pivot_${di}_a_${df}.${nomeFallbackExt}`;

    const fname = getFilenameFromDisposition(resp) || fallback;
    downloadBlob(blob, fname);
    setMsg("Arquivo gerado com sucesso! ✓");
  } catch (err) {
    console.error(err);
    setMsg(err.message || "Falha ao gerar arquivo.", "erro");
  } finally {
    setBusy(false);
  }
}

// 5) Eventos
if ($btnCSV) {
  $btnCSV.addEventListener("click", (ev) => {
    ev.preventDefault();
    exportar("/api/ocorrencias/csv_pivot", "csv");
  });
}
if ($btnXLSX) {
  $btnXLSX.addEventListener("click", (ev) => {
    ev.preventDefault();
    exportar("/api/ocorrencias/xlsx_pivot", "xlsx");
  });
}

// 6) Ping (diagnóstico)
(async function bootstrap() {
  try {
    const r = await fetch(`${API_BASE}/api/ping`, { method: "GET" });
    if (!r.ok) throw new Error(`Ping falhou (${r.status})`);
    console.log("[OK] API acessível em:", API_BASE);
  } catch (e) {
    console.warn("[ATENÇÃO] Não foi possível acessar a API em:", API_BASE, e);
    setMsg("Não foi possível acessar a API. Verifique a URL no config.js.", "erro");
  }
})();
