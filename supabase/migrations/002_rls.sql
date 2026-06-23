create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select coalesce((select is_admin from public.player_profiles where id = auth.uid()), false);
$$;

alter table public.player_profiles enable row level security;
alter table public.level_configs enable row level security;
alter table public.global_configs enable row level security;
alter table public.game_items enable row level security;
alter table public.chore_templates enable row level security;
alter table public.daily_chore_rolls enable row level security;
alter table public.workers enable row level security;
alter table public.auction_lots enable row level security;
alter table public.auction_bids enable row level security;
alter table public.battle_logs enable row level security;
alter table public.captivity_records enable row level security;

grant usage on schema public to authenticated;
grant select, update on public.player_profiles to authenticated;
grant select, insert, update, delete on public.level_configs to authenticated;
grant select, insert, update, delete on public.global_configs to authenticated;
grant select, insert, update, delete on public.game_items to authenticated;
grant select, insert, update, delete on public.chore_templates to authenticated;
grant select, insert, update, delete on public.daily_chore_rolls to authenticated;
grant select, insert, update, delete on public.workers to authenticated;
grant select, insert, update, delete on public.auction_lots to authenticated;
grant select, insert on public.auction_bids to authenticated;
grant select, insert on public.battle_logs to authenticated;
grant select, insert, update, delete on public.captivity_records to authenticated;

drop policy if exists "profiles select own or admin" on public.player_profiles;
create policy "profiles select own or admin"
on public.player_profiles
for select
to authenticated
using (id = auth.uid() or public.is_admin());

drop policy if exists "profiles admin update" on public.player_profiles;
create policy "profiles admin update"
on public.player_profiles
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "level configs readable" on public.level_configs;
create policy "level configs readable"
on public.level_configs
for select
to authenticated
using (true);

drop policy if exists "level configs admin write" on public.level_configs;
create policy "level configs admin write"
on public.level_configs
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "global configs readable" on public.global_configs;
create policy "global configs readable"
on public.global_configs
for select
to authenticated
using (true);

drop policy if exists "global configs admin write" on public.global_configs;
create policy "global configs admin write"
on public.global_configs
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "items readable" on public.game_items;
create policy "items readable"
on public.game_items
for select
to authenticated
using (
  public.is_admin()
  or owner_id = auth.uid()
  or (owner_id is null and disabled = false)
  or exists (
    select 1 from public.auction_lots lot
    where lot.item_id = game_items.id
      and lot.status = 'active'
  )
);

drop policy if exists "items admin write" on public.game_items;
create policy "items admin write"
on public.game_items
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "chore templates readable" on public.chore_templates;
create policy "chore templates readable"
on public.chore_templates
for select
to authenticated
using (public.is_admin() or disabled = false);

drop policy if exists "chore templates admin write" on public.chore_templates;
create policy "chore templates admin write"
on public.chore_templates
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "daily chores own or admin read" on public.daily_chore_rolls;
create policy "daily chores own or admin read"
on public.daily_chore_rolls
for select
to authenticated
using (user_id = auth.uid() or public.is_admin());

drop policy if exists "daily chores admin write" on public.daily_chore_rolls;
create policy "daily chores admin write"
on public.daily_chore_rolls
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "workers own or admin read" on public.workers;
create policy "workers own or admin read"
on public.workers
for select
to authenticated
using (owner_id = auth.uid() or public.is_admin());

drop policy if exists "workers admin write" on public.workers;
create policy "workers admin write"
on public.workers
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "auction lots readable" on public.auction_lots;
create policy "auction lots readable"
on public.auction_lots
for select
to authenticated
using (true);

drop policy if exists "auction lots admin write" on public.auction_lots;
create policy "auction lots admin write"
on public.auction_lots
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "auction bids readable" on public.auction_bids;
create policy "auction bids readable"
on public.auction_bids
for select
to authenticated
using (bidder_id = auth.uid() or public.is_admin());

drop policy if exists "auction bids admin insert" on public.auction_bids;
create policy "auction bids admin insert"
on public.auction_bids
for insert
to authenticated
with check (public.is_admin());

drop policy if exists "battle logs own or admin read" on public.battle_logs;
create policy "battle logs own or admin read"
on public.battle_logs
for select
to authenticated
using (user_id = auth.uid() or public.is_admin());

drop policy if exists "battle logs admin insert" on public.battle_logs;
create policy "battle logs admin insert"
on public.battle_logs
for insert
to authenticated
with check (public.is_admin());

drop policy if exists "captivity own or admin read" on public.captivity_records;
create policy "captivity own or admin read"
on public.captivity_records
for select
to authenticated
using (captor_id = auth.uid() or captive_id = auth.uid() or public.is_admin());

drop policy if exists "captivity admin write" on public.captivity_records;
create policy "captivity admin write"
on public.captivity_records
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());
