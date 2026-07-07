# Vision

**Status:** done

LetGo is a desktop web FPS that plays like 1993 Doom and looks like a box of plastic bricks. You are a minifig in a colorful dungeon that builds itself forever in every direction. Runs end in death by design: every time you are knocked into loose parts your studs go back to the Workshop, where permanent upgrades, weapon unlocks, and one-run gadgets bend the next run in your favor, in the Rogue Legacy tradition.

One sentence pitch: Doom's combat, a bright plastic-brick minifig look, Rogue Legacy 2's death economy, endless procedural dungeon.

What it is NOT: a story game, a mobile-first game, a multiplayer game, or a faithful level-based Doom campaign.

### Build log

- 2026-07-07: theme reboot to LetGo. Kept all Doom mechanics and Rogue Legacy meta; reskinned the entire art, audio, and copy layer from 1930s mouse noir to plastic bricks and minifigs. Files: `src/art/brick.ts`, `src/art/sprites.ts`, `src/art/textures.ts`, `src/components/LetGoGame.tsx`, `src/components/WorkshopScreen.tsx`. PR #TBD.
- 2026-07-07: full reboot shipped: new game replacing the arena shooter. Files: `src/components/FlatlineGame.tsx`, `src/components/OfficeScreen.tsx`, `src/game/dungeon.ts`, `src/game/enemies.ts`, `src/game/weapons.ts`, `src/game/meta.ts`, `src/art/ink.ts`, `src/art/sprites.ts`. PR #172.
