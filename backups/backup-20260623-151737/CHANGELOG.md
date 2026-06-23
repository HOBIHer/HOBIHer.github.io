# Changelog

## Unreleased

- Reserved for future local-only gameplay and documentation changes.

## v1.6.0 - 2026-06-11

- Added the v1.6.0 three-act enemy pool from `docs/content_requests/Enemy_BATCH_1.6.0.md`, including new act 1/2/3 combat, elite, boss, summon, and boss-part enemy definitions.
- Reworked enemy groups to require `act` plus `nodeType`, with combat/elite/boss selection filtered by the current act.
- Made boss map nodes choose a seed-determined boss group from the current act's boss pool.
- Added enemy initial statuses, enemy repeated damage effects, Slippery, Intangible, enemy Stun/Slumber skips, and shared end-turn HP-loss status handling for new enemy pressure statuses.
- Updated low-profile enemy intent display to use neutral intent terms in stealth mode.
- Added v1.6.0 enemy pool, act-aware group, boss determinism, mechanism, and low-profile tests in `src/tests/v160Enemies.test.ts`, and updated older group/Boss tests for act-aware pools.
- Updated mechanics, content catalog, milestones, progress, and changelog documentation with implemented and still-limited v1.6 enemy mechanisms.

## v1.5.2 - 2026-06-11

- Fixed the default Iron Oath starter loadout to use one starter data source for 5 basic attacks, 4 basic defenses, 1 `破势重击`, and the starter victory-heal relic.
- Expanded rest upgrade results so RestScreen shows card name, before/after descriptions, and cost changes when an upgrade changes cost.
- Added a reusable RelicBar for map and combat screens with normal/low-profile relic names, descriptions, and empty state.
- Added a centralized card keyword description registry and focusable hover/focus keyword rendering in CardView while preserving the original description text.
- Added v1.5.2 regression coverage in `src/tests/v152Systems.test.ts`.

## v1.5.0 - 2026-06-10

- Added typed `Plating`, `Buffer`, `Ritual`, and `Replay` mechanics, including the previously blocked Plating card and mechanism-blocked potion rows.
- Added 18 curse cards with `curse` type/rarity, unplayable default behavior, normal pile flow, low-profile presentation, and key timing triggers.
- Converted runs to a three-act structure with deterministic maps, distinct act bosses, act-start major events, act transition healing, and act 3 victory/ascension unlock.
- Added the v1.5.0 event system with major/minor event pools, deterministic event selection, run-local non-repeat tracking, typed choice effects, blocked-choice reasons, low-profile EventScreen support, and event logs.
- Added deterministic continue snapshots for shops and events so returning to the main menu restores node-start state without rerolling inventories or event choices.
- Updated local save normalization to v5 for event state, seen events, shop/event snapshots, curse fields, Replay modifiers, and curse combat stats.
- Added v1.5.0 coverage in `src/tests/v150Systems.test.ts` and updated existing map/run/storage/content tests for events, curses, three-act flow, and deterministic continue.

## v1.4.0 - 2026-06-10

- Added 33 implemented v1.4.0 potion definitions with rarity, targets, normal/low-profile text, reward/shop pool inclusion, and typed potion effects.
- Added potion mechanisms for enemy damage reduction, hand upgrades, reshuffle-draw, delayed draw/energy/block, passive death ward, block multiplication, max HP gain, temporary strength/dexterity, next-card replay, next-attack damage multiplier, corrosive end-turn HP loss, hand retention, top-card autoplay, potion slot refill, and temporary generated cards.
- Added ascension levels 0-10 with local unlock persistence and stacked restrictions for extra elites, rest heal reduction, gold reduction, fewer potion slots, starter burden card, shop removal price, lower rare card odds, higher enemy HP/damage, and final double boss.
- Replaced the Act 1 route with a deterministic 14-layer DAG including combat, elite, rest, shop, and one final boss endpoint.
- Added a deterministic shop system for local card, relic, and potion purchases with sold flags, gold checks, full potion-slot handling, save/load preservation, and low-profile labels.
- Added the starter-only victory-heal relic `afterglow-charm` / `余息护符` / `恢复凭证` to the current default Iron Oath class.
- Updated local save normalization to v4 and added a versioned ascension-progress localStorage key.
- Added v1.4.0 tests in `src/tests/v140Systems.test.ts` and updated map/run tests for the expanded DAG.
- Recorded blocked potion rows that require unresolved UI, event, token, class, or undefined mechanic support.

## v1.3.0 - 2026-06-09

- Added 83 implemented v1.3.0 Iron Oath cards with original ids, normal names, low-profile names, explicit upgrades, and reward-pool inclusion for non-basic cards.
- Added typed support for X-cost cards, innate upgrades, ancient/basic rarities, combat-local card modifiers, pile manipulation, exhaust triggers, and several power-style turn/event hooks.
- Rows 27, 60, and 75 remain blocked because they require another player/ally model or undefined `Giant Rock` behavior; row 72 was unblocked in v1.5.0 through `Plating`.
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
