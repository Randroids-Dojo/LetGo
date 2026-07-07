# LetGo

An endless brick dungeon. First-person Doom mechanics in an on-the-fly generated dungeon built entirely out of bright plastic bricks and minifigs, with Rogue Legacy style meta progression: get smashed, bank your studs, buy permanent upgrades at the Workshop, snap yourself back together and dive in again.

Live build: https://let-go-kappa.vercel.app/

## Play

- WASD to move, mouse to aim (click grants pointer lock), click to shoot.
- 1 to 7 swap weapons (or tap the HUD slots), E or Space opens doors, hold Tab for the automap, Escape pauses.
- Touch devices: left thumb moves, right thumb aims, tap to shoot, hold FIRE to spray; on-screen USE, MAP, and pause buttons.
- Death is progress: studs collected convert to Build Plan ranks, Armory unlocks, and one-run gadgets. Unspent studs get swept up by the cleanup crew when the next run starts, so spend before you dive.

## Development

```bash
npm install
npm run dev        # http://127.0.0.1:3000
npm run verify     # lint + typecheck + unit tests + build + e2e
```

E2e uses Playwright. In environments with a preinstalled browser, point at it with `PLAYWRIGHT_CHROMIUM_PATH=/opt/pw-browsers/chromium npm run test:e2e`.

All art and audio are generated at runtime (canvas 2D + WebAudio); the repo has no binary game assets. No game runtime environment variables are required.

## Project Docs

- `docs/gdd/`: canonical requirement-granular game design document (start at `docs/gdd/README.md`).
- `AGENTS.md`: required operating rules for agentic coding tools.
- `docs/IMPLEMENTATION_PLAN.md`: backlog shape, slice order, loop rules, and definitions of done.
- `docs/WORKING_AGREEMENT.md`: branch, commit, PR, review, CI, and deploy rules.
- `docs/PROGRESS_LOG.md`: newest-first implementation history.
- `docs/OPEN_QUESTIONS.md`: durable design and technical decisions.
- `docs/FOLLOWUPS.md`: deferred work that should survive context loss.
- `docs/GDD_COVERAGE.json`: maps GDD requirements to implementation, tests, and remaining gaps.

## Source Layout

- `src/game/`: pure simulation logic (dungeon generation, movement, combat, enemies, doors, pickups, meta progression), each module unit-tested.
- `src/art/`: procedural plastic-brick drawing (brick primitives, textures, minifig sprites, viewmodels, mugshot, sparkle post pass).
- `src/audio/`: synthesized sound.
- `src/components/`: the Three.js game component and the Workshop screen.
- `tests/`: Playwright e2e (full loop, pause, persistence, sparkle-motion QA).
