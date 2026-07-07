import { describe, expect, it } from 'vitest'
import { applyPlayerDamage, splashDamage, type PlayerVitals } from './combat'

function vitals(overrides: Partial<PlayerVitals> = {}): PlayerVitals {
  return { hp: 100, maxHp: 100, armor: 0, armorClass: 'none', ...overrides }
}

describe('applyPlayerDamage', () => {
  it('applies full damage with no armor', () => {
    const v = applyPlayerDamage(vitals(), 30)
    expect(v.hp).toBe(70)
  })

  it('vest absorbs a third, consuming armor points', () => {
    const v = applyPlayerDamage(vitals({ armor: 100, armorClass: 'vest' }), 30)
    expect(v.hp).toBe(80)
    expect(v.armor).toBe(90)
  })

  it('heavy armor absorbs half', () => {
    const v = applyPlayerDamage(vitals({ armor: 200, armorClass: 'heavy' }), 30)
    expect(v.hp).toBe(85)
    expect(v.armor).toBe(185)
  })

  it('never absorbs more than remaining armor and downgrades class at zero', () => {
    const v = applyPlayerDamage(vitals({ armor: 3, armorClass: 'heavy' }), 30)
    expect(v.armor).toBe(0)
    expect(v.hp).toBe(73)
    expect(v.armorClass).toBe('none')
  })

  it('clamps hp at zero', () => {
    const v = applyPlayerDamage(vitals({ hp: 5 }), 100)
    expect(v.hp).toBe(0)
  })
})

describe('splashDamage', () => {
  it('deals max damage at the center and zero at the edge', () => {
    expect(splashDamage(128, 4, 0)).toBe(128)
    expect(splashDamage(128, 4, 4)).toBe(0)
    expect(splashDamage(128, 4, 2)).toBe(64)
  })
})
