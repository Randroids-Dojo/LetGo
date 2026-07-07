import { describe, expect, it } from 'vitest'
import { applyPickup, type PickupPlayerState } from './pickups'
import { AMMO_MAX_BASE } from './weapons'

function state(overrides: Partial<PickupPlayerState> = {}): PickupPlayerState {
  return {
    vitals: { hp: 50, maxHp: 100, armor: 0, armorClass: 'none' },
    ammo: { bullets: 20, shells: 0, tnt: 0, cells: 0 },
    ammoMax: { ...AMMO_MAX_BASE },
    studs: 0,
    hasVaultKey: false,
    ...overrides
  }
}

describe('applyPickup', () => {
  it('heals capped at max hp', () => {
    const r = applyPickup('heartBig', state({ vitals: { hp: 90, maxHp: 100, armor: 0, armorClass: 'none' } }))
    expect(r.consumed).toBe(true)
    expect(r.state.vitals.hp).toBe(100)
  })

  it('leaves health items on the floor at full hp', () => {
    const r = applyPickup('heartSmall', state({ vitals: { hp: 100, maxHp: 100, armor: 0, armorClass: 'none' } }))
    expect(r.consumed).toBe(false)
  })

  it('vest sets 100 armor and refuses when already at 100+', () => {
    const first = applyPickup('vest', state())
    expect(first.state.vitals.armor).toBe(100)
    expect(first.state.vitals.armorClass).toBe('vest')
    const second = applyPickup('vest', first.state)
    expect(second.consumed).toBe(false)
  })

  it('heavy armor upgrades over a vest', () => {
    const withVest = applyPickup('vest', state()).state
    const r = applyPickup('heavyArmor', withVest)
    expect(r.state.vitals.armor).toBe(200)
    expect(r.state.vitals.armorClass).toBe('heavy')
  })

  it('caps ammo at the max', () => {
    const r = applyPickup('bullets', state({ ammo: { bullets: 190, shells: 0, tnt: 0, cells: 0 } }))
    expect(r.state.ammo.bullets).toBe(200)
  })

  it('coins scale with the studs multiplier', () => {
    const r = applyPickup('stud', state(), 1.5)
    expect(r.state.studs).toBe(15)
  })

  it('vault key is picked up once', () => {
    const first = applyPickup('vaultKey', state())
    expect(first.state.hasVaultKey).toBe(true)
    expect(applyPickup('vaultKey', first.state).consumed).toBe(false)
  })
})
