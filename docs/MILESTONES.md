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
