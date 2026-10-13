/* ══════════════════════════════════════════════════
   JS AUTH — login real via Supabase Auth
   Usado pelo sistema principal (/) e pelo Escritório (/escritorio-interno/).
   Nenhuma senha fica no código: o Supabase confere e devolve um token.
   Toda chamada ao Supabase passa a levar o token da usuária logada.
   ══════════════════════════════════════════════════ */
(function () {
  const URL  = 'https://lnfghtlrzoioaotamzvy.supabase.co';
  const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxuZmdodGxyem9pb2FvdGFtenZ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY3MDg5MTMsImV4cCI6MjA5MjI4NDkxM30.lNHckve8P--rp9axdwZ6v6zTl4LLnk-1xY_kJS3wfFo';
  const KEY  = 'js_auth_session';
  const nativeFetch = window.fetch.bind(window);

  function load() {
    try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { return null; }
  }
  function save(s) {
    try { s ? localStorage.setItem(KEY, JSON.stringify(s)) : localStorage.removeItem(KEY); } catch (e) {}
  }
  let session = load();
  let refreshing = null;

  async function tokenRequest(grant, body) {
    const r = await nativeFetch(URL + '/auth/v1/token?grant_type=' + grant, {
      method: 'POST',
      headers: { apikey: ANON, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok || !d.access_token) throw new Error(d.error_description || d.msg || 'Falha no login');
    return {
      access_token: d.access_token,
      refresh_token: d.refresh_token,
      expires_at: Date.now() + (d.expires_in || 3600) * 1000,
      email: (d.user && d.user.email) || (session && session.email) || '',
      perfil: session && session.perfil,
    };
  }

  async function carregarPerfil(s) {
    const r = await nativeFetch(URL + '/rest/v1/escritorio_usuarios?select=nome,role,perfil&email=eq.' + encodeURIComponent(s.email), {
      headers: { apikey: ANON, Authorization: 'Bearer ' + s.access_token },
    });
    const d = await r.json().catch(() => []);
    const u = Array.isArray(d) && d[0];
    if (!u) throw new Error('Usuária sem acesso a este sistema.');
    const admin = u.role === 'admin' || u.perfil === 'admin';
    return { nome: u.nome, role: admin ? 'admin' : 'colaborador' };
  }

  async function ensureFresh() {
    if (!session) return null;
    if (session.expires_at - Date.now() > 120000) return session;
    if (!refreshing) {
      refreshing = tokenRequest('refresh_token', { refresh_token: session.refresh_token })
        .then(s => { s.perfil = session.perfil; session = s; save(s); return s; })
        .catch(() => { session = null; save(null); return null; })
        .finally(() => { refreshing = null; });
    }
    return refreshing;
  }

  function aplicarPerfilNaSessao(p) {
    // Compatibilidade com o código existente, que lê o nome/papel daqui
    sessionStorage.setItem('js_logged', 'true');
    sessionStorage.setItem('js_nome', p.nome);
    sessionStorage.setItem('esc_logged', 'true');
    sessionStorage.setItem('esc_nome', p.nome);
    sessionStorage.setItem('esc_role', p.role);
    sessionStorage.setItem('esc_perfil', p.role);
  }

  // Toda chamada ao Supabase (exceto login) sai com o token da usuária
  window.fetch = async function (input, init) {
    const url = typeof input === 'string' ? input : (input && input.url) || '';
    if (url.startsWith(URL) && !url.startsWith(URL + '/auth/v1/') && session) {
      const s = await ensureFresh();
      if (s) {
        init = Object.assign({}, init);
        const h = new Headers(init.headers || (typeof input !== 'string' && input.headers) || {});
        h.set('Authorization', 'Bearer ' + s.access_token);
        if (!h.has('apikey')) h.set('apikey', ANON);
        init.headers = h;
      }
    }
    return nativeFetch(input, init);
  };

  window.JSAuth = {
    /** Faz login. Devolve {nome, role} ou lança erro com mensagem. */
    async login(email, senha) {
      const s = await tokenRequest('password', { email: (email || '').trim().toLowerCase(), password: senha || '' });
      s.perfil = await carregarPerfil(s);
      session = s; save(s);
      aplicarPerfilNaSessao(s.perfil);
      return s.perfil;
    },
    /** Confere se há sessão válida (renovando se preciso). Devolve {nome, role} ou null. */
    async restaurar() {
      const s = await ensureFresh();
      if (!s || !s.perfil) { this.limparSessaoLocal(); return null; }
      aplicarPerfilNaSessao(s.perfil);
      return s.perfil;
    },
    async trocarSenha(nova) {
      const s = await ensureFresh();
      if (!s) throw new Error('Sessão expirada. Entre novamente.');
      const r = await nativeFetch(URL + '/auth/v1/user', {
        method: 'PUT',
        headers: { apikey: ANON, Authorization: 'Bearer ' + s.access_token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: nova }),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        throw new Error(d.msg || d.error_description || 'Não foi possível trocar a senha.');
      }
    },
    async logout() {
      const s = session;
      session = null; save(null);
      this.limparSessaoLocal();
      if (s) { try { await nativeFetch(URL + '/auth/v1/logout', { method: 'POST', headers: { apikey: ANON, Authorization: 'Bearer ' + s.access_token } }); } catch (e) {} }
    },
    limparSessaoLocal() {
      ['js_logged', 'js_nome', 'esc_logged', 'esc_nome', 'esc_role', 'esc_perfil'].forEach(k => sessionStorage.removeItem(k));
    },
    token() { return session ? session.access_token : null; },
  };

  // Renova o token em segundo plano e ao voltar para a aba
  setInterval(ensureFresh, 60000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) ensureFresh(); });
})();
