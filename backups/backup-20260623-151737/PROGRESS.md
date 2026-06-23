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

## v1.2.0: Multi-Start Tree Map + Card Upgrades + Potion System

Status: Completed.

## Completed

- Replaced the previous first-act route with a deterministic upward tree:
  - 3 available bottom start nodes
  - combat and elite branches across middle layers
  - 2 rest nodes
  - 1 top Boss endpoint
- Added map metadata for:
  - `layer`
  - `parentNodeIds`
  - `nextNodeIds`
  - `x`
  - `y`
- Kept map progression deterministic and local:
  - locked nodes cannot be skipped
  - entering one available node locks same-layer alternatives
  - completing a node unlocks only declared child nodes
- Converted run deck storage to persistent card instances with `definitionId` and upgrade state.
- Added generated card upgrade support for every current Iron Oath card.
- Updated combat card lookup so upgraded cards use upgraded costs, descriptions, and effects.
- Expanded rest nodes with a second action:
  - heal for 30% max HP
  - upgrade one unupgraded deck card
- Added rest upgrade result feedback before returning to the map.
- Added a small original potion pool:
  - `small-healing-fluid`
  - `strength-draught`
  - `guard-draught`
  - `draw-draught`
  - `risk-mark-bottle`
- Added 3 potion slots to runs.
- Added deterministic potion rewards for combat and elite rewards.
- Added combat potion use for heal, block, draw, self-status, and enemy-status effects.
- Added potion UI in combat and reward screens, including full-slot handling.
- Updated local save schema to version 3 with v1/v2 fallback normalization for deck instances, potions, tree map fields, combat snapshots, and rest upgrade results.
- Updated low-profile UI labels for the new map, rest upgrade, reward, pile empty, and potion flows.
- Updated `docs/MECHANICS.md`, `docs/CONTENT_CATALOG.md`, `docs/MILESTONES.md`, `PROGRESS.md`, and `CHANGELOG.md`.

## Main Files Added or Modified

- `src/game/types.ts`
- `src/game/data/potions/potions.ts`
- `src/game/engine/cardUpgrades.ts`
- `src/game/engine/potions.ts`
- `src/game/engine/map.ts`
- `src/game/engine/run.ts`
- `src/game/engine/rewards.ts`
- `src/game/engine/combat.ts`
- `src/game/engine/deck.ts`
- `src/game/engine/effects.ts`
- `src/game/store/useGameStore.ts`
- `src/adapters/storageAdapter.ts`
- `src/ui/components/Hand.tsx`
- `src/ui/components/PileInfo.tsx`
- `src/ui/components/PotionBar.tsx`
- `src/ui/screens/CombatScreen.tsx`
- `src/ui/screens/MapScreen.tsx`
- `src/ui/screens/RestScreen.tsx`
- `src/ui/screens/RewardScreen.tsx`
- `src/index.css`
- `src/tests/mapEngine.test.ts`
- `src/tests/runMilestone5.test.ts`
- `src/tests/storeFlow.test.ts`
- `src/tests/v120MapUpgradePotion.test.ts`
- `docs/MECHANICS.md`
- `docs/CONTENT_CATALOG.md`
- `docs/MILESTONES.md`
- `PROGRESS.md`
- `CHANGELOG.md`

## Verification Commands

```bash
npm test
npm run build
npm run dev -- --host 127.0.0.1 --port 5175
```

## Test Result

`npm test` passed on 2026-06-09 with 17 test files and 91 tests.

## Build Result

`npm run build` passed on 2026-06-09 with TypeScript checking and Vite production build.

`npm run dev -- --host 127.0.0.1 --port 5175` was used for the final local smoke check when prior Vite ports were occupied.

## Known Issues

- The tree route is still a fixed first-act shape, not a full procedural map generator.
- Rest nodes support only heal or upgrade; card removal, transformation, shops, and events are still future work.
- Potion balance and upgrade values are first-pass local tuning and need playtesting.
- Bosses remain single-phase first-version encounters.
- Save schema v3 reads old v1/v2 payloads, but old clients cannot read v3 saves.

## Next Step

Recommended next milestone: expand run variety with additional original event/shop placeholders, route-generation constraints, potion tuning, and encounter difficulty bands.

## v1.3.0: New Card Batch Update

Status: Completed.

## Completed

- Parsed `docs/content_requests/CARD_BATCH_1.3.0.md` and implemented 83 local, single-player-compatible cards with original ids, names, low-profile names, descriptions, costs, rarity, type, target, effects, and explicit upgrade definitions.
- Added `basic` and `ancient` card rarities:
  - `basic` cards do not enter rewards.
  - `ancient` cards are reward-eligible at low weight.
- Added typed X-cost support and X-scaling effects.
- Added combat-local card modifiers for temporary cost overrides, exhaust-on-play, innate upgrades, and combat damage growth.
- Added data-driven descriptors for:
  - copying cards
  - upgrading hand cards
  - blocking later draw or energy gain
  - exhausting hand cards by count/random/type
  - playing draw-pile top cards
  - moving discard cards to draw top
  - draw-until-card-type searches
  - damage scaling from block, exhaust pile size, vulnerable stacks, cards exhausted this turn, basic attack count, attacks played this turn, and HP-loss events
- Added power/status hooks for:
  - block retention
  - turn-start HP/block/strength/energy
  - exhaust draw/block triggers
  - vulnerable damage/draw triggers
  - HP-loss damage/strength triggers
  - block-gain damage
  - third-attack copying
  - next-attack replay and free cost
  - end-turn attack auto-play
  - exhaust-pile auto-play
- Updated power card resolution so power cards leave the combat cycle when played.
- Updated card display and hand playability for `X` costs.
- Updated local save normalization for new optional combat/card-instance fields.
- Added `src/tests/v130CardBatch.test.ts` for v1.3.0 content validation, reward eligibility, upgrades, low-profile rendering, all-card play smoke coverage, and representative new mechanisms.
- Updated `docs/MECHANICS.md`, `docs/CONTENT_CATALOG.md`, `docs/MILESTONES.md`, `PROGRESS.md`, and `CHANGELOG.md`.

## Blocked Cards

- Row 27: requires "another player" block transfer, which conflicts with the single-player product spec.
- Row 60: references `Giant Rock` / `Giant Rock+` without defining token cost, type, or effect.
- Row 75: requires ally damage reduction, which conflicts with the current single-player combat model.

## Verification Commands

```bash
npm test
npm run build
```

## Test Result

`npm test` passed on 2026-06-09 with 18 test files and 103 tests.

## Build Result

`npm run build` passed on 2026-06-09 with TypeScript checking and Vite production build.

## Product-Spec Concerns

- No networking, account, telemetry, ads, cloud sync, enemies, relics, map nodes, or events were added.
- Three rows remain blocked because they conflict with the current single-player model or still omit required mechanic definitions. Row 72 was implemented in v1.5.0 after `Plating` was defined.

## v1.4.0: Potion Batch + Ascension + Map + Shop Update

Status: Completed.

## Completed

- Parsed `docs/content_requests/potion_BATCH_1.4.0.md` and implemented all rows that fit the current local single-player engine without new choice/event/token/class systems.
- Added 33 implemented potion definitions with complete ids, original names, low-profile names, rarity, targets, descriptions, low-profile descriptions, and typed effects.
- Expanded potion effect support for:
  - percent max-HP healing
  - block multiplication
  - energy gain
  - max HP gain
  - direct enemy/all-enemy damage
  - all-enemy status application
  - temporary strength/dexterity
  - hand upgrades
  - shuffle-all-into-draw plus draw
  - play top draw-pile cards
  - refill empty potion slots
  - passive death ward
  - discard-to-hand with temporary cost override
  - random generated cards by type
  - randomized hand costs
  - hand retention
- Added statuses/mechanics for `enemyAttackDown30`, `startTurnDraw`, `startTurnEnergyNextTurns`, `startTurnBlock`, `corrosiveLeak`, `temporaryDexterity`, `retainHand`, `nextCardExtraPlay`, and `nextAttackDamageMultiplier`.
- Added ascension levels 0-10 with local progress persistence and stacked restrictions.
- Added deterministic 14-layer Act 1 DAG map with multiple starts, branches, merges, re-branches, combat, elite, rest, shop, and a unique final boss endpoint.
- Added deterministic shop inventory generation and `ShopScreen` for card, relic, and potion purchases.
- Added starter-only relic `afterglow-charm` / `余息护符` / `恢复凭证`; victory heals 3 HP and ordinary relic rewards exclude starter-only relics.
- Added ascension 5 burden card `v140-ascension-burden`.
- Updated save schema to v4 and added versioned ascension progress persistence.
- Updated `docs/MECHANICS.md`, `docs/CONTENT_CATALOG.md`, `docs/MILESTONES.md`, `docs/ARCHITECTURE.md`, `CHANGELOG.md`, and `PROGRESS.md`.
- Added `src/tests/v140Systems.test.ts` and updated map/run tests for the expanded route.

## Blocked Potion Rows

- Row 1: requires choosing any number of cards from hand to exhaust; no choose-any hand-selection UI exists yet.
- Rows 2, 9, 39, and 44: require choosing 1 of 3 random card offers during potion use; combat-time choice UI is not available.
- Row 10: references the absent `Regent` class and upgraded colorless-card hand generation.
- Row 14: requires selecting a card from the draw pile; draw-pile selection UI is not available.
- Row 23: event potion includes all-player damage and merchant throwing for gold; event and merchant targeting systems do not exist.
- Row 26: requires discarding any number of selected hand cards and drawing that many; choose-any discard UI is not available.
- Row 28: event row has no rarity and requires event-only hand exhaustion/draw behavior.
- Row 30: references absent `Regent` class and undefined `Forge`.
- Row 37: token row lacks owner/reward fields.
- Row 51: requires choosing a hand card to make free for the combat; hand-card choice UI is not available.

## Naming Notes

- The request referenced `破誓者`; the repo currently has only the default `iron-oath` / Iron Oath class. Per instruction, no new class was added. Class-specific potion/relic behavior was attached to the existing default class and this naming difference is recorded here.

## Verification Commands

```bash
npm test
npm run build
```

## Test Result

`npm test` passed on 2026-06-10 with 19 test files and 110 tests.

## Build Result

`npm run build` passed on 2026-06-10 with TypeScript checking and Vite production build.

## Product-Spec Concerns

- No network gameplay, account login, cloud sync, telemetry, analytics, ads, remote feature flags, remote game data, commercial APIs, or scraping were added.
- Blocked potion rows were left unimplemented instead of approximated because they require missing UI/system support or still-undefined mechanics. Rows 29, 33, 34, and 46 were implemented in v1.5.0 after `Plating`, `Buffer`, `Ritual`, and `Replay` were defined.

## v1.5.0: Mechanism Completion + Curses + Three Acts + Events

Status: Completed.

## Completed

- Parsed `docs/content_requests/mechanics_BATCH_1.5.0.md`, `docs/content_requests/Curse_BATCH_1.5.0.md`, and `docs/content_requests/Events_BATCH_1.5.0.md`.
- Implemented `Plating`, `Buffer`, `Ritual`, and `Replay` as typed engine mechanisms with data/status definitions and focused tests.
- Rechecked previously blocked content and implemented rows that were blocked only by the newly defined mechanics:
  - v1.3 row 72 as `v150-plated-oath` / `镀誓` / `周期缓冲协议`.
  - v1.4 potion row 29 as `v150-plating-vial`.
  - v1.4 potion row 33 as `v150-buffer-vial`.
  - v1.4 potion row 34 as `v150-ritual-vial`.
  - v1.4 potion row 46 as `v150-replay-etching`.
- Added the curse system:
  - New `curse` card type/rarity.
  - Unplayable default cost display.
  - 18 curse definitions with normal and low-profile names/descriptions.
  - Curse pile flow through deck, draw, hand, discard, retain, and exhaust.
  - Curse timing hooks for combat start/opening hand, end-turn HP/gold/status effects, retain, self-exhaust, and play-limit constraints.
- Added three-act run progression:
  - Act 1, act 2, and act 3 each generate a deterministic map.
  - Act bosses are `bell_tower_guardian`, `tide_archive_prime`, and `oath_mirror_warden`.
  - Act 1/2 boss rewards transition to the next act, heal to at least 90% max HP, and open a major event.
  - Act 3 boss reward completes victory, writes run history, and unlocks the next local ascension level.
- Added the event system:
  - Major act-start events.
  - Minor map event nodes.
  - Deterministic event selection with run-local seen-event tracking.
  - Typed event effects for HP, gold, deck, relics, potions, curses, card upgrade, remove, transform, and downgrade.
  - `EventScreen` with normal and low-profile display.
  - Event logs and local save/load support.
- Added deterministic continue for shop and event nodes:
  - Shop start snapshots restore initial gold, inventory, and sold flags after returning to menu and continuing.
  - Event start snapshots restore event id, choices, deck/resources, and unchosen state after returning to menu and continuing.
  - Combat start snapshot behavior remains intact.
- Updated local save schema to v5.
- Updated `docs/MECHANICS.md`, `docs/CONTENT_CATALOG.md`, `docs/MILESTONES.md`, `docs/ARCHITECTURE.md`, `CHANGELOG.md`, and `PROGRESS.md`.
- Added `src/tests/v150Systems.test.ts` and updated existing tests for content counts, boss pools, start-run event flow, three-act routing, event persistence, and low-profile curse display.

## Still Blocked

- v1.3 card rows 27, 60, and 75 remain blocked:
  - Row 27 and row 75 require another player or ally model, which conflicts with the current single-player combat model.
  - Row 60 references `Giant Rock` / `Giant Rock+` without defining card/token cost, type, and effect.
- v1.4 potion rows still blocked are 1, 2, 9, 10, 14, 23, 26, 28, 30, 37, 39, 44, and 51. These require missing choose-any/choose-one UI, the absent `Regent` class, undefined `Forge`, event/merchant targeting, token ownership fields, or hand-card selection UI.
- Several v1.5 event choices remain blocked in event data because they require secondary selection screens or undefined objects/systems:
  - Colorless-card or card-offer selection.
  - Route preview/reroll.
  - Enchantment systems.
  - Undefined relic/object references.
  - Undefined key/fake-relic/fight flows.
  - Undefined future delayed rewards or potion conversion tables.

## Verification Commands

```bash
npm test
npm run build
```

## Test Result

`npm test` passed on 2026-06-10 with 20 test files and 116 tests.

## Build Result

`npm run build` passed on 2026-06-10 with TypeScript checking and Vite production build.

## Product-Spec Concerns

- No network gameplay, account login, cloud sync, telemetry, analytics, ads, remote feature flags, remote game data, commercial APIs, scraping, new class, new account system, or real cloud sync was added.
- Blocked event choices and remaining blocked rows were left blocked rather than approximated because the request required no guessing when fields or mechanics are undefined.

## v1.5.2: Starter Loadout, Rest Upgrade Details, Relic Display, and Card Keywords

Status: Completed.

## Completed

- Centralized the current default Iron Oath starter loadout in `src/game/data/starterDecks.ts`:
  - 5 `short-blade-advance` basic attacks.
  - 4 `guarded-stance` basic defenses.
  - 1 `break-stance-smash`.
  - Starter relic `afterglow-charm`.
- Kept initial deck instance creation through `createDeckCardInstances`, so every starter `CardInstance` begins with `upgraded: false`.
- Ensured `startRun` reads starter deck and starter relics from the same loadout source and de-duplicates relic ids.
- Expanded rest upgrade results with card name, before/after normal descriptions, before/after low-profile descriptions, and before/after costs.
- Updated `RestScreen` to show upgrade-before and upgrade-after details, plus cost change when cost changes; already upgraded cards remain disabled and marked as upgraded/optimized.
- Added `RelicBar` and mounted it on MapScreen and CombatScreen.
- Relic display now supports normal names/descriptions, low-profile names/descriptions, and empty-state text.
- Added `src/ui/terminology/keywordDescriptions.ts` as the centralized mechanism/keyword description registry.
- Updated CardView to wrap recognized mechanism terms in focusable hover/focus keyword elements while preserving the original description string on the description element.
- Added `src/tests/v152Systems.test.ts` for starter deck counts, unupgraded starter cards, rest upgrade details, repeat-upgrade prevention, starter relic display/effect, keyword registry lookups, CardView keyword rendering, and low-profile keyword descriptions.

## Verification Commands

```bash
npm test
npm run build
```

## Test Result

`npm test` passed on 2026-06-11 with 21 test files and 120 tests.

## Build Result

`npm run build` passed on 2026-06-11 with TypeScript checking and Vite production build.

## Product-Spec Concerns

- No reward-pool logic was changed.
- No new class, network gameplay, account login, cloud sync, telemetry, analytics, ads, remote feature flags, or remote content fetch was added.

## v1.6.0: Three-Act Enemy Pool Update

Status: Completed for all locally implementable enemy-pool content; exact unsupported sub-mechanics are blocked below.

## Completed

- Parsed `docs/content_requests/Enemy_BATCH_1.6.0.md`.
- Added v1.6 enemy definitions for act 1, act 2, and act 3 normal enemies, elite enemies, boss enemies, summons, and boss parts.
- Added enemy fields for:
  - `act`
  - `role`
  - `description`
  - `lowProfileDescription`
  - `initialStatuses`
- Added act-aware enemy groups:
  - Act 1: 12 combat groups, 4 elite groups, 3 boss groups.
  - Act 2: 11 combat groups, 3 elite groups, 3 boss groups.
  - Act 3: 11 combat groups, 3 elite groups, 3 boss groups.
- Updated map creation so boss nodes store a seed-determined boss group from the current act's boss pool.
- Updated run enemy selection so combat, elite, and boss nodes select only groups matching the current act and node type.
- Added typed enemy `damageRepeated` effects.
- Added enemy `initialStatuses` application at combat creation.
- Added or registered v1.6 statuses:
  - `slippery`
  - `slow`
  - `constrict`
  - `tangled`
  - `tender`
  - `slumber`
  - `stun`
  - `spawned`
  - `curlUp`
  - `reattach`
  - `vitalSpark`
  - `personalHive`
  - `sandpit`
  - `galvanic`
  - `stock`
  - `paperCuts`
  - `plow`
  - `ringing`
  - `chainsOfBinding`
  - `intangible`
  - `painfulStabs`
  - `nemesis`
  - `pollutionSlimed`
  - `pollutionDazed`
  - `pollutionBurn`
  - `pollutionWound`
  - `infection`
  - `toxic`
- Implemented concrete behavior for:
  - Slippery hit caps and stack consumption.
  - Intangible hit caps.
  - enemy Stun/Slumber action skipping.
  - generic end-turn HP loss for statuses that define `turnEndHpLossPerStack`.
  - enemy repeated damage resolving one hit at a time.
- Updated low-profile enemy intent labels in `EnemyPanel`.
- Added `src/tests/v160Enemies.test.ts` for content registration, act-aware selection, boss determinism, node entry by act, initial statuses, Slippery, Intangible, repeated enemy damage, Slumber, and low-profile enemy UI.
- Updated older content/group/run tests to validate act-aware enemy pools instead of the previous global boss/group assumptions.
- Updated:
  - `docs/MECHANICS.md`
  - `docs/CONTENT_CATALOG.md`
  - `docs/MILESTONES.md`
  - `CHANGELOG.md`
  - `PROGRESS.md`

## Blocked or Limited v1.6 Enemy Sub-Mechanics

- Dynamic summons are not fully implemented. Enemies that summon or spawn are represented by initial group composition and `spawned` marker statuses.
- On-death spawning/revival is not implemented. Phrog Parasite, Wriggler, Decimillipede reattachment, Axebot stock refill, Fabricator bots, and similar rows are implemented as current encounter data plus marker statuses, not dynamic death triggers.
- Exact boss phase scripts are not implemented. Ceremonial Beast, Doormaker, The Queen, and Test Subject #C10 use available data-driven moves/statuses, but threshold phase changes, hiding/returning, shield-front behavior, and phase-specific debuff clearing remain blocked.
- True status-card deck pollution is not implemented for enemies. Slimed/Dazed/Burn/Wound/Infection/Toxic requests are represented by typed status markers or HP-loss statuses rather than inserting temporary status cards into draw/discard piles.
- Forced permanent choices and bespoke boss subsystems are not implemented. Knowledge Demon forced choice, Insatiable Sandpit death countdown/Frantic Escape cards, and Test Subject skill/unblocked-damage reactive rules remain blocked.
- Resource theft and permanent max-HP loss are not implemented. Thieving Hopper and Scroll of Biting use available combat effects/statuses without mutating run gold or max HP from enemy actions.
- Ally/body-part cross-effects are not implemented. Kaiser Crab claw death buffs, Queen front-body gating, and Doormaker door/body cycling remain represented by multi-enemy groups and standard moves.

## Verification Commands

```bash
npm test
npm run build
```

## Test Result

`npm test` passed on 2026-06-11 with 22 test files and 130 tests.

## Build Result

`npm run build` passed on 2026-06-11 with TypeScript checking and Vite production build.

## Product-Spec Concerns

- No new class, network gameplay, account login, cloud sync, telemetry, analytics, ads, remote feature flags, remote content fetch, commercial API, or scraping was added.
- Unsupported sub-mechanics were recorded rather than implemented as UI-side or hidden approximations.
