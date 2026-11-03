-- Starlight Memorial: guest letter read policy and lasting flower offerings.
-- Run after 007_haemungi_starlight_memorial.sql.
begin;

-- Guest letter reads must never depend on the private hm_admins table.
alter policy "mem_letters_public_read" on public.hm_memorial_letters
  to anon using (status='approved');
drop policy if exists "mem_letters_authenticated_read" on public.hm_memorial_letters;
create policy "mem_letters_authenticated_read" on public.hm_memorial_letters
  for select to authenticated
  using (
    status='approved'
    or exists(
      select 1 from public.hm_admins
      where user_id=(select auth.uid())
    )
  );

create table if not exists public.hm_memorial_offerings (
  id uuid primary key default gen_random_uuid(),
  memorial_id uuid not null references public.hm_memorial_public(id) on delete cascade,
  flower_kind text not null check (flower_kind in ('white','peach','gold')),
  created_at timestamptz not null default now()
);
create index if not exists hm_memorial_offerings_recent_idx
  on public.hm_memorial_offerings (memorial_id,created_at desc);
alter table public.hm_memorial_offerings enable row level security;
grant select,insert on public.hm_memorial_offerings to anon,authenticated;

drop policy if exists "mem_offerings_public_read" on public.hm_memorial_offerings;
create policy "mem_offerings_public_read" on public.hm_memorial_offerings
  for select to anon,authenticated using (true);
drop policy if exists "mem_offerings_public_insert" on public.hm_memorial_offerings;
create policy "mem_offerings_public_insert" on public.hm_memorial_offerings
  for insert to anon,authenticated
  with check (
    flower_kind in ('white','peach','gold')
    and exists(
      select 1 from public.hm_memorial_public
      where id=hm_memorial_offerings.memorial_id
    )
  );
commit;
