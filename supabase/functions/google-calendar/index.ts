// Google Agenda ⇄ Escritório Interno (sentido único: Escritório → Google)
//
// Ações (POST JSON):
//   start       — (usuária logada) devolve a URL de autorização do Google
//   status      — (usuária logada) diz se está conectada e com qual e-mail
//   disconnect  — (usuária logada) desconecta e apaga os tokens
//   sync        — (gatilho do banco) sincroniza um item {tipo, id}
//   sync_all    — (usuária logada) sincroniza os itens futuros dela
// GET ?code&state — retorno do Google depois da autorização
//
// Segredos necessários: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPA_URL = Deno.env.get("SUPABASE_URL")!;
const SRK = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID") ?? "";
const CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET") ?? "";
const REDIRECT_URI = `${SUPA_URL}/functions/v1/google-calendar`;
const SITE = "https://www.ecoladenegociosjs.com/escritorio-interno/";
const TZ = "America/Sao_Paulo";
const SCOPES = "https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/tasks openid email";

const db = createClient(SUPA_URL, SRK, { auth: { persistSession: false } });

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...CORS, "Content-Type": "application/json" } });

// ── quem está chamando ──
async function usuariaLogada(req: Request): Promise<string | null> {
  const jwt = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (!jwt) return null;
  const { data } = await db.auth.getUser(jwt);
  const email = data?.user?.email;
  if (!email) return null;
  const { data: u } = await db.from("escritorio_usuarios").select("nome,ativo").ilike("email", email).maybeSingle();
  return u && u.ativo !== false ? u.nome : null;
}

// ── tokens do Google ──
async function tokenDe(usuario: string): Promise<string | null> {
  const { data: t } = await db.from("escritorio_google_tokens").select("*").eq("usuario", usuario).maybeSingle();
  if (!t) return null;
  if (t.access_token && t.expires_at && new Date(t.expires_at).getTime() - Date.now() > 60_000) return t.access_token;
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: CLIENT_ID, client_secret: CLIENT_SECRET,
      refresh_token: t.refresh_token, grant_type: "refresh_token",
    }),
  });
  const d = await r.json();
  if (!r.ok || !d.access_token) {
    await marcarIntegracao(usuario, "erro", { erro: d.error || "refresh_falhou" });
    return null;
  }
  await db.from("escritorio_google_tokens").update({
    access_token: d.access_token,
    expires_at: new Date(Date.now() + (d.expires_in || 3600) * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  }).eq("usuario", usuario);
  return d.access_token;
}

async function marcarIntegracao(usuario: string, status: string, extra: Record<string, unknown> = {}) {
  const { data: atual } = await db.from("escritorio_integracoes").select("id").eq("user_id", usuario).eq("provider", "google_calendar").maybeSingle();
  const row = { user_id: usuario, provider: "google_calendar", status, sync_mode: "escritorio_para_google", metadata: extra, updated_at: new Date().toISOString(), ...(status === "conectado" ? { last_sync_at: new Date().toISOString() } : {}) };
  if (atual) await db.from("escritorio_integracoes").update(row).eq("id", atual.id);
  else await db.from("escritorio_integracoes").insert({ id: `in_${Date.now()}_${crypto.randomUUID().slice(0, 5)}`, ...row });
}

// ── montar o evento a partir do item ──
const TABELA: Record<string, string> = { tarefa: "escritorio_tarefas", reuniao: "escritorio_reunioes", evento: "escritorio_eventos" };

function idGoogle(tipo: string, id: string) {
  // ids do Google aceitam apenas a-v e 0-9: usamos hex
  return "esc" + Array.from(new TextEncoder().encode(`${tipo}_${id}`)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
function maisUmDia(d: string) {
  const x = new Date(d + "T12:00:00Z"); x.setUTCDate(x.getUTCDate() + 1); return x.toISOString().slice(0, 10);
}
function hhmm(t?: string | null) { return t ? t.slice(0, 5) : null; }
function somarHora(t: string, h = 1) {
  const [a, b] = t.split(":").map(Number); const m = a * 60 + b + h * 60;
  return `${String(Math.min(23, Math.floor(m / 60))).padStart(2, "0")}:${String(m >= 24 * 60 ? 59 : m % 60).padStart(2, "0")}`;
}
function quando(data: string, ini?: string | null, fim?: string | null, dataFim?: string | null) {
  if (!ini) return { start: { date: data }, end: { date: maisUmDia(dataFim || data) } };
  const f = fim || somarHora(ini);
  return {
    start: { dateTime: `${data}T${ini}:00`, timeZone: TZ },
    end: { dateTime: `${dataFim || data}T${f}:00`, timeZone: TZ },
  };
}

// deve existir no Google? e com qual conteúdo
function montar(tipo: string, it: any): Record<string, unknown> | null {
  const rodape = "\n\n— Escritório Interno";
  const base = { extendedProperties: { private: { escritorio_tipo: tipo, escritorio_id: it.id } }, reminders: { useDefault: true }, status: "confirmed" };
  if (tipo === "reuniao") {
    const data = it.data || (it.data_hora_inicio || "").slice(0, 10);
    if (!data || it.status === "cancelada") return null;
    const desc = [it.objetivo && `Objetivo: ${it.objetivo}`, it.pauta && `Pauta:\n${it.pauta}`, it.link].filter(Boolean).join("\n\n");
    return { ...base, summary: it.titulo, location: it.link || it.local || undefined, description: desc + rodape, ...quando(data, hhmm(it.hora_inicio), hhmm(it.hora_fim)) };
  }
  if (tipo === "evento") {
    if (!it.data_inicio || (it.status && it.status !== "ativo")) return null;
    const ini = it.dia_inteiro ? null : hhmm(it.hora_inicio);
    return { ...base, summary: it.titulo, location: it.local || it.link || undefined, description: [it.descricao, it.link].filter(Boolean).join("\n\n") + rodape, ...quando(it.data_inicio, ini, hhmm(it.hora_fim), it.data_fim) };
  }
  return null;
}

async function gcal(token: string, method: string, path: string, body?: unknown) {
  const r = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events${path}`, {
    method, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  return r;
}

// ── TAREFAS → Google Tasks (com check de concluir) ──
async function gtasks(token: string, method: string, path: string, body?: unknown) {
  return fetch(`https://tasks.googleapis.com/tasks/v1${path}`, {
    method, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
}

async function syncTarefa(id: string) {
  const { data: conectadas } = await db.from("escritorio_google_tokens").select("usuario");
  if (!conectadas?.length) return { ok: true, motivo: "ninguém conectada" };
  const { data: it } = await db.from("escritorio_tarefas").select("*").eq("id", id).maybeSingle();
  const donas = it ? new Set([it.responsavel_id, ...(it.compartilhado_com || [])].filter(Boolean)) : new Set<string>();
  const { data: mapas } = await db.from("escritorio_google_tarefas").select("*").eq("tarefa_id", id);
  const res: Record<string, string> = {};

  for (const { usuario } of conectadas) {
    const mapa = (mapas || []).find((m: any) => m.usuario === usuario);
    const quer = !!it && donas.has(usuario);
    if (!quer && !mapa) continue;
    const token = await tokenDe(usuario);
    if (!token) { res[usuario] = "sem token"; continue; }

    if (!quer) { // tarefa apagada ou deixou de ser dela
      await gtasks(token, "DELETE", `/lists/${mapa.lista_id}/tasks/${mapa.task_id}`);
      await db.from("escritorio_google_tarefas").delete().eq("tarefa_id", id).eq("usuario", usuario);
      res[usuario] = "removida"; continue;
    }
    const corpo: Record<string, unknown> = {
      title: it.titulo,
      notes: [it.descricao, it.area && `Área: ${it.area}`, "— Escritório Interno"].filter(Boolean).join("\n\n"),
      status: it.status === "concluida" ? "completed" : "needsAction",
      due: it.prazo ? `${it.prazo}T00:00:00.000Z` : null,
    };
    if (corpo.status === "needsAction") corpo.completed = null;

    if (mapa) {
      const r = await gtasks(token, "PATCH", `/lists/${mapa.lista_id}/tasks/${mapa.task_id}`, corpo);
      if (r.ok) { res[usuario] = "atualizada"; continue; }
      if (r.status !== 404) { res[usuario] = `erro ${r.status}`; console.error(await r.text()); continue; }
      await db.from("escritorio_google_tarefas").delete().eq("tarefa_id", id).eq("usuario", usuario);
    }
    if (corpo.status === "completed") { res[usuario] = "concluída, nada a criar"; continue; }
    // reserva a linha antes de criar, para não duplicar se dois avisos chegarem juntos
    const { error: reserva } = await db.from("escritorio_google_tarefas").insert({ tarefa_id: id, usuario, lista_id: "@default", task_id: "pendente" });
    if (reserva) { res[usuario] = "já em criação"; continue; }
    const r = await gtasks(token, "POST", "/lists/@default/tasks", corpo);
    const d = await r.json().catch(() => ({}));
    if (r.ok && d.id) {
      await db.from("escritorio_google_tarefas").update({ task_id: d.id }).eq("tarefa_id", id).eq("usuario", usuario);
      res[usuario] = "criada";
    } else {
      await db.from("escritorio_google_tarefas").delete().eq("tarefa_id", id).eq("usuario", usuario);
      res[usuario] = `erro ${r.status}`; console.error(d);
    }
  }
  return { ok: true, res };
}

// ── volta do Google: concluiu lá → conclui no Escritório (e vice-versa) ──
async function puxarConclusoes() {
  const { data: conectadas } = await db.from("escritorio_google_tokens").select("usuario,tasks_lido_em");
  let mudou = 0;
  for (const { usuario, tasks_lido_em } of conectadas || []) {
    const token = await tokenDe(usuario);
    if (!token) continue;
    const inicio = new Date();
    const desde = new Date(new Date(tasks_lido_em || Date.now() - 86400000).getTime() - 120000).toISOString();
    let pageToken = "";
    do {
      const q = new URLSearchParams({ showCompleted: "true", showHidden: "true", updatedMin: desde, maxResults: "100" });
      if (pageToken) q.set("pageToken", pageToken);
      const r = await gtasks(token, "GET", `/lists/@default/tasks?${q}`);
      if (!r.ok) { console.error("listar tasks", usuario, r.status); break; }
      const d = await r.json();
      for (const t of d.items || []) {
        const { data: mapa } = await db.from("escritorio_google_tarefas").select("tarefa_id").eq("usuario", usuario).eq("task_id", t.id).maybeSingle();
        if (!mapa) continue;
        const { data: tarefa } = await db.from("escritorio_tarefas").select("status").eq("id", mapa.tarefa_id).maybeSingle();
        if (!tarefa) continue;
        if (t.status === "completed" && tarefa.status !== "concluida") {
          await db.from("escritorio_tarefas").update({ status: "concluida", concluida_em: t.completed || new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", mapa.tarefa_id);
          mudou++;
        } else if (t.status === "needsAction" && tarefa.status === "concluida") {
          await db.from("escritorio_tarefas").update({ status: "a_fazer", concluida_em: null, updated_at: new Date().toISOString() }).eq("id", mapa.tarefa_id);
          mudou++;
        }
      }
      pageToken = d.nextPageToken || "";
    } while (pageToken);
    await db.from("escritorio_google_tokens").update({ tasks_lido_em: inicio.toISOString() }).eq("usuario", usuario);
  }
  return mudou;
}

async function syncItem(tipo: string, id: string) {
  if (tipo === "tarefa") return syncTarefa(id);
  if (!TABELA[tipo]) return { ok: false, motivo: "tipo inválido" };
  const { data: conectadas } = await db.from("escritorio_google_tokens").select("usuario");
  if (!conectadas?.length) return { ok: true, motivo: "ninguém conectada" };
  const { data: it } = await db.from(TABELA[tipo]).select("*").eq("id", id).maybeSingle();
  const evento = it ? montar(tipo, it) : null;
  const donas = it ? new Set([it.responsavel_id, ...(it.compartilhado_com || [])].filter(Boolean)) : new Set<string>();
  const gid = idGoogle(tipo, id);
  const res: Record<string, string> = {};

  for (const { usuario } of conectadas) {
    const token = await tokenDe(usuario);
    if (!token) { res[usuario] = "sem token"; continue; }
    if (evento && donas.has(usuario)) {
      let r = await gcal(token, "PUT", `/${gid}`, { ...evento, id: gid });
      if (r.status === 404) r = await gcal(token, "POST", "", { ...evento, id: gid });
      res[usuario] = r.ok ? "atualizado" : `erro ${r.status}`;
      if (!r.ok) console.error(usuario, tipo, id, await r.text());
    } else {
      const r = await gcal(token, "DELETE", `/${gid}`);
      res[usuario] = r.ok ? "removido" : r.status === 404 || r.status === 410 ? "nada a remover" : `erro ${r.status}`;
    }
  }
  return { ok: true, res };
}

async function syncTudo(usuario: string) {
  const hoje = new Date().toISOString().slice(0, 10);
  const filtro = (q: any) => q.or(`responsavel_id.eq.${usuario},compartilhado_com.cs.{${usuario}}`);
  const [t, r, e] = await Promise.all([
    filtro(db.from("escritorio_tarefas").select("id").neq("status", "concluida")),
    filtro(db.from("escritorio_reunioes").select("id").gte("data", hoje).neq("status", "cancelada")),
    filtro(db.from("escritorio_eventos").select("id").gte("data_inicio", hoje).eq("status", "ativo")),
  ]);
  let n = 0;
  for (const [tipo, lista] of [["tarefa", t.data], ["reuniao", r.data], ["evento", e.data]] as const) {
    for (const x of lista || []) { await syncItem(tipo, x.id); n++; }
  }
  await marcarIntegracao(usuario, "conectado", { itens_sincronizados: n });
  return n;
}

// ── retorno do Google ──
async function callback(url: URL) {
  const volta = (st: string) => Response.redirect(`${SITE}?gcal=${st}`, 302);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state) return volta("cancelado");
  const { data: st } = await db.from("escritorio_google_oauth_states").select("*").eq("state", state).maybeSingle();
  await db.from("escritorio_google_oauth_states").delete().eq("state", state);
  if (!st || Date.now() - new Date(st.created_at).getTime() > 15 * 60_000) return volta("expirado");

  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ code, client_id: CLIENT_ID, client_secret: CLIENT_SECRET, redirect_uri: REDIRECT_URI, grant_type: "authorization_code" }),
  });
  const d = await r.json();
  if (!r.ok || !d.refresh_token) { console.error("troca de código", d); return volta("erro"); }
  let email = "";
  try { email = JSON.parse(atob(d.id_token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))).email; } catch { /* sem e-mail */ }

  await db.from("escritorio_google_tokens").upsert({
    usuario: st.usuario, email, refresh_token: d.refresh_token, access_token: d.access_token,
    expires_at: new Date(Date.now() + (d.expires_in || 3600) * 1000).toISOString(), updated_at: new Date().toISOString(),
  });
  await marcarIntegracao(st.usuario, "conectado", { email });
  syncTudo(st.usuario).catch((e) => console.error("sync inicial", e));
  return volta("ok");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const url = new URL(req.url);
  if (req.method === "GET") return callback(url);

  const body = await req.json().catch(() => ({}));
  const acao = body.action;

  if (acao === "poll") {
    return json({ ok: true, alteradas: await puxarConclusoes() });
  }
  if (acao === "sync") {
    return json(await syncItem(String(body.tipo || ""), String(body.id || "")));
  }

  const usuario = await usuariaLogada(req);
  if (!usuario) return json({ erro: "não autorizado" }, 401);

  if (acao === "start") {
    if (!CLIENT_ID || !CLIENT_SECRET) return json({ erro: "Credenciais do Google ainda não configuradas." }, 400);
    const state = crypto.randomUUID();
    await db.from("escritorio_google_oauth_states").insert({ state, usuario });
    const p = new URLSearchParams({
      client_id: CLIENT_ID, redirect_uri: REDIRECT_URI, response_type: "code", scope: SCOPES,
      access_type: "offline", prompt: "consent", include_granted_scopes: "true", state,
    });
    return json({ url: `https://accounts.google.com/o/oauth2/v2/auth?${p}` });
  }
  if (acao === "status") {
    const { data: t } = await db.from("escritorio_google_tokens").select("email,updated_at").eq("usuario", usuario).maybeSingle();
    const { data: i } = await db.from("escritorio_integracoes").select("status,last_sync_at").eq("user_id", usuario).eq("provider", "google_calendar").maybeSingle();
    return json({ conectado: !!t && i?.status !== "erro", email: t?.email || null, status: i?.status || "desconectado", last_sync_at: i?.last_sync_at || null, configurado: !!(CLIENT_ID && CLIENT_SECRET) });
  }
  if (acao === "sync_all") {
    return json({ ok: true, itens: await syncTudo(usuario) });
  }
  if (acao === "disconnect") {
    const { data: t } = await db.from("escritorio_google_tokens").select("refresh_token").eq("usuario", usuario).maybeSingle();
    if (t?.refresh_token) await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(t.refresh_token)}`, { method: "POST" }).catch(() => {});
    await db.from("escritorio_google_tokens").delete().eq("usuario", usuario);
    await marcarIntegracao(usuario, "desconectado");
    return json({ ok: true });
  }
  return json({ erro: "ação desconhecida" }, 400);
});
