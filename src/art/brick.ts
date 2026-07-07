// Shared plastic-brick drawing primitives for the toy look: saturated ABS
// colors, vertical sheen gradients, crisp dark seams, raised studs with a
// specular crescent, and scattered-part debris. Everything is drawn to
// canvas at runtime; the repo ships no binary art.

import { mulberry32, type Rng } from '@/game/rng'

// Molded-plastic palette, close to the classic brick colors.
export const RED = '#c9250f'
export const YELLOW = '#f2c500'
export const BLUE = '#0d69c2'
export const GREEN = '#2e8f3c'
export const LIME = '#8fd11e'
export const ORANGE = '#f47b20'
export const BROWN = '#6b3f22'
export const TAN = '#e4cd9e'
export const WHITE = '#f4f4f2'
export const GRAY_LIGHT = '#a8adb2'
export const GRAY_DARK = '#5d6165'
export const BLACK = '#161a1f'
export const GOLD = '#d8a52a'
export const SKIN = '#ffcf1f'
export const SEAM = 'rgba(10, 12, 16, 0.55)'

export type Ctx = CanvasRenderingContext2D

export function makeCanvas(width: number, height: number): { canvas: HTMLCanvasElement; ctx: Ctx } {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new Error('2d context unavailable')
  }
  return { canvas, ctx }
}

// Deterministic per-drawing randomness for tone jitter and debris scatter.
export function makeRng(seed: number): Rng {
  return mulberry32(seed)
}

// Lighten (amount > 0) or darken (amount < 0) a #rrggbb color.
export function shade(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16)
  const channel = (c: number) => {
    const v = amount >= 0 ? c + (255 - c) * amount : c * (1 + amount)
    return Math.max(0, Math.min(255, Math.round(v)))
  }
  const r = channel((n >> 16) & 255)
  const g = channel((n >> 8) & 255)
  const b = channel(n & 255)
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`
}

export function roundRectPath(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  const radius = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.arcTo(x + w, y, x + w, y + h, radius)
  ctx.arcTo(x + w, y + h, x, y + h, radius)
  ctx.arcTo(x, y + h, x, y, radius)
  ctx.arcTo(x, y, x + w, y, radius)
  ctx.closePath()
}

export type PlasticOptions = {
  radius?: number
  // Sheen strength 0..1; 0 disables the gloss pass.
  gloss?: number
  outline?: string | null
  outlineWidth?: number
}

// A molded plastic slab: vertical light-to-dark gradient, glossy top edge,
// and a thin seam outline.
export function plasticRect(ctx: Ctx, x: number, y: number, w: number, h: number, color: string, options: PlasticOptions = {}) {
  const { radius = 3, gloss = 0.5, outline = SEAM, outlineWidth = 2 } = options
  const gradient = ctx.createLinearGradient(0, y, 0, y + h)
  gradient.addColorStop(0, shade(color, 0.18))
  gradient.addColorStop(0.5, color)
  gradient.addColorStop(1, shade(color, -0.18))
  ctx.save()
  roundRectPath(ctx, x, y, w, h, radius)
  ctx.fillStyle = gradient
  ctx.fill()
  if (gloss > 0) {
    roundRectPath(ctx, x + w * 0.08, y + h * 0.06, w * 0.84, Math.max(2, h * 0.16), radius)
    ctx.fillStyle = `rgba(255, 255, 255, ${0.28 * gloss})`
    ctx.fill()
  }
  if (outline) {
    roundRectPath(ctx, x, y, w, h, radius)
    ctx.strokeStyle = outline
    ctx.lineWidth = outlineWidth
    ctx.stroke()
  }
  ctx.restore()
}

// A raised stud seen from above: rim shadow, body, specular crescent.
export function stud(ctx: Ctx, cx: number, cy: number, r: number, color: string) {
  ctx.save()
  ctx.beginPath()
  ctx.arc(cx, cy + r * 0.16, r, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(10, 12, 16, 0.35)'
  ctx.fill()
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  const g = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.35, r * 0.15, cx, cy, r)
  g.addColorStop(0, shade(color, 0.35))
  g.addColorStop(1, shade(color, -0.08))
  ctx.fillStyle = g
  ctx.fill()
  ctx.strokeStyle = 'rgba(10, 12, 16, 0.3)'
  ctx.lineWidth = 1.5
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(cx - r * 0.3, cy - r * 0.32, r * 0.42, Math.PI * 0.9, Math.PI * 1.7)
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)'
  ctx.lineWidth = Math.max(1, r * 0.22)
  ctx.lineCap = 'round'
  ctx.stroke()
  ctx.restore()
}

// A stud seen side-on (a short cylinder on top of a brick).
export function studSide(ctx: Ctx, cx: number, topY: number, r: number, h: number, color: string) {
  ctx.save()
  ctx.fillStyle = shade(color, 0.08)
  ctx.fillRect(cx - r, topY, r * 2, h)
  ctx.strokeStyle = SEAM
  ctx.lineWidth = 1.5
  ctx.strokeRect(cx - r, topY, r * 2, h)
  ctx.beginPath()
  ctx.ellipse(cx, topY, r, r * 0.35, 0, 0, Math.PI * 2)
  ctx.fillStyle = shade(color, 0.3)
  ctx.fill()
  ctx.stroke()
  ctx.restore()
}

// The hollow tube pattern on the underside of a plate (ceilings).
export function tube(ctx: Ctx, cx: number, cy: number, r: number, color: string) {
  ctx.save()
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.strokeStyle = shade(color, -0.35)
  ctx.lineWidth = Math.max(2, r * 0.35)
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(cx, cy, r * 1.18, 0, Math.PI * 2)
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)'
  ctx.lineWidth = 1.5
  ctx.stroke()
  ctx.restore()
}

// Impact and muzzle-flash starburst: hard-edged toy explosion.
export function starburst(
  ctx: Ctx,
  rng: Rng,
  cx: number,
  cy: number,
  points: number,
  rOuter: number,
  rInner: number,
  fill = YELLOW,
  core: string | null = WHITE
) {
  ctx.save()
  ctx.beginPath()
  for (let i = 0; i < points * 2; i++) {
    const a = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2
    const r = (i % 2 === 0 ? rOuter : rInner) * (0.85 + rng() * 0.3)
    const px = cx + Math.cos(a) * r
    const py = cy + Math.sin(a) * r
    if (i === 0) {
      ctx.moveTo(px, py)
    } else {
      ctx.lineTo(px, py)
    }
  }
  ctx.closePath()
  ctx.fillStyle = fill
  ctx.fill()
  ctx.strokeStyle = shade(fill, -0.4)
  ctx.lineWidth = 2.5
  ctx.stroke()
  if (core) {
    ctx.beginPath()
    ctx.arc(cx, cy, rInner * 0.7, 0, Math.PI * 2)
    ctx.fillStyle = core
    ctx.fill()
  }
  ctx.restore()
}

// A tiny loose brick, used for debris and come-apart deaths.
export function loosePiece(ctx: Ctx, cx: number, cy: number, w: number, h: number, color: string, rotation: number) {
  ctx.save()
  ctx.translate(cx, cy)
  ctx.rotate(rotation)
  plasticRect(ctx, -w / 2, -h / 2, w, h, color, { radius: 2, gloss: 0.4, outlineWidth: 1.5 })
  if (w > 9) {
    studSide(ctx, 0, -h / 2 - 2.5, w * 0.18, 2.5, color)
  }
  ctx.restore()
}

// Scatter of loose parts: the death decal and destruction feedback.
export function debrisScatter(ctx: Ctx, rng: Rng, cx: number, cy: number, spread: number, colors: string[]) {
  const count = 5 + Math.floor(rng() * 4)
  for (let i = 0; i < count; i++) {
    const a = rng() * Math.PI * 2
    const d = rng() * spread
    const color = colors[Math.floor(rng() * colors.length)]
    loosePiece(ctx, cx + Math.cos(a) * d, cy + Math.sin(a) * d * 0.7, 8 + rng() * 12, 6 + rng() * 6, color, rng() * Math.PI)
  }
}

// The C-shaped minifig claw hand.
export function clawHand(ctx: Ctx, cx: number, cy: number, r: number, color: string, rotation = 0) {
  ctx.save()
  ctx.translate(cx, cy)
  ctx.rotate(rotation)
  ctx.beginPath()
  ctx.arc(0, 0, r, Math.PI * 0.35, Math.PI * 1.65)
  ctx.strokeStyle = shade(color, -0.15)
  ctx.lineWidth = r * 0.85
  ctx.lineCap = 'round'
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(-r * 0.18, -r * 0.2, r * 0.9, Math.PI * 0.5, Math.PI * 1.4)
  ctx.strokeStyle = shade(color, 0.22)
  ctx.lineWidth = r * 0.3
  ctx.stroke()
  ctx.restore()
}

// Classic minifig face features on an already-drawn head shape.
export type FaceMood = 'calm' | 'grin' | 'pain' | 'angry' | 'dead' | 'skull'

export function minifigFace(ctx: Ctx, cx: number, cy: number, r: number, mood: FaceMood, look = 0) {
  ctx.save()
  ctx.lineCap = 'round'
  const eyeY = cy - r * 0.18
  const eyeX = r * 0.42
  if (mood === 'dead') {
    ctx.strokeStyle = BLACK
    ctx.lineWidth = Math.max(2, r * 0.13)
    for (const side of [-1, 1]) {
      ctx.beginPath()
      ctx.moveTo(cx + side * eyeX - r * 0.16, eyeY - r * 0.16)
      ctx.lineTo(cx + side * eyeX + r * 0.16, eyeY + r * 0.16)
      ctx.moveTo(cx + side * eyeX + r * 0.16, eyeY - r * 0.16)
      ctx.lineTo(cx + side * eyeX - r * 0.16, eyeY + r * 0.16)
      ctx.stroke()
    }
  } else if (mood === 'skull') {
    ctx.fillStyle = BLACK
    for (const side of [-1, 1]) {
      ctx.beginPath()
      ctx.ellipse(cx + side * eyeX, eyeY, r * 0.2, r * 0.24, 0, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.beginPath()
    ctx.ellipse(cx, cy + r * 0.28, r * 0.3, r * 0.12, 0, 0, Math.PI * 2)
    ctx.fill()
  } else {
    ctx.fillStyle = BLACK
    for (const side of [-1, 1]) {
      ctx.beginPath()
      ctx.arc(cx + side * eyeX + look * r * 0.12, eyeY, r * 0.13, 0, Math.PI * 2)
      ctx.fill()
    }
    if (mood === 'angry') {
      ctx.strokeStyle = BLACK
      ctx.lineWidth = Math.max(2, r * 0.11)
      for (const side of [-1, 1]) {
        ctx.beginPath()
        ctx.moveTo(cx + side * (eyeX + r * 0.22), eyeY - r * 0.36)
        ctx.lineTo(cx + side * (eyeX - r * 0.18), eyeY - r * 0.18)
        ctx.stroke()
      }
    }
  }
  // Mouth.
  ctx.strokeStyle = BLACK
  ctx.lineWidth = Math.max(2, r * 0.12)
  ctx.beginPath()
  if (mood === 'grin') {
    ctx.arc(cx, cy + r * 0.18, r * 0.42, Math.PI * 0.15, Math.PI * 0.85)
  } else if (mood === 'pain') {
    ctx.ellipse(cx, cy + r * 0.42, r * 0.18, r * 0.24, 0, 0, Math.PI * 2)
  } else if (mood === 'angry') {
    ctx.arc(cx, cy + r * 0.72, r * 0.42, Math.PI * 1.2, Math.PI * 1.8)
  } else if (mood === 'dead') {
    ctx.moveTo(cx - r * 0.3, cy + r * 0.42)
    ctx.lineTo(cx + r * 0.3, cy + r * 0.42)
  } else if (mood === 'calm') {
    ctx.arc(cx, cy + r * 0.22, r * 0.34, Math.PI * 0.2, Math.PI * 0.8)
  }
  ctx.stroke()
  ctx.restore()
}

// A minifig head: cylinder with a top stud, then face features.
export function minifigHead(ctx: Ctx, cx: number, cy: number, r: number, color: string, mood: FaceMood, look = 0) {
  ctx.save()
  plasticRect(ctx, cx - r, cy - r, r * 2, r * 2, color, { radius: r * 0.55, gloss: 0.6 })
  studSide(ctx, cx, cy - r - r * 0.24, r * 0.42, r * 0.24, color)
  minifigFace(ctx, cx, cy, r, mood, look)
  ctx.restore()
}
