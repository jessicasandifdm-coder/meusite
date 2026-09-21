/* ══════════════════════════════════════════════════
   MÓDULO TAREFAS — escritorio-interno
   ══════════════════════════════════════════════════ */

// ── CONSTANTES ──
const T_STATUS = {
  a_fazer:      { label: 'A fazer',      cor: 'gray'   },
  em_andamento: { label: 'Em andamento', cor: 'blue'   },
  concluida:    { label: 'Concluída',    cor: 'green'  },
  pausada:      { label: 'Pausada',      cor: 'amber'  },
};
const T_PRIORIDADE = {
  baixa:    { label: 'Baixa',    cor: 'gray'   },
  normal:   { label: 'Normal',   cor: 'blue'   },
  alta:     { label: 'Alta',     cor: 'amber'  },
  urgente:  { label: 'Urgente',  cor: 'red'    },
};
const T_AREAS = ['JS Mentoria', 'Moni Sul', 'Interno'];
const T_ORIGENS = ['manual', 'projeto', 'reuniao', 'caixa_entrada', 'decisao', 'rotina', 'solicitacao'];
const T_RESPONSAVEIS = ['Jéssica', 'Amanda'];

// Filtros ativos
let _tfiltros = { view: 'todas', area: '', responsavel: '', status: '', prioridade: '' };
let _tarefasCache = [];
let _tarefaEditandoId = null;

// ── RENDER PRINCIPAL ──
async function escRenderTarefas(el) {
  el.innerHTML = `
    <div id="t-header" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:20px">
      <div style="display:flex;gap:8px;flex-wrap:wrap" id="t-views"></div>
      <div style="display:flex;gap:8px">
        <button class="btn btn-primary" onclick="tAbrirForm()">+ Nova tarefa</button>
      </div>
    </div>

    <!-- Filtros secundários -->
    <div id="t-filtros" style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px">
      <select class="esc-select" style="width:auto;min-width:130px" onchange="tSetFiltro('area',this.value)">
        <option value="">Todas as áreas</option>
        ${T_AREAS.map(a=>`<option value="${a}">${a}</option>`).join('')}
      </select>
      <select class="esc-select" style="width:auto;min-width:140px" onchange="tSetFiltro('responsavel',this.value)">
        <option value="">Todos os responsáveis</option>
        ${T_RESPONSAVEIS.map(r=>`<option value="${r}">${r}</option>`).join('')}
      </select>
      <select class="esc-select" style="width:auto;min-width:130px" onchange="tSetFiltro('status',this.value)">
        <option value="">Todos os status</option>
        ${Object.entries(T_STATUS).map(([k,v])=>`<option value="${k}">${v.label}</option>`).join('')}
      </select>
      <select class="esc-select" style="width:auto;min-width:120px" onchange="tSetFiltro('prioridade',this.value)">
        <option value="">Todas as prioridades</option>
        ${Object.entries(T_PRIORIDADE).map(([k,v])=>`<option value="${k}">${v.label}</option>`).join('')}
      </select>
      <button class="btn btn-secondary btn-sm" onclick="tLimparFiltros()">Limpar filtros</button>
    </div>

    <!-- KPIs rápidos -->
    <div id="t-kpis" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:10px;margin-bottom:20px"></div>

    <!-- Lista de tarefas -->
    <div id="t-lista">
      <div style="color:var(--text3);text-align:center;padding:40px">Carregando tarefas...</div>
    </div>
  `;

  tRenderViews();
  await tCarregar();
}

function tRenderViews() {
  const VIEWS = [
    { id: 'todas',     label: 'Todas' },
    { id: 'hoje',      label: 'Hoje' },
    { id: 'proximas',  label: 'Próximas' },
    { id: 'atrasadas', label: 'Atrasadas' },
    { id: 'concluidas',label: 'Concluídas' },
  ];
  document.getElementById('t-views').innerHTML = VIEWS.map(v => `
    <button class="btn ${_tfiltros.view === v.id ? 'btn-primary' : 'btn-secondary'} btn-sm" onclick="tSetView('${v.id}')">${v.label}</button>
  `).join('');
}

function tSetView(view) {
  _tfiltros.view = view;
  tRenderViews();
  tRenderLista();
}

function tSetFiltro(campo, valor) {
  _tfiltros[campo] = valor;
  tRenderLista();
}

function tLimparFiltros() {
  _tfiltros = { ..._tfiltros, area: '', responsavel: '', status: '', prioridade: '' };
  // Resetar selects
  document.querySelectorAll('#t-filtros select').forEach(s => s.selectedIndex = 0);
  tRenderLista();
}

async function tCarregar() {
  try {
    const data = await escGet('/rest/v1/escritorio_tarefas?order=created_at.desc');
    _tarefasCache = Array.isArray(data) ? data : [];
  } catch(e) {
    _tarefasCache = [];
    console.error('tCarregar:', e);
  }
  tRenderKpis();
  tRenderLista();
}

function tFiltrarTarefas() {
  const hoje = new Date().toISOString().split('T')[0];
  let lista = [..._tarefasCache];

  // View
  if (_tfiltros.view === 'hoje') {
    lista = lista.filter(t => t.prazo === hoje && t.status !== 'concluida');
  } else if (_tfiltros.view === 'atrasadas') {
    lista = lista.filter(t => t.prazo && t.prazo < hoje && t.status !== 'concluida');
  } else if (_tfiltros.view === 'proximas') {
    lista = lista.filter(t => t.prazo && t.prazo > hoje && t.status !== 'concluida');
  } else if (_tfiltros.view === 'concluidas') {
    lista = lista.filter(t => t.status === 'concluida');
  } else {
    // Todas: excluir concluídas por padrão (mostrar separado)
    // Manter todas
  }

  // Filtros secundários
  if (_tfiltros.area)        lista = lista.filter(t => t.area === _tfiltros.area);
  if (_tfiltros.responsavel) lista = lista.filter(t => t.responsavel_id === _tfiltros.responsavel || t.criado_por === _tfiltros.responsavel);
  if (_tfiltros.status)      lista = lista.filter(t => t.status === _tfiltros.status);
  if (_tfiltros.prioridade)  lista = lista.filter(t => t.prioridade === _tfiltros.prioridade);

  // Ordenar: urgente > alta > normal > baixa, depois por prazo
  const prioOrdem = { urgente: 0, alta: 1, normal: 2, baixa: 3 };
  lista.sort((a, b) => {
    const pa = prioOrdem[a.prioridade] ?? 2, pb = prioOrdem[b.prioridade] ?? 2;
    if (pa !== pb) return pa - pb;
    if (a.prazo && b.prazo) return a.prazo.localeCompare(b.prazo);
    if (a.prazo) return -1;
    if (b.prazo) return 1;
    return 0;
  });
  return lista;
}

function tRenderKpis() {
  const hoje = new Date().toISOString().split('T')[0];
  const ativas = _tarefasCache.filter(t => t.status !== 'concluida');
  const kpis = [
    { val: ativas.length,                                                              lbl: 'Pendentes',     cor: '' },
    { val: _tarefasCache.filter(t => t.prazo === hoje && t.status !== 'concluida').length, lbl: 'Para hoje',     cor: 'accent' },
    { val: _tarefasCache.filter(t => t.prazo && t.prazo < hoje && t.status !== 'concluida').length, lbl: 'Atrasadas', cor: 'red' },
    { val: _tarefasCache.filter(t => t.status === 'em_andamento').length,              lbl: 'Em andamento',  cor: 'blue' },
    { val: _tarefasCache.filter(t => t.status === 'concluida').length,                 lbl: 'Concluídas',    cor: 'green' },
  ];
  const CORES = { accent:'var(--accent)', red:'var(--red)', blue:'var(--accent)', green:'var(--green)', '':'var(--text)' };
  document.getElementById('t-kpis').innerHTML = kpis.map(k => `
    <div class="esc-kpi" style="${k.cor ? `border-color:${CORES[k.cor]}22` : ''}">
      <div class="esc-kpi-val" style="color:${CORES[k.cor]};font-size:22px">${k.val}</div>
      <div class="esc-kpi-lbl">${k.lbl}</div>
    </div>`).join('');
}

function tRenderLista() {
  const el = document.getElementById('t-lista');
  if (!el) return;
  const lista = tFiltrarTarefas();
  const hoje = new Date().toISOString().split('T')[0];

  if (!lista.length) {
    el.innerHTML = `<div style="color:var(--text3);text-align:center;padding:60px 20px">
      <div style="font-size:32px;margin-bottom:12px;opacity:.3">✅</div>
      <div>Nenhuma tarefa encontrada.</div>
    </div>`;
    return;
  }

  // Visão "próximas" — agrupar por data
  if (_tfiltros.view === 'proximas') {
    const grupos = {};
    lista.forEach(t => {
      const d = t.prazo || 'Sem prazo';
      if (!grupos[d]) grupos[d] = [];
      grupos[d].push(t);
    });
    el.innerHTML = Object.entries(grupos).map(([data, tarefas]) => `
      <div style="margin-bottom:20px">
        <div style="font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--text3);margin-bottom:8px;padding-left:2px">${tFormatarData(data)}</div>
        <div class="esc-list">${tarefas.map(t => tItemHtml(t, hoje)).join('')}</div>
      </div>`).join('');
    return;
  }

  el.innerHTML = `<div class="esc-list">${lista.map(t => tItemHtml(t, hoje)).join('')}</div>`;
}

function tItemHtml(t, hoje) {
  const atrasada = t.prazo && t.prazo < hoje && t.status !== 'concluida';
  const paraHoje = t.prazo === hoje && t.status !== 'concluida';
  const st = T_STATUS[t.status] || { label: t.status, cor: 'gray' };
  const pr = T_PRIORIDADE[t.prioridade] || { label: t.prioridade, cor: 'gray' };
  const AREA_COR = { 'JS Mentoria':'area-js', 'Moni Sul':'area-moni', 'Interno':'area-js' };

  return `
    <div class="esc-list-item" onclick="tAbrirDetalhe('${t.id}')" style="${t.status==='concluida' ? 'opacity:.55' : ''}">
      <!-- Indicador de prioridade -->
      <div style="width:3px;height:36px;border-radius:2px;background:${tCorPrioridade(t.prioridade)};flex-shrink:0"></div>

      <!-- Conteúdo principal -->
      <div style="flex:1;min-width:0">
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
          <span style="font-size:13px;font-weight:500;color:${t.status==='concluida'?'var(--text3)':'var(--text)'};${t.status==='concluida'?'text-decoration:line-through':''}">${escEsc(t.titulo)}</span>
          ${atrasada ? '<span class="badge badge-red">Atrasada</span>' : ''}
          ${paraHoje ? '<span class="badge badge-blue">Hoje</span>' : ''}
        </div>
        <div style="display:flex;align-items:center;gap:8px;margin-top:4px;flex-wrap:wrap">
          ${t.area ? `<span class="${AREA_COR[t.area]||'area-js'}">${t.area}</span>` : ''}
          ${t.responsavel_id ? `<span style="font-size:11px;color:var(--text3)">${escEsc(t.responsavel_id)}</span>` : ''}
          ${t.prazo ? `<span style="font-size:11px;color:${atrasada?'var(--red)':paraHoje?'var(--accent)':'var(--text3)'}">📅 ${tFormatarData(t.prazo)}</span>` : ''}
        </div>
      </div>

      <!-- Status + prioridade -->
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px;flex-shrink:0">
        <span class="badge badge-${st.cor}">${st.label}</span>
        <span class="badge badge-${pr.cor}" style="font-size:9px">${pr.label}</span>
      </div>

      <!-- Ações rápidas -->
      <div style="display:flex;flex-direction:column;gap:4px;flex-shrink:0" onclick="event.stopPropagation()">
        ${t.status !== 'concluida' ? `
          <button onclick="tConcluir('${t.id}')" title="Concluir" style="background:none;border:1px solid var(--border);border-radius:4px;color:var(--text3);padding:3px 7px;cursor:pointer;font-size:12px" onmouseenter="this.style.borderColor='var(--green)';this.style.color='var(--green)'" onmouseleave="this.style.borderColor='var(--border)';this.style.color='var(--text3)'">✓</button>
        ` : ''}
      </div>
    </div>`;
}

function tCorPrioridade(p) {
  return { baixa:'var(--text3)', normal:'var(--accent)', alta:'var(--amber)', urgente:'var(--red)' }[p] || 'var(--border)';
}

function tFormatarData(d) {
  if (!d || d === 'Sem prazo') return 'Sem prazo';
  try {
    const dt = new Date(d + 'T12:00:00');
    const hoje = new Date(); hoje.setHours(0,0,0,0);
    const amanha = new Date(hoje); amanha.setDate(hoje.getDate()+1);
    const dtLocal = new Date(d + 'T12:00:00'); dtLocal.setHours(0,0,0,0);
    if (dtLocal.getTime() === hoje.getTime()) return 'Hoje';
    if (dtLocal.getTime() === amanha.getTime()) return 'Amanhã';
    return dt.toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit', year:'numeric' });
  } catch(e) { return d; }
}

// ── FORMULÁRIO CRIAR/EDITAR ──
function tAbrirForm(idTarefa) {
  _tarefaEditandoId = idTarefa || null;
  const t = idTarefa ? _tarefasCache.find(x => x.id === idTarefa) : null;
  const titulo = t ? 'Editar tarefa' : 'Nova tarefa';

  document.getElementById('esc-modal-title').textContent = titulo;
  document.getElementById('esc-modal-body').innerHTML = `
    <div class="esc-field">
      <label class="esc-label">Título <span style="color:var(--red)">*</span></label>
      <input class="esc-input" id="tf-titulo" placeholder="O que precisa ser feito?" value="${escEsc(t?.titulo||'')}">
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
      <div class="esc-field">
        <label class="esc-label">Área <span style="color:var(--red)">*</span></label>
        <select class="esc-select" id="tf-area">
          <option value="">Selecionar</option>
          ${T_AREAS.map(a=>`<option value="${a}" ${t?.area===a?'selected':''}>${a}</option>`).join('')}
        </select>
      </div>
      <div class="esc-field">
        <label class="esc-label">Responsável</label>
        <select class="esc-select" id="tf-resp">
          <option value="">Selecionar</option>
          ${T_RESPONSAVEIS.map(r=>`<option value="${r}" ${(t?.responsavel_id||t?.criado_por)===r?'selected':''}>${r}</option>`).join('')}
        </select>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
      <div class="esc-field">
        <label class="esc-label">Prioridade</label>
        <select class="esc-select" id="tf-prio">
          ${Object.entries(T_PRIORIDADE).map(([k,v])=>`<option value="${k}" ${(t?.prioridade||'normal')===k?'selected':''}>${v.label}</option>`).join('')}
        </select>
      </div>
      <div class="esc-field">
        <label class="esc-label">Status</label>
        <select class="esc-select" id="tf-status">
          ${Object.entries(T_STATUS).map(([k,v])=>`<option value="${k}" ${(t?.status||'a_fazer')===k?'selected':''}>${v.label}</option>`).join('')}
        </select>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
      <div class="esc-field">
        <label class="esc-label">Prazo</label>
        <input class="esc-input" type="date" id="tf-prazo" value="${t?.prazo||''}">
      </div>
      <div class="esc-field">
        <label class="esc-label">Data de início</label>
        <input class="esc-input" type="date" id="tf-inicio" value="${t?.data_inicio||''}">
      </div>
    </div>
    <div class="esc-field">
      <label class="esc-label">Descrição</label>
      <textarea class="esc-textarea" id="tf-desc" placeholder="Detalhes, contexto ou instruções...">${escEsc(t?.descricao||'')}</textarea>
    </div>
    <div class="esc-field">
      <label class="esc-label">Origem</label>
      <select class="esc-select" id="tf-origem">
        <option value="manual" ${(!t||t.origem_tipo==='manual')?'selected':''}>Manual</option>
        ${T_ORIGENS.filter(o=>o!=='manual').map(o=>`<option value="${o}" ${t?.origem_tipo===o?'selected':''}>${o.replace('_',' ')}</option>`).join('')}
      </select>
    </div>
    ${t?.status === 'concluida' && t?.concluida_em ? `<div style="font-size:12px;color:var(--green);margin-bottom:12px">✓ Concluída em ${new Date(t.concluida_em).toLocaleDateString('pt-BR')}</div>` : ''}
    <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:4px">
      ${t && t.status !== 'concluida' ? `<button class="btn btn-secondary btn-sm" onclick="tConcluir('${t.id}');escFecharModal()" style="color:var(--green);border-color:var(--green)">✓ Concluir</button>` : ''}
      <button class="btn btn-secondary" onclick="escFecharModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="tSalvar()">${t ? 'Salvar alterações' : 'Criar tarefa'}</button>
    </div>
  `;
  if(typeof escAbrirModal==='function'){escAbrirModal();}else{const _ov=document.getElementById('esc-modal-overlay');if(_ov){_ov.style.opacity='1';_ov.style.pointerEvents='all';_ov.classList.add('open');}}
  document.getElementById('tf-titulo')?.focus();
}

async function tSalvar() {
  const titulo = document.getElementById('tf-titulo')?.value?.trim();
  const area   = document.getElementById('tf-area')?.value;
  if (!titulo) { escToast('Informe o título da tarefa.'); return; }
  if (!area)   { escToast('Selecione a área.'); return; }

  const obj = {
    titulo,
    area,
    responsavel_id: document.getElementById('tf-resp')?.value || null,
    prioridade:     document.getElementById('tf-prio')?.value || 'normal',
    status:         document.getElementById('tf-status')?.value || 'a_fazer',
    prazo:          document.getElementById('tf-prazo')?.value || null,
    data_inicio:    document.getElementById('tf-inicio')?.value || null,
    descricao:      document.getElementById('tf-desc')?.value || null,
    origem_tipo:    document.getElementById('tf-origem')?.value || 'manual',
    created_by:     ESC_STATE.usuario,
    criado_por:     ESC_STATE.usuario,
  };

  try {
    if (_tarefaEditandoId) {
      // Editar
      obj.updated_at = new Date().toISOString();
      const r = await fetch(ESC_SUPA_URL + '/rest/v1/escritorio_tarefas?id=eq.' + _tarefaEditandoId, {
        method: 'PATCH',
        headers: { 'apikey': ESC_SUPA_KEY, 'Authorization': 'Bearer ' + ESC_SUPA_KEY, 'Content-Type': 'application/json', 'Prefer': 'return=representation' },
        body: JSON.stringify(obj)
      });
      const updated = await r.json();
      if (Array.isArray(updated)) {
        const idx = _tarefasCache.findIndex(x => x.id === _tarefaEditandoId);
        if (idx >= 0) _tarefasCache[idx] = updated[0];
      }
      escToast('Tarefa atualizada!');
    } else {
      // Criar
      const r = await fetch(ESC_SUPA_URL + '/rest/v1/escritorio_tarefas', {
        method: 'POST',
        headers: { 'apikey': ESC_SUPA_KEY, 'Authorization': 'Bearer ' + ESC_SUPA_KEY, 'Content-Type': 'application/json', 'Prefer': 'return=representation' },
        body: JSON.stringify(obj)
      });
      const created = await r.json();
      if (Array.isArray(created)) _tarefasCache.unshift(created[0]);
      escToast('Tarefa criada!');
    }
    escFecharModal();
    tRenderKpis();
    tRenderLista();
  } catch(e) {
    escToast('Erro ao salvar tarefa.');
    console.error(e);
  }
}

// ── DETALHE (abrir tarefa existente = abrir form de edição) ──
function tAbrirDetalhe(id) {
  tAbrirForm(id);
}

// ── CONCLUIR ──
async function tConcluir(id) {
  try {
    const agora = new Date().toISOString();
    const r = await fetch(ESC_SUPA_URL + '/rest/v1/escritorio_tarefas?id=eq.' + id, {
      method: 'PATCH',
      headers: { 'apikey': ESC_SUPA_KEY, 'Authorization': 'Bearer ' + ESC_SUPA_KEY, 'Content-Type': 'application/json', 'Prefer': 'return=representation' },
      body: JSON.stringify({ status: 'concluida', concluida_em: agora, updated_at: agora })
    });
    const updated = await r.json();
    if (Array.isArray(updated)) {
      const idx = _tarefasCache.findIndex(x => x.id === id);
      if (idx >= 0) _tarefasCache[idx] = updated[0];
    }
    escToast('Tarefa concluída! ✓');
    tRenderKpis();
    tRenderLista();
  } catch(e) {
    escToast('Erro ao concluir tarefa.');
  }
}

// ── DASHBOARD: bloco tarefas ──
async function tDashboardBloco() {
  const hoje = new Date().toISOString().split('T')[0];
  let tarefas = [];
  try { tarefas = await escGet('/rest/v1/escritorio_tarefas?status=neq.concluida&order=prioridade.asc'); }
  catch(e) { tarefas = escMockTarefas(); }

  const paraHoje  = tarefas.filter(t => t.prazo === hoje);
  const atrasadas = tarefas.filter(t => t.prazo && t.prazo < hoje);
  const emAndamento = tarefas.filter(t => t.status === 'em_andamento');

  return { tarefas, paraHoje, atrasadas, emAndamento };
}
