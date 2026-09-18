// Recorder review reuses Jam Doctor's focus-managed sheet and keeps audio saving explicit.
/*
THESIS: Keep a played idea, then practice an explicitly accepted melody.
OWN-WORLD: Inherit Velvet Rehearsal's dark faceplates, amber actions and warm type.
STORY: Replay input or transcribed notes with a reversible tone, then Keep or Practice explicitly.
FIRST VIEWPORT: Source, tone and title lead; Keep and Practice stay pinned below the scrolling corrections.
FORM: Extend the existing Jam Doctor sheet, not a new editor page or visual identity.
*/
import type { Accessor } from 'solid-js'
import { batch, createEffect, createMemo, createSignal, Show, untrack, } from 'solid-js'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { Download, GuitarTab, LinkChain, Midi, MoreHorizontal, Pencil, Sparkles, Trash2, } from '@/components/icons'
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
  const [refineExpanded, setRefineExpanded] = createSignal(
    initialDraft.refinementBackup !== undefined ||
      untrack(() => props.autoRefine === true),
  )
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
  const refinementSummary = createMemo(() => {
    const progress = refinement.progress()
    if (progress !== null)
      return `Finding chord notes · ${Math.round(progress.fraction * 100)}%`
    const candidate = refinement.candidate()
    if (candidate !== null)
      return `${score().notes.length} → ${candidate.notes.length} notes`
    if (score().refinement !== undefined)
      return `Chord pass applied · ${score().notes.length} notes`
    if (fingeringCount() > 0)
      return `${score().notes.length} notes · ${fingeringCount()} need fingering`
    return `${score().notes.length} ${score().notes.length === 1 ? 'note' : 'notes'} ready`
  })
  const exportSourceLabel = createMemo(() =>
    props.playback.source() === 'recording' ? 'Recording' : 'Notes',
  )
  const exportToneLabel = createMemo(() => {
    if (props.playback.tone() === 'clean') return 'Clean'
    if (props.playback.tone() === 'saved-amp') return 'Saved amp'
    return 'Current amp'
  })
  createEffect(() => {
    if (
      refinement.running() ||
      refinement.pendingReview() ||
      refinement.error() !== null
    )
      setRefineExpanded(true)
  })
  const locked = () =>
    busy() || refinement.locked() || props.playback.exporting()
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
    detail: kept() ? 'Kept on this device.' : 'Draft on this device.',
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
          variant="recording-review"
          view={view()}
          onClose={() => {
            if (
              !busy() &&
              !refinement.persisting() &&
              !props.playback.exporting()
            ) {
              refinement.cancel()
              props.onClose()
            }
          }}
          onRecover={() => {
            if (
              !busy() &&
              !refinement.persisting() &&
              !props.playback.exporting()
            ) {
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
                {(reason) => (
                  <p class={styles.reviewNotice} role="status">
                    {reason()}
                  </p>
                )}
              </Show>
              <section
                class={styles.reviewSection}
                aria-labelledby="recording-listen-heading"
              >
                <div class={styles.sectionHeading}>
                  <div>
                    <strong id="recording-listen-heading">Listen</strong>
                    <span>Recording, notes and amp playback</span>
                  </div>
                </div>
                <label class={styles.titleField}>
                  <span>Take title</span>
                  <input
                    value={title()}
                    maxLength={180}
                    onInput={(event) => setTitle(event.currentTarget.value)}
                    disabled={kept() || locked()}
                  />
                </label>
                <GuitarRecordingPlaybackControls
                  playback={props.playback}
                  transport
                  details
                  disabled={
                    busy() || refinement.running() || refinement.persisting()
                  }
                />
              </section>

              <section
                class={styles.refineSection}
                data-expanded={refineExpanded() ? 'true' : 'false'}
                aria-labelledby="recording-refine-heading"
              >
                <div class={styles.refineHeading}>
                  <button
                    type="button"
                    class={styles.sectionDisclosure}
                    aria-expanded={refineExpanded()}
                    aria-controls="recording-refine-body"
                    onClick={() => {
                      const expanded = !refineExpanded()
                      batch(() => {
                        setRefineExpanded(expanded)
                        if (!expanded) setEditing(false)
                      })
                    }}
                  >
                    <span class={styles.sectionIcon} aria-hidden="true">
                      <Sparkles />
                    </span>
                    <span class={styles.sectionCopy}>
                      <strong id="recording-refine-heading">
                        Refine notes
                      </strong>
                      <small>{refinementSummary()}</small>
                    </span>
                    <span class={styles.disclosureMark} aria-hidden="true">
                      {refineExpanded() ? '−' : '+'}
                    </span>
                  </button>
                  <Show when={score().notes.length > 0}>
                    <button
                      type="button"
                      class={styles.editShortcut}
                      disabled={locked()}
                      aria-expanded={editing()}
                      aria-label={
                        editing()
                          ? 'Hide note corrections'
                          : fingeringCount() > 0
                            ? `Review ${fingeringCount()} problem ${fingeringCount() === 1 ? 'note' : 'notes'}`
                            : 'Review and correct notes'
                      }
                      onClick={() => {
                        setRefineExpanded(true)
                        setEditorMounted(true)
                        setEditing(!editing())
                      }}
                    >
                      <Pencil />
                      <span>{editing() ? 'Close editor' : 'Edit notes'}</span>
                    </button>
                  </Show>
                </div>
                <Show when={refineExpanded()}>
                  <div class={styles.refineBody} id="recording-refine-body">
                    <GuitarChordRefinementPanel
                      controller={refinement}
                      score={score()}
                      disabled={busy()}
                      hasAudio={props.draft.blob !== null}
                    />
                    <Show when={score().notes.length > 0}>
                      <div class={styles.manualSummary}>
                        <div>
                          <strong>Manual corrections</strong>
                          <span>
                            {fingeringCount() > 0
                              ? `${fingeringCount()} ${fingeringCount() === 1 ? 'note needs' : 'notes need'} fingering`
                              : 'Pitch, timing and fingering are ready to review'}
                          </span>
                        </div>
                        <span>
                          {score().bpm} BPM · {score().timeSignature.join('/')}
                        </span>
                      </div>
                      <Show when={editorMounted()}>
                        <div class={styles.editorMount} hidden={!editing()}>
                          <GuitarRecordingEditor
                            score={score()}
                            disabled={locked()}
                            onChange={setScore}
                          />
                          <Show when={kept()}>
                            <button
                              type="button"
                              class={styles.saveCorrections}
                              disabled={locked()}
                              onClick={() => void save('keep')}
                            >
                              Save note corrections
                            </button>
                          </Show>
                        </div>
                      </Show>
                    </Show>
                    <Show when={problem()}>
                      {(reason) => (
                        <p class={styles.reviewNotice}>{reason()}</p>
                      )}
                    </Show>
                  </div>
                </Show>
              </section>

              <section
                class={styles.reviewSection}
                aria-labelledby="recording-export-heading"
              >
                <div class={styles.sectionHeading}>
                  <div>
                    <strong id="recording-export-heading">
                      Export current setup
                    </strong>
                    <span>What you hear in Listen above</span>
                  </div>
                </div>
                <div
                  class={styles.exportSummary}
                  role="group"
                  aria-label="Audio export setup"
                >
                  <span>{exportSourceLabel()}</span>
                  <span>{exportToneLabel()}</span>
                  <Show when={props.playback.drumTrackAvailable()}>
                    <span>
                      {props.playback.drumsMuted()
                        ? 'Drums muted'
                        : `Drums ${Math.round(props.playback.drumLevel() * 100)}%`}
                    </span>
                  </Show>
                </div>
                <button
                  type="button"
                  class={styles.exportPrimary}
                  aria-label="Export audio mix"
                  disabled={locked() || !props.playback.available()}
                  onClick={() => void props.playback.exportMix(reviewHost)}
                >
                  <Download />
                  <span>
                    {props.playback.exporting()
                      ? 'Rendering WAV…'
                      : 'Download WAV'}
                  </span>
                </button>
                <Show when={score().notes.length > 0}>
                  <div class={styles.notationHeading}>
                    <strong>Notes and tab</strong>
                    <span>Exports the corrected melody, not the audio mix</span>
                  </div>
                  <span
                    id="recording-export-timing"
                    class={styles.visuallyHidden}
                  >
                    Guitar Pro rounds timing to thirty-second notes for readable
                    notation. MIDI keeps your played timing. Neither changes
                    this take’s audio or practice timing.
                  </span>
                  <div class={styles.exportActions}>
                    <Show when={props.onAttach}>
                      <button
                        type="button"
                        aria-label="Attach to a song"
                        disabled={locked() || problem() !== null}
                        title={problem() ?? 'Attach these notes to a song'}
                        onClick={() => void save('attach')}
                      >
                        <LinkChain />
                        <span>Attach</span>
                      </button>
                    </Show>
                    <button
                      type="button"
                      aria-label="Export MIDI"
                      disabled={locked() || midiProblem() !== null}
                      title={midiProblem() ?? 'Export MIDI'}
                      onClick={() => void save('midi')}
                    >
                      <Midi />
                      <span>MIDI</span>
                    </button>
                    <button
                      type="button"
                      aria-label="Export Guitar Pro"
                      disabled={locked() || problem() !== null}
                      title={problem() ?? 'Export Guitar Pro 7'}
                      aria-describedby="recording-export-timing"
                      onClick={() => void save('gp')}
                    >
                      <GuitarTab />
                      <span>Guitar Pro</span>
                    </button>
                  </div>
                  <details class={styles.exportDetails}>
                    <summary>Timing and format details</summary>
                    <p>
                      Guitar Pro rounds timing to thirty-second notes for
                      readable notation. MIDI keeps your played timing. Neither
                      changes this take’s audio or practice timing.
                    </p>
                  </details>
                </Show>
              </section>

              <Show when={error()}>
                {(message) => (
                  <p class={styles.reviewNotice} role="alert">
                    {message()}
                  </p>
                )}
              </Show>
              <Show when={notice()}>
                {(message) => (
                  <p class={styles.reviewNotice} role="status">
                    {message()}
                  </p>
                )}
              </Show>

              <div class={styles.secondaryActions}>
                <span aria-hidden="true">
                  <MoreHorizontal />
                </span>
                <Show when={!kept()}>
                  <button
                    type="button"
                    disabled={locked()}
                    onClick={() => void discard()}
                  >
                    <Trash2 />
                    <span>Discard recording</span>
                  </button>
                </Show>
                <Show when={kept()}>
                  <button
                    type="button"
                    disabled={locked()}
                    onClick={() => setDeleting(true)}
                  >
                    <Trash2 />
                    <span>Remove recording and notes</span>
                  </button>
                </Show>
              </div>
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
