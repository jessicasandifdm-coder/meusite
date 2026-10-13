-- Integração Escritório ⇄ Google (Tasks para tarefas, Agenda para reuniões/eventos)
create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;

-- tokens do Google: só o servidor lê (RLS ligado, sem políticas)
create table if not exists public.escritorio_google_tokens (
  usuario text primary key,
  email text,
  refresh_token text not null,
  access_token text,
  expires_at timestamptz,
  tasks_lido_em timestamptz,
  updated_at timestamptz default now()
);
alter table public.escritorio_google_tokens enable row level security;

create table if not exists public.escritorio_google_oauth_states (
  state text primary key,
  usuario text not null,
  created_at timestamptz default now()
);
alter table public.escritorio_google_oauth_states enable row level security;

-- qual tarefa do Escritório corresponde a qual tarefa no Google Tasks de cada uma
create table if not exists public.escritorio_google_tarefas (
  tarefa_id text not null,
  usuario text not null,
  lista_id text not null default '@default',
  task_id text not null,
  created_at timestamptz default now(),
  primary key (tarefa_id, usuario)
);
alter table public.escritorio_google_tarefas enable row level security;

-- avisa a função quando tarefa/reunião/evento muda
create or replace function public.escritorio_gcal_notificar()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
begin
  if not exists (select 1 from public.escritorio_google_tokens) then
    return null;
  end if;
  perform net.http_post(
    url := 'https://lnfghtlrzoioaotamzvy.supabase.co/functions/v1/google-calendar',
    headers := jsonb_build_object('Content-Type','application/json'),
    body := jsonb_build_object('action','sync','tipo',TG_ARGV[0],'id',coalesce(NEW.id, OLD.id))
  );
  return null;
end $$;

drop trigger if exists gcal_sync on public.escritorio_tarefas;
create trigger gcal_sync after insert or update or delete on public.escritorio_tarefas
  for each row execute function public.escritorio_gcal_notificar('tarefa');
drop trigger if exists gcal_sync on public.escritorio_reunioes;
create trigger gcal_sync after insert or update or delete on public.escritorio_reunioes
  for each row execute function public.escritorio_gcal_notificar('reuniao');
drop trigger if exists gcal_sync on public.escritorio_eventos;
create trigger gcal_sync after insert or update or delete on public.escritorio_eventos
  for each row execute function public.escritorio_gcal_notificar('evento');

-- a cada 5 minutos: o que foi concluído no Google é concluído no Escritório
select cron.unschedule('escritorio-google-poll') where exists (select 1 from cron.job where jobname = 'escritorio-google-poll');
select cron.schedule('escritorio-google-poll', '*/5 * * * *', $$
  select net.http_post(
    url := 'https://lnfghtlrzoioaotamzvy.supabase.co/functions/v1/google-calendar',
    headers := jsonb_build_object('Content-Type','application/json'),
    body := jsonb_build_object('action','poll')
  ) where exists (select 1 from public.escritorio_google_tokens);
$$);
