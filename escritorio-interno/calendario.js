/* ══════════════════════════════════════════════════
   MÓDULO CALENDÁRIO — escritorio-interno
   Agregador temporal: tarefas + reuniões + eventos + planejamento
   ══════════════════════════════════════════════════ */

const CAL_VIEWS   = ['mes','semana','dia','lista'];
const CAL_MESES   = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const CAL_DIAS_SEMANA = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
const CAL_TIPOS_EVENTO = ['Compromisso','Bloqueio','Evento','Gravação','Data importante','Pessoal','Comercial','Outro'];
const CAL_AREAS   = ['JS Mentoria','Moni Sul','Interno'];
const CAL_RESP    = ['Jéssica','Amanda'];

// Cores por tipo de item
const CAL_CORES = {
  tarefa:           '#4a90d9',
  reuniao:          '#a371f7',
  evento:           '#3fb950',
  Bloqueio:         '#f85149',
  'Gravação':       '#d29922',
  'Data importante':'#2ea8a0',
  Comercial:        '#d29922',
  Pessoal:          '#3fb950',
};

let _calView   = 'mes';
let _calData   = new Date();
let _calFiltros = { area:'', tipo:'', responsavel:'' };
let _calItems  = [];   // todos os itens agregados do período
let _calEvEditId = null;

// ── RENDER PRINCIPAL ──
async function escRenderCalendario(el) {
  el.innerHTML = `
    <!-- Toolbar -->
    <div style="display:flex;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:16px">
      <!-- Navegação temporal -->
      <div style="display:flex;align-items:center;gap:6px">
        <button class="btn btn-secondary btn-sm" onclick="calNavegar(-1)">‹</button>
        <button class="btn btn-secondary btn-sm" onclick="calHoje()">Hoje</button>
        <button class="btn btn-secondary btn-sm" onclick="calNavegar(1)">›</button>
        <div id="cal-periodo" style="font-size:15px;font-weight:700;color:var(--text);padding:0 8px;min-width:180px"></div>
      </div>
      <!-- Seletor de view -->
      <div style="display:flex;gap:4px">
        ${CAL_VIEWS.map(v=>`<button class="btn btn-secondary btn-sm" id="cal-view-${v}" onclick="calSetView('${v}')">${{mes:'Mês',semana:'Semana',dia:'Dia',lista:'Lista'}[v]}</button>`).join('')}
      </div>
      <!-- Filtros -->
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-left:auto">
        <select class="esc-select" style="width:auto;min-width:120px;font-size:12px" onchange="calSetFiltro('area',this.value)">
          <option value="">Todas as áreas</option>
          ${CAL_AREAS.map(a=>`<option value="${a}">${a}</option>`).join('')}
        </select>
        <select class="esc-select" style="width:auto;min-width:120px;font-size:12px" onchange="calSetFiltro('tipo',this.value)">
          <option value="">Todos os tipos</option>
          <option value="tarefa">Tarefa</option>
          <option value="reuniao">Reunião</option>
          <option value="evento">Evento</option>
        </select>
        <button class="btn btn-primary btn-sm" onclick="calAbrirFormEvento()">+ Novo evento</button>
      </div>
    </div>

    <!-- Área do calendário -->
    <div id="cal-area"></div>
  `;
  calAtualizarPeriodoLabel();
  calAtualizarViewBtns();
  await calCarregarPeriodo();
}

function calHoje()       { _calData = new Date(); calAtualizarPeriodoLabel(); calAtualizarViewBtns(); calCarregarPeriodo(); }
function calNavegar(dir) {
  if      (_calView==='mes')    _calData.setMonth(_calData.getMonth()+dir);
  else if (_calView==='semana') _calData.setDate(_calData.getDate()+dir*7);
  else if (_calView==='dia')    _calData.setDate(_calData.getDate()+dir);
  else if (_calView==='lista')  _calData.setDate(_calData.getDate()+dir*7);
  _calData = new Date(_calData);
  calAtualizarPeriodoLabel();
  calCarregarPeriodo();
}
function calSetView(v) { _calView=v; calAtualizarViewBtns(); calAtualizarPeriodoLabel(); calCarregarPeriodo(); }
function calSetFiltro(k,v) { _calFiltros[k]=v; calRenderView(); }
function calAtualizarViewBtns() {
  CAL_VIEWS.forEach(v=>{
    const btn=document.getElementById('cal-view-'+v);
    if(btn){btn.className='btn btn-sm '+(v===_calView?'btn-primary':'btn-secondary');}
  });
}
function calAtualizarPeriodoLabel() {
  const el=document.getElementById('cal-periodo');
  if(!el) return;
  const mes = CAL_MESES[_calData.getMonth()];
  const ano = _calData.getFullYear();
  if (_calView==='mes')    el.textContent=`${mes} ${ano}`;
  else if(_calView==='semana'){ const ini=calInicioSemana(_calData); const fim=new Date(ini); fim.setDate(fim.getDate()+6); el.textContent=`${ini.toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'})} – ${fim.toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric'})}`; }
  else if(_calView==='dia')   el.textContent=_calData.toLocaleDateString('pt-BR',{weekday:'long',day:'2-digit',month:'long',year:'numeric'});
  else el.textContent=`A partir de ${_calData.toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric'})}`;
}

// ── CARREGAR DADOS DO PERÍODO ──
async function calCarregarPeriodo() {
  const {ini, fim} = calGetRange();
  const iniStr = ini.toISOString().split('T')[0];
  const fimStr = fim.toISOString().split('T')[0];
  _calItems = [];

  // 1. Tarefas com prazo no período
  try {
    const tarefas = await escGet(`/rest/v1/escritorio_tarefas?prazo=gte.${iniStr}&prazo=lte.${fimStr}&status=neq.concluida&order=prazo.asc`);
    (tarefas||[]).forEach(t=>_calItems.push({
      tipo:'tarefa', id:t.id, titulo:t.titulo, data:t.prazo, hora:null,
      area:t.area, responsavel:t.responsavel_id, prioridade:t.prioridade,
      status:t.status, projeto_id:t.projeto_id, _raw:t
    }));
  } catch(e) {}

  // 2. Reuniões no período
  try {
    const reunioes = await escGet(`/rest/v1/escritorio_reunioes?data=gte.${iniStr}&data=lte.${fimStr}&status=neq.cancelada&order=data.asc,hora_inicio.asc`);
    (reunioes||[]).forEach(r=>_calItems.push({
      tipo:'reuniao', id:r.id, titulo:r.titulo, data:r.data||r.data_hora_inicio?.substring(0,10),
      hora:r.hora_inicio||r.data_hora_inicio?.substring(11,16),
      area:r.area, responsavel:r.responsavel_id, status:r.status,
      tipo_reuniao:r.tipo, _raw:r
    }));
  } catch(e) {}

  // 3. Eventos criados diretamente
  try {
    const eventos = await escGet(`/rest/v1/escritorio_eventos?data_inicio=gte.${iniStr}&data_inicio=lte.${fimStr}&status=eq.ativo&order=data_inicio.asc,hora_inicio.asc`);
    (eventos||[]).forEach(ev=>_calItems.push({
      tipo:'evento', id:ev.id, titulo:ev.titulo, data:ev.data_inicio,
      hora:ev.hora_inicio, hora_fim:ev.hora_fim, dia_inteiro:ev.dia_inteiro,
      area:ev.area, responsavel:ev.responsavel_id, tipo_evento:ev.tipo,
      status:ev.status, _raw:ev
    }));
  } catch(e) {}

  calRenderView();
}

function calGetRange() {
  let ini, fim;
  if (_calView==='mes') {
    ini = new Date(_calData.getFullYear(), _calData.getMonth(), 1);
    fim = new Date(_calData.getFullYear(), _calData.getMonth()+1, 0);
  } else if (_calView==='semana') {
    ini = calInicioSemana(_calData);
    fim = new Date(ini); fim.setDate(fim.getDate()+6);
  } else if (_calView==='dia') {
    ini = fim = new Date(_calData);
  } else { // lista
    ini = new Date(_calData);
    fim = new Date(_calData); fim.setDate(fim.getDate()+30);
  }
  return {ini, fim};
}

function calInicioSemana(d) {
  const ini = new Date(d);
  ini.setDate(ini.getDate() - ini.getDay()); // domingo
  return ini;
}

// ── FILTRAR ITEMS ──
function calFiltrar(items) {
  let lista = [...items];
  if (_calFiltros.area)  lista=lista.filter(i=>i.area===_calFiltros.area);
  if (_calFiltros.tipo)  lista=lista.filter(i=>i.tipo===_calFiltros.tipo);
  if (_calFiltros.responsavel) lista=lista.filter(i=>i.responsavel===_calFiltros.responsavel);
  return lista;
}

// ── RENDER VIEW ──
function calRenderView() {
  const el = document.getElementById('cal-area');
  if (!el) return;
  const items = calFiltrar(_calItems);
  if      (_calView==='mes')    calRenderMes(el, items);
  else if (_calView==='semana') calRenderSemana(el, items);
  else if (_calView==='dia')    calRenderDia(el, items);
  else                           calRenderLista(el, items);
}

// ── RENDER MÊS ──
function calRenderMes(el, items) {
  const ano = _calData.getFullYear(), mes = _calData.getMonth();
  const primeiroDia = new Date(ano,mes,1).getDay();
  const diasNoMes   = new Date(ano,mes+1,0).getDate();
  const hoje        = new Date().toISOString().split('T')[0];

  // Indexar items por data
  const porDia = {};
  items.forEach(i=>{ if(!porDia[i.data]) porDia[i.data]=[]; porDia[i.data].push(i); });

  let html = `
    <div style="background:var(--card);border:1px solid var(--border);border-radius:12px;overflow:hidden">
      <!-- Cabeçalho dias semana -->
      <div style="display:grid;grid-template-columns:repeat(7,1fr);border-bottom:1px solid var(--border)">
        ${CAL_DIAS_SEMANA.map(d=>`<div style="text-align:center;padding:8px 4px;font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--text3)">${d}</div>`).join('')}
      </div>
      <!-- Células dos dias -->
      <div style="display:grid;grid-template-columns:repeat(7,1fr)">`;

  // Células vazias antes do dia 1
  for(let i=0;i<primeiroDia;i++) html+=`<div style="border-right:1px solid var(--border);border-bottom:1px solid var(--border);min-height:90px;background:rgba(0,0,0,.15)"></div>`;

  for(let d=1;d<=diasNoMes;d++) {
    const dataStr = `${ano}-${String(mes+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const ehHoje  = dataStr === hoje;
    const diasItems = porDia[dataStr]||[];
    const diaDoMes = new Date(ano,mes,d).getDay();
    const ehFimSem = diaDoMes===0||diaDoMes===6;
    const total = (d+primeiroDia-1);
    const ultimaLinha = total>=28;

    html+=`<div style="border-right:${(d+primeiroDia)%7===0?'none':'1px solid var(--border)'};border-bottom:1px solid var(--border);min-height:90px;padding:4px 3px;background:${ehFimSem?'rgba(0,0,0,.08)':'transparent'};vertical-align:top">
      <div style="text-align:right;margin-bottom:3px">
        <span style="${ehHoje?'background:var(--accent);color:#fff;border-radius:50%;width:22px;height:22px;display:inline-flex;align-items:center;justify-content:center;':'color:'+(ehFimSem?'var(--text3)':'var(--text2)')};font-size:12px;font-weight:${ehHoje?700:400}">${d}</span>
      </div>
      ${diasItems.slice(0,3).map(i=>calBadge(i)).join('')}
      ${diasItems.length>3?`<div style="font-size:9px;color:var(--text3);text-align:center;cursor:pointer" onclick="calVerDia('${dataStr}')">+${diasItems.length-3} mais</div>`:''}
    </div>`;
  }

  // Células vazias depois
  const total = primeiroDia + diasNoMes;
  const resto = (7 - total%7) % 7;
  for(let i=0;i<resto;i++) html+=`<div style="border-right:${i<resto-1?'1px solid var(--border)':'none'};border-bottom:1px solid var(--border);min-height:90px;background:rgba(0,0,0,.15)"></div>`;

  html += `</div></div>`;

  // Legenda
  html += `<div style="display:flex;gap:14px;flex-wrap:wrap;margin-top:12px;font-size:11px;color:var(--text3)">
    <span><span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:${CAL_CORES.tarefa};margin-right:5px"></span>Tarefa</span>
    <span><span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:${CAL_CORES.reuniao};margin-right:5px"></span>Reunião</span>
    <span><span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:${CAL_CORES.evento};margin-right:5px"></span>Evento</span>
  </div>`;

  el.innerHTML = html;
}

function calBadge(item) {
  const cor = item.tipo==='tarefa'?CAL_CORES.tarefa:item.tipo==='reuniao'?CAL_CORES.reuniao:(CAL_CORES[item.tipo_evento]||CAL_CORES.evento);
  const hora = item.hora ? `<span style="opacity:.7">${item.hora.substring(0,5)} </span>` : '';
  return `<div onclick="calAbrirItem('${item.tipo}','${item.id}')"
    style="background:${cor}22;border-left:2px solid ${cor};border-radius:0 3px 3px 0;padding:2px 4px;margin-bottom:2px;cursor:pointer;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;font-size:10px;color:var(--text)"
    title="${escEsc(item.titulo)}">${hora}${escEsc(item.titulo.slice(0,20))}${item.titulo.length>20?'…':''}</div>`;
}

// ── RENDER SEMANA ──
function calRenderSemana(el, items) {
  const ini = calInicioSemana(_calData);
  const hoje = new Date().toISOString().split('T')[0];
  const dias = [];
  for(let i=0;i<7;i++){const d=new Date(ini);d.setDate(d.getDate()+i);dias.push(d);}

  const porDia = {};
  items.forEach(i=>{if(!porDia[i.data])porDia[i.data]=[];porDia[i.data].push(i);});

  let html = `<div style="background:var(--card);border:1px solid var(--border);border-radius:12px;overflow:hidden">
    <div style="display:grid;grid-template-columns:repeat(7,1fr)">
    ${dias.map(d=>{
      const ds = d.toISOString().split('T')[0];
      const ehHoje = ds===hoje;
      const dItems = porDia[ds]||[];
      return `<div style="border-right:1px solid var(--border);padding:8px 6px;min-height:120px">
        <div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;margin-bottom:6px">
          ${CAL_DIAS_SEMANA[d.getDay()]}
          <span style="${ehHoje?'background:var(--accent);color:#fff;border-radius:50%;width:22px;height:22px;display:inline-flex;align-items:center;justify-content:center;':'color:var(--text)'}font-size:13px;font-weight:700;margin-left:4px">${d.getDate()}</span>
        </div>
        ${dItems.map(i=>calBadgeSemana(i)).join('')}
      </div>`;
    }).join('')}
    </div></div>`;
  el.innerHTML = html;
}

function calBadgeSemana(item) {
  const cor = item.tipo==='tarefa'?CAL_CORES.tarefa:item.tipo==='reuniao'?CAL_CORES.reuniao:(CAL_CORES[item.tipo_evento]||CAL_CORES.evento);
  return `<div onclick="calAbrirItem('${item.tipo}','${item.id}')"
    style="background:${cor}22;border-left:2px solid ${cor};border-radius:0 4px 4px 0;padding:3px 6px;margin-bottom:3px;cursor:pointer;font-size:11px;color:var(--text)">
    ${item.hora?`<span style="font-size:10px;color:var(--text3)">${item.hora.substring(0,5)} </span>`:''}${escEsc(item.titulo.slice(0,25))}
  </div>`;
}

// ── RENDER DIA ──
function calRenderDia(el, items) {
  const ds = _calData.toISOString().split('T')[0];
  const hoje = new Date().toISOString().split('T')[0];
  const ehHoje = ds===hoje;
  const dItems = items.filter(i=>i.data===ds);
  dItems.sort((a,b)=>(a.hora||'00:00').localeCompare(b.hora||'00:00'));

  // Itens dia inteiro
  const diaInteiro = dItems.filter(i=>i.dia_inteiro||(!i.hora&&i.tipo==='evento'));
  const comHora    = dItems.filter(i=>!i.dia_inteiro&&(i.hora||i.tipo!=='evento'));

  let html = `<div style="background:var(--card);border:1px solid var(--border);border-radius:12px;padding:20px">
    <h3 style="font-size:16px;font-weight:700;color:${ehHoje?'var(--accent)':'var(--text)'};margin-bottom:16px">
      ${_calData.toLocaleDateString('pt-BR',{weekday:'long',day:'2-digit',month:'long',year:'numeric'})}
    </h3>`;

  if(diaInteiro.length) {
    html+=`<div style="margin-bottom:14px">${diaInteiro.map(i=>calItemDia(i,'full')).join('')}</div>`;
  }

  if(!dItems.length) {
    html+=`<div style="color:var(--text3);text-align:center;padding:30px;font-size:13px">Nenhum item para este dia.</div>`;
  } else {
    html+=comHora.map(i=>calItemDia(i)).join('');
  }
  html+=`</div>`;
  el.innerHTML = html;
}

function calItemDia(item, modo='normal') {
  const cor = item.tipo==='tarefa'?CAL_CORES.tarefa:item.tipo==='reuniao'?CAL_CORES.reuniao:(CAL_CORES[item.tipo_evento]||CAL_CORES.evento);
  const TIPO_LABEL = {tarefa:'Tarefa',reuniao:'Reunião',evento:'Evento'};
  return `<div onclick="calAbrirItem('${item.tipo}','${item.id}')"
    style="display:flex;align-items:flex-start;gap:12px;padding:10px 14px;background:${cor}11;border:1px solid ${cor}33;border-radius:8px;margin-bottom:8px;cursor:pointer">
    ${item.hora?`<div style="min-width:46px;font-size:13px;font-weight:700;color:${cor}">${item.hora.substring(0,5)}</div>`:`<div style="min-width:46px;font-size:11px;color:var(--text3)">dia todo</div>`}
    <div style="flex:1">
      <div style="font-size:13px;font-weight:500;color:var(--text)">${escEsc(item.titulo)}</div>
      <div style="font-size:11px;color:var(--text3);margin-top:2px">
        <span style="background:${cor}33;border-radius:3px;padding:1px 6px;color:${cor}">${TIPO_LABEL[item.tipo]||item.tipo_evento||'Evento'}</span>
        ${item.area?` · ${item.area}`:''}
        ${item.responsavel?` · ${item.responsavel}`:''}
      </div>
    </div>
  </div>`;
}

// ── RENDER LISTA ──
function calRenderLista(el, items) {
  const hoje = new Date().toISOString().split('T')[0];
  if(!items.length){
    el.innerHTML=`<div style="color:var(--text3);text-align:center;padding:40px">Nenhum item nos próximos 30 dias.</div>`;
    return;
  }

  // Agrupar por data
  const grupos = {};
  items.forEach(i=>{if(!grupos[i.data])grupos[i.data]=[];grupos[i.data].push(i);});
  const datas = Object.keys(grupos).sort();

  const TIPO_LABEL={tarefa:'Tarefa',reuniao:'Reunião',evento:'Evento'};
  el.innerHTML = datas.map(data=>{
    const ehHoje  = data===hoje;
    const amanha  = new Date(); amanha.setDate(amanha.getDate()+1);
    const ehAm    = data===amanha.toISOString().split('T')[0];
    const dtObj   = new Date(data+'T12:00:00');
    const dtLabel = ehHoje?'Hoje':ehAm?'Amanhã':dtObj.toLocaleDateString('pt-BR',{weekday:'short',day:'2-digit',month:'2-digit'});
    const dItems  = grupos[data].sort((a,b)=>(a.hora||'00:00').localeCompare(b.hora||'00:00'));
    return `
      <div style="margin-bottom:20px">
        <div style="font-size:12px;font-weight:700;color:${ehHoje?'var(--accent)':'var(--text3)'};letter-spacing:.05em;margin-bottom:8px;padding-left:4px">${dtLabel.toUpperCase()}</div>
        ${dItems.map(i=>{
          const cor=i.tipo==='tarefa'?CAL_CORES.tarefa:i.tipo==='reuniao'?CAL_CORES.reuniao:(CAL_CORES[i.tipo_evento]||CAL_CORES.evento);
          return `<div onclick="calAbrirItem('${i.tipo}','${i.id}')"
            style="display:flex;align-items:center;gap:12px;padding:10px 14px;border-left:3px solid ${cor};background:var(--card);border-radius:0 8px 8px 0;margin-bottom:6px;cursor:pointer">
            <div style="min-width:44px;font-size:12px;font-weight:600;color:${cor}">${i.hora?i.hora.substring(0,5):'—'}</div>
            <div style="flex:1">
              <div style="font-size:13px;font-weight:500;color:var(--text)">${escEsc(i.titulo)}</div>
              <div style="font-size:11px;color:var(--text3)">${TIPO_LABEL[i.tipo]||'Evento'}${i.area?` · ${i.area}`:''}${i.responsavel?` · ${i.responsavel}`:''}</div>
            </div>
          </div>`;
        }).join('')}
      </div>`;
  }).join('');
}

function calVerDia(dataStr) {
  _calData = new Date(dataStr+'T12:00:00');
  calSetView('dia');
}

// ── ABRIR ITEM ──
function calAbrirItem(tipo, id) {
  if (tipo==='tarefa') {
    if(typeof tAbrirForm==='function') tAbrirForm(id);
  } else if(tipo==='reuniao') {
    if(typeof rAbrirDetalhe==='function') { rAbrirDetalhe(id); escNavegar('reunioes'); }
  } else if(tipo==='evento') {
    calAbrirFormEvento(id);
  }
}

// ── FORMULÁRIO EVENTO ──
function calAbrirFormEvento(id) {
  _calEvEditId = id||null;
  let ev = null;
  if (id) {
    const encontrado = _calItems.find(x=>x.id===id&&x.tipo==='evento');
    if (encontrado) ev = encontrado._raw;
  }
  const hoje = _calData.toISOString().split('T')[0];

  document.getElementById('esc-modal-title').textContent = ev?'Editar evento':'Novo evento';
  document.getElementById('esc-modal-body').innerHTML = `
    <div class="esc-field">
      <label class="esc-label">Título <span style="color:var(--red)">*</span></label>
      <input class="esc-input" id="ef-titulo" value="${escEsc(ev?.titulo||'')}" placeholder="Nome do evento">
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
      <div class="esc-field">
        <label class="esc-label">Tipo</label>
        <select class="esc-select" id="ef-tipo">
          ${CAL_TIPOS_EVENTO.map(t=>`<option value="${t}" ${ev?.tipo===t?'selected':''}>${t}</option>`).join('')}
        </select>
      </div>
      <div class="esc-field">
        <label class="esc-label">Área</label>
        <select class="esc-select" id="ef-area">
          <option value="">Nenhuma</option>
          ${CAL_AREAS.map(a=>`<option value="${a}" ${ev?.area===a?'selected':''}>${a}</option>`).join('')}
        </select>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px">
      <div class="esc-field">
        <label class="esc-label">Data <span style="color:var(--red)">*</span></label>
        <input class="esc-input" type="date" id="ef-data" value="${ev?.data_inicio||hoje}">
      </div>
      <div class="esc-field">
        <label class="esc-label">Início</label>
        <input class="esc-input" type="time" id="ef-hora-ini" value="${ev?.hora_inicio||''}">
      </div>
      <div class="esc-field">
        <label class="esc-label">Fim</label>
        <input class="esc-input" type="time" id="ef-hora-fim" value="${ev?.hora_fim||''}">
      </div>
    </div>
    <div class="esc-field" style="display:flex;align-items:center;gap:10px">
      <input type="checkbox" id="ef-inteiro" ${ev?.dia_inteiro?'checked':''} style="width:16px;height:16px;accent-color:var(--accent)">
      <label for="ef-inteiro" style="font-size:13px;color:var(--text2);cursor:pointer">Dia inteiro</label>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
      <div class="esc-field">
        <label class="esc-label">Responsável</label>
        <select class="esc-select" id="ef-resp">
          <option value="">Selecionar</option>
          ${CAL_RESP.map(r=>`<option value="${r}" ${ev?.responsavel_id===r?'selected':''}>${r}</option>`).join('')}
        </select>
      </div>
      <div class="esc-field">
        <label class="esc-label">Local</label>
        <input class="esc-input" id="ef-local" value="${escEsc(ev?.local||'')}" placeholder="Local ou plataforma">
      </div>
    </div>
    <div class="esc-field">
      <label class="esc-label">Descrição</label>
      <textarea class="esc-textarea" id="ef-desc" rows="2" placeholder="Detalhes opcionais...">${escEsc(ev?.descricao||'')}</textarea>
    </div>
    <div class="esc-field">
      <label class="esc-label">Link</label>
      <input class="esc-input" id="ef-link" value="${escEsc(ev?.link||'')}" placeholder="https://...">
    </div>
    <div style="display:flex;gap:10px;justify-content:flex-end">
      ${ev?`<button class="btn btn-secondary btn-sm" style="color:var(--red);border-color:var(--red)" onclick="calExcluirEvento('${ev.id}')">Excluir</button>`:''}
      <button class="btn btn-secondary" onclick="escFecharModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="calSalvarEvento()">${ev?'Salvar':'Criar evento'}</button>
    </div>`;
  if(typeof escAbrirModal==='function'){escAbrirModal();}else{const _ov=document.getElementById('esc-modal-overlay');if(_ov){_ov.style.opacity='1';_ov.style.pointerEvents='all';_ov.classList.add('open');}}
  document.getElementById('ef-titulo')?.focus();
}

async function calSalvarEvento() {
  const titulo = document.getElementById('ef-titulo')?.value?.trim();
  const data   = document.getElementById('ef-data')?.value;
  if(!titulo){ escToast('Informe o título.'); return; }
  if(!data)  { escToast('Informe a data.'); return; }

  const obj = {
    titulo, data_inicio:data,
    tipo:           document.getElementById('ef-tipo')?.value||'Compromisso',
    area:           document.getElementById('ef-area')?.value||null,
    hora_inicio:    document.getElementById('ef-hora-ini')?.value||null,
    hora_fim:       document.getElementById('ef-hora-fim')?.value||null,
    dia_inteiro:    document.getElementById('ef-inteiro')?.checked||false,
    responsavel_id: document.getElementById('ef-resp')?.value||null,
    local:          document.getElementById('ef-local')?.value||null,
    descricao:      document.getElementById('ef-desc')?.value||null,
    link:           document.getElementById('ef-link')?.value||null,
    status:         'ativo',
    created_by:     ESC_STATE?.usuario||'Jéssica',
    updated_at:     new Date().toISOString(),
  };

  try {
    if (_calEvEditId) {
      await fetch(ESC_SUPA_URL+'/rest/v1/escritorio_eventos?id=eq.'+_calEvEditId,{
        method:'PATCH', headers:{'apikey':ESC_SUPA_KEY,'Authorization':'Bearer '+ESC_SUPA_KEY,'Content-Type':'application/json','Prefer':'return=minimal'},
        body:JSON.stringify(obj)
      });
      escToast('Evento atualizado!');
    } else {
      await fetch(ESC_SUPA_URL+'/rest/v1/escritorio_eventos',{
        method:'POST', headers:{'apikey':ESC_SUPA_KEY,'Authorization':'Bearer '+ESC_SUPA_KEY,'Content-Type':'application/json','Prefer':'return=minimal'},
        body:JSON.stringify(obj)
      });
      escToast('Evento criado!');
    }
    escFecharModal();
    await calCarregarPeriodo();
  } catch(e){ escToast('Erro ao salvar evento.'); }
}

async function calExcluirEvento(id) {
  if(!confirm('Excluir este evento?')) return;
  try {
    await fetch(ESC_SUPA_URL+'/rest/v1/escritorio_eventos?id=eq.'+id,{
      method:'DELETE', headers:{'apikey':ESC_SUPA_KEY,'Authorization':'Bearer '+ESC_SUPA_KEY}
    });
    escToast('Evento excluído.');
    escFecharModal();
    await calCarregarPeriodo();
  } catch(e){ escToast('Erro ao excluir.'); }
}
