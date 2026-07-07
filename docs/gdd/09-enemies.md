# Enemies

**Status:** done

Five minifig monsters mirroring Doom's early bestiary, with Doom's HP, pain chance (out of 255), damage dice, and the P_CheckMissileRange attack gamble. Monster hitscan spread is 4x the player's, per the original.

| Monster | Doom analog | HP | Attack |
|---|---|---|---|
| Skeleton | Zombieman | 20 | 1 stud round, 3x1d5 |
| Guard | Shotgun guy | 30 | 3 pellets, 3x1d5 each |
| Wizard | Imp | 60 | thrown bolt 3x1d8, melee staff |
| Knight | Pinky | 150 | melee only 4x1d10, fastest walker |
| Golem | Baron (scaled) | 350 | brick fireball 8x1d6 at 16 m/s, heavy melee |

AI is a five-state machine (idle, chase, windup, pain, dying) with Doom's zigzag chase (commit to a direction toward the target plus a random offset, re-roll when blocked or expired). Enemies wake on sight within 24m or on gunfire within 20m, open unlocked doors, and take pain rolls per damage event. Deaths play a three-frame collapse that scatters the minifig into loose bricks and drops studs.

Spawn mix by ring: skeletons everywhere; guards and wizards from ring 1; knights ring 2; golems ring 3 and deeper, weight rising with the ring.

### Build log

- 2026-07-07: bestiary reskinned as minifig monsters (kinds `skeleton`/`guard`/`wizard`/`knight`/`golem`); stats, AI, and spawn mix unchanged. Files: `src/game/enemies.ts`, `src/game/enemies.test.ts`, `src/art/sprites.ts`. PR #TBD.
- 2026-07-07: bestiary, AI state machine, infight retargeting, tests. Files: `src/game/enemies.ts`, `src/game/enemies.test.ts`, `src/art/sprites.ts`. PR #172.
