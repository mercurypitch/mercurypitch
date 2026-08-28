// ============================================================
// Guided Voice Check — Pitch Centre task, reading, and practice handoff
// ============================================================
//
// One temporary, local-only task owns the listening canvas at a time. Nothing
// reaches the voice vault until the singer explicitly keeps the Focus Take;
// quality and reported comfort always take precedence over interpretation.

import type { Component, JSX } from 'solid-js'
import { createEffect, createMemo, createSignal, For, onCleanup, onMount, Show, untrack, } from 'solid-js'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { IconMic } from '@/components/exercise-icons'
import { Info, Pause, Play, Sparkles, X } from '@/components/icons'
import { Sheet } from '@/components/mobile/Sheet'
import { VoiceTakeWaveform } from '@/components/VoiceTakeWaveform'
import { EXERCISE_PITCH_HOLD } from '@/lib/domain/exercise-contracts'
import { midiToNoteName, noteToMidi } from '@/lib/frequency-to-note'
import type { GuidedRetakeProtocol, GuidedSingerEffort, PitchCentrePilotAssessmentResult, } from '@/lib/guided-voice'
import { assessPitchCentrePilot, createPitchCentrePilotProtocol, PITCH_CENTRE_PILOT_THRESHOLDS_V1, } from '@/lib/guided-voice'
import { generateId } from '@/lib/id'
import { playReferenceTone } from '@/lib/reference-tone'
import { isNarrow } from '@/lib/use-viewport'
import { getComfortableMidiRange, getDefaultNote } from '@/lib/vocal-range'
import { encodeVoiceAtlasContour } from '@/lib/voice-contour'
import { vocalRangePreset } from '@/stores/settings-store'
import { startExercise } from '@/stores/ui-store'
import { createFreeformThreadTarget, keepFreeformVoiceTake, } from './freeform-voice-take'
import { armGuidedPracticeHandoff, guidedPracticeLaunchFromRecommendation, } from './guided-practice-handoff'
import { keepGuidedVoiceTake } from './guided-voice-take'
import type { GuidedCanvasEvidence, GuidedCanvasSegment, } from './GuidedPitchCentreCanvas'
import { GuidedPitchCentreCanvas } from './GuidedPitchCentreCanvas'
import styles from './GuidedVoiceCheck.module.css'
import type { DryVoiceCaptureResult } from './useDryVoiceCapture'
import { useDryVoiceCapture } from './useDryVoiceCapture'

type GuidedStage =
  | 'briefing'
  | 'comfort'
  | 'setup'
  | 'rehearsal'
  | 'capture'
  | 'effort'
  | 'result'
  | 'safety-stop'
  | 'error'

type CapturePhase = 'listen' | 'prepare' | 'sing' | 'rest' | 'checking'

interface GuidedVoiceCheckProps {
  initialProtocol?: Readonly<GuidedRetakeProtocol> | null
  returningFromPractice?: boolean
  onClose: () => void
  onCloseRequestReady?: (request: GuidedCloseRequester | null) => void
  onKept: (comparisonKey: string, takeId: string) => Promise<void> | void
}

export type GuidedCloseRequester = (
  onResolved: (closed: boolean) => void,
) => void

const MIC_CONSUMER_PREFIX = 'voice-history-guided-pitch-centre'
const LANDING_CAPTURE_MS =
  PITCH_CENTRE_PILOT_THRESHOLDS_V1.landingWindowMilliseconds
// Browser timers may resume a few milliseconds before their requested delay.
// Capture a short tail so a completed landing cannot fail the exact-duration
// quality gate; analysis still uses only the prescribed landing window below.
const LANDING_CAPTURE_GUARD_MS = 100
const REFERENCE_DURATION_SECONDS = 0.85
/**
 * Unrecorded preparation space after the reference tone. This is UI pacing,
 * not part of the versioned landing window or comparison fingerprint.
 */
const BEFORE_LANDING_MS = 2_000
/** Unrecorded reset between notes, outside every measured landing window. */
const BETWEEN_LANDINGS_MS = 2_000
let guidedCheckInstance = 0

function createToneContext(): AudioContext | null {
  const WindowAudioContext =
    window.AudioContext ??
    (
      window as typeof window & {
        webkitAudioContext?: typeof AudioContext
      }
    ).webkitAudioContext
  if (WindowAudioContext === undefined) return null
  try {
    return new WindowAudioContext()
  } catch {
    return null
  }
}

function blocksSpaceShortcut(target: EventTarget | null): boolean {
  return (
    target instanceof Element &&
    target.closest(
      'input, textarea, select, [contenteditable], [role="alertdialog"]',
    ) !== null
  )
}

function formatSeconds(seconds: number): string {
  return `${Math.max(0, seconds).toFixed(1)}s`
}

function formatCountdown(milliseconds: number): string {
  const seconds = Math.max(1, Math.ceil(milliseconds / 1000))
  return `${seconds} ${seconds === 1 ? 'second' : 'seconds'}`
}

function fractionFromResult(result: PitchCentrePilotAssessmentResult | null): {
  numerator: number
  denominator: number
} {
  return {
    numerator: result?.aggregate.settledCoverage.numeratorRepetitions ?? 0,
    denominator:
      result?.aggregate.settledCoverage.denominatorRepetitions ??
      PITCH_CENTRE_PILOT_THRESHOLDS_V1.repetitions,
  }
}

function resultStatusCopy(
  result: PitchCentrePilotAssessmentResult | null,
): string {
  if (result === null) return 'This recording could not be checked.'
  switch (result.outcome.kind) {
    case 'focus-reading': {
      const fraction = fractionFromResult(result)
      return `${fraction.numerator} of ${fraction.denominator} holds settled near the target pitch.`
    }
    case 'needs-another-recording': {
      if (result.quality.blockingCheckIds.includes('microphone-continuity')) {
        return 'The microphone connection changed during this take. Record once more for a fair reading.'
      }
      if (
        result.quality.blockingCheckIds.some((id) =>
          ['task-completion', 'duration', 'repetitions'].includes(id),
        )
      ) {
        return 'The take ended before all three landings were complete. Record once more for a fair reading.'
      }
      return 'There was not enough clear pitch to make a fair reading.'
    }
    case 'unavailable-here': {
      if (result.quality.blockingCheckIds.includes('clipping')) {
        return 'This browser could not verify the recording peak level.'
      }
      if (result.quality.blockingCheckIds.includes('analysis-capability')) {
        return 'Pitch analysis is not available in this browser right now.'
      }
      return 'This browser could not complete every required signal check.'
    }
    case 'safety-stop':
      return 'This check stopped with your comfort report.'
    case 'no-reliable-focus':
      return 'This take did not contain one reliable focus to act on.'
    case 'analysis-failed':
      return 'The recording stayed local, but its reading could not be completed.'
  }
}

export const GuidedVoiceCheck: Component<GuidedVoiceCheckProps> = (props) => {
  const preset = untrack(vocalRangePreset)
  const range = getComfortableMidiRange(preset)
  const requestedProtocol = untrack(() => props.initialProtocol ?? null)
  const matchedProtocol = requestedProtocol !== null
  const defaultPreferredMidiCents = noteToMidi(getDefaultNote(preset)) * 100
  const [protocol, setProtocol] = createSignal<Readonly<GuidedRetakeProtocol>>(
    requestedProtocol ??
      createPitchCentrePilotProtocol({
        comfortableRangeMidiCents: [range.min * 100, range.max * 100],
        preferredMidiCents: defaultPreferredMidiCents,
      }),
  )
  const [stage, setStage] = createSignal<GuidedStage>('briefing')
  const [capturePhase, setCapturePhase] = createSignal<CapturePhase>('listen')
  const [landingIndex, setLandingIndex] = createSignal(0)
  const [phaseRemainingMs, setPhaseRemainingMs] = createSignal(0)
  const [rehearsalDone, setRehearsalDone] = createSignal(false)
  const [referenceBusy, setReferenceBusy] = createSignal(false)
  const [drawerOpen, setDrawerOpen] = createSignal(false)
  const [captureResult, setCaptureResult] =
    createSignal<DryVoiceCaptureResult | null>(null)
  const [assessment, setAssessment] =
    createSignal<PitchCentrePilotAssessmentResult | null>(null)
  const [selectedEvidenceId, setSelectedEvidenceId] = createSignal<
    string | null
  >(null)
  const [captureEndedEarly, setCaptureEndedEarly] = createSignal(false)
  const [reportedEffort, setReportedEffort] =
    createSignal<GuidedSingerEffort | null>(null)
  const [saving, setSaving] = createSignal(false)
  const [keptTakeId, setKeptTakeId] = createSignal<string | null>(null)
  const [saveError, setSaveError] = createSignal<string | null>(null)
  const [discardPromptOpen, setDiscardPromptOpen] = createSignal(false)
  const [errorMessage, setErrorMessage] = createSignal<string | null>(null)

  const voiceCapture = useDryVoiceCapture({
    consumerId: `${MIC_CONSUMER_PREFIX}:${++guidedCheckInstance}`,
    maxDurationMs: 30_000,
  })

  let toneContext: AudioContext | null = null
  let flowGeneration = 0
  let previousStage: GuidedStage | null = null
  let closeResolution: ((closed: boolean) => void) | null = null
  let closePreparationPending = false
  let closeAfterProcessing = false
  let mainCanvas: HTMLDivElement | undefined
  let inspectorPanel: HTMLDivElement | undefined
  let stageFocusTimer: number | null = null
  let phaseWaitCancel: (() => void) | null = null

  const targets = createMemo(() =>
    protocol().task.targetMidiCents.map((value) => value / 100),
  )
  const centreMidi = createMemo(
    () =>
      ((protocol().task.parameters.fittedCentreMidiCents as
        | number
        | undefined) ??
        protocol().task.targetMidiCents[1] ??
        defaultPreferredMidiCents) / 100,
  )
  const currentTargetMidi = createMemo(
    () => targets()[landingIndex()] ?? centreMidi(),
  )
  const capturedSegments = createMemo<GuidedCanvasSegment[]>(() => {
    const capture = captureResult()
    if (capture === null) return []
    return capture.segments.map((segment, index) => ({
      id: `landing-${index + 1}`,
      targetMidi: targets()[index] ?? centreMidi(),
      audioOffsetMs: segment.audioOffsetMs,
      durationMs: segment.durationMs,
      frames: segment.frames,
    }))
  })
  const analysisDurationMs = createMemo(() => {
    const capture = captureResult()
    return capture?.durationMs ?? 0
  })
  const evidenceMoments = createMemo<GuidedCanvasEvidence[]>(() => {
    const result = assessment()
    const reading = result?.reading
    if (result === null || reading === null || reading === undefined) return []

    return [
      {
        role: 'What held',
        evidenceId: reading.positiveFinding.evidenceId,
      },
      {
        role: 'Current focus',
        evidenceId: reading.focusFinding.evidenceId,
      },
    ].flatMap(({ role, evidenceId }) => {
      const evidence = result.evidence.find((item) => item.id === evidenceId)
      if (evidence?.availability !== 'available') return []
      const moment = evidence.moments[0]
      if (moment === undefined) return []
      return [
        {
          id: `${role.toLowerCase().replaceAll(' ', '-')}:${moment.id}`,
          label: role,
          seconds: (moment.startSeconds + moment.endSeconds) / 2,
        },
      ]
    })
  })
  const hasUnsavedCapture = createMemo(
    () =>
      (captureResult() !== null && keptTakeId() === null) ||
      voiceCapture.state() === 'starting' ||
      voiceCapture.state() === 'recording' ||
      voiceCapture.state() === 'paused' ||
      voiceCapture.state() === 'processing',
  )
  const phaseLabel = createMemo(() => {
    if (stage() === 'capture') {
      if (capturePhase() === 'listen') return 'Listen'
      if (capturePhase() === 'prepare') {
        return `Breathe — your turn in ${formatCountdown(phaseRemainingMs())}`
      }
      if (capturePhase() === 'sing') return 'Your turn — land and hold'
      if (capturePhase() === 'rest') {
        return `Rest — next note in ${formatCountdown(phaseRemainingMs())}`
      }
      return 'Checking this recording on your device'
    }
    if (stage() === 'rehearsal') {
      return capturePhase() === 'prepare'
        ? `Breathe — your turn in ${formatCountdown(phaseRemainingMs())}`
        : 'Unscored rehearsal'
    }
    if (stage() === 'effort') return 'Recording complete'
    if (stage() === 'result') return 'Your Focus reading'
    if (props.returningFromPractice === true && stage() === 'briefing') {
      return 'Ready for the same check again'
    }
    return 'Hear, land, and hold'
  })

  /**
   * A visible, cancellable cadence clock. The recorder stays paused through
   * prepare/rest, so a singer's breath never consumes the measured landing.
   */
  function waitForPhase(
    milliseconds: number,
    generation: number,
  ): Promise<boolean> {
    phaseWaitCancel?.()
    return new Promise((resolve) => {
      const end = performance.now() + milliseconds
      let timer: number | null = null
      let settled = false
      const finish = (completed: boolean): void => {
        if (settled) return
        settled = true
        if (timer !== null) window.clearInterval(timer)
        if (phaseWaitCancel === cancel) phaseWaitCancel = null
        setPhaseRemainingMs(0)
        resolve(completed)
      }
      const cancel = (): void => finish(false)
      const tick = (): void => {
        if (generation !== flowGeneration) {
          finish(false)
          return
        }
        const remaining = Math.max(0, end - performance.now())
        setPhaseRemainingMs(remaining)
        if (remaining <= 0) finish(true)
      }
      phaseWaitCancel = cancel
      tick()
      if (!settled) timer = window.setInterval(tick, 100)
    })
  }

  function cancelPhaseWait(): void {
    phaseWaitCancel?.()
    phaseWaitCancel = null
  }

  function ensureToneContext(): AudioContext | null {
    if (toneContext === null || toneContext.state === 'closed') {
      toneContext = createToneContext()
    }
    if (toneContext?.state === 'suspended') {
      void toneContext.resume().catch(() => undefined)
    }
    return toneContext
  }

  async function playTarget(midi = centreMidi()): Promise<boolean> {
    const context = ensureToneContext()
    if (context === null) {
      setErrorMessage('Reference tones are not available in this browser.')
      return false
    }
    setReferenceBusy(true)
    try {
      await playReferenceTone(context, midi, REFERENCE_DURATION_SECONDS)
      return true
    } catch {
      setErrorMessage('The reference tone could not play. Try it once more.')
      return false
    } finally {
      setReferenceBusy(false)
    }
  }

  function fitPreferredTarget(nextMidi: number): void {
    const next = createPitchCentrePilotProtocol({
      comfortableRangeMidiCents: [range.min * 100, range.max * 100],
      preferredMidiCents: Math.round(nextMidi) * 100,
    })
    setProtocol(next)
    setRehearsalDone(false)
  }

  async function rehearse(): Promise<void> {
    cancelPhaseWait()
    const generation = ++flowGeneration
    ensureToneContext()
    setErrorMessage(null)
    setStage('rehearsal')
    setCapturePhase('listen')
    setDrawerOpen(false)
    const rehearsalStarted = await voiceCapture.start({ paused: true })
    if (generation !== flowGeneration) return
    if (!rehearsalStarted) {
      setErrorMessage(
        voiceCapture.message() ??
          'The microphone could not open for the rehearsal.',
      )
      setStage('setup')
      setDrawerOpen(isNarrow())
      return
    }
    const rehearsalTonePlayed = await playTarget(centreMidi())
    if (generation !== flowGeneration) return
    if (!rehearsalTonePlayed) {
      voiceCapture.discard()
      setStage('setup')
      return
    }
    setCapturePhase('prepare')
    if (!(await waitForPhase(BEFORE_LANDING_MS, generation))) return
    const rehearsalResumed = await voiceCapture.resumeSegment()
    if (generation !== flowGeneration) return
    if (!rehearsalResumed) {
      voiceCapture.discard()
      setErrorMessage('The microphone could not resume for the rehearsal.')
      setStage('setup')
      setDrawerOpen(isNarrow())
      return
    }
    setCapturePhase('sing')
    if (!(await waitForPhase(LANDING_CAPTURE_MS, generation))) return
    const rehearsalSegment = await voiceCapture.pauseSegment()
    if (generation !== flowGeneration) return
    if (rehearsalSegment === null) {
      voiceCapture.discard()
      setErrorMessage('The microphone could not pause after the rehearsal.')
      setStage('setup')
      setDrawerOpen(isNarrow())
      return
    }
    voiceCapture.discard()
    setRehearsalDone(true)
    setStage('setup')
    setDrawerOpen(isNarrow())
  }

  async function runCapture(): Promise<void> {
    cancelPhaseWait()
    const generation = ++flowGeneration
    ensureToneContext()
    voiceCapture.discard()
    setCaptureResult(null)
    setAssessment(null)
    setKeptTakeId(null)
    setSaveError(null)
    setErrorMessage(null)
    setCaptureEndedEarly(false)
    setLandingIndex(0)
    setCapturePhase('listen')
    setStage('capture')
    setDrawerOpen(false)

    const captureStarted = await voiceCapture.start({ paused: true })
    if (generation !== flowGeneration) return
    if (!captureStarted) {
      setErrorMessage(
        voiceCapture.message() ??
          'The microphone could not open for this check.',
      )
      setStage('error')
      return
    }

    for (let index = 0; index < targets().length; index += 1) {
      if (generation !== flowGeneration) return
      setLandingIndex(index)
      setCapturePhase('listen')
      const targetPlayed = await playTarget(targets()[index]!)
      if (generation !== flowGeneration) return
      if (!targetPlayed) {
        voiceCapture.discard()
        setStage('error')
        return
      }
      setCapturePhase('prepare')
      if (!(await waitForPhase(BEFORE_LANDING_MS, generation))) return
      const captureResumed = await voiceCapture.resumeSegment()
      if (generation !== flowGeneration) return
      if (!captureResumed) {
        voiceCapture.discard()
        setErrorMessage(
          'The microphone could not resume after the reference tone.',
        )
        setStage('error')
        return
      }
      setCapturePhase('sing')
      if (
        !(await waitForPhase(
          LANDING_CAPTURE_MS + LANDING_CAPTURE_GUARD_MS,
          generation,
        ))
      ) {
        return
      }
      const capturedSegment = await voiceCapture.pauseSegment()
      if (generation !== flowGeneration) return
      if (capturedSegment === null) {
        voiceCapture.discard()
        setErrorMessage('The microphone could not pause after this landing.')
        setStage('error')
        return
      }
      if (index < targets().length - 1) {
        setCapturePhase('rest')
        if (!(await waitForPhase(BETWEEN_LANDINGS_MS, generation))) return
      }
    }

    if (generation !== flowGeneration) return
    setCapturePhase('checking')
    const result = await voiceCapture.stop()
    if (generation !== flowGeneration) return
    if (result === null) {
      if (closeAfterProcessing) {
        closeAfterProcessing = false
        discardAndClose()
        return
      }
      setErrorMessage(
        voiceCapture.message() ??
          'No usable audio was captured. Try once more.',
      )
      setStage('error')
      return
    }
    setCaptureResult(result)
    setStage('effort')
    setDrawerOpen(isNarrow())
    if (closeAfterProcessing) {
      closeAfterProcessing = false
      setDiscardPromptOpen(true)
    }
  }

  async function stopCaptureEarly(): Promise<void> {
    if (stage() !== 'capture') return
    const generation = ++flowGeneration
    cancelPhaseWait()
    setCaptureEndedEarly(true)
    setCapturePhase('checking')
    const result = await voiceCapture.stop()
    if (generation !== flowGeneration) return
    if (result === null) {
      if (closeAfterProcessing) {
        closeAfterProcessing = false
        discardAndClose()
        return
      }
      voiceCapture.discard()
      setCaptureResult(null)
      setStage('setup')
      setDrawerOpen(isNarrow())
      return
    }
    setCaptureResult(result)
    setStage('effort')
    setDrawerOpen(isNarrow())
    if (closeAfterProcessing) {
      closeAfterProcessing = false
      setDiscardPromptOpen(true)
    }
  }

  function analyseCapture(effort: GuidedSingerEffort): void {
    const capture = captureResult()
    if (capture === null) return
    const durationMs = capture.durationMs
    const result = assessPitchCentrePilot({
      runId: `pitch-centre.run-${generateId()}`,
      protocol: protocol(),
      captureDurationMilliseconds: durationMs,
      landingWindows: capture.segments.map((segment) => ({
        startSeconds: segment.audioOffsetMs / 1000,
        endSeconds: (segment.audioOffsetMs + LANDING_CAPTURE_MS) / 1000,
        frames: segment.frames.filter(
          (frame) => frame.t < LANDING_CAPTURE_MS / 1000,
        ),
      })),
      quality: {
        microphoneContinuous: capture.microphoneContinuous,
        clippingDetected:
          capture.peakAmplitude === null
            ? 'unavailable'
            : capture.peakAmplitude >= 0.995,
        noiseSeparation: 'unavailable',
        taskCompleted:
          !captureEndedEarly() &&
          capture.segments.length === protocol().task.repetitions,
        analysisAvailable: capture.pitchAnalysisAvailable,
      },
      safety: { preCapture: 'proceed', singerEffort: effort },
      captureContext: {
        inputContextKey: null,
        detectorId: 'f0-stream-yin',
        detectorVersion: '1.0.0',
        sampleRateHz: capture.sampleRateHz,
      },
    })
    setAssessment(result)
    setStage(result.outcome.kind === 'safety-stop' ? 'safety-stop' : 'result')
    setDrawerOpen(isNarrow())
  }

  function revealReading(effort: GuidedSingerEffort): void {
    setReportedEffort(effort)
    analyseCapture(effort)
  }

  function retryAnalysis(): void {
    const effort = reportedEffort()
    if (effort === null || captureResult() === null) return
    setAssessment(null)
    setSaveError(null)
    analyseCapture(effort)
  }

  function seekEvidence(evidence: GuidedCanvasEvidence): void {
    setSelectedEvidenceId(evidence.id)
    voiceCapture.seekPreview(evidence.seconds)
  }

  function seekPreviewFromPointer(event: PointerEvent): void {
    const reportedDurationMs = voiceCapture.previewDurationMs()
    const durationMs =
      Number.isFinite(reportedDurationMs) && reportedDurationMs > 0
        ? reportedDurationMs
        : analysisDurationMs()
    if (!Number.isFinite(durationMs) || durationMs <= 0) return
    const bounds = (event.currentTarget as HTMLElement).getBoundingClientRect()
    const progress = Math.max(
      0,
      Math.min(1, (event.clientX - bounds.left) / Math.max(1, bounds.width)),
    )
    voiceCapture.seekPreview((durationMs / 1000) * progress)
  }

  async function keepTake(): Promise<string | null> {
    if (saving()) return null
    const existingId = keptTakeId()
    if (existingId !== null) return existingId
    const capture = captureResult()
    const result = assessment()
    if (
      capture === null ||
      result?.persistedContext === null ||
      result?.persistedContext === undefined ||
      result.reading === null
    ) {
      return null
    }

    setSaving(true)
    setSaveError(null)
    try {
      const saved = await keepGuidedVoiceTake({
        take: {
          blob: capture.blob,
          durationMs: analysisDurationMs(),
          peaks: capture.peaks,
          capturedAt: capture.capturedAt,
          contour: encodeVoiceAtlasContour(capture.frames, {
            source: 'f0-stream-yin-v1',
          }),
        },
        assessment: result.persistedContext,
        reading: result.reading,
      })
      if (!saved.ok || saved.value === undefined) {
        setSaveError(
          saved.quotaExceeded || !saved.roomAvailable
            ? 'This device is too low on browser storage to keep the Focus Take.'
            : 'The Focus Take could not be kept. Its temporary copy is still here.',
        )
        return null
      }
      setKeptTakeId(saved.value.id)
      try {
        await props.onKept(protocol().comparisonFingerprint, saved.value.id)
      } catch {
        setSaveError(
          'The Focus Take was kept, but voice history could not refresh yet.',
        )
      }
      return saved.value.id
    } catch {
      setSaveError(
        'The Focus Take could not be kept. Its temporary copy is still here.',
      )
      return null
    } finally {
      setSaving(false)
    }
  }

  async function keepAsOrdinaryTake(): Promise<string | null> {
    if (saving()) return null
    const existingId = keptTakeId()
    if (existingId !== null) return existingId
    const capture = captureResult()
    if (capture === null) return null

    setSaving(true)
    setSaveError(null)
    const target = createFreeformThreadTarget()
    try {
      const saved = await keepFreeformVoiceTake({
        target,
        threadTitle: 'Pitch Centre — unanalysed',
        take: {
          blob: capture.blob,
          durationMs: analysisDurationMs(),
          peaks: capture.peaks,
          capturedAt: capture.capturedAt,
          contour: encodeVoiceAtlasContour(capture.frames, {
            source: 'f0-stream-yin-v1',
          }),
        },
      })
      if (!saved.ok || saved.value === undefined) {
        setSaveError(
          saved.quotaExceeded || !saved.roomAvailable
            ? 'This device is too low on browser storage to keep the recording.'
            : 'The recording could not be kept. Its temporary copy is still here.',
        )
        return null
      }
      setKeptTakeId(saved.value.id)
      try {
        await props.onKept(target.comparisonKey, saved.value.id)
      } catch {
        setSaveError(
          'The recording was kept, but voice history could not refresh yet.',
        )
      }
      return saved.value.id
    } catch {
      setSaveError(
        'The recording could not be kept. Its temporary copy is still here.',
      )
      return null
    } finally {
      setSaving(false)
    }
  }

  async function keepAndPractise(): Promise<void> {
    if (saving()) return
    const result = assessment()
    if (result?.reading === null || result?.reading === undefined) return
    const guidedPractice = guidedPracticeLaunchFromRecommendation(
      result.reading.recommendation,
    )
    const takeId = await keepTake()
    if (takeId === null) return
    const targetNote = midiToNoteName(guidedPractice.targetMidiCents / 100)
    armGuidedPracticeHandoff(
      {
        assessmentRunId:
          result.reading.recommendation.returnDestination.assessmentRunId,
        takeId,
        retake: result.reading.recommendation.retake,
      },
      guidedPractice,
    )
    voiceCapture.discard()
    startExercise(EXERCISE_PITCH_HOLD, {
      notes: [targetNote],
      challengeName: 'Pitch Centre focus',
      guidedPractice,
    })
  }

  function resetForRetake(): void {
    if (saving()) return
    flowGeneration += 1
    cancelPhaseWait()
    voiceCapture.discard()
    setCaptureResult(null)
    setAssessment(null)
    setSelectedEvidenceId(null)
    setCaptureEndedEarly(false)
    setReportedEffort(null)
    setSaveError(null)
    setKeptTakeId(null)
    setRehearsalDone(true)
    setStage('setup')
    setDrawerOpen(isNarrow())
  }

  function discardAndClose(): void {
    if (saving()) return
    flowGeneration += 1
    cancelPhaseWait()
    closePreparationPending = false
    closeAfterProcessing = false
    voiceCapture.discard()
    setDiscardPromptOpen(false)
    const resolve = closeResolution
    closeResolution = null
    resolve?.(true)
    props.onClose()
  }

  async function prepareActiveCaptureForClose(): Promise<void> {
    if (closePreparationPending) return
    closePreparationPending = true
    closeAfterProcessing = false
    const generation = ++flowGeneration
    cancelPhaseWait()
    setCaptureEndedEarly(true)
    setCapturePhase('checking')
    const result = await voiceCapture.stop()
    closePreparationPending = false
    if (generation !== flowGeneration) return
    if (result === null) {
      discardAndClose()
      return
    }
    setCaptureResult(result)
    setStage('effort')
    setDrawerOpen(isNarrow())
    setDiscardPromptOpen(true)
  }

  function requestClose(onResolved?: (closed: boolean) => void): void {
    if (closeResolution !== null) closeResolution(false)
    closeResolution = onResolved ?? null
    if (saving()) {
      const resolve = closeResolution
      closeResolution = null
      resolve?.(false)
      return
    }
    const captureState = voiceCapture.state()
    if (captureState === 'starting' || stage() === 'rehearsal') {
      // No reviewable take exists yet. Abort the pending/rehearsal capture and
      // release its mic lease rather than showing a misleading discard choice.
      discardAndClose()
      return
    }
    if (captureState === 'recording' || captureState === 'paused') {
      // Stop into a reviewable partial take. Cancel then returns to the effort
      // step; only the dialog's destructive action discards the audio.
      void prepareActiveCaptureForClose()
      return
    }
    if (captureState === 'processing') {
      // The in-flight stop owns the only Blob promise. Let its normal
      // continuation publish the result, then ask whether to discard it.
      closeAfterProcessing = true
      return
    }
    if (hasUnsavedCapture()) {
      setDiscardPromptOpen(true)
      return
    }
    discardAndClose()
  }

  function cancelDiscardRequest(): void {
    closeAfterProcessing = false
    setDiscardPromptOpen(false)
    const resolve = closeResolution
    closeResolution = null
    resolve?.(false)
  }

  function resultInspector(): JSX.Element {
    const result = assessment()
    const fraction = fractionFromResult(result)
    const reading = result?.reading
    const reinforce =
      reading?.focusFinding.findingCode ===
      'pitch-centre.finding.reinforce-centre'
    return (
      <>
        <div class={styles.inspectorHeading}>
          <span>Focus reading</span>
          <h3>{resultStatusCopy(result)}</h3>
        </div>

        <Show when={result?.outcome.kind === 'focus-reading'}>
          <div class={styles.readingRule}>
            <span>What we could measure</span>
            <p>
              We could clearly track pitch in{' '}
              {result?.aggregate.measuredRepetitions} of {fraction.denominator}{' '}
              holds.
            </p>
          </div>
          <div class={styles.readingRule}>
            <span>Current focus</span>
            <p>
              {reinforce
                ? 'These notes repeatedly found the centre. Give that pathway a little more familiar time.'
                : fraction.numerator === 0
                  ? 'None of the three notes stayed near the target long enough. Practise meeting one clear centre without pushing.'
                  : fraction.numerator === fraction.denominator
                    ? 'All three notes stayed near the target long enough, but they usually settled a little away from its centre. Practise one clear centre without pushing.'
                    : 'Some notes did not stay near the target long enough. Practise meeting one clear centre without pushing.'}
            </p>
          </div>
          <div class={styles.practiceRoute}>
            <div>
              <span>Try this next</span>
              <strong>Pitch Hold</strong>
              <p>
                Three short holds around {midiToNoteName(centreMidi())}. Stop if
                it feels uncomfortable.
              </p>
            </div>
            <button
              type="button"
              class={styles.primaryButton}
              disabled={saving()}
              onClick={() => void keepAndPractise()}
            >
              {keptTakeId() === null ? 'Keep & practise' : 'Practise this'}
            </button>
          </div>
          <div class={styles.resultActions}>
            <button
              type="button"
              class={styles.secondaryButton}
              disabled={saving() || keptTakeId() !== null}
              onClick={() => void keepTake()}
            >
              {saving()
                ? 'Keeping…'
                : keptTakeId() !== null
                  ? 'Focus Take kept'
                  : 'Keep Focus Take'}
            </button>
            <button
              type="button"
              class={styles.quietButton}
              disabled={saving()}
              onClick={() =>
                keptTakeId() === null
                  ? setDiscardPromptOpen(true)
                  : props.onClose()
              }
            >
              {keptTakeId() === null ? 'Discard' : 'Return to history'}
            </button>
          </div>
        </Show>

        <Show
          when={
            result?.outcome.kind === 'needs-another-recording' ||
            result?.outcome.kind === 'no-reliable-focus' ||
            result?.outcome.kind === 'analysis-failed' ||
            result?.outcome.kind === 'unavailable-here'
          }
        >
          <p class={styles.recoveryCopy}>
            Keep a steady distance from the microphone, sing at a comfortable
            level, and let each note begin after the reference ends.
          </p>
          <div class={styles.resultActions}>
            <Show when={result?.outcome.kind === 'analysis-failed'}>
              <button
                type="button"
                class={styles.primaryButton}
                disabled={saving()}
                onClick={retryAnalysis}
              >
                Try analysis again
              </button>
            </Show>
            <Show
              when={
                result?.outcome.kind !== 'unavailable-here' &&
                result?.outcome.kind !== 'analysis-failed'
              }
            >
              <button
                type="button"
                class={styles.primaryButton}
                disabled={saving()}
                onClick={resetForRetake}
              >
                Record another
              </button>
            </Show>
            <Show
              when={
                result?.outcome.kind === 'analysis-failed' ||
                result?.outcome.kind === 'unavailable-here'
              }
            >
              <button
                type="button"
                class={styles.secondaryButton}
                disabled={saving() || keptTakeId() !== null}
                onClick={() => void keepAsOrdinaryTake()}
              >
                {saving()
                  ? 'Keeping…'
                  : keptTakeId() === null
                    ? 'Keep without a reading'
                    : 'Recording kept'}
              </button>
            </Show>
            <button
              type="button"
              class={styles.quietButton}
              disabled={saving()}
              onClick={() =>
                keptTakeId() === null
                  ? setDiscardPromptOpen(true)
                  : props.onClose()
              }
            >
              {keptTakeId() === null ? 'Discard' : 'Return to history'}
            </button>
          </div>
        </Show>

        <Show when={saveError()}>
          <p class={styles.errorText} role="alert">
            {saveError()}
          </p>
        </Show>

        <details class={styles.measurementDetails}>
          <summary>What this check measured</summary>
          <p>
            You sang three short notes. For each one, we looked for a clear
            pitch that stayed within 35 cents—about one-third of a semitone—of
            the target for 0.3 seconds. A result saying you repeatedly found the
            centre requires all three to settle, with their typical pitch within
            25 cents of the target. This describes this one task; it is not a
            score for your overall voice or vocal health.
          </p>
          <Show
            when={result?.quality.partialCheckIds.includes('noise-separation')}
          >
            <p>
              One limitation: this check does not yet measure your voice
              separately from background sound. It uses only pitch it can
              identify clearly and asks for another recording if there is not
              enough clear pitch.
            </p>
          </Show>
        </details>
      </>
    )
  }

  function inspectorContent(): JSX.Element {
    return (
      <div
        ref={inspectorPanel}
        class={styles.inspectorContent}
        tabIndex={-1}
        aria-label={`${phaseLabel()} guidance`}
      >
        <Show when={stage() === 'briefing'}>
          <div class={styles.inspectorHeading}>
            <span>
              {props.returningFromPractice === true
                ? 'Matched retake'
                : 'Guided check'}
            </span>
            <h3>
              {props.returningFromPractice === true
                ? 'Hear what changed in the same task.'
                : 'Find one focus you can hear.'}
            </h3>
            <p>
              Hear a note, land on it from silence, and hold briefly. This
              measures where confident pitch settles and how long it takes.
            </p>
          </div>
          <div class={styles.privacyNote}>
            <span aria-hidden="true">
              <Info size={14} />
            </span>
            <p>
              Analysed on this device. Nothing is kept until you choose Keep
              Focus Take. This cannot diagnose vocal health.
            </p>
          </div>
          <button
            type="button"
            class={styles.primaryButton}
            onClick={() => setStage('comfort')}
          >
            Check comfort and begin
          </button>
        </Show>

        <Show when={stage() === 'comfort'}>
          <div class={styles.inspectorHeading}>
            <span>Before you sing</span>
            <h3>Does singing feel comfortable today?</h3>
            <p>
              If you have pain, unusual hoarseness or tiredness, illness, sudden
              range change, or unusual effort, stop here rather than testing it.
            </p>
          </div>
          <div class={styles.stackActions}>
            <button
              type="button"
              class={styles.primaryButton}
              onClick={() => setStage('setup')}
            >
              Yes, continue
            </button>
            <button
              type="button"
              class={styles.secondaryButton}
              onClick={() => setStage('safety-stop')}
            >
              Not today
            </button>
          </div>
        </Show>

        <Show when={stage() === 'setup'}>
          <div class={styles.inspectorHeading}>
            <span>Fit the task</span>
            <h3>Three notes, centred where you are comfortable.</h3>
            <p>Your route stays inside the vocal range saved in Settings.</p>
          </div>
          <Show when={!matchedProtocol}>
            <div class={styles.targetControl}>
              <button
                type="button"
                aria-label="Move the Pitch Centre route one semitone lower"
                disabled={
                  protocol().task.targetMidiCents[0]! <= range.min * 100 ||
                  referenceBusy()
                }
                onClick={() => fitPreferredTarget(centreMidi() - 1)}
              >
                Lower
              </button>
              <div>
                <strong>{midiToNoteName(centreMidi())}</strong>
                <span>{targets().map(midiToNoteName).join(' · ')}</span>
              </div>
              <button
                type="button"
                aria-label="Move the Pitch Centre route one semitone higher"
                disabled={
                  protocol().task.targetMidiCents.at(-1)! >= range.max * 100 ||
                  referenceBusy()
                }
                onClick={() => fitPreferredTarget(centreMidi() + 1)}
              >
                Higher
              </button>
            </div>
          </Show>
          <Show when={matchedProtocol}>
            <div class={styles.matchedTarget}>
              <span>Matched route locked</span>
              <strong>{targets().map(midiToNoteName).join(' · ')}</strong>
              <p>
                The same notes and recorded 1.8-second windows keep this take a
                fair comparison.
              </p>
            </div>
          </Show>
          <div class={styles.stackActions}>
            <button
              type="button"
              class={styles.secondaryButton}
              disabled={referenceBusy()}
              onClick={() => void playTarget()}
            >
              <Play />
              {referenceBusy() ? 'Playing target…' : 'Hear target'}
            </button>
            <button
              type="button"
              class={styles.secondaryButton}
              disabled={referenceBusy()}
              onClick={() => void rehearse()}
            >
              <IconMic size={17} />
              {rehearsalDone() ? 'Rehearse once more' : 'Try one landing'}
            </button>
            <button
              type="button"
              class={styles.primaryButton}
              disabled={!rehearsalDone() || referenceBusy()}
              onClick={() => void runCapture()}
            >
              Start three landings
            </button>
          </div>
          <Show when={rehearsalDone()}>
            <p class={styles.readyNote} role="status">
              Rehearsal complete. It was not scored or kept.
            </p>
          </Show>
          <Show when={errorMessage()}>
            <p class={styles.errorText} role="alert">
              {errorMessage()}
            </p>
          </Show>
        </Show>

        <Show when={stage() === 'effort'}>
          <div class={styles.inspectorHeading}>
            <span>Your report comes first</span>
            <h3>How did that feel?</h3>
            <p>
              This answer changes what MercuryPitch is allowed to recommend.
              Audio never overrides discomfort.
            </p>
          </div>
          <div class={styles.effortGrid}>
            <For
              each={
                [
                  ['easy', 'Easy'],
                  ['workable', 'Workable'],
                  ['effortful', 'Effortful'],
                  ['uncomfortable', 'Uncomfortable'],
                ] as const
              }
            >
              {([value, label]) => (
                <button type="button" onClick={() => revealReading(value)}>
                  {label}
                </button>
              )}
            </For>
          </div>
        </Show>

        <Show when={stage() === 'result'}>{resultInspector()}</Show>

        <Show when={stage() === 'safety-stop'}>
          <div class={styles.inspectorHeading}>
            <span>Stop here today</span>
            <h3>Do not push through discomfort.</h3>
            <p>
              Rest rather than repeating this check. MercuryPitch cannot
              diagnose why singing feels different. Seek qualified care for a
              persistent or concerning voice change.
            </p>
          </div>
          <button
            type="button"
            class={styles.secondaryButton}
            onClick={() =>
              captureResult() === null
                ? props.onClose()
                : setDiscardPromptOpen(true)
            }
          >
            Return to Hear Yourself
          </button>
        </Show>

        <Show when={stage() === 'error'}>
          <div class={styles.inspectorHeading}>
            <span>Check paused</span>
            <h3>The task could not finish.</h3>
            <p>
              {errorMessage() ??
                'The temporary recording was not kept. Check the microphone and try again.'}
            </p>
          </div>
          <div class={styles.stackActions}>
            <button
              type="button"
              class={styles.primaryButton}
              onClick={resetForRetake}
            >
              Return to setup
            </button>
            <button
              type="button"
              class={styles.quietButton}
              onClick={() => requestClose()}
            >
              Close
            </button>
          </div>
        </Show>
      </div>
    )
  }

  function toggleTemporaryReplayWithSpace(event: KeyboardEvent): void {
    if (
      event.code !== 'Space' ||
      event.repeat ||
      blocksSpaceShortcut(event.target) ||
      captureResult() === null ||
      (stage() !== 'result' && stage() !== 'safety-stop')
    ) {
      return
    }
    event.preventDefault()
    event.stopImmediatePropagation()
    voiceCapture.togglePreview()
  }

  createEffect(() => {
    const current = stage()
    if (current === previousStage) return
    previousStage = current
    if (isNarrow() && current !== 'capture' && current !== 'rehearsal') {
      setDrawerOpen(true)
    }
    if (stageFocusTimer !== null) window.clearTimeout(stageFocusTimer)
    stageFocusTimer = window.setTimeout(() => {
      stageFocusTimer = null
      if (untrack(() => stage() !== current || discardPromptOpen())) {
        return
      }
      const target =
        current === 'capture' || current === 'rehearsal'
          ? mainCanvas
          : inspectorPanel
      target?.focus({ preventScroll: true })
    }, 0)
  })

  createEffect(() => {
    const register = props.onCloseRequestReady
    if (register === undefined) return
    // The parent receives an imperative navigation guard; signal reads remain
    // inside requestClose when the user actually invokes it.
    // eslint-disable-next-line solid/reactivity
    register((onResolved) => requestClose(onResolved))
    onCleanup(() => register(null))
  })

  onMount(() => {
    window.addEventListener('keydown', toggleTemporaryReplayWithSpace, true)
  })

  onCleanup(() => {
    flowGeneration += 1
    cancelPhaseWait()
    const resolve = closeResolution
    closeResolution = null
    resolve?.(false)
    window.removeEventListener('keydown', toggleTemporaryReplayWithSpace, true)
    if (stageFocusTimer !== null) window.clearTimeout(stageFocusTimer)
    if (toneContext !== null && toneContext.state !== 'closed') {
      void toneContext.close().catch(() => undefined)
    }
  })

  return (
    <section
      class={styles.check}
      aria-labelledby="guided-voice-check-title"
      aria-busy={saving() ? true : undefined}
      data-testid="guided-voice-check"
    >
      <div class={styles.header}>
        <div>
          <span class={styles.eyebrow}>Guided voice check</span>
          <h2 id="guided-voice-check-title">Pitch Centre</h2>
        </div>
        <button
          type="button"
          class={styles.closeButton}
          aria-label="Close guided voice check"
          disabled={saving()}
          onClick={() => requestClose()}
        >
          <X />
        </button>
      </div>

      <div class={styles.layout}>
        <div
          ref={mainCanvas}
          class={styles.mainCanvas}
          tabIndex={-1}
          aria-label="Pitch Centre listening canvas"
        >
          <GuidedPitchCentreCanvas
            active={
              (stage() === 'capture' || stage() === 'rehearsal') &&
              capturePhase() === 'sing'
            }
            targetMidi={currentTargetMidi()}
            targetSummary={
              captureResult() !== null &&
              (stage() === 'effort' ||
                stage() === 'result' ||
                stage() === 'safety-stop')
                ? targets().map(midiToNoteName).join(' · ')
                : undefined
            }
            frame={voiceCapture.latestSmoothedFrame}
            liveWindowMs={LANDING_CAPTURE_MS + LANDING_CAPTURE_GUARD_MS}
            phaseLabel={phaseLabel()}
            segments={captureResult() === null ? [] : capturedSegments()}
            durationMs={analysisDurationMs()}
            evidence={stage() === 'result' ? evidenceMoments() : []}
            selectedEvidenceId={selectedEvidenceId()}
            onSeekEvidence={seekEvidence}
          />

          <Show when={stage() === 'capture' || stage() === 'rehearsal'}>
            <div
              class={styles.captureDock}
              classList={{
                [styles.captureDockLive]: capturePhase() === 'sing',
              }}
            >
              <div class={styles.recordingState}>
                <span class={styles.micPulse} aria-hidden="true">
                  <IconMic size={22} />
                </span>
                <div>
                  <strong>
                    {capturePhase() === 'sing'
                      ? 'Recording now'
                      : capturePhase() === 'listen'
                        ? 'Reference only — not recording'
                        : capturePhase() === 'prepare'
                          ? `Take a breath · ${Math.max(1, Math.ceil(phaseRemainingMs() / 1000))}s`
                          : capturePhase() === 'checking'
                            ? 'Checking locally'
                            : `Rest · ${Math.max(1, Math.ceil(phaseRemainingMs() / 1000))}s`}
                  </strong>
                  <span>
                    {stage() === 'rehearsal'
                      ? capturePhase() === 'prepare'
                        ? `Your ${formatSeconds(LANDING_CAPTURE_MS / 1000)} rehearsal starts after the count-in`
                        : 'Unscored rehearsal'
                      : capturePhase() === 'prepare'
                        ? `Landing ${Math.min(landingIndex() + 1, targets().length)} of ${targets().length} starts after the count-in`
                        : capturePhase() === 'sing'
                          ? `Landing ${Math.min(landingIndex() + 1, targets().length)} of ${targets().length} · ${formatSeconds(LANDING_CAPTURE_MS / 1000)} sample`
                          : `Landing ${Math.min(landingIndex() + 1, targets().length)} of ${targets().length}`}
                  </span>
                </div>
              </div>
              <Show when={stage() === 'capture'}>
                <button
                  type="button"
                  class={styles.stopButton}
                  onClick={() => void stopCaptureEarly()}
                  disabled={capturePhase() === 'checking'}
                >
                  Stop check
                </button>
              </Show>
            </div>
          </Show>

          <Show
            when={
              captureResult() !== null &&
              (stage() === 'effort' ||
                stage() === 'result' ||
                stage() === 'safety-stop')
            }
          >
            <div class={styles.previewStrip}>
              <button
                type="button"
                class={styles.playButton}
                data-voice-playback-toggle
                aria-label={
                  voiceCapture.previewPlaying()
                    ? 'Pause temporary take'
                    : 'Play temporary take'
                }
                onClick={voiceCapture.togglePreview}
              >
                {voiceCapture.previewPlaying() ? <Pause /> : <Play />}
              </button>
              <div
                class={styles.previewWave}
                role="slider"
                tabindex="0"
                aria-label="Temporary take position"
                aria-valuemin="0"
                aria-valuemax="100"
                aria-valuenow={Math.round(voiceCapture.previewProgress() * 100)}
                data-testid="guided-preview-scrubber"
                onPointerDown={seekPreviewFromPointer}
                onKeyDown={(event) => {
                  if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight')
                    return
                  event.preventDefault()
                  const direction = event.key === 'ArrowRight' ? 1 : -1
                  voiceCapture.seekPreview(
                    voiceCapture.previewCurrentTimeMs() / 1000 + direction,
                  )
                }}
              >
                <VoiceTakeWaveform
                  peaks={captureResult()?.peaks ?? null}
                  progress={voiceCapture.previewProgress()}
                  playing={voiceCapture.previewPlaying()}
                  showPlayhead
                  class={styles.previewWaveCanvas}
                />
              </div>
              <span class={styles.previewTime}>
                {formatSeconds(voiceCapture.previewCurrentTimeMs() / 1000)}
              </span>
            </div>
          </Show>

          <Show when={isNarrow()}>
            <button
              type="button"
              class={styles.drawerButton}
              aria-expanded={drawerOpen()}
              onClick={() => setDrawerOpen(true)}
            >
              <Sparkles />
              {stage() === 'result' ? 'Open Focus reading' : 'Open guide'}
            </button>
            <Sheet
              isOpen={drawerOpen()}
              close={() => setDrawerOpen(false)}
              ariaLabel={
                stage() === 'result'
                  ? 'Pitch Centre Focus reading'
                  : 'Pitch Centre guide'
              }
              snap="content"
              class={styles.mobileSheet}
            >
              {inspectorContent()}
            </Sheet>
          </Show>
        </div>

        <Show when={!isNarrow()}>
          <aside class={styles.inspector} aria-label="Pitch Centre guide">
            {inspectorContent()}
          </aside>
        </Show>
      </div>

      <ConfirmDialog
        open={discardPromptOpen()}
        busy={saving()}
        title="Discard this temporary take?"
        message={
          <>
            This recording has not been added to your voice history. Discarding
            it removes the temporary audio from this page.
          </>
        }
        confirmLabel="Discard take"
        confirmIcon={<X />}
        onCancel={cancelDiscardRequest}
        onConfirm={discardAndClose}
      />
    </section>
  )
}
