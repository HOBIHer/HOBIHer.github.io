# Product Spec

## Game Positioning

SlaytheFish2 is a local, offline-first, single-player roguelite deck-building tower-climb card game. The product goal is to capture the broad appeal of tactical turn-based card combat while building an original game identity, original terminology, original content, and original presentation.

The game may draw from genre-level conventions:

- Turn-based card combat.
- Energy or action-point style card costs.
- Draw pile, hand, discard pile, and exhaust/remove-for-combat pile.
- Relics or passive artifacts that modify rules.
- Temporary and persistent status effects.
- Enemy intent previews.
- Map nodes, route selection, rewards, rest points, shops, events, elites, and bosses.

## Target Experience

- Fast local runs that can be played entirely offline.
- Clear deterministic combat rules that are easy to inspect and test.
- Low-friction keyboard and mouse controls.
- Readable UI suitable for both normal play and a discreet "low-profile" mode.
- Data-driven content so new cards, enemies, relics, and statuses can be added without rewriting the engine.

## Technical Stack

The initial implementation should use:

- TypeScript for shared game rules and UI code.
- React for the user interface.
- Vite for local development and production build.
- Vitest for unit tests.
- A lightweight local state layer in `game/store`.
- Browser local storage or IndexedDB for offline saves, with adapter boundaries kept explicit.

The project must remain runnable without a backend service.

## Offline First

The game is offline-first by design.

- Core gameplay must not require network access.
- All default game data must be bundled locally.
- Saves, settings, run history, custom backgrounds, and imports/exports must work locally.
- No account login, cloud sync, remote entitlement checks, telemetry, analytics SDKs, or ad SDKs are allowed.
- Optional future import/export flows must use local files or clipboard data, not remote services.

## Low-Profile Mode

Low-profile mode is a required product feature. It should allow the game to present itself with discreet terminology and a calmer visual surface while preserving the same underlying mechanics.

Requirements:

- Replace overt fantasy/combat labels with neutral labels where practical.
- Support alternate terminology for cards, enemies, relics, map nodes, and combat actions.
- Avoid flashy animation by default while low-profile mode is enabled.
- Keep combat state fully understandable without relying on copied genre UI language.
- Persist the setting locally.

Low-profile mode is not a separate ruleset. It is a presentation and terminology layer over the same engine state.

## Replaceable Backgrounds

The game must support replaceable visual backgrounds.

- Default backgrounds must be original, locally bundled, or generated for this project.
- Users should be able to choose alternate local backgrounds.
- Custom backgrounds must not be uploaded anywhere.
- The UI should remain readable across backgrounds through contrast controls, overlays, or theme-aware surfaces.
- Background logic belongs in UI or adapter layers, not in the rules engine.

## Product Guardrails

- Prefer deterministic engine functions that are easy to test.
- Keep UI presentation separate from game rules.
- Keep all default data in local files.
- Make terminology themeable where feasible.
- Add or update documentation whenever a mechanic or content category changes.
- Do not introduce network dependencies without an explicit product-spec change.
