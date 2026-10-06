// Continuous runner steering — real keyboard, mouse capture and two-finger touch on the running host.

import { expect, test, type Page } from '@playwright/test'
import { useRunnerControlsRenderer } from './helpers/runner-controls-renderer'
import { installRunnerVoice } from './helpers/runner-voice-fixture'
import { useRunnerThreeNoteLayout } from './helpers/runner-score-layout'

test.use({
  viewport: { width: 390, height: 844 },
  hasTouch: true,
  launchOptions: {
    env: { ...process.env, CHROME_DESKTOP: 'agent-browser.desktop' },
    args: [
      '--class=agent-browser',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding',
      '--disable-background-timer-throttling',
    ],
  },
})
test.setTimeout(120_000)

async function openStudy(page: Page) {
  await useRunnerControlsRenderer(page)
  await installRunnerVoice(page)
  await page.goto('/glass-game/?layout=singing-current&steering=continuous')
  const runner = page.getByTestId('song-runner')
  await expect(runner).toHaveAttribute('data-movement-mode', 'continuous')
  const start = page.getByRole('button', { name: 'Start course' })
  await expect(start).toBeEnabled({ timeout: 60_000 })
  await start.click()
  await expect(runner).toHaveAttribute('data-phase', 'running', {
    timeout: 30_000,
  })
  return runner
}

test('continuous steering follows a captured mouse and brakes on release @smoke', async ({
  page,
}) => {
  const runner = await openStudy(page)
  const steering = page.getByRole('slider', { name: 'Steer Merc' })
  const box = (await steering.boundingBox())!
  const origin = { x: box.x + box.width / 2, y: box.y + box.height / 2 }
  const before = Number(await runner.getAttribute('data-lateral-x'))
  await page.mouse.move(origin.x, origin.y)
  await page.mouse.down()
  await page.mouse.move(origin.x + 40, origin.y, { steps: 4 })
  await expect(steering).toHaveAttribute('aria-valuenow', '100')
  await expect
    .poll(async () => Number(await runner.getAttribute('data-lateral-x')))
    .toBeGreaterThan(before + 0.2)
  await page.mouse.up()
  await expect(steering).toHaveAttribute('aria-valuenow', '0')
  await expect
    .poll(async () =>
      Number(await runner.getAttribute('data-lateral-velocity')),
    )
    .toBe(0)
  const stoppedAt = Number(await runner.getAttribute('data-lateral-x'))
  await page.keyboard.down('KeyA')
  await expect
    .poll(async () => Number(await runner.getAttribute('data-lateral-x')))
    .toBeLessThan(stoppedAt - 0.2)
  await page.keyboard.up('KeyA')
  await expect
    .poll(async () =>
      Number(await runner.getAttribute('data-lateral-velocity')),
    )
    .toBe(0)
  await page.getByRole('button', { name: 'Open settings' }).click()
  await expect(steering).toHaveCount(0)
  await expect(runner).toHaveAttribute('data-lateral-velocity', '0.000')
  await page.evaluate(() => window.runnerVoiceFixture.dispose())
})

test('continuous steering keeps jump and a second touch independent, then cancels cleanly @smoke', async ({
  page,
  context,
}) => {
  const runner = await openStudy(page)
  const steering = page.getByRole('slider', { name: 'Steer Merc' })
  const box = (await steering.boundingBox())!
  const jumpBox = (await page
    .getByRole('button', { name: 'Jump', exact: true })
    .boundingBox())!
  const origin = { id: 1, x: box.x + box.width / 2, y: box.y + box.height / 2 }
  const moved = { ...origin, x: origin.x - 40 }
  const jump = {
    id: 2,
    x: jumpBox.x + jumpBox.width / 2,
    y: jumpBox.y + jumpBox.height / 2,
  }
  const cdp = await context.newCDPSession(page)
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [origin],
  })
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [moved],
  })
  await expect(steering).toHaveAttribute('aria-valuenow', '-100')
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [moved, jump],
  })
  await expect(runner).toHaveAttribute('data-player-grounded', 'false')
  await expect(steering).toHaveAttribute('aria-valuenow', '-100')
  // CDP touchMove carries the remaining contacts; touchEnd clears all of them.
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [moved],
  })
  await expect(steering).toHaveAttribute('aria-valuenow', '-100')
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchCancel',
    touchPoints: [],
  })
  await expect(steering).toHaveAttribute('aria-valuenow', '0')
  await expect
    .poll(async () =>
      Number(await runner.getAttribute('data-lateral-velocity')),
    )
    .toBe(0)
  expect(await page.evaluate(() => window.getSelection()?.toString())).toBe('')
  await expect(steering).toHaveCSS('touch-action', 'none')
  await page.evaluate(() => window.runnerVoiceFixture.dispose())
})

test('paused and resumed continuous controls require a fresh keyboard press @smoke', async ({
  page,
}) => {
  const runner = await openStudy(page)
  const steering = page.getByRole('slider', { name: 'Steer Merc' })
  await page.keyboard.down('KeyD')
  await expect(steering).toHaveAttribute('aria-valuenow', '100')
  await page.getByRole('button', { name: 'Open settings' }).click()
  await expect(runner).toHaveAttribute('data-phase', 'paused')
  await expect(steering).toHaveCount(0)
  await expect(runner).toHaveAttribute('data-lateral-velocity', '0.000')
  await page.getByRole('button', { name: 'Resume', exact: true }).click()
  await expect(runner).toHaveAttribute('data-phase', 'running', {
    timeout: 30_000,
  })
  await page.keyboard.down('KeyD')
  await expect(steering).toHaveAttribute('aria-valuenow', '0')
  await page.keyboard.up('KeyD')
  await page.keyboard.down('KeyD')
  await expect(steering).toHaveAttribute('aria-valuenow', '100')
  await page.keyboard.up('KeyD')
  await page.evaluate(() => window.runnerVoiceFixture.dispose())
})

for (const viewport of [
  { width: 320, height: 740 },
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1440, height: 900 },
  { width: 844, height: 390 },
  { width: 844, height: 310 },
]) {
  test(`continuous controls leave room for the note at ${viewport.width}x${viewport.height} @smoke`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize(viewport)
    await openStudy(page)
    const steering = page.getByRole('slider', { name: 'Steer Merc' })
    const jump = page.getByRole('button', { name: 'Jump', exact: true })
    const notation = page.getByLabel('Current melody')
    await expect(notation).toBeVisible()
    const steeringBox = (await steering.boundingBox())!
    const jumpBox = (await jump.boundingBox())!
    const notationBox = (await notation.boundingBox())!
    expect(steeringBox.x).toBeGreaterThanOrEqual(0)
    expect(jumpBox.x + jumpBox.width).toBeLessThanOrEqual(viewport.width)
    expect(steeringBox.x + steeringBox.width).toBeLessThan(jumpBox.x)
    for (const box of [steeringBox, jumpBox]) {
      expect(box.height).toBeGreaterThanOrEqual(44)
      expect(box.y + box.height).toBeLessThanOrEqual(viewport.height)
      expect(
        notationBox.y + notationBox.height <= box.y ||
          notationBox.x + notationBox.width <= box.x ||
          notationBox.x >= box.x + box.width,
      ).toBe(true)
    }
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      ),
    ).toBe(0)
    await expect(steering).toHaveCSS('touch-action', 'none')
    await expect(steering).toHaveCSS('user-select', 'none')
    await expect(jump).toHaveCSS('touch-action', 'none')
    await page.screenshot({
      path: testInfo.outputPath(
        `steering-${viewport.width}x${viewport.height}.png`,
      ),
    })
    await jump.click()
    await expect(page.getByTestId('song-runner')).toHaveAttribute(
      'data-player-grounded',
      'false',
    )
    await page.evaluate(() => window.runnerVoiceFixture.dispose())
  })
}

for (const viewport of [
  { width: 844, height: 310 },
  { width: 740, height: 360 },
]) {
  test(`three-note ribbon keeps Merc visible at ${viewport.width}x${viewport.height} @smoke`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize(viewport)
    await installRunnerVoice(page)
    await useRunnerControlsRenderer(page)
    await useRunnerThreeNoteLayout(page)
    await page.goto('/glass-game/?layout=singing-current&steering=continuous')
    await expect(page.getByTestId('song-runner')).toHaveAttribute(
      'data-phase',
      'running',
    )
    const notation = page.getByLabel('Current melody')
    const panel = (await notation.boundingBox())!
    // Keep the centred character and its jump approach outside the expanded HUD.
    expect(panel.x + panel.width).toBeLessThanOrEqual(viewport.width / 2 - 32)
    const holds = page.getByLabel('Notes and holds').locator(':scope > span')
    await expect(holds).toHaveCount(3)
    for (const hold of await holds.all()) {
      await expect(hold).toHaveText(/[A-G]#?\d\d?\s*\d(?:\.\d)?s/)
      const box = (await hold.boundingBox())!
      expect(box.x).toBeGreaterThanOrEqual(panel.x)
      expect(box.x + box.width).toBeLessThanOrEqual(panel.x + panel.width)
    }
    const steering = (await page
      .getByRole('slider', { name: 'Steer Merc' })
      .boundingBox())!
    expect(panel.y + panel.height).toBeLessThan(steering.y)
    await page.screenshot({
      path: testInfo.outputPath(
        `three-note-clear-${viewport.width}x${viewport.height}.png`,
      ),
    })
    await page.evaluate(() => window.runnerVoiceFixture.dispose())
  })
}

test('ribbon advances to the charged note without losing the complete phrase @smoke', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 740 })
  await installRunnerVoice(page)
  await useRunnerControlsRenderer(page)
  await useRunnerThreeNoteLayout(page, {
    activeNoteIndex: 1,
    fillProgress: 0.4,
  })
  await page.goto('/glass-game/?layout=singing-current&steering=continuous')
  await expect(page.getByTestId('song-runner')).toHaveAttribute(
    'data-phase',
    'running',
  )
  const ribbon = page.getByLabel('Current melody')
  await expect(ribbon).toContainText('2/3')
  await expect(
    ribbon.getByRole('progressbar', { name: 'Note charge' }),
  ).toHaveAttribute('aria-valuenow', '40')
  await expect(
    ribbon.getByLabel('Notes and holds').locator(':scope > span'),
  ).toHaveCount(2)
  await expect(
    ribbon.getByRole('list', { name: 'Complete melody' }).locator('li'),
  ).toHaveCount(3)
  await expect(ribbon).toHaveCSS('pointer-events', 'none')
  await page.evaluate(() => window.runnerVoiceFixture.dispose())
})

for (const viewport of [
  { width: 320, height: 740 },
  { width: 568, height: 320 },
]) {
  test(`compiled glide ribbon fits ${viewport.width}px without crowding the scene @smoke`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize(viewport)
    await installRunnerVoice(page)
    await useRunnerControlsRenderer(page)
    await useRunnerThreeNoteLayout(page, {
      activeNoteIndex: 1,
      fillProgress: 0.4,
      phrase: 'glides',
    })
    await page.goto('/glass-game/?layout=singing-current&pace=current')
    await expect(page.getByTestId('song-runner')).toHaveAttribute(
      'data-phase',
      'running',
    )
    const ribbon = page.getByLabel('Current melody')
    const panel = (await ribbon.boundingBox())!
    await expect(ribbon).toContainText('2/5')
    const notes = ribbon
      .getByLabel('Notes and holds')
      .locator(':scope > span:visible')
    expect(await notes.count()).toBeGreaterThanOrEqual(2)
    const position = ribbon.getByLabel('Note 2 of 5')
    const rightLimit = (await position.boundingBox())!.x
    let previousRight = panel.x
    for (const note of await notes.all()) {
      await expect(note.locator('strong')).toContainText('→')
      const bounds = (await note.locator('strong').boundingBox())!
      expect(bounds.x).toBeGreaterThanOrEqual(previousRight)
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(rightLimit)
      previousRight = bounds.x + bounds.width
    }
    if (viewport.width === 568) {
      await expect(notes).toHaveCount(2)
      await expect(position.locator('strong:visible')).toHaveText('+2')
    }
    await expect(
      ribbon.getByRole('list', { name: 'Complete melody' }).locator('li'),
    ).toHaveCount(5)
    await page.screenshot({
      path: testInfo.outputPath(`glide-ribbon-${viewport.width}px.png`),
    })
  })
}

for (const viewport of [
  { width: 320, height: 740 },
  { width: 568, height: 320 },
]) {
  test(`upcoming compiled glide cue fits ${viewport.width}px @smoke`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize(viewport)
    await installRunnerVoice(page)
    await useRunnerControlsRenderer(page)
    await useRunnerThreeNoteLayout(page, {
      activeNoteIndex: 0,
      fillProgress: 0,
      phrase: 'glides',
      upcoming: true,
    })
    await page.goto('/glass-game/?layout=singing-current&pace=current')
    await expect(page.getByTestId('song-runner')).toHaveAttribute(
      'data-phase',
      'running',
    )
    const cue = page.getByTestId('runner-upcoming-cue')
    await expect(cue).toBeVisible()
    const bounds = (await cue.boundingBox())!
    expect(bounds.x).toBeGreaterThanOrEqual(10)
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(viewport.width - 10)
    const notes = cue
      .getByLabel('Notes and holds')
      .locator(':scope > span:visible')
    let previousRight = bounds.x
    for (const note of await notes.all()) {
      const box = (await note.boundingBox())!
      expect(box.x).toBeGreaterThanOrEqual(previousRight)
      expect(box.x + box.width).toBeLessThanOrEqual(bounds.x + bounds.width)
      previousRight = box.x + box.width
    }
    await page.screenshot({
      path: testInfo.outputPath(`upcoming-glides-${viewport.width}px.png`),
    })
  })
}
