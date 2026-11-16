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
// notices back; and that leaving the drill hands what is left to the
// toasts. The store's part is pinned in src/stores/notifications-stage.test.ts.

import { cleanup, fireEvent, render } from '@solidjs/testing-library'
import { createSignal, Show } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Notifications } from '@/components/Notifications'
import type { ExerciseVoiceCaptureController } from '@/lib/domain/exercise-voice-capture'
import { encodeVoiceAtlasContour } from '@/lib/voice-contour'
import { notifications, resetNotifications, showActionNotification, showNotification, } from '@/stores/notifications-store'
import type { ExerciseDemo } from './ExerciseShell'
import { DEMO_LINE_MIN_MS, ExerciseShell } from './ExerciseShell'
import { STAGE_NOTICE_EXIT_MS } from './stage/StageNotice'
import type { ExerciseStatus } from './types'
import { EXERCISE_PITCH_HOLD } from './types'

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
          voiceCapture={options.take === true ? readyTake() : undefined}
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
    expect(stage.notice()?.textContent).toContain('Level up!')
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

  it("a calmer notice is said before the take's, which follows when it goes", async () => {
    const stage = drill({ status: 'complete', take: true })
    expect(stage.notice()?.textContent).toContain('Keep this take?')

    showNotification('Level up! This drill is now Lv 4', 'success')
    expect(stage.notice()?.textContent).toContain('Level up!')

    fireEvent.click(stage.getByRole('button', { name: 'Dismiss notification' }))
    await vi.advanceTimersByTimeAsync(STAGE_NOTICE_EXIT_MS)
    expect(notifications()).toHaveLength(0)
    expect(stage.notice()?.textContent).toContain('Keep this take?')
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
