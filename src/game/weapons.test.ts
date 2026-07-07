import { describe, expect, it } from 'vitest'
import { AMMO_MAX_BASE, bestFallbackWeapon, canFire, spendAmmo, WEAPONS, WEAPON_ORDER } from './weapons'

describe('weapons table', () => {
  it('covers seven slots in order', () => {
    expect(WEAPON_ORDER.map((id) => WEAPONS[id].slot)).toEqual([1, 2, 3, 4, 5, 6, 7])
  })

  it('melee weapons never need ammo', () => {
    expect(canFire(WEAPONS.claws, { bullets: 0, shells: 0, tnt: 0, cells: 0 })).toBe(true)
  })

  it('guns need ammo and spend it', () => {
    const ammo = { ...AMMO_MAX_BASE, bullets: 1 }
    expect(canFire(WEAPONS.studgun, ammo)).toBe(true)
    const after = spendAmmo(WEAPONS.studgun, ammo)
    expect(after.bullets).toBe(0)
    expect(canFire(WEAPONS.studgun, after)).toBe(false)
  })

  it('mega brick drinks 40 cells per shot', () => {
    expect(canFire(WEAPONS.megabrick, { bullets: 0, shells: 0, tnt: 0, cells: 39 })).toBe(false)
    expect(canFire(WEAPONS.megabrick, { bullets: 0, shells: 0, tnt: 0, cells: 40 })).toBe(true)
  })

  it('falls back to the best owned weapon with ammo', () => {
    expect(bestFallbackWeapon(['claws', 'studgun', 'scatter'], { bullets: 0, shells: 5, tnt: 0, cells: 0 })).toBe(
      'scatter'
    )
    expect(bestFallbackWeapon(['claws', 'studgun'], { bullets: 0, shells: 0, tnt: 0, cells: 0 })).toBe('claws')
  })
})
