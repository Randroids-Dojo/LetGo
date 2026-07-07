// The status-bar mugshot: our minifig hero's head, reacting like Doomguy.
// Five health tiers get progressively more cracked and scuffed; expressions
// cover idle glances, pain, the new-toy grin, and coming apart.

import { hashString } from '@/game/rng'
import { BLACK, BLUE, GRAY_DARK, SKIN, YELLOW, makeCanvas, makeRng, minifigHead, plasticRect, shade, type FaceMood } from './brick'

export const MUG_SIZE = 96

export type MugExpression = 'idle' | 'pain' | 'grin' | 'dead'

// tier 0 = healthy .. 4 = nearly in pieces; matches Doom's 80/60/40/20 bands.
export function mugTierForHp(hp: number, maxHp: number): number {
  const pct = (hp / Math.max(1, maxHp)) * 100
  if (pct >= 80) return 0
  if (pct >= 60) return 1
  if (pct >= 40) return 2
  if (pct >= 20) return 3
  return 4
}

export function drawMugshot(tier: number, expression: MugExpression, look: number): HTMLCanvasElement {
  const { canvas, ctx } = makeCanvas(MUG_SIZE, MUG_SIZE)
  const rng = makeRng(hashString(`mug-${tier}-${expression}-${look}`))
  const cx = MUG_SIZE / 2
  const cy = MUG_SIZE / 2 + 6
  const r = 32

  ctx.save()
  if (expression === 'pain') {
    ctx.translate(0, 2)
  }
  if (expression === 'dead') {
    ctx.translate(0, 6)
    ctx.rotate(0.12)
  }

  // The head: a glossy yellow minifig cylinder with its top stud and face.
  let mood: FaceMood = 'calm'
  if (expression === 'dead') {
    mood = 'dead'
  } else if (expression === 'pain') {
    mood = 'pain'
  } else if (expression === 'grin') {
    mood = 'grin'
  } else if (tier >= 3) {
    mood = 'angry'
  }
  minifigHead(ctx, cx, cy, r, SKIN, mood, expression === 'idle' ? look : 0)

  // Battle damage per tier: hairline cracks, scuffs, then a missing chip.
  ctx.strokeStyle = 'rgba(10, 12, 16, 0.65)'
  ctx.lineWidth = 2
  ctx.lineCap = 'round'
  const crack = (x0: number, y0: number, segments: number) => {
    ctx.beginPath()
    ctx.moveTo(x0, y0)
    let x = x0
    let y = y0
    for (let i = 0; i < segments; i++) {
      x += 4 + rng() * 6
      y += (rng() - 0.4) * 10
      ctx.lineTo(x, y)
    }
    ctx.stroke()
  }
  if (tier >= 1) {
    crack(cx - r + 4, cy - r * 0.5, 3)
  }
  if (tier >= 2) {
    crack(cx + r * 0.2, cy + r * 0.55, 3)
    ctx.fillStyle = 'rgba(10, 12, 16, 0.18)'
    ctx.beginPath()
    ctx.ellipse(cx - r * 0.5, cy + r * 0.4, 7, 4, 0.4, 0, Math.PI * 2)
    ctx.fill()
  }
  if (tier >= 3) {
    crack(cx + r * 0.3, cy - r * 0.9, 4)
    ctx.fillStyle = 'rgba(10, 12, 16, 0.18)'
    ctx.beginPath()
    ctx.ellipse(cx + r * 0.45, cy - r * 0.1, 6, 9, -0.3, 0, Math.PI * 2)
    ctx.fill()
  }
  if (tier >= 4) {
    // A chip knocked clean out of the crown.
    ctx.fillStyle = shade(GRAY_DARK, -0.5)
    ctx.beginPath()
    ctx.moveTo(cx - r * 0.6, cy - r + 2)
    ctx.lineTo(cx - r * 0.25, cy - r + 2)
    ctx.lineTo(cx - r * 0.42, cy - r * 0.6)
    ctx.closePath()
    ctx.fill()
    if (expression !== 'dead') {
      // Dazed stars.
      const star = (sx: number, sy: number) => {
        ctx.strokeStyle = shade(YELLOW, -0.1)
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.moveTo(sx - 4, sy)
        ctx.lineTo(sx + 4, sy)
        ctx.moveTo(sx, sy - 4)
        ctx.lineTo(sx, sy + 4)
        ctx.stroke()
      }
      star(cx - r - 6, cy - r * 0.9)
      star(cx + r + 5, cy - r)
    }
  }
  if (expression === 'dead') {
    // Split right across the face.
    ctx.strokeStyle = BLACK
    ctx.lineWidth = 3
    crack(cx - r + 2, cy - 4, 6)
  }
  ctx.restore()

  // A hint of the blue torso along the bottom edge grounds the portrait.
  plasticRect(ctx, cx - r * 1.15, MUG_SIZE - 10, r * 2.3, 14, BLUE, { radius: 4, gloss: 0.5 })

  return canvas
}
