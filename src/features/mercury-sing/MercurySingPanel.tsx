// ============================================================
// MercurySingPanel — everything the listening stage shows
// ============================================================
//
// Pure presentation: data in, intents out. The stage feeds it live engine
// signals; the preview harness feeds it fixtures — which is how this
// screen can be designed and reviewed without a microphone, a library or
// a match. No audio, no navigation, no stores in this file.
//
// The picker is the wheel (docs/plans/mercury-sing.md M4): the closest
// matches sit in quadrants around a Mercury core, so choosing is a glance
// and a gesture. The named roster only fills the wait before the first
// match — see the fallback.

import { createMemo, For, Show } from 'solid-js'
import type { MercurySingCandidateView, MercurySingLibraryEntry, MercurySingStatus, } from './mercury-sing-engine'
import { WHEEL_SLOTS } from './mercury-sing-engine'
import styles from './MercurySingPanel.module.css'
import { MercurySingWheel } from './MercurySingWheel'

const TRAIL_VIEW_W = 96
const TRAIL_VIEW_H = 34
const TRAIL_MIDI_LOW = 40
const TRAIL_MIDI_HIGH = 84

export interface MercurySingPanelProps {
  status: MercurySingStatus
  candidates: MercurySingCandidateView[]
  leaderId: string | null
  armedFraction: number
  elapsedSec: number
  /** MIDI numbers; NaN marks an unvoiced frame. */
  trail: readonly number[]
  library: MercurySingLibraryEntry[]
  libraryCount: number
  fingerprinting: { done: number; total: number }
  /** True while ranking is held still because someone is speaking. */
  frozen: boolean
  /** Latest transcript from the voice listener — words, not melody. */
  heard: string
  onPick: (index: number) => void
  onOpenLibrary: (sessionId: string) => void
  onClose: () => void
}

export function MercurySingPanel(props: MercurySingPanelProps) {
  /**
   * The sung line, as continuous strokes. Unvoiced frames break the path
   * into separate segments rather than joining across a breath — the gaps
   * are information, not noise.
   */
  const trailSegments = createMemo(() => {
    const span = TRAIL_MIDI_HIGH - TRAIL_MIDI_LOW
    const segments: string[] = []
    let current: string[] = []
    props.trail.forEach((midi, index) => {
      if (Number.isNaN(midi)) {
        if (current.length > 1) segments.push(current.join(' '))
        current = []
        return
      }
      const clamped = Math.max(TRAIL_MIDI_LOW, Math.min(TRAIL_MIDI_HIGH, midi))
      const y =
        TRAIL_VIEW_H -
        3 -
        ((clamped - TRAIL_MIDI_LOW) / span) * (TRAIL_VIEW_H - 6)
      current.push(
        `${current.length === 0 ? 'M' : 'L'} ${String(index)} ${y.toFixed(2)}`,
      )
    })
    if (current.length > 1) segments.push(current.join(' '))
    return segments
  })

  const elapsedLabel = createMemo(() => {
    const total = Math.max(0, Math.floor(props.elapsedSec))
    return `${String(Math.floor(total / 60))}:${String(total % 60).padStart(2, '0')}`
  })

  const fingerprintingBusy = createMemo(
    () =>
      props.fingerprinting.total > 0 &&
      props.fingerprinting.done < props.fingerprinting.total,
  )

  const listening = createMemo(() => props.status === 'listening')

  return (
    <div
      class={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-label="Mercury Sing"
      data-testid="mercury-sing-stage"
      onClick={() => props.onClose()}
    >
      {/* Backdrop: deep space, a Mercury crescent, drifting starfield.
          Pure CSS so it stays crisp at any size and costs no asset. */}
      <div class={styles.sky} aria-hidden="true">
        <div class={styles.stars} />
        <div class={styles.crescent} />
        <div class={styles.glow} />
      </div>

      <div class={styles.card} onClick={(e) => e.stopPropagation()}>
        <header class={styles.header}>
          <div class={styles.brand}>
            <span class={styles.brandMark} aria-hidden="true" />
            <div>
              <h2 class={styles.title}>Mercury Sing</h2>
              <p class={styles.subtitle}>
                <Show
                  when={listening()}
                  fallback="Sing, and the song joins you"
                >
                  Listening — {elapsedLabel()} · {String(props.libraryCount)}{' '}
                  song
                  {props.libraryCount === 1 ? '' : 's'} in the running
                </Show>
              </p>
            </div>
          </div>
          <button
            type="button"
            class={styles.closeButton}
            onClick={() => props.onClose()}
            aria-label="Stop listening"
          >
            &times;
          </button>
        </header>

        <Show when={props.status === 'starting'}>
          <p class={styles.statusLine}>Warming up the ears…</p>
        </Show>
        <Show when={props.status === 'mic-denied'}>
          <p class={styles.statusLine}>
            The microphone is unavailable. Allow mic access in the browser and
            try "what song is this" again.
          </p>
        </Show>
        <Show when={props.status === 'no-library'}>
          <p class={styles.statusLine}>
            Nothing to match against yet — separate a song in the Karaoke tab
            first, then Mercury Sing can find it from your singing.
          </p>
        </Show>
        <Show when={props.status === 'launching'}>
          <p class={styles.statusLine}>Joining you…</p>
        </Show>

        <Show when={listening()}>
          <Show
            when={props.candidates.length > 0}
            fallback={
              <div class={styles.waiting}>
                <MercurySingWheel
                  candidates={[]}
                  leaderId={null}
                  armedFraction={0}
                  listening
                  onPick={props.onPick}
                />
                <p class={styles.waitingLine}>
                  Keep singing — a verse is usually enough. The closest matches
                  land in the wheel.
                </p>
                {/* The roster, named: without it the stage showed a count and
                    nothing to read, so there was no way to know what was even
                    in the running. Any row opens that song from the top. */}
                <Show when={props.library.length > 0}>
                  <p class={styles.rosterHeading}>Listening for</p>
                  <ul class={styles.roster}>
                    <For each={props.library}>
                      {(entry) => (
                        <li>
                          <button
                            type="button"
                            class={styles.rosterButton}
                            classList={{ [styles.rosterPending]: !entry.ready }}
                            onClick={() => props.onOpenLibrary(entry.sessionId)}
                            title={
                              entry.ready
                                ? `Open "${entry.name}" from the top`
                                : `"${entry.name}" — still being fingerprinted; opens from the top`
                            }
                          >
                            <span class={styles.rosterName}>{entry.name}</span>
                            <Show when={!entry.ready}>
                              <span class={styles.rosterChip}>indexing</span>
                            </Show>
                          </button>
                        </li>
                      )}
                    </For>
                  </ul>
                </Show>
              </div>
            }
          >
            <MercurySingWheel
              candidates={props.candidates.slice(0, WHEEL_SLOTS).map((c) => ({
                sessionId: c.sessionId,
                name: c.name,
                confidence: c.confidence,
              }))}
              leaderId={props.leaderId}
              armedFraction={props.armedFraction}
              listening
              onPick={props.onPick}
            />

            {/* The leader's score breakdown — why this song is winning. */}
            <Show
              when={props.candidates.find(
                (c) => c.sessionId === props.leaderId,
              )}
            >
              {(leader) => (
                <div class={styles.leaderStrip}>
                  <span class={styles.leaderName}>{leader().name}</span>
                  <span class={styles.leaderMeta}>
                    pitch {String(leader().breakdown.pitch)} · interval{' '}
                    {String(leader().breakdown.interval)} · chroma{' '}
                    {String(leader().breakdown.chroma)} · rhythm{' '}
                    {String(leader().breakdown.rhythm)}
                  </span>
                </div>
              )}
            </Show>
          </Show>

          <svg
            class={styles.trail}
            viewBox={`0 0 ${String(TRAIL_VIEW_W)} ${String(TRAIL_VIEW_H)}`}
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <For each={trailSegments()}>
              {(segment) => <path class={styles.trailLine} d={segment} />}
            </For>
          </svg>

          {/* What the recogniser made of your VOICE. This is the speech
              engine, not the matcher: it is how commands are heard, and
              showing it is the only way to tell a mis-heard command from
              an ignored one. Lyrics do not yet feed the match — that is
              M2b — so this is marked as heard, not used. */}
          <Show when={props.heard !== ''}>
            <div class={styles.heardLine}>
              <div class={styles.heardMeta}>
                <span class={styles.heardLabel}>heard</span>
                <span class={styles.heardNote}>
                  commands only — lyrics do not affect the match yet
                </span>
              </div>
              <span class={styles.heardText}>“{props.heard}”</span>
            </div>
          </Show>

          <Show when={props.frozen}>
            <p class={styles.frozenLine}>
              Ranking held while you speak — the numbers stay put
            </p>
          </Show>

          <Show when={fingerprintingBusy()}>
            <p class={styles.fingerprintLine}>
              Teaching your library: {String(props.fingerprinting.done)} of{' '}
              {String(props.fingerprinting.total)} new songs fingerprinted
            </p>
          </Show>
        </Show>

        <p class={styles.hint}>
          Say "sing number one" — or tap a wedge. "cancel" stops; Escape and a
          click outside work too.
        </p>
      </div>
    </div>
  )
}
