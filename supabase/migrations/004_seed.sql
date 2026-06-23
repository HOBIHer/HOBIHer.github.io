with realms(realm_index, realm_key, realm_name) as (
  values
    (0, 'dou_zhi_qi', '斗之气'),
    (1, 'dou_zhe', '斗者'),
    (2, 'dou_shi', '斗师'),
    (3, 'da_dou_shi', '大斗师'),
    (4, 'dou_ling', '斗灵'),
    (5, 'dou_wang', '斗王'),
    (6, 'dou_huang', '斗皇'),
    (7, 'dou_zong', '斗宗'),
    (8, 'dou_zun', '斗尊'),
    (9, 'ban_sheng', '半圣'),
    (10, 'dou_sheng', '斗圣'),
    (11, 'dou_di', '斗帝')
),
subs(sub_index) as (
  select generate_series(1, 9)
),
cn(num, label) as (
  values
    (1, '一'),
    (2, '二'),
    (3, '三'),
    (4, '四'),
    (5, '五'),
    (6, '六'),
    (7, '七'),
    (8, '八'),
    (9, '九')
)
insert into public.level_configs (
  level_order, realm_index, sub_index, realm_key, realm_name, label,
  threshold, base_rate_per_sec, hp_base, qi_base, attack_base, defense_base
)
select
  r.realm_index * 9 + s.sub_index - 1,
  r.realm_index,
  s.sub_index,
  r.realm_key,
  r.realm_name,
  case
    when r.realm_index = 0 then r.realm_name || c.label || '段'
    else c.label || '星' || r.realm_name
  end,
  round((300 * power(3.2, r.realm_index) * (1 + 0.22 * (s.sub_index - 1)))::numeric),
  round((1.0 * power(1.12, r.realm_index) * (1 + 0.02 * (s.sub_index - 1)))::numeric, 4),
  round((100 * power(1.55, r.realm_index) * (1 + 0.11 * (s.sub_index - 1)))::numeric),
  round((60 * power(1.50, r.realm_index) * (1 + 0.10 * (s.sub_index - 1)))::numeric),
  round((8 * power(1.45, r.realm_index) * (1 + 0.09 * (s.sub_index - 1)))::numeric),
  round((2 * power(1.42, r.realm_index) * (1 + 0.08 * (s.sub_index - 1)))::numeric)
from realms r
cross join subs s
join cn c on c.num = s.sub_index
on conflict (level_order) do update
set threshold = excluded.threshold,
    base_rate_per_sec = excluded.base_rate_per_sec,
    hp_base = excluded.hp_base,
    qi_base = excluded.qi_base,
    attack_base = excluded.attack_base,
    defense_base = excluded.defense_base,
    label = excluded.label;

insert into public.global_configs (key, value, description)
values
  ('cultivation_speed_multiplier', to_jsonb(1::numeric), '全局修炼速度倍率'),
  ('skill_practice_rate_per_sec', to_jsonb(1::numeric), '斗技熟练度每秒增长'),
  ('max_offline_seconds', to_jsonb(86400::numeric), '单次离线结算上限'),
  ('heal_hp_pct_per_sec', to_jsonb(0.025::numeric), '疗伤每秒恢复血量百分比'),
  ('heal_qi_pct_per_sec', to_jsonb(0.04::numeric), '疗伤每秒恢复斗气百分比'),
  ('auction_close_hour_local', to_jsonb(16::numeric), 'UTC+8 拍卖结算小时'),
  ('auction_bid_lock_minutes', to_jsonb(30::numeric), '拍卖出价锁定分钟'),
  ('auction_min_increment_pct', to_jsonb(0.05::numeric), '最低加价比例'),
  ('auction_daily_system_lot_count', to_jsonb(3::numeric), '每日系统拍卖数量'),
  ('worker_income_cap_hours', to_jsonb(24::numeric), '工钱累计上限小时'),
  ('auto_cultivate_after_heal', to_jsonb(true), '疗伤完成后自动修炼'),
  ('auto_cultivate_after_chore', to_jsonb(false), '杂工完成后自动修炼'),
  ('config_version', to_jsonb(1::numeric), '配置版本')
on conflict (key) do nothing;

with method_seed(name, description, tier, grade, element, speed_multiplier, potential_multiplier, hp_multiplier, qi_multiplier, attack_multiplier, defense_multiplier, special_effects) as (
  values
    ('焚炎诀', '黄阶低级火属性功法。', 'huang', 'low', 'fire', 1.15, 1.00, 1.00, 1.00, 1.00, 1.00, '{}'::jsonb),
    ('青木吐纳', '黄阶中级木属性功法，略强体魄。', 'huang', 'mid', 'wood', 1.30, 1.01, 1.05, 1.00, 1.00, 1.00, '{}'::jsonb),
    ('疾风诀', '黄阶高级风属性功法，斗气更充盈。', 'huang', 'high', 'wind', 1.50, 1.03, 1.00, 1.08, 1.00, 1.00, '{}'::jsonb),
    ('雷鸣心法', '玄阶低级雷属性功法。', 'xuan', 'low', 'thunder', 1.80, 1.04, 1.00, 1.00, 1.05, 1.00, '{}'::jsonb),
    ('寒泉功', '玄阶中级冰属性功法，守势绵长。', 'xuan', 'mid', 'ice', 2.15, 1.06, 1.00, 1.00, 1.00, 1.08, '{}'::jsonb),
    ('地火焚身诀', '玄阶高级火属性功法，攻势炽烈。', 'xuan', 'high', 'fire', 2.60, 1.08, 1.00, 1.00, 1.12, 1.00, '{}'::jsonb),
    ('厚土玄功', '地阶低级土属性功法，血量雄浑。', 'di', 'low', 'earth', 3.30, 1.09, 1.20, 1.00, 1.00, 1.10, '{}'::jsonb),
    ('风雷化形诀', '地阶中级风雷相生的身法。', 'di', 'mid', 'wind', 4.10, 1.12, 1.00, 1.18, 1.08, 1.00, '{}'::jsonb),
    ('万毒心经', '地阶高级毒属性功法，暗藏毒劲。', 'di', 'high', 'poison', 5.20, 1.15, 1.05, 1.00, 1.05, 1.05, '{"poison": true}'::jsonb),
    ('九天星辉诀', '天阶低级光属性功法，潜力深厚。', 'tian', 'low', 'light', 7.00, 1.16, 1.10, 1.10, 1.08, 1.08, '{}'::jsonb),
    ('太虚古龙诀', '天阶中级暗属性功法，气血皆盛。', 'tian', 'mid', 'dark', 9.50, 1.20, 1.25, 1.25, 1.15, 1.10, '{}'::jsonb),
    ('帝炎焚天诀', '天阶高级火属性功法，攻伐无双。', 'tian', 'high', 'fire', 13.00, 1.25, 1.15, 1.15, 1.35, 1.10, '{}'::jsonb)
)
insert into public.game_items (
  item_type, owner_id, name, description, tier, grade, element,
  speed_multiplier, potential_multiplier, hp_multiplier, qi_multiplier,
  attack_multiplier, defense_multiplier, special_effects
)
select
  'method', null, name, description, tier::public.tier_type, grade::public.grade_type, element,
  speed_multiplier, potential_multiplier, hp_multiplier, qi_multiplier,
  attack_multiplier, defense_multiplier, special_effects
from method_seed seed
where not exists (
  select 1 from public.game_items item
  where item.owner_id is null and item.name = seed.name
);

with skill_seed(name, description, tier, grade, element, skill_kind, cooldown_sec, qi_cost_pct, power_multiplier, effect_json, proficiency_required) as (
  values
    ('吸掌', '黄阶低级无属性斗技。', 'huang', 'low', 'none', 'instant_damage', 3, 0.05, 1.15, '{}'::jsonb, 600),
    ('火云掌', '黄阶中级火属性斗技。', 'huang', 'mid', 'fire', 'instant_damage', 4, 0.06, 1.35, '{}'::jsonb, 960),
    ('裂风腿', '黄阶高级风属性斗技，可能暴击。', 'huang', 'high', 'wind', 'crit_strike', 5, 0.08, 1.45, '{"crit_chance": 0.2, "crit_multiplier": 1.5}'::jsonb, 1500),
    ('八极崩', '玄阶高级爆发斗技。', 'xuan', 'high', 'none', 'crit_strike', 8, 0.12, 2.8, '{"crit_chance": 0.25, "crit_multiplier": 1.8}'::jsonb, 4500),
    ('寒冰刃', '玄阶中级冰属性斗技，附带流血。', 'xuan', 'mid', 'ice', 'bleed', 7, 0.10, 2.1, '{"bleed_pct": 0.15, "bleed_seconds": 3}'::jsonb, 2880),
    ('风卷残云', '地阶中级风属性斗技，持续割裂。', 'di', 'mid', 'wind', 'bleed', 10, 0.15, 4.2, '{"bleed_pct": 0.2, "bleed_seconds": 4}'::jsonb, 8640),
    ('三千雷动', '地阶高级雷属性身法。', 'di', 'high', 'thunder', 'dodge_buff', 15, 0.16, 1.0, '{"dodge_chance": 0.35, "duration_seconds": 3}'::jsonb, 13500),
    ('佛怒火莲', '天阶高级火属性斗技。', 'tian', 'high', 'fire', 'instant_damage', 20, 0.25, 16.0, '{}'::jsonb, 40500)
)
insert into public.game_items (
  item_type, owner_id, name, description, tier, grade, element,
  skill_kind, cooldown_sec, qi_cost_pct, power_multiplier, effect_json,
  proficiency_xp, proficiency_required, is_basic
)
select
  'skill', null, name, description, tier::public.tier_type, grade::public.grade_type, element,
  skill_kind, cooldown_sec, qi_cost_pct, power_multiplier, effect_json,
  0, proficiency_required, false
from skill_seed seed
where not exists (
  select 1 from public.game_items item
  where item.owner_id is null and item.name = seed.name
);

with chore_seed(name, description, quality, min_level_order, duration_minutes, success_rate, base_reward, weight) as (
  values
    ('打扫炼药房', '清理药灰与残渣。', 'common', 0, 5, 0.95, 12, 12),
    ('看守山门', '在山门值守一轮。', 'common', 0, 20, 0.92, 15, 10),
    ('搬运药材', '把药材送到库房。', 'good', 0, 25, 0.95, 25, 9),
    ('抄录功法残卷', '誊写残卷，磨炼心性。', 'good', 3, 35, 0.92, 32, 8),
    ('护送商队', '护送小型商队穿过山道。', 'rare', 9, 60, 0.82, 60, 6),
    ('采集寒泉水', '前往寒泉取水。', 'rare', 9, 60, 0.80, 70, 6),
    ('猎杀低阶魔兽', '清理宗门周边魔兽。', 'epic', 18, 90, 0.78, 130, 4),
    ('潜入敌宗探查', '打探敌宗动向。', 'epic', 18, 120, 0.65, 160, 3),
    ('寻找异火线索', '追踪异火传闻。', 'legendary', 27, 180, 0.42, 350, 2),
    ('远古洞府扫荡', '探索破败洞府。', 'legendary', 36, 240, 0.38, 500, 1),
    ('修补聚气阵', '更换阵眼灵石。', 'good', 6, 30, 0.90, 38, 7),
    ('炼制止血散', '协助药师炼制丹散。', 'rare', 12, 50, 0.86, 75, 5),
    ('押运灵石箱', '护送宗门灵石。', 'epic', 24, 100, 0.70, 180, 3),
    ('清剿山匪', '扫平山道匪患。', 'rare', 15, 75, 0.78, 95, 5),
    ('夜巡后山', '巡查后山灵脉。', 'common', 0, 15, 0.94, 18, 10)
)
insert into public.chore_templates (
  name, description, quality, min_level_order, duration_minutes, success_rate, base_reward, weight
)
select
  name, description, quality::public.chore_quality, min_level_order, duration_minutes, success_rate, base_reward, weight
from chore_seed seed
where not exists (
  select 1 from public.chore_templates template
  where template.name = seed.name
);
