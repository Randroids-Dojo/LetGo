// Procedural environment textures: molded plastic bricks in bright toy
// colors. Walls are stacked brick courses with tone jitter per brick, the
// floor is a classic green studded baseplate, and the ceiling is the tube
// side of a big plate.

import {
  BLACK,
  BLUE,
  GOLD,
  GRAY_DARK,
  GRAY_LIGHT,
  GREEN,
  RED,
  SEAM,
  WHITE,
  YELLOW,
  makeCanvas,
  makeRng,
  plasticRect,
  shade,
  stud,
  tube,
  type Ctx
} from './brick'

const SIZE = 256

export type WallTheme = 'classic' | 'castle' | 'space'

export function themeForRing(ring: number): WallTheme {
  const themes: WallTheme[] = ['classic', 'castle', 'space']
  return themes[ring % themes.length]
}

function base(ctx: Ctx, fill: string) {
  ctx.fillStyle = fill
  ctx.fillRect(0, 0, SIZE, SIZE)
}

// Stacked brick courses with a running bond offset and per-brick tone
// jitter, so walls read as built from individual pieces.
function brickCourses(ctx: Ctx, seed: number, color: string, rows: number, minW: number, maxW: number) {
  const rng = makeRng(seed)
  const rowH = SIZE / rows
  for (let r = 0; r < rows; r++) {
    let x = -Math.floor(rng() * maxW * 0.8)
    while (x < SIZE) {
      const w = minW + rng() * (maxW - minW)
      const jitter = (rng() - 0.5) * 0.16
      plasticRect(ctx, x, r * rowH, w, rowH, shade(color, jitter), {
        radius: 2,
        gloss: 0.35,
        outline: SEAM,
        outlineWidth: 2.5
      })
      x += w
    }
  }
}

export function drawClassicWall(seed: number): HTMLCanvasElement {
  const { canvas, ctx } = makeCanvas(SIZE, SIZE)
  base(ctx, shade(RED, -0.35))
  brickCourses(ctx, seed, RED, 5, 60, 110)
  return canvas
}

export function drawCastleWall(seed: number): HTMLCanvasElement {
  const { canvas, ctx } = makeCanvas(SIZE, SIZE)
  base(ctx, shade(GRAY_DARK, -0.3))
  brickCourses(ctx, seed, GRAY_LIGHT, 6, 40, 90)
  // A few mossy green bricks for dungeon age.
  const rng = makeRng(seed ^ 0x51ce)
  const rowH = SIZE / 6
  for (let i = 0; i < 3; i++) {
    const r = Math.floor(rng() * 6)
    const x = rng() * (SIZE - 70)
    plasticRect(ctx, x, r * rowH, 55 + rng() * 25, rowH, shade(GREEN, -0.1 + rng() * 0.2), {
      radius: 2,
      gloss: 0.35,
      outlineWidth: 2.5
    })
  }
  return canvas
}

export function drawSpaceWall(seed: number): HTMLCanvasElement {
  const { canvas, ctx } = makeCanvas(SIZE, SIZE)
  base(ctx, shade(BLUE, -0.4))
  const rng = makeRng(seed)
  // Big smooth panels.
  const rows = 3
  const rowH = SIZE / rows
  for (let r = 0; r < rows; r++) {
    let x = -Math.floor(rng() * 60)
    while (x < SIZE) {
      const w = 90 + rng() * 80
      plasticRect(ctx, x, r * rowH, w, rowH, shade(BLUE, (rng() - 0.4) * 0.2), {
        radius: 3,
        gloss: 0.5,
        outlineWidth: 3
      })
      x += w
    }
  }
  // A glowing greeble strip across the middle panel row.
  const y = rowH * 1.5
  for (let x = 18; x < SIZE; x += 36) {
    ctx.save()
    ctx.beginPath()
    ctx.arc(x, y, 7, 0, Math.PI * 2)
    ctx.fillStyle = rngPick(rng, ['#79e6ff', YELLOW, WHITE])
    ctx.shadowColor = '#79e6ff'
    ctx.shadowBlur = 8
    ctx.fill()
    ctx.restore()
  }
  return canvas
}

function rngPick<T>(rng: () => number, options: T[]): T {
  return options[Math.floor(rng() * options.length)]
}

export function drawWall(theme: WallTheme, seed: number): HTMLCanvasElement {
  return theme === 'classic' ? drawClassicWall(seed) : theme === 'castle' ? drawCastleWall(seed) : drawSpaceWall(seed)
}

// Stamp a piece (stud, tube) at the center of each cell of an 8x8 grid.
function studGrid(ctx: Ctx, draw: (cx: number, cy: number, cell: number) => void) {
  const grid = 8
  const cell = SIZE / grid
  for (let r = 0; r < grid; r++) {
    for (let c = 0; c < grid; c++) {
      draw(c * cell + cell / 2, r * cell + cell / 2, cell)
    }
  }
}

// The floor: a green baseplate with an 8x8 stud grid.
export function drawFloor(seed: number): HTMLCanvasElement {
  const { canvas, ctx } = makeCanvas(SIZE, SIZE)
  const rng = makeRng(seed)
  base(ctx, GREEN)
  // Faint plate seams every 4 studs.
  const cell = SIZE / 8
  ctx.strokeStyle = 'rgba(10, 12, 16, 0.25)'
  ctx.lineWidth = 2
  for (let i = 0; i <= 8; i += 4) {
    ctx.beginPath()
    ctx.moveTo(i * cell, 0)
    ctx.lineTo(i * cell, SIZE)
    ctx.moveTo(0, i * cell)
    ctx.lineTo(SIZE, i * cell)
    ctx.stroke()
  }
  studGrid(ctx, (cx, cy, c) => stud(ctx, cx, cy, c * 0.3, shade(GREEN, (rng() - 0.5) * 0.08)))
  return canvas
}

// The ceiling: the underside of a big dark plate, all tubes.
export function drawCeiling(seed: number): HTMLCanvasElement {
  const { canvas, ctx } = makeCanvas(SIZE, SIZE)
  const rng = makeRng(seed)
  const color = shade(GRAY_DARK, -0.45)
  base(ctx, color)
  studGrid(ctx, (cx, cy, c) => tube(ctx, cx, cy, c * 0.26, shade(color, (rng() - 0.5) * 0.1)))
  return canvas
}

export function drawDoor(locked: boolean, seed: number): HTMLCanvasElement {
  const { canvas, ctx } = makeCanvas(SIZE, SIZE)
  const rng = makeRng(seed)
  const color = locked ? GOLD : YELLOW
  base(ctx, shade(color, -0.4))
  plasticRect(ctx, 6, 6, SIZE - 12, SIZE - 12, color, { radius: 8, gloss: 0.55, outlineWidth: 4 })
  if (locked) {
    // Vault door: stud rivets around the edge and a big padlock.
    for (let i = 0; i < 6; i++) {
      const t = 30 + (i * (SIZE - 60)) / 5
      stud(ctx, t, 26, 9, color)
      stud(ctx, t, SIZE - 26, 9, color)
    }
    ctx.save()
    ctx.strokeStyle = shade(GRAY_DARK, -0.2)
    ctx.lineWidth = 14
    ctx.beginPath()
    ctx.arc(SIZE / 2, SIZE / 2 - 14, 34, Math.PI, Math.PI * 2)
    ctx.stroke()
    plasticRect(ctx, SIZE / 2 - 44, SIZE / 2 - 16, 88, 74, GRAY_DARK, { radius: 10, gloss: 0.5 })
    ctx.fillStyle = BLACK
    ctx.beginPath()
    ctx.arc(SIZE / 2, SIZE / 2 + 12, 10, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillRect(SIZE / 2 - 5, SIZE / 2 + 14, 10, 22)
    ctx.restore()
  } else {
    // Four recessed panels and a gray handle.
    for (const [px, py] of [
      [30, 30],
      [SIZE / 2 + 8, 30],
      [30, SIZE / 2 + 8],
      [SIZE / 2 + 8, SIZE / 2 + 8]
    ]) {
      plasticRect(ctx, px, py, SIZE / 2 - 38, SIZE / 2 - 38, shade(color, (rng() - 0.7) * 0.18), {
        radius: 6,
        gloss: 0.3,
        outlineWidth: 2.5
      })
    }
    plasticRect(ctx, SIZE / 2 - 34, SIZE / 2 - 9, 68, 18, GRAY_LIGHT, { radius: 8, gloss: 0.6 })
  }
  return canvas
}

// The Workshop door back at the start room: bright blue with a sign.
export function drawWorkshopDoor(): HTMLCanvasElement {
  const { canvas, ctx } = makeCanvas(SIZE, SIZE)
  base(ctx, shade(BLUE, -0.4))
  plasticRect(ctx, 6, 6, SIZE - 12, SIZE - 12, BLUE, { radius: 8, gloss: 0.55, outlineWidth: 4 })
  // White sign plate with lettering.
  plasticRect(ctx, 30, 28, SIZE - 60, 116, WHITE, { radius: 6, gloss: 0.35 })
  ctx.fillStyle = BLACK
  ctx.font = 'bold 40px Verdana, Arial, sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText('LETGO', SIZE / 2, 78)
  ctx.font = 'bold 22px Verdana, Arial, sans-serif'
  ctx.fillText('WORKSHOP', SIZE / 2, 112)
  // Yellow stud row under the sign.
  for (let i = 0; i < 5; i++) {
    stud(ctx, 52 + i * 38, 176, 11, YELLOW)
  }
  plasticRect(ctx, SIZE / 2 - 30, SIZE - 52, 60, 16, GRAY_LIGHT, { radius: 8, gloss: 0.6 })
  return canvas
}
