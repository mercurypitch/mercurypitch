// Collectible host acceptance — real PCM, actual rendering and certified course actions.
import type { CDPSession, Locator, Page } from '@playwright/test'
import { expect } from '@playwright/test'
import { SINGING_CURRENT_CRYSTAL_CONTINUOUS_STUDY as course } from '../../../../packages/glass-game/src/runner/crystal-obstacle-study'
import { runnerBeatToSeconds } from '../../../../packages/glass-game/src/runner/tempo'
import { observeCollectibleHost } from './runner-collectible-observation'
import { installRunnerVoice } from './runner-voice-fixture'
import { installHostRasterCheckpoints } from './host-raster-checkpoints'

export const collectibleCourse = course
export const collectiblePickup = course.rewards.pickups[0]!
export const collectibleScaleKey =
  'beside-cue:glass-adventure:collectible-artwork-scale:v1'

export async function openCollectibleCourse(page: Page) {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  // Real raster checkpoints surround voice timing; full-raster GPU runs use the same flow.
  await installHostRasterCheckpoints(
    page,
    '[data-testid="song-runner-scene"]',
    true,
  )
  await installRunnerVoice(page, true, { course, omitRaster: false })
  await observeCollectibleHost(page)
  await page.goto(
    '/glass-game/?layout=singing-current&steering=continuous&camera=angled&obstacles=crystal-study',
  )
  const runner = page.getByTestId('song-runner')
  await expect(runner).toHaveAttribute('data-course-id', course.id)
  await page.waitForFunction(
    () => {
      const buttons = [...document.querySelectorAll('button')]
      return (
        buttons.some(
          (button) =>
            button.textContent?.trim() === 'Start course' && !button.disabled,
        ) ||
        buttons.some(
          (button) => button.textContent?.trim() === 'Retry course view',
        )
      )
    },
    undefined,
    { timeout: 90_000 },
  )
  await expect(
    page.getByRole('button', { name: 'Start course', exact: true }),
    JSON.stringify(errors),
  ).toBeEnabled()
  return { runner, errors }
}

export async function collectibleSettings(page: Page) {
  await page.getByRole('button', { name: 'Open settings', exact: true }).click()
  const settings = page.getByRole('dialog', { name: 'Settings', exact: true })
  await settings.getByRole('tab', { name: 'Advanced', exact: true }).click()
  const range = settings.getByRole('slider', {
    name: 'Artwork size',
    exact: true,
  })
  await expect(range).toBeVisible()
  return { settings, range }
}

export async function touchCollectibleScale(
  cdp: CDPSession,
  range: Locator,
  ratio: number,
) {
  await range.scrollIntoViewIfNeeded()
  const box = (await range.boundingBox())!
  const min = Number(await range.getAttribute('min'))
  const max = Number(await range.getAttribute('max'))
  const current = (Number(await range.inputValue()) - min) / (max - min)
  const point = (value: number) => ({
    id: 1,
    x: box.x + 9 + (box.width - 18) * value,
    y: box.y + box.height / 2,
  })
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [point(current)],
  })
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [point(ratio)],
  })
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchEnd',
    touchPoints: [],
  })
}

export async function waitForCollectibleTime(page: Page, seconds: number) {
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
    seconds,
    { polling: 'raf', timeout: 90_000 },
  )
  await handle.dispose()
  await expect(page.getByTestId('song-runner')).toHaveAttribute(
    'data-phase',
    'running',
  )
  await expect(page.getByTestId('song-runner')).toHaveAttribute(
    'data-recovery-reason',
    '',
  )
}

export function collectibleTimeAtDistance(distance: number) {
  return runnerBeatToSeconds(
    course.tempoSegments,
    distance / course.metersPerBeat,
  )
}

export async function steerToCollectible(page: Page) {
  if (course.movement.kind !== 'continuous')
    throw new Error('Expected continuous study.')
  const target = collectiblePickup.lateralX
  await page.keyboard.down('ArrowLeft')
  try {
    const handle = await page.waitForFunction(
      ({ target, braking }) => {
        const runner = document.querySelector<HTMLElement>(
          '[data-testid="song-runner"]',
        )!
        const x = Number(runner.dataset.lateralX)
        const v = Number(runner.dataset.lateralVelocity)
        return (
          runner.dataset.phase !== 'running' ||
          x + (v * Math.abs(v)) / (2 * braking) <= target
        )
      },
      { target, braking: course.movement.lateralBrakingMetersPerSecondSquared },
      { polling: 'raf', timeout: 5000 },
    )
    await handle.dispose()
  } finally {
    await page.keyboard.up('ArrowLeft')
  }
  const runner = page.getByTestId('song-runner')
  await expect
    .poll(async () =>
      Number(await runner.getAttribute('data-lateral-velocity')),
    )
    .toBe(0)
  expect(
    Math.abs(Number(await runner.getAttribute('data-lateral-x')) - target),
  ).toBeLessThan(0.25)
}
