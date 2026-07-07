import { describe, expect, it } from 'vitest'
import {
  CELL_DOOR,
  CELL_FLOOR,
  CELL_SOLID,
  CELL_VAULT_DOOR,
  CHUNK_SIZE,
  cellAtLocal,
  enemyWeightsForRing,
  gatewayOffset,
  generateChunk
} from './dungeon'

const SEED = 424242

describe('generateChunk', () => {
  it('is deterministic', () => {
    const a = generateChunk(SEED, 3, -2)
    const b = generateChunk(SEED, 3, -2)
    expect(Array.from(a.cells)).toEqual(Array.from(b.cells))
    expect(a.enemies).toEqual(b.enemies)
    expect(a.pickups).toEqual(b.pickups)
  })

  it('always carves the office room at the origin', () => {
    const chunk = generateChunk(SEED, 0, 0)
    // Office room is the fixed 8x8 at (8,8).
    for (let z = 8; z < 16; z++) {
      for (let x = 8; x < 16; x++) {
        expect(cellAtLocal(chunk, x, z)).toBe(CELL_FLOOR)
      }
    }
    // No enemies inside the office room.
    for (const enemy of chunk.enemies) {
      const inOffice = enemy.gx >= 8 && enemy.gx < 16 && enemy.gz >= 8 && enemy.gz < 16
      expect(inOffice).toBe(false)
    }
  })

  it('carves matching gateway cells on both sides of a shared edge', () => {
    for (const [cx, cz] of [
      [0, 0],
      [4, -3],
      [-7, 2]
    ]) {
      const left = generateChunk(SEED, cx, cz)
      const right = generateChunk(SEED, cx + 1, cz)
      const gz = gatewayOffset(SEED, cx + 1, cz, true)
      expect(cellAtLocal(left, CHUNK_SIZE - 1, gz)).not.toBe(CELL_SOLID)
      expect(cellAtLocal(right, 0, gz)).not.toBe(CELL_SOLID)

      const top = generateChunk(SEED, cx, cz)
      const bottom = generateChunk(SEED, cx, cz + 1)
      const gx = gatewayOffset(SEED, cx, cz + 1, false)
      expect(cellAtLocal(top, gx, CHUNK_SIZE - 1)).not.toBe(CELL_SOLID)
      expect(cellAtLocal(bottom, gx, 0)).not.toBe(CELL_SOLID)
    }
  })

  it('keeps every floor cell reachable from the west gateway', () => {
    // Flood fill from the west gateway; every non-solid cell must be reached.
    // This guards against isolated rooms.
    for (const [cx, cz] of [
      [0, 0],
      [2, 5],
      [-4, -4]
    ]) {
      const chunk = generateChunk(SEED, cx, cz)
      const start = gatewayOffset(SEED, cx, cz, true)
      const visited = new Set<number>()
      const queue = [start * CHUNK_SIZE + 0]
      visited.add(queue[0])
      while (queue.length > 0) {
        const idx = queue.pop() as number
        const lx = idx % CHUNK_SIZE
        const lz = Math.floor(idx / CHUNK_SIZE)
        for (const [dx, dz] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1]
        ]) {
          const nx = lx + dx
          const nz = lz + dz
          if (nx < 0 || nz < 0 || nx >= CHUNK_SIZE || nz >= CHUNK_SIZE) {
            continue
          }
          const nIdx = nz * CHUNK_SIZE + nx
          if (visited.has(nIdx) || chunk.cells[nIdx] === CELL_SOLID) {
            continue
          }
          visited.add(nIdx)
          queue.push(nIdx)
        }
      }
      for (let idx = 0; idx < chunk.cells.length; idx++) {
        if (chunk.cells[idx] !== CELL_SOLID) {
          expect(visited.has(idx)).toBe(true)
        }
      }
    }
  })

  it('pairs every vault with a key in the same chunk', () => {
    let vaultsSeen = 0
    for (let cx = -6; cx <= 6 && vaultsSeen < 4; cx++) {
      for (let cz = -6; cz <= 6 && vaultsSeen < 4; cz++) {
        const chunk = generateChunk(SEED, cx, cz)
        const hasVaultDoor = chunk.doors.some((d) => d.locked)
        if (!hasVaultDoor) {
          continue
        }
        vaultsSeen++
        expect(chunk.pickups.some((p) => p.kind === 'vaultKey')).toBe(true)
        expect(chunk.cells.some((c) => c === CELL_VAULT_DOOR)).toBe(true)
      }
    }
    expect(vaultsSeen).toBeGreaterThan(0)
  })

  it('seals every vault: no plain floor cell touches the treasure', () => {
    // Every floor cell adjacent to a vault-key treasure room must pass
    // through a locked door, even where corridors widened the opening.
    // Approximate by checking each vault door chunk: every neighbor of a
    // vault door cell that lies outside its room is either solid, floor,
    // or another vault door, and vault treasure (coin piles) is never
    // reachable without crossing a CELL_VAULT_DOOR. Flood fill from the
    // west gateway treating vault doors as walls; coin piles inside vaults
    // must be unreached.
    let vaultsChecked = 0
    for (let cx = -8; cx <= 8 && vaultsChecked < 6; cx++) {
      for (let cz = -8; cz <= 8 && vaultsChecked < 6; cz++) {
        const chunk = generateChunk(SEED, cx, cz)
        if (!chunk.doors.some((d) => d.locked)) {
          continue
        }
        vaultsChecked++
        const start = gatewayOffset(SEED, cx, cz, true)
        const visited = new Set<number>()
        const queue = [start * CHUNK_SIZE + 0]
        visited.add(queue[0])
        while (queue.length > 0) {
          const idx = queue.pop() as number
          const lx = idx % CHUNK_SIZE
          const lz = Math.floor(idx / CHUNK_SIZE)
          for (const [dx, dz] of [
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1]
          ]) {
            const nx = lx + dx
            const nz = lz + dz
            if (nx < 0 || nz < 0 || nx >= CHUNK_SIZE || nz >= CHUNK_SIZE) {
              continue
            }
            const nIdx = nz * CHUNK_SIZE + nx
            const cell = chunk.cells[nIdx]
            if (visited.has(nIdx) || cell === CELL_SOLID || cell === CELL_VAULT_DOOR) {
              continue
            }
            visited.add(nIdx)
            queue.push(nIdx)
          }
        }
        for (const pickup of chunk.pickups) {
          if (pickup.kind !== 'studPile') {
            continue
          }
          const lx = pickup.gx - cx * CHUNK_SIZE
          const lz = pickup.gz - cz * CHUNK_SIZE
          expect(visited.has(lz * CHUNK_SIZE + lx)).toBe(false)
        }
      }
    }
    expect(vaultsChecked).toBeGreaterThan(0)
  })

  it('registers a door entity for every door cell', () => {
    for (let cx = -3; cx <= 3; cx++) {
      const chunk = generateChunk(SEED, cx, 1)
      let doorCells = 0
      for (const cell of chunk.cells) {
        if (cell === CELL_DOOR || cell === CELL_VAULT_DOOR) {
          doorCells++
        }
      }
      expect(chunk.doors.length).toBe(doorCells)
    }
  })

  it('gates tough enemies behind deeper rings', () => {
    const ring0 = enemyWeightsForRing(0)
    expect(ring0.find((w) => w.kind === 'knight')?.weight).toBe(0)
    expect(ring0.find((w) => w.kind === 'golem')?.weight).toBe(0)
    const ring4 = enemyWeightsForRing(4)
    expect(ring4.find((w) => w.kind === 'golem')?.weight).toBeGreaterThan(0)
  })

  it('spawns more dangerous mixes deeper out', () => {
    const near = generateChunk(SEED, 1, 0)
    const far = generateChunk(SEED, 9, 9)
    expect(near.enemies.every((e) => e.kind !== 'golem')).toBe(true)
    expect(far.ring).toBe(9)
  })
})
