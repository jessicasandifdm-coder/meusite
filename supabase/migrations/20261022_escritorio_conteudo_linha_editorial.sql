-- Linha editorial no Escritório: dia de gravar, pilar, palavra-chave, stories, fase e modelo
alter table public.escritorio_conteudo
  add column if not exists data_gravacao date,
  add column if not exists pilar text,
  add column if not exists palavra_chave text,
  add column if not exists stories text,
  add column if not exists fase text,
  add column if not exists referencia text;
create index if not exists escritorio_conteudo_data_pub_idx on public.escritorio_conteudo (data_publicacao);
