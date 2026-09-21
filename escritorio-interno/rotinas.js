/* ══════════════════════════════════════════════════
   MÓDULO ROTINAS — escritorio-interno
   Rotina → Execução → eventualmente Tarefa
   ══════════════════════════════════════════════════ */

const ROT_FREQ = {
  diaria:        { label:'Diária',       emoji:'🔄' },
  semanal:       { label:'Semanal',      emoji:'📅' },
  quinzenal:     { label:'Quinzenal',    emoji:'📅' },
  mensal:        { label:'Mensal',       emoji:'📆' },
  trimestral:    { label:'Trimestral',   emoji:'🗓' },
  anual:         { label:'Anual',        emoji:'📅' },
  personalizada: { label:'Personalizada',emoji:'⚙' },
};
const ROT_DIAS_SEM = [
  {val:'dom',label:'Dom'},{val:'seg',label:'Seg'},{val:'ter',label:'Ter'},
  {val:'qua',label:'Qua'},{val:'qui',label:'Qui'},{val:'sex',label:'Sex'},{val:'sab',label:'Sáb'}
];
const ROT_CATEGORIAS = ['Comercial','Conteúdo','Financeiro','Planejamento','Atendimento','Marketing','Gestão','Operacional','Pessoas','Estratégico','Outro'];
const ROT_AREAS      = ['JS Mentoria','Moni Sul','Interno'];
const ROT_RESP       = ['Jéssica','Amanda'];
const ROT_STATUS_EXEC = { concluida:'green', parcial:'amber', nao_realizada:'red' };
const ROT_MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

let _rotCache   = [];
let _rotFiltros = { area:'', categoria:'', frequencia:'', status:'ativa' };
let _rotEditId  = null;
let _rotDetalheId = null;

// ── RENDER PRINCIPAL ──
async function escRenderRotinas(el) {
  el.innerHTML = `
    <div style="margin-bottom:20px">
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:6px">
        <div>
          <h2 style="font-size:18px;font-weight:700;color:var(--text)">Rotinas</h2>
          <div style="font-size:12px;color:var(--text3)">Atividades recorrentes que mantêm o negócio em ordem.</div>
        </div>
        <button class="btn btn-primary" onclick="rotAbrirForm()">+ Nova rotina</button>
      </div>
    </div>

    <!-- Filtros -->
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px">
      <select class="esc-select" style="width:auto;min-width:130px" onchange="rotSetFiltro('area',this.value)">
        <option value="">Todas as áreas</option>
        ${ROT_AREAS.map(a=>`<option value="${a}">${a}</option>`).join('')}
      </select>
      <select class="esc-select" style="width:auto;min-width:130px" onchange="rotSetFiltro('categoria',this.value)">
        <option value="">Todas as categorias</option>
        ${ROT_CATEGORIAS.map(c=>`<option value="${c}">${c}</option>`).join('')}
      </select>
      <select class="esc-select" style="width:auto;min-width:120px" onchange="rotSetFiltro('frequencia',this.value)">
        <option value="">Todas as frequências</option>
        ${Object.entries(ROT_FREQ).map(([k,v])=>`<option value="${k}">${v.label}</option>`).join('')}
      </select>
      <select class="esc-select" style="width:auto;min-width:110px" onchange="rotSetFiltro('status',this.value)">
        <option value="ativa" selected>Ativas</option>
        <option value="pausada">Pausadas</option>
        <option value="encerrada">Encerradas</option>
        <option value="">Todas</option>
      </select>
      <button class="btn btn-secondary btn-sm" onclick="rotLimparFiltros()">Limpar</button>
    </div>

    <!-- KPIs -->
    <div id="rot-kpis" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:10px;margin-bottom:20px"></div>

    <!-- Hoje -->
    <div id="rot-hoje" style="margin-bottom:20px"></div>

    <!-- Lista -->
    <div id="rot-lista"><div style="color:var(--text3);text-align:center;padding:40px">Carregando...</div></div>
  `;
  await rotCarregar();
}

function rotSetFiltro(k,v) { _rotFiltros[k]=v; rotRenderKpis(); rotRenderHoje(); rotRenderLista(); }
function rotLimparFiltros() {
  _rotFiltros = { area:'', categoria:'', frequencia:'', status:'ativa' };
  document.querySelectorAll('[onchange*="rotSetFiltro"]').forEach(s=>{ s.selectedIndex=0; if(s.id&&s.options[0].value==='ativa') s.selectedIndex=0; });
  rotRenderKpis(); rotRenderHoje(); rotRenderLista();
}

async function rotCarregar() {
  try {
    _rotCache = await escGet('/rest/v1/escritorio_rotinas?order=proxima_execucao.asc,titulo.asc');
    if (!Array.isArray(_rotCache)) _rotCache = [];
  } catch(e) { _rotCache = []; console.error(e); }
  rotRenderKpis();
  rotRenderHoje();
  rotRenderLista();
}

function rotFiltrar(base) {
  let lista = [...(base||_rotCache)];
  if (_rotFiltros.area)       lista=lista.filter(r=>r.area===_rotFiltros.area);
  if (_rotFiltros.categoria)  lista=lista.filter(r=>r.categoria===_rotFiltros.categoria);
  if (_rotFiltros.frequencia) lista=lista.filter(r=>r.frequencia===_rotFiltros.frequencia);
  if (_rotFiltros.status==='ativa')    lista=lista.filter(r=>r.ativo&&!rotEncerrada(r));
  if (_rotFiltros.status==='pausada')  lista=lista.filter(r=>!r.ativo&&!rotEncerrada(r));
  if (_rotFiltros.status==='encerrada')lista=lista.filter(r=>rotEncerrada(r));
  return lista;
}

function rotEncerrada(r) {
  if (!r.data_fim) return false;
  return r.data_fim < new Date().toISOString().split('T')[0];
}

function rotRenderKpis() {
  const hoje    = new Date().toISOString().split('T')[0];
  const ativas  = _rotCache.filter(r=>r.ativo&&!rotEncerrada(r));
  const hojeRot = _rotCache.filter(r=>r.ativo&&r.proxima_execucao===hoje);
  const atras   = _rotCache.filter(r=>r.ativo&&r.proxima_execucao&&r.proxima_execucao<hoje);
  
  // Execuções desta semana
  const iniSem  = new Date(); iniSem.setDate(iniSem.getDate()-iniSem.getDay());
  const iniStr  = iniSem.toISOString().split('T')[0];
  
  const kpis = [
    {val:ativas.length,  lbl:'Ativas',        cor:'green' },
    {val:hojeRot.length, lbl:'Hoje',           cor:'accent'},
    {val:atras.length,   lbl:'Pendentes',      cor:'amber' },
  ];
  const CORES={green:'var(--green)',accent:'var(--accent)',amber:'var(--amber)','':'var(--text)'};
  const el=document.getElementById('rot-kpis');
  if(el) el.innerHTML=kpis.map(k=>`
    <div class="esc-kpi" style="${k.cor?`border-color:${CORES[k.cor]}22`:''}">
      <div class="esc-kpi-val" style="color:${CORES[k.cor]};font-size:22px">${k.val}</div>
      <div class="esc-kpi-lbl">${k.lbl}</div>
    </div>`).join('');
}

function rotRenderHoje() {
  const el = document.getElementById('rot-hoje');
  if (!el) return;
  const hoje    = new Date().toISOString().split('T')[0];
  const em7d    = new Date(Date.now()+7*86400000).toISOString().split('T')[0];
  const hojeRot = _rotCache.filter(r=>r.ativo&&r.proxima_execucao===hoje);
  const atrasadas = _rotCache.filter(r=>r.ativo&&r.proxima_execucao&&r.proxima_execucao<hoje);
  const proximas  = _rotCache.filter(r=>r.ativo&&r.proxima_execucao&&r.proxima_execucao>hoje&&r.proxima_execucao<=em7d);

  if(!hojeRot.length&&!atrasadas.length&&!proximas.length){ el.innerHTML=''; return; }

  el.innerHTML = `
    ${hojeRot.length?`
      <div class="esc-card" style="margin-bottom:14px;border-color:var(--accent-border)">
        <div class="esc-card-title" style="color:var(--accent)">Rotinas de hoje</div>
        ${hojeRot.map(r=>`
          <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border)">
            <div>
              <div style="font-size:13px;font-weight:500;color:var(--text)">${escEsc(r.titulo)}</div>
              <div style="font-size:11px;color:var(--text3)">${r.area||''} ${r.horario?'· '+r.horario.substring(0,5):''}</div>
            </div>
            <button class="btn btn-secondary btn-sm" style="color:var(--green);border-color:var(--green)" onclick="rotExecutar('${r.id}')">▶ Executar</button>
          </div>`).join('')}
      </div>`:``}

    ${atrasadas.length?`
      <div class="esc-card" style="margin-bottom:14px;border-color:rgba(210,153,34,.3)">
        <div class="esc-card-title" style="color:var(--amber)">⚠ Pendentes / Atrasadas</div>
        ${atrasadas.map(r=>`
          <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border)">
            <div>
              <div style="font-size:13px;font-weight:500;color:var(--text)">${escEsc(r.titulo)}</div>
              <div style="font-size:11px;color:var(--amber)">Prevista: ${r.proxima_execucao} · ${r.area||''}</div>
            </div>
            <button class="btn btn-secondary btn-sm" onclick="rotExecutar('${r.id}')">Registrar</button>
          </div>`).join('')}
      </div>`:``}

    ${proximas.length?`
      <div class="esc-card" style="margin-bottom:14px">
        <div class="esc-card-title">Próximos 7 dias</div>
        ${proximas.map(r=>`
          <div style="display:flex;align-items:center;justify-content:space-between;padding:7px 0;border-bottom:1px solid var(--border)">
            <div style="font-size:13px;color:var(--text2)">${escEsc(r.titulo)}</div>
            <div style="font-size:11px;color:var(--text3)">${r.proxima_execucao}</div>
          </div>`).join('')}
      </div>`:``}`;
}

function rotRenderLista() {
  const el = document.getElementById('rot-lista');
  if (!el) return;
  const lista = rotFiltrar();
  if (!lista.length) {
    el.innerHTML=`<div style="color:var(--text3);text-align:center;padding:40px 20px">
      <div style="font-size:28px;opacity:.3;margin-bottom:12px">🔄</div>
      <div>Nenhuma rotina encontrada.</div>
      <button class="btn btn-secondary btn-sm" style="margin-top:14px" onclick="rotAbrirForm()">+ Nova rotina</button>
    </div>`;
    return;
  }

  const hoje = new Date().toISOString().split('T')[0];
  const AREA_COR={'JS Mentoria':'area-js','Moni Sul':'area-moni','Interno':'area-js'};

  el.innerHTML = `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px">
    ${lista.map(r=>{
      const atrasada = r.ativo&&r.proxima_execucao&&r.proxima_execucao<hoje;
      const hojeR    = r.ativo&&r.proxima_execucao===hoje;
      const encerrada= rotEncerrada(r);
      const freq = ROT_FREQ[r.frequencia]||{label:r.frequencia,emoji:'🔄'};
      return `
        <div class="esc-card" style="cursor:pointer;opacity:${encerrada||!r.ativo?'.6':1};border-color:${hojeR?'var(--accent-border)':atrasada?'rgba(210,153,34,.3)':''}"
          onclick="rotAbrirDetalhe('${r.id}')">
          <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:8px">
            <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
              ${r.area?`<span class="${AREA_COR[r.area]||'area-js'}">${r.area}</span>`:''}
              ${r.prioridade==='essencial'?`<span class="badge badge-red">Essencial</span>`:''}
              ${!r.ativo?`<span class="badge badge-gray">Pausada</span>`:''}
              ${encerrada?`<span class="badge badge-gray">Encerrada</span>`:''}
              ${hojeR?`<span class="badge badge-blue">Hoje</span>`:''}
              ${atrasada?`<span class="badge badge-amber">Pendente</span>`:''}
            </div>
            <span style="font-size:16px">${freq.emoji}</span>
          </div>
          <div style="font-size:14px;font-weight:600;color:var(--text);margin-bottom:4px">${escEsc(r.titulo)}</div>
          <div style="font-size:11px;color:var(--text3);margin-bottom:10px">${freq.label}${r.categoria?' · '+r.categoria:''}${r.responsavel_id?' · '+r.responsavel_id:''}</div>
          ${r.proxima_execucao?`<div style="font-size:11px;color:${atrasada?'var(--amber)':hojeR?'var(--accent)':'var(--text3)'}">Próxima: ${r.proxima_execucao}</div>`:''}
          ${r.ultima_execucao?`<div style="font-size:11px;color:var(--text3)">Última: ${new Date(r.ultima_execucao).toLocaleDateString('pt-BR')}</div>`:''}
          <div style="display:flex;gap:6px;margin-top:10px" onclick="event.stopPropagation()">
            ${r.ativo&&!encerrada?`<button class="btn btn-secondary btn-sm" style="color:var(--green);border-color:var(--green);font-size:11px" onclick="rotExecutar('${r.id}')">▶ Executar</button>`:''}
            <button class="btn btn-ghost btn-sm" style="font-size:11px" onclick="rotAbrirForm('${r.id}')">✏</button>
            ${r.ativo&&!encerrada?`<button class="btn btn-ghost btn-sm" style="font-size:11px" onclick="rotPausar('${r.id}')">⏸</button>`:''}
            ${!r.ativo&&!encerrada?`<button class="btn btn-ghost btn-sm" style="font-size:11px;color:var(--green)" onclick="rotReativar('${r.id}')">▶</button>`:''}
          </div>
        </div>`;}).join('')}
  </div>`;
}

// ── DETALHE ──
async function rotAbrirDetalhe(id) {
  _rotDetalheId = id;
  const r = _rotCache.find(x=>x.id===id);
  if (!r) return;
  const content = document.getElementById('esc-content');
  content.innerHTML=`<div style="color:var(--text3);text-align:center;padding:40px">Carregando...</div>`;

  let execucoes=[], checklist=[];
  try { execucoes = await escGet(`/rest/v1/escritorio_rotina_execucoes?rotina_id=eq.${id}&order=executado_em.desc&limit=20`); } catch(e) {}
  try { checklist = await escGet(`/rest/v1/escritorio_rotina_checklist?rotina_id=eq.${id}&ativo=eq.true&order=ordem.asc`); } catch(e) {}

  const freq = ROT_FREQ[r.frequencia]||{label:r.frequencia,emoji:'🔄'};
  const AREA_COR={'JS Mentoria':'area-js','Moni Sul':'area-moni','Interno':'area-js'};
  const hoje = new Date().toISOString().split('T')[0];
  const atrasada = r.ativo&&r.proxima_execucao&&r.proxima_execucao<hoje;
  const hojeR    = r.ativo&&r.proxima_execucao===hoje;
  const encerrada= rotEncerrada(r);

  content.innerHTML = `
    <!-- Breadcrumb -->
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:20px;font-size:13px">
      <span style="color:var(--text3);cursor:pointer" onclick="escNavegar('rotinas')">Rotinas</span>
      <span style="color:var(--border2)">›</span>
      <span style="color:var(--text)">${escEsc(r.titulo)}</span>
    </div>

    <!-- Header -->
    <div style="display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:24px">
      <div>
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:6px">
          ${r.area?`<span class="${AREA_COR[r.area]||'area-js'}">${r.area}</span>`:''}
          <span class="badge badge-gray">${freq.emoji} ${freq.label}</span>
          ${r.categoria?`<span class="badge badge-gray">${r.categoria}</span>`:''}
          ${r.prioridade==='essencial'?`<span class="badge badge-red">Essencial</span>`:''}
          ${!r.ativo?`<span class="badge badge-amber">Pausada</span>`:''}
          ${encerrada?`<span class="badge badge-gray">Encerrada</span>`:''}
          ${hojeR?`<span class="badge badge-blue">Hoje</span>`:''}
          ${atrasada?`<span class="badge badge-amber">Pendente</span>`:''}
        </div>
        <h2 style="font-size:20px;font-weight:700;color:var(--text);margin-bottom:4px">${escEsc(r.titulo)}</h2>
        ${r.descricao?`<p style="font-size:13px;color:var(--text2);line-height:1.5">${escEsc(r.descricao)}</p>`:''}
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        ${r.ativo&&!encerrada?`<button class="btn btn-primary" onclick="rotExecutar('${r.id}')">▶ Executar</button>`:''}
        <button class="btn btn-secondary btn-sm" onclick="rotAbrirForm('${r.id}')">✏ Editar</button>
        ${r.ativo&&!encerrada?`<button class="btn btn-secondary btn-sm" onclick="rotPausar('${r.id}')">⏸ Pausar</button>`:''}
        ${!r.ativo&&!encerrada?`<button class="btn btn-secondary btn-sm" style="color:var(--green)" onclick="rotReativar('${r.id}')">▶ Reativar</button>`:''}
      </div>
    </div>

    <!-- Grid info -->
    <div class="esc-grid-2" style="gap:16px;margin-bottom:16px">
      <div class="esc-card">
        <div class="esc-card-title">Configuração</div>
        <div style="display:flex;flex-direction:column;gap:8px;font-size:13px">
          <div><span style="color:var(--text3)">Frequência: </span>${freq.label}${rotFreqDetalhe(r)}</div>
          ${r.responsavel_id?`<div><span style="color:var(--text3)">Responsável: </span>${escEsc(r.responsavel_id)}</div>`:''}
          ${r.horario?`<div><span style="color:var(--text3)">Horário: </span>${r.horario.substring(0,5)}</div>`:''}
          ${r.duracao_estimada?`<div><span style="color:var(--text3)">Duração: </span>${r.duracao_estimada} min</div>`:''}
          <div><span style="color:var(--text3)">Início: </span>${r.data_inicio}</div>
          ${r.data_fim?`<div><span style="color:var(--text3)">Fim: </span>${r.data_fim}</div>`:''}
        </div>
      </div>
      <div class="esc-card">
        <div class="esc-card-title">Próximas execuções</div>
        ${rotProximasExecucoes(r).map(d=>`<div style="font-size:13px;color:var(--text2);padding:4px 0;border-bottom:1px solid var(--border)">${d}</div>`).join('')||`<div style="color:var(--text3);font-size:13px">—</div>`}
      </div>
    </div>

    <!-- Checklist -->
    ${checklist.length?`
      <div class="esc-card" style="margin-bottom:16px">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
          <div class="esc-card-title" style="margin-bottom:0">Checklist (${checklist.length} itens)</div>
        </div>
        ${checklist.map((c,i)=>`
          <div style="display:flex;align-items:center;gap:10px;padding:7px 0;border-bottom:1px solid var(--border)">
            <span style="color:var(--text3);font-size:12px">${c.ordem||i+1}.</span>
            <span style="font-size:13px;color:var(--text2)">${escEsc(c.titulo)}</span>
          </div>`).join('')}
      </div>`:``}

    <!-- Histórico de execuções -->
    <div class="esc-card">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
        <div class="esc-card-title" style="margin-bottom:0">Histórico de execuções</div>
        <span style="font-size:12px;color:var(--text3)">${execucoes.length} registro(s)</span>
      </div>
      ${execucoes.length===0
        ? `<div style="color:var(--text3);font-size:13px">Nenhuma execução registrada ainda.</div>`
        : execucoes.map(e=>{
          const st = {concluida:{label:'Concluída',cor:'green'},parcial:{label:'Parcial',cor:'amber'},nao_realizada:{label:'Não realizada',cor:'red'}}[e.status]||{label:e.status,cor:'gray'};
          const dtFormatada = new Date(e.executado_em).toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'});
          return `<div style="padding:10px 0;border-bottom:1px solid var(--border)">
            <div style="display:flex;align-items:center;gap:10px">
              <span style="font-size:12px;color:var(--text3);min-width:130px">${dtFormatada}</span>
              <span class="badge badge-${st.cor}">${st.label}</span>
              ${e.executado_por?`<span style="font-size:11px;color:var(--text3)">${escEsc(e.executado_por)}</span>`:''}
              ${e.tarefa_id?`<span class="badge badge-blue" style="font-size:10px;cursor:pointer" onclick="tAbrirForm('${e.tarefa_id}')">tarefa vinculada</span>`:''}
            </div>
            ${e.observacao?`<div style="font-size:12px;color:var(--text2);margin-top:4px;line-height:1.4">${escEsc(e.observacao)}</div>`:''}
          </div>`;}).join('')}
    </div>`;
}

function rotFreqDetalhe(r) {
  if (r.frequencia==='semanal'&&r.dias_semana) {
    try { const dias=JSON.parse(r.dias_semana); return ' — '+dias.map(d=>ROT_DIAS_SEM.find(x=>x.val===d)?.label||d).join(', '); } catch(e) {}
  }
  if (r.frequencia==='mensal'&&r.dia_mes) return ` — dia ${r.dia_mes}`;
  return '';
}

function rotProximasExecucoes(r) {
  if (!r.proxima_execucao) return [];
  const base = new Date(r.proxima_execucao+'T12:00:00');
  const result = [];
  for (let i=0;i<5;i++) {
    result.push(new Date(base).toLocaleDateString('pt-BR',{weekday:'short',day:'2-digit',month:'2-digit',year:'numeric'}));
    rotAvancarData(base, r);
  }
  return result;
}

function rotAvancarData(d, r) {
  if      (r.frequencia==='diaria')       d.setDate(d.getDate()+1);
  else if (r.frequencia==='semanal')      d.setDate(d.getDate()+7);
  else if (r.frequencia==='quinzenal')    d.setDate(d.getDate()+14);
  else if (r.frequencia==='mensal')       d.setMonth(d.getMonth()+1);
  else if (r.frequencia==='trimestral')   d.setMonth(d.getMonth()+3);
  else if (r.frequencia==='anual')        d.setFullYear(d.getFullYear()+1);
  else d.setDate(d.getDate()+7);
}

// ── CALCULAR PRÓXIMA EXECUÇÃO ──
function rotCalcularProxima(freq, diasSemana, diaMes, dataInicio) {
  const base = new Date(dataInicio+'T12:00:00');
  const hoje = new Date(); hoje.setHours(0,0,0,0);
  let d = new Date(base);

  if (freq==='diaria') {
    if (d<=hoje) { d=new Date(hoje); d.setDate(d.getDate()+1); }
    return d.toISOString().split('T')[0];
  }
  if (freq==='semanal') {
    let dias = [];
    try { dias=(JSON.parse(diasSemana)||[]).map(x=>({dom:0,seg:1,ter:2,qua:3,qui:4,sex:5,sab:6}[x]||0)); } catch(e) {}
    if (!dias.length) dias=[5]; // sexta por padrão
    const hj = hoje.getDay();
    let minDiff = 99;
    dias.forEach(dia=>{ let diff=(dia-hj+7)%7; if(diff===0)diff=7; if(diff<minDiff)minDiff=diff; });
    const prox = new Date(hoje); prox.setDate(hoje.getDate()+minDiff);
    return prox.toISOString().split('T')[0];
  }
  if (freq==='quinzenal') {
    if (d<=hoje) { d=new Date(hoje); d.setDate(d.getDate()+1); }
    return d.toISOString().split('T')[0];
  }
  if (freq==='mensal') {
    const dia = parseInt(diaMes)||1;
    const prox = new Date(hoje.getFullYear(),hoje.getMonth(),dia);
    if (prox<=hoje) prox.setMonth(prox.getMonth()+1);
    return prox.toISOString().split('T')[0];
  }
  if (freq==='trimestral') {
    const prox = new Date(hoje); prox.setMonth(prox.getMonth()+3);
    return prox.toISOString().split('T')[0];
  }
  if (freq==='anual') {
    const prox = new Date(hoje); prox.setFullYear(prox.getFullYear()+1);
    return prox.toISOString().split('T')[0];
  }
  return hoje.toISOString().split('T')[0];
}

// ── EXECUTAR ROTINA ──
function rotExecutar(id) {
  const r = _rotCache.find(x=>x.id===id);
  if (!r) return;
  document.getElementById('esc-modal-title').textContent = 'Registrar execução';
  document.getElementById('esc-modal-body').innerHTML = `
    <div style="font-size:13px;color:var(--text2);margin-bottom:16px">
      Rotina: <b>${escEsc(r.titulo)}</b>
    </div>
    <div class="esc-field">
      <label class="esc-label">Status da execução</label>
      <select class="esc-select" id="re-status">
        <option value="concluida" selected>Concluída</option>
        <option value="parcial">Parcial</option>
        <option value="nao_realizada">Não realizada</option>
      </select>
    </div>
    <div class="esc-field">
      <label class="esc-label">Observação</label>
      <textarea class="esc-textarea" id="re-obs" rows="3" placeholder="Como foi? O que identificou?"></textarea>
    </div>
    <div class="esc-field" style="display:flex;align-items:center;gap:10px">
      <input type="checkbox" id="re-gerar-tarefa" style="width:16px;height:16px;accent-color:var(--accent)">
      <label for="re-gerar-tarefa" style="font-size:13px;color:var(--text2);cursor:pointer">Gerar tarefa a partir desta execução</label>
    </div>
    <div id="re-tarefa-form" style="display:none;margin-top:8px;padding:12px;background:var(--bg);border-radius:8px;border:1px solid var(--border)">
      <div class="esc-field">
        <label class="esc-label">Título da tarefa</label>
        <input class="esc-input" id="re-tarefa-titulo" placeholder="O que precisa ser feito?" value="${escEsc(r.titulo)}">
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <div class="esc-field">
          <label class="esc-label">Prazo</label>
          <input class="esc-input" type="date" id="re-tarefa-prazo">
        </div>
        <div class="esc-field">
          <label class="esc-label">Prioridade</label>
          <select class="esc-select" id="re-tarefa-prio">
            <option value="normal" selected>Normal</option>
            <option value="alta">Alta</option>
            <option value="urgente">Urgente</option>
            <option value="baixa">Baixa</option>
          </select>
        </div>
      </div>
      <div class="esc-field">
        <label class="esc-label">Vincular a projeto</label>
        <select class="esc-select" id="re-tarefa-proj">
          <option value="">Nenhum</option>
          ${(_projetosCache||[]).filter(p=>!['cancelado','concluido'].includes(p.status)).map(p=>`<option value="${p.id}">${escEsc(p.nome)}</option>`).join('')}
        </select>
      </div>
    </div>
    <script>
      document.getElementById('re-gerar-tarefa').addEventListener('change',function(){
        document.getElementById('re-tarefa-form').style.display=this.checked?'block':'none';
      });
    </script>
    <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:12px">
      <button class="btn btn-secondary" onclick="escFecharModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="rotSalvarExecucao('${id}')">Registrar execução</button>
    </div>`;
  if(typeof escAbrirModal==='function'){escAbrirModal();}else{const _ov=document.getElementById('esc-modal-overlay');if(_ov){_ov.style.opacity='1';_ov.style.pointerEvents='all';_ov.classList.add('open');}}
}

async function rotSalvarExecucao(rotId) {
  const status  = document.getElementById('re-status')?.value||'concluida';
  const obs     = document.getElementById('re-obs')?.value||null;
  const gerarTar= document.getElementById('re-gerar-tarefa')?.checked;
  const r = _rotCache.find(x=>x.id===rotId);
  const agora   = new Date().toISOString();
  let tarefaId  = null;

  try {
    // Criar tarefa se solicitado
    if (gerarTar) {
      const titulo = document.getElementById('re-tarefa-titulo')?.value?.trim() || r?.titulo || 'Tarefa de rotina';
      const tObj = {
        titulo, area: r?.area||null,
        responsavel_id: r?.responsavel_id||null,
        prioridade:     document.getElementById('re-tarefa-prio')?.value||'normal',
        prazo:          document.getElementById('re-tarefa-prazo')?.value||null,
        projeto_id:     document.getElementById('re-tarefa-proj')?.value||null,
        status:         'a_fazer',
        origem_tipo:    'rotina',
        origem_id:      rotId,
        created_by:     ESC_STATE?.usuario||'Jéssica',
        criado_por:     ESC_STATE?.usuario||'Jéssica',
      };
      const tr = await fetch(ESC_SUPA_URL+'/rest/v1/escritorio_tarefas',{
        method:'POST',
        headers:{'apikey':ESC_SUPA_KEY,'Authorization':'Bearer '+ESC_SUPA_KEY,'Content-Type':'application/json','Prefer':'return=representation'},
        body:JSON.stringify(tObj)
      });
      const tc = await tr.json();
      if(Array.isArray(tc)&&tc[0]) {
        tarefaId = tc[0].id;
        if(typeof _tarefasCache!=='undefined') _tarefasCache.unshift(tc[0]);
      }
    }

    // Registrar execução
    const execObj = {
      rotina_id:    rotId,
      executado_em: agora,
      executado_por:ESC_STATE?.usuario||'Jéssica',
      status, observacao:obs,
      tarefa_id: tarefaId,
    };
    await fetch(ESC_SUPA_URL+'/rest/v1/escritorio_rotina_execucoes',{
      method:'POST',
      headers:{'apikey':ESC_SUPA_KEY,'Authorization':'Bearer '+ESC_SUPA_KEY,'Content-Type':'application/json','Prefer':'return=minimal'},
      body:JSON.stringify(execObj)
    });

    // Atualizar ultima_execucao e calcular proxima_execucao
    const novaProxima = rotCalcularProxima(r?.frequencia||'semanal', r?.dias_semana, r?.dia_mes, r?.data_inicio||new Date().toISOString().split('T')[0]);
    const patchRot = {ultima_execucao:agora, proxima_execucao:novaProxima, updated_at:agora};
    const res = await fetch(ESC_SUPA_URL+'/rest/v1/escritorio_rotinas?id=eq.'+rotId,{
      method:'PATCH',
      headers:{'apikey':ESC_SUPA_KEY,'Authorization':'Bearer '+ESC_SUPA_KEY,'Content-Type':'application/json','Prefer':'return=representation'},
      body:JSON.stringify(patchRot)
    });
    const updated = await res.json();
    if(Array.isArray(updated)){const idx=_rotCache.findIndex(x=>x.id===rotId);if(idx>=0)_rotCache[idx]=updated[0];}

    escToast(tarefaId?'Execução registrada + tarefa criada! ✓':'Execução registrada! ✓');
    escFecharModal();
    if(_rotDetalheId===rotId) rotAbrirDetalhe(rotId);
    else { rotRenderKpis(); rotRenderHoje(); rotRenderLista(); }
  } catch(e){ escToast('Erro ao registrar execução.'); console.error(e); }
}

// ── PAUSAR / REATIVAR ──
async function rotPausar(id) {
  await rotPatchStatus(id, false); escToast('Rotina pausada.');
  rotRenderKpis(); rotRenderHoje(); rotRenderLista();
  if(_rotDetalheId===id) rotAbrirDetalhe(id);
}
async function rotReativar(id) {
  await rotPatchStatus(id, true); escToast('Rotina reativada!');
  rotRenderKpis(); rotRenderHoje(); rotRenderLista();
  if(_rotDetalheId===id) rotAbrirDetalhe(id);
}
async function rotPatchStatus(id, ativo) {
  const agora=new Date().toISOString();
  const res = await fetch(ESC_SUPA_URL+'/rest/v1/escritorio_rotinas?id=eq.'+id,{
    method:'PATCH',
    headers:{'apikey':ESC_SUPA_KEY,'Authorization':'Bearer '+ESC_SUPA_KEY,'Content-Type':'application/json','Prefer':'return=representation'},
    body:JSON.stringify({ativo, updated_at:agora})
  });
  const updated=await res.json();
  if(Array.isArray(updated)){const idx=_rotCache.findIndex(x=>x.id===id);if(idx>=0)_rotCache[idx]=updated[0];}
}

// ── FORMULÁRIO ──
function rotAbrirForm(id) {
  _rotEditId = id||null;
  const r = id ? _rotCache.find(x=>x.id===id) : null;
  let diasSel = [];
  try { diasSel=JSON.parse(r?.dias_semana||'[]'); } catch(e) {}
  const hoje = new Date().toISOString().split('T')[0];

  document.getElementById('esc-modal-title').textContent = r?'Editar rotina':'Nova rotina';
  document.getElementById('esc-modal-body').innerHTML = `
    <div class="esc-field">
      <label class="esc-label">Nome <span style="color:var(--red)">*</span></label>
      <input class="esc-input" id="rf-titulo" value="${escEsc(r?.titulo||'')}" placeholder="Ex: Revisão semanal da Mentoria">
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
      <div class="esc-field">
        <label class="esc-label">Área</label>
        <select class="esc-select" id="rf-area">
          <option value="">Selecionar</option>
          ${ROT_AREAS.map(a=>`<option value="${a}" ${r?.area===a?'selected':''}>${a}</option>`).join('')}
        </select>
      </div>
      <div class="esc-field">
        <label class="esc-label">Categoria</label>
        <select class="esc-select" id="rf-cat">
          <option value="">Selecionar</option>
          ${ROT_CATEGORIAS.map(c=>`<option value="${c}" ${r?.categoria===c?'selected':''}>${c}</option>`).join('')}
        </select>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
      <div class="esc-field">
        <label class="esc-label">Frequência <span style="color:var(--red)">*</span></label>
        <select class="esc-select" id="rf-freq" onchange="rotToggleCamposFreq(this.value)">
          ${Object.entries(ROT_FREQ).map(([k,v])=>`<option value="${k}" ${(r?.frequencia||'semanal')===k?'selected':''}>${v.label}</option>`).join('')}
        </select>
      </div>
      <div class="esc-field">
        <label class="esc-label">Responsável</label>
        <select class="esc-select" id="rf-resp">
          <option value="">Selecionar</option>
          ${ROT_RESP.map(rv=>`<option value="${rv}" ${r?.responsavel_id===rv?'selected':''}>${rv}</option>`).join('')}
        </select>
      </div>
    </div>
    <!-- Campos condicionais de frequência -->
    <div id="rf-dias-wrap" style="${(r?.frequencia||'semanal')==='semanal'?'':'display:none'}" class="esc-field">
      <label class="esc-label">Dias da semana</label>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        ${ROT_DIAS_SEM.map(d=>`
          <label style="display:flex;align-items:center;gap:4px;cursor:pointer;padding:4px 8px;border:1px solid var(--border);border-radius:6px;font-size:12px">
            <input type="checkbox" value="${d.val}" ${diasSel.includes(d.val)?'checked':''} style="accent-color:var(--accent)"> ${d.label}
          </label>`).join('')}
      </div>
    </div>
    <div id="rf-diames-wrap" style="${r?.frequencia==='mensal'?'':'display:none'}" class="esc-field">
      <label class="esc-label">Dia do mês</label>
      <input class="esc-input" type="number" id="rf-dia-mes" min="1" max="31" value="${r?.dia_mes||1}">
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
      <div class="esc-field">
        <label class="esc-label">Data de início <span style="color:var(--red)">*</span></label>
        <input class="esc-input" type="date" id="rf-inicio" value="${r?.data_inicio||hoje}">
      </div>
      <div class="esc-field">
        <label class="esc-label">Data de fim (opcional)</label>
        <input class="esc-input" type="date" id="rf-fim" value="${r?.data_fim||''}">
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
      <div class="esc-field">
        <label class="esc-label">Horário</label>
        <input class="esc-input" type="time" id="rf-horario" value="${r?.horario?.substring(0,5)||''}">
      </div>
      <div class="esc-field">
        <label class="esc-label">Duração estimada (min)</label>
        <input class="esc-input" type="number" id="rf-dur" min="5" value="${r?.duracao_estimada||''}">
      </div>
    </div>
    <div class="esc-field">
      <label class="esc-label">Prioridade</label>
      <select class="esc-select" id="rf-prio">
        <option value="normal" ${r?.prioridade!=='essencial'?'selected':''}>Normal</option>
        <option value="essencial" ${r?.prioridade==='essencial'?'selected':''}>Essencial</option>
      </select>
    </div>
    <div class="esc-field">
      <label class="esc-label">Descrição</label>
      <textarea class="esc-textarea" id="rf-desc" rows="2">${escEsc(r?.descricao||'')}</textarea>
    </div>
    <div class="esc-field" style="display:flex;align-items:center;gap:10px">
      <input type="checkbox" id="rf-ativo" ${r===null||r?.ativo?'checked':''} style="width:16px;height:16px;accent-color:var(--accent)">
      <label for="rf-ativo" style="font-size:13px;color:var(--text2);cursor:pointer">Rotina ativa</label>
    </div>
    <div style="display:flex;gap:10px;justify-content:flex-end">
      <button class="btn btn-secondary" onclick="escFecharModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="rotSalvar()">${r?'Salvar':'Criar rotina'}</button>
    </div>`;
  if(typeof escAbrirModal==='function'){escAbrirModal();}else{const _ov=document.getElementById('esc-modal-overlay');if(_ov){_ov.style.opacity='1';_ov.style.pointerEvents='all';_ov.classList.add('open');}}
  document.getElementById('rf-titulo')?.focus();
  rotToggleCamposFreq(r?.frequencia||'semanal');
}

function rotToggleCamposFreq(freq) {
  const diasWrap  = document.getElementById('rf-dias-wrap');
  const diamesWrap= document.getElementById('rf-diames-wrap');
  if (diasWrap)   diasWrap.style.display   = freq==='semanal'?'block':'none';
  if (diamesWrap) diamesWrap.style.display = freq==='mensal'?'block':'none';
}

async function rotSalvar() {
  const titulo  = document.getElementById('rf-titulo')?.value?.trim();
  const freq    = document.getElementById('rf-freq')?.value;
  const inicio  = document.getElementById('rf-inicio')?.value;
  if (!titulo)  { escToast('Informe o nome.'); return; }
  if (!freq)    { escToast('Selecione a frequência.'); return; }
  if (!inicio)  { escToast('Informe a data de início.'); return; }

  // Dias da semana selecionados
  let diasSel = [];
  document.querySelectorAll('#rf-dias-wrap input[type=checkbox]:checked').forEach(cb=>diasSel.push(cb.value));

  const proxima = rotCalcularProxima(freq, JSON.stringify(diasSel), document.getElementById('rf-dia-mes')?.value, inicio);

  const obj = {
    titulo,
    area:            document.getElementById('rf-area')?.value||null,
    categoria:       document.getElementById('rf-cat')?.value||null,
    frequencia:      freq,
    responsavel_id:  document.getElementById('rf-resp')?.value||null,
    dias_semana:     freq==='semanal'&&diasSel.length?JSON.stringify(diasSel):null,
    dia_mes:         freq==='mensal'?parseInt(document.getElementById('rf-dia-mes')?.value)||null:null,
    horario:         document.getElementById('rf-horario')?.value||null,
    duracao_estimada:parseInt(document.getElementById('rf-dur')?.value)||null,
    data_inicio:     inicio,
    data_fim:        document.getElementById('rf-fim')?.value||null,
    ativo:           document.getElementById('rf-ativo')?.checked!==false,
    prioridade:      document.getElementById('rf-prio')?.value||'normal',
    descricao:       document.getElementById('rf-desc')?.value||null,
    proxima_execucao:proxima,
    created_by:      ESC_STATE?.usuario||'Jéssica',
    updated_at:      new Date().toISOString(),
  };

  try {
    if (_rotEditId) {
      const res=await fetch(ESC_SUPA_URL+'/rest/v1/escritorio_rotinas?id=eq.'+_rotEditId,{
        method:'PATCH',
        headers:{'apikey':ESC_SUPA_KEY,'Authorization':'Bearer '+ESC_SUPA_KEY,'Content-Type':'application/json','Prefer':'return=representation'},
        body:JSON.stringify(obj)
      });
      const updated=await res.json();
      if(Array.isArray(updated)){const idx=_rotCache.findIndex(x=>x.id===_rotEditId);if(idx>=0)_rotCache[idx]=updated[0];}
      escToast('Rotina atualizada!');
    } else {
      const res=await fetch(ESC_SUPA_URL+'/rest/v1/escritorio_rotinas',{
        method:'POST',
        headers:{'apikey':ESC_SUPA_KEY,'Authorization':'Bearer '+ESC_SUPA_KEY,'Content-Type':'application/json','Prefer':'return=representation'},
        body:JSON.stringify(obj)
      });
      const created=await res.json();
      if(Array.isArray(created)) _rotCache.unshift(created[0]);
      escToast('Rotina criada!');
    }
    escFecharModal();
    rotRenderKpis(); rotRenderHoje(); rotRenderLista();
    if(_rotDetalheId&&_rotEditId===_rotDetalheId) rotAbrirDetalhe(_rotDetalheId);
  } catch(e){ escToast('Erro ao salvar rotina.'); console.error(e); }
}
