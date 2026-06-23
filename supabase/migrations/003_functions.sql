create or replace function public.config_numeric(p_key text, p_default numeric)
returns numeric
language sql
security definer
set search_path = public
as $$
  select coalesce(
    (select (value #>> '{}')::numeric from public.global_configs where key = p_key),
    p_default
  );
$$;

create or replace function public.config_bool(p_key text, p_default boolean)
returns boolean
language sql
security definer
set search_path = public
as $$
  select coalesce(
    (select (value #>> '{}')::boolean from public.global_configs where key = p_key),
    p_default
  );
$$;

create or replace function public.local_day_utc8()
returns date
language sql
stable
as $$
  select (now() at time zone 'Asia/Shanghai')::date;
$$;

create or replace function public.auction_close_ts(p_day date, p_hour int)
returns timestamptz
language sql
stable
as $$
  select (p_day::timestamp + make_interval(hours => p_hour)) at time zone 'Asia/Shanghai';
$$;

create or replace function public.compute_player_stats(
  p_level_order int,
  p_method_id uuid default null,
  out max_hp numeric,
  out max_qi numeric,
  out attack numeric,
  out defense numeric
)
language sql
security definer
set search_path = public
as $$
  select
    floor(l.hp_base * coalesce(m.hp_multiplier, 1)),
    floor(l.qi_base * coalesce(m.qi_multiplier, 1)),
    floor(l.attack_base * coalesce(m.attack_multiplier, 1)),
    floor(l.defense_base * coalesce(m.defense_multiplier, 1))
  from public.level_configs l
  left join public.game_items m
    on m.id = p_method_id
   and m.item_type = 'method'
   and m.disabled = false
  where l.level_order = p_level_order;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_username text;
begin
  v_username := lower(coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)));

  insert into public.player_profiles (id, username, display_name)
  values (new.id, v_username, v_username)
  on conflict (id) do nothing;

  insert into public.game_items (
    item_type, owner_id, name, description, tier, grade, element,
    skill_kind, cooldown_sec, qi_cost_pct, power_multiplier,
    proficiency_xp, proficiency_required, is_basic
  ) values (
    'skill', new.id, '普通攻击', '最基础的攻击，每秒可释放一次。', 'huang', 'low', 'none',
    'normal_attack', 0, 0, 1,
    600, 600, true
  );

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.settle_self()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_profile public.player_profiles%rowtype;
  v_now timestamptz := now();
  v_elapsed numeric;
  v_level public.level_configs%rowtype;
  v_method public.game_items%rowtype;
  v_gain numeric := 0;
  v_xp numeric;
  v_level_order int;
  v_threshold numeric;
  v_rate numeric;
  v_activity public.activity_type;
  v_target uuid;
  v_hp numeric;
  v_qi numeric;
  v_max_hp numeric;
  v_max_qi numeric;
  v_attack numeric;
  v_defense numeric;
  v_roll public.daily_chore_rolls%rowtype;
  v_template public.chore_templates%rowtype;
  v_quality_mult numeric;
  v_reward int;
  v_payout int;
  v_success boolean;
  v_snapshot jsonb;
begin
  if v_uid is null then
    raise exception '需要登录';
  end if;

  select * into v_profile
  from public.player_profiles
  where id = v_uid
  for update;

  if not found then
    raise exception '玩家档案不存在';
  end if;

  v_elapsed := extract(epoch from (v_now - v_profile.last_settled_at));
  v_elapsed := greatest(0, least(v_elapsed, public.config_numeric('max_offline_seconds', 86400)));
  v_xp := v_profile.cultivation_xp;
  v_level_order := v_profile.level_order;
  v_activity := v_profile.activity_type;
  v_target := v_profile.activity_target_id;
  v_hp := v_profile.current_hp;
  v_qi := v_profile.current_qi;

  if v_elapsed > 0 and v_profile.activity_type = 'cultivating' then
    select * into v_level from public.level_configs where level_order = v_level_order;
    select * into v_method from public.game_items where id = v_profile.equipped_method_id and item_type = 'method';

    v_rate := v_level.base_rate_per_sec
      * coalesce(v_method.speed_multiplier, 1)
      * coalesce(v_method.potential_multiplier, 1)
      * public.config_numeric('cultivation_speed_multiplier', 1);
    v_xp := v_xp + v_elapsed * v_rate;

    loop
      select threshold into v_threshold from public.level_configs where level_order = v_level_order;
      exit when v_level_order >= 107 or v_xp < v_threshold;
      v_xp := v_xp - v_threshold;
      v_level_order := v_level_order + 1;
    end loop;

    if v_level_order >= 107 then
      select threshold into v_threshold from public.level_configs where level_order = 107;
      v_xp := least(v_xp, v_threshold);
    end if;
  elsif v_elapsed > 0 and v_profile.activity_type = 'practicing_skill' then
    update public.game_items
    set proficiency_xp = least(proficiency_required, proficiency_xp + v_elapsed * public.config_numeric('skill_practice_rate_per_sec', 1))
    where id = v_profile.activity_target_id
      and owner_id = v_uid
      and item_type = 'skill'
      and is_locked = false
      and disabled = false;
  elsif v_elapsed > 0 and v_profile.activity_type = 'healing' then
    select max_hp, max_qi, attack, defense
    into v_max_hp, v_max_qi, v_attack, v_defense
    from public.compute_player_stats(v_level_order, v_profile.equipped_method_id);

    v_hp := least(v_max_hp, v_hp + v_elapsed * v_max_hp * public.config_numeric('heal_hp_pct_per_sec', 0.025));
    v_qi := least(v_max_qi, v_qi + v_elapsed * v_max_qi * public.config_numeric('heal_qi_pct_per_sec', 0.04));

    if v_hp >= v_max_hp and v_qi >= v_max_qi and public.config_bool('auto_cultivate_after_heal', true) then
      v_activity := 'cultivating';
      v_target := null;
    end if;
  elsif v_profile.activity_type = 'doing_chore' then
    select * into v_roll
    from public.daily_chore_rolls
    where id = v_profile.activity_target_id
      and user_id = v_uid
    for update;

    if found and v_roll.status = 'in_progress' then
      select * into v_template from public.chore_templates where id = v_roll.template_id;
      if v_roll.started_at + make_interval(mins => v_template.duration_minutes) <= v_now then
        select * into v_level from public.level_configs where level_order = v_level_order;
        v_quality_mult := case v_template.quality
          when 'common' then 1
          when 'good' then 1.35
          when 'rare' then 1.9
          when 'epic' then 2.8
          else 4.2
        end;
        v_reward := floor(v_template.base_reward * v_quality_mult * (1 + v_level.realm_index * 0.6 + (v_level.sub_index - 1) * 0.03));
        v_success := random() <= v_template.success_rate;
        v_payout := case when v_success then v_reward else floor(v_reward * 0.15) end;

        update public.daily_chore_rolls
        set status = case when v_success then 'success' else 'failed' end,
            completed_at = v_now,
            reward = v_payout,
            result_payload = jsonb_build_object('success', v_success)
        where id = v_roll.id;

        v_profile.coins := v_profile.coins + v_payout;
        v_activity := case when public.config_bool('auto_cultivate_after_chore', false) then 'cultivating' else 'idle' end;
        v_target := null;
      end if;
    end if;
  end if;

  select max_hp, max_qi, attack, defense
  into v_max_hp, v_max_qi, v_attack, v_defense
  from public.compute_player_stats(v_level_order, v_profile.equipped_method_id);

  v_hp := least(coalesce(v_hp, v_max_hp), v_max_hp);
  v_qi := least(coalesce(v_qi, v_max_qi), v_max_qi);

  update public.player_profiles p
  set coins = v_profile.coins,
      level_order = v_level_order,
      cultivation_xp = v_xp,
      current_hp = greatest(0, v_hp),
      current_qi = greatest(0, v_qi),
      activity_type = v_activity,
      activity_target_id = v_target,
      activity_started_at = case when v_activity <> v_profile.activity_type then v_now else p.activity_started_at end,
      last_settled_at = v_now,
      last_seen_at = v_now
  where p.id = v_uid
  returning to_jsonb(p) into v_snapshot;

  return v_snapshot;
end;
$$;

create or replace function public.start_activity(
  p_activity public.activity_type,
  p_target_id uuid default null,
  p_payload jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_profile public.player_profiles%rowtype;
  v_roll public.daily_chore_rolls%rowtype;
  v_template public.chore_templates%rowtype;
  v_max_hp numeric;
  v_max_qi numeric;
  v_attack numeric;
  v_defense numeric;
  v_snapshot jsonb;
begin
  if v_uid is null then
    raise exception '需要登录';
  end if;

  perform public.settle_self();

  select * into v_profile
  from public.player_profiles
  where id = v_uid
  for update;

  if v_profile.activity_type = 'doing_chore' and p_activity <> 'doing_chore' then
    select * into v_roll from public.daily_chore_rolls where id = v_profile.activity_target_id for update;
    if found and v_roll.status = 'in_progress' then
      select * into v_template from public.chore_templates where id = v_roll.template_id;
      if v_roll.started_at + make_interval(mins => v_template.duration_minutes) > now() then
        raise exception '当前杂工尚未完成';
      end if;
    end if;
  end if;

  if p_activity in ('idle', 'cultivating') then
    p_target_id := null;
  elsif p_activity = 'practicing_skill' then
    if p_target_id is null or not exists (
      select 1 from public.game_items
      where id = p_target_id
        and owner_id = v_uid
        and item_type = 'skill'
        and is_locked = false
        and disabled = false
    ) then
      raise exception '斗技不可练习';
    end if;
  elsif p_activity = 'doing_chore' then
    select * into v_roll
    from public.daily_chore_rolls
    where id = p_target_id
      and user_id = v_uid
      and status = 'available'
    for update;
    if not found then
      raise exception '杂工任务不可用';
    end if;
    update public.daily_chore_rolls
    set status = 'in_progress',
        started_at = now()
    where id = p_target_id;
  elsif p_activity = 'healing' then
    select max_hp, max_qi, attack, defense
    into v_max_hp, v_max_qi, v_attack, v_defense
    from public.compute_player_stats(v_profile.level_order, v_profile.equipped_method_id);
    if v_profile.current_hp >= v_max_hp and v_profile.current_qi >= v_max_qi then
      raise exception '当前无需疗伤';
    end if;
    p_target_id := null;
  else
    raise exception '暂不支持该活动';
  end if;

  update public.player_profiles p
  set activity_type = p_activity,
      activity_target_id = p_target_id,
      activity_payload = coalesce(p_payload, '{}'::jsonb),
      activity_started_at = now(),
      last_settled_at = now(),
      last_seen_at = now()
  where p.id = v_uid
  returning to_jsonb(p) into v_snapshot;

  return v_snapshot;
end;
$$;

create or replace function public.equip_method(p_item_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_profile public.player_profiles%rowtype;
  v_max_hp numeric;
  v_max_qi numeric;
  v_attack numeric;
  v_defense numeric;
  v_snapshot jsonb;
begin
  if v_uid is null then raise exception '需要登录'; end if;
  perform public.settle_self();

  if not exists (
    select 1 from public.game_items
    where id = p_item_id
      and owner_id = v_uid
      and item_type = 'method'
      and is_locked = false
      and disabled = false
  ) then
    raise exception '功法不可装备';
  end if;

  select * into v_profile from public.player_profiles where id = v_uid for update;
  select max_hp, max_qi, attack, defense
  into v_max_hp, v_max_qi, v_attack, v_defense
  from public.compute_player_stats(v_profile.level_order, p_item_id);

  update public.player_profiles p
  set equipped_method_id = p_item_id,
      current_hp = least(current_hp, v_max_hp),
      current_qi = least(current_qi, v_max_qi),
      last_seen_at = now()
  where p.id = v_uid
  returning to_jsonb(p) into v_snapshot;

  return v_snapshot;
end;
$$;

create or replace function public.update_battle_strategy(p_skill_ids jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_skill_id text;
  v_clean jsonb := '[]'::jsonb;
  v_count int := 0;
  v_snapshot jsonb;
begin
  if v_uid is null then raise exception '需要登录'; end if;
  if jsonb_typeof(p_skill_ids) <> 'array' then
    raise exception '斗技顺序格式错误';
  end if;

  for v_skill_id in select value from jsonb_array_elements_text(p_skill_ids)
  loop
    exit when v_count >= 6;
    if not exists (
      select 1 from public.game_items
      where id = v_skill_id::uuid
        and owner_id = v_uid
        and item_type = 'skill'
        and is_basic = false
        and is_locked = false
        and disabled = false
    ) then
      raise exception '斗技不属于当前玩家';
    end if;
    v_clean := v_clean || jsonb_build_array(v_skill_id);
    v_count := v_count + 1;
  end loop;

  update public.player_profiles p
  set battle_strategy = v_clean,
      last_seen_at = now()
  where p.id = v_uid
  returning to_jsonb(p) into v_snapshot;

  return v_snapshot;
end;
$$;

create or replace function public.generate_daily_chores()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_day date := public.local_day_utc8();
  v_level_order int;
begin
  if v_uid is null then raise exception '需要登录'; end if;
  select level_order into v_level_order from public.player_profiles where id = v_uid;

  if not exists (
    select 1 from public.daily_chore_rolls
    where user_id = v_uid and local_day = v_day
  ) then
    insert into public.daily_chore_rolls (user_id, local_day, template_id)
    select v_uid, v_day, id
    from public.chore_templates
    where disabled = false
      and min_level_order <= v_level_order
    order by random() / greatest(weight, 1)
    limit 5;
  end if;

  return coalesce((
    select jsonb_agg(to_jsonb(r))
    from public.daily_chore_rolls r
    where r.user_id = v_uid and r.local_day = v_day
  ), '[]'::jsonb);
end;
$$;

create or replace function public.collect_worker_income(p_worker_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_worker public.workers%rowtype;
  v_elapsed_hours numeric;
  v_reward bigint;
  v_snapshot jsonb;
begin
  if v_uid is null then raise exception '需要登录'; end if;

  select * into v_worker
  from public.workers
  where id = p_worker_id
    and owner_id = v_uid
    and active = true
  for update;

  if not found then
    raise exception '工人不存在';
  end if;

  v_elapsed_hours := greatest(0, least(
    extract(epoch from (now() - v_worker.last_collected_at)) / 3600,
    public.config_numeric('worker_income_cap_hours', 24)
  ));
  v_reward := floor(v_elapsed_hours * floor(2 * power(1.18, floor(v_worker.level_order / 9)) * v_worker.efficiency));

  update public.player_profiles set coins = coins + v_reward where id = v_uid;
  update public.workers set last_collected_at = now() where id = p_worker_id;

  select to_jsonb(p) into v_snapshot from public.player_profiles p where p.id = v_uid;
  return jsonb_build_object('profile', v_snapshot, 'reward', v_reward);
end;
$$;

create or replace function public.close_due_auctions()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lot public.auction_lots%rowtype;
  v_closed int := 0;
begin
  for v_lot in
    select * from public.auction_lots
    where status = 'active'
      and closes_at <= now()
    order by closes_at
    for update
  loop
    if v_lot.current_bidder_id is not null then
      update public.game_items
      set owner_id = v_lot.current_bidder_id,
          is_locked = false
      where id = v_lot.item_id;

      if v_lot.seller_id is not null then
        update public.player_profiles
        set coins = coins + coalesce(v_lot.current_bid, 0)
        where id = v_lot.seller_id;
      end if;

      update public.auction_lots
      set status = 'closed'
      where id = v_lot.id;
    else
      update public.game_items
      set is_locked = false
      where id = v_lot.item_id;

      update public.auction_lots
      set status = 'expired'
      where id = v_lot.id;
    end if;
    v_closed := v_closed + 1;
  end loop;

  return jsonb_build_object('closed', v_closed);
end;
$$;

create or replace function public.generate_daily_auctions()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_day date := public.local_day_utc8();
  v_hour int := public.config_numeric('auction_close_hour_local', 16)::int;
  v_count int := public.config_numeric('auction_daily_system_lot_count', 3)::int;
  v_item record;
  v_start_price bigint;
begin
  perform public.close_due_auctions();

  if extract(hour from (now() at time zone 'Asia/Shanghai')) >= v_hour then
    v_day := v_day + 1;
  end if;

  if not exists (
    select 1 from public.auction_lots
    where source = 'system'
      and local_day = v_day
  ) then
    for v_item in
      select id, tier, grade
      from public.game_items
      where owner_id is null
        and is_locked = false
        and disabled = false
        and is_basic = false
      order by random()
      limit v_count
      for update skip locked
    loop
      v_start_price := case v_item.tier
        when 'huang' then 50
        when 'xuan' then 180
        when 'di' then 800
        else 3200
      end * case v_item.grade
        when 'low' then 1
        when 'mid' then 2
        else 4
      end;

      insert into public.auction_lots (local_day, item_id, source, start_price, closes_at)
      values (v_day, v_item.id, 'system', v_start_price, public.auction_close_ts(v_day, v_hour));

      update public.game_items set is_locked = true where id = v_item.id;
    end loop;
  end if;

  return coalesce((
    select jsonb_agg(to_jsonb(l))
    from public.auction_lots l
    where l.local_day = v_day
  ), '[]'::jsonb);
end;
$$;

create or replace function public.place_bid(p_lot_id uuid, p_amount bigint)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_lot public.auction_lots%rowtype;
  v_bidder public.player_profiles%rowtype;
  v_min_bid bigint;
  v_lock_minutes int := public.config_numeric('auction_bid_lock_minutes', 30)::int;
  v_increment numeric := public.config_numeric('auction_min_increment_pct', 0.05);
begin
  if v_uid is null then raise exception '需要登录'; end if;
  perform public.close_due_auctions();

  select * into v_lot
  from public.auction_lots
  where id = p_lot_id
  for update;

  if not found or v_lot.status <> 'active' then
    raise exception '拍卖不可出价';
  end if;
  if now() >= v_lot.closes_at then
    raise exception '拍卖已结束';
  end if;
  if v_lot.seller_id = v_uid then
    raise exception '不能给自己的寄售出价';
  end if;
  if v_lot.current_bidder_id = v_uid then
    raise exception '不能连续出价';
  end if;
  if v_lot.last_bid_at is not null and v_lot.last_bid_at + make_interval(mins => v_lock_minutes) > now() then
    raise exception '出价锁定中';
  end if;

  v_min_bid := case
    when v_lot.current_bid is null then v_lot.start_price
    else ceil(v_lot.current_bid * (1 + v_increment))::bigint
  end;
  if p_amount < v_min_bid then
    raise exception '出价低于最低价';
  end if;

  select * into v_bidder
  from public.player_profiles
  where id = v_uid
  for update;

  if v_bidder.coins < p_amount then
    raise exception '灵石不足';
  end if;

  update public.player_profiles set coins = coins - p_amount where id = v_uid;

  if v_lot.current_bidder_id is not null and v_lot.current_bid is not null then
    update public.player_profiles
    set coins = coins + v_lot.current_bid
    where id = v_lot.current_bidder_id;
  end if;

  insert into public.auction_bids (lot_id, bidder_id, amount)
  values (p_lot_id, v_uid, p_amount);

  update public.auction_lots
  set current_bid = p_amount,
      current_bidder_id = v_uid,
      last_bid_at = now()
  where id = p_lot_id;

  return jsonb_build_object('lot_id', p_lot_id, 'amount', p_amount);
end;
$$;

create or replace function public.create_player_auction(p_item_id uuid, p_start_price bigint)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_profile public.player_profiles%rowtype;
  v_item public.game_items%rowtype;
  v_day date := public.local_day_utc8();
  v_hour int := public.config_numeric('auction_close_hour_local', 16)::int;
  v_lot_id uuid;
  v_lot jsonb;
begin
  if v_uid is null then raise exception '需要登录'; end if;
  perform public.settle_self();
  select * into v_profile from public.player_profiles where id = v_uid for update;
  select * into v_item from public.game_items where id = p_item_id and owner_id = v_uid for update;

  if not found or v_item.is_basic or v_item.is_locked or v_item.disabled then
    raise exception '物品不可寄售';
  end if;
  if v_item.item_type = 'method' and v_profile.equipped_method_id = p_item_id then
    raise exception '已装备功法不可寄售';
  end if;
  if extract(hour from (now() at time zone 'Asia/Shanghai')) >= v_hour then
    v_day := v_day + 1;
  end if;

  update public.player_profiles
  set battle_strategy = (
    select coalesce(jsonb_agg(value), '[]'::jsonb)
    from jsonb_array_elements_text(v_profile.battle_strategy)
    where value <> p_item_id::text
  )
  where id = v_uid;

  insert into public.auction_lots (local_day, item_id, seller_id, source, start_price, closes_at)
  values (v_day, p_item_id, v_uid, 'player', greatest(1, p_start_price), public.auction_close_ts(v_day, v_hour))
  returning id into v_lot_id;

  update public.game_items set is_locked = true where id = p_item_id;
  select to_jsonb(l) into v_lot from public.auction_lots l where l.id = v_lot_id;
  return v_lot;
end;
$$;

create or replace function public.admin_cancel_auction(p_lot_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lot public.auction_lots%rowtype;
begin
  if not public.is_admin() then
    raise exception '需要管理员权限';
  end if;

  select * into v_lot
  from public.auction_lots
  where id = p_lot_id
  for update;

  if not found then
    raise exception '拍卖不存在';
  end if;

  if v_lot.status <> 'active' then
    return jsonb_build_object('status', v_lot.status, 'cancelled', false);
  end if;

  if v_lot.current_bidder_id is not null and v_lot.current_bid is not null then
    update public.player_profiles
    set coins = coins + v_lot.current_bid
    where id = v_lot.current_bidder_id;
  end if;

  update public.game_items
  set is_locked = false
  where id = v_lot.item_id;

  update public.auction_lots
  set status = 'cancelled'
  where id = p_lot_id;

  return jsonb_build_object('status', 'cancelled', 'cancelled', true);
end;
$$;

create or replace function public.save_npc_battle_result(
  p_opponent_name text,
  p_result text,
  p_player_hp_after numeric,
  p_player_qi_after numeric,
  p_reward_payload jsonb default '{}'::jsonb,
  p_log_json jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_profile public.player_profiles%rowtype;
  v_max_hp numeric;
  v_max_qi numeric;
  v_attack numeric;
  v_defense numeric;
  v_hp numeric;
  v_qi numeric;
  v_log_id uuid;
begin
  if v_uid is null then raise exception '需要登录'; end if;
  if p_result not in ('win', 'lose', 'timeout') then raise exception '战斗结果无效'; end if;

  perform public.settle_self();
  select * into v_profile from public.player_profiles where id = v_uid for update;
  select max_hp, max_qi, attack, defense
  into v_max_hp, v_max_qi, v_attack, v_defense
  from public.compute_player_stats(v_profile.level_order, v_profile.equipped_method_id);

  v_hp := least(v_max_hp, greatest(case when p_result = 'win' then 0 else 1 end, p_player_hp_after));
  v_qi := least(v_max_qi, greatest(0, p_player_qi_after));

  update public.player_profiles
  set current_hp = v_hp,
      current_qi = v_qi,
      last_seen_at = now()
  where id = v_uid;

  insert into public.battle_logs (
    user_id, opponent_name, result, player_hp_after, player_qi_after, reward_payload, log_json
  ) values (
    v_uid, p_opponent_name, p_result, v_hp, v_qi, p_reward_payload, p_log_json
  )
  returning id into v_log_id;

  if p_result = 'win' then
    insert into public.workers (
      owner_id, name, source, level_order, realm_label, efficiency
    ) values (
      v_uid,
      coalesce(p_reward_payload->>'name', p_opponent_name),
      'npc',
      coalesce((p_reward_payload->>'level_order')::int, v_profile.level_order),
      coalesce(p_reward_payload->>'realm_label', '斗之气一段'),
      coalesce((p_reward_payload->>'efficiency')::numeric, 1)
    );
  end if;

  return jsonb_build_object('battle_log_id', v_log_id);
end;
$$;

grant execute on function public.settle_self() to authenticated;
grant execute on function public.start_activity(public.activity_type, uuid, jsonb) to authenticated;
grant execute on function public.equip_method(uuid) to authenticated;
grant execute on function public.update_battle_strategy(jsonb) to authenticated;
grant execute on function public.generate_daily_chores() to authenticated;
grant execute on function public.collect_worker_income(uuid) to authenticated;
grant execute on function public.generate_daily_auctions() to authenticated;
grant execute on function public.close_due_auctions() to authenticated;
grant execute on function public.place_bid(uuid, bigint) to authenticated;
grant execute on function public.create_player_auction(uuid, bigint) to authenticated;
grant execute on function public.admin_cancel_auction(uuid) to authenticated;
grant execute on function public.save_npc_battle_result(text, text, numeric, numeric, jsonb, jsonb) to authenticated;
