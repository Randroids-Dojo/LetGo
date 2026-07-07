import { expect, test, type Page } from '@playwright/test'

// Touch control coverage (AGENTS.md rule 10): assert the player observably
// moves and turns from stick input, not just that the controls render.

type DebugPos = { x: number; z: number; yaw: number } | null

function debugPos(page: Page): Promise<DebugPos> {
  return page.evaluate(() => {
    const w = window as Window & { letgoDebug?: () => { x: number; z: number; yaw: number } | null }
    return w.letgoDebug ? w.letgoDebug() : null
  })
}

function sendTouch(
  page: Page,
  kind: 'touchstart' | 'touchmove' | 'touchend',
  id: number,
  x: number,
  y: number
): Promise<void> {
  return page.evaluate(
    ({ kind, id, x, y }) => {
      const touch = new Touch({ identifier: id, target: document.body, clientX: x, clientY: y })
      window.dispatchEvent(
        new TouchEvent(kind, {
          changedTouches: [touch],
          touches: kind === 'touchend' ? [] : [touch],
          bubbles: true,
          cancelable: true
        })
      )
    },
    { kind, id, x, y }
  )
}

async function startRun(page: Page) {
  await page.goto('/')
  await page.getByTestId('start-run').tap()
  await expect(page.getByTestId('hud')).toBeVisible()
}

test('touch sticks move the player and turn the camera', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-chromium', 'touch-only flow')
  await startRun(page)
  await expect(page.getByTestId('touch-controls')).toBeVisible()

  const before = await debugPos(page)
  expect(before).not.toBeNull()

  // Hold the move stick pushed up on the left half of the screen.
  await sendTouch(page, 'touchstart', 1, 120, 500)
  await sendTouch(page, 'touchmove', 1, 120, 420)
  await expect(page.locator('.touch-stick')).toBeVisible()
  await expect
    .poll(async () => {
      const now = await debugPos(page)
      return now && before ? Math.hypot(now.x - before.x, now.z - before.z) : 0
    })
    .toBeGreaterThan(0.5)
  await sendTouch(page, 'touchend', 1, 120, 420)

  // Drag the aim stick on the right half; yaw must change.
  const mid = await debugPos(page)
  await sendTouch(page, 'touchstart', 2, 300, 400)
  await sendTouch(page, 'touchmove', 2, 355, 400)
  await expect
    .poll(async () => {
      const now = await debugPos(page)
      return now && mid ? Math.abs(now.yaw - mid.yaw) : 0
    })
    .toBeGreaterThan(0.1)
  await sendTouch(page, 'touchend', 2, 355, 400)
})

test('FIRE button shoots and HUD slots swap weapons', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-chromium', 'touch-only flow')
  await startRun(page)

  await expect(page.getByTestId('hud-ammo')).toHaveText('50')
  await page.getByTestId('touch-fire').tap()
  await expect
    .poll(async () => Number(await page.getByTestId('hud-ammo').textContent()))
    .toBeLessThan(50)

  await page.getByTestId('slot-claws').tap()
  await expect(page.getByTestId('slot-claws')).toHaveClass(/current/)
  await expect(page.getByTestId('hud-ammo')).toHaveText('-')
})

test('status bar fits a phone viewport', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-chromium', 'phone layout check')
  await startRun(page)

  const hud = page.getByTestId('hud')
  expect(await hud.evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true)
  const depth = await page.getByTestId('hud-depth').boundingBox()
  const viewport = page.viewportSize()
  expect(depth).not.toBeNull()
  expect(viewport).not.toBeNull()
  expect(depth!.x + depth!.width).toBeLessThanOrEqual(viewport!.width + 1)
  await page.screenshot({ path: testInfo.outputPath('mobile-hud.png') })
})

test('touch MAP and pause buttons work', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-chromium', 'touch-only flow')
  await startRun(page)

  const mapButton = page.getByTestId('touch-map')
  await expect(mapButton).toHaveAttribute('aria-pressed', 'false')
  await mapButton.tap()
  await expect(mapButton).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByTestId('automap')).toBeVisible()

  await page.getByTestId('touch-pause').tap()
  await expect(page.getByTestId('pause-menu')).toBeVisible()
  await page.getByRole('button', { name: 'Resume' }).tap()
  await expect(page.getByTestId('pause-menu')).toBeHidden()
  await expect(page.getByTestId('touch-controls')).toBeVisible()
})
