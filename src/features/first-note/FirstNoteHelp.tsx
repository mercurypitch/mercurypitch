// ============================================================
// First note's "?": what the room is, and what a song needs for it
// ============================================================
//
// The room has no guided demo, so its "?" (the bar's, RoomShell.tsx
// ShellBarEnd `help`) opens this sheet: what a round is, in four steps, and
// what makes a place in a song where the band can stop and ask for the
// note (entry-rules.ts), in plain words. The owner's ask (1 Nov 2026): a
// singer whose song sits out should be able to tell why from here, and the
// Songs sheet's "i" on that song says it with the song's own counts.
//
// The words carry the rules' numbers as plain words, not their constants:
// the rules load only with a read (own-song-read.ts), never with the room.
// FirstNoteHelp.test.tsx holds the two together.

import type { JSX } from 'solid-js'
import { For } from 'solid-js'
import { X } from '@/components/icons'
import { Sheet } from '@/components/mobile/Sheet'
import { OWN_SONG_MIN_ENTRIES } from './first-note-rules'
import styles from './FirstNoteHelp.module.css'

/** A round, in the order it goes. */
const ROUND: readonly string[] = [
  'The band plays a song, without its singer.',
  'It counts in and stops where the singer comes in.',
  "Sing the singer's first note. Any octave counts.",
  'Hold it until it lands in the light, and the song carries on.',
]

/** What a place to come in needs: a name and its plain words. */
const NEEDS: ReadonlyArray<readonly [string, string]> = [
  [
    'A pause before the line',
    'The band plays alone for a moment, 1.6 seconds or more, so you can hear where you are.',
  ],
  [
    'A clear first note',
    'The singer lands on it straight away, with no slide, rasp or growl into it.',
  ],
  [
    'A note we are sure of',
    'Two ways of hearing the voice agree on it, it is sung in tune, and it sits near the rest of the song.',
  ],
]

export interface FirstNoteHelpProps {
  isOpen: boolean
  close: () => void
}

export function FirstNoteHelp(props: FirstNoteHelpProps): JSX.Element {
  return (
    <Sheet
      isOpen={props.isOpen}
      close={() => props.close()}
      ariaLabel="How First note works"
    >
      <div class={styles.sheet} data-testid="first-note-help-sheet">
        <div class={styles.head}>
          <div>
            <h2 class={styles.title}>How First note works</h2>
            <p class={styles.sub}>
              Come in on the singer's first note, from the band alone.
            </p>
          </div>
          <button
            type="button"
            class={styles.close}
            onClick={() => props.close()}
            aria-label="Close"
          >
            <X />
          </button>
        </div>

        <ol class={styles.steps}>
          <For each={ROUND}>
            {(step, i) => (
              <li>
                <span class={styles.step} aria-hidden="true">
                  {i() + 1}
                </span>
                <span>{step}</span>
              </li>
            )}
          </For>
        </ol>

        <section class={styles.section} aria-labelledby="first-note-help-needs">
          <h3 id="first-note-help-needs" class={styles.sectionHead}>
            Where a song can stop
          </h3>
          <p class={styles.line}>
            First note listens to each song for places to stop the band and ask
            for the next note. Each place needs:
          </p>
          <ul class={styles.needs}>
            <For each={NEEDS}>
              {([name, words]) => (
                <li>
                  <span class={styles.needName}>{name}</span>
                  <span class={styles.line}>{words}</span>
                </li>
              )}
            </For>
          </ul>
          <p class={styles.line} data-testid="first-note-help-few">
            {`A song needs at least ${OWN_SONG_MIN_ENTRIES} such places. One sung line after line, with few pauses, is also tried at shorter pauses, 0.6 seconds or more, where its synced lyrics start a line. A song that still has too few sits out: the i beside it in Songs says why.`}
          </p>
        </section>
      </div>
    </Sheet>
  )
}
