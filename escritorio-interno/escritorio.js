/* ══════════════════════════════════════════════════
   ESCRITÓRIO INTERNO JS — JavaScript
   Conecta ao mesmo Supabase do sistema comercial
   ══════════════════════════════════════════════════ */

// ── CONFIGURAÇÃO SUPABASE (mesmo projeto do sistema comercial) ──
const ESC_SUPA_URL = 'https://lnfghtlrzoioaotamzvy.supabase.co';
const ESC_SUPA_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxuZmdodGxyem9pb2FvdGFtenZ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY3MDg5MTMsImV4cCI6MjA5MjI4NDkxM30.lNHckve8P--rp9axdwZ6v6zTl4LLnk-1xY_kJS3wfFo';

// ── USUÁRIOS (mesmo sistema de auth do index.html) ──
const ESC_USERS = [
  { email: 'jessicasandifdm@gmail.com', senha: 'Jesa2011@', nome: 'Jéssica' }
];

// ── ESTADO GLOBAL ──
let ESC_STATE = {
  modulo: 'dashboard',
  usuario: null,
};

// ── HELPERS SUPABASE ──
async function escGet(path) {
  const r = await fetch(ESC_SUPA_URL + path, {
    headers: { 'apikey': ESC_SUPA_KEY, 'Authorization': 'Bearer ' + ESC_SUPA_KEY }
  });
  if (!r.ok) throw new Error('escGet ' + path + ' → ' + r.status);
  return r.json();
}

async function escPost(table, data) {
  const r = await fetch(ESC_SUPA_URL + '/rest/v1/' + table, {
    method: 'POST',
    headers: {
      'apikey': ESC_SUPA_KEY, 'Authorization': 'Bearer ' + ESC_SUPA_KEY,
      'Content-Type': 'application/json', 'Prefer': 'return=representation'
    },
    body: JSON.stringify(data)
  });
  if (!r.ok) throw new Error('escPost ' + table + ' → ' + r.status);
  return r.json();
}

async function escPatch(table, id, data) {
  const r = await fetch(ESC_SUPA_URL + '/rest/v1/' + table + '?id=eq.' + id, {
    method: 'PATCH',
    headers: {
      'apikey': ESC_SUPA_KEY, 'Authorization': 'Bearer ' + ESC_SUPA_KEY,
      'Content-Type': 'application/json', 'Prefer': 'return=minimal'
    },
    body: JSON.stringify(data)
  });
  if (!r.ok) throw new Error('escPatch ' + table + '/' + id + ' → ' + r.status);
}

// ── AUTH ──
function escCheckSession() {
  const s = sessionStorage.getItem('esc_logged');
  const nome = sessionStorage.getItem('esc_nome');
  if (s === 'true') {
    ESC_STATE.usuario = nome || 'Jéssica';
    document.getElementById('esc-login-overlay').style.display = 'none';
    escInit();
  }
}

function escDoLogin() {
  const email = (document.getElementById('esc-login-email')?.value || '').trim().toLowerCase();
  const senha = document.getElementById('esc-login-senha')?.value || '';
  const errEl = document.getElementById('esc-login-err');
  const user = ESC_USERS.find(u => u.email === email && u.senha === senha);
  if (!user) {
    if (errEl) errEl.textContent = 'E-mail ou senha incorretos.';
    return;
  }
  sessionStorage.setItem('esc_logged', 'true');
  sessionStorage.setItem('esc_nome', user.nome);
  ESC_STATE.usuario = user.nome;
  document.getElementById('esc-login-overlay').style.display = 'none';
  escInit();
}

function escLogout() {
  sessionStorage.removeItem('esc_logged');
  sessionStorage.removeItem('esc_nome');
  location.reload();
}

// ── INIT ──
async function escInit() {
  const userEl = document.getElementById('esc-user-name');
  if (userEl) userEl.textContent = ESC_STATE.usuario || 'Jéssica';
  escNavegar('dashboard');
}

// ── NAVEGAÇÃO ──
function escNavegar(modulo) {
  ESC_STATE.modulo = modulo;

  // Atualizar nav items ativos
  document.querySelectorAll('.esc-nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.modulo === modulo);
  });

  // Renderizar o módulo
  const content = document.getElementById('esc-content');
  const headerTitle = document.getElementById('esc-page-title');
  const headerSub   = document.getElementById('esc-page-sub');

  const TITULOS = {
    dashboard:    ['Dashboard', 'Visão geral do dia — planejamento e execução'],
    caixa:        ['Caixa de Entrada', 'Itens que precisam de atenção ou decisão'],
    tarefas:      ['Tarefas', 'Gestão de tarefas por área e projeto'],
    projetos:     ['Projetos', 'Projetos em andamento — JS Mentoria e Moni Sul'],
    reunioes:     ['Reuniões', 'Pautas, decisões e atas'],
    decisoes:     ['Decisões', 'Registro de decisões estratégicas'],
    planejamento: ['Planejamento', 'Planejamento estratégico por área'],
    calendario:   ['Calendário', 'Visão temporal de tarefas e reuniões'],
    conteudo:     ['Conteúdo', 'Planejamento e produção de conteúdo'],
    rotinas:      ['Rotinas', 'Rotinas e processos recorrentes'],
    processos:    ['Processos', 'Documentação de processos internos'],
  };

  const [titulo, sub] = TITULOS[modulo] || ['Módulo', ''];
  if (headerTitle) headerTitle.textContent = titulo;
  if (headerSub)   headerSub.textContent   = sub;

  switch (modulo) {
    case 'dashboard':    escRenderDashboard(content);    break;
    case 'tarefas':      escRenderTarefas(content);           break;
    default:             escRenderPlaceholder(content, titulo, sub); break;
  }
}

// ── DASHBOARD ──
async function escRenderDashboard(el) {
  el.innerHTML = escTemplateDashboardLoading();

  // Dados reais do Supabase (com fallback para mock se tabelas ainda não existirem)
  let tarefasHoje = [], reunioesHoje = [], projetosAtivos = [], caixaRecentes = [];
  const hoje = new Date().toISOString().split('T')[0];

  try {
    tarefasHoje   = await escGet(`/rest/v1/escritorio_tarefas?prazo=eq.${hoje}&status=neq.concluida&order=prioridade.asc&limit=10`);
  } catch(e) { tarefasHoje = escMockTarefas(); }

  try {
    reunioesHoje  = await escGet(`/rest/v1/escritorio_reunioes?data=eq.${hoje}&order=hora_inicio.asc&limit=5`);
  } catch(e) { reunioesHoje = escMockReunioes(); }

  try {
    projetosAtivos = await escGet(`/rest/v1/escritorio_projetos?status=eq.em_andamento&order=prioridade.asc&limit=6`);
  } catch(e) { projetosAtivos = escMockProjetos(); }

  try {
    caixaRecentes = await escGet(`/rest/v1/escritorio_caixa_entrada?status=eq.pendente&order=created_at.desc&limit=5`);
  } catch(e) { caixaRecentes = escMockCaixa(); }

  el.innerHTML = escTemplateDashboard({ tarefasHoje, reunioesHoje, projetosAtivos, caixaRecentes, hoje });
}

function escTemplateDashboardLoading() {
  return `<div style="display:flex;align-items:center;justify-content:center;min-height:200px;color:var(--text3);font-size:13px">Carregando...</div>`;
}

function escTemplateDashboard({ tarefasHoje, reunioesHoje, projetosAtivos, caixaRecentes, hoje }) {
  const dataFormatada = new Date(hoje + 'T12:00:00').toLocaleDateString('pt-BR', { weekday:'long', day:'numeric', month:'long' });
  const PRIO_BADGE = { alta: '<span class="badge badge-red">Alta</span>', media: '<span class="badge badge-amber">Média</span>', baixa: '<span class="badge badge-gray">Baixa</span>' };
  const AREA_TAG   = { 'JS Mentoria': '<span class="area-js">JS Mentoria</span>', 'Moni Sul': '<span class="area-moni">Moni Sul</span>' };
  const STATUS_BADGE = { pendente: '<span class="badge badge-amber">Pendente</span>', em_andamento: '<span class="badge badge-blue">Em andamento</span>', concluida: '<span class="badge badge-green">Concluída</span>' };

  return `
    <!-- Indicadores de tarefas -->
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:10px;margin-bottom:20px">
      <div class="esc-kpi" style="cursor:pointer;padding:14px" onclick="escNavegar('tarefas')">
        <div class="esc-kpi-val" style="font-size:22px;color:var(--text)">${tarefasHoje.length}</div>
        <div class="esc-kpi-lbl">Para hoje</div>
      </div>
    </div>

    <!-- Atalhos rápidos -->
    <div class="esc-shortcuts">
      <div class="esc-shortcut" onclick="tAbrirForm()"><span class="esc-shortcut-icon">✚</span> Nova tarefa</div>
      <div class="esc-shortcut" onclick="escAbrirModal('nova-reuniao')"><span class="esc-shortcut-icon">📅</span> Nova reunião</div>
      <div class="esc-shortcut" onclick="escAbrirModal('novo-projeto')"><span class="esc-shortcut-icon">📁</span> Novo projeto</div>
      <div class="esc-shortcut" onclick="escAbrirModal('nova-decisao')"><span class="esc-shortcut-icon">⚡</span> Nova decisão</div>
      <div class="esc-shortcut" onclick="escNavegar('caixa')"><span class="esc-shortcut-icon">📥</span> Caixa de entrada</div>
    </div>

    <!-- Visão do dia -->
    <div class="esc-section">
      <div class="esc-section-header">
        <div class="esc-section-title">Visão do dia &nbsp;<span style="font-size:12px;font-weight:400;color:var(--text3)">${dataFormatada}</span></div>
      </div>
      <div class="esc-grid-2" style="gap:14px">
        <!-- Tarefas de hoje -->
        <div class="esc-card">
          <div class="esc-card-title">Tarefas de hoje (${tarefasHoje.length})</div>
          ${tarefasHoje.length === 0
            ? `<div style="color:var(--text3);font-size:13px">Nenhuma tarefa para hoje.</div>`
            : `<div class="esc-list">${tarefasHoje.map(t => `
              <div class="esc-list-item">
                <div class="esc-list-item-title">${escEsc(t.titulo)}</div>
                ${AREA_TAG[t.area] || ''}
                ${PRIO_BADGE[t.prioridade] || ''}
              </div>`).join('')}</div>`}
        </div>
        <!-- Reuniões do dia -->
        <div class="esc-card">
          <div class="esc-card-title">Reuniões hoje (${reunioesHoje.length})</div>
          ${reunioesHoje.length === 0
            ? `<div style="color:var(--text3);font-size:13px">Nenhuma reunião hoje.</div>`
            : `<div class="esc-list">${reunioesHoje.map(r => `
              <div class="esc-list-item">
                <span style="font-size:11px;font-family:var(--mono);color:var(--text3);min-width:44px">${r.hora_inicio||''}</span>
                <div class="esc-list-item-title">${escEsc(r.titulo)}</div>
                ${AREA_TAG[r.area] || ''}
              </div>`).join('')}</div>`}
        </div>
      </div>
    </div>

    <!-- Projetos em andamento -->
    <div class="esc-section">
      <div class="esc-section-header">
        <div class="esc-section-title">Projetos em andamento</div>
        <button class="esc-section-link" onclick="escNavegar('projetos')">Ver todos →</button>
      </div>
      ${projetosAtivos.length === 0
        ? `<div style="color:var(--text3);font-size:13px">Nenhum projeto ativo.</div>`
        : `<div class="esc-grid-3">${projetosAtivos.map(p => `
          <div class="esc-card" style="cursor:pointer" onclick="escNavegar('projetos')">
            <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:8px">
              ${AREA_TAG[p.area] || '<span></span>'}
              ${PRIO_BADGE[p.prioridade] || ''}
            </div>
            <div style="font-size:14px;font-weight:600;color:var(--text);margin-bottom:4px">${escEsc(p.nome)}</div>
            <div style="font-size:12px;color:var(--text3);line-height:1.4">${escEsc((p.descricao||'').slice(0,80))}${(p.descricao||'').length>80?'…':''}</div>
            ${p.prazo ? `<div style="margin-top:10px;font-size:11px;color:var(--text3)">Prazo: ${p.prazo}</div>` : ''}
          </div>`).join('')}</div>`}
    </div>

    <!-- Caixa de entrada -->
    <div class="esc-section">
      <div class="esc-section-header">
        <div class="esc-section-title">Caixa de entrada</div>
        <button class="esc-section-link" onclick="escNavegar('caixa')">Ver tudo →</button>
      </div>
      ${caixaRecentes.length === 0
        ? `<div style="color:var(--text3);font-size:13px">Caixa vazia.</div>`
        : `<div class="esc-list">${caixaRecentes.map(c => `
          <div class="esc-list-item">
            <div class="esc-list-item-title">${escEsc(c.titulo)}</div>
            ${AREA_TAG[c.area] || ''}
            <span class="esc-list-item-meta">${c.tipo||''}</span>
          </div>`).join('')}</div>`}
    </div>`;
}

// ── PLACEHOLDER (módulos ainda não implementados) ──
function escRenderPlaceholder(el, titulo, sub) {
  const ICONS = {
    'Caixa de Entrada':'📥', 'Tarefas':'✅', 'Projetos':'📁', 'Reuniões':'📅',
    'Decisões':'⚡', 'Planejamento':'🗺', 'Calendário':'📆', 'Conteúdo':'✏️',
    'Rotinas':'🔄', 'Processos':'📋'
  };
  el.innerHTML = `
    <div class="esc-placeholder">
      <div class="esc-placeholder-icon">${ICONS[titulo]||'📄'}</div>
      <div class="esc-placeholder-title">${titulo}</div>
      <div class="esc-placeholder-sub">${sub}<br><br><span style="color:var(--text3)">Módulo em construção — será implementado em breve.</span></div>
    </div>`;
}

// ── MODAL (estrutura base) ──
function escAbrirModal(tipo) {
  const TITULOS = {
    'nova-tarefa': 'Nova tarefa',
    'nova-reuniao': 'Nova reunião',
    'novo-projeto': 'Novo projeto',
    'nova-decisao': 'Nova decisão'
  };
  const overlay = document.getElementById('esc-modal-overlay');
  const title   = document.getElementById('esc-modal-title');
  const body    = document.getElementById('esc-modal-body');
  if (!overlay) return;
  title.textContent = TITULOS[tipo] || tipo;
  body.innerHTML    = escModalForm(tipo);
  overlay.classList.add('open');
}

function escFecharModal() {
  document.getElementById('esc-modal-overlay')?.classList.remove('open');
}

function escModalForm(tipo) {
  const areaOpts = `<option value="JS Mentoria">JS Mentoria</option><option value="Moni Sul">Moni Sul</option>`;
  const prioOpts = `<option value="media" selected>Média</option><option value="alta">Alta</option><option value="baixa">Baixa</option>`;
  if (tipo === 'nova-tarefa') return `
    <div class="esc-field"><label class="esc-label">Título</label><input class="esc-input" id="esc-form-titulo" placeholder="O que precisa ser feito?"></div>
    <div class="esc-field"><label class="esc-label">Área</label><select class="esc-select" id="esc-form-area">${areaOpts}</select></div>
    <div class="esc-field"><label class="esc-label">Prioridade</label><select class="esc-select" id="esc-form-prio">${prioOpts}</select></div>
    <div class="esc-field"><label class="esc-label">Prazo</label><input class="esc-input" type="date" id="esc-form-prazo"></div>
    <div class="esc-field"><label class="esc-label">Descrição</label><textarea class="esc-textarea" id="esc-form-desc" placeholder="Detalhes (opcional)"></textarea></div>
    <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:4px">
      <button class="btn btn-secondary" onclick="escFecharModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="escSalvarTarefa()">Salvar tarefa</button>
    </div>`;
  if (tipo === 'nova-reuniao') return `
    <div class="esc-field"><label class="esc-label">Título</label><input class="esc-input" id="esc-form-titulo" placeholder="Assunto da reunião"></div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px">
      <div class="esc-field"><label class="esc-label">Data</label><input class="esc-input" type="date" id="esc-form-data"></div>
      <div class="esc-field"><label class="esc-label">Início</label><input class="esc-input" type="time" id="esc-form-hora-ini"></div>
      <div class="esc-field"><label class="esc-label">Fim</label><input class="esc-input" type="time" id="esc-form-hora-fim"></div>
    </div>
    <div class="esc-field"><label class="esc-label">Área</label><select class="esc-select" id="esc-form-area">${areaOpts}</select></div>
    <div class="esc-field"><label class="esc-label">Objetivo</label><input class="esc-input" id="esc-form-obj" placeholder="O que queremos resolver nessa reunião?"></div>
    <div class="esc-field"><label class="esc-label">Pauta</label><textarea class="esc-textarea" id="esc-form-pauta" placeholder="Tópicos a discutir"></textarea></div>
    <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:4px">
      <button class="btn btn-secondary" onclick="escFecharModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="escSalvarReuniao()">Salvar reunião</button>
    </div>`;
  if (tipo === 'novo-projeto') return `
    <div class="esc-field"><label class="esc-label">Nome do projeto</label><input class="esc-input" id="esc-form-titulo" placeholder="Nome do projeto"></div>
    <div class="esc-field"><label class="esc-label">Área</label><select class="esc-select" id="esc-form-area">${areaOpts}</select></div>
    <div class="esc-field"><label class="esc-label">Prioridade</label><select class="esc-select" id="esc-form-prio">${prioOpts}</select></div>
    <div class="esc-field"><label class="esc-label">Descrição</label><textarea class="esc-textarea" id="esc-form-desc" placeholder="Objetivo e contexto do projeto"></textarea></div>
    <div class="esc-field"><label class="esc-label">Prazo</label><input class="esc-input" type="date" id="esc-form-prazo"></div>
    <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:4px">
      <button class="btn btn-secondary" onclick="escFecharModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="escSalvarProjeto()">Salvar projeto</button>
    </div>`;
  if (tipo === 'nova-decisao') return `
    <div class="esc-field"><label class="esc-label">Título da decisão</label><input class="esc-input" id="esc-form-titulo" placeholder="O que foi decidido?"></div>
    <div class="esc-field"><label class="esc-label">Área</label><select class="esc-select" id="esc-form-area">${areaOpts}</select></div>
    <div class="esc-field"><label class="esc-label">Contexto</label><textarea class="esc-textarea" id="esc-form-ctx" placeholder="Por que essa decisão foi necessária?"></textarea></div>
    <div class="esc-field"><label class="esc-label">A decisão</label><textarea class="esc-textarea" id="esc-form-dec" placeholder="O que foi decidido exatamente?"></textarea></div>
    <div class="esc-field"><label class="esc-label">Data</label><input class="esc-input" type="date" id="esc-form-data" value="${new Date().toISOString().split('T')[0]}"></div>
    <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:4px">
      <button class="btn btn-secondary" onclick="escFecharModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="escSalvarDecisao()">Salvar decisão</button>
    </div>`;
  return '<div style="color:var(--text3)">Formulário não implementado ainda.</div>';
}

// ── SALVAR (com fallback gracioso se tabela não existir) ──
async function escSalvarTarefa() {
  // Delegado ao módulo tarefas
  return tSalvar ? tSalvar() : escToast('Módulo tarefas não carregado.');
}
async function _escSalvarTarefa_legacy() {
  const titulo = document.getElementById('esc-form-titulo')?.value?.trim();
  if (!titulo) return escToast('Informe o título da tarefa.');
  const obj = {
    titulo, area: document.getElementById('esc-form-area')?.value,
    prioridade: document.getElementById('esc-form-prio')?.value,
    prazo: document.getElementById('esc-form-prazo')?.value || null,
    descricao: document.getElementById('esc-form-desc')?.value || '',
    status: 'pendente', criado_por: ESC_STATE.usuario
  };
  try {
    await escPost('escritorio_tarefas', obj);
    escToast('Tarefa salva!'); escFecharModal();
    if (ESC_STATE.modulo === 'dashboard') escNavegar('dashboard');
  } catch(e) { escToast('Não foi possível salvar — tabela ainda não criada no banco.'); }
}

async function escSalvarReuniao() {
  const titulo = document.getElementById('esc-form-titulo')?.value?.trim();
  if (!titulo) return escToast('Informe o título da reunião.');
  const obj = {
    titulo, area: document.getElementById('esc-form-area')?.value,
    data: document.getElementById('esc-form-data')?.value || null,
    hora_inicio: document.getElementById('esc-form-hora-ini')?.value || null,
    hora_fim: document.getElementById('esc-form-hora-fim')?.value || null,
    objetivo: document.getElementById('esc-form-obj')?.value || '',
    pauta: document.getElementById('esc-form-pauta')?.value || '',
    criado_por: ESC_STATE.usuario, created_by: ESC_STATE.usuario
  };
  try {
    await escPost('escritorio_reunioes', obj);
    escToast('Reunião salva!'); escFecharModal();
    if (ESC_STATE.modulo === 'dashboard') escNavegar('dashboard');
  } catch(e) { escToast('Não foi possível salvar — tabela ainda não criada no banco.'); }
}

async function escSalvarProjeto() {
  const titulo = document.getElementById('esc-form-titulo')?.value?.trim();
  if (!titulo) return escToast('Informe o nome do projeto.');
  const obj = {
    nome: titulo, area: document.getElementById('esc-form-area')?.value,
    prioridade: document.getElementById('esc-form-prio')?.value,
    prazo: document.getElementById('esc-form-prazo')?.value || null,
    descricao: document.getElementById('esc-form-desc')?.value || '',
    status: 'em_andamento', created_by: ESC_STATE.usuario
  };
  try {
    await escPost('escritorio_projetos', obj);
    escToast('Projeto salvo!'); escFecharModal();
    if (ESC_STATE.modulo === 'dashboard') escNavegar('dashboard');
  } catch(e) { escToast('Não foi possível salvar — tabela ainda não criada no banco.'); }
}

async function escSalvarDecisao() {
  const titulo = document.getElementById('esc-form-titulo')?.value?.trim();
  if (!titulo) return escToast('Informe o título da decisão.');
  const obj = {
    titulo, area: document.getElementById('esc-form-area')?.value,
    contexto: document.getElementById('esc-form-ctx')?.value || '',
    decisao: document.getElementById('esc-form-dec')?.value || '',
    data_decisao: document.getElementById('esc-form-data')?.value || null,
    criado_por: ESC_STATE.usuario, created_by: ESC_STATE.usuario
  };
  try {
    await escPost('escritorio_decisoes', obj);
    escToast('Decisão registrada!'); escFecharModal();
    if (ESC_STATE.modulo === 'dashboard') escNavegar('dashboard');
  } catch(e) { escToast('Não foi possível salvar — tabela ainda não criada no banco.'); }
}

// ── UTILS ──
function escEsc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

function escToast(msg) {
  const el = document.getElementById('esc-toast');
  if (!el) return;
  el.textContent = msg; el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 3000);
}

// ── MOCKS (dados de demonstração enquanto as tabelas não existem) ──
function escMockTarefas() {
  return [
    { titulo: 'Preparar pauta da reunião de quarta', area: 'JS Mentoria', prioridade: 'alta' },
    { titulo: 'Revisar planejamento de conteúdo de outubro', area: 'JS Mentoria', prioridade: 'media' },
    { titulo: 'Analisar resultado da campanha do mês', area: 'Moni Sul', prioridade: 'media' },
  ];
}
function escMockReunioes() {
  return [
    { titulo: 'Alinhamento semanal JS Mentoria', hora_inicio: '09:00', area: 'JS Mentoria' },
    { titulo: 'Revisão de processos operacionais', hora_inicio: '14:00', area: 'Moni Sul' },
  ];
}
function escMockProjetos() {
  return [
    { nome: 'Lançamento Mentoria Outubro', area: 'JS Mentoria', prioridade: 'alta', descricao: 'Preparar toda a estrutura para abertura de vagas em outubro.' },
    { nome: 'Planejamento de verão Moni Sul', area: 'Moni Sul', prioridade: 'media', descricao: 'Coleção, campanhas e comunicação para o verão 2026/27.' },
    { nome: 'Escritório Interno — módulos', area: 'JS Mentoria', prioridade: 'media', descricao: 'Construção incremental dos módulos do Escritório Interno.' },
  ];
}
function escMockCaixa() {
  return [
    { titulo: 'Aprovar proposta de criação de conteúdo', area: 'JS Mentoria', tipo: 'aprovação' },
    { titulo: 'Definir linha editorial de novembro', area: 'JS Mentoria', tipo: 'decisão' },
    { titulo: 'Verificar calendário de coleções', area: 'Moni Sul', tipo: 'tarefa' },
  ];
}

// ── INICIALIZAÇÃO ──
document.addEventListener('DOMContentLoaded', () => {
  escCheckSession();
  // Fechar modal ao clicar fora
  document.getElementById('esc-modal-overlay')?.addEventListener('click', function(e) {
    if (e.target === this) escFecharModal();
  });
  // Login via Enter
  document.getElementById('esc-login-senha')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') escDoLogin();
  });
});
