import { describe, expect, it } from 'vitest'
import { createProjectile, resolveSplash, tickProjectile } from './projectiles'

const wallAtX10: (gx: number, gz: number) => boolean = (gx) => gx >= 5

describe('tickProjectile', () => {
  it('flies until it hits a wall', () => {
    const p = createProjectile('ray', { x: 0, z: 1 }, Math.PI / 2, 27.3, 0.25, 20, true)
    let hit = null
    for (let i = 0; i < 60 && !hit; i++) {
      hit = tickProjectile(p, 0.016, wallAtX10, [])
    }
    expect(hit).toEqual({ type: 'wall', pos: expect.anything() })
    expect(p.pos.x).toBeGreaterThanOrEqual(10)
  })

  it('hits a target in its path', () => {
    const p = createProjectile('bolt', { x: 0, z: 1 }, Math.PI / 2, 10.9, 0.2, 12, false, 3)
    let hit = null
    for (let i = 0; i < 60 && !hit; i++) {
      hit = tickProjectile(p, 0.016, () => false, [{ id: 9, pos: { x: 4, z: 1 }, radiusM: 0.5 }])
    }
    expect(hit).toMatchObject({ type: 'target', targetId: 9 })
  })

  it('expires after its lifetime', () => {
    const p = createProjectile('ray', { x: 0, z: 0 }, 0, 0.01, 0.2, 5, true)
    let hit = null
    for (let i = 0; i < 200 && !hit; i++) {
      hit = tickProjectile(p, 0.1, () => false, [])
    }
    expect(hit).toEqual({ type: 'expired' })
  })
})

describe('resolveSplash', () => {
  it('damages targets by distance and skips ones out of range', () => {
    const results = resolveSplash<number | 'player'>({ x: 0, z: 0 }, { maxDamage: 128, radiusM: 4 }, [
      { id: 1, pos: { x: 0, z: 0 } },
      { id: 2, pos: { x: 0, z: 2 } },
      { id: 'player', pos: { x: 0, z: 10 } }
    ])
    expect(results).toEqual([
      { targetId: 1, damage: 128 },
      { targetId: 2, damage: 64 }
    ])
  })
})
