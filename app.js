// ===================================================================
// app.js - Relatório de Ocorrências (compatível com seus IDs antigos)
// IDs esperados no HTML:
//   #turmas, #ocorrencias, #data-inicio, #data-fim, #exportar, #status
// ===================================================================

// Base da API: se existir window.API_BASE (ex.: https://sua-api.onrender.com) usa;
// caso contrário, usa caminho relativo (/api/...), ideal p/ backend+front juntos.
const API_BASE = (window.API_BASE ?? "").replace(/\/$/, "");

// Helpers DOM
const $ = (sel) => document.querySelector(sel);

// Elementos (mantendo os MESMOS IDs que você usava)
const turmasEl = $("#turmas");
const ocorsEl  = $("#ocorrencias");
const dIniEl   = $("#data-inicio");
const dFimEl   = $("#data-fim");
const btn      = $("#exportar");
const statusEl = $("#status");

// ------- Utilitários -------
const valMulti = (sel) =>
  Array.from(sel?.selectedOptions || [])
    .map(o => (o.value ?? "").trim())
    .filter(Boolean);

// Lê data-cod (se você tiver <option data-cod="123">)
const valMultiData = (sel, attr = "cod") =>
  Array.from(sel?.selectedOptions || [])
    .map(o => (o.dataset?.[attr] ?? "").toString().trim())
    .filter(Boolean);

// datas vêm como yyyy-mm-dd do <input type="date">
const fmtDate = (inp) => (inp?.value || "").trim();

// Validação: habilita/desabilita o botão
const validate = () => {
  const ok =
    valMulti(turmasEl).length > 0 &&
    valMulti(ocorsEl).length  > 0 &&
    !!dIniEl?.value &&
    !!dFimEl?.value;

  if (btn) btn.disabled = !ok;
  return ok;
};

// Datas padrão: últimos 30 dias
(function setDefaultDates() {
  if (!dIniEl || !dFimEl) return;
  const today = new Date();
  const past  = new Date();
  past.setDate(today.getDate() - 30);
  const toIso = (d) => d.toISOString().slice(0, 10);
  if (!dIniEl.value) dIniEl.value = toIso(past);
  if (!dFimEl.value) dFimEl.value = toIso(today);
})();

// Revalida ao mexer nos campos
["change","input"].forEach(ev => {
  [turmasEl, ocorsEl, dIniEl, dFimEl].forEach(el => el && el.addEventListener(ev, validate));
});
validate();

// Mensagens
function setStatus(txt) {
  if (!statusEl) return;
  statusEl.textContent = txt || "";
}

// Faz download de Blob com nome
function downloadBlob(blob, filename) {
  const a = document.createElement("a");
  const url = URL.createObjectURL(blob);
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// Tenta pegar filename do header Content-Disposition
function getFilenameFromDisposition(resp) {
  const cd = resp.headers.get("Content-Disposition") || resp.headers.get("content-disposition");
  if (!cd) return null;
  const m = cd.match(/filename\*=UTF-8''([^;]+)|filename="?([^"]+)"?/i);
  if (!m) return null;
  try {
    return decodeURIComponent(m[1] || m[2] || "").trim();
  } catch {
    return (m[1] || m[2] || "").trim();
  }
}

// Exportar XLSX (usa o endpoint novo do backend)
async function exportarXLSX() {
  if (!validate()) return;

  const turmas = valMulti(turmasEl);
  const turmasCod = valMultiData(turmasEl, "cod"); // só será enviado se existir data-cod
  const ocors  = valMulti(ocorsEl);
  const di     = fmtDate(dIniEl);
  const df     = fmtDate(dFimEl);

  // Monta a query exatamente como o backend espera
  const qs = new URLSearchParams();
  turmas.forEach(t => qs.append("turmas", t));
  if (turmasCod.length) turmasCod.forEach(c => qs.append("turmas_cod", c));
  ocors.forEach(o => qs.append("ocorrencias", o));
  qs.append("data_inicio", di);
  qs.append("data_fim", df);

  // Se API_BASE estiver vazio -> "/api/..." (relativo). Se não, "https://.../api/..."
  const url = `${API_BASE}/api/ocorrencias/xlsx_pivot?${qs.toString()}`;

  if (btn) btn.disabled = true;
  setStatus("Gerando XLSX…");

  try {
    const res = await fetch(url, { method: "GET" });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`Erro ao gerar XLSX (${res.status}). ${txt || ""}`);
    }

    const blob = await res.blob();
    // tenta pegar nome do header, senão monta fallback
    let fname = getFilenameFromDisposition(res);
    if (!fname) {
      const diLabel = di.replaceAll("-", "_");
      const dfLabel = df.replaceAll("-", "_");
      fname = `relatorio_ocorrencias_${diLabel}_a_${dfLabel}.xlsx`;
    }

    downloadBlob(blob, fname);
    setStatus("Arquivo gerado com sucesso ✨");
  } catch (err) {
    console.error(err);
    setStatus(err.message || "Falha ao gerar XLSX.");
  } finally {
    if (btn) btn.disabled = !validate();
    setTimeout(() => { if (statusEl?.textContent?.startsWith("Arquivo")) setStatus(""); }, 2500);
  }
}

// Clique do botão (mesmo ID antigo)
if (btn) btn.addEventListener("click", exportarXLSX);

// Ping inicial (útil p/ identificar CORS/URL errada no console)
(async function ping() {
  try {
    const r = await fetch(`${API_BASE}/api/ping`);
    if (!r.ok) throw new Error(`Ping falhou (${r.status})`);
    console.log("[OK] API acessível em:", API_BASE || "(caminho relativo)");
  } catch (e) {
    console.warn("[ATENÇÃO] Não foi possível acessar a API em:", API_BASE || "(relativo)", e);
  }
})();
