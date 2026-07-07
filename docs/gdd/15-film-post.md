# Post pass

**Status:** done

Three presets, selectable on the title screen and pause menu, persisted in localStorage:

- Clean: light sparkle, minimal saturation boost.
- Playful (default): sparkle plus a saturation/brightness glow.
- Retro: heavy sparkle, glow, and vignette.

Implementation: a 2D overlay canvas above the WebGL view redraws at about 12Hz with tiled animated glitter specks, an occasional one-frame twinkle burst, and a soft radial vignette; the render root gets a CSS saturate/brightness/contrast filter so the molded plastic reads punchy. The overlay uses normal blending so the sparkle sits as light over the scene.

Motion QA rule 10 coverage: e2e asserts the overlay pixels actually change over time and that Retro draws denser sparkle than Clean.

### Build log

- 2026-07-07: film grayscale pass replaced by a colorful sparkle/vignette post pass; `film.ts` renamed to `post.ts`, presets renamed clean/playful/retro. Files: `src/art/post.ts`, `tests/film-motion.spec.ts`. PR #TBD.
- 2026-07-07: grain, scratches, vignette, presets, and motion tests. Files: `src/art/film.ts`, `tests/film-motion.spec.ts`. PR #172.
