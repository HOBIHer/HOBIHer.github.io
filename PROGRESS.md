# Progress

## Milestone 1: Project Skeleton + Basic Combat Loop

Status: Completed for the requested first playable slice.

## Completed

- Created a Vite + React + TypeScript project skeleton.
- Added Zustand state management in `src/game/store/useGameStore.ts`.
- Added Vitest tests in `src/tests/combat.test.ts`, `src/tests/cardEffects.test.ts`, and `src/tests/storeFlow.test.ts`.
- Implemented the original starter class `铁誓者`.
- Implemented original starter cards:
  - `短刃推进`
  - `架势防护`
  - `破势重击`
- Implemented original reward cards:
  - `沉弧斩`
  - `整息`
  - `铁架`
  - `横线扫击`
  - `热血`
  - `稳步`
  - `盾压`
- Implemented original enemies:
  - `训练木偶`
  - `锈刃斥候`
  - `石簿员`
- Implemented the basic local combat loop:
  - Start run.
  - Start combat.
  - Draw opening hand.
  - Play cards with energy costs.
  - Resolve damage, block, and vulnerable.
  - Discard played cards and end-turn hand.
  - Resolve enemy intent and enemy actions.
  - Win combat.
  - Generate card rewards.
  - Choose or skip reward.
  - Continue to the next combat.
- Built DOM + CSS screens for main menu, combat, and rewards.
- Added visible hand, enemy, player, draw pile, discard pile, exhaust pile, combat log, and end-turn button.
- Kept the first version local-only with no account, server, telemetry, or gameplay network integration.
- Updated `docs/MECHANICS.md` with Milestone 1 implementation status.

## Verification Commands

```bash
npm test
npm run build
npm run dev -- --host 127.0.0.1 --port 5173
```

`npm test` passed with 3 test files and 9 tests on 2026-06-08. `npm run build` also passed. The Vite dev server responded with HTTP 200 at `http://127.0.0.1:5173`.

## Notes

- `npm.ps1` is blocked by the local PowerShell execution policy, so validation used `npm.cmd`.
- The first `npm install` attempt timed out and left a temporary Node process; it was stopped, then `npm.cmd install --no-audit --no-fund` completed successfully.
- Reward flow uses a minimal local card-choice implementation: after victory, choose one generated card or skip, then immediately start the next combat.
- Local save, run history, import/export, low-profile mode, custom backgrounds, maps, rest points, bosses, and relic triggers remain for later milestones.
- Status ids for the full mechanics plan exist, but only the Milestone 1 subset has gameplay coverage.

## Milestone 2: Status System + Relic Trigger System

Status: Completed.

## Completed

- Added data-driven status definitions in `src/game/data/statuses/statuses.ts`.
- Added original relic definitions in `src/game/data/relics/relics.ts`.
- Added relic ids, hooks, trigger conditions, trigger effects, and turn stats to the shared game types.
- Implemented required statuses:
  - `strength`
  - `dexterity`
  - `vulnerable`
  - `weak`
  - `frail`
  - `artifact`
  - `thorns`
  - `regen`
  - `bleed`
  - `barrierLock`
- Implemented required relic hooks:
  - `onCombatStart`
  - `onTurnStart`
  - `onTurnEnd`
  - `onCardPlayed`
  - `onAttackPlayed`
  - `onSkillPlayed`
  - `onEnemyKilled`
  - `onShuffle`
  - `onVictory`
- Implemented original relics:
  - `旧铜扣`
  - `裂纹透镜`
  - `沉纸镇`
  - `余温币`
  - `静手套`
- Added `src/tests/statusEffects.test.ts` for required status interactions.
- Added `src/tests/relics.test.ts` for the five required relic effects.
- Kept the default run relic-free so Milestone 1 gameplay behavior remains unchanged unless a test or caller explicitly opts into relic ids.

## Verification Commands

```bash
npm test
npm run build
```

`npm test` passed with 5 test files and 23 tests on 2026-06-08. `npm run build` also passed with TypeScript checking.

## Notes

- `裂纹透镜` is implemented as a turn-start relic trigger on turn 1 after the normal opening draw, producing a 6-card opening hand when the relic is present.
- `bleed` and `regen` resolve at the owner's turn end and then decay by one stack.
- `barrierLock` preserves block during the next turn-start cleanup and then decays by one stack.
- No real networking, account system, server integration, telemetry, or commercial-game content was added.

## Milestone 3: Low-Profile Mode + Multiple Themes + Background Replacement

Status: Completed.

## Completed

- Added `GameMode` support for `normal` and `stealth`.
- Added `ThemeId` support for:
  - `normal`
  - `document`
  - `dashboard`
  - `code`
  - `meeting`
  - `terminal`
- Added terminology mapping for normal and low-profile labels.
- Added low-profile card names and descriptions to all current warrior cards.
- Added local settings persistence through `src/adapters/settingsAdapter.ts`.
- Added background options and custom local image reading through `src/adapters/backgroundAdapter.ts`.
- Added six theme CSS files:
  - `src/ui/themes/normal.css`
  - `src/ui/themes/document.css`
  - `src/ui/themes/dashboard.css`
  - `src/ui/themes/code.css`
  - `src/ui/themes/meeting.css`
  - `src/ui/themes/terminal.css`
- Added root theme class generation in `src/ui/themes/appTheme.ts`.
- Added settings UI for mode, theme, background, opacity, compact mode, local background upload, and clearing local settings.
- Added keyboard controls:
  - `S` toggles normal/stealth mode.
  - `E` ends the current turn/cycle during combat.
  - `1-9` play cards by hand position during combat.
  - `Esc` opens or closes settings.
- Updated main menu, combat screen, reward screen, card view, enemy panel, player panel, pile display, and combat log to use mode-aware labels.
- Added `src/tests/stealthUi.test.ts` for low-profile labels, root theme classes, and local background settings persistence.

## Verification Commands

```bash
npm test
npm run build
```

`npm test` passed with 6 test files and 27 tests on 2026-06-08. `npm run build` also passed with TypeScript checking.

## Notes

- Low-profile mode is presentation-only. It changes labels, card display text, theme classes, and background settings without changing combat engine rules.
- Custom images are read as local data URLs and saved only in localStorage. No upload, network call, account, server integration, telemetry, or analytics was added.
- Theme and background settings are intentionally isolated in UI/adapters rather than the rules engine.

## Milestone 4: Local Save + Run History + Import/Export + Cloud Placeholder

Status: Completed.

## Completed

- Added `StorageAdapter` and `LocalStorageAdapter` in `src/adapters/storageAdapter.ts`.
- Added versioned localStorage payloads for:
  - `currentRun`
  - `settings`
  - `runHistory`
- Added `migrateSaveData(raw)` for versioned saves and legacy raw payloads.
- Kept the existing settings helper API while routing it through the shared storage adapter.
- Added current run persistence from the Zustand store after run start, card play, turn end, reward choice, and reward skip.
- Added local run history storage and abandoned/defeated run summary recording when returning to the menu.
- Added run history JSON export and import actions in the store.
- Added settings UI controls for:
  - cloud sync disabled status
  - clearing local current run save
  - exporting run history JSON
  - importing run history JSON
- Added `CloudSyncAdapterPlaceholder` with:
  - `uploadRunSummary()`
  - `downloadRunHistory()`
  - `syncSettings()`
- Added `src/tests/storageAdapter.test.ts` for settings save/load, current run save/load, run history export/import, and disabled cloud sync behavior.

## Verification Commands

```bash
npm test
npm run build
```

`npm test` passed with 7 test files and 32 tests on 2026-06-08. `npm run build` also passed with TypeScript checking.

## Notes

- Cloud sync is only a placeholder. It returns `NotEnabled` disabled results and does not call `fetch` or any network API.
- No server, account, login, telemetry, ads, analytics, or external URL request was added.
- Import/export is JSON text based inside the local settings UI. File-based export can be added later without changing the storage adapter contract.

## Milestone 5: Linear Map + Rewards + Rest Point + Boss Placeholder

Status: Completed.

## Completed

- Added a deterministic five-node linear route:
  - 普通战斗
  - 普通战斗
  - 精英战斗
  - 休整点
  - Boss
- Added map node progression with locked/current/completed states and no node skipping.
- Added enemy groups in `src/game/data/enemies/groups.ts`.
- Added original elite enemy `iron_beadle` / `铁铃执事`.
- Added original Boss placeholder `bell_tower_guardian` / `钟塔守卫`.
- Added run orchestration in `src/game/engine/run.ts` for:
  - starting a run at the map
  - entering combat, elite, rest, and Boss nodes
  - completing combat into reward flow
  - claiming or skipping rewards
  - resting for 30% max HP
  - victory and defeat summaries
- Expanded reward generation in `src/game/engine/rewards.ts`:
  - normal combat: 3 unique card choices and 10-15 gold
  - elite combat: 3 unique card choices, 20-30 gold, and one unowned relic when available
  - Boss: placeholder completion reward that leads to victory summary
- Added local run history summaries for victory and defeat.
- Added UI screens for map, rest, reward, victory, defeat, and run history.
- Added low-profile labels:
  - 地图 -> 流程面板
  - 普通战斗 -> 常规会话
  - 精英战斗 -> 重点事项
  - 休整点 -> 整理节点
  - Boss -> 最终议题
  - 奖励 -> 处理结果
  - 金币 -> 额度
  - 生命 -> 稳定度
  - 遗物 -> 凭证
- Updated `docs/MECHANICS.md` and marked Milestone 5 complete in `docs/MILESTONES.md`.

## Main Files Added or Modified

- `src/game/types.ts`
- `src/game/data/enemies/training.ts`
- `src/game/data/enemies/groups.ts`
- `src/game/engine/map.ts`
- `src/game/engine/rewards.ts`
- `src/game/engine/run.ts`
- `src/game/engine/combat.ts`
- `src/game/store/useGameStore.ts`
- `src/adapters/storageAdapter.ts`
- `src/adapters/cloudSyncAdapterPlaceholder.ts`
- `src/App.tsx`
- `src/ui/terminology/terminology.ts`
- `src/ui/screens/MainMenu.tsx`
- `src/ui/screens/CombatScreen.tsx`
- `src/ui/screens/MapScreen.tsx`
- `src/ui/screens/RestScreen.tsx`
- `src/ui/screens/RewardScreen.tsx`
- `src/ui/screens/VictoryScreen.tsx`
- `src/ui/screens/DefeatScreen.tsx`
- `src/ui/screens/RunHistoryScreen.tsx`
- `src/ui/components/EnemyPanel.tsx`
- `src/index.css`
- `src/tests/mapEngine.test.ts`
- `src/tests/runMilestone5.test.ts`
- `src/tests/milestone5StealthScreens.test.ts`
- `src/tests/storeFlow.test.ts`
- `src/tests/storageAdapter.test.ts`
- `src/tests/stealthUi.test.ts`
- `docs/MECHANICS.md`
- `docs/MILESTONES.md`
- `PROGRESS.md`

## Verification Commands

```bash
npm test
npm run build
npm run dev -- --host 127.0.0.1 --port 5173
```

## Test Result

`npm test` passed on 2026-06-09 with 10 test files and 48 tests.

## Build Result

`npm run build` passed on 2026-06-09 with TypeScript checking and Vite production build.

`npm run dev` is reachable at `http://127.0.0.1:5173` and responded with HTTP 200.

## Known Issues

- The first map is intentionally linear and has no branching, events, shop, or Act 2.
- The Boss is a single-phase placeholder by design.
- Rest point only supports healing; card upgrade remains a disabled placeholder.
- Reward pools are still small and should be expanded in the next milestone.
- Some earlier combat/status/relic text remains minimal placeholder copy from prior milestones.

## Next Step

Milestone 6: expand the Iron Oath card pool, enemy pool, and relic pool with more original, data-driven content and content validation tests.

## Milestone 6: Expanded Iron Oath Card, Enemy, Group, and Relic Pools

Status: Completed.

## Completed

- Expanded the Iron Oath card pool to 34 total cards:
  - 3 starter cards
  - 15 common cards
  - 10 uncommon cards
  - 6 rare cards
- Kept existing card ids and added original common/uncommon/rare cards.
- Added `target` to card definitions and kept card resolution in `game/engine`.
- Added data-driven card effects:
  - `gainEnergy`
  - `loseHp`
  - `heal`
  - `damageAll`
  - `conditional`
  - `blockNextTurn`
- Expanded enemies to:
  - 9 normal enemies
  - 4 elite enemies
  - 2 Boss enemies
- Added `intentPattern` and low-profile names to all enemies.
- Expanded enemy groups to:
  - 8 normal combat groups
  - 4 elite groups
  - 2 Boss groups
- Added multi-enemy combat support for enemy groups with multiple enemy ids.
- Added clickable enemy target selection in combat UI.
- Expanded relics to 17 total relics with:
  - rarity
  - low-profile name
  - low-profile description
  - legal trigger data
- Added weighted card rewards:
  - normal combat: common/uncommon/rare = 70/25/5
  - elite combat: common/uncommon/rare = 55/35/10
- Added weighted relic rewards:
  - common/uncommon/rare = 65/28/7
- Ensured reward generation remains seed deterministic, avoids duplicate card choices, avoids already owned relics, and handles empty relic pools.
- Fixed `drawCards()` so `onShuffle` relics that draw cards correctly sync the hand back into the outer draw operation.
- Added `docs/CONTENT_CATALOG.md` with all current cards, enemies, enemy groups, and relics.
- Updated `docs/MECHANICS.md` and marked Milestone 6 complete in `docs/MILESTONES.md`.

## Main Files Added or Modified

- `src/game/types.ts`
- `src/game/data/cards/warrior.ts`
- `src/game/data/enemies/training.ts`
- `src/game/data/enemies/groups.ts`
- `src/game/data/relics/relics.ts`
- `src/game/engine/effects.ts`
- `src/game/engine/relics.ts`
- `src/game/engine/rewards.ts`
- `src/game/engine/combat.ts`
- `src/game/engine/run.ts`
- `src/game/engine/deck.ts`
- `src/ui/components/EnemyPanel.tsx`
- `src/ui/screens/CombatScreen.tsx`
- `src/ui/screens/RewardScreen.tsx`
- `src/index.css`
- `src/tests/contentValidationM6.test.ts`
- `src/tests/rewardsM6.test.ts`
- `src/tests/cardEffectsM6.test.ts`
- `src/tests/relicsM6.test.ts`
- `src/tests/stealthContentM6.test.ts`
- `src/tests/statusEffects.test.ts`
- `docs/CONTENT_CATALOG.md`
- `docs/MECHANICS.md`
- `docs/MILESTONES.md`
- `PROGRESS.md`

## Verification Commands

```bash
npm test
npm run build
```

## Test Result

`npm test` passed on 2026-06-09 with 15 test files and 74 tests.

## Build Result

`npm run build` passed on 2026-06-09 with TypeScript checking and Vite production build.

## Known Issues

- The route is still the Milestone 5 five-node linear route; larger map variety remains future work.
- The expanded card/relic/enemy numbers are first-pass local tuning and should be adjusted through playtesting.
- Rest point still only supports healing; upgrade remains a placeholder.
- Bosses are single-phase first-version encounters.
- No shop, event, unlock, or Act 2 content has been added yet.

## Next Step

Recommended next milestone: add broader run variety through map branching, more node types such as events/shops, and content validation around encounter difficulty bands.

## v1.1.0: Branching Route and Experience Improvements

Status: Completed.

## Completed

- Replaced the first act's five-node linear route with a deterministic branching route graph.
- Added `nextNodeIds` to map nodes and route progression that unlocks next nodes while locking same-floor alternatives after a branch choice.
- Added active-run continue from the main menu.
- Added combat-start snapshots so returning to the main menu during combat and continuing restarts that combat from the same opening hand, shuffle state, enemy intents, and pre-reward state.
- Added explicit `defeated` state to enemy combatants.
- Updated combat resolution so defeated enemies are logged, skipped, not targeted by all-enemy effects, and cannot be selected again.
- Updated enemy UI to show defeated targets as muted/completed.
- Added hover/focus descriptions for status chips in normal and low-profile terminology.
- Added clickable draw, discard, and exhaust pile viewers.
- Updated rest points to show HP before/after and healed amount before returning to the map.
- Added main menu continue UI.
- Updated local save schema to version 2 with legacy v1 read fallback and normalization for branching map nodes, defeated enemies, combat snapshots, and rest results.
- Expanded README with local setup, run, stop, test, build, and localStorage save notes.
- Added `CHANGELOG.md` with v1.1.0 notes.
- Updated `docs/MECHANICS.md` and `docs/MILESTONES.md`.

## Main Files Added or Modified

- `README.md`
- `CHANGELOG.md`
- `src/game/types.ts`
- `src/game/engine/map.ts`
- `src/game/engine/run.ts`
- `src/game/engine/combat.ts`
- `src/game/engine/effects.ts`
- `src/game/store/useGameStore.ts`
- `src/adapters/storageAdapter.ts`
- `src/ui/screens/MainMenu.tsx`
- `src/ui/screens/MapScreen.tsx`
- `src/ui/screens/CombatScreen.tsx`
- `src/ui/screens/RestScreen.tsx`
- `src/ui/components/EnemyPanel.tsx`
- `src/ui/components/PlayerPanel.tsx`
- `src/ui/components/PileInfo.tsx`
- `src/ui/components/StatusPill.tsx`
- `src/ui/terminology/statusDescriptions.ts`
- `src/index.css`
- `src/tests/mapEngine.test.ts`
- `src/tests/runMilestone5.test.ts`
- `src/tests/rewardsM6.test.ts`
- `src/tests/v110Experience.test.ts`
- `docs/MECHANICS.md`
- `docs/MILESTONES.md`
- `PROGRESS.md`

## Verification Commands

```bash
npm test
npm run build
npm run dev -- --host 127.0.0.1 --port 5174
```

## Test Result

`npm test` passed on 2026-06-09 with 16 test files and 82 tests.

## Build Result

`npm run build` passed on 2026-06-09 with TypeScript checking and Vite production build.

`npm run dev -- --host 127.0.0.1 --port 5174` is reachable at `http://127.0.0.1:5174` and responded with HTTP 200. Port 5173 was already occupied during verification.

## Known Issues

- Branching is limited to the first act route and still uses only combat, elite, rest, and Boss nodes.
- Rest still only supports healing; upgrade remains a disabled placeholder.
- Bosses remain single-phase first-version encounters.
- There are still no event, shop, unlock, or Act 2 systems.
- Combat resume intentionally restarts from the combat opening snapshot, not the exact mid-turn pause state.

## Next Step

Recommended next milestone: add broader run variety with event and shop placeholders, then expand map-generation constraints and encounter difficulty bands with original local content.
