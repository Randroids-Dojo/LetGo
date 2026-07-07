# Audio

**Status:** partial

Everything is synthesized with WebAudio, no assets: per-weapon noise-burst blasters, cartoon slide-whistle enemy deaths, squeak pain cues, stud dings, door creaks, a locked-door thunk, explosion rumble. Ambience is a soft pad with a bouncy major-key bass line that skips along like a toy on parade. Mute toggle on title and pause, persisted per session only.

Not yet done: audio texture tied to the style preset, positional panning, and a fuller ambience loop. See F-028.

### Build log

- 2026-07-07: ambience reskinned from vinyl-crackle swing bass to a bright bouncing major-key loop; sfx methods unchanged. Files: `src/audio/sfx.ts`. PR #TBD.
- 2026-07-07: synthesized sfx and crackle-plus-bass ambience. Files: `src/audio/sfx.ts`. PR #172.
