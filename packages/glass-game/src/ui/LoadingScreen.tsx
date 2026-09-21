// Museum loading presentation — keeps unfinished scenes concealed behind Merc's gallery threshold.
import { createEffect, createSignal, onCleanup, onMount, Show } from 'solid-js'
import { trapDialogKeys } from './dialog-focus'
import { LoadingMerc } from './LoadingMerc'
import styles from './LoadingScreen.module.css'

export type LoadingScreenPhase =
  | 'loading-assets'
  | 'awaiting-first-frame'
  | 'error'

interface LoadingScreenProps {
  phase: LoadingScreenPhase
  error: string | null
  levelTitle: string
  mercArtUrl: string
  mercModelUrl: string
  generation: number
  progress: { completedUnits: number; totalUnits: number }
  onRetry(): void
  onLeave(): void
}

const loadingCopy = {
  'loading-assets': {
    title: 'Opening the gallery',
    detail: 'Merc is setting each exhibit in place.',
  },
  'awaiting-first-frame': {
    title: 'Lighting the exhibits',
    detail: 'The gallery is almost ready.',
  },
} as const

const slowCopy = {
  title: 'Still opening the gallery',
  detail: 'A few exhibits are taking a little longer.',
} as const

export function LoadingScreen(props: LoadingScreenProps) {
  let cover!: HTMLElement
  let retryButton: HTMLButtonElement | undefined
  let lastPhase: LoadingScreenPhase | undefined
  let focusActive = true
  let slowTimer: ReturnType<typeof setTimeout> | undefined
  const [slow, setSlow] = createSignal(false)
  const isError = (): boolean => props.phase === 'error'
  const copy = () =>
    props.phase === 'error'
      ? undefined
      : slow()
        ? slowCopy
        : loadingCopy[props.phase]

  const startSlowTimer = (): void => {
    clearTimeout(slowTimer)
    setSlow(false)
    slowTimer = setTimeout(() => {
      if (focusActive && !isError()) setSlow(true)
    }, 10_000)
  }

  onMount(() => cover.focus({ preventScroll: true }))
  createEffect(() => {
    const phase = props.phase
    const previousPhase = lastPhase
    lastPhase = phase
    if (phase === 'error') {
      clearTimeout(slowTimer)
      setSlow(false)
    } else if (previousPhase === undefined || previousPhase === 'error') {
      startSlowTimer()
    }
    if (phase !== 'error' && previousPhase !== 'error') return
    queueMicrotask(() => {
      if (!focusActive || lastPhase !== phase || !cover.isConnected) return
      if (phase === 'error' && retryButton?.isConnected === true)
        retryButton.focus({ preventScroll: true })
      else cover.focus({ preventScroll: true })
    })
  })
  onCleanup(() => {
    focusActive = false
    clearTimeout(slowTimer)
  })

  const keepFocusInCover = (event: KeyboardEvent): void => {
    trapDialogKeys(event)
  }

  return (
    <section
      ref={cover}
      class={styles.screen}
      data-testid="glass-loading-screen"
      data-phase={props.phase}
      tabIndex={-1}
      role={isError() ? 'alertdialog' : 'dialog'}
      aria-modal="true"
      aria-busy={!isError()}
      aria-labelledby="glass-loading-title"
      aria-describedby="glass-loading-detail"
      onKeyDown={keepFocusInCover}
    >
      <div class={styles.architecture} aria-hidden="true">
        <div class={styles.arch}>
          <span class={styles.revealPanel} />
          <span class={styles.revealPanel} />
          <span class={styles.polishLight} />
          <LoadingMerc
            modelUrl={props.mercModelUrl}
            artUrl={props.mercArtUrl}
            generation={props.generation}
            phase={props.phase}
            completedUnits={props.progress.completedUnits}
            totalUnits={props.progress.totalUnits}
          />
        </div>
        <span class={styles.threshold} />
      </div>

      <div class={styles.copy}>
        <p class={styles.galleryName}>{props.levelTitle}</p>
        <Show
          when={!isError()}
          fallback={
            <>
              <h1 id="glass-loading-title">The gallery could not open</h1>
              <p id="glass-loading-detail" class={styles.detail}>
                {props.error ??
                  'Try opening it again. Your museum progress is safe.'}
              </p>
            </>
          }
        >
          <div aria-live="polite" aria-atomic="true">
            <h1 id="glass-loading-title">{copy()?.title}</h1>
            <p id="glass-loading-detail" class={styles.detail}>
              {copy()?.detail}
            </p>
          </div>
        </Show>
        <div
          class={styles.progressTrack}
          role="progressbar"
          aria-label="Gallery preparation"
          aria-valuemin={0}
          aria-valuemax={Math.max(1, props.progress.totalUnits)}
          aria-valuenow={props.progress.completedUnits}
          aria-valuetext={
            isError() ? 'Preparation paused; retry to continue' : copy()?.title
          }
        >
          <span
            class={styles.progressFill}
            style={{
              transform: `scaleX(${props.progress.totalUnits > 0 ? props.progress.completedUnits / props.progress.totalUnits : 0})`,
            }}
          />
        </div>
        <Show
          when={isError()}
          fallback={
            <div class={styles.loadingActions}>
              <button
                class={styles.leave}
                type="button"
                onClick={() => props.onLeave()}
              >
                Leave museum
              </button>
            </div>
          }
        >
          <div class={styles.actions}>
            <button
              ref={retryButton}
              class={styles.retry}
              type="button"
              onClick={() => props.onRetry()}
            >
              Retry
            </button>
            <button
              class={styles.leave}
              type="button"
              onClick={() => props.onLeave()}
            >
              Leave museum
            </button>
          </div>
        </Show>
      </div>
    </section>
  )
}
