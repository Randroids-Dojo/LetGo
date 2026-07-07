import { describe, expect, it } from 'vitest'
import { attackChance, createEnemy, damageEnemy, tickEnemy, ENEMY_DEFS } from './enemies'
import { mulberry32 } from './rng'

describe('attackChance', () => {
  it('follows the doom gamble curve', () => {
    // Point blank: d clamps to 0, always willing.
    expect(attackChance(2, false)).toBe(1)
    // Long range floors at (256-200)/256.
    expect(attackChance(50, false)).toBeCloseTo(56 / 256)
    // Melee-capable monsters are more trigger happy at range.
    expect(attackChance(8, true)).toBeGreaterThan(attackChance(8, false))
  })
})

describe('tickEnemy', () => {
  it('wakes when it sees the target', () => {
    const enemy = createEnemy('skeleton', { x: 0, z: 0 })
    tickEnemy(enemy, { dt: 0.016, target: { x: 5, z: 0 }, canSeeTarget: true, rng: mulberry32(1) })
    expect(enemy.state).toBe('chase')
    expect(enemy.awake).toBe(true)
  })

  it('stays idle without line of sight', () => {
    const enemy = createEnemy('skeleton', { x: 0, z: 0 })
    tickEnemy(enemy, { dt: 0.016, target: { x: 5, z: 0 }, canSeeTarget: false, rng: mulberry32(1) })
    expect(enemy.state).toBe('idle')
  })

  it('winds up and fires a hitscan attack', () => {
    const enemy = createEnemy('skeleton', { x: 0, z: 0 })
    enemy.state = 'chase'
    enemy.awake = true
    enemy.attackCooldown = 0
    const rng = mulberry32(3)
    // Run enough frames for the gamble to land, then the windup to expire.
    let fired = false
    for (let i = 0; i < 600 && !fired; i++) {
      const events = tickEnemy(enemy, { dt: 0.05, target: { x: 3, z: 0 }, canSeeTarget: true, rng })
      fired = events.some((e) => e.type === 'hitscan')
    }
    expect(fired).toBe(true)
  })

  it('melees when in range', () => {
    const enemy = createEnemy('knight', { x: 0, z: 0 })
    enemy.state = 'chase'
    enemy.attackCooldown = 0
    const rng = mulberry32(4)
    let melee = false
    for (let i = 0; i < 100 && !melee; i++) {
      const events = tickEnemy(enemy, { dt: 0.05, target: { x: 1, z: 0 }, canSeeTarget: true, rng })
      melee = events.some((e) => e.type === 'meleeHit')
    }
    expect(melee).toBe(true)
  })

  it('finishes the death animation in the dead state', () => {
    const enemy = createEnemy('skeleton', { x: 0, z: 0 })
    damageEnemy(enemy, 999, mulberry32(5))
    expect(enemy.state).toBe('dying')
    tickEnemy(enemy, { dt: 1, target: { x: 5, z: 0 }, canSeeTarget: true, rng: mulberry32(6) })
    expect(enemy.state).toBe('dead')
  })
})

describe('damageEnemy', () => {
  it('kills at zero hp', () => {
    const enemy = createEnemy('skeleton', { x: 0, z: 0 })
    expect(damageEnemy(enemy, ENEMY_DEFS.skeleton.hp, mulberry32(1))).toBe('died')
  })

  it('records the attacker for infighting', () => {
    const enemy = createEnemy('guard', { x: 0, z: 0 })
    damageEnemy(enemy, 5, mulberry32(2), 77)
    expect(enemy.infightTargetId).toBe(77)
  })

  it('high pain chance enemies flinch often', () => {
    const rng = mulberry32(9)
    let flinches = 0
    for (let i = 0; i < 100; i++) {
      const enemy = createEnemy('skeleton', { x: 0, z: 0 })
      if (damageEnemy(enemy, 1, rng) === 'pain') {
        flinches++
      }
    }
    // painChance 200/255 ~ 78%.
    expect(flinches).toBeGreaterThan(60)
  })

  it('ignores damage to corpses', () => {
    const enemy = createEnemy('skeleton', { x: 0, z: 0 })
    damageEnemy(enemy, 999, mulberry32(1))
    expect(damageEnemy(enemy, 10, mulberry32(1))).toBe('ignored')
  })
})
