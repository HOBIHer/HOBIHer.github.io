# 「喝水记录」网页自验与上线手册

这套喝水奖励 Demo 完全运行在网页中，由三部分组成：

- `/#/water`：手机优先的喝水记录、瓶中水位、逐帧角色动画、“我的刮刮乐”和已兑换金额用户端。
- `supabase/migrations/006_water_rewards.sql` 与 `supabase/functions/`：累计饮水量、加权随机奖励、唯一刮刮乐编码、兑换校验和后台接口。
- `/#/water-admin`：查询刮刮乐记录、完成线下兑换和维护奖池的管理后台。

页面中的水瓶初始剩余 `1000ml`。一口按 `20ml`、一杯按 `250ml` 从瓶中取水，水位随已喝量下降；喝空一瓶时结算 1 张刮刮乐，然后显示下一瓶。每台浏览器设备每天最多累计 `2000ml`、也就是 2 瓶；最后一次操作若超过上限，只计入当天剩余额度，第 2 瓶喝空后保持空瓶且喝水按钮停用。跨瓶操作的剩余饮水量会从下一瓶继续扣除。这些数值只是便于记录的估算值，不是饮水或医疗建议。

初始奖池采用总权重 `10000` 的整数权重：现金档位为 `10 / 20 / 30 / 50 / 66 / 88 / 100 / 200 / 520 元`，另有“超级神秘大奖”。其中 `520 元`权重为 `29`，即 `29 / 10000 = 0.29%`；“超级神秘大奖”权重为 `1`，即 `1 / 10000 = 0.01%`。这些是初始概率，后台修改权重后应以当时所有启用奖励的权重总和重新计算实际概率。

## 0. 先轮换已经暴露的凭据

在部署前，先在 Supabase 控制台轮换数据库密码，以及聊天中出现过的 Secret key / 旧 service-role key。它们不能进入网页代码、Git 仓库、GitHub Actions 变量、文档或截图。

工作区中的旧说明已改成占位符，但泄露值仍可能存在于聊天记录或 Git 历史中，因此不能只删除当前文件。若仓库已经公开，还应在团队确认后清理历史，并轮换所有复用过相同口令的项目。

`sb_publishable_...` 是设计给浏览器使用的公开密钥，可以进入前端构建产物。系统安全边界必须由服务端校验、数据库权限和 RLS 提供，不能依靠隐藏 publishable key。

## 1. 环境变量

喝水用户端与后台共用一个 Supabase 项目，但分别调用两个 Edge Function：

```env
VITE_WATER_SUPABASE_URL=https://你的项目.supabase.co
VITE_WATER_SUPABASE_PUBLISHABLE_KEY=你的_publishable_key
VITE_WATER_USER_API_FUNCTION=water-rewards-api
VITE_WATER_ADMIN_FUNCTION=water-rewards-admin
VITE_WATER_USER_MOCK=true
VITE_WATER_ADMIN_MOCK=true
```

- `VITE_WATER_USER_MOCK=true`：用户端只读写当前浏览器的本地数据。
- `VITE_WATER_ADMIN_MOCK=true`：后台只读写当前浏览器的示例管理数据。
- 当两个页面处于同一站点来源且同时启用 mock 时，它们共享浏览器本地刮刮乐台账，可以离线验收从喝空结算、申请兑换到后台核销、用户回读状态与已兑换金额的完整链路。
- 联网自验和 GitHub Pages 正式构建必须把两个 mock 开关都设为精确的小写字符串 `false`。

浏览器端永远不要配置数据库密码、Secret key、service-role key、`WATER_ADMIN_PASSWORD` 或服务端签名密钥。

## 2. 最快的离线自验

在仓库根目录创建 `.env.local`，写入上一节配置并保持两个 mock 开关为 `true`，然后运行：

```powershell
npm install
npm run dev
```

### 2.1 手机用户端

在浏览器打开终端显示的本地地址，再进入 `/#/water`。推荐同时用桌面浏览器的手机尺寸模拟和一台真实手机浏览器检查。如果主要从微信聊天分享链接，还要在微信内置浏览器中完整走一遍，确认页面、刮奖手势、网络请求与本地状态都正常。

1. 首次进入时确认第 1 瓶显示剩余 `1000ml`。点击“一口”或“一杯”，确认对应逐帧角色动画播放，动画期间按钮不会重复提交，结束后水位按实际记录量下降。
2. 连续点击 4 次“一杯 250ml”，确认前三次后第 1 瓶依次显示 `750 / 500 / 250ml`；第 4 次判定该瓶喝空并结算 1 张刮刮乐，关闭结算层后第 2 瓶显示剩余 `1000ml`。
3. 反复滑动刮刮乐涂层，确认奖励内容和唯一编码能够显示；无法方便刮动时也应能使用页面提供的直接揭晓方式。
4. 打开“我的刮刮乐”，确认新记录存在且状态为可申请。
5. 点击“申请兑换”，确认状态变为“已申请”或“待线下兑换”。
6. 刷新页面，确认水位、刮刮乐和已揭晓状态仍然保留。
7. 喝空第 2 瓶，确认会生成新的唯一编码；同一个奖励允许再次出现，但每次生成的唯一编码不同。
8. 当日累计达到 `2000ml` 后，确认水瓶显示 `0% / 0ml`，“一口”和“一杯”按钮均停用，刷新后仍保持今日上限状态。

另做一次“最后一笔截断”自验：清除站点数据后先累计到 `1990ml`，再点击“一口 20ml”，预期只计入剩余的 `10ml`、今日累计停在 `2000ml`，第 2 瓶显示空瓶并结算刮刮乐，而不是累计到 `2010ml`。

想重做离线用户端测试，可在浏览器开发者工具中清除该站点的 Local Storage / 站点数据后刷新。

### 2.2 管理后台

进入 `/#/water-admin`，离线模式使用 `admin` / `admin` 登录。

1. 确认刚才由用户端申请兑换的刮刮乐已经出现在“待兑换”列表。
2. 切换“全部”“待兑换”“已完成”等筛选项，并用刚才的唯一编码或查询 key 搜索。
3. 对该记录点击“标记线下兑换完成”，确认状态和统计数字同步变化。
4. 回到 `/#/water` 刷新“我的刮刮乐”，确认同一条记录变成“已兑换”；固定现金奖励还应计入页面的“已兑换金额”，超级神秘大奖不增加固定现金金额。
5. 进入后台奖池页，修改奖励权重或新增奖励，刷新后确认本地修改仍然存在。

若两个页面来自不同端口、不同域名或不同浏览器配置，它们不会共享 Local Storage。离线联调时应从同一个 `npm run dev` 地址打开两个 hash 路由。

## 3. 部署 Supabase 后端

以下示例沿用项目 ref `ilhdespamsutecfabknr`；若使用新项目，请替换为自己的 ref、URL 和 publishable key。

### 3.1 建表并初始化奖池

在 Supabase 控制台的 SQL Editor 中，新建查询并完整执行：

```text
supabase/migrations/006_water_rewards.sql
```

仓库中的 `001` 到 `005` 属于另一个游戏项目。全新的喝水 Supabase 项目只需执行 `006_water_rewards.sql`，不要直接对空项目运行整个仓库的 `supabase db push`。

迁移会创建设备、喝水请求、奖池、刮刮乐记录和管理员审计数据，并写入总权重 `10000` 的初始现金奖池与每日 `2000ml` 限额。每次喝空结算都会创建独立记录、唯一编码和查询 key；同一个奖励可以重复出现。

如果这个喝水后端已经部署过旧版，也要在 SQL Editor 中重新完整执行最新的 `006_water_rewards.sql`，不能只重新构建网页。执行前先备份当前奖池与刮刮乐记录；SQL 成功后继续重新部署下一节的两个 Edge Function，确保数据库函数与客户端接口来自同一版本。

### 3.2 设置仅服务端可见的配置

先登录 Supabase CLI：

```powershell
npx supabase login
```

分别生成两个不少于 32 字符的随机值，并为远程后台设置强口令：

```powershell
npx supabase secrets set --project-ref ilhdespamsutecfabknr WATER_ADMIN_USERNAME=admin WATER_ADMIN_PASSWORD="替换成强口令" WATER_DEVICE_TOKEN_SECRET="替换成设备令牌随机长字符串" WATER_ADMIN_SESSION_SECRET="替换成另一个会话随机长字符串"
```

`admin/admin` 只适合离线 Demo。管理函数一旦公开部署，就必须覆盖默认密码；否则任何知道地址的人都能登录后台。

### 3.3 部署 Edge Functions

```powershell
npx supabase functions deploy water-rewards-api --project-ref ilhdespamsutecfabknr --no-verify-jwt
npx supabase functions deploy water-rewards-admin --project-ref ilhdespamsutecfabknr --no-verify-jwt
```

两个入口会在函数内部校验 publishable key。用户端在首次使用时取得随机设备凭据，后续请求还会校验设备 token；后台接口校验短期签名会话。数据库 Secret key 只存在于 Supabase 托管的函数环境中。

对于已经上线的旧版本，正确更新顺序是：先重新执行最新 `006_water_rewards.sql`，确认无 SQL 错误，再运行上面两条 function deploy 命令，最后按第 4 节重新联网验收。

## 4. 本地联网验收

把本机 `.env.local` 改为：

```env
VITE_WATER_SUPABASE_URL=https://ilhdespamsutecfabknr.supabase.co
VITE_WATER_SUPABASE_PUBLISHABLE_KEY=你的_publishable_key
VITE_WATER_USER_API_FUNCTION=water-rewards-api
VITE_WATER_ADMIN_FUNCTION=water-rewards-admin
VITE_WATER_USER_MOCK=false
VITE_WATER_ADMIN_MOCK=false
```

重启 `npm run dev`。如果浏览器此前运行过离线模式，建议先清除该本地站点的数据，避免把旧 mock 状态误认为线上数据。

1. 进入 `/#/water`，依次完成“从第 1 瓶喝 4 杯 → 第 4 杯触发喝空结算 → 刮开刮刮乐 → 我的刮刮乐 → 申请兑换”。记下唯一编码或查询 key，并确认每次操作都会播放相应逐帧角色动画。
2. 打开 `/#/water-admin`，用刚设置的远程管理员账号登录。
3. 搜索刚才的唯一编码或查询 key，确认奖励内容和状态均与用户端一致。
4. 在后台标记线下兑换完成。
5. 回到用户端刷新“我的刮刮乐”，确认状态变成“已兑换”；固定现金奖励应同步增加“已兑换金额”。
6. 继续累计到当天 `2000ml`，确认最后一次最多只计入剩余额度，第 2 瓶喝空后按钮停用且不会继续生成刮刮乐。
7. 刷新两个页面并重新打开浏览器，确认用户设备凭据、刮刮乐、已兑换金额、每日上限和后台状态都能正常恢复。

## 5. 代码级验收

每次准备发布前运行：

```powershell
npm test
npm run build
```

至少覆盖以下场景：

| 场景 | 预期 |
| --- | --- |
| 连点“一口”或“一杯” | 忙碌状态不会重复提交同一操作 |
| 当前瓶已喝 `750ml`，再喝一杯 | 判定该瓶喝空并结算 1 张刮刮乐；若仍有当日额度，下一瓶显示剩余 `1000ml` |
| 当前瓶已喝 `900ml`，再喝一杯 | 结算 1 张刮刮乐，跨瓶的 `150ml` 继续从下一瓶扣除，下一瓶显示剩余 `850ml` |
| 当日 `1990ml` 再喝一口 | 只计入 `10ml`，累计停在 `2000ml`，第 2 瓶显示空瓶并结算刮刮乐 |
| 当日已累计 `2000ml` | 喝水按钮停用；服务端也拒绝继续累计或生成刮刮乐 |
| 请求超时后重试 | 相同 `requestId` 不会重复累计饮水量或重复生成刮刮乐 |
| 同一奖励多次出现 | 每条刮刮乐记录的唯一编码和查询 key 仍然不同 |
| 初始奖池 | 启用权重总和为 `10000`；`520 元`为 `29`（`0.29%`），超级神秘为 `1`（`0.01%`） |
| 已兑换金额 | 只累计状态为“已兑换”的固定现金奖励；未兑换记录和超级神秘大奖不计入固定金额 |
| 已申请的刮刮乐再次申请 | 返回当前状态，不产生第二条记录 |
| 未申请的刮刮乐直接后台核销 | 服务端拒绝 |
| 已兑换的刮刮乐再次申请 | 服务端拒绝 |
| 普通浏览器客户端直接访问表或 RPC | RLS / 权限拒绝 |
| 后台错误密码或过期会话 | 返回未授权并要求重新登录 |
| 两个 mock 开关任一不为 `false` | GitHub Pages 构建门禁拒绝发布 |

## 6. 发布到 GitHub Pages

### 6.1 配置生产构建变量

在 GitHub 仓库 `Settings → Secrets and variables → Actions → Variables` 中确认：

```text
VITE_WATER_SUPABASE_URL=https://ilhdespamsutecfabknr.supabase.co
VITE_WATER_SUPABASE_PUBLISHABLE_KEY=你的_publishable_key
VITE_WATER_USER_API_FUNCTION=water-rewards-api
VITE_WATER_ADMIN_FUNCTION=water-rewards-admin
VITE_WATER_USER_MOCK=false
VITE_WATER_ADMIN_MOCK=false
```

Publishable key 本身可以作为 Repository Variable；不要在这里配置数据库密码或 Supabase Secret key。仓库 workflow 也提供当前 Demo 的公开默认值，但上线前仍应逐项核对目标项目，避免把页面连到错误环境。

发布 workflow 会先执行测试，再检查两个 mock 开关是否都为精确的 `false`，最后才构建并上传 `dist/`。这个门禁用于防止把只操作浏览器本地数据的版本误发布为正式版。

### 6.2 发布与生产验收

1. 在仓库 `Settings → Pages` 中确认 Source 使用 GitHub Actions。
2. 将通过验收的代码提交并推送到 `main`。
3. 等待 `Deploy` workflow 的 build 和 deploy 两个 job 全部成功。
4. 用无痕窗口分别打开：

```text
https://hobiher.github.io/#/water
https://hobiher.github.io/#/water-admin
```

5. 在手机浏览器走完一次“从瓶中取水 → 喝空一瓶 → 结算并揭晓刮刮乐 → 申请兑换”，同时确认水位下降和逐帧角色动画正常，再到后台搜索并完成核销。
6. 回到用户页刷新，确认生产环境能读回“已兑换”状态，并确认页面没有显示本地自验模式提示。
7. 确认固定现金奖励已计入“已兑换金额”。再用测试设备验收到当天 2 瓶上限；若不希望在正式刮刮乐台账留下测试记录，应事先准备专用测试环境或在留存审计记录的前提下按既定运维流程处理测试数据。

## 7. Demo 之后的安全与运维建议

- 为管理员使用独立强密码，并定期轮换管理员会话密钥与设备令牌密钥。
- 当前用户身份是浏览器本机设备凭据，不是账号；清除站点数据、换浏览器或换手机都会生成新身份，当前 Demo 不支持跨设备找回刮刮乐记录。上线后可再接微信 OAuth 或其他账号系统提供跨设备恢复。
- 给注册、喝水记录、兑换和管理员登录增加按 IP / 设备的限流、失败告警和异常审计。
- 定期备份奖池与刮刮乐记录，并保留线下兑换记录。
- 上线后持续保留双 mock 门禁，避免生产页面静默退回本地数据。
- 当前现金奖励只用于私人、免费、无充值或付费参与的线下兑换，不是医疗建议，也不应包装为公开商业抽奖。若后续公开运营、收费、导流促销或与品牌活动结合，应在上线前重新评估适用法律、税务、平台规则和未成年人保护等合规要求。
