insert into public.global_configs (key, value, description)
values
  ('passive_hp_pct_per_sec', to_jsonb(0.0005::numeric), '非疗伤状态每秒自然恢复血量百分比'),
  ('passive_qi_pct_per_sec', to_jsonb(0.0008::numeric), '非疗伤状态每秒自然恢复斗气百分比')
on conflict (key) do nothing;

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
  v_start_level_order int;
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
  v_start_level_order := v_profile.level_order;
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

  if v_level_order > v_start_level_order then
    v_hp := v_max_hp;
    v_qi := v_max_qi;
  elsif v_elapsed > 0 and v_profile.activity_type <> 'healing' then
    v_hp := least(
      v_max_hp,
      coalesce(v_hp, v_max_hp) + v_elapsed * v_max_hp * public.config_numeric('passive_hp_pct_per_sec', 0.0005)
    );
    v_qi := least(
      v_max_qi,
      coalesce(v_qi, v_max_qi) + v_elapsed * v_max_qi * public.config_numeric('passive_qi_pct_per_sec', 0.0008)
    );
  end if;

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

grant execute on function public.settle_self() to authenticated;
