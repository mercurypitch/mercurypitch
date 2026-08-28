// ============================================================
// PhraseConsole — the ladder a phrase is tapped back on.
//
// Eight rungs, 1 to the tonic above, and a strip that shows what
// has been tapped so far in solfège, so the player can see the
// phrase forming and take one note back. The console never says
// whether a note was right until the whole phrase is in — a note-
// by-note verdict would turn recall into a guessing game.
// ============================================================

import type { JSX } from 'solid-js'
import { For, Show } from 'solid-js'
import { degreeSolfege, PHRASE_DEGREES } from '@/lib/ear/phrase'
import { ConsoleLink, Pads, StagePad } from './EarStage'
import styles from './EarStage.module.css'

interface PhraseConsoleProps {
  expectedLength: number
  answered: readonly number[]
  armed: boolean
  label: string
  /** The rungs; eight, 1 to the tonic above, unless told otherwise. */
  degrees?: readonly number[]
  /** The word under a rung and in the strip; solfège unless told. */
  words?: (degree: number) => string
  onTap: (degree: number) => void
  onUndo: () => void
}

export function PhraseConsole(props: PhraseConsoleProps): JSX.Element {
  const degrees = () => props.degrees ?? PHRASE_DEGREES
  const word = (degree: number) => (props.words ?? degreeSolfege)(degree)
  return (
    <>
      <div
        class={styles.phraseStrip}
        data-testid="ear-phrase-strip"
        aria-live="polite"
        aria-label="Your phrase so far"
      >
        <For each={props.answered}>
          {(degree) => <span class={styles.phraseChip}>{word(degree)}</span>}
        </For>
        <span class={styles.phraseCount}>
          {props.answered.length} of {props.expectedLength}
        </span>
        <Show when={props.armed && props.answered.length > 0}>
          <ConsoleLink onClick={() => props.onUndo()}>
            Take one back
          </ConsoleLink>
        </Show>
      </div>
      <Pads columns={degrees().length} compact label={props.label}>
        <For each={degrees()}>
          {(degree) => (
            <StagePad
              keycap={String(degree)}
              label={degree === 8 ? '1′' : String(degree)}
              sub={word(degree)}
              disabled={!props.armed}
              onClick={() => props.onTap(degree)}
            />
          )}
        </For>
      </Pads>
    </>
  )
}
