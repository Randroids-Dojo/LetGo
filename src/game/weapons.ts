// The arsenal. Numbers follow original Doom's weapon tables (damage dice,
// cycle times in 35-tic seconds, pellet counts, spread) with 32 map units
// to the meter, re-themed as a box of plastic brick weaponry.

export type WeaponId = 'claws' | 'studgun' | 'scatter' | 'gatling' | 'dynamite' | 'raygun' | 'megabrick'

export type AmmoType = 'none' | 'bullets' | 'shells' | 'tnt' | 'cells'

export type WeaponDef = {
  id: WeaponId
  name: string
  slot: number
  ammoType: AmmoType
  ammoPerShot: number
  // Seconds between shots (Doom tics / 35).
  cycleSec: number
  pellets: number
  // Damage dice per pellet/projectile: multiplier * (count d sides).
  dice: { count: number; sides: number; mult: number }
  // Horizontal spread half-angle in radians. Doom hitscan spread is ~5.6 deg.
  spreadRad: number
  // First shot of a burst is perfectly accurate (pistol/chaingun rule).
  accurateFirstShot: boolean
  auto: boolean
  melee?: { rangeM: number }
  projectile?: { speedM: number; radiusM: number; splash?: { maxDamage: number; radiusM: number } }
}

const SPREAD = 0.0977 // 5.6 degrees, Doom's hitscan spread half-angle

export const WEAPONS: Record<WeaponId, WeaponDef> = {
  claws: {
    id: 'claws',
    name: 'Bare Claws',
    slot: 1,
    ammoType: 'none',
    ammoPerShot: 0,
    cycleSec: 0.46,
    pellets: 1,
    dice: { count: 1, sides: 10, mult: 2 },
    spreadRad: 0,
    accurateFirstShot: true,
    auto: true,
    melee: { rangeM: 2 }
  },
  studgun: {
    id: 'studgun',
    name: 'Stud Shooter',
    slot: 2,
    ammoType: 'bullets',
    ammoPerShot: 1,
    cycleSec: 0.4,
    pellets: 1,
    dice: { count: 1, sides: 3, mult: 5 },
    spreadRad: SPREAD,
    accurateFirstShot: true,
    auto: true
  },
  scatter: {
    id: 'scatter',
    name: 'Scatter Blaster',
    slot: 3,
    ammoType: 'shells',
    ammoPerShot: 1,
    cycleSec: 1.06,
    pellets: 7,
    dice: { count: 1, sides: 3, mult: 5 },
    spreadRad: SPREAD,
    accurateFirstShot: false,
    auto: true
  },
  gatling: {
    id: 'gatling',
    name: 'Gatling Stud',
    slot: 4,
    ammoType: 'bullets',
    ammoPerShot: 1,
    cycleSec: 0.114,
    pellets: 1,
    dice: { count: 1, sides: 3, mult: 5 },
    spreadRad: SPREAD,
    accurateFirstShot: true,
    auto: true
  },
  dynamite: {
    id: 'dynamite',
    name: 'Dynamite',
    slot: 5,
    ammoType: 'tnt',
    ammoPerShot: 1,
    cycleSec: 0.57,
    pellets: 1,
    dice: { count: 1, sides: 8, mult: 20 },
    spreadRad: 0,
    accurateFirstShot: true,
    auto: false,
    projectile: { speedM: 21.9, radiusM: 0.3, splash: { maxDamage: 128, radiusM: 4 } }
  },
  raygun: {
    id: 'raygun',
    name: 'Ray Blaster',
    slot: 6,
    ammoType: 'cells',
    ammoPerShot: 1,
    cycleSec: 0.086,
    pellets: 1,
    dice: { count: 1, sides: 8, mult: 5 },
    spreadRad: 0,
    accurateFirstShot: true,
    auto: true,
    projectile: { speedM: 27.3, radiusM: 0.25 }
  },
  megabrick: {
    id: 'megabrick',
    name: 'Mega Brick',
    slot: 7,
    ammoType: 'cells',
    ammoPerShot: 40,
    cycleSec: 1.71,
    pellets: 1,
    dice: { count: 1, sides: 8, mult: 100 },
    spreadRad: 0,
    accurateFirstShot: true,
    auto: false,
    projectile: { speedM: 27.3, radiusM: 0.5, splash: { maxDamage: 300, radiusM: 6 } }
  }
}

export const WEAPON_ORDER: WeaponId[] = (Object.keys(WEAPONS) as WeaponId[]).sort(
  (a, b) => WEAPONS[a].slot - WEAPONS[b].slot
)

export type AmmoState = Record<Exclude<AmmoType, 'none'>, number>

export const AMMO_MAX_BASE: AmmoState = { bullets: 200, shells: 50, tnt: 50, cells: 300 }

export const AMMO_PICKUPS: Record<'bullets' | 'shells' | 'tnt' | 'cells', number> = {
  bullets: 50,
  shells: 8,
  tnt: 3,
  cells: 40
}

export function canFire(weapon: WeaponDef, ammo: AmmoState): boolean {
  if (weapon.ammoType === 'none') {
    return true
  }
  return ammo[weapon.ammoType] >= weapon.ammoPerShot
}

export function spendAmmo(weapon: WeaponDef, ammo: AmmoState): AmmoState {
  if (weapon.ammoType === 'none') {
    return ammo
  }
  return { ...ammo, [weapon.ammoType]: ammo[weapon.ammoType] - weapon.ammoPerShot }
}

// The best weapon that has ammo, used when the current gun runs dry.
// The Mega Brick is deliberately excluded: auto-switching into a 40-cell
// shot would waste the player's ultimate (Doom's auto-switch shuns the
// BFG for the same reason).
export function bestFallbackWeapon(owned: WeaponId[], ammo: AmmoState): WeaponId {
  const preference: WeaponId[] = ['gatling', 'scatter', 'raygun', 'studgun', 'dynamite', 'claws']
  for (const id of preference) {
    if (owned.includes(id) && canFire(WEAPONS[id], ammo)) {
      return id
    }
  }
  return 'claws'
}
