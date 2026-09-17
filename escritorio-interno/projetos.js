/* ══════════════════════════════════════════════════
   MÓDULO PROJETOS — escritorio-interno
   Conectado ao módulo Tarefas via projeto_id
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

let _pfiltros = { view: 'todos', area: '', status: '', prioridade: '', responsavel: '' };
let _projetosCache = [];
let _pEditandoId = null;
let _pDetalheId  = null;

// ── RENDER PRINCIPAL ──
async function escRenderProjetos(el) {
  el.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:20px">
      <div style="display:flex;gap:8px;flex-wrap:wrap" id="p-views"></div>
      <button class="btn btn-primary" onclick="pAbrirForm()">+ Novo projeto</button>
    </div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px">
      <select class="esc-select" style="width:auto;min-width:130px" onchange="pSetFiltro('area',this.value)">
        <option value="">Todas as áreas</option>
        ${P_AREAS.map(a=>`<option value="${a}">${a}</option>`).join('')}
      </select>
      <select class="esc-select" style="width:auto;min-width:140px" onchange="pSetFiltro('responsavel',this.value)">
        <option value="">Todos os responsáveis</option>
        ${P_RESPONSAVEIS.map(r=>`<option value="${r}">${r}</option>`).join('')}
      </select>
      <select class="esc-select" style="width:auto;min-width:120px" onchange="pSetFiltro('prioridade',this.value)">
        <option value="">Todas as prioridades</option>
        ${Object.entries(P_PRIORIDADE).map(([k,v])=>`<option value="${k}">${v.label}</option>`).join('')}
      </select>
      <button class="btn btn-secondary btn-sm" onclick="pLimparFiltros()">Limpar</button>
    </div>
    <div id="p-kpis" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:10px;margin-bottom:20px"></div>
    <div id="p-lista"><div style="color:var(--text3);text-align:center;padding:40px">Carregando projetos...</div></div>
  `;
  pRenderViews();
  await pCarregar();
}

function pRenderViews() {
  const VIEWS = [
    { id:'todos',        label:'Todos'        },
    { id:'em_andamento', label:'Em andamento' },
    { id:'planejamento', label:'Planejamento' },
    { id:'pausados',     label:'Pausados'     },
    { id:'atrasados',    label:'Atrasados'    },
    { id:'concluidos',   label:'Concluídos'   },
  ];
  document.getElementById('p-views').innerHTML = VIEWS.map(v=>`
    <button class="btn ${_pfiltros.view===v.id?'btn-primary':'btn-secondary'} btn-sm"
      onclick="pSetView('${v.id}')">${v.label}</button>`).join('');
}

function pSetView(v) { _pfiltros.view=v; pRenderViews(); pRenderLista(); }
function pSetFiltro(k,v) { _pfiltros[k]=v; pRenderLista(); }
function pLimparFiltros() {
  _pfiltros = {..._pfiltros, area:'', status:'', prioridade:'', responsavel:''};
  document.querySelectorAll('#p-lista + * select, [onchange*="pSetFiltro"]').forEach(s=>s.selectedIndex=0);
  pRenderLista();
}

async function pCarregar() {
  try {
    _projetosCache = await escGet('/rest/v1/escritorio_projetos?order=created_at.desc');
  } catch(e) { _projetosCache = []; console.error(e); }
  pRenderKpis();
  pRenderLista();
}

function pFiltrar() {
  const hoje = new Date().toISOString().split('T')[0];
  let lista = [..._projetosCache];
  const v = _pfiltros.view;
  if      (v==='em_andamento') lista = lista.filter(p=>p.status==='em_andamento');
  else if (v==='planejamento') lista = lista.filter(p=>p.status==='planejamento');
  else if (v==='pausados')     lista = lista.filter(p=>p.status==='pausado');
  else if (v==='concluidos')   lista = lista.filter(p=>p.status==='concluido');
  else if (v==='atrasados')    lista = lista.filter(p=>p.prazo&&p.prazo<hoje&&!['concluido','cancelado'].includes(p.status));
  if (_pfiltros.area)        lista = lista.filter(p=>p.area===_pfiltros.area);
  if (_pfiltros.responsavel) lista = lista.filter(p=>p.responsavel_id===_pfiltros.responsavel);
  if (_pfiltros.prioridade)  lista = lista.filter(p=>p.prioridade===_pfiltros.prioridade);
  const prioOrdem = {urgente:0,alta:1,normal:2,baixa:3};
  lista.sort((a,b)=>{
    const pa=prioOrdem[a.prioridade]??2, pb=prioOrdem[b.prioridade]??2;
    if(pa!==pb) return pa-pb;
    if(a.prazo&&b.prazo) return a.prazo.localeCompare(b.prazo);
    return 0;
  });
  return lista;
}

function pRenderKpis() {
  const hoje = new Date().toISOString().split('T')[0];
  const kpis = [
    {val:_projetosCache.filter(p=>p.status==='em_andamento').length, lbl:'Em andamento', cor:'accent'},
    {val:_projetosCache.filter(p=>p.status==='planejamento').length,  lbl:'Planejamento', cor:''},
    {val:_projetosCache.filter(p=>p.prazo&&p.prazo<hoje&&!['concluido','cancelado'].includes(p.status)).length, lbl:'Atrasados', cor:'red'},
    {val:_projetosCache.filter(p=>p.status==='concluido').length,     lbl:'Concluídos',  cor:'green'},
  ];
  const CORES={accent:'var(--accent)',red:'var(--red)',green:'var(--green)','':'var(--text)'};
  const el=document.getElementById('p-kpis');
  if(el) el.innerHTML=kpis.map(k=>`
    <div class="esc-kpi" style="${k.cor?`border-color:${CORES[k.cor]}22`:''}">
      <div class="esc-kpi-val" style="color:${CORES[k.cor]};font-size:22px">${k.val}</div>
      <div class="esc-kpi-lbl">${k.lbl}</div>
    </div>`).join('');
}

async function pRenderLista() {
  const el=document.getElementById('p-lista');
  if(!el) return;
  const lista=pFiltrar();
  if(!lista.length){
    el.innerHTML=`<div style="color:var(--text3);text-align:center;padding:60px 20px">
      <div style="font-size:32px;opacity:.3;margin-bottom:12px">📁</div>
      <div>Nenhum projeto encontrado.</div>
      <button class="btn btn-secondary btn-sm" style="margin-top:16px" onclick="pAbrirForm()">+ Criar primeiro projeto</button>
    </div>`;
    return;
  }
  // Buscar contagem de tarefas por projeto (batch)
  const ids = lista.map(p=>p.id);
  let tarefasPorProjeto = {};
  try {
    const tAll = await escGet('/rest/v1/escritorio_tarefas?projeto_id=in.('+ids.join(',')+')&select=id,projeto_id,status');
    tAll.forEach(t=>{
      if(!tarefasPorProjeto[t.projeto_id]) tarefasPorProjeto[t.projeto_id]={total:0,concluidas:0};
      tarefasPorProjeto[t.projeto_id].total++;
      if(t.status==='concluida') tarefasPorProjeto[t.projeto_id].concluidas++;
    });
  } catch(e) {}

  const hoje = new Date().toISOString().split('T')[0];
  el.innerHTML = `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:14px">
    ${lista.map(p=>pCardHtml(p, tarefasPorProjeto[p.id]||{total:0,concluidas:0}, hoje)).join('')}
  </div>`;
}

function pCardHtml(p, prog, hoje) {
  const atrasado = p.prazo&&p.prazo<hoje&&!['concluido','cancelado'].includes(p.status);
  const st  = P_STATUS[p.status] || {label:p.status,cor:'gray'};
  const pr  = P_PRIORIDADE[p.prioridade] || {label:p.prioridade,cor:'gray'};
  const pct = prog.total>0 ? Math.round(prog.concluidas/prog.total*100) : 0;
  const AREA_COR = {'JS Mentoria':'area-js','Moni Sul':'area-moni','Interno':'area-js'};

  return `
    <div class="esc-card" style="cursor:pointer;border-color:${atrasado?'var(--red)22':''}" onclick="pAbrirDetalhe('${p.id}')">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:10px;gap:8px">
        <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
          ${p.area?`<span class="${AREA_COR[p.area]||'area-js'}">${p.area}</span>`:''}
          ${atrasado?'<span class="badge badge-red">Atrasado</span>':''}
        </div>
        <div style="display:flex;gap:4px;flex-shrink:0">
          <span class="badge badge-${st.cor}">${st.label}</span>
        </div>
      </div>

      <div style="font-size:15px;font-weight:600;color:var(--text);margin-bottom:4px;line-height:1.3">${escEsc(p.nome)}</div>
      ${p.descricao?`<div style="font-size:12px;color:var(--text3);margin-bottom:10px;line-height:1.4">${escEsc(p.descricao.slice(0,80))}${p.descricao.length>80?'…':''}</div>`:'<div style="margin-bottom:10px"></div>'}

      <!-- Progresso -->
      ${prog.total>0 ? `
        <div style="margin-bottom:10px">
          <div style="display:flex;justify-content:space-between;margin-bottom:4px">
            <span style="font-size:11px;color:var(--text3)">${prog.concluidas} de ${prog.total} tarefas</span>
            <span style="font-size:11px;font-weight:600;color:${pct===100?'var(--green)':'var(--text2)'}">${pct}%</span>
          </div>
          <div style="height:4px;background:var(--border);border-radius:2px;overflow:hidden">
            <div style="height:100%;width:${pct}%;background:${pct===100?'var(--green)':'var(--accent)'};border-radius:2px;transition:width .3s"></div>
          </div>
        </div>` : `<div style="font-size:11px;color:var(--text3);margin-bottom:10px">Nenhuma tarefa vinculada</div>`}

      <!-- Footer -->
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:4px">
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
          ${p.responsavel_id?`<span style="font-size:11px;color:var(--text3)">${escEsc(p.responsavel_id)}</span>`:''}
          ${p.prazo?`<span style="font-size:11px;color:${atrasado?'var(--red)':'var(--text3)'}">📅 ${tFormatarData(p.prazo)}</span>`:''}
        </div>
        <span class="badge badge-${pr.cor}" style="font-size:9px">${pr.label}</span>
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

  // Buscar tarefas do projeto
  let tarefas = [];
  try { tarefas = await escGet(`/rest/v1/escritorio_tarefas?projeto_id=eq.${id}&order=created_at.desc`); }
  catch(e) {}

  const hoje = new Date().toISOString().split('T')[0];
  const total = tarefas.length;
  const concluidas = tarefas.filter(t=>t.status==='concluida').length;
  const emAndamento = tarefas.filter(t=>t.status==='em_andamento').length;
  const aFazer = tarefas.filter(t=>t.status==='a_fazer').length;
  const pausadas = tarefas.filter(t=>t.status==='pausada').length;
  const atrasadas = tarefas.filter(t=>t.prazo&&t.prazo<hoje&&t.status!=='concluida').length;
  const pct = total>0 ? Math.round(concluidas/total*100) : 0;

  const atrasado = p.prazo&&p.prazo<hoje&&!['concluido','cancelado'].includes(p.status);
  const st = P_STATUS[p.status]||{label:p.status,cor:'gray'};
  const pr = P_PRIORIDADE[p.prioridade]||{label:p.prioridade,cor:'gray'};
  const AREA_COR = {'JS Mentoria':'area-js','Moni Sul':'area-moni','Interno':'area-js'};

  content.innerHTML = `
    <!-- Breadcrumb -->
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:20px;font-size:13px">
      <span style="color:var(--text3);cursor:pointer" onclick="escNavegar('projetos')">Projetos</span>
      <span style="color:var(--border2)">›</span>
      <span style="color:var(--text)">${escEsc(p.nome)}</span>
    </div>

    <!-- Header do projeto -->
    <div style="display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:24px">
      <div>
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:6px">
          ${p.area?`<span class="${AREA_COR[p.area]||'area-js'}">${p.area}</span>`:''}
          <span class="badge badge-${st.cor}">${st.label}</span>
          <span class="badge badge-${pr.cor}">${pr.label}</span>
          ${atrasado?'<span class="badge badge-red">Atrasado</span>':''}
        </div>
        <h2 style="font-size:22px;font-weight:700;color:var(--text);margin-bottom:4px">${escEsc(p.nome)}</h2>
        ${p.descricao?`<p style="font-size:13px;color:var(--text2);line-height:1.6">${escEsc(p.descricao)}</p>`:''}
      </div>
      <div style="display:flex;gap:8px;flex-shrink:0">
        <button class="btn btn-secondary btn-sm" onclick="pAbrirForm('${id}')">✏ Editar</button>
        ${p.status!=='concluido'?`<button class="btn btn-secondary btn-sm" style="color:var(--green);border-color:var(--green)" onclick="pConcluir('${id}')">✓ Concluir</button>`:''}
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
          <div style="color:var(--text3);font-size:13px;text-align:center;padding:20px 0">
            Nenhuma tarefa vinculada ainda.
          </div>
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
              {val:concluidas, lbl:'Concluídas', cor:'green'},
              {val:emAndamento,lbl:'Em andamento',cor:'accent'},
              {val:aFazer,     lbl:'A fazer',    cor:''},
              {val:pausadas,   lbl:'Pausadas',   cor:'amber'},
              {val:atrasadas,  lbl:'Atrasadas',  cor:'red'},
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

      <!-- Filtros rápidos das tarefas -->
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px" id="pdet-views">
        ${['todas','hoje','atrasadas','concluidas'].map(v=>`
          <button class="btn btn-secondary btn-sm" style="font-size:11px" id="pdet-v-${v}" onclick="pDetViewTarefas('${id}','${v}',${JSON.stringify(tarefas)})">${
            {todas:'Todas',hoje:'Hoje',atrasadas:'Atrasadas',concluidas:'Concluídas'}[v]
          }</button>`).join('')}
      </div>

      <div id="pdet-tarefas">
        ${tarefas.length===0
          ? `<div style="color:var(--text3);font-size:13px;text-align:center;padding:30px">Nenhuma tarefa ainda.</div>`
          : `<div class="esc-list">${tarefas.map(t=>tItemHtml(t,hoje)).join('')}</div>`}
      </div>
    </div>`;
}

function pDetViewTarefas(projetoId, view, tarefas) {
  const hoje = new Date().toISOString().split('T')[0];
  document.querySelectorAll('[id^="pdet-v-"]').forEach(b=>b.classList.remove('btn-primary'));
  document.querySelectorAll('[id^="pdet-v-"]').forEach(b=>b.classList.add('btn-secondary'));
  const btn = document.getElementById('pdet-v-'+view);
  if(btn){btn.classList.remove('btn-secondary');btn.classList.add('btn-primary');}
  let lista = [...tarefas];
  if     (view==='hoje')      lista = lista.filter(t=>t.prazo===hoje&&t.status!=='concluida');
  else if(view==='atrasadas') lista = lista.filter(t=>t.prazo&&t.prazo<hoje&&t.status!=='concluida');
  else if(view==='concluidas')lista = lista.filter(t=>t.status==='concluida');
  const el = document.getElementById('pdet-tarefas');
  if(!el) return;
  el.innerHTML = lista.length===0
    ? `<div style="color:var(--text3);font-size:13px;text-align:center;padding:30px">Nenhuma tarefa nessa categoria.</div>`
    : `<div class="esc-list">${lista.map(t=>tItemHtml(t,hoje)).join('')}</div>`;
}

function pNovaTarefaNoProject(projetoId) { pNovaTarefaNoProject(projetoId); }
function pNovaTarefaNoProject(pid) {
  if(typeof tAbrirForm==='function') {
    tAbrirForm(null, pid);
  }
}
function pNovaTarefaNoProjetoLaunch(pid) {
  if(typeof tAbrirFormComProjeto==='function') tAbrirFormComProjeto(pid);
  else if(typeof tAbrirForm==='function') tAbrirForm(null, pid);
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
  if(!nome) { escToast('Informe o nome do projeto.'); return; }
  if(!area) { escToast('Selecione a área.'); return; }

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
    if(_pEditandoId) {
      const r = await fetch(ESC_SUPA_URL+'/rest/v1/escritorio_projetos?id=eq.'+_pEditandoId, {
        method:'PATCH',
        headers:{'apikey':ESC_SUPA_KEY,'Authorization':'Bearer '+ESC_SUPA_KEY,'Content-Type':'application/json','Prefer':'return=representation'},
        body:JSON.stringify(obj)
      });
      const updated = await r.json();
      if(Array.isArray(updated)){
        const idx=_projetosCache.findIndex(x=>x.id===_pEditandoId);
        if(idx>=0) _projetosCache[idx]=updated[0];
      }
      escToast('Projeto atualizado!');
    } else {
      const r = await fetch(ESC_SUPA_URL+'/rest/v1/escritorio_projetos', {
        method:'POST',
        headers:{'apikey':ESC_SUPA_KEY,'Authorization':'Bearer '+ESC_SUPA_KEY,'Content-Type':'application/json','Prefer':'return=representation'},
        body:JSON.stringify(obj)
      });
      const created = await r.json();
      if(Array.isArray(created)) _projetosCache.unshift(created[0]);
      escToast('Projeto criado!');
    }
    escFecharModal();
    // Se está na tela de detalhe, reabrir; senão re-render lista
    if(_pDetalheId && _pEditandoId===_pDetalheId) pAbrirDetalhe(_pDetalheId);
    else { pRenderKpis(); await pRenderLista(); }
  } catch(e) { escToast('Erro ao salvar projeto.'); console.error(e); }
}

async function pConcluir(id) {
  try {
    const agora = new Date().toISOString();
    const r = await fetch(ESC_SUPA_URL+'/rest/v1/escritorio_projetos?id=eq.'+id, {
      method:'PATCH',
      headers:{'apikey':ESC_SUPA_KEY,'Authorization':'Bearer '+ESC_SUPA_KEY,'Content-Type':'application/json','Prefer':'return=representation'},
      body:JSON.stringify({status:'concluido', concluido_em:agora, updated_at:agora})
    });
    const updated = await r.json();
    if(Array.isArray(updated)){
      const idx=_projetosCache.findIndex(x=>x.id===id);
      if(idx>=0) _projetosCache[idx]=updated[0];
    }
    escToast('Projeto concluído! 🎉');
    pRenderKpis(); await pRenderLista();
  } catch(e) { escToast('Erro ao concluir projeto.'); }
}

// ── INTEGRAÇÃO COM TAREFAS ──
// Extende tAbrirForm para aceitar projeto_id
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
  if(!titulo) { escToast('Informe o título da tarefa.'); return; }

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
    // Atualizar cache de tarefas se existir
    if(Array.isArray(created)&&typeof _tarefasCache!=='undefined') _tarefasCache.unshift(created[0]);
    escToast('Tarefa criada no projeto! ✓');
    escFecharModal();
    // Reabrir detalhe do projeto
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
    emAndamento: projetos.filter(p=>p.status==='em_andamento'),
    planejamento: projetos.filter(p=>p.status==='planejamento'),
    atrasados: projetos.filter(p=>p.prazo&&p.prazo<hoje&&!['concluido','cancelado'].includes(p.status)),
  };
}
