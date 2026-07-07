// Touch control mapping for the mobile layer. The float-where-you-tap
// joystick math comes from vibekit (proven in the pre-reboot Flatline and
// VibeRacer); this module adds the Flatline-specific pieces: analog stick
// deflection with a radial deadzone for movement and aim, tap-vs-drag
// classification for tap-to-fire, and the phantom (0, 0) pointerdown
// rebase carried over from pre-reboot followup F-005.

import { readJoystick, type JoystickState, type JoystickVector } from '@randroids-dojo/vibekit'

export {
  JOYSTICK_RADIUS,
  beginJoystick,
  createJoystick,
  endJoystick,
  moveJoystick,
  readJoystick
} from '@randroids-dojo/vibekit'
export type { JoystickState } from '@randroids-dojo/vibekit'

// A release counts as a tap (fire once) when the thumb stayed inside this
// drift radius and lifted quickly; anything longer is aiming.
export const TAP_MAX_DRIFT_PX = 14
export const TAP_MAX_MS = 260

// Radians per second at full stick deflection.
export const LOOK_YAW_RATE = 3.0
export const LOOK_PITCH_RATE = 2.2

// Radial deadzone (fraction of full deflection). Smaller than vibekit's
// suggested 0.25: with float-where-you-tap sticks the origin is the touch
// point itself, so little dead travel is needed and a big deadzone reads
// as input lag.
export const ANALOG_DEADZONE = 0.15

// Analog deflection with a radial deadzone: zero inside the deadzone,
// then remapped so speed ramps from 0 at the deadzone edge to 1 at the
// rim. Direction is preserved exactly (no per-axis snapping) and the
// magnitude never exceeds 1, so a near-rim diagonal cannot out-run the
// rim itself.
export function analogVectorFromStick(stick: JoystickState): JoystickVector {
  const v = readJoystick(stick)
  const len = Math.hypot(v.x, v.y)
  const mag = Math.min(1, len)
  if (mag <= ANALOG_DEADZONE) {
    return { x: 0, y: 0 }
  }
  const scale = (mag - ANALOG_DEADZONE) / (1 - ANALOG_DEADZONE) / len
  return { x: v.x * scale, y: v.y * scale }
}

// Aim uses a squared per-axis response on top of the analog vector: fine
// corrections near the center, full-rate flicks at the rim.
export function lookVectorFromStick(stick: JoystickState): JoystickVector {
  const v = analogVectorFromStick(stick)
  return { x: v.x * Math.abs(v.x), y: v.y * Math.abs(v.y) }
}

export function joystickMovedBeyond(stick: JoystickState, thresholdPx: number): boolean {
  return Math.hypot(stick.currentX - stick.originX, stick.currentY - stick.originY) > thresholdPx
}

export function isTapRelease(stick: JoystickState, heldMs: number): boolean {
  return heldMs < TAP_MAX_MS && !joystickMovedBeyond(stick, TAP_MAX_DRIFT_PX)
}

// Some mobile Chrome builds deliver the first touch of a session anchored
// at the exact screen origin (pre-reboot F-005).
export function isPhantomOrigin(stick: JoystickState): boolean {
  return stick.originX === 0 && stick.originY === 0
}

// A phantom-origin stick rebases onto the first real move so the knob
// does not lunge from the corner.
export function rebaseOriginIfPhantom(stick: JoystickState, x: number, y: number): void {
  if (isPhantomOrigin(stick) && (x !== 0 || y !== 0)) {
    stick.originX = x
    stick.originY = y
    stick.currentX = x
    stick.currentY = y
  }
}
