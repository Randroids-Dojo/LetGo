// Damage application rules, straight from Doom: armor soaks a fraction of
// incoming damage (1/3 for the vest, 1/2 for the heavy armor) and is
// consumed by the amount it absorbed.

export type ArmorClass = 'none' | 'vest' | 'heavy'

export type PlayerVitals = {
  hp: number
  maxHp: number
  armor: number
  armorClass: ArmorClass
}

export function absorbFraction(armorClass: ArmorClass): number {
  if (armorClass === 'heavy') {
    return 1 / 2
  }
  if (armorClass === 'vest') {
    return 1 / 3
  }
  return 0
}

export function applyPlayerDamage(vitals: PlayerVitals, damage: number): PlayerVitals {
  let absorbed = Math.floor(damage * absorbFraction(vitals.armorClass))
  absorbed = Math.min(absorbed, vitals.armor)
  const armor = vitals.armor - absorbed
  const hp = Math.max(0, vitals.hp - (damage - absorbed))
  return {
    hp,
    maxHp: vitals.maxHp,
    armor,
    armorClass: armor <= 0 ? 'none' : vitals.armorClass
  }
}

// Explosion falloff: Doom radius damage loses 1 point per map unit from the
// blast center. Scaled to meters (32 mu per m).
export function splashDamage(maxDamage: number, radiusM: number, distanceM: number): number {
  if (distanceM >= radiusM) {
    return 0
  }
  return Math.max(0, Math.round(maxDamage * (1 - distanceM / radiusM)))
}
