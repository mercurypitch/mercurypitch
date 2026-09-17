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

function noteCountLabel(count: number) {
  return `${count} ${count === 1 ? 'note' : 'notes'}`
}

function selectedState(selected: boolean) {
  return selected ? 'true' : 'false'
}

function describeRefinementDelta(delta: number) {
  if (delta === 0) return 'The refined pass kept the same note count.'
  if (delta > 0)
    return `${delta} additional ${delta === 1 ? 'pitch' : 'pitches'} found.`
  const fewer = Math.abs(delta)
  return `${fewer} fewer ${fewer === 1 ? 'pitch' : 'pitches'} proposed.`
}

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
  const addedNotes = createMemo(
    () =>
      (props.controller.candidate()?.notes.length ?? props.score.notes.length) -
      props.score.notes.length,
  )
  return (
    <section class={styles.panel} aria-label="Chord refinement">
      <div class={styles.heading}>
        <strong>Chord analysis</strong>
        <span>Experimental</span>
      </div>
      <Show
        when={props.controller.running()}
        fallback={
          <Show
            when={props.controller.candidate()}
            fallback={
              <>
                <p class={styles.intro}>
                  Find simultaneous pitches in the dry recording. Nothing
                  changes until you accept the result.
                </p>
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
                      class={styles.quietAction}
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
              </>
            }
          >
            {(candidate) => (
              <>
                <fieldset
                  class={styles.comparison}
                  disabled={props.disabled || props.controller.persisting()}
                >
                  <legend>Choose the note set to preview</legend>
                  <label
                    data-selected={selectedState(
                      props.controller.comparison() === 'current',
                    )}
                  >
                    <input
                      type="radio"
                      name="chord-comparison"
                      aria-label={`Current · ${noteCountLabel(props.score.notes.length)}`}
                      checked={props.controller.comparison() === 'current'}
                      onChange={() => props.controller.compare('current')}
                    />
                    <span>
                      <strong>Current</strong>
                      <small>{noteCountLabel(props.score.notes.length)}</small>
                    </span>
                  </label>
                  <label
                    data-selected={selectedState(
                      props.controller.comparison() === 'refined',
                    )}
                  >
                    <input
                      type="radio"
                      name="chord-comparison"
                      aria-label={`Refined · ${noteCountLabel(candidate().notes.length)}`}
                      checked={props.controller.comparison() === 'refined'}
                      onChange={() => props.controller.compare('refined')}
                    />
                    <span>
                      <strong>Refined</strong>
                      <small>{noteCountLabel(candidate().notes.length)}</small>
                    </span>
                  </label>
                </fieldset>
                <p class={styles.delta}>
                  {describeRefinementDelta(addedNotes())} Use Notes in Listen
                  above to compare.
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
              </>
            )}
          </Show>
        }
      >
        <div class={styles.progressHeader}>
          <p role="status">{description()}</p>
          <button
            type="button"
            aria-label="Cancel chord analysis"
            onClick={() => props.controller.cancel()}
          >
            Cancel
          </button>
        </div>
        <progress
          aria-label="Chord analysis progress"
          max="1"
          value={props.controller.progress()?.fraction ?? 0}
        />
      </Show>
      <Show when={!props.hasAudio}>
        <p class={styles.inlineState}>
          Audio is unavailable. Existing notes can still be edited and
          practised.
        </p>
      </Show>
      <Show
        when={
          props.controller.hasBackup() &&
          !props.controller.canRestore() &&
          !props.controller.pendingReview()
        }
      >
        <p class={styles.inlineState}>
          Previous notes are protected, but this version can no longer be
          restored after later edits.
        </p>
      </Show>
      <Show when={props.controller.error()}>
        {(message) => (
          <p class={styles.inlineState} role="alert">
            {message()}
          </p>
        )}
      </Show>
      <Show when={props.controller.notice()}>
        {(message) => (
          <p class={styles.inlineState} role="status">
            {message()}
          </p>
        )}
      </Show>
    </section>
  )
}
