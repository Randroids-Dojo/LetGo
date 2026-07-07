// Enemy, pickup, and projectile sprites, drawn as front-facing minifigs
// and molded parts. Every animation frame is drawn twice with a slightly
// different lean; the renderer alternates variants at ~10Hz so the toys
// feel stop-motion animated.

import type { EnemyKind, PickupKind } from '@/game/dungeon'
import { hashString, type Rng } from '@/game/rng'
import {
  BLACK,
  BLUE,
  BROWN,
  GOLD,
  GRAY_DARK,
  GRAY_LIGHT,
  ORANGE,
  RED,
  SKIN,
  WHITE,
  YELLOW,
  clawHand,
  debrisScatter,
  makeCanvas,
  makeRng,
  minifigFace,
  plasticRect,
  shade,
  starburst,
  stud,
  studSide,
  type Ctx,
  type FaceMood
} from './brick'

export const SPRITE_SIZE = 160

export type EnemyFrame = 'walkA' | 'walkB' | 'windup' | 'pain' | 'die1' | 'die2' | 'die3'

export const ENEMY_FRAMES: EnemyFrame[] = ['walkA', 'walkB', 'windup', 'pain', 'die1', 'die2', 'die3']

type CharacterSpec = {
  scale: number
  torso: string
  legs: string
  head: string
  face: FaceMood
  hat: 'helmet' | 'knight' | 'wizard' | 'none'
  hatColor: string
  bulk: number
  weapon: 'studgun' | 'scatter' | 'staff' | 'sword' | 'none'
  // The golem is brick-built rather than a standard minifig.
  golem?: boolean
}

const SPECS: Record<EnemyKind, CharacterSpec> = {
  skeleton: { scale: 0.82, torso: WHITE, legs: WHITE, head: WHITE, face: 'skull', hat: 'none', hatColor: WHITE, bulk: 0.8, weapon: 'studgun' },
  guard: { scale: 0.88, torso: GRAY_LIGHT, legs: GRAY_DARK, head: SKIN, face: 'angry', hat: 'helmet', hatColor: GRAY_DARK, bulk: 1.05, weapon: 'scatter' },
  wizard: { scale: 0.92, torso: BLUE, legs: BLUE, head: SKIN, face: 'angry', hat: 'wizard', hatColor: BLUE, bulk: 0.9, weapon: 'staff' },
  knight: { scale: 1, torso: GRAY_DARK, legs: BLACK, head: SKIN, face: 'angry', hat: 'knight', hatColor: GRAY_LIGHT, bulk: 1.3, weapon: 'sword' },
  golem: { scale: 1.1, torso: ORANGE, legs: shade(ORANGE, -0.25), head: ORANGE, face: 'angry', hat: 'none', hatColor: ORANGE, bulk: 1.6, weapon: 'none', golem: true }
}

type Pose = {
  legSwing: number
  armRaise: number
  flinch: boolean
  collapse: number // 0 standing .. 1 in pieces
  eyesDead: boolean
}

function poseForFrame(frame: EnemyFrame): Pose {
  switch (frame) {
    case 'walkA':
      return { legSwing: 1, armRaise: 0.15, flinch: false, collapse: 0, eyesDead: false }
    case 'walkB':
      return { legSwing: -1, armRaise: 0.15, flinch: false, collapse: 0, eyesDead: false }
    case 'windup':
      return { legSwing: 0.3, armRaise: 1, flinch: false, collapse: 0, eyesDead: false }
    case 'pain':
      return { legSwing: 0, armRaise: 0.4, flinch: true, collapse: 0, eyesDead: false }
    case 'die1':
      return { legSwing: 0, armRaise: 0.8, flinch: true, collapse: 0.25, eyesDead: true }
    case 'die2':
      return { legSwing: 0, armRaise: 0.3, flinch: true, collapse: 0.6, eyesDead: true }
    case 'die3':
      return { legSwing: 0, armRaise: 0, flinch: false, collapse: 1, eyesDead: true }
  }
}

function drawArm(ctx: Ctx, spec: CharacterSpec, shoulderX: number, shoulderY: number, angle: number, length: number) {
  ctx.save()
  ctx.translate(shoulderX, shoulderY)
  ctx.rotate(angle)
  plasticRect(ctx, -5 * spec.bulk, 0, 10 * spec.bulk, length, shade(spec.torso, -0.06), { radius: 5, gloss: 0.45, outlineWidth: 2 })
  clawHand(ctx, 0, length + 6, 7, spec.head, angle > 0 ? -0.4 : 0.4)
  ctx.restore()
}

function drawWeapon(ctx: Ctx, spec: CharacterSpec, handX: number, handY: number, raise: number) {
  ctx.save()
  ctx.translate(handX, handY)
  if (spec.weapon === 'studgun') {
    plasticRect(ctx, -3, -10, 24, 8, GRAY_DARK, { radius: 2, gloss: 0.5 })
    plasticRect(ctx, -3, -6, 7, 12, GRAY_DARK, { radius: 2, gloss: 0.4 })
    studSide(ctx, 19, -14, 3.5, 4, GRAY_LIGHT)
  } else if (spec.weapon === 'scatter') {
    plasticRect(ctx, -8, -12, 36, 7, GRAY_DARK, { radius: 3, gloss: 0.5 })
    plasticRect(ctx, -8, -5, 36, 7, GRAY_DARK, { radius: 3, gloss: 0.35 })
    plasticRect(ctx, -14, -8, 12, 12, BROWN, { radius: 3, gloss: 0.4 })
  } else if (spec.weapon === 'staff') {
    plasticRect(ctx, 1, -34 - raise * 6, 5, 46, BROWN, { radius: 2.5, gloss: 0.35 })
    starburst(ctx, makeRng(7), 3.5, -38 - raise * 6, 5, 9, 4, '#79e6ff', WHITE)
  } else if (spec.weapon === 'sword') {
    plasticRect(ctx, 0, -38 - raise * 8, 6, 34, GRAY_LIGHT, { radius: 2, gloss: 0.7 })
    plasticRect(ctx, -6, -6 - raise * 8, 18, 5, GOLD, { radius: 2, gloss: 0.5 })
  }
  ctx.restore()
}

function drawHat(ctx: Ctx, spec: CharacterSpec, headX: number, headY: number, headR: number) {
  if (spec.hat === 'helmet') {
    ctx.save()
    ctx.beginPath()
    ctx.arc(headX, headY - headR * 0.25, headR * 1.15, Math.PI, Math.PI * 2)
    ctx.fillStyle = spec.hatColor
    ctx.fill()
    ctx.strokeStyle = 'rgba(10,12,16,0.5)'
    ctx.lineWidth = 2
    ctx.stroke()
    plasticRect(ctx, headX - headR * 1.15, headY - headR * 0.35, headR * 2.3, headR * 0.3, spec.hatColor, { radius: 3, gloss: 0.5, outlineWidth: 1.5 })
    ctx.restore()
  } else if (spec.hat === 'knight') {
    // Full helm with a visor slit; covers the face.
    plasticRect(ctx, headX - headR * 1.05, headY - headR * 1.2, headR * 2.1, headR * 2.2, spec.hatColor, { radius: headR * 0.5, gloss: 0.6 })
    ctx.fillStyle = BLACK
    ctx.fillRect(headX - headR * 0.7, headY - headR * 0.35, headR * 1.4, headR * 0.28)
    plasticRect(ctx, headX - headR * 0.16, headY - headR * 1.7, headR * 0.32, headR * 0.6, RED, { radius: 2, gloss: 0.4, outlineWidth: 1.5 })
  } else if (spec.hat === 'wizard') {
    ctx.save()
    ctx.beginPath()
    ctx.moveTo(headX - headR * 1.2, headY - headR * 0.55)
    ctx.lineTo(headX + headR * 1.2, headY - headR * 0.55)
    ctx.lineTo(headX + headR * 0.1, headY - headR * 2.6)
    ctx.closePath()
    ctx.fillStyle = spec.hatColor
    ctx.fill()
    ctx.strokeStyle = 'rgba(10,12,16,0.5)'
    ctx.lineWidth = 2
    ctx.stroke()
    stud(ctx, headX - headR * 0.35, headY - headR * 1.3, headR * 0.18, YELLOW)
    stud(ctx, headX + headR * 0.4, headY - headR * 1.7, headR * 0.14, YELLOW)
    ctx.restore()
  }
}

function drawCharacter(ctx: Ctx, kind: EnemyKind, spec: CharacterSpec, pose: Pose, rng: Rng, lean: number) {
  const S = SPRITE_SIZE
  const cx = S / 2
  const groundY = S - 8
  const scale = spec.scale

  ctx.save()
  ctx.translate(cx, groundY)
  ctx.scale(scale, scale)
  ctx.rotate(lean + (pose.flinch ? 0.06 : 0))

  if (pose.collapse >= 1) {
    // Final frame: a scatter of parts with the head resting in the pile.
    debrisScatter(ctx, rng, 0, -12, 26, [spec.torso, spec.legs, spec.hatColor])
    ctx.save()
    ctx.translate(10, -14)
    ctx.rotate(0.9)
    plasticRect(ctx, -11, -11, 22, 22, spec.head, { radius: 7, gloss: 0.5 })
    minifigFace(ctx, 0, 0, 11, spec.face === 'skull' ? 'skull' : 'dead')
    ctx.restore()
    ctx.restore()
    return
  }

  const squash = 1 - pose.collapse * 0.5
  ctx.scale(1, squash)
  // Dying figures start to come apart: joints spread with collapse.
  const sep = pose.collapse * 10

  const legH = 30
  const legW = 11 * spec.bulk
  const torsoH = 38
  const torsoW = 30 * spec.bulk
  const hipY = -legH
  const torsoTop = hipY - torsoH - sep * 0.5
  const headR = 15
  const headY = torsoTop - headR - 4 - sep

  if (spec.golem) {
    drawGolem(ctx, spec, pose, rng, sep)
    ctx.restore()
    return
  }

  // Legs: stiff blocks that swing from the hip.
  const lift = pose.legSwing * 6
  plasticRect(ctx, -legW - 1.5, hipY - Math.max(0, lift), legW, legH + Math.max(0, lift), spec.legs, { radius: 3, gloss: 0.4 })
  plasticRect(ctx, 1.5, hipY - Math.max(0, -lift), legW, legH + Math.max(0, -lift), spec.legs, { radius: 3, gloss: 0.4 })
  // Hip block.
  plasticRect(ctx, -legW - 1.5, hipY - 7, legW * 2 + 3, 9, shade(spec.legs, -0.15), { radius: 3, gloss: 0.35 })

  // Torso: the classic trapezoid, wider at the hips.
  ctx.save()
  ctx.beginPath()
  ctx.moveTo(-torsoW * 0.42, torsoTop)
  ctx.lineTo(torsoW * 0.42, torsoTop)
  ctx.lineTo(torsoW * 0.55, torsoTop + torsoH)
  ctx.lineTo(-torsoW * 0.55, torsoTop + torsoH)
  ctx.closePath()
  const grad = ctx.createLinearGradient(0, torsoTop, 0, torsoTop + torsoH)
  grad.addColorStop(0, shade(spec.torso, 0.18))
  grad.addColorStop(1, shade(spec.torso, -0.15))
  ctx.fillStyle = grad
  ctx.fill()
  ctx.strokeStyle = 'rgba(10,12,16,0.55)'
  ctx.lineWidth = 2.5
  ctx.stroke()
  ctx.restore()

  // Torso print.
  if (kind === 'skeleton') {
    ctx.strokeStyle = shade(WHITE, -0.4)
    ctx.lineWidth = 3
    for (let i = 0; i < 3; i++) {
      ctx.beginPath()
      ctx.moveTo(-torsoW * 0.3, torsoTop + 9 + i * 9)
      ctx.lineTo(torsoW * 0.3, torsoTop + 9 + i * 9)
      ctx.stroke()
    }
    ctx.beginPath()
    ctx.moveTo(0, torsoTop + 4)
    ctx.lineTo(0, torsoTop + torsoH - 6)
    ctx.stroke()
  } else if (kind === 'guard') {
    plasticRect(ctx, -torsoW * 0.32, torsoTop + 6, torsoW * 0.64, torsoH * 0.6, shade(GRAY_LIGHT, -0.2), { radius: 4, gloss: 0.6, outlineWidth: 1.5 })
    stud(ctx, 0, torsoTop + torsoH * 0.35, 3.5, GRAY_LIGHT)
  } else if (kind === 'wizard') {
    // Robe stars.
    for (const [sx, sy] of [
      [-torsoW * 0.25, torsoTop + 12],
      [torsoW * 0.2, torsoTop + 22],
      [-torsoW * 0.05, torsoTop + 30]
    ]) {
      starburst(ctx, rng, sx, sy, 4, 4, 1.8, YELLOW, null)
    }
  } else if (kind === 'knight') {
    plasticRect(ctx, -torsoW * 0.36, torsoTop + 5, torsoW * 0.72, torsoH * 0.7, GRAY_LIGHT, { radius: 5, gloss: 0.7, outlineWidth: 2 })
    ctx.fillStyle = RED
    ctx.beginPath()
    ctx.moveTo(0, torsoTop + 10)
    ctx.lineTo(6, torsoTop + 22)
    ctx.lineTo(0, torsoTop + 30)
    ctx.lineTo(-6, torsoTop + 22)
    ctx.closePath()
    ctx.fill()
  }

  // Arms. The weapon arm rises with armRaise.
  const raise = pose.armRaise
  const shoulderY = torsoTop + 5
  drawArm(ctx, spec, -torsoW * 0.48, shoulderY, 0.5 - raise * 0.1, torsoH * 0.75)
  const weaponAngle = -0.5 - raise * 1.1
  drawArm(ctx, spec, torsoW * 0.48, shoulderY, weaponAngle, torsoH * 0.75)
  const armLen = torsoH * 0.75 + 6
  const handX = torsoW * 0.48 - Math.sin(weaponAngle) * armLen
  const handY = shoulderY + Math.cos(weaponAngle) * armLen
  drawWeapon(ctx, spec, handX, handY, raise)

  // Head.
  plasticRect(ctx, -headR, headY - headR, headR * 2, headR * 2, spec.head, { radius: headR * 0.55, gloss: 0.6 })
  if (spec.hat === 'none') {
    studSide(ctx, 0, headY - headR - 3.5, headR * 0.4, 3.5, spec.head)
  }
  if (spec.hat !== 'knight') {
    minifigFace(ctx, 0, headY, headR, pose.eyesDead ? (spec.face === 'skull' ? 'skull' : 'dead') : spec.face)
  }
  drawHat(ctx, spec, 0, headY, headR)

  ctx.restore()
}

// The golem: a brick-built brute instead of a standard minifig.
function drawGolem(ctx: Ctx, spec: CharacterSpec, pose: Pose, rng: Rng, sep: number) {
  const bodyW = 56
  const lift = pose.legSwing * 5
  // Stumpy leg bricks.
  plasticRect(ctx, -bodyW * 0.45, -26 - Math.max(0, lift), 22, 26 + Math.max(0, lift), spec.legs, { radius: 3, gloss: 0.4 })
  plasticRect(ctx, bodyW * 0.45 - 22, -26 - Math.max(0, -lift), 22, 26 + Math.max(0, -lift), spec.legs, { radius: 3, gloss: 0.4 })
  // Stacked torso courses with visible studs.
  const courses = [
    { y: -44 - sep * 0.4, w: bodyW * 1.05, tone: -0.12 },
    { y: -62 - sep * 0.7, w: bodyW * 1.15, tone: 0.05 },
    { y: -80 - sep, w: bodyW * 0.95, tone: -0.04 }
  ]
  for (const course of courses) {
    plasticRect(ctx, -course.w / 2, course.y, course.w, 20, shade(spec.torso, course.tone + (rng() - 0.5) * 0.06), { radius: 3, gloss: 0.45, outlineWidth: 2.5 })
    for (let i = 0; i < 3; i++) {
      studSide(ctx, -course.w / 3 + (i * course.w) / 3, course.y - 3, 5, 3, shade(spec.torso, course.tone))
    }
  }
  // Massive arm bricks; the raised one telegraphs the throw.
  const raise = pose.armRaise
  ctx.save()
  ctx.translate(-bodyW * 0.72, -74 - sep)
  ctx.rotate(0.35 - raise * 0.2)
  plasticRect(ctx, -9, 0, 18, 42, shade(spec.torso, -0.18), { radius: 4, gloss: 0.4 })
  ctx.restore()
  ctx.save()
  ctx.translate(bodyW * 0.72, -74 - sep)
  ctx.rotate(-0.35 + raise * 1.15)
  plasticRect(ctx, -9, 0, 18, 42, shade(spec.torso, -0.18), { radius: 4, gloss: 0.4 })
  if (raise > 0.5) {
    starburst(ctx, rng, 0, 50, 6, 12, 6, ORANGE, YELLOW)
  }
  ctx.restore()
  // Head brick with glowing eyes.
  const headY = -96 - sep * 1.4
  plasticRect(ctx, -16, headY - 14, 32, 22, shade(spec.torso, 0.08), { radius: 4, gloss: 0.5 })
  studSide(ctx, -6, headY - 17.5, 4, 3.5, spec.torso)
  studSide(ctx, 6, headY - 17.5, 4, 3.5, spec.torso)
  ctx.fillStyle = pose.eyesDead ? BLACK : YELLOW
  for (const side of [-1, 1]) {
    ctx.beginPath()
    ctx.arc(side * 7, headY - 4, 3.4, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.fillStyle = BLACK
  ctx.fillRect(-8, headY + 3, 16, 3)
}

export type SpriteSheet = Record<EnemyFrame, HTMLCanvasElement[]>

export function drawEnemySprites(kind: EnemyKind): SpriteSheet {
  const spec = SPECS[kind]
  const sheet = {} as SpriteSheet
  for (const frame of ENEMY_FRAMES) {
    sheet[frame] = [0, 1].map((variant) => {
      const { canvas, ctx } = makeCanvas(SPRITE_SIZE, SPRITE_SIZE)
      const rng = makeRng(hashString(`${kind}-${frame}-${variant}`))
      drawCharacter(ctx, kind, spec, poseForFrame(frame), rng, variant === 0 ? -0.015 : 0.015)
      return canvas
    })
  }
  return sheet
}

// --- Pickups ---

const PICKUP_SIZE = 96

function pickupCanvas(draw: (ctx: Ctx, rng: Rng) => void, seed: string): HTMLCanvasElement[] {
  return [0, 1].map((variant) => {
    const { canvas, ctx } = makeCanvas(PICKUP_SIZE, PICKUP_SIZE)
    const rng = makeRng(hashString(`${seed}-${variant}`))
    ctx.save()
    ctx.translate(PICKUP_SIZE / 2, PICKUP_SIZE / 2)
    ctx.rotate(variant === 0 ? -0.03 : 0.03)
    draw(ctx, rng)
    ctx.restore()
    return canvas
  })
}

// A loose stud seen at three-quarter view: short gold cylinder.
function drawStudPiece(ctx: Ctx, cx: number, cy: number, r: number) {
  ctx.save()
  ctx.fillStyle = shade(GOLD, -0.15)
  ctx.beginPath()
  ctx.ellipse(cx, cy + r * 0.45, r, r * 0.5, 0, 0, Math.PI)
  ctx.fill()
  ctx.fillRect(cx - r, cy, r * 2, r * 0.45)
  ctx.strokeStyle = 'rgba(10,12,16,0.5)'
  ctx.lineWidth = 2
  ctx.strokeRect(cx - r, cy, r * 2, r * 0.45)
  ctx.beginPath()
  ctx.ellipse(cx, cy, r, r * 0.5, 0, 0, Math.PI * 2)
  const g = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.2, r * 0.1, cx, cy, r)
  g.addColorStop(0, shade(GOLD, 0.45))
  g.addColorStop(1, GOLD)
  ctx.fillStyle = g
  ctx.fill()
  ctx.stroke()
  ctx.restore()
}

function drawHeart(ctx: Ctx, big: boolean) {
  if (big) {
    // Medkit brick: white 2x2 with a red cross print.
    plasticRect(ctx, -26, -14, 52, 36, WHITE, { radius: 4, gloss: 0.55 })
    studSide(ctx, -13, -18, 6, 4, WHITE)
    studSide(ctx, 13, -18, 6, 4, WHITE)
    ctx.fillStyle = RED
    ctx.fillRect(-5, -8, 10, 24)
    ctx.fillRect(-12, -1, 24, 10)
  } else {
    ctx.save()
    ctx.beginPath()
    ctx.moveTo(0, 18)
    ctx.bezierCurveTo(-26, -2, -16, -22, 0, -10)
    ctx.bezierCurveTo(16, -22, 26, -2, 0, 18)
    const g = ctx.createLinearGradient(0, -20, 0, 18)
    g.addColorStop(0, shade(RED, 0.25))
    g.addColorStop(1, shade(RED, -0.12))
    ctx.fillStyle = g
    ctx.fill()
    ctx.strokeStyle = 'rgba(10,12,16,0.5)'
    ctx.lineWidth = 2.5
    ctx.stroke()
    ctx.restore()
  }
}

function drawVestPickup(ctx: Ctx, heavy: boolean) {
  const color = heavy ? GRAY_DARK : GRAY_LIGHT
  ctx.save()
  ctx.beginPath()
  ctx.moveTo(-18, -20)
  ctx.lineTo(18, -20)
  ctx.lineTo(24, 22)
  ctx.lineTo(-24, 22)
  ctx.closePath()
  const g = ctx.createLinearGradient(0, -20, 0, 22)
  g.addColorStop(0, shade(color, 0.2))
  g.addColorStop(1, shade(color, -0.15))
  ctx.fillStyle = g
  ctx.fill()
  ctx.strokeStyle = 'rgba(10,12,16,0.55)'
  ctx.lineWidth = 3
  ctx.stroke()
  // Shoulder cutouts.
  ctx.fillStyle = 'rgba(10,12,16,0.35)'
  ctx.beginPath()
  ctx.ellipse(-12, -20, 7, 5, 0, 0, Math.PI)
  ctx.ellipse(12, -20, 7, 5, 0, 0, Math.PI)
  ctx.fill()
  if (heavy) {
    ctx.strokeStyle = GOLD
    ctx.lineWidth = 3
    ctx.strokeRect(-14, -10, 28, 24)
    stud(ctx, 0, 2, 6, GOLD)
  } else {
    stud(ctx, 0, 2, 6, color)
  }
  ctx.restore()
}

function drawAmmoBox(ctx: Ctx, label: string, color: string) {
  plasticRect(ctx, -26, -16, 52, 38, color, { radius: 4, gloss: 0.5 })
  studSide(ctx, -13, -20, 6, 4, color)
  studSide(ctx, 13, -20, 6, 4, color)
  plasticRect(ctx, -20, -6, 40, 18, WHITE, { radius: 3, gloss: 0.25, outlineWidth: 1.5 })
  ctx.fillStyle = BLACK
  ctx.font = 'bold 11px Verdana, Arial, sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText(label, 0, 7)
}

function drawKey(ctx: Ctx) {
  ctx.save()
  ctx.strokeStyle = shade(GOLD, -0.3)
  ctx.lineWidth = 6
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.arc(-10, -8, 11, 0, Math.PI * 2)
  ctx.stroke()
  ctx.strokeStyle = GOLD
  ctx.lineWidth = 5
  ctx.beginPath()
  ctx.arc(-10, -8, 11, 0, Math.PI * 2)
  ctx.moveTo(-2, 0)
  ctx.lineTo(18, 20)
  ctx.moveTo(10, 12)
  ctx.lineTo(17, 5)
  ctx.moveTo(14, 16)
  ctx.lineTo(21, 9)
  ctx.stroke()
  ctx.restore()
}

export function drawPickupSprites(): Record<PickupKind, HTMLCanvasElement[]> {
  return {
    stud: pickupCanvas((ctx) => drawStudPiece(ctx, 0, 2, 16), 'stud'),
    studPile: pickupCanvas((ctx) => {
      drawStudPiece(ctx, -16, 10, 13)
      drawStudPiece(ctx, 16, 10, 13)
      drawStudPiece(ctx, 0, -8, 14)
    }, 'studpile'),
    heartSmall: pickupCanvas((ctx) => drawHeart(ctx, false), 'heartsmall'),
    heartBig: pickupCanvas((ctx) => drawHeart(ctx, true), 'heartbig'),
    vest: pickupCanvas((ctx) => drawVestPickup(ctx, false), 'vest'),
    heavyArmor: pickupCanvas((ctx) => drawVestPickup(ctx, true), 'heavyarmor'),
    bullets: pickupCanvas((ctx) => drawAmmoBox(ctx, 'STUDS', GRAY_LIGHT), 'bullets'),
    shells: pickupCanvas((ctx) => drawAmmoBox(ctx, 'SHELLS', RED), 'shells'),
    tnt: pickupCanvas(drawTntBundle, 'tntammo'),
    cells: pickupCanvas((ctx) => drawAmmoBox(ctx, 'CELLS', BLUE), 'cells'),
    vaultKey: pickupCanvas(drawKey, 'key')
  }
}

function drawTntBundle(ctx: Ctx) {
  for (const x of [-13, 0, 13]) {
    plasticRect(ctx, x - 6, -18, 12, 40, RED, { radius: 5, gloss: 0.5, outlineWidth: 2 })
  }
  plasticRect(ctx, -21, -5, 42, 12, WHITE, { radius: 2, gloss: 0.3, outlineWidth: 1.5 })
  ctx.fillStyle = BLACK
  ctx.font = 'bold 10px Verdana, Arial, sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText('TNT', 0, 4)
  ctx.strokeStyle = BLACK
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(0, -18)
  ctx.quadraticCurveTo(6, -26, 10, -28)
  ctx.stroke()
}

// Explosive crate: waist-high brown crate marked TNT.
export function drawCrateSprites(): HTMLCanvasElement[] {
  return pickupCanvas((ctx) => {
    plasticRect(ctx, -30, -26, 60, 60, BROWN, { radius: 4, gloss: 0.4 })
    studSide(ctx, -15, -30, 6, 4, BROWN)
    studSide(ctx, 15, -30, 6, 4, BROWN)
    ctx.strokeStyle = 'rgba(10,12,16,0.4)'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.moveTo(-30, -26)
    ctx.lineTo(30, 34)
    ctx.moveTo(30, -26)
    ctx.lineTo(-30, 34)
    ctx.stroke()
    plasticRect(ctx, -20, -6, 40, 20, WHITE, { radius: 3, gloss: 0.25, outlineWidth: 1.5 })
    ctx.fillStyle = BLACK
    ctx.font = 'bold 13px Verdana, Arial, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('TNT', 0, 8)
  }, 'crate')
}

// --- Projectiles and effects ---

export type ProjectileArt = 'bolt' | 'fireball' | 'ray' | 'tnt' | 'megabrick'

export function drawProjectileSprites(): Record<ProjectileArt, HTMLCanvasElement[]> {
  const make = (seed: string, draw: (ctx: Ctx, rng: Rng) => void) =>
    [0, 1].map((variant) => {
      const { canvas, ctx } = makeCanvas(64, 64)
      const rng = makeRng(hashString(`${seed}-${variant}`))
      ctx.save()
      ctx.translate(32, 32)
      draw(ctx, rng)
      ctx.restore()
      return canvas
    })
  return {
    bolt: make('proj-bolt', (ctx, rng) => {
      starburst(ctx, rng, 0, 0, 5, 16, 7, '#79e6ff', WHITE)
    }),
    fireball: make('proj-fireball', (ctx, rng) => {
      starburst(ctx, rng, 0, 0, 7, 20, 10, ORANGE, YELLOW)
    }),
    ray: make('proj-ray', (ctx, rng) => {
      ctx.save()
      ctx.shadowColor = '#7ef05a'
      ctx.shadowBlur = 10
      ctx.beginPath()
      ctx.ellipse(0, 0, 15, 7, 0, 0, Math.PI * 2)
      ctx.fillStyle = '#7ef05a'
      ctx.fill()
      ctx.restore()
      ctx.beginPath()
      ctx.ellipse(0, 0, 7, 3.2, 0, 0, Math.PI * 2)
      ctx.fillStyle = WHITE
      ctx.fill()
      void rng
    }),
    tnt: make('proj-tnt', (ctx, rng) => {
      ctx.save()
      ctx.rotate(0.4)
      plasticRect(ctx, -6, -16, 12, 32, RED, { radius: 5, gloss: 0.5, outlineWidth: 2 })
      ctx.restore()
      starburst(ctx, rng, 10, -18, 5, 8, 4, YELLOW, WHITE)
    }),
    megabrick: make('proj-megabrick', (ctx, rng) => {
      ctx.save()
      ctx.rotate(-0.35)
      plasticRect(ctx, -24, -10, 48, 22, RED, { radius: 3, gloss: 0.55, outlineWidth: 2.5 })
      for (let i = 0; i < 4; i++) {
        studSide(ctx, -18 + i * 12, -13.5, 4.5, 3.5, RED)
      }
      ctx.restore()
      void rng
    })
  }
}

export function drawImpactStar(): HTMLCanvasElement[] {
  return [0, 1].map((variant) => {
    const { canvas, ctx } = makeCanvas(96, 96)
    const rng = makeRng(hashString(`impact-${variant}`))
    starburst(ctx, rng, 48, 48, 8, 38, 17, YELLOW, WHITE)
    return canvas
  })
}

export function drawExplosion(): HTMLCanvasElement[] {
  return [0, 1, 2].map((stage) => {
    const { canvas, ctx } = makeCanvas(160, 160)
    const rng = makeRng(hashString(`boom-${stage}`))
    const r = 30 + stage * 24
    starburst(ctx, rng, 80, 80, 9, r, r * 0.55, stage === 2 ? RED : ORANGE, stage === 2 ? ORANGE : YELLOW)
    if (stage < 2) {
      ctx.fillStyle = BLACK
      ctx.font = 'bold 26px Verdana, Arial, sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText('POW!', 80, 88)
    }
    return canvas
  })
}

// Scattered loose parts: hit feedback and the floor decals kills leave.
export function drawDebrisSprites(): HTMLCanvasElement[] {
  return [0, 1, 2].map((variant) => {
    const { canvas, ctx } = makeCanvas(96, 96)
    const rng = makeRng(hashString(`debris-${variant}`))
    debrisScatter(ctx, rng, 48, 48, 24, [GRAY_LIGHT, RED, YELLOW, BLUE])
    return canvas
  })
}
