import { describe, expect, it } from 'vitest'
import {
  beginRun,
  BOARD_NODES,
  createMetaState,
  deriveRunConfig,
  endRun,
  keepFraction,
  laborCost,
  metaSchema,
  nodeCost,
  purchaseNode,
  purchaseRelic,
  purchaseWeapon,
  purchaseWeaponTier,
  visibleNodes
} from './meta'

describe('case board', () => {
  it('reveals only neighbors of purchased nodes', () => {
    const meta = createMetaState()
    const visible = visibleNodes(meta)
    expect(visible.has('office')).toBe(true)
    expect(visible.has('snacks')).toBe(true)
    expect(visible.has('boxing')).toBe(true)
    // Two steps out: hidden until something adjacent is bought.
    expect(visible.has('safe')).toBe(false)
    expect(visible.has('gunlocker')).toBe(false)
  })

  it('purchases ranks with escalating cost', () => {
    let meta = { ...createMetaState(), studs: 10_000 }
    const first = nodeCost(meta, 'snacks')
    meta = purchaseNode(meta, 'snacks') as typeof meta
    expect(meta).not.toBeNull()
    const second = nodeCost(meta, 'snacks')
    expect(second).toBeGreaterThan(first as number)
  })

  it('refuses hidden or unaffordable nodes', () => {
    const meta = { ...createMetaState(), studs: 10_000 }
    expect(purchaseNode(meta, 'safe')).toBeNull()
    expect(purchaseNode({ ...meta, studs: 1 }, 'snacks')).toBeNull()
  })

  it('applies labor cost inflation after 30 total ranks', () => {
    let meta = { ...createMetaState(), studs: 1_000_000 }
    expect(laborCost(meta)).toBe(0)
    // Buy 31 ranks (office already counts as 1).
    const buyable = ['snacks', 'boxing', 'streetsmarts', 'jog']
    let bought = 0
    while (bought < 30) {
      let progress = false
      for (const id of buyable) {
        const next = purchaseNode(meta, id)
        if (next) {
          meta = next
          bought++
          progress = true
          if (bought >= 30) {
            break
          }
        }
      }
      if (!progress) {
        break
      }
    }
    expect(laborCost(meta)).toBeGreaterThan(0)
  })
})

describe('armory', () => {
  it('requires the gun locker node', () => {
    const meta = { ...createMetaState(), studs: 10_000 }
    expect(purchaseWeapon(meta, 'scatter')).toBeNull()
  })

  it('unlocks weapons and sells tiers', () => {
    let meta = { ...createMetaState(), studs: 10_000 }
    meta = purchaseNode(meta, 'boxing') as typeof meta
    meta = purchaseNode(meta, 'gunlocker') as typeof meta
    meta = purchaseWeapon(meta, 'scatter') as typeof meta
    expect(meta.weaponsUnlocked).toContain('scatter')
    meta = purchaseWeaponTier(meta, 'scatter') as typeof meta
    expect(meta.weaponTiers.scatter).toBe(1)
    // Double-buy is rejected.
    expect(purchaseWeapon(meta, 'scatter')).toBeNull()
  })
})

describe('relics and the rent', () => {
  function metaWithFence(): ReturnType<typeof createMetaState> {
    let meta = { ...createMetaState(), studs: 50_000 }
    meta = purchaseNode(meta, 'streetsmarts') as typeof meta
    meta = purchaseNode(meta, 'fence') as typeof meta
    return meta
  }

  it('requires the fence and dedupes relics', () => {
    const noFence = { ...createMetaState(), studs: 10_000 }
    expect(purchaseRelic(noFence, 'espresso')).toBeNull()
    let meta = metaWithFence()
    meta = purchaseRelic(meta, 'espresso') as typeof meta
    expect(meta.relics).toContain('espresso')
    expect(purchaseRelic(meta, 'espresso')).toBeNull()
  })

  it('relics apply to the run config and are consumed by beginRun', () => {
    let meta = metaWithFence()
    meta = purchaseRelic(meta, 'espresso') as typeof meta
    meta = purchaseRelic(meta, 'umbrella') as typeof meta
    const config = deriveRunConfig(meta)
    expect(config.speedMult).toBeGreaterThan(1.2)
    expect(config.startArmorClass).toBe('heavy')
    meta = beginRun(meta)
    expect(meta.relics).toEqual([])
  })

  it('the rent takes everything without a floor safe', () => {
    const meta = { ...createMetaState(), studs: 500 }
    expect(keepFraction(meta)).toBe(0)
    const after = beginRun(meta)
    expect(after.studs).toBe(0)
    expect(after.rentPaid).toBe(500)
  })

  it('floor safe ranks bank a percentage', () => {
    let meta = { ...createMetaState(), studs: 100_000 }
    meta = purchaseNode(meta, 'snacks') as typeof meta
    meta = purchaseNode(meta, 'safe') as typeof meta
    expect(keepFraction(meta)).toBeCloseTo(0.1)
    const before = meta.studs
    const after = beginRun(meta)
    expect(after.studs).toBe(Math.floor(before * 0.1))
  })
})

describe('run lifecycle', () => {
  it('endRun accumulates studs, kills, and best ring', () => {
    const meta = endRun(createMetaState(), { studsEarned: 340, kills: 12, ring: 3 })
    expect(meta.studs).toBe(340)
    expect(meta.totalKills).toBe(12)
    expect(meta.bestRing).toBe(3)
    expect(meta.totalDeaths).toBe(1)
    expect(endRun(meta, { studsEarned: 0, kills: 0, ring: 1 }).bestRing).toBe(3)
  })

  it('derived config reflects stat nodes', () => {
    let meta = { ...createMetaState(), studs: 10_000 }
    meta = purchaseNode(meta, 'snacks') as typeof meta
    const config = deriveRunConfig(meta)
    expect(config.maxHp).toBe(110)
    expect(config.startHp).toBe(110)
  })

  it('meta state round-trips through the schema', () => {
    const meta = createMetaState()
    expect(metaSchema.parse(JSON.parse(JSON.stringify(meta)))).toEqual(meta)
  })

  it('board layout has no overlapping nodes', () => {
    const seen = new Set<string>()
    for (const node of BOARD_NODES) {
      const key = `${node.x},${node.y}`
      expect(seen.has(key)).toBe(false)
      seen.add(key)
    }
  })
})
