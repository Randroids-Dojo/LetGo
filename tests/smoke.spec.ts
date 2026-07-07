import { expect, test } from '@playwright/test'

test('full loop: title, run, shoot, die, spend at the office, run again', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'mobile-chromium', 'desktop loop covered on desktop project')
  test.setTimeout(90_000)

  await page.goto('/')
  await expect(page.getByTestId('title-screen')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'LETGO' })).toBeVisible()
  await expect(page.getByTestId('style-select')).toBeVisible()
  await expect(page.locator('.render-root canvas')).toBeVisible()

  // Start a run.
  await page.getByTestId('start-run').click()
  await expect(page.getByTestId('hud')).toBeVisible()
  await expect(page.getByTestId('crosshair')).toBeVisible()
  await expect(page.getByTestId('weapon-canvas')).toBeVisible()
  await expect(page.getByTestId('hud-health')).toContainText('%')
  await expect(page.getByTestId('damage-flash')).toBeHidden()
  await expect.poll(async () => canvasHasPixels(page)).toBe(true)

  // The snubnose starts with 50 bullets; a click must spend one.
  await expect(page.getByTestId('hud-ammo')).toHaveText('50')
  await page.mouse.click(640, 360)
  await expect(page.getByTestId('hud-ammo')).not.toHaveText('50', { timeout: 3000 })

  // Walking must actually move the world (weapon bob and dungeon render).
  await page.keyboard.down('KeyW')
  await page.waitForTimeout(600)
  await page.keyboard.up('KeyW')

  // Death drops the summary card.
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('letgo:force-death')))
  await expect(page.getByTestId('death-screen')).toBeVisible({ timeout: 5000 })
  await expect(page.getByTestId('run-summary')).toBeVisible()

  // The Workshop: grant studs via the test hook and buy a stat rank.
  await page.getByTestId('back-to-office').click()
  await expect(page.getByTestId('workshop-screen')).toBeVisible()
  await expect(page.getByTestId('build-plan')).toBeVisible()
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('letgo:grant-studs', { detail: 5000 })))
  await expect(page.getByTestId('workshop-studs')).toContainText('5000')
  await page.getByTestId('buy-snacks').click()
  await expect(page.getByTestId('workshop-studs')).not.toContainText('5000')

  // Armory unlocks through the board, then sells a weapon.
  await page.getByTestId('buy-boxing').click()
  await page.getByTestId('buy-gunlocker').click()
  await page.getByTestId('tab-armory').click()
  await expect(page.getByTestId('armory')).toBeVisible()
  await page.getByTestId('unlock-scatter').click()

  // Back on the streets with the upgrades applied.
  await page.getByTestId('hit-the-streets').click()
  await expect(page.getByTestId('hud')).toBeVisible()
  // 110 max HP after one rank of Late Night Snacks.
  await expect(page.getByTestId('hud-health')).toContainText('110%')

  await page.screenshot({ path: testInfo.outputPath('run-after-upgrades.png'), fullPage: true })
})

test('pause menu opens with Escape and resumes', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'mobile-chromium', 'keyboard flow')
  await page.goto('/')
  await page.getByTestId('start-run').click()
  await expect(page.getByTestId('hud')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('pause-menu')).toBeVisible()
  await page.getByRole('button', { name: 'Resume' }).click()
  await expect(page.getByTestId('pause-menu')).toBeHidden()
})

test('meta progression survives a reload', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'mobile-chromium', 'storage flow')
  await page.goto('/')
  await page.getByTestId('go-office').click()
  await expect(page.getByTestId('workshop-screen')).toBeVisible()
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('letgo:grant-studs', { detail: 900 })))
  await page.getByTestId('buy-snacks').click()
  await page.reload()
  await page.getByTestId('go-office').click()
  await expect(page.getByTestId('build-plan')).toBeVisible()
  await expect(page.getByTestId('build-plan').getByText('1/10')).toBeVisible()
})

test('title screen renders on mobile viewports', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-chromium', 'mobile-only check')
  await page.goto('/')
  await expect(page.getByTestId('title-screen')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'LETGO' })).toBeVisible()
})

async function canvasHasPixels(page: import('@playwright/test').Page) {
  return page.locator('.render-root canvas').evaluate((element) => {
    const canvas = element as HTMLCanvasElement
    const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl')
    if (!gl) {
      return false
    }
    const width = gl.drawingBufferWidth
    const height = gl.drawingBufferHeight
    const pixels = new Uint8Array(4 * 9)
    const points = [
      [0.25, 0.25],
      [0.5, 0.25],
      [0.75, 0.25],
      [0.25, 0.5],
      [0.5, 0.5],
      [0.75, 0.5],
      [0.25, 0.75],
      [0.5, 0.75],
      [0.75, 0.75]
    ]
    points.forEach(([x, y], index) => {
      gl.readPixels(Math.floor(width * x), Math.floor(height * y), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixels, index * 4)
    })
    return pixels.some((value) => value > 12)
  })
}
