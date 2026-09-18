/* ══════════════════════════════════════════════════
   MÓDULO DECISÕES — escritorio-interno
   Memória estratégica da empresa
   ══════════════════════════════════════════════════ */

const D_STATUS = {
  ativa:             { label:'Ativa',              cor:'green'  },
  em_acompanhamento: { label:'Em acompanhamento',  cor:'blue'   },
  revisada:          { label:'Revisada',            cor:'purple' },
  substituida:       { label:'Substituída',         cor:'amber'  },
  cancelada:         { label:'Cancelada',           cor:'red'    },
};
const D_AREAS        = ['JS Mentoria','Moni Sul','Interno'];
const D_RESPONSAVEIS = ['Jéssica','Amanda'];
const D_ORIGENS      = { manual:'Registro manual', reuniao:'Reunião', caixa_entrada:'Caixa de Entrada', projeto:'Projeto' };

let _dfiltros    = { view:'ativas', area:'', status:'', responsavel:'', origem:'' };
let _decisoesCache = [];
let _dEditandoId = null;
let _dDetalheId  = null;

// ── RENDER PRINCIPAL ──
async function escRenderDecisoes(el) {
  el.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:20px">
      <div style="display:flex;gap:6px;flex-wrap:wrap" id="d-views"></div>
      <button class="btn btn-primary" onclick="dAbrirForm()">+ Nova decisão</button>
    </div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px">
      <select class="esc-select" style="width:auto;min-width:130px" onchange="dSetFiltro('area',this.value)">
        <option value="">Todas as áreas</option>
        ${D_AREAS.map(a=>`<option value="${a}">${a}</option>`).join('')}
      </select>
      <select class="esc-select" style="width:auto;min-width:140px" onchange="dSetFiltro('responsavel',this.value)">
        <option value="">Todos os responsáveis</option>
        ${D_RESPONSAVEIS.map(r=>`<option value="${r}">${r}</option>`).join('')}
      </select>
      <select class="esc-select" style="width:auto;min-width:140px" onchange="dSetFiltro('origem',this.value)">
        <option value="">Todas as origens</option>
        ${Object.entries(D_ORIGENS).map(([k,v])=>`<option value="${k}">${v}</option>`).join('')}
      </select>
      <button class="btn btn-secondary btn-sm" onclick="dLimparFiltros()">Limpar</button>
    </div>
    <div id="d-kpis" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:10px;margin-bottom:20px"></div>
    <div id="d-lista"><div style="color:var(--text3);text-align:center;padding:40px">Carregando...</div></div>
  `;
  dRenderViews();
  await dCarregar();
}

function dRenderViews() {
  const VIEWS = [
    { id:'ativas',           label:'Ativas'           },
    { id:'em_acompanhamento',label:'Em acompanhamento'},
    { id:'para_revisar',     label:'Para revisar'     },
    { id:'recentes',         label:'Recentes'         },
    { id:'historico',        label:'Histórico'        },
    { id:'todas',            label:'Todas'            },
  ];
  document.getElementById('d-views').innerHTML = VIEWS.map(v=>`
    <button class="btn ${_dfiltros.view===v.id?'btn-primary':'btn-secondary'} btn-sm"
      onclick="dSetView('${v.id}')">${v.label}</button>`).join('');
}

function dSetView(v)     { _dfiltros.view=v; dRenderViews(); dRenderLista(); }
function dSetFiltro(k,v) { _dfiltros[k]=v; dRenderLista(); }
function dLimparFiltros() {
  _dfiltros = {..._dfiltros, area:'', status:'', responsavel:'', origem:''};
  document.querySelectorAll('[onchange*="dSetFiltro"]').forEach(s=>s.selectedIndex=0);
  dRenderLista();
}

async function dCarregar() {
  try {
    _decisoesCache = await escGet('/rest/v1/escritorio_decisoes?order=created_at.desc');
    if (!Array.isArray(_decisoesCache)) _decisoesCache = [];
  } catch(e) { _decisoesCache = []; console.error(e); }
  dRenderKpis();
  dRenderLista();
}

function dFiltrar() {
  const hoje = new Date().toISOString().split('T')[0];
  const em7d = new Date(Date.now()+7*86400000).toISOString().split('T')[0];
  let lista = [..._decisoesCache];

  const v = _dfiltros.view;
  if (v==='ativas')           lista = lista.filter(d=>d.status==='ativa');
  else if(v==='em_acompanhamento') lista = lista.filter(d=>d.status==='em_acompanhamento');
  else if(v==='para_revisar') lista = lista.filter(d=>
    d.data_revisao && d.data_revisao <= em7d && ['ativa','em_acompanhamento'].includes(d.status));
  else if(v==='recentes') {
    const limite = new Date(Date.now()-30*86400000).toISOString();
    lista = lista.filter(d=>d.created_at >= limite);
  } else if(v==='historico') {
    lista = lista.filter(d=>['revisada','substituida','cancelada'].includes(d.status));
  }

  if (_dfiltros.area)        lista = lista.filter(d=>d.area===_dfiltros.area);
  if (_dfiltros.responsavel) lista = lista.filter(d=>d.responsavel_id===_dfiltros.responsavel);
  if (_dfiltros.origem)      lista = lista.filter(d=>d.origem_tipo===_dfiltros.origem);
  return lista;
}

function dRenderKpis() {
  const hoje = new Date().toISOString().split('T')[0];
  const em7d = new Date(Date.now()+7*86400000).toISOString().split('T')[0];
  const kpis = [
    {val:_decisoesCache.filter(d=>d.status==='ativa').length,            lbl:'Ativas',           cor:'green' },
    {val:_decisoesCache.filter(d=>d.status==='em_acompanhamento').length, lbl:'Em acompanhamento',cor:'blue'  },
    {val:_decisoesCache.filter(d=>d.data_revisao&&d.data_revisao<=em7d&&['ativa','em_acompanhamento'].includes(d.status)).length,
                                                                           lbl:'Para revisar',    cor:'amber' },
    {val:_decisoesCache.filter(d=>['revisada','substituida','cancelada'].includes(d.status)).length,
                                                                           lbl:'Histórico',       cor:''      },
  ];
  const CORES={green:'var(--green)',blue:'var(--accent)',amber:'var(--amber)','':'var(--text)'};
  const el=document.getElementById('d-kpis');
  if(el) el.innerHTML=kpis.map(k=>`
    <div class="esc-kpi" style="${k.cor?`border-color:${CORES[k.cor]}22`:''}">
      <div class="esc-kpi-val" style="color:${CORES[k.cor]};font-size:22px">${k.val}</div>
      <div class="esc-kpi-lbl">${k.lbl}</div>
    </div>`).join('');
}

function dRenderLista() {
  const el=document.getElementById('d-lista');
  if(!el) return;
  const lista=dFiltrar();
  if(!lista.length){
    el.innerHTML=`<div style="color:var(--text3);text-align:center;padding:60px 20px">
      <div style="font-size:32px;opacity:.3;margin-bottom:12px">⚡</div>
      <div>${_dfiltros.view==='para_revisar'?'Nenhuma decisão aguardando revisão nos próximos 7 dias.':'Nenhuma decisão encontrada.'}</div>
      ${_dfiltros.view==='ativas'||_dfiltros.view==='todas'?`<button class="btn btn-secondary btn-sm" style="margin-top:16px" onclick="dAbrirForm()">+ Nova decisão</button>`:''}
    </div>`;
    return;
  }

  // Agrupar por área se view = todas
  if(_dfiltros.view==='todas'&&!_dfiltros.area){
    const grupos = {};
    lista.forEach(d=>{ const a=d.area||'Sem área'; if(!grupos[a]) grupos[a]=[]; grupos[a].push(d); });
    el.innerHTML = Object.entries(grupos).map(([area, items])=>`
      <div style="margin-bottom:20px">
        <div style="font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--text3);margin-bottom:8px">${area}</div>
        <div class="esc-list">${items.map(d=>dItemHtml(d)).join('')}</div>
      </div>`).join('');
    return;
  }
  el.innerHTML=`<div class="esc-list">${lista.map(d=>dItemHtml(d)).join('')}</div>`;
}

function dItemHtml(d) {
  const st = D_STATUS[d.status]||{label:d.status,cor:'gray'};
  const hoje = new Date().toISOString().split('T')[0];
  const em7d = new Date(Date.now()+7*86400000).toISOString().split('T')[0];
  const revisaoVencida  = d.data_revisao && d.data_revisao < hoje && ['ativa','em_acompanhamento'].includes(d.status);
  const revisaoProxima  = d.data_revisao && d.data_revisao >= hoje && d.data_revisao <= em7d && ['ativa','em_acompanhamento'].includes(d.status);
  const AREA_COR = {'JS Mentoria':'area-js','Moni Sul':'area-moni','Interno':'area-js'};
  const dataDecisao = d.data_decisao ? new Date(d.data_decisao+'T12:00:00').toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric'}) : '';
  const inativo = ['revisada','substituida','cancelada'].includes(d.status);

  return `
    <div class="esc-list-item" onclick="dAbrirDetalhe('${d.id}')" style="${inativo?'opacity:.55':''}">
      <!-- Linha colorida de status -->
      <div style="width:3px;height:44px;border-radius:2px;flex-shrink:0;background:${{green:'var(--green)',blue:'var(--accent)',purple:'var(--purple)',amber:'var(--amber)',red:'var(--red)',gray:'var(--border)'}[st.cor]}"></div>

      <div style="flex:1;min-width:0">
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:4px">
          <span style="font-size:13px;font-weight:500;color:${inativo?'var(--text3)':'var(--text)'}">${escEsc(d.titulo)}</span>
          ${revisaoVencida?'<span class="badge badge-red">Revisão vencida</span>':''}
          ${revisaoProxima?'<span class="badge badge-amber">Revisar em breve</span>':''}
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
          ${d.area?`<span class="${AREA_COR[d.area]||'area-js'}">${d.area}</span>`:''}
          ${d.responsavel_id?`<span style="font-size:11px;color:var(--text3)">${escEsc(d.responsavel_id)}</span>`:''}
          ${dataDecisao?`<span style="font-size:11px;color:var(--text3)">Decidido em ${dataDecisao}</span>`:''}
          ${d.origem_tipo&&d.origem_tipo!=='manual'?`<span style="font-size:11px;color:var(--text3)">• ${D_ORIGENS[d.origem_tipo]||d.origem_tipo}</span>`:''}
        </div>
      </div>

      <span class="badge badge-${st.cor}" style="flex-shrink:0">${st.label}</span>
    </div>`;
}

// ── DETALHE DA DECISÃO ──
async function dAbrirDetalhe(id) {
  _dDetalheId = id;
  const d = _decisoesCache.find(x=>x.id===id);
  if (!d) return;

  const content = document.getElementById('esc-content');
  content.innerHTML=`<div style="color:var(--text3);text-align:center;padding:40px">Carregando...</div>`;

  // Buscar tarefas relacionadas e decisão substituta em paralelo
  let tarefas = [], decisaoSubstituta = null;
  try { tarefas = await escGet(`/rest/v1/escritorio_tarefas?origem_tipo=eq.decisao&origem_id=eq.${id}&order=created_at.asc`); } catch(e) {}
  if (d.substituida_por) {
    try {
      const sub = await escGet(`/rest/v1/escritorio_decisoes?id=eq.${d.substituida_por}&select=id,titulo,status`);
      decisaoSubstituta = Array.isArray(sub)&&sub[0] ? sub[0] : null;
    } catch(e) {}
  }

  const st   = D_STATUS[d.status]||{label:d.status,cor:'gray'};
  const hoje = new Date().toISOString().split('T')[0];
  const em7d = new Date(Date.now()+7*86400000).toISOString().split('T')[0];
  const revisaoVencida = d.data_revisao && d.data_revisao < hoje && ['ativa','em_acompanhamento'].includes(d.status);
  const revisaoProxima = d.data_revisao && d.data_revisao >= hoje && d.data_revisao <= em7d && ['ativa','em_acompanhamento'].includes(d.status);
  const AREA_COR = {'JS Mentoria':'area-js','Moni Sul':'area-moni','Interno':'area-js'};
  const inativo = ['revisada','substituida','cancelada'].includes(d.status);

  content.innerHTML = `
    <!-- Breadcrumb -->
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:20px;font-size:13px">
      <span style="color:var(--text3);cursor:pointer" onclick="escNavegar('decisoes')">Decisões</span>
      <span style="color:var(--border2)">›</span>
      <span style="color:var(--text)">${escEsc(d.titulo)}</span>
    </div>

    <!-- Header -->
    <div style="display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:24px">
      <div>
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:6px">
          ${d.area?`<span class="${AREA_COR[d.area]||'area-js'}">${d.area}</span>`:''}
          <span class="badge badge-${st.cor}">${st.label}</span>
          ${revisaoVencida?'<span class="badge badge-red">⚠ Revisão vencida</span>':''}
          ${revisaoProxima?'<span class="badge badge-amber">Revisar em breve</span>':''}
        </div>
        <h2 style="font-size:20px;font-weight:700;color:${inativo?'var(--text2)':'var(--text)'};margin-bottom:4px">${escEsc(d.titulo)}</h2>
        <div style="font-size:12px;color:var(--text3)">
          ${d.data_decisao?`Decidido em ${new Date(d.data_decisao+'T12:00:00').toLocaleDateString('pt-BR')} `:''}
          ${d.responsavel_id?`• ${escEsc(d.responsavel_id)}`:''}
          ${d.origem_tipo&&d.origem_tipo!=='manual'?` • via ${D_ORIGENS[d.origem_tipo]||d.origem_tipo}`:''}
        </div>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        ${!inativo?`<button class="btn btn-secondary btn-sm" onclick="dAbrirForm('${id}')">✏ Editar</button>`:''}
        ${!inativo?`<button class="btn btn-secondary btn-sm" onclick="dAbrirRevisao('${id}')">↻ Revisar</button>`:''}
      </div>
    </div>

    <!-- Aviso se substituída -->
    ${d.status==='substituida'&&decisaoSubstituta?`
      <div style="background:rgba(210,153,34,.1);border:1px solid rgba(210,153,34,.3);border-radius:10px;padding:14px 18px;margin-bottom:16px;display:flex;align-items:center;gap:12px">
        <span style="font-size:18px">→</span>
        <div>
          <div style="font-size:12px;font-weight:700;color:var(--amber);margin-bottom:2px">SUBSTITUÍDA POR</div>
          <div style="font-size:13px;color:var(--text2);cursor:pointer" onclick="dAbrirDetalhe('${decisaoSubstituta.id}')">
            ${escEsc(decisaoSubstituta.titulo)} <span style="color:var(--accent)">→ abrir</span>
          </div>
        </div>
      </div>`:``}

    <!-- Grid: Decisão + Informações -->
    <div class="esc-grid-2" style="gap:16px;margin-bottom:16px">
      <!-- Decisão -->
      <div class="esc-card">
        <div class="esc-card-title">O que foi decidido</div>
        <div style="font-size:14px;color:var(--text);line-height:1.7;white-space:pre-wrap">${escEsc(d.decisao||d.descricao||'—')}</div>
      </div>
      <!-- Informações -->
      <div class="esc-card">
        <div class="esc-card-title">Informações</div>
        <div style="display:flex;flex-direction:column;gap:10px;font-size:13px">
          ${d.responsavel_id?`<div><span style="color:var(--text3)">Responsável: </span><b>${escEsc(d.responsavel_id)}</b></div>`:''}
          ${d.data_decisao?`<div><span style="color:var(--text3)">Data: </span>${new Date(d.data_decisao+'T12:00:00').toLocaleDateString('pt-BR')}</div>`:''}
          ${d.data_revisao?`<div><span style="color:${revisaoVencida?'var(--red)':revisaoProxima?'var(--amber)':'var(--text3)'}">Prazo de revisão: </span><b>${new Date(d.data_revisao+'T12:00:00').toLocaleDateString('pt-BR')}</b></div>`:''}
          ${d.projeto_id?`<div><span style="color:var(--text3)">Projeto: </span><span style="color:var(--accent);cursor:pointer" onclick="pAbrirDetalhe&&pAbrirDetalhe('${d.projeto_id}')">ver projeto →</span></div>`:''}
          ${d.reuniao_id?`<div><span style="color:var(--text3)">Reunião: </span><span style="color:var(--accent);cursor:pointer" onclick="rAbrirDetalhe&&rAbrirDetalhe('${d.reuniao_id}');escNavegar('reunioes')">ver reunião →</span></div>`:''}
          ${d.origem_tipo?`<div><span style="color:var(--text3)">Origem: </span>${D_ORIGENS[d.origem_tipo]||d.origem_tipo}</div>`:''}
        </div>
      </div>
    </div>

    <!-- Contexto -->
    ${d.contexto?`
      <div class="esc-card" style="margin-bottom:16px">
        <div class="esc-card-title">Contexto</div>
        <div style="font-size:13px;color:var(--text2);line-height:1.7;white-space:pre-wrap">${escEsc(d.contexto)}</div>
      </div>`:``}

    <!-- Observações de revisão -->
    ${d.observacoes_revisao?`
      <div class="esc-card" style="margin-bottom:16px;border-color:var(--purple-dim)">
        <div class="esc-card-title" style="color:var(--purple)">Observações da última revisão</div>
        <div style="font-size:13px;color:var(--text2);line-height:1.7;white-space:pre-wrap">${escEsc(d.observacoes_revisao)}</div>
      </div>`:``}

    <!-- Mudança de status rápida (se ativa) -->
    ${!inativo?`
      <div class="esc-card" style="margin-bottom:16px">
        <div class="esc-card-title">Status da decisão</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          ${Object.entries(D_STATUS).map(([k,v])=>`
            <button onclick="dMudarStatus('${id}','${k}')"
              class="btn btn-secondary btn-sm"
              style="${d.status===k?`background:var(--${v.cor==='green'?'green':v.cor==='blue'?'accent':v.cor==='amber'?'amber':'red'}-dim);border-color:var(--${v.cor==='green'?'green':v.cor==='blue'?'accent':v.cor==='amber'?'amber':'red'})`:''}">${v.label}</button>`).join('')}
        </div>
      </div>`:``}

    <!-- Tarefas relacionadas -->
    <div class="esc-card" style="margin-bottom:16px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
        <div class="esc-card-title" style="margin-bottom:0">Tarefas geradas (${tarefas.length})</div>
        ${!inativo?`<button class="btn btn-secondary btn-sm" onclick="dNovaTarefa('${id}','${escEsc(d.area||'')}','${escEsc(d.responsavel_id||'')}')">+ Nova tarefa</button>`:''}
      </div>
      ${tarefas.length===0
        ? `<div style="color:var(--text3);font-size:13px">Nenhuma tarefa gerada ainda.</div>`
        : `<div class="esc-list">${tarefas.map(t=>tItemHtml(t,new Date().toISOString().split('T')[0])).join('')}</div>`}
    </div>`;
}

// ── MUDAR STATUS ──
async function dMudarStatus(id, novoStatus) {
  if (novoStatus === d_getStatus(id)) return;
  try {
    const agora = new Date().toISOString();
    const res = await fetch(ESC_SUPA_URL+'/rest/v1/escritorio_decisoes?id=eq.'+id, {
      method:'PATCH',
      headers:{'apikey':ESC_SUPA_KEY,'Authorization':'Bearer '+ESC_SUPA_KEY,'Content-Type':'application/json','Prefer':'return=representation'},
      body: JSON.stringify({status:novoStatus, updated_at:agora})
    });
    const updated = await res.json();
    if(Array.isArray(updated)){
      const idx=_decisoesCache.findIndex(x=>x.id===id);
      if(idx>=0) _decisoesCache[idx]=updated[0];
    }
    escToast('Status atualizado!');
    dAbrirDetalhe(id);
  } catch(e) { escToast('Erro ao atualizar status.'); }
}

function d_getStatus(id) {
  return (_decisoesCache.find(x=>x.id===id)||{}).status;
}

// ── NOVA TAREFA NA DECISÃO ──
function dNovaTarefa(decisaoId, area, responsavel) {
  document.getElementById('esc-modal-title').textContent = 'Nova tarefa';
  document.getElementById('esc-modal-body').innerHTML = `
    <div style="font-size:12px;color:var(--accent);margin-bottom:12px;padding:6px 10px;background:var(--accent-dim);border-radius:6px">
      ⚡ Originada desta decisão
    </div>
    <div class="esc-field">
      <label class="esc-label">Título <span style="color:var(--red)">*</span></label>
      <input class="esc-input" id="dt-titulo" placeholder="O que precisa ser feito?">
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
      <div class="esc-field">
        <label class="esc-label">Responsável</label>
        <select class="esc-select" id="dt-resp">
          <option value="">Selecionar</option>
          ${D_RESPONSAVEIS.map(r=>`<option value="${r}" ${r===responsavel?'selected':''}>${r}</option>`).join('')}
        </select>
      </div>
      <div class="esc-field">
        <label class="esc-label">Prioridade</label>
        <select class="esc-select" id="dt-prio">
          ${Object.entries(CI_PRIORIDADE||{baixa:{label:'Baixa'},normal:{label:'Normal'},alta:{label:'Alta'},urgente:{label:'Urgente'}}).map(([k,v])=>`<option value="${k}" ${k==='normal'?'selected':''}>${v.label}</option>`).join('')}
        </select>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
      <div class="esc-field">
        <label class="esc-label">Prazo</label>
        <input class="esc-input" type="date" id="dt-prazo">
      </div>
      <div class="esc-field">
        <label class="esc-label">Vincular a projeto</label>
        <select class="esc-select" id="dt-projeto">
          <option value="">Nenhum</option>
          ${(_projetosCache||[]).filter(p=>!['cancelado','concluido'].includes(p.status)).map(p=>`<option value="${p.id}">${escEsc(p.nome)}</option>`).join('')}
        </select>
      </div>
    </div>
    <div style="display:flex;gap:10px;justify-content:flex-end">
      <button class="btn btn-secondary" onclick="escFecharModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="dSalvarTarefa('${decisaoId}','${area}')">Criar tarefa</button>
    </div>`;
  document.getElementById('esc-modal-overlay').classList.add('open');
  document.getElementById('dt-titulo')?.focus();
}

async function dSalvarTarefa(decisaoId, area) {
  const titulo = document.getElementById('dt-titulo')?.value?.trim();
  if(!titulo){ escToast('Informe o título.'); return; }
  const obj = {
    titulo, area:area||'JS Mentoria',
    responsavel_id: document.getElementById('dt-resp')?.value||null,
    prioridade:     document.getElementById('dt-prio')?.value||'normal',
    prazo:          document.getElementById('dt-prazo')?.value||null,
    projeto_id:     document.getElementById('dt-projeto')?.value||null,
    status:         'a_fazer',
    origem_tipo:    'decisao',
    origem_id:      decisaoId,
    created_by:     ESC_STATE?.usuario||'Jéssica',
    criado_por:     ESC_STATE?.usuario||'Jéssica',
  };
  try {
    const r = await fetch(ESC_SUPA_URL+'/rest/v1/escritorio_tarefas',{
      method:'POST',
      headers:{'apikey':ESC_SUPA_KEY,'Authorization':'Bearer '+ESC_SUPA_KEY,'Content-Type':'application/json','Prefer':'return=representation'},
      body:JSON.stringify(obj)
    });
    const created = await r.json();
    if(Array.isArray(created)&&typeof _tarefasCache!=='undefined') _tarefasCache.unshift(created[0]);
    escToast('Tarefa criada! ✓');
    escFecharModal();
    dAbrirDetalhe(decisaoId);
  } catch(e){ escToast('Erro ao criar tarefa.'); }
}

// ── REVISAR DECISÃO ──
function dAbrirRevisao(id) {
  const d = _decisoesCache.find(x=>x.id===id);
  if (!d) return;
  document.getElementById('esc-modal-title').textContent = 'Revisar decisão';
  document.getElementById('esc-modal-body').innerHTML = `
    <div style="font-size:13px;color:var(--text2);margin-bottom:16px">
      Registre o resultado da revisão desta decisão.
    </div>
    <div class="esc-field">
      <label class="esc-label">Novo status após revisão</label>
      <select class="esc-select" id="dr-status">
        <option value="ativa" ${d.status==='ativa'?'selected':''}>Ativa — continua valendo</option>
        <option value="em_acompanhamento">Em acompanhamento — monitorar</option>
        <option value="revisada">Revisada — foi reavaliada e atualizada</option>
        <option value="substituida">Substituída — outra decisão tomou o lugar</option>
        <option value="cancelada">Cancelada — não se aplica mais</option>
      </select>
    </div>
    <div class="esc-field">
      <label class="esc-label">Observações da revisão</label>
      <textarea class="esc-textarea" id="dr-obs" rows="4" placeholder="O que foi avaliado? O que mudou? Por quê?">${escEsc(d.observacoes_revisao||'')}</textarea>
    </div>
    <div class="esc-field" id="dr-novo-wrap" style="display:none">
      <label class="esc-label">Criar nova decisão substituta?</label>
      <input class="esc-input" id="dr-novo-titulo" placeholder="Título da nova decisão (opcional)">
    </div>
    <script>
      document.getElementById('dr-status').addEventListener('change', function(){
        document.getElementById('dr-novo-wrap').style.display = this.value==='substituida'?'block':'none';
      });
    </script>
    <div style="display:flex;gap:10px;justify-content:flex-end">
      <button class="btn btn-secondary" onclick="escFecharModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="dSalvarRevisao('${id}')">Salvar revisão</button>
    </div>`;
  document.getElementById('esc-modal-overlay').classList.add('open');
}

async function dSalvarRevisao(id) {
  const novoStatus = document.getElementById('dr-status')?.value;
  const obs        = document.getElementById('dr-obs')?.value||null;
  const novoTitulo = document.getElementById('dr-novo-titulo')?.value?.trim();
  const agora = new Date().toISOString();

  try {
    // Atualizar a decisão atual
    const patch = { status:novoStatus, observacoes_revisao:obs, updated_at:agora };
    const d = _decisoesCache.find(x=>x.id===id);

    // Se substituída + novo título, criar nova decisão
    if (novoStatus==='substituida' && novoTitulo) {
      const novaDecisao = {
        titulo: novoTitulo,
        area: d?.area||null,
        responsavel_id: d?.responsavel_id||null,
        data_decisao: agora.split('T')[0],
        status: 'ativa',
        origem_tipo: 'manual',
        created_by: ESC_STATE?.usuario||'Jéssica',
        contexto: `Substituiu a decisão anterior: "${d?.titulo||''}".`,
      };
      const r2 = await fetch(ESC_SUPA_URL+'/rest/v1/escritorio_decisoes',{
        method:'POST',
        headers:{'apikey':ESC_SUPA_KEY,'Authorization':'Bearer '+ESC_SUPA_KEY,'Content-Type':'application/json','Prefer':'return=representation'},
        body:JSON.stringify(novaDecisao)
      });
      const created = await r2.json();
      if(Array.isArray(created)&&created[0]) {
        _decisoesCache.unshift(created[0]);
        patch.substituida_por = created[0].id;
      }
    }

    const res = await fetch(ESC_SUPA_URL+'/rest/v1/escritorio_decisoes?id=eq.'+id,{
      method:'PATCH',
      headers:{'apikey':ESC_SUPA_KEY,'Authorization':'Bearer '+ESC_SUPA_KEY,'Content-Type':'application/json','Prefer':'return=representation'},
      body:JSON.stringify(patch)
    });
    const updated = await res.json();
    if(Array.isArray(updated)){
      const idx=_decisoesCache.findIndex(x=>x.id===id);
      if(idx>=0) _decisoesCache[idx]=updated[0];
    }
    escToast('Revisão registrada!');
    escFecharModal();
    dRenderKpis();
    dAbrirDetalhe(id);
  } catch(e){ escToast('Erro ao salvar revisão.'); console.error(e); }
}

// ── FORMULÁRIO CRIAR/EDITAR ──
function dAbrirForm(id) {
  _dEditandoId = id||null;
  const d = id ? _decisoesCache.find(x=>x.id===id) : null;
  const hoje = new Date().toISOString().split('T')[0];

  document.getElementById('esc-modal-title').textContent = d?'Editar decisão':'Nova decisão';
  document.getElementById('esc-modal-body').innerHTML = `
    <div class="esc-field">
      <label class="esc-label">Título <span style="color:var(--red)">*</span></label>
      <input class="esc-input" id="df-titulo" value="${escEsc(d?.titulo||'')}" placeholder="O que foi decidido?">
    </div>
    <div class="esc-field">
      <label class="esc-label">Descrição da decisão <span style="color:var(--red)">*</span></label>
      <textarea class="esc-textarea" id="df-decisao" rows="3" placeholder="Descreva claramente o que foi definido...">${escEsc(d?.decisao||d?.descricao||'')}</textarea>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
      <div class="esc-field">
        <label class="esc-label">Área <span style="color:var(--red)">*</span></label>
        <select class="esc-select" id="df-area">
          <option value="">Selecionar</option>
          ${D_AREAS.map(a=>`<option value="${a}" ${d?.area===a?'selected':''}>${a}</option>`).join('')}
        </select>
      </div>
      <div class="esc-field">
        <label class="esc-label">Responsável <span style="color:var(--red)">*</span></label>
        <select class="esc-select" id="df-resp">
          <option value="">Selecionar</option>
          ${D_RESPONSAVEIS.map(r=>`<option value="${r}" ${d?.responsavel_id===r?'selected':''}>${r}</option>`).join('')}
        </select>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
      <div class="esc-field">
        <label class="esc-label">Data da decisão <span style="color:var(--red)">*</span></label>
        <input class="esc-input" type="date" id="df-data" value="${d?.data_decisao||hoje}">
      </div>
      <div class="esc-field">
        <label class="esc-label">Prazo de revisão</label>
        <input class="esc-input" type="date" id="df-revisao" value="${d?.data_revisao||''}">
      </div>
    </div>
    <div class="esc-field">
      <label class="esc-label">Contexto (opcional)</label>
      <textarea class="esc-textarea" id="df-contexto" rows="3" placeholder="Por que essa decisão foi tomada? Qual situação gerou isso?">${escEsc(d?.contexto||'')}</textarea>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
      <div class="esc-field">
        <label class="esc-label">Origem</label>
        <select class="esc-select" id="df-origem">
          ${Object.entries(D_ORIGENS).map(([k,v])=>`<option value="${k}" ${(d?.origem_tipo||'manual')===k?'selected':''}>${v}</option>`).join('')}
        </select>
      </div>
      <div class="esc-field">
        <label class="esc-label">Projeto relacionado</label>
        <select class="esc-select" id="df-projeto">
          <option value="">Nenhum</option>
          ${(_projetosCache||[]).filter(p=>!['cancelado'].includes(p.status)).map(p=>`<option value="${p.id}" ${d?.projeto_id===p.id?'selected':''}>${escEsc(p.nome)}</option>`).join('')}
        </select>
      </div>
    </div>
    ${d?`<div class="esc-field">
      <label class="esc-label">Status</label>
      <select class="esc-select" id="df-status">
        ${Object.entries(D_STATUS).map(([k,v])=>`<option value="${k}" ${d.status===k?'selected':''}>${v.label}</option>`).join('')}
      </select>
    </div>`:''}
    <div style="display:flex;gap:10px;justify-content:flex-end">
      <button class="btn btn-secondary" onclick="escFecharModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="dSalvar()">${d?'Salvar alterações':'Registrar decisão'}</button>
    </div>`;
  document.getElementById('esc-modal-overlay').classList.add('open');
  document.getElementById('df-titulo')?.focus();
}

async function dSalvar() {
  const titulo   = document.getElementById('df-titulo')?.value?.trim();
  const decisao  = document.getElementById('df-decisao')?.value?.trim();
  const area     = document.getElementById('df-area')?.value;
  const resp     = document.getElementById('df-resp')?.value;
  const data     = document.getElementById('df-data')?.value;
  if (!titulo)  { escToast('Informe o título.'); return; }
  if (!decisao) { escToast('Descreva a decisão.'); return; }
  if (!area)    { escToast('Selecione a área.'); return; }
  if (!resp)    { escToast('Selecione o responsável.'); return; }
  if (!data)    { escToast('Informe a data.'); return; }

  const obj = {
    titulo, decisao, area,
    responsavel_id: resp,
    data_decisao:   data,
    data_revisao:   document.getElementById('df-revisao')?.value||null,
    contexto:       document.getElementById('df-contexto')?.value||null,
    origem_tipo:    document.getElementById('df-origem')?.value||'manual',
    projeto_id:     document.getElementById('df-projeto')?.value||null,
    status:         document.getElementById('df-status')?.value||'ativa',
    created_by:     ESC_STATE?.usuario||'Jéssica',
    updated_at:     new Date().toISOString(),
  };

  try {
    if (_dEditandoId) {
      const res = await fetch(ESC_SUPA_URL+'/rest/v1/escritorio_decisoes?id=eq.'+_dEditandoId,{
        method:'PATCH',
        headers:{'apikey':ESC_SUPA_KEY,'Authorization':'Bearer '+ESC_SUPA_KEY,'Content-Type':'application/json','Prefer':'return=representation'},
        body:JSON.stringify(obj)
      });
      const updated = await res.json();
      if(Array.isArray(updated)){
        const idx=_decisoesCache.findIndex(x=>x.id===_dEditandoId);
        if(idx>=0) _decisoesCache[idx]=updated[0];
      }
      escToast('Decisão atualizada!');
    } else {
      const res = await fetch(ESC_SUPA_URL+'/rest/v1/escritorio_decisoes',{
        method:'POST',
        headers:{'apikey':ESC_SUPA_KEY,'Authorization':'Bearer '+ESC_SUPA_KEY,'Content-Type':'application/json','Prefer':'return=representation'},
        body:JSON.stringify(obj)
      });
      const created = await res.json();
      if(Array.isArray(created)) _decisoesCache.unshift(created[0]);
      escToast('Decisão registrada!');
    }
    escFecharModal();
    if(_dDetalheId&&_dEditandoId===_dDetalheId) dAbrirDetalhe(_dDetalheId);
    else { dRenderKpis(); dRenderLista(); }
  } catch(e){ escToast('Erro ao salvar decisão.'); console.error(e); }
}

// ── INTEGRAÇÃO COM CAIXA DE ENTRADA ──
// Chamado pelo módulo Caixa quando usuário clica em "⚡ Decisão"
async function ciSalvarComoDecisao_real(ciId) {
  const c = typeof _caixa_cache!=='undefined' ? (_caixa_cache||[]).find(x=>x.id===ciId) : null;
  if (!c) { escToast('Entrada não encontrada.'); return; }

  const hoje = new Date().toISOString().split('T')[0];
  document.getElementById('esc-modal-title').textContent = 'Converter em decisão';
  document.getElementById('esc-modal-body').innerHTML = `
    <div style="font-size:12px;color:var(--accent);margin-bottom:12px;padding:6px 10px;background:var(--accent-dim);border-radius:6px">
      📥 Originada da Caixa de Entrada
    </div>
    <div class="esc-field">
      <label class="esc-label">Título <span style="color:var(--red)">*</span></label>
      <input class="esc-input" id="cd-titulo" value="${escEsc(c.titulo)}">
    </div>
    <div class="esc-field">
      <label class="esc-label">Descrição da decisão <span style="color:var(--red)">*</span></label>
      <textarea class="esc-textarea" id="cd-decisao" rows="3" placeholder="O que foi efetivamente definido?">${escEsc(c.descricao||'')}</textarea>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
      <div class="esc-field">
        <label class="esc-label">Área</label>
        <select class="esc-select" id="cd-area">
          ${D_AREAS.map(a=>`<option value="${a}" ${(c.area||'JS Mentoria')===a?'selected':''}>${a}</option>`).join('')}
        </select>
      </div>
      <div class="esc-field">
        <label class="esc-label">Responsável</label>
        <select class="esc-select" id="cd-resp">
          <option value="">Selecionar</option>
          ${D_RESPONSAVEIS.map(r=>`<option value="${r}">${r}</option>`).join('')}
        </select>
      </div>
    </div>
    <div class="esc-field">
      <label class="esc-label">Data da decisão</label>
      <input class="esc-input" type="date" id="cd-data" value="${hoje}">
    </div>
    <div style="display:flex;gap:10px;justify-content:flex-end">
      <button class="btn btn-secondary" onclick="escFecharModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="cdFinalizar('${ciId}')">Registrar decisão</button>
    </div>`;
  document.getElementById('esc-modal-overlay').classList.add('open');
}

async function cdFinalizar(ciId) {
  const titulo  = document.getElementById('cd-titulo')?.value?.trim();
  const decisao = document.getElementById('cd-decisao')?.value?.trim();
  const area    = document.getElementById('cd-area')?.value;
  const resp    = document.getElementById('cd-resp')?.value;
  if(!titulo||!decisao){ escToast('Preencha título e descrição.'); return; }
  const obj = {
    titulo, decisao, area,
    responsavel_id: resp||null,
    data_decisao:   document.getElementById('cd-data')?.value||new Date().toISOString().split('T')[0],
    status:         'ativa',
    origem_tipo:    'caixa_entrada',
    origem_id:      ciId,
    created_by:     ESC_STATE?.usuario||'Jéssica',
  };
  try {
    const res = await fetch(ESC_SUPA_URL+'/rest/v1/escritorio_decisoes',{
      method:'POST',
      headers:{'apikey':ESC_SUPA_KEY,'Authorization':'Bearer '+ESC_SUPA_KEY,'Content-Type':'application/json','Prefer':'return=representation'},
      body:JSON.stringify(obj)
    });
    const created = await res.json();
    const decId = Array.isArray(created)?created[0]?.id:null;
    if(decId) _decisoesCache.unshift(created[0]);
    if(typeof ciMarcarConvertida==='function') await ciMarcarConvertida(ciId,'decisao',decId);
    escToast('Convertida em decisão! ✓');
    escFecharModal();
    if(decId) { escNavegar('decisoes'); setTimeout(()=>dAbrirDetalhe(decId),300); }
  } catch(e){ escToast('Erro ao converter.'); console.error(e); }
}

// Sobrescrever o placeholder do módulo caixa
function ciConverterEmDecisao(ciId) {
  ciSalvarComoDecisao_real(ciId);
}
