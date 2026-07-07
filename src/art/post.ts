// The toy-shelf post pass: animated glitter sparkle, a soft vignette, and a
// saturated CSS filter that makes the plastic pop. Three presets mirror the
// old cuts as brightness/sparkle points, drawn onto a 2D overlay canvas
// above the WebGL view. No grayscale, no film grain: this is a bright box of
// bricks, not a 1934 reel.

import { mulberry32 } from '@/game/rng'
import { makeCanvas } from './brick'

export type PostPreset = 'clean' | 'playful' | 'retro'

export type PostSettings = {
  sparkle: number // 0..1, density of glitter specks
  glow: number // 0..1, applied as CSS saturation/brightness on the render root
  vignette: number // 0..1, corner darkening
}

export const POST_PRESETS: Record<PostPreset, PostSettings> = {
  clean: { sparkle: 0.04, glow: 0.1, vignette: 0.25 },
  playful: { sparkle: 0.18, glow: 0.4, vignette: 0.4 },
  retro: { sparkle: 0.32, glow: 0.7, vignette: 0.6 }
}

const SPARKLE_TILE = 160
const SPARKLE_TILES = 5
const SPARKLE_COLORS = ['#ffffff', '#fff2a8', '#a8e6ff', '#ffd0e8']

export function makeSparkleTiles(): HTMLCanvasElement[] {
  const tiles: HTMLCanvasElement[] = []
  for (let t = 0; t < SPARKLE_TILES; t++) {
    const { canvas, ctx } = makeCanvas(SPARKLE_TILE, SPARKLE_TILE)
    const rng = mulberry32(2000 + t)
    const count = 26
    for (let i = 0; i < count; i++) {
      const x = rng() * SPARKLE_TILE
      const y = rng() * SPARKLE_TILE
      const r = 0.6 + rng() * 1.8
      ctx.globalAlpha = 0.4 + rng() * 0.6
      ctx.fillStyle = SPARKLE_COLORS[Math.floor(rng() * SPARKLE_COLORS.length)]
      ctx.beginPath()
      ctx.arc(x, y, r, 0, Math.PI * 2)
      ctx.fill()
    }
    tiles.push(canvas)
  }
  return tiles
}

export type PostFrameState = {
  tiles: HTMLCanvasElement[]
  frame: number
}

// Draw one frame of the sparkle + vignette overlay. Call at ~12Hz for a
// gentle twinkle.
export function drawPostFrame(
  ctx: CanvasRenderingContext2D,
  state: PostFrameState,
  width: number,
  height: number,
  settings: PostSettings
) {
  ctx.clearRect(0, 0, width, height)
  state.frame++
  const rng = mulberry32(state.frame * 7919)

  // Glitter: tile a sparkle tile with a random offset, alpha by density.
  if (settings.sparkle > 0 && state.tiles.length > 0) {
    const tile = state.tiles[state.frame % state.tiles.length]
    ctx.save()
    ctx.globalAlpha = Math.min(1, settings.sparkle * 2.2)
    const ox = -Math.floor(rng() * SPARKLE_TILE)
    const oy = -Math.floor(rng() * SPARKLE_TILE)
    for (let y = oy; y < height; y += SPARKLE_TILE) {
      for (let x = ox; x < width; x += SPARKLE_TILE) {
        ctx.drawImage(tile, x, y)
      }
    }
    ctx.restore()
  }

  // An occasional bright twinkle burst that lives for one frame.
  if (rng() < settings.sparkle) {
    ctx.save()
    ctx.globalAlpha = 0.5 + rng() * 0.4
    ctx.fillStyle = SPARKLE_COLORS[Math.floor(rng() * SPARKLE_COLORS.length)]
    const x = rng() * width
    const y = rng() * height
    const s = 3 + rng() * 4
    ctx.beginPath()
    ctx.moveTo(x, y - s)
    ctx.lineTo(x + s * 0.3, y - s * 0.3)
    ctx.lineTo(x + s, y)
    ctx.lineTo(x + s * 0.3, y + s * 0.3)
    ctx.lineTo(x, y + s)
    ctx.lineTo(x - s * 0.3, y + s * 0.3)
    ctx.lineTo(x - s, y)
    ctx.lineTo(x - s * 0.3, y - s * 0.3)
    ctx.closePath()
    ctx.fill()
    ctx.restore()
  }

  // Soft vignette.
  if (settings.vignette > 0) {
    const gradient = ctx.createRadialGradient(
      width / 2,
      height / 2,
      Math.min(width, height) * 0.5,
      width / 2,
      height / 2,
      Math.max(width, height) * 0.78
    )
    gradient.addColorStop(0, 'rgba(0,0,0,0)')
    gradient.addColorStop(1, `rgba(20,16,32,${0.55 * settings.vignette})`)
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, width, height)
  }
}

// CSS filter string for the render root: saturate and brighten so the ABS
// plastic reads punchy.
export function plasticFilter(settings: PostSettings): string {
  const saturate = 1 + settings.glow * 0.5
  const brightness = 1 + settings.glow * 0.08
  const contrast = 1 + settings.glow * 0.1
  return `saturate(${saturate.toFixed(3)}) brightness(${brightness.toFixed(3)}) contrast(${contrast.toFixed(3)})`
}
