import type { Component } from 'solid-js'
import { createMemo, createSignal, createUniqueId, For, Show, untrack, } from 'solid-js'
import type { ZenExampleAudio, ZenExerciseCategory, ZenExerciseDefinition, } from '@/features/zen/types'
import { midiToNote } from '@/lib/scale-data'
import styles from './ExerciseEditor.module.css'
import { ExercisePreview } from './ExercisePreview'
import { ExerciseTimelineEditor } from './ExerciseTimelineEditor'

export type ExerciseLifecycle =
  | 'draft'
  | 'published'
  | 'superseded'
  | 'archived'

export type ExerciseEditorStatus =
  | 'idle'
  | 'loading'
  | 'saving'
  | 'publishing'
  | 'archiving'
  | 'restoring'
  | 'duplicating'
  | 'uploading'
  | 'error'

export interface ExerciseEditorValidationIssue {
  path: string
  message: string
  severity?: 'error' | 'warning'
}

export interface ExerciseEditorProps {
  value: ZenExerciseDefinition
  lifecycle: ExerciseLifecycle
  status: ExerciseEditorStatus
  validationIssues: readonly ExerciseEditorValidationIssue[]
  identityLocked?: boolean
  onChange: (value: ZenExerciseDefinition) => void
  onSave?: (value: ZenExerciseDefinition) => Promise<void>
  onPublish?: (value: ZenExerciseDefinition) => Promise<void>
  onArchive?: (value: ZenExerciseDefinition) => Promise<void>
  onRestore?: (value: ZenExerciseDefinition) => Promise<void>
  onDuplicate?: (value: ZenExerciseDefinition) => Promise<void>
  onExampleAudioFile?: (
    file: File,
    value: ZenExerciseDefinition,
  ) => Promise<ZenExampleAudio | undefined>
  onRemoveExampleAudio?: (
    audio: ZenExampleAudio,
    value: ZenExerciseDefinition,
  ) => Promise<void>
}

type LocalAction =
  | 'save'
  | 'publish'
  | 'archive'
  | 'restore'
  | 'duplicate'
  | 'upload'
  | 'remove-audio'

const CATEGORY_OPTIONS: readonly {
  value: ZenExerciseCategory
  label: string
}[] = [
  { value: 'range', label: 'Range' },
  { value: 'agility', label: 'Agility' },
  { value: 'scales', label: 'Scales' },
  { value: 'tone', label: 'Tone' },
  { value: 'articulation', label: 'Articulation' },
]

const LEVEL_OPTIONS = [
  ['foundation', 'Foundation'],
  ['developing', 'Developing'],
  ['advanced', 'Advanced'],
] as const

const EXTERNAL_BUSY_STATUSES: readonly ExerciseEditorStatus[] = [
  'loading',
  'saving',
  'publishing',
  'archiving',
  'restoring',
  'duplicating',
  'uploading',
]

const STATUS_LABELS: Record<ExerciseEditorStatus, string> = {
  idle: 'Ready',
  loading: 'Loading',
  saving: 'Saving',
  publishing: 'Publishing',
  archiving: 'Archiving',
  restoring: 'Restoring',
  duplicating: 'Duplicating',
  uploading: 'Uploading audio',
  error: 'Action failed',
}

const actionLabel = (action: LocalAction | null): string | null => {
  if (action === null) return null
  const labels: Record<LocalAction, string> = {
    save: 'Saving',
    publish: 'Publishing',
    archive: 'Archiving',
    restore: 'Restoring',
    duplicate: 'Duplicating',
    upload: 'Uploading audio',
    'remove-audio': 'Removing audio',
  }
  return labels[action]
}

const errorMessage = (error: unknown): string =>
  error instanceof Error && error.message.trim() !== ''
    ? error.message
    : 'The action could not be completed. Check the connection and try again.'

export const ExerciseEditor: Component<ExerciseEditorProps> = (props) => {
  const [view, setView] = createSignal<'author' | 'preview'>('author')
  const [selectedTargetId, setSelectedTargetId] = createSignal<string | null>(
    untrack(() => props.value.targets[0]?.id ?? null),
  )
  const [localAction, setLocalAction] = createSignal<LocalAction | null>(null)
  const [localError, setLocalError] = createSignal<string | null>(null)
  const editorId = createUniqueId()

  const busy = createMemo(
    () =>
      localAction() !== null || EXTERNAL_BUSY_STATUSES.includes(props.status),
  )
  const readOnly = createMemo(() => props.lifecycle !== 'draft' || busy())
  const blockingIssues = createMemo(() =>
    props.validationIssues.filter((issue) => issue.severity !== 'warning'),
  )
  const scoreWeightTotal = createMemo(
    () =>
      props.value.scoring.pitchWeight +
      props.value.scoring.coverageWeight +
      props.value.scoring.steadinessWeight,
  )
  const rootLabel = createMemo(() => {
    const note = midiToNote(props.value.defaultRootMidi)
    return `${note.name}${note.octave}`
  })

  const emit = (patch: Partial<ZenExerciseDefinition>): void => {
    if (readOnly()) return
    props.onChange({ ...props.value, ...patch })
  }

  const runAction = (
    action: LocalAction,
    callback: ((value: ZenExerciseDefinition) => Promise<void>) | undefined,
  ): void => {
    if (callback === undefined || busy()) return
    const value = props.value
    setLocalAction(action)
    setLocalError(null)
    void callback(value)
      .catch((error: unknown) => setLocalError(errorMessage(error)))
      .finally(() => setLocalAction(null))
  }

  const updateExampleAudio = (patch: Partial<ZenExampleAudio>): void => {
    const current = props.value.exampleAudio
    if (current === undefined || readOnly()) return
    emit({ exampleAudio: { ...current, ...patch } })
  }

  const addExampleAudioMetadata = (): void => {
    emit({
      exampleAudio: {
        src: '',
        durationMs: 5000,
        locale: 'en-GB',
        source: 'coach',
        transcript: '',
      },
    })
  }

  const uploadExampleAudio = (file: File): void => {
    const callback = props.onExampleAudioFile
    if (callback === undefined || busy() || readOnly()) return
    const value = props.value
    const onChange = props.onChange
    setLocalAction('upload')
    setLocalError(null)
    void callback(file, value)
      .then((audio) => {
        if (audio !== undefined) onChange({ ...value, exampleAudio: audio })
      })
      .catch((error: unknown) => setLocalError(errorMessage(error)))
      .finally(() => setLocalAction(null))
  }

  const removeExampleAudio = (): void => {
    const audio = props.value.exampleAudio
    if (audio === undefined || busy() || readOnly()) return
    const value = props.value
    const callback = props.onRemoveExampleAudio
    const onChange = props.onChange
    if (callback === undefined) {
      onChange({ ...value, exampleAudio: undefined })
      return
    }
    setLocalAction('remove-audio')
    setLocalError(null)
    void callback(audio, value)
      .then(() => onChange({ ...value, exampleAudio: undefined }))
      .catch((error: unknown) => setLocalError(errorMessage(error)))
      .finally(() => setLocalAction(null))
  }

  const statusText = createMemo(
    () => actionLabel(localAction()) ?? STATUS_LABELS[props.status],
  )

  return (
    <section
      class={styles.root}
      data-testid="guided-exercise-editor"
      aria-label="Guided exercise editor"
    >
      <header class={styles.appBar}>
        <div class={styles.identity}>
          <div class={styles.identityMark} aria-hidden="true">
            <span />
          </div>
          <div>
            <p>Guided exercise studio</p>
            <h2>{props.value.title || 'Untitled exercise'}</h2>
          </div>
          <span class={styles.lifecycle} data-lifecycle={props.lifecycle}>
            {props.lifecycle}
          </span>
        </div>

        <div class={styles.viewSwitch} role="tablist" aria-label="Editor view">
          <button
            type="button"
            role="tab"
            aria-selected={view() === 'author'}
            classList={{ [styles.activeView]: view() === 'author' }}
            onClick={() => setView('author')}
          >
            Author
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={view() === 'preview'}
            classList={{ [styles.activeView]: view() === 'preview' }}
            onClick={() => setView('preview')}
          >
            Preview
          </button>
        </div>

        <div class={styles.actions}>
          <span class={styles.status} aria-live="polite">
            {statusText()}
          </span>
          <Show when={props.lifecycle === 'draft'}>
            <button
              type="button"
              class={styles.secondaryAction}
              disabled={busy() || props.onSave === undefined}
              onClick={() => void runAction('save', props.onSave)}
            >
              Save draft
            </button>
            <button
              type="button"
              class={styles.primaryAction}
              disabled={
                busy() ||
                blockingIssues().length > 0 ||
                props.onPublish === undefined
              }
              title={
                blockingIssues().length > 0
                  ? 'Resolve validation errors before publishing'
                  : 'Publish this immutable exercise version'
              }
              onClick={() => void runAction('publish', props.onPublish)}
            >
              Publish
            </button>
          </Show>
          <Show when={props.lifecycle === 'published'}>
            <button
              type="button"
              class={styles.primaryAction}
              disabled={busy() || props.onDuplicate === undefined}
              onClick={() => void runAction('duplicate', props.onDuplicate)}
            >
              Create draft revision
            </button>
          </Show>
        </div>
      </header>

      <Show when={localError()}>
        <div class={styles.actionError} role="alert">
          <strong>Action failed</strong>
          <span>{localError()}</span>
          <button type="button" onClick={() => setLocalError(null)}>
            Dismiss
          </button>
        </div>
      </Show>

      <Show
        when={view() === 'author'}
        fallback={
          <div class={styles.previewView} role="tabpanel">
            <ExercisePreview value={props.value} />
          </div>
        }
      >
        <div class={styles.authorLayout} role="tabpanel">
          <main class={styles.authorMain}>
            <section
              class={styles.section}
              aria-labelledby={`${editorId}-identity-heading`}
            >
              <div class={styles.sectionHeading}>
                <div>
                  <p>Exercise definition</p>
                  <h3 id={`${editorId}-identity-heading`}>
                    Identity and coaching
                  </h3>
                </div>
                <span>Version {props.value.version}</span>
              </div>

              <div class={styles.formGrid}>
                <label class={styles.wideField}>
                  <span>Title</span>
                  <input
                    value={props.value.title}
                    disabled={readOnly()}
                    onInput={(event) =>
                      emit({ title: event.currentTarget.value })
                    }
                  />
                </label>
                <label>
                  <span>Stable ID</span>
                  <input
                    value={props.value.id}
                    disabled={readOnly() || props.identityLocked === true}
                    spellcheck={false}
                    onInput={(event) => emit({ id: event.currentTarget.value })}
                  />
                  <Show when={props.identityLocked === true}>
                    <small>The stable ID is locked after the first save.</small>
                  </Show>
                </label>
                <label>
                  <span>Category</span>
                  <select
                    value={props.value.category}
                    disabled={readOnly()}
                    onChange={(event) =>
                      emit({
                        category: event.currentTarget
                          .value as ZenExerciseCategory,
                      })
                    }
                  >
                    <For each={CATEGORY_OPTIONS}>
                      {(option) => (
                        <option value={option.value}>{option.label}</option>
                      )}
                    </For>
                  </select>
                </label>
                <label>
                  <span>Level</span>
                  <select
                    value={props.value.level}
                    disabled={readOnly()}
                    onChange={(event) =>
                      emit({
                        level: event.currentTarget.value as
                          | 'foundation'
                          | 'developing'
                          | 'advanced',
                      })
                    }
                  >
                    <For each={LEVEL_OPTIONS}>
                      {([value, label]) => (
                        <option value={value}>{label}</option>
                      )}
                    </For>
                  </select>
                </label>
                <label class={styles.wideField}>
                  <span>Catalogue summary</span>
                  <input
                    value={props.value.summary}
                    disabled={readOnly()}
                    onInput={(event) =>
                      emit({ summary: event.currentTarget.value })
                    }
                  />
                  <small>
                    One calm sentence shown before the full instructions.
                  </small>
                </label>
                <label class={styles.wideField}>
                  <span>Practice goal</span>
                  <textarea
                    rows="2"
                    value={props.value.goal}
                    disabled={readOnly()}
                    onInput={(event) =>
                      emit({ goal: event.currentTarget.value })
                    }
                  />
                </label>
                <label class={styles.wideField}>
                  <span>How to sing it</span>
                  <textarea
                    rows="4"
                    value={props.value.instructions}
                    disabled={readOnly()}
                    onInput={(event) =>
                      emit({ instructions: event.currentTarget.value })
                    }
                  />
                </label>
                <label class={styles.wideField}>
                  <span>Pronunciation guidance</span>
                  <textarea
                    rows="2"
                    value={props.value.pronunciationHint ?? ''}
                    disabled={readOnly()}
                    onInput={(event) =>
                      emit({
                        pronunciationHint:
                          event.currentTarget.value || undefined,
                      })
                    }
                  />
                </label>
                <label class={styles.wideField}>
                  <span>Safety note</span>
                  <textarea
                    rows="2"
                    value={props.value.safetyNote ?? ''}
                    disabled={readOnly()}
                    onInput={(event) =>
                      emit({
                        safetyNote: event.currentTarget.value || undefined,
                      })
                    }
                  />
                </label>
              </div>
            </section>

            <section
              class={styles.section}
              aria-labelledby={`${editorId}-timing-heading`}
            >
              <div class={styles.sectionHeading}>
                <div>
                  <p>Playback frame</p>
                  <h3 id={`${editorId}-timing-heading`}>
                    Timing and singer defaults
                  </h3>
                </div>
                <span>
                  Root {rootLabel()} · {props.value.loopBeats} beats
                </span>
              </div>
              <div class={styles.compactGrid}>
                <label>
                  <span>Tempo</span>
                  <div class={styles.unitInput}>
                    <input
                      type="number"
                      min="40"
                      max="240"
                      step="1"
                      value={props.value.bpm}
                      disabled={readOnly()}
                      onChange={(event) =>
                        emit({ bpm: Number(event.currentTarget.value) })
                      }
                    />
                    <small>BPM</small>
                  </div>
                </label>
                <label>
                  <span>Count-in</span>
                  <div class={styles.unitInput}>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={props.value.countInBeats}
                      disabled={readOnly()}
                      onChange={(event) =>
                        emit({
                          countInBeats: Number(event.currentTarget.value),
                        })
                      }
                    />
                    <small>beats</small>
                  </div>
                </label>
                <label>
                  <span>Loop length</span>
                  <div class={styles.unitInput}>
                    <input
                      type="number"
                      min="0.25"
                      step="0.25"
                      value={props.value.loopBeats}
                      disabled={readOnly()}
                      onChange={(event) =>
                        emit({
                          loopBeats: Number(event.currentTarget.value),
                        })
                      }
                    />
                    <small>beats</small>
                  </div>
                </label>
                <label>
                  <span>Default root</span>
                  <div class={styles.unitInput}>
                    <input
                      type="number"
                      min="24"
                      max="96"
                      step="1"
                      value={props.value.defaultRootMidi}
                      disabled={readOnly()}
                      onChange={(event) =>
                        emit({
                          defaultRootMidi: Number(event.currentTarget.value),
                        })
                      }
                    />
                    <small>{rootLabel()}</small>
                  </div>
                </label>
                <label>
                  <span>Target notes</span>
                  <select
                    value={props.value.defaultTargetVisibility}
                    disabled={readOnly()}
                    onChange={(event) =>
                      emit({
                        defaultTargetVisibility: event.currentTarget.value as
                          | 'off'
                          | 'dim'
                          | 'on',
                      })
                    }
                  >
                    <option value="on">Shown</option>
                    <option value="dim">Dimmed</option>
                    <option value="off">Hidden</option>
                  </select>
                </label>
                <label>
                  <span>Progress cue</span>
                  <select
                    value={props.value.defaultProgressCue}
                    disabled={readOnly()}
                    onChange={(event) =>
                      emit({
                        defaultProgressCue: event.currentTarget.value as
                          | 'none'
                          | 'playhead',
                      })
                    }
                  >
                    <option value="playhead">Playhead</option>
                    <option value="none">No playhead</option>
                  </select>
                </label>
              </div>
            </section>

            <section class={`${styles.section} ${styles.timelineSection}`}>
              <ExerciseTimelineEditor
                value={props.value}
                selectedTargetId={selectedTargetId()}
                onSelectedTargetIdChange={setSelectedTargetId}
                onChange={props.onChange}
                readOnly={readOnly()}
              />
            </section>

            <section
              class={styles.section}
              aria-labelledby={`${editorId}-scoring-heading`}
            >
              <div class={styles.sectionHeading}>
                <div>
                  <p>Measured feedback</p>
                  <h3 id={`${editorId}-scoring-heading`}>Scoring</h3>
                </div>
                <span>{scoreWeightTotal().toFixed(2)} total weight</span>
              </div>
              <div class={styles.scoringGrid}>
                <label>
                  <span>Pitch weight</span>
                  <input
                    type="number"
                    min="0"
                    step="0.05"
                    value={props.value.scoring.pitchWeight}
                    disabled={readOnly()}
                    onChange={(event) =>
                      emit({
                        scoring: {
                          ...props.value.scoring,
                          pitchWeight: Number(event.currentTarget.value),
                        },
                      })
                    }
                  />
                </label>
                <label>
                  <span>Coverage weight</span>
                  <input
                    type="number"
                    min="0"
                    step="0.05"
                    value={props.value.scoring.coverageWeight}
                    disabled={readOnly()}
                    onChange={(event) =>
                      emit({
                        scoring: {
                          ...props.value.scoring,
                          coverageWeight: Number(event.currentTarget.value),
                        },
                      })
                    }
                  />
                </label>
                <label>
                  <span>Steadiness weight</span>
                  <input
                    type="number"
                    min="0"
                    step="0.05"
                    value={props.value.scoring.steadinessWeight}
                    disabled={readOnly()}
                    onChange={(event) =>
                      emit({
                        scoring: {
                          ...props.value.scoring,
                          steadinessWeight: Number(event.currentTarget.value),
                        },
                      })
                    }
                  />
                </label>
                <label>
                  <span>Pitch tolerance</span>
                  <div class={styles.unitInput}>
                    <input
                      type="number"
                      min="1"
                      step="5"
                      value={props.value.scoring.toleranceCents}
                      disabled={readOnly()}
                      onChange={(event) =>
                        emit({
                          scoring: {
                            ...props.value.scoring,
                            toleranceCents: Number(event.currentTarget.value),
                          },
                        })
                      }
                    />
                    <small>cents</small>
                  </div>
                </label>
              </div>
              <p class={styles.scoringNote}>
                MercuryPitch scores pitch, sung coverage, and steadiness. Cue
                pronunciation is coaching content and is not scored.
              </p>
            </section>

            <section
              class={styles.section}
              aria-labelledby={`${editorId}-audio-heading`}
            >
              <div class={styles.sectionHeading}>
                <div>
                  <p>Pronunciation and tone</p>
                  <h3 id={`${editorId}-audio-heading`}>
                    Example audio (optional)
                  </h3>
                </div>
                <span>Optional at publication</span>
              </div>

              <p class={styles.audioPolicy}>
                <strong>You can publish without audio.</strong> When attached, a
                short coach or generated vocal recording teaches pronunciation
                and tone; it is lazy loaded only when the singer asks to hear
                it.
              </p>

              <Show
                when={props.value.exampleAudio}
                fallback={
                  <div class={styles.noAudio}>
                    <div>
                      <strong>No example audio attached</strong>
                      <span>
                        Leave this empty to publish without audio, or set up the
                        transcript and origin before choosing a file.
                      </span>
                    </div>
                    <button
                      type="button"
                      disabled={readOnly()}
                      onClick={addExampleAudioMetadata}
                    >
                      Set up example audio
                    </button>
                  </div>
                }
              >
                {(audio) => (
                  <div class={styles.audioEditor}>
                    <Show when={audio().src.trim() !== ''}>
                      <audio controls preload="none" src={audio().src} />
                    </Show>
                    <div class={styles.formGrid}>
                      <label class={styles.wideField}>
                        <span>Playback URL</span>
                        <input
                          value={audio().src}
                          disabled={readOnly()}
                          spellcheck={false}
                          onInput={(event) =>
                            updateExampleAudio({
                              src: event.currentTarget.value,
                            })
                          }
                        />
                        <small>
                          Filled after upload, or enter an existing managed
                          playback URL.
                        </small>
                      </label>
                      <label>
                        <span>Origin</span>
                        <select
                          value={audio().source}
                          disabled={readOnly()}
                          onChange={(event) =>
                            updateExampleAudio({
                              source: event.currentTarget.value as
                                | 'coach'
                                | 'generated'
                                | 'imported',
                            })
                          }
                        >
                          <option value="coach">Coach recording</option>
                          <option value="generated">Generated vocal</option>
                          <option value="imported">Imported</option>
                        </select>
                      </label>
                      <label>
                        <span>Duration</span>
                        <div class={styles.unitInput}>
                          <input
                            type="number"
                            min="1"
                            step="100"
                            value={audio().durationMs}
                            disabled={readOnly()}
                            onChange={(event) =>
                              updateExampleAudio({
                                durationMs: Number(event.currentTarget.value),
                              })
                            }
                          />
                          <small>ms</small>
                        </div>
                      </label>
                      <label>
                        <span>Locale</span>
                        <select value={audio().locale} disabled>
                          <option value="en-GB">English (UK)</option>
                        </select>
                      </label>
                      <label class={styles.wideField}>
                        <span>Transcript</span>
                        <input
                          value={audio().transcript}
                          disabled={readOnly()}
                          onInput={(event) =>
                            updateExampleAudio({
                              transcript: event.currentTarget.value,
                            })
                          }
                        />
                        <small>
                          Enter the exact syllable or phrase heard in the
                          recording. Required only when audio is attached.
                        </small>
                      </label>
                    </div>
                    <div class={styles.audioUpload}>
                      <label>
                        <span>
                          {audio().src.trim() === ''
                            ? 'Choose recording'
                            : 'Replace recording'}
                        </span>
                        <input
                          type="file"
                          accept="audio/*"
                          disabled={
                            readOnly() ||
                            busy() ||
                            audio().transcript.trim() === '' ||
                            props.onExampleAudioFile === undefined
                          }
                          onChange={(event) => {
                            const file = event.currentTarget.files?.[0]
                            if (file !== undefined) {
                              void uploadExampleAudio(file)
                            }
                            event.currentTarget.value = ''
                          }}
                        />
                        <small>
                          Enter the transcript above before choosing a file.
                        </small>
                      </label>
                      <p>
                        Use a short pronunciation and tone example, ideally
                        around five seconds and no larger than 2 MiB. A guide
                        tone alone is not a pronunciation recording.
                      </p>
                    </div>
                    <button
                      type="button"
                      class={styles.removeAudio}
                      disabled={readOnly() || busy()}
                      onClick={() => void removeExampleAudio()}
                    >
                      {audio().src.trim() === ''
                        ? 'Remove audio setup'
                        : 'Remove example audio'}
                    </button>
                  </div>
                )}
              </Show>
            </section>
          </main>

          <aside
            class={styles.validationRail}
            aria-labelledby={`${editorId}-validation-heading`}
          >
            <div class={styles.validationHeading}>
              <div>
                <p>Publish check</p>
                <h3 id={`${editorId}-validation-heading`}>Validation</h3>
              </div>
              <span
                classList={{
                  [styles.validationReady]: blockingIssues().length === 0,
                }}
              >
                {blockingIssues().length === 0
                  ? 'Ready'
                  : `${blockingIssues().length} to resolve`}
              </span>
            </div>
            <Show
              when={props.validationIssues.length > 0}
              fallback={
                <p class={styles.validationEmpty}>
                  The current definition passes every supplied publishing check.
                </p>
              }
            >
              <ul class={styles.issueList}>
                <For each={props.validationIssues}>
                  {(issue) => (
                    <li data-severity={issue.severity ?? 'error'}>
                      <span>{issue.path}</span>
                      <p>{issue.message}</p>
                    </li>
                  )}
                </For>
              </ul>
            </Show>

            <div class={styles.railFacts}>
              <div>
                <span>Targets</span>
                <strong>{props.value.targets.length}</strong>
              </div>
              <div>
                <span>Loop</span>
                <strong>{props.value.loopBeats} beats</strong>
              </div>
              <div>
                <span>Audio</span>
                <strong>
                  {props.value.exampleAudio === undefined
                    ? 'Optional · none'
                    : props.value.exampleAudio.src.trim() === ''
                      ? 'Setup incomplete'
                      : 'Attached'}
                </strong>
              </div>
            </div>

            <div class={styles.lifecycleActions}>
              <Show when={props.lifecycle !== 'archived'}>
                <button
                  type="button"
                  disabled={busy() || props.onArchive === undefined}
                  onClick={() => void runAction('archive', props.onArchive)}
                >
                  Archive exercise
                </button>
              </Show>
              <Show
                when={
                  props.lifecycle === 'archived' &&
                  props.onRestore !== undefined
                }
              >
                <button
                  type="button"
                  disabled={busy() || props.onRestore === undefined}
                  onClick={() => void runAction('restore', props.onRestore)}
                >
                  Restore exercise
                </button>
              </Show>
              <Show
                when={
                  props.lifecycle === 'draft' && props.onDuplicate !== undefined
                }
              >
                <button
                  type="button"
                  disabled={busy() || props.onDuplicate === undefined}
                  onClick={() => void runAction('duplicate', props.onDuplicate)}
                >
                  Duplicate draft
                </button>
              </Show>
            </div>
          </aside>
        </div>
      </Show>
    </section>
  )
}
