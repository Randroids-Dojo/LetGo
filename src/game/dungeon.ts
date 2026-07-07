// Endless on-the-fly dungeon generation.
//
// The world is an infinite grid of 24x24-cell chunks. Each chunk is generated
// deterministically from (runSeed, cx, cz) the moment the player gets close,
// so the dungeon streams forever in every direction with no global state.
//
// Cross-chunk connectivity is guaranteed by shared edge gateways: the corridor
// opening between two neighboring chunks is derived from the seed of the edge
// they share, so both chunks independently carve to the same doorway cell.

import { hashCoords, mulberry32, rngInt, type Rng } from './rng'

export const CHUNK_SIZE = 24
export const CELL_M = 2
export const WALL_HEIGHT_M = 3

export const CELL_SOLID = 0
export const CELL_FLOOR = 1
export const CELL_DOOR = 2
export const CELL_VAULT_DOOR = 3

export type Room = {
  x: number
  z: number
  w: number
  h: number
}

export type DoorSpawn = {
  gx: number
  gz: number
  // Doors slide up between two solid cells; axis is the direction you walk
  // through them ('x' means the corridor runs east-west).
  axis: 'x' | 'z'
  locked: boolean
}

export type EnemyKind = 'skeleton' | 'guard' | 'wizard' | 'knight' | 'golem'

export type EnemySpawn = { gx: number; gz: number; kind: EnemyKind }

export type PickupKind =
  | 'stud'
  | 'studPile'
  | 'heartSmall'
  | 'heartBig'
  | 'vest'
  | 'heavyArmor'
  | 'bullets'
  | 'shells'
  | 'tnt'
  | 'cells'
  | 'vaultKey'

export type PickupSpawn = { gx: number; gz: number; kind: PickupKind }

export type Chunk = {
  cx: number
  cz: number
  ring: number
  cells: Uint8Array
  doors: DoorSpawn[]
  enemies: EnemySpawn[]
  pickups: PickupSpawn[]
  crates: { gx: number; gz: number }[]
}

export function chunkKey(cx: number, cz: number): string {
  return `${cx},${cz}`
}

export function worldToCell(x: number): number {
  return Math.floor(x / CELL_M)
}

export function cellCenter(g: number): number {
  return (g + 0.5) * CELL_M
}

export function cellToChunk(g: number): number {
  return Math.floor(g / CHUNK_SIZE)
}

function localIndex(lx: number, lz: number): number {
  return lz * CHUNK_SIZE + lx
}

// The corridor opening along the shared edge between two chunks. Both
// neighbors call this with the same canonical edge coordinates and get the
// same local offset, so their corridors meet.
export function gatewayOffset(seed: number, edgeX: number, edgeZ: number, vertical: boolean): number {
  const h = hashCoords(seed, vertical ? 7717 : 3391, edgeX, edgeZ)
  return 4 + (h % (CHUNK_SIZE - 8))
}

export function generateChunk(seed: number, cx: number, cz: number): Chunk {
  const rng = mulberry32(hashCoords(seed, cx, cz))
  const cells = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE)
  const ring = Math.max(Math.abs(cx), Math.abs(cz))
  const isOrigin = cx === 0 && cz === 0

  const rooms: Room[] = []
  if (isOrigin) {
    // The starting room: the workshop entrance. Always centered, always safe.
    rooms.push({ x: 8, z: 8, w: 8, h: 8 })
  }

  const attempts = 14
  for (let i = 0; i < attempts && rooms.length < 6; i++) {
    const w = rngInt(rng, 4, 8)
    const h = rngInt(rng, 4, 8)
    const x = rngInt(rng, 2, CHUNK_SIZE - 2 - w)
    const z = rngInt(rng, 2, CHUNK_SIZE - 2 - h)
    const candidate = { x, z, w, h }
    if (!rooms.some((r) => rectsTouch(r, candidate))) {
      rooms.push(candidate)
    }
  }
  if (rooms.length < 2) {
    rooms.push({ x: 4, z: 4, w: 6, h: 6 })
  }

  for (const room of rooms) {
    carveRect(cells, room.x, room.z, room.w, room.h)
  }

  // Connect rooms in a chain, then close the loop for extra routes.
  for (let i = 0; i < rooms.length; i++) {
    const a = rooms[i]
    const b = rooms[(i + 1) % rooms.length]
    carveCorridor(cells, rng, roomCenter(a), roomCenter(b))
  }

  // Carve to the four shared edge gateways so neighbors always connect.
  const west = gatewayOffset(seed, cx, cz, true)
  const east = gatewayOffset(seed, cx + 1, cz, true)
  const north = gatewayOffset(seed, cx, cz, false)
  const south = gatewayOffset(seed, cx, cz + 1, false)
  carveCorridor(cells, rng, { lx: 0, lz: west }, roomCenter(nearestRoom(rooms, 0, west)))
  carveCorridor(cells, rng, { lx: CHUNK_SIZE - 1, lz: east }, roomCenter(nearestRoom(rooms, CHUNK_SIZE - 1, east)))
  carveCorridor(cells, rng, { lx: north, lz: 0 }, roomCenter(nearestRoom(rooms, north, 0)))
  carveCorridor(cells, rng, { lx: south, lz: CHUNK_SIZE - 1 }, roomCenter(nearestRoom(rooms, south, CHUNK_SIZE - 1)))

  // Vault room: a locked bonus room with treasure. Its key spawns in another
  // room of the same chunk.
  let vaultRoom: Room | null = null
  if (!isOrigin && rooms.length >= 3 && rng() < 0.35) {
    vaultRoom = rooms.reduce((smallest, room) => (room.w * room.h < smallest.w * smallest.h ? room : smallest))
  }

  const doors: DoorSpawn[] = []
  placeDoors(cells, rng, doors, cx, cz, vaultRoom)

  const enemies: EnemySpawn[] = []
  const pickups: PickupSpawn[] = []
  const crates: { gx: number; gz: number }[] = []
  populate(rng, rooms, ring, isOrigin, cx, cz, cells, enemies, pickups, crates, vaultRoom)

  return { cx, cz, ring, cells, doors, enemies, pickups, crates }
}

export function cellAtLocal(chunk: Chunk, lx: number, lz: number): number {
  if (lx < 0 || lz < 0 || lx >= CHUNK_SIZE || lz >= CHUNK_SIZE) {
    return CELL_SOLID
  }
  return chunk.cells[localIndex(lx, lz)]
}

// Lookup across chunk boundaries via a chunk provider. The provider is
// expected to generate chunks on demand.
export function cellAtGlobal(getChunk: (cx: number, cz: number) => Chunk, gx: number, gz: number): number {
  const cx = cellToChunk(gx)
  const cz = cellToChunk(gz)
  const chunk = getChunk(cx, cz)
  return cellAtLocal(chunk, gx - cx * CHUNK_SIZE, gz - cz * CHUNK_SIZE)
}

function rectsTouch(a: Room, b: Room): boolean {
  return a.x - 1 < b.x + b.w + 1 && a.x + a.w + 1 > b.x - 1 && a.z - 1 < b.z + b.h + 1 && a.z + a.h + 1 > b.z - 1
}

function roomCenter(room: Room): { lx: number; lz: number } {
  return { lx: Math.floor(room.x + room.w / 2), lz: Math.floor(room.z + room.h / 2) }
}

function nearestRoom(rooms: Room[], lx: number, lz: number): Room {
  let best = rooms[0]
  let bestDist = Infinity
  for (const room of rooms) {
    const c = roomCenter(room)
    const d = Math.abs(c.lx - lx) + Math.abs(c.lz - lz)
    if (d < bestDist) {
      bestDist = d
      best = room
    }
  }
  return best
}

function carveRect(cells: Uint8Array, x: number, z: number, w: number, h: number) {
  for (let dz = 0; dz < h; dz++) {
    for (let dx = 0; dx < w; dx++) {
      cells[localIndex(x + dx, z + dz)] = CELL_FLOOR
    }
  }
}

function carveCell(cells: Uint8Array, lx: number, lz: number) {
  if (lx >= 0 && lz >= 0 && lx < CHUNK_SIZE && lz < CHUNK_SIZE) {
    cells[localIndex(lx, lz)] = CELL_FLOOR
  }
}

// L-shaped corridor, horizontal-first or vertical-first at random.
function carveCorridor(
  cells: Uint8Array,
  rng: Rng,
  from: { lx: number; lz: number },
  to: { lx: number; lz: number }
) {
  const horizontalFirst = rng() < 0.5
  if (horizontalFirst) {
    carveLineX(cells, from.lx, to.lx, from.lz)
    carveLineZ(cells, from.lz, to.lz, to.lx)
  } else {
    carveLineZ(cells, from.lz, to.lz, from.lx)
    carveLineX(cells, from.lx, to.lx, to.lz)
  }
}

function carveLineX(cells: Uint8Array, x0: number, x1: number, z: number) {
  const [a, b] = x0 < x1 ? [x0, x1] : [x1, x0]
  for (let x = a; x <= b; x++) {
    carveCell(cells, x, z)
  }
}

function carveLineZ(cells: Uint8Array, z0: number, z1: number, x: number) {
  const [a, b] = z0 < z1 ? [z0, z1] : [z1, z0]
  for (let z = a; z <= b; z++) {
    carveCell(cells, x, z)
  }
}

function isRoomEdgeCell(room: Room, lx: number, lz: number): boolean {
  const onRing =
    lx >= room.x - 1 && lx <= room.x + room.w && lz >= room.z - 1 && lz <= room.z + room.h
  const inside = lx >= room.x && lx < room.x + room.w && lz >= room.z && lz < room.z + room.h
  return onRing && !inside
}

function placeDoors(
  cells: Uint8Array,
  rng: Rng,
  doors: DoorSpawn[],
  cx: number,
  cz: number,
  vaultRoom: Room | null
) {
  for (let lz = 1; lz < CHUNK_SIZE - 1; lz++) {
    for (let lx = 1; lx < CHUNK_SIZE - 1; lx++) {
      if (cells[localIndex(lx, lz)] !== CELL_FLOOR) {
        continue
      }
      const solidNS =
        cells[localIndex(lx, lz - 1)] === CELL_SOLID && cells[localIndex(lx, lz + 1)] === CELL_SOLID
      const solidEW =
        cells[localIndex(lx - 1, lz)] === CELL_SOLID && cells[localIndex(lx + 1, lz)] === CELL_SOLID
      const floorEW =
        cells[localIndex(lx - 1, lz)] === CELL_FLOOR && cells[localIndex(lx + 1, lz)] === CELL_FLOOR
      const floorNS =
        cells[localIndex(lx, lz - 1)] === CELL_FLOOR && cells[localIndex(lx, lz + 1)] === CELL_FLOOR

      let axis: 'x' | 'z' | null = null
      if (solidNS && floorEW) {
        axis = 'x'
      } else if (solidEW && floorNS) {
        axis = 'z'
      }
      const isVaultEntrance = vaultRoom !== null && isRoomEdgeCell(vaultRoom, lx, lz)
      if (isVaultEntrance && !axis) {
        // Corridors may have widened the vault opening past the narrow
        // pinch shape; seal it anyway so no vault is ever left open.
        axis = solidNS || floorEW ? 'x' : 'z'
      }
      if (!axis) {
        continue
      }
      if (!isVaultEntrance && (doors.length >= 5 || rng() >= 0.35)) {
        continue
      }
      const gx = cx * CHUNK_SIZE + lx
      const gz = cz * CHUNK_SIZE + lz
      const tooClose = doors.some((d) => Math.abs(d.gx - gx) + Math.abs(d.gz - gz) < 3)
      if (tooClose && !isVaultEntrance) {
        continue
      }
      cells[localIndex(lx, lz)] = isVaultEntrance ? CELL_VAULT_DOOR : CELL_DOOR
      doors.push({ gx, gz, axis, locked: isVaultEntrance })
    }
  }
}

// Enemy mix shifts with the ring (Chebyshev distance from the office chunk).
export function enemyWeightsForRing(ring: number): Array<{ kind: EnemyKind; weight: number }> {
  return [
    { kind: 'skeleton', weight: 10 },
    { kind: 'guard', weight: ring >= 1 ? 6 : 0 },
    { kind: 'wizard', weight: ring >= 1 ? 4 + ring : 0 },
    { kind: 'knight', weight: ring >= 2 ? 3 + ring : 0 },
    { kind: 'golem', weight: ring >= 3 ? 1 + Math.floor(ring / 2) : 0 }
  ]
}

function pickEnemyKind(rng: Rng, ring: number): EnemyKind {
  const weights = enemyWeightsForRing(ring)
  const total = weights.reduce((sum, w) => sum + w.weight, 0)
  let roll = rng() * total
  for (const { kind, weight } of weights) {
    roll -= weight
    if (roll <= 0 && weight > 0) {
      return kind
    }
  }
  return 'skeleton'
}

function populate(
  rng: Rng,
  rooms: Room[],
  ring: number,
  isOrigin: boolean,
  cx: number,
  cz: number,
  cells: Uint8Array,
  enemies: EnemySpawn[],
  pickups: PickupSpawn[],
  crates: { gx: number; gz: number }[],
  vaultRoom: Room | null
) {
  const office = isOrigin ? rooms[0] : null
  const taken = new Set<number>()

  const spot = (room: Room): { lx: number; lz: number } | null => {
    for (let i = 0; i < 12; i++) {
      const lx = rngInt(rng, room.x, room.x + room.w - 1)
      const lz = rngInt(rng, room.z, room.z + room.h - 1)
      const idx = localIndex(lx, lz)
      if (cells[idx] === CELL_FLOOR && !taken.has(idx)) {
        taken.add(idx)
        return { lx, lz }
      }
    }
    return null
  }

  const global = (p: { lx: number; lz: number }) => ({ gx: cx * CHUNK_SIZE + p.lx, gz: cz * CHUNK_SIZE + p.lz })

  for (const room of rooms) {
    if (room === office) {
      continue
    }
    const area = room.w * room.h

    if (room === vaultRoom) {
      // Treasure hoard behind the locked door.
      for (let i = 0; i < 4; i++) {
        const p = spot(room)
        if (p) {
          pickups.push({ ...global(p), kind: 'studPile' })
        }
      }
      const bonus = spot(room)
      if (bonus) {
        pickups.push({ ...global(bonus), kind: rng() < 0.5 ? 'heavyArmor' : 'heartBig' })
      }
      const ammo = spot(room)
      if (ammo) {
        pickups.push({ ...global(ammo), kind: rng() < 0.5 ? 'tnt' : 'cells' })
      }
      continue
    }

    const baseCount = isOrigin ? 1 : Math.min(8, 2 + Math.floor(ring / 2) + Math.floor(area / 24))
    const count = rngInt(rng, Math.max(1, baseCount - 1), baseCount + 1)
    for (let i = 0; i < count; i++) {
      const p = spot(room)
      if (p) {
        enemies.push({ ...global(p), kind: pickEnemyKind(rng, ring) })
      }
    }

    if (rng() < 0.5) {
      const p = spot(room)
      if (p) {
        pickups.push({ ...global(p), kind: rng() < 0.7 ? 'heartSmall' : 'heartBig' })
      }
    }
    if (rng() < 0.6) {
      const p = spot(room)
      if (p) {
        const roll = rng()
        pickups.push({
          ...global(p),
          kind: roll < 0.45 ? 'bullets' : roll < 0.75 ? 'shells' : roll < 0.9 ? 'tnt' : 'cells'
        })
      }
    }
    if (rng() < 0.35) {
      const p = spot(room)
      if (p) {
        pickups.push({ ...global(p), kind: 'stud' })
      }
    }
    if (rng() < 0.12) {
      const p = spot(room)
      if (p) {
        pickups.push({ ...global(p), kind: 'vest' })
      }
    }
    if (rng() < 0.4) {
      const p = spot(room)
      if (p) {
        crates.push(global(p))
      }
    }
  }

  if (vaultRoom) {
    const keyRooms = rooms.filter((r) => r !== vaultRoom && r !== office)
    if (keyRooms.length > 0) {
      const room = keyRooms[rngInt(rng, 0, keyRooms.length - 1)]
      const p = spot(room)
      if (p) {
        pickups.push({ ...global(p), kind: 'vaultKey' })
      }
    }
  }

  if (office) {
    // A little starting ammo outside the workshop door.
    pickups.push({ gx: cx * CHUNK_SIZE + office.x + 1, gz: cz * CHUNK_SIZE + office.z + 1, kind: 'bullets' })
  }
}
