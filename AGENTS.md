# Agent Rules

This repository is an offline-first, original roguelite deck-building card game. All future AI coding agents must follow these rules.

## Product Source of Truth

- All new features must comply with `docs/PRODUCT_SPEC.md`.
- Do not implement a feature that conflicts with the product spec.
- If a requested feature conflicts with the product spec, stop and explain the conflict before editing code.
- Keep the game local and offline-first.

## Original Content Rule

Do not copy, import, scrape, trace, closely paraphrase, or recreate commercial game content.

This includes:

- Character names.
- Card names.
- Monster or enemy names.
- Relic names.
- Status names that are distinctive to a specific game.
- Art, icons, screenshots, animation, VFX, SFX, music, fonts, UI skins, card text, event text, lore text, tutorial text, numeric tables, encounter tables, reward tables, and map-generation tables.

Genre-level mechanics are allowed only when implemented with original names, original values, original content, and original presentation.

## Documentation Rule

- Any new mechanic must update `docs/MECHANICS.md`.
- Any architecture change that moves responsibilities across `game/engine`, `game/data`, `game/store`, `ui`, or `adapters` must update `docs/ARCHITECTURE.md`.
- Any product-scope change, network-related proposal, or content-policy change must update `docs/PRODUCT_SPEC.md`.
- Keep milestone progress aligned with `docs/MILESTONES.md`.

## Engineering Boundaries

- Keep rules engine code separate from React UI code.
- Keep cards, enemies, relics, and statuses data-driven where practical.
- Keep browser APIs behind store or adapter boundaries.
- Keep save data versioned and local.
- Prefer deterministic tests for combat, rewards, map generation, statuses, and relic triggers.

## Required Final Checks

Before ending every implementation task, run:

```bash
npm test
npm run build
```

If either command cannot run because the project has not been scaffolded yet or dependencies are missing, report that clearly in the final response.

## Prohibited Integrations

- Do not use network access for gameplay features.
- Do not add account login.
- Do not add cloud sync.
- Do not add telemetry, analytics, crash reporting SDKs, ad SDKs, or tracking pixels.
- Do not add remote feature flags.
- Do not fetch game data from remote services.
- Do not connect to commercial game APIs or scrape commercial game wikis as implementation input.

## Handoff Rule

At the end of a task, summarize:

- What changed.
- Which tests were run.
- Any docs updated.
- Any product-spec concerns or follow-up risks.
