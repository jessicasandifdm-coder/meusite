/* ══════════════════════════════════════════════════
   MÓDULO PLANEJAMENTO — escritorio-interno
   Direcionar → Priorizar → Organizar → Executar → Revisar
   ══════════════════════════════════════════════════ */

const PL_STATUS = {
  em_construcao: { label:'Em construção', cor:'gray'   },
  ativo:         { label:'Ativo',          cor:'green'  },
  em_revisao:    { label:'Em revisão',     cor:'amber'  },
  encerrado:     { label:'Encerrado',      cor:'red'    },
};
const PL_TIPOS = {
  anual:       { label:'Anual',       emoji:'📅' },
  trimestral:  { label:'Trimestral',  emoji:'🗓' },
  mensal:      { label:'Mensal',      emoji:'📆' },
};
const PL_AREAS = ['JS Mentoria','Moni Sul'];
const PL_RESPONSAVEIS = ['Jéssica','Amanda'];
const PL_TRIMESTRES = ['T1 (Jan–Mar)','T2 (Abr–Jun)','T3 (Jul–Set)','T4 (Out–Dez)'];
const PL_MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

let _plfiltros    = { view:'ativos', area:'JS Mentoria' };
let _plCache      = [];
let _plEditandoId = null;
let _plDetalheId  = null;
let _plPrioridades = {};
const ANO_ATUAL = new Date().getFullYear();
const MES_ATUAL = new Date().getMonth() + 1;

// ── RENDER PRINCIPAL ──
async function escRenderPlanejamento(el) {
  el.innerHTML = `
    <!-- Seletor de área -->
    <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:20px">
      <div style="display:flex;gap:4px">
        ${PL_AREAS.map(a=>`
          <button class="btn ${_plfiltros.area===a?'btn-primary':'btn-secondary'}" style="font-size:13px;padding:7px 16px"
            onclick="plSetArea('${a}')">${a}</button>`).join('')}
      </div>
      <button class="btn btn-primary" onclick="plAbrirForm()">+ Novo planejamento</button>
    </div>

    <!-- Views -->
    <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:20px" id="pl-views"></div>

    <!-- Conteúdo -->
    <div id="pl-conteudo"><div style="color:var(--text3);text-align:center;padding:40px">Carregando...</div></div>
  `;
  plRenderViews();
  await plCarregar();
}

function plSetArea(area) { _plfiltros.area=area; escRenderPlanejamento(document.getElementById('esc-content')); }

function plRenderViews() {
  const VIEWS = [
    {id:'ativos',    label:'Ativos'    },
    {id:'mensal',    label:'Mensal'    },
    {id:'trimestral',label:'Trimestral'},
    {id:'anual',     label:'Anual'     },
    {id:'historico', label:'Histórico' },
  ];
  const el = document.getElementById('pl-views');
  if (el) el.innerHTML = VIEWS.map(v=>`
    <button class="btn ${_plfiltros.view===v.id?'btn-primary':'btn-secondary'} btn-sm"
      onclick="plSetView('${v.id}')">${v.label}</button>`).join('');
}

function plSetView(v) { _plfiltros.view=v; plRenderViews(); plRenderLista(); }

async function plCarregar() {
  try {
    _plCache = await escGet('/rest/v1/escritorio_planejamentos?order=ano.desc,mes.desc,trimestre.desc');
    if (!Array.isArray(_plCache)) _plCache = [];
  } catch(e) { _plCache = []; }
  plRenderLista();
}

function plFiltrar() {
  const area = _plfiltros.area;
  const v    = _plfiltros.view;
  let lista  = _plCache.filter(p=>p.area===area);
  if      (v==='ativos')     lista = lista.filter(p=>['ativo','em_construcao','em_revisao'].includes(p.status));
  else if (v==='mensal')     lista = lista.filter(p=>p.periodo_tipo==='mensal');
  else if (v==='trimestral') lista = lista.filter(p=>p.periodo_tipo==='trimestral');
  else if (v==='anual')      lista = lista.filter(p=>p.periodo_tipo==='anual');
  else if (v==='historico')  lista = lista.filter(p=>p.status==='encerrado');
  return lista;
}

async function plRenderLista() {
  const el = document.getElementById('pl-conteudo');
  if (!el) return;
  const lista = plFiltrar();

  if (!lista.length) {
    el.innerHTML = `<div style="color:var(--text3);text-align:center;padding:60px 20px">
      <div style="font-size:32px;opacity:.3;margin-bottom:12px">🗺</div>
      <div>Nenhum planejamento encontrado para ${_plfiltros.area}.</div>
      <button class="btn btn-secondary btn-sm" style="margin-top:16px" onclick="plAbrirForm()">+ Criar primeiro planejamento</button>
    </div>`;
    return;
  }

  // Separar ativo atual vs anteriores
  const ativos   = lista.filter(p=>['ativo','em_construcao','em_revisao'].includes(p.status));
  const anteriores = lista.filter(p=>p.status==='encerrado');

  let html = '';

  // Card destaque do ativo
  if (ativos.length) {
    html += ativos.map(p=>plCardHtml(p, true)).join('');
  }

  // Lista anteriores
  if (anteriores.length && _plfiltros.view!=='ativos') {
    html += `<div style="font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--text3);margin:24px 0 10px">Histórico</div>`;
    html += `<div class="esc-list">${anteriores.map(p=>plItemHtml(p)).join('')}</div>`;
  }

  el.innerHTML = html || `<div style="color:var(--text3);text-align:center;padding:40px">Nenhum planejamento encontrado.</div>`;
}

function plPeriodoLabel(p) {
  if (p.periodo_tipo==='anual') return `${p.ano}`;
  if (p.periodo_tipo==='trimestral') return `T${p.trimestre||1} ${p.ano}`;
  if (p.periodo_tipo==='mensal') return `${PL_MESES[(p.mes||1)-1]} ${p.ano}`;
  return p.titulo||'—';
}

function plCardHtml(p, destaque=false) {
  const st = PL_STATUS[p.status]||{label:p.status,cor:'gray'};
  const emoji = PL_TIPOS[p.periodo_tipo]?.emoji||'📄';
  const AREA_COR={'JS Mentoria':'area-js','Moni Sul':'area-moni'};
  return `
    <div class="esc-card" style="margin-bottom:16px;cursor:pointer;border-color:${destaque?'rgba(74,144,217,.3)':''}"
      onclick="plAbrirDetalhe('${p.id}')">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:10px;margin-bottom:14px">
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
          <span style="font-size:18px">${emoji}</span>
          <span class="badge badge-${st.cor}">${st.label}</span>
          <span class="${AREA_COR[p.area]||'area-js'}">${p.area}</span>
          <span class="badge badge-gray">${PL_TIPOS[p.periodo_tipo]?.label||p.periodo_tipo} — ${plPeriodoLabel(p)}</span>
        </div>
        <div style="display:flex;gap:6px" onclick="event.stopPropagation()">
          <button class="btn btn-secondary btn-sm" onclick="plAbrirForm('${p.id}')">✏</button>
          ${p.status!=='encerrado'?`<button class="btn btn-secondary btn-sm" onclick="plEncerrar('${p.id}')" style="color:var(--red)" title="Encerrar">✓ Encerrar</button>`:''}
        </div>
      </div>
      <div style="font-size:15px;font-weight:700;color:var(--text);margin-bottom:${p.foco_principal?'10px':'4px'}">${escEsc(p.titulo)}</div>
      ${p.foco_principal?`
        <div style="background:var(--bg);border-left:3px solid var(--accent);border-radius:0 8px 8px 0;padding:10px 14px;margin-bottom:12px">
          <div style="font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--accent);margin-bottom:3px">Foco</div>
          <div style="font-size:13px;color:var(--text2);font-style:italic">"${escEsc(p.foco_principal)}"</div>
        </div>`:``}
      ${p.objetivo_geral?`<div style="font-size:12px;color:var(--text2);margin-bottom:10px;line-height:1.5">${escEsc(p.objetivo_geral.slice(0,120))}${p.objetivo_geral.length>120?'…':''}</div>`:``}
      <div style="font-size:11px;color:var(--text3)">Criado por ${escEsc(p.created_by||'—')}</div>
    </div>`;
}

function plItemHtml(p) {
  const st = PL_STATUS[p.status]||{label:p.status,cor:'gray'};
  const emoji = PL_TIPOS[p.periodo_tipo]?.emoji||'📄';
  return `
    <div class="esc-list-item" onclick="plAbrirDetalhe('${p.id}')">
      <span style="font-size:16px">${emoji}</span>
      <div style="flex:1">
        <div style="font-size:13px;font-weight:500;color:var(--text2)">${escEsc(p.titulo)}</div>
        <div style="font-size:11px;color:var(--text3)">${PL_TIPOS[p.periodo_tipo]?.label||''} — ${plPeriodoLabel(p)}</div>
      </div>
      <span class="badge badge-${st.cor}">${st.label}</span>
    </div>`;
}

// ── DETALHE ──
async function plAbrirDetalhe(id) {
  _plDetalheId = id;
  const pl = _plCache.find(x=>x.id===id);
  if (!pl) return;
  const content = document.getElementById('esc-content');
  content.innerHTML = `<div style="color:var(--text3);text-align:center;padding:40px">Carregando...</div>`;

  // Buscar prioridades, projetos vinculados, decisões vinculadas, reuniões vinculadas, tarefas
  let prioridades=[], projVinc=[], decVinc=[], reunVinc=[], tarefas=[];
  try { prioridades = await escGet(`/rest/v1/escritorio_plano_prioridades?planejamento_id=eq.${id}&order=ordem.asc`); } catch(e) {}
  try { projVinc   = await escGet(`/rest/v1/escritorio_plano_projetos?planejamento_id=eq.${id}`); } catch(e) {}
  try { decVinc    = await escGet(`/rest/v1/escritorio_plano_decisoes?planejamento_id=eq.${id}`); } catch(e) {}
  try { reunVinc   = await escGet(`/rest/v1/escritorio_plano_reunioes?planejamento_id=eq.${id}`); } catch(e) {}

  // Buscar dados reais dos vínculos
  let projetos=[], decisoes=[], reunioes=[];
  if (projVinc.length) {
    const ids = projVinc.map(x=>x.projeto_id).join(',');
    try { projetos = await escGet(`/rest/v1/escritorio_projetos?id=in.(${ids})`); } catch(e) {}
  }
  if (decVinc.length) {
    const ids = decVinc.map(x=>x.decisao_id).join(',');
    try { decisoes = await escGet(`/rest/v1/escritorio_decisoes?id=in.(${ids})&select=id,titulo,status,area`); } catch(e) {}
  }
  if (reunVinc.length) {
    const ids = reunVinc.map(x=>x.reuniao_id).join(',');
    try { reunioes = await escGet(`/rest/v1/escritorio_reunioes?id=in.(${ids})&select=id,titulo,status,data`); } catch(e) {}
  }

  // Tarefas via projetos vinculados
  if (projetos.length) {
    const pids = projetos.map(p=>p.id).join(',');
    try { tarefas = await escGet(`/rest/v1/escritorio_tarefas?projeto_id=in.(${pids})&status=neq.concluida&order=prioridade.asc&limit=10`); } catch(e) {}
  }

  const st = PL_STATUS[pl.status]||{label:pl.status,cor:'gray'};
  const emoji = PL_TIPOS[pl.periodo_tipo]?.emoji||'📄';
  const AREA_COR={'JS Mentoria':'area-js','Moni Sul':'area-moni'};
  const PRIO_ST = {pendente:'gray',em_andamento:'blue',concluida:'green',adiada:'amber'};
  const hoje = new Date().toISOString().split('T')[0];

  content.innerHTML = `
    <!-- Breadcrumb -->
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:20px;font-size:13px">
      <span style="color:var(--text3);cursor:pointer" onclick="escNavegar('planejamento')">Planejamento</span>
      <span style="color:var(--border2)">›</span>
      <span style="color:var(--text)">${escEsc(pl.titulo)}</span>
    </div>

    <!-- Header -->
    <div style="display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:24px">
      <div>
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:6px">
          <span style="font-size:20px">${emoji}</span>
          <span class="${AREA_COR[pl.area]||'area-js'}">${pl.area}</span>
          <span class="badge badge-gray">${PL_TIPOS[pl.periodo_tipo]?.label||''} — ${plPeriodoLabel(pl)}</span>
          <span class="badge badge-${st.cor}">${st.label}</span>
        </div>
        <h2 style="font-size:20px;font-weight:700;color:var(--text);margin-bottom:4px">${escEsc(pl.titulo)}</h2>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn btn-secondary btn-sm" onclick="plAbrirForm('${id}')">✏ Editar</button>
        ${pl.status!=='encerrado'?`<button class="btn btn-secondary btn-sm" style="color:var(--amber);border-color:var(--amber)" onclick="plAbrirRevisao('${id}')">↻ Revisar</button>`:''}
        ${pl.status!=='encerrado'?`<button class="btn btn-secondary btn-sm" style="color:var(--red);border-color:var(--red)" onclick="plEncerrar('${id}')">✓ Encerrar</button>`:''}
      </div>
    </div>

    <!-- 1. Foco + Objetivo -->
    ${pl.foco_principal?`
      <div style="background:var(--accent-dim);border:1px solid var(--accent-border);border-radius:12px;padding:18px 22px;margin-bottom:16px">
        <div style="font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--accent);margin-bottom:6px">Foco principal</div>
        <div style="font-size:15px;color:var(--text);font-style:italic;line-height:1.5">"${escEsc(pl.foco_principal)}"</div>
      </div>`:``}

    ${pl.objetivo_geral?`
      <div class="esc-card" style="margin-bottom:16px">
        <div class="esc-card-title">Objetivo geral</div>
        <div style="font-size:13px;color:var(--text2);line-height:1.7;white-space:pre-wrap">${escEsc(pl.objetivo_geral)}</div>
      </div>`:``}

    <!-- 2. Prioridades -->
    <div class="esc-card" style="margin-bottom:16px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
        <div class="esc-card-title" style="margin-bottom:0">Prioridades (${prioridades.length})</div>
        ${pl.status!=='encerrado'?`<button class="btn btn-secondary btn-sm" onclick="plNovaPrioridade('${id}')">+ Prioridade</button>`:''}
      </div>
      ${prioridades.length===0
        ? `<div style="color:var(--text3);font-size:13px">Nenhuma prioridade cadastrada.</div>`
        : prioridades.map((p,i)=>`
          <div style="display:flex;align-items:flex-start;gap:12px;padding:10px 0;border-bottom:1px solid var(--border)">
            <div style="font-size:18px;font-weight:700;color:var(--accent);min-width:24px;text-align:right;flex-shrink:0;margin-top:1px">${i+1}</div>
            <div style="flex:1">
              <div style="font-size:13px;font-weight:500;color:${p.status==='concluida'?'var(--text3)':'var(--text)'}${p.status==='concluida'?';text-decoration:line-through':''}">${escEsc(p.titulo)}</div>
              ${p.descricao?`<div style="font-size:12px;color:var(--text3);margin-top:2px;line-height:1.4">${escEsc(p.descricao)}</div>`:''}
              ${p.responsavel_id?`<div style="font-size:11px;color:var(--text3);margin-top:3px">${escEsc(p.responsavel_id)}</div>`:''}
            </div>
            <div style="display:flex;align-items:center;gap:6px;flex-shrink:0">
              <span class="badge badge-${PRIO_ST[p.status]||'gray'}">${{pendente:'Pendente',em_andamento:'Em andamento',concluida:'Concluída',adiada:'Adiada'}[p.status]||p.status}</span>
              ${pl.status!=='encerrado'&&p.status!=='concluida'?`<button onclick="plConcluirPrioridade('${p.id}')" title="Concluir" style="background:none;border:1px solid var(--border);border-radius:4px;color:var(--text3);padding:2px 7px;cursor:pointer;font-size:11px">✓</button>`:''}
            </div>
          </div>`).join('')}
    </div>

    <!-- 3. Não priorizar -->
    ${pl.nao_priorizar?`
      <div class="esc-card" style="margin-bottom:16px;border-color:rgba(248,81,73,.2)">
        <div class="esc-card-title" style="color:var(--red)">Não priorizar agora</div>
        <div style="font-size:13px;color:var(--text2);line-height:1.7;white-space:pre-wrap">${escEsc(pl.nao_priorizar)}</div>
      </div>`:``}

    <!-- 4. Campos estratégicos (grid) -->
    ${pl.oportunidades||pl.riscos||pl.hipoteses||pl.indicadores?`
      <div class="esc-grid-2" style="gap:14px;margin-bottom:16px">
        ${pl.oportunidades?`<div class="esc-card"><div class="esc-card-title" style="color:var(--green)">Oportunidades</div><div style="font-size:13px;color:var(--text2);line-height:1.6;white-space:pre-wrap">${escEsc(pl.oportunidades)}</div></div>`:``}
        ${pl.riscos?`<div class="esc-card"><div class="esc-card-title" style="color:var(--amber)">Riscos e pontos de atenção</div><div style="font-size:13px;color:var(--text2);line-height:1.6;white-space:pre-wrap">${escEsc(pl.riscos)}</div></div>`:``}
        ${pl.hipoteses?`<div class="esc-card"><div class="esc-card-title">Hipóteses</div><div style="font-size:13px;color:var(--text2);line-height:1.6;white-space:pre-wrap">${escEsc(pl.hipoteses)}</div></div>`:``}
        ${pl.indicadores?`<div class="esc-card"><div class="esc-card-title">Indicadores de acompanhamento</div><div style="font-size:13px;color:var(--text2);line-height:1.6;white-space:pre-wrap">${escEsc(pl.indicadores)}</div></div>`:``}
      </div>`:``}

    <!-- 5. Projetos vinculados -->
    <div class="esc-card" style="margin-bottom:16px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
        <div class="esc-card-title" style="margin-bottom:0">Projetos relacionados (${projetos.length})</div>
        ${pl.status!=='encerrado'?`<button class="btn btn-secondary btn-sm" onclick="plVincularProjeto('${id}')">+ Vincular projeto</button>`:''}
      </div>
      ${projetos.length===0
        ? `<div style="color:var(--text3);font-size:13px">Nenhum projeto vinculado.</div>`
        : `<div class="esc-list">${projetos.map(p=>{
            const pct = 0; // simplificado
            const PS = {planejamento:'gray',em_andamento:'blue',pausado:'amber',concluido:'green',cancelado:'red'};
            const PL2 = {planejamento:'Planejamento',em_andamento:'Em andamento',pausado:'Pausado',concluido:'Concluído',cancelado:'Cancelado'};
            return `<div class="esc-list-item" onclick="pAbrirDetalhe&&pAbrirDetalhe('${p.id}')">
              <div style="flex:1"><div style="font-size:13px;font-weight:500;color:var(--text)">${escEsc(p.nome)}</div>
                ${p.responsavel_id?`<div style="font-size:11px;color:var(--text3)">${escEsc(p.responsavel_id)}</div>`:''}
              </div>
              <span class="badge badge-${PS[p.status]||'gray'}">${PL2[p.status]||p.status}</span>
            </div>`;}).join('')}</div>`}
    </div>

    <!-- 6. Tarefas (via projetos) -->
    ${tarefas.length?`
      <div class="esc-card" style="margin-bottom:16px">
        <div class="esc-card-title">Tarefas em andamento (via projetos)</div>
        <div class="esc-list">${tarefas.slice(0,8).map(t=>tItemHtml(t,hoje)).join('')}</div>
        ${tarefas.length>8?`<div style="font-size:12px;color:var(--text3);text-align:center;margin-top:8px">${tarefas.length-8} mais → ver em Tarefas</div>`:''}
      </div>`:``}

    <!-- 7. Decisões vinculadas -->
    <div class="esc-card" style="margin-bottom:16px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
        <div class="esc-card-title" style="margin-bottom:0">Decisões relacionadas (${decisoes.length})</div>
        ${pl.status!=='encerrado'?`<button class="btn btn-secondary btn-sm" onclick="plVincularDecisao('${id}')">+ Vincular decisão</button>`:''}
      </div>
      ${decisoes.length===0
        ? `<div style="color:var(--text3);font-size:13px">Nenhuma decisão vinculada.</div>`
        : `<div class="esc-list">${decisoes.map(d=>{
            const DS={'ativa':'green','em_acompanhamento':'blue','revisada':'purple','substituida':'amber','cancelada':'red'};
            const DL={'ativa':'Ativa','em_acompanhamento':'Em acompanhamento','revisada':'Revisada','substituida':'Substituída','cancelada':'Cancelada'};
            return `<div class="esc-list-item" onclick="dAbrirDetalhe&&dAbrirDetalhe('${d.id}');escNavegar('decisoes')">
              <div style="flex:1;font-size:13px;color:var(--text)">${escEsc(d.titulo)}</div>
              <span class="badge badge-${DS[d.status]||'gray'}">${DL[d.status]||d.status}</span>
            </div>`;}).join('')}</div>`}
    </div>

    <!-- 8. Reuniões vinculadas -->
    <div class="esc-card" style="margin-bottom:16px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
        <div class="esc-card-title" style="margin-bottom:0">Reuniões relacionadas (${reunioes.length})</div>
        ${pl.status!=='encerrado'?`<button class="btn btn-secondary btn-sm" onclick="plVincularReuniao('${id}')">+ Vincular reunião</button>`:''}
      </div>
      ${reunioes.length===0
        ? `<div style="color:var(--text3);font-size:13px">Nenhuma reunião vinculada.</div>`
        : `<div class="esc-list">${reunioes.map(r=>{
            const RS={'agendada':'blue','realizada':'green','cancelada':'red'};
            const RL={'agendada':'Agendada','realizada':'Realizada','cancelada':'Cancelada'};
            const dt = r.data?new Date(r.data+'T12:00:00').toLocaleDateString('pt-BR'):'';
            return `<div class="esc-list-item" onclick="rAbrirDetalhe&&rAbrirDetalhe('${r.id}');escNavegar('reunioes')">
              <div style="flex:1"><div style="font-size:13px;color:var(--text)">${escEsc(r.titulo)}</div>
                ${dt?`<div style="font-size:11px;color:var(--text3)">${dt}</div>`:''}
              </div>
              <span class="badge badge-${RS[r.status]||'gray'}">${RL[r.status]||r.status}</span>
            </div>`;}).join('')}</div>`}
    </div>

    <!-- 9. Datas importantes -->
    ${pl.datas_importantes?`
      <div class="esc-card">
        <div class="esc-card-title">Datas importantes</div>
        <div style="font-size:13px;color:var(--text2);line-height:1.8;white-space:pre-wrap">${escEsc(pl.datas_importantes)}</div>
      </div>`:``}`;
}

// ── VINCULAR PROJETO ──
function plVincularProjeto(plId) {
  const vinculados = _plCache.find(x=>x.id===plId)?._vinc_proj||[];
  document.getElementById('esc-modal-title').textContent = 'Vincular projeto';
  const projDisp = (_projetosCache||[]).filter(p=>!['cancelado'].includes(p.status));
  document.getElementById('esc-modal-body').innerHTML = `
    <div class="esc-field">
      <label class="esc-label">Projeto</label>
      <select class="esc-select" id="pv-projeto">
        <option value="">Selecionar projeto</option>
        ${projDisp.map(p=>`<option value="${p.id}">${escEsc(p.nome)}</option>`).join('')}
      </select>
    </div>
    <div style="display:flex;gap:10px;justify-content:flex-end">
      <button class="btn btn-secondary" onclick="escFecharModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="plSalvarVinculo('${plId}','projeto')">Vincular</button>
    </div>`;
  document.getElementById('esc-modal-overlay').classList.add('open');
}

// ── VINCULAR DECISÃO ──
function plVincularDecisao(plId) {
  document.getElementById('esc-modal-title').textContent = 'Vincular decisão';
  const decDisp = (_decisoesCache||[]).filter(d=>['ativa','em_acompanhamento'].includes(d.status));
  document.getElementById('esc-modal-body').innerHTML = `
    <div class="esc-field">
      <label class="esc-label">Decisão</label>
      <select class="esc-select" id="pv-decisao">
        <option value="">Selecionar decisão</option>
        ${decDisp.map(d=>`<option value="${d.id}">${escEsc(d.titulo)}</option>`).join('')}
      </select>
    </div>
    <div style="display:flex;gap:10px;justify-content:flex-end">
      <button class="btn btn-secondary" onclick="escFecharModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="plSalvarVinculo('${plId}','decisao')">Vincular</button>
    </div>`;
  document.getElementById('esc-modal-overlay').classList.add('open');
}

// ── VINCULAR REUNIÃO ──
function plVincularReuniao(plId) {
  document.getElementById('esc-modal-title').textContent = 'Vincular reunião';
  const reunDisp = (_reunioesCache||[]).filter(r=>r.status!=='cancelada');
  document.getElementById('esc-modal-body').innerHTML = `
    <div class="esc-field">
      <label class="esc-label">Reunião</label>
      <select class="esc-select" id="pv-reuniao">
        <option value="">Selecionar reunião</option>
        ${reunDisp.map(r=>`<option value="${r.id}">${escEsc(r.titulo)}${r.data?' — '+r.data:''}</option>`).join('')}
      </select>
    </div>
    <div style="display:flex;gap:10px;justify-content:flex-end">
      <button class="btn btn-secondary" onclick="escFecharModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="plSalvarVinculo('${plId}','reuniao')">Vincular</button>
    </div>`;
  document.getElementById('esc-modal-overlay').classList.add('open');
}

async function plSalvarVinculo(plId, tipo) {
  const tabelas = { projeto:'escritorio_plano_projetos', decisao:'escritorio_plano_decisoes', reuniao:'escritorio_plano_reunioes' };
  const campos  = { projeto:'projeto_id', decisao:'decisao_id', reuniao:'reuniao_id' };
  const selIds  = { projeto:'pv-projeto', decisao:'pv-decisao', reuniao:'pv-reuniao' };
  const fId = document.getElementById(selIds[tipo])?.value;
  if (!fId) { escToast('Selecione um item.'); return; }
  try {
    await fetch(ESC_SUPA_URL+'/rest/v1/'+tabelas[tipo], {
      method:'POST',
      headers:{'apikey':ESC_SUPA_KEY,'Authorization':'Bearer '+ESC_SUPA_KEY,'Content-Type':'application/json','Prefer':'return=minimal'},
      body: JSON.stringify({ planejamento_id:plId, [campos[tipo]]:fId })
    });
    escToast('Vinculado! ✓');
    escFecharModal();
    plAbrirDetalhe(plId);
  } catch(e) { escToast('Erro ao vincular.'); }
}

// ── PRIORIDADES ──
function plNovaPrioridade(plId) {
  document.getElementById('esc-modal-title').textContent = 'Nova prioridade';
  document.getElementById('esc-modal-body').innerHTML = `
    <div class="esc-field">
      <label class="esc-label">Título <span style="color:var(--red)">*</span></label>
      <input class="esc-input" id="pp-titulo" placeholder="Ex: Estruturar captação">
    </div>
    <div class="esc-field">
      <label class="esc-label">Descrição</label>
      <textarea class="esc-textarea" id="pp-desc" rows="2" placeholder="Detalhe a prioridade..."></textarea>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
      <div class="esc-field">
        <label class="esc-label">Ordem</label>
        <select class="esc-select" id="pp-ordem">
          ${[1,2,3,4,5].map(n=>`<option value="${n}">${n}</option>`).join('')}
        </select>
      </div>
      <div class="esc-field">
        <label class="esc-label">Responsável</label>
        <select class="esc-select" id="pp-resp">
          <option value="">Selecionar</option>
          ${PL_RESPONSAVEIS.map(r=>`<option value="${r}">${r}</option>`).join('')}
        </select>
      </div>
    </div>
    <div style="display:flex;gap:10px;justify-content:flex-end">
      <button class="btn btn-secondary" onclick="escFecharModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="plSalvarPrioridade('${plId}')">Salvar</button>
    </div>`;
  document.getElementById('esc-modal-overlay').classList.add('open');
  document.getElementById('pp-titulo')?.focus();
}

async function plSalvarPrioridade(plId) {
  const titulo = document.getElementById('pp-titulo')?.value?.trim();
  if (!titulo) { escToast('Informe o título.'); return; }
  const obj = {
    planejamento_id: plId,
    titulo, status: 'pendente',
    descricao:      document.getElementById('pp-desc')?.value||null,
    ordem:          parseInt(document.getElementById('pp-ordem')?.value)||1,
    responsavel_id: document.getElementById('pp-resp')?.value||null,
  };
  try {
    await fetch(ESC_SUPA_URL+'/rest/v1/escritorio_plano_prioridades',{
      method:'POST',
      headers:{'apikey':ESC_SUPA_KEY,'Authorization':'Bearer '+ESC_SUPA_KEY,'Content-Type':'application/json','Prefer':'return=minimal'},
      body:JSON.stringify(obj)
    });
    escToast('Prioridade adicionada!');
    escFecharModal();
    plAbrirDetalhe(plId);
  } catch(e){ escToast('Erro ao salvar.'); }
}

async function plConcluirPrioridade(ppId) {
  try {
    await fetch(ESC_SUPA_URL+'/rest/v1/escritorio_plano_prioridades?id=eq.'+ppId,{
      method:'PATCH',
      headers:{'apikey':ESC_SUPA_KEY,'Authorization':'Bearer '+ESC_SUPA_KEY,'Content-Type':'application/json','Prefer':'return=minimal'},
      body:JSON.stringify({status:'concluida', updated_at:new Date().toISOString()})
    });
    escToast('Prioridade concluída! ✓');
    if(_plDetalheId) plAbrirDetalhe(_plDetalheId);
  } catch(e){ escToast('Erro.'); }
}

// ── ENCERRAR ──
async function plEncerrar(id) {
  if (!confirm('Encerrar este planejamento? Os dados e vínculos serão preservados.')) return;
  const agora = new Date().toISOString();
  try {
    const res = await fetch(ESC_SUPA_URL+'/rest/v1/escritorio_planejamentos?id=eq.'+id,{
      method:'PATCH',
      headers:{'apikey':ESC_SUPA_KEY,'Authorization':'Bearer '+ESC_SUPA_KEY,'Content-Type':'application/json','Prefer':'return=representation'},
      body:JSON.stringify({status:'encerrado', encerrado_em:agora, updated_at:agora})
    });
    const updated = await res.json();
    if(Array.isArray(updated)){const idx=_plCache.findIndex(x=>x.id===id);if(idx>=0) _plCache[idx]=updated[0];}
    escToast('Planejamento encerrado.');
    if (_plDetalheId===id) plAbrirDetalhe(id);
    else plRenderLista();
  } catch(e){ escToast('Erro.'); }
}

// ── REVISÃO ──
function plAbrirRevisao(id) {
  const pl = _plCache.find(x=>x.id===id);
  document.getElementById('esc-modal-title').textContent = 'Revisar planejamento';
  document.getElementById('esc-modal-body').innerHTML = `
    <div style="font-size:13px;color:var(--text2);margin-bottom:14px">Atualize o que mudou neste período sem apagar o histórico.</div>
    <div class="esc-field">
      <label class="esc-label">Foco principal (atualizado)</label>
      <input class="esc-input" id="rv-foco" value="${escEsc(pl?.foco_principal||'')}">
    </div>
    <div class="esc-field">
      <label class="esc-label">Observações da revisão</label>
      <textarea class="esc-textarea" id="rv-obs" rows="4" placeholder="O que mudou? O que foi ajustado? Por quê?"></textarea>
    </div>
    <div class="esc-field">
      <label class="esc-label">Novo status</label>
      <select class="esc-select" id="rv-status">
        ${Object.entries(PL_STATUS).filter(([k])=>k!=='encerrado').map(([k,v])=>`<option value="${k}" ${pl?.status===k?'selected':''}>${v.label}</option>`).join('')}
      </select>
    </div>
    <div style="display:flex;gap:10px;justify-content:flex-end">
      <button class="btn btn-secondary" onclick="escFecharModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="plSalvarRevisao('${id}')">Salvar revisão</button>
    </div>`;
  document.getElementById('esc-modal-overlay').classList.add('open');
}

async function plSalvarRevisao(id) {
  const pl = _plCache.find(x=>x.id===id);
  const foco   = document.getElementById('rv-foco')?.value?.trim();
  const obs    = document.getElementById('rv-obs')?.value||'';
  const status = document.getElementById('rv-status')?.value||'em_revisao';
  const novoObjetivo = obs ? (pl?.objetivo_geral||'') + (obs?'\n\n[Revisão '+new Date().toLocaleDateString('pt-BR')+']: '+obs:'') : pl?.objetivo_geral;
  const patch = {status, updated_at:new Date().toISOString()};
  if(foco) patch.foco_principal = foco;
  if(obs)  patch.objetivo_geral = novoObjetivo;
  try {
    const res = await fetch(ESC_SUPA_URL+'/rest/v1/escritorio_planejamentos?id=eq.'+id,{
      method:'PATCH',
      headers:{'apikey':ESC_SUPA_KEY,'Authorization':'Bearer '+ESC_SUPA_KEY,'Content-Type':'application/json','Prefer':'return=representation'},
      body:JSON.stringify(patch)
    });
    const updated = await res.json();
    if(Array.isArray(updated)){const idx=_plCache.findIndex(x=>x.id===id);if(idx>=0)_plCache[idx]=updated[0];}
    escToast('Revisão salva!');
    escFecharModal();
    plAbrirDetalhe(id);
  } catch(e){ escToast('Erro.'); }
}

// ── FORMULÁRIO ──
function plAbrirForm(id) {
  _plEditandoId = id||null;
  const pl = id ? _plCache.find(x=>x.id===id) : null;
  const hoje_ano = ANO_ATUAL;
  document.getElementById('esc-modal-title').textContent = pl?'Editar planejamento':'Novo planejamento';
  document.getElementById('esc-modal-body').innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
      <div class="esc-field">
        <label class="esc-label">Área <span style="color:var(--red)">*</span></label>
        <select class="esc-select" id="pf-area" onchange="plToggleCamposPeriodo(this.value)">
          ${PL_AREAS.map(a=>`<option value="${a}" ${(pl?.area||_plfiltros.area)===a?'selected':''}>${a}</option>`).join('')}
        </select>
      </div>
      <div class="esc-field">
        <label class="esc-label">Período <span style="color:var(--red)">*</span></label>
        <select class="esc-select" id="pf-tipo" onchange="plToggleCamposPeriodo(document.getElementById('pf-area').value, this.value)">
          ${Object.entries(PL_TIPOS).map(([k,v])=>`<option value="${k}" ${pl?.periodo_tipo===k?'selected':''}>${v.label}</option>`).join('')}
        </select>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px" id="pf-periodo-grid">
      <div class="esc-field">
        <label class="esc-label">Ano <span style="color:var(--red)">*</span></label>
        <input class="esc-input" type="number" id="pf-ano" value="${pl?.ano||hoje_ano}" min="2020" max="2035">
      </div>
      <div class="esc-field" id="pf-trim-wrap" style="${!pl||pl.periodo_tipo!=='trimestral'?'display:none':''}">
        <label class="esc-label">Trimestre</label>
        <select class="esc-select" id="pf-trim">
          ${PL_TRIMESTRES.map((t,i)=>`<option value="${i+1}" ${pl?.trimestre===i+1?'selected':''}>${t}</option>`).join('')}
        </select>
      </div>
      <div class="esc-field" id="pf-mes-wrap" style="${!pl||pl.periodo_tipo!=='mensal'?'display:none':''}">
        <label class="esc-label">Mês</label>
        <select class="esc-select" id="pf-mes">
          ${PL_MESES.map((m,i)=>`<option value="${i+1}" ${pl?.mes===i+1?'selected':''}>${m}</option>`).join('')}
        </select>
      </div>
    </div>
    <div class="esc-field">
      <label class="esc-label">Título <span style="color:var(--red)">*</span></label>
      <input class="esc-input" id="pf-titulo" value="${escEsc(pl?.titulo||'')}" placeholder="Ex: JS Mentoria — Setembro 2026">
    </div>
    <div class="esc-field">
      <label class="esc-label">Foco principal <span style="color:var(--red)">*</span></label>
      <textarea class="esc-textarea" id="pf-foco" rows="2" placeholder="Uma frase que resume o direcionamento deste período...">${escEsc(pl?.foco_principal||'')}</textarea>
    </div>
    <div class="esc-field">
      <label class="esc-label">Objetivo geral</label>
      <textarea class="esc-textarea" id="pf-objetivo" rows="3" placeholder="O que se pretende construir ou alcançar?">${escEsc(pl?.objetivo_geral||'')}</textarea>
    </div>
    <div class="esc-field">
      <label class="esc-label">Não priorizar agora (opcional)</label>
      <textarea class="esc-textarea" id="pf-nao" rows="2" placeholder="Ex: Não iniciar novo produto; Não alterar identidade visual">${escEsc(pl?.nao_priorizar||'')}</textarea>
    </div>
    <div class="esc-grid-2" style="gap:10px">
      <div class="esc-field">
        <label class="esc-label">Oportunidades</label>
        <textarea class="esc-textarea" id="pf-op" rows="3" placeholder="O que merece atenção este período?">${escEsc(pl?.oportunidades||'')}</textarea>
      </div>
      <div class="esc-field">
        <label class="esc-label">Riscos e pontos de atenção</label>
        <textarea class="esc-textarea" id="pf-riscos" rows="3" placeholder="O que pode comprometer o planejamento?">${escEsc(pl?.riscos||'')}</textarea>
      </div>
    </div>
    <div class="esc-grid-2" style="gap:10px">
      <div class="esc-field">
        <label class="esc-label">Hipóteses</label>
        <textarea class="esc-textarea" id="pf-hip" rows="2" placeholder="Ideias ou caminhos a validar...">${escEsc(pl?.hipoteses||'')}</textarea>
      </div>
      <div class="esc-field">
        <label class="esc-label">Indicadores a acompanhar</label>
        <textarea class="esc-textarea" id="pf-ind" rows="2" placeholder="Informações que serão observadas...">${escEsc(pl?.indicadores||'')}</textarea>
      </div>
    </div>
    <div class="esc-field">
      <label class="esc-label">Datas importantes (opcional)</label>
      <textarea class="esc-textarea" id="pf-datas" rows="2" placeholder="Ex: Black Friday — 27/11; Troca de estação — início de setembro">${escEsc(pl?.datas_importantes||'')}</textarea>
    </div>
    ${pl?`<div class="esc-field">
      <label class="esc-label">Status</label>
      <select class="esc-select" id="pf-status">
        ${Object.entries(PL_STATUS).map(([k,v])=>`<option value="${k}" ${pl.status===k?'selected':''}>${v.label}</option>`).join('')}
      </select>
    </div>`:''}
    <div style="display:flex;gap:10px;justify-content:flex-end">
      <button class="btn btn-secondary" onclick="escFecharModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="plSalvar()">${pl?'Salvar alterações':'Criar planejamento'}</button>
    </div>`;
  document.getElementById('esc-modal-overlay').classList.add('open');
  document.getElementById('pf-titulo')?.focus();

  // Trigger para mostrar/ocultar campos de trimestre/mês
  if (pl?.periodo_tipo) plToggleCamposPeriodo(pl.area, pl.periodo_tipo);
}

function plToggleCamposPeriodo(area, tipo) {
  const t = tipo || document.getElementById('pf-tipo')?.value;
  const trimWrap = document.getElementById('pf-trim-wrap');
  const mesWrap  = document.getElementById('pf-mes-wrap');
  if (trimWrap) trimWrap.style.display = t==='trimestral'?'block':'none';
  if (mesWrap)  mesWrap.style.display  = t==='mensal'?'block':'none';
}

async function plSalvar() {
  const titulo = document.getElementById('pf-titulo')?.value?.trim();
  const area   = document.getElementById('pf-area')?.value;
  const tipo   = document.getElementById('pf-tipo')?.value;
  const ano    = parseInt(document.getElementById('pf-ano')?.value);
  const foco   = document.getElementById('pf-foco')?.value?.trim();
  if (!titulo) { escToast('Informe o título.'); return; }
  if (!area)   { escToast('Selecione a área.'); return; }
  if (!tipo)   { escToast('Selecione o tipo.'); return; }
  if (!ano||isNaN(ano)) { escToast('Informe o ano.'); return; }
  if (!foco)   { escToast('Informe o foco principal.'); return; }

  const obj = {
    titulo, area, periodo_tipo:tipo, ano,
    trimestre:      tipo==='trimestral'?parseInt(document.getElementById('pf-trim')?.value)||null:null,
    mes:            tipo==='mensal'?parseInt(document.getElementById('pf-mes')?.value)||null:null,
    foco_principal: foco,
    objetivo_geral: document.getElementById('pf-objetivo')?.value||null,
    nao_priorizar:  document.getElementById('pf-nao')?.value||null,
    oportunidades:  document.getElementById('pf-op')?.value||null,
    riscos:         document.getElementById('pf-riscos')?.value||null,
    hipoteses:      document.getElementById('pf-hip')?.value||null,
    indicadores:    document.getElementById('pf-ind')?.value||null,
    datas_importantes: document.getElementById('pf-datas')?.value||null,
    status:         document.getElementById('pf-status')?.value||'ativo',
    created_by:     ESC_STATE?.usuario||'Jéssica',
    updated_at:     new Date().toISOString(),
  };

  try {
    if (_plEditandoId) {
      const res = await fetch(ESC_SUPA_URL+'/rest/v1/escritorio_planejamentos?id=eq.'+_plEditandoId,{
        method:'PATCH',
        headers:{'apikey':ESC_SUPA_KEY,'Authorization':'Bearer '+ESC_SUPA_KEY,'Content-Type':'application/json','Prefer':'return=representation'},
        body:JSON.stringify(obj)
      });
      const updated = await res.json();
      if(Array.isArray(updated)){const idx=_plCache.findIndex(x=>x.id===_plEditandoId);if(idx>=0)_plCache[idx]=updated[0];}
      escToast('Planejamento atualizado!');
    } else {
      const res = await fetch(ESC_SUPA_URL+'/rest/v1/escritorio_planejamentos',{
        method:'POST',
        headers:{'apikey':ESC_SUPA_KEY,'Authorization':'Bearer '+ESC_SUPA_KEY,'Content-Type':'application/json','Prefer':'return=representation'},
        body:JSON.stringify(obj)
      });
      const created = await res.json();
      if(Array.isArray(created)) _plCache.unshift(created[0]);
      escToast('Planejamento criado!');
    }
    escFecharModal();
    if(_plDetalheId&&_plEditandoId===_plDetalheId) plAbrirDetalhe(_plDetalheId);
    else plRenderLista();
  } catch(e){ escToast('Erro ao salvar.'); console.error(e); }
}
