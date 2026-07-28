-- Water rewards backend.
-- All client traffic is routed through Supabase Edge Functions.  The functions
-- below are deliberately executable by service_role only; anon/authenticated
-- clients receive no direct table or RPC access.

create extension if not exists pgcrypto;

create table if not exists public.water_devices (
  id uuid primary key default gen_random_uuid(),
  registration_request_id uuid not null unique,
  token_hash bytea not null,
  local_day date not null default ((now() at time zone 'Asia/Shanghai')::date),
  current_ml integer not null default 0 check (current_ml >= 0 and current_ml < 1000),
  daily_total_ml bigint not null default 0 check (daily_total_ml >= 0),
  total_ml bigint not null default 0 check (total_ml >= 0),
  bottles_completed bigint not null default 0 check (bottles_completed >= 0),
  disabled boolean not null default false,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.water_reward_catalog (
  id uuid primary key default gen_random_uuid(),
  reward_key text not null unique check (reward_key ~ '^[a-z0-9][a-z0-9_-]{0,63}$'),
  name text not null check (char_length(name) between 1 and 120),
  description text not null default '' check (char_length(description) <= 1000),
  weight integer not null check (weight between 0 and 1000000),
  enabled boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.water_coupons (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null references public.water_devices(id) on delete restrict,
  reward_id uuid not null references public.water_reward_catalog(id) on delete restrict,
  coupon_code text not null unique,
  lookup_key text not null unique,
  reward_key text not null,
  reward_name text not null,
  reward_description text not null default '',
  bottle_sequence bigint not null check (bottle_sequence > 0),
  status text not null default 'issued'
    check (status in ('issued', 'redemption_requested', 'redeemed')),
  redemption_request_id uuid null,
  redemption_requested_at timestamptz null,
  redeemed_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (device_id, bottle_sequence),
  constraint water_coupon_status_timestamps check (
    (status = 'issued' and redemption_request_id is null
      and redemption_requested_at is null and redeemed_at is null)
    or
    (status = 'redemption_requested' and redemption_request_id is not null
      and redemption_requested_at is not null and redeemed_at is null)
    or
    (status = 'redeemed' and redemption_request_id is not null
      and redemption_requested_at is not null and redeemed_at is not null)
  )
);

create unique index if not exists water_coupon_redemption_request_once
  on public.water_coupons(device_id, redemption_request_id)
  where redemption_request_id is not null;

create index if not exists water_coupons_device_created_idx
  on public.water_coupons(device_id, created_at desc);

create index if not exists water_coupons_status_created_idx
  on public.water_coupons(status, created_at desc);

create index if not exists water_coupons_device_redeemed_idx
  on public.water_coupons(device_id)
  where status = 'redeemed';

create table if not exists public.water_api_requests (
  device_id uuid not null references public.water_devices(id) on delete cascade,
  request_id uuid not null,
  action text not null check (action in ('add_water', 'request_redeem')),
  request_payload jsonb not null,
  response_payload jsonb not null,
  created_at timestamptz not null default now(),
  primary key (device_id, request_id)
);

create table if not exists public.water_admin_audit (
  id uuid primary key default gen_random_uuid(),
  request_id uuid null unique,
  action text not null,
  target_id uuid null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create or replace function public.water_touch_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists touch_water_devices_updated_at on public.water_devices;
create trigger touch_water_devices_updated_at
before update on public.water_devices
for each row execute function public.water_touch_updated_at();

drop trigger if exists touch_water_rewards_updated_at on public.water_reward_catalog;
create trigger touch_water_rewards_updated_at
before update on public.water_reward_catalog
for each row execute function public.water_touch_updated_at();

drop trigger if exists touch_water_coupons_updated_at on public.water_coupons;
create trigger touch_water_coupons_updated_at
before update on public.water_coupons
for each row execute function public.water_touch_updated_at();

-- The fixed cash pool totals exactly 10,000 weight units. Replaying this
-- migration deliberately restores these weights and disables all older demo
-- rewards; already-issued coupons keep their immutable reward snapshots.
insert into public.water_reward_catalog
  (reward_key, name, description, weight, enabled, sort_order)
values
  ('cash_10', '10元现金红包', '线下兑换10元现金红包。', 3000, true, 10),
  ('cash_20', '20元现金红包', '线下兑换20元现金红包。', 2500, true, 20),
  ('cash_30', '30元现金红包', '线下兑换30元现金红包。', 1800, true, 30),
  ('cash_50', '50元现金红包', '线下兑换50元现金红包。', 1300, true, 40),
  ('cash_66', '66元现金红包', '线下兑换66元现金红包。', 700, true, 50),
  ('cash_88', '88元现金红包', '线下兑换88元现金红包。', 400, true, 60),
  ('cash_100', '100元现金红包', '线下兑换100元现金红包。', 200, true, 70),
  ('cash_200', '200元现金红包', '线下兑换200元现金红包。', 70, true, 80),
  ('cash_520', '520元现金红包', '线下兑换520元现金红包。', 29, true, 90),
  ('super_mystery', '超级神秘大奖', '线下兑换超级神秘大奖。', 1, true, 100)
on conflict (reward_key) do update
set name = excluded.name,
    description = excluded.description,
    weight = excluded.weight,
    enabled = true,
    sort_order = excluded.sort_order;

update public.water_reward_catalog
set enabled = false
where reward_key not in (
  'cash_10', 'cash_20', 'cash_30', 'cash_50', 'cash_66',
  'cash_88', 'cash_100', 'cash_200', 'cash_520', 'super_mystery'
)
and enabled = true;

do $$
declare
  v_cash_pool_weight bigint;
begin
  select coalesce(sum(weight), 0)::bigint into v_cash_pool_weight
  from public.water_reward_catalog
  where enabled = true;

  if v_cash_pool_weight <> 10000 then
    raise exception 'WATER_CASH_POOL_WEIGHT_MUST_EQUAL_10000';
  end if;
end;
$$;

create or replace function public.water_local_day()
returns date
language sql
stable
set search_path = public
as $$
  select (now() at time zone 'Asia/Shanghai')::date;
$$;

create or replace function public.water_require_device(
  p_device_id uuid,
  p_device_token text
)
returns public.water_devices
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_device public.water_devices%rowtype;
  v_today date := public.water_local_day();
begin
  if p_device_id is null or p_device_token is null
     or char_length(p_device_token) < 32 or char_length(p_device_token) > 512 then
    raise exception 'WATER_INVALID_DEVICE_CREDENTIALS';
  end if;

  select * into v_device
  from public.water_devices
  where id = p_device_id
    and token_hash = digest(convert_to(p_device_token, 'UTF8'), 'sha256')
    and disabled = false
  for update;

  if not found then
    raise exception 'WATER_INVALID_DEVICE_CREDENTIALS';
  end if;

  if v_device.local_day <> v_today then
    update public.water_devices
    set local_day = v_today,
        current_ml = 0,
        daily_total_ml = 0,
        last_seen_at = now()
    where id = v_device.id
    returning * into v_device;
  else
    update public.water_devices
    set last_seen_at = now()
    where id = v_device.id
    returning * into v_device;
  end if;

  return v_device;
end;
$$;

-- Cash amounts are derived only from the immutable reward_key snapshot stored
-- on each issued coupon. Unknown/legacy rewards and super_mystery deliberately
-- contribute zero, so later catalog edits cannot rewrite redeemed history.
create or replace function public.water_fixed_cash_amount(p_reward_key text)
returns integer
language sql
immutable
strict
set search_path = public
as $$
  select case p_reward_key
    when 'cash_10' then 10
    when 'cash_20' then 20
    when 'cash_30' then 30
    when 'cash_50' then 50
    when 'cash_66' then 66
    when 'cash_88' then 88
    when 'cash_100' then 100
    when 'cash_200' then 200
    when 'cash_520' then 520
    else 0
  end;
$$;

create or replace function public.water_state_json(p_device public.water_devices)
returns jsonb
language sql
stable
set search_path = public
as $$
  select jsonb_build_object(
    'deviceId', p_device.id,
    'localDay', p_device.local_day,
    'date', p_device.local_day,
    'currentMl', case when p_device.daily_total_ml >= 2000 then 0 else p_device.current_ml end,
    'waterMl', case when p_device.daily_total_ml >= 2000 then 0 else p_device.current_ml end,
    'dailyTotalMl', least(p_device.daily_total_ml, 2000),
    'todayTotalMl', least(p_device.daily_total_ml, 2000),
    'totalMl', least(p_device.daily_total_ml, 2000),
    'lifetimeTotalMl', p_device.total_ml,
    'bottlesCompleted', least(2, floor(p_device.daily_total_ml::numeric / 1000)::bigint),
    'completedBottles', least(2, floor(p_device.daily_total_ml::numeric / 1000)::bigint),
    'lifetimeBottlesCompleted', p_device.bottles_completed,
    'bottleCapacityMl', 1000,
    'dailyBottleLimit', 2,
    'dailyLimitReached', p_device.daily_total_ml >= 2000,
    'remainingDailyMl', greatest(0, 2000 - least(p_device.daily_total_ml, 2000)),
    'redeemedAmount', coalesce((
      select sum(public.water_fixed_cash_amount(c.reward_key))::bigint
      from public.water_coupons c
      where c.device_id = p_device.id
        and c.status = 'redeemed'
    ), 0),
    'sipMl', 20,
    'cupMl', 250
  );
$$;

create or replace function public.water_coupon_json(p_coupon public.water_coupons)
returns jsonb
language sql
stable
set search_path = public
as $$
  select jsonb_build_object(
    'id', p_coupon.id,
    'code', p_coupon.coupon_code,
    'couponCode', p_coupon.coupon_code,
    'lookupKey', p_coupon.lookup_key,
    'rewardId', p_coupon.reward_id,
    'rewardKey', p_coupon.reward_key,
    'rewardName', p_coupon.reward_name,
    'rewardDescription', p_coupon.reward_description,
    'rewardContent', p_coupon.reward_description,
    'cashAmount', public.water_fixed_cash_amount(p_coupon.reward_key),
    'fixedCashAmount', public.water_fixed_cash_amount(p_coupon.reward_key),
    'icon', '🎁',
    'bottleSequence', p_coupon.bottle_sequence,
    'status', p_coupon.status,
    'createdAt', p_coupon.created_at,
    'requestedAt', p_coupon.redemption_requested_at,
    'redeemedAt', p_coupon.redeemed_at,
    'requestId', p_coupon.redemption_request_id
  );
$$;

create or replace function public.water_random_coupon_code()
returns text
language sql
volatile
set search_path = public, extensions
as $$
  select 'WTR-'
    || substr(upper(encode(gen_random_bytes(8), 'hex')), 1, 4) || '-'
    || substr(upper(encode(gen_random_bytes(8), 'hex')), 1, 4) || '-'
    || substr(upper(encode(gen_random_bytes(8), 'hex')), 1, 4) || '-'
    || substr(upper(encode(gen_random_bytes(8), 'hex')), 1, 4);
$$;

create or replace function public.water_random_lookup_key()
returns text
language sql
volatile
set search_path = public, extensions
as $$
  select 'KEY-' || upper(encode(gen_random_bytes(16), 'hex'));
$$;

create or replace function public.water_register_device(
  p_device_token text,
  p_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_device public.water_devices%rowtype;
begin
  if p_request_id is null then
    raise exception 'WATER_INVALID_REQUEST_ID';
  end if;
  if p_device_token is null or char_length(p_device_token) < 32 or char_length(p_device_token) > 512 then
    raise exception 'WATER_INVALID_DEVICE_TOKEN';
  end if;

  insert into public.water_devices (registration_request_id, token_hash)
  values (p_request_id, digest(convert_to(p_device_token, 'UTF8'), 'sha256'))
  on conflict (registration_request_id) do update
    set last_seen_at = now()
  returning * into v_device;

  if v_device.token_hash <> digest(convert_to(p_device_token, 'UTF8'), 'sha256') then
    raise exception 'WATER_REGISTRATION_TOKEN_MISMATCH';
  end if;

  if v_device.local_day <> public.water_local_day() then
    update public.water_devices
    set local_day = public.water_local_day(), current_ml = 0, daily_total_ml = 0
    where id = v_device.id
    returning * into v_device;
  end if;

  return public.water_state_json(v_device);
end;
$$;

create or replace function public.water_get_state(
  p_device_id uuid,
  p_device_token text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_device public.water_devices%rowtype;
begin
  v_device := public.water_require_device(p_device_id, p_device_token);
  return public.water_state_json(v_device);
end;
$$;

create or replace function public.water_add_water(
  p_device_id uuid,
  p_device_token text,
  p_amount_ml integer,
  p_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_device public.water_devices%rowtype;
  v_request public.water_api_requests%rowtype;
  v_request_payload jsonb;
  v_response jsonb;
  v_new_coupons jsonb := '[]'::jsonb;
  v_fills integer;
  v_applied_amount_ml integer;
  v_i integer;
  v_weight_total bigint;
  v_roll double precision;
  v_reward public.water_reward_catalog%rowtype;
  v_coupon public.water_coupons%rowtype;
  v_inserted boolean;
  v_attempt integer;
begin
  if p_request_id is null then
    raise exception 'WATER_INVALID_REQUEST_ID';
  end if;
  if p_amount_ml is null or p_amount_ml not in (20, 250) then
    raise exception 'WATER_INVALID_AMOUNT';
  end if;

  -- The row lock serializes all state and idempotency changes for this device.
  v_device := public.water_require_device(p_device_id, p_device_token);
  v_request_payload := jsonb_build_object('amountMl', p_amount_ml);

  select * into v_request
  from public.water_api_requests
  where device_id = p_device_id and request_id = p_request_id;

  if found then
    if v_request.action <> 'add_water' or v_request.request_payload <> v_request_payload then
      raise exception 'WATER_IDEMPOTENCY_CONFLICT';
    end if;
    return v_request.response_payload;
  end if;

  if v_device.daily_total_ml >= 2000 then
    raise exception 'WATER_DAILY_BOTTLE_LIMIT_REACHED';
  end if;

  -- The final request of the day may be partially applied so that the device
  -- lands exactly on two bottles without discarding the valid remainder.
  v_applied_amount_ml := least(
    p_amount_ml,
    (2000 - v_device.daily_total_ml)::integer
  );
  v_fills := (
    ((v_device.daily_total_ml + v_applied_amount_ml) / 1000)
    - (v_device.daily_total_ml / 1000)
  )::integer;

  update public.water_devices
  set current_ml = ((v_device.daily_total_ml + v_applied_amount_ml) % 1000)::integer,
      daily_total_ml = daily_total_ml + v_applied_amount_ml,
      total_ml = total_ml + v_applied_amount_ml,
      bottles_completed = bottles_completed + v_fills,
      last_seen_at = now()
  where id = v_device.id
  returning * into v_device;

  if v_fills > 0 then
    -- Keep the pool stable between total calculation and selection. Admin pool
    -- edits wait for this short award transaction to finish.
    lock table public.water_reward_catalog in share mode;

    select sum(weight)::bigint into v_weight_total
    from public.water_reward_catalog
    where enabled = true and weight > 0;

    if coalesce(v_weight_total, 0) <= 0 then
      raise exception 'WATER_REWARD_POOL_EMPTY';
    end if;

    for v_i in 1..v_fills loop
      v_roll := random() * v_weight_total;

      select catalog.* into v_reward
      from public.water_reward_catalog catalog
      join (
        select r.id,
          sum(r.weight) over (order by r.sort_order, r.id) as cumulative_weight
        from public.water_reward_catalog r
        where r.enabled = true and r.weight > 0
      ) weighted on weighted.id = catalog.id
      where weighted.cumulative_weight > v_roll
      order by weighted.cumulative_weight
      limit 1;

      if not found then
        raise exception 'WATER_REWARD_SELECTION_FAILED';
      end if;

      v_inserted := false;
      for v_attempt in 1..8 loop
        begin
          insert into public.water_coupons (
            device_id, reward_id, coupon_code, lookup_key,
            reward_key, reward_name, reward_description, bottle_sequence
          ) values (
            v_device.id,
            v_reward.id,
            public.water_random_coupon_code(),
            public.water_random_lookup_key(),
            v_reward.reward_key,
            v_reward.name,
            v_reward.description,
            v_device.bottles_completed - v_fills + v_i
          )
          returning * into v_coupon;
          v_inserted := true;
          exit;
        exception when unique_violation then
          -- Random code/key collisions are fantastically unlikely, but retrying
          -- here keeps the uniqueness guarantee explicit.
          null;
        end;
      end loop;

      if not v_inserted then
        raise exception 'WATER_COUPON_CODE_GENERATION_FAILED';
      end if;

      v_new_coupons := v_new_coupons || jsonb_build_array(public.water_coupon_json(v_coupon));
    end loop;
  end if;

  v_response := jsonb_build_object(
    'state', public.water_state_json(v_device),
    'newCoupons', v_new_coupons,
    'requestedAmountMl', p_amount_ml,
    'appliedAmountMl', v_applied_amount_ml
  );

  insert into public.water_api_requests
    (device_id, request_id, action, request_payload, response_payload)
  values
    (p_device_id, p_request_id, 'add_water', v_request_payload, v_response);

  return v_response;
end;
$$;

create or replace function public.water_list_coupons(
  p_device_id uuid,
  p_device_token text,
  p_status text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_device public.water_devices%rowtype;
  v_items jsonb;
  v_redeemed_amount bigint;
begin
  if p_status is not null and p_status not in ('issued', 'redemption_requested', 'redeemed') then
    raise exception 'WATER_INVALID_COUPON_STATUS';
  end if;

  v_device := public.water_require_device(p_device_id, p_device_token);

  select coalesce(jsonb_agg(public.water_coupon_json(c) order by c.created_at desc), '[]'::jsonb)
  into v_items
  from public.water_coupons c
  where c.device_id = v_device.id
    and (p_status is null or c.status = p_status);

  select coalesce(sum(public.water_fixed_cash_amount(c.reward_key)), 0)::bigint
  into v_redeemed_amount
  from public.water_coupons c
  where c.device_id = v_device.id
    and c.status = 'redeemed';

  return jsonb_build_object(
    'items', v_items,
    'redeemedAmount', v_redeemed_amount
  );
end;
$$;

create or replace function public.water_request_redeem(
  p_device_id uuid,
  p_device_token text,
  p_coupon_code text,
  p_request_id uuid,
  p_reward_key text default null,
  p_reward_name text default null,
  p_reward_description text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_device public.water_devices%rowtype;
  v_request public.water_api_requests%rowtype;
  v_request_payload jsonb;
  v_coupon public.water_coupons%rowtype;
  v_response jsonb;
begin
  if p_request_id is null then
    raise exception 'WATER_INVALID_REQUEST_ID';
  end if;
  if p_coupon_code is null or char_length(btrim(p_coupon_code)) not between 8 and 80 then
    raise exception 'WATER_INVALID_COUPON_CODE';
  end if;

  v_device := public.water_require_device(p_device_id, p_device_token);
  v_request_payload := jsonb_strip_nulls(jsonb_build_object(
    'couponCode', upper(btrim(p_coupon_code)),
    'rewardKey', nullif(btrim(p_reward_key), ''),
    'rewardName', nullif(btrim(p_reward_name), ''),
    'rewardDescription', nullif(btrim(p_reward_description), '')
  ));

  select * into v_request
  from public.water_api_requests
  where device_id = p_device_id and request_id = p_request_id;

  if found then
    if v_request.action <> 'request_redeem' or v_request.request_payload <> v_request_payload then
      raise exception 'WATER_IDEMPOTENCY_CONFLICT';
    end if;
    return v_request.response_payload;
  end if;

  select * into v_coupon
  from public.water_coupons
  where device_id = v_device.id
    and coupon_code = upper(btrim(p_coupon_code))
  for update;

  if not found then
    raise exception 'WATER_COUPON_NOT_FOUND';
  end if;

  -- Reward content sent by the client is treated only as a consistency check;
  -- the immutable server snapshot remains authoritative.
  if nullif(btrim(p_reward_key), '') is not null
     and v_coupon.reward_key <> btrim(p_reward_key) then
    raise exception 'WATER_COUPON_REWARD_MISMATCH';
  end if;
  if nullif(btrim(p_reward_name), '') is not null
     and v_coupon.reward_name <> btrim(p_reward_name) then
    raise exception 'WATER_COUPON_REWARD_MISMATCH';
  end if;
  if nullif(btrim(p_reward_description), '') is not null
     and v_coupon.reward_description <> btrim(p_reward_description) then
    raise exception 'WATER_COUPON_REWARD_MISMATCH';
  end if;

  if v_coupon.status = 'redeemed' then
    raise exception 'WATER_COUPON_ALREADY_REDEEMED';
  end if;

  if v_coupon.status = 'issued' then
    update public.water_coupons
    set status = 'redemption_requested',
        redemption_request_id = p_request_id,
        redemption_requested_at = now()
    where id = v_coupon.id
    returning * into v_coupon;
  end if;

  v_response := public.water_coupon_json(v_coupon);

  insert into public.water_api_requests
    (device_id, request_id, action, request_payload, response_payload)
  values
    (p_device_id, p_request_id, 'request_redeem', v_request_payload, v_response);

  return v_response;
end;
$$;

create or replace function public.water_admin_list_coupons(
  p_status text default null,
  p_query text default null,
  p_limit integer default 50,
  p_offset integer default 0
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_items jsonb;
  v_stats jsonb;
  v_filtered_total bigint;
begin
  if p_status = 'all' then p_status := null; end if;
  if p_status is not null and p_status not in ('issued', 'redemption_requested', 'redeemed') then
    raise exception 'WATER_INVALID_COUPON_STATUS';
  end if;
  p_limit := least(greatest(coalesce(p_limit, 50), 1), 200);
  p_offset := greatest(coalesce(p_offset, 0), 0);
  p_query := nullif(btrim(p_query), '');

  select count(*) into v_filtered_total
  from public.water_coupons c
  where (p_status is null or c.status = p_status)
    and (
      p_query is null
      or c.coupon_code ilike '%' || p_query || '%'
      or c.lookup_key ilike '%' || p_query || '%'
      or c.reward_name ilike '%' || p_query || '%'
      or c.reward_key ilike '%' || p_query || '%'
      or c.id::text = p_query
    );

  select coalesce(jsonb_agg(item order by created_at desc), '[]'::jsonb)
  into v_items
  from (
    select public.water_coupon_json(c)
      || jsonb_build_object('deviceId', c.device_id) as item,
      c.created_at
    from public.water_coupons c
    where (p_status is null or c.status = p_status)
      and (
        p_query is null
        or c.coupon_code ilike '%' || p_query || '%'
        or c.lookup_key ilike '%' || p_query || '%'
        or c.reward_name ilike '%' || p_query || '%'
        or c.reward_key ilike '%' || p_query || '%'
        or c.id::text = p_query
      )
    order by c.created_at desc
    limit p_limit offset p_offset
  ) listed;

  select jsonb_build_object(
    'total', count(*),
    'issued', count(*) filter (where status = 'issued'),
    'requested', count(*) filter (where status = 'redemption_requested'),
    'redeemed', count(*) filter (where status = 'redeemed'),
    'redeemedAmount', coalesce(sum(
      public.water_fixed_cash_amount(reward_key)
    ) filter (where status = 'redeemed'), 0)
  ) into v_stats
  from public.water_coupons;

  return jsonb_build_object(
    'items', v_items,
    'stats', v_stats,
    'pagination', jsonb_build_object(
      'total', v_filtered_total,
      'limit', p_limit,
      'offset', p_offset
    )
  );
end;
$$;

create or replace function public.water_admin_get_coupon(p_lookup text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_coupon public.water_coupons%rowtype;
begin
  if p_lookup is null or char_length(btrim(p_lookup)) > 100 then
    raise exception 'WATER_INVALID_LOOKUP';
  end if;

  select * into v_coupon
  from public.water_coupons
  where upper(coupon_code) = upper(btrim(p_lookup))
     or upper(lookup_key) = upper(btrim(p_lookup))
     or id::text = btrim(p_lookup)
  limit 1;

  if not found then
    raise exception 'WATER_COUPON_NOT_FOUND';
  end if;

  return public.water_coupon_json(v_coupon)
    || jsonb_build_object('deviceId', v_coupon.device_id);
end;
$$;

create or replace function public.water_admin_mark_redeemed(
  p_lookup text,
  p_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_coupon public.water_coupons%rowtype;
  v_audit public.water_admin_audit%rowtype;
begin
  if p_request_id is null then
    raise exception 'WATER_INVALID_REQUEST_ID';
  end if;
  if p_lookup is null or char_length(btrim(p_lookup)) > 100 then
    raise exception 'WATER_INVALID_LOOKUP';
  end if;

  -- Serializes retries that carry the same admin operation id, including the
  -- narrow race before the audit row is first inserted.
  perform pg_advisory_xact_lock(hashtextextended(p_request_id::text, 0));

  select * into v_audit
  from public.water_admin_audit
  where request_id = p_request_id;

  if found then
    if v_audit.action <> 'mark_redeemed'
       or upper(coalesce(v_audit.payload->>'lookup', '')) <> upper(btrim(p_lookup)) then
      raise exception 'WATER_IDEMPOTENCY_CONFLICT';
    end if;
    select * into v_coupon from public.water_coupons where id = v_audit.target_id;
    return public.water_coupon_json(v_coupon)
      || jsonb_build_object('deviceId', v_coupon.device_id);
  end if;

  select * into v_coupon
  from public.water_coupons
  where upper(coupon_code) = upper(btrim(p_lookup))
     or upper(lookup_key) = upper(btrim(p_lookup))
     or id::text = btrim(p_lookup)
  limit 1
  for update;

  if not found then
    raise exception 'WATER_COUPON_NOT_FOUND';
  end if;
  if v_coupon.status = 'issued' then
    raise exception 'WATER_REDEMPTION_NOT_REQUESTED';
  end if;

  if v_coupon.status = 'redemption_requested' then
    update public.water_coupons
    set status = 'redeemed', redeemed_at = now()
    where id = v_coupon.id
    returning * into v_coupon;
  end if;

  insert into public.water_admin_audit(request_id, action, target_id, payload)
  values (
    p_request_id,
    'mark_redeemed',
    v_coupon.id,
    jsonb_build_object('lookup', btrim(p_lookup))
  );

  return public.water_coupon_json(v_coupon)
    || jsonb_build_object('deviceId', v_coupon.device_id);
end;
$$;

create or replace function public.water_admin_list_rewards()
returns jsonb
language sql
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'items', coalesce(jsonb_agg(jsonb_build_object(
      'id', id,
      'rewardKey', reward_key,
      'name', name,
      'description', description,
      'weight', weight,
      'enabled', enabled,
      'sortOrder', sort_order,
      'createdAt', created_at,
      'updatedAt', updated_at
    ) order by sort_order, name), '[]'::jsonb)
  )
  from public.water_reward_catalog;
$$;

create or replace function public.water_admin_upsert_reward(
  p_reward_id uuid,
  p_reward_key text,
  p_name text,
  p_description text,
  p_weight integer,
  p_enabled boolean,
  p_sort_order integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reward public.water_reward_catalog%rowtype;
begin
  p_reward_key := lower(btrim(p_reward_key));
  p_name := btrim(p_name);
  p_description := coalesce(p_description, '');

  if p_reward_key is null or p_reward_key !~ '^[a-z0-9][a-z0-9_-]{0,63}$' then
    raise exception 'WATER_INVALID_REWARD_KEY';
  end if;
  if p_name is null or char_length(p_name) not between 1 and 120 then
    raise exception 'WATER_INVALID_REWARD_NAME';
  end if;
  if char_length(p_description) > 1000 then
    raise exception 'WATER_INVALID_REWARD_DESCRIPTION';
  end if;
  if p_weight is null or p_weight not between 0 and 1000000 then
    raise exception 'WATER_INVALID_REWARD_WEIGHT';
  end if;

  if p_reward_id is not null then
    update public.water_reward_catalog
    set reward_key = p_reward_key,
        name = p_name,
        description = p_description,
        weight = p_weight,
        enabled = coalesce(p_enabled, true),
        sort_order = coalesce(p_sort_order, 0)
    where id = p_reward_id
    returning * into v_reward;

    if not found then
      raise exception 'WATER_REWARD_NOT_FOUND';
    end if;
  else
    insert into public.water_reward_catalog
      (reward_key, name, description, weight, enabled, sort_order)
    values
      (p_reward_key, p_name, p_description, p_weight,
       coalesce(p_enabled, true), coalesce(p_sort_order, 0))
    on conflict (reward_key) do update
      set name = excluded.name,
          description = excluded.description,
          weight = excluded.weight,
          enabled = excluded.enabled,
          sort_order = excluded.sort_order
    returning * into v_reward;
  end if;

  insert into public.water_admin_audit(action, target_id, payload)
  values (
    'upsert_reward',
    v_reward.id,
    jsonb_build_object(
      'rewardKey', v_reward.reward_key,
      'weight', v_reward.weight,
      'enabled', v_reward.enabled
    )
  );

  return jsonb_build_object(
    'id', v_reward.id,
    'rewardKey', v_reward.reward_key,
    'name', v_reward.name,
    'description', v_reward.description,
    'weight', v_reward.weight,
    'enabled', v_reward.enabled,
    'sortOrder', v_reward.sort_order,
    'createdAt', v_reward.created_at,
    'updatedAt', v_reward.updated_at
  );
end;
$$;

alter table public.water_devices enable row level security;
alter table public.water_reward_catalog enable row level security;
alter table public.water_coupons enable row level security;
alter table public.water_api_requests enable row level security;
alter table public.water_admin_audit enable row level security;

-- Explicitly remove the broad grants Supabase normally applies to public-schema
-- objects.  service_role reaches data only through the SECURITY DEFINER RPCs.
revoke all on table public.water_devices from public, anon, authenticated;
revoke all on table public.water_reward_catalog from public, anon, authenticated;
revoke all on table public.water_coupons from public, anon, authenticated;
revoke all on table public.water_api_requests from public, anon, authenticated;
revoke all on table public.water_admin_audit from public, anon, authenticated;

revoke all on function public.water_local_day() from public, anon, authenticated;
revoke all on function public.water_touch_updated_at() from public, anon, authenticated;
revoke all on function public.water_require_device(uuid, text) from public, anon, authenticated;
revoke all on function public.water_fixed_cash_amount(text) from public, anon, authenticated;
revoke all on function public.water_state_json(public.water_devices) from public, anon, authenticated;
revoke all on function public.water_coupon_json(public.water_coupons) from public, anon, authenticated;
revoke all on function public.water_random_coupon_code() from public, anon, authenticated;
revoke all on function public.water_random_lookup_key() from public, anon, authenticated;
revoke all on function public.water_register_device(text, uuid) from public, anon, authenticated;
revoke all on function public.water_get_state(uuid, text) from public, anon, authenticated;
revoke all on function public.water_add_water(uuid, text, integer, uuid) from public, anon, authenticated;
revoke all on function public.water_list_coupons(uuid, text, text) from public, anon, authenticated;
revoke all on function public.water_request_redeem(uuid, text, text, uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.water_admin_list_coupons(text, text, integer, integer) from public, anon, authenticated;
revoke all on function public.water_admin_get_coupon(text) from public, anon, authenticated;
revoke all on function public.water_admin_mark_redeemed(text, uuid) from public, anon, authenticated;
revoke all on function public.water_admin_list_rewards() from public, anon, authenticated;
revoke all on function public.water_admin_upsert_reward(uuid, text, text, text, integer, boolean, integer) from public, anon, authenticated;

grant execute on function public.water_register_device(text, uuid) to service_role;
grant execute on function public.water_get_state(uuid, text) to service_role;
grant execute on function public.water_add_water(uuid, text, integer, uuid) to service_role;
grant execute on function public.water_list_coupons(uuid, text, text) to service_role;
grant execute on function public.water_request_redeem(uuid, text, text, uuid, text, text, text) to service_role;
grant execute on function public.water_admin_list_coupons(text, text, integer, integer) to service_role;
grant execute on function public.water_admin_get_coupon(text) to service_role;
grant execute on function public.water_admin_mark_redeemed(text, uuid) to service_role;
grant execute on function public.water_admin_list_rewards() to service_role;
grant execute on function public.water_admin_upsert_reward(uuid, text, text, text, integer, boolean, integer) to service_role;
