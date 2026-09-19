/* ══════════════════════════════════════════════════
   MÓDULO EQUIPE — escritorio-interno
   Jéssica: visão administrativa da equipe
   Amanda: portal próprio com agenda e tarefas
   ══════════════════════════════════════════════════ */

let _equipeUsuarios     = [];
let _equipeUsuarioAtual = null;
let _equipeSimulando    = false;
let _equipeSimulandoComo = null;

// ── CARREGAR USUÁRIO LOGADO ──
async function equipeCarregarUsuario() {
  if (_equipeUsuarioAtual && !_equipeSimulando) return _equipeUsuarioAtual;
  const nome = _equipeSimulando ? _equipeSimulandoComo : (ESC_STATE?.usuario || 'Jéssica');
  try {
    const data = await escGet(`/rest/v1/escritorio_usuarios?nome=eq.${encodeURIComponent(nome)}&limit=1`);
    if (Array.isArray(data) && data[0]) {
      _equipeUsuarioAtual = data[0];
      if (!_equipeSimulando && typeof ESC_STATE !== 'undefined') {
        ESC_STATE.role       = data[0].role || data[0].perfil || 'admin';
        ESC_STATE.usuario_id = data[0].id;
      }
    }
  } catch(e) { console.error('equipeCarregarUsuario:', e); }
  return _equipeUsuarioAtual;
}

// ── RENDER PRINCIPAL ──
async function escRenderEquipe(el) {
  el.innerHTML = `<div style="color:var(--text3);font-size:13px;text-align:center;padding:40px">Carregando...</div>`;
  await equipeCarregarUsuario();

  const role     = _equipeSimulando ? 'colaborador' : (ESC_STATE?.role || 'admin');
  const isAdmin  = role === 'admin' && !_equipeSimulando;

  // Admin vê painel da equipe; colaborador vê portal próprio
  if (isAdmin) {
    await equipeRenderAdmin(el);
  } else {
    await equipeRenderPortal(el, _equipeSimulando ? _equipeSimulandoComo : ESC_STATE?.usuario);
  }
}

// ── VISÃO ADMIN (Jéssica) ──
async function equipeRenderAdmin(el) {
  // Carregar membros
  let membros = [];
  try { membros = await escGet('/rest/v1/escritorio_usuarios?order=nome.asc'); } catch(e) {}

  // Para cada membro, contar tarefas pendentes
  const statsPromises = membros.map(async m => {
    let tarefas = [], atrasadas = [], hoje_t = [];
    const hojeStr = new Date().toISOString().split('T')[0];
    try {
      tarefas   = await escGet(`/rest/v1/escritorio_tarefas?responsavel_id=eq.${encodeURIComponent(m.nome)}&status=neq.concluida&order=prazo.asc&limit=20`);
      atrasadas = tarefas.filter(t => t.prazo && t.prazo < hojeStr);
      hoje_t    = tarefas.filter(t => t.prazo === hojeStr);
    } catch(e) {}
    return { ...m, tarefas, atrasadas, hoje_t };
  });
  const membrosComStats = await Promise.all(statsPromises);

  el.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:24px;flex-wrap:wrap;gap:12px">
      <div>
        <div style="font-size:18px;font-weight:700;color:var(--text)">Equipe</div>
        <div style="font-size:12px;color:var(--text3);margin-top:2px">Visão administrativa — o que cada pessoa tem em andamento</div>
      </div>
      <div style="display:flex;gap:8px">
        <button class="btn btn-secondary btn-sm" onclick="equipeAbrirGerenciar()">Gerenciar usuários</button>
        <button class="btn btn-secondary btn-sm" onclick="equipeSimular('Amanda')" title="Ver como Amanda">
          <svg style="width:13px;height:13px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
          Ver como Amanda
        </button>
      </div>
    </div>

    ${membrosComStats.map(m => `
      <div class="esc-card" style="margin-bottom:14px">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;flex-wrap:wrap;gap:8px">
          <div style="display:flex;align-items:center;gap:10px">
            <div style="width:36px;height:36px;border-radius:50%;background:var(--accent-dim);border:1px solid var(--accent-border);display:flex;align-items:center;justify-content:center;font-size:15px;font-weight:700;color:var(--accent);flex-shrink:0">
              ${(m.nome||'?')[0].toUpperCase()}
            </div>
            <div>
              <div style="font-size:14px;font-weight:600;color:var(--text)">${escEsc(m.nome)}</div>
              <div style="font-size:11px;color:var(--text3)">${escEsc(m.cargo||'')}${m.role==='admin'?' · Admin':' · Colaborador'}</div>
            </div>
          </div>
          <div style="display:flex;gap:16px;font-size:12px">
            <div style="text-align:center">
              <div style="font-size:18px;font-weight:700;color:var(--text)">${m.tarefas.length}</div>
              <div style="color:var(--text3)">Pendentes</div>
            </div>
            <div style="text-align:center">
              <div style="font-size:18px;font-weight:700;color:${m.hoje_t.length?'var(--accent)':'var(--text3)'}">${m.hoje_t.length}</div>
              <div style="color:var(--text3)">Hoje</div>
            </div>
            <div style="text-align:center">
              <div style="font-size:18px;font-weight:700;color:${m.atrasadas.length?'var(--red)':'var(--text3)'}">${m.atrasadas.length}</div>
              <div style="color:var(--text3)">Atrasadas</div>
            </div>
          </div>
        </div>

        ${m.tarefas.length === 0
          ? `<div style="font-size:13px;color:var(--text3);padding:4px 0">Nenhuma tarefa pendente.</div>`
          : `<div style="display:flex;flex-direction:column;gap:2px">
              ${m.tarefas.slice(0,5).map(t => {
                const hojeStr = new Date().toISOString().split('T')[0];
                const atrasada = t.prazo && t.prazo < hojeStr;
                const hoje_t   = t.prazo === hojeStr;
                const PRIO_COR = {urgente:'var(--red)',alta:'var(--amber)',normal:'var(--accent)',baixa:'var(--border2)'};
                return `<div style="display:flex;align-items:center;gap:10px;padding:7px 8px;border-radius:6px;background:var(--bg)">
                  <div style="width:3px;height:26px;border-radius:2px;background:${PRIO_COR[t.prioridade]||'var(--accent)'};flex-shrink:0"></div>
                  <div style="flex:1;font-size:13px;color:var(--text2)">${escEsc(t.titulo)}</div>
                  ${atrasada?`<span class="badge badge-red" style="font-size:9px">Atrasada</span>`:
                    hoje_t?`<span class="badge badge-blue" style="font-size:9px">Hoje</span>`:
                    t.prazo?`<span style="font-size:11px;color:var(--text3)">${t.prazo.substring(5).replace('-','/')}</span>`:''}
                </div>`;
              }).join('')}
              ${m.tarefas.length>5?`<div style="font-size:12px;color:var(--text3);padding:6px 8px">+${m.tarefas.length-5} mais tarefas</div>`:''}
            </div>`}

        <div style="margin-top:12px;display:flex;gap:8px">
          <button class="btn btn-secondary btn-sm" onclick="equipeAtribuirTarefa('${escEsc(m.nome)}')">+ Atribuir tarefa</button>
          ${m.nome !== ESC_STATE?.usuario ? `<button class="btn btn-secondary btn-sm" onclick="equipeSimular('${escEsc(m.nome)}')">Ver portal →</button>` : ''}
        </div>
      </div>`).join('')}
  `;
}

// ── PORTAL PRÓPRIO (Amanda ou simulação) ──
async function equipeRenderPortal(el, nomeUsuario) {
  const hoje      = new Date();
  const hojeStr   = hoje.toISOString().split('T')[0];
  const hora      = hoje.getHours();
  const saudacao  = hora<12?'Bom dia':hora<18?'Boa tarde':'Boa noite';
  const dateLabel = hoje.toLocaleDateString('pt-BR',{weekday:'long',day:'numeric',month:'long'});
  const isSimulando = _equipeSimulando;

  let tarefas=[], reunioes=[], rotinas=[];
  try { tarefas  = await escGet(`/rest/v1/escritorio_tarefas?responsavel_id=eq.${encodeURIComponent(nomeUsuario)}&status=neq.concluida&order=prazo.asc`); } catch(e) {}
  try { reunioes = await escGet(`/rest/v1/escritorio_reunioes?status=neq.cancelada&order=data.asc`); } catch(e) {}
  try { rotinas  = await escGet(`/rest/v1/escritorio_rotinas?responsavel_id=eq.${encodeURIComponent(nomeUsuario)}&ativo=eq.true&order=proxima_execucao.asc`); } catch(e) {}

  // Participações em reuniões (via reuniao_participantes)
  let minhasReunioes = reunioes.filter(r =>
    r.responsavel_id === nomeUsuario ||
    r.titulo?.toLowerCase().includes(nomeUsuario.toLowerCase())
  );
  const tarefasHoje  = tarefas.filter(t => t.prazo === hojeStr);
  const tarefasAtras = tarefas.filter(t => t.prazo && t.prazo < hojeStr);
  const rodinasHoje  = rotinas.filter(r => r.proxima_execucao === hojeStr);
  const reunioesHoje = minhasReunioes.filter(r => (r.data||'').startsWith(hojeStr));

  // Próximos 7 dias
  const em7 = new Date(hoje); em7.setDate(em7.getDate()+7);
  const proximas7 = tarefas.filter(t => t.prazo && t.prazo > hojeStr && t.prazo <= em7.toISOString().split('T')[0]);

  el.innerHTML = `
    ${isSimulando ? `
      <div style="background:var(--amber-dim);border:1px solid rgba(240,184,74,.3);border-radius:8px;padding:10px 14px;margin-bottom:20px;display:flex;align-items:center;justify-content:space-between;font-size:12px">
        <span style="color:var(--amber)">Você está visualizando o portal de <b>${escEsc(nomeUsuario)}</b> como administrador</span>
        <button class="btn btn-secondary btn-xs" onclick="equipePararSimulacao()">Sair da prévia</button>
      </div>`:``}

    <!-- Cabeçalho pessoal -->
    <div style="margin-bottom:28px">
      <div style="font-size:20px;font-weight:700;color:var(--text);margin-bottom:2px">${saudacao}, ${escEsc(nomeUsuario.split(' ')[0])}.</div>
      <div style="font-size:13px;color:var(--text3)">${dateLabel}</div>
    </div>

    <!-- Captura rápida -->
    <div style="background:var(--card);border:1px solid var(--accent-border);border-radius:10px;padding:14px 16px;margin-bottom:24px">
      <div style="font-size:11px;color:var(--text3);margin-bottom:8px;font-weight:600;letter-spacing:.06em;text-transform:uppercase">Registrar algo</div>
      <div style="display:flex;gap:8px">
        <input id="equipe-ci-input" class="esc-input" placeholder="O que precisa ser feito ou registrado?"
          onkeydown="if(event.key==='Enter')equipeCapturarRapido('${escEsc(nomeUsuario)}')" style="flex:1">
        <button class="btn btn-primary btn-sm" onclick="equipeCapturarRapido('${escEsc(nomeUsuario)}')">+ Adicionar</button>
      </div>
      <div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap">
        <button class="btn btn-secondary btn-xs" onclick="equipeNovaTarefa('${escEsc(nomeUsuario)}')">Nova tarefa</button>
        <button class="btn btn-secondary btn-xs" onclick="equipeNotificarJessica('${escEsc(nomeUsuario)}')">Notificar Jéssica</button>
      </div>
    </div>

    <!-- Grid: esquerda tarefas, direita agenda/rotinas -->
    <div style="display:grid;grid-template-columns:1.3fr 1fr;gap:20px;align-items:start">

      <!-- COLUNA ESQUERDA: Tarefas -->
      <div>
        ${tarefasAtras.length ? `
          <div style="margin-bottom:20px">
            <div style="font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--red);margin-bottom:8px">Atrasado</div>
            ${tarefasAtras.map(t => equipeTarefaRow(t, hojeStr)).join('')}
          </div>` : ''}

        <div style="margin-bottom:20px">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
            <div style="font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--text3)">Hoje</div>
            <button class="btn btn-ghost btn-xs" onclick="equipeNovaTarefa('${escEsc(nomeUsuario)}','${hojeStr}')">+ tarefa</button>
          </div>
          ${tarefasHoje.length
            ? tarefasHoje.map(t => equipeTarefaRow(t, hojeStr)).join('')
            : `<div style="font-size:13px;color:var(--text3);padding:6px 8px">Sem tarefas para hoje.</div>`}
        </div>

        ${proximas7.length ? `
          <div>
            <div style="font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--text3);margin-bottom:8px">Próximos dias</div>
            ${proximas7.map(t => equipeTarefaRow(t, hojeStr)).join('')}
          </div>` : ''}

        <!-- Todas as tarefas pendentes -->
        ${tarefas.length > tarefasHoje.length + tarefasAtras.length + proximas7.length ? `
          <div style="margin-top:20px">
            <div style="font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--text3);margin-bottom:8px">Sem data definida</div>
            ${tarefas.filter(t=>!t.prazo).map(t => equipeTarefaRow(t, hojeStr)).join('')}
          </div>` : ''}
      </div>

      <!-- COLUNA DIREITA: Agenda + Reuniões + Rotinas -->
      <div>
        <!-- Agenda de hoje -->
        <div class="esc-card" style="margin-bottom:12px">
          <div style="font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--text3);margin-bottom:12px">Agenda de hoje</div>
          ${reunioesHoje.length === 0 && rodinasHoje.length === 0
            ? `<div style="font-size:13px;color:var(--text3)">Agenda livre.</div>`
            : `
              ${reunioesHoje.map(r=>`
                <div style="display:flex;align-items:center;gap:10px;padding:7px 0;border-bottom:1px solid var(--border)">
                  <div style="font-size:12px;font-weight:600;color:var(--accent);font-family:var(--mono);min-width:40px">${r.hora_inicio?.substring(0,5)||'—'}</div>
                  <div style="flex:1;font-size:13px;color:var(--text)">${escEsc(r.titulo)}</div>
                  <span class="badge badge-blue" style="font-size:9px">Reunião</span>
                </div>`).join('')}
              ${rodinasHoje.map(r=>`
                <div style="display:flex;align-items:center;gap:10px;padding:7px 0;border-bottom:1px solid var(--border)">
                  <div style="font-size:12px;font-weight:600;color:var(--text3);font-family:var(--mono);min-width:40px">${r.horario?.substring(0,5)||'—'}</div>
                  <div style="flex:1;font-size:13px;color:var(--text2)">${escEsc(r.titulo)}</div>
                  <span class="badge badge-gray" style="font-size:9px">Rotina</span>
                </div>`).join('')}`}
        </div>

        <!-- Mini calendário semanal -->
        <div class="esc-card">
          <div style="font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--text3);margin-bottom:12px">Esta semana</div>
          ${equipeMiniSemana(tarefas, minhasReunioes, nomeUsuario)}
        </div>
      </div>
    </div>
  `;
}

// ── MINI CALENDÁRIO SEMANAL ──
function equipeMiniSemana(tarefas, reunioes, nomeUsuario) {
  const hoje = new Date();
  const diasSemana = [];
  const domingoDaSemana = new Date(hoje);
  domingoDaSemana.setDate(hoje.getDate() - hoje.getDay());

  for (let i=1; i<=7; i++) { // seg a dom
    const d = new Date(domingoDaSemana);
    d.setDate(domingoDaSemana.getDate() + i);
    diasSemana.push(d);
  }

  const DIAS_LABEL = ['Seg','Ter','Qua','Qui','Sex','Sáb','Dom'];
  const hojeStr = hoje.toISOString().split('T')[0];

  return `<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px">
    ${diasSemana.map((d, idx) => {
      const ds = d.toISOString().split('T')[0];
      const isHoje = ds === hojeStr;
      const tDia = tarefas.filter(t => t.prazo === ds);
      const rDia = reunioes.filter(r => (r.data||'').startsWith(ds));
      const total = tDia.length + rDia.length;
      return `
        <div style="text-align:center;cursor:pointer" onclick="equipeVerDia('${ds}','${escEsc(nomeUsuario)}')">
          <div style="font-size:9px;color:var(--text3);margin-bottom:4px;font-weight:600">${DIAS_LABEL[idx]}</div>
          <div style="width:28px;height:28px;border-radius:50%;margin:0 auto;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:${isHoje?700:400};
            background:${isHoje?'var(--accent)':'transparent'};color:${isHoje?'#fff':'var(--text2)'};border:${isHoje?'none':'1px solid var(--border)'}">${d.getDate()}</div>
          ${total > 0 ? `<div style="margin-top:4px;display:flex;justify-content:center;gap:2px">
            ${tDia.length?`<div style="width:5px;height:5px;border-radius:50%;background:var(--accent)"></div>`:''}
            ${rDia.length?`<div style="width:5px;height:5px;border-radius:50%;background:var(--amber)"></div>`:''}
          </div>` : '<div style="margin-top:4px;height:9px"></div>'}
        </div>`;
    }).join('')}
  </div>`;
}

function equipeVerDia(ds, nomeUsuario) {
  // Abre modal com o dia completo
  const d = new Date(ds+'T12:00:00');
  const label = d.toLocaleDateString('pt-BR',{weekday:'long',day:'2-digit',month:'long'});
  document.getElementById('esc-modal-title').textContent = label;
  document.getElementById('esc-modal-body').innerHTML = `
    <div style="color:var(--text3);font-size:13px;text-align:center;padding:20px">Carregando dia...</div>`;
  document.getElementById('esc-modal-overlay').classList.add('open');

  Promise.all([
    escGet(`/rest/v1/escritorio_tarefas?responsavel_id=eq.${encodeURIComponent(nomeUsuario)}&prazo=eq.${ds}`).catch(()=>[]),
    escGet(`/rest/v1/escritorio_reunioes?data=eq.${ds}&status=neq.cancelada`).catch(()=>[]),
  ]).then(([tarefas, reunioes]) => {
    const hojeStr = new Date().toISOString().split('T')[0];
    document.getElementById('esc-modal-body').innerHTML = `
      <div style="margin-bottom:16px">
        <div style="font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--text3);margin-bottom:8px">Tarefas</div>
        ${tarefas.length
          ? tarefas.map(t => equipeTarefaRow(t, hojeStr)).join('')
          : `<div style="font-size:13px;color:var(--text3)">Nenhuma tarefa.</div>`}
      </div>
      <div>
        <div style="font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--text3);margin-bottom:8px">Reuniões</div>
        ${reunioes.length
          ? reunioes.map(r=>`<div style="padding:8px 0;border-bottom:1px solid var(--border);font-size:13px;color:var(--text)">${r.hora_inicio?.substring(0,5)||'—'} — ${escEsc(r.titulo)}</div>`).join('')
          : `<div style="font-size:13px;color:var(--text3)">Nenhuma reunião.</div>`}
      </div>
      <div style="margin-top:16px;display:flex;gap:8px;justify-content:space-between">
        <button class="btn btn-secondary btn-sm" onclick="equipeNovaTarefa('${escEsc(nomeUsuario)}','${ds}')">+ Tarefa neste dia</button>
        <button class="btn btn-secondary btn-sm" onclick="escFecharModal()">Fechar</button>
      </div>`;
  });
}

// ── LINHA DE TAREFA ──
function equipeTarefaRow(t, hojeStr) {
  const atrasada = t.prazo && t.prazo < hojeStr && t.status !== 'concluida';
  const hoje_t   = t.prazo === hojeStr;
  const done     = t.status === 'concluida';
  const PRIO_COR = {urgente:'var(--red)',alta:'var(--amber)',normal:'var(--accent)',baixa:'var(--border2)'};
  const ST_NEXT  = {a_fazer:'em_andamento',em_andamento:'concluida',pausada:'em_andamento'};
  const ST_LBL   = {a_fazer:'A fazer',em_andamento:'Em andamento',concluida:'Concluída',pausada:'Pausada'};
  const ST_COR   = {a_fazer:'gray',em_andamento:'blue',concluida:'green',pausada:'amber'};
  return `
    <div style="display:flex;align-items:center;gap:8px;padding:7px 8px;border-radius:6px;margin-bottom:2px;${done?'opacity:.55':''}">
      <div style="width:3px;height:28px;border-radius:2px;background:${PRIO_COR[t.prioridade]||'var(--accent)'};flex-shrink:0"></div>
      <!-- Checkbox -->
      <div onclick="equipeConcluirTarefa('${t.id}',this)"
        style="width:16px;height:16px;border-radius:4px;border:1.5px solid ${done?'var(--green)':'var(--border2)'};background:${done?'var(--green)':'transparent'};flex-shrink:0;cursor:pointer;display:flex;align-items:center;justify-content:center">
        ${done?'<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width:10px;height:10px"><polyline points="20 6 9 17 4 12"/></svg>':''}
      </div>
      <div style="flex:1;min-width:0">
        <div style="font-size:13px;color:${done?'var(--text3)':'var(--text)'};${done?'text-decoration:line-through':''};white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escEsc(t.titulo)}</div>
        <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-top:2px">
          <span class="badge badge-${ST_COR[t.status]||'gray'}" style="font-size:9px">${ST_LBL[t.status]||t.status}</span>
          ${t.projeto_id?`<span style="font-size:10px;color:var(--text3)">projeto</span>`:''}
        </div>
      </div>
      ${atrasada?`<span class="badge badge-red" style="font-size:9px;flex-shrink:0">Atrasada</span>`:
        hoje_t&&!done?`<span class="badge badge-blue" style="font-size:9px;flex-shrink:0">Hoje</span>`:
        t.prazo&&!done?`<span style="font-size:10px;color:var(--text3);flex-shrink:0">${t.prazo.substring(5).replace('-','/')}</span>`:''}
      ${!done?`<button onclick="equipeAvancarStatus('${t.id}','${t.status}',this)" title="Avançar status"
        style="background:none;border:1px solid var(--border);border-radius:4px;color:var(--text3);padding:2px 7px;cursor:pointer;font-size:11px;flex-shrink:0">→</button>`:''}
    </div>`;
}

// ── AÇÕES NAS TAREFAS ──
async function equipeConcluirTarefa(id, el) {
  const box = el;
  box.style.background = 'var(--green)'; box.style.borderColor = 'var(--green)';
  box.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width:10px;height:10px"><polyline points="20 6 9 17 4 12"/></svg>';
  const row = box.closest('div[style*="display:flex"]');
  if(row) { row.style.opacity='.55'; const title=row.querySelector('div[style*="font-size:13px"]'); if(title){title.style.textDecoration='line-through';title.style.color='var(--text3)';} }
  try {
    await escPatch('escritorio_tarefas', id, {status:'concluida', concluida_em:new Date().toISOString()});
    if(typeof _tarefasCache!=='undefined'){const idx=_tarefasCache.findIndex(x=>x.id===id);if(idx>=0)_tarefasCache[idx].status='concluida';}
    escToast('Tarefa concluída!');
  } catch(e) { escToast('Erro ao concluir.'); }
}

async function equipeAvancarStatus(id, statusAtual, el) {
  const proximo = {a_fazer:'em_andamento',em_andamento:'a_fazer',pausada:'em_andamento'}[statusAtual]||'em_andamento';
  const ST_LBL  = {a_fazer:'A fazer',em_andamento:'Em andamento',concluida:'Concluída',pausada:'Pausada'};
  try {
    await escPatch('escritorio_tarefas', id, {status:proximo});
    escToast('Status: '+ST_LBL[proximo]);
    // Re-render mínimo: atualizar badge
    const row = el.closest('div[style*="display:flex"]');
    const badge = row?.querySelector('.badge');
    if(badge) { badge.textContent = ST_LBL[proximo]; }
  } catch(e) { escToast('Erro.'); }
}

// ── NOVA TAREFA (com opção de data) ──
function equipeNovaTarefa(nomeUsuario, dataPreenchida) {
  document.getElementById('esc-modal-title').textContent = 'Nova tarefa';
  document.getElementById('esc-modal-body').innerHTML = `
    <div class="esc-field"><label class="esc-label">O que precisa ser feito? *</label>
      <input class="esc-input" id="et-titulo" placeholder="Título da tarefa">
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
      <div class="esc-field"><label class="esc-label">Data</label>
        <input class="esc-input" type="date" id="et-prazo" value="${dataPreenchida||''}">
      </div>
      <div class="esc-field"><label class="esc-label">Horário (opcional)</label>
        <input class="esc-input" type="time" id="et-hora">
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
      <div class="esc-field"><label class="esc-label">Prioridade</label>
        <select class="esc-select" id="et-prio">
          <option value="normal" selected>Normal</option>
          <option value="alta">Alta</option>
          <option value="urgente">Urgente</option>
          <option value="baixa">Baixa</option>
        </select>
      </div>
      <div class="esc-field"><label class="esc-label">Status inicial</label>
        <select class="esc-select" id="et-status">
          <option value="a_fazer" selected>A fazer</option>
          <option value="em_andamento">Em andamento</option>
        </select>
      </div>
    </div>
    <div class="esc-field"><label class="esc-label">Descrição</label>
      <textarea class="esc-textarea" id="et-desc" rows="2" placeholder="Detalhes ou contexto..."></textarea>
    </div>
    <div class="esc-field"><label class="esc-label">Vincular a projeto (opcional)</label>
      <select class="esc-select" id="et-projeto">
        <option value="">Nenhum</option>
        ${(_projetosCache||[]).filter(p=>!['cancelado','concluido'].includes(p.status)).map(p=>`<option value="${p.id}">${escEsc(p.nome)}</option>`).join('')}
      </select>
    </div>
    <div style="display:flex;gap:10px;justify-content:flex-end">
      <button class="btn btn-secondary" onclick="escFecharModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="equipeSalvarTarefa('${escEsc(nomeUsuario)}')">Criar tarefa</button>
    </div>`;
  document.getElementById('esc-modal-overlay').classList.add('open');
  document.getElementById('et-titulo')?.focus();
}

async function equipeSalvarTarefa(nomeUsuario) {
  const titulo = document.getElementById('et-titulo')?.value?.trim();
  if (!titulo) { escToast('Informe o título.'); return; }
  const prazo  = document.getElementById('et-prazo')?.value||null;
  const hora   = document.getElementById('et-hora')?.value||null;
  const obj = {
    titulo,
    responsavel_id: nomeUsuario,
    prioridade:    document.getElementById('et-prio')?.value||'normal',
    status:        document.getElementById('et-status')?.value||'a_fazer',
    prazo,
    descricao:     document.getElementById('et-desc')?.value||null,
    projeto_id:    document.getElementById('et-projeto')?.value||null,
    area:          'JS Mentoria',
    origem_tipo:   'manual',
    created_by:    ESC_STATE?.usuario||'Jéssica',
    criado_por:    ESC_STATE?.usuario||'Jéssica',
  };
  try {
    const r = await fetch(ESC_SUPA_URL+'/rest/v1/escritorio_tarefas',{
      method:'POST',
      headers:{'apikey':ESC_SUPA_KEY,'Authorization':'Bearer '+ESC_SUPA_KEY,'Content-Type':'application/json','Prefer':'return=representation'},
      body:JSON.stringify(obj)
    });
    const created = await r.json();
    if(Array.isArray(created) && typeof _tarefasCache!=='undefined') _tarefasCache.unshift(created[0]);
    // Notificar se criou para outro usuário
    const criador = ESC_STATE?.usuario||'Jéssica';
    if (nomeUsuario !== criador && typeof notifCriar==='function') {
      await notifCriar(nomeUsuario,'tarefa_atribuida',`Nova tarefa: "${titulo}"`,
        `${criador} atribuiu uma tarefa a você${prazo?' para '+prazo:''}.`,'tarefas',created[0]?.id);
    }
    escToast('Tarefa criada!');
    escFecharModal();
    escRenderEquipe(document.getElementById('esc-content'));
  } catch(e) { escToast('Erro ao criar tarefa.'); console.error(e); }
}

// ── CAPTURA RÁPIDA ──
async function equipeCapturarRapido(nomeUsuario) {
  const inp = document.getElementById('equipe-ci-input');
  const titulo = inp?.value?.trim();
  if (!titulo) { inp?.focus(); return; }
  const obj = {
    titulo, status:'nova', prioridade:'normal',
    created_by: nomeUsuario,
  };
  try {
    await fetch(ESC_SUPA_URL+'/rest/v1/escritorio_caixa_entrada',{
      method:'POST',
      headers:{'apikey':ESC_SUPA_KEY,'Authorization':'Bearer '+ESC_SUPA_KEY,'Content-Type':'application/json','Prefer':'return=minimal'},
      body:JSON.stringify(obj)
    });
    inp.value='';
    escToast('Registrado! Transforme em tarefa quando quiser.');
  } catch(e){ escToast('Registrado localmente.'); inp.value=''; }
}

// ── NOTIFICAR JÉSSICA ──
function equipeNotificarJessica(nomeRemetente) {
  document.getElementById('esc-modal-title').textContent = 'Notificar Jéssica';
  document.getElementById('esc-modal-body').innerHTML = `
    <div style="font-size:13px;color:var(--text2);margin-bottom:14px">
      A notificação aparecerá no sino da Jéssica. Ela decide o que fazer com a informação.
    </div>
    <div class="esc-field"><label class="esc-label">Assunto *</label>
      <input class="esc-input" id="notif-titulo" placeholder="Ex: Preciso de aprovação em X">
    </div>
    <div class="esc-field"><label class="esc-label">Mensagem</label>
      <textarea class="esc-textarea" id="notif-msg" rows="3" placeholder="Detalhes..."></textarea>
    </div>
    <div style="display:flex;gap:10px;justify-content:flex-end">
      <button class="btn btn-secondary" onclick="escFecharModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="equipeEnviarNotif('${escEsc(nomeRemetente)}','Jéssica')">Enviar notificação</button>
    </div>`;
  document.getElementById('esc-modal-overlay').classList.add('open');
  document.getElementById('notif-titulo')?.focus();
}

async function equipeEnviarNotif(remetente, destinatario) {
  const titulo = document.getElementById('notif-titulo')?.value?.trim();
  const msg    = document.getElementById('notif-msg')?.value||'';
  if (!titulo) { escToast('Informe o assunto.'); return; }
  if (typeof notifCriar === 'function') {
    await notifCriar(destinatario,'compartilhamento',`${remetente}: ${titulo}`,msg,'',null);
    escToast('Notificação enviada!');
    escFecharModal();
  } else { escToast('Módulo de notificações não carregado.'); }
}

// ── ATRIBUIR TAREFA (Admin → Amanda) ──
function equipeAtribuirTarefa(nomeUsuario) {
  equipeNovaTarefa(nomeUsuario);
}

// ── SIMULAÇÃO (Admin vê portal de outro) ──
function equipeSimular(nome) {
  _equipeSimulando    = true;
  _equipeSimulandoComo = nome;
  _equipeUsuarioAtual  = null;
  escRenderEquipe(document.getElementById('esc-content'));
}
function equipePararSimulacao() {
  _equipeSimulando    = false;
  _equipeSimulandoComo = null;
  _equipeUsuarioAtual  = null;
  escRenderEquipe(document.getElementById('esc-content'));
}

// ── GERENCIAR USUÁRIOS ──
async function equipeAbrirGerenciar() {
  const usuarios = await equipeCarregarListaUsuarios();
  document.getElementById('esc-modal-title').textContent = 'Usuários';
  document.getElementById('esc-modal-body').innerHTML = `
    <div class="esc-list" style="margin-bottom:16px">
      ${usuarios.map(u=>`
        <div class="esc-list-item">
          <div style="width:30px;height:30px;border-radius:50%;background:var(--accent-dim);border:1px solid var(--accent-border);display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;color:var(--accent);flex-shrink:0">${(u.nome||'?')[0]}</div>
          <div style="flex:1"><div style="font-size:13px;font-weight:500">${escEsc(u.nome)}</div><div style="font-size:11px;color:var(--text3)">${escEsc(u.email)}${u.cargo?' · '+u.cargo:''}</div></div>
          <div style="display:flex;align-items:center;gap:6px">
            <span class="badge badge-${u.role==='admin'?'blue':'gray'}">${u.role==='admin'?'Admin':'Equipe'}</span>
            <span style="font-size:11px;color:${u.ativo?'var(--green)':'var(--red)'}">${u.ativo?'Ativo':'Inativo'}</span>
          </div>
        </div>`).join('')}
    </div>
    <div style="display:flex;gap:10px;justify-content:space-between">
      <button class="btn btn-secondary btn-sm" onclick="equipeAbrirFormUsuario()">+ Novo usuário</button>
      <button class="btn btn-secondary" onclick="escFecharModal()">Fechar</button>
    </div>`;
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
    <div class="esc-field"><label class="esc-label">Nome *</label><input class="esc-input" id="eu-nome" value="${escEsc(u?.nome||'')}"></div>
    <div class="esc-field"><label class="esc-label">E-mail *</label><input class="esc-input" type="email" id="eu-email" value="${escEsc(u?.email||'')}"></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
      <div class="esc-field"><label class="esc-label">Cargo</label><input class="esc-input" id="eu-cargo" value="${escEsc(u?.cargo||'')}"></div>
      <div class="esc-field"><label class="esc-label">Perfil</label>
        <select class="esc-select" id="eu-role">
          <option value="colaborador" ${u?.role!=='admin'?'selected':''}>Colaborador</option>
          <option value="admin" ${u?.role==='admin'?'selected':''}>Admin</option>
        </select>
      </div>
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
  if(!nome||!email){escToast('Preencha nome e e-mail.');return;}
  const obj={nome,email,cargo:document.getElementById('eu-cargo')?.value||null,role:document.getElementById('eu-role')?.value||'colaborador',perfil:document.getElementById('eu-role')?.value==='admin'?'admin':'colaborador',ativo:document.getElementById('eu-ativo')?.checked!==false,updated_at:new Date().toISOString()};
  try{
    if(id){await fetch(ESC_SUPA_URL+'/rest/v1/escritorio_usuarios?id=eq.'+id,{method:'PATCH',headers:{'apikey':ESC_SUPA_KEY,'Authorization':'Bearer '+ESC_SUPA_KEY,'Content-Type':'application/json','Prefer':'return=minimal'},body:JSON.stringify(obj)});}
    else{await fetch(ESC_SUPA_URL+'/rest/v1/escritorio_usuarios',{method:'POST',headers:{'apikey':ESC_SUPA_KEY,'Authorization':'Bearer '+ESC_SUPA_KEY,'Content-Type':'application/json','Prefer':'return=minimal'},body:JSON.stringify(obj)});}
    escToast('Salvo!');equipeAbrirGerenciar();
  }catch(e){escToast('Erro ao salvar.');}
}
