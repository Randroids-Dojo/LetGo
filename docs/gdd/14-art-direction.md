# Art direction

**Status:** done

The plastic-brick recipe: saturated ABS colors (classic brick red, yellow, blue, green), vertical light-to-dark gloss gradients, crisp dark seams, raised studs with a specular crescent, minifig bodies (trapezoid torso, block legs, cylinder head with a top stud, C-shaped claw hands), monsters that come apart into loose pieces instead of bleeding, hard-edged starburst muzzle flashes, and deaths that scatter the figure into a pile of bricks with the head resting on top.

Everything is drawn procedurally at runtime with canvas 2D in `src/art/`:

- `brick.ts`: shared primitives (plastic slabs with gloss, studs, tubes, starbursts, loose-piece debris, claw hands, minifig heads and faces) on a saturated toy palette.
- `textures.ts`: classic (red brick), castle (gray with moss), and space (blue panel) wall themes rotating by ring, a green studded baseplate floor, a tube-underside ceiling, doors, the Workshop door.
- `sprites.ts`: a parameterized minifig rig rendering all five monsters (skeleton, guard, wizard, knight, brick-built golem) across seven animation frames, plus pickups, crates, projectiles, impacts, explosions.
- `viewmodel.ts`: first-person claw-hand and molded-weapon views with fire frames.
- `mugshot.ts`: the status-bar minifig head with cracking damage tiers.

Environment rendering: instanced wall cubes with Lambert shading under a bright hemisphere-plus-directional-plus-ambient rig, a tube ceiling, colored haze closing at 42m. Enemies and items are fog-affected billboards. A sparkle-and-vignette post pass (`post.ts`) plus a saturating CSS filter keeps the plastic punchy.

### Build log

- 2026-07-07: art layer reskinned to plastic bricks and minifigs; `ink.ts` replaced by `brick.ts`, `film.ts` by `post.ts`. Files: `src/art/brick.ts`, `src/art/textures.ts`, `src/art/sprites.ts`, `src/art/viewmodel.ts`, `src/art/mugshot.ts`, `src/art/post.ts`. PR #TBD.
- 2026-07-07: complete procedural art layer. Files: `src/art/ink.ts`, `src/art/textures.ts`, `src/art/sprites.ts`, `src/art/viewmodel.ts`, `src/art/mugshot.ts`. PR #172.
