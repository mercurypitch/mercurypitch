// Responsive runner cue acceptance — visible pitch and movement prompts drive real controls.
import { expect, test, type Page } from '@playwright/test'
import { SINGING_CURRENT } from '../../../packages/glass-game/src/runner/first-course'
import { installRunnerVoice } from './helpers/runner-voice-fixture'
import { useRunnerControlsRenderer } from './helpers/runner-controls-renderer'

async function expectFullRunnerHeading(
  page: Page,
  expectedStatuses: readonly string[],
): Promise<void> {
  const layout = await page.getByLabel('Current melody').evaluate((panel) => {
    const note = panel.querySelector<HTMLElement>('strong[aria-label]')!
    const prompt = note.parentElement!
    const facts = panel.querySelector<HTMLElement>(
      '[aria-label="Listening status"]',
    )!
    const rectangle = (element: Element) => {
      const { left, top, right, bottom } = element.getBoundingClientRect()
      return { left, top, right, bottom }
    }
    return {
      panel: rectangle(panel),
      prompt: rectangle(prompt),
      note: {
        label: note.textContent,
        width: note.clientWidth,
        contentWidth: note.scrollWidth,
      },
      statuses: [...facts.children].map((badge) => ({
        label: badge.textContent,
        rectangle: rectangle(badge),
        width: badge.clientWidth,
        contentWidth: badge.scrollWidth,
      })),
    }
  })
  expect(layout.note.label).toBe('A#3')
  expect(layout.note.contentWidth).toBeLessThanOrEqual(layout.note.width)
  expect(layout.statuses.map((badge) => badge.label)).toEqual(expectedStatuses)
  for (const [index, badge] of layout.statuses.entries()) {
    expect(badge.contentWidth).toBeLessThanOrEqual(badge.width)
    expect(badge.rectangle.left).toBeGreaterThanOrEqual(layout.panel.left)
    expect(badge.rectangle.right).toBeLessThanOrEqual(layout.panel.right)
    expect(badge.rectangle.top).toBeGreaterThanOrEqual(layout.panel.top)
    expect(badge.rectangle.bottom).toBeLessThanOrEqual(layout.panel.bottom)
    for (const other of [
      layout.prompt,
      ...layout.statuses.slice(0, index).map((item) => item.rectangle),
    ]) {
      const overlapWidth =
        Math.min(badge.rectangle.right, other.right) -
        Math.max(badge.rectangle.left, other.left)
      const overlapHeight =
        Math.min(badge.rectangle.bottom, other.bottom) -
        Math.max(badge.rectangle.top, other.top)
      expect(overlapWidth <= 0 || overlapHeight <= 0).toBe(true)
    }
  }
}

for (const viewport of [
  { width: 320, height: 740 },
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1440, height: 900 },
]) {
  test.describe(`runner note heading ${viewport.width}px`, () => {
    test.use({ viewport, hasTouch: viewport.width < 600 })

    test('full target notes and status badges fit through preparation and listening @smoke', async ({
      page,
    }, testInfo) => {
      test.setTimeout(30_000)
      await useRunnerControlsRenderer(page)
      await installRunnerVoice(page, false, { omitRaster: false })
      await page.goto('/glass-game/?layout=singing-current')
      const start = page.getByRole('button', { name: 'Start course' })
      await expect(start).toBeEnabled()
      await page.getByRole('slider', { name: 'Comfortable note' }).focus()
      await page.keyboard.press('ArrowRight')
      await page.evaluate(() => window.runnerVoiceFixture.silent())
      const runner = page.getByTestId('song-runner')
      try {
        await start.click()
        await expect(runner).toHaveAttribute('data-phase', 'readiness')
        await expectFullRunnerHeading(page, ['Microphone ready', 'Start note'])
        await page.evaluate(() => window.runnerVoiceFixture.tone(58))
        await expect(runner).toHaveAttribute('data-phase', 'count-in')
        await expectFullRunnerHeading(page, [
          'Microphone ready',
          'Scoring opens after count-in',
        ])
        await expect(runner).toHaveAttribute('data-phase', 'running', {
          timeout: 10_000,
        })
        await expect(page.getByLabel('Current melody')).toHaveAttribute(
          'data-voice-phase',
          'listen',
        )
        await expectFullRunnerHeading(page, [
          'Microphone ready',
          'Scoring opens at Sing',
          'Short hold',
        ])
        await page.screenshot({
          path: testInfo.outputPath('runner-full-note-heading.png'),
        })
        await expect(page.getByLabel('Current melody')).toHaveAttribute(
          'data-voice-phase',
          'get-ready',
          { timeout: 10_000 },
        )
        await expectFullRunnerHeading(page, [
          'Microphone ready',
          'Scoring opens at Sing',
          'Short hold',
        ])
      } finally {
        await page.evaluate(() => window.runnerVoiceFixture.dispose())
      }
    })
  })
}

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true })
test.setTimeout(150_000)

test('visible prompts support a corrected note, reacted jumps and course completion @smoke', async ({
  page,
}) => {
  await useRunnerControlsRenderer(page)
  await installRunnerVoice(page)
  await page.goto('/glass-game/?layout=singing-current')
  const runner = page.getByTestId('song-runner')
  const start = page.getByRole('button', { name: 'Start course' })
  await expect(start).toBeEnabled({ timeout: 60_000 })
  await start.click()
  await expect(runner).toHaveAttribute('data-phase', 'running', {
    timeout: 15_000,
  })
  // Readiness used the correct comfortable note. Deliberately start this wall
  // three semitones high, then correct from the same pitch label a player sees.
  await page.evaluate(() => window.runnerVoiceFixture.tone(60))
  const feedback = page.getByLabel('Your voice and target')
  await expect(feedback).toHaveAttribute('data-pitch-state', 'wrong', {
    timeout: 10_000,
  })
  await expect(feedback).toContainText('Sing lower')
  await page.waitForTimeout(250)
  const follower = await page.evaluate(() =>
    window.setInterval(() => {
      const notation = document.querySelector<HTMLElement>(
        '[aria-label="Current melody"]',
      )
      const label =
        notation?.querySelector('[data-pitch-target]')?.textContent ?? ''
      const match = /^([A-G])([#♯b♭]?)(-?\d+)$/.exec(label.trim())
      if (notation?.dataset.voicePhase !== 'sing' || match === null) {
        window.runnerVoiceFixture.silent()
        return
      }
      const offsets: Record<string, number> = {
        C: 0,
        D: 2,
        E: 4,
        F: 5,
        G: 7,
        A: 9,
        B: 11,
      }
      const accidental = /[#♯]/.test(match[2]!)
        ? 1
        : /[b♭]/.test(match[2]!)
          ? -1
          : 0
      window.runnerVoiceFixture.tone(
        (Number(match[3]) + 1) * 12 + offsets[match[1]!]! + accidental,
      )
    }, 30),
  )
  try {
    await expect(page.getByTestId('runner-release-hint')).toBeVisible({
      timeout: 4_000,
    })
    expect(
      Number(await runner.getAttribute('data-course-seconds')),
    ).toBeLessThan(SINGING_CURRENT.targets[0]!.contactCourseSeconds)
    const movement = page.getByTestId('runner-movement-hint')
    for (let stretch = 0; stretch < 2; stretch++) {
      await expect(
        movement.getByText('Change lane', { exact: true }),
      ).toBeVisible({ timeout: 45_000 })
      await expect(
        movement.getByText('Take the open side', { exact: true }),
      ).toBeVisible()
      // Both authored center-lane blockers leave either side open. Choose right
      // consistently here; the separate actual-GPU proof covers reading the
      // opening from the rendered scene.
      await page.waitForTimeout(250)
      await page.getByRole('button', { name: 'Right lane' }).click()
      await expect(
        movement.getByText('Gap ahead', { exact: true }),
      ).toBeVisible({ timeout: 15_000 })
      await expect(
        movement.getByText('Watch the edge', { exact: true }),
      ).toBeVisible()
      await expect(movement.getByText('Jump', { exact: true })).toBeVisible({
        timeout: 8_000,
      })
      await expect(movement.getByText('Now', { exact: true })).toBeVisible()
      // This deliberate reaction delay is inside the visible cue. It does not
      // consult a certified midpoint or bypass the real pointer input path.
      await page.waitForTimeout(250)
      await page.getByRole('button', { name: 'Jump', exact: true }).click()
      const landing = movement.getByText('Landing', { exact: true })
      await expect(landing).toBeVisible()
      await expect(
        movement.getByText('Keep your line', { exact: true }),
      ).toBeVisible()
      await expect(landing).toBeHidden({
        timeout: 3_000,
      })
      // Recenter intentionally after the visible Landing prompt clears so the
      // next identical center-lane stretch begins from its neutral lane.
      await page.getByRole('button', { name: 'Left lane' }).click()
    }
    await expect(runner).toHaveAttribute('data-phase', 'finished', {
      timeout: 45_000,
    })
    await expect(runner).toHaveAttribute('data-hit-targets', '8')
    await expect(runner).toHaveAttribute('data-resolved-targets', '8')
    await expect(runner).toHaveAttribute('data-run-stars', '24')
    await expect(page.getByText('Portrait collected')).toBeVisible()
  } finally {
    await page.evaluate((id) => window.clearInterval(id), follower)
    await page.evaluate(() => window.runnerVoiceFixture.dispose())
  }
})
