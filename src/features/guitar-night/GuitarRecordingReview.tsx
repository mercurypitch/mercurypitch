// Recorder review reuses Jam Doctor's focus-managed sheet and keeps audio saving explicit.
/*
THESIS: Keep a played idea, then practise an explicitly accepted melody.
OWN-WORLD: Inherit Velvet Rehearsal's dark faceplates, amber actions and warm type.
STORY: Replay dry input, correct uncertain notes, Keep or Practice without grading the improvisation.
FIRST VIEWPORT: Dry replay and title lead; Keep and Practice stay pinned below the scrolling corrections.
FORM: Extend the existing Jam Doctor sheet, not a new editor page or visual identity.
*/
import type { Accessor } from 'solid-js'
import { createEffect, createMemo, createSignal, onCleanup, Show, untrack, } from 'solid-js'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import type { GuitarRecordingDraft } from '@/db/services/guitar-recording-service'
import { createGuitarRecordingStore } from '@/db/services/guitar-recording-service'
import type { InstrumentTuning } from '@/lib/guitar/instrument-tuning'
import { acceptRecordingScoreRevision, createRecordingScore, recordingScoreProblem, } from '@/lib/guitar/recording-score'
import type { GuitarPracticeScore } from '@/lib/guitar/recording-types'
import type { GuitarNightDoctorView } from './GuitarNightJamDoctor'
import { GuitarNightJamDoctor } from './GuitarNightJamDoctor'
import styles from './GuitarRecording.module.css'
import { recordingTime } from './GuitarRecordingControls'
import { GuitarRecordingEditor } from './GuitarRecordingEditor'

export function GuitarRecordingReview(props: {
  draft: GuitarRecordingDraft
  open: boolean
  tuning: InstrumentTuning
  onClose(): void
  onDiscard(): Promise<void>
  onSaved(): void
  onRemove(): Promise<void>
  onPractice(score: GuitarPracticeScore): Promise<void>
  onReplay(): void
  onAttach?(score: GuitarPracticeScore): Promise<void>
  fallbackFocus?: Accessor<HTMLElement | null>
}) {
  // The host keys this editor by its draft. Open/close must not reset local edits.
  const initialDraft = untrack(() => props.draft)
  const [score, setScore] = createSignal(
    initialDraft.editableScore ??
      initialDraft.acceptedScore ??
      createRecordingScore(
        initialDraft.recording,
        initialDraft.notes,
        untrack(() => props.tuning),
      ),
  )
  const [revision, setRevision] = createSignal(
    initialDraft.acceptedScore?.revision ?? 0,
  )
  const [title, setTitle] = createSignal(initialDraft.recording.title)
  const [kept, setKept] = createSignal(initialDraft.recording.state === 'kept')
  const [busy, setBusy] = createSignal(false)
  const [error, setError] = createSignal<string | null>(null)
  const [url, setUrl] = createSignal<string | null>(null)
  const [editing, setEditing] = createSignal(false)
  const [editorMounted, setEditorMounted] = createSignal(false)
  const [notice, setNotice] = createSignal<string | null>(null)
  const [deleting, setDeleting] = createSignal(false)
  const problem = createMemo(() => recordingScoreProblem(score()))
  let audio: HTMLAudioElement | undefined
  let reviewHost: HTMLDivElement | undefined
  createEffect(() => {
    const blob = props.draft.blob
    if (blob === null) return
    const objectUrl = URL.createObjectURL(blob)
    setUrl(objectUrl)
    onCleanup(() => {
      audio?.pause()
      URL.revokeObjectURL(objectUrl)
    })
  })
  createEffect(() => {
    if (!props.open) audio?.pause()
  })
  const save = async (
    action: 'keep' | 'practice' | 'attach' | 'midi' | 'gp',
  ): Promise<void> => {
    if (busy()) return
    setBusy(true)
    setError(null)
    const store = createGuitarRecordingStore()
    try {
      const corrections = { ...score(), title: title() }
      const accepted =
        action === 'keep'
          ? undefined
          : acceptRecordingScoreRevision(corrections, revision() + 1)
      if (!kept()) {
        await store.keep(
          {
            ...props.draft,
            recording: { ...props.draft.recording, title: title() },
          },
          accepted,
          corrections,
        )
        setKept(true)
      } else if (accepted !== undefined) await store.accept(accepted)
      else {
        await store.saveCorrections(corrections)
        setNotice('Note corrections saved on this device.')
      }
      props.onSaved()
      if (accepted !== undefined) {
        setRevision(accepted.revision)
        setScore(accepted)
        audio?.pause()
        if (action === 'practice') await props.onPractice(accepted)
        else if (action === 'attach') await props.onAttach?.(accepted)
        else {
          const { downloadRecordingScore } =
            await import('@/lib/guitar/recording-export')
          await downloadRecordingScore(
            accepted,
            action === 'gp' ? 'gp' : 'mid',
            reviewHost,
          )
          setNotice(
            `Revision ${accepted.revision} saved and exported. Original audio is unchanged.`,
          )
        }
      }
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Could not save this take. Try again; the draft is still available.',
      )
    } finally {
      setBusy(false)
    }
  }
  const view = createMemo<GuitarNightDoctorView>(() => ({
    anchorLabel: `Recorded melody · ${recordingTime(props.draft.recording.frames / props.draft.recording.sampleRate)}`,
    headline:
      props.draft.notes.length > 0
        ? `${props.draft.notes.length} ${props.draft.notes.length === 1 ? 'note' : 'notes'} captured.`
        : 'Audio captured. No stable notes identified.',
    detail:
      'Detected melody · draft. Single notes work best; chords and bends may need correction.',
    evidence: [],
    unavailableReasons: [],
    recoveryLabel: 'Back to playing',
    privacyCopy:
      'Audio and note evidence stay on this device. This improvisation has no accuracy grade.',
  }))
  return (
    <>
      <div class={styles.reviewOverlay}>
        <GuitarNightJamDoctor
          open={props.open && !deleting()}
          view={view()}
          onClose={() => {
            if (!busy()) props.onClose()
          }}
          onRecover={() => {
            if (!busy()) props.onClose()
          }}
          fallbackFocus={props.fallbackFocus}
          actions={
            <div class={`${styles.actions} ${styles.mainActions}`}>
              <button
                type="button"
                class={styles.primary}
                disabled={kept() || busy() || props.draft.blob === null}
                onClick={() => void save('keep')}
              >
                {busy()
                  ? 'Saving…'
                  : kept()
                    ? 'Take kept'
                    : props.draft.notes.length
                      ? 'Keep take'
                      : 'Keep audio only'}
              </button>
              <button
                type="button"
                disabled={
                  busy() ||
                  problem() !== null ||
                  (!kept() && props.draft.blob === null)
                }
                onClick={() => void save('practice')}
              >
                Practice these notes
              </button>
            </div>
          }
          footer={
            <div class={styles.review} ref={reviewHost}>
              <Show when={props.draft.recording.interruption}>
                {(reason) => <p role="status">{reason()}</p>}
              </Show>
              <label>
                Take title
                <input
                  value={title()}
                  maxLength={180}
                  onInput={(event) => setTitle(event.currentTarget.value)}
                  disabled={kept() || busy()}
                />
              </label>
              <Show
                when={url()}
                fallback={
                  <p>
                    Audio is unavailable. Any accepted practice notes remain on
                    this device.
                  </p>
                }
              >
                {(source) => (
                  <label>
                    Dry input replay
                    <audio
                      ref={audio}
                      controls
                      preload="none"
                      src={source()}
                      onPlay={() => props.onReplay()}
                    />
                  </label>
                )}
              </Show>
              <Show when={props.draft.notes.length > 0}>
                <button
                  type="button"
                  disabled={busy()}
                  aria-expanded={editing()}
                  onClick={() => {
                    setEditorMounted(true)
                    setEditing(!editing())
                  }}
                >
                  {editing()
                    ? 'Hide note corrections'
                    : 'Review and correct notes'}
                </button>
                <Show when={editorMounted()}>
                  <div hidden={!editing()}>
                    <GuitarRecordingEditor
                      score={score()}
                      disabled={busy()}
                      onChange={setScore}
                    />
                  </div>
                </Show>
                <p>
                  {score().bpm} BPM · {score().timeSignature.join('/')} display
                  grid. Practice scores your next performance against these
                  notes.
                </p>
              </Show>
              <Show when={problem()}>{(reason) => <p>{reason()}</p>}</Show>
              <Show when={error()}>
                {(message) => <p role="alert">{message()}</p>}
              </Show>
              <Show when={notice()}>
                {(message) => <p role="status">{message()}</p>}
              </Show>
              <div class={styles.actions}>
                <Show when={kept() && editing()}>
                  <button
                    type="button"
                    disabled={busy()}
                    onClick={() => void save('keep')}
                  >
                    Save note corrections
                  </button>
                </Show>
                <Show when={!kept()}>
                  <button
                    type="button"
                    disabled={busy()}
                    onClick={() =>
                      void props
                        .onDiscard()
                        .catch((cause: unknown) =>
                          setError(
                            cause instanceof Error
                              ? cause.message
                              : 'Could not discard this draft.',
                          ),
                        )
                    }
                  >
                    Discard recording
                  </button>
                </Show>
              </div>
              <Show when={score().notes.length > 0}>
                <p>Attach and export also keep a practice revision.</p>
                <div class={styles.actions}>
                  <Show when={props.onAttach}>
                    <button
                      type="button"
                      disabled={busy() || problem() !== null}
                      onClick={() => void save('attach')}
                    >
                      Attach to a song
                    </button>
                  </Show>
                  <button
                    type="button"
                    disabled={busy() || problem() !== null}
                    onClick={() => void save('midi')}
                  >
                    Export MIDI
                  </button>
                  <button
                    type="button"
                    disabled={busy() || problem() !== null}
                    onClick={() => void save('gp')}
                  >
                    Export Guitar Pro
                  </button>
                </div>
              </Show>
              <Show when={kept()}>
                <button
                  type="button"
                  disabled={busy()}
                  onClick={() => setDeleting(true)}
                >
                  Remove recording and notes
                </button>
              </Show>
            </div>
          }
        />
      </div>
      <ConfirmDialog
        open={props.open && deleting()}
        title="Remove this recording and its notes?"
        message={
          <>
            Delete the dry audio, detected evidence and every practice revision
            of <strong>{title()}</strong> on this device? This cannot be undone.
            Other recordings and practice attempts remain.{' '}
            <Show when={error()}>
              <p role="alert">{error()}</p>
            </Show>
          </>
        }
        busy={busy()}
        confirmLabel="Remove audio and notes"
        onCancel={() => setDeleting(false)}
        onConfirm={() => {
          if (busy()) return
          setBusy(true)
          setError(null)
          void props
            .onRemove()
            .catch((cause: unknown) =>
              setError(
                cause instanceof Error
                  ? cause.message
                  : 'Could not remove this recording.',
              ),
            )
            .finally(() => setBusy(false))
        }}
      />
    </>
  )
}
