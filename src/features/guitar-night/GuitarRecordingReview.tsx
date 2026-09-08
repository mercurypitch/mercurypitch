// Recorder review reuses Jam Doctor's focus-managed sheet and keeps audio saving explicit.
/*
THESIS: Keep a played idea, then practise an explicitly accepted melody.
OWN-WORLD: Inherit Velvet Rehearsal's dark faceplates, amber actions and warm type.
STORY: Replay input or transcribed notes with a reversible tone, then Keep or Practice explicitly.
FIRST VIEWPORT: Source, tone and title lead; Keep and Practice stay pinned below the scrolling corrections.
FORM: Extend the existing Jam Doctor sheet, not a new editor page or visual identity.
*/
import type { Accessor } from 'solid-js'
import { batch, createEffect, createMemo, createSignal, Show, untrack, } from 'solid-js'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import type { GuitarRecordingDraft } from '@/db/services/guitar-recording-service'
import { createGuitarRecordingStore } from '@/db/services/guitar-recording-service'
import type { InstrumentTuning } from '@/lib/guitar/instrument-tuning'
import { acceptRecordingScoreRevision, createRecordingScore, recordingMidiProblem, recordingNoteNeedsFingering, recordingScoreProblem, } from '@/lib/guitar/recording-score'
import type { GuitarPracticeScore } from '@/lib/guitar/recording-types'
import { acceptRecordingPractice } from './accept-recording-practice'
import { GuitarChordRefinementPanel } from './GuitarChordRefinementPanel'
import type { GuitarNightDoctorView } from './GuitarNightJamDoctor'
import { GuitarNightJamDoctor } from './GuitarNightJamDoctor'
import styles from './GuitarRecording.module.css'
import { recordingTime } from './GuitarRecordingControls'
import { GuitarRecordingEditor } from './GuitarRecordingEditor'
import { GuitarRecordingPlaybackControls } from './GuitarRecordingPlaybackControls'
import { useGuitarChordRefinement } from './useGuitarChordRefinement'
import type { GuitarRecordingPlayback } from './useGuitarRecordingPlayback'

export function GuitarRecordingReview(props: {
  draft: GuitarRecordingDraft
  open: boolean
  autoRefine?: boolean
  onAutoRefine?(): void
  tuning: InstrumentTuning
  onClose(): void
  onDiscard(): Promise<void>
  onSaved(): void
  onPreviewScore?(score: GuitarPracticeScore): void
  onRemove(): Promise<void>
  onPractice(score: GuitarPracticeScore): Promise<void>
  playback: GuitarRecordingPlayback
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
  const [title, setTitle] = createSignal(
    initialDraft.editableScore?.title ??
      initialDraft.acceptedScore?.title ??
      initialDraft.recording.title,
  )
  const [kept, setKept] = createSignal(initialDraft.recording.state === 'kept')
  const [busy, setBusy] = createSignal(false)
  const [discarding, setDiscarding] = createSignal(false)
  const [error, setError] = createSignal<string | null>(null)
  const [editing, setEditing] = createSignal(false)
  const [editorMounted, setEditorMounted] = createSignal(false)
  const [notice, setNotice] = createSignal<string | null>(null)
  const [deleting, setDeleting] = createSignal(false)
  const editableScore = createMemo(() => {
    const current = score()
    return current.title === title() ? current : { ...current, title: title() }
  })
  const problem = createMemo(() => recordingScoreProblem(score()))
  const midiProblem = createMemo(() => recordingMidiProblem(score()))
  const fingeringCount = createMemo(
    () =>
      score().notes.filter((note) => recordingNoteNeedsFingering(score(), note))
        .length,
  )
  const refinement = useGuitarChordRefinement({
    draft: initialDraft,
    open: () => props.open,
    score: editableScore,
    blocked: () => busy() || deleting(),
    autoStart: () => props.autoRefine === true,
    onAutoStart: () => props.onAutoRefine?.(),
    onScore: (next) =>
      batch(() => {
        setEditorMounted(false)
        setEditing(false)
        setScore(next)
        setTitle(next.title)
      }),
    onSaved: () => props.onSaved(),
    get playback() {
      return props.playback
    },
  })
  const locked = () => busy() || refinement.locked()
  createEffect(() =>
    props.onPreviewScore?.(refinement.preview() ?? editableScore()),
  )
  let reviewHost: HTMLDivElement | undefined
  createEffect(() => {
    if (!props.open || busy() || deleting())
      untrack(() => props.playback.pause())
  })
  const save = async (
    action: 'keep' | 'practice' | 'attach' | 'midi' | 'gp',
  ): Promise<void> => {
    if (locked()) return
    setBusy(true)
    setError(null)
    const store = createGuitarRecordingStore()
    try {
      const corrections = editableScore()
      if (action === 'practice') {
        const accepted = await acceptRecordingPractice(
          props.draft,
          corrections,
          store,
        )
        setKept(true)
        setRevision(accepted.revision)
        setScore(accepted)
        await refinement.saved(corrections, accepted.id)
        props.onSaved()
        props.playback.pause()
        await props.onPractice(accepted)
        return
      }
      const accepted =
        action === 'keep' || action === 'midi'
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
      await refinement.saved(corrections, accepted?.id)
      props.onSaved()
      if (action === 'midi') {
        const { downloadRecordingScore } =
          await import('@/lib/guitar/recording-export')
        await downloadRecordingScore(corrections, 'mid', reviewHost)
        setNotice(
          'MIDI exported with these note corrections. Original audio and any accepted practice revision are unchanged.',
        )
      }
      if (accepted !== undefined) {
        setRevision(accepted.revision)
        setScore(accepted)
        props.playback.pause()
        if (action === 'attach') await props.onAttach?.(accepted)
        else {
          const { downloadRecordingScore } =
            await import('@/lib/guitar/recording-export')
          await downloadRecordingScore(
            accepted,
            action === 'gp' ? 'gp' : 'mid',
            reviewHost,
          )
          setNotice(
            `Revision ${accepted.revision} saved. Guitar Pro exported with thirty-second-note timing. Saved audio and practice timing are unchanged.`,
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
  const discard = async (): Promise<void> => {
    if (locked()) return
    setBusy(true)
    setDiscarding(true)
    setError(null)
    try {
      await props.onDiscard()
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Could not discard this draft.',
      )
    } finally {
      setDiscarding(false)
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
      score().refinement !== undefined
        ? 'Chord-refined draft. Review pitches and suggested fingering before practice; bends are not transcribed.'
        : 'Detected melody · draft. Try Refine chords for simultaneous notes after recording.',
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
            if (!busy() && !refinement.persisting()) {
              refinement.cancel()
              props.onClose()
            }
          }}
          onRecover={() => {
            if (!busy() && !refinement.persisting()) {
              refinement.cancel()
              props.onClose()
            }
          }}
          fallbackFocus={props.fallbackFocus}
          actions={
            <div class={`${styles.actions} ${styles.mainActions}`}>
              <button
                type="button"
                class={styles.primary}
                disabled={kept() || locked() || props.draft.blob === null}
                onClick={() => void save('keep')}
              >
                {busy()
                  ? discarding()
                    ? 'Discarding…'
                    : 'Saving…'
                  : kept()
                    ? 'Take kept'
                    : props.draft.notes.length
                      ? 'Keep take'
                      : 'Keep audio only'}
              </button>
              <button
                type="button"
                disabled={
                  locked() ||
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
              <GuitarRecordingPlaybackControls
                playback={props.playback}
                transport
                details
                disabled={
                  busy() || refinement.running() || refinement.persisting()
                }
              />
              <GuitarChordRefinementPanel
                controller={refinement}
                score={score()}
                disabled={busy()}
                hasAudio={props.draft.blob !== null}
              />
              <label>
                Take title
                <input
                  value={title()}
                  maxLength={180}
                  onInput={(event) => setTitle(event.currentTarget.value)}
                  disabled={kept() || locked()}
                />
              </label>
              <Show when={score().notes.length > 0}>
                <Show when={fingeringCount() > 0}>
                  <p>
                    {fingeringCount()}{' '}
                    {fingeringCount() === 1 ? 'note needs' : 'notes need'}{' '}
                    fingering before guitar practice, attachment or Guitar Pro
                    export. MIDI can keep pitches outside this tuning.
                  </p>
                </Show>
                <button
                  type="button"
                  disabled={locked()}
                  aria-expanded={editing()}
                  onClick={() => {
                    setEditorMounted(true)
                    setEditing(!editing())
                  }}
                >
                  {editing()
                    ? 'Hide note corrections'
                    : fingeringCount() > 0
                      ? `Review ${fingeringCount()} problem ${fingeringCount() === 1 ? 'note' : 'notes'}`
                      : 'Review and correct notes'}
                </button>
                <Show when={editorMounted()}>
                  <div hidden={!editing()}>
                    <GuitarRecordingEditor
                      score={score()}
                      disabled={locked()}
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
                    disabled={locked()}
                    onClick={() => void save('keep')}
                  >
                    Save note corrections
                  </button>
                </Show>
                <Show when={!kept()}>
                  <button
                    type="button"
                    disabled={locked()}
                    onClick={() => void discard()}
                  >
                    Discard recording
                  </button>
                </Show>
              </div>
              <Show when={score().notes.length > 0}>
                <p>
                  Attach opens the song chooser. Attach and Guitar Pro export
                  keep a playable practice revision; MIDI saves the current note
                  corrections.
                </p>
                <p id="recording-export-timing">
                  Guitar Pro rounds timing to thirty-second notes for readable
                  notation. MIDI keeps your played timing. Neither changes this
                  take’s audio or practice timing.
                </p>
                <div class={styles.actions}>
                  <Show when={props.onAttach}>
                    <button
                      type="button"
                      disabled={locked() || problem() !== null}
                      onClick={() => void save('attach')}
                    >
                      Attach to a song
                    </button>
                  </Show>
                  <button
                    type="button"
                    disabled={locked() || midiProblem() !== null}
                    onClick={() => void save('midi')}
                  >
                    Export MIDI
                  </button>
                  <button
                    type="button"
                    disabled={locked() || problem() !== null}
                    aria-describedby="recording-export-timing"
                    onClick={() => void save('gp')}
                  >
                    Export Guitar Pro
                  </button>
                </div>
              </Show>
              <Show when={kept()}>
                <button
                  type="button"
                  disabled={locked()}
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
