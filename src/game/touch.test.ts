import { describe, expect, it } from 'vitest'
import {
  ANALOG_DEADZONE,
  JOYSTICK_RADIUS,
  analogVectorFromStick,
  beginJoystick,
  createJoystick,
  isTapRelease,
  joystickMovedBeyond,
  lookVectorFromStick,
  moveJoystick,
  rebaseOriginIfPhantom,
  TAP_MAX_DRIFT_PX,
  TAP_MAX_MS
} from './touch'

function stickAt(dx: number, dy: number) {
  const stick = createJoystick()
  beginJoystick(stick, 7, 200, 300)
  moveJoystick(stick, 200 + dx, 300 + dy)
  return stick
}

describe('analogVectorFromStick', () => {
  it('returns zero inside the radial deadzone', () => {
    const px = ANALOG_DEADZONE * JOYSTICK_RADIUS * 0.9
    expect(analogVectorFromStick(stickAt(px, 0))).toEqual({ x: 0, y: 0 })
    expect(analogVectorFromStick(createJoystick())).toEqual({ x: 0, y: 0 })
  })

  it('ramps from zero at the deadzone edge to one at the rim', () => {
    const justPast = analogVectorFromStick(stickAt(ANALOG_DEADZONE * JOYSTICK_RADIUS + 2, 0))
    expect(justPast.x).toBeGreaterThan(0)
    expect(justPast.x).toBeLessThan(0.1)
    const rim = analogVectorFromStick(stickAt(JOYSTICK_RADIUS * 2, 0))
    expect(rim.x).toBeCloseTo(1)
    expect(rim.y).toBeCloseTo(0)
  })

  it('scales magnitude monotonically with deflection', () => {
    const half = analogVectorFromStick(stickAt(0, -JOYSTICK_RADIUS / 2))
    const full = analogVectorFromStick(stickAt(0, -JOYSTICK_RADIUS))
    expect(Math.abs(half.y)).toBeGreaterThan(0.2)
    expect(Math.abs(half.y)).toBeLessThan(Math.abs(full.y))
    expect(full.y).toBeCloseTo(-1)
  })

  it('preserves direction without per-axis snapping', () => {
    const v = analogVectorFromStick(stickAt(30, -40))
    // 3-4-5 triangle: direction must survive the deadzone remap exactly.
    expect(v.x / -v.y).toBeCloseTo(30 / 40)
  })

  it('never exceeds unit magnitude, even on near-rim diagonals', () => {
    const v = analogVectorFromStick(stickAt(JOYSTICK_RADIUS * 0.95, JOYSTICK_RADIUS * 0.95))
    expect(Math.hypot(v.x, v.y)).toBeLessThanOrEqual(1.000001)
  })
})

describe('lookVectorFromStick', () => {
  it('squares the response for fine aim near the center', () => {
    const gentle = lookVectorFromStick(stickAt(JOYSTICK_RADIUS / 2, 0))
    const linear = analogVectorFromStick(stickAt(JOYSTICK_RADIUS / 2, 0))
    expect(gentle.x).toBeGreaterThan(0)
    expect(gentle.x).toBeLessThan(linear.x)
  })

  it('reaches full rate at the rim and keeps sign', () => {
    const v = lookVectorFromStick(stickAt(-JOYSTICK_RADIUS * 2, 0))
    expect(v.x).toBeCloseTo(-1)
    expect(v.y).toBe(0)
  })
})

describe('tap classification', () => {
  it('a quick still release is a tap', () => {
    expect(isTapRelease(stickAt(3, 3), TAP_MAX_MS - 50)).toBe(true)
  })

  it('a slow release is not a tap', () => {
    expect(isTapRelease(stickAt(0, 0), TAP_MAX_MS + 1)).toBe(false)
  })

  it('a dragged release is not a tap', () => {
    expect(isTapRelease(stickAt(TAP_MAX_DRIFT_PX + 2, 0), 100)).toBe(false)
  })

  it('joystickMovedBeyond measures euclidean drift', () => {
    expect(joystickMovedBeyond(stickAt(10, 10), 14)).toBe(true)
    expect(joystickMovedBeyond(stickAt(9, 9), 14)).toBe(false)
  })
})

describe('rebaseOriginIfPhantom', () => {
  it('rebases a stick anchored at the exact screen origin', () => {
    const stick = createJoystick()
    beginJoystick(stick, 1, 0, 0)
    rebaseOriginIfPhantom(stick, 140, 520)
    expect(stick.originX).toBe(140)
    expect(stick.originY).toBe(520)
    expect(stick.currentX).toBe(140)
    expect(stick.currentY).toBe(520)
  })

  it('leaves a normally anchored stick alone', () => {
    const stick = stickAt(20, 0)
    rebaseOriginIfPhantom(stick, 999, 999)
    expect(stick.originX).toBe(200)
    expect(stick.currentX).toBe(220)
  })
})
