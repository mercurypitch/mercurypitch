// ============================================================
// MercurySingStage — the listening stage, a thin skin
// ============================================================
//
// Mounted (lazily) inside <Show when={mercurySingOpen()}> by App and the
// standalone Karaoke Night page, so mounting IS opening: the engine spins
// up in the component body and everything releases on unmount. All logic
// lives in the engine; this file only renders its signals and forwards
// close/pick. Cancel works by voice ("cancel"), Escape, backdrop click or
// the button — same gesture set as the other overlays.

import { createMemo, For, onCleanup, onMount, Show } from 'solid-js'
import { createMercurySingEngine } from './mercury-sing-engine'
import { closeMercurySing, setMercurySingPickHandler, } from './mercury-sing-store'
import styles from './MercurySingStage.module.css'

const TRAIL_VIEW_W = 96
const TRAIL_VIEW_H = 40
const TRAIL_MIDI_LOW = 40
const TRAIL_MIDI_HIGH = 84

export function MercurySingStage() {
  const engine = createMercurySingEngine()
  setMercurySingPickHandler(engine.pick)
  onCleanup(() => {
    setMercurySingPickHandler(null)
    engine.dispose()
  })

  // Capture phase so Escape closes THIS surface, not a modal underneath.
  const handleKey = (e: KeyboardEvent) => {
    if (e.code === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      closeMercurySing()
    }
  }
  onMount(() => window.addEventListener('keydown', handleKey, true))
  onCleanup(() => window.removeEventListener('keydown', handleKey, true))

  const trailBars = createMemo(() =>
    engine
      .trail()
      .map((midi, index) => {
        if (Number.isNaN(midi)) return null
        const clamped = Math.max(
          TRAIL_MIDI_LOW,
          Math.min(TRAIL_MIDI_HIGH, midi),
        )
        const span = TRAIL_MIDI_HIGH - TRAIL_MIDI_LOW
        const y =
          TRAIL_VIEW_H -
          4 -
          ((clamped - TRAIL_MIDI_LOW) / span) * (TRAIL_VIEW_H - 8)
        return { x: index, y }
      })
      .filter((bar): bar is { x: number; y: number } => bar !== null),
  )

  const elapsedLabel = createMemo(() => {
    const total = Math.floor(engine.elapsedSec())
    const minutes = Math.floor(total / 60)
    const seconds = total % 60
    return `${String(minutes)}:${String(seconds).padStart(2, '0')}`
  })

  const fingerprintingBusy = createMemo(() => {
    const p = engine.fingerprinting()
    return p.total > 0 && p.done < p.total
  })

  return (
    <div
      class={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-label="Mercury Sing"
      data-testid="mercury-sing-stage"
      onClick={() => closeMercurySing()}
    >
      <div class={styles.card} onClick={(e) => e.stopPropagation()}>
        <div class={styles.header}>
          <h2 class={styles.title}>Mercury Sing</h2>
          <p class={styles.subtitle}>
            Just sing — the song joins you when I'm sure. Other voice commands
            need the "Mercury" prefix while I listen.
          </p>
          <button
            type="button"
            class={styles.closeButton}
            onClick={() => closeMercurySing()}
            aria-label="Stop listening"
          >
            &times;
          </button>
        </div>

        <Show when={engine.status() === 'starting'}>
          <p class={styles.statusLine}>Warming up the ears…</p>
        </Show>

        <Show when={engine.status() === 'mic-denied'}>
          <p class={styles.statusLine}>
            The microphone is unavailable. Allow mic access in the browser and
            try "Mercury Sing" again.
          </p>
        </Show>

        <Show when={engine.status() === 'no-library'}>
          <p class={styles.statusLine}>
            Nothing to match against yet — separate a song in the Karaoke tab
            first, then Mercury Sing can find it from your singing.
          </p>
        </Show>

        <Show when={engine.status() === 'launching'}>
          <p class={styles.statusLine}>Joining you…</p>
        </Show>

        <Show when={engine.status() === 'listening'}>
          <div class={styles.listenRow}>
            <span class={styles.listenDot} aria-hidden="true" />
            <span>Listening — {elapsedLabel()}</span>
            <span class={styles.librarySpan}>
              {String(engine.libraryCount())} song
              {engine.libraryCount() === 1 ? '' : 's'} in the running
            </span>
          </div>

          <svg
            class={styles.trail}
            viewBox={`0 0 ${String(TRAIL_VIEW_W)} ${String(TRAIL_VIEW_H)}`}
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <For each={trailBars()}>
              {(bar) => (
                <rect
                  class={styles.trailBar}
                  x={bar.x}
                  y={bar.y}
                  width="0.8"
                  height="2.4"
                  rx="0.4"
                />
              )}
            </For>
          </svg>

          <Show when={fingerprintingBusy()}>
            <p class={styles.fingerprintLine}>
              Teaching your library: {String(engine.fingerprinting().done)} of{' '}
              {String(engine.fingerprinting().total)} new songs fingerprinted
            </p>
          </Show>

          <Show
            when={engine.candidates().length > 0}
            fallback={
              <p class={styles.waitingLine}>
                Keep singing — a verse is usually enough.
              </p>
            }
          >
            <ol class={styles.candidates}>
              <For each={engine.candidates()}>
                {(candidate, index) => (
                  <li class={styles.candidate}>
                    <button
                      type="button"
                      class={styles.candidateButton}
                      onClick={() => engine.pick(index())}
                      title={`Open "${candidate.name}" now`}
                    >
                      <span class={styles.candidateIndex}>
                        {String(index() + 1)}
                      </span>
                      <span class={styles.candidateName}>{candidate.name}</span>
                      <span class={styles.candidateConfidence}>
                        {String(candidate.confidence)}%
                      </span>
                    </button>
                    <div class={styles.candidateMeta}>
                      <span>pitch {String(candidate.breakdown.pitch)}</span>
                      <span>
                        interval {String(candidate.breakdown.interval)}
                      </span>
                      <span>chroma {String(candidate.breakdown.chroma)}</span>
                      <span>rhythm {String(candidate.breakdown.rhythm)}</span>
                    </div>
                    <Show
                      when={
                        engine.armed().leaderId === candidate.sessionId &&
                        engine.armed().kind !== 'listening'
                      }
                    >
                      <div
                        class={styles.armTrack}
                        role="progressbar"
                        aria-label="Match locking in"
                      >
                        <div
                          class={styles.armFill}
                          style={{
                            width: `${String(Math.round(engine.armed().armedFraction * 100))}%`,
                          }}
                        />
                      </div>
                    </Show>
                  </li>
                )}
              </For>
            </ol>
          </Show>
        </Show>

        <p class={styles.hint}>
          Say "cancel" to stop, or "sing number one" to open a pick — Escape and
          a click outside work too.
        </p>
      </div>
    </div>
  )
}
