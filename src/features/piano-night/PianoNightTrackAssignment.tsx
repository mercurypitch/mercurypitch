// ============================================================
// Piano Night track assignment — one score lane plus optional Hear lanes
// ============================================================
//
// This drawer-native editor operates directly on canonical PianoProject ids.
// Percussion remains visible as preserved source material, but stays outside
// the fallback pitched synth until Piano Night gains a drum-kit engine.

import type { JSX } from 'solid-js'
import { createMemo, createSignal, For, onMount, Show, untrack } from 'solid-js'
import { ChevronLeft, ScoreDocument } from '@/components/icons'
import type { PianoProject } from '@/features/piano-project/piano-project'
import { pianoProjectToTrackAssignment } from './piano-night-track-assignment'
import styles from './PianoNightTrackAssignment.module.css'

export interface PianoNightTrackSelection {
  readonly scoreTrackId: string
  readonly backingTrackIds: readonly string[]
}

interface PianoNightTrackAssignmentProps {
  project: PianoProject
  saving: boolean
  error: string | null
  onBack(): void
  onSave(selection: PianoNightTrackSelection): void
}

export function PianoNightTrackAssignmentEditor(
  props: PianoNightTrackAssignmentProps,
): JSX.Element {
  // The parent keys this editor by project revision, so one untracked snapshot
  // is the intentional draft authority for the lifetime of this instance.
  const assignment = pianoProjectToTrackAssignment(untrack(() => props.project))
  const [scoreTrackId, setScoreTrackId] = createSignal(
    assignment.scoreTrackId ?? '',
  )
  const [backingTrackIds, setBackingTrackIds] = createSignal(
    new Set(assignment.backingTrackIds),
  )
  let heading: HTMLHeadingElement | undefined

  const chosenHearCount = createMemo(() => {
    const score = scoreTrackId()
    const backing = backingTrackIds()
    let count = 0
    for (const track of assignment.tracks) {
      if (!track.isPercussion && track.id !== score && backing.has(track.id)) {
        count += 1
      }
    }
    return count
  })

  const chooseScore = (trackId: string): void => {
    const previousScoreTrackId = scoreTrackId()
    setScoreTrackId(trackId)
    setBackingTrackIds((current) => {
      const promotedFromHear = current.has(trackId)
      if (!promotedFromHear) return current
      const next = new Set(current)
      next.delete(trackId)
      if (previousScoreTrackId !== '') next.add(previousScoreTrackId)
      return next
    })
  }

  const chooseBacking = (trackId: string, checked: boolean): void => {
    setBackingTrackIds((current) => {
      const next = new Set(current)
      if (checked) next.add(trackId)
      else next.delete(trackId)
      return next
    })
  }

  const save = (): void => {
    const score = scoreTrackId()
    if (score === '' || props.saving) return
    const pitchedIds = new Set(
      assignment.tracks
        .filter((track) => !track.isPercussion)
        .map((track) => track.id),
    )
    props.onSave({
      scoreTrackId: score,
      backingTrackIds: [...backingTrackIds()].filter(
        (trackId) => trackId !== score && pitchedIds.has(trackId),
      ),
    })
  }

  onMount(() => heading?.focus())

  return (
    <div class={styles.editor}>
      <button
        class={styles.backButton}
        type="button"
        onClick={() => props.onBack()}
        disabled={props.saving}
      >
        <ChevronLeft />
        Back to music
      </button>

      <span class={styles.kicker}>Score and accompaniment</span>
      <h2 ref={heading} tabindex="-1">
        Arrange {props.project.name}
      </h2>
      <p class={styles.intro}>
        Choose one part to practise. Pitched Hear tracks play as fallback
        accompaniment; drum lanes stay preserved for a future drum-kit engine.
      </p>

      <div class={styles.legend} aria-hidden="true">
        <span>Score</span>
        <span>Hear</span>
        <span>Track</span>
      </div>

      <fieldset class={styles.trackList}>
        <legend class={styles.srOnly}>
          Choose one Score track and optional Hear tracks
        </legend>
        <For each={assignment.tracks}>
          {(track) => {
            const isScore = () => scoreTrackId() === track.id
            const canHear = () => !track.isPercussion && !isScore()
            return (
              <div
                class={styles.trackRow}
                classList={{
                  [styles.trackRowScore]: isScore(),
                  [styles.trackRowPercussion]: track.isPercussion,
                }}
              >
                <label
                  class={styles.choice}
                  classList={{
                    [styles.choiceDisabled]: track.isPercussion,
                  }}
                >
                  <input
                    type="radio"
                    name="piano-night-score-track"
                    value={track.id}
                    aria-label={`Score ${track.name}, channel ${track.channel + 1}, source track ${track.sourceTrackIndex + 1}`}
                    checked={isScore()}
                    disabled={track.isPercussion || props.saving}
                    onChange={() => chooseScore(track.id)}
                  />
                  <span class={styles.choiceLabel}>Score</span>
                </label>
                <label
                  class={styles.choice}
                  classList={{ [styles.choiceDisabled]: !canHear() }}
                >
                  <input
                    type="checkbox"
                    value={track.id}
                    aria-label={`Hear ${track.name}, channel ${track.channel + 1}, source track ${track.sourceTrackIndex + 1}`}
                    checked={canHear() && backingTrackIds().has(track.id)}
                    disabled={!canHear() || props.saving}
                    onChange={(event) =>
                      chooseBacking(track.id, event.currentTarget.checked)
                    }
                  />
                  <span class={styles.choiceLabel}>Hear</span>
                </label>
                <div class={styles.trackCopy}>
                  <span class={styles.trackIcon} aria-hidden="true">
                    <ScoreDocument />
                  </span>
                  <span>
                    <strong>{track.name}</strong>
                    <small>
                      {track.isPercussion
                        ? 'Drums · drum-kit playback not available yet'
                        : `${track.instrumentName} · ${track.noteCount.toLocaleString()} ${track.noteCount === 1 ? 'note' : 'notes'}`}
                    </small>
                  </span>
                </div>
              </div>
            )
          }}
        </For>
      </fieldset>

      <Show when={props.error !== null}>
        <p class={styles.error} role="alert">
          {props.error}
        </p>
      </Show>

      <div class={styles.summary} role="status" aria-live="polite">
        <span>
          <strong>1</strong> Score part
        </span>
        <span>
          <strong>{chosenHearCount()}</strong> Hear{' '}
          {chosenHearCount() === 1 ? 'part' : 'parts'}
        </span>
        <Show when={assignment.percussionTrackCount > 0}>
          <span>
            <strong>{assignment.percussionTrackCount}</strong> preserved drum{' '}
            {assignment.percussionTrackCount === 1 ? 'lane' : 'lanes'}
          </span>
        </Show>
      </div>

      <button
        class={styles.saveButton}
        type="button"
        onClick={save}
        disabled={scoreTrackId() === '' || props.saving}
      >
        {props.saving ? 'Saving track choices…' : 'Save and stage'}
      </button>
    </div>
  )
}
