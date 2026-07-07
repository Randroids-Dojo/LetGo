// First-person weapon viewmodels: yellow minifig claw hands and chunky
// molded hardware drawn on transparent canvases, displayed at the bottom of
// the screen with Doom's bob formula. Fire frames get a starburst flash.

import { hashString, type Rng } from '@/game/rng'
import type { WeaponId } from '@/game/weapons'
import {
  BLACK,
  BLUE,
  BROWN,
  GRAY_DARK,
  GRAY_LIGHT,
  RED,
  SEAM,
  SKIN,
  WHITE,
  YELLOW,
  clawHand,
  makeCanvas,
  makeRng,
  plasticRect,
  shade,
  starburst,
  studSide,
  type Ctx
} from './brick'

export const VIEW_W = 420
export const VIEW_H = 300

export type ViewFrame = 'idle' | 'fire'

// A minifig arm reaching in from the bottom edge, ending in a claw hand.
function arm(ctx: Ctx, x0: number, y0: number, x1: number, y1: number, width = 26) {
  ctx.save()
  const angle = Math.atan2(y1 - y0, x1 - x0)
  const length = Math.hypot(x1 - x0, y1 - y0)
  ctx.translate(x0, y0)
  ctx.rotate(angle - Math.PI / 2)
  plasticRect(ctx, -width / 2, 0, width, length, SKIN, { radius: width / 2, gloss: 0.55, outlineWidth: 2.5 })
  ctx.restore()
  clawHand(ctx, x1, y1, width * 0.55, SKIN, angle + Math.PI / 2)
}

function drawClaws(ctx: Ctx, rng: Rng, fire: boolean) {
  const cx = VIEW_W / 2
  if (fire) {
    arm(ctx, cx + 150, VIEW_H + 60, cx + 14, VIEW_H - 150, 30)
    starburst(ctx, rng, cx + 14, VIEW_H - 186, 6, 26, 12, YELLOW, WHITE)
  } else {
    arm(ctx, cx - 190, VIEW_H + 60, cx - 104, VIEW_H - 88, 30)
    arm(ctx, cx + 190, VIEW_H + 60, cx + 104, VIEW_H - 88, 30)
  }
}

function drawStudgun(ctx: Ctx, rng: Rng, fire: boolean) {
  const cx = VIEW_W / 2 + 44
  const y = VIEW_H - (fire ? 16 : 0)
  arm(ctx, cx + 60, VIEW_H + 60, cx + 2, y - 40, 28)
  ctx.save()
  ctx.translate(cx, y)
  ctx.rotate(-0.16)
  // Grip, body, and a stud-loaded barrel pointing up-screen.
  plasticRect(ctx, -10, -66, 22, 34, GRAY_DARK, { radius: 4, gloss: 0.4 })
  plasticRect(ctx, -12, -128, 26, 64, GRAY_DARK, { radius: 5, gloss: 0.55 })
  studSide(ctx, 1, -134, 8, 6, GRAY_LIGHT)
  ctx.restore()
  if (fire) {
    starburst(ctx, rng, cx - 20, y - 158, 7, 34, 15, YELLOW, WHITE)
  }
}

function drawScatter(ctx: Ctx, rng: Rng, fire: boolean) {
  const cx = VIEW_W / 2
  const y = VIEW_H - (fire ? 20 : 0)
  ctx.save()
  ctx.translate(cx + 40, y)
  ctx.rotate(-0.5)
  // Twin barrels and a wooden stock.
  plasticRect(ctx, -22, -190, 18, 158, GRAY_DARK, { radius: 5, gloss: 0.55 })
  plasticRect(ctx, -2, -190, 18, 158, GRAY_DARK, { radius: 5, gloss: 0.4 })
  plasticRect(ctx, -26, -48, 44, 60, BROWN, { radius: 6, gloss: 0.4 })
  ctx.restore()
  arm(ctx, cx + 140, VIEW_H + 60, cx + 56, y - 20, 28)
  clawHand(ctx, cx + 4, y - 62, 15, SKIN, -0.5)
  if (fire) {
    starburst(ctx, rng, cx - 56, y - 208, 8, 44, 20, YELLOW, WHITE)
  }
}

function drawGatling(ctx: Ctx, rng: Rng, fire: boolean) {
  const cx = VIEW_W / 2
  const y = VIEW_H - (fire ? 12 : 0)
  ctx.save()
  ctx.translate(cx + 30, y)
  ctx.rotate(-0.35)
  plasticRect(ctx, -14, -170, 22, 118, GRAY_DARK, { radius: 5, gloss: 0.55 })
  plasticRect(ctx, -24, -62, 44, 56, GRAY_LIGHT, { radius: 6, gloss: 0.5 })
  // Round stud drum.
  ctx.beginPath()
  ctx.arc(-2, 18, 30, 0, Math.PI * 2)
  const g = ctx.createRadialGradient(-10, 8, 6, -2, 18, 30)
  g.addColorStop(0, shade(GRAY_DARK, 0.25))
  g.addColorStop(1, shade(GRAY_DARK, -0.2))
  ctx.fillStyle = g
  ctx.fill()
  ctx.strokeStyle = SEAM
  ctx.lineWidth = 2.5
  ctx.stroke()
  studSide(ctx, -2, -176, 7, 5, YELLOW)
  ctx.restore()
  arm(ctx, cx + 150, VIEW_H + 60, cx + 48, y - 22, 28)
  clawHand(ctx, cx + 12, y - 90, 15, SKIN, -0.4)
  if (fire) {
    starburst(ctx, rng, cx - 28, y - 196, 7, 38, 16, YELLOW, WHITE)
  }
}

function drawDynamite(ctx: Ctx, rng: Rng, fire: boolean) {
  const cx = VIEW_W / 2
  if (fire) {
    // Mid-throw: the arm whips up and the stick is already gone.
    arm(ctx, cx + 170, VIEW_H + 60, cx + 22, VIEW_H - 198, 30)
    starburst(ctx, rng, cx + 22, VIEW_H - 236, 5, 18, 8, YELLOW, WHITE)
  } else {
    arm(ctx, cx + 170, VIEW_H + 60, cx + 60, VIEW_H - 92, 30)
    ctx.save()
    ctx.translate(cx + 60, VIEW_H - 124)
    ctx.rotate(0.3)
    plasticRect(ctx, -13, -42, 26, 66, RED, { radius: 9, gloss: 0.5 })
    plasticRect(ctx, -13, -14, 26, 12, WHITE, { radius: 2, gloss: 0.25, outlineWidth: 1.5 })
    ctx.restore()
    // Lit fuse.
    ctx.strokeStyle = BLACK
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.moveTo(cx + 74, VIEW_H - 164)
    ctx.quadraticCurveTo(cx + 84, VIEW_H - 176, cx + 80, VIEW_H - 186)
    ctx.stroke()
    starburst(ctx, rng, cx + 80, VIEW_H - 190, 5, 11, 5, YELLOW, WHITE)
  }
}

function drawRaygun(ctx: Ctx, rng: Rng, fire: boolean) {
  const cx = VIEW_W / 2 + 50
  const y = VIEW_H - 60 - (fire ? 16 : 0)
  // Classic space blaster: white body, side fins, trans-green emitter.
  plasticRect(ctx, cx - 34, y - 66, 68, 46, WHITE, { radius: 10, gloss: 0.65 })
  for (const side of [-1, 1]) {
    ctx.beginPath()
    ctx.moveTo(cx + side * 32, y - 60)
    ctx.lineTo(cx + side * 54, y - 72)
    ctx.lineTo(cx + side * 32, y - 40)
    ctx.closePath()
    ctx.fillStyle = BLUE
    ctx.fill()
    ctx.strokeStyle = 'rgba(10,12,16,0.5)'
    ctx.lineWidth = 2
    ctx.stroke()
  }
  plasticRect(ctx, cx - 11, y - 98, 22, 34, GRAY_LIGHT, { radius: 5, gloss: 0.5 })
  ctx.save()
  ctx.shadowColor = '#7ef05a'
  ctx.shadowBlur = 12
  ctx.beginPath()
  ctx.ellipse(cx, y - 100, 15, 8, 0, 0, Math.PI * 2)
  ctx.fillStyle = '#7ef05a'
  ctx.fill()
  ctx.restore()
  arm(ctx, cx + 70, VIEW_H + 50, cx + 10, y + 8, 26)
  if (fire) {
    starburst(ctx, rng, cx, y - 124, 9, 30, 14, '#7ef05a', WHITE)
  }
}

function drawMegabrick(ctx: Ctx, rng: Rng, fire: boolean) {
  const cx = VIEW_W / 2
  const y = VIEW_H - (fire ? 24 : 0)
  // A comically large 2x4 brick on a launcher cradle, held with both hands.
  plasticRect(ctx, cx - 86, y - 62, 172, 52, GRAY_DARK, { radius: 8, gloss: 0.4 })
  plasticRect(ctx, cx - 74, y - 118, 148, 62, RED, { radius: 5, gloss: 0.6, outlineWidth: 3 })
  for (let i = 0; i < 4; i++) {
    studSide(ctx, cx - 54 + i * 36, y - 126, 13, 8, RED)
  }
  // Emitter mouth above the brick.
  ctx.beginPath()
  ctx.ellipse(cx, y - 128, 30, 10, 0, 0, Math.PI * 2)
  ctx.fillStyle = BLACK
  ctx.fill()
  arm(ctx, cx - 170, VIEW_H + 60, cx - 84, y - 36, 30)
  arm(ctx, cx + 170, VIEW_H + 60, cx + 84, y - 36, 30)
  if (fire) {
    starburst(ctx, rng, cx, y - 158, 10, 54, 24, RED, YELLOW)
  }
}

const DRAWERS: Record<WeaponId, (ctx: Ctx, rng: Rng, fire: boolean) => void> = {
  claws: drawClaws,
  studgun: drawStudgun,
  scatter: drawScatter,
  gatling: drawGatling,
  dynamite: drawDynamite,
  raygun: drawRaygun,
  megabrick: drawMegabrick
}

export type ViewmodelSet = Record<ViewFrame, HTMLCanvasElement[]>

export function drawViewmodel(weapon: WeaponId): ViewmodelSet {
  const set = {} as ViewmodelSet
  for (const frame of ['idle', 'fire'] as ViewFrame[]) {
    set[frame] = [0, 1].map((variant) => {
      const { canvas, ctx } = makeCanvas(VIEW_W, VIEW_H)
      const rng = makeRng(hashString(`vm-${weapon}-${frame}-${variant}`))
      ctx.save()
      ctx.translate(0, variant === 0 ? 0 : 2)
      DRAWERS[weapon](ctx, rng, frame === 'fire')
      ctx.restore()
      return canvas
    })
  }
  return set
}
