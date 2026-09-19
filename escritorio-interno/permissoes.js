/* ══════════════════════════════════════════════════
   MÓDULO PERMISSÕES — escritorio-interno
   Camada central de controle de acesso
   ══════════════════════════════════════════════════ */

// ── CONTEXTO CENTRAL DO USUÁRIO ──
// Carregado uma vez e reutilizado por todos os módulos
const ESC_CTX = {
  usuario:     null,   // nome
  role:        null,   // 'admin' | 'equipe'
  usuario_id:  null,   // ID na tabela escritorio_usuarios
  auth_user_id:null,   // futuro: Supabase Auth UID
  permissoes:  {},     // { 'tarefas': {can_view,can_create,can_edit,can_delete}, ... }
  carregado:   false,
};

// ── CARREGAR CONTEXTO COMPLETO ──
async function escCarregarContexto() {
  if (ESC_CTX.carregado) return ESC_CTX;

  const nomeSession = sessionStorage.getItem('esc_nome') || 'Jéssica';
  const perfilSession = sessionStorage.getItem('esc_perfil') || 'colaborador';
  ESC_CTX.usuario = nomeSession;

  // 1. Buscar usuário na tabela
  try {
    const data = await escGet(`/rest/v1/escritorio_usuarios?nome=eq.${encodeURIComponent(nomeSession)}&limit=1`);
    if (Array.isArray(data) && data[0]) {
      const u = data[0];
      ESC_CTX.usuario_id  = u.id;
      ESC_CTX.auth_user_id = u.auth_user_id;
      ESC_CTX.role = u.role || (u.perfil === 'admin' ? 'admin' : 'equipe');
    } else {
      // Fallback: usar sessão
      ESC_CTX.role = perfilSession === 'admin' ? 'admin' : 'equipe';
    }
  } catch(e) {
    ESC_CTX.role = perfilSession === 'admin' ? 'admin' : 'equipe';
  }

  // 2. Buscar permissões do role
  try {
    const perms = await escGet(`/rest/v1/escritorio_permissoes?role=eq.${ESC_CTX.role}`);
    if (Array.isArray(perms)) {
      perms.forEach(p => {
        ESC_CTX.permissoes[p.resource] = {
          can_view:   p.can_view,
          can_create: p.can_create,
          can_edit:   p.can_edit,
          can_delete: p.can_delete,
        };
      });
    }
  } catch(e) {
    // Fallback: admin vê tudo, equipe vê o básico
    escSetPermissoesFallback();
  }

  // Sincronizar com ESC_STATE
  if (typeof ESC_STATE !== 'undefined') {
    ESC_STATE.perfil     = ESC_CTX.role;
    ESC_STATE.usuario    = ESC_CTX.usuario;
    ESC_STATE.usuario_id = ESC_CTX.usuario_id;
  }

  ESC_CTX.carregado = true;
  return ESC_CTX;
}

function escSetPermissoesFallback() {
  const recursos = ['tarefas','projetos','reunioes','caixa','decisoes','planejamento','calendario','rotinas','equipe','permissoes'];
  recursos.forEach(r => {
    const isAdmin = ESC_CTX.role === 'admin';
    ESC_CTX.permissoes[r] = {
      can_view:   isAdmin || ['tarefas','projetos','reunioes','caixa','calendario','rotinas','decisoes'].includes(r),
      can_create: isAdmin || ['tarefas','caixa','calendario'].includes(r),
      can_edit:   isAdmin || ['tarefas','caixa','calendario'].includes(r),
      can_delete: isAdmin,
    };
  });
}

// ── FUNÇÃO CENTRAL: can(resource, action) ──
function can(resource, action) {
  if (!ESC_CTX.carregado) return ESC_CTX.role === 'admin'; // safe default
  if (ESC_CTX.role === 'admin') return true;
  const perm = ESC_CTX.permissoes[resource];
  if (!perm) return false;
  switch(action) {
    case 'view':   return perm.can_view;
    case 'create': return perm.can_create;
    case 'edit':   return perm.can_edit;
    case 'delete': return perm.can_delete;
    default:       return false;
  }
}

// ── FILTRO DE DADOS POR VISIBILIDADE ──
// Filtra uma lista de registros conforme as regras de visibilidade
async function escFiltrarPorVisibilidade(lista, resourceType) {
  if (ESC_CTX.role === 'admin') return lista; // admin vê tudo
  if (!Array.isArray(lista)) return [];

  // Buscar compartilhamentos específicos com o usuário
  let idsCompartilhados = new Set();
  if (ESC_CTX.usuario_id) {
    try {
      const comps = await escGet(
        `/rest/v1/escritorio_compartilhamentos?user_id=eq.${ESC_CTX.usuario_id}&resource_type=eq.${resourceType}&select=resource_id`
      );
      (comps||[]).forEach(c => idsCompartilhados.add(c.resource_id));
    } catch(e) {}
  }

  const nomeUsuario = ESC_CTX.usuario;
  return lista.filter(item => {
    const vis = item.visibility || 'team';

    // Próprio (criador ou responsável) — sempre visível
    if (item.created_by === nomeUsuario || item.responsavel_id === nomeUsuario) return true;

    // Compartilhado especificamente
    if (idsCompartilhados.has(item.id)) return true;

    // Por visibilidade
    if (vis === 'team' || vis === 'shared') return true;
    if (vis === 'private') return false;

    return true; // sem visibility = visível
  });
}

// ── TELA DE ACESSO NEGADO ──
function escNegarAcesso(motivo) {
  const content = document.getElementById('esc-content');
  if (!content) return;
  content.innerHTML = `
    <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:300px;text-align:center;color:var(--text3)">
      <div style="font-size:40px;margin-bottom:16px;opacity:.3">🔒</div>
      <div style="font-size:16px;font-weight:600;color:var(--text2);margin-bottom:8px">Você não tem acesso a esta área</div>
      <div style="font-size:13px;max-width:360px;line-height:1.6">${motivo||'Este conteúdo não está disponível para o seu perfil.'}</div>
      <button class="btn btn-secondary btn-sm" style="margin-top:20px" onclick="escNavegar('equipe')">← Voltar ao meu escritório</button>
    </div>`;
}

// ── TELA DE USUÁRIOS (admin) ──
async function escRenderUsuarios(el) {
  if (!can('equipe','view')) { // equipe não acessa
    escNegarAcesso('Somente administradores podem gerenciar usuários.');
    return;
  }

  el.innerHTML = `<div style="color:var(--text3);text-align:center;padding:20px">Carregando usuários...</div>`;
  let usuarios = [];
  try { usuarios = await escGet('/rest/v1/escritorio_usuarios?order=nome.asc'); }
  catch(e) {}

  const ROLE_BADGE = { admin:'badge-blue', equipe:'badge-gray', gestor:'badge-amber', consulta:'badge-gray' };
  const ROLE_LBL   = { admin:'Admin', equipe:'Equipe', gestor:'Gestor', consulta:'Consulta' };

  el.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px">
      <div>
        <h2 style="font-size:18px;font-weight:700;color:var(--text)">Usuários</h2>
        <div style="font-size:12px;color:var(--text3)">Gerenciamento de acesso ao Escritório Interno</div>
      </div>
      <button class="btn btn-primary" onclick="escAbrirFormUsuario()">+ Novo usuário</button>
    </div>

    <!-- Matriz de permissões resumida -->
    <div class="esc-card" style="margin-bottom:20px">
      <div class="esc-card-title">Matriz de acesso</div>
      <div style="overflow-x:auto">
        <table style="width:100%;border-collapse:collapse;font-size:12px">
          <thead>
            <tr>
              <th style="text-align:left;padding:6px 10px;color:var(--text3);border-bottom:1px solid var(--border)">Recurso</th>
              <th style="text-align:center;padding:6px 10px;color:var(--accent);border-bottom:1px solid var(--border)">Admin</th>
              <th style="text-align:center;padding:6px 10px;color:var(--text2);border-bottom:1px solid var(--border)">Equipe</th>
            </tr>
          </thead>
          <tbody>
            ${[
              ['Tarefas',     'Completo',         'Próprias / atribuídas'],
              ['Projetos',    'Completo',         'Relacionados'],
              ['Reuniões',    'Completo',         'Participantes'],
              ['Caixa',       'Completo',         'Criar / consultar próprias'],
              ['Decisões',    'Completo',         'Apenas team/shared'],
              ['Planejamento','Completo',         'Apenas compartilhado'],
              ['Calendário',  'Completo',         'Relacionado'],
              ['Rotinas',     'Completo',         'Próprias'],
              ['Usuários',    'Completo',         '—'],
              ['Permissões',  'Completo',         '—'],
            ].map(([r,a,e])=>`
              <tr>
                <td style="padding:6px 10px;color:var(--text2);border-bottom:1px solid var(--border)">${r}</td>
                <td style="padding:6px 10px;text-align:center;color:var(--green);border-bottom:1px solid var(--border)">✓ ${a}</td>
                <td style="padding:6px 10px;text-align:center;color:${e==='—'?'var(--red)':'var(--text3)'};border-bottom:1px solid var(--border)">${e==='—'?'✗':''+e}</td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>

    <!-- Lista de usuários -->
    <div class="esc-card">
      <div class="esc-card-title">Usuários cadastrados (${usuarios.length})</div>
      <div class="esc-list">
        ${usuarios.map(u=>`
          <div class="esc-list-item" style="align-items:center">
            <div style="width:36px;height:36px;border-radius:50%;background:var(--accent-dim);display:flex;align-items:center;justify-content:center;font-size:15px;font-weight:700;color:var(--accent);flex-shrink:0">
              ${(u.nome||'?')[0].toUpperCase()}
            </div>
            <div style="flex:1">
              <div style="font-size:13px;font-weight:500;color:var(--text)">${escEsc(u.nome)}</div>
              <div style="font-size:11px;color:var(--text3)">${escEsc(u.email)}${u.cargo?' · '+escEsc(u.cargo):''}</div>
            </div>
            <div style="display:flex;align-items:center;gap:8px">
              <span class="badge ${ROLE_BADGE[u.role||u.perfil]||'badge-gray'}">${ROLE_LBL[u.role||u.perfil]||u.role||u.perfil}</span>
              <span style="font-size:11px;color:${u.ativo?'var(--green)':'var(--red)'}">${u.ativo?'Ativo':'Inativo'}</span>
              <button class="btn btn-secondary btn-sm" onclick="escAbrirFormUsuario('${u.id}')">✏</button>
              <button class="btn btn-secondary btn-sm" style="color:${u.ativo?'var(--amber)':'var(--green)'}"
                onclick="escToggleUsuario('${u.id}',${!u.ativo})">${u.ativo?'Desativar':'Ativar'}</button>
            </div>
          </div>`).join('')}
      </div>
    </div>`;
}

// ── FORMULÁRIO DE USUÁRIO ──
function escAbrirFormUsuario(id) {
  if (!can('equipe','view')) return;
  // Reutilizar a função do módulo equipe.js se existir
  if (typeof equipeAbrirFormUsuario === 'function') {
    equipeAbrirFormUsuario(id);
    return;
  }
  escToast('Módulo de usuários não carregado.');
}

async function escToggleUsuario(id, novoAtivo) {
  const confirmMsg = novoAtivo ? 'Ativar este usuário?' : 'Desativar este usuário? Ele não conseguirá mais acessar o sistema.';
  if (!confirm(confirmMsg)) return;
  try {
    await fetch(ESC_SUPA_URL+'/rest/v1/escritorio_usuarios?id=eq.'+id, {
      method:'PATCH',
      headers:{'apikey':ESC_SUPA_KEY,'Authorization':'Bearer '+ESC_SUPA_KEY,'Content-Type':'application/json','Prefer':'return=minimal'},
      body:JSON.stringify({ativo:novoAtivo, updated_at:new Date().toISOString()})
    });
    escToast(novoAtivo?'Usuário ativado!':'Usuário desativado.');
    escRenderUsuarios(document.getElementById('esc-content'));
  } catch(e){ escToast('Erro.'); }
}

async function escAlterarRole(id, novoRole) {
  const msgConf = `Alterar papel para "${novoRole}"? Esta ação afeta o nível de acesso do usuário.`;
  if (!confirm(msgConf)) return;
  try {
    await fetch(ESC_SUPA_URL+'/rest/v1/escritorio_usuarios?id=eq.'+id, {
      method:'PATCH',
      headers:{'apikey':ESC_SUPA_KEY,'Authorization':'Bearer '+ESC_SUPA_KEY,'Content-Type':'application/json','Prefer':'return=minimal'},
      body:JSON.stringify({role:novoRole, perfil:novoRole==='admin'?'admin':'colaborador', updated_at:new Date().toISOString()})
    });
    escToast('Papel alterado!');
    escRenderUsuarios(document.getElementById('esc-content'));
  } catch(e){ escToast('Erro.'); }
}

// ── COMPARTILHAMENTO ──
async function escCompartilhar(resourceType, resourceId, userId, permission='view') {
  if (!can(resourceType, 'edit')) { escToast('Sem permissão para compartilhar.'); return; }
  try {
    await fetch(ESC_SUPA_URL+'/rest/v1/escritorio_compartilhamentos', {
      method:'POST',
      headers:{'apikey':ESC_SUPA_KEY,'Authorization':'Bearer '+ESC_SUPA_KEY,'Content-Type':'application/json','Prefer':'return=minimal'},
      body:JSON.stringify({ resource_type:resourceType, resource_id:resourceId, user_id:userId, permission, created_by:ESC_CTX.usuario })
    });
    escToast('Compartilhado!');
  } catch(e){ escToast('Erro ao compartilhar.'); }
}

// ── GUARD DE NAVEGAÇÃO ──
// Chamado pelo escritorio.js antes de renderizar um módulo
async function escGuardNavegacao(modulo) {
  await escCarregarContexto();
  const RECURSO_MAP = {
    tarefas:'tarefas', projetos:'projetos', reunioes:'reunioes',
    caixa:'caixa', decisoes:'decisoes', planejamento:'planejamento',
    calendario:'calendario', rotinas:'rotinas', equipe:'equipe',
    usuarios:'equipe', permissoes:'permissoes',
  };
  const recurso = RECURSO_MAP[modulo];
  if (!recurso) return true; // dashboard, etc: libera
  if (!can(recurso, 'view')) {
    escNegarAcesso();
    return false;
  }
  return true;
}
