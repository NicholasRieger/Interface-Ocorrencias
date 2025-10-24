// ===================================================================
// app.js - Front para Relatório de Ocorrências
// Lê selections do formulário e chama a API do backend (Flask)
// ===================================================================

// 1) Base da API (vem do config.js). Em dev local, pode usar 127.0.0.1:5000
const API_BASE = (window.API_BASE || "http://127.0.0.1:5000").replace(/\/$/, "");

// 2) Pega referências dos elementos (se não existir algum, ignora com null)
const $turmas        = document.getElementById("turmas");
const $ocorrencias   = document.getElementById("ocorrencias");
const $dataInicio    = document.getElementById("dataInicio");
const $dataFim       = document.getElementById("dataFim");
const $btnCSV        = document.getElementById("btnExportarCSV");
const $btnXLSX       = document.getElementById("btnExportarXLSX");
const $msg           = document.getElementById("msg");

// 3) Utilidades ------------------------------------------------------

/** Mostra mensagem de status/erro (se houver elemento #msg) */
function setMsg(texto, tipo = "info") {
  if (!$msg) return;
  $msg.textContent = texto || "";
  $msg.className = ""; // limpa classes
  if (texto) {
    $msg.classList.add(tipo === "erro" ? "msg-erro" : "msg-ok");
  }
}

/** Lê valores selecionados de um <select multiple> */
function selectedValues(selectEl) {
  if (!selectEl) return [];
  return Array.from(selectEl.selectedOptions || [])
    .map(o => (o.value ?? "").trim())
    .filter(Boolean);
}

/** Lê data-* custom (ex.: data-cod) dos options selecionados */
function selectedDataAttr(selectEl, attr) {
  if (!selectEl) return [];
  const key = "cod"; // por padrão usamos data-cod para códigos de turma
  const dataKey = (attr || key);
  return Array.from(selectEl.selectedOptions || [])
    .map(o => (o.dataset && o.dataset[dataKey]) ? String(o.dataset[dataKey]).trim() : "")
    .filter(Boolean);
}

/** Normaliza AAAA-MM-DD (value do <input type="date"> já vem assim) */
function readISODate(inputEl) {
  if (!inputEl) return "";
  return (inputEl.value || "").trim();
}

/** Baixa um Blob com nome de arquivo */
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

/** Tenta extrair filename do header Content-Disposition */
function getFilenameFromDisposition(resp) {
  const cd = resp.headers.get("Content-Disposition") || resp.headers.get("content-disposition");
  if (!cd) return null;
  const m = cd.match(/filename\*=UTF-8''([^;]+)|filename="?([^"]+)"?/i);
  if (!m) return null;
  return decodeURIComponent(m[1] || m[2] || "").replace(/\s+/g, " ").trim();
}

/** Validação básica do formulário */
function validarFiltro() {
  const turmas = selectedValues($turmas);
  const tipos  = selectedValues($ocorrencias);
  const di     = readISODate($dataInicio);
  const df     = readISODate($dataFim);

  if (!turmas.length) {
    throw new Error("Selecione ao menos 1 turma.");
  }
  if (!tipos.length) {
    throw new Error("Selecione ao menos 1 tipo de ocorrência.");
  }
  if (!di || !df) {
    throw new Error("Informe as datas (início e fim).");
  }
  if (di > df) {
    throw new Error("A data inicial não pode ser maior que a final.");
  }
}

/** Monta QueryString com os filtros atuais */
function montarQueryString() {
  const turmas     = selectedValues($turmas);
  const turmasCod  = selectedDataAttr($turmas, "cod"); // opcional: só se existir data-cod
  const tipos      = selectedValues($ocorrencias);
  const di         = readISODate($dataInicio);
  const df         = readISODate($dataFim);

  const qs = new URLSearchParams();
  turmas.forEach(t => qs.append("turmas", t));
  // Só envia turmas_cod se existir pelo menos um código (não exponha nada forçado no front)
  if (turmasCod.length) {
    turmasCod.forEach(c => qs.append("turmas_cod", c));
  }
  tipos.forEach(o => qs.append("ocorrencias", o));
  qs.set("data_inicio", di);
  qs.set("data_fim", df);

  return qs;
}

/** Desabilita/habilita botões durante o fetch */
function setBusy(b) {
  [$btnCSV, $btnXLSX].forEach(btn => {
    if (!btn) return;
    btn.disabled = !!b;
  });
}

// 4) Ações: Exportar CSV / XLSX --------------------------------------

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
    setMsg(err.message || "Falha ao gerar arquivo.", "erro");
    console.error(err);
  } finally {
    setBusy(false);
  }
}

// Handlers dos botões (se existirem na página)
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

// 5) Ping inicial (ajuda a diagnosticar CORS/conexão no console) -----
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
