-- Additive gift placement for the Starlight Pet Store. Existing memorials,
-- owner's approved tribute artwork, one-flower offerings and letters are unchanged.
begin;

create table if not exists public.hm_memorial_store_gifts (
  id uuid primary key default gen_random_uuid(),
  memorial_id uuid not null references public.hm_memorial_public(id) on delete cascade,
  gift_batch_id uuid not null,
  product_id text not null check (product_id in (
    'bouquet','flower-basket','cake','treats','drinks','fruit','toys','gift-box'
  )),
  quantity smallint not null check (quantity between 1 and 20),
  created_at timestamptz not null default now(),
  unique (gift_batch_id,product_id)
);

create index if not exists hm_memorial_store_gifts_recent_idx
  on public.hm_memorial_store_gifts (memorial_id,created_at desc);

alter table public.hm_memorial_store_gifts enable row level security;
revoke all on public.hm_memorial_store_gifts from anon,authenticated;
grant select,insert on public.hm_memorial_store_gifts to anon,authenticated;

drop policy if exists "mem_store_gifts_public_read" on public.hm_memorial_store_gifts;
create policy "mem_store_gifts_public_read" on public.hm_memorial_store_gifts
  for select to anon,authenticated using (true);

drop policy if exists "mem_store_gifts_public_place" on public.hm_memorial_store_gifts;
create policy "mem_store_gifts_public_place" on public.hm_memorial_store_gifts
  for insert to anon,authenticated
  with check (
    product_id in ('bouquet','flower-basket','cake','treats','drinks','fruit','toys','gift-box')
    and quantity between 1 and 20
    and exists (select 1 from public.hm_memorial_public
                where id=hm_memorial_store_gifts.memorial_id)
  );

comment on table public.hm_memorial_store_gifts is
  'Public free virtual offerings placed on approved memorial altars, no payment or private data.';
commit;
