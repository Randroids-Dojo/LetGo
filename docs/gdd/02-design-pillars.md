# Design pillars

**Status:** done

1. **Doom in the fingers.** Movement speed, weapon cadence, damage dice, armor math, pain chance, door timing: taken from the original tables (via doomwiki and the released source constants), scaled only where the tighter dungeon demands it. Doom quirks are kept on purpose (unnormalized diagonal speed, first-shot pistol accuracy, monster infighting).
2. **Everything is a brick.** Saturated ABS colors, glossy molded plastic with crisp seams, raised studs, minifigs that come apart into loose pieces instead of bleeding, sparkle and a soft vignette over everything. If a screenshot could not pass for a photo of a plastic-brick playset, it is wrong.
3. **Death pays the studs.** Dying is progress. Studs collected in a run always convert to permanent power at the Workshop. Unspent studs are swept up when the next run starts (the Charon rule), so every visit to the Workshop ends with a spending decision.
4. **The dungeon never ends.** The dungeon streams forever in every direction from a run seed. Deeper rings spawn meaner mixes. There is no exit, only a personal best.

### Build log

- 2026-07-07: theme reboot reskinned pillar 2 (plastic-brick look) and pillar 3 (studs currency); mechanics untouched. Files: `src/art/brick.ts`, `src/art/post.ts`, `src/game/meta.ts`. PR #TBD.
- 2026-07-07: pillars established in the reboot implementation. Files: `src/game/movement.ts`, `src/game/weapons.ts`, `src/game/dungeon.ts`, `src/game/meta.ts`, `src/art/ink.ts`, `src/art/film.ts`. PR #172.
