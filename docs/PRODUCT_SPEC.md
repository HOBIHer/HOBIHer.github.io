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

The game must not copy protected expression, names, assets, text, layouts, or balancing tables from commercial games.

## Target Experience

- Fast local runs that can be played entirely offline.
- Clear deterministic combat rules that are easy to inspect and test.
- Low-friction keyboard and mouse controls.
- Readable UI suitable for both normal play and a discreet "low-profile" mode.
- Original card, enemy, relic, status, event, and character fantasy.
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

## Original Content Requirements

All player-facing creative content must be original to this project, including:

- Character names and class identities.
- Card names, card art, flavor text, and rule text.
- Enemy names, enemy art, intent names, and move patterns.
- Relic names, relic art, and descriptions.
- Status names, icons, and descriptions.
- Event names, event text, map art, UI assets, sound assets, and music.
- Numeric tuning tables and encounter compositions.

Content can use generic fantasy, nautical, mechanical, academic, office, or abstract themes, but it must be written and tuned independently.

## Explicit Prohibited Content

The project must not use, copy, adapt, scrape, trace, import, or closely paraphrase any of the following from Slay the Spire, Slay the Spire 2, or any other commercial game:

- Character names.
- Card names.
- Monster or enemy names.
- Relic names.
- Status names that are distinctive to a specific game.
- Art assets, screenshots, icons, animations, VFX, SFX, music, fonts, or UI skins.
- UI layouts that are recognizably copied as a whole composition.
- Card text, event text, lore text, descriptions, jokes, or tutorial wording.
- Exact card pools, enemy move sets, encounter tables, relic pools, reward tables, map generation tables, or numeric balance tables.
- Internal data schemas obtained from commercial game files.

References to commercial games may appear only in planning discussions as high-level genre comparisons. They must not become implementation data.

## Allowed Genre-Level Mechanics

The following generic mechanics are allowed because they are broad game-design patterns:

- Turn-based combat.
- Energy per turn.
- Card draw and discard.
- Cards that deal damage, grant block, apply statuses, or manipulate piles.
- Exhausting cards for the current combat.
- Retaining cards between turns.
- Passive relic-like modifiers.
- Enemy intents.
- Procedural or semi-procedural map nodes.
- Rewards after combat.
- Local save and run history.

When implementing these mechanics, use original names, original numbers, and project-owned descriptions.

## Product Guardrails

- Prefer deterministic engine functions that are easy to test.
- Keep UI presentation separate from game rules.
- Keep all default data in local files.
- Make terminology themeable where feasible.
- Add or update documentation whenever a mechanic or content category changes.
- Do not introduce network dependencies without an explicit product-spec change.
