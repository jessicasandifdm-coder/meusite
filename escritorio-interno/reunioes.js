/* ══════════════════════════════════════════════════
   MÓDULO REUNIÕES — escritorio-interno
   Pauta → Reunião → Decisões → Tarefas → Acompanhamento
   ══════════════════════════════════════════════════ */

const R_STATUS = {
  agendada:     { label: 'Agendada',     cor: 'blue'   },
  em_andamento: { label: 'Em andamento', cor: 'amber'  },
  realizada:    { label: 'Realizada',    cor: 'green'  },
  cancelada:    { label: 'Cancelada',    cor: 'red'    },
};
const R_TIPOS = [
  'Estratégica','Comercial','Conteúdo','Operacional interna',
  '1:1','Planejamento','Revisão','Outro'
];
const R_AREAS       = ['JS Mentoria','Moni Sul','Interno'];
const R_RESPONSAVEIS = ['Jéssica','Amanda'];

let _rfiltros = { view: 'proximas', area: '', tipo: '', status: '' };
let _reunioesCache = [];
let _rEditandoId   = null;
let _rDetalheId    = null;

// ── RENDER PRINCIPAL ──
async function escRenderReunioes(el) {
  el.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:20px">
      <div style="display:flex;gap:8px;flex-wrap:wrap" id="r-views"></div>
      <button class="btn btn-primary" onclick="rAbrirForm()">+ Nova reunião</button>
    </div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px">
      <select class="esc-select" style="width:auto;min-width:130px" onchange="rSetFiltro('area',this.value)">
        <option value="">Todas as áreas</option>
        ${R_AREAS.map(a=>`<option value="${a}">${a}</option>`).join('')}
      </select>
      <select class="esc-select" style="width:auto;min-width:140px" onchange="rSetFiltro('tipo',this.value)">
        <option value="">Todos os tipos</option>
        ${R_TIPOS.map(t=>`<option value="${t}">${t}</option>`).join('')}
      </select>
      <select class="esc-select" style="width:auto;min-width:130px" onchange="rSetFiltro('status',this.value)">
        <option value="">Todos os status</option>
        ${Object.entries(R_STATUS).map(([k,v])=>`<option value="${k}">${v.label}</option>`).join('')}
      </select>
      <button class="btn btn-secondary btn-sm" onclick="rLimparFiltros()">Limpar</button>
    </div>
    <div id="r-kpis" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:10px;margin-bottom:20px"></div>
    <div id="r-lista"><div style="color:var(--text3);text-align:center;padding:40px">Carregando...</div></div>
  `;
  rRenderViews();
  await rCarregar();
}

function rRenderViews() {
  const VIEWS = [
    { id:'proximas',  label:'Próximas'  },
    { id:'hoje',      label:'Hoje'      },
    { id:'todas',     label:'Todas'     },
    { id:'realizadas',label:'Realizadas'},
    { id:'canceladas',label:'Canceladas'},
  ];
  document.getElementById('r-views').innerHTML = VIEWS.map(v=>`
    <button class="btn ${_rfiltros.view===v.id?'btn-primary':'btn-secondary'} btn-sm"
      onclick="rSetView('${v.id}')">${v.label}</button>`).join('');
}

function rSetView(v) { _rfiltros.view=v; rRenderViews(); rRenderLista(); }
function rSetFiltro(k,v) { _rfiltros[k]=v; rRenderLista(); }
function rLimparFiltros() {
  _rfiltros = {..._rfiltros, area:'', tipo:'', status:''};
  document.querySelectorAll('[onchange*="rSetFiltro"]').forEach(s=>s.selectedIndex=0);
  rRenderLista();
}

async function rCarregar() {
  try {
    _reunioesCache = await escGet('/rest/v1/escritorio_reunioes?order=data_hora_inicio.asc');
    if(!Array.isArray(_reunioesCache)) _reunioesCache = [];
  } catch(e) { _reunioesCache = []; console.error(e); }
  rRenderKpis();
  rRenderLista();
}

function rFiltrar() {
  const agora = new Date();
  const hoje  = agora.toISOString().split('T')[0];
  let lista = [..._reunioesCache];

  const v = _rfiltros.view;
  if (v==='proximas') {
    lista = lista.filter(r => {
      const dt = r.data_hora_inicio || (r.data ? r.data+'T'+(r.hora_inicio||'00:00') : null);
      return dt && dt >= agora.toISOString() && r.status !== 'cancelada';
    });
  } else if (v==='hoje') {
    lista = lista.filter(r => {
      const dt = r.data_hora_inicio || r.data;
      return dt && dt.startsWith(hoje);
    });
  } else if (v==='realizadas') {
    lista = lista.filter(r => r.status === 'realizada');
  } else if (v==='canceladas') {
    lista = lista.filter(r => r.status === 'cancelada');
  }

  if (_rfiltros.area)   lista = lista.filter(r => r.area === _rfiltros.area);
  if (_rfiltros.tipo)   lista = lista.filter(r => r.tipo === _rfiltros.tipo);
  if (_rfiltros.status) lista = lista.filter(r => r.status === _rfiltros.status);
  return lista;
}

function rRenderKpis() {
  const hoje = new Date().toISOString().split('T')[0];
  const kpis = [
    { val: _reunioesCache.filter(r=>r.status==='agendada').length,   lbl:'Agendadas',  cor:''       },
    { val: _reunioesCache.filter(r=>(r.data_hora_inicio||r.data||'').startsWith(hoje)).length, lbl:'Hoje', cor:'accent' },
    { val: _reunioesCache.filter(r=>r.status==='realizada').length,   lbl:'Realizadas', cor:'green'  },
    { val: _reunioesCache.filter(r=>r.status==='cancelada').length,   lbl:'Canceladas', cor:'red'    },
  ];
  const CORES = {accent:'var(--accent)',green:'var(--green)',red:'var(--red)','':'var(--text)'};
  const el = document.getElementById('r-kpis');
  if (el) el.innerHTML = kpis.map(k=>`
    <div class="esc-kpi" style="${k.cor?`border-color:${CORES[k.cor]}22`:''}">
      <div class="esc-kpi-val" style="color:${CORES[k.cor]};font-size:22px">${k.val}</div>
      <div class="esc-kpi-lbl">${k.lbl}</div>
    </div>`).join('');
}

function rRenderLista() {
  const el = document.getElementById('r-lista');
  if (!el) return;
  const lista = rFiltrar();
  if (!lista.length) {
    el.innerHTML = `<div style="color:var(--text3);text-align:center;padding:60px 20px">
      <div style="font-size:32px;opacity:.3;margin-bottom:12px">📅</div>
      <div>Nenhuma reunião encontrada.</div>
      <button class="btn btn-secondary btn-sm" style="margin-top:16px" onclick="rAbrirForm()">+ Nova reunião</button>
    </div>`;
    return;
  }
  el.innerHTML = `<div class="esc-list">${lista.map(r=>rItemHtml(r)).join('')}</div>`;
}

function rItemHtml(r) {
  const st = R_STATUS[r.status] || {label:r.status,cor:'gray'};
  const dt = rFormatarDataHora(r.data_hora_inicio, r.data, r.hora_inicio);
  const hoje = new Date().toISOString().split('T')[0];
  const dataStr = (r.data_hora_inicio||r.data||'').substring(0,10);
  const isHoje = dataStr === hoje;
  const passada = dataStr && dataStr < hoje && r.status === 'agendada';
  const AREA_COR = {'JS Mentoria':'area-js','Moni Sul':'area-moni','Interno':'area-js'};

  return `
    <div class="esc-list-item" onclick="rAbrirDetalhe('${r.id}')" style="align-items:flex-start;gap:14px">
      <!-- Data/hora destacada -->
      <div style="min-width:56px;text-align:center;padding:6px 0;flex-shrink:0">
        <div style="font-size:18px;font-weight:700;color:${isHoje?'var(--accent)':passada?'var(--red)':'var(--text)'};line-height:1">${dataStr?new Date(dataStr+'T12:00:00').getDate():'—'}</div>
        <div style="font-size:10px;color:var(--text3)">${dataStr?new Date(dataStr+'T12:00:00').toLocaleDateString('pt-BR',{month:'short'}).replace('.',''):''}</div>
        ${r.hora_inicio||r.data_hora_inicio?`<div style="font-size:10px;color:var(--text3);margin-top:2px">${rSoHora(r.data_hora_inicio,r.hora_inicio)}</div>`:''}
      </div>

      <!-- Conteúdo -->
      <div style="flex:1;min-width:0">
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:4px">
          <span style="font-size:13px;font-weight:500;color:var(--text)">${escEsc(r.titulo)}</span>
          ${isHoje?'<span class="badge badge-blue">Hoje</span>':''}
          ${passada?'<span class="badge badge-red">Sem registro</span>':''}
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
          ${r.area?`<span class="${AREA_COR[r.area]||'area-js'}">${r.area}</span>`:''}
          ${r.tipo?`<span style="font-size:11px;color:var(--text3)">${r.tipo}</span>`:''}
          ${r.responsavel_id?`<span style="font-size:11px;color:var(--text3)">• ${escEsc(r.responsavel_id)}</span>`:''}
        </div>
      </div>

      <!-- Status -->
      <div style="flex-shrink:0">
        <span class="badge badge-${st.cor}">${st.label}</span>
      </div>
    </div>`;
}

function rFormatarDataHora(dt_iso, data, hora) {
  const d = dt_iso ? dt_iso.substring(0,10) : (data||'');
  const h = dt_iso ? dt_iso.substring(11,16) : (hora||'');
  if (!d) return '—';
  const dtObj = new Date(d+'T12:00:00');
  const dStr = dtObj.toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric'});
  return h ? `${dStr} — ${h}` : dStr;
}

function rSoHora(dt_iso, hora) {
  if (dt_iso && dt_iso.length >= 16) return dt_iso.substring(11,16);
  return hora || '';
}

// ── DETALHE DA REUNIÃO ──
async function rAbrirDetalhe(id) {
  _rDetalheId = id;
  const r = _reunioesCache.find(x=>x.id===id);
  if (!r) return;

  const content = document.getElementById('esc-content');
  content.innerHTML = `<div style="color:var(--text3);text-align:center;padding:40px">Carregando...</div>`;

  // Buscar tarefas, decisões e participantes em paralelo
  let tarefas = [], decisoes = [], participantes = [];
  try { tarefas = await escGet(`/rest/v1/escritorio_tarefas?origem_tipo=eq.reuniao&origem_id=eq.${id}&order=created_at.desc`); } catch(e) {}
  try { decisoes = await escGet(`/rest/v1/escritorio_decisoes?reuniao_id=eq.${id}&order=created_at.asc`); } catch(e) {}
  try { participantes = await escGet(`/rest/v1/escritorio_reuniao_participantes?reuniao_id=eq.${id}`); } catch(e) {}

  const hoje = new Date().toISOString().split('T')[0];
  const st = R_STATUS[r.status]||{label:r.status,cor:'gray'};
  const dtStr = rFormatarDataHora(r.data_hora_inicio, r.data, r.hora_inicio);
  const AREA_COR = {'JS Mentoria':'area-js','Moni Sul':'area-moni','Interno':'area-js'};

  content.innerHTML = `
    <!-- Breadcrumb -->
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:20px;font-size:13px">
      <span style="color:var(--text3);cursor:pointer" onclick="escNavegar('reunioes')">Reuniões</span>
      <span style="color:var(--border2)">›</span>
      <span style="color:var(--text)">${escEsc(r.titulo)}</span>
    </div>

    <!-- Header -->
    <div style="display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:24px">
      <div>
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:6px">
          ${r.area?`<span class="${AREA_COR[r.area]||'area-js'}">${r.area}</span>`:''}
          <span class="badge badge-${st.cor}">${st.label}</span>
          ${r.tipo?`<span class="badge badge-gray">${r.tipo}</span>`:''}
        </div>
        <h2 style="font-size:20px;font-weight:700;color:var(--text);margin-bottom:4px">${escEsc(r.titulo)}</h2>
        <div style="font-size:13px;color:var(--text3)">${dtStr}${r.hora_fim||r.data_hora_fim?' – '+rSoHora(r.data_hora_fim,r.hora_fim):''}</div>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;flex-shrink:0">
        <button class="btn btn-secondary btn-sm" onclick="rAbrirForm('${id}')">✏ Editar</button>
        ${r.status==='agendada'?`<button class="btn btn-secondary btn-sm" onclick="rMudarStatus('${id}','em_andamento')" style="color:var(--amber);border-color:var(--amber)">▶ Iniciar</button>`:''}
        ${r.status!=='realizada'&&r.status!=='cancelada'?`<button class="btn btn-secondary btn-sm" onclick="rMudarStatus('${id}','realizada')" style="color:var(--green);border-color:var(--green)">✓ Realizada</button>`:''}
      </div>
    </div>

    <!-- Grid info + pauta -->
    <div class="esc-grid-2" style="gap:16px;margin-bottom:20px">
      <!-- Informações -->
      <div class="esc-card">
        <div class="esc-card-title">Informações</div>
        <div style="display:flex;flex-direction:column;gap:8px;font-size:13px">
          ${r.responsavel_id?`<div><span style="color:var(--text3)">Responsável: </span><span style="color:var(--text)">${escEsc(r.responsavel_id)}</span></div>`:''}
          ${participantes.length?`<div><span style="color:var(--text3)">Participantes: </span><span style="color:var(--text)">${participantes.map(p=>escEsc(p.usuario_id)).join(', ')}</span></div>`:''}
          ${r.local?`<div><span style="color:var(--text3)">Local: </span><span style="color:var(--text)">${escEsc(r.local)}</span></div>`:''}
          ${r.link?`<div><span style="color:var(--text3)">Link: </span><a href="${escEsc(r.link)}" target="_blank" style="color:var(--accent)">${escEsc(r.link)}</a></div>`:''}
          ${r.projeto_id?`<div><span style="color:var(--text3)">Projeto: </span><span style="color:var(--accent);cursor:pointer" onclick="pAbrirDetalhe&&pAbrirDetalhe('${r.projeto_id}')">ver projeto →</span></div>`:''}
          ${r.objetivo||r.descricao?`<div style="margin-top:4px;color:var(--text2)">${escEsc(r.objetivo||r.descricao)}</div>`:''}
        </div>
      </div>

      <!-- Pauta -->
      <div class="esc-card">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
          <div class="esc-card-title" style="margin-bottom:0">Pauta</div>
          <button class="btn btn-secondary btn-sm" onclick="rEditarCampo('${id}','pauta',${JSON.stringify(r.pauta||'')})">✏</button>
        </div>
        <div id="r-pauta-content">
          ${r.pauta ? `<div style="font-size:13px;color:var(--text2);line-height:1.7;white-space:pre-wrap">${escEsc(r.pauta)}</div>`
            : `<div style="color:var(--text3);font-size:13px">Sem pauta registrada.</div>`}
        </div>
      </div>
    </div>

    <!-- Resumo -->
    <div class="esc-card" style="margin-bottom:16px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
        <div class="esc-card-title" style="margin-bottom:0">Resumo</div>
        <button class="btn btn-secondary btn-sm" onclick="rEditarCampo('${id}','resumo',${JSON.stringify(r.resumo||'')})">✏ Editar</button>
      </div>
      ${r.resumo ? `<div style="font-size:13px;color:var(--text2);line-height:1.7;white-space:pre-wrap">${escEsc(r.resumo)}</div>`
        : `<div style="color:var(--text3);font-size:13px">Sem resumo ainda. <span style="color:var(--accent);cursor:pointer" onclick="rEditarCampo('${id}','resumo','')">Registrar agora →</span></div>`}
    </div>

    <!-- Decisões -->
    <div class="esc-card" style="margin-bottom:16px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
        <div class="esc-card-title" style="margin-bottom:0">Decisões (${decisoes.length})</div>
        <button class="btn btn-secondary btn-sm" onclick="rNovaDecisao('${id}','${escEsc(r.area||'')}')">+ Nova decisão</button>
      </div>
      <div id="r-decisoes-list">
        ${decisoes.length===0
          ? `<div style="color:var(--text3);font-size:13px">Nenhuma decisão registrada.</div>`
          : decisoes.map(d=>`
            <div style="padding:10px 0;border-bottom:1px solid var(--border);display:flex;align-items:flex-start;gap:10px">
              <div style="width:6px;height:6px;border-radius:50%;background:var(--accent);flex-shrink:0;margin-top:6px"></div>
              <div style="flex:1">
                <div style="font-size:13px;font-weight:500;color:var(--text)">${escEsc(d.titulo)}</div>
                ${d.decisao?`<div style="font-size:12px;color:var(--text2);margin-top:2px;line-height:1.5">${escEsc(d.decisao)}</div>`:''}
                ${d.responsavel_id?`<div style="font-size:11px;color:var(--text3);margin-top:4px">Responsável: ${escEsc(d.responsavel_id)}</div>`:''}
              </div>
            </div>`).join('')}
      </div>
    </div>

    <!-- Tarefas geradas -->
    <div class="esc-card" style="margin-bottom:16px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
        <div class="esc-card-title" style="margin-bottom:0">Tarefas geradas (${tarefas.length})</div>
        <button class="btn btn-secondary btn-sm" onclick="rNovaTarefa('${id}','${escEsc(r.area||'')}','${escEsc(r.responsavel_id||'')}')">+ Nova tarefa</button>
      </div>
      <div id="r-tarefas-list">
        ${tarefas.length===0
          ? `<div style="color:var(--text3);font-size:13px">Nenhuma tarefa gerada ainda.</div>`
          : `<div class="esc-list">${tarefas.map(t=>tItemHtml(t,new Date().toISOString().split('T')[0])).join('')}</div>`}
      </div>
    </div>

    <!-- Observações -->
    <div class="esc-card">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
        <div class="esc-card-title" style="margin-bottom:0">Observações</div>
        <button class="btn btn-secondary btn-sm" onclick="rEditarCampo('${id}','observacoes',${JSON.stringify(r.observacoes||'')})">✏</button>
      </div>
      ${r.observacoes ? `<div style="font-size:13px;color:var(--text2);line-height:1.7;white-space:pre-wrap">${escEsc(r.observacoes)}</div>`
        : `<div style="color:var(--text3);font-size:13px">Sem observações.</div>`}
    </div>`;
}

// ── EDITAR CAMPO INLINE (pauta, resumo, observações) ──
function rEditarCampo(id, campo, valorAtual) {
  const LABELS = { pauta:'Pauta', resumo:'Resumo', observacoes:'Observações' };
  document.getElementById('esc-modal-title').textContent = 'Editar — ' + (LABELS[campo]||campo);
  document.getElementById('esc-modal-body').innerHTML = `
    <div class="esc-field">
      <textarea class="esc-textarea" id="rf-campo-val" rows="10" style="min-height:160px">${escEsc(valorAtual)}</textarea>
    </div>
    <div style="display:flex;gap:10px;justify-content:flex-end">
      <button class="btn btn-secondary" onclick="escFecharModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="rSalvarCampo('${id}','${campo}')">Salvar</button>
    </div>`;
  if(typeof escAbrirModal==='function'){escAbrirModal();}else{const _ov=document.getElementById('esc-modal-overlay');if(_ov){_ov.style.opacity='1';_ov.style.pointerEvents='all';_ov.classList.add('open');}}
  document.getElementById('rf-campo-val')?.focus();
}

async function rSalvarCampo(id, campo) {
  const val = document.getElementById('rf-campo-val')?.value || '';
  try {
    const r = await fetch(ESC_SUPA_URL+'/rest/v1/escritorio_reunioes?id=eq.'+id, {
      method:'PATCH',
      headers:{'apikey':ESC_SUPA_KEY,'Authorization':'Bearer '+ESC_SUPA_KEY,'Content-Type':'application/json','Prefer':'return=representation'},
      body: JSON.stringify({[campo]: val, updated_at: new Date().toISOString()})
    });
    const updated = await r.json();
    if (Array.isArray(updated)) {
      const idx = _reunioesCache.findIndex(x=>x.id===id);
      if (idx>=0) _reunioesCache[idx] = updated[0];
    }
    escToast('Salvo!');
    escFecharModal();
    rAbrirDetalhe(id);
  } catch(e) { escToast('Erro ao salvar.'); }
}

// ── MUDAR STATUS ──
async function rMudarStatus(id, novoStatus) {
  try {
    const extra = novoStatus==='realizada' ? { realizada_em: new Date().toISOString() } : {};
    const r = await fetch(ESC_SUPA_URL+'/rest/v1/escritorio_reunioes?id=eq.'+id, {
      method:'PATCH',
      headers:{'apikey':ESC_SUPA_KEY,'Authorization':'Bearer '+ESC_SUPA_KEY,'Content-Type':'application/json','Prefer':'return=representation'},
      body: JSON.stringify({status: novoStatus, updated_at: new Date().toISOString(), ...extra})
    });
    const updated = await r.json();
    if (Array.isArray(updated)) {
      const idx = _reunioesCache.findIndex(x=>x.id===id);
      if (idx>=0) _reunioesCache[idx] = updated[0];
    }
    escToast('Status atualizado!');
    rAbrirDetalhe(id);
  } catch(e) { escToast('Erro ao atualizar status.'); }
}

// ── NOVA DECISÃO DENTRO DA REUNIÃO ──
function rNovaDecisao(reuniaoId, area) {
  document.getElementById('esc-modal-title').textContent = 'Nova decisão';
  document.getElementById('esc-modal-body').innerHTML = `
    <div style="font-size:12px;color:var(--accent);margin-bottom:12px;padding:6px 10px;background:var(--accent-dim);border-radius:6px">
      📅 Vinculando à reunião atual
    </div>
    <div class="esc-field">
      <label class="esc-label">Título <span style="color:var(--red)">*</span></label>
      <input class="esc-input" id="rd-titulo" placeholder="O que foi decidido?">
    </div>
    <div class="esc-field">
      <label class="esc-label">Descrição da decisão</label>
      <textarea class="esc-textarea" id="rd-decisao" rows="3" placeholder="Detalhe a decisão tomada..."></textarea>
    </div>
    <div class="esc-field">
      <label class="esc-label">Contexto</label>
      <input class="esc-input" id="rd-contexto" placeholder="Por que essa decisão foi necessária?">
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
      <div class="esc-field">
        <label class="esc-label">Responsável</label>
        <select class="esc-select" id="rd-resp">
          <option value="">Selecionar</option>
          ${R_RESPONSAVEIS.map(r=>`<option value="${r}">${r}</option>`).join('')}
        </select>
      </div>
      <div class="esc-field">
        <label class="esc-label">Data de revisão</label>
        <input class="esc-input" type="date" id="rd-revisao">
      </div>
    </div>
    <div style="display:flex;gap:10px;justify-content:flex-end">
      <button class="btn btn-secondary" onclick="escFecharModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="rSalvarDecisao('${reuniaoId}','${area}')">Salvar decisão</button>
    </div>`;
  if(typeof escAbrirModal==='function'){escAbrirModal();}else{const _ov=document.getElementById('esc-modal-overlay');if(_ov){_ov.style.opacity='1';_ov.style.pointerEvents='all';_ov.classList.add('open');}}
  document.getElementById('rd-titulo')?.focus();
}

async function rSalvarDecisao(reuniaoId, area) {
  const titulo = document.getElementById('rd-titulo')?.value?.trim();
  if (!titulo) { escToast('Informe o título da decisão.'); return; }
  const obj = {
    titulo, area,
    reuniao_id:    reuniaoId,
    decisao:       document.getElementById('rd-decisao')?.value||null,
    contexto:      document.getElementById('rd-contexto')?.value||null,
    responsavel_id:document.getElementById('rd-resp')?.value||null,
    data_revisao:  document.getElementById('rd-revisao')?.value||null,
    data_decisao:  new Date().toISOString().split('T')[0],
    created_by:    ESC_STATE?.usuario||'Jéssica',
  };
  try {
    await fetch(ESC_SUPA_URL+'/rest/v1/escritorio_decisoes', {
      method:'POST',
      headers:{'apikey':ESC_SUPA_KEY,'Authorization':'Bearer '+ESC_SUPA_KEY,'Content-Type':'application/json','Prefer':'return=minimal'},
      body: JSON.stringify(obj)
    });
    escToast('Decisão registrada!');
    escFecharModal();
    rAbrirDetalhe(reuniaoId);
  } catch(e) { escToast('Erro ao salvar decisão.'); }
}

// ── NOVA TAREFA DENTRO DA REUNIÃO ──
function rNovaTarefa(reuniaoId, area, responsavel) {
  document.getElementById('esc-modal-title').textContent = 'Nova tarefa';
  document.getElementById('esc-modal-body').innerHTML = `
    <div style="font-size:12px;color:var(--accent);margin-bottom:12px;padding:6px 10px;background:var(--accent-dim);border-radius:6px">
      📅 Originada nesta reunião
    </div>
    <div class="esc-field">
      <label class="esc-label">Título <span style="color:var(--red)">*</span></label>
      <input class="esc-input" id="rt-titulo" placeholder="O que precisa ser feito?">
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
      <div class="esc-field">
        <label class="esc-label">Responsável</label>
        <select class="esc-select" id="rt-resp">
          <option value="">Selecionar</option>
          ${R_RESPONSAVEIS.map(r=>`<option value="${r}" ${r===responsavel?'selected':''}>${r}</option>`).join('')}
        </select>
      </div>
      <div class="esc-field">
        <label class="esc-label">Prioridade</label>
        <select class="esc-select" id="rt-prio">
          ${Object.entries(T_PRIORIDADE||{normal:{label:'Normal'},alta:{label:'Alta'},baixa:{label:'Baixa'},urgente:{label:'Urgente'}}).map(([k,v])=>`<option value="${k}" ${k==='normal'?'selected':''}>${v.label}</option>`).join('')}
        </select>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
      <div class="esc-field">
        <label class="esc-label">Prazo</label>
        <input class="esc-input" type="date" id="rt-prazo">
      </div>
      <div class="esc-field">
        <label class="esc-label">Vincular a projeto</label>
        <select class="esc-select" id="rt-projeto">
          <option value="">Nenhum</option>
          ${(_projetosCache||[]).filter(p=>p.status!=='cancelado'&&p.status!=='concluido').map(p=>`<option value="${p.id}">${escEsc(p.nome)}</option>`).join('')}
        </select>
      </div>
    </div>
    <div style="display:flex;gap:10px;justify-content:flex-end">
      <button class="btn btn-secondary" onclick="escFecharModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="rSalvarTarefa('${reuniaoId}','${area}')">Criar tarefa</button>
    </div>`;
  if(typeof escAbrirModal==='function'){escAbrirModal();}else{const _ov=document.getElementById('esc-modal-overlay');if(_ov){_ov.style.opacity='1';_ov.style.pointerEvents='all';_ov.classList.add('open');}}
  document.getElementById('rt-titulo')?.focus();
}

async function rSalvarTarefa(reuniaoId, area) {
  const titulo = document.getElementById('rt-titulo')?.value?.trim();
  if (!titulo) { escToast('Informe o título da tarefa.'); return; }
  const obj = {
    titulo, area,
    responsavel_id: document.getElementById('rt-resp')?.value||null,
    prioridade:     document.getElementById('rt-prio')?.value||'normal',
    prazo:          document.getElementById('rt-prazo')?.value||null,
    projeto_id:     document.getElementById('rt-projeto')?.value||null,
    status:         'a_fazer',
    origem_tipo:    'reuniao',
    origem_id:      reuniaoId,
    reuniao_id:     reuniaoId,
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
    if(Array.isArray(created) && typeof _tarefasCache!=='undefined') _tarefasCache.unshift(created[0]);
    escToast('Tarefa criada! ✓');
    escFecharModal();
    rAbrirDetalhe(reuniaoId);
  } catch(e) { escToast('Erro ao criar tarefa.'); }
}

// ── FORMULÁRIO CRIAR/EDITAR REUNIÃO ──
function rAbrirForm(id) {
  _rEditandoId = id || null;
  const r = id ? _reunioesCache.find(x=>x.id===id) : null;

  // Extrair hora do data_hora_inicio se existir
  const hIni = r?.hora_inicio || (r?.data_hora_inicio ? r.data_hora_inicio.substring(11,16) : '');
  const hFim = r?.hora_fim    || (r?.data_hora_fim   ? r.data_hora_fim.substring(11,16)    : '');
  const dataVal = r?.data || (r?.data_hora_inicio ? r.data_hora_inicio.substring(0,10) : '');

  document.getElementById('esc-modal-title').textContent = r ? 'Editar reunião' : 'Nova reunião';
  document.getElementById('esc-modal-body').innerHTML = `
    <div class="esc-field">
      <label class="esc-label">Título <span style="color:var(--red)">*</span></label>
      <input class="esc-input" id="rf-titulo" value="${escEsc(r?.titulo||'')}" placeholder="Assunto da reunião">
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
      <div class="esc-field">
        <label class="esc-label">Área <span style="color:var(--red)">*</span></label>
        <select class="esc-select" id="rf-area">
          <option value="">Selecionar</option>
          ${R_AREAS.map(a=>`<option value="${a}" ${r?.area===a?'selected':''}>${a}</option>`).join('')}
        </select>
      </div>
      <div class="esc-field">
        <label class="esc-label">Tipo <span style="color:var(--red)">*</span></label>
        <select class="esc-select" id="rf-tipo">
          <option value="">Selecionar</option>
          ${R_TIPOS.map(t=>`<option value="${t}" ${r?.tipo===t?'selected':''}>${t}</option>`).join('')}
        </select>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px">
      <div class="esc-field">
        <label class="esc-label">Data <span style="color:var(--red)">*</span></label>
        <input class="esc-input" type="date" id="rf-data" value="${dataVal}">
      </div>
      <div class="esc-field">
        <label class="esc-label">Início</label>
        <input class="esc-input" type="time" id="rf-hora-ini" value="${hIni}">
      </div>
      <div class="esc-field">
        <label class="esc-label">Fim</label>
        <input class="esc-input" type="time" id="rf-hora-fim" value="${hFim}">
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
      <div class="esc-field">
        <label class="esc-label">Responsável <span style="color:var(--red)">*</span></label>
        <select class="esc-select" id="rf-resp">
          <option value="">Selecionar</option>
          ${R_RESPONSAVEIS.map(rv=>`<option value="${rv}" ${r?.responsavel_id===rv?'selected':''}>${rv}</option>`).join('')}
        </select>
      </div>
      <div class="esc-field">
        <label class="esc-label">Status</label>
        <select class="esc-select" id="rf-status">
          ${Object.entries(R_STATUS).map(([k,v])=>`<option value="${k}" ${(r?.status||'agendada')===k?'selected':''}>${v.label}</option>`).join('')}
        </select>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
      <div class="esc-field">
        <label class="esc-label">Local</label>
        <input class="esc-input" id="rf-local" value="${escEsc(r?.local||'')}" placeholder="Ex: Google Meet, Escritório...">
      </div>
      <div class="esc-field">
        <label class="esc-label">Link</label>
        <input class="esc-input" id="rf-link" value="${escEsc(r?.link||'')}" placeholder="https://...">
      </div>
    </div>
    <div class="esc-field">
      <label class="esc-label">Objetivo / Descrição</label>
      <input class="esc-input" id="rf-objetivo" value="${escEsc(r?.objetivo||r?.descricao||'')}" placeholder="O que queremos resolver nessa reunião?">
    </div>
    <div class="esc-field">
      <label class="esc-label">Pauta</label>
      <textarea class="esc-textarea" id="rf-pauta" rows="4" placeholder="Assuntos a discutir...">${escEsc(r?.pauta||'')}</textarea>
    </div>
    <div class="esc-field">
      <label class="esc-label">Vincular a projeto</label>
      <select class="esc-select" id="rf-projeto">
        <option value="">Nenhum</option>
        ${(_projetosCache||[]).filter(p=>p.status!=='cancelado').map(p=>`<option value="${p.id}" ${r?.projeto_id===p.id?'selected':''}>${escEsc(p.nome)}</option>`).join('')}
      </select>
    </div>
    <div style="display:flex;gap:10px;justify-content:flex-end">
      <button class="btn btn-secondary" onclick="escFecharModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="rSalvar()">${r?'Salvar alterações':'Criar reunião'}</button>
    </div>`;
  if(typeof escAbrirModal==='function'){escAbrirModal();}else{const _ov=document.getElementById('esc-modal-overlay');if(_ov){_ov.style.opacity='1';_ov.style.pointerEvents='all';_ov.classList.add('open');}}
  document.getElementById('rf-titulo')?.focus();
}

async function rSalvar() {
  const titulo = document.getElementById('rf-titulo')?.value?.trim();
  const area   = document.getElementById('rf-area')?.value;
  const tipo   = document.getElementById('rf-tipo')?.value;
  const data   = document.getElementById('rf-data')?.value;
  const resp   = document.getElementById('rf-resp')?.value;
  if (!titulo) { escToast('Informe o título.'); return; }
  if (!area)   { escToast('Selecione a área.'); return; }
  if (!tipo)   { escToast('Selecione o tipo.'); return; }
  if (!data)   { escToast('Informe a data.'); return; }

  const hIni = document.getElementById('rf-hora-ini')?.value||'';
  const hFim = document.getElementById('rf-hora-fim')?.value||'';

  const obj = {
    titulo, area, tipo,
    status:       document.getElementById('rf-status')?.value||'agendada',
    data:         data,
    hora_inicio:  hIni||null,
    hora_fim:     hFim||null,
    data_hora_inicio: hIni ? `${data}T${hIni}:00` : `${data}T00:00:00`,
    data_hora_fim:    hFim ? `${data}T${hFim}:00` : null,
    responsavel_id:   resp||null,
    local:    document.getElementById('rf-local')?.value||null,
    link:     document.getElementById('rf-link')?.value||null,
    objetivo: document.getElementById('rf-objetivo')?.value||null,
    pauta:    document.getElementById('rf-pauta')?.value||null,
    projeto_id: document.getElementById('rf-projeto')?.value||null,
    created_by: ESC_STATE?.usuario||'Jéssica',
    updated_at: new Date().toISOString(),
  };

  try {
    if (_rEditandoId) {
      const res = await fetch(ESC_SUPA_URL+'/rest/v1/escritorio_reunioes?id=eq.'+_rEditandoId, {
        method:'PATCH',
        headers:{'apikey':ESC_SUPA_KEY,'Authorization':'Bearer '+ESC_SUPA_KEY,'Content-Type':'application/json','Prefer':'return=representation'},
        body: JSON.stringify(obj)
      });
      const updated = await res.json();
      if(Array.isArray(updated)){
        const idx=_reunioesCache.findIndex(x=>x.id===_rEditandoId);
        if(idx>=0) _reunioesCache[idx]=updated[0];
      }
      escToast('Reunião atualizada!');
    } else {
      const res = await fetch(ESC_SUPA_URL+'/rest/v1/escritorio_reunioes', {
        method:'POST',
        headers:{'apikey':ESC_SUPA_KEY,'Authorization':'Bearer '+ESC_SUPA_KEY,'Content-Type':'application/json','Prefer':'return=representation'},
        body: JSON.stringify(obj)
      });
      const created = await res.json();
      if(Array.isArray(created)) _reunioesCache.unshift(created[0]);
      escToast('Reunião criada!');
    }
    escFecharModal();
    if(_rDetalheId && _rEditandoId===_rDetalheId) rAbrirDetalhe(_rDetalheId);
    else { rRenderKpis(); rRenderLista(); }
  } catch(e) { escToast('Erro ao salvar reunião.'); console.error(e); }
}
