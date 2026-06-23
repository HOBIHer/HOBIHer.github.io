# SlaytheFish2

SlaytheFish2 is a local, offline-first roguelite deck-building card game prototype with original cards, enemies, relics, map nodes, and low-profile terminology. It runs entirely in the browser with bundled local data and no gameplay network dependency.

## Requirements

- Node.js 20 or newer
- npm

## Install

```bash
npm install
```

## Start Development Server

```bash
npm run dev
```

Vite starts on `http://127.0.0.1:5173` by default. If the port is busy, pass another port:

```bash
npm run dev -- --host 127.0.0.1 --port 5174
```

Stop the dev server with `Ctrl+C` in the terminal running Vite.

## Test

```bash
npm test
```

## Build

```bash
npm run build
```

The build command runs TypeScript checking and then creates the production bundle in `dist/`.

## Local Saves

Active runs, settings, custom background choices, and run history are saved in browser `localStorage` under `slaythefish2.*` keys. Saves are versioned locally; no account, cloud sync, telemetry, analytics, or remote data fetch is used for gameplay.

## Product Guardrails

- Keep all default content original and bundled locally.
- Keep the rules engine separate from React UI.
- Update `docs/MECHANICS.md` when adding mechanics.
- Run `npm test` and `npm run build` before handoff.
