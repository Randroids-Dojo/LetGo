# Meta progression

**Status:** done

Rogue Legacy 2's structure, re-themed. All purchases use studs at the Workshop between runs.

**Build Plan** (the manor tree): a 5x4 grid of nodes joined by connectors. Fog of war: a node is visible only when purchased or adjacent to a purchase, hidden nodes show face-down tiles. Sixteen nodes (the pre-owned Workshop root plus fifteen purchases): hp (two nodes, deeper one bigger), damage (two), speed, start armor, stud gain, max ammo, drop luck, fire rate, automap range, the Parts Bin (opens the Armory), The Tinkerer (opens gadgets), and the Storage Bin plus Secret Stash (stud banking). Rank cost grows about 60% per rank; past 30 total ranks a labor-cost inflation adds 10 per rank purchased anywhere (the RL2 rule).

**Armory**: unlock Scatter Blaster 300, Gatling Stud 650, Dynamite 1200, Ray Blaster 2000, Mega Brick 4000; three +20% damage tiers per weapon priced as growing multiples of the unlock price.

**The cleanup (Charon rule)**: starting a run sweeps up 100% of unspent studs. Storage Bin ranks keep 10% each (up to 60%), Secret Stash extends to 100%. Swept studs are tracked for flavor.

Death always banks the run's earnings first: `endRun` adds studs, kills, and best depth; `beginRun` applies cleanup and consumes gadgets.

Pacing anchors from RL2 research: early runs earn roughly 150 to 600; first-row node ranks cost 80 to 200, so every death affords at least one purchase.

### Build log

- 2026-07-07: meta copy reskinned (studs currency, Build Plan / Workshop / Tinkerer, brick weapon names); node ids, costs, and math unchanged. Files: `src/game/meta.ts`, `src/components/WorkshopScreen.tsx`. PR #TBD.
- 2026-07-07: board, armory, rent, run lifecycle, schema, tests. Files: `src/game/meta.ts`, `src/game/meta.test.ts`, `src/components/OfficeScreen.tsx`. PR #172.
