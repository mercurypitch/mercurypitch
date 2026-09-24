// Replay selection — choose an authored star goal without surrendering earlier discoveries.

import { createSignal, For, onCleanup, onMount, Show, untrack } from 'solid-js'
import type { ResolvedReplay } from '../core/replay-profile'
import { sameReplayIdentity } from '../core/replay-profile'
import type { ReplayProgress } from '../core/replay-progress'
import { canEnterReplay, highestReplayTier } from '../core/replay-progress'
import { focusDialog, trapDialogKeys } from './dialog-focus'
import styles from './ReplaySelection.module.css'

export function ReplaySelection(props: {
  title: string
  imageUrl: string
  profiles: readonly ResolvedReplay[]
  progress: ReplayProgress
  onChoose(profileId: string, fresh: boolean): void
  onClose(): void
}) {
  const [selectedId, setSelectedId] = createSignal(
    untrack(() => props.profiles[0]?.profile.id),
  )
  const selected = () =>
    props.profiles.find((item) => item.profile.id === selectedId())
  const attempt = () =>
    props.progress.attempts.find((item) => {
      const current = selected()
      return (
        current !== undefined &&
        sameReplayIdentity(item.identity, current.identity)
      )
    })
  const canResume = () =>
    attempt() !== undefined &&
    attempt()!.progress.finished !== true &&
    (attempt()!.progress.completedBreakableIds.length > 0 ||
      attempt()!.progress.checkpointId !== selected()!.level.spawn.checkpointId)
  const choose = (fresh: boolean) => {
    const profile = selected()
    if (profile && canEnterReplay(props.progress, profile))
      props.onChoose(profile.profile.id, fresh)
  }
  let previousFocus: HTMLElement | null = null
  onMount(() => {
    previousFocus =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null
  })
  onCleanup(() => {
    queueMicrotask(() => {
      if (previousFocus?.isConnected === true)
        previousFocus.focus({ preventScroll: true })
    })
  })
  return (
    <div
      class={styles.scrim}
      onClick={(event) => {
        if (event.target === event.currentTarget) props.onClose()
      }}
    >
      <section
        class={styles.panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="glass-replay-title"
        ref={focusDialog}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault()
            props.onClose()
          } else trapDialogKeys(event)
        }}
      >
        <div class={styles.cover} aria-hidden="true">
          <img src={props.imageUrl} alt="" />
        </div>
        <div class={styles.body}>
          <button
            type="button"
            class={styles.close}
            aria-label="Return to museum"
            onClick={() => props.onClose()}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="m6 6 12 12M6 18 18 6" />
            </svg>
          </button>
          <p class={styles.eyebrow}>A little more resonance</p>
          <h2 id="glass-replay-title">{props.title}</h2>
          <p class={styles.intro}>
            Choose your next challenge. Your portrait and discoveries stay
            yours.
          </p>
          <div
            class={styles.goals}
            role="group"
            aria-label="Choose a star challenge"
          >
            <For each={props.profiles}>
              {(entry) => {
                const earned = () =>
                  props.progress.clears.some((item) =>
                    sameReplayIdentity(item.identity, entry.identity),
                  )
                return (
                  <button
                    type="button"
                    class={styles.goal}
                    aria-pressed={selectedId() === entry.profile.id}
                    disabled={!canEnterReplay(props.progress, entry)}
                    onClick={() => setSelectedId(entry.profile.id)}
                  >
                    <span class={styles.stars} aria-hidden="true">
                      <For each={Array.from({ length: entry.profile.tier })}>
                        {() => (
                          <svg viewBox="0 0 24 24">
                            <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9Z" />
                          </svg>
                        )}
                      </For>
                    </span>
                    <strong>{entry.profile.title}</strong>
                    <Show when={earned()}>
                      <span class={styles.earned}>Completed</span>
                    </Show>
                  </button>
                )
              }}
            </For>
          </div>
          <Show when={selected()}>
            {(entry) => (
              <p class={styles.description} aria-live="polite">
                {entry().profile.description}
              </p>
            )}
          </Show>
          <p class={styles.explanation}>
            Open every main exhibit and reach the exit to earn this challenge’s
            stars. Optional treasures are yours to explore.
          </p>
          <Show
            when={
              props.progress.legacyCompleted &&
              highestReplayTier(props.progress) === 0
            }
          >
            <p class={styles.history}>
              Your earlier gallery completion and portrait performance are
              saved. These stars celebrate the new replay challenges.
            </p>
          </Show>
          <button
            type="button"
            class={styles.primary}
            onClick={() => choose(!canResume())}
          >
            {canResume() ? 'Continue this challenge' : 'Begin this challenge'}
          </button>
          <Show when={canResume()}>
            <button
              type="button"
              class={styles.secondary}
              onClick={() => choose(true)}
            >
              Start this challenge again
            </button>
          </Show>
        </div>
      </section>
    </div>
  )
}
