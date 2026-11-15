-- Fotos dos passos dos roteiros de suporte (já aplicado no projeto PIBVolApp)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('suporte-fotos', 'suporte-fotos', true, 8388608, array['image/jpeg','image/png','image/webp','image/heic','image/heif'])
on conflict (id) do nothing;

create policy "suporte-fotos leitura" on storage.objects for select
  using (bucket_id = 'suporte-fotos');
create policy "suporte-fotos envio gestores" on storage.objects for insert
  with check (bucket_id = 'suporte-fotos' and public.current_pode_gerir_suporte());
create policy "suporte-fotos troca gestores" on storage.objects for update
  using (bucket_id = 'suporte-fotos' and public.current_pode_gerir_suporte())
  with check (bucket_id = 'suporte-fotos' and public.current_pode_gerir_suporte());
create policy "suporte-fotos remocao gestores" on storage.objects for delete
  using (bucket_id = 'suporte-fotos' and public.current_pode_gerir_suporte());

-- Etapa "Durante o culto" nos roteiros
alter table public.suporte_procedimentos drop constraint if exists suporte_procedimentos_tipo_check;
alter table public.suporte_procedimentos add constraint suporte_procedimentos_tipo_check check (tipo in ('ligar','durante','desligar'));
