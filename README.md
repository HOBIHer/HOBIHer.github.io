# douqi-idle-web

## 喝水记录

仓库还包含一套纯网页喝水奖励应用：手机用户端 `/#/water`、刮刮乐管理后台 `/#/water-admin`，以及负责随机奖励与兑换校验的 Supabase 后端。页面中的水瓶初始剩余 `1000ml`；每口按 `20ml`、每杯按 `250ml` 从瓶中取水，水位随已喝量下降。每喝空一瓶结算 1 张刮刮乐，并切换到下一瓶；第 2 瓶喝空后保持空瓶状态。每台浏览器设备每天最多累计 `2000ml`（2 瓶），最后一次操作若超过上限，只计入剩余额度，达到上限后喝水按钮停用。

“一口”和“一杯”操作会播放各自的逐帧角色动画，动画及网络请求期间不会重复提交。初始现金奖励奖池包含 `10 / 20 / 30 / 50 / 66 / 88 / 100 / 200 / 520 元`等档位及“超级神秘大奖”，总权重为 `10000`。其中 `520 元`权重为 `29`（`0.29%`），“超级神秘大奖”权重为 `1`（`0.01%`）。“我的刮刮乐”区域会显示状态、唯一编码和已兑换金额。完整的离线自验、联网验收和 GitHub Pages 上线步骤见 [docs/water-rewards-runbook.md](docs/water-rewards-runbook.md)。

移动竖屏优先的斗气题材挂机修炼 demo。前端是可静态托管的 Vite React TypeScript SPA，路由默认使用 `HashRouter`，后端能力来自 Supabase Auth、Postgres、RLS 与 RPC。

## 功能

- 用户名 + 密码注册登录，内部转换为 `{username}@douqi.example.com` 使用 Supabase email/password Auth。用户名中的 `_` 会在 fake email 中映射为 `-`，用户名本身仍保存在 Auth metadata 与 `player_profiles.username`。
- 修炼、暂停、疗伤、斗技熟练、杂工等长活动互斥。
- 修炼进度按真实时间结算，前端每秒只做本地投影显示。
- 功法装备、斗技熟练度、战斗释放顺序、NPC 自动战斗。
- 每日杂工、手下败将工钱、系统/玩家拍卖。
- `/#/admin-stone-gate` 后台，权限来自 `player_profiles.is_admin=true`。

## Supabase Setup

1. 创建 Supabase 项目。
2. 在 Auth 设置中关闭 Email Confirmations，确保 demo 用户注册后可以直接登录。
3. 在 SQL editor 中按顺序执行：

```sql
-- supabase/migrations/001_schema.sql
-- supabase/migrations/002_rls.sql
-- supabase/migrations/003_functions.sql
-- supabase/migrations/004_seed.sql
-- supabase/migrations/005_recovery_and_levelup.sql
```

4. 注册一个普通用户，例如用户名 `admin`。
5. 在 SQL editor 中赋予后台权限：

```sql
update public.player_profiles
set is_admin = true
where username = 'admin';
```

## Environment

复制 `.env.example` 为 `.env.local`，填入 Supabase 项目 URL 和 publishable key：

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
```

同一组值也支持 `NEXT_PUBLIC_SUPABASE_URL` 与 `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`。Vite 已配置 `envPrefix` 暴露这两类前缀。

喝水网页使用独立的公开配置。复制 `.env.example` 后，可用 `VITE_WATER_USER_MOCK=true` 与 `VITE_WATER_ADMIN_MOCK=true` 做完全离线自验；连接后端时将两者改为 `false`。具体变量和联调顺序见 [喝水奖励上线手册](docs/water-rewards-runbook.md)。

## Local Development

```bash
npm install
npm run dev
```

质量检查：

```bash
npm test
npm run build
```

真实 Supabase smoke test：

```bash
npm run smoke:supabase
npm run smoke:supabase -- --register
```

第一条只检查环境变量；第二条会创建一个随机 `codex_smoke_*` 测试账号，验证注册、登录、profile、普通攻击、108 行等级配置、`settle_self` 与 `start_activity('cultivating')`。
如果 Supabase 返回 `email rate limit exceeded`，等待项目 Auth 限流窗口恢复后重跑第二条。

## Updating An Existing Supabase Project

如果项目已经部署过旧版 SQL，只需要在 Supabase SQL editor 执行最新增量文件：

```sql
-- supabase/migrations/005_recovery_and_levelup.sql
```

该迁移会增加自然恢复配置，并替换 `settle_self()`：突破升境界后自动回满 HP/Qi；非疗伤状态也会按很慢速度自然恢复 HP/Qi。

如果喝水奖励后端已经部署过旧版，请在 Supabase SQL Editor 中重新完整执行最新的 `supabase/migrations/006_water_rewards.sql`，再重新部署 `water-rewards-api` 与 `water-rewards-admin` 两个 Edge Function。这样才能同步现金奖池、每日两瓶上限和接口返回字段；详细命令及验收步骤见喝水奖励上线手册。

## GitHub Pages

本项目使用 hash 路由，静态资源 `base` 为相对路径，适合部署到 `github.io`。仓库中包含 GitHub Actions workflow，会在推送到 `main` 时执行构建并发布 `dist/`。

GitHub Actions 构建时会注入 Supabase publishable env。默认 workflow 已带当前 demo 项目的 public 配置；如果要切换 Supabase 项目，可在 GitHub 仓库的 Settings -> Secrets and variables -> Actions 中设置相应 URL 与 publishable key。喝水应用上线构建还会强制检查用户端和后台的 mock 开关均为 `false`。

入口：

```text
/#/water
/#/water-admin
/#/admin-stone-gate
```

## Data Safety

- 浏览器端只使用 Supabase publishable key。
- 玩家经济、等级、经验、物品归属、拍卖状态等写入通过 RPC 完成。
- 普通玩家不能直接更新关键资源字段。
- 前端不按秒写数据库；登录、活动切换、页面恢复、战斗结束、拍卖动作和 3-5 分钟心跳才会结算。
