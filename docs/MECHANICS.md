# Mechanics

This document tracks the first-version mechanics the project intends to support. Any new mechanic added to the game must be documented here before or alongside implementation.

## Version 1 Mechanics

| Mechanic | Category | First-Version Behavior | Data-Driven Target | Test Expectations |
| --- | --- | --- | --- | --- |
| `damage` | Combat effect | Reduces target HP after block and modifiers are applied. Damage can target enemies or the player. | Card and enemy moves specify damage effects with base values and target rules. | Damage respects block, vulnerable, weak, strength, and thorns where applicable. |
| `block` | Combat effect | Adds temporary prevention that absorbs incoming attack damage. Usually clears at turn start unless modified. | Card and enemy moves specify block gain effects. | Block absorbs damage and clears at the correct time. |
| `draw` | Pile effect | Moves cards from draw pile to hand. If the draw pile is empty, shuffle discard into draw when possible. | Card effects specify draw count. | Draw order, reshuffle, and hand-size limits behave deterministically. |
| `discard` | Pile effect | Moves cards from hand to discard pile by count, choice, random rule, or explicit target. | Card effects and enemy effects specify discard rules. | Chosen and random discard paths update piles correctly. |
| `exhaust` | Pile effect | Moves cards to an exhaust pile for the current combat. Exhausted cards return after combat unless explicitly removed from the run deck by a separate effect. | Card definitions may include exhaust behavior, and effects may exhaust selected cards. | Exhaust removes cards from normal pile cycling for the combat. |
| `retain` | Pile effect | Keeps specified cards in hand between turns instead of discarding them during cleanup. | Card definitions and statuses can declare retain rules. | Retained cards persist across turn transitions and respect hand limits. |
| `vulnerable` | Status | Increases attack damage received by the affected combatant for a duration or stack count. | Status data defines multiplier, stack decay, and timing. | Incoming damage increases only while vulnerable is active. |
| `weak` | Status | Reduces attack damage dealt by the affected combatant for a duration or stack count. | Status data defines multiplier, stack decay, and timing. | Outgoing damage decreases only while weak is active. |
| `frail` | Status | Reduces block gained by the affected combatant for a duration or stack count. | Status data defines multiplier, stack decay, and timing. | Block gain is reduced from cards and enemy moves while frail is active. |
| `strength` | Status | Modifies outgoing attack damage by a flat amount. Can be positive or negative. | Status data defines stat modifier and whether it decays. | Multi-hit and single-hit damage apply strength consistently. |
| `dexterity` | Status | Modifies block gained by a flat amount. Can be positive or negative. | Status data defines stat modifier and whether it decays. | Block cards and block effects apply dexterity consistently. |
| `artifact` | Status | Prevents the next eligible negative status application, then decreases by one stack. | Status data defines prevention rules and eligible status tags. | Artifact blocks debuffs without blocking direct damage. |
| `thorns` | Status | Deals return damage to attackers when the holder receives attack damage. | Status data defines return damage and trigger timing. | Attackers take thorns damage after successful attack resolution. |
| `regen` | Status | Restores HP at a defined timing, usually end of turn, then may decay. | Status data defines heal amount, timing, and decay. | Healing is capped by max HP and decays correctly. |
| `bleed` | Status | Deals damage over time or on action according to project-owned rules. | Status data defines trigger timing, damage, block interaction, and decay. | Bleed applies at the documented timing and cannot copy another game's proprietary behavior. |
| `barrierLock` | Status or rule modifier | Prevents some or all block loss while active, or locks a block threshold according to original project rules. | Status data defines lock amount, duration, and cleanup timing. | Block cleanup and incoming damage respect the lock rules. |
| `relic triggers` | Passive system | Relics react to hooks such as combat start, turn start, card played, damage dealt, damage taken, enemy defeated, reward generated, and rest. | Relic data declares trigger hooks, conditions, and effects. | Trigger order is deterministic and documented. |
| `enemy intents` | Enemy system | Enemies preview their next broad action such as attack, defend, buff, debuff, summon, wait, or mixed action. | Enemy move data declares intent type, values, and display labels. | Displayed intent matches the move that resolves next. |
| `reward generation` | Run system | Generates post-combat rewards such as card choices, currency, relics, healing, or special options from local pools. | Reward pools and weights live in data files and use seeded randomness. | Same seed and run state produce the same reward options. |
| `local save` | Persistence | Saves active run, settings, history, unlocked local content, and custom preferences on the device. | Save schema is typed and versioned. | Save/load round trips preserve active run state. |
| `stealth terminology` | Presentation | Low-profile mode swaps overt combat/fantasy terminology for neutral terms without changing rules. | Terminology dictionaries map canonical engine terms to theme-specific labels. | Mode changes affect labels only, not engine state. |
| `custom background` | Presentation | User can choose a local background or bundled theme background for the app. | Background metadata and user selection are stored separately from combat state. | Background settings persist locally and do not affect engine tests. |

## Milestone 1 Implementation Status

Updated on 2026-06-08.

| Mechanic | Status | Notes |
| --- | --- | --- |
| `damage` | Implemented | Card and enemy damage resolve through the engine and account for block, vulnerable, weak, and strength. |
| `block` | Implemented | Player and enemy block can be gained, absorbs attack damage, and clears at turn boundaries. |
| `draw` | Implemented | Opening hand and turn-start draw are implemented, including discard reshuffle and hand limit. |
| `discard` | Implemented for M1 | End-turn hand discard and count-based discard effects are implemented. Choice-based discard is not in M1. |
| `exhaust` | Implemented for M1 | `exhaustSelf` moves the played card to the combat exhaust pile. Broader exhaust selection is deferred. |
| `retain` | Planned | No M1 card uses retain. |
| `vulnerable` | Implemented for M1 | `破势重击` applies vulnerable, and later attacks deal increased damage while it is active. |
| `weak` | Partial | Enemy data can apply weak, and outgoing attack damage is reduced while weak is active. Dedicated tests are deferred to Milestone 2. |
| `frail` | Partial | Block math supports frail, but no M1 content applies it. |
| `strength` | Implemented for M1 | `热血` applies strength, and attack damage increases. |
| `dexterity` | Implemented for M1 | `稳步` applies dexterity, and block gain increases. |
| `artifact` | Partial | Engine status application can prevent negative statuses, but no M1 content grants artifact. |
| `thorns` | Partial | Engine can return thorns damage when the player is hit, but no M1 content grants thorns. |
| `regen` | Planned | Not implemented in M1. |
| `bleed` | Planned | Status id exists for future support, but no damage-over-time behavior is implemented in M1. |
| `barrierLock` | Planned | Status id exists for future support, but block-lock behavior is not implemented in M1. |
| `relic triggers` | Planned | Deferred to Milestone 2. |
| `enemy intents` | Implemented | Enemy moves expose intents that match the next resolved action. |
| `reward generation` | Implemented for M1 | Post-combat card rewards are generated locally from the original warrior reward pool with seeded randomness. |
| `local save` | Planned | Deferred to Milestone 4. |
| `stealth terminology` | Planned | Deferred to Milestone 3. |
| `custom background` | Planned | Deferred to Milestone 3. |

## Milestone 2 Implementation Status

Updated on 2026-06-08.

| Mechanic | Status | Notes |
| --- | --- | --- |
| `strength` | Implemented | Data definition grants flat outgoing attack damage per stack. Tested through existing `热血` coverage and relic start logic. |
| `dexterity` | Implemented | Data definition grants flat block gain per stack. Used by the shared block calculation path. |
| `vulnerable` | Implemented | Data definition increases received attack damage by multiplier while active. Covered by status tests. |
| `weak` | Implemented | Data definition reduces outgoing attack damage by multiplier while active. Covered by status tests. |
| `frail` | Implemented | Data definition reduces block gain by multiplier while active. Covered by status tests. |
| `artifact` | Implemented | Data definition marks artifact as a negative-status prevention stack. It cancels one eligible negative status and then removes one artifact stack. |
| `thorns` | Implemented | Data definition returns attack damage to attackers when HP damage is taken from an attack. Covered by status tests. |
| `regen` | Implemented | Data definition heals at owner turn end, capped by max HP, then decays by one stack. |
| `bleed` | Implemented | Data definition causes direct HP loss at owner turn end, then decays by one stack. Covered by status tests. |
| `barrierLock` | Implemented | Data definition preserves block during the next turn-start cleanup, then decays by one stack. Covered by status tests. |
| `relic triggers` | Implemented | Supported hooks are `onCombatStart`, `onTurnStart`, `onTurnEnd`, `onCardPlayed`, `onAttackPlayed`, `onSkillPlayed`, `onEnemyKilled`, `onShuffle`, and `onVictory`. Trigger order follows run relic order, then trigger order in the relic definition. |
| `旧铜扣` | Implemented | Original relic. `onCombatStart`: gain 1 strength. |
| `裂纹透镜` | Implemented | Original relic. `onTurnStart` on turn 1: draw 1 card after the normal opening draw. |
| `沉纸镇` | Implemented | Original relic. `onCombatStart`: gain 4 block. |
| `余温币` | Implemented | Original relic. `onShuffle`: gain 1 current energy. |
| `静手套` | Implemented | Original relic. `onSkillPlayed` with first-skill-this-turn condition: gain 3 block. |

## Milestone 3 Implementation Status

Updated on 2026-06-08.

| Mechanic | Status | Notes |
| --- | --- | --- |
| `stealth terminology` | Implemented | `normal` mode uses combat-facing labels, while `stealth` mode maps combat terms to neutral labels such as `会话`, `目标`, `操作项`, `配额`, `稳定度`, `缓冲`, `推进`, `周期`, and `结束周期`. |
| `GameMode` | Implemented | Supported values are `normal` and `stealth`. The mode is stored in local settings and can be toggled from UI or keyboard. |
| `ThemeId` | Implemented | Supported values are `normal`, `document`, `dashboard`, `code`, `meeting`, and `terminal`. Theme selection updates the app root class name. |
| `lowProfileName` | Implemented | Card definitions include low-profile display names and descriptions. UI card rendering switches to those fields in stealth mode. |
| `keyboard shortcuts` | Implemented | `S` toggles low-profile mode, `E` ends the current turn/cycle in combat, `1-9` play hand cards by position, and `Esc` opens or closes settings. |
| `custom background` | Implemented | Local settings support solid, stealth grid, document paper, dark code, and custom local image backgrounds with opacity control. |
| `local settings persistence` | Implemented | Display mode, theme, background choice, custom image data URL, opacity, and compact mode are saved to localStorage through adapter functions. |
| `compact mode` | Implemented | Compact mode adjusts layout density through a root class without changing engine state. |

## Milestone 4 Implementation Status

Updated on 2026-06-08.

| Mechanic | Status | Notes |
| --- | --- | --- |
| `local save` | Implemented | `LocalStorageAdapter` stores `currentRun`, `settings`, and `runHistory` locally. Each saved payload uses a `version` field and `savedAt` timestamp. |
| `save migration` | Implemented | `migrateSaveData(raw)` accepts versioned saves and wraps legacy raw payloads into the current versioned envelope. |
| `run history` | Implemented | Run history entries record run id, character name, result, combats won, deck size, relic count, and end time. Abandoned or defeated runs can be recorded locally. |
| `run history export` | Implemented | `exportRunHistoryJson()` returns versioned JSON for local copy/export flows. |
| `run history import` | Implemented | `importRunHistoryJson()` parses versioned JSON, normalizes entries, saves them locally, and reports invalid JSON through the settings UI. |
| `settings persistence` | Implemented | Settings now use the shared storage adapter while preserving the existing settings helper API. |
| `cloud sync placeholder` | Implemented | `CloudSyncAdapterPlaceholder` exposes `uploadRunSummary`, `downloadRunHistory`, and `syncSettings`, but returns disabled results and performs no network requests. |

## Milestone 5 Implementation Status

Updated on 2026-06-09.

| Mechanic | Status | Notes |
| --- | --- | --- |
| `map nodes` | Implemented | `createLinearMap(seed)` creates a deterministic five-node linear route: normal combat, normal combat, elite combat, rest point, and Boss. |
| `node progression` | Implemented | Locked nodes cannot be skipped. Completing a node marks it completed and unlocks the next node as current. |
| `enemy groups` | Implemented | Combat, elite, and Boss nodes select original local enemy groups from `src/game/data/enemies/groups.ts`. |
| `elite combat` | Implemented | The first elite placeholder uses the original enemy `iron_beadle` / `铁铃执事`. |
| `boss placeholder` | Implemented | The first Boss placeholder uses the original enemy `bell_tower_guardian` / `钟塔守卫` and ends the run through the victory flow when defeated. |
| `reward generation` | Expanded | Normal combat rewards generate 3 unique card choices and 10-15 gold. Elite rewards generate 3 unique card choices, 20-30 gold, and attempt one unowned relic. |
| `reward claiming` | Implemented | `RewardBundle.claimed` and run state transitions prevent repeated claims in the active flow. Card rewards can be selected or skipped while gold and single relic rewards still resolve. |
| `rest point` | Implemented | Rest restores 30% of max HP, rounded down with a minimum of 1, and never exceeds max HP. Upgrade is represented as a disabled placeholder. |
| `run status` | Implemented | Runs now track `active`, `victory`, and `defeat`, with victory and defeat screens driven by `RunSummary`. |
| `run history` | Expanded | Victory and defeat write local run summaries with seed, class id, floor reached, HP, gold, deck size, relic count, and completion time. |
| `stealth terminology` | Expanded | Map, reward, rest, Boss, gold, HP, and relic labels use low-profile terms such as `流程面板`, `处理结果`, `整理节点`, `最终议题`, `额度`, `稳定度`, and `凭证`. |
| `custom background` | Unchanged | Existing theme/background settings continue to apply across map, reward, rest, result, and history screens. |

## Milestone 6 Implementation Status

Updated on 2026-06-09.

| Mechanic | Status | Notes |
| --- | --- | --- |
| `card content pool` | Expanded | Iron Oath now has 34 cards: 3 starter, 15 common, 10 uncommon, and 6 rare. All cards include normal and low-profile names/descriptions, rarity, cost, target, and data-driven effects. |
| `target` | Implemented | Cards declare `enemy`, `allEnemies`, `self`, or `none` as their target category. UI target selection is available in multi-enemy combats. |
| `gainEnergy` | Implemented | Card and relic effects can add current-turn energy through a typed effect descriptor. |
| `loseHp` | Implemented | Card effects can spend player HP as a resource. HP loss can end combat if it drops the player to zero. |
| `heal` | Implemented | Card and relic effects can heal the player, capped by max HP. |
| `damageAll` | Implemented | Cards can damage all living enemies. Defeated enemies are ignored. |
| `conditional` | Implemented | Cards can branch on player HP, player block, or target status. Branch effects remain data-driven. |
| `blockNextTurn` | Implemented | Cards can grant block plus `barrierLock` so unspent block is preserved into the next turn start. |
| `multi-enemy combat` | Implemented | Enemy groups may contain multiple enemy ids. Enemy turns skip defeated enemies, and all-enemy effects only affect living enemies. |
| `enemy content pool` | Expanded | Enemy data now includes 9 normal enemies, 4 elites, and 2 bosses. Each enemy has a low-profile name and `intentPattern`. |
| `enemy group pool` | Expanded | Enemy groups now include 8 combat groups, 4 elite groups, and 2 boss groups. Selection is node-type filtered, weighted, and seed deterministic. |
| `relic content pool` | Expanded | Relic data now includes 17 relics with normal and low-profile names/descriptions, rarity, and legal triggers. |
| `reward weights` | Expanded | Card rewards use common/uncommon/rare weights of 70/25/5 for combat and 55/35/10 for elites. Relic rewards use 65/28/7. Duplicate card choices and owned relic rewards are filtered. |
| `content catalog` | Implemented | `docs/CONTENT_CATALOG.md` lists all current cards, enemies, enemy groups, and relics. |

## v1.1.0 Experience Update

Updated on 2026-06-09.

| Mechanic | Status | Notes |
| --- | --- | --- |
| `branching map` | Implemented | Act 1 now uses a deterministic branching route graph with `nextNodeIds`. Completing a node unlocks only its next nodes, and entering one same-floor branch locks the alternative branch. |
| `combat snapshot resume` | Implemented | Entering combat stores a start snapshot. Returning to the main menu saves the active run, and continuing a combat restores the same opening hand, enemy intents, seed state, and pre-reward combat start. |
| `defeated enemies` | Implemented | Enemy combatants now have an explicit `defeated` flag. Defeated enemies are logged, visually muted, skipped by enemy turns, ignored by all-enemy effects, and cannot be selected as card targets. |
| `status descriptions` | Implemented | Status chips expose hover, focus, title, and aria descriptions in normal and low-profile terminology. |
| `pile viewers` | Implemented | Draw, discard, and exhaust pile counters can open local UI lists of their current cards. This is presentation-only and does not mutate combat state. |
| `rest result` | Implemented | Rest points now show the before/after HP and healed amount before the player returns to the map. |
| `continue run` | Implemented | Main menu shows a continue action when an active run is available in memory or local save. |
| `local save v2` | Implemented | Active run saves now normalize branching map data, defeated enemy state, combat snapshots, and rest results while preserving legacy v1 read fallback. |

## v1.2.0 Map, Upgrade, and Potion Update

Updated on 2026-06-09.

| Mechanic | Status | Notes |
| --- | --- | --- |
| `tree map` | Implemented | Act 1 now uses a deterministic upward tree with 12 nodes: 3 bottom start nodes, intermediate combat/elite branches, 2 rest nodes, and 1 top Boss endpoint. |
| `map layers` | Implemented | Nodes store `layer`, `parentNodeIds`, `nextNodeIds`, and layout coordinates. Only available start nodes or unlocked child nodes can be entered. |
| `branch locking` | Implemented | Entering one available node on a layer locks same-layer alternatives, then completing the node unlocks only its declared children. |
| `card instances` | Implemented | Run decks store persistent card instances with `definitionId` and upgrade state. Combat creates temporary combat-local instances from those persistent cards. |
| `card upgrades` | Implemented | Rest nodes can upgrade one unupgraded deck card instead of healing. Upgrades use project-owned generated effects and text, preserve nonnegative cost, and append a `+` display marker. |
| `upgraded combat effects` | Implemented | Combat resolves the effective card definition for each card instance, so upgraded costs, descriptions, and effects apply during play. |
| `rest choice` | Implemented | Rest nodes support either healing for 30% max HP or upgrading one card. The chosen action completes the node and opens the next route step. |
| `potions` | Implemented | Runs have 3 potion slots. Potion rewards can add local one-use consumables, and combat can consume them for heal, block, draw, self-status, or enemy-status effects. |
| `potion reward` | Implemented | Normal and elite rewards can include a deterministic potion offer. If potion slots are full, claiming the reward skips the potion without crashing. |
| `local save v3` | Implemented | Active run saves normalize upgraded deck cards, combat piles, potion inventory, potion slots, tree-map fields, combat snapshots, and rest upgrade results while keeping v1/v2 read fallback. |
| `stealth presentation` | Expanded | Tree map, rest upgrade choices, card/pile empty states, rewards, and potion names/descriptions use low-profile terminology without changing rules. |

## v1.3.0 Card Batch Update

Updated on 2026-06-09.

| Mechanic | Status | Notes |
| --- | --- | --- |
| `v1.3.0 card batch` | Implemented | 83 local Iron Oath cards from `docs/content_requests/CARD_BATCH_1.3.0.md` were implemented with original ids, names, low-profile names, descriptions, explicit upgrades, and reward-pool inclusion for non-basic cards. Rows 27, 60, 72, and 75 are blocked in `PROGRESS.md`. |
| `CardCost: X` | Implemented | Cards can declare `cost: 'X'`. Playing an X-cost card spends current energy and passes the spent value to X-scaling effects. Covered by `v130-x-wide-storm` tests. |
| `basic` and `ancient` rarities | Implemented | `basic` cards are excluded from reward pools. `ancient` cards are reward-eligible with low card reward weight. |
| `innate` | Implemented | Upgraded cards can declare `innate`, causing them to enter the opening hand before normal opening draw fills to hand size. |
| `combat-local card modifiers` | Implemented | Card instances can carry cost overrides, exhaust-on-play, and combat damage bonuses. Used by generated attacks, next-attack free effects, and growing attack cards. |
| `copySelfToDiscard` / `copySelfToHand` | Implemented | Cards can create combat-local copies of themselves in discard or hand. |
| `upgradeCardsInHand` | Implemented | Cards can upgrade the first eligible hand card or all eligible hand cards for the current combat. |
| `preventDrawThisTurn` / `preventEnergyGainThisTurn` | Implemented | One-turn status gates block later draw or extra energy after the card's own effect resolves. |
| `exhaustFromHand` | Implemented | Cards can exhaust selected, random, all, type-filtered, or type-excluded hand cards. Exhaust triggers are centralized and deterministic. |
| `playTopCards` / `drawUntilCardType` / `moveDiscardToDrawTop` | Implemented | Pile manipulation supports playing draw-pile top cards, draw-until searches, and returning discard cards to draw top. |
| `damage scaling descriptors` | Implemented | New typed damage descriptors cover block value, exhaust pile size, status stacks, exhausted cards this turn, basic attack count, attacks played this turn, HP-loss events this combat, random hits, repeated hits, and all-enemy X repeats. |
| `turn and event power statuses` | Implemented | Power-style hooks are represented as statuses for block retention, turn-start HP/block/strength/energy, exhaust draw/block, vulnerable bonus/draw, HP-loss damage/strength, block-gain damage, third-attack copy, next-attack extra play/free cost, end-turn attack auto-play, and exhaust-pile auto-play. |
| `power card resolution` | Implemented | Power cards now leave the combat cycle when played as a type rule, matching persistent ability behavior while keeping rule logic in the engine. |
| `low-profile card display` | Verified | New cards render `lowProfileName` and `lowProfileDescription` in stealth mode through existing `CardView` behavior. |
| `v1.3.0 validation tests` | Implemented | `src/tests/v130CardBatch.test.ts` validates batch row counts, blocked rows, unique ids, complete fields, upgrades, reward eligibility, low-profile rendering, all-card play smoke coverage, and representative new mechanisms. |

## Naming Note

The identifiers above are internal project terms for planning. User-facing names may differ by theme, especially in low-profile mode.

## Documentation Rule

When a mechanic changes, update this table with:

- The canonical mechanic id.
- Its category.
- The intended behavior.
- Whether it should be data-driven.
- The minimum tests expected.
