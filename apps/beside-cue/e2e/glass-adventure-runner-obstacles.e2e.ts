// Crystal obstacle course — real audio and input clear the grounded hurdle without changing existing saves.
import { expect, test } from '@playwright/test'
import { SINGING_CURRENT_CRYSTAL_STUDY } from '../../../packages/glass-game/src/runner/crystal-obstacle-study'
import { useRunnerControlsRenderer } from './helpers/runner-controls-renderer'
import { installRunnerVoice } from './helpers/runner-voice-fixture'
import { runnerCourseActions } from './helpers/runner-course-actions'

const course = SINGING_CURRENT_CRYSTAL_STUDY
const actions = runnerCourseActions(course)
const hurdle = course.obstacles.find(
  (obstacle) => obstacle.id === 'rose-jump-hurdle',
)!
const jump = hurdle.certifiedActions.find((action) => action.kind === 'jump')!
const hurdleTime =
  (jump.launchOpenCourseSeconds + jump.launchCloseCourseSeconds) / 2

test('crystal study clears the rose hurdle with a real jump and finishes its isolated course @smoke', async ({
  page,
}, info) => {
  test.setTimeout(180_000)
  await page.setViewportSize({ width: 390, height: 844 })
  await useRunnerControlsRenderer(page)
  await installRunnerVoice(page, true, { course })
  await page.goto('/glass-game/?layout=singing-current&obstacles=crystal-study')
  const runner = page.getByTestId('song-runner')
  await expect(page.getByRole('button', { name: 'Start course' })).toBeEnabled({
    timeout: 60_000,
  })
  await page.getByRole('button', { name: 'Start course' }).click()
  await expect(runner).toHaveAttribute('data-phase', 'running', {
    timeout: 30_000,
  })
  const commands = [
    { at: actions.firstLaneChange, key: 'ArrowRight' },
    { at: actions.firstJump, key: 'Space' },
    { at: actions.returnToMiddle, key: 'ArrowLeft' },
    { at: hurdleTime, key: 'Space', hurdle: true },
    { at: actions.secondLaneChange, key: 'ArrowRight' },
    { at: actions.secondJump, key: 'Space' },
  ].sort((a, b) => a.at - b.at)
  for (const command of commands) {
    const handle = await page.waitForFunction(
      (at) => {
        const runner = document.querySelector<HTMLElement>(
          '[data-testid="song-runner"]',
        )!
        return (
          runner.dataset.phase !== 'running' ||
          Number(runner.dataset.courseSeconds) >= at
        )
      },
      command.at,
      { polling: 'raf', timeout: 90_000 },
    )
    await handle.dispose()
    await expect(runner).toHaveAttribute('data-phase', 'running')
    if (command.hurdle) {
      await expect(page.getByTestId('runner-movement-hint')).toContainText(
        'Jump',
      )
      await page.screenshot({ path: info.outputPath('rose-hurdle-cue.png') })
    }
    await page.keyboard.press(command.key)
    if (command.hurdle)
      await expect(runner).toHaveAttribute('data-player-grounded', 'false')
  }
  await expect(runner).toHaveAttribute('data-phase', 'finished', {
    timeout: 90_000,
  })
  await expect(runner).toHaveAttribute(
    'data-hit-targets',
    String(course.targets.length),
  )
  const saves = await page.evaluate(() =>
    Object.keys(localStorage).filter((key) => key.includes('runner-progress:')),
  )
  expect(saves).toEqual([
    `beside-cue:glass-adventure:runner-progress:v1:${course.id}`,
  ])
  await page.evaluate(() => window.runnerVoiceFixture.dispose())
})
