// Runner slide controls — real course, PCM, mouse capture, keyboard toggles and independent touch contacts.
import { expect, test, type Page } from '@playwright/test'
import { SLIDE_CONTINUOUS_STUDY, SLIDE_LANES_STUDY, } from '../../../packages/glass-game/src/runner/slide-study'
import { installRunnerVoice } from './helpers/runner-voice-fixture'
import { useRunnerControlsRenderer } from './helpers/runner-controls-renderer'

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true })
test.setTimeout(120_000)

async function openSlide(page: Page, mode = 'continuous', theme = 'light') {
  // Keep the real course/audio/physics/control host; isolate GPU scheduling in CI.
  if (process.env.GLASS_SLIDE_REAL_RENDER !== '1')
    await useRunnerControlsRenderer(page)
  await installRunnerVoice(page, true, {
    omitRaster: false,
    course:
      mode === 'continuous'
        ? SLIDE_CONTINUOUS_STUDY.course
        : SLIDE_LANES_STUDY.course,
  })
  await page.goto(
    `/glass-game/?layout=singing-current&steering=${mode}&camera=angled&obstacles=slide-study`,
  )
  const start = page.getByRole('button', { name: 'Start course', exact: true })
  await expect(start).toBeEnabled({ timeout: 60_000 })
  await page.getByRole('button', { name: 'Open settings' }).click()
  const settings = page.getByRole('dialog', { name: 'Settings', exact: true })
  await settings.getByRole('tab', { name: 'Display', exact: true }).click()
  await settings
    .getByRole('button', {
      name: theme === 'dark' ? 'Celadon' : 'Crystal',
      exact: true,
    })
    .click()
  await settings
    .getByRole('button', { name: 'Close settings', exact: true })
    .click()
  await start.click()
  const runner = page.getByTestId('song-runner')
  await expect(runner).toHaveAttribute('data-phase', 'running', {
    timeout: 30_000,
  })
  return {
    runner,
    slide: page.getByRole('button', { name: 'Slide', exact: true }),
  }
}

test('slide follows captured mouse and keyboard holds, then cancels its accessible toggle on pause @smoke', async ({
  page,
}) => {
  const { runner, slide } = await openSlide(page)
  await expect(slide).toBeVisible()
  const box = (await slide.boundingBox())!
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await expect(slide).toHaveAttribute('aria-pressed', 'true')
  await expect(runner).toHaveAttribute('data-slide-phase', 'sliding')
  await page.keyboard.down('ArrowDown')
  await page.keyboard.down('KeyS')
  await page.mouse.move(4, 4)
  await page.mouse.up()
  await page.keyboard.up('ArrowDown')
  await expect(slide).toHaveAttribute('aria-pressed', 'true')
  await page.keyboard.up('KeyS')
  await expect(runner).toHaveAttribute('data-slide-phase', 'standing')
  await expect(slide).toHaveAttribute('aria-pressed', 'false')
  await page.getByRole('button', { name: 'Jump', exact: true }).click()
  await expect(runner).toHaveAttribute('data-player-grounded', 'false')
  await slide.focus()
  await page.keyboard.press('Enter')
  await expect(slide).toHaveAttribute('aria-pressed', 'false')
  await expect(runner).toHaveAttribute('data-player-grounded', 'true')
  // Keyboard activation toggles once; the actual physical stance owns aria-pressed.
  await slide.focus()
  await page.keyboard.press('Enter')
  await expect(runner).toHaveAttribute('data-slide-phase', 'sliding')
  await page.getByRole('button', { name: 'Open settings' }).click()
  await expect(runner).toHaveAttribute('data-phase', 'paused')
  await page.getByRole('button', { name: 'Resume', exact: true }).click()
  await expect(runner).toHaveAttribute('data-phase', 'running', {
    timeout: 30_000,
  })
  await expect(slide).toHaveAttribute('aria-pressed', 'false')
  await slide.focus()
  await page.keyboard.press('Space')
  await expect(runner).toHaveAttribute('data-slide-phase', 'sliding')
  await page.keyboard.press('Space')
  await expect(runner).toHaveAttribute('data-slide-phase', 'standing')
  await page.evaluate(() => window.runnerVoiceFixture.dispose())
})

test('slide and steering retain separate real touch contacts and release on cancellation @smoke', async ({
  page,
  context,
}) => {
  const { runner, slide } = await openSlide(page)
  const steering = page.getByRole('slider', { name: 'Steer Merc' })
  const thumb = (await steering.boundingBox())!
  const button = (await slide.boundingBox())!
  const first = {
    id: 1,
    x: thumb.x + thumb.width / 2,
    y: thumb.y + thumb.height / 2,
  }
  const second = {
    id: 2,
    x: button.x + button.width / 2,
    y: button.y + button.height / 2,
  }
  const moved = { ...first, x: first.x - 30 }
  const cdp = await context.newCDPSession(page)
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [first],
  })
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [moved],
  })
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [moved, second],
  })
  await expect(runner).toHaveAttribute('data-slide-phase', 'sliding')
  await expect(steering).not.toHaveAttribute('aria-valuenow', '0')
  // This pinned Chromium dispatches pointerup for the specified ended contact.
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchEnd',
    touchPoints: [moved],
  })
  await expect(steering).toHaveAttribute('aria-valuenow', '0')
  await expect(slide).toHaveAttribute('aria-pressed', 'true')
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchCancel',
    touchPoints: [],
  })
  await expect(runner).toHaveAttribute('data-slide-phase', 'standing')
  await expect(slide).toHaveAttribute('aria-pressed', 'false')
  await page.evaluate(() => window.runnerVoiceFixture.dispose())
})

test('existing courses keep their original jump target and omit Slide @smoke', async ({
  page,
}) => {
  await useRunnerControlsRenderer(page)
  await installRunnerVoice(page)
  await page.goto('/glass-game/?layout=singing-current&steering=continuous')
  await page.getByRole('button', { name: 'Start course', exact: true }).click()
  const runner = page.getByTestId('song-runner')
  await expect(runner).toHaveAttribute('data-phase', 'running', {
    timeout: 30_000,
  })
  await expect(
    page.getByRole('button', { name: 'Slide', exact: true }),
  ).toHaveCount(0)
  const jump = page.getByRole('button', { name: 'Jump', exact: true })
  expect((await jump.boundingBox())!.width).toBe(82)
  await jump.click()
  await expect(runner).toHaveAttribute('data-player-grounded', 'false')
  await page.evaluate(() => window.runnerVoiceFixture.dispose())
})

for (const mode of ['lanes', 'continuous'])
  for (const theme of ['light', 'dark']) {
    test(`${mode} slide controls fit phone, landscape and tablet in ${theme} @smoke`, async ({
      page,
    }, testInfo) => {
      const { slide } = await openSlide(page, mode, theme)
      const controls = page.getByRole('navigation', { name: 'Course controls' })
      for (const viewport of [
        { width: 320, height: 568 },
        { width: 390, height: 844 },
        { width: 844, height: 390 },
        { width: 1024, height: 768 },
      ]) {
        await page.setViewportSize(viewport)
        await expect(slide).toBeVisible()
        const boxes = await controls
          .locator('button, [role="slider"]')
          .evaluateAll((elements) =>
            elements.map((element) => {
              const rect = element.getBoundingClientRect()
              const hit = document.elementFromPoint(
                rect.x + rect.width / 2,
                rect.y + rect.height / 2,
              )
              return {
                x: rect.x,
                y: rect.y,
                width: rect.width,
                height: rect.height,
                hit: hit !== null && element.contains(hit),
              }
            }),
          )
        for (const box of boxes) {
          expect(box.width).toBeGreaterThanOrEqual(44)
          expect(box.height).toBeGreaterThanOrEqual(44)
          expect(box.x).toBeGreaterThanOrEqual(0)
          expect(box.x + box.width).toBeLessThanOrEqual(viewport.width)
          expect(box.y + box.height).toBeLessThanOrEqual(viewport.height)
          expect(box.hit).toBe(true)
        }
        for (let index = 1; index < boxes.length; index++)
          expect(boxes[index - 1]!.x + boxes[index - 1]!.width).toBeLessThan(
            boxes[index]!.x,
          )
        await page.screenshot({
          path: testInfo.outputPath(
            `slide-${mode}-${theme}-${viewport.width}.png`,
          ),
        })
      }
      await page.evaluate(() => window.runnerVoiceFixture.dispose())
    })
  }
