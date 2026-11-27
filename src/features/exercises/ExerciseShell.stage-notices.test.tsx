// ============================================================
// ExerciseShell: the app's notices in Merc's bubble
// ============================================================
//
// While a drill's stage is on screen in the web build, the app's notices,
// achievements among them, are said one at a time in Merc's bubble, as the
// take's notice is, and the toasts draw nothing. These pin the order the
// bubble gives them (stage/stage-notice.ts `bubbleNotice`): a warning or an
// error, then the example's line, then any other notice, then the take's,
// then the run's instruction or the brief; that a run holds the calmer
// notices back; that while the take's question has the bubble, an
// achievement waits for it and every other notice is a toast at once; and
// that leaving the drill hands what is left to the toasts. The store's part
// is pinned in src/stores/notifications-stage.test.ts.

import { cleanup, fireEvent, render } from '@solidjs/testing-library'
import { createSignal, Show } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Notifications } from '@/components/Notifications'
import type { ExerciseVoiceCaptureController, ExerciseVoiceCaptureState, } from '@/lib/domain/exercise-voice-capture'
import { encodeVoiceAtlasContour } from '@/lib/voice-contour'
import { notifications, resetNotifications, showActionNotification, showNotification, } from '@/stores/notifications-store'
import type { ExerciseDemo } from './ExerciseShell'
import { DEMO_LINE_MIN_MS, ExerciseShell } from './ExerciseShell'
import { STAGE_NOTICE_EXIT_MS } from './stage/StageNotice'
import { TAKE_KEPT_LINGER_MS } from './stage/take-notice'
import type { ExerciseStatus } from './types'
import { EXERCISE_PITCH_HOLD } from './types'

const { keepMock } = vi.hoisted(() => ({ keepMock: vi.fn() }))

vi.mock('./exercise-voice-take', () => ({ keepExerciseVoiceTake: keepMock }))
vi.mock('@/lib/analytics', () => ({ trackEvent: () => {} }))
// jsdom has no WebGL, so Merc is his still here whatever the gate says; the
// stub only spares the log the probe's "not implemented" notice.
vi.mock('@/lib/merc/gpu-gate', () => ({
  canRunLiveMerc: () => false,
  waitForLiveMerc: () => () => undefined,
}))

const BRIEF = (
  <div class="exercise-idle-placeholder">
    <p>Keep your pitch locked inside the target zone.</p>
  </div>
)

/** A take that is ready to keep, as a finished Pitch Hold run leaves one. */
function readyTake(): ExerciseVoiceCaptureController {
  const take = {
    blob: new Blob(['voice'], { type: 'audio/webm' }),
    durationMs: 4200,
    peaks: new Float32Array([0.2, 0.8]),
    capturedAt: '2026-11-15T12:00:00.000Z',
    contour: encodeVoiceAtlasContour([], { source: 'practice-engine-v1' }),
    config: { type: EXERCISE_PITCH_HOLD, targetNote: 'E3' },
    result: {
      type: EXERCISE_PITCH_HOLD,
      score: 72,
      metrics: {},
      completedAt: Date.UTC(2026, 10, 15, 12),
    },
  }
  return {
    state: () => 'ready',
    take: () => take,
    awaitOutcome: async () => ({ state: 'ready', take }),
    discard: () => undefined,
  }
}

/**
 * A finished run's take as the drill hands it over: still being finished,
 * then ready, and gone once it is thrown away.
 */
function finishingTake() {
  const [state, setState] =
    createSignal<ExerciseVoiceCaptureState>('processing')
  const ready = readyTake()
  const capture: ExerciseVoiceCaptureController = {
    state,
    take: () => (state() === 'ready' ? ready.take() : null),
    awaitOutcome: ready.awaitOutcome,
    discard: () => setState('idle'),
  }
  return { capture, ready: () => setState('ready') }
}

/** The achievements a first run earns, as the grant engine raises them. */
function firstRunUnlocks(): void {
  showNotification('Achievement unlocked: First Note', 'success', {
    unlock: { kind: 'achievement', name: 'First Note', icon: 'leaf' },
  })
  showNotification('Achievement unlocked: Drill Sergeant', 'success', {
    unlock: { kind: 'achievement', name: 'Drill Sergeant', icon: 'dumbbell' },
  })
}

/** An example that sounds until the test says it has finished. */
function example() {
  let finish: () => void = () => {}
  const demo: ExerciseDemo = {
    play: () =>
      new Promise<void>((resolve) => {
        finish = resolve
      }),
    stop: () => finish(),
    line: () => 'Listen: E3. That is the note to stay on.',
  }
  return { demo, finish: () => finish() }
}

/** Pitch Hold on the stage, beside the app's toast host. */
function drill(
  options: {
    status?: ExerciseStatus
    take?: boolean
    capture?: ExerciseVoiceCaptureController
    demo?: ExerciseDemo
  } = {},
) {
  const [status, setStatus] = createSignal<ExerciseStatus>(
    options.status ?? 'idle',
  )
  const [open, setOpen] = createSignal(true)
  const view = render(() => (
    <>
      <Notifications />
      <Show when={open()}>
        <ExerciseShell
          type={EXERCISE_PITCH_HOLD}
          title="Pitch Hold"
          status={status}
          currentScore={() => 72}
          resultScore={() => (status() === 'complete' ? 72 : null)}
          voiceCapture={
            options.capture ?? (options.take === true ? readyTake() : undefined)
          }
          idlePlaceholder={BRIEF}
          activePhase={<span>Hold E3</span>}
          demo={options.demo}
          onBack={() => {}}
          onStart={() => {}}
          activeContent={<div>active</div>}
          onStop={() => {}}
          resultSummary={<>In Zone: 64%</>}
          onTryAgain={() => {}}
          onChangeTarget={() => {}}
        />
      </Show>
    </>
  ))
  const coach = () =>
    view.container.querySelector<HTMLElement>(
      '[data-testid="exercise-stage-coach"]',
    )
  return {
    ...view,
    setStatus,
    leave: () => setOpen(false),
    coach,
    /** The notice the bubble shows now, not one on its way out. */
    notice: () =>
      [
        ...(coach()?.querySelectorAll<HTMLElement>(
          '[data-testid="exercise-stage-notice"], [data-testid="exercise-take-notice"]',
        ) ?? []),
      ].find((el) => !/leaving/.test(el.className)) ?? null,
    toasts: () =>
      view.getByRole('region', { name: 'Notifications' }).children.length,
    demoLine: () =>
      coach()?.querySelector('.exercise-stage-demo-line')?.textContent ?? null,
  }
}

beforeEach(() => {
  keepMock.mockReset()
  vi.useFakeTimers({
    toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'],
  })
  resetNotifications()
})

afterEach(() => {
  cleanup()
  resetNotifications()
  vi.useRealTimers()
})

describe("the app's notices on the drill stage", () => {
  it("are said in Merc's bubble, and the toasts draw none", () => {
    const stage = drill()

    showNotification('Level up! This drill is now Lv 4', 'success')

    expect(stage.notice()?.dataset.testid).toBe('exercise-stage-notice')
    expect(stage.notice()?.textContent).toContain('Level up!')
    expect(stage.toasts()).toBe(0)
  })

  it('say the unlocks of one moment as one notice that names them', () => {
    const stage = drill({ status: 'complete' })

    showNotification('Achievement unlocked: First Note', 'success', {
      unlock: { kind: 'achievement', name: 'First Note', icon: 'leaf' },
    })
    showNotification('Achievement unlocked: Drill Sergeant', 'success', {
      unlock: { kind: 'achievement', name: 'Drill Sergeant', icon: 'dumbbell' },
    })

    const notices = stage
      .coach()!
      .querySelectorAll('[data-testid="exercise-stage-notice"]')
    expect(notices).toHaveLength(1)
    expect(notices[0]!.textContent).toBe(
      '2 new achievementsFirst Note, Drill Sergeant',
    )
  })

  it('go back to the toasts, in order, when the drill is left', () => {
    const stage = drill({ status: 'active' })
    showNotification('Level up! This drill is now Lv 4', 'success')
    showNotification('Synced', 'info')
    expect(stage.notice()).toBeNull()

    stage.leave()

    const region = stage.getByRole('region', { name: 'Notifications' })
    expect([...region.children].map((toast) => toast.textContent)).toEqual([
      'Level up! This drill is now Lv 4',
      'Synced',
    ])
  })
})

describe('what the bubble says first', () => {
  it("a calmer notice waits for the run to end, and the run's instruction stays", async () => {
    const stage = drill({ status: 'active' })

    showNotification('Level up! This drill is now Lv 4', 'success')
    expect(stage.notice()).toBeNull()
    expect(stage.coach()?.textContent).toContain('Hold E3')

    // However long the run, its time has not run while it waited.
    await vi.advanceTimersByTimeAsync(60_000)
    stage.setStatus('complete')
    await vi.advanceTimersByTimeAsync(0)
    expect(stage.notice()?.textContent).toContain('Level up!')
  })

  it('a calmer notice does not pop out between a run ended and the next begun in one tap', async () => {
    const stage = drill({ status: 'active' })
    showNotification('Level up! This drill is now Lv 4', 'success')

    // Try Again: the drill resets, then starts its count-in, in one go.
    stage.setStatus('idle')
    stage.setStatus('count-in')
    await vi.advanceTimersByTimeAsync(0)

    // Not on show, and not on its way out either.
    expect(
      stage.coach()!.querySelector('[data-testid="exercise-stage-notice"]'),
    ).toBeNull()
    expect(notifications()).toHaveLength(0)
  })

  it('a warning is said during a run, over its instruction', () => {
    const stage = drill({ status: 'active' })

    showActionNotification(
      'Background noise is triggering false notes.',
      'warning',
      { label: 'Open mic settings', onClick: () => undefined },
      { title: 'Microphone' },
    )

    expect(stage.notice()?.textContent).toContain(
      'Background noise is triggering false notes.',
    )
    expect(
      stage
        .coach()
        ?.querySelector('.exercise-active-phase')
        ?.closest('[aria-hidden="true"]'),
    ).not.toBeNull()
  })

  it("an error is said over the example's line", () => {
    const { demo } = example()
    const stage = drill({ demo })
    fireEvent.click(stage.getByRole('button', { name: 'Hear it first' }))

    showNotification('Could not play the example.', 'error')

    expect(stage.notice()?.textContent).toContain('Could not play the example.')
    expect(stage.notice()?.getAttribute('role')).toBe('alert')
  })

  it("the example's line is said over a calmer notice, which comes back after it", async () => {
    const { demo, finish } = example()
    const stage = drill({ demo })
    showNotification('Synced', 'info')
    expect(stage.notice()?.textContent).toContain('Synced')

    fireEvent.click(stage.getByRole('button', { name: 'Hear it first' }))
    expect(stage.demoLine()).toBe('Listen: E3. That is the note to stay on.')
    expect(stage.notice()).toBeNull()

    finish()
    await vi.advanceTimersByTimeAsync(DEMO_LINE_MIN_MS)
    expect(stage.demoLine()).toBeNull()
    expect(stage.notice()?.textContent).toContain('Synced')
  })

  it("during the take's question a calmer notice is a toast at once, and the question keeps the bubble", () => {
    const stage = drill({ status: 'complete', take: true })
    expect(stage.notice()?.textContent).toContain('Keep this take?')

    showNotification('Synced', 'info')

    expect(stage.notice()?.textContent).toContain('Keep this take?')
    const region = stage.getByRole('region', { name: 'Notifications' })
    expect([...region.children].map((toast) => toast.textContent)).toEqual([
      expect.stringContaining('Synced'),
    ])
  })

  it('a toast the question let through stays a toast once it is answered, and the achievements have the bubble', async () => {
    const take = finishingTake()
    const stage = drill({ status: 'active', capture: take.capture })
    stage.setStatus('complete')
    take.ready()
    firstRunUnlocks()
    showNotification('Synced', 'info', { durationMs: 60_000 })
    expect(stage.notice()?.textContent).toContain('Keep this take?')
    expect(stage.toasts()).toBe(1)

    fireEvent.click(stage.getByRole('button', { name: 'Discard take' }))
    await vi.advanceTimersByTimeAsync(STAGE_NOTICE_EXIT_MS)

    expect(stage.notice()?.textContent).toBe(
      '2 new achievementsFirst Note, Drill Sergeant',
    )
    const region = stage.getByRole('region', { name: 'Notifications' })
    expect([...region.children].map((toast) => toast.textContent)).toEqual([
      expect.stringContaining('Synced'),
    ])
  })

  it("an achievement waits behind the take's question, and is said in the bubble after Keep", async () => {
    const stage = drill({ status: 'complete', take: true })
    firstRunUnlocks()
    expect(stage.notice()?.textContent).toContain('Keep this take?')
    expect(stage.toasts()).toBe(0)

    // However long the question waits, the achievements' time has not run.
    await vi.advanceTimersByTimeAsync(60_000)
    keepMock.mockResolvedValue({
      ok: true,
      quotaExceeded: false,
      roomAvailable: true,
    })
    fireEvent.click(stage.getByRole('button', { name: 'Keep' }))
    await vi.advanceTimersByTimeAsync(0)
    expect(stage.notice()?.textContent).toContain('Take kept')

    await vi.advanceTimersByTimeAsync(TAKE_KEPT_LINGER_MS)
    expect(stage.notice()?.textContent).toBe(
      '2 new achievementsFirst Note, Drill Sergeant',
    )
    expect(stage.toasts()).toBe(0)
  })

  it("a first run's achievements wait behind its take's question, from the run's end", async () => {
    const take = finishingTake()
    const stage = drill({ status: 'active', capture: take.capture })

    // The run ends: its take is still being finished as the grants come.
    stage.setStatus('complete')
    firstRunUnlocks()
    expect(stage.notice()).toBeNull()
    expect(notifications()).toHaveLength(0)

    take.ready()
    expect(stage.notice()?.textContent).toContain('Keep this take?')

    // Put away: the achievements, as one notice, with their whole time.
    fireEvent.click(stage.getByRole('button', { name: 'Discard take' }))
    await vi.advanceTimersByTimeAsync(STAGE_NOTICE_EXIT_MS)
    const notices = stage
      .coach()!
      .querySelectorAll('[data-testid="exercise-stage-notice"]')
    expect(notices).toHaveLength(1)
    expect(notices[0]!.textContent).toBe(
      '2 new achievementsFirst Note, Drill Sergeant',
    )
    expect(stage.toasts()).toBe(0)
  })

  it('an achievement waiting behind the take is a toast once the drill is left', () => {
    const stage = drill({ status: 'complete', take: true })
    firstRunUnlocks()
    expect(stage.notice()?.textContent).toContain('Keep this take?')

    stage.leave()

    const region = stage.getByRole('region', { name: 'Notifications' })
    expect([...region.children].map((toast) => toast.textContent)).toEqual([
      expect.stringContaining('First Note'),
    ])
  })

  it("a warning is a toast at once during the take's question, which keeps the bubble", () => {
    const stage = drill({ status: 'complete', take: true })

    showNotification('Microphone disconnected.', 'warning')

    expect(stage.notice()?.textContent).toContain('Keep this take?')
    const region = stage.getByRole('region', { name: 'Notifications' })
    expect([...region.children].map((toast) => toast.textContent)).toEqual([
      expect.stringContaining('Microphone disconnected.'),
    ])
  })

  it('a notice that waited out the run is a toast at once when the question comes', async () => {
    const take = finishingTake()
    const stage = drill({ status: 'active', capture: take.capture })
    showNotification('Synced', 'info')
    expect(stage.toasts()).toBe(0)

    stage.setStatus('complete')
    take.ready()
    await vi.advanceTimersByTimeAsync(0)

    expect(stage.notice()?.textContent).toContain('Keep this take?')
    expect(stage.toasts()).toBe(1)
  })

  it('an achievement does not pop out between an answered question and the next run begun in one tap', async () => {
    const stage = drill({ status: 'complete', take: true })
    firstRunUnlocks()

    // Try Again during the question: the drill resets and starts its
    // count-in in one go.
    stage.setStatus('idle')
    stage.setStatus('count-in')
    await vi.advanceTimersByTimeAsync(0)

    expect(
      stage.coach()!.querySelector('[data-testid="exercise-stage-notice"]'),
    ).toBeNull()
    expect(notifications()).toHaveLength(0)
    expect(stage.toasts()).toBe(0)
  })

  it('the brief is back, not hidden, once there is nothing to say', async () => {
    const stage = drill()
    showNotification('Synced', 'info')
    const brief = stage
      .coach()!
      .querySelector('.exercise-idle-placeholder')!.parentElement!
    expect(brief.getAttribute('aria-hidden')).toBe('true')

    await vi.advanceTimersByTimeAsync(6000 + STAGE_NOTICE_EXIT_MS)

    expect(stage.notice()).toBeNull()
    expect(brief.hasAttribute('aria-hidden')).toBe(false)
  })
})
