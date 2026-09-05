import { createMemo, createSignal, Match, onCleanup, onMount, Switch, } from 'solid-js'
import { MascotStage } from '@/components/MascotStage'
import { CORKY_V023_REST_ART } from '@/content'
import type { Copy } from '@/i18n/ui-copy'
import { useCopy } from '@/i18n/ui-copy'
import { Selectable } from '@/interaction/selection'
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

function describeCountdown(totalSeconds: number, copy: Copy): string {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  const parts: string[] = []
  if (minutes > 0) {
    parts.push(
      copy.t(minutes === 1 ? '{count} minute' : '{count} minutes', {
        count: minutes,
      }),
    )
  }
  if (seconds > 0 || parts.length === 0) {
    parts.push(
      copy.t(seconds === 1 ? '{count} second' : '{count} seconds', {
        count: seconds,
      }),
    )
  }
  return copy.t('{duration} remaining', { duration: parts.join(' ') })
}

export function QuietScreen(props: QuietScreenProps) {
  const copy = useCopy()
  const [phase, setPhase] = createSignal<QuietScreenPhase>('ready')
  const [remainingSeconds, setRemainingSeconds] = createSignal(0)
  const [announcement, setAnnouncement] = createSignal('')
  const durationMinutes = () => wholeDurationMinutes(props.starter)
  const instruction = () => props.starter?.instruction ?? props.message
  const corkyArt = createMemo(() => ({
    ...CORKY_V023_REST_ART,
    alt: copy.t(
      'Corky, a rose-plum cork character with eight tubular limbs, settled beside the current plan.',
    ),
  }))

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
      copy.t(
        minutes === 1
          ? 'Timer started for {count} minute.'
          : 'Timer started for {count} minutes.',
        { count: minutes },
      ),
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
            ? copy.t('Quiet timer')
            : copy.t('Side B is yours')
          : copy.t('Not now is okay')}
      </p>
      <MascotStage
        state={props.choseBSide ? 'turn' : 'quiet'}
        artOverride={corkyArt()}
      />

      <Switch>
        <Match when={!props.choseBSide}>
          <section class="quiet-screen__copy" {...Selectable}>
            <h1
              id="quiet-title"
              ref={(element) => {
                headingElement = element
              }}
              tabIndex={-1}
            >
              {props.message}
            </h1>
            <p>{copy.t('You made a choice. The next cue stays gentle.')}</p>
          </section>
          <div class="quiet-screen__actions">
            <button
              class="primary-button primary-button--wide primary-button--quiet"
              type="button"
              onClick={() => props.onDone()}
            >
              {copy.t('Back to home')}
            </button>
          </div>
        </Match>

        <Match when={phase() === 'ready'}>
          <section class="quiet-screen__copy" {...Selectable}>
            <p class="quiet-screen__section-label">{copy.t('Your Side B')}</p>
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
                ? copy.t(
                    'Your choice is recorded. You can leave Beside Cue and begin.',
                  )
                : copy.t(
                    'A short timer is here if it helps. Your choice is already recorded.',
                  )}
            </p>
          </section>
          <div class="quiet-screen__actions">
            {durationMinutes() === undefined ? (
              <button
                class="primary-button primary-button--wide primary-button--quiet"
                type="button"
                onClick={() => props.onDone()}
              >
                {copy.t('Back to home')}
              </button>
            ) : (
              <>
                <button
                  class="primary-button primary-button--wide primary-button--quiet"
                  type="button"
                  onClick={startTimer}
                >
                  {durationMinutes() === 1
                    ? copy.t('Start one-minute timer')
                    : copy.t('Start {count}-minute timer', {
                        count: durationMinutes() ?? 0,
                      })}
                </button>
                <button
                  class="quiet-button quiet-screen__quiet-action"
                  type="button"
                  onClick={() => props.onDone()}
                >
                  {copy.t('Continue without timer')}
                </button>
              </>
            )}
          </div>
        </Match>

        <Match when={phase() === 'running'}>
          <section
            class="quiet-screen__copy quiet-screen__copy--timer"
            {...Selectable}
          >
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
              aria-label={describeCountdown(remainingSeconds(), copy)}
              dateTime={`PT${String(remainingSeconds())}S`}
            >
              {formatCountdown(remainingSeconds())}
            </time>
            <p>
              {copy.t(
                'Keep this screen open for the finish haptic. You can end the timer at any point; your choice stays recorded.',
              )}
            </p>
          </section>
          <div class="quiet-screen__actions">
            <button
              class="quiet-button quiet-screen__quiet-action"
              type="button"
              onClick={endTimer}
            >
              {copy.t('End timer')}
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
              {copy.t('Timer finished')}
            </h1>
            <div class="quiet-screen__finished-action">
              <span>{copy.t('Your Side B')}</span>
              <p {...Selectable}>{instruction()}</p>
            </div>
            <p>
              {copy.t('Your choice was already recorded. No check-in needed.')}
            </p>
          </section>
          <div class="quiet-screen__actions">
            <button
              class="primary-button primary-button--wide primary-button--quiet"
              type="button"
              onClick={() => props.onDone()}
            >
              {copy.t('Back to home')}
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
