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
import { micLevelFraction } from '@/lib/mic-level'
import { IconMic } from './ear-icons'
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

interface SungStripProps {
  /** The notes the mic has heard so far, as degrees. */
  degrees: readonly number[]
  expectedLength: number
  words?: (degree: number) => string
  /** Input level 0..1 (RMS); the lamp glows with it. */
  level: number
  /** The window is open: the lamp is lit. */
  listening: boolean
}

/** The same strip a tapped answer fills, filled live by the mic: a
 *  lamp that glows with the input, then each note heard, in solfège. */
export function SungStrip(props: SungStripProps): JSX.Element {
  const word = (degree: number) => (props.words ?? degreeSolfege)(degree)
  return (
    <div
      class={styles.phraseStrip}
      data-testid="ear-phrase-strip"
      aria-live="polite"
      aria-label="What the mic has heard so far"
    >
      <span
        class={styles.micLamp}
        classList={{ [styles.micLampOn]: props.listening }}
        style={{ '--mic-level': String(micLevelFraction(props.level)) }}
        data-testid="ear-mic-lamp"
        aria-hidden="true"
      >
        <IconMic size={14} />
      </span>
      <For each={props.degrees}>
        {(degree) => <span class={styles.phraseChip}>{word(degree)}</span>}
      </For>
      <span class={styles.phraseCount}>
        {props.degrees.length} of {props.expectedLength}
      </span>
    </div>
  )
}
