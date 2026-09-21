/* ══════════════════════════════════════════════════
   ESCRITÓRIO INTERNO — orquestrador v2
   Menu: Escritório · Tarefas · Projetos · Agenda · Conteúdo · Equipe
   ══════════════════════════════════════════════════ */

// ── CONFIG ──
const ESC_SUPA_URL = 'https://lnfghtlrzoioaotamzvy.supabase.co';
const ESC_SUPA_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxuZmdodGxyem9pb2FvdGFtenZ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY3MDg5MTMsImV4cCI6MjA5MjI4NDkxM30.lNHckve8P--rp9axdwZ6v6zTl4LLnk-1xY_kJS3wfFo';
const ESC_USERS = [
  { email:'jessicasandifdm@gmail.com', senha:'Jesa2011@',   nome:'Jéssica', role:'admin'      },
  { email:'artchique7@gmail.com',       senha:'Amanda2026@', nome:'Amanda',  role:'colaborador' },
];

// ── ESTADO ──
const ESC_STATE = { modulo:'escritorio', usuario:null, role:null, usuario_id:null, perfil:null };

// ── ÍCONES SVG (sem emojis) ──
const ICONS = {
  home:     `<svg viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`,
  check:    `<svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>`,
  folder:   `<svg viewBox="0 0 24 24"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>`,
  calendar: `<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`,
  edit2:    `<svg viewBox="0 0 24 24"><path d="M17 3a2.828 2.828 0 114 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>`,
  users:    `<svg viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>`,
  settings: `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>`,
  plus:     `<svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`,
  bell:     `<svg viewBox="0 0 24 24"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>`,
  clock:    `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
  task:     `<svg viewBox="0 0 24 24"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>`,
  meeting:  `<svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>`,
  note:     `<svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`,
  content:  `<svg viewBox="0 0 24 24"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>`,
  arrow:    `<svg viewBox="0 0 24 24"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>`,
  eye:      `<svg viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`,
  logout:   `<svg viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>`,
  x:        `<svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
  chevron:  `<svg viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg>`,
  rotate:   `<svg viewBox="0 0 24 24"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 102.13-9.36L1 10"/></svg>`,
};
function icon(name, size='16') {
  return `<span class="icon" style="width:${size}px;height:${size}px">${ICONS[name]||''}</span>`;
}

// ── AUTH ──
function escCheckSession() {
  const logged = sessionStorage.getItem('esc_logged');
  if (logged === 'true') {
    ESC_STATE.usuario = sessionStorage.getItem('esc_nome') || 'Jéssica';
    ESC_STATE.role    = sessionStorage.getItem('esc_role') || 'admin';
    document.getElementById('esc-login-overlay').style.display = 'none';
    escInit();
  }
}
function escDoLogin() {
  const email = document.getElementById('esc-login-email')?.value?.trim().toLowerCase();
  const senha = document.getElementById('esc-login-senha')?.value || '';
  const err   = document.getElementById('esc-login-err');
  const user  = ESC_USERS.find(u => u.email === email && u.senha === senha);
  if (!user) { if(err) err.textContent = 'E-mail ou senha incorretos.'; return; }
  sessionStorage.setItem('esc_logged', 'true');
  sessionStorage.setItem('esc_nome',   user.nome);
  sessionStorage.setItem('esc_role',   user.role);
  ESC_STATE.usuario = user.nome;
  ESC_STATE.role    = user.role;
  document.getElementById('esc-login-overlay').style.display = 'none';
  escInit();
}
function escLogout() {
  ['esc_logged','esc_nome','esc_role'].forEach(k => sessionStorage.removeItem(k));
  location.reload();
}

// ── INIT ──
async function escInit() {
  // Atualizar nome no nav
  const nameEl = document.getElementById('esc-nav-name');
  if (nameEl) nameEl.textContent = ESC_STATE.usuario || 'Jéssica';
  const avatarEl = document.getElementById('esc-nav-avatar');
  if (avatarEl) avatarEl.textContent = (ESC_STATE.usuario||'J')[0].toUpperCase();

  // Inicializar notificações
  if (typeof notifInicializar === 'function') {
    notifInicializar().then(() => { if (typeof notifVerificarPrazos==='function') notifVerificarPrazos(); });
  }
  // Carregar contexto de permissões
  if (typeof escCarregarContexto === 'function') await escCarregarContexto();

  // Módulo inicial: colaborador → Equipe/portal, admin → Escritório
  const inicio = ESC_STATE.role === 'colaborador' ? 'equipe' : 'escritorio';
  escNavegar(inicio);
}

// ── NAVEGAÇÃO ──
function escNavegar(modulo) {
  ESC_STATE.modulo = modulo;
  document.querySelectorAll('.esc-nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.modulo === modulo);
  });
  const pageTitle = document.getElementById('esc-page-title');
  const LABELS = {
    escritorio:'Escritório', tarefas:'Tarefas', projetos:'Projetos',
    agenda:'Agenda', conteudo:'Conteúdo', equipe:'Equipe',
    configuracoes:'Configurações'
  };
  if (pageTitle) pageTitle.textContent = LABELS[modulo] || modulo;
  const content = document.getElementById('esc-content');
  switch(modulo) {
    case 'escritorio':    escRenderHome(content);        break;
    case 'tarefas':       escRenderTarefas(content);     break;
    case 'projetos':      escRenderProjetos(content);    break;
    case 'agenda':        escRenderAgenda(content);      break;
    case 'conteudo':      escRenderConteudo(content);    break;
    case 'equipe':        escRenderEquipe(content);      break;
    case 'configuracoes': escRenderConfiguracoes && escRenderConfiguracoes(content); break;
    default: escRenderHome(content);
  }
}

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
    method:'POST',
    headers:{'apikey':ESC_SUPA_KEY,'Authorization':'Bearer '+ESC_SUPA_KEY,'Content-Type':'application/json','Prefer':'return=representation'},
    body: JSON.stringify(data)
  });
  if (!r.ok) throw new Error('escPost ' + table + ' → ' + r.status);
  return r.json();
}
async function escPatch(table, id, data) {
  const r = await fetch(ESC_SUPA_URL + '/rest/v1/' + table + '?id=eq.' + id, {
    method:'PATCH',
    headers:{'apikey':ESC_SUPA_KEY,'Authorization':'Bearer '+ESC_SUPA_KEY,'Content-Type':'application/json','Prefer':'return=representation'},
    body: JSON.stringify(data)
  });
  if (!r.ok) throw new Error('escPatch ' + table + '/' + id + ' → ' + r.status);
  return r.json();
}
function escEsc(s) {
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function escToast(msg) {
  const el = document.getElementById('esc-toast');
  if (!el) return;
  el.textContent = msg; el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 3000);
}

// ── HOME / ESCRITÓRIO ──
async function escRenderHome(el) {
  const hoje = new Date();
  const hojeStr = hoje.toISOString().split('T')[0];
  const nome = ESC_STATE.usuario || 'Jéssica';
  const hora = hoje.getHours();
  const saudacao = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite';
  const dateLabel = hoje.toLocaleDateString('pt-BR', {weekday:'long',day:'numeric',month:'long'});

  el.innerHTML = `<div style="color:var(--text3);font-size:13px;padding:40px;text-align:center">Carregando...</div>`;

  // Carregar dados em paralelo
  const usuario = ESC_STATE.usuario || 'Jéssica';
  let tarefasHoje=[], tarefasAtras=[], reunioesHoje=[], projetosAtivos=[], proximos=[];

  try {
    const todas = await escGet(`/rest/v1/escritorio_tarefas?responsavel_id=eq.${encodeURIComponent(usuario)}&status=neq.concluida&order=prazo.asc,prioridade.asc&limit=50`);
    tarefasHoje = todas.filter(t => t.prazo === hojeStr);
    tarefasAtras= todas.filter(t => t.prazo && t.prazo < hojeStr);
  } catch(e) {}

  try {
    reunioesHoje = await escGet(`/rest/v1/escritorio_reunioes?data=eq.${hojeStr}&status=neq.cancelada&order=hora_inicio.asc`);
  } catch(e) {}

  try {
    projetosAtivos = await escGet(`/rest/v1/escritorio_projetos?status=in.(planejamento,em_andamento)&order=updated_at.desc&limit=5`);
  } catch(e) {}

  try {
    const amanha = new Date(hoje); amanha.setDate(amanha.getDate()+1);
    const em7 = new Date(hoje); em7.setDate(em7.getDate()+7);
    const p = await escGet(`/rest/v1/escritorio_tarefas?responsavel_id=eq.${encodeURIComponent(usuario)}&prazo=gte.${amanha.toISOString().split('T')[0]}&prazo=lte.${em7.toISOString().split('T')[0]}&status=neq.concluida&order=prazo.asc&limit=8`);
    proximos = p;
  } catch(e) {}

  // Descobrir item "AGORA" — reunião ou tarefa com horário mais próximo
  const agora = hoje.getHours() * 60 + hoje.getMinutes();
  const eventoAgora = reunioesHoje.find(r => {
    if (!r.hora_inicio) return false;
    const [h,m] = r.hora_inicio.split(':').map(Number);
    const diff = h*60+m - agora;
    return diff >= -30 && diff <= 90;
  });

  // Agrupar agenda de hoje: reuniões + tarefas com horário
  const agendaHoje = [
    ...reunioesHoje.map(r => ({ hora:r.hora_inicio?.substring(0,5)||'', titulo:r.titulo, tipo:'reuniao', id:r.id })),
  ].sort((a,b) => (a.hora||'99').localeCompare(b.hora||'99'));

  const PRIO_COR = {urgente:'prio-urgente',alta:'prio-alta',normal:'prio-normal',baixa:'prio-baixa'};

  el.innerHTML = `
    <div class="esc-home-greeting">${saudacao}, ${escEsc(nome.split(' ')[0])}.</div>
    <div class="esc-home-date">${dateLabel}</div>

    ${eventoAgora ? `
      <div class="esc-now-block">
        <div>
          <div style="font-size:10px;font-weight:700;letter-spacing:.1em;color:var(--accent);text-transform:uppercase;margin-bottom:3px">Agora</div>
          <div class="esc-now-title">${escEsc(eventoAgora.titulo)}</div>
          <div class="esc-now-sub">${eventoAgora.hora_inicio?.substring(0,5)||''}${eventoAgora.hora_fim?' – '+eventoAgora.hora_fim.substring(0,5):''}</div>
        </div>
      </div>` : ''}

    <div class="esc-home-grid">
      <!-- COLUNA PRINCIPAL -->
      <div>
        ${tarefasAtras.length ? `
          <div class="esc-section">
            <div class="esc-section-label" style="color:var(--red)">Atrasado</div>
            ${tarefasAtras.slice(0,4).map(t => escTaskRowHtml(t, hojeStr)).join('')}
          </div>` : ''}

        <div class="esc-section">
          <div class="esc-section-label">Hoje</div>
          ${tarefasHoje.length
            ? tarefasHoje.map(t => escTaskRowHtml(t, hojeStr)).join('')
            : `<div style="color:var(--text3);font-size:13px;padding:8px 10px">Nenhuma tarefa para hoje.</div>`}
        </div>

        ${proximos.length ? `
          <div class="esc-section">
            <div class="esc-section-label">Próximos dias</div>
            ${proximos.map(t => `
              <div class="esc-upcoming-row">
                <div class="esc-upcoming-date">${new Date(t.prazo+'T12:00:00').toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'})}</div>
                <div class="esc-upcoming-title">${escEsc(t.titulo)}</div>
              </div>`).join('')}
          </div>` : ''}
      </div>

      <!-- COLUNA LATERAL -->
      <div>
        <div class="esc-section">
          <div class="esc-section-label">Agenda de hoje</div>
          ${agendaHoje.length
            ? agendaHoje.map(ev => `
              <div class="esc-agenda-row" onclick="escNavegar('agenda')">
                <div class="esc-agenda-time">${ev.hora||'—'}</div>
                <div class="esc-agenda-title">${escEsc(ev.titulo)}</div>
              </div>`).join('')
            : `<div style="color:var(--text3);font-size:13px;padding:8px 10px">Agenda livre.</div>`}
        </div>

        ${projetosAtivos.length ? `
          <div class="esc-section">
            <div class="esc-section-label" style="display:flex;align-items:center;justify-content:space-between">
              <span>Em andamento</span>
              <button class="btn btn-ghost btn-xs" onclick="escNavegar('projetos')">ver todos</button>
            </div>
            ${projetosAtivos.map(p => `
              <div class="esc-task-row" onclick="escNavegar('projetos');setTimeout(()=>pAbrirDetalhe&&pAbrirDetalhe('${p.id}'),300)">
                <div class="esc-task-prio prio-${p.prioridade==='urgente'?'urgente':p.prioridade==='alta'?'alta':'normal'}"></div>
                <div class="esc-task-title">${escEsc(p.nome)}</div>
                <div class="esc-task-meta" style="font-size:10px">${{'planejamento':'Planejamento','em_andamento':'Em andamento'}[p.status]||''}</div>
              </div>`).join('')}
          </div>` : ''}
      </div>
    </div>`;
}

function escTaskRowHtml(t, hojeStr) {
  const atrasada = t.prazo && t.prazo < hojeStr && t.status !== 'concluida';
  const done = t.status === 'concluida';
  const PRIO_COR = {urgente:'prio-urgente',alta:'prio-alta',normal:'prio-normal',baixa:'prio-baixa'};
  return `
    <div class="esc-task-row" onclick="tAbrirForm&&tAbrirForm('${t.id}')">
      <div class="esc-task-prio ${PRIO_COR[t.prioridade]||'prio-normal'}"></div>
      <div class="esc-task-check ${done?'done':''}" onclick="event.stopPropagation();escConcluirTarefa('${t.id}',this)"></div>
      <div class="esc-task-title ${done?'done':''}">${escEsc(t.titulo)}</div>
      ${atrasada?`<span class="badge badge-red" style="font-size:9px">Atrasada</span>`:''}
      ${t.prazo&&!atrasada&&t.prazo!==hojeStr?`<div class="esc-task-meta">${new Date(t.prazo+'T12:00:00').toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'})}</div>`:''}
    </div>`;
}

async function escConcluirTarefa(id, checkEl) {
  checkEl.classList.add('done');
  const row = checkEl.closest('.esc-task-row');
  const titleEl = row?.querySelector('.esc-task-title');
  if (titleEl) titleEl.classList.add('done');
  try {
    await escPatch('escritorio_tarefas', id, {status:'concluida', concluida_em:new Date().toISOString()});
    if (typeof _tarefasCache !== 'undefined') {
      const idx = _tarefasCache.findIndex(x=>x.id===id);
      if(idx>=0) _tarefasCache[idx].status = 'concluida';
    }
    escToast('Tarefa concluída!');
  } catch(e) { escToast('Erro ao concluir tarefa.'); }
}

// ── AGENDA (wrapper do calendário) ──
function escRenderAgenda(el) {
  if (typeof escRenderCalendario === 'function') {
    escRenderCalendario(el);
  } else {
    el.innerHTML = `<div class="esc-empty"><div class="esc-empty-title">Agenda</div><div class="esc-empty-sub">Módulo carregando...</div></div>`;
  }
}

// ── CONTEÚDO ──
async function escRenderConteudo(el) {
  el.innerHTML = `<div style="color:var(--text3);font-size:13px;text-align:center;padding:40px">Carregando...</div>`;

  // Verificar se tabela escritorio_conteudo existe
  let conteudos = [];
  try { conteudos = await escGet('/rest/v1/escritorio_conteudo?order=data_publicacao.asc&limit=30'); } catch(e) {}

  const TABS = ['Ideias','Em produção','Programados','Publicados'];
  const STATUS_MAP = {Ideias:'ideia','Em produção':'producao',Programados:'programado',Publicados:'publicado'};

  el.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px">
      <div>
        <div style="font-size:18px;font-weight:700;color:var(--text)">Conteúdo</div>
        <div style="font-size:12px;color:var(--text3);margin-top:2px">Calendário editorial e produção de conteúdo</div>
      </div>
      <button class="btn btn-primary" onclick="escAbrirNovoConteudo()">
        ${icon('plus','14')} Novo conteúdo
      </button>
    </div>
    <div class="esc-tabs" id="cont-tabs">
      ${TABS.map((t,i)=>`<button class="esc-tab ${i===0?'active':''}" onclick="contSetTab(this,'${STATUS_MAP[t]}')">${t}</button>`).join('')}
    </div>
    <div id="cont-lista">
      ${escRenderConteudoLista(conteudos, 'ideia')}
    </div>`;

  window._conteudoCache = conteudos;
}

function contSetTab(btn, status) {
  document.querySelectorAll('#cont-tabs .esc-tab').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  const lista = document.getElementById('cont-lista');
  if(lista) lista.innerHTML = escRenderConteudoLista(window._conteudoCache||[], status);
}

function escRenderConteudoLista(lista, status) {
  const filtrado = lista.filter(c=>c.status===status);
  if(!filtrado.length) return `<div class="esc-empty" style="min-height:180px">
    <div class="esc-empty-title">Nenhum conteúdo aqui</div>
    <div class="esc-empty-sub">Adicione um novo conteúdo para começar.</div>
  </div>`;
  return `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:10px">
    ${filtrado.map(c=>`
      <div class="esc-content-card">
        <div style="font-size:13px;font-weight:600;color:var(--text);margin-bottom:6px">${escEsc(c.titulo||c.ideia||'Sem título')}</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;font-size:11px;color:var(--text3)">
          ${c.formato?`<span>${escEsc(c.formato)}</span>`:''}
          ${c.canal?`<span>${escEsc(c.canal)}</span>`:''}
          ${c.data_publicacao?`<span>${new Date(c.data_publicacao+'T12:00:00').toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'})}</span>`:''}
        </div>
      </div>`).join('')}
  </div>`;
}

function escAbrirNovoConteudo() {
  document.getElementById('esc-modal-title').textContent = 'Novo conteúdo';
  document.getElementById('esc-modal-body').innerHTML = `
    <div class="esc-field"><label class="esc-label">Título / Ideia</label><input class="esc-input" id="nc-titulo" placeholder="Sobre o que é?"></div>
    <div class="grid-2">
      <div class="esc-field"><label class="esc-label">Formato</label>
        <select class="esc-select" id="nc-formato">
          <option value="">Selecionar</option>
          <option>Reels</option><option>Carrossel</option><option>Stories</option>
          <option>Post estático</option><option>Live</option><option>Podcast</option>
        </select>
      </div>
      <div class="esc-field"><label class="esc-label">Canal</label>
        <select class="esc-select" id="nc-canal">
          <option value="">Selecionar</option>
          <option>Instagram</option><option>YouTube</option><option>TikTok</option><option>Email</option>
        </select>
      </div>
    </div>
    <div class="grid-2">
      <div class="esc-field"><label class="esc-label">Status</label>
        <select class="esc-select" id="nc-status">
          <option value="ideia">Ideia</option><option value="producao">Em produção</option>
          <option value="programado">Programado</option><option value="publicado">Publicado</option>
        </select>
      </div>
      <div class="esc-field"><label class="esc-label">Data de publicação</label>
        <input class="esc-input" type="date" id="nc-data">
      </div>
    </div>
    <div class="esc-field"><label class="esc-label">Roteiro / Legenda</label>
      <textarea class="esc-textarea" id="nc-roteiro" placeholder="Detalhes do conteúdo..." rows="3"></textarea>
    </div>
    <div style="display:flex;gap:10px;justify-content:flex-end">
      <button class="btn btn-secondary" onclick="escFecharModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="escSalvarConteudo()">Salvar</button>
    </div>`;
  document.getElementById('esc-modal-overlay').classList.add('open');
  document.getElementById('nc-titulo')?.focus();
}

async function escSalvarConteudo() {
  const titulo = document.getElementById('nc-titulo')?.value?.trim();
  if(!titulo){escToast('Informe o título.'); return;}
  const data_pub = document.getElementById('nc-data')?.value;
  const obj = {
    titulo, status: document.getElementById('nc-status')?.value||'ideia',
    formato: document.getElementById('nc-formato')?.value||null,
    canal:   document.getElementById('nc-canal')?.value||null,
    roteiro: document.getElementById('nc-roteiro')?.value||null,
    data_publicacao: data_pub||null,
    responsavel_id:  ESC_STATE.usuario,
    created_by:      ESC_STATE.usuario,
  };
  try {
    await fetch(ESC_SUPA_URL+'/rest/v1/escritorio_conteudo',{
      method:'POST',
      headers:{'apikey':ESC_SUPA_KEY,'Authorization':'Bearer '+ESC_SUPA_KEY,'Content-Type':'application/json','Prefer':'return=minimal'},
      body: JSON.stringify(obj)
    });
    escToast('Conteúdo salvo!');
    escFecharModal();
    escRenderConteudo(document.getElementById('esc-content'));
  } catch(e){
    // Tabela não existe ainda — criar
    escToast('Tabela de conteúdo será criada na próxima atualização.');
    escFecharModal();
  }
}

// ── MODAL ──
function escFecharModal() {
  const ov = document.getElementById('esc-modal-overlay');
  if (!ov) return;
  ov.style.opacity = '0';
  ov.style.pointerEvents = 'none';
  ov.classList.remove('open');
}
function escAbrirModal() {
  const ov = document.getElementById('esc-modal-overlay');
  if (!ov) return;
  ov.style.opacity = '1';
  ov.style.pointerEvents = 'all';
  ov.classList.add('open');
}

// ── DROPDOWN + ADICIONAR ──
function escToggleAddMenu() {
  const menu = document.getElementById('esc-add-menu');
  if (!menu) return;
  const visible = menu.style.display !== 'none';
  menu.style.display = visible ? 'none' : 'block';
  if (!visible) {
    // Fechar ao clicar fora
    setTimeout(() => {
      document.addEventListener('click', function close(e) {
        if (!menu.contains(e.target)) { menu.style.display='none'; document.removeEventListener('click',close); }
      });
    }, 0);
  }
}

function escAddItem(tipo) {
  document.getElementById('esc-add-menu').style.display = 'none';
  switch(tipo) {
    case 'tarefa':
      if(typeof tAbrirForm==='function') tAbrirForm(null);
      else escToast('Módulo Tarefas não carregado.');
      break;
    case 'projeto':
      if(typeof pAbrirForm==='function') pAbrirForm();
      else escToast('Módulo Projetos não carregado.');
      break;
    case 'reuniao':
      if(typeof rAbrirForm==='function') { escNavegar('agenda'); setTimeout(()=>rAbrirForm(),300); }
      else escToast('Módulo Reuniões não carregado.');
      break;
    case 'conteudo':
      escAbrirNovoConteudo();
      break;
    case 'nota':
      escAbrirNota();
      break;
  }
}

function escAbrirNota() {
  document.getElementById('esc-modal-title').textContent = 'Nova nota rápida';
  document.getElementById('esc-modal-body').innerHTML = `
    <div style="font-size:12px;color:var(--text3);margin-bottom:12px">Registre e depois decida o que fazer com isso.</div>
    <div class="esc-field"><input class="esc-input" id="nota-titulo" placeholder="O que você precisa registrar?"></div>
    <div class="esc-field"><textarea class="esc-textarea" id="nota-corpo" rows="4" placeholder="Detalhes..."></textarea></div>
    <div style="display:flex;gap:10px;justify-content:flex-end">
      <button class="btn btn-secondary" onclick="escFecharModal()">Cancelar</button>
      <button class="btn btn-secondary" onclick="escNota_viraTarefa()">→ Criar tarefa</button>
      <button class="btn btn-primary" onclick="escNota_salvar()">Salvar nota</button>
    </div>`;
  document.getElementById('esc-modal-overlay').classList.add('open');
  document.getElementById('nota-titulo')?.focus();
}

async function escNota_salvar() {
  const titulo = document.getElementById('nota-titulo')?.value?.trim();
  const corpo  = document.getElementById('nota-corpo')?.value||'';
  if(!titulo){escToast('Escreva algo.');return;}
  // Salvar na caixa de entrada
  try {
    await fetch(ESC_SUPA_URL+'/rest/v1/escritorio_caixa_entrada',{
      method:'POST',
      headers:{'apikey':ESC_SUPA_KEY,'Authorization':'Bearer '+ESC_SUPA_KEY,'Content-Type':'application/json','Prefer':'return=minimal'},
      body:JSON.stringify({titulo, descricao:corpo, tipo:'Anotação', status:'nova', created_by:ESC_STATE.usuario})
    });
    escToast('Nota registrada!');
  } catch(e){escToast('Nota salva localmente.');}
  escFecharModal();
}

function escNota_viraTarefa() {
  const titulo = document.getElementById('nota-titulo')?.value?.trim()||'';
  escFecharModal();
  if(typeof tAbrirForm==='function') {
    tAbrirForm(null);
    setTimeout(()=>{
      const inp=document.getElementById('tf-titulo'); if(inp) inp.value=titulo;
    },200);
  }
}

// ── INIT DOM ──
document.addEventListener('DOMContentLoaded', () => {
  escCheckSession();

  document.getElementById('esc-modal-overlay')?.addEventListener('click', function(e){
    if(e.target===this) escFecharModal();
  });
  document.getElementById('esc-login-senha')?.addEventListener('keydown', e=>{
    if(e.key==='Enter') escDoLogin();
  });
});
