// Song runner UI — real mouse, native touch, modal focus, and campaign return paths.

import { expect, test, type BrowserContext, type Locator, type Page, type Route, } from '@playwright/test'
import { MUSEUM_CAMPAIGN } from '../../../packages/glass-game/src/content/campaign'
import { SINGING_CURRENT } from '../../../packages/glass-game/src/runner/first-course'
import { readSavedRunnerProgress } from '../../../packages/glass-game/src/runner/progress'
import { omitRasterOutput } from './helpers/glass-adventure-controls'
import { installRunnerVoice } from './helpers/runner-voice-fixture'
import { createRunnerCourseProbe, useRunnerControlsRenderer, } from './helpers/runner-controls-renderer'
import { verifyRunnerRendererStreaming } from './helpers/runner-renderer-smoke'

function runnerActionSecond(
  obstacleId: string,
  kind: 'lane-transition' | 'jump',
): number {
  const obstacle = SINGING_CURRENT.obstacles.find(
    (candidate) => candidate.id === obstacleId,
  )
  const window = obstacle?.certifiedActions.find(
    (candidate) => candidate.kind === kind,
  )
  if (window === undefined)
    throw new Error(`Missing ${kind} window for ${obstacleId}.`)
  return (window.launchOpenCourseSeconds + window.launchCloseCourseSeconds) / 2
}

const RUNNER_ACTIONS = {
  firstLaneChange: runnerActionSecond('first-lane-gate', 'lane-transition'),
  firstJump: runnerActionSecond('first-jump', 'jump'),
  returnToMiddle: 17,
  secondLaneChange: runnerActionSecond('second-lane-gate', 'lane-transition'),
  secondJump: runnerActionSecond('second-jump', 'jump'),
} as const

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
      '--use-gl=angle',
      '--use-angle=swiftshader',
      '--enable-unsafe-swiftshader',
    ],
  },
})
test.setTimeout(180_000)

async function openRunningCourse(
  page: Page,
  followCourse = false,
): Promise<Locator> {
  await installRunnerVoice(page, followCourse)
  const response = await page.goto('/glass-game/?layout=singing-current')
  expect(response?.status()).toBe(200)
  const runner = page.getByTestId('song-runner')
  await expect(runner).toBeVisible()
  const start = page.getByRole('button', { name: 'Start course' })
  await expect(start).toBeEnabled({ timeout: 90_000 })
  await expect(start).toBeFocused()
  await start.click()
  await expect(runner).toHaveAttribute('data-phase', 'running', {
    timeout: 60_000,
  })
  return runner
}

async function clickAtCourseSecond(
  page: Page,
  runner: Locator,
  control: Locator,
  courseSeconds: number,
): Promise<void> {
  const sample = await page
    .waitForFunction(
      (wantedSeconds) => {
        const element = document.querySelector<HTMLElement>(
          '[data-testid="song-runner"]',
        )
        const phase = element?.dataset.phase ?? 'missing'
        const currentSeconds = Number(element?.dataset.courseSeconds)
        if (phase !== 'running')
          return {
            ready: false,
            phase,
            reason: element?.dataset.recoveryReason ?? '',
            currentSeconds,
          }
        return currentSeconds >= wantedSeconds
          ? { ready: true, phase, reason: '', currentSeconds }
          : null
      },
      courseSeconds,
      { polling: 'raf', timeout: 100_000 },
    )
    .then((handle) => handle.jsonValue())
  if (!sample.ready) {
    const diagnostics = await page.evaluate(() => {
      const probe = window.runnerCourseProbe
      if (probe === undefined) return undefined
      return {
        phases: probe.phases,
        frameGaps: probe.frameGaps.slice(-8),
        longTasks: probe.longTasks.slice(-8),
        pitchFeedbackSamples: probe.pitchFeedback.length,
        pitchFeedbackDropped: probe.pitchFeedbackDropped,
        lastPitchFeedback: probe.pitchFeedback.at(-1),
        runnerElementConnected: probe.runnerElementConnected,
        runnerDisconnectedAtCourseSeconds:
          probe.runnerDisconnectedAtCourseSeconds,
      }
    })
    throw new Error(
      `Course stopped at ${sample.currentSeconds}s (${sample.phase}${sample.reason ? `: ${sample.reason}` : ''}); timing=${JSON.stringify(diagnostics)}.`,
    )
  }
  const bounds = await control.boundingBox()
  expect(bounds).not.toBeNull()
  await page.mouse.click(
    bounds!.x + bounds!.width / 2,
    bounds!.y + bounds!.height / 2,
  )
}

async function touchPoints(
  context: BrowserContext,
  page: Page,
  points: readonly { id: number; locator: Locator }[],
): Promise<void> {
  const resolved = await Promise.all(
    points.map(async ({ id, locator }) => {
      const bounds = await locator.boundingBox()
      expect(bounds).not.toBeNull()
      return {
        id,
        x: bounds!.x + bounds!.width / 2,
        y: bounds!.y + bounds!.height / 2,
      }
    }),
  )
  const cdp = await context.newCDPSession(page)
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: resolved,
  })
  await expect
    .poll(() =>
      page.getByTestId('song-runner').getAttribute('data-player-grounded'),
    )
    .toBe('false')
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchCancel',
    touchPoints: [],
  })
}

test('runner controls keep real mouse and simultaneous touch edges independent @smoke', async ({
  page,
  context,
}) => {
  const runner = await openRunningCourse(page)
  const left = page.getByRole('button', { name: 'Left lane' })
  const right = page.getByRole('button', { name: 'Right lane' })
  const jump = page.getByRole('button', { name: 'Jump' })

  await left.click()
  await expect(runner).toHaveAttribute('data-target-lane', '0')
  await right.click()
  await expect(runner).toHaveAttribute('data-target-lane', '1')

  await touchPoints(context, page, [
    { id: 1, locator: left },
    { id: 2, locator: jump },
  ])
  await expect(runner).toHaveAttribute('data-target-lane', '0')
  await expect(runner).toHaveAttribute('data-player-grounded', 'false')

  await expect
    .poll(async () => runner.getAttribute('data-player-grounded'), {
      timeout: 5_000,
    })
    .toBe('true')
  const rightBounds = await right.boundingBox()
  expect(rightBounds).not.toBeNull()
  const cdp = await context.newCDPSession(page)
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [
      {
        id: 3,
        x: rightBounds!.x + rightBounds!.width / 2,
        y: rightBounds!.y + rightBounds!.height / 2,
      },
    ],
  })
  await expect(runner).toHaveAttribute('data-target-lane', '1')
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchCancel',
    touchPoints: [],
  })

  const geometry = await page.evaluate(() => {
    const staff = document.querySelector<HTMLElement>(
      '[aria-label="Current melody"]',
    )
    const controls = document.querySelector<HTMLElement>(
      '[aria-label="Course controls"]',
    )
    const buttons = [
      ...document.querySelectorAll<HTMLButtonElement>('[data-action]'),
    ]
    const staffBox = staff?.getBoundingClientRect()
    const controlsBox = controls?.getBoundingClientRect()
    return {
      overflow: document.documentElement.scrollWidth - window.innerWidth,
      overlap:
        staffBox !== undefined &&
        controlsBox !== undefined &&
        staffBox.bottom > controlsBox.top,
      buttons: buttons.map((button) => {
        const box = button.getBoundingClientRect()
        return { width: box.width, height: box.height }
      }),
    }
  })
  expect(geometry.overflow).toBeLessThanOrEqual(0)
  expect(geometry.overlap).toBe(false)
  expect(
    geometry.buttons.every(
      (button) => button.width >= 44 && button.height >= 44,
    ),
  ).toBe(true)

  await page.evaluate(() => window.runnerVoiceFixture.dispose())
})

test('the real renderer installs and retires streamed chunks without graphics errors', async ({
  page,
}) => {
  await verifyRunnerRendererStreaming(page)
})

test('live singing shows wrong, accepted and silent PCM without stale feedback after pause @smoke', async ({
  page,
}) => {
  await useRunnerControlsRenderer(page)
  const runner = await openRunningCourse(page)
  const feedback = page.getByLabel('Your voice and target')
  const presentation = page.getByTestId('runner-controls-presentation')
  await page.evaluate(() => window.runnerVoiceFixture.tone(60))
  await expect(feedback).toHaveAttribute('data-pitch-state', 'wrong', {
    timeout: 15_000,
  })
  await expect(feedback.locator('[data-pitch-target]')).toHaveText('A3')
  await expect(feedback.locator('[data-pitch-observed]')).toHaveText('C4')
  await expect(feedback).toContainText('Sing lower')
  expect(Number(await presentation.getAttribute('data-fill'))).toBe(0)
  await expect(feedback).toHaveAttribute('aria-live', 'off')

  await page.evaluate(() => window.runnerVoiceFixture.tone(57))
  await expect(feedback).toHaveAttribute('data-pitch-state', 'accepted')
  await expect(feedback.locator('[data-pitch-observed]')).toHaveText('A3')
  await expect(feedback).toContainText('Matched')
  await expect
    .poll(async () => Number(await presentation.getAttribute('data-fill')))
    .toBeGreaterThan(0)

  await page.evaluate(() => window.runnerVoiceFixture.silent())
  await expect(feedback).toHaveAttribute('data-pitch-state', 'neutral')
  await expect(feedback.locator('[data-pitch-observed]')).toHaveCount(0)
  await expect(feedback).toContainText('Listening')
  await page.getByRole('button', { name: 'Pause course' }).click()
  await expect(runner).toHaveAttribute('data-phase', 'paused')
  await page.evaluate(() => window.runnerVoiceFixture.followTarget())
  await page.getByRole('button', { name: 'Resume', exact: true }).click()
  await expect(runner).toHaveAttribute('data-phase', 'running', {
    timeout: 60_000,
  })
  // Resume rewinds to the safe checkpoint before this phrase. No captured
  // note from the previous microphone epoch may survive that restart.
  await expect(page.locator('[data-pitch-observed]')).toHaveCount(0)
  await expect(feedback).toHaveAttribute('data-pitch-state', 'neutral')
  await page.evaluate(() => window.runnerVoiceFixture.dispose())
})

for (const viewport of [
  { width: 320, height: 740 },
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1440, height: 900 },
  { width: 740, height: 360 },
]) {
  test(`pitch readout leaves the course and controls clear at ${viewport.width}x${viewport.height} @smoke`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport)
    await useRunnerControlsRenderer(page)
    await openRunningCourse(page)
    await page.evaluate(() => window.runnerVoiceFixture.tone(60))
    const feedback = page.getByLabel('Your voice and target')
    await expect(feedback).toHaveAttribute('data-pitch-state', 'wrong', {
      timeout: 15_000,
    })
    const boxes = await page.evaluate(() => {
      const box = (selector: string) =>
        document.querySelector(selector)!.getBoundingClientRect().toJSON()
      return {
        notation: box('[aria-label="Current melody"]'),
        controls: box('[aria-label="Course controls"]'),
        readout: box('[aria-label="Your voice and target"]'),
        overflow: document.documentElement.scrollWidth - window.innerWidth,
      }
    })
    expect(boxes.overflow).toBeLessThanOrEqual(0)
    expect(boxes.readout.left).toBeGreaterThanOrEqual(0)
    expect(boxes.readout.right).toBeLessThanOrEqual(viewport.width)
    expect(
      boxes.notation.bottom < boxes.controls.top ||
        boxes.notation.right < boxes.controls.left,
    ).toBe(true)
    expect(boxes.notation.height).toBeLessThan(viewport.height * 0.48)
    await page.screenshot({
      path: test
        .info()
        .outputPath(`pitch-${viewport.width}x${viewport.height}.png`),
    })
    await page.evaluate(() => window.runnerVoiceFixture.dispose())
  })
}

test('pause traps focus and resumed controls are rearmed @smoke', async ({
  page,
}) => {
  const runner = await openRunningCourse(page)
  await page.getByRole('button', { name: 'Pause course' }).click()
  await expect(runner).toHaveAttribute('data-phase', 'paused')
  await expect(runner).toHaveAttribute('data-microphone', 'closed')
  const dialog = page.getByRole('dialog', { name: 'Course paused' })
  await expect(dialog).toBeVisible()
  const resume = dialog.getByRole('button', { name: 'Resume' })
  await expect(resume).toBeFocused()
  await page.keyboard.press('Shift+Tab')
  expect(
    await dialog.evaluate((element) =>
      element.contains(document.activeElement),
    ),
  ).toBe(true)
  await resume.click()
  await expect(runner).toHaveAttribute('data-phase', 'running', {
    timeout: 60_000,
  })
  await expect(runner).toHaveAttribute('data-microphone', 'ready')

  const before = Number(await runner.getAttribute('data-target-lane'))
  const action = before < 2 ? 'Right lane' : 'Left lane'
  await page.getByRole('button', { name: action }).click()
  await expect
    .poll(async () => Number(await runner.getAttribute('data-target-lane')))
    .toBe(before < 2 ? before + 1 : before - 1)
  expect(
    await page.evaluate(() => window.runnerVoiceFixture.requests),
  ).toBeGreaterThanOrEqual(1)
  await page.evaluate(() => window.runnerVoiceFixture.dispose())
})

test('a fall waits at the checkpoint for an explicit resume gesture @smoke', async ({
  page,
}) => {
  const runner = await openRunningCourse(page)
  const right = page.getByRole('button', { name: 'Right lane' })
  await clickAtCourseSecond(page, runner, right, RUNNER_ACTIONS.firstLaneChange)

  await expect(runner).toHaveAttribute('data-phase', 'recovering', {
    timeout: 45_000,
  })
  await expect(runner).toHaveAttribute('data-microphone', 'closed')
  await expect(runner).toHaveAttribute('data-recovery-reason', 'fall')
  const dialog = page.getByRole('dialog', { name: 'Try that stretch again' })
  const resume = dialog.getByRole('button', {
    name: 'Resume from checkpoint',
  })
  await expect(resume).toBeFocused()
  await page.keyboard.press('Shift+Tab')
  expect(
    await dialog.evaluate((element) =>
      element.contains(document.activeElement),
    ),
  ).toBe(true)
  await resume.click()
  await expect(runner).toHaveAttribute('data-phase', 'running', {
    timeout: 60_000,
  })
  await expect(runner).toHaveAttribute('data-microphone', 'ready')
  await page.evaluate(() => window.runnerVoiceFixture.dispose())
})

test('context loss pauses, retries the view, and waits for explicit resume @smoke', async ({
  page,
}) => {
  const runner = await openRunningCourse(page)
  const requestsBeforeLoss = await page.evaluate(
    () => window.runnerVoiceFixture.requests,
  )
  const canvas = page.getByLabel(
    'The Singing Current, three paths through floating glass',
  )

  await canvas.evaluate((element) =>
    element.dispatchEvent(new Event('webglcontextlost', { cancelable: true })),
  )
  await expect(runner).toHaveAttribute('data-phase', 'paused')
  await expect(runner).toHaveAttribute('data-microphone', 'closed')
  await expect(
    page.getByText('The graphics stopped. Retry to return to your checkpoint.'),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Retry course view' }).click()
  const resume = page.getByRole('button', { name: 'Resume' })
  await expect(resume).toBeEnabled({ timeout: 90_000 })
  expect(await page.evaluate(() => window.runnerVoiceFixture.requests)).toBe(
    requestsBeforeLoss,
  )
  await resume.click()
  await expect(runner).toHaveAttribute('data-phase', 'running', {
    timeout: 60_000,
  })
  await expect(runner).toHaveAttribute('data-microphone', 'ready')
  expect(
    await page.evaluate(() => window.runnerVoiceFixture.requests),
  ).toBeGreaterThanOrEqual(requestsBeforeLoss)
  await page.evaluate(() => window.runnerVoiceFixture.dispose())
})

test('a missing required asset leaves an honest retryable start screen @smoke', async ({
  page,
}) => {
  const missingMerc = /\/glass3d\/merc-v2\.glb(?:\?.*)?$/
  const failMerc = (route: Route) =>
    route.fulfill({ status: 404, contentType: 'application/octet-stream' })
  await page.route(missingMerc, failMerc)
  const response = await page.goto('/glass-game/?layout=singing-current')
  expect(response?.status()).toBe(200)

  await expect(
    page.getByText(
      'The scene could not load. Check your connection and retry.',
    ),
  ).toBeVisible({ timeout: 30_000 })
  await expect(
    page.getByRole('button', { name: 'Start course' }),
  ).toBeDisabled()
  await expect(
    page.getByRole('button', { name: 'Retry course view' }),
  ).toBeVisible()
})

test('runner unlock follows First Light and Leave returns to the campaign @smoke', async ({
  page,
}) => {
  await omitRasterOutput(page)
  await page.addInitScript(() =>
    localStorage.setItem('beside-cue:glass-adventure:tutorial', 'seen'),
  )
  await page.goto('/glass-game/?campaign=1&progression=earned')
  const locked = page.getByRole('button', {
    name: 'Finish First Light to unlock',
  })
  await expect(locked).toBeDisabled()

  const prologue = MUSEUM_CAMPAIGN[0]!.level
  await page.evaluate(
    (level) =>
      localStorage.setItem(
        `beside-cue:glass-adventure:progress:${level.id}`,
        JSON.stringify({
          version: 2,
          levelId: level.id,
          checkpointId: level.spawn.checkpointId,
          completedBreakableIds: level.breakables.map((item) => item.id),
          finished: true,
        }),
      ),
    prologue,
  )
  await page.reload()
  const entry = page.getByRole('button', { name: 'Play The Singing Current' })
  await expect(entry).toBeEnabled()
  await entry.click()
  const runner = page.getByTestId('song-runner')
  await expect(runner).toBeVisible({
    timeout: 60_000,
  })
  const leave = page
    .getByRole('dialog', { name: 'Ready when you are' })
    .getByRole('button', { name: 'Leave course' })
  const start = page.getByRole('button', { name: 'Start course' })
  await expect(start).toBeEnabled({ timeout: 90_000 })
  await start.focus()
  await page.keyboard.press('Tab')
  await expect(leave).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(entry).toBeVisible({ timeout: 60_000 })
  await expect(runner).toHaveCount(0)
})

test('the complete audio and control course judges every phrase and obstacle without recovery', async ({
  page,
}, testInfo) => {
  const courseProbe = createRunnerCourseProbe(page)
  // Keep real PCM, capture, audio time, UI input, movement, judging and saves.
  // Software raster throughput is not an audio/control contract. The other
  // cases keep the real renderer; streaming and full hardware art have their
  // own checks, without weakening the production 250ms recovery threshold.
  await useRunnerControlsRenderer(page)
  const runner = await openRunningCourse(page, true)
  const presentation = page.getByTestId('runner-controls-presentation')
  await expect(presentation).toHaveCount(1)
  await courseProbe.install(runner)

  const left = page.getByRole('button', { name: 'Left lane' })
  const right = page.getByRole('button', { name: 'Right lane' })
  const jump = page.getByRole('button', { name: 'Jump' })
  const movementHint = page.getByTestId('runner-movement-hint')
  const notation = page.getByLabel('Current melody')

  try {
    await expect(movementHint).toContainText('Change lane', { timeout: 30_000 })
    await expect(notation).toHaveCount(0)
    await clickAtCourseSecond(
      page,
      runner,
      right,
      RUNNER_ACTIONS.firstLaneChange,
    )
    await expect(movementHint).toHaveCount(0)
    await expect(movementHint).toContainText('Jump the gap', {
      timeout: 10_000,
    })
    await clickAtCourseSecond(page, runner, jump, RUNNER_ACTIONS.firstJump)
    await expect(movementHint).toHaveCount(0)
    await expect(notation).toBeVisible({ timeout: 10_000 })
    await clickAtCourseSecond(page, runner, left, RUNNER_ACTIONS.returnToMiddle)
    await clickAtCourseSecond(
      page,
      runner,
      right,
      RUNNER_ACTIONS.secondLaneChange,
    )
    await clickAtCourseSecond(page, runner, jump, RUNNER_ACTIONS.secondJump)

    await expect(runner).toHaveAttribute('data-phase', 'finished', {
      timeout: 100_000,
    })
  } catch (error) {
    await courseProbe.attach(testInfo)
    throw error
  }
  const timing = await courseProbe.attach(testInfo)
  await expect(runner).toHaveAttribute('data-course-status', 'finished')
  await expect(presentation).toHaveAttribute('data-status', 'finished')
  expect(
    Number(await presentation.getAttribute('data-course-seconds')),
  ).toBeCloseTo(SINGING_CURRENT.lengthCourseSeconds, 3)
  await expect(runner).toHaveAttribute('data-resolved-targets', '8')
  await expect(runner).toHaveAttribute('data-hit-targets', '8')
  await expect(runner).toHaveAttribute('data-run-stars', '24')
  const saved = readSavedRunnerProgress(
    SINGING_CURRENT,
    await page.evaluate(
      (id) =>
        JSON.parse(
          localStorage.getItem(
            `beside-cue:glass-adventure:runner-progress:v1:${id}`,
          ) ?? 'null',
        ),
      SINGING_CURRENT.id,
    ),
  )
  expect(saved.completed).toBe(true)
  expect(
    saved.bestTargetQualities.map((quality) => quality.targetId).sort(),
  ).toEqual(SINGING_CURRENT.targets.map((target) => target.id).sort())
  expect(
    saved.bestTargetQualities.every((quality) => quality.grade === 3),
  ).toBe(true)
  expect(saved.collectedRewardIds).toEqual(
    expect.arrayContaining(SINGING_CURRENT.rewards.finishRewardIds),
  )
  expect(saved.collectedRewardIds).toHaveLength(
    SINGING_CURRENT.rewards.finishRewardIds.length + 1,
  )
  const phases = timing?.phases ?? []
  expect(phases).not.toContain('recovering')
  expect(phases).not.toContain('paused')
  expect(phases).not.toContain('error')
  expect(timing?.runnerElementConnected).toBe(true)
  expect(timing?.runnerDisconnectedAtCourseSeconds).toBeNull()
  expect(timing?.pitchFeedbackDropped).toBe(0)

  const acceptedPitchFeedback = (timing?.pitchFeedback ?? []).filter(
    (sample) =>
      sample.state === 'accepted' &&
      sample.targetPhase === 'judging' &&
      sample.targetLabel !== '' &&
      sample.observedLabel !== '' &&
      sample.comparedTargetMidi !== null &&
      sample.observedMidi !== null,
  )
  for (const target of SINGING_CURRENT.targets)
    expect(
      acceptedPitchFeedback.filter((sample) => sample.targetId === target.id),
      `${target.id} should publish accepted pitch labels during judging`,
    ).not.toHaveLength(0)

  const sequentialPitchFeedback = acceptedPitchFeedback.filter(
    (sample) => sample.targetId === 'two-note-window',
  )
  expect(
    new Set(sequentialPitchFeedback.map((sample) => sample.noteIndex)),
  ).toEqual(new Set([0, 1]))
  expect(
    new Set(sequentialPitchFeedback.map((sample) => sample.targetLabel)).size,
  ).toBeGreaterThanOrEqual(2)

  const glideTarget = SINGING_CURRENT.targets.find(
    (target) => target.id === 'arc-diadem',
  )
  expect(glideTarget).toBeDefined()
  const glideNoteIndices = new Set(
    glideTarget!.notes
      .filter((note) => note.connection === 'glide')
      .map((note) => note.index),
  )
  const glidePitchFeedback = acceptedPitchFeedback.filter(
    (sample) =>
      sample.targetId === glideTarget!.id &&
      sample.noteIndex !== null &&
      glideNoteIndices.has(sample.noteIndex),
  )
  expect(glidePitchFeedback.length).toBeGreaterThan(1)
  expect(
    new Set(
      glidePitchFeedback.map((sample) => sample.comparedTargetMidi!.toFixed(2)),
    ).size,
  ).toBeGreaterThan(1)
  expect(
    acceptedPitchFeedback.some((sample) => sample.targetId === 'melody-finale'),
  ).toBe(true)

  await expect(page.getByText('Portrait collected')).toBeVisible()
  await expect(
    page.getByRole('img', { name: /imaginary singing muse/i }),
  ).toBeVisible()
  const pickups = page.getByText('Pickups').locator('..')
  await expect(pickups).toContainText('1 / 4')
  const finishDialog = page.getByRole('dialog', {
    name: 'The current carried you through',
  })
  const assertFinishFits = async () => {
    const geometry = await finishDialog.evaluate((element) => {
      const box = element.getBoundingClientRect()
      return {
        bottom: box.bottom,
        documentOverflow:
          document.documentElement.scrollWidth - window.innerWidth,
        height: box.height,
        scrollHeight: element.scrollHeight,
        top: box.top,
        viewportHeight: window.innerHeight,
      }
    })
    expect(geometry.documentOverflow).toBeLessThanOrEqual(0)
    expect(geometry.top).toBeGreaterThanOrEqual(0)
    expect(geometry.bottom).toBeLessThanOrEqual(geometry.viewportHeight)
    expect(geometry.scrollHeight).toBeLessThanOrEqual(geometry.height + 1)
  }
  await assertFinishFits()
  const finish390 = testInfo.outputPath('song-runner-finish-390.png')
  await page.screenshot({ path: finish390 })
  await testInfo.attach('song-runner-finish-390', {
    path: finish390,
    contentType: 'image/png',
  })

  await page.setViewportSize({ width: 320, height: 568 })
  await assertFinishFits()
  const finish320 = testInfo.outputPath('song-runner-finish-320.png')
  await page.screenshot({ path: finish320 })
  await testInfo.attach('song-runner-finish-320', {
    path: finish320,
    contentType: 'image/png',
  })
  await page.evaluate(() => window.runnerVoiceFixture.dispose())
})
