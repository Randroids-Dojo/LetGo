# HUD and mugshot

**Status:** done

A Doom status bar across the bottom: current ammo, health percent, weapon slot indicators 1 to 7 (owned lit, current inverted) with the weapon name, the mugshot, armor percent, run studs, and depth (ring), plus a [KEY] tag when carrying a vault key.

The mugshot is the minifig's head with Doom's behavior: five health tiers at 80/60/40/20 percent get progressively more cracked and scuffed (hairline cracks, scuffs, a knocked-out chip, dazed stars), idle eyes glance randomly, damage shows a pain face for 0.7s, pickups flash a grin, and death shows X eyes over a split face.

Overlays: center crosshair, damage flash (red vignette scaled by Doom's damagecount decay), brief bright pickup flash, weapon viewmodel canvas with the Doom bob formula (speed-squared amplitude, frozen while firing).

### Build log

- 2026-07-07: mugshot reskinned to a cracking minifig head, HUD labels retitled (STUDS, DEPTH). Files: `src/components/LetGoGame.tsx`, `src/art/mugshot.ts`, `app/globals.css`. PR #TBD.
- 2026-07-07: status bar, reactive mugshot, flashes, viewmodel bob. Files: `src/components/FlatlineGame.tsx`, `src/art/mugshot.ts`, `app/globals.css`. PR #172.
- 2026-07-07: phone-width reflow: under 700px the status bar becomes a two-row grid around a smaller mugshot with safe-area insets; weapon slots became buttons. Files: `app/globals.css`, `src/components/FlatlineGame.tsx`. PR #173.
- 2026-07-07: phone-width reflow: under 700px the status bar becomes a two-row grid around a smaller mugshot with safe-area insets; weapon slots became buttons. Files: `app/globals.css`, `src/components/FlatlineGame.tsx`. PR #173.
