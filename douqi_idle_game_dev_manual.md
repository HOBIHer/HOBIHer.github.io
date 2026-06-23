# 斗气挂机修炼网页游戏开发手册（Codex Goal Mode 版）

> 项目代号：`douqi-idle-web`  
> 目标：开发一款移动端竖屏优先、可部署到 GitHub Pages / `github.io` 的网页挂机修炼 demo。  
> 后端：Supabase Postgres + Supabase Auth + RLS。  
> 说明：本手册是给 Codex 或其他代码代理执行开发时对照使用的产品、数值、数据库、前端与验收规格。

---

## 0. 最重要的实现原则

1. **这是纯静态网页应用**：最终部署在 `github.io`，不能依赖 Node 服务端、Next API Routes 或隐藏服务器密钥。
2. **Supabase publishable key 可以放前端，但必须启用 RLS**：不要把 `service_role` / `secret` key 放进任何前端代码、GitHub Pages、客户端环境变量或仓库。
3. **真实世界时间同步**：所有长期活动都只记录“开始时间、最后结算时间、活动类型、活动目标”，前端每秒只做本地展示投影，数据库不要每秒写入。
4. **免费数据库低请求量设计**：玩家操作切换、登录、页面恢复、战斗结束、拍卖出价、每 3-5 分钟心跳时才调用一次结算 RPC。
5. **同一时间只能做一件事**：修炼斗气、熟练斗技、玩家本人杂工、疗伤、未来被俘打工互斥。手下败将作为“工人”可以独立产生收益，不阻塞玩家本人。
6. **后台管理不能只靠隐藏路径**：隐藏路径只是入口，真实权限必须来自 Supabase Auth 登录用户的 `is_admin=true` 与 RLS / RPC 校验。
7. **Demo 阶段优先可玩、可扩展、可调数值**：复杂 PvP、反作弊、实时多人状态、交易监管可以预留表结构，不强制一次完成。

---

## 1. 技术栈与部署决策

### 1.1 推荐技术栈

- 前端：Vite + React + TypeScript。
- 路由：React Router，推荐 `HashRouter`，因为 GitHub Pages 对 SPA 的直链路由容易 404。
- 状态：Zustand 或 React Context；数据请求可用 TanStack Query，也可以简单封装 Supabase 查询。
- 样式：移动端优先 CSS，或 Tailwind。为了让 Codex 更快完成，默认可以使用普通 CSS + CSS variables。
- 后端：Supabase。
  - Auth：使用 Supabase email/password Auth，但前端对玩家展示为“用户名 + 密码”。
  - Database：Postgres tables + RLS policies。
  - RPC：使用 Postgres functions 处理关键经济与进度结算。

### 1.2 环境变量

用户已提供：

```env
NEXT_PUBLIC_SUPABASE_URL=https://gpaykyxwmouwadgmfnil.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_VNfyswX-5YqFzyG7lMlTBQ_fF8yM4Hz

postgresql://postgres:ljq15168442626@db.gpaykyxwmouwadgmfnil.supabase.co:5432/postgres
```

由于 Vite 默认只暴露 `VITE_` 前缀变量，应在 `vite.config.ts` 中加入：

```ts
export default defineConfig({
  plugins: [react()],
  envPrefix: ['VITE_', 'NEXT_PUBLIC_'],
})
```

并在 Supabase client 初始化中兼容读取：

```ts
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? import.meta.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? import.meta.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
```

推荐本地也补一份 Vite 变量，便于标准化：

```env
VITE_SUPABASE_URL=https://gpaykyxwmouwadgmfnil.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_VNfyswX-5YqFzyG7lMlTBQ_fF8yM4Hz
```

### 1.3 GitHub Pages 路由

- 推荐管理后台入口为：`/#/admin-stone-gate`。
- 玩家主入口为：`/#/`。
- 如果必须使用 `/admin-stone-gate` 这种真实 path，需要额外配置 `404.html` 将所有 path 重定向回 SPA；MVP 不强制。

### 1.4 认证方案：用户名 + 密码

Supabase Auth 原生支持 email/password。为了符合“只需要用户名和密码，不需要邮箱验证码”的 demo 需求：

- 前端要求用户名为：`3-20` 位，`a-zA-Z0-9_`。
- 登录时把用户名规范化为小写，并转换为伪邮箱：`{username}@douqi.local`。
- 注册时调用 Supabase `signUp({ email, password, options: { data: { username }}})`。
- 登录时调用 Supabase `signInWithPassword({ email, password })`。
- 在 Supabase Dashboard 中关闭 Email Confirmations。
- 通过数据库 trigger 在 `auth.users` 创建后自动写入 `public.player_profiles`。

不要自己在前端或普通 public table 中明文存密码。

---

## 2. 产品范围

### 2.1 本期 MVP 要做

1. 注册 / 登录 / 登出。
2. 移动端竖屏主界面：小人、等级、进度条、修炼 / 暂停 / 疗伤按钮、修炼体系弹窗。
3. 真实时间挂机修炼：离线期间也根据最后状态结算。
4. 功法与斗技界面：背包、装备一本功法、斗技熟练度、斗技释放顺序。
5. 玩家同一时间只能执行一个长期活动：修炼、熟练斗技、玩家本人杂工、疗伤。
6. 杂工系统：每日随机任务，玩家本人可做任务获取代币；战斗胜利获得“手下败将”工人，工人可产生被动收益。
7. 拍卖行：每日全服统一系统拍卖、玩家寄售、出价规则、16:00 结算。
8. 对战系统：玩家按斗技顺序与随机 NPC 对战，1 秒一结算，伤害保留到战后，需要疗伤。
9. 后台管理界面：管理员登录后查看用户状态，调整等级阈值 / 修炼速度，CRUD 功法、斗技、任务模板、拍卖。

### 2.2 本期不强制做，但要预留

1. 玩家 PvP 捕获系统：击败其他玩家后使其进入杂工状态。
2. 实时在线 PvP 匹配。
3. 邮箱、手机、第三方登录。
4. 完整反作弊与服务端战斗仲裁。
5. 复杂宗门、地图、副本、丹药、装备系统。
6. 拍卖行复杂监管、税率、流拍二次处理。

---

## 3. 世界观与核心名词

### 3.1 修炼等级体系

大境界顺序：

1. 斗之气
2. 斗者
3. 斗师
4. 大斗师
5. 斗灵
6. 斗王
7. 斗皇
8. 斗宗
9. 斗尊
10. 半圣
11. 斗圣
12. 斗帝

每个大境界 9 个小等级：

- `斗之气`：一段到九段。
- 其他大境界：一星到九星。

总小等级数：`12 * 9 = 108`。

等级 label 示例：

- `斗之气一段`
- `斗之气九段`
- `一星斗者`
- `九星斗帝`

代码中统一使用：

```ts
type RealmKey =
  | 'dou_zhi_qi'
  | 'dou_zhe'
  | 'dou_shi'
  | 'da_dou_shi'
  | 'dou_ling'
  | 'dou_wang'
  | 'dou_huang'
  | 'dou_zong'
  | 'dou_zun'
  | 'ban_sheng'
  | 'dou_sheng'
  | 'dou_di'
```

### 3.2 功法与斗技品阶

品阶：

1. 黄阶
2. 玄阶
3. 地阶
4. 天阶

每阶分级：

1. 低级
2. 中级
3. 高级

代码中：

```ts
type Tier = 'huang' | 'xuan' | 'di' | 'tian'
type Grade = 'low' | 'mid' | 'high'
```

### 3.3 斗气属性

Demo 默认属性：

- 无
- 火
- 水
- 风
- 雷
- 土
- 木
- 冰
- 毒
- 光
- 暗

功法决定玩家主属性。斗技也有属性。属性相同可获得小额加成。

MVP 属性规则：

- 功法属性与斗技属性相同：斗技最终伤害 `* 1.08`。
- 功法属性为 `无`：无加成。
- 斗技属性为 `无`：无加成。
- 暂不做复杂克制关系。

### 3.4 唯一代币

游戏只有一种代币，统一命名：`灵石`。

用途：

- 拍卖行出价。
- 未来系统扩展。

字段名：`coins`。

---

## 4. 核心数值设计

### 4.1 修炼进度模型

每个小等级有：

- `level_order`：0-107。
- `realm_index`：0-11。
- `sub_index`：1-9。
- `threshold`：突破到下个小等级所需斗气值。
- `base_rate_per_sec`：该等级的基础自然修炼速度。
- `hp_base`：基础最大血量。
- `qi_base`：基础最大斗气量。
- `attack_base`：基础攻击。
- `defense_base`：基础防御。

玩家当前等级记录：

- `level_order`
- `cultivation_xp`：当前小等级内已积累斗气值。

若 `cultivation_xp >= threshold`，则自动升级：

1. `cultivation_xp -= threshold`
2. `level_order += 1`
3. 重新读取下一小等级 config
4. 如仍超过新阈值，继续循环升级
5. 到达 107 后封顶，超额可保留或清零；MVP 建议封顶后 `cultivation_xp = threshold`

### 4.2 默认阈值公式

后台可以随时改每级阈值；下面只是 seed 默认值。

```ts
threshold = round(300 * pow(3.2, realmIndex) * (1 + 0.22 * (subIndex - 1)))
```

解释：

- `斗之气一段 -> 二段` 默认约 300 斗气，基础速度 1/s，约 5 分钟。
- 同一大境界内线性增长。
- 大境界之间几何倍率增长。
- 越后期必须依赖更高阶功法、后台活动与未来系统。

### 4.3 默认自然修炼速度公式

```ts
baseRatePerSec = round4(1.0 * pow(1.12, realmIndex) * (1 + 0.02 * (subIndex - 1)))
```

实际速度：

```ts
actualCultivationRate = levelConfig.base_rate_per_sec
  * equippedMethod.speed_multiplier
  * equippedMethod.potential_multiplier
  * globalConfig.cultivation_speed_multiplier
```

默认 `globalConfig.cultivation_speed_multiplier = 1`。测试时后台可以临时调成 `5` 或 `10`。

### 4.4 基础战斗属性公式

Seed 默认：

```ts
hpBase = round(100 * pow(1.55, realmIndex) * (1 + 0.11 * (subIndex - 1)))
qiBase = round(60 * pow(1.50, realmIndex) * (1 + 0.10 * (subIndex - 1)))
attackBase = round(8 * pow(1.45, realmIndex) * (1 + 0.09 * (subIndex - 1)))
defenseBase = round(2 * pow(1.42, realmIndex) * (1 + 0.08 * (subIndex - 1)))
```

装备功法后的最终属性：

```ts
maxHp = floor(hpBase * method.hp_multiplier)
maxQi = floor(qiBase * method.qi_multiplier)
attack = floor(attackBase * method.attack_multiplier)
defense = floor(defenseBase * method.defense_multiplier)
```

若未装备功法，使用默认功法：

```ts
{
  name: '无名吐纳法',
  tier: 'huang',
  grade: 'low',
  element: 'none',
  speed_multiplier: 1.0,
  potential_multiplier: 1.0,
  hp_multiplier: 1.0,
  qi_multiplier: 1.0,
  attack_multiplier: 1.0,
  defense_multiplier: 1.0
}
```

### 4.5 功法倍率表

| 品阶 | 低级修炼倍率 | 中级修炼倍率 | 高级修炼倍率 | 潜力倍率建议 |
|---|---:|---:|---:|---:|
| 黄阶 | 1.15 | 1.30 | 1.50 | 1.00-1.03 |
| 玄阶 | 1.80 | 2.15 | 2.60 | 1.04-1.08 |
| 地阶 | 3.30 | 4.10 | 5.20 | 1.09-1.15 |
| 天阶 | 7.00 | 9.50 | 13.00 | 1.16-1.25 |

潜力倍率在 MVP 中作用为：

- 参与修炼速度乘区。
- 参与未来拓展，如突破概率、上限、成长。

### 4.6 血量和斗气恢复

战斗造成的血量与斗气消耗在战斗结束后保留。

疗伤规则：

- 满血且满斗气时，疗伤按钮不可点击。
- 疗伤会占用当前长期活动。
- 默认每秒恢复：
  - HP：`maxHp * 0.025`，约 40 秒满血。
  - Qi：`maxQi * 0.04`，约 25 秒满斗气。
- 疗伤完成后，自动切换为 `cultivating`。

后台配置：

```json
{
  "heal_hp_pct_per_sec": 0.025,
  "heal_qi_pct_per_sec": 0.04,
  "auto_cultivate_after_heal": true
}
```

---

## 5. 长期活动与真实时间同步

### 5.1 活动类型

```ts
type ActivityType =
  | 'idle'
  | 'cultivating'
  | 'practicing_skill'
  | 'doing_chore'
  | 'healing'
  | 'captured_working' // 未来 PvP 使用
```

玩家 profile 中保存：

- `activity_type`
- `activity_target_id`
- `activity_payload jsonb`
- `activity_started_at timestamptz`
- `last_settled_at timestamptz`
- `last_seen_at timestamptz`

### 5.2 结算触发时机

调用 `settle_self()` 的时机：

1. 登录成功后。
2. App 首次加载当前玩家数据时。
3. 点击开始修炼 / 暂停 / 熟练斗技 / 杂工 / 疗伤前。
4. 每次长期活动切换前。
5. 页面从后台恢复到前台时。
6. 每 3-5 分钟一次心跳。
7. 战斗开始前与战斗结束后。
8. 拍卖出价前可以不结算修炼，但建议更新 `last_seen_at`。

不要每秒写数据库。

### 5.3 前端本地投影

前端每秒更新 UI，但不写 DB：

```ts
projectedXp = serverXp + elapsedSinceLastSnapshot * actualRate
projectedProgressPct = projectedXp / threshold
```

展示可以提前显示“预计已升级”，但真正等级以 `settle_self()` 返回为准。

### 5.4 离线收益上限

MVP 建议离线收益最大结算 24 小时：

```json
{
  "max_offline_seconds": 86400
}
```

后台可改。这样避免玩家长期不登录后一次结算过大，也保护免费数据库。

### 5.5 活动切换规则

所有长期活动切换必须走统一流程：

1. 调用 `settle_self()`。
2. 检查当前状态是否允许切换。
3. 更新 `activity_type`、`activity_target_id`、`activity_payload`、`activity_started_at=now()`、`last_settled_at=now()`。
4. 返回最新 player snapshot。

示例：

- 开始修炼：`start_activity('cultivating')`
- 暂停：`start_activity('idle')`
- 熟练斗技：`start_activity('practicing_skill', skillItemId)`
- 玩家本人杂工：`start_activity('doing_chore', choreRollId)`
- 疗伤：`start_activity('healing')`

---

## 6. 功法系统

### 6.1 功法定位

功法是玩家的核心被动配置，决定：

- 修炼速度。
- 斗气属性。
- 潜力倍率。
- HP / Qi / Attack / Defense 乘区。
- 特殊能力，MVP 以 JSON 预留。

玩家一次只能装备一本功法。

功法不需要修炼，直接装备生效。更换功法后重新计算上限：

- 若新 `maxHp` 小于当前 HP，当前 HP clamp 到新 max。
- 若新 `maxQi` 小于当前 Qi，当前 Qi clamp 到新 max。

### 6.2 功法字段

```ts
type MethodItem = {
  id: string
  item_type: 'method'
  owner_id: string | null
  name: string
  description: string
  tier: Tier
  grade: Grade
  element: ElementKey
  speed_multiplier: number
  potential_multiplier: number
  hp_multiplier: number
  qi_multiplier: number
  attack_multiplier: number
  defense_multiplier: number
  special_effects: Record<string, unknown>
  is_locked: boolean
}
```

`owner_id = null` 表示尚未被玩家拥有，可作为系统拍卖候选。  
`owner_id = user_id` 表示玩家拥有。  
`is_locked = true` 表示正在拍卖或系统处理中，不能装备、出售或练习。

### 6.3 功法背包 UI

功法与斗技共用“背包”概念。功法 tab 展示：

- 名称
- 品阶
- 属性
- 修炼倍率
- 潜力
- 是否装备中
- 操作：装备、查看、出售

---

## 7. 斗技系统

### 7.1 普通攻击

每个玩家默认拥有一个基础斗技：`普通攻击`。

规则：

- 不在拍卖行出现。
- 不可出售。
- 无 CD。
- 无斗气消耗。
- 每秒可释放一次。
- 作为所有战斗 fallback。

字段建议：

```json
{
  "name": "普通攻击",
  "tier": "huang",
  "grade": "low",
  "element": "none",
  "skill_kind": "normal_attack",
  "cooldown_sec": 0,
  "qi_cost_pct": 0,
  "power_multiplier": 1.0
}
```

### 7.2 斗技定位

斗技是主动战斗技能，需要熟练度。

玩家可在斗技界面：

- 查看已拥有斗技。
- 选择一个斗技开始熟练。
- 设置战斗释放顺序。
- 查看当前境界伤害与下一境界伤害。

熟练斗技会占用长期活动，因此不能同时修炼斗气。

### 7.3 熟练度规则

每个斗技有：

- `proficiency_xp`
- `proficiency_required`
- `proficiency_pct = clamp(xp / required, 0, 1)`

发挥倍率：

```ts
proficiencyFactor = 0.4 + 0.6 * proficiencyPct
```

阶段 label：

| 熟练度 | 阶段 | 发挥倍率约 |
|---:|---|---:|
| 0%-24% | 入门 | 40%-54% |
| 25%-49% | 小成 | 55%-69% |
| 50%-74% | 大成 | 70%-84% |
| 75%-99% | 圆满 | 85%-99% |
| 100% | 化境 | 100% |

熟练所需默认公式：

```ts
const tierCost = { huang: 1, xuan: 3, di: 9, tian: 27 }[tier]
const gradeCost = { low: 1, mid: 1.6, high: 2.5 }[grade]
proficiencyRequired = round(600 * tierCost * gradeCost)
```

默认熟练速度：

```ts
practiceXpPerSec = globalConfig.skill_practice_rate_per_sec // 默认 1
```

### 7.4 斗技字段

```ts
type SkillItem = {
  id: string
  item_type: 'skill'
  owner_id: string | null
  name: string
  description: string
  tier: Tier
  grade: Grade
  element: ElementKey
  skill_kind: 'normal_attack' | 'instant_damage' | 'bleed' | 'dodge_buff' | 'shield' | 'qi_burn' | 'crit_strike'
  cooldown_sec: number
  qi_cost_pct: number
  power_multiplier: number
  effect_json: Record<string, unknown>
  proficiency_xp: number
  proficiency_required: number
  is_basic: boolean
  is_locked: boolean
}
```

### 7.5 斗技默认倍率建议

| 品阶 | 低级伤害倍率 | 中级伤害倍率 | 高级伤害倍率 | 推荐斗气消耗 | 推荐 CD |
|---|---:|---:|---:|---:|---:|
| 黄阶 | 1.15 | 1.35 | 1.60 | 5%-8% | 3-5 秒 |
| 玄阶 | 2.00 | 2.50 | 3.10 | 8%-12% | 5-8 秒 |
| 地阶 | 4.00 | 5.20 | 6.80 | 12%-18% | 8-12 秒 |
| 天阶 | 9.00 | 12.00 | 16.00 | 18%-25% | 12-20 秒 |

### 7.6 斗技效果 MVP

优先实现以下效果类型：

1. `instant_damage`：立即造成伤害。
2. `bleed`：造成初始伤害，并附加持续每秒扣血。
3. `crit_strike`：带概率暴击。
4. `dodge_buff`：给自己增加一次或数秒闪避概率。
5. `shield`：吸收固定或百分比伤害。
6. `qi_burn`：扣除敌方斗气。

MVP 可以先完整实现 1-3，4-6 作为 JSON 展示和后续 TODO，但后台表单要能录入。

### 7.7 伤害计算

基础直接伤害：

```ts
rawDamage = attacker.attack
  * skill.power_multiplier
  * skill.proficiencyFactor
  * elementBonus
  * randomFactor

defenseReduction = defender.defense * 0.5
finalDamage = max(1, floor(rawDamage - defenseReduction))
```

其中：

```ts
elementBonus = method.element === skill.element && skill.element !== 'none' ? 1.08 : 1.0
randomFactor = random(0.92, 1.08)
```

暴击示例：

```ts
if (skill.kind === 'crit_strike' && random() < effect.crit_chance) {
  finalDamage *= effect.crit_multiplier
}
```

流血示例：

```ts
bleedTickDamage = floor(finalDamage * effect.bleed_pct)
bleedDurationSec = effect.duration_sec
```

### 7.8 Tooltip / 移动端提示

所有斗技数值支持：

- 桌面鼠标 hover：显示 tooltip。
- 移动端点击 / 长按：显示底部抽屉或弹窗。

提示内容：

- 当前等级预计伤害。
- 下一小等级预计伤害。
- 下一大境界一星预计伤害。
- 当前熟练度发挥百分比。
- 满熟练度伤害。

---

## 8. 杂工系统

### 8.1 目标

杂工系统是玩家获得灵石的主要入口。

MVP 包含两部分：

1. 玩家本人每日任务：占用长期活动。
2. 手下败将工人：战斗胜利后获得，可被动赚钱，不占用玩家修炼活动。

### 8.2 任务品质

品质：

```ts
type ChoreQuality = 'common' | 'good' | 'rare' | 'epic' | 'legendary'
```

中文：

- common：凡品
- good：良品
- rare：上品
- epic：珍品
- legendary：奇遇

默认任务参数：

| 品质 | 时长 | 基础成功率 | 奖励倍率 | 出现权重 |
|---|---:|---:|---:|---:|
| 凡品 | 10-20 分钟 | 95% | 1.0 | 60 |
| 良品 | 20-35 分钟 | 85% | 1.8 | 25 |
| 上品 | 35-60 分钟 | 72% | 3.2 | 10 |
| 珍品 | 60-120 分钟 | 58% | 6.0 | 4 |
| 奇遇 | 120-240 分钟 | 42% | 12.0 | 1 |

### 8.3 每日刷新

- 每个玩家每天刷新 5 个任务。
- 日期按 UTC+8 计算。
- 第一次打开杂工页时，如果当天没有任务，则调用 `generate_daily_chores()`。
- 后台任务模板可新增、删除、禁用。

### 8.4 奖励公式

```ts
realmCoinMultiplier = 1 + realmIndex * 0.6 + (subIndex - 1) * 0.03
reward = floor(template.base_reward * qualityMultiplier * realmCoinMultiplier)
```

失败奖励：

```ts
failReward = floor(reward * 0.15)
```

### 8.5 玩家本人做杂工

点击任务：

1. 先 `settle_self()`。
2. 如果当前活动不是可切换状态，提示“当前正在 X，不能同时做杂工”。
3. 调用 `start_activity('doing_chore', choreRollId)`。
4. 到时后通过 `settle_self()` 判定成功并发放灵石。
5. 完成后活动变为 `idle`，不自动修炼，除非后台配置 `auto_cultivate_after_chore=true`。

### 8.6 手下败将工人

玩家打赢 NPC 后获得一个 worker。

Worker 字段：

```ts
type Worker = {
  id: string
  owner_id: string
  name: string
  realm_label: string
  level_order: number
  efficiency: number
  source: 'npc' | 'player'
  captured_user_id?: string
  created_at: string
  last_collected_at: string
  active: boolean
}
```

MVP 被动收益：

```ts
workerCoinsPerHour = floor(2 * pow(1.18, workerRealmIndex) * worker.efficiency)
```

工人收益领取：

- 玩家点击“收取工钱”。
- 按 `last_collected_at` 到当前时间计算。
- 单次最多累计 24 小时。
- 不阻塞玩家本人活动。

未来 PvP：如果 worker 来源是玩家，`captured_user_id` 对应玩家会进入 `captured_working`，无法修炼或操作，直到释放、赎身、到期或被击败者反抗。

---

## 9. 拍卖行系统

### 9.1 目标

拍卖行提供功法与斗技流通。

MVP 支持：

1. 系统每日随机投放未拥有的功法 / 斗技。
2. 玩家出售自己拥有的功法 / 斗技。
3. 全服统一列表。
4. 每日下午 4 点结算。
5. 出价后 30 分钟内不能再次出价。
6. 不能连续由同一个玩家出价。

### 9.2 唯一物品规则

`game_items` 表中每一行代表一个唯一物品。

- `owner_id = null`：无人拥有，可被系统拍卖选择。
- `owner_id = user_id`：玩家拥有。
- `is_locked = true`：正在拍卖或处理中。

系统拍卖生成时只能选择：

```sql
where owner_id is null
  and is_locked = false
  and item_type in ('method', 'skill')
```

物品一旦被玩家获得，除非玩家重新寄售，否则不会再次出现在系统随机拍卖。

### 9.3 每日系统拍卖

- 每天 UTC+8 00:05 后首次访问拍卖行时生成当天拍卖。
- 默认每天 3 件系统物品。
- `closes_at` 为当天 UTC+8 16:00。
- 若当天 16:00 已过，则展示已结算或生成次日预告，不允许继续出价。

后台配置：

```json
{
  "auction_close_hour_local": 16,
  "auction_daily_system_lot_count": 3,
  "auction_bid_lock_minutes": 30,
  "auction_min_increment_pct": 0.05
}
```

### 9.4 出价规则

玩家点击出价时调用 `place_bid(lot_id, amount)`，数据库事务中执行：

1. `settle_due_auctions()` 或至少检查 lot 是否未过期。
2. 锁定 auction lot 行。
3. 检查 lot 状态为 `active`。
4. 检查当前时间 `< closes_at`。
5. 检查 `now() - last_bid_at >= 30 minutes`，首出价除外。
6. 检查 `last_bidder_id != auth.uid()`。
7. 检查出价金额 >= `max(start_price, current_bid * 1.05)`。
8. 检查玩家灵石足够。
9. 扣除本次出价金额。
10. 如果有上一位出价者，退还上一位出价金额。
11. 写入 `auction_bids`。
12. 更新 lot 的 `current_bid`、`current_bidder_id`、`last_bid_at`。

### 9.5 结算规则

`close_due_auctions()`：

- 所有人访问拍卖行时可触发。
- 管理员后台也可手动触发。
- 对 `closes_at <= now()` 且 `status='active'` 的拍卖逐个结算。

如果有最高出价者：

1. `game_items.owner_id = current_bidder_id`
2. `game_items.is_locked = false`
3. 若 seller 是玩家，则 seller 获得 `current_bid` 灵石；系统拍卖则灵石进系统 sink。
4. lot status = `closed`

如果无人出价：

1. 系统拍卖：物品解锁，`owner_id` 仍为 null。
2. 玩家寄售：物品解锁，仍归 seller。
3. lot status = `expired`

### 9.6 玩家寄售

玩家可以在背包中选择出售功法 / 斗技。

限制：

- 普通攻击不可出售。
- 装备中的功法不可出售，需先卸下或自动卸下。
- 战斗释放顺序中的斗技若出售，需要从顺序中移除。
- 正在拍卖的物品 `is_locked=true`，不可使用、不可装备、不可练习。

---

## 10. 对战系统

### 10.1 目标

Demo 阶段做 NPC 对战：

- 系统生成同大境界 NPC。
- NPC 随机小等级、随机功法、随机斗技。
- 玩家根据设置的斗技释放顺序自动战斗。
- 每秒一结算。
- 血量清零则结束。
- 赢了获得一个手下败将 worker。
- 输了 NPC 放玩家一马，不扣灵石、不丢物品，但战斗中造成的伤害保留。

### 10.2 战斗准备

战斗开始前：

1. 调用 `settle_self()`。
2. 如果玩家 HP <= 1，提示先疗伤。
3. 根据当前装备、等级、斗技顺序生成 player combatant。
4. 生成 NPC：
   - `realm_index` 与玩家相同。
   - `sub_index` 在玩家附近随机，默认 `playerSubIndex + random(-2, +2)` clamp 到 1-9。
   - 功法从内置 NPC 功法池随机。
   - 技能从内置 NPC 技能池随机 1-3 个。

### 10.3 每秒行动选择

每个战斗单位每秒按顺序选择技能：

1. 遍历自己的 `battle_strategy`。
2. 找到第一个：
   - 不在 CD 中。
   - 当前 qi 足够。
   - 技能未被禁用。
3. 释放该技能。
4. 如果没有可释放技能，释放普通攻击。

普通攻击无 CD、无消耗。

### 10.4 结算顺序

每一秒：

1. 处理上一秒留下的持续效果，如 bleed。
2. 玩家选择技能，NPC 选择技能。
3. 可简单处理为同时出手。
4. 计算消耗、伤害、buff/debuff。
5. 更新 CD。
6. 任一方 HP <= 0 时结束。
7. 若 180 秒仍未结束，按剩余 HP 百分比判定，或算玩家失败；MVP 建议 180 秒超时玩家失败。

### 10.5 战斗结束

玩家胜利：

- 保存玩家剩余 HP / Qi。
- 创建 worker：名称随机，境界取 NPC 境界，效率 `random(0.8, 1.2)`。
- 写入 battle log。
- 弹窗：“你击败了 X，可在杂工系统中派其打工”。

玩家失败：

- 保存玩家剩余 HP / Qi，最低保留 `1 HP`，避免无法进入界面。
- 写入 battle log。
- 弹窗：“对方放你一马，但你的伤势仍需疗养”。

### 10.6 战斗服务端权威程度

Demo 可先用前端 TS 模拟战斗，并在结束后通过 RPC 保存结果。因为 demo 用户少且无恶意注册，这是可接受的。

但需要把战斗核心逻辑写在纯函数中：

```ts
simulateBattle(input: BattleInput): BattleResult
```

这样未来可以迁移到 Supabase Edge Function 或数据库 RPC。

### 10.7 未来 PvP 预留

预留表：`captivity_records`。

未来规则：

- 玩家 A 挑战玩家 B。
- A 赢：B 进入 `captured_working`，一段时间内无法修炼、斗技、杂工、疗伤以外操作；A 获得 B 的打工收益。
- A 输：A 扣一笔灵石给 B。
- 需要服务端战斗仲裁，不能只依赖前端。

MVP 不实现真实 PvP 捕获，只做候选 UI 灰置说明。

---

## 11. 页面与交互设计

### 11.1 全局布局

移动端竖屏优先：

- 最大内容宽度：`430px`。
- 桌面居中显示，背景可做暗色渐变或卷轴风。
- 底部固定导航 5 个 tab：
  1. 修炼
  2. 功法
  3. 杂工
  4. 拍卖
  5. 对战
- 顶部显示：用户名、等级、灵石、当前状态。
- 所有卡片大按钮，适合触摸。

### 11.2 登录 / 注册页

字段：

- 用户名
- 密码

校验：

- 用户名 `3-20` 位，英文字母、数字、下划线。
- 密码至少 6 位。

注册成功后自动进入游戏。

### 11.3 修炼主界面

核心元素：

1. 小人 / 修炼者 avatar。
   - CSS 或 SVG 即可。
   - 修炼中有呼吸 / 光环动画。
   - 疗伤中用绿色或柔和光效。
2. 当前等级 label。
3. `?` 按钮：点击显示完整修炼体系。
4. 本级进度条。
5. 当前速度：`x.xx 斗气/秒`。
6. 当前活动状态。
7. HP / Qi 条。
8. 按钮：
   - 开始修炼
   - 暂停修炼
   - 疗伤
9. 今日离线收益提示：登录后若结算了离线进度，显示 toast。

状态按钮规则：

- 当前 `idle`：显示“开始修炼”。
- 当前 `cultivating`：显示“暂停修炼”。
- 当前 `healing`：显示“疗伤中”，不可重复点。
- 当前 HP/Qi 满：疗伤按钮 disabled。
- 当前在斗技 / 杂工：主按钮提示“正在熟练斗技 / 杂工中，切换会先结算当前进度”。

### 11.4 修炼体系弹窗

展示 12 个大境界，每个大境界 9 个小等级。

- 当前等级高亮。
- 已达到等级打勾。
- 未达到等级灰色。
- 点击某级可以查看阈值、基础速度、基础属性。

### 11.5 功法斗技界面

分为 3 个 tab：

1. 功法背包
2. 斗技背包
3. 战斗顺序

功法背包：

- 卡片展示品阶、属性、倍率、描述。
- 操作：装备 / 出售。

斗技背包：

- 卡片展示品阶、属性、熟练度、CD、斗气消耗。
- 操作：开始熟练 / 停止 / 出售 / 查看数值。

战斗顺序：

- 拖拽排序或上下按钮排序。
- 普通攻击固定最后 fallback，不必显示在队列里，但可以在说明中展示。
- 保存按钮调用 `update_battle_strategy()`。

### 11.6 杂工界面

分为 2 个 tab：

1. 今日任务
2. 手下败将

今日任务：

- 每日 5 个任务卡。
- 显示品质、时长、成功率、预计奖励、当前状态。
- 已完成任务置灰。
- 进行中任务显示倒计时。

手下败将：

- 显示 worker 列表。
- 显示境界、效率、待领取收益。
- 按钮：收取工钱。

### 11.7 拍卖行界面

分为 3 个 tab：

1. 今日拍卖
2. 我的出价
3. 我要寄售

今日拍卖卡片：

- 物品名称、类型、品阶、属性。
- 当前价、起拍价、最高出价者匿名或用户名。
- 距离结算时间。
- 距离可再次出价时间。
- 出价输入框和按钮。

出价按钮禁用条件：

- 拍卖结束。
- 距上次出价不足 30 分钟。
- 最高出价者是自己。
- 灵石不足。

### 11.8 对战界面

元素：

- 玩家战斗卡：HP/Qi、技能顺序。
- NPC 候选卡：境界、功法属性、难度估计。
- 按钮：刷新对手、开始战斗。
- 战斗过程日志：每秒一行，可折叠。
- 结果弹窗。

战斗日志示例：

```text
第 1 秒：你施展 八极崩，造成 38 伤害。对方普通攻击造成 9 伤害。
第 2 秒：流血造成 5 伤害。你普通攻击造成 12 伤害。
```

### 11.9 后台管理界面

入口：`/#/admin-stone-gate`

访问规则：

- 未登录：跳转登录。
- 已登录但 `is_admin=false`：显示无权限。
- `is_admin=true`：显示后台。

后台模块：

1. 玩家总览
   - 用户名
   - 等级
   - 进度
   - HP/Qi
   - 灵石
   - 当前活动
   - 装备功法
   - 最后在线
2. 等级配置
   - 108 级表格
   - 修改 threshold、base_rate、hp、qi、attack、defense
   - 支持“一键按公式重生成”
3. 全局配置
   - 修炼全服倍率
   - 离线上限
   - 疗伤速度
   - 斗技熟练速度
   - 拍卖配置
4. 功法 / 斗技管理
   - 新增、编辑、删除或禁用
   - 设置拥有者
   - 设置是否锁定
   - 效果 JSON 编辑
5. 杂工任务模板
   - 新增、编辑、禁用
   - 品质、时长、成功率、基础奖励、权重
6. 拍卖管理
   - 查看今日 lots
   - 手动生成系统拍卖
   - 手动结算
   - 强制下架 / 解锁

---

## 12. Supabase 数据库设计

### 12.1 Enum 建议

```sql
create type public.activity_type as enum (
  'idle',
  'cultivating',
  'practicing_skill',
  'doing_chore',
  'healing',
  'captured_working'
);

create type public.item_type as enum ('method', 'skill');
create type public.tier_type as enum ('huang', 'xuan', 'di', 'tian');
create type public.grade_type as enum ('low', 'mid', 'high');
create type public.auction_status as enum ('active', 'closed', 'expired', 'cancelled');
create type public.chore_quality as enum ('common', 'good', 'rare', 'epic', 'legendary');
```

### 12.2 表：player_profiles

```sql
create table public.player_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  display_name text,
  is_admin boolean not null default false,

  coins bigint not null default 0,
  level_order int not null default 0,
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
```

注意：`equipped_method_id` 可在创建 `game_items` 后再添加外键，避免循环依赖。

### 12.3 表：level_configs

```sql
create table public.level_configs (
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
```

### 12.4 表：global_configs

简单实现可以用 key-value：

```sql
create table public.global_configs (
  key text primary key,
  value jsonb not null,
  description text,
  updated_at timestamptz not null default now()
);
```

建议 seed：

```json
{
  "cultivation_speed_multiplier": 1,
  "skill_practice_rate_per_sec": 1,
  "max_offline_seconds": 86400,
  "heal_hp_pct_per_sec": 0.025,
  "heal_qi_pct_per_sec": 0.04,
  "auction_close_hour_local": 16,
  "auction_bid_lock_minutes": 30,
  "auction_min_increment_pct": 0.05,
  "auction_daily_system_lot_count": 3,
  "worker_income_cap_hours": 24
}
```

### 12.5 表：game_items

功法和斗技统一在一张唯一物品表。

```sql
create table public.game_items (
  id uuid primary key default gen_random_uuid(),
  item_type public.item_type not null,
  owner_id uuid null references public.player_profiles(id) on delete set null,

  name text not null,
  description text not null default '',
  tier public.tier_type not null default 'huang',
  grade public.grade_type not null default 'low',
  element text not null default 'none',

  -- method fields
  speed_multiplier numeric not null default 1,
  potential_multiplier numeric not null default 1,
  hp_multiplier numeric not null default 1,
  qi_multiplier numeric not null default 1,
  attack_multiplier numeric not null default 1,
  defense_multiplier numeric not null default 1,
  special_effects jsonb not null default '{}'::jsonb,

  -- skill fields
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
  updated_at timestamptz not null default now()
);
```

约束建议：

```sql
alter table public.game_items add constraint method_has_no_skill_kind
check (
  (item_type = 'method' and skill_kind is null)
  or
  (item_type = 'skill' and skill_kind is not null)
);
```

### 12.6 表：chore_templates

```sql
create table public.chore_templates (
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
```

### 12.7 表：daily_chore_rolls

```sql
create table public.daily_chore_rolls (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.player_profiles(id) on delete cascade,
  local_day date not null,
  template_id uuid not null references public.chore_templates(id),
  status text not null default 'available', -- available, in_progress, success, failed, expired
  started_at timestamptz null,
  completed_at timestamptz null,
  reward int not null default 0,
  result_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(user_id, local_day, template_id)
);
```

### 12.8 表：workers

```sql
create table public.workers (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.player_profiles(id) on delete cascade,
  name text not null,
  source text not null default 'npc', -- npc, player
  captured_user_id uuid null references public.player_profiles(id) on delete set null,
  level_order int not null default 0,
  realm_label text not null default '斗之气一段',
  efficiency numeric not null default 1,
  active boolean not null default true,
  last_collected_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
```

### 12.9 表：auction_lots

```sql
create table public.auction_lots (
  id uuid primary key default gen_random_uuid(),
  local_day date not null,
  item_id uuid not null references public.game_items(id),
  seller_id uuid null references public.player_profiles(id) on delete set null,
  source text not null default 'system', -- system, player

  status public.auction_status not null default 'active',
  start_price bigint not null,
  current_bid bigint null,
  current_bidder_id uuid null references public.player_profiles(id) on delete set null,
  last_bid_at timestamptz null,
  closes_at timestamptz not null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

### 12.10 表：auction_bids

```sql
create table public.auction_bids (
  id uuid primary key default gen_random_uuid(),
  lot_id uuid not null references public.auction_lots(id) on delete cascade,
  bidder_id uuid not null references public.player_profiles(id) on delete cascade,
  amount bigint not null,
  created_at timestamptz not null default now()
);
```

### 12.11 表：battle_logs

```sql
create table public.battle_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.player_profiles(id) on delete cascade,
  opponent_type text not null default 'npc',
  opponent_name text not null,
  result text not null, -- win, lose, timeout
  player_hp_after numeric not null,
  player_qi_after numeric not null,
  reward_payload jsonb not null default '{}'::jsonb,
  log_json jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
```

### 12.12 表：captivity_records（预留）

```sql
create table public.captivity_records (
  id uuid primary key default gen_random_uuid(),
  captor_id uuid not null references public.player_profiles(id) on delete cascade,
  captive_id uuid not null references public.player_profiles(id) on delete cascade,
  started_at timestamptz not null default now(),
  ends_at timestamptz null,
  income_rate numeric not null default 1,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
```

---

## 13. RLS 与权限策略

### 13.1 基础函数

```sql
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select coalesce((select is_admin from public.player_profiles where id = auth.uid()), false);
$$;
```

### 13.2 RLS 原则

1. 所有 public schema 中可被客户端访问的表都启用 RLS。
2. 玩家只能读取自己的 profile、自己的 worker、自己的 battle log、自己的 daily chore rolls。
3. 全服配置、等级配置、拍卖 lot 可被登录玩家读取。
4. 经济相关写入必须通过 RPC：
   - coins
   - level_order
   - cultivation_xp
   - game_items.owner_id
   - auction bids
   - workers
5. 管理员可以通过后台编辑配置与物品，但仍要校验 `is_admin()`。

### 13.3 示例 policy

```sql
alter table public.player_profiles enable row level security;

create policy "profiles select own or admin"
on public.player_profiles
for select
to authenticated
using (id = auth.uid() or public.is_admin());
```

建议不要给玩家直接 update 整个 profile，改用 RPC。若为了快速 MVP 允许部分字段更新，必须限制列权限，例如只允许 `battle_strategy`、`display_name`。

```sql
revoke update on public.player_profiles from authenticated;
-- 如需列级授权，再单独 grant update(display_name, battle_strategy) 并配合 policy。
```

配置表：

```sql
alter table public.level_configs enable row level security;

create policy "level configs readable"
on public.level_configs
for select
to authenticated
using (true);

create policy "level configs admin write"
on public.level_configs
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());
```

`game_items`：

- 玩家可读取：自己拥有的、无人拥有且未禁用的、正在拍卖 lot 指向的。
- 管理员可读写全部。
- 普通玩家不直接 update，出售、装备、练习通过 RPC。

---

## 14. 必要 RPC / 数据库函数

### 14.1 handle_new_user

Auth user 创建后自动创建 profile 与普通攻击。

```sql
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_username text;
begin
  v_username := coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1));

  insert into public.player_profiles (id, username, display_name)
  values (new.id, lower(v_username), v_username)
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
```

Trigger：

```sql
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
```

### 14.2 settle_self()

核心结算函数。签名：

```sql
public.settle_self() returns jsonb
```

职责：

- 锁定当前玩家 profile。
- 用数据库 `now()` 计算 elapsed。
- 根据 activity_type 结算：
  - cultivating：增加斗气并自动升级。
  - practicing_skill：增加斗技熟练度。
  - doing_chore：如果到时，判定成功并加灵石。
  - healing：恢复 HP/Qi，满后自动切换 cultivating。
  - idle：只更新 last_seen。
- 返回最新 player snapshot。

伪代码：

```text
function settle_self():
  uid = auth.uid()
  profile = select * from player_profiles where id=uid for update
  now_ts = now()
  elapsed = seconds_between(now_ts, profile.last_settled_at)
  elapsed = clamp(elapsed, 0, global.max_offline_seconds)

  if profile.activity_type == cultivating:
    gain = elapsed * currentLevel.base_rate * equippedMethod.speed * equippedMethod.potential * globalSpeed
    apply cultivation gain with level-up loop

  if profile.activity_type == practicing_skill:
    skill = lock owned skill by activity_target_id
    skill.proficiency_xp = min(required, xp + elapsed * practiceRate)

  if profile.activity_type == healing:
    compute maxHp/maxQi
    hp += elapsed * maxHp * healHpPct
    qi += elapsed * maxQi * healQiPct
    if hp == maxHp and qi == maxQi:
      activity_type = cultivating
      activity_started_at = now_ts

  if profile.activity_type == doing_chore:
    chore = lock activity_target_id
    if now_ts >= chore.started_at + duration:
      deterministic/random success
      add coins
      mark chore success/failed
      activity_type = idle

  update last_settled_at=now_ts, last_seen_at=now_ts
  return snapshot
```

### 14.3 start_activity(activity, target_id, payload)

签名：

```sql
public.start_activity(
  p_activity public.activity_type,
  p_target_id uuid default null,
  p_payload jsonb default '{}'::jsonb
) returns jsonb
```

职责：

1. 调用或执行 settle 逻辑。
2. 校验 activity 与 target。
3. 更新 profile activity。
4. 返回 snapshot。

校验例子：

- `practicing_skill`：target 必须是当前玩家拥有的 `item_type='skill'` 且不是 locked。
- `doing_chore`：target 必须是今天任务且 available。
- `healing`：当前 HP 或 Qi 未满。
- `cultivating` / `idle`：无需 target。

### 14.4 equip_method(item_id)

- 检查 item 是当前玩家拥有的功法。
- 检查未 locked。
- 结算当前状态。
- 设置 `equipped_method_id`。
- clamp HP/Qi。
- 返回 snapshot。

### 14.5 update_battle_strategy(skill_ids jsonb)

- 检查所有 skill id 属于当前玩家。
- 排除 locked / disabled。
- 普通攻击不必加入。
- 最多 6 个主动技能。
- 保存到 profile。

### 14.6 generate_daily_chores()

- 为当前玩家生成当天任务。
- 如果已生成，直接返回。
- 按 template weight 随机选 5 个符合等级的任务。

### 14.7 collect_worker_income(worker_id)

- 检查 worker 属于当前玩家。
- 根据 `last_collected_at` 计算收益。
- 单次最多累计 24 小时。
- 增加 coins。
- 更新 `last_collected_at`。

### 14.8 generate_daily_auctions()

- 全服函数。
- 若当天已存在 system lot，直接返回。
- 选择未拥有、未锁定 item，按品阶权重抽取 3 个。
- 创建 lots，并 `game_items.is_locked=true`。

### 14.9 place_bid(lot_id, amount)

按第 9.4 节规则实现事务。

### 14.10 close_due_auctions()

按第 9.5 节规则实现。

### 14.11 create_player_auction(item_id, start_price)

- 检查物品归当前玩家。
- 检查不是 basic。
- 检查未 locked。
- 如为当前装备功法，需要先拒绝并提示卸下，或自动卸下。
- 创建 auction lot，seller 为当前玩家。
- 锁定 item。

### 14.12 save_npc_battle_result(...)

MVP 前端模拟战斗后调用：

- 保存 battle log。
- 保存玩家 HP/Qi。
- 如果 win，创建 worker。
- 如果 lose，HP 最低 clamp 到 1。

参数中应包含 battle result 摘要，不要允许前端直接传 coins 增加。MVP 胜利只奖励 worker，不给大量 coins，降低作弊影响。

---

## 15. Seed 数据

### 15.1 等级配置 seed

Codex 应写一个 TS 或 SQL seed 脚本生成 108 行 `level_configs`。

realm 定义：

```ts
const realms = [
  ['dou_zhi_qi', '斗之气'],
  ['dou_zhe', '斗者'],
  ['dou_shi', '斗师'],
  ['da_dou_shi', '大斗师'],
  ['dou_ling', '斗灵'],
  ['dou_wang', '斗王'],
  ['dou_huang', '斗皇'],
  ['dou_zong', '斗宗'],
  ['dou_zun', '斗尊'],
  ['ban_sheng', '半圣'],
  ['dou_sheng', '斗圣'],
  ['dou_di', '斗帝'],
]
```

label：

```ts
if realmIndex === 0: `斗之气${cnNum[subIndex]}段`
else: `${cnNum[subIndex]}星${realmName}`
```

### 15.2 初始功法 seed

建议至少 12 本，便于拍卖：

1. 焚炎诀：黄阶低级，火，修炼 1.15。
2. 青木吐纳：黄阶中级，木，修炼 1.30，HP 1.05。
3. 疾风诀：黄阶高级，风，修炼 1.50，Qi 1.08。
4. 雷鸣心法：玄阶低级，雷，修炼 1.80，攻击 1.05。
5. 寒泉功：玄阶中级，冰，修炼 2.15，防御 1.08。
6. 地火焚身诀：玄阶高级，火，修炼 2.60，攻击 1.12。
7. 厚土玄功：地阶低级，土，修炼 3.30，HP 1.20。
8. 风雷化形诀：地阶中级，风/雷任选，修炼 4.10，Qi 1.18。
9. 万毒心经：地阶高级，毒，修炼 5.20，特殊 poison。
10. 九天星辰诀：天阶低级，光，修炼 7.00，潜力 1.16。
11. 太虚古龙诀：天阶中级，暗，修炼 9.50，HP/Qi 1.25。
12. 帝炎焚天诀：天阶高级，火，修炼 13.00，攻击 1.35。

这些 seed item 默认 `owner_id=null`，供系统拍卖。

### 15.3 初始斗技 seed

系统可拍卖斗技：

1. 吸掌：黄阶低级，无，instant_damage，倍率 1.15，CD 3，消耗 5%。
2. 火云掌：黄阶中级，火，instant_damage，倍率 1.35，CD 4，消耗 6%。
3. 裂风腿：黄阶高级，风，crit_strike，倍率 1.45，暴击 20% * 1.5，CD 5，消耗 8%。
4. 八极崩：玄阶高级，无，crit_strike，倍率 2.8，暴击 25% * 1.8，CD 8，消耗 12%。
5. 寒冰刺：玄阶中级，冰，bleed，倍率 2.1，流血 15% 持续 3 秒，CD 7，消耗 10%。
6. 风卷残云：地阶中级，风，bleed，倍率 4.2，流血 20% 持续 4 秒，CD 10，消耗 15%。
7. 三千雷动：地阶高级，雷，dodge_buff，倍率 1.0，闪避 35% 持续 3 秒，CD 15，消耗 16%。
8. 佛怒火莲：天阶高级，火，instant_damage，倍率 16，CD 20，消耗 25%。

### 15.4 杂工模板 seed

至少 15 个任务：

- 打扫炼药房：凡品，15 分钟，95%，base 12。
- 看守山门：凡品，20 分钟，92%，base 15。
- 搬运药材：良品，25 分钟，85%，base 25。
- 抄录功法残卷：良品，35 分钟，82%，base 32。
- 护送商队：上品，50 分钟，72%，base 60。
- 采集寒泉水：上品，60 分钟，70%，base 70。
- 猎杀低阶魔兽：珍品，90 分钟，58%，base 130。
- 潜入敌宗探查：珍品，120 分钟，55%，base 160。
- 寻找异火线索：奇遇，180 分钟，42%，base 350。
- 远古洞府扫荡：奇遇，240 分钟，38%，base 500。

---

## 16. 前端代码结构建议

```text
douqi-idle-web/
  index.html
  package.json
  vite.config.ts
  public/
    404.html                # 可选
  src/
    main.tsx
    App.tsx
    lib/
      supabase.ts
      env.ts
    game/
      constants.ts
      formulas.ts
      battle.ts
      labels.ts
      projection.ts
      types.ts
    store/
      authStore.ts
      gameStore.ts
    components/
      AppShell.tsx
      BottomNav.tsx
      StatBar.tsx
      ProgressBar.tsx
      Modal.tsx
      TooltipOrSheet.tsx
      ItemCard.tsx
    pages/
      LoginPage.tsx
      CultivationPage.tsx
      MethodsSkillsPage.tsx
      ChoresPage.tsx
      AuctionPage.tsx
      BattlePage.tsx
      AdminPage.tsx
    styles/
      global.css
      theme.css
  supabase/
    migrations/
      001_schema.sql
      002_rls.sql
      003_functions.sql
      004_seed.sql
  README.md
```

### 16.1 公式层

所有游戏公式放在 `src/game/formulas.ts`，不要散落在组件中。

必须包含：

- `getLevelLabel(levelOrder)`
- `computeLevelSeedConfig(realmIndex, subIndex)`
- `computeStats(levelConfig, method)`
- `computeCultivationRate(levelConfig, method, globalConfig)`
- `computeSkillDamagePreview(attackerStats, defenderStats, skill, method)`
- `computePracticeProgress(skill)`
- `computeWorkerIncome(worker, now)`

### 16.2 Battle 纯函数

`src/game/battle.ts`：

```ts
export function simulateBattle(input: BattleInput): BattleResult
```

要求：

- 不直接访问 React state。
- 不直接访问 Supabase。
- 输入相同 seed 时结果可复现。MVP 可先用简单随机；最好传入 seeded RNG。
- 输出包含每秒 log。

### 16.3 UI 主题

建议风格：

- 背景：深色玄幻渐变。
- 卡片：半透明、圆角、轻微阴影。
- 主色：金色 / 琥珀色。
- 危险：红色 HP。
- 斗气：蓝紫色 Qi。
- 修炼进度：金色。

不要为了 demo 引入过重 UI 库。

---

## 17. 本地缓存与请求策略

### 17.1 缓存内容

可以缓存到 localStorage：

- level_configs
- global_configs
- item catalog / owned item snapshot
- last player snapshot
- UI tab 状态

### 17.2 缓存失效

`global_configs` 中增加：

```json
{
  "config_version": 1
}
```

后台每次大改配置时更新 `config_version`。前端发现版本变化后重新拉取 configs。

### 17.3 请求频率

普通玩家典型请求：

- 打开 app：3-5 次查询 / RPC。
- 挂机中：每 3-5 分钟 1 次 `settle_self()`。
- 前端每秒 UI tick 不请求数据库。

避免使用 Supabase Realtime 监听所有表。管理员页面如需刷新，手动按钮或 30-60 秒轮询即可。

---

## 18. 管理员账号初始化

因为不能在前端放 admin secret，推荐流程：

1. 通过正常注册页注册用户名：`admin`。
2. 到 Supabase SQL editor 执行：

```sql
update public.player_profiles
set is_admin = true
where username = 'admin';
```

3. 以后用 `admin` + 注册时密码登录。
4. 后台入口：`/#/admin-stone-gate`。

Demo 也可以在 README 中说明：如需更换管理员，直接 update 对应 profile。

---

## 19. 开发里程碑

### Milestone 1：项目脚手架与基础登录

完成：

- Vite React TS 项目。
- Supabase client。
- 登录 / 注册 / 登出。
- HashRouter。
- 移动端 AppShell + BottomNav。
- Supabase migrations 初版。

验收：

- 可以注册用户。
- 注册后 Supabase 中出现 profile 和普通攻击。
- 登录后进入主界面。

### Milestone 2：修炼主循环

完成：

- `level_configs` seed 108 级。
- `global_configs` seed。
- `settle_self()` + `start_activity()`。
- 主界面实时投影进度条。
- 修炼 / 暂停 / 疗伤。
- 修炼体系弹窗。

验收：

- 开始修炼后进度每秒增长。
- 刷新页面后进度不丢。
- 离线几分钟再回来能结算。
- 升级能自动发生。

### Milestone 3：功法与斗技

完成：

- `game_items` seed。
- 功法背包与装备。
- 斗技背包与熟练按钮。
- 熟练度结算。
- 战斗顺序保存。
- tooltip / 移动弹窗显示当前与下一境界数值。

验收：

- 装备功法影响修炼速度与属性。
- 同一时间不能既修炼又熟练斗技。
- 斗技熟练度随真实时间增长。

### Milestone 4：杂工系统

完成：

- 任务模板 seed。
- 每日任务生成。
- 玩家本人做杂工。
- 成功率和奖励结算。
- Worker 被动收益与领取。

验收：

- 每天有任务。
- 做任务占用活动。
- 完成后获得灵石或失败奖励。
- Worker 可以收取工钱。

### Milestone 5：拍卖行

完成：

- 每日系统拍卖生成。
- 出价、退款、锁定。
- 16:00 结算。
- 玩家寄售。
- 我的出价。

验收：

- 同一物品不会重复出现在多个 active lot。
- 30 分钟出价锁生效。
- 同一玩家不能连续出价。
- 结算后物品转移，灵石扣转正确。

### Milestone 6：NPC 对战

完成：

- 斗技顺序读取。
- NPC 生成。
- 1 秒一结算战斗模拟。
- HP/Qi 战后保存。
- 胜利生成 worker。
- 失败无额外惩罚。

验收：

- 战斗日志完整。
- 战斗后必须回主界面疗伤。
- 满血无法疗伤，疗伤结束自动修炼。

### Milestone 7：后台管理

完成：

- Admin route。
- 权限检查。
- 玩家总览。
- 等级配置编辑。
- 全局配置编辑。
- 功法 / 斗技 CRUD。
- 任务模板 CRUD。
- 拍卖管理。

验收：

- 非管理员无法进入。
- 管理员能修改阈值和速度。
- 修改后普通玩家刷新或下次结算生效。

### Milestone 8：部署与 QA

完成：

- GitHub Actions build。
- GitHub Pages deploy。
- README 完整。
- `.env.example`。
- `npm run build` 通过。
- 基础错误提示和 loading 状态。

---

## 20. 验收清单

### 20.1 功能验收

- [ ] 用户可注册、登录、登出。
- [ ] 注册只需用户名和密码。
- [ ] 主界面适配手机竖屏。
- [ ] 修炼体系完整展示 12 大境界 * 9 小等级。
- [ ] 修炼进度与真实时间同步。
- [ ] 数据库不每秒写入。
- [ ] 后台可修改每级阈值和速度。
- [ ] 功法可装备，影响速度与属性。
- [ ] 斗技可熟练，熟练占用活动。
- [ ] 战斗顺序可设置。
- [ ] 杂工任务每日刷新，能获得灵石。
- [ ] 拍卖行全服统一，16:00 结算。
- [ ] 出价 30 分钟锁与不能连续出价生效。
- [ ] NPC 对战 1 秒结算，血量伤害保留。
- [ ] 疗伤满后自动修炼。
- [ ] 管理员后台可用。

### 20.2 安全与数据验收

- [ ] 没有 service role key 出现在前端或仓库。
- [ ] public schema 关键表启用 RLS。
- [ ] 普通玩家不能直接改 coins、level、owner_id。
- [ ] 经济交易通过 RPC。
- [ ] 拍卖出价扣款和退款在事务中完成。
- [ ] 管理员权限来自 `is_admin()`，不是仅靠路由路径。

### 20.3 构建验收

- [ ] `npm install` 成功。
- [ ] `npm run build` 成功。
- [ ] `npm run lint` 成功，若项目配置 lint。
- [ ] 本地 `npm run dev` 可玩。
- [ ] GitHub Pages 构建后的静态页面可打开。

---

## 21. 给 Codex 的额外开发建议

1. 先让游戏可跑，再逐步加强 RLS 与 RPC 细节。
2. 每完成一个 milestone 都运行 `npm run build`。
3. 如果 PL/pgSQL 一次写完整太复杂，先实现核心 RPC：`settle_self`、`start_activity`、`place_bid`、`close_due_auctions`，其余后台 CRUD 可暂用 admin RLS 直连。
4. 不要把公式写死在 UI 组件里，统一放 `formulas.ts`。
5. 不要为了 demo 引入复杂动画库，CSS 动画足够。
6. 每个 Supabase 调用都要有 loading / error UI。
7. 时间展示用用户本地时间，拍卖结算按 UTC+8。
