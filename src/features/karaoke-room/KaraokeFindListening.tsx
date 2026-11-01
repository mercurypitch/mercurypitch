// ============================================================
// Find by singing, listening: the engine's life and what it shows
// ============================================================
//
// KaraokeFindSheet.tsx loads this when it first opens, so the engine, the
// matcher and their mic are not part of the room until a singer asks for
// them. One mount is one listening: mounted, the engine opens the mic;
// unmounted, it lets it go.
//
// The closest songs keep their rows while the ranking moves under them
// (`Index`: a row is a place in the list, its contents change in it), so a
// press is never lost to a row rebuilt mid-tap, and a tap opens the song the
// row showed as it was pressed, by its id, not whatever has moved into its
// place before the click. When the singing stops for a while, the mic is let
// go and what was found stays to be tapped, with Listen again beside it: the
// singer who stops to read the list is not cut off.

import type { Accessor, JSX } from 'solid-js'
import { createMemo, For, Index, onCleanup, Show } from 'solid-js'
import { createMercurySingEngine } from '@/features/mercury-sing/mercury-sing-engine'
import styles from './karaoke-room.module.css'
import type { MercurySingCandidateView, MercurySingHost, MercurySingLibraryEntry, } from './karaoke-room-find'
import { FIND_STATUS } from './karaoke-room-find'
import { NoteGlyph } from './karaoke-room-glyphs'

/** The trail's span, MIDI: E2 to C6, every voice's. */
const TRAIL_LOW = 40
const TRAIL_HIGH = 84
const TRAIL_W = 96
const TRAIL_H = 34

/** "0:07" */
const clock = (seconds: number): string => {
  const whole = Math.max(0, Math.floor(seconds))
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`
}

/** The sung line as strokes; a breath breaks it rather than joining across. */
function trailPaths(trail: readonly number[]): string[] {
  const span = TRAIL_HIGH - TRAIL_LOW
  const paths: string[] = []
  let current: string[] = []
  trail.forEach((midi, i) => {
    if (Number.isNaN(midi)) {
      if (current.length > 1) paths.push(current.join(' '))
      current = []
      return
    }
    const x = (i / Math.max(1, trail.length - 1)) * TRAIL_W
    const level = Math.min(1, Math.max(0, (midi - TRAIL_LOW) / span))
    const y = TRAIL_H - level * TRAIL_H
    current.push(
      `${current.length === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`,
    )
  })
  if (current.length > 1) paths.push(current.join(' '))
  return paths
}

/** The songs listened for, the ones that can be found first. */
function readyFirst(
  library: readonly MercurySingLibraryEntry[],
): MercurySingLibraryEntry[] {
  return [...library].sort((a, b) => Number(b.ready) - Number(a.ready))
}

interface MatchRowProps {
  candidate: Accessor<MercurySingCandidateView>
  /** The match the room is about to open, as the engine arms it. */
  leading: boolean
  /** It is about to open: the row says so. */
  arming: boolean
  /** Open this song. */
  pick: (sessionId: string) => void
}

function MatchRow(props: MatchRowProps): JSX.Element {
  // The song the row showed as the finger went down. A tick can re-rank the
  // rows between that press and the click it makes, and the singer meant
  // the song they pressed, not the one that has moved into the row since. A
  // click from the keyboard has no press before it and counts no clicks
  // (`detail` 0): it opens the song the row shows.
  let pressed: string | null = null
  const open = (event: MouseEvent): void => {
    const sessionId =
      event.detail > 0 && pressed !== null
        ? pressed
        : props.candidate().sessionId
    pressed = null
    props.pick(sessionId)
  }
  return (
    <li class={styles.songItem}>
      <button
        type="button"
        class={styles.songRow}
        classList={{ [styles.songRowCurrent]: props.leading }}
        onPointerDown={() => {
          pressed = props.candidate().sessionId
        }}
        // A press that turned into a scroll makes no click.
        onPointerCancel={() => {
          pressed = null
        }}
        onClick={open}
        data-testid="karaoke-find-match"
      >
        <span class={styles.songArt} aria-hidden="true">
          <NoteGlyph />
        </span>
        <span class={styles.songText}>
          <span class={styles.songTitle}>{props.candidate().name}</span>
          <span class={styles.findMeter} aria-hidden="true">
            <span
              class={styles.findMeterFill}
              style={{
                width: `${String(Math.min(100, props.candidate().confidence))}%`,
              }}
            />
          </span>
        </span>
        <span class={styles.songLength}>
          {props.leading && props.arming ? 'This one?' : 'Play'}
        </span>
      </button>
    </li>
  )
}

export interface ListeningProps {
  host: MercurySingHost
  /** Listen again: a fresh listening, the last one's mic long let go. */
  again: () => void
}

/** One listening: the engine's lifetime and what it shows. */
export function KaraokeFindListening(props: ListeningProps): JSX.Element {
  // The host is fixed for the sheet's life. The singing stopping keeps the
  // sheet and what it found (status `quiet`); nothing closes it but the
  // singer.
  // eslint-disable-next-line solid/reactivity
  const engine = createMercurySingEngine(props.host, () => undefined)
  onCleanup(() => engine.dispose())

  const listening = (): boolean => engine.status() === 'listening'
  const quiet = (): boolean => engine.status() === 'quiet'
  const hasMatches = (): boolean =>
    (listening() || quiet()) && engine.candidates().length > 0
  const paths = createMemo(() => trailPaths(engine.trail()))
  const roster = createMemo(() => readyFirst(engine.library()))

  return (
    <>
      <p class={styles.findStatus} data-testid="karaoke-find-status">
        {FIND_STATUS[engine.status()]}
      </p>

      <Show when={listening()}>
        <div class={styles.findTrailBox}>
          <svg
            class={styles.findTrail}
            viewBox={`0 0 ${String(TRAIL_W)} ${String(TRAIL_H)}`}
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <For each={paths()}>{(d) => <path d={d} />}</For>
          </svg>
          <span class={styles.findClock} data-testid="karaoke-find-clock">
            {clock(engine.elapsedSec())}
          </span>
        </div>
      </Show>

      <Show when={quiet()}>
        <button
          type="button"
          class={styles.findAgain}
          onClick={() => props.again()}
          data-testid="karaoke-find-again"
        >
          Listen again
        </button>
      </Show>

      <Show
        when={hasMatches()}
        fallback={
          <Show when={roster().length > 0 && engine.status() !== 'launching'}>
            <section class={styles.group}>
              <h3 class={styles.groupTitle}>Listening for</h3>
              <ul class={styles.songList}>
                <For each={roster()}>
                  {(song) => (
                    <li class={styles.songItem}>
                      <button
                        type="button"
                        class={styles.songRow}
                        onClick={() => engine.openFromLibrary(song.sessionId)}
                        data-testid="karaoke-find-song"
                      >
                        <span class={styles.songArt} aria-hidden="true">
                          <NoteGlyph />
                        </span>
                        <span class={styles.songText}>
                          <span class={styles.songTitle}>{song.name}</span>
                          <Show when={!song.ready}>
                            <span class={styles.songSub}>
                              Turn its notes on once to find it by singing
                            </span>
                          </Show>
                        </span>
                      </button>
                    </li>
                  )}
                </For>
              </ul>
              <p class={styles.groupNote}>A tap plays a song from the top.</p>
            </section>
          </Show>
        }
      >
        <section class={styles.group}>
          <h3 class={styles.groupTitle}>Closest</h3>
          <ul class={styles.songList}>
            <Index each={engine.candidates()}>
              {(candidate) => (
                <MatchRow
                  candidate={candidate}
                  leading={engine.armed().leaderId === candidate().sessionId}
                  arming={engine.armed().kind === 'arming'}
                  pick={(sessionId) => engine.pickSession(sessionId)}
                />
              )}
            </Index>
          </ul>
          <p class={styles.groupNote}>
            Tap your song, and it plays from where you are.
          </p>
        </section>
      </Show>
    </>
  )
}
