# Changelog

## Unreleased

- Reserved for future local-only gameplay and documentation changes.

## v1.3.0 - 2026-06-09

- Added 83 implemented v1.3.0 Iron Oath cards with original ids, normal names, low-profile names, explicit upgrades, and reward-pool inclusion for non-basic cards.
- Added typed support for X-cost cards, innate upgrades, ancient/basic rarities, combat-local card modifiers, pile manipulation, exhaust triggers, and several power-style turn/event hooks.
- Blocked 4 source rows that require another player/ally model or undefined `Giant Rock`/`Plating` behavior.
- Updated low-profile card rendering and hand playability for X-cost cards.
- Added v1.3.0 content and mechanism coverage in `src/tests/v130CardBatch.test.ts`.
- Updated mechanics, catalog, milestone, progress, and changelog documentation.

## v1.2.0 - 2026-06-09

- Replaced the first-act route with a deterministic upward tree map with multiple starts and one Boss endpoint.
- Added persistent deck card instances and one-step card upgrades from rest nodes.
- Added upgraded card resolution in combat for cost, text, and effects.
- Added a local potion pool, 3 potion slots, potion rewards, and combat potion use.
- Updated reward, rest, combat, and map UI for the new systems in normal and low-profile modes.
- Updated local save normalization to v3 with upgraded cards, potions, tree-map fields, combat snapshots, and rest upgrade results.
- Added v1.2.0 tests for tree-map progression, card upgrades, potion behavior, save/load, and low-profile labels.

## v1.1.0 - 2026-06-09

- Added a deterministic branching Act 1 map with route choices.
- Added active-run continue flow from the main menu.
- Added combat-start snapshots so paused combats resume from the same opening state.
- Added explicit defeated enemy state, defeated-target filtering, and defeat log entries.
- Added hover and focus descriptions for status badges.
- Added clickable draw, discard, and exhaust pile viewers.
- Added rest result feedback before returning to the map.
- Updated local save schema normalization for v2 active-run fields.
- Expanded README handoff instructions for local install, dev, test, build, and localStorage saves.
