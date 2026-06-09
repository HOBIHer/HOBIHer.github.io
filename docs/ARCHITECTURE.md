# Architecture

## Overview

SlaytheFish2 should be structured around a strict separation between a deterministic game rules engine and a React presentation layer. The engine owns what happens. The UI owns how it looks, sounds, and feels.

Core principle:

- `game/engine` must be usable without React.
- `ui` must render state and dispatch commands rather than directly mutating combat rules.
- Content should be data-driven wherever practical.
- Browser APIs must be isolated behind adapters or store boundaries.

## Proposed Directory Structure

```text
.
├── AGENTS.md
├── docs/
│   ├── ARCHITECTURE.md
│   ├── MECHANICS.md
│   ├── MILESTONES.md
│   └── PRODUCT_SPEC.md
├── public/
│   └── assets/
│       ├── backgrounds/
│       ├── icons/
│       └── audio/
├── src/
│   ├── adapters/
│   │   ├── backgroundAdapter.ts
│   │   ├── exportAdapter.ts
│   │   ├── randomAdapter.ts
│   │   └── saveAdapter.ts
│   ├── game/
│   │   ├── data/
│   │   │   ├── cards/
│   │   │   ├── enemies/
│   │   │   ├── relics/
│   │   │   ├── statuses/
│   │   │   ├── rewards/
│   │   │   └── themes/
│   │   ├── engine/
│   │   │   ├── combat/
│   │   │   ├── map/
│   │   │   ├── rewards/
│   │   │   ├── rules/
│   │   │   └── types.ts
│   │   └── store/
│   │       ├── combatStore.ts
│   │       ├── runStore.ts
│   │       ├── settingsStore.ts
│   │       └── historyStore.ts
│   ├── ui/
│   │   ├── components/
│   │   ├── screens/
│   │   ├── themes/
│   │   └── terminology/
│   ├── App.tsx
│   └── main.tsx
├── package.json
└── vite.config.ts
```

This is the intended direction. Early milestones may create only the directories needed for the current slice.

## `game/engine`

`game/engine` owns deterministic rules and state transitions.

Responsibilities:

- Combat turn flow.
- Card play validation and resolution.
- Damage, block, healing, pile movement, and status application.
- Relic trigger evaluation.
- Enemy intent selection and enemy action resolution.
- Reward generation rules.
- Map node generation and route progression.
- Pure or mostly pure functions that receive state plus commands and return next state plus events.

Engine code should avoid:

- React imports.
- DOM access.
- Browser storage APIs.
- CSS, image, or audio concerns.
- Direct random calls that cannot be seeded or tested.

## `game/data`

`game/data` contains project-owned data definitions.

Responsibilities:

- Card definitions.
- Enemy definitions and move tables.
- Relic definitions.
- Status definitions.
- Reward pools.
- Map node definitions.
- Theme and terminology data when it is content-like.

Guidelines:

- Keep cards, enemies, relics, and statuses as data-driven as possible.
- Prefer reusable effect descriptors over one-off hardcoded card functions.
- Use original names, original text, and original numbers.
- Do not import or encode commercial game data.
- Validate data shape with TypeScript types and tests.

## `game/store`

`game/store` bridges the deterministic engine and the app.

Responsibilities:

- Hold active run state.
- Expose user actions such as play card, end turn, choose reward, select route, rest, save, and load.
- Coordinate settings, run history, and local persistence.
- Convert UI events into engine commands.
- Keep state serializable where practical.

The store may use a lightweight state library, but the engine must not depend on that library.

## `ui`

`ui` owns presentation.

Responsibilities:

- Screens such as combat, map, rewards, rest point, run history, and settings.
- Components such as hand, draw pile, discard pile, enemy row, intent indicator, relic bar, status badges, and reward chooser.
- Themes, low-profile mode labels, and visual density.
- Custom background selection and readability controls.
- Animation and interaction polish.

UI components should read state and dispatch store actions. They should not reimplement combat math.

## `adapters`

`adapters` isolate platform-specific or side-effecting behavior.

Responsibilities:

- Local save persistence through local storage, IndexedDB, or files where available.
- Import and export serialization.
- Custom background loading from local files.
- Seeded random implementation or bridge.
- Optional future audio or asset loading boundaries.

Adapters should be small, testable, and replaceable. They must not introduce network access unless the product spec is explicitly changed.

## Rule Engine and React Separation

The engine should expose command-style APIs such as:

```ts
resolveCombatCommand(state, command, context): CombatResult
```

React should never be required to run an engine test. A Vitest test should be able to instantiate combat state, apply a card command, and assert the resulting state without rendering a component.

Recommended flow:

1. UI receives user input.
2. Store validates whether the action is currently available.
3. Store sends a command to the engine.
4. Engine returns next state and events.
5. Store persists or records history as needed.
6. UI renders the new state and events.

## Data-Driven Content

Cards, enemies, relics, and statuses should be defined as data with typed effect descriptors whenever feasible.

Example categories:

- `damage`: deal computed damage to a target.
- `block`: add block to the player.
- `applyStatus`: apply a status stack to a combatant.
- `draw`: move cards from draw pile to hand.
- `trigger`: define relic hooks such as combat start, turn start, card played, damage taken, or combat reward.

Hardcoded behavior is acceptable only when a mechanic cannot be expressed cleanly through existing descriptors. When adding hardcoded behavior, document why and add focused tests.

## Testing Expectations

Engine tests should cover:

- Deterministic card resolution.
- Status interactions.
- Relic trigger order.
- Enemy intent and action resolution.
- Reward generation with seeded randomness.
- Save/load serialization compatibility.

UI tests can be narrower early on, focused on smoke tests and critical user flows.
