/* ══════════════════════════════════════════════════
   MÓDULO PROJETOS — escritorio-interno
   Kanban por status · Projetos da Amanda separados
   ══════════════════════════════════════════════════ */

const P_STATUS = {
  planejamento:  { label: 'Planejamento',  cor: 'gray'   },
  em_andamento:  { label: 'Em andamento',  cor: 'blue'   },
  pausado:       { label: 'Pausado',       cor: 'amber'  },
  concluido:     { label: 'Concluído',     cor: 'green'  },
  cancelado:     { label: 'Cancelado',     cor: 'red'    },
};
const P_PRIORIDADE = {
  baixa:   { label: 'Baixa',   cor: 'gray'  },
  normal:  { label: 'Normal',  cor: 'blue'  },
  alta:    { label: 'Alta',    cor: 'amber' },
  urgente: { label: 'Urgente', cor: 'red'   },
};
const P_AREAS = ['JS Mentoria', 'Moni Sul', 'Interno'];
const P_RESPONSAVEIS = ['Jéssica', 'Amanda'];

// Colunas Kanban: só os status relevantes (cancelado fica oculto por padrão)
const P_KANBAN_COLS = [
  { status: 'em_andamento', label: 'Em andamento', cor: 'var(--accent)',  icone: '▶' },
  { status: 'planejamento', label: 'Planejamento',  cor: 'var(--text3)',  icone: '○' },
  { status: 'pausado',      label: 'Pausado',       cor: 'var(--amber)',  icone: '⏸' },
  { status: 'concluido',    label: 'Concluído',     cor: 'var(--green)',  icone: '✓' },
];

let _pfiltros = { area: '', prioridade: '' };
let _projetosCache = [];
let _pEditandoId = null;
let _pDetalheId  = null;

// ── RENDER PRINCIPAL ──
async function escRenderProjetos(el) {
  el.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:16px">
      <div>
        <p class="page-title" style="margin-bottom:2px">Projetos</p>
        <p class="page-sub" style="margin-top:0">Execução do que importa — por status</p>
      </div>
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
        <select class="esc-select" style="width:auto;min-width:120px" onchange="pSetFiltro('area',this.value)">
          <option value="">Todas as áreas</option>
          ${P_AREAS.map(a=>`<option value="${a}">${a}</option>`).join('')}
        </select>
        <select class="esc-select" style="width:auto;min-width:120px" onchange="pSetFiltro('prioridade',this.value)">
          <option value="">Todas as prioridades</option>
          ${Object.entries(P_PRIORIDADE).map(([k,v])=>`<option value="${k}">${v.label}</option>`).join('')}
        </select>
        <button class="btn btn-primary" onclick="pAbrirForm()">+ Novo projeto</button>
      </div>
    </div>
    <div id="p-kpis" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:10px;margin-bottom:20px"></div>
    <div id="p-kanban">
      <div style="color:var(--text3);text-align:center;padding:40px">Carregando projetos...</div>
    </div>
  `;
  await pCarregar();
}

function pSetFiltro(k, v) { _pfiltros[k] = v; pRenderKanban(); }

async function pCarregar() {
  try {
    _projetosCache = await escGet('/rest/v1/escritorio_projetos?order=created_at.asc');
  } catch(e) { _projetosCache = []; console.error(e); }
  pRenderKpis();
  await pRenderKanban();
}

function pRenderKpis() {
  const hoje = new Date().toISOString().split('T')[0];
  const meus = _projetosCache.filter(p => p.responsavel_id !== 'Amanda' || !p.responsavel_id);
  const kpis = [
    { val: meus.filter(p=>p.status==='em_andamento').length, lbl: 'Em andamento', cor: 'accent' },
    { val: meus.filter(p=>p.prazo&&p.prazo<hoje&&!['concluido','cancelado'].includes(p.status)).length, lbl: 'Atrasados', cor: 'red' },
    { val: _projetosCache.filter(p=>p.responsavel_id==='Amanda'&&p.status==='em_andamento').length, lbl: 'Amanda', cor: '' },
    { val: _projetosCache.filter(p=>p.status==='concluido').length, lbl: 'Concluídos', cor: 'green' },
  ];
  const CORES = { accent:'var(--accent)', red:'var(--red)', green:'var(--green)', '':'var(--text)' };
  const el = document.getElementById('p-kpis');
  if (el) el.innerHTML = kpis.map(k=>`
    <div class="esc-kpi" style="${k.cor?`border-color:${CORES[k.cor]}22`:''}">
      <div class="esc-kpi-val" style="color:${CORES[k.cor]};font-size:22px">${k.val}</div>
      <div class="esc-kpi-lbl">${k.lbl}</div>
    </div>`).join('');
}

async function pRenderKanban() {
  const el = document.getElementById('p-kanban');
  if (!el) return;

  // Buscar contagem de tarefas por projeto
  const ids = _projetosCache.map(p=>p.id);
  let tarefasPorProjeto = {};
  if (ids.length) {
    try {
      const tAll = await escGet('/rest/v1/escritorio_tarefas?projeto_id=in.('+ids.join(',')+')'+'&select=id,projeto_id,status');
      tAll.forEach(t => {
        if (!tarefasPorProjeto[t.projeto_id]) tarefasPorProjeto[t.projeto_id] = { total:0, concluidas:0 };
        tarefasPorProjeto[t.projeto_id].total++;
        if (t.status==='concluida') tarefasPorProjeto[t.projeto_id].concluidas++;
      });
    } catch(e) {}
  }

  const hoje = new Date().toISOString().split('T')[0];
  const prioOrdem = { urgente:0, alta:1, normal:2, baixa:3 };

  // Separar: meus x Amanda
  let meus   = _projetosCache.filter(p => p.responsavel_id !== 'Amanda');
  let amanda = _projetosCache.filter(p => p.responsavel_id === 'Amanda');

  // Aplicar filtros
  const filtrar = lista => {
    if (_pfiltros.area)      lista = lista.filter(p => p.area === _pfiltros.area);
    if (_pfiltros.prioridade) lista = lista.filter(p => p.prioridade === _pfiltros.prioridade);
    return lista;
  };
  meus   = filtrar(meus);
  amanda = filtrar(amanda);

  // Ordenar dentro de cada coluna por prioridade → prazo
  const ordenar = lista => lista.sort((a,b) => {
    const pa = prioOrdem[a.prioridade]??2, pb = prioOrdem[b.prioridade]??2;
    if (pa!==pb) return pa-pb;
    if (a.prazo&&b.prazo) return a.prazo.localeCompare(b.prazo);
    return 0;
  });

  // Render das colunas para um conjunto de projetos
  const renderCols = (lista) => P_KANBAN_COLS.map(col => {
    const cards = ordenar(lista.filter(p => p.status === col.status));
    return `
      <div style="flex:0 0 260px;min-width:0">
        <!-- Cabeçalho da coluna -->
        <div style="display:flex;align-items:center;gap:8px;padding:10px 12px;margin-bottom:8px;border-bottom:2px solid ${col.cor}20">
          <span style="color:${col.cor};font-size:13px">${col.icone}</span>
          <span style="font-size:12px;font-weight:600;color:var(--text2);text-transform:uppercase;letter-spacing:.06em">${col.label}</span>
          <span style="font-size:11px;color:var(--text3);margin-left:auto;background:var(--bg2);padding:1px 7px;border-radius:10px">${cards.length}</span>
        </div>
        <!-- Cards -->
        <div style="display:flex;flex-direction:column;gap:10px;min-height:60px">
          ${cards.length ? cards.map(p => pCardHtml(p, tarefasPorProjeto[p.id]||{total:0,concluidas:0}, hoje, col.cor)).join('')
            : `<div style="border:1.5px dashed var(--border2);border-radius:8px;padding:16px;text-align:center;color:var(--text3);font-size:12px;opacity:.6">Nenhum projeto</div>`}
        </div>
      </div>`;
  }).join('');

  let html = '';

  if (!_projetosCache.length) {
    html = `<div style="color:var(--text3);text-align:center;padding:60px 20px">
      <div style="font-size:32px;opacity:.3;margin-bottom:12px">📁</div>
      <div>Nenhum projeto ainda.</div>
      <button class="btn btn-secondary btn-sm" style="margin-top:16px" onclick="pAbrirForm()">+ Criar primeiro projeto</button>
    </div>`;
  } else {
    // Seção Meus Projetos
    html += `
      <div style="overflow-x:auto;padding-bottom:8px">
        <div style="display:flex;gap:14px;min-width:max-content">
          ${renderCols(meus)}
        </div>
      </div>`;

    // Seção Amanda (se houver)
    if (amanda.length) {
      html += `
        <div style="margin-top:32px">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px">
            <div style="height:1px;flex:1;background:var(--border)"></div>
            <span style="font-size:11px;font-weight:600;color:var(--text3);text-transform:uppercase;letter-spacing:.08em;white-space:nowrap;padding:4px 10px;background:var(--bg2);border-radius:20px;border:1px solid var(--border)">📋 Projetos da Amanda</span>
            <div style="height:1px;flex:1;background:var(--border)"></div>
          </div>
          <div style="overflow-x:auto;padding-bottom:8px">
            <div style="display:flex;gap:14px;min-width:max-content">
              ${renderCols(amanda)}
            </div>
          </div>
        </div>`;
    }
  }

  el.innerHTML = html;
}

function pCardHtml(p, prog, hoje, colCor) {
  const atrasado = p.prazo && p.prazo < hoje && !['concluido','cancelado'].includes(p.status);
  const pr  = P_PRIORIDADE[p.prioridade] || { label: p.prioridade, cor: 'gray' };
  const pct = prog.total > 0 ? Math.round(prog.concluidas/prog.total*100) : -1;
  const AREA_COR = { 'JS Mentoria':'area-js', 'Moni Sul':'area-moni', 'Interno':'area-js' };
  const PRIO_BORDA = { urgente:'var(--red)', alta:'var(--amber)', normal:'transparent', baixa:'transparent' };

  return `
    <div class="esc-card" style="cursor:pointer;padding:12px;border-left:3px solid ${PRIO_BORDA[p.prioridade]||'transparent'};${atrasado?'border-top:2px solid var(--red)20;':''}"
      onclick="pAbrirDetalhe('${p.id}')">

      <!-- Topo: área + badge prioridade urgente/alta -->
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:6px;margin-bottom:8px">
        <div style="display:flex;gap:4px;flex-wrap:wrap;align-items:center">
          ${p.area?`<span class="${AREA_COR[p.area]||'area-js'}" style="font-size:9px">${p.area}</span>`:''}
          ${atrasado?'<span class="badge badge-red" style="font-size:9px">Atrasado</span>':''}
        </div>
        ${p.prioridade==='urgente'||p.prioridade==='alta'?`<span class="badge badge-${pr.cor}" style="font-size:9px;flex-shrink:0">${pr.label}</span>`:''}
      </div>

      <!-- Nome -->
      <div style="font-size:14px;font-weight:600;color:var(--text);margin-bottom:6px;line-height:1.3">${escEsc(p.nome)}</div>

      <!-- Progresso (só se tiver tarefas) -->
      ${pct >= 0 ? `
        <div style="margin-bottom:8px">
          <div style="height:3px;background:var(--border);border-radius:2px;overflow:hidden">
            <div style="height:100%;width:${pct}%;background:${pct===100?'var(--green)':'var(--accent)'};border-radius:2px"></div>
          </div>
          <div style="font-size:10px;color:var(--text3);margin-top:3px">${prog.concluidas}/${prog.total} tarefas · ${pct}%</div>
        </div>` : `<div style="font-size:10px;color:var(--text3);margin-bottom:8px;opacity:.6">Sem tarefas vinculadas</div>`}

      <!-- Footer: prazo + ações rápidas -->
      <div style="display:flex;align-items:center;justify-content:space-between;gap:6px;flex-wrap:wrap">
        <span style="font-size:10px;color:${atrasado?'var(--red)':'var(--text3)'}">${p.prazo?'📅 '+tFormatarData(p.prazo):''}</span>
        <div style="display:flex;gap:4px" onclick="event.stopPropagation()">
          ${p.status!=='concluido'
            ? `<button class="btn btn-secondary btn-sm" style="font-size:10px;padding:2px 7px;color:var(--green);border-color:var(--green)20" onclick="pConcluir('${p.id}')">✓</button>`
            : `<button class="btn btn-secondary btn-sm" style="font-size:10px;padding:2px 7px;color:var(--text3)" onclick="pDesconcluir('${p.id}')" title="Reabrir">↩</button>`}
          <button class="btn btn-secondary btn-sm" style="font-size:10px;padding:2px 7px" onclick="pAbrirForm('${p.id}')">✏</button>
        </div>
      </div>
    </div>`;
}

// ── DETALHE DO PROJETO ──
async function pAbrirDetalhe(id) {
  _pDetalheId = id;
  const p = _projetosCache.find(x=>x.id===id);
  if (!p) return;

  const content = document.getElementById('esc-content');
  content.innerHTML = `<div style="color:var(--text3);text-align:center;padding:40px">Carregando...</div>`;

  let tarefas = [];
  try { tarefas = await escGet(`/rest/v1/escritorio_tarefas?${escFiltroDono()}&projeto_id=eq.${id}&order=created_at.desc`); }
  catch(e) {}

  const hoje = new Date().toISOString().split('T')[0];
  const total = tarefas.length;
  const concluidas   = tarefas.filter(t=>t.status==='concluida').length;
  const emAndamento  = tarefas.filter(t=>t.status==='em_andamento').length;
  const aFazer       = tarefas.filter(t=>t.status==='a_fazer').length;
  const pausadas     = tarefas.filter(t=>t.status==='pausada').length;
  const atrasadas    = tarefas.filter(t=>t.prazo&&t.prazo<hoje&&t.status!=='concluida').length;
  const pct = total > 0 ? Math.round(concluidas/total*100) : 0;

  const atrasado = p.prazo&&p.prazo<hoje&&!['concluido','cancelado'].includes(p.status);
  const st = P_STATUS[p.status]||{label:p.status,cor:'gray'};
  const pr = P_PRIORIDADE[p.prioridade]||{label:p.prioridade,cor:'gray'};
  const AREA_COR = {'JS Mentoria':'area-js','Moni Sul':'area-moni','Interno':'area-js'};

  content.innerHTML = `
    <!-- Breadcrumb -->
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:20px;font-size:13px">
      <span style="color:var(--text3);cursor:pointer" onclick="escNavegar('projetos')">← Projetos</span>
    </div>

    <!-- Header -->
    <div style="display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:24px">
      <div>
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:6px">
          ${p.area?`<span class="${AREA_COR[p.area]||'area-js'}">${p.area}</span>`:''}
          <span class="badge badge-${st.cor}">${st.label}</span>
          <span class="badge badge-${pr.cor}">${pr.label}</span>
          ${atrasado?'<span class="badge badge-red">Atrasado</span>':''}
          ${p.responsavel_id?`<span style="font-size:11px;color:var(--text3);padding:2px 8px;background:var(--bg2);border-radius:10px;border:1px solid var(--border)">👤 ${escEsc(p.responsavel_id)}</span>`:''}
        </div>
        <h2 style="font-size:22px;font-weight:700;color:var(--text);margin-bottom:4px">${escEsc(p.nome)}</h2>
        ${p.descricao?`<p style="font-size:13px;color:var(--text2);line-height:1.6">${escEsc(p.descricao)}</p>`:''}
      </div>
      <div style="display:flex;gap:8px;flex-shrink:0">
        <button class="btn btn-secondary btn-sm" onclick="pAbrirForm('${id}')">✏ Editar</button>
        ${p.status!=='concluido'
          ? `<button class="btn btn-secondary btn-sm" style="color:var(--green);border-color:var(--green)" onclick="pConcluir('${id}')">✓ Concluir</button>`
          : `<button class="btn btn-secondary btn-sm" style="color:var(--text3)" onclick="pDesconcluir('${id}')">↩ Reabrir</button>`}
      </div>
    </div>

    <!-- Info + progresso -->
    <div class="esc-grid-2" style="margin-bottom:24px;gap:16px">
      <div class="esc-card">
        <div class="esc-card-title">Informações</div>
        <div style="display:flex;flex-direction:column;gap:10px">
          ${p.objetivo?`<div><div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:2px">Objetivo</div><div style="font-size:13px;color:var(--text2)">${escEsc(p.objetivo)}</div></div>`:''}
          ${p.resultado_esperado?`<div><div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:2px">Resultado esperado</div><div style="font-size:13px;color:var(--text2)">${escEsc(p.resultado_esperado)}</div></div>`:''}
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
            ${p.responsavel_id?`<div><div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:2px">Responsável</div><div style="font-size:13px;color:var(--text)">${escEsc(p.responsavel_id)}</div></div>`:''}
            ${p.prazo?`<div><div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:2px">Prazo</div><div style="font-size:13px;color:${atrasado?'var(--red)':'var(--text)'}">${tFormatarData(p.prazo)}</div></div>`:''}
            ${p.data_inicio?`<div><div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:2px">Início</div><div style="font-size:13px;color:var(--text)">${tFormatarData(p.data_inicio)}</div></div>`:''}
          </div>
        </div>
      </div>

      <div class="esc-card">
        <div class="esc-card-title">Progresso</div>
        ${total===0 ? `
          <div style="color:var(--text3);font-size:13px;text-align:center;padding:20px 0">Nenhuma tarefa vinculada ainda.</div>
          <button class="btn btn-secondary btn-sm" style="width:100%;justify-content:center" onclick="pNovaTarefaNoprojeto('${id}')">+ Adicionar primeira tarefa</button>
        ` : `
          <div style="margin-bottom:12px">
            <div style="display:flex;justify-content:space-between;margin-bottom:6px">
              <span style="font-size:13px;color:var(--text2)">${concluidas} de ${total} tarefas concluídas</span>
              <span style="font-size:16px;font-weight:700;color:${pct===100?'var(--green)':'var(--accent)'}">${pct}%</span>
            </div>
            <div style="height:8px;background:var(--border);border-radius:4px;overflow:hidden">
              <div style="height:100%;width:${pct}%;background:${pct===100?'var(--green)':'var(--accent)'};border-radius:4px;transition:width .4s"></div>
            </div>
          </div>
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(80px,1fr));gap:8px">
            ${[
              {val:concluidas, lbl:'Concluídas',  cor:'green'},
              {val:emAndamento,lbl:'Em andamento', cor:'accent'},
              {val:aFazer,     lbl:'A fazer',      cor:''},
              {val:pausadas,   lbl:'Pausadas',     cor:'amber'},
              {val:atrasadas,  lbl:'Atrasadas',    cor:'red'},
            ].map(k=>`<div style="text-align:center;padding:8px;background:var(--bg);border-radius:6px;border:1px solid var(--border)">
              <div style="font-size:18px;font-weight:700;color:${{green:'var(--green)',accent:'var(--accent)',amber:'var(--amber)',red:'var(--red)','':'var(--text)'}[k.cor]}">${k.val}</div>
              <div style="font-size:10px;color:var(--text3)">${k.lbl}</div>
            </div>`).join('')}
          </div>
        `}
      </div>
    </div>

    <!-- Tarefas do projeto -->
    <div class="esc-section">
      <div class="esc-section-header">
        <div class="esc-section-title">Tarefas do projeto</div>
        <button class="btn btn-secondary btn-sm" onclick="pNovaTarefaNoprojeto('${id}')">+ Nova tarefa</button>
      </div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px" id="pdet-views">
        ${['dia','semana','mes','atrasadas','concluidas','todas'].map(v=>`
          <button class="btn ${v==='semana'?'btn-primary':'btn-secondary'} btn-sm" style="font-size:11px" id="pdet-v-${v}" onclick="pDetViewTarefas('${id}','${v}')">${
            {dia:'Dia',semana:'Semana',mes:'Mês',atrasadas:'Atrasadas',concluidas:'Concluídas',todas:'Todas'}[v]
          }</button>`).join('')}
      </div>
      <div id="pdet-tarefas"></div>
    </div>`;
  _pDetTarefas = tarefas; _pDetView = 'semana'; _pDetRef = tHojeISO();
  pDetRenderTarefas();
}

let _pDetTarefas = [], _pDetView = 'semana', _pDetRef = null;
function pDetViewTarefas(projetoId, view) {
  _pDetView = view;
  if (!_pDetRef) _pDetRef = tHojeISO();
  document.querySelectorAll('[id^="pdet-v-"]').forEach(b=>{b.classList.remove('btn-primary');b.classList.add('btn-secondary');});
  const btn = document.getElementById('pdet-v-'+view);
  if (btn) { btn.classList.remove('btn-secondary'); btn.classList.add('btn-primary'); }
  pDetRenderTarefas();
}
function pDetPasso(passo) {
  _pDetRef = passo === 0 ? tHojeISO() : tPeriodoMover(_pDetView, _pDetRef || tHojeISO(), passo);
  pDetRenderTarefas();
}
function pDetRenderTarefas() {
  const el = document.getElementById('pdet-tarefas');
  if (!el) return;
  const hoje = tHojeISO();
  const tarefas = _pDetTarefas || [];
  if (!tarefas.length) { el.innerHTML = `<div style="color:var(--text3);font-size:13px;text-align:center;padding:30px">Nenhuma tarefa ainda.</div>`; return; }
  if (['dia','semana','mes'].includes(_pDetView)) {
    el.innerHTML = tPeriodoNavHtml(_pDetView, _pDetRef, 'pDetPasso') + tPeriodoListaHtml(tarefas, _pDetView, _pDetRef);
    return;
  }
  let lista = [...tarefas];
  if      (_pDetView==='atrasadas')  lista = lista.filter(t=>t.prazo&&t.prazo<hoje&&t.status!=='concluida');
  else if (_pDetView==='concluidas') lista = lista.filter(t=>t.status==='concluida');
  lista.sort((a,b)=>(a.prazo||'9999').localeCompare(b.prazo||'9999'));
  el.innerHTML = lista.length===0
    ? `<div style="color:var(--text3);font-size:13px;text-align:center;padding:30px">Nenhuma tarefa nessa categoria.</div>`
    : `<div class="esc-list">${lista.map(t=>tItemHtml(t,hoje)).join('')}</div>`;
}

function pNovaTarefaNoProjetoLaunch(pid) {
  if (typeof tAbrirFormComProjeto==='function') tAbrirFormComProjeto(pid);
  else if (typeof tAbrirForm==='function') tAbrirForm(null, pid);
}
function pNovaTarefaNoprojeto(pid) { pNovaTarefaNoProjetoLaunch(pid); }

// ── FORMULÁRIO PROJETO ──
function pAbrirForm(id) {
  _pEditandoId = id || null;
  const p = id ? _projetosCache.find(x=>x.id===id) : null;

  document.getElementById('esc-modal-title').textContent = p ? 'Editar projeto' : 'Novo projeto';
  document.getElementById('esc-modal-body').innerHTML = `
    <div class="esc-field">
      <label class="esc-label">Nome do projeto <span style="color:var(--red)">*</span></label>
      <input class="esc-input" id="pf-nome" value="${escEsc(p?.nome||'')}" placeholder="Ex: Calendário de Conteúdo de Outubro">
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
      <div class="esc-field">
        <label class="esc-label">Área <span style="color:var(--red)">*</span></label>
        <select class="esc-select" id="pf-area">
          <option value="">Selecionar</option>
          ${P_AREAS.map(a=>`<option value="${a}" ${p?.area===a?'selected':''}>${a}</option>`).join('')}
        </select>
      </div>
      <div class="esc-field">
        <label class="esc-label">Responsável</label>
        <select class="esc-select" id="pf-resp">
          <option value="">Selecionar</option>
          ${P_RESPONSAVEIS.map(r=>`<option value="${r}" ${p?.responsavel_id===r?'selected':''}>${r}</option>`).join('')}
        </select>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
      <div class="esc-field">
        <label class="esc-label">Status</label>
        <select class="esc-select" id="pf-status">
          ${Object.entries(P_STATUS).map(([k,v])=>`<option value="${k}" ${(p?.status||'planejamento')===k?'selected':''}>${v.label}</option>`).join('')}
        </select>
      </div>
      <div class="esc-field">
        <label class="esc-label">Prioridade</label>
        <select class="esc-select" id="pf-prio">
          ${Object.entries(P_PRIORIDADE).map(([k,v])=>`<option value="${k}" ${(p?.prioridade||'normal')===k?'selected':''}>${v.label}</option>`).join('')}
        </select>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
      <div class="esc-field">
        <label class="esc-label">Prazo</label>
        <input class="esc-input" type="date" id="pf-prazo" value="${p?.prazo||''}">
      </div>
      <div class="esc-field">
        <label class="esc-label">Data de início</label>
        <input class="esc-input" type="date" id="pf-inicio" value="${p?.data_inicio||''}">
      </div>
    </div>
    <div class="esc-field">
      <label class="esc-label">Descrição</label>
      <textarea class="esc-textarea" id="pf-desc" placeholder="Contexto e escopo do projeto">${escEsc(p?.descricao||'')}</textarea>
    </div>
    <div class="esc-field">
      <label class="esc-label">Objetivo</label>
      <input class="esc-input" id="pf-objetivo" value="${escEsc(p?.objetivo||'')}" placeholder="O que queremos alcançar?">
    </div>
    <div class="esc-field">
      <label class="esc-label">Resultado esperado</label>
      <input class="esc-input" id="pf-resultado" value="${escEsc(p?.resultado_esperado||'')}" placeholder="Como saberemos que foi concluído com sucesso?">
    </div>
    <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:4px">
      ${p&&p.status!=='concluido'?`<button class="btn btn-secondary btn-sm" style="color:var(--green);border-color:var(--green)" onclick="pConcluir('${p.id}');escFecharModal()">✓ Concluir</button>`:''}
      ${p&&p.status==='concluido'?`<button class="btn btn-secondary btn-sm" style="color:var(--text3)" onclick="pDesconcluir('${p.id}');escFecharModal()">↩ Reabrir</button>`:''}
      <button class="btn btn-secondary" onclick="escFecharModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="pSalvar()">${p?'Salvar alterações':'Criar projeto'}</button>
    </div>
  `;
  document.getElementById('esc-modal-overlay').classList.add('open');
  document.getElementById('pf-nome')?.focus();
}

async function pSalvar() {
  const nome = document.getElementById('pf-nome')?.value?.trim();
  const area = document.getElementById('pf-area')?.value;
  if (!nome) { escToast('Informe o nome do projeto.'); return; }
  if (!area) { escToast('Selecione a área.'); return; }

  const obj = {
    nome, area,
    responsavel_id: document.getElementById('pf-resp')?.value||null,
    status:         document.getElementById('pf-status')?.value||'planejamento',
    prioridade:     document.getElementById('pf-prio')?.value||'normal',
    prazo:          document.getElementById('pf-prazo')?.value||null,
    data_inicio:    document.getElementById('pf-inicio')?.value||null,
    descricao:      document.getElementById('pf-desc')?.value||null,
    objetivo:       document.getElementById('pf-objetivo')?.value||null,
    resultado_esperado: document.getElementById('pf-resultado')?.value||null,
    created_by:     ESC_STATE.usuario,
    updated_at:     new Date().toISOString(),
  };

  try {
    if (_pEditandoId) {
      const r = await fetch(ESC_SUPA_URL+'/rest/v1/escritorio_projetos?id=eq.'+_pEditandoId, {
        method:'PATCH',
        headers:{'apikey':ESC_SUPA_KEY,'Authorization':'Bearer '+ESC_SUPA_KEY,'Content-Type':'application/json','Prefer':'return=representation'},
        body:JSON.stringify(obj)
      });
      const updated = await r.json();
      if (Array.isArray(updated)) {
        const idx = _projetosCache.findIndex(x=>x.id===_pEditandoId);
        if (idx>=0) _projetosCache[idx] = updated[0];
      }
      escToast('Projeto atualizado!');
    } else {
      const r = await fetch(ESC_SUPA_URL+'/rest/v1/escritorio_projetos', {
        method:'POST',
        headers:{'apikey':ESC_SUPA_KEY,'Authorization':'Bearer '+ESC_SUPA_KEY,'Content-Type':'application/json','Prefer':'return=representation'},
        body:JSON.stringify(obj)
      });
      const created = await r.json();
      if (Array.isArray(created)) _projetosCache.unshift(created[0]);
      escToast('Projeto criado!');
    }
    escFecharModal();
    if (_pDetalheId && _pEditandoId===_pDetalheId) await pAbrirDetalhe(_pDetalheId);
    else { pRenderKpis(); await pRenderKanban(); }
  } catch(e) { escToast('Erro ao salvar projeto.'); console.error(e); }
}

async function pConcluir(id) {
  if (!confirm('Marcar este projeto como concluído?')) return;
  try {
    const agora = new Date().toISOString();
    const r = await fetch(ESC_SUPA_URL+'/rest/v1/escritorio_projetos?id=eq.'+id, {
      method:'PATCH',
      headers:{'apikey':ESC_SUPA_KEY,'Authorization':'Bearer '+ESC_SUPA_KEY,'Content-Type':'application/json','Prefer':'return=representation'},
      body:JSON.stringify({status:'concluido', concluido_em:agora, updated_at:agora})
    });
    if (!r.ok) { escToast('Erro ao concluir projeto. ('+r.status+')'); return; }
    const updated = await r.json();
    if (Array.isArray(updated) && updated[0]) {
      const idx = _projetosCache.findIndex(x=>x.id===id);
      if (idx>=0) _projetosCache[idx] = updated[0];
      else _projetosCache.push(updated[0]);
    }
    escToast('Projeto concluído! 🎉');
    if (_pDetalheId===id) await pAbrirDetalhe(id);
    else { pRenderKpis(); await pRenderKanban(); }
  } catch(e) { console.error(e); escToast('Erro ao concluir projeto.'); }
}

async function pDesconcluir(id) {
  try {
    const r = await fetch(ESC_SUPA_URL+'/rest/v1/escritorio_projetos?id=eq.'+id, {
      method:'PATCH',
      headers:{'apikey':ESC_SUPA_KEY,'Authorization':'Bearer '+ESC_SUPA_KEY,'Content-Type':'application/json','Prefer':'return=representation'},
      body:JSON.stringify({status:'em_andamento', concluido_em:null, updated_at:new Date().toISOString()})
    });
    if (!r.ok) { escToast('Erro ao reabrir projeto.'); return; }
    const updated = await r.json();
    if (Array.isArray(updated) && updated[0]) {
      const idx = _projetosCache.findIndex(x=>x.id===id);
      if (idx>=0) _projetosCache[idx] = updated[0];
    }
    escToast('Projeto reaberto.');
    if (_pDetalheId===id) await pAbrirDetalhe(id);
    else { pRenderKpis(); await pRenderKanban(); }
  } catch(e) { console.error(e); escToast('Erro ao reabrir projeto.'); }
}

// ── INTEGRAÇÃO COM TAREFAS ──
function tAbrirFormComProjeto(projetoId) {
  _tarefaEditandoId = null;
  const p = _projetosCache.find(x=>x.id===projetoId);

  document.getElementById('esc-modal-title').textContent = 'Nova tarefa';
  document.getElementById('esc-modal-body').innerHTML = `
    <div style="font-size:12px;color:var(--accent);margin-bottom:12px;padding:6px 10px;background:var(--accent-dim);border-radius:6px">
      📁 Vinculando ao projeto: <b>${escEsc(p?.nome||projetoId)}</b>
    </div>
    <div class="esc-field">
      <label class="esc-label">Título <span style="color:var(--red)">*</span></label>
      <input class="esc-input" id="tf-titulo" placeholder="O que precisa ser feito?">
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
      <div class="esc-field">
        <label class="esc-label">Área</label>
        <select class="esc-select" id="tf-area">
          ${T_AREAS.map(a=>`<option value="${a}" ${p?.area===a?'selected':''}>${a}</option>`).join('')}
        </select>
      </div>
      <div class="esc-field">
        <label class="esc-label">Responsável</label>
        <select class="esc-select" id="tf-resp">
          <option value="">Selecionar</option>
          ${T_RESPONSAVEIS.map(r=>`<option value="${r}" ${p?.responsavel_id===r?'selected':''}>${r}</option>`).join('')}
        </select>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
      <div class="esc-field">
        <label class="esc-label">Prioridade</label>
        <select class="esc-select" id="tf-prio">
          ${Object.entries(T_PRIORIDADE).map(([k,v])=>`<option value="${k}" ${k==='normal'?'selected':''}>${v.label}</option>`).join('')}
        </select>
      </div>
      <div class="esc-field">
        <label class="esc-label">Prazo</label>
        <input class="esc-input" type="date" id="tf-prazo">
      </div>
    </div>
    <input type="hidden" id="tf-projeto-id" value="${projetoId}">
    <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:4px">
      <button class="btn btn-secondary" onclick="escFecharModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="pSalvarTarefaNoProjetoERefresh('${projetoId}')">Criar tarefa</button>
    </div>`;
  document.getElementById('esc-modal-overlay').classList.add('open');
  document.getElementById('tf-titulo')?.focus();
}

async function pSalvarTarefaNoProjetoERefresh(pid) {
  const titulo = document.getElementById('tf-titulo')?.value?.trim();
  const area   = document.getElementById('tf-area')?.value;
  if (!titulo) { escToast('Informe o título da tarefa.'); return; }

  const obj = {
    titulo, area,
    responsavel_id: document.getElementById('tf-resp')?.value||null,
    prioridade:     document.getElementById('tf-prio')?.value||'normal',
    prazo:          document.getElementById('tf-prazo')?.value||null,
    status:         'a_fazer',
    projeto_id:     pid,
    origem_tipo:    'projeto',
    origem_id:      pid,
    created_by:     ESC_STATE.usuario,
    criado_por:     ESC_STATE.usuario,
  };

  try {
    const r = await fetch(ESC_SUPA_URL+'/rest/v1/escritorio_tarefas', {
      method:'POST',
      headers:{'apikey':ESC_SUPA_KEY,'Authorization':'Bearer '+ESC_SUPA_KEY,'Content-Type':'application/json','Prefer':'return=representation'},
      body:JSON.stringify(obj)
    });
    const created = await r.json();
    if (Array.isArray(created)&&typeof _tarefasCache!=='undefined') _tarefasCache.unshift(created[0]);
    escToast('Tarefa criada no projeto! ✓');
    escFecharModal();
    await pAbrirDetalhe(pid);
  } catch(e) { escToast('Erro ao criar tarefa.'); console.error(e); }
}

// ── DASHBOARD: bloco projetos ──
async function pDashboardInfo() {
  let projetos = [];
  try { projetos = await escGet('/rest/v1/escritorio_projetos?status=neq.cancelado&order=created_at.desc&limit=20'); }
  catch(e) {}
  const hoje = new Date().toISOString().split('T')[0];
  return {
    projetos,
    emAndamento:  projetos.filter(p=>p.status==='em_andamento'),
    planejamento: projetos.filter(p=>p.status==='planejamento'),
    atrasados:    projetos.filter(p=>p.prazo&&p.prazo<hoje&&!['concluido','cancelado'].includes(p.status)),
  };
}
