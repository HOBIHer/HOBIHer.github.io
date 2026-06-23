create extension if not exists pgcrypto;

do $$ begin
  create type public.activity_type as enum (
    'idle',
    'cultivating',
    'practicing_skill',
    'doing_chore',
    'healing',
    'captured_working'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.item_type as enum ('method', 'skill');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.tier_type as enum ('huang', 'xuan', 'di', 'tian');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.grade_type as enum ('low', 'mid', 'high');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.auction_status as enum ('active', 'closed', 'expired', 'cancelled');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.chore_quality as enum ('common', 'good', 'rare', 'epic', 'legendary');
exception when duplicate_object then null;
end $$;

create table if not exists public.player_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  display_name text,
  is_admin boolean not null default false,

  coins bigint not null default 0,
  level_order int not null default 0 check (level_order >= 0 and level_order <= 107),
  cultivation_xp numeric not null default 0,

  current_hp numeric not null default 100,
  current_qi numeric not null default 60,
  equipped_method_id uuid null,
  battle_strategy jsonb not null default '[]'::jsonb,

  activity_type public.activity_type not null default 'idle',
  activity_target_id uuid null,
  activity_payload jsonb not null default '{}'::jsonb,
  activity_started_at timestamptz not null default now(),
  last_settled_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.level_configs (
  level_order int primary key check (level_order >= 0 and level_order <= 107),
  realm_index int not null check (realm_index >= 0 and realm_index <= 11),
  sub_index int not null check (sub_index >= 1 and sub_index <= 9),
  realm_key text not null,
  realm_name text not null,
  label text not null,

  threshold numeric not null,
  base_rate_per_sec numeric not null,
  hp_base numeric not null,
  qi_base numeric not null,
  attack_base numeric not null,
  defense_base numeric not null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.global_configs (
  key text primary key,
  value jsonb not null,
  description text,
  updated_at timestamptz not null default now()
);

create table if not exists public.game_items (
  id uuid primary key default gen_random_uuid(),
  item_type public.item_type not null,
  owner_id uuid null references public.player_profiles(id) on delete set null,

  name text not null,
  description text not null default '',
  tier public.tier_type not null default 'huang',
  grade public.grade_type not null default 'low',
  element text not null default 'none',

  speed_multiplier numeric not null default 1,
  potential_multiplier numeric not null default 1,
  hp_multiplier numeric not null default 1,
  qi_multiplier numeric not null default 1,
  attack_multiplier numeric not null default 1,
  defense_multiplier numeric not null default 1,
  special_effects jsonb not null default '{}'::jsonb,

  skill_kind text null,
  cooldown_sec int not null default 0,
  qi_cost_pct numeric not null default 0,
  power_multiplier numeric not null default 1,
  effect_json jsonb not null default '{}'::jsonb,
  proficiency_xp numeric not null default 0,
  proficiency_required numeric not null default 600,
  is_basic boolean not null default false,

  is_locked boolean not null default false,
  disabled boolean not null default false,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint method_has_no_skill_kind check (
    (item_type = 'method' and skill_kind is null)
    or
    (item_type = 'skill' and skill_kind is not null)
  )
);

do $$ begin
  alter table public.player_profiles
    add constraint player_profiles_equipped_method_fk
    foreign key (equipped_method_id) references public.game_items(id) on delete set null;
exception when duplicate_object then null;
end $$;

create table if not exists public.chore_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  quality public.chore_quality not null default 'common',
  min_level_order int not null default 0,
  duration_minutes int not null,
  success_rate numeric not null check (success_rate >= 0 and success_rate <= 1),
  base_reward int not null,
  weight int not null default 1,
  disabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.daily_chore_rolls (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.player_profiles(id) on delete cascade,
  local_day date not null,
  template_id uuid not null references public.chore_templates(id),
  status text not null default 'available' check (status in ('available', 'in_progress', 'success', 'failed', 'expired')),
  started_at timestamptz null,
  completed_at timestamptz null,
  reward int not null default 0,
  result_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(user_id, local_day, template_id)
);

create table if not exists public.workers (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.player_profiles(id) on delete cascade,
  name text not null,
  source text not null default 'npc' check (source in ('npc', 'player')),
  captured_user_id uuid null references public.player_profiles(id) on delete set null,
  level_order int not null default 0,
  realm_label text not null default '斗之气一段',
  efficiency numeric not null default 1,
  active boolean not null default true,
  last_collected_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.auction_lots (
  id uuid primary key default gen_random_uuid(),
  local_day date not null,
  item_id uuid not null references public.game_items(id),
  seller_id uuid null references public.player_profiles(id) on delete set null,
  source text not null default 'system' check (source in ('system', 'player')),

  status public.auction_status not null default 'active',
  start_price bigint not null check (start_price > 0),
  current_bid bigint null,
  current_bidder_id uuid null references public.player_profiles(id) on delete set null,
  last_bid_at timestamptz null,
  closes_at timestamptz not null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists active_auction_item_once
on public.auction_lots(item_id)
where status = 'active';

create table if not exists public.auction_bids (
  id uuid primary key default gen_random_uuid(),
  lot_id uuid not null references public.auction_lots(id) on delete cascade,
  bidder_id uuid not null references public.player_profiles(id) on delete cascade,
  amount bigint not null check (amount > 0),
  created_at timestamptz not null default now()
);

create table if not exists public.battle_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.player_profiles(id) on delete cascade,
  opponent_type text not null default 'npc',
  opponent_name text not null,
  result text not null check (result in ('win', 'lose', 'timeout')),
  player_hp_after numeric not null,
  player_qi_after numeric not null,
  reward_payload jsonb not null default '{}'::jsonb,
  log_json jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.captivity_records (
  id uuid primary key default gen_random_uuid(),
  captor_id uuid not null references public.player_profiles(id) on delete cascade,
  captive_id uuid not null references public.player_profiles(id) on delete cascade,
  started_at timestamptz not null default now(),
  ends_at timestamptz null,
  income_rate numeric not null default 1,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists touch_profiles_updated_at on public.player_profiles;
create trigger touch_profiles_updated_at
before update on public.player_profiles
for each row execute function public.touch_updated_at();

drop trigger if exists touch_levels_updated_at on public.level_configs;
create trigger touch_levels_updated_at
before update on public.level_configs
for each row execute function public.touch_updated_at();

drop trigger if exists touch_items_updated_at on public.game_items;
create trigger touch_items_updated_at
before update on public.game_items
for each row execute function public.touch_updated_at();

drop trigger if exists touch_chores_updated_at on public.chore_templates;
create trigger touch_chores_updated_at
before update on public.chore_templates
for each row execute function public.touch_updated_at();

drop trigger if exists touch_lots_updated_at on public.auction_lots;
create trigger touch_lots_updated_at
before update on public.auction_lots
for each row execute function public.touch_updated_at();
