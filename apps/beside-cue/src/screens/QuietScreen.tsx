import { createSignal, Match, onCleanup, onMount, Switch } from 'solid-js'
import { MascotStage } from '@/components/MascotStage'
import type { LocalActionStarter } from '../action-starters/action-starter'

type QuietScreenPhase = 'ready' | 'running' | 'complete'

interface QuietScreenProps {
  choseBSide: boolean
  message: string
  starter?: LocalActionStarter
  onTimerComplete: () => void
  onDone: () => void
}

function wholeDurationMinutes(starter: LocalActionStarter | undefined) {
  if (starter?.kind !== 'quiet-timer') return undefined

  const minutes = starter.durationMs / 60_000
  return Number.isSafeInteger(minutes) && minutes > 0 ? minutes : undefined
}

function formatCountdown(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

function describeCountdown(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  const parts: string[] = []
  if (minutes > 0) {
    parts.push(`${String(minutes)} ${minutes === 1 ? 'minute' : 'minutes'}`)
  }
  if (seconds > 0 || parts.length === 0) {
    parts.push(`${String(seconds)} ${seconds === 1 ? 'second' : 'seconds'}`)
  }
  return `${parts.join(' ')} remaining`
}

export function QuietScreen(props: QuietScreenProps) {
  const [phase, setPhase] = createSignal<QuietScreenPhase>('ready')
  const [remainingSeconds, setRemainingSeconds] = createSignal(0)
  const [announcement, setAnnouncement] = createSignal('')
  const durationMinutes = () => wholeDurationMinutes(props.starter)
  const instruction = () => props.starter?.instruction ?? props.message

  let deadlineMs = 0
  let timerHandle: ReturnType<typeof setInterval> | undefined
  let completionReported = false
  let mounted = false
  let headingElement: HTMLHeadingElement | undefined

  function clearTimer(): void {
    if (timerHandle === undefined) return
    clearInterval(timerHandle)
    timerHandle = undefined
  }

  function focusHeading(): void {
    queueMicrotask(() => {
      if (!mounted) return
      headingElement?.focus({ preventScroll: true })
    })
  }

  function finishTimer(): void {
    if (phase() !== 'running') return

    clearTimer()
    setRemainingSeconds(0)
    setPhase('complete')
    setAnnouncement('')
    focusHeading()
    if (!completionReported) {
      completionReported = true
      props.onTimerComplete()
    }
  }

  function refreshTimer(): void {
    if (phase() !== 'running') return

    const nextSeconds = Math.max(0, Math.ceil((deadlineMs - Date.now()) / 1000))
    setRemainingSeconds(nextSeconds)
    if (nextSeconds === 0) finishTimer()
  }

  function startTimer(): void {
    const minutes = durationMinutes()
    if (phase() !== 'ready' || minutes === undefined) return

    const durationMs = minutes * 60_000
    completionReported = false
    deadlineMs = Date.now() + durationMs
    setRemainingSeconds(durationMs / 1000)
    setPhase('running')
    setAnnouncement(
      `Timer started for ${String(minutes)} ${minutes === 1 ? 'minute' : 'minutes'}.`,
    )
    timerHandle = setInterval(refreshTimer, 1000)
    focusHeading()
  }

  function endTimer(): void {
    clearTimer()
    props.onDone()
  }

  function handleVisibilityChange(): void {
    refreshTimer()
  }

  onMount(() => {
    mounted = true
    document.addEventListener('visibilitychange', handleVisibilityChange)
    focusHeading()
  })

  onCleanup(() => {
    mounted = false
    clearTimer()
    document.removeEventListener('visibilitychange', handleVisibilityChange)
  })

  return (
    <main
      class="quiet-screen app-screen"
      aria-labelledby="quiet-title"
      data-phase={phase()}
      data-starter={durationMinutes() === undefined ? 'instruction' : 'timer'}
    >
      <p class="quiet-screen__label">
        {props.choseBSide
          ? phase() === 'running'
            ? 'Quiet timer'
            : 'Side B is yours'
          : 'Not now is okay'}
      </p>
      <MascotStage state={props.choseBSide ? 'turn' : 'quiet'} />

      <Switch>
        <Match when={!props.choseBSide}>
          <section class="quiet-screen__copy">
            <h1
              id="quiet-title"
              ref={(element) => {
                headingElement = element
              }}
              tabIndex={-1}
            >
              {props.message}
            </h1>
            <p>You made a choice. The next cue stays gentle.</p>
          </section>
          <div class="quiet-screen__actions">
            <button
              class="primary-button primary-button--wide primary-button--quiet"
              type="button"
              onClick={() => props.onDone()}
            >
              Back to home
            </button>
          </div>
        </Match>

        <Match when={phase() === 'ready'}>
          <section class="quiet-screen__copy">
            <p class="quiet-screen__section-label">Your Side B</p>
            <h1
              id="quiet-title"
              ref={(element) => {
                headingElement = element
              }}
              tabIndex={-1}
            >
              {instruction()}
            </h1>
            <p class="quiet-screen__acknowledgement">{props.message}</p>
            <p>
              {durationMinutes() === undefined
                ? 'Your choice is recorded. You can leave Beside Cue and begin.'
                : 'A short timer is here if it helps. Your choice is already recorded.'}
            </p>
          </section>
          <div class="quiet-screen__actions">
            {durationMinutes() === undefined ? (
              <button
                class="primary-button primary-button--wide primary-button--quiet"
                type="button"
                onClick={() => props.onDone()}
              >
                Back to home
              </button>
            ) : (
              <>
                <button
                  class="primary-button primary-button--wide primary-button--quiet"
                  type="button"
                  onClick={startTimer}
                >
                  Start {durationMinutes()}-minute timer
                </button>
                <button
                  class="quiet-button quiet-screen__quiet-action"
                  type="button"
                  onClick={() => props.onDone()}
                >
                  Continue without timer
                </button>
              </>
            )}
          </div>
        </Match>

        <Match when={phase() === 'running'}>
          <section class="quiet-screen__copy quiet-screen__copy--timer">
            <h1
              id="quiet-title"
              ref={(element) => {
                headingElement = element
              }}
              tabIndex={-1}
            >
              {instruction()}
            </h1>
            <time
              class="quiet-screen__timer"
              role="timer"
              aria-live="off"
              aria-label={describeCountdown(remainingSeconds())}
              dateTime={`PT${String(remainingSeconds())}S`}
            >
              {formatCountdown(remainingSeconds())}
            </time>
            <p>
              Keep this screen open for the finish haptic. You can end the timer
              at any point; your choice stays recorded.
            </p>
          </section>
          <div class="quiet-screen__actions">
            <button
              class="quiet-button quiet-screen__quiet-action"
              type="button"
              onClick={endTimer}
            >
              End timer
            </button>
          </div>
        </Match>

        <Match when={phase() === 'complete'}>
          <section class="quiet-screen__copy">
            <h1
              id="quiet-title"
              ref={(element) => {
                headingElement = element
              }}
              tabIndex={-1}
            >
              Timer finished
            </h1>
            <div class="quiet-screen__finished-action">
              <span>Your Side B</span>
              <p>{instruction()}</p>
            </div>
            <p>Your choice was already recorded. No check-in needed.</p>
          </section>
          <div class="quiet-screen__actions">
            <button
              class="primary-button primary-button--wide primary-button--quiet"
              type="button"
              onClick={() => props.onDone()}
            >
              Back to home
            </button>
          </div>
        </Match>
      </Switch>

      <p class="visually-hidden" role="status" aria-live="polite">
        {announcement()}
      </p>
    </main>
  )
}
