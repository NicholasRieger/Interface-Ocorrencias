(function () {
  const $ = (sel) => document.querySelector(sel);

  const turmasEl = $("#turmas");
  const ocorsEl  = $("#ocorrencias");
  const dIniEl   = $("#data-inicio");
  const dFimEl   = $("#data-fim");
  const btn      = $("#exportar");
  const statusEl = $("#status");

  const valMulti = (sel) => Array.from(sel.selectedOptions).map(o => o.value.trim()).filter(Boolean);
  const fmtDate = (inp) => inp.value;

  const validate = () => {
    const valid = valMulti(turmasEl).length > 0 && valMulti(ocorsEl).length > 0 && dIniEl.value && dFimEl.value;
    btn.disabled = !valid;
    return valid;
  };

  // Datas padrão: últimos 30 dias
  const today = new Date();
  const past  = new Date(); past.setDate(today.getDate() - 30);
  const toIso = (d) => d.toISOString().slice(0,10);
  if(!dIniEl.value) dIniEl.value = toIso(past);
  if(!dFimEl.value) dFimEl.value = toIso(today);

  ["change","input"].forEach(ev => {
    [turmasEl, ocorsEl, dIniEl, dFimEl].forEach(el => el.addEventListener(ev, validate));
  });
  validate();

  async function exportarXLSX(){
    if(!validate()) return;

    const turmas = valMulti(turmasEl);
    const ocors  = valMulti(ocorsEl);
    const di     = fmtDate(dIniEl);
    const df     = fmtDate(dFimEl);

    const qs = new URLSearchParams();
    turmas.forEach(t => qs.append("turmas", t));
    ocors.forEach(o => qs.append("ocorrencias", o));
    qs.append("data_inicio", di);
    qs.append("data_fim", df);

    const url = `/api/ocorrencias/xlsx_pivot?${qs.toString()}`;

    btn.disabled = true;
    statusEl.textContent = "Gerando XLSX…";

    try{
      const res = await fetch(url, { method: "GET" });
      if(!res.ok){
        const txt = await res.text().catch(() => "");
        throw new Error(`Erro ao gerar XLSX (${res.status}). ${txt || ""}`);
      }
      const blob = await res.blob();
      const a = document.createElement("a");
      const diLabel = di.replaceAll("-","_");
      const dfLabel = df.replaceAll("-","_");
      a.href = URL.createObjectURL(blob);
      a.download = `relatorio_ocorrencias_${diLabel}_a_${dfLabel}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      statusEl.textContent = "Arquivo gerado com sucesso ✨";
    }catch(err){
      console.error(err);
      statusEl.textContent = err.message || "Falha ao gerar XLSX.";
    }finally{
      btn.disabled = !validate();
      setTimeout(() => { if(statusEl.textContent.startsWith("Arquivo")) statusEl.textContent=""; }, 2500);
    }
  }

  $("#exportar").addEventListener("click", exportarXLSX);
})();
