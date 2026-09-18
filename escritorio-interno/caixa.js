/* ══════════════════════════════════════════════════
   MÓDULO CAIXA DE ENTRADA — escritorio-interno
   Capturar agora → Organizar depois
   ══════════════════════════════════════════════════ */

const CI_STATUS = {
  nova:       { label: 'Nova',       cor: 'blue'   },
  em_analise: { label: 'Em análise', cor: 'amber'  },
  convertida: { label: 'Convertida', cor: 'green'  },
  arquivada:  { label: 'Arquivada',  cor: 'gray'   },
  descartada: { label: 'Descartada', cor: 'red'    },
};
const CI_TIPOS = ['Ideia','Demanda','Informação','Dúvida','Pendência','Solicitação','Anotação','Outro'];
const CI_AREAS = ['JS Mentoria','Moni Sul','Interno'];
const CI_RESPONSAVEIS = ['Jéssica','Amanda'];
const CI_PRIORIDADE = {
  baixa:   { label:'Baixa',   cor:'gray'  },
  normal:  { label:'Normal',  cor:'blue'  },
  alta:    { label:'Alta',    cor:'amber' },
  urgente: { label:'Urgente', cor:'red'   },
};

let _cifiltros   = { view:'pendentes', area:'', tipo:'', status:'' };
let _caixa_cache = [];
let _ciEditandoId = null;

// ── RENDER PRINCIPAL ──
async function escRenderCaixa(el) {
  el.innerHTML = `
    <!-- Captura rápida no topo -->
    <div style="background:var(--card);border:1px solid var(--accent-border);border-radius:12px;padding:16px 20px;margin-bottom:20px">
      <div style="font-size:12px;color:var(--text3);margin-bottom:8px">Captura rápida — registre agora, organize depois</div>
      <div style="display:flex;gap:10px">
        <input id="ci-rapido" class="esc-input" placeholder="O que surgiu agora?" style="flex:1"
          onkeydown="if(event.key==='Enter')ciCapturarRapido()">
        <button class="btn btn-primary" onclick="ciCapturarRapido()">+ Registrar</button>
        <button class="btn btn-secondary" onclick="ciAbrirForm()" title="Formulário completo">⋯</button>
      </div>
    </div>

    <!-- Views + filtros -->
    <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:14px">
      <div style="display:flex;gap:6px;flex-wrap:wrap" id="ci-views"></div>
    </div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px">
      <select class="esc-select" style="width:auto;min-width:130px" onchange="ciSetFiltro('area',this.value)">
        <option value="">Todas as áreas</option>
        ${CI_AREAS.map(a=>`<option value="${a}">${a}</option>`).join('')}
      </select>
      <select class="esc-select" style="width:auto;min-width:130px" onchange="ciSetFiltro('tipo',this.value)">
        <option value="">Todos os tipos</option>
        ${CI_TIPOS.map(t=>`<option value="${t}">${t}</option>`).join('')}
      </select>
      <select class="esc-select" style="width:auto;min-width:130px" onchange="ciSetFiltro('status',this.value)">
        <option value="">Todos os status</option>
        ${Object.entries(CI_STATUS).map(([k,v])=>`<option value="${k}">${v.label}</option>`).join('')}
      </select>
      <button class="btn btn-secondary btn-sm" onclick="ciLimparFiltros()">Limpar</button>
    </div>

    <!-- KPIs -->
    <div id="ci-kpis" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:10px;margin-bottom:20px"></div>

    <!-- Lista -->
    <div id="ci-lista"><div style="color:var(--text3);text-align:center;padding:40px">Carregando...</div></div>
  `;
  ciRenderViews();
  await ciCarregar();
}

function ciRenderViews() {
  const VIEWS = [
    { id:'pendentes',  label:'Pendentes'   },
    { id:'nova',       label:'Novas'       },
    { id:'em_analise', label:'Em análise'  },
    { id:'convertidas',label:'Convertidas' },
    { id:'arquivadas', label:'Arquivadas'  },
    { id:'todas',      label:'Todas'       },
  ];
  document.getElementById('ci-views').innerHTML = VIEWS.map(v=>`
    <button class="btn ${_cifiltros.view===v.id?'btn-primary':'btn-secondary'} btn-sm"
      onclick="ciSetView('${v.id}')">${v.label}</button>`).join('');
}

function ciSetView(v) { _cifiltros.view=v; ciRenderViews(); ciRenderLista(); }
function ciSetFiltro(k,v) { _cifiltros[k]=v; ciRenderLista(); }
function ciLimparFiltros() {
  _cifiltros = {..._cifiltros, area:'', tipo:'', status:''};
  document.querySelectorAll('[onchange*="ciSetFiltro"]').forEach(s=>s.selectedIndex=0);
  ciRenderLista();
}

async function ciCarregar() {
  try {
    _caixa_cache = await escGet('/rest/v1/escritorio_caixa_entrada?order=created_at.desc');
    if (!Array.isArray(_caixa_cache)) _caixa_cache = [];
  } catch(e) { _caixa_cache = []; console.error(e); }
  ciRenderKpis();
  ciRenderLista();
}

function ciFiltrar() {
  let lista = [..._caixa_cache];
  const v = _cifiltros.view;
  if      (v==='pendentes')   lista = lista.filter(c=>['nova','em_analise'].includes(c.status));
  else if (v==='nova')        lista = lista.filter(c=>c.status==='nova');
  else if (v==='em_analise')  lista = lista.filter(c=>c.status==='em_analise');
  else if (v==='convertidas') lista = lista.filter(c=>c.status==='convertida');
  else if (v==='arquivadas')  lista = lista.filter(c=>['arquivada','descartada'].includes(c.status));
  if (_cifiltros.area)   lista = lista.filter(c=>c.area===_cifiltros.area);
  if (_cifiltros.tipo)   lista = lista.filter(c=>c.tipo===_cifiltros.tipo);
  if (_cifiltros.status) lista = lista.filter(c=>c.status===_cifiltros.status);
  return lista;
}

function ciRenderKpis() {
  const novas     = _caixa_cache.filter(c=>c.status==='nova').length;
  const analise   = _caixa_cache.filter(c=>c.status==='em_analise').length;
  const pendentes = novas + analise;
  const convert   = _caixa_cache.filter(c=>c.status==='convertida').length;
  const kpis = [
    {val:pendentes, lbl:'Pendentes',  cor:'accent'},
    {val:novas,     lbl:'Novas',      cor:''      },
    {val:analise,   lbl:'Em análise', cor:'amber' },
    {val:convert,   lbl:'Convertidas',cor:'green' },
  ];
  const CORES={accent:'var(--accent)',amber:'var(--amber)',green:'var(--green)','':'var(--text)'};
  const el=document.getElementById('ci-kpis');
  if(el) el.innerHTML=kpis.map(k=>`
    <div class="esc-kpi" style="${k.cor?`border-color:${CORES[k.cor]}22`:''}">
      <div class="esc-kpi-val" style="color:${CORES[k.cor]};font-size:22px">${k.val}</div>
      <div class="esc-kpi-lbl">${k.lbl}</div>
    </div>`).join('');
}

function ciRenderLista() {
  const el = document.getElementById('ci-lista');
  if (!el) return;
  const lista = ciFiltrar();
  if (!lista.length) {
    el.innerHTML = `<div style="color:var(--text3);text-align:center;padding:60px 20px">
      <div style="font-size:32px;opacity:.3;margin-bottom:12px">📥</div>
      <div>${_cifiltros.view==='pendentes' ? 'Caixa limpa — nenhuma pendência.' : 'Nenhum registro encontrado.'}</div>
    </div>`;
    return;
  }
  el.innerHTML = `<div class="esc-list">${lista.map(c=>ciItemHtml(c)).join('')}</div>`;
}

function ciItemHtml(c) {
  const st = CI_STATUS[c.status]||{label:c.status,cor:'gray'};
  const pr = CI_PRIORIDADE[c.prioridade]||{label:'Normal',cor:'gray'};
  const AREA_COR = {'JS Mentoria':'area-js','Moni Sul':'area-moni','Interno':'area-js'};
  const criado = c.created_at ? new Date(c.created_at).toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric'}) : '';

  return `
    <div class="esc-list-item" onclick="ciAbrirDetalhe('${c.id}')"
      style="${['arquivada','descartada'].includes(c.status)?'opacity:.55':''}">
      <!-- Tipo badge -->
      <div style="flex-shrink:0">
        <span class="badge badge-gray" style="font-size:10px;white-space:nowrap">${c.tipo||'—'}</span>
      </div>
      <!-- Conteúdo -->
      <div style="flex:1;min-width:0">
        <div style="font-size:13px;font-weight:500;color:var(--text);margin-bottom:3px">${escEsc(c.titulo)}</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
          ${c.area?`<span class="${AREA_COR[c.area]||'area-js'}">${c.area}</span>`:''}
          <span style="font-size:11px;color:var(--text3)">${criado}</span>
          ${c.destino_tipo?`<span style="font-size:11px;color:var(--green)">→ ${c.destino_tipo}</span>`:''}
        </div>
      </div>
      <!-- Status + prioridade + ações rápidas -->
      <div style="display:flex;align-items:center;gap:8px;flex-shrink:0" onclick="event.stopPropagation()">
        ${c.status==='nova'||c.status==='em_analise' ? `
          <button onclick="ciArquivar('${c.id}')" title="Arquivar"
            style="background:none;border:1px solid var(--border);border-radius:4px;color:var(--text3);padding:3px 8px;cursor:pointer;font-size:11px">
            Arquivar
          </button>` : ''}
        <span class="badge badge-${st.cor}">${st.label}</span>
      </div>
    </div>`;
}

// ── CAPTURA RÁPIDA ──
async function ciCapturarRapido() {
  const inp = document.getElementById('ci-rapido');
  const titulo = inp?.value?.trim();
  if (!titulo) { inp?.focus(); return; }
  const obj = {
    titulo, status:'nova', prioridade:'normal',
    created_by: ESC_STATE?.usuario||'Jéssica',
  };
  try {
    const r = await fetch(ESC_SUPA_URL+'/rest/v1/escritorio_caixa_entrada', {
      method:'POST',
      headers:{'apikey':ESC_SUPA_KEY,'Authorization':'Bearer '+ESC_SUPA_KEY,'Content-Type':'application/json','Prefer':'return=representation'},
      body: JSON.stringify(obj)
    });
    const created = await r.json();
    if (Array.isArray(created)) _caixa_cache.unshift(created[0]);
    inp.value = '';
    escToast('Registrado na Caixa de Entrada ✓');
    ciRenderKpis();
    ciRenderLista();
  } catch(e) { escToast('Erro ao registrar.'); }
}

// ── DETALHE DA ENTRADA ──
async function ciAbrirDetalhe(id) {
  const c = _caixa_cache.find(x=>x.id===id);
  if (!c) return;

  const st = CI_STATUS[c.status]||{label:c.status,cor:'gray'};
  const pr = CI_PRIORIDADE[c.prioridade]||{label:'Normal',cor:'gray'};
  const AREA_COR = {'JS Mentoria':'area-js','Moni Sul':'area-moni','Interno':'area-js'};
  const criado = c.created_at ? new Date(c.created_at).toLocaleDateString('pt-BR') : '';
  const processado = c.processado_em ? new Date(c.processado_em).toLocaleDateString('pt-BR') : null;

  const content = document.getElementById('esc-content');
  content.innerHTML = `
    <!-- Breadcrumb -->
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:20px;font-size:13px">
      <span style="color:var(--text3);cursor:pointer" onclick="escNavegar('caixa')">Caixa de Entrada</span>
      <span style="color:var(--border2)">›</span>
      <span style="color:var(--text)">${escEsc(c.titulo)}</span>
    </div>

    <!-- Header -->
    <div style="display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:24px">
      <div>
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:6px">
          ${c.tipo?`<span class="badge badge-gray">${c.tipo}</span>`:''}
          <span class="badge badge-${st.cor}">${st.label}</span>
          ${c.area?`<span class="${AREA_COR[c.area]||'area-js'}">${c.area}</span>`:''}
          ${c.prioridade&&c.prioridade!=='normal'?`<span class="badge badge-${pr.cor}">${pr.label}</span>`:''}
        </div>
        <h2 style="font-size:20px;font-weight:700;color:var(--text);margin-bottom:4px">${escEsc(c.titulo)}</h2>
        <div style="font-size:12px;color:var(--text3)">
          Criado em ${criado} por ${escEsc(c.created_by||'—')}
          ${processado?` • Processado em ${processado}`:''}
        </div>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn btn-secondary btn-sm" onclick="ciAbrirForm('${id}')">✏ Editar</button>
        ${c.status!=='arquivada'&&c.status!=='descartada'?`
          <button class="btn btn-secondary btn-sm" onclick="ciArquivar('${id}')">Arquivar</button>
          <button class="btn btn-secondary btn-sm" onclick="ciDescartar('${id}')" style="color:var(--red);border-color:var(--red)">Descartar</button>
        `:''}
      </div>
    </div>

    <!-- Descrição -->
    ${c.descricao?`
      <div class="esc-card" style="margin-bottom:16px">
        <div class="esc-card-title">Descrição</div>
        <div style="font-size:13px;color:var(--text2);line-height:1.7;white-space:pre-wrap">${escEsc(c.descricao)}</div>
      </div>`:``}

    <!-- Destino (se já foi convertida) -->
    ${c.destino_tipo?`
      <div style="background:var(--green-dim);border:1px solid rgba(63,185,80,.3);border-radius:10px;padding:14px 18px;margin-bottom:16px;display:flex;align-items:center;gap:12px">
        <span style="font-size:18px">✓</span>
        <div>
          <div style="font-size:12px;font-weight:700;color:var(--green);margin-bottom:2px">CONVERTIDA</div>
          <div style="font-size:13px;color:var(--text2)">Esta entrada foi convertida em <b>${c.destino_tipo}</b>.
            ${c.destino_id?`<span style="color:var(--accent);cursor:pointer" onclick="ciAbrirDestino('${c.destino_tipo}','${c.destino_id}')"> Abrir →</span>`:''}
          </div>
        </div>
      </div>`:``}

    <!-- Processar -->
    ${!['convertida','arquivada','descartada'].includes(c.status)?`
      <div class="esc-card" style="margin-bottom:16px">
        <div class="esc-card-title">Processar entrada</div>
        <div style="font-size:12px;color:var(--text3);margin-bottom:14px">Transforme esta entrada em algo acionável.</div>
        <div style="display:flex;gap:10px;flex-wrap:wrap">
          <button class="btn btn-secondary" onclick="ciConverterEmTarefa('${id}')">
            ✅ Tarefa
          </button>
          <button class="btn btn-secondary" onclick="ciConverterEmProjeto('${id}')">
            📁 Projeto
          </button>
          <button class="btn btn-secondary" onclick="ciConverterEmReuniao('${id}')">
            📅 Reunião
          </button>
          <button class="btn btn-secondary" onclick="ciConverterEmDecisao('${id}')" style="opacity:.6" title="Módulo Decisões em breve">
            ⚡ Decisão
          </button>
        </div>
        ${c.status==='nova'?`
          <div style="margin-top:12px;padding-top:12px;border-top:1px solid var(--border)">
            <button class="btn btn-secondary btn-sm" onclick="ciMudarStatus('${id}','em_analise')">
              Marcar como Em análise
            </button>
          </div>`:``}
      </div>`:``}

    <!-- Histórico de informações -->
    <div class="esc-card">
      <div class="esc-card-title">Informações</div>
      <div style="display:flex;flex-direction:column;gap:8px;font-size:13px">
        <div><span style="color:var(--text3)">Responsável: </span><span>${escEsc(c.responsavel_id||'—')}</span></div>
        <div><span style="color:var(--text3)">Prioridade: </span><span>${pr.label}</span></div>
        ${c.prazo?`<div><span style="color:var(--text3)">Prazo: </span><span>${c.prazo}</span></div>`:''}
      </div>
    </div>`;
}

function ciAbrirDestino(tipo, id) {
  if (tipo==='tarefa' && typeof tAbrirForm==='function') { escNavegar('tarefas'); return; }
  if (tipo==='projeto' && typeof pAbrirDetalhe==='function') { pAbrirDetalhe(id); return; }
  if (tipo==='reuniao' && typeof rAbrirDetalhe==='function') { rAbrirDetalhe(id); escNavegar('reunioes'); return; }
}

// ── CONVERTER EM TAREFA ──
function ciConverterEmTarefa(ciId) {
  const c = _caixa_cache.find(x=>x.id===ciId);
  if (!c) return;
  document.getElementById('esc-modal-title').textContent = 'Converter em tarefa';
  document.getElementById('esc-modal-body').innerHTML = `
    <div style="font-size:12px;color:var(--accent);margin-bottom:12px;padding:6px 10px;background:var(--accent-dim);border-radius:6px">
      📥 Originada da Caixa de Entrada
    </div>
    <div class="esc-field">
      <label class="esc-label">Título <span style="color:var(--red)">*</span></label>
      <input class="esc-input" id="cc-titulo" value="${escEsc(c.titulo)}">
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
      <div class="esc-field">
        <label class="esc-label">Área</label>
        <select class="esc-select" id="cc-area">
          <option value="">Selecionar</option>
          ${CI_AREAS.map(a=>`<option value="${a}" ${c.area===a?'selected':''}>${a}</option>`).join('')}
        </select>
      </div>
      <div class="esc-field">
        <label class="esc-label">Responsável</label>
        <select class="esc-select" id="cc-resp">
          <option value="">Selecionar</option>
          ${CI_RESPONSAVEIS.map(r=>`<option value="${r}">${r}</option>`).join('')}
        </select>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
      <div class="esc-field">
        <label class="esc-label">Prioridade</label>
        <select class="esc-select" id="cc-prio">
          ${Object.entries(CI_PRIORIDADE).map(([k,v])=>`<option value="${k}" ${(c.prioridade||'normal')===k?'selected':''}>${v.label}</option>`).join('')}
        </select>
      </div>
      <div class="esc-field">
        <label class="esc-label">Prazo</label>
        <input class="esc-input" type="date" id="cc-prazo" value="${c.prazo||''}">
      </div>
    </div>
    <div class="esc-field">
      <label class="esc-label">Vincular a projeto</label>
      <select class="esc-select" id="cc-projeto">
        <option value="">Nenhum</option>
        ${(_projetosCache||[]).filter(p=>!['cancelado','concluido'].includes(p.status)).map(p=>`<option value="${p.id}">${escEsc(p.nome)}</option>`).join('')}
      </select>
    </div>
    <div style="display:flex;gap:10px;justify-content:flex-end">
      <button class="btn btn-secondary" onclick="escFecharModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="ciSalvarComoTarefa('${ciId}')">Criar tarefa</button>
    </div>`;
  document.getElementById('esc-modal-overlay').classList.add('open');
}

async function ciSalvarComoTarefa(ciId) {
  const titulo = document.getElementById('cc-titulo')?.value?.trim();
  if (!titulo) { escToast('Informe o título.'); return; }
  const obj = {
    titulo,
    area:           document.getElementById('cc-area')?.value||null,
    responsavel_id: document.getElementById('cc-resp')?.value||null,
    prioridade:     document.getElementById('cc-prio')?.value||'normal',
    prazo:          document.getElementById('cc-prazo')?.value||null,
    projeto_id:     document.getElementById('cc-projeto')?.value||null,
    status:         'a_fazer',
    origem_tipo:    'caixa_entrada',
    origem_id:      ciId,
    created_by:     ESC_STATE?.usuario||'Jéssica',
    criado_por:     ESC_STATE?.usuario||'Jéssica',
  };
  try {
    const r = await fetch(ESC_SUPA_URL+'/rest/v1/escritorio_tarefas', {
      method:'POST',
      headers:{'apikey':ESC_SUPA_KEY,'Authorization':'Bearer '+ESC_SUPA_KEY,'Content-Type':'application/json','Prefer':'return=representation'},
      body: JSON.stringify(obj)
    });
    const created = await r.json();
    const tarefaId = Array.isArray(created) ? created[0]?.id : null;
    if(tarefaId && typeof _tarefasCache!=='undefined') _tarefasCache.unshift(created[0]);
    await ciMarcarConvertida(ciId, 'tarefa', tarefaId);
    escToast('Convertida em tarefa! ✓');
    escFecharModal();
    ciAbrirDetalhe(ciId);
  } catch(e) { escToast('Erro ao converter.'); console.error(e); }
}

// ── CONVERTER EM PROJETO ──
function ciConverterEmProjeto(ciId) {
  const c = _caixa_cache.find(x=>x.id===ciId);
  if (!c) return;
  document.getElementById('esc-modal-title').textContent = 'Converter em projeto';
  document.getElementById('esc-modal-body').innerHTML = `
    <div style="font-size:12px;color:var(--accent);margin-bottom:12px;padding:6px 10px;background:var(--accent-dim);border-radius:6px">
      📥 Originada da Caixa de Entrada
    </div>
    <div class="esc-field">
      <label class="esc-label">Nome do projeto <span style="color:var(--red)">*</span></label>
      <input class="esc-input" id="cp-nome" value="${escEsc(c.titulo)}">
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
      <div class="esc-field">
        <label class="esc-label">Área</label>
        <select class="esc-select" id="cp-area">
          <option value="">Selecionar</option>
          ${CI_AREAS.map(a=>`<option value="${a}" ${c.area===a?'selected':''}>${a}</option>`).join('')}
        </select>
      </div>
      <div class="esc-field">
        <label class="esc-label">Responsável</label>
        <select class="esc-select" id="cp-resp">
          <option value="">Selecionar</option>
          ${CI_RESPONSAVEIS.map(r=>`<option value="${r}">${r}</option>`).join('')}
        </select>
      </div>
    </div>
    <div class="esc-field">
      <label class="esc-label">Descrição</label>
      <textarea class="esc-textarea" id="cp-desc" rows="3">${escEsc(c.descricao||'')}</textarea>
    </div>
    <div class="esc-field">
      <label class="esc-label">Prazo</label>
      <input class="esc-input" type="date" id="cp-prazo">
    </div>
    <div style="display:flex;gap:10px;justify-content:flex-end">
      <button class="btn btn-secondary" onclick="escFecharModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="ciSalvarComoProjeto('${ciId}')">Criar projeto</button>
    </div>`;
  document.getElementById('esc-modal-overlay').classList.add('open');
}

async function ciSalvarComoProjeto(ciId) {
  const nome = document.getElementById('cp-nome')?.value?.trim();
  if (!nome) { escToast('Informe o nome do projeto.'); return; }
  const obj = {
    nome,
    area:          document.getElementById('cp-area')?.value||null,
    responsavel_id:document.getElementById('cp-resp')?.value||null,
    descricao:     document.getElementById('cp-desc')?.value||null,
    prazo:         document.getElementById('cp-prazo')?.value||null,
    status:        'planejamento',
    prioridade:    'normal',
    created_by:    ESC_STATE?.usuario||'Jéssica',
  };
  try {
    const r = await fetch(ESC_SUPA_URL+'/rest/v1/escritorio_projetos', {
      method:'POST',
      headers:{'apikey':ESC_SUPA_KEY,'Authorization':'Bearer '+ESC_SUPA_KEY,'Content-Type':'application/json','Prefer':'return=representation'},
      body: JSON.stringify(obj)
    });
    const created = await r.json();
    const pid = Array.isArray(created) ? created[0]?.id : null;
    if(pid && typeof _projetosCache!=='undefined') _projetosCache.unshift(created[0]);
    await ciMarcarConvertida(ciId, 'projeto', pid);
    escToast('Convertida em projeto! ✓');
    escFecharModal();
    ciAbrirDetalhe(ciId);
  } catch(e) { escToast('Erro ao converter.'); console.error(e); }
}

// ── CONVERTER EM REUNIÃO ──
function ciConverterEmReuniao(ciId) {
  const c = _caixa_cache.find(x=>x.id===ciId);
  if (!c) return;
  document.getElementById('esc-modal-title').textContent = 'Converter em reunião';
  document.getElementById('esc-modal-body').innerHTML = `
    <div style="font-size:12px;color:var(--accent);margin-bottom:12px;padding:6px 10px;background:var(--accent-dim);border-radius:6px">
      📥 Originada da Caixa de Entrada
    </div>
    <div class="esc-field">
      <label class="esc-label">Título <span style="color:var(--red)">*</span></label>
      <input class="esc-input" id="cr-titulo" value="${escEsc(c.titulo)}">
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
      <div class="esc-field">
        <label class="esc-label">Área</label>
        <select class="esc-select" id="cr-area">
          <option value="">Selecionar</option>
          ${CI_AREAS.map(a=>`<option value="${a}" ${c.area===a?'selected':''}>${a}</option>`).join('')}
        </select>
      </div>
      <div class="esc-field">
        <label class="esc-label">Tipo</label>
        <select class="esc-select" id="cr-tipo">
          <option value="">Selecionar</option>
          ${(R_TIPOS||['Estratégica','Comercial','Operacional interna','Planejamento','Outro']).map(t=>`<option value="${t}">${t}</option>`).join('')}
        </select>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
      <div class="esc-field">
        <label class="esc-label">Data</label>
        <input class="esc-input" type="date" id="cr-data">
      </div>
      <div class="esc-field">
        <label class="esc-label">Horário</label>
        <input class="esc-input" type="time" id="cr-hora">
      </div>
    </div>
    <div style="display:flex;gap:10px;justify-content:flex-end">
      <button class="btn btn-secondary" onclick="escFecharModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="ciSalvarComoReuniao('${ciId}')">Criar reunião</button>
    </div>`;
  document.getElementById('esc-modal-overlay').classList.add('open');
}

async function ciSalvarComoReuniao(ciId) {
  const titulo = document.getElementById('cr-titulo')?.value?.trim();
  const area   = document.getElementById('cr-area')?.value;
  if (!titulo) { escToast('Informe o título.'); return; }
  const data = document.getElementById('cr-data')?.value;
  const hora = document.getElementById('cr-hora')?.value;
  const obj = {
    titulo, area: area||'JS Mentoria',
    tipo:    document.getElementById('cr-tipo')?.value||'Outro',
    status:  'agendada',
    data:    data||null,
    hora_inicio: hora||null,
    data_hora_inicio: data&&hora ? `${data}T${hora}:00` : (data ? `${data}T00:00:00` : null),
    created_by: ESC_STATE?.usuario||'Jéssica',
  };
  try {
    const r = await fetch(ESC_SUPA_URL+'/rest/v1/escritorio_reunioes', {
      method:'POST',
      headers:{'apikey':ESC_SUPA_KEY,'Authorization':'Bearer '+ESC_SUPA_KEY,'Content-Type':'application/json','Prefer':'return=representation'},
      body: JSON.stringify(obj)
    });
    const created = await r.json();
    const rid = Array.isArray(created) ? created[0]?.id : null;
    if(rid && typeof _reunioesCache!=='undefined') _reunioesCache.unshift(created[0]);
    await ciMarcarConvertida(ciId, 'reuniao', rid);
    escToast('Convertida em reunião! ✓');
    escFecharModal();
    ciAbrirDetalhe(ciId);
  } catch(e) { escToast('Erro ao converter.'); console.error(e); }
}

// ── CONVERTER EM DECISÃO (preparado para módulo futuro) ──
function ciConverterEmDecisao(ciId) {
  escToast('Módulo Decisões será implementado em breve.');
}

// ── MARCAR COMO CONVERTIDA ──
async function ciMarcarConvertida(ciId, tipo, destinoId) {
  const agora = new Date().toISOString();
  const patch = { status:'convertida', processado_em:agora, destino_tipo:tipo, destino_id:destinoId, updated_at:agora };
  const r = await fetch(ESC_SUPA_URL+'/rest/v1/escritorio_caixa_entrada?id=eq.'+ciId, {
    method:'PATCH',
    headers:{'apikey':ESC_SUPA_KEY,'Authorization':'Bearer '+ESC_SUPA_KEY,'Content-Type':'application/json','Prefer':'return=representation'},
    body: JSON.stringify(patch)
  });
  const updated = await r.json();
  if(Array.isArray(updated)){
    const idx=_caixa_cache.findIndex(x=>x.id===ciId);
    if(idx>=0) _caixa_cache[idx]=updated[0];
  }
}

// ── ARQUIVAR / DESCARTAR ──
async function ciArquivar(id) {
  await ciMudarStatus(id,'arquivada');
  escToast('Arquivada.');
  // Se está na lista, re-render; se está no detalhe, voltar para lista
  if(document.getElementById('ci-lista')) ciRenderLista();
  else escNavegar('caixa');
}
async function ciDescartar(id) {
  if (!confirm('Descartar esta entrada? Ela será mantida no histórico.')) return;
  await ciMudarStatus(id,'descartada');
  escToast('Descartada.');
  escNavegar('caixa');
}
async function ciMudarStatus(id, status) {
  try {
    const agora = new Date().toISOString();
    const patch = {status, updated_at:agora};
    if(status==='convertida') patch.processado_em = agora;
    const r = await fetch(ESC_SUPA_URL+'/rest/v1/escritorio_caixa_entrada?id=eq.'+id, {
      method:'PATCH',
      headers:{'apikey':ESC_SUPA_KEY,'Authorization':'Bearer '+ESC_SUPA_KEY,'Content-Type':'application/json','Prefer':'return=representation'},
      body: JSON.stringify(patch)
    });
    const updated = await r.json();
    if(Array.isArray(updated)){
      const idx=_caixa_cache.findIndex(x=>x.id===id);
      if(idx>=0) _caixa_cache[idx]=updated[0];
    }
  } catch(e) { console.error(e); }
}

// ── FORMULÁRIO COMPLETO ──
function ciAbrirForm(id) {
  _ciEditandoId = id||null;
  const c = id ? _caixa_cache.find(x=>x.id===id) : null;
  document.getElementById('esc-modal-title').textContent = c ? 'Editar entrada' : 'Nova entrada';
  document.getElementById('esc-modal-body').innerHTML = `
    <div class="esc-field">
      <label class="esc-label">Título <span style="color:var(--red)">*</span></label>
      <input class="esc-input" id="cif-titulo" value="${escEsc(c?.titulo||'')}" placeholder="O que surgiu?">
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
      <div class="esc-field">
        <label class="esc-label">Tipo</label>
        <select class="esc-select" id="cif-tipo">
          <option value="">Selecionar</option>
          ${CI_TIPOS.map(t=>`<option value="${t}" ${c?.tipo===t?'selected':''}>${t}</option>`).join('')}
        </select>
      </div>
      <div class="esc-field">
        <label class="esc-label">Área</label>
        <select class="esc-select" id="cif-area">
          <option value="">Não definida</option>
          ${CI_AREAS.map(a=>`<option value="${a}" ${c?.area===a?'selected':''}>${a}</option>`).join('')}
        </select>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
      <div class="esc-field">
        <label class="esc-label">Prioridade</label>
        <select class="esc-select" id="cif-prio">
          ${Object.entries(CI_PRIORIDADE).map(([k,v])=>`<option value="${k}" ${(c?.prioridade||'normal')===k?'selected':''}>${v.label}</option>`).join('')}
        </select>
      </div>
      <div class="esc-field">
        <label class="esc-label">Responsável</label>
        <select class="esc-select" id="cif-resp">
          <option value="">Selecionar</option>
          ${CI_RESPONSAVEIS.map(r=>`<option value="${r}" ${c?.responsavel_id===r?'selected':''}>${r}</option>`).join('')}
        </select>
      </div>
    </div>
    <div class="esc-field">
      <label class="esc-label">Descrição</label>
      <textarea class="esc-textarea" id="cif-desc" rows="4" placeholder="Contexto ou detalhes...">${escEsc(c?.descricao||'')}</textarea>
    </div>
    ${c?`<div class="esc-field">
      <label class="esc-label">Status</label>
      <select class="esc-select" id="cif-status">
        ${Object.entries(CI_STATUS).map(([k,v])=>`<option value="${k}" ${c.status===k?'selected':''}>${v.label}</option>`).join('')}
      </select>
    </div>`:''}
    <div style="display:flex;gap:10px;justify-content:flex-end">
      <button class="btn btn-secondary" onclick="escFecharModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="ciSalvar()">${c?'Salvar':'Registrar'}</button>
    </div>`;
  document.getElementById('esc-modal-overlay').classList.add('open');
  document.getElementById('cif-titulo')?.focus();
}

async function ciSalvar() {
  const titulo = document.getElementById('cif-titulo')?.value?.trim();
  if (!titulo) { escToast('Informe o título.'); return; }
  const obj = {
    titulo,
    tipo:           document.getElementById('cif-tipo')?.value||null,
    area:           document.getElementById('cif-area')?.value||null,
    prioridade:     document.getElementById('cif-prio')?.value||'normal',
    responsavel_id: document.getElementById('cif-resp')?.value||null,
    descricao:      document.getElementById('cif-desc')?.value||null,
    status:         document.getElementById('cif-status')?.value||'nova',
    created_by:     ESC_STATE?.usuario||'Jéssica',
    updated_at:     new Date().toISOString(),
  };
  try {
    if (_ciEditandoId) {
      const r = await fetch(ESC_SUPA_URL+'/rest/v1/escritorio_caixa_entrada?id=eq.'+_ciEditandoId, {
        method:'PATCH',
        headers:{'apikey':ESC_SUPA_KEY,'Authorization':'Bearer '+ESC_SUPA_KEY,'Content-Type':'application/json','Prefer':'return=representation'},
        body: JSON.stringify(obj)
      });
      const updated = await r.json();
      if(Array.isArray(updated)){
        const idx=_caixa_cache.findIndex(x=>x.id===_ciEditandoId);
        if(idx>=0) _caixa_cache[idx]=updated[0];
      }
      escToast('Atualizada!');
    } else {
      obj.status = obj.status||'nova';
      const r = await fetch(ESC_SUPA_URL+'/rest/v1/escritorio_caixa_entrada', {
        method:'POST',
        headers:{'apikey':ESC_SUPA_KEY,'Authorization':'Bearer '+ESC_SUPA_KEY,'Content-Type':'application/json','Prefer':'return=representation'},
        body: JSON.stringify(obj)
      });
      const created = await r.json();
      if(Array.isArray(created)) _caixa_cache.unshift(created[0]);
      escToast('Registrado!');
    }
    escFecharModal();
    if(_ciEditandoId) ciAbrirDetalhe(_ciEditandoId);
    else { ciRenderKpis(); ciRenderLista(); }
  } catch(e) { escToast('Erro ao salvar.'); console.error(e); }
}
