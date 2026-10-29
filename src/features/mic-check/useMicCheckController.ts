// ============================================================
// useMicCheckController — one mic check, from Start to cleanup
// ============================================================
//
// Owns the check's capture and everything it watches. The capture is a voice
// session (@/lib/voice-session) under the check's own consumer id — the
// sequence that opens a microphone without the iOS traps — plus a live
// analysis of the check's own on the session's context (live-analysis.ts):
// one analyser whose buffers feed the level, the ribbon's bands and a YIN
// pass for the note.
//
// What it watches, because each is a way a microphone gets taken over
// without anyone saying so:
//   - the device list (`devicechange`): an input arriving, leaving, or
//     quietly becoming the system default;
//   - the capture track: `mute` (the system paused it for a call, another
//     app or a privacy switch), `ended` (unplugged, revoked) and its settings;
//   - the level: a live track delivering exact zeros is muted somewhere,
//     which a quiet room never is;
//   - the shared manager: which other surfaces in this tab hold the mic,
//     and whether another MercuryPitch tab took it away;
//   - the site's microphone permission.
// Every change lands in a short timeline, so "what happened" still has an
// answer afterwards, and the verdict (check-verdict.ts) names the one
// that matters now.
//
// Release is unconditional on cleanup, and the check registers its indicator
// with the mic sentinel like every other mic surface.

import type { Accessor } from 'solid-js'
import { createMemo, createSignal, onCleanup, onMount } from 'solid-js'
import type { InputHealth } from '@/lib/input-health'
import { armInputHealth, initialInputHealth, observeInputLevel, } from '@/lib/input-health'
import type { MicLockRecord } from '@/lib/mic-lock'
import { micLockStatus, onMicLockChange } from '@/lib/mic-lock'
import type { MicErrorKind } from '@/lib/mic-manager'
import { BACKGROUND_HOLD_IDS, micManager } from '@/lib/mic-manager'
import { registerMicIndicator } from '@/lib/mic-sentinel'
import type { OpenResult, VoiceSession } from '@/lib/voice-session'
import { createVoiceSession } from '@/lib/voice-session'
import { holdExclusiveCapture } from '@/stores/mic-store'
import type { CheckTone } from './check-copy'
import { describeRosterChange, describeSwitch, holderName, inputName, permissionWords, } from './check-copy'
import type { LostReason, Verdict } from './check-verdict'
import { decideVerdict } from './check-verdict'
import { listDevices, trackIdentity, watchDeviceChanges } from './device-watch'
import type { MicAnalysis, MicCheckLive } from './live-analysis'
import { createMicAnalysis, createMicLive, quietMicLive } from './live-analysis'
import type { DeviceInfoLike, MicRoster } from './mic-roster'
import { buildRoster, defaultInput, diffRosters, EMPTY_ROSTER, listeningInput, } from './mic-roster'
import type { HeldNote } from './note-tracker'

export const MIC_CHECK_ID = 'mic-check'

/** The timeline keeps this many lines, newest first. */
const EVENT_LIMIT = 8
/** A live microphone never reads this low; exact silence is a mute somewhere
 *  (the same floor voice-session's probe uses). */
const DEAD_RMS = 1e-6
/** How long exact silence must last before it is worth saying. */
const DEAD_AFTER_MS = 1500
/** The readout and the verdict update at this pace, not every frame. */
const UI_REFRESH_MS = 90
/** The same line twice within this window is one event, not two. */
const REPEAT_WINDOW_MS = 2000

export type MicCheckPhase = 'idle' | 'opening' | 'listening'

export interface MicCheckEvent {
  id: number
  /** Epoch ms. */
  at: number
  tone: CheckTone
  text: string
}

export interface TrackFacts {
  label: string
  muted: boolean
  ended: boolean
  settings: MediaTrackSettings
}

export interface MicCheckController {
  phase: Accessor<MicCheckPhase>
  verdict: Accessor<Verdict>
  roster: Accessor<MicRoster>
  events: Accessor<readonly MicCheckEvent[]>
  permission: Accessor<PermissionState | 'unknown'>
  track: Accessor<TrackFacts | null>
  /** Other surfaces in this tab holding the microphone, as consumer ids. */
  otherHolders: Accessor<readonly string[]>
  note: Accessor<HeldNote | null>
  /** The input the check was pointed at, or null while it follows the
   *  system default. */
  pinnedDeviceId: Accessor<string | null>
  switching: Accessor<boolean>
  /** False while another surface is listening: reopening the device would
   *  cut it off without telling it. */
  canSwitch: Accessor<boolean>
  live: MicCheckLive
  /** Call from the click itself: the AudioContext is created inside it. */
  start: () => void
  stop: () => void
  restart: () => void
  takeOver: () => Promise<void>
  /** Listen to one input, or to the system default with null. */
  listenTo: (deviceId: string | null) => Promise<void>
}

interface CaptureGraph {
  analysis: MicAnalysis
  /** Follows the context's state, for Safari's `interrupted`. */
  onState: () => void
}

interface WatchedTrack {
  stream: MediaStream
  track: MediaStreamTrack
  stop: () => void
}

export function useMicCheckController(): MicCheckController {
  const [phase, setPhase] = createSignal<MicCheckPhase>('idle')
  const [openError, setOpenError] = createSignal<{
    kind: MicErrorKind
    message: string
  } | null>(null)
  const [lost, setLost] = createSignal<LostReason | null>(null)
  const [lockHolder, setLockHolder] = createSignal<MicLockRecord | null>(null)
  const [roster, setRoster] = createSignal<MicRoster>(EMPTY_ROSTER)
  const [events, setEvents] = createSignal<readonly MicCheckEvent[]>([])
  const [permission, setPermission] = createSignal<PermissionState | 'unknown'>(
    'unknown',
  )
  const [track, setTrack] = createSignal<TrackFacts | null>(null)
  const [holders, setHolders] = createSignal<readonly string[]>([])
  const [note, setNote] = createSignal<HeldNote | null>(null)
  const [health, setHealth] = createSignal<InputHealth>('unknown')
  const [digitalSilence, setDigitalSilence] = createSignal(false)
  const [interrupted, setInterrupted] = createSignal(false)
  const [pinned, setPinned] = createSignal<string | null>(
    micManager.getPreferredDevice(),
  )
  const [switching, setSwitching] = createSignal(false)

  const live: MicCheckLive = createMicLive()

  let disposed = false
  let session: VoiceSession | null = null
  let graph: CaptureGraph | null = null
  let watched: WatchedTrack | null = null
  let releaseExclusive: (() => void) | null = null
  let frameId = 0
  let lastUiAt = 0
  let healthState = initialInputHealth()
  let deadSince: number | null = null
  // While the session's probe runs, its own dead-zero rebuild may replace
  // the context under us; exact zeros then are the probe's business.
  let probing = false
  let lastDevices: readonly DeviceInfoLike[] = []
  let eventId = 0

  const pushEvent = (tone: CheckTone, text: string): void => {
    const now = Date.now()
    setEvents((previous) => {
      const top = previous[0]
      if (top?.text === text && now - top.at < REPEAT_WINDOW_MS) return previous
      return [{ id: ++eventId, at: now, tone, text }, ...previous].slice(
        0,
        EVENT_LIMIT,
      )
    })
  }

  const currentName = (): string => inputName(listeningInput(roster()))

  const canSwitch = (): boolean =>
    holders().every((id) => BACKGROUND_HOLD_IDS.includes(id))

  // ── The track ─────────────────────────────────────────────

  function refreshTrack(): void {
    const current = watched?.track
    if (current === undefined) {
      setTrack(null)
    } else {
      setTrack({
        label: current.label,
        muted: current.muted,
        ended: current.readyState === 'ended',
        settings: current.getSettings?.() ?? {},
      })
    }
    // Which row is "listening" follows the track, not the device list.
    setRoster(buildRoster(lastDevices, trackIdentity(watched?.track)))
  }

  function unwatchTrack(): void {
    watched?.stop()
    watched = null
  }

  function watchStream(): void {
    const stream = micManager.getStream()
    if (watched?.stream === stream) return
    unwatchTrack()
    const current = stream?.getAudioTracks()[0]
    if (stream === null || current === undefined) {
      refreshTrack()
      return
    }
    const onMute = (): void => {
      refreshTrack()
      pushEvent('bad', `Your system paused ${currentName()}`)
    }
    const onUnmute = (): void => {
      refreshTrack()
      pushEvent('good', `${currentName()} is coming through again`)
    }
    const onEnded = (): void => {
      refreshTrack()
      pushEvent('bad', `${currentName()} stopped: unplugged, off or taken back`)
    }
    current.addEventListener('mute', onMute)
    current.addEventListener('unmute', onUnmute)
    current.addEventListener('ended', onEnded)
    watched = {
      stream,
      track: current,
      stop: () => {
        current.removeEventListener('mute', onMute)
        current.removeEventListener('unmute', onUnmute)
        current.removeEventListener('ended', onEnded)
      },
    }
    refreshTrack()
  }

  // ── The device list ───────────────────────────────────────

  async function refreshRoster(): Promise<void> {
    const devices = await listDevices()
    if (devices === null || disposed) return
    lastDevices = devices
    const next = buildRoster(devices, trackIdentity(watched?.track))
    for (const change of diffRosters(roster(), next)) {
      const line = describeRosterChange(change)
      pushEvent(line.tone, line.text)
    }
    setRoster(next)
  }

  // A device event, read for the list as it stands then. Nothing here
  // should track, as with the manager's events below.
  // eslint-disable-next-line solid/reactivity
  const unwatchDevices = watchDeviceChanges(() => {
    void refreshRoster()
  })
  // Listed before any check starts, so the panel opens on what is plugged in.
  onMount(() => {
    void refreshRoster()
  })

  // ── Permission ────────────────────────────────────────────

  let permissionStatus: PermissionStatus | null = null
  const onPermissionChange = (): void => {
    const state = permissionStatus?.state
    if (state === undefined) return
    setPermission(state)
    pushEvent(
      state === 'denied' ? 'bad' : 'info',
      `Microphone permission is now ${permissionWords(state)}`,
    )
    // Names arrive with a grant.
    if (state === 'granted') void refreshRoster()
  }
  void (async () => {
    try {
      const status = await navigator.permissions?.query({
        name: 'microphone' as PermissionName,
      })
      if (status === undefined || disposed) return
      permissionStatus = status
      setPermission(status.state)
      status.addEventListener('change', onPermissionChange)
    } catch {
      // Firefox and older WebKit do not answer for the microphone.
    }
  })()

  // ── The shared manager and the other tabs ─────────────────

  const unsubscribeLock = onMicLockChange((status, holder) => {
    setLockHolder(status === 'other' ? holder : null)
  })

  function handleLost(): void {
    const ended = watched?.track.readyState === 'ended'
    const reason: LostReason =
      micLockStatus() === 'other' ? 'other-tab' : ended ? 'ended' : 'closed'
    endCapture()
    setLost(reason)
    setPhase('idle')
    pushEvent(
      reason === 'other-tab' ? 'warn' : 'bad',
      reason === 'other-tab'
        ? 'Another MercuryPitch tab took the microphone'
        : reason === 'ended'
          ? 'The microphone went away'
          : 'The microphone was closed under the check',
    )
  }

  // The manager answers a subscribe at once, with whoever already holds the
  // mic. Those did not start "now", so the first answer sets the list quietly.
  let holdersKnown = false
  const unsubscribeManager = micManager.subscribe(
    // A manager event, read for the values as they stand now. Nothing here
    // should track, so it deliberately runs outside any tracked scope.
    // eslint-disable-next-line solid/reactivity
    (state) => {
      const others = state.consumers.filter((id) => id !== MIC_CHECK_ID)
      const before = holders()
      if (holdersKnown) {
        for (const id of others) {
          if (!before.includes(id)) {
            pushEvent('info', `${holderName(id)} started using the microphone`)
          }
        }
        for (const id of before) {
          if (!others.includes(id)) {
            pushEvent('info', `${holderName(id)} let go of the microphone`)
          }
        }
      }
      holdersKnown = true
      setHolders(others)
      if (phase() !== 'listening' || switching()) return
      if (
        micManager.getStream() === null ||
        !state.consumers.includes(MIC_CHECK_ID)
      ) {
        handleLost()
        return
      }
      watchStream()
    },
  )

  // ── The analysis graph and its loop ───────────────────────

  function disposeGraph(): void {
    if (graph === null) return
    graph.analysis.context.removeEventListener('statechange', graph.onState)
    graph.analysis.dispose()
    graph = null
    live.active = false
  }

  function buildGraph(): void {
    disposeGraph()
    const context = session?.context() ?? null
    const stream = micManager.getStream()
    if (context === null || stream === null) return
    // Safari reports a call or Siri as an `interrupted` context, a state the
    // standard types do not list.
    const onState = (): void => {
      const isInterrupted = (context.state as string) === 'interrupted'
      if (isInterrupted && !interrupted()) {
        pushEvent('warn', 'A call or another app interrupted audio')
      }
      setInterrupted(isInterrupted)
    }
    context.addEventListener('statechange', onState)
    graph = { analysis: createMicAnalysis(context, stream), onState }
    live.active = true
    // Armed from the first frame: opening a mic check IS the request to make
    // a sound, so six seconds of nothing is worth saying.
    healthState = armInputHealth(performance.now())
    deadSince = null
  }

  function syncUi(now: number): void {
    setNote(live.note)

    const status = healthState.status
    if (status !== health()) {
      if (status === 'silent') {
        pushEvent('warn', `Nothing has reached us from ${currentName()}`)
      } else if (status === 'healthy') {
        pushEvent('good', `Heard you on ${currentName()}`)
      }
      setHealth(status)
    }

    const dead = deadSince !== null && now - deadSince >= DEAD_AFTER_MS
    if (dead !== digitalSilence()) {
      pushEvent(
        dead ? 'bad' : 'good',
        dead
          ? `${currentName()} went completely silent`
          : `Sound is coming from ${currentName()} again`,
      )
      setDigitalSilence(dead)
    }
  }

  function frame(now: number): void {
    frameId = 0
    const current = graph
    if (current === null) return
    current.analysis.read(live, now)
    const rms = live.rms
    healthState = observeInputLevel(healthState, rms, now)
    deadSince = rms > DEAD_RMS || probing ? null : (deadSince ?? now)

    if (now - lastUiAt >= UI_REFRESH_MS) {
      lastUiAt = now
      syncUi(now)
    }
    frameId = requestAnimationFrame(frame)
  }

  function startLoop(): void {
    if (frameId === 0) frameId = requestAnimationFrame(frame)
  }

  function stopLoop(): void {
    if (frameId !== 0) cancelAnimationFrame(frameId)
    frameId = 0
  }

  // ── Lifecycle ─────────────────────────────────────────────

  function endCapture(): void {
    stopLoop()
    disposeGraph()
    unwatchTrack()
    session?.close()
    session = null
    releaseExclusive?.()
    releaseExclusive = null
    probing = false
    healthState = initialInputHealth()
    deadSince = null
    quietMicLive(live)
    setNote(null)
    setHealth('unknown')
    setDigitalSilence(false)
    setInterrupted(false)
    setTrack(null)
    setRoster(buildRoster(lastDevices, null))
  }

  function start(): void {
    if (phase() !== 'idle') return
    setPhase('opening')
    setOpenError(null)
    setLost(null)
    // Voice control stands down for a capture that listens to singing; it
    // would hear held vowels as commands (mic-store.ts).
    releaseExclusive = holdExclusiveCapture()
    const opened = createVoiceSession(MIC_CHECK_ID)
    session = opened
    // open() creates its AudioContext before its first await, which keeps
    // it inside this click for iOS Safari. Nothing may be awaited above.
    void finishOpening(opened, opened.open())
  }

  async function finishOpening(
    opened: VoiceSession,
    opening: Promise<OpenResult>,
  ): Promise<void> {
    const result = await opening
    if (session !== opened || disposed) return
    if (!result.ok) {
      const error = micManager.getError()
      setOpenError({ kind: error?.kind ?? 'unknown', message: result.message })
      endCapture()
      setPhase('idle')
      pushEvent('bad', result.message)
      return
    }
    setPhase('listening')
    setPinned(micManager.getPreferredDevice())
    probing = true
    buildGraph()
    watchStream()
    startLoop()
    void followProbe(opened)
    await refreshRoster()
    if (session === opened) pushEvent('info', `Listening on ${currentName()}`)
  }

  async function followProbe(opened: VoiceSession): Promise<void> {
    try {
      await opened.probe()
    } finally {
      if (session === opened) {
        probing = false
        // The probe rebuilds the session's context when it reads dead
        // zeros (the iOS sample-rate case); follow it onto the new one.
        if (graph?.analysis.context !== opened.context()) buildGraph()
      }
    }
  }

  function stop(): void {
    if (phase() === 'idle') return
    endCapture()
    setPhase('idle')
  }

  function restart(): void {
    // Reopen the device itself, not the lingering handle the manager would
    // hand straight back: a fresh open is what tells a muted or seized input
    // from a working one. Queued, not awaited, so start() still runs inside
    // the click; the manager runs its queue in order.
    const fresh = canSwitch()
    endCapture()
    setPhase('idle')
    if (fresh) void micManager.forceReleaseAll()
    start()
  }

  async function takeOver(): Promise<void> {
    const won = await micManager.takeOverFromOtherTab()
    if (disposed) return
    if (!won) {
      pushEvent(
        'warn',
        'The other tab did not answer. Close it, or turn its microphone off there.',
      )
      return
    }
    setOpenError(null)
    setLost(null)
    start()
  }

  async function listenTo(deviceId: string | null): Promise<void> {
    const current = session
    if (current === null || phase() !== 'listening' || switching()) return
    if (!canSwitch()) return
    const asked =
      deviceId === null
        ? null
        : (roster().inputs.find((input) => input.deviceId === deviceId) ?? null)
    setSwitching(true)
    // The old track stops as the device changes; let go of it first.
    stopLoop()
    disposeGraph()
    unwatchTrack()
    let result: Awaited<ReturnType<VoiceSession['useDevice']>> = 'no-session'
    try {
      result = await current.useDevice(deviceId ?? '')
    } finally {
      setSwitching(false)
    }
    if (session !== current || disposed) return
    setPinned(micManager.getPreferredDevice())
    if (micManager.getStream() === null) {
      // The new input would not open, and the old one is already closed.
      handleLost()
      return
    }
    buildGraph()
    watchStream()
    startLoop()
    await refreshRoster()
    if (session !== current) return
    const line = describeSwitch(asked, pinned() !== null, currentName())
    pushEvent(line.tone, line.text)
    if (result === 'silent') {
      pushEvent('warn', `${currentName()} opened, but sent no sound at all`)
    }
  }

  const unregisterIndicator = registerMicIndicator(
    MIC_CHECK_ID,
    // Deliberately non-reactive: the sentinel polls these accessors on its
    // own low-frequency interval — no tracked scope involved.
    // eslint-disable-next-line solid/reactivity
    () => phase() === 'listening',
    // eslint-disable-next-line solid/reactivity
    () => {
      stop()
    },
  )

  onCleanup(() => {
    disposed = true
    endCapture()
    unregisterIndicator()
    unsubscribeManager()
    unsubscribeLock()
    unwatchDevices()
    permissionStatus?.removeEventListener('change', onPermissionChange)
  })

  // A boolean, so a note moving by a few cents does not re-decide anything.
  const singing = createMemo(() => note() !== null)
  const verdict = createMemo(
    () =>
      decideVerdict({
        phase: phase(),
        openError: openError(),
        lost: lost(),
        otherTabLabel: lockHolder()?.label ?? null,
        permission: permission(),
        trackMuted: track()?.muted === true,
        trackEnded: track()?.ended === true,
        contextInterrupted: interrupted(),
        digitalSilence: digitalSilence(),
        health: health(),
        followingDefault: pinned() === null,
        listening: listeningInput(roster()),
        systemDefault: defaultInput(roster()),
        singing: singing(),
      }),
    undefined,
    // Same words, same verdict: the status region is a live region, and a
    // fresh object with the same text must not make it speak again.
    { equals: (a, b) => a.title === b.title && a.detail === b.detail },
  )

  return {
    phase,
    verdict,
    roster,
    events,
    permission,
    track,
    otherHolders: holders,
    note,
    pinnedDeviceId: pinned,
    switching,
    canSwitch,
    live,
    start,
    stop,
    restart,
    takeOver,
    listenTo,
  }
}
