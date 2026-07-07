# Movement

**Status:** done

Doom's momentum model converted from tics to seconds: thrust accumulates into momentum, friction multiplies momentum by 0.90625 per 35Hz tic, and equilibrium yields Doom's top speeds. A global scale of 0.62 tunes the original 18.2 m/s run down to roughly 11 m/s because this dungeon's corridors are tighter than Doom's arenas.

Kept quirks: diagonal movement is not normalized (forward+strafe really is faster), and there is no jumping, crouching, or vertical aim.

Touch sticks feed the same thrust model through analog axes: a radial deadzone (0.15) remaps deflection so walking speed ramps smoothly from a creep to full run, direction follows the thumb exactly (no per-axis snapping), and the axis magnitude caps at 1 so a stick diagonal cannot out-run the rim. The keyboard keeps full-strength Doom axes, including the diagonal quirk.

Collision is circle vs cell grid with independent axis sliding and sub-stepping so high speeds cannot tunnel. Player radius 0.45m, eye height 1.5m, view bob scales with speed squared.

### Build log

- 2026-07-07: momentum, friction, sliding collision, and tests. Files: `src/game/movement.ts`, `src/game/collision.ts`, `src/game/movement.test.ts`, `src/game/collision.test.ts`. PR #172.
- 2026-07-07: analog touch walking (real-device feel report): radial-deadzone analog axes through applyThrustAxes, squared aim response. Files: `src/game/touch.ts`, `src/game/movement.ts`, `src/components/FlatlineGame.tsx`. PR #174.
- 2026-07-07: fixed reversed strafe direction (was backwards on every input path); positive strafe now moves the player right. Files: `src/game/movement.ts`, `src/game/movement.test.ts`. PR #174.
