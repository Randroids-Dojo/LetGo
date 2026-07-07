# Pickups

**Status:** done

Doom's item economy in plastic clothes. Items that would do nothing (full hp, full armor, full ammo) stay on the floor.

- Small heart +10 hp, medkit brick +25 hp, both capped at max hp.
- Vest: sets 100 armor at 1/3 absorb. Heavy armor: 200 at 1/2.
- Ammo: box of studs 50, shells 8, TNT bundle 3, ray cells 40.
- Studs: single stud 10, stud pile 100, scaled by the Stud Magnet multiplier and doubled by Golden Touch. Studs burst from dead enemies (2 to 20 by monster type, following the RL2 pacing of 20 to 50 gold per early kill).
- Vault key: one-slot key item.

Enemy kills also roll a luck-scaled supply drop (heart or studs, 18% base plus Lucky Brick).

### Build log

- 2026-07-07: pickup art and copy reskinned (kinds `stud`/`studPile`/`heartSmall`/`heartBig`/`heavyArmor`); values unchanged. Files: `src/game/pickups.ts`, `src/game/pickups.test.ts`, `src/art/sprites.ts`. PR #TBD.
- 2026-07-07: pickup effects, drop rolls, and tests. Files: `src/game/pickups.ts`, `src/game/pickups.test.ts`. PR #172.
