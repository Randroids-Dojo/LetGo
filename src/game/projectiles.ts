// Shared projectile simulation for player rockets/rays and enemy shots.
// Toy-box rule: projectiles are always visible flying bricks and bolts.

import type { SolidAt } from './collision'
import { splashDamage } from './combat'
import { worldToCell } from './dungeon'
import { dist, type Vec2 } from './types'

export type ProjectileKind = 'tnt' | 'ray' | 'megabrick' | 'bolt' | 'fireball'

export type Projectile = {
  id: number
  kind: ProjectileKind
  pos: Vec2
  angle: number
  speedM: number
  radiusM: number
  damage: number
  splash?: { maxDamage: number; radiusM: number }
  fromPlayer: boolean
  // Enemy that fired it, for infighting attribution.
  shooterId: number | null
  ageSec: number
}

let nextProjectileId = 1

export function createProjectile(
  kind: ProjectileKind,
  pos: Vec2,
  angle: number,
  speedM: number,
  radiusM: number,
  damage: number,
  fromPlayer: boolean,
  shooterId: number | null = null,
  splash?: { maxDamage: number; radiusM: number }
): Projectile {
  return { id: nextProjectileId++, kind, pos: { ...pos }, angle, speedM, radiusM, damage, splash, fromPlayer, shooterId, ageSec: 0 }
}

// Targets carry an opaque id chosen by the caller (a number, or a typed
// ref); it is echoed back untouched in the hit result.
export type ProjectileTarget<TId> = { id: TId; pos: Vec2; radiusM: number }

export type ProjectileHit<TId> =
  | { type: 'wall'; pos: Vec2 }
  | { type: 'target'; targetId: TId; pos: Vec2 }
  | { type: 'expired' }

// Advance one projectile. Returns a hit description or null while in flight.
export function tickProjectile<TId>(
  projectile: Projectile,
  dt: number,
  solidAt: SolidAt,
  targets: ProjectileTarget<TId>[]
): ProjectileHit<TId> | null {
  projectile.ageSec += dt
  if (projectile.ageSec > 8) {
    return { type: 'expired' }
  }

  const distance = projectile.speedM * dt
  const steps = Math.max(1, Math.ceil(distance / 0.5))
  const stepX = (Math.sin(projectile.angle) * distance) / steps
  const stepZ = (Math.cos(projectile.angle) * distance) / steps

  for (let i = 0; i < steps; i++) {
    projectile.pos.x += stepX
    projectile.pos.z += stepZ

    if (solidAt(worldToCell(projectile.pos.x), worldToCell(projectile.pos.z))) {
      return { type: 'wall', pos: { ...projectile.pos } }
    }
    for (const target of targets) {
      if (dist(projectile.pos, target.pos) < projectile.radiusM + target.radiusM) {
        return { type: 'target', targetId: target.id, pos: { ...projectile.pos } }
      }
    }
  }
  return null
}

export type SplashResult<TId> = { targetId: TId; damage: number }

export function resolveSplash<TId>(
  center: Vec2,
  splash: { maxDamage: number; radiusM: number },
  targets: Array<{ id: TId; pos: Vec2 }>
): SplashResult<TId>[] {
  const results: SplashResult<TId>[] = []
  for (const target of targets) {
    const damage = splashDamage(splash.maxDamage, splash.radiusM, dist(center, target.pos))
    if (damage > 0) {
      results.push({ targetId: target.id, damage })
    }
  }
  return results
}
