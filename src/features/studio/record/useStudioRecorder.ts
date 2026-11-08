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
// Arming: each lane's arm button arms that lane (its input opens and the
// lane shows its level) or disarms it, and leaves every other lane as it
// is: as in a DAW, any number of lanes can be armed, and one Record press
// records them all, each lane's take a clip on its own lane. The arms stay
// put when another lane is selected and after a take. A lane can record
// from an input of its own, and one of its channels or an aligned pair
// (studio-lane-input-state.ts). Audio lanes record from one input at a
// time (studio-mic-share.ts): every armed audio lane takes its own channel
// or pair of the one device, which opens once and stays open while any lane
// on it is armed, re-armed or changes channel; a lane on another device is
// refused in words that name both. A MIDI lane plays its instrument in
// place of a microphone (midi/): any number can be armed beside the audio
// lanes, each on a port of its own, its player always hears it, and a kept
// take keeps the notes played into it. The mic icon is on while any armed
// lane holds the microphone.
//
// Keys: Record and R start a take on every armed lane in one press; with no
// lane armed they arm the selected lane, else the first lane with no clips,
// else a new lane, and start in the same press. R or Stop ends the take;
// Escape disarms every lane, cancels a count-in or stops a take; Space stops a take
// (StudioWorkspace's toggle). Arming takes the focus in the Studio; once
// armed, R and Escape work wherever the focus is, outside text fields and
// dialogs.
import type { Accessor } from 'solid-js'
import { batch, createEffect, createMemo, createSignal, on, onCleanup, untrack, } from 'solid-js'
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
import { openStudioCapture, prepareStudioRecorderWorklet, } from '@/lib/studio/record/capture-node'
import { createStudioClickTrack } from '@/lib/studio/record/click-track'
import { createStudioInputMonitor } from '@/lib/studio/record/input-monitor'
import type { StudioLaneInput } from '@/lib/studio/record/lane-inputs'
import { isMidiLaneInput } from '@/lib/studio/record/lane-inputs'
import type { StudioRecordSettings } from '@/lib/studio/record/record-settings'
import { readStudioRecordSettings, writeStudioRecordSettings, } from '@/lib/studio/record/record-settings'
import type { StudioCapturedTake, StudioLiveTake, StudioRecorderView, StudioRecordPhase, StudioTakeJournalWriter, } from '@/lib/studio/record/studio-recorder'
import { createStudioRecorder } from '@/lib/studio/record/studio-recorder'
import { pcm16ToFloat } from '@/lib/studio/record/take-audio'
import { studioTakeClip } from '@/lib/studio/record/take-passes'
import type { StudioTakeCut } from '@/lib/studio/record/take-plan'
import type { StudioRoundTrip } from '@/lib/studio/record/take-timing'
import { studioInstrumentShift, studioRoundTrip, } from '@/lib/studio/record/take-timing'
import { micLatencyPathMsForDevice } from '@/stores/mic-latency-path-store'
import { micLatencyMsForDevice } from '@/stores/mic-latency-store'
import type { StudioTakeClock } from '../audio/take-clock'
import { sameTakeClock } from '../audio/take-clock'
import type { useStudioTransport } from '../audio/useStudioTransport'
import type { StudioRecordingImport } from '../controller/imports'
import { studioContentEnd } from '../timeline/timeline-geometry'
import type { StudioLaneArming } from '../timeline/types'
import { StudioMidiArmRefusal } from './midi/studio-midi-arm'
import { createStudioMidiLanes } from './midi/studio-midi-lanes'
import { createStudioRecordLanes } from './record-lanes'
import { createStudioInputs } from './studio-inputs'
import { createStudioLaneInputState } from './studio-lane-input-state'
import { createStudioMicShare, StudioInputRefusal } from './studio-mic-share'
import { studioTakeFrames, studioTakeImport } from './take-import'
import { setStudioTakeRunning } from './take-running'

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
    | 'range'
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

/** Whether a journaled take keeps anything: past its trim to the frame heard, of a punch's range or of a loop's. */
function placesSomething(row: StudioTakeJournalRecord): boolean {
  return studioTakeClip(row, studioTakeFrames(row)) !== null
}

/** What to say when the microphone, the memory or the recorder would not start. */
export function describeStudioRecordError(error: unknown): string {
  if (error instanceof StudioMidiArmRefusal) return error.words
  if (error instanceof StudioInputRefusal) return error.words
  const kind = (error as Partial<MicError> | null)?.kind
  if (typeof kind === 'string' && kind in MIC_ERRORS)
    return MIC_ERRORS[kind as MicError['kind']]
  if (isStudioMemoryRefusal(error))
    return 'Studio needs more memory to record. Close other songs or tabs, then press Record again.'
  if (error instanceof Error && error.message.startsWith("This browser can't"))
    return error.message
  return "Studio couldn't start recording. Press Record to try again."
}

/** Memory refused for one lane of several: Record started none of them. */
const MEMORY_FOR_EVERY_LANE =
  'Studio needs more memory to record every armed lane, so none started. Disarm a lane, or close other songs or tabs, then press Record again.'

const RUNNING = new Set(['counting', 'recording'])
const HOLDS_MIC = new Set(['armed', 'counting', 'recording', 'finishing'])
const TAKE_PHASES = new Set(['counting', 'recording', 'finishing'])

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
  // The input takes record from: picked in Sound, opened for the arm alone,
  // and each lane's own input and channels (studio-lane-input-state.ts).
  const inputs = createStudioInputs()
  const lanes = createStudioLaneInputState({
    project: () => options.project(),
    settings,
    devices: inputs.devices,
  })

  /** A lane's name for the recorder's words. */
  function laneName(trackId: string | null): string {
    if (trackId === null) return 'the new lane'
    const track = options.project()?.tracks.find((each) => each.id === trackId)
    return track?.name ?? 'the lane'
  }
  // A MIDI lane plays its sound in place of a microphone (midi/).
  const midi = createStudioMidiLanes({
    project: () => options.project(),
    laneInput: (trackId) => lanes.of(trackId),
    laneName,
    onLost: (words, trackId) => recorder.inputLost(words, trackId),
  })
  // Every armed audio lane records from the one input (studio-mic-share.ts).
  const micShare = createStudioMicShare({
    open: (deviceId) => micManager.acquireFrom(STUDIO_RECORD_MIC_ID, deviceId),
    armed: (trackId) =>
      laneRecords.lanes().some((lane) => lane.trackId === trackId),
    laneName,
  })
  // Each armed lane, as the timeline and the arm buttons read it.
  const laneRecords = createStudioRecordLanes()
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
      // The switch guards against a microphone's feedback; a MIDI lane has
      // none, so its player always hears what they play.
      on: settings().monitor || isMidiLaneInput(lanes.of(trackId)),
      gain:
        track === undefined ? 1 : track.mute ? 0 : 10 ** (track.gainDb / 20),
      pan: track?.pan ?? 0,
    }
  }

  function measureRoundTrip(context: AudioContext, stream: MediaStream | null) {
    // An instrument's take: the output path alone, and the line-up beside
    // the offset keeps speaking of the voice's round trip.
    if (stream === null)
      return studioInstrumentShift(audioOutputPathSeconds(context))
    const reported = stream.getAudioTracks?.()[0]?.getSettings?.() as
      | { latency?: number; deviceId?: string }
      | undefined
    // Measured on the input this take records from, which need not be the
    // app's (MicManager.acquireFrom): as its track names it, else as asked.
    const named = reported?.deviceId?.trim() ?? ''
    const device = named.length > 0 ? named : lanes.openedAsAsked()
    const trip = studioRoundTrip({
      measuredMs: micLatencyMsForDevice(device),
      measuredPathMs: micLatencyPathMsForDevice(device),
      pathSeconds: audioOutputPathSeconds(context),
      inputSeconds: reported?.latency,
      offsetMs: settings().offsetMs,
    })
    setRoundTrip(trip)
    return trip.seconds
  }

  /** Keep a take the way a picked WAV is kept: trimmed to the frame the singer heard, a punch's range, or a loop's passes. */
  async function keepTake(take: StudioCapturedTake): Promise<boolean> {
    const kept = studioTakeImport(take)
    // The recorder hands over, and recovery offers, only takes that keep
    // something (take-passes.ts); one that keeps nothing has nothing to retry.
    if (kept === null) return true
    const stored = await options.addRecording(kept)
    // A MIDI take keeps the notes played into it beside its audio.
    if (stored) await midi.keepNotes(take)
    return stored
  }

  /** What Record keeps: the range's passes with Repeat on, the range alone with Punch on, else a plain take. */
  function takeCut(): StudioTakeCut | null {
    const range = transport.range()
    if (range === null) return null
    if (transport.repeating()) return { mode: 'loop', range }
    return settings().punch ? { mode: 'punch', range } : null
  }

  const recorder = createStudioRecorder({
    unlock: () => transport.unlock(),
    clock: () => transport.clock(),
    acquireInstrument: (trackId) => midi.acquire(trackId),
    acquireMic: async (trackId) => {
      // Planned from the list the Studio holds: the input opens inside the
      // press, before anything is awaited, unless a lane armed on it holds
      // it open already.
      const plan = lanes.plan(trackId)
      const held = await micShare.open(trackId, {
        deviceId: plan.deviceId,
        name: lanes.askName(trackId, plan),
      })
      const pick = lanes.held(trackId, plan, held.missing)
      // The page may use the microphone now, so the browser names its inputs.
      void inputs.refresh()
      // Given back through itself, never by the Studio's id: a late release
      // from an earlier arm cannot end this one (MicManager.acquireFrom).
      return { stream: held.stream, pick, release: held.release }
    },
    inputOpened: lanes.opened,
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
      play: (notBefore, fromFrame) => transport.play(notBefore, fromFrame),
      pause: () => transport.pause(),
      anchor: () => transport.anchor(),
    },
    settings,
    takeCut,
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
    title: () => `Take ${studioNextTakeNumber(options.assets())}`,
    createId: () => globalThis.crypto.randomUUID(),
    describeError: (error) =>
      isStudioMemoryRefusal(error) && laneRecords.lanes().length > 1
        ? MEMORY_FOR_EVERY_LANE
        : describeStudioRecordError(error),
    onChange: (next) =>
      batch(() => {
        setLevel(next.level)
        setLive(next.live)
        laneRecords.update(next)
        setView((before) =>
          before.phase === next.phase &&
          before.countBeat === next.countBeat &&
          before.error === next.error &&
          before.notice === next.notice &&
          before.notices === next.notices &&
          before.capture === next.capture &&
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

  /** The lane Record arms when none is: the selected one, else the first with no clips, else a new lane (null). */
  function defaultLane(): string | null {
    const song = project()
    if (song === null) return null
    const selected = options.selectedTrackId()
    if (song.tracks.some((track) => track.id === selected)) return selected
    const used = new Set(song.clips.map((clip) => clip.trackId))
    const empty = [...song.tracks]
      .sort((a, b) => a.order - b.order)
      .find((track) => !used.has(track.id))
    return empty?.id ?? null
  }

  /** Start the take on the armed lane. */
  function startTake(): void {
    // A take runs straight through: the song does not loop under it,
    // unless it loops a range to record pass after pass.
    restoreRepeat = takeCut()?.mode !== 'loop' && transport.repeating()
    if (restoreRepeat) void transport.setRepeat(false)
    recorder.record()
  }

  // Bumped by every press: a Record that armed a lane starts the take only
  // if nothing was pressed since, and the lane it armed is still armed.
  let pressToken = 0

  /** Arm `lane` inside the press (the microphone and the clock need one), then record there. */
  async function armAndRecord(lane: string | null, token: number) {
    const armed = await recorder.arm(lane)
    if (armed && token === pressToken && phase() === 'armed') startTake()
  }

  /** The Record button and R: start a take on the armed lane, arming one first if none is; stop a take. */
  function press(): void {
    const now = phase()
    const token = ++pressToken
    if (now === 'idle') {
      if (canArm()) void armAndRecord(defaultLane(), token)
    } else if (now === 'armed') startTake()
    else if (RUNNING.has(now)) recorder.stop()
  }

  /** Whether lane `trackId` is armed, or its input is opening. */
  const isArmed = (trackId: string | null) =>
    laneRecords.lanes().some((lane) => lane.trackId === trackId)

  /** A lane's arm button: arm that lane beside the others, or disarm it alone. */
  function toggleArm(trackId: string): void {
    pressToken++
    if (TAKE_PHASES.has(phase())) return
    if (isArmed(trackId)) recorder.disarm(trackId)
    else if (canArm()) void recorder.arm(trackId)
  }

  /** How lane `trackId`'s arm button shows: idle, opening, armed, or the take every armed lane is in. */
  function laneState(trackId: string): StudioRecordPhase {
    const lane = laneRecords.lanes().find((each) => each.trackId === trackId)
    if (lane === undefined) return 'idle'
    if (lane.arming) return 'arming'
    const now = phase()
    return TAKE_PHASES.has(now) ? now : 'armed'
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

  // An armed lane that leaves the song (removed, or undone) disarms.
  createEffect(() => {
    const now = phase()
    if (now !== 'armed' && now !== 'arming') return
    const song = new Set(project()?.tracks.map((track) => track.id))
    for (const { trackId } of laneRecords.lanes())
      if (trackId !== null && !song.has(trackId))
        untrack(() => recorder.disarm(trackId))
  })
  // Monitoring follows its setting and each armed lane's volume and pan.
  createEffect(() => {
    for (const { trackId } of laneRecords.lanes()) laneLevel(trackId)
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
      // The Studio's input is a stream of its own (acquireFrom), apart from
      // the shared one `active` speaks for. A release by the app says why.
      // Only the lanes on it go: a MIDI lane's port is its own.
      if (state.scoped !== STUDIO_RECORD_MIC_ID)
        recorder.micLost(state.released ?? null)
    }),
  )
  onCleanup(
    registerMicIndicator(
      STUDIO_RECORD_MIC_ID,
      // Deliberately non-reactive: the sentinel polls these accessors on its
      // own low-frequency interval — no tracked scope involved.
      // On while any armed lane holds the microphone; a MIDI lane holds none.

      () => laneRecords.lanes().some((lane) => lane.microphone),
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
  onCleanup(() => {
    recorder.dispose()
    midi.dispose()
  })

  // ── Takes left in the journal by a closed tab or a refused save ──

  async function refreshRecovery(): Promise<void> {
    const current = untrack(project)
    if (current === null) return
    try {
      const rows = await journal.list(current.id)
      const stored = untrack(options.assets).map((asset) => asset.id)
      // A take stored before its rows could go, or one that keeps nothing (a
      // tab closed in its count-in, or before a range held enough of it):
      // its rows go now.
      const offered = rows.filter(
        (row) => !stored.includes(row.id) && placesSomething(row),
      )
      for (const row of rows)
        if (!offered.includes(row))
          void journal.discard(row.id).catch(() => undefined)
      if (untrack(project)?.id === current.id) setRecovery(offered)
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
      if ((now === 'idle' || now === 'armed') && before === 'finishing')
        void refreshRecovery()
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
          cut: read.header.cut ?? null,
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

  function setSettings(next: StudioRecordSettings): void {
    setSettingsSignal(writeStudioRecordSettings(next))
    recorder.updateMonitor()
  }

  /** Record lane `trackId` from its own input and channels from the next arm, on this device; an armed lane opens them now, the device left open when it stays the same. */
  function chooseLaneInput(trackId: string, next: StudioLaneInput): void {
    if (busy() || !lanes.choose(trackId, next)) return
    if (phase() !== 'armed' || !isArmed(trackId)) return
    const keepOpen = isMidiLaneInput(next)
      ? () => undefined
      : micShare.retain(lanes.plan(trackId).deviceId)
    recorder.disarm(trackId)
    // Its new arm takes the open input before the hold kept for it goes.
    void recorder.arm(trackId)
    keepOpen()
  }

  /** Record from `id` (null: the default) from the next arm; an armed lane opens it now. */
  function chooseInput(id: string | null, label: string | null): void {
    if (busy()) return
    setSettings({
      ...settings(),
      inputDeviceId: id,
      inputLabel: id === null ? null : label,
    })
    lanes.forget()
    if (phase() !== 'armed') return
    // The armed audio lanes open the new input; a MIDI lane plays on.
    const audio = laneRecords
      .lanes()
      .filter(({ trackId }) => !isMidiLaneInput(lanes.of(trackId)))
      .map(({ trackId }) => trackId)
    for (const trackId of audio) recorder.disarm(trackId)
    for (const trackId of audio) void recorder.arm(trackId)
  }

  // A take counting in or recording, and where it sits on the clock: the
  // playhead follows it where no song plays under it (take-clock.ts).
  const takeClock = createMemo(
    (): StudioTakeClock | null => {
      const current = running() ? live() : null
      if (current?.anchor === undefined) return null
      const loop = current.cut?.mode === 'loop' ? current.cut.range : null
      return { anchor: current.anchor, loop }
    },
    null,
    { equals: sameTakeClock },
  )

  // Export, Compare, Auto-balance, Repeat and the range wait for the take.
  const busy = () => running() || phase() === 'finishing'
  createEffect(() => setStudioTakeRunning(busy()))
  onCleanup(() => setStudioTakeRunning(false))

  async function discardRecovered(id: string): Promise<void> {
    await journal.discard(id).catch(() => undefined)
    await refreshRecovery()
  }

  return {
    view,
    phase,
    level,
    live,
    /** Every armed lane's level and the take growing in it, for the timeline. */
    timeline: laneRecords.records,
    /** The armed lanes, in the order they were armed: which hold a microphone, and which are still opening. */
    armedLanes: laneRecords.lanes,
    /** A running take's place on the clock, for the transport (take-clock.ts). */
    takeClock,
    /** A lane's name, or null for one that is not in the song. */
    laneName: (trackId: string | null): string | null =>
      project()?.tracks.find((track) => track.id === trackId)?.name ?? null,
    /** A count-in or a take is running: Space and seeks stop it. */
    running,
    /** Lane renders and warm-ups wait while a take counts in, records or is kept. */
    busy,
    canArm,
    press,
    stop,
    keyDown,
    /** Each lane's arm button reads and presses through this. */
    arming: {
      laneState,
      phase,
      canArm,
      toggle: toggleArm,
    } satisfies StudioLaneArming,
    /** Disarm every lane. */
    disarm: () => recorder.disarm(),
    clearMessages: () => recorder.clearMessages(),
    settings,
    setSettings,
    /** The browser's audio inputs, named once the page may use the microphone. */
    inputs: inputs.devices,
    /** List the inputs again: after the page was let use the microphone, say. */
    refreshInputs: inputs.refresh,
    /** The chosen input was not connected at the arm: the default records instead. */
    inputMissing: lanes.inputMissing,
    chooseInput,
    /** Each lane's own input: what it is, choosing it, its channels as far as this device knows, and the Studio's input it follows otherwise. */
    laneInputs: {
      of: (trackId: string) => lanes.of(trackId),
      choose: chooseLaneInput,
      channels: lanes.channels,
      studioInputName: lanes.studioInputName,
      /** Every input's channel count found on this device. */
      counts: lanes.counts,
      /** Keep the channel count of an input opened elsewhere: the Inputs view's check. */
      remember: lanes.remember,
    },
    /** The armed microphone for meters beside the take, on its own split; null while no lane holds one. */
    inputTap: () => recorder.inputTap(),
    /** Which opening of the microphone the armed lanes share: the Inputs view reads the tap again when it changes. */
    inputCapture: () => view().capture ?? null,
    /** The Studio's MIDI access: its state and ports, and the ask from a press. */
    midi: midi.access,
    /** Lane `trackId`'s MIDI arm by its port's name and sound, the first armed lane's with none named; null for a microphone. */
    midiArmed: (trackId?: string | null) =>
      midi.armed(trackId === undefined ? view().targetTrackId : trackId),
    /** What lane `trackId`'s arm opened, the last arm's with none named: what records, and what opened in place of what its lane asked for. */
    armedInput: (trackId?: string | null) => lanes.armed(trackId),
    /** Punch, on the transport: Record keeps only the range. */
    punch: {
      on: () => settings().punch,
      toggle: () => setSettings({ ...settings(), punch: !settings().punch }),
    },
    roundTrip,
    recovery,
    recovering,
    keepRecovered,
    discardRecovered,
  }
}

export type StudioRecorderHandle = ReturnType<typeof useStudioRecorder>

/** The next take's number: one past the highest a recorded take's file carries ("Take 3.wav" is take 3). */
export function studioNextTakeNumber(assets: readonly StudioAsset[]): number {
  let highest = 0
  for (const asset of assets) {
    if (asset.provenance.kind !== 'recording') continue
    const number = /^Take (\d+)\b/.exec(asset.originalName ?? '')
    highest = Math.max(highest, number ? Number(number[1]) : 0)
  }
  return highest + 1
}
