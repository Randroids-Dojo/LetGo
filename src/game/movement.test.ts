import { describe, expect, it } from 'vitest'
import { applyFriction, applyThrust, applyThrustAxes, type MoveInput } from './movement'

const FORWARD: MoveInput = { forward: true, backward: false, left: false, right: false }
const DIAGONAL: MoveInput = { forward: true, backward: false, left: false, right: true }
const NONE: MoveInput = { forward: false, backward: false, left: false, right: false }

function simulate(input: MoveInput, seconds: number): { x: number; z: number } {
  let momentum = { x: 0, z: 0 }
  const dt = 1 / 60
  for (let t = 0; t < seconds; t += dt) {
    momentum = applyThrust(momentum, 0, input, dt, 1)
    momentum = applyFriction(momentum, dt)
  }
  return momentum
}

describe('doom movement model', () => {
  it('accelerates to a stable top speed', () => {
    const early = Math.hypot(simulate(FORWARD, 0.2).x, simulate(FORWARD, 0.2).z)
    const late = Math.hypot(simulate(FORWARD, 2).x, simulate(FORWARD, 2).z)
    const later = Math.hypot(simulate(FORWARD, 4).x, simulate(FORWARD, 4).z)
    expect(early).toBeLessThan(late)
    expect(late).toBeCloseTo(later, 0)
    // Doom-fast: scaled run speed lands around 11 m/s.
    expect(late).toBeGreaterThan(9)
    expect(late).toBeLessThan(13)
  })

  it('keeps the doom quirk: diagonal is faster than forward', () => {
    const forward = Math.hypot(simulate(FORWARD, 2).x, simulate(FORWARD, 2).z)
    const diagonal = Math.hypot(simulate(DIAGONAL, 2).x, simulate(DIAGONAL, 2).z)
    expect(diagonal).toBeGreaterThan(forward * 1.1)
  })

  it('friction brings the player to a full stop', () => {
    let momentum = simulate(FORWARD, 2)
    const dt = 1 / 60
    for (let t = 0; t < 2; t += dt) {
      momentum = applyFriction(momentum, dt)
    }
    expect(momentum.x).toBe(0)
    expect(momentum.z).toBe(0)
  })

  it('no input means no movement', () => {
    const momentum = simulate(NONE, 1)
    expect(momentum.x).toBe(0)
    expect(momentum.z).toBe(0)
  })
})

describe('analog thrust axes', () => {
  function simulateAxes(forwardAxis: number, strafeAxis: number, seconds: number) {
    let momentum = { x: 0, z: 0 }
    const dt = 1 / 60
    for (let t = 0; t < seconds; t += dt) {
      momentum = applyThrustAxes(momentum, 0, forwardAxis, strafeAxis, dt, 1)
      momentum = applyFriction(momentum, dt)
    }
    return momentum
  }

  it('matches the boolean path at full deflection', () => {
    const viaInput = simulate(FORWARD, 2)
    const viaAxes = simulateAxes(1, 0, 2)
    expect(viaAxes.x).toBeCloseTo(viaInput.x)
    expect(viaAxes.z).toBeCloseTo(viaInput.z)
  })

  it('half deflection settles at roughly half speed', () => {
    const full = Math.hypot(simulateAxes(1, 0, 3).x, simulateAxes(1, 0, 3).z)
    const half = Math.hypot(simulateAxes(0.5, 0, 3).x, simulateAxes(0.5, 0, 3).z)
    expect(half).toBeGreaterThan(full * 0.4)
    expect(half).toBeLessThan(full * 0.6)
  })

  // Direction regression: the camera faces yaw + PI, so at yaw 0 forward
  // is +z and the player's right is -x. Guards against strafe (and
  // forward) being wired backwards.
  it('moves forward along +z at yaw 0', () => {
    const fwd = simulateAxes(1, 0, 0.5)
    expect(fwd.z).toBeGreaterThan(0)
    expect(Math.abs(fwd.x)).toBeLessThan(1e-9)
  })

  it('strafes right toward -x at yaw 0', () => {
    const right = simulateAxes(0, 1, 0.5)
    expect(right.x).toBeLessThan(0)
    expect(Math.abs(right.z)).toBeLessThan(1e-9)
  })
})
