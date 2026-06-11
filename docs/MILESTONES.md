# Milestones

Each milestone should preserve the product guardrails in `docs/PRODUCT_SPEC.md`. Every completed milestone should pass the documented test commands before handoff.

## Milestone 1: Project Skeleton + Basic Combat Loop

### Scope

- Create the TypeScript, React, Vite, and Vitest project skeleton.
- Establish the initial `src/game/engine`, `src/game/data`, `src/game/store`, `src/ui`, and `src/adapters` directories.
- Implement a minimal local combat loop:
  - Start combat.
  - Draw opening hand.
  - Play a card with energy cost.
  - Deal damage.
  - Gain block.
  - End turn.
  - Enemy performs a simple intent.
  - Win or lose combat.
- Add a tiny original starter deck and one original test enemy.

### Completion Criteria

- App launches locally through Vite.
- Combat can be completed from the UI.
- Engine combat tests run without rendering React.
- No commercial game names, assets, text, or numeric tables are used.
- All initial content is original placeholder content.

### Test Commands

```bash
npm test
npm run build
```

## Milestone 2: Status System + Relic Trigger System

### Scope

- Implement a typed status model.
- Add first-pass support for:
  - `vulnerable`
  - `weak`
  - `frail`
  - `strength`
  - `dexterity`
  - `artifact`
  - `thorns`
  - `regen`
  - `bleed`
  - `barrierLock`
- Implement deterministic relic trigger hooks:
  - Combat start.
  - Turn start.
  - Turn end.
  - Card played.
  - Damage dealt.
  - Damage taken.
  - Enemy defeated.
  - Reward generated.
- Add a small original relic pool for testing.

### Completion Criteria

- Status effects are applied, decay, and interact with combat math correctly.
- Relic triggers execute in a deterministic order.
- Statuses and relics are mostly data-driven.
- `docs/MECHANICS.md` reflects any final behavior choices.

### Test Commands

```bash
npm test
npm run build
```

## Milestone 3: Low-Profile Mode + Multiple Themes + Background Replacement

### Scope

- Add local settings for visual theme and low-profile mode.
- Add terminology dictionaries for normal and low-profile presentation.
- Add at least two UI themes.
- Add bundled original backgrounds.
- Add local custom background selection.
- Add contrast or overlay controls to preserve readability.

### Completion Criteria

- Low-profile mode changes terminology and presentation without changing engine state.
- Theme switching persists locally.
- Custom background selection persists locally.
- Background logic is isolated from the rules engine.
- The UI remains readable with bundled and custom backgrounds.

### Test Commands

```bash
npm test
npm run build
```

## Milestone 4: Local Save + Run History + Import/Export

### Scope

- Add versioned local save schema.
- Save and load active runs.
- Record completed and abandoned run history locally.
- Add local import/export through JSON file or clipboard.
- Add migration handling for older save versions once schema changes exist.

### Completion Criteria

- Active run survives page refresh.
- Run history records meaningful summary fields.
- Exported data can be imported on the same build.
- Invalid imports fail gracefully with a user-readable error.
- No account, cloud, telemetry, or network dependency is introduced.

### Test Commands

```bash
npm test
npm run build
```

## Milestone 5: Map Nodes + Rewards + Rest Points + Boss Placeholder

Status: Completed on 2026-06-09.

### Scope

- Implement route-based map nodes.
- Add node types:
  - Normal combat.
  - Elite combat placeholder.
  - Event placeholder.
  - Shop placeholder.
  - Rest point.
  - Boss placeholder.
- Implement reward generation after combat.
- Add card reward selection, currency reward, and relic reward.
- Add rest point actions such as heal or upgrade placeholder.

### Completion Criteria

- A run can progress across multiple map nodes.
- Reward generation is deterministic with seeded randomness.
- Rest point choices affect run state.
- Boss placeholder ends or advances the run cleanly.
- Map, reward, and rest flows are covered by engine or store tests.

### Test Commands

```bash
npm test
npm run build
```

## Milestone 6: Expand Warrior Card Pool, Enemy Pool, and Relic Pool

Status: Completed on 2026-06-09.

### Scope

- Create the first full original warrior-style archetype.
- Expand the card pool enough to support varied early runs.
- Expand enemy pool with multiple original enemy patterns.
- Expand relic pool with common trigger variations.
- Add content validation tests for ids, references, rarity, and duplicate names.
- Tune numbers independently through local playtesting.

### Completion Criteria

- The warrior-style archetype has a coherent original identity.
- Card, enemy, and relic pools are large enough for non-repetitive early runs.
- Content remains data-driven and validated.
- Numeric tuning is project-owned and not copied from commercial games.
- The game can complete a basic run using original local content.

### Test Commands

```bash
npm test
npm run build
```

## v1.1.0: Post-Milestone Experience Improvements

Status: Completed on 2026-06-09.

### Scope

- Replace the first act route with a deterministic branching route graph.
- Keep route progression local and seed deterministic.
- Add active-run continue from the main menu.
- Restart paused combats from the combat-start snapshot rather than mid-turn state.
- Make defeated enemies explicit in engine state and UI.
- Add status descriptions and clickable pile viewers.
- Show rest results before returning to the map.
- Update local save normalization for the new active-run fields.
- Improve README and changelog handoff documentation.

### Completion Criteria

- Route branches can be selected, and same-floor alternatives lock after a branch choice.
- Active runs can return to main menu and continue without being abandoned.
- Combat continues from the same opening hand, shuffle state, enemy intent, and pre-reward state.
- Defeated targets cannot be selected and are skipped by follow-up effects.
- Status and pile UI improvements work in normal and low-profile modes.
- Save schema changes remain local-only and versioned.
- Product guardrails remain unchanged: no account, telemetry, network gameplay, or commercial-game content.

### Test Commands

```bash
npm test
npm run build
```

## v1.2.0: Multi-Start Tree Map + Card Upgrades + Potions

Status: Completed on 2026-06-09.

### Scope

- Replace the previous route graph with a deterministic upward tree.
- Support multiple available start nodes and a single Boss endpoint.
- Add map node layout metadata for layer, parent links, child links, and simple UI positioning.
- Store deck cards as persistent card instances with upgrade state.
- Add a rest-node choice between healing and upgrading one card.
- Resolve upgraded card costs, effects, and descriptions during combat.
- Add a small original potion pool and 3 local potion slots.
- Add potion rewards for combat and elite nodes.
- Allow potion use during combat without adding any network, account, telemetry, or remote data dependency.
- Update local save normalization for deck instances, potions, tree-map fields, and rest upgrade results.

### Completion Criteria

- A new run starts from one of several bottom nodes and climbs toward one top Boss endpoint.
- Locked nodes cannot be skipped, and completing a node unlocks only its declared children.
- Rest nodes can heal or upgrade one eligible card, with clear normal and low-profile UI labels.
- Upgraded cards visibly show upgraded names/descriptions and apply upgraded effects in combat.
- Potion rewards are deterministic, potion slots are capped, and potion use mutates only local run/combat state.
- Active-run save/load preserves upgraded cards, potion inventory, potion slots, combat snapshots, and route state.
- Normal and low-profile screens remain presentation-only; engine rules are unchanged by display mode.

### Test Commands

```bash
npm test
npm run build
```

## v1.3.0: New Card Batch Update

Status: Completed on 2026-06-09.

### Scope

- Implement the locally compatible rows from `docs/content_requests/CARD_BATCH_1.3.0.md`.
- Generate original ids, names, and low-profile names for rows that did not provide them.
- Preserve the table's costs, types, rarity labels, effects, and explicit upgrades where implementable.
- Add only the typed engine descriptors needed by this batch.
- Keep rules in `game/engine`, card data in `game/data`, and presentation in `ui`.
- Add reward-pool inclusion for every non-basic card.
- Block rows that conflict with the single-player product model or omit required mechanic definitions.

### Completion Criteria

- Implemented cards have complete normal and low-profile fields, unique ids, targets, effects, rarity, costs, and upgrade definitions.
- X-cost, ancient rarity, basic rarity, pile manipulation, exhaust triggers, turn hooks, combat-local card modifiers, and new damage scaling descriptors are tested.
- Low-profile card display uses low-profile names and descriptions.
- The reward pool includes all non-basic v1.3.0 cards.
- Blocked rows are recorded in `PROGRESS.md`.
- No networking, account, telemetry, cloud sync, enemies, relics, map nodes, events, or allies are introduced.

### Test Commands

```bash
npm test
npm run build
```

## v1.4.0: Potion Batch + Ascension + Map + Shop Update

Status: Completed on 2026-06-10.

### Scope

- Implement all locally compatible rows from `docs/content_requests/potion_BATCH_1.4.0.md`.
- Block rows that require missing choice UI, absent classes, event/merchant targeting, tokens, or undefined mechanics.
- Add ascension levels 0-10 with local unlock persistence and stacked restrictions.
- Replace Act 1 with a deterministic 14-layer DAG containing combat, elite, rest, shop, and boss nodes.
- Add deterministic shop inventories for cards, relics, and potions.
- Add a starter victory-heal relic to the current default Iron Oath class.

### Completion Criteria

- Potion definitions have complete ids, names, low-profile names, rarity, target, descriptions, and effects.
- New potion mechanisms are typed, documented, and covered by Vitest.
- Ascension victory unlocks, failure behavior, stacked restrictions, and local persistence are covered.
- The new map has multiple starts, branches, merges, re-branches, shops, and one final boss endpoint.
- Shops support deterministic inventory, card/relic/potion purchases, sold flags, gold checks, full-potion-slot safety, leaving, and save/load preservation.
- The starter relic heals after victory and does not appear in ordinary relic rewards.
- No network, account, telemetry, ads, cloud sync, remote data fetches, commercial APIs, or scraping are introduced.

### Test Commands

```bash
npm test
npm run build
```

## v1.5.0: Mechanism Completion + Curses + Three Acts + Events

Status: Completed on 2026-06-10.

### Scope

- Implement v1.5.0 mechanics from `docs/content_requests/mechanics_BATCH_1.5.0.md`: `Plating`, `Buffer`, `Ritual`, and `Replay`.
- Revisit previously blocked content and implement rows that were blocked only by those newly defined mechanics.
- Add a curse card type and implement all curses from `docs/content_requests/Curse_BATCH_1.5.0.md`.
- Convert runs to a three-act structure with deterministic act maps, distinct bosses, major act-start events, and act transition healing.
- Add major and minor event systems from `docs/content_requests/Events_BATCH_1.5.0.md`, blocking only choices that require missing secondary-choice UI or undefined objects.
- Add deterministic continue snapshots for shop and event nodes so returning to menu cannot reroll inventories or event choices.
- Update local save normalization for v1.5.0 fields.

### Completion Criteria

- New mechanics are typed, documented, and covered by Vitest for base, edge, and interaction cases.
- Previously blocked Plating/Buffer/Ritual/Replay card and potion content is implemented where the rest of the row is now supported.
- Curse cards have complete ids, normal/low-profile text, unplayable/default behavior, and pile/trigger coverage.
- Act 1 boss advances to act 2, act 2 boss advances to act 3, and act 3 boss records victory plus ascension unlock.
- Each act begins with a major event, and map event nodes resolve deterministic minor events without run-stopping repeats.
- Shop and event deterministic continue snapshots restore node-start state while preserving inventory/event identity.
- No account, telemetry, ads, network gameplay, cloud sync, remote data fetch, or commercial API integration is introduced.

### Test Commands

```bash
npm test
npm run build
```

## v1.6.0: Three-Act Enemy Pool Update

Status: Completed on 2026-06-11.

### Scope

- Implement the locally compatible enemy rows from `docs/content_requests/Enemy_BATCH_1.6.0.md`.
- Add act-aware enemy group definitions for combat, elite, and boss nodes.
- Make boss groups seed-determined per act during map creation.
- Add typed enemy support for initial statuses and repeated enemy damage.
- Add minimal status mechanisms required by the batch: Slippery, Intangible, enemy Stun/Slumber skips, and shared end-turn HP-loss status processing.
- Keep map topology, reward generation, save format, and UI routing responsibilities unchanged except for encounter-pool selection.

### Completion Criteria

- Every v1.6 enemy id is present with name, low-profile name, act, role, max HP, intent pattern, and data-driven moves.
- Every enemy group declares `act`, `nodeType`, enemy ids, and weight.
- Combat, elite, and boss selection are filtered by current act and node type.
- Boss nodes store deterministic act-specific boss groups, and same seeds produce the same boss group.
- Multi-enemy combat continues to skip defeated enemies, reject defeated single targets, and ignore defeated enemies for all-enemy effects.
- Low-profile enemy panels display low-profile enemy names and neutral intent labels.
- Unsupported exact enemy sub-mechanics are recorded in `PROGRESS.md` rather than hidden in UI code.
- No network, account, telemetry, ads, cloud sync, remote data fetch, commercial API, or scraping is introduced.

### Test Commands

```bash
npm test
npm run build
```
