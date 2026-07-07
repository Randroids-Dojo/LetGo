import { expect, test } from '@playwright/test'

// Motion QA (AGENTS.md rule 10): the film grain overlay must visibly change
// pixels over time, not just claim to be animated.
test('film grain overlay actually animates', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'mobile-chromium', 'covered on desktop')
  await page.goto('/')
  await expect(page.getByTestId('post-overlay')).toBeVisible()

  const snapshot = () =>
    page.getByTestId('post-overlay').evaluate((element) => (element as HTMLCanvasElement).toDataURL())

  const first = await snapshot()
  await expect
    .poll(async () => ((await snapshot()) === first ? 'same' : 'changed'), { timeout: 5000 })
    .toBe('changed')
})

// Vintage cut must produce more visible wear than studio cut.
test('film preset changes the overlay density', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'mobile-chromium', 'covered on desktop')
  await page.goto('/')

  const density = () =>
    page.getByTestId('post-overlay').evaluate((element) => {
      const canvas = element as HTMLCanvasElement
      const ctx = canvas.getContext('2d')
      if (!ctx || canvas.width === 0) {
        return 0
      }
      // Sample the center: the corner vignette is identical across presets
      // and would drown out the grain difference.
      const w = Math.min(200, canvas.width)
      const h = Math.min(200, canvas.height)
      const data = ctx.getImageData(Math.floor((canvas.width - w) / 2), Math.floor((canvas.height - h) / 2), w, h).data
      let opaque = 0
      for (let i = 3; i < data.length; i += 4) {
        if (data[i] > 30) {
          opaque++
        }
      }
      return opaque
    })

  await page.getByTestId('style-select').selectOption('clean')
  await page.waitForTimeout(400)
  const studio = await density()
  await page.getByTestId('style-select').selectOption('retro')
  await page.waitForTimeout(400)
  const vintage = await density()
  expect(vintage).toBeGreaterThan(studio)
})
