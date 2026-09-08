// Chord review extends the existing faceplate with a reversible comparison, not a second editor.
/* THESIS: Compare heard pitches before changing a melody.
OWN-WORLD: Velvet Rehearsal charcoal, ivory labels and amber actions.
STORY: Ask for local analysis, audition Current/Refined notes, then explicitly use or discard.
FIRST VIEWPORT: One Refine action below audition; progress and comparison replace it in place.
FORM: A compact extension of the existing review sheet, no additional modal. */
import { createMemo, Show } from 'solid-js'
import type { GuitarPracticeScore } from '@/lib/guitar/recording-types'
import styles from './GuitarChordRefinementPanel.module.css'
import type { GuitarChordRefinement } from './useGuitarChordRefinement'

export function GuitarChordRefinementPanel(props: {
  controller: GuitarChordRefinement
  score: GuitarPracticeScore
  disabled: boolean
  hasAudio: boolean
}) {
  const description = createMemo(() => {
    const progress = props.controller.progress()
    if (progress === null) return ''
    const stage = {
      loading: 'Loading chord model',
      decoding: 'Preparing recorded audio',
      analysing: 'Finding chord notes',
    }[progress.stage]
    return `${stage} · ${Math.round(progress.fraction * 100)}%`
  })
  return (
    <section class={styles.panel} aria-label="Chord refinement">
      <div class={styles.heading}>
        <strong>Find chord notes</strong>
        <span>Experimental</span>
      </div>
      <p>
        Find simultaneous notes in this recording, on your device. Check
        proposed pitches and fingering before practice.
      </p>
      <Show
        when={props.controller.running()}
        fallback={
          <Show
            when={props.controller.candidate()}
            fallback={
              <div class={styles.actions}>
                <button
                  type="button"
                  disabled={
                    props.disabled ||
                    props.controller.persisting() ||
                    !props.hasAudio
                  }
                  onClick={() => void props.controller.start()}
                >
                  Refine chords
                </button>
                <Show when={props.controller.hasBackup()}>
                  <button
                    type="button"
                    disabled={
                      props.disabled ||
                      props.controller.persisting() ||
                      !props.controller.canRestore()
                    }
                    onClick={() => void props.controller.restore()}
                  >
                    Restore previous notes
                  </button>
                </Show>
              </div>
            }
          >
            {(candidate) => (
              <>
                <fieldset
                  class={styles.comparison}
                  disabled={props.disabled || props.controller.persisting()}
                >
                  <legend>Compare notes</legend>
                  <label>
                    <input
                      type="radio"
                      name="chord-comparison"
                      checked={props.controller.comparison() === 'current'}
                      onChange={() => props.controller.compare('current')}
                    />
                    Current · {props.score.notes.length}{' '}
                    {props.score.notes.length === 1 ? 'note' : 'notes'}
                  </label>
                  <label>
                    <input
                      type="radio"
                      name="chord-comparison"
                      checked={props.controller.comparison() === 'refined'}
                      onChange={() => props.controller.compare('refined')}
                    />
                    Refined · {candidate().notes.length}{' '}
                    {candidate().notes.length === 1 ? 'note' : 'notes'}
                  </label>
                </fieldset>
                <p>
                  Choose a version, then use Notes Play above to compare.
                  Nothing is saved until you choose Use refined notes.
                </p>
                <div class={styles.actions}>
                  <button
                    type="button"
                    class={styles.primary}
                    disabled={props.disabled || props.controller.persisting()}
                    onClick={() => void props.controller.apply()}
                  >
                    {props.controller.persisting()
                      ? 'Saving refined notes…'
                      : 'Use refined notes'}
                  </button>
                  <button
                    type="button"
                    disabled={props.disabled || props.controller.persisting()}
                    onClick={() => props.controller.cancel()}
                  >
                    Keep current notes
                  </button>
                </div>
                <p>Choose either action to unlock practice and export.</p>
              </>
            )}
          </Show>
        }
      >
        <p role="status">{description()}</p>
        <progress
          aria-label="Chord analysis progress"
          max="1"
          value={props.controller.progress()?.fraction ?? 0}
        />
        <button type="button" onClick={() => props.controller.cancel()}>
          Cancel chord analysis
        </button>
      </Show>
      <Show when={!props.hasAudio}>
        <p>
          Audio is no longer on this device. You can still edit and practise the
          existing notes.
        </p>
      </Show>
      <Show
        when={
          props.controller.hasBackup() &&
          !props.controller.canRestore() &&
          !props.controller.pendingReview()
        }
      >
        <p>
          Restore is available before further edits or a new accepted practice
          revision. Previously accepted targets are always preserved.
        </p>
      </Show>
      <Show when={props.controller.error()}>
        {(message) => <p role="alert">{message()}</p>}
      </Show>
      <Show when={props.controller.notice()}>
        {(message) => <p role="status">{message()}</p>}
      </Show>
    </section>
  )
}
