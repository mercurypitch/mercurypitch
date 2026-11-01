// ============================================================
// useStudioRecorder — Record in the Studio: the recorder wired to the song's clock, the shared microphone, the save path and the keys
// ============================================================
//
// The recorder itself (lib/studio/record/studio-recorder.ts) knows no Solid
// and no storage; this hook hands it the Studio's transport and clock, the
// app's one microphone (micManager, the only capture path), the import a
// picked file goes through (controller.addRecording), and the journal that
// keeps a take through a closed tab. It also keeps the rules every mic
// surface keeps: the mic icon registers with the sentinel, a take in
// progress holds the mic against a hidden-tab release, navigation waits for
// a take, and the mic is given back when a take ends or the Studio closes.
//
// Keys: R arms, then records, then stops; Escape disarms, cancels a
// count-in or stops a take; Space stops a take (StudioWorkspace's toggle).
// Arming takes the focus in the Studio; once armed, R and Escape work
// wherever the focus is, outside text fields and dialogs.
import type { Accessor } from 'solid-js'
import { batch, createEffect, createSignal, on, onCleanup, untrack, } from 'solid-js'
import type { StudioTakeJournalRecord } from '@/db/services/studio-take-journal'
import { createStudioTakeJournal } from '@/db/services/studio-take-journal'
import { useLocalSaveNavigationLockWithReason } from '@/lib/local-save-navigation-reason'
import { audioOutputPathSeconds } from '@/lib/mic-latency'
import type { MicError } from '@/lib/mic-manager'
import { micManager } from '@/lib/mic-manager'
import { registerMicIndicator } from '@/lib/mic-sentinel'
import { isInsideOverlay, isTypingTarget } from '@/lib/space-playback'
import { isStudioMemoryRefusal, reserveStudioMemory, } from '@/lib/studio/memory-budget'
import type { StudioAsset, StudioProject } from '@/lib/studio/model/types'
import { STUDIO_SAMPLE_RATE } from '@/lib/studio/model/types'
import { openStudioCapture, prepareStudioRecorderWorklet, } from '@/lib/studio/record/capture-node'
import { createStudioClickTrack } from '@/lib/studio/record/click-track'
import { createStudioInputMonitor } from '@/lib/studio/record/input-monitor'
import type { StudioRecordSettings } from '@/lib/studio/record/record-settings'
import { readStudioRecordSettings, writeStudioRecordSettings, } from '@/lib/studio/record/record-settings'
import type { StudioCapturedTake, StudioLiveTake, StudioRecorderView, StudioTakeJournalWriter, } from '@/lib/studio/record/studio-recorder'
import { createStudioRecorder } from '@/lib/studio/record/studio-recorder'
import { pcm16ToFloat, studioTakeWav } from '@/lib/studio/record/take-audio'
import type { StudioRoundTrip } from '@/lib/studio/record/take-timing'
import { placeHeardTake, studioRoundTrip, } from '@/lib/studio/record/take-timing'
import { micLatencyPathMs } from '@/stores/mic-latency-path-store'
import { micLatencyMs } from '@/stores/mic-latency-store'
import type { useStudioTransport } from '../audio/useStudioTransport'
import type { StudioRecordingImport } from '../controller/imports'
import { studioContentEnd } from '../timeline/timeline-geometry'
import type { StudioTimelineRecording } from '../timeline/types'

/** The microphone hold and the mic icon share this id. */
export const STUDIO_RECORD_MIC_ID = 'studio-record'

type Transport = ReturnType<typeof useStudioTransport>

export interface StudioRecorderOptions {
  readonly project: Accessor<StudioProject | null>
  readonly assets: Accessor<readonly StudioAsset[]>
  /** The song takes edits here now. */
  readonly canEdit: Accessor<boolean>
  addRecording(take: StudioRecordingImport): Promise<boolean>
  readonly transport: Pick<
    Transport,
    | 'playing'
    | 'frameNow'
    | 'play'
    | 'pause'
    | 'anchor'
    | 'clock'
    | 'unlock'
    | 'repeating'
    | 'setRepeat'
  >
  /** The lane a new take goes to. */
  readonly selectedTrackId: Accessor<string | null>
  /** Export, Compare or auto-balance hold the song's audio. */
  readonly audioBusy: Accessor<boolean>
}

const MIC_ERRORS: Record<MicError['kind'], string> = {
  'permission-denied':
    "Studio can't hear your microphone. Allow it in the browser's site settings, then press Record again.",
  'device-busy':
    'Another app is using your microphone. Close it, then press Record again.',
  'no-device':
    "Studio can't find a microphone. Connect one, then press Record again.",
  'held-elsewhere':
    'Another MercuryPitch tab is using your microphone. Close it there, then press Record again.',
  unknown: "Studio can't open your microphone. Press Record to try again.",
}

/** What to say when the microphone, the memory or the recorder would not start. */
export function describeStudioRecordError(error: unknown): string {
  const kind = (error as Partial<MicError> | null)?.kind
  if (typeof kind === 'string' && kind in MIC_ERRORS)
    return MIC_ERRORS[kind as MicError['kind']]
  if (isStudioMemoryRefusal(error))
    return 'Studio needs more memory to record. Close other songs or tabs, then press Record again.'
  if (error instanceof Error && error.message.startsWith("This browser can't"))
    return error.message
  return "Studio couldn't start recording. Press Record to try again."
}

const RUNNING = new Set(['counting', 'recording'])
const HOLDS_MIC = new Set(['armed', 'counting', 'recording', 'finishing'])

export function useStudioRecorder(options: StudioRecorderOptions) {
  const { transport } = options
  const [view, setView] = createSignal<StudioRecorderView>({
    phase: 'idle',
    level: 0,
    countBeat: null,
    error: null,
    notice: null,
    targetTrackId: null,
    live: null,
  })
  const [level, setLevel] = createSignal(0)
  const [live, setLive] = createSignal<StudioLiveTake | null>(null)
  const [settings, setSettingsSignal] = createSignal<StudioRecordSettings>(
    readStudioRecordSettings(),
  )
  const [roundTrip, setRoundTrip] = createSignal<StudioRoundTrip | null>(null)
  const [recovery, setRecovery] = createSignal<
    readonly StudioTakeJournalRecord[]
  >([])
  const [recovering, setRecovering] = createSignal(false)
  const journal = createStudioTakeJournal()
  const writers = new Map<string, StudioTakeJournalWriter>()
  let restoreRepeat = false

  const phase = () => view().phase
  const running = () => RUNNING.has(phase())
  const project = () => options.project()

  function journalWriter(): StudioTakeJournalWriter {
    const id = project()?.id ?? ''
    let writer = writers.get(id)
    if (writer === undefined) {
      writer = journal.writer(id)
      writers.set(id, writer)
    }
    return writer
  }

  function laneLevel(trackId: string | null) {
    const track = project()?.tracks.find((item) => item.id === trackId)
    return {
      on: settings().monitor,
      gain:
        track === undefined ? 1 : track.mute ? 0 : 10 ** (track.gainDb / 20),
      pan: track?.pan ?? 0,
    }
  }

  function measureRoundTrip(context: AudioContext, stream: MediaStream) {
    const reported = stream.getAudioTracks?.()[0]?.getSettings?.() as
      | { latency?: number }
      | undefined
    const trip = studioRoundTrip({
      measuredMs: micLatencyMs(),
      measuredPathMs: micLatencyPathMs(),
      pathSeconds: audioOutputPathSeconds(context),
      inputSeconds: reported?.latency,
      offsetMs: settings().offsetMs,
    })
    setRoundTrip(trip)
    return trip.seconds
  }

  /** Keep a take the way a picked WAV is kept, trimmed to the frame the singer heard. */
  async function keepTake(take: StudioCapturedTake): Promise<boolean> {
    const frames = Math.round(
      (take.samples.length * STUDIO_SAMPLE_RATE) / take.sampleRate,
    )
    const placement = placeHeardTake(take.heardFirst, take.fromFrame, frames)
    // A take its trim leaves nothing of has nothing to keep, and nothing to retry.
    if (placement === null) return true
    const wav = studioTakeWav(take.samples, take.sampleRate)
    return options.addRecording({
      wav,
      title: take.title,
      startFrame: placement.startFrame,
      sourceInFrame: placement.sourceInFrame,
      trackId: take.trackId,
      assetId: take.id,
    })
  }

  const recorder = createStudioRecorder({
    unlock: () => transport.unlock(),
    clock: () => transport.clock(),
    acquireMic: () => micManager.acquire(STUDIO_RECORD_MIC_ID),
    releaseMic: () => micManager.release(STUDIO_RECORD_MIC_ID),
    prepareWorklet: prepareStudioRecorderWorklet,
    openCapture: openStudioCapture,
    createSource: (context, stream) => context.createMediaStreamSource(stream),
    createClicks: createStudioClickTrack,
    createMonitor: createStudioInputMonitor,
    monitorLevel: laneLevel,
    transport: {
      playing: () => transport.playing(),
      playheadFrame: () => transport.frameNow(),
      canPlay: (frame) => {
        const clips = project()?.clips ?? []
        return clips.length > 0 && frame < studioContentEnd(clips)
      },
      play: (notBefore) => transport.play(notBefore),
      pause: () => transport.pause(),
      anchor: () => transport.anchor(),
    },
    settings,
    tempoBpm: () => project()?.tempoBpm ?? 120,
    roundTrip: measureRoundTrip,
    reserveMemory: reserveStudioMemory,
    journal: {
      begin: (header) => journalWriter().begin(header),
      place: (id, heardFirst) => journalWriter().place(id, heardFirst),
      append: (id, sequence, firstFrame, pcm) =>
        journalWriter().append(id, sequence, firstFrame, pcm),
      discard: (id) => journalWriter().discard(id),
    },
    keep: keepTake,
    title: () => {
      const recorded = options
        .assets()
        .filter((asset) => asset.provenance.kind === 'recording').length
      return `Take ${recorded + 1}`
    },
    createId: () => globalThis.crypto.randomUUID(),
    describeError: describeStudioRecordError,
    onChange: (next) =>
      batch(() => {
        setLevel(next.level)
        setLive(next.live)
        setView((before) =>
          before.phase === next.phase &&
          before.countBeat === next.countBeat &&
          before.error === next.error &&
          before.notice === next.notice &&
          before.targetTrackId === next.targetTrackId
            ? before
            : next,
        )
      }),
  })

  const canArm = () =>
    project() !== null &&
    options.canEdit() &&
    !options.audioBusy() &&
    !recovering()

  /** The Record button and R: arm, then record, then stop. */
  function press(): void {
    const now = phase()
    if (now === 'idle') {
      if (!canArm()) return
      void recorder.arm(options.selectedTrackId())
    } else if (now === 'armed') {
      // A take runs straight through: the song does not loop under it.
      restoreRepeat = transport.repeating()
      if (restoreRepeat) void transport.setRepeat(false)
      recorder.record()
    } else if (RUNNING.has(now)) recorder.stop()
  }

  function stop(): void {
    if (running()) recorder.stop()
  }

  /** R and Escape; true when the key was the recorder's. */
  function keyDown(event: KeyboardEvent): boolean {
    if (event.metaKey || event.ctrlKey || event.altKey || event.repeat)
      return false
    if (event.key === 'r' || event.key === 'R') {
      event.preventDefault()
      press()
      return true
    }
    if (event.key !== 'Escape') return false
    const now = phase()
    if (now === 'armed' || now === 'arming') recorder.disarm()
    else if (RUNNING.has(now)) recorder.stop()
    else return false
    event.preventDefault()
    return true
  }

  // A take in progress answers R and Escape wherever the focus went, as
  // Space does: a button that re-renders mid-take can drop the focus to the
  // page. The workspace handles its own keys first and marks them handled.
  const onWindowKey = (event: KeyboardEvent) => {
    if (phase() === 'idle' || event.defaultPrevented) return
    if (isTypingTarget(event.target) || isInsideOverlay(event.target)) return
    keyDown(event)
  }
  window.addEventListener('keydown', onWindowKey)
  onCleanup(() => window.removeEventListener('keydown', onWindowKey))

  // The armed lane follows the selection until the take starts.
  createEffect(
    on(options.selectedTrackId, (trackId) => recorder.retarget(trackId), {
      defer: true,
    }),
  )
  // Monitoring follows its setting and the lane's volume and pan.
  createEffect(() => {
    laneLevel(view().targetTrackId)
    untrack(() => recorder.updateMonitor())
  })
  // Repeat comes back once the take is over.
  createEffect(
    on(phase, (now) => {
      if (restoreRepeat && (now === 'idle' || now === 'armed')) {
        restoreRepeat = false
        void transport.setRepeat(true)
      }
    }),
  )

  // A clock that stops running (an interruption, a closed device) ends the take.
  createEffect(() => {
    if (!HOLDS_MIC.has(phase())) return
    const context = untrack(() => transport.clock())
    if (context === null) return
    const onState = () => {
      if (context.state !== 'running') recorder.clockStopped()
    }
    context.addEventListener('statechange', onState)
    onCleanup(() => context.removeEventListener('statechange', onState))
  })

  // The microphone taken away (another tab, the OS, a backgrounded app).
  onCleanup(
    micManager.subscribe((state) => {
      const now = untrack(phase)
      if (now !== 'armed' && !RUNNING.has(now)) return
      if (!state.active || !state.consumers.includes(STUDIO_RECORD_MIC_ID))
        recorder.micLost()
    }),
  )
  onCleanup(
    registerMicIndicator(
      STUDIO_RECORD_MIC_ID,
      // Deliberately non-reactive: the sentinel polls these accessors on its
      // own low-frequency interval — no tracked scope involved.
      // eslint-disable-next-line solid/reactivity
      () => HOLDS_MIC.has(phase()),
      () => recorder.micLost(),
    ),
  )
  // Polled when the tab hides, so a take keeps its microphone.
  // eslint-disable-next-line solid/reactivity
  onCleanup(micManager.registerRunGuard(STUDIO_RECORD_MIC_ID, () => running()))
  useLocalSaveNavigationLockWithReason(
    () => running() || phase() === 'finishing',
    'Studio recording',
    () => 'Studio is recording. Stop the take before you leave.',
  )
  onCleanup(() => recorder.dispose())

  // ── Takes left in the journal by a closed tab or a refused save ──

  async function refreshRecovery(): Promise<void> {
    const current = untrack(project)
    if (current === null) return
    try {
      const rows = await journal.list(current.id)
      const stored = new Set(untrack(options.assets).map((asset) => asset.id))
      // A take stored before its rows could go: they go now.
      for (const row of rows)
        if (stored.has(row.id))
          void journal.discard(row.id).catch(() => undefined)
      if (untrack(project)?.id === current.id)
        setRecovery(rows.filter((row) => !stored.has(row.id)))
    } catch {
      setRecovery([])
    }
  }
  createEffect(
    on(
      () => project()?.id,
      () => void refreshRecovery(),
    ),
  )
  // A take that could not be kept stays offered.
  createEffect(
    on(phase, (now, before) => {
      if (now === 'idle' && before === 'finishing') void refreshRecovery()
    }),
  )

  async function keepRecovered(id: string): Promise<void> {
    if (recovering() || phase() !== 'idle') return
    setRecovering(true)
    try {
      const read = await journal.read(id)
      if (read === null || read.pcm.length === 0) {
        await journal.discard(id)
        return
      }
      const release = reserveStudioMemory(read.pcm.length * 8)
      try {
        const kept = await keepTake({
          id,
          title: read.header.title,
          trackId: read.header.trackId,
          sampleRate: read.header.sampleRate,
          samples: pcm16ToFloat(read.pcm),
          heardFirst: read.header.heardFirst,
          fromFrame: read.header.fromFrame,
        })
        if (kept) await journal.discard(id)
      } finally {
        release()
      }
    } catch (error) {
      setView((before) => ({
        ...before,
        error: describeStudioRecordError(error),
      }))
    } finally {
      setRecovering(false)
      await refreshRecovery()
    }
  }

  async function discardRecovered(id: string): Promise<void> {
    await journal.discard(id).catch(() => undefined)
    await refreshRecovery()
  }

  return {
    view,
    phase,
    level,
    live,
    /** The armed lane's level and the take growing in it, for the timeline. */
    timeline: (): StudioTimelineRecording | null =>
      phase() === 'idle'
        ? null
        : {
            trackId: view().targetTrackId,
            live: live(),
            level: level(),
            listening: phase() !== 'finishing',
          },
    /** A lane's name, or null for one that is not in the song. */
    laneName: (trackId: string | null): string | null =>
      project()?.tracks.find((track) => track.id === trackId)?.name ?? null,
    /** A count-in or a take is running: Space and seeks stop it. */
    running,
    /** Lane renders and warm-ups wait while a take counts in, records or is kept. */
    busy: () => running() || phase() === 'finishing',
    canArm,
    press,
    stop,
    keyDown,
    disarm: () => recorder.disarm(),
    clearMessages: () => recorder.clearMessages(),
    settings,
    setSettings(next: StudioRecordSettings): void {
      setSettingsSignal(writeStudioRecordSettings(next))
      recorder.updateMonitor()
    },
    roundTrip,
    recovery,
    recovering,
    keepRecovered,
    discardRecovered,
  }
}

export type StudioRecorderHandle = ReturnType<typeof useStudioRecorder>
