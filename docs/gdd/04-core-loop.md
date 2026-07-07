# Core loop

**Status:** done

Minute to minute: sweep rooms, smash monsters, grab studs and supplies, push one ring further out, find vault keys, crack vaults.

Run to run: die, watch the summary (depth, kills, studs, time), return to the Workshop, spend on the Build Plan / Armory / Tinkerer, dive in. Starting a run sweeps up all unbanked studs, so spending before leaving is the correct move.

Session to session: permanent board ranks and weapon tiers persist in localStorage. Best depth is the score.

### Build log

- 2026-07-07: loop copy reskinned (studs currency, Workshop hub); flow unchanged. Files: `src/components/LetGoGame.tsx`, `src/components/WorkshopScreen.tsx`, `src/game/meta.ts`. PR #TBD.
- 2026-07-07: full loop shipped. Files: `src/components/FlatlineGame.tsx`, `src/components/OfficeScreen.tsx`, `src/game/meta.ts`. PR #172.
