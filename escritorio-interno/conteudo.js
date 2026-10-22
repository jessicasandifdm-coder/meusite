/* ══════════════════════════════════════════════════
   ESCRITÓRIO — CONTEÚDO (linha editorial)
   Semana a semana: o que gravar, o que postar e quando.
   Tabela: escritorio_conteudo
   ══════════════════════════════════════════════════ */

const CONT_STATUS = [
  { v: 'ideia',     l: 'Planejado' },
  { v: 'producao',  l: 'Em produção' },
  { v: 'programado',l: 'Programado' },
  { v: 'publicado', l: 'Publicado' },
];
const CONT_FORMATOS = ['Reels', 'Carrossel', 'Foto', 'Stories', 'Live', 'Post estático'];
const CONT_PILARES  = ['Marketing', 'Vendas', 'Rotina comercial', 'Método', 'Pessoal'];
const CONT_DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

const CONT_STATE = { lista: [], vista: 'calendario', passadas: false, mes: null, diaSel: null };

function contStatusLabel(v) { return (CONT_STATUS.find(s => s.v === v) || {}).l || v || ''; }
function contData(iso) { return iso ? new Date(iso + 'T12:00:00') : null; }
function contDM(iso) {
  const d = contData(iso); if (!d) return '';
  return String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0');
}
function contDia(iso) { const d = contData(iso); return d ? CONT_DIAS[d.getDay()] : ''; }
function contHojeISO() {
  const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}
function contSegunda(iso) {
  const d = contData(iso); const dow = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - dow);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}
function contSomaDias(iso, n) {
  const d = contData(iso); d.setDate(d.getDate() + n);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}

function contCss() {
  if (document.getElementById('cont-css')) return;
  const s = document.createElement('style'); s.id = 'cont-css';
  s.textContent = `
  .cont-top{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:18px;flex-wrap:wrap}
  .cont-switch{display:flex;gap:2px;background:var(--card);border:1px solid var(--border);border-radius:var(--radius);padding:2px}
  .cont-switch button{background:none;border:none;color:var(--text3);font-size:12px;padding:6px 12px;border-radius:4px;cursor:pointer;font-family:inherit}
  .cont-switch button.on{background:var(--accent-dim);color:var(--accent)}
  .cont-gravar{background:var(--amber-dim);border:1px solid rgba(240,184,74,.25);border-radius:var(--radius-lg);padding:14px 16px;margin-bottom:22px}
  .cont-gravar-t{font-size:12px;font-weight:600;color:var(--amber);letter-spacing:.04em;text-transform:uppercase;margin-bottom:10px}
  .cont-gravar-dia{font-size:12px;color:var(--text2);margin:8px 0 4px;font-weight:600}
  .cont-sem{margin-bottom:22px}
  .cont-sem-h{display:flex;align-items:baseline;justify-content:space-between;gap:10px;border-bottom:1px solid var(--border);padding-bottom:6px;margin-bottom:6px}
  .cont-sem-h b{font-size:13px;color:var(--text)}
  .cont-sem-h span{font-size:11px;color:var(--text3)}
  .cont-sem.atual .cont-sem-h b{color:var(--accent)}
  .cont-row{display:grid;grid-template-columns:64px 92px 1fr auto;gap:12px;align-items:center;padding:9px 10px;border-radius:var(--radius);cursor:pointer;border:1px solid transparent}
  .cont-row:hover{background:var(--card);border-color:var(--border)}
  .cont-row.feito{opacity:.5}
  .cont-dia{font-size:12px;color:var(--text2);line-height:1.25}
  .cont-dia small{display:block;color:var(--text3);font-size:11px}
  .cont-fmt{font-size:11px;font-weight:600;padding:3px 8px;border-radius:10px;text-align:center;white-space:nowrap}
  .f-Reels{background:rgba(240,96,96,.1);color:#f08a8a}
  .f-Carrossel{background:var(--accent-dim);color:var(--accent)}
  .f-Foto{background:rgba(255,255,255,.05);color:var(--text2)}
  .f-Live{background:var(--green-dim);color:var(--green)}
  .f-Stories{background:var(--amber-dim);color:var(--amber)}
  .cont-tit{font-size:13px;color:var(--text);line-height:1.35}
  .cont-meta{display:flex;gap:6px;flex-wrap:wrap;margin-top:4px}
  .cont-chip{font-size:10.5px;color:var(--text3);border:1px solid var(--border);border-radius:10px;padding:1px 7px;white-space:nowrap}
  .cont-chip.pal{color:var(--text2);border-color:var(--border2);font-weight:600;letter-spacing:.04em}
  .cont-chip.grav{color:var(--amber);border-color:rgba(240,184,74,.3)}
  .cont-st{font-size:11px;color:var(--text3);white-space:nowrap}
  .cont-st.producao{color:var(--amber)} .cont-st.programado{color:var(--accent)} .cont-st.publicado{color:var(--green)}
  .cont-txt{white-space:pre-wrap;font-size:13px;line-height:1.6;color:var(--text2);background:var(--card);border:1px solid var(--border);border-radius:var(--radius);padding:12px 14px;max-height:340px;overflow:auto}
  .cont-sec{font-size:11px;font-weight:600;color:var(--text3);text-transform:uppercase;letter-spacing:.06em;margin:16px 0 6px;display:flex;justify-content:space-between;align-items:center}
  .cont-sec button{font-size:11px;text-transform:none;letter-spacing:0}

  .cal-nav{display:flex;align-items:center;gap:10px;margin-bottom:12px}
  .cal-nav b{font-size:15px;color:var(--text);min-width:150px;text-align:center}
  .cal-nav button{background:var(--card);border:1px solid var(--border);color:var(--text2);border-radius:var(--radius);padding:5px 10px;cursor:pointer;font-family:inherit;font-size:13px}
  .cal-leg{display:flex;gap:12px;flex-wrap:wrap;font-size:11px;color:var(--text3);margin-left:auto}
  .cal-leg i{display:inline-block;width:8px;height:8px;border-radius:2px;margin-right:4px;vertical-align:0}
  .cal-grid{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));border-top:1px solid var(--border);border-left:1px solid var(--border)}
  .cal-wd{font-size:11px;color:var(--text3);text-transform:uppercase;letter-spacing:.06em;padding:6px 8px;border-right:1px solid var(--border);border-bottom:1px solid var(--border);background:var(--surface)}
  .cal-cel{min-height:118px;border-right:1px solid var(--border);border-bottom:1px solid var(--border);padding:6px;cursor:pointer;display:flex;flex-direction:column;gap:3px;min-width:0}
  .cal-cel:hover{background:rgba(255,255,255,.02)}
  .cal-cel.fora{opacity:.35}
  .cal-cel.hoje{background:var(--accent-dim)}
  .cal-cel.sel{outline:1px solid var(--accent);outline-offset:-1px}
  .cal-n{font-size:12px;color:var(--text2);font-weight:600;margin-bottom:2px}
  .cal-cel.hoje .cal-n{color:var(--accent)}
  .cal-it{font-size:11px;line-height:1.3;padding:3px 6px;border-radius:4px;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;border-left:3px solid var(--border2);background:var(--card)}
  .cal-it:hover{background:var(--card-hover)}
  .cal-it.publicado{opacity:.5;text-decoration:line-through}
  .cal-it.b-Reels{border-left-color:#f08a8a} .cal-it.b-Carrossel{border-left-color:var(--accent)} .cal-it.b-Live{border-left-color:var(--green)} .cal-it.b-Foto{border-left-color:var(--text3)} .cal-it.b-Stories{border-left-color:var(--amber)}
  .cal-grav{font-size:10.5px;color:var(--amber);padding:2px 6px;border-radius:4px;background:var(--amber-dim);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .cal-dots{display:none}
  .cal-dia-lista{margin-top:14px}
  .cf-lab{display:flex;justify-content:space-between;align-items:center}
  .cf-lab button{font-size:11px;padding:2px 6px}
  .grid-3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px}
  @media (max-width:640px){
    .cont-row{grid-template-columns:48px 1fr;gap:4px 10px;align-items:start}
    .cont-row > .cont-dia{grid-column:1;grid-row:1 / span 3}
    .cont-row > .cont-fmt{grid-column:2;grid-row:1;justify-self:start}
    .cont-row > div:nth-child(3){grid-column:2;grid-row:2}
    .cont-row > .cont-st{grid-column:2;grid-row:3}
    .grid-3{grid-template-columns:1fr}
    .cal-cel{min-height:54px;padding:4px}
    .cal-cel .cal-it,.cal-cel .cal-grav{display:none}
    .cal-dots{display:flex;gap:3px;flex-wrap:wrap}
    .cal-dots i{width:6px;height:6px;border-radius:50%;background:var(--text3)}
    .cal-dots i.b-Reels{background:#f08a8a} .cal-dots i.b-Carrossel{background:var(--accent)} .cal-dots i.b-Live{background:var(--green)} .cal-dots i.g{background:var(--amber)}
    .cal-wd{padding:4px 2px;text-align:center;font-size:10px}
    .cal-leg{margin-left:0}
  }`;
  document.head.appendChild(s);
}

async function escRenderConteudo(el) {
  contCss();
  el.innerHTML = `<div style="color:var(--text3);font-size:13px;text-align:center;padding:40px">Carregando...</div>`;
  try {
    CONT_STATE.lista = await escGet('/rest/v1/escritorio_conteudo?status=neq.arquivado&order=data_publicacao.asc.nullslast&limit=500');
  } catch (e) {
    el.innerHTML = `<div class="esc-empty"><div class="esc-empty-title">Não consegui carregar o conteúdo</div><div class="esc-empty-sub">${escEsc(e.message)}</div></div>`;
    return;
  }
  contDesenhar(el);
}

function contDesenhar(el) {
  el = el || document.getElementById('esc-content');
  const v = CONT_STATE.vista;
  el.innerHTML = `
    <div class="cont-top">
      <div>
        <div style="font-size:18px;font-weight:700;color:var(--text)">Conteúdo</div>
        <div style="font-size:12px;color:var(--text3);margin-top:2px">O que gravar, o que postar e quando</div>
      </div>
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
        <div class="cont-switch">
          <button class="${v==='calendario'?'on':''}" onclick="contVista('calendario')">Calendário</button>
          <button class="${v==='semanas'?'on':''}" onclick="contVista('semanas')">Lista</button>
          <button class="${v==='status'?'on':''}" onclick="contVista('status')">Por status</button>
        </div>
        <button class="btn btn-primary" onclick="contAbrir(null)">${icon('plus','14')} Novo conteúdo</button>
      </div>
    </div>
    ${v === 'calendario' ? contHtmlCalendario() : v === 'semanas' ? contHtmlGravar() + contHtmlSemanas() : contHtmlStatus()}`;
}
function contVista(v) { CONT_STATE.vista = v; contDesenhar(); }

function contLinha(c) {
  const feito = c.status === 'publicado';
  const grav = c.data_gravacao && (c.status === 'ideia' || c.status === 'producao')
    ? `<span class="cont-chip grav">gravar ${contDia(c.data_gravacao).toLowerCase()} ${contDM(c.data_gravacao)}</span>` : '';
  return `<div class="cont-row ${feito?'feito':''}" onclick="contAbrir('${c.id}')">
    <div class="cont-dia">${contDia(c.data_publicacao)}<small>${contDM(c.data_publicacao)}</small></div>
    <div class="cont-fmt f-${escEsc(c.formato||'')}">${escEsc(c.formato||'—')}</div>
    <div>
      <div class="cont-tit">${escEsc(c.titulo)}</div>
      <div class="cont-meta">
        ${c.pilar?`<span class="cont-chip">${escEsc(c.pilar)}</span>`:''}
        ${c.palavra_chave?`<span class="cont-chip pal">${escEsc(c.palavra_chave)}</span>`:''}
        ${c.referencia?`<span class="cont-chip">${escEsc(c.referencia)}</span>`:''}
        ${grav}
      </div>
    </div>
    <div class="cont-st ${c.status}">${contStatusLabel(c.status)}</div>
  </div>`;
}

function contHtmlGravar() {
  const hoje = contHojeISO(), lim = contSomaDias(hoje, 7);
  const itens = CONT_STATE.lista.filter(c => c.data_gravacao && c.data_gravacao <= lim
    && (c.status === 'ideia' || c.status === 'producao')
    && (!c.data_publicacao || c.data_publicacao >= hoje))
    .sort((a, b) => (a.data_gravacao + (a.data_publicacao||'')).localeCompare(b.data_gravacao + (b.data_publicacao||'')));
  if (!itens.length) return '';
  const dias = {};
  itens.forEach(c => { (dias[c.data_gravacao] = dias[c.data_gravacao] || []).push(c); });
  return `<div class="cont-gravar"><div class="cont-gravar-t">Para gravar nos próximos 7 dias</div>
    ${Object.keys(dias).sort().map(d => `
      <div class="cont-gravar-dia">${d < hoje ? 'Atrasado · ' : d === hoje ? 'Hoje · ' : ''}${contDia(d)} ${contDM(d)}</div>
      ${dias[d].map(contLinha).join('')}`).join('')}
  </div>`;
}

function contHtmlSemanas() {
  const hoje = contHojeISO(), segAtual = contSegunda(hoje);
  const semanas = {};
  const semData = [];
  CONT_STATE.lista.forEach(c => {
    if (!c.data_publicacao) { semData.push(c); return; }
    const s = contSegunda(c.data_publicacao);
    if (!CONT_STATE.passadas && s < segAtual) return;
    (semanas[s] = semanas[s] || []).push(c);
  });
  const chaves = Object.keys(semanas).sort();
  let html = `<div style="display:flex;justify-content:flex-end;margin:-8px 0 10px">
    <button class="btn btn-ghost" style="font-size:12px" onclick="CONT_STATE.passadas=!CONT_STATE.passadas;contDesenhar()">
      ${CONT_STATE.passadas ? 'Esconder semanas passadas' : 'Mostrar semanas passadas'}</button></div>`;
  if (!chaves.length && !semData.length) {
    return html + `<div class="esc-empty" style="min-height:180px"><div class="esc-empty-title">Nenhum conteúdo planejado</div><div class="esc-empty-sub">Adicione um novo conteúdo para começar.</div></div>`;
  }
  html += chaves.map(s => {
    const itens = semanas[s];
    const fases = {}; itens.forEach(c => { if (c.fase) fases[c.fase] = (fases[c.fase] || 0) + 1; });
    const fase = Object.keys(fases).sort((a, b) => fases[b] - fases[a])[0] || '';
    return `<div class="cont-sem ${s === segAtual ? 'atual' : ''}">
      <div class="cont-sem-h"><b>${s === segAtual ? 'Esta semana · ' : ''}${contDM(s)} a ${contDM(contSomaDias(s, 6))}</b><span>${escEsc(fase)}</span></div>
      ${itens.map(contLinha).join('')}
    </div>`;
  }).join('');
  if (semData.length) html += `<div class="cont-sem"><div class="cont-sem-h"><b>Sem data</b><span>ideias para encaixar</span></div>${semData.map(contLinha).join('')}</div>`;
  return html;
}

function contHtmlStatus() {
  const st = CONT_STATE.tabStatus || 'ideia';
  const itens = CONT_STATE.lista.filter(c => c.status === st);
  return `<div class="esc-tabs">${CONT_STATUS.map(s => `<button class="esc-tab ${s.v===st?'active':''}" onclick="CONT_STATE.tabStatus='${s.v}';contDesenhar()">${s.l} (${CONT_STATE.lista.filter(c=>c.status===s.v).length})</button>`).join('')}</div>
    ${itens.length ? itens.map(contLinha).join('') : `<div class="esc-empty" style="min-height:160px"><div class="esc-empty-title">Nenhum conteúdo aqui</div></div>`}`;
}


/* ── CALENDÁRIO DO MÊS ── */
function contMudarMes(n) {
  const [a, m] = CONT_STATE.mes.split('-').map(Number);
  const d = new Date(a, m - 1 + n, 1);
  CONT_STATE.mes = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
  CONT_STATE.diaSel = null;
  contDesenhar();
}
function contMesHoje() { CONT_STATE.mes = contHojeISO().slice(0, 7); CONT_STATE.diaSel = null; contDesenhar(); }
function contClicarDia(iso) {
  if (window.matchMedia('(max-width:640px)').matches) { CONT_STATE.diaSel = iso; contDesenhar(); return; }
  contAbrir(null, iso);
}
function contHtmlCalendario() {
  if (!CONT_STATE.mes) CONT_STATE.mes = contHojeISO().slice(0, 7);
  const hoje = contHojeISO();
  const ini = CONT_STATE.mes + '-01';
  const primeiro = contSegunda(ini);
  const [a, m] = CONT_STATE.mes.split('-').map(Number);
  const ultimoDia = new Date(a, m, 0).getDate();
  const fim = contSomaDias(contSegunda(CONT_STATE.mes + '-' + String(ultimoDia).padStart(2, '0')), 6);
  const porPub = {}, porGrav = {};
  CONT_STATE.lista.forEach(c => {
    if (c.data_publicacao) (porPub[c.data_publicacao] = porPub[c.data_publicacao] || []).push(c);
    if (c.data_gravacao && (c.status === 'ideia' || c.status === 'producao')) (porGrav[c.data_gravacao] = porGrav[c.data_gravacao] || []).push(c);
  });
  let nomeMes = new Date(a, m - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  nomeMes = nomeMes.charAt(0).toUpperCase() + nomeMes.slice(1);
  let cels = '';
  for (let d = primeiro; d <= fim; d = contSomaDias(d, 1)) {
    const pubs = porPub[d] || [], gravs = porGrav[d] || [];
    const cls = ['cal-cel', d.slice(0, 7) !== CONT_STATE.mes ? 'fora' : '', d === hoje ? 'hoje' : '', d === CONT_STATE.diaSel ? 'sel' : ''].join(' ');
    cels += `<div class="${cls}" onclick="contClicarDia('${d}')">
      <div class="cal-n">${Number(d.slice(8))}</div>
      ${gravs.length ? `<div class="cal-grav" title="${escEsc(gravs.map(g => g.titulo).join(' · '))}">Gravar ${gravs.length}: ${escEsc(gravs.map(g => g.formato).join(', '))}</div>` : ''}
      ${pubs.map(c => `<div class="cal-it b-${escEsc(c.formato||'')} ${c.status}" title="${escEsc(c.formato||'')} · ${escEsc(c.titulo)}" onclick="event.stopPropagation();contAbrir('${c.id}')">${escEsc(c.titulo)}</div>`).join('')}
      <div class="cal-dots">${gravs.length ? '<i class="g"></i>' : ''}${pubs.map(c => `<i class="b-${escEsc(c.formato||'')}"></i>`).join('')}</div>
    </div>`;
  }
  let lista = '';
  if (CONT_STATE.diaSel) {
    const d = CONT_STATE.diaSel;
    const pubs = porPub[d] || [], gravs = porGrav[d] || [];
    lista = `<div class="cal-dia-lista"><div class="cont-sem-h"><b>${contDia(d)} ${contDM(d)}</b>
      <button class="btn btn-secondary" style="font-size:12px;padding:4px 10px" onclick="contAbrir(null,'${d}')">${icon('plus','12')} Adicionar</button></div>
      ${gravs.length ? `<div class="cont-gravar-dia" style="color:var(--amber)">Gravar neste dia</div>${gravs.map(contLinha).join('')}` : ''}
      ${pubs.length ? `<div class="cont-gravar-dia">Postar neste dia</div>${pubs.map(contLinha).join('')}` : ''}
      ${!gravs.length && !pubs.length ? '<div style="font-size:12px;color:var(--text3);padding:8px 0">Nada neste dia.</div>' : ''}</div>`;
  }
  return `<div class="cal-nav">
      <button onclick="contMudarMes(-1)">‹</button><b>${nomeMes}</b><button onclick="contMudarMes(1)">›</button>
      <button onclick="contMesHoje()">Hoje</button>
      <div class="cal-leg"><span><i style="background:#f08a8a"></i>Reels</span><span><i style="background:var(--accent)"></i>Carrossel</span><span><i style="background:var(--green)"></i>Live</span><span><i style="background:var(--text3)"></i>Foto</span><span><i style="background:var(--amber)"></i>Gravar</span></div>
    </div>
    <div class="cal-grid">${['Seg','Ter','Qua','Qui','Sex','Sáb','Dom'].map(w => `<div class="cal-wd">${w}</div>`).join('')}${cels}</div>
    ${lista}`;
}

/* ── FICHA DO CONTEÚDO ── */
function contAbrir(id, dataPadrao) {
  const c = id ? CONT_STATE.lista.find(x => x.id === id) : { status: 'ideia', canal: 'Instagram', data_publicacao: dataPadrao || '' };
  if (!c) return;
  CONT_STATE.editando = id;
  const opt = (arr, val) => arr.map(o => `<option ${o===val?'selected':''}>${escEsc(o)}</option>`).join('');
  const area = (k, label, rows, ph) => `<div class="esc-field"><label class="esc-label cf-lab"><span>${label}</span>
      <button class="btn btn-ghost" type="button" onclick="contCopiar('${k}')">Copiar</button></label>
      <textarea class="esc-textarea" id="cf-${k}" rows="${rows}" placeholder="${ph||''}">${escEsc(c[k]||'')}</textarea></div>`;

  document.getElementById('esc-modal-title').textContent = id
    ? `${contDia(c.data_publicacao)} ${contDM(c.data_publicacao)} · ${c.formato||'Conteúdo'}`
    : 'Novo conteúdo' + (dataPadrao ? ` · ${contDia(dataPadrao)} ${contDM(dataPadrao)}` : '');
  const box = document.getElementById('esc-modal-box') || document.getElementById('esc-modal-overlay').firstElementChild;
  if (box) { if (box.dataset.mw === undefined) box.dataset.mw = box.style.maxWidth || ''; box.style.maxWidth = '760px'; }
  document.getElementById('esc-modal-body').innerHTML = `
    <div class="esc-field"><label class="esc-label">Título</label><input class="esc-input" id="cf-titulo" value="${escEsc(c.titulo||'')}"></div>
    <div class="grid-3">
      <div class="esc-field"><label class="esc-label">Formato</label><select class="esc-select" id="cf-formato"><option value="">—</option>${opt(CONT_FORMATOS, c.formato)}</select></div>
      <div class="esc-field"><label class="esc-label">Postar em</label><input class="esc-input" type="date" id="cf-data_publicacao" value="${c.data_publicacao||''}"></div>
      <div class="esc-field"><label class="esc-label">Gravar em</label><input class="esc-input" type="date" id="cf-data_gravacao" value="${c.data_gravacao||''}"></div>
    </div>
    <div class="grid-3">
      <div class="esc-field"><label class="esc-label">Status</label><select class="esc-select" id="cf-status">${CONT_STATUS.map(s=>`<option value="${s.v}" ${s.v===c.status?'selected':''}>${s.l}</option>`).join('')}</select></div>
      <div class="esc-field"><label class="esc-label">Pilar</label><select class="esc-select" id="cf-pilar"><option value="">—</option>${opt(CONT_PILARES, c.pilar)}</select></div>
      <div class="esc-field"><label class="esc-label">Palavra-chave</label><input class="esc-input" id="cf-palavra_chave" value="${escEsc(c.palavra_chave||'')}" placeholder="ex.: PLANO"></div>
    </div>
    ${area('ideia','Ideia e função',2,'Do que se trata e para que serve')}
    ${area('roteiro','Roteiro',8,'Fala a fala, texto da tela, onde gravar')}
    ${area('legenda','Legenda',5,'Texto da legenda')}
    ${area('stories','Stories de reforço',3,'O que postar nos stories')}
    ${area('observacoes','Observações',2,'')}
    <div class="grid-2">
      <div class="esc-field"><label class="esc-label">Fase do plano</label><input class="esc-input" id="cf-fase" value="${escEsc(c.fase||'')}"></div>
      <div class="esc-field"><label class="esc-label">Modelo / estrutura</label><input class="esc-input" id="cf-referencia" value="${escEsc(c.referencia||'')}"></div>
    </div>
    <div style="display:flex;gap:10px;justify-content:space-between;margin-top:18px;flex-wrap:wrap">
      <div>${id ? `<button class="btn btn-danger" onclick="contArquivar()">Arquivar</button>` : ''}</div>
      <div style="display:flex;gap:10px">
        <button class="btn btn-secondary" onclick="escFecharModal()">Fechar</button>
        <button class="btn btn-primary" onclick="contSalvar()">Salvar</button>
      </div>
    </div>`;
  escAbrirModal();
}

function contCopiar(k) {
  const el = document.getElementById('cf-' + k);
  const txt = el ? el.value : '';
  if (!txt) { escToast('Campo vazio.'); return; }
  navigator.clipboard.writeText(txt).then(() => escToast('Copiado.'), () => escToast('Não consegui copiar.'));
}

async function contSalvar() {
  const campos = ['titulo','formato','data_publicacao','data_gravacao','status','pilar','palavra_chave','ideia','roteiro','legenda','stories','observacoes','fase','referencia'];
  const obj = {};
  campos.forEach(k => { const el = document.getElementById('cf-' + k); if (el) obj[k] = el.value.trim() || null; });
  if (!obj.titulo) { escToast('Informe o título.'); return; }
  if (obj.palavra_chave) obj.palavra_chave = obj.palavra_chave.toUpperCase();
  obj.status = obj.status || 'ideia';
  try {
    if (CONT_STATE.editando) {
      obj.updated_at = new Date().toISOString();
      await escPatch('escritorio_conteudo', CONT_STATE.editando, obj);
    } else {
      Object.assign(obj, { canal: 'Instagram', responsavel_id: ESC_STATE.usuario, created_by: ESC_STATE.usuario });
      await escPost('escritorio_conteudo', obj);
    }
    escToast('Salvo.');
    escFecharModal();
    escRenderConteudo(document.getElementById('esc-content'));
  } catch (e) { escToast('Não consegui salvar: ' + e.message); }
}

async function contArquivar() {
  if (!CONT_STATE.editando) return;
  try {
    await escPatch('escritorio_conteudo', CONT_STATE.editando, { status: 'arquivado', updated_at: new Date().toISOString() });
    escToast('Arquivado.');
    escFecharModal();
    escRenderConteudo(document.getElementById('esc-content'));
  } catch (e) { escToast('Não consegui arquivar: ' + e.message); }
}
