-- Suporte técnico: roteiros de ligar/desligar + base de problemas e soluções (já aplicado no projeto PIBVolApp)

-- Quem administra o suporte técnico: admin, pastor e líder (alteram roteiros e aprovam soluções)
create or replace function public.current_pode_gerir_suporte()
returns boolean language sql stable security definer set search_path to 'public' as $$
  select coalesce(public.current_nivel() in ('admin','pastor','lider'), false) or public.current_is_admin()
$$;

create table public.suporte_procedimentos (
  id uuid primary key default gen_random_uuid(),
  sistema text not null check (sistema in ('som','transmissao','multimidia')),
  tipo text not null check (tipo in ('ligar','desligar')),
  local text not null default 'salao_principal',
  passos jsonb not null default '[]'::jsonb,           -- [{texto, alerta}]
  atualizado_por uuid references public.voluntarios(id) on delete set null,
  atualizado_por_nome text,
  atualizado_em timestamptz not null default now(),
  unique (sistema, tipo, local)
);
alter table public.suporte_procedimentos enable row level security;
create policy suporte_proc_select on public.suporte_procedimentos for select using (true);
create policy suporte_proc_insert on public.suporte_procedimentos for insert with check (public.current_pode_gerir_suporte());
create policy suporte_proc_update on public.suporte_procedimentos for update using (public.current_pode_gerir_suporte()) with check (public.current_pode_gerir_suporte());
create policy suporte_proc_delete on public.suporte_procedimentos for delete using (public.current_pode_gerir_suporte());

create table public.suporte_problemas (
  id uuid primary key default gen_random_uuid(),
  sistema text not null check (sistema in ('som','transmissao','multimidia','outro')),
  local text not null default 'salao_principal',
  titulo text not null,
  sintoma text not null,
  solucao text,
  resolvido boolean not null default true,
  status text not null default 'pendente' check (status in ('pendente','aprovado','rejeitado')),
  motivo_rejeicao text,
  autor_id uuid default auth.uid() references public.voluntarios(id) on delete set null,
  autor_nome text,
  aprovado_por uuid references public.voluntarios(id) on delete set null,
  aprovado_por_nome text,
  aprovado_em timestamptz,
  uteis uuid[] not null default '{}',                  -- quem marcou "me ajudou"
  criado_em timestamptz not null default now(),
  constraint solucao_quando_resolvido check (not resolvido or coalesce(trim(solucao),'') <> '')
);
create index suporte_problemas_status_idx on public.suporte_problemas(status, sistema);
alter table public.suporte_problemas enable row level security;
create policy suporte_prob_select on public.suporte_problemas for select
  using (status = 'aprovado' or autor_id = auth.uid() or public.current_pode_gerir_suporte());
create policy suporte_prob_insert on public.suporte_problemas for insert
  with check (autor_id = auth.uid() and (status = 'pendente' or public.current_pode_gerir_suporte()));
create policy suporte_prob_update on public.suporte_problemas for update
  using (public.current_pode_gerir_suporte()) with check (public.current_pode_gerir_suporte());
create policy suporte_prob_delete on public.suporte_problemas for delete
  using (public.current_pode_gerir_suporte() or (autor_id = auth.uid() and status = 'pendente'));

-- "Me ajudou": p_marcar null = alterna; true = só marca; false = só desmarca
create or replace function public.alternar_util_problema(p_problema_id uuid, p_marcar boolean default null)
returns uuid[] language plpgsql security definer set search_path to 'public' as $$
declare v_uid uuid := auth.uid(); v_uteis uuid[]; v_tem boolean;
begin
  if v_uid is null then raise exception 'Não autenticado'; end if;
  select uteis into v_uteis from public.suporte_problemas where id = p_problema_id and status = 'aprovado' for update;
  if not found then raise exception 'Registro não encontrado'; end if;
  v_tem := v_uid = any(v_uteis);
  if v_tem and coalesce(p_marcar, false) = false then v_uteis := array_remove(v_uteis, v_uid);
  elsif not v_tem and coalesce(p_marcar, true) = true then v_uteis := array_append(v_uteis, v_uid);
  end if;
  update public.suporte_problemas set uteis = v_uteis where id = p_problema_id;
  return v_uteis;
end; $$;

-- Avisa admin/pastor/líderes quando um voluntário registra algo pra aprovar
create or replace function public.notificar_suporte_novo()
returns trigger language plpgsql security definer set search_path to 'public' as $$
declare v_dest record;
begin
  if new.status <> 'pendente' then return new; end if;
  for v_dest in select id from public.voluntarios where nivel in ('admin','pastor','lider') and id is distinct from new.autor_id loop
    insert into public.notificacoes (vol_id, tipo, mensagem)
    values (v_dest.id, 'suporte_pendente',
      coalesce(new.autor_nome,'Alguém') || ' registrou "' || new.titulo || '"' ||
      case when new.resolvido then ' com uma solução' else ' (ainda sem solução)' end || '. Revise para aprovar.');
  end loop;
  return new;
end; $$;
create trigger suporte_problemas_notificar after insert on public.suporte_problemas
  for each row execute function public.notificar_suporte_novo();

-- Avisa o autor quando o registro dele for aprovado ou recusado
create or replace function public.notificar_suporte_revisado()
returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  if new.status is distinct from old.status and new.status in ('aprovado','rejeitado')
     and new.autor_id is not null and new.autor_id is distinct from auth.uid() then
    insert into public.notificacoes (vol_id, tipo, mensagem)
    values (new.autor_id, 'suporte_revisado',
      case when new.status = 'aprovado'
        then 'Seu registro "' || new.titulo || '" foi aprovado e já ajuda o Voluntário IA. Obrigado!'
        else 'Seu registro "' || new.titulo || '" não foi aprovado' || coalesce(': ' || nullif(trim(new.motivo_rejeicao),''), '.') end);
  end if;
  return new;
end; $$;
create trigger suporte_problemas_revisado after update on public.suporte_problemas
  for each row execute function public.notificar_suporte_revisado();

revoke execute on function public.notificar_suporte_novo() from public, anon, authenticated;
revoke execute on function public.notificar_suporte_revisado() from public, anon, authenticated;
