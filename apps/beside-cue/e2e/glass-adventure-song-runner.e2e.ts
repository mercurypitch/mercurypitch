// Song runner UI — real mouse, native touch, modal focus, and campaign return paths.

import { expect, test, type BrowserContext, type Locator, type Page, type Route, } from '@playwright/test'
import { MUSEUM_CAMPAIGN } from '../../../packages/glass-game/src/content/campaign'
import { SINGING_CURRENT } from '../../../packages/glass-game/src/runner/first-course'
import { omitRasterOutput } from './helpers/glass-adventure-controls'

interface RunnerVoiceSource {
  context: AudioContext
  gain: GainNode
  oscillator: OscillatorNode
  track: MediaStreamTrack
}

const RUNNER_ROOT_MIDI = 57
const RUNNER_TONE_TARGETS = SINGING_CURRENT.targets.map((target) => ({
  judgeOpenCourseSeconds: target.judgeOpenCourseSeconds,
  judgeCloseCourseSeconds: target.judgeCloseCourseSeconds,
  notes: target.notes.map((note) => ({
    startCourseSeconds: note.startCourseSeconds,
    endCourseSeconds: note.endCourseSeconds,
    startOffsetSemitones: note.startOffsetSemitones,
    endOffsetSemitones: note.endOffsetSemitones,
  })),
}))

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

declare global {
  interface Window {
    runnerVoiceFixture: {
      readonly requests: number
      readonly stoppedTracks: number
      dispose(): Promise<void>
    }
    runnerCourseProbe?: {
      phases: string[]
      frameGaps: { courseSeconds: number; duration: number }[]
      longTasks: { courseSeconds: number; duration: number }[]
    }
  }
}

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

async function installRunnerVoice(
  page: Page,
  followCourse = false,
): Promise<void> {
  await omitRasterOutput(page)
  await page.addInitScript(
    ({ follow, rootMidi, targets }) => {
      const prefix = 'beside-cue:glass-adventure:'
      localStorage.setItem(`${prefix}comfortable-note`, '57')
      localStorage.setItem(`${prefix}runner-music-muted:v1`, 'true')

      let requests = 0
      let stoppedTracks = 0
      const sources: RunnerVoiceSource[] = []
      Object.defineProperty(navigator.mediaDevices, 'getUserMedia', {
        configurable: true,
        value: async (constraints: MediaStreamConstraints) => {
          if (!constraints.audio) return new MediaStream()
          requests++
          const context = new AudioContext()
          await context.resume()
          const oscillator = context.createOscillator()
          oscillator.frequency.value = 220
          const gain = context.createGain()
          gain.gain.value = 0.22
          const destination = context.createMediaStreamDestination()
          oscillator.connect(gain).connect(destination)
          oscillator.start()
          const track = destination.stream.getAudioTracks()[0]!
          const frequency = (midi: number) => 440 * 2 ** ((midi - 69) / 12)
          const targetMidiAt = (courseSeconds: number): number => {
            const target = targets.find(
              (candidate) =>
                courseSeconds >= candidate.judgeOpenCourseSeconds &&
                courseSeconds <= candidate.judgeCloseCourseSeconds,
            )
            if (target === undefined || target.notes.length === 0)
              return rootMidi
            const first = target.notes[0]!
            if (courseSeconds <= first.startCourseSeconds)
              return rootMidi + first.startOffsetSemitones
            const last = target.notes.at(-1)!
            if (courseSeconds >= last.endCourseSeconds)
              return rootMidi + last.endOffsetSemitones
            const note =
              target.notes.find(
                (candidate) =>
                  courseSeconds >= candidate.startCourseSeconds &&
                  courseSeconds <= candidate.endCourseSeconds,
              ) ?? last
            const duration = note.endCourseSeconds - note.startCourseSeconds
            const progress =
              duration <= 0
                ? 1
                : Math.min(
                    1,
                    Math.max(
                      0,
                      (courseSeconds - note.startCourseSeconds) / duration,
                    ),
                  )
            return (
              rootMidi +
              note.startOffsetSemitones +
              (note.endOffsetSemitones - note.startOffsetSemitones) * progress
            )
          }
          const followTimer = follow
            ? window.setInterval(() => {
                const runner = document.querySelector<HTMLElement>(
                  '[data-testid="song-runner"]',
                )
                const courseSeconds = Number(runner?.dataset.courseSeconds)
                const midi = Number.isFinite(courseSeconds)
                  ? targetMidiAt(courseSeconds)
                  : rootMidi
                oscillator.frequency.setValueAtTime(
                  frequency(midi),
                  context.currentTime,
                )
              }, 10)
            : undefined
          const stop = track.stop.bind(track)
          track.stop = () => {
            if (track.readyState === 'ended') return
            stoppedTracks++
            if (followTimer !== undefined) window.clearInterval(followTimer)
            stop()
            oscillator.stop()
            oscillator.disconnect()
            gain.disconnect()
            void context.close()
          }
          sources.push({ context, gain, oscillator, track })
          return destination.stream
        },
      })
      Object.defineProperty(navigator.mediaDevices, 'enumerateDevices', {
        configurable: true,
        value: async () => [
          {
            deviceId: 'runner-test-input',
            groupId: 'runner-test-group',
            kind: 'audioinput',
            label: 'Runner test microphone',
            toJSON: () => ({}),
          },
        ],
      })
      window.runnerVoiceFixture = {
        get requests() {
          return requests
        },
        get stoppedTracks() {
          return stoppedTracks
        },
        async dispose() {
          for (const source of sources)
            if (source.track.readyState === 'live') source.track.stop()
          await Promise.all(
            sources.map((source) =>
              source.context.state === 'closed'
                ? Promise.resolve()
                : source.context.close(),
            ),
          )
        },
      }
    },
    {
      follow: followCourse,
      rootMidi: RUNNER_ROOT_MIDI,
      targets: RUNNER_TONE_TARGETS,
    },
  )
}

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
    const diagnostics = await page.evaluate(() => window.runnerCourseProbe)
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

test('the complete course judges sung targets and clears each obstacle without recovery', async ({
  page,
}, testInfo) => {
  const runner = await openRunningCourse(page, true)
  await runner.evaluate((element) => {
    const phases = [element.dataset.phase ?? 'unknown']
    const frameGaps: { courseSeconds: number; duration: number }[] = []
    const longTasks: { courseSeconds: number; duration: number }[] = []
    const courseSeconds = () => Number(element.dataset.courseSeconds)
    new MutationObserver(() => {
      const phase = element.dataset.phase ?? 'unknown'
      if (phases.at(-1) !== phase) phases.push(phase)
    }).observe(element, {
      attributes: true,
      attributeFilter: ['data-phase'],
    })
    let previousFrame = performance.now()
    const trackFrame = (now: number) => {
      const duration = now - previousFrame
      previousFrame = now
      if (duration >= 100)
        frameGaps.push({ courseSeconds: courseSeconds(), duration })
      requestAnimationFrame(trackFrame)
    }
    requestAnimationFrame(trackFrame)
    if ('PerformanceObserver' in window) {
      const observer = new PerformanceObserver((entries) => {
        for (const entry of entries.getEntries())
          longTasks.push({
            courseSeconds: courseSeconds(),
            duration: entry.duration,
          })
      })
      try {
        observer.observe({ type: 'longtask', buffered: true })
      } catch {
        /* Chromium may omit long-task timing in constrained CI sandboxes. */
      }
    }
    window.runnerCourseProbe = { phases, frameGaps, longTasks }
  })

  const left = page.getByRole('button', { name: 'Left lane' })
  const right = page.getByRole('button', { name: 'Right lane' })
  const jump = page.getByRole('button', { name: 'Jump' })
  const movementHint = page.getByTestId('runner-movement-hint')
  const notation = page.getByLabel('Current melody')

  await expect(movementHint).toContainText('Change lane', { timeout: 30_000 })
  await expect(notation).toHaveCount(0)
  await clickAtCourseSecond(page, runner, right, RUNNER_ACTIONS.firstLaneChange)
  await expect(movementHint).toHaveCount(0)
  await expect(movementHint).toContainText('Jump the gap', { timeout: 10_000 })
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
  await expect(runner).toHaveAttribute('data-course-status', 'finished')
  await expect(runner).toHaveAttribute('data-resolved-targets', '8')
  await expect(runner).toHaveAttribute('data-hit-targets', '8')
  await expect(runner).toHaveAttribute('data-run-stars', '24')
  const timing = await page.evaluate(() => window.runnerCourseProbe)
  const phases = timing?.phases ?? []
  expect(phases).not.toContain('recovering')
  expect(phases).not.toContain('paused')
  expect(phases).not.toContain('error')
  await testInfo.attach('runner-timing.json', {
    body: JSON.stringify(timing, null, 2),
    contentType: 'application/json',
  })

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
