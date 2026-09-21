/* ══════════════════════════════════════════════════
   MÓDULO CONFIGURAÇÕES + INTEGRAÇÕES — escritorio-interno
   Conta, integrações, notificações, sistema
   ══════════════════════════════════════════════════ */

let _configIntegracoes = [];
let _configPrefs       = null;

async function escRenderConfiguracoes(el) {
  el.innerHTML = `<div style="color:var(--text3);text-align:center;padding:20px">Carregando configurações...</div>`;
  const userId = ESC_CTX?.usuario_id || ESC_CTX?.usuario || ESC_STATE?.usuario || 'Jéssica';

  // Carregar dados em paralelo
  let usuario=null, integracoes=[], prefs=null;
  try { const d=await escGet(`/rest/v1/escritorio_usuarios?nome=eq.${encodeURIComponent(ESC_CTX?.usuario||'Jéssica')}&limit=1`); usuario=d[0]||null; } catch(e){}
  try { integracoes=await escGet(`/rest/v1/escritorio_integracoes?user_id=eq.${encodeURIComponent(userId)}`)||[]; } catch(e){}
  try { prefs=await escGet(`/rest/v1/escritorio_preferencias_notificacao?user_id=eq.${encodeURIComponent(userId)}&limit=1`); prefs=prefs[0]||null; } catch(e){}
  _configPrefs = prefs;

  const gcal = integracoes.find(i=>i.provider==='google_calendar');
  const ST_COR = {desconectado:'var(--text3)',conectado:'var(--green)',erro:'var(--red)',pendente:'var(--amber)'};
  const ST_LBL = {desconectado:'Não conectado',conectado:'Conectado',erro:'Erro de conexão',pendente:'Aguardando'};

  el.innerHTML = `
    <div style="max-width:680px">
      <h2 style="font-size:18px;font-weight:700;color:var(--text);margin-bottom:6px">Configurações</h2>
      <div style="font-size:12px;color:var(--text3);margin-bottom:24px">Conta, integrações e preferências do Escritório Interno</div>

      <!-- MINHA CONTA -->
      <div class="esc-card" style="margin-bottom:16px">
        <div class="esc-card-title">Minha conta</div>
        <div style="display:flex;align-items:center;gap:16px;margin-bottom:16px">
          <div style="width:52px;height:52px;border-radius:50%;background:var(--accent-dim);display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:700;color:var(--accent)">${(usuario?.nome||'J')[0]}</div>
          <div>
            <div style="font-size:15px;font-weight:600;color:var(--text)">${escEsc(usuario?.nome||ESC_CTX?.usuario||'—')}</div>
            <div style="font-size:12px;color:var(--text3)">${escEsc(usuario?.email||'—')} · ${escEsc(usuario?.cargo||'—')}</div>
            <span class="badge badge-${usuario?.role==='admin'?'blue':'gray'}" style="margin-top:4px">${usuario?.role==='admin'?'Admin':'Equipe'}</span>
          </div>
        </div>
        <button class="btn btn-secondary btn-sm" onclick="configEditarConta()">✏ Editar perfil</button>
      </div>

      <!-- INTEGRAÇÕES -->
      <div class="esc-card" style="margin-bottom:16px">
        <div class="esc-card-title">Integrações</div>

        <!-- Google Calendar -->
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:16px;padding:14px 0;border-bottom:1px solid var(--border)">
          <div style="display:flex;align-items:flex-start;gap:12px">
            <div style="font-size:26px">📅</div>
            <div>
              <div style="font-size:14px;font-weight:600;color:var(--text)">Google Calendar</div>
              <div style="font-size:12px;color:var(--text3);margin-top:2px">Sincronize reuniões, eventos e compromissos com o Google Calendar.</div>
              <div style="display:flex;align-items:center;gap:6px;margin-top:6px">
                <div style="width:8px;height:8px;border-radius:50%;background:${ST_COR[gcal?.status||'desconectado']}"></div>
                <span style="font-size:12px;color:${ST_COR[gcal?.status||'desconectado']}">${ST_LBL[gcal?.status||'desconectado']}</span>
                ${gcal?.last_sync_at?`<span style="font-size:11px;color:var(--text3)">· Última sync: ${new Date(gcal.last_sync_at).toLocaleDateString('pt-BR')}</span>`:''}
              </div>
              <!-- Status de implementação honesto -->
              <div style="margin-top:8px;padding:8px 12px;background:var(--amber-dim);border-radius:6px;font-size:11px;color:var(--amber)">
                ⚠ Integração OAuth requer configuração de Client ID/Secret no servidor. Tokens nunca são armazenados no frontend. 
                <a href="https://console.cloud.google.com/" target="_blank" style="color:var(--accent)">Configurar no Google Cloud Console →</a>
              </div>
            </div>
          </div>
          <div style="flex-shrink:0">
            ${gcal?.status==='conectado'
              ? `<button class="btn btn-secondary btn-sm" style="color:var(--red)" onclick="configDesconectarIntegracao('${gcal.id}')">Desconectar</button>`
              : `<button class="btn btn-secondary btn-sm" onclick="configIniciarOAuth('google_calendar')" disabled title="Requer configuração de OAuth no servidor">Conectar <span style="font-size:9px;color:var(--text3)">(em breve)</span></button>`}
          </div>
        </div>

        <!-- Futuras integrações -->
        ${[['📧','E-mail','Envio de notificações e resumos por e-mail.'],
           ['💬','WhatsApp','Notificações via WhatsApp Business.']].map(([ic,nm,desc])=>`
          <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:16px;padding:14px 0;border-bottom:1px solid var(--border);opacity:.5">
            <div style="display:flex;gap:12px">
              <div style="font-size:26px">${ic}</div>
              <div>
                <div style="font-size:14px;font-weight:600;color:var(--text)">${nm}</div>
                <div style="font-size:12px;color:var(--text3)">${desc}</div>
                <span class="badge badge-gray" style="margin-top:6px;font-size:9px">Em breve</span>
              </div>
            </div>
          </div>`).join('')}
      </div>

      <!-- NOTIFICAÇÕES -->
      <div class="esc-card" style="margin-bottom:16px">
        <div class="esc-card-title">Preferências de notificação</div>
        <div style="display:flex;flex-direction:column;gap:12px" id="config-notif-prefs">
          ${[
            ['tarefas',         'Tarefas',          'Nova tarefa atribuída, prazo próximo, atraso'],
            ['reunioes',        'Reuniões',          'Lembrete antes de reuniões'],
            ['rotinas',         'Rotinas',           'Rotina pendente de execução'],
            ['solicitacoes',    'Solicitações',      'Solicitações recebidas'],
            ['compartilhamentos','Compartilhamentos', 'Conteúdo compartilhado com você'],
            ['prazos',          'Prazos',            'Tarefas com prazo próximo'],
          ].map(([campo, label, desc])=>`
            <div style="display:flex;align-items:center;justify-content:space-between">
              <div>
                <div style="font-size:13px;color:var(--text)">${label}</div>
                <div style="font-size:11px;color:var(--text3)">${desc}</div>
              </div>
              <label style="position:relative;display:inline-block;width:40px;height:22px;cursor:pointer">
                <input type="checkbox" id="pref-${campo}" ${prefs?.[campo]!==false?'checked':''} onchange="configSalvarPrefs()"
                  style="opacity:0;width:0;height:0">
                <span style="position:absolute;cursor:pointer;inset:0;background:${prefs?.[campo]!==false?'var(--green)':'var(--border)'};border-radius:22px;transition:.2s">
                  <span style="position:absolute;height:16px;width:16px;left:${prefs?.[campo]!==false?'20px':'3px'};bottom:3px;background:#fff;border-radius:50%;transition:.2s"></span>
                </span>
              </label>
            </div>`).join('')}
        </div>
      </div>

      <!-- SISTEMA -->
      <div class="esc-card">
        <div class="esc-card-title">Sistema</div>
        <div style="display:flex;flex-direction:column;gap:8px;font-size:13px">
          <div><span style="color:var(--text3)">Versão: </span><span>Escritório Interno v1.0</span></div>
          <div><span style="color:var(--text3)">Supabase: </span><span style="font-family:var(--mono);font-size:12px">lnfghtlrzoioaotamzvy</span></div>
          <div><span style="color:var(--text3)">Módulos ativos: </span><span>Tarefas, Projetos, Reuniões, Caixa, Decisões, Planejamento, Calendário, Rotinas, Equipe, Usuários, Permissões, Configurações</span></div>
        </div>
      </div>
    </div>`;
}

// ── EDITAR CONTA ──
function configEditarConta() {
  const u = ESC_CTX?.usuario||'Jéssica';
  document.getElementById('esc-modal-title').textContent = 'Editar perfil';
  document.getElementById('esc-modal-body').innerHTML = `
    <div class="esc-field"><label class="esc-label">Nome</label><input class="esc-input" id="cfg-nome" value="${escEsc(u)}"></div>
    <div style="color:var(--text3);font-size:12px;padding:10px;background:var(--bg);border-radius:6px;margin-bottom:12px">
      Para alterar e-mail ou senha, entre em contato com o administrador do sistema.
    </div>
    <div style="display:flex;gap:10px;justify-content:flex-end">
      <button class="btn btn-secondary" onclick="escFecharModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="configSalvarConta()">Salvar</button>
    </div>`;
  if(typeof escAbrirModal==='function'){escAbrirModal();}else{const _ov=document.getElementById('esc-modal-overlay');if(_ov){_ov.style.opacity='1';_ov.style.pointerEvents='all';_ov.classList.add('open');}}
}

async function configSalvarConta() {
  const novoNome = document.getElementById('cfg-nome')?.value?.trim();
  if (!novoNome) { escToast('Informe o nome.'); return; }
  if (ESC_CTX?.usuario_id) {
    try {
      await fetch(ESC_SUPA_URL+'/rest/v1/escritorio_usuarios?id=eq.'+ESC_CTX.usuario_id,{
        method:'PATCH',
        headers:{'apikey':ESC_SUPA_KEY,'Authorization':'Bearer '+ESC_SUPA_KEY,'Content-Type':'application/json','Prefer':'return=minimal'},
        body:JSON.stringify({nome:novoNome, updated_at:new Date().toISOString()})
      });
      ESC_CTX.usuario = novoNome;
      if(typeof ESC_STATE!=='undefined') ESC_STATE.usuario = novoNome;
      sessionStorage.setItem('esc_nome', novoNome);
      const el=document.getElementById('esc-user-name'); if(el) el.textContent=novoNome;
      escToast('Perfil atualizado!');
      escFecharModal();
      escRenderConfiguracoes(document.getElementById('esc-content'));
    } catch(e){ escToast('Erro ao salvar.'); }
  } else { escToast('Não foi possível identificar o usuário no banco.'); }
}

// ── SALVAR PREFERÊNCIAS DE NOTIFICAÇÃO ──
async function configSalvarPrefs() {
  const userId = ESC_CTX?.usuario_id || ESC_CTX?.usuario || ESC_STATE?.usuario || 'Jéssica';
  const campos = ['tarefas','reunioes','rotinas','solicitacoes','compartilhamentos','prazos'];
  const obj = { user_id:userId, updated_at:new Date().toISOString() };
  campos.forEach(c=>{ obj[c]=document.getElementById('pref-'+c)?.checked!==false; });
  try {
    // Upsert
    await fetch(ESC_SUPA_URL+'/rest/v1/escritorio_preferencias_notificacao',{
      method:'POST',
      headers:{'apikey':ESC_SUPA_KEY,'Authorization':'Bearer '+ESC_SUPA_KEY,'Content-Type':'application/json','Prefer':'resolution=merge-duplicates,return=minimal'},
      body:JSON.stringify(obj)
    });
    escToast('Preferências salvas!');
  } catch(e){ escToast('Erro ao salvar preferências.'); }
}

// ── OAUTH GOOGLE (estrutura preparada, não implementado) ──
function configIniciarOAuth(provider) {
  escToast('Integração com ' + provider + ' requer configuração de OAuth no servidor. Nenhum token é armazenado no frontend.');
  // Arquitetura preparada:
  // 1. Frontend redireciona para Edge Function de auth
  // 2. Edge Function realiza OAuth com Google
  // 3. Token é armazenado de forma segura no servidor (nunca no JS público)
  // 4. Edge Function retorna apenas um token_ref (ID) para o frontend
  // 5. Frontend salva apenas o token_ref na tabela escritorio_integracoes
}

async function configDesconectarIntegracao(id) {
  if (!confirm('Desconectar esta integração?')) return;
  try {
    await fetch(ESC_SUPA_URL+'/rest/v1/escritorio_integracoes?id=eq.'+id,{
      method:'PATCH',
      headers:{'apikey':ESC_SUPA_KEY,'Authorization':'Bearer '+ESC_SUPA_KEY,'Content-Type':'application/json','Prefer':'return=minimal'},
      body:JSON.stringify({status:'desconectado', token_ref:null, updated_at:new Date().toISOString()})
    });
    // Log
    await fetch(ESC_SUPA_URL+'/rest/v1/escritorio_integracao_logs',{
      method:'POST',
      headers:{'apikey':ESC_SUPA_KEY,'Authorization':'Bearer '+ESC_SUPA_KEY,'Content-Type':'application/json','Prefer':'return=minimal'},
      body:JSON.stringify({integracao_id:id, tipo:'desconexao', status:'sucesso', mensagem:'Integração desconectada pelo usuário.'})
    });
    escToast('Integração desconectada.');
    escRenderConfiguracoes(document.getElementById('esc-content'));
  } catch(e){ escToast('Erro.'); }
}
