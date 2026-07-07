# Weapons

**Status:** done

Seven slots mapping one-to-one onto Doom's arsenal, re-skinned as brick weaponry. Damage dice, cycle times, pellet counts, spread, and ammo economy follow the Doom tables.

| Slot | Name | Doom analog | Notes |
|---|---|---|---|
| 1 | Bare Claws | Fist | 2x1d10 melee, always available |
| 2 | Stud Shooter | Pistol | 5x1d3, first tapped shot perfectly accurate |
| 3 | Scatter Blaster | Shotgun | 7 pellets of 5x1d3, 1.06s cycle |
| 4 | Gatling Stud | Chaingun | 5x1d3 at 8.75 rounds/sec |
| 5 | Dynamite | Rocket launcher | 20x1d8 direct plus 128-over-4m splash, hurts you too |
| 6 | Ray Blaster | Plasma rifle | 5x1d8 projectiles at 27 m/s |
| 7 | Mega Brick | BFG (simplified) | 100x1d8 ball, 40 cells per shot, big splash |

Ammo types: bullets (200 max), shells (50), tnt (50), cells (300); max scales with the Deep Bins board node. Dry-firing swaps to the best owned weapon with ammo. Claws and Stud Shooter are always owned; the rest unlock in the Armory, with three purchasable +20% damage tiers per gun.

Hitscan spread uses Doom's triangular twin-random distribution at 5.6 degrees.

### Build log

- 2026-07-07: weapon names reskinned as brick weaponry (ids `claws`/`studgun`/`scatter`/`gatling`/`dynamite`/`raygun`/`megabrick`); stats and tables unchanged. Files: `src/game/weapons.ts`, `src/game/weapons.test.ts`, `src/art/viewmodel.ts`. PR #TBD.
- 2026-07-07: full arsenal with Doom-table stats and tests. Files: `src/game/weapons.ts`, `src/game/weapons.test.ts`, `src/art/viewmodel.ts`. PR #172.
