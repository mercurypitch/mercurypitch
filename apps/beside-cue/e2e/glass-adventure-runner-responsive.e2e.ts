// Responsive runner cue acceptance — visible pitch and movement prompts drive real controls.
import { expect, test } from '@playwright/test'
import { SINGING_CURRENT } from '../../../packages/glass-game/src/runner/first-course'
import { installRunnerVoice } from './helpers/runner-voice-fixture'
import { useRunnerControlsRenderer } from './helpers/runner-controls-renderer'

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
