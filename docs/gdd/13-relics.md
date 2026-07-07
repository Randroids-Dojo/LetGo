# Gadgets (one-run items)

**Status:** done

Bought at The Tinkerer after unlocking it on the board. Each applies to the next run only and is consumed when the run starts. One of each per run. (Internally still called relics in the schema.)

- Extra Life 250: survive one death at 50 hp.
- Turbo Charger 150: +25% move speed.
- Health Pack 120: start 50 hp over the cap.
- Golden Touch 200: double stud drops.
- Riot Plate 180: start with 100 heavy armor.
- Ammo Crate 160: start with full bins.
- Master Key 220: vault doors open without keys.
- Radar Chip 100: pickups appear on the automap.

### Build log

- 2026-07-07: gadget names and copy reskinned; ids and effects unchanged. Files: `src/game/meta.ts`, `src/components/WorkshopScreen.tsx`. PR #TBD.
- 2026-07-07: relic definitions, purchase flow, and run-config effects. Files: `src/game/meta.ts`, `src/game/meta.test.ts`. PR #172.
