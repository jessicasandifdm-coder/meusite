/* ══════════════════════════════════════════════════
   MÓDULO PORTAL DA EQUIPE — escritorio-interno
   Meu Escritório — visão personalizada por usuário
   ══════════════════════════════════════════════════ */

// ── ESTADO DO USUÁRIO ──
// ESC_STATE.usuario já contém o nome do usuário logado (ex: 'Jéssica' ou 'Amanda')
// ESC_STATE.perfil será 'admin' para Jéssica, 'colaborador' para Amanda
// ESC_STATE.usuario_id será preenchido após lookup na tabela escritorio_usuarios

let _equipeUsuarios = []; // cache da tabela escritorio_usuarios
let _equipeUsuarioAtual = null; // registro completo do usuário logado

// ── CARREGAR USUÁRIO LOGADO ──
async function equipeCarregarUsuario() {
  if (_equipeUsuarioAtual) return _equipeUsuarioAtual;
  try {
    const nome = ESC_STATE?.usuario || 'Jéssica';
    const data = await escGet(`/rest/v1/escritorio_usuarios?nome=eq.${encodeURIComponent(nome)}&limit=1`);
    if (Array.isArray(data) && data[0]) {
      _equipeUsuarioAtual = data[0];
      if (typeof ESC_STATE !== 'undefined') {
        ESC_STATE.perfil = data[0].perfil;
        ESC_STATE.usuario_id = data[0].id;
      }
    }
  } catch(e) { console.error('equipeCarregarUsuario:', e); }
  return _equipeUsuarioAtual;
}

// ── RENDER PRINCIPAL ──
async function escRenderEquipe(el) {
  el.innerHTML = `<div style="color:var(--text3);text-align:center;padding:40px">Carregando seu escritório...</div>`;
  await equipeCarregarUsuario();
  const usuario = _equipeUsuarioAtual;
  const nome    = usuario?.nome || ESC_STATE?.usuario || 'Jéssica';
  const perfil  = usuario?.perfil || 'admin';
  const hoje    = new Date();
  const hojeStr = hoje.toISOString().split('T')[0];
  const hora    = hoje.getHours();
  const saudacao = hora<12 ? 'Bom dia' : hora<18 ? 'Boa tarde' : 'Boa noite';

  // Carregar dados do usuário
  let tarefas=[], reunioes=[], rotinas=[], caixaPendente=[];
  try { tarefas  = await escGet(`/rest/v1/escritorio_tarefas?responsavel_id=eq.${encodeURIComponent(nome)}&status=neq.concluida&order=prazo.asc`); } catch(e) {}
  try { reunioes = await escGet(`/rest/v1/escritorio_reunioes?responsavel_id=eq.${encodeURIComponent(nome)}&status=neq.cancelada&order=data.asc`); } catch(e) {}
  try { rotinas  = await escGet(`/rest/v1/escritorio_rotinas?responsavel_id=eq.${encodeURIComponent(nome)}&ativo=eq.true&order=proxima_execucao.asc`); } catch(e) {}
  try { caixaPendente = await escGet(`/rest/v1/escritorio_caixa_entrada?created_by=eq.${encodeURIComponent(nome)}&status=in.(nova,em_analise)&order=created_at.desc&limit=5`); } catch(e) {}

  const tarefasHoje   = tarefas.filter(t=>t.prazo===hojeStr);
  const tarefasAtras  = tarefas.filter(t=>t.prazo&&t.prazo<hojeStr);
  const tarefasProx   = tarefas.filter(t=>t.prazo&&t.prazo>hojeStr);
  const reunioesHoje  = reunioes.filter(r=>(r.data||'').startsWith(hojeStr));
  const rotinasHoje   = rotinas.filter(r=>r.proxima_execucao===hojeStr);

  const AREA_COR = {'JS Mentoria':'area-js','Moni Sul':'area-moni','Interno':'area-js'};

  el.innerHTML = `
    <!-- Cabeçalho pessoal -->
    <div style="display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:28px">
      <div>
        <div style="font-size:22px;font-weight:700;color:var(--text);margin-bottom:4px">${saudacao}, ${escEsc(nome)}.</div>
        <div style="font-size:13px;color:var(--text3)">${hoje.toLocaleDateString('pt-BR',{weekday:'long',day:'2-digit',month:'long',year:'numeric'})}</div>
        ${usuario?.cargo?`<div style="font-size:12px;color:var(--text3);margin-top:2px">${escEsc(usuario.cargo)}${usuario.area&&usuario.area!=='Geral'?' · '+escEsc(usuario.area):''}</div>`:''}
      </div>
      ${perfil==='admin'?`<div style="display:flex;gap:8px">
        <button class="btn btn-secondary btn-sm" onclick="equipeMudarPerfil()">🔄 Ver como colaborador</button>
        <button class="btn btn-secondary btn-sm" onclick="equipeAbrirGerenciar()">⚙ Gerenciar equipe</button>
      </div>`:''}
    </div>

    <!-- KPIs rápidos -->
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:10px;margin-bottom:24px">
      ${[
        {val:tarefasHoje.length,  lbl:'Tarefas hoje', cor:'accent', click:"equipeSetViewTarefas('hoje')"},
        {val:tarefasAtras.length, lbl:'Atrasadas',     cor:'red',    click:"equipeSetViewTarefas('atrasadas')"},
        {val:rotinasHoje.length,  lbl:'Rotinas hoje',  cor:'green',  click:"equipeScrollTo('equipe-rotinas')"},
        {val:caixaPendente.length,lbl:'Caixa pendente',cor:'amber',  click:"equipeScrollTo('equipe-caixa')"},
      ].map(k=>{
        const CORES={accent:'var(--accent)',red:'var(--red)',green:'var(--green)',amber:'var(--amber)'};
        return `<div class="esc-kpi" style="cursor:pointer;border-color:${CORES[k.cor]}22" onclick="${k.click}">
          <div class="esc-kpi-val" style="color:${CORES[k.cor]};font-size:22px">${k.val}</div>
          <div class="esc-kpi-lbl">${k.lbl}</div>
        </div>`;}).join('')}
    </div>

    <!-- Grid principal -->
    <div class="esc-grid-2" style="gap:16px;margin-bottom:16px">

      <!-- Tarefas -->
      <div class="esc-card">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
          <div class="esc-card-title" style="margin-bottom:0">Minhas tarefas</div>
          <div style="display:flex;gap:4px" id="equipe-tab-tarefas">
            ${['hoje','proximas','atrasadas','concluidas','todas'].map((v,i)=>`
              <button onclick="equipeSetViewTarefas('${v}')"
                class="btn btn-secondary btn-sm" style="font-size:10px;padding:3px 8px" id="equipe-tv-${v}">${
                {hoje:'Hoje',proximas:'Próximas',atrasadas:'Atrasadas',concluidas:'Concluídas',todas:'Todas'}[v]}</button>`).join('')}
          </div>
        </div>
        <div id="equipe-tarefas-lista">
          ${equipeRenderTarefasInline(tarefasHoje, hojeStr, 'hoje')}
        </div>
      </div>

      <!-- Reuniões + Rotinas -->
      <div>
        <!-- Reuniões do dia -->
        <div class="esc-card" style="margin-bottom:12px">
          <div class="esc-card-title">Reuniões (${reunioesHoje.length} hoje)</div>
          ${reunioesHoje.length===0
            ? `<div style="color:var(--text3);font-size:13px">Nenhuma reunião hoje.</div>`
            : reunioesHoje.map(r=>`
              <div class="esc-list-item" onclick="rAbrirDetalhe&&rAbrirDetalhe('${r.id}');escNavegar('reunioes')">
                <div style="font-size:12px;font-weight:700;color:var(--accent);min-width:44px">${r.hora_inicio?.substring(0,5)||'—'}</div>
                <div style="flex:1;font-size:13px;color:var(--text)">${escEsc(r.titulo)}</div>
                ${r.area?`<span class="${AREA_COR[r.area]||'area-js'}">${r.area}</span>`:''}
              </div>`).join('')}
        </div>

        <!-- Rotinas do dia -->
        <div class="esc-card" id="equipe-rotinas">
          <div class="esc-card-title">Rotinas de hoje (${rotinasHoje.length})</div>
          ${rotinasHoje.length===0
            ? `<div style="color:var(--text3);font-size:13px">Nenhuma rotina para hoje.</div>`
            : rotinasHoje.map(r=>`
              <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border)">
                <div>
                  <div style="font-size:13px;color:var(--text)">${escEsc(r.titulo)}</div>
                  <div style="font-size:11px;color:var(--text3)">${r.categoria||''}${r.horario?' · '+r.horario.substring(0,5):''}</div>
                </div>
                <button class="btn btn-secondary btn-sm" style="color:var(--green);border-color:var(--green);font-size:11px"
                  onclick="rotExecutar('${r.id}')">▶ Executar</button>
              </div>`).join('')}
        </div>
      </div>
    </div>

    <!-- Caixa de entrada da Amanda -->
    <div class="esc-card" id="equipe-caixa" style="margin-bottom:16px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
        <div class="esc-card-title" style="margin-bottom:0">Minha Caixa de Entrada</div>
        <button class="btn btn-secondary btn-sm" onclick="equipeCapturaRapida()">+ Registrar</button>
      </div>
      <div style="display:flex;gap:8px;margin-bottom:12px">
        <input id="equipe-ci-input" class="esc-input" placeholder="Registrar ideia, demanda, observação..."
          onkeydown="if(event.key==='Enter')equipeCapturarRapido()" style="flex:1">
        <button class="btn btn-primary btn-sm" onclick="equipeCapturarRapido()">+</button>
      </div>
      ${caixaPendente.length===0
        ? `<div style="color:var(--text3);font-size:13px">Sua caixa está vazia.</div>`
        : caixaPendente.map(c=>`
          <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border)">
            <div>
              <div style="font-size:13px;color:var(--text)">${escEsc(c.titulo)}</div>
              <div style="font-size:11px;color:var(--text3)">${c.tipo||'—'} · ${new Date(c.created_at).toLocaleDateString('pt-BR')}</div>
            </div>
            <span class="badge badge-${c.status==='nova'?'blue':'amber'}">${c.status==='nova'?'Nova':'Em análise'}</span>
          </div>`).join('')}
    </div>

    <!-- Próximas tarefas (resumo) -->
    ${tarefasProx.length?`
      <div class="esc-card">
        <div class="esc-card-title">Próximas tarefas (${tarefasProx.length})</div>
        <div class="esc-list">${tarefasProx.slice(0,5).map(t=>tItemHtml(t,hojeStr)).join('')}</div>
        ${tarefasProx.length>5?`<div style="text-align:center;font-size:12px;color:var(--text3);margin-top:8px">${tarefasProx.length-5} mais → ver em Tarefas</div>`:''}
      </div>`:``}

    <!-- Se é admin: painel de gerenciamento da equipe -->
    ${perfil==='admin'?`<div id="equipe-admin-painel" style="display:none;margin-top:16px"></div>`:''}
  `;

  // Guardar tarefas para o filtro de tabs
  window._equipeTarefas = tarefas;
  window._equipeHojeStr = hojeStr;
  equipeSetViewTarefas('hoje');
}

// ── FILTRO DE TAREFAS ──
function equipeSetViewTarefas(view) {
  const tarefas = window._equipeTarefas||[];
  const hojeStr = window._equipeHojeStr||new Date().toISOString().split('T')[0];
  let lista;
  if      (view==='hoje')       lista=tarefas.filter(t=>t.prazo===hojeStr);
  else if (view==='proximas')   lista=tarefas.filter(t=>t.prazo&&t.prazo>hojeStr);
  else if (view==='atrasadas')  lista=tarefas.filter(t=>t.prazo&&t.prazo<hojeStr);
  else if (view==='concluidas') lista=tarefas.filter(t=>t.status==='concluida');
  else lista=tarefas;

  document.querySelectorAll('[id^="equipe-tv-"]').forEach(b=>{
    b.className='btn btn-sm '+(b.id==='equipe-tv-'+view?'btn-primary':'btn-secondary');
    b.style.fontSize='10px'; b.style.padding='3px 8px';
  });
  const el=document.getElementById('equipe-tarefas-lista');
  if(el) el.innerHTML=equipeRenderTarefasInline(lista,hojeStr,view);
}

function equipeRenderTarefasInline(lista, hojeStr, view) {
  if(!lista||!lista.length) return `<div style="color:var(--text3);font-size:13px;padding:8px 0">${view==='hoje'?'Nenhuma tarefa para hoje.':'Nenhuma tarefa.'}</div>`;
  const PR_BADGE = {baixa:'gray',normal:'gray',alta:'amber',urgente:'red'};
  const ST_BADGE = {a_fazer:'gray',em_andamento:'blue',concluida:'green',pausada:'amber'};
  const ST_LBL   = {a_fazer:'A fazer',em_andamento:'Em andamento',concluida:'Concluída',pausada:'Pausada'};
  return lista.slice(0,8).map(t=>{
    const atrasada=t.prazo&&t.prazo<hojeStr&&t.status!=='concluida';
    return `<div style="padding:8px 0;border-bottom:1px solid var(--border);display:flex;align-items:flex-start;gap:10px">
      <div style="width:3px;height:40px;border-radius:2px;background:${{baixa:'var(--text3)',normal:'var(--accent)',alta:'var(--amber)',urgente:'var(--red)'}[t.prioridade]||'var(--accent)'};flex-shrink:0;margin-top:4px"></div>
      <div style="flex:1;min-width:0">
        <div style="font-size:13px;font-weight:500;color:var(--text);margin-bottom:3px">${escEsc(t.titulo)}</div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">
          <span class="badge badge-${ST_BADGE[t.status]||'gray'}" style="font-size:9px">${ST_LBL[t.status]||t.status}</span>
          ${t.prazo?`<span style="font-size:11px;color:${atrasada?'var(--red)':t.prazo===hojeStr?'var(--accent)':'var(--text3)'}">${t.prazo===hojeStr?'Hoje':t.prazo}</span>`:''}
          ${t.projeto_id?`<span style="font-size:10px;color:var(--text3)">📁 projeto</span>`:''}
        </div>
      </div>
      <div style="display:flex;flex-direction:column;gap:4px;flex-shrink:0">
        ${t.status!=='concluida'?`
          <button onclick="equipeAvancarStatus('${t.id}','${t.status}')" title="Avançar status"
            style="background:none;border:1px solid var(--border);border-radius:4px;color:var(--text3);padding:2px 8px;cursor:pointer;font-size:11px">→</button>
          <button onclick="equipeConcluirTarefa('${t.id}')" title="Concluir"
            style="background:none;border:1px solid var(--border);border-radius:4px;color:var(--green);padding:2px 8px;cursor:pointer;font-size:11px">✓</button>
        `:''}
      </div>
    </div>`;
  }).join('')+(lista.length>8?`<div style="font-size:12px;color:var(--text3);text-align:center;padding:8px">${lista.length-8} mais</div>`:'');
}

// ── AÇÕES RÁPIDAS NAS TAREFAS ──
async function equipeAvancarStatus(id, statusAtual) {
  const proximo = {a_fazer:'em_andamento', em_andamento:'a_fazer', pausada:'em_andamento'}[statusAtual]||'em_andamento';
  try {
    const res = await fetch(ESC_SUPA_URL+'/rest/v1/escritorio_tarefas?id=eq.'+id,{
      method:'PATCH',
      headers:{'apikey':ESC_SUPA_KEY,'Authorization':'Bearer '+ESC_SUPA_KEY,'Content-Type':'application/json','Prefer':'return=representation'},
      body:JSON.stringify({status:proximo, updated_at:new Date().toISOString()})
    });
    const updated = await res.json();
    if(Array.isArray(updated)&&typeof _tarefasCache!=='undefined'){
      const idx=_tarefasCache.findIndex(x=>x.id===id); if(idx>=0)_tarefasCache[idx]=updated[0];
    }
    // Atualizar no cache da equipe também
    if(window._equipeTarefas){const idx=window._equipeTarefas.findIndex(x=>x.id===id);if(idx>=0)window._equipeTarefas[idx]=updated[0]||window._equipeTarefas[idx];}
    escToast('Status atualizado!');
    equipeSetViewTarefas(document.querySelector('[id^="equipe-tv-"].btn-primary')?.id?.replace('equipe-tv-','')||'hoje');
  } catch(e){ escToast('Erro.'); }
}

async function equipeConcluirTarefa(id) {
  const agora = new Date().toISOString();
  try {
    const res = await fetch(ESC_SUPA_URL+'/rest/v1/escritorio_tarefas?id=eq.'+id,{
      method:'PATCH',
      headers:{'apikey':ESC_SUPA_KEY,'Authorization':'Bearer '+ESC_SUPA_KEY,'Content-Type':'application/json','Prefer':'return=representation'},
      body:JSON.stringify({status:'concluida', concluida_em:agora, updated_at:agora})
    });
    const updated = await res.json();
    if(Array.isArray(updated)&&typeof _tarefasCache!=='undefined'){const idx=_tarefasCache.findIndex(x=>x.id===id);if(idx>=0)_tarefasCache[idx]=updated[0];}
    if(window._equipeTarefas){window._equipeTarefas=window._equipeTarefas.filter(x=>x.id!==id);}
    escToast('Tarefa concluída! ✓');
    equipeSetViewTarefas('hoje');
  } catch(e){ escToast('Erro.'); }
}

// ── CAPTURA RÁPIDA CAIXA ──
async function equipeCapturarRapido() {
  const inp = document.getElementById('equipe-ci-input');
  const titulo = inp?.value?.trim();
  if (!titulo) { inp?.focus(); return; }
  const obj = {
    titulo, status:'nova', prioridade:'normal',
    created_by: ESC_STATE?.usuario||'Jéssica',
  };
  try {
    const r = await fetch(ESC_SUPA_URL+'/rest/v1/escritorio_caixa_entrada',{
      method:'POST',
      headers:{'apikey':ESC_SUPA_KEY,'Authorization':'Bearer '+ESC_SUPA_KEY,'Content-Type':'application/json','Prefer':'return=representation'},
      body:JSON.stringify(obj)
    });
    const created = await r.json();
    if(Array.isArray(created)&&typeof _caixa_cache!=='undefined') _caixa_cache.unshift(created[0]);
    inp.value='';
    escToast('Registrado na Caixa de Entrada ✓');
  } catch(e){ escToast('Erro ao registrar.'); }
}

function equipeCapturaRapida() { document.getElementById('equipe-ci-input')?.focus(); }

function equipeScrollTo(id) {
  const el=document.getElementById(id); if(el) el.scrollIntoView({behavior:'smooth',block:'start'});
}

// ── GERENCIAMENTO DE USUÁRIOS (admin) ──
function equipeAbrirGerenciar() {
  document.getElementById('esc-modal-title').textContent = 'Equipe';
  equipeCarregarListaUsuarios().then(usuarios=>{
    document.getElementById('esc-modal-body').innerHTML = `
      <div style="margin-bottom:16px">
        <div style="font-size:13px;color:var(--text2);margin-bottom:14px">Usuários do Escritório Interno.</div>
        <div class="esc-list" style="margin-bottom:16px">
          ${usuarios.map(u=>`
            <div class="esc-list-item">
              <div style="width:32px;height:32px;border-radius:50%;background:var(--accent-dim);display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;color:var(--accent);flex-shrink:0">${(u.nome||'?')[0]}</div>
              <div style="flex:1">
                <div style="font-size:13px;font-weight:500;color:var(--text)">${escEsc(u.nome)}</div>
                <div style="font-size:11px;color:var(--text3)">${escEsc(u.email)} · ${u.cargo||'—'} · <span class="badge badge-${u.perfil==='admin'?'blue':'gray'}">${u.perfil}</span></div>
              </div>
              <span style="font-size:11px;color:${u.ativo?'var(--green)':'var(--red)'}">${u.ativo?'Ativa':'Inativa'}</span>
            </div>`).join('')}
        </div>
        <button class="btn btn-secondary btn-sm" onclick="equipeAbrirFormUsuario()">+ Novo usuário</button>
      </div>
      <div style="display:flex;justify-content:flex-end">
        <button class="btn btn-secondary" onclick="escFecharModal()">Fechar</button>
      </div>`;
  });
  document.getElementById('esc-modal-overlay').classList.add('open');
}

async function equipeCarregarListaUsuarios() {
  try {
    const data = await escGet('/rest/v1/escritorio_usuarios?order=nome.asc');
    _equipeUsuarios = Array.isArray(data)?data:[];
    return _equipeUsuarios;
  } catch(e) { return []; }
}

function equipeAbrirFormUsuario(id) {
  const u = id?_equipeUsuarios.find(x=>x.id===id):null;
  document.getElementById('esc-modal-title').textContent = u?'Editar usuário':'Novo usuário';
  document.getElementById('esc-modal-body').innerHTML = `
    <div class="esc-field">
      <label class="esc-label">Nome <span style="color:var(--red)">*</span></label>
      <input class="esc-input" id="eu-nome" value="${escEsc(u?.nome||'')}" placeholder="Nome completo">
    </div>
    <div class="esc-field">
      <label class="esc-label">E-mail <span style="color:var(--red)">*</span></label>
      <input class="esc-input" id="eu-email" type="email" value="${escEsc(u?.email||'')}" placeholder="email@exemplo.com">
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
      <div class="esc-field">
        <label class="esc-label">Cargo</label>
        <input class="esc-input" id="eu-cargo" value="${escEsc(u?.cargo||'')}" placeholder="Ex: Assistente">
      </div>
      <div class="esc-field">
        <label class="esc-label">Área</label>
        <input class="esc-input" id="eu-area" value="${escEsc(u?.area||'')}" placeholder="Ex: Geral">
      </div>
    </div>
    <div class="esc-field">
      <label class="esc-label">Perfil</label>
      <select class="esc-select" id="eu-perfil">
        <option value="colaborador" ${(u?.perfil||'colaborador')==='colaborador'?'selected':''}>Colaborador</option>
        <option value="admin" ${u?.perfil==='admin'?'selected':''}>Admin</option>
      </select>
    </div>
    <div class="esc-field" style="display:flex;align-items:center;gap:10px">
      <input type="checkbox" id="eu-ativo" ${u===null||u?.ativo?'checked':''} style="width:16px;height:16px;accent-color:var(--accent)">
      <label for="eu-ativo" style="font-size:13px;color:var(--text2);cursor:pointer">Usuário ativo</label>
    </div>
    <div style="display:flex;gap:10px;justify-content:flex-end">
      <button class="btn btn-secondary" onclick="equipeAbrirGerenciar()">Voltar</button>
      <button class="btn btn-primary" onclick="equipeSalvarUsuario(${id?`'${id}'`:'null'})">Salvar</button>
    </div>`;
}

async function equipeSalvarUsuario(id) {
  const nome  = document.getElementById('eu-nome')?.value?.trim();
  const email = document.getElementById('eu-email')?.value?.trim();
  if(!nome)  { escToast('Informe o nome.'); return; }
  if(!email) { escToast('Informe o e-mail.'); return; }
  const obj = {
    nome, email,
    cargo:  document.getElementById('eu-cargo')?.value||null,
    area:   document.getElementById('eu-area')?.value||null,
    perfil: document.getElementById('eu-perfil')?.value||'colaborador',
    ativo:  document.getElementById('eu-ativo')?.checked!==false,
    updated_at: new Date().toISOString(),
  };
  try {
    if (id) {
      await fetch(ESC_SUPA_URL+'/rest/v1/escritorio_usuarios?id=eq.'+id,{
        method:'PATCH', headers:{'apikey':ESC_SUPA_KEY,'Authorization':'Bearer '+ESC_SUPA_KEY,'Content-Type':'application/json','Prefer':'return=minimal'},
        body:JSON.stringify(obj)
      });
    } else {
      await fetch(ESC_SUPA_URL+'/rest/v1/escritorio_usuarios',{
        method:'POST', headers:{'apikey':ESC_SUPA_KEY,'Authorization':'Bearer '+ESC_SUPA_KEY,'Content-Type':'application/json','Prefer':'return=minimal'},
        body:JSON.stringify(obj)
      });
    }
    escToast('Usuário salvo!');
    equipeAbrirGerenciar();
  } catch(e){ escToast('Erro ao salvar.'); }
}

// ── MODO DE VISUALIZAÇÃO (admin pode simular visão de colaborador) ──
let _equipeSimulando = false;
function equipeMudarPerfil() {
  _equipeSimulando = !_equipeSimulando;
  escToast(_equipeSimulando?'Simulando visão de colaborador':'Visão de admin restaurada');
  // Re-render
  if(typeof ESC_STATE!=='undefined') {
    const perfilOriginal = _equipeUsuarioAtual?.perfil||'admin';
    ESC_STATE.perfil = _equipeSimulando?'colaborador':perfilOriginal;
  }
  escRenderEquipe(document.getElementById('esc-content'));
}
