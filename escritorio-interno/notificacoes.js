/* ══════════════════════════════════════════════════
   MÓDULO NOTIFICAÇÕES — escritorio-interno
   Central de notificações internas
   ══════════════════════════════════════════════════ */

let _notifCache  = [];
let _notifNaoLidas = 0;
let _notifTimer  = null;

// ── INICIALIZAR (chamado no escInit) ──
async function notifInicializar() {
  await notifCarregar();
  notifRenderBadge();
  // Atualizar a cada 2 minutos (não polling agressivo)
  if (_notifTimer) clearInterval(_notifTimer);
  _notifTimer = setInterval(async () => {
    await notifCarregar();
    notifRenderBadge();
  }, 120000);
}

// ── CARREGAR NOTIFICAÇÕES ──
async function notifCarregar() {
  const userId = ESC_CTX?.usuario || ESC_STATE?.usuario || 'Jéssica';
  try {
    const data = await escGet(
      `/rest/v1/escritorio_notificacoes?user_id=eq.${encodeURIComponent(userId)}&order=created_at.desc&limit=30`
    );
    _notifCache = Array.isArray(data) ? data : [];
    _notifNaoLidas = _notifCache.filter(n=>!n.lida).length;
  } catch(e) {
    _notifCache = [];
    _notifNaoLidas = 0;
  }
}

// ── BADGE NO HEADER ──
function notifRenderBadge() {
  const el = document.getElementById('notif-badge');
  if (!el) return;
  if (_notifNaoLidas > 0) {
    el.textContent = _notifNaoLidas > 9 ? '9+' : _notifNaoLidas;
    el.style.display = 'flex';
  } else {
    el.style.display = 'none';
  }
}

// ── PAINEL DE NOTIFICAÇÕES ──
function notifAbrirPainel() {
  document.getElementById('esc-modal-title').textContent = '🔔 Notificações';
  const TIPO_ICON = {
    tarefa_atribuida:'✅', prazo_proximo:'⏰', tarefa_atrasada:'🔴',
    reuniao_proxima:'📅', rotina_pendente:'🔄', compartilhamento:'🔗', caixa_entrada:'📥'
  };
  const naoLidas = _notifCache.filter(n=>!n.lida);
  const lidas    = _notifCache.filter(n=>n.lida);

  document.getElementById('esc-modal-body').innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
      <span style="font-size:12px;color:var(--text3)">${_notifNaoLidas} não lida(s)</span>
      ${_notifNaoLidas>0?`<button class="btn btn-secondary btn-sm" onclick="notifMarcarTodasLidas()">Marcar todas como lidas</button>`:''}
    </div>
    <div style="max-height:420px;overflow-y:auto">
      ${_notifCache.length===0
        ? `<div style="color:var(--text3);text-align:center;padding:30px;font-size:13px">Nenhuma notificação.</div>`
        : _notifCache.map(n=>`
          <div onclick="notifClicar('${n.id}','${n.resource_type||''}','${n.resource_id||''}')"
            style="display:flex;gap:12px;padding:12px;border-radius:8px;cursor:pointer;margin-bottom:4px;background:${n.lida?'transparent':'var(--accent-dim)'};border:1px solid ${n.lida?'transparent':'var(--accent-border)'}">
            <div style="font-size:20px;flex-shrink:0">${TIPO_ICON[n.tipo]||'🔔'}</div>
            <div style="flex:1">
              <div style="font-size:13px;font-weight:${n.lida?400:600};color:${n.lida?'var(--text2)':'var(--text)'}">${escEsc(n.titulo)}</div>
              ${n.mensagem?`<div style="font-size:12px;color:var(--text3);margin-top:2px;line-height:1.4">${escEsc(n.mensagem)}</div>`:''}
              <div style="font-size:10px;color:var(--text3);margin-top:4px">${notifTempoRelativo(n.created_at)}</div>
            </div>
            ${!n.lida?`<button onclick="event.stopPropagation();notifMarcarLida('${n.id}')" style="background:none;border:none;color:var(--text3);cursor:pointer;font-size:16px;padding:0;flex-shrink:0" title="Marcar como lida">✓</button>`:''}
          </div>`).join('')}
    </div>
    <div style="text-align:center;margin-top:10px">
      <button class="btn btn-secondary btn-sm" onclick="escFecharModal()">Fechar</button>
    </div>`;
  if(typeof escAbrirModal==='function'){escAbrirModal();}else{const _ov=document.getElementById('esc-modal-overlay');if(_ov){_ov.style.opacity='1';_ov.style.pointerEvents='all';_ov.classList.add('open');}}
}

function notifTempoRelativo(ts) {
  if (!ts) return '';
  const diff = Date.now() - new Date(ts).getTime();
  const min  = Math.floor(diff/60000);
  const h    = Math.floor(diff/3600000);
  const d    = Math.floor(diff/86400000);
  if (min<1)  return 'agora';
  if (min<60) return `há ${min} min`;
  if (h<24)   return `há ${h}h`;
  if (d===1)  return 'ontem';
  return `há ${d} dias`;
}

async function notifMarcarLida(id) {
  try {
    const agora=new Date().toISOString();
    await fetch(ESC_SUPA_URL+'/rest/v1/escritorio_notificacoes?id=eq.'+id,{
      method:'PATCH',
      headers:{'apikey':ESC_SUPA_KEY,'Authorization':'Bearer '+ESC_SUPA_KEY,'Content-Type':'application/json','Prefer':'return=minimal'},
      body:JSON.stringify({lida:true, read_at:agora})
    });
    const n=_notifCache.find(x=>x.id===id); if(n){n.lida=true;n.read_at=agora;}
    _notifNaoLidas=Math.max(0,_notifNaoLidas-1);
    notifRenderBadge();
    notifAbrirPainel();
  } catch(e){}
}

async function notifMarcarTodasLidas() {
  const userId = ESC_CTX?.usuario || ESC_STATE?.usuario || 'Jéssica';
  const agora  = new Date().toISOString();
  try {
    await fetch(ESC_SUPA_URL+'/rest/v1/escritorio_notificacoes?user_id=eq.'+encodeURIComponent(userId)+'&lida=eq.false',{
      method:'PATCH',
      headers:{'apikey':ESC_SUPA_KEY,'Authorization':'Bearer '+ESC_SUPA_KEY,'Content-Type':'application/json','Prefer':'return=minimal'},
      body:JSON.stringify({lida:true, read_at:agora})
    });
    _notifCache.forEach(n=>{n.lida=true;n.read_at=agora;});
    _notifNaoLidas=0;
    notifRenderBadge();
    notifAbrirPainel();
  } catch(e){}
}

function notifClicar(id, resourceType, resourceId) {
  notifMarcarLida(id);
  escFecharModal();
  if (!resourceType||!resourceId) return;
  const MAP={tarefas:'tarefas',reunioes:'reunioes',rotinas:'rotinas',decisoes:'decisoes',planejamento:'planejamento'};
  const modulo=MAP[resourceType];
  if(modulo) escNavegar(modulo);
}

// ── CRIAR NOTIFICAÇÃO ──
async function notifCriar(userId, tipo, titulo, mensagem, resourceType, resourceId) {
  // Deduplicação: verificar se já existe notificação idêntica recente (últimas 24h)
  const janela=new Date(Date.now()-86400000).toISOString();
  try {
    const existing=await escGet(
      `/rest/v1/escritorio_notificacoes?user_id=eq.${encodeURIComponent(userId)}&tipo=eq.${tipo}&resource_id=eq.${resourceId}&created_at=gte.${janela}&limit=1`
    );
    if(Array.isArray(existing)&&existing.length>0) return; // já existe
  } catch(e){}

  try {
    await fetch(ESC_SUPA_URL+'/rest/v1/escritorio_notificacoes',{
      method:'POST',
      headers:{'apikey':ESC_SUPA_KEY,'Authorization':'Bearer '+ESC_SUPA_KEY,'Content-Type':'application/json','Prefer':'return=minimal'},
      body:JSON.stringify({user_id:userId, tipo, titulo, mensagem, resource_type:resourceType, resource_id:resourceId})
    });
    if(userId===(ESC_CTX?.usuario||ESC_STATE?.usuario)){
      _notifNaoLidas++;
      notifRenderBadge();
    }
  } catch(e){ console.error('notifCriar:',e); }
}

// ── NOTIFICAR TAREFA ATRIBUÍDA ──
async function notifTarefaAtribuida(tarefa) {
  if (!tarefa.responsavel_id) return;
  const criador = ESC_CTX?.usuario||ESC_STATE?.usuario||'Jéssica';
  if (tarefa.responsavel_id === criador) return; // não notifica a si mesmo
  await notifCriar(
    tarefa.responsavel_id,
    'tarefa_atribuida',
    'Nova tarefa atribuída',
    `Você recebeu uma nova tarefa: "${tarefa.titulo}"`,
    'tarefas', tarefa.id
  );
}

// ── VERIFICAR PRAZOS (chamado no init, não agressivo) ──
async function notifVerificarPrazos() {
  const userId = ESC_CTX?.usuario||ESC_STATE?.usuario||'Jéssica';
  const amanha = new Date(); amanha.setDate(amanha.getDate()+1);
  const amanhaStr = amanha.toISOString().split('T')[0];
  const hoje = new Date().toISOString().split('T')[0];

  try {
    // Tarefas vencendo amanhã (apenas do usuário logado)
    const prox=await escGet(
      `/rest/v1/escritorio_tarefas?responsavel_id=eq.${encodeURIComponent(userId)}&prazo=eq.${amanhaStr}&status=neq.concluida&limit=5`
    );
    for(const t of (prox||[])){
      await notifCriar(userId,'prazo_proximo','Prazo amanhã',`"${t.titulo}" vence amanhã.`,'tarefas',t.id+'_prazo_'+amanhaStr);
    }
    // Tarefas atrasadas
    const atras=await escGet(
      `/rest/v1/escritorio_tarefas?responsavel_id=eq.${encodeURIComponent(userId)}&prazo=lt.${hoje}&status=neq.concluida&limit=3`
    );
    for(const t of (atras||[])){
      await notifCriar(userId,'tarefa_atrasada','Tarefa atrasada',`"${t.titulo}" está com prazo vencido.`,'tarefas',t.id+'_atrasada_'+hoje);
    }
  } catch(e){}
}
