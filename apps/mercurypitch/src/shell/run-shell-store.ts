// ============================================================
// RunShell — the shell's state machine, and nothing that draws
// ============================================================
//
// One module for the five moments the bottom edge has to tell apart
// (S1 build brief §4, §6): browsing a room, a run active, a run paused, a run
// ended with the take still on screen, and a run parked because the singer
// left the room. Every component below reads from here; none of them keeps a
// second copy.
//
// WHERE THE TRUTH COMES FROM. The ROOM, through the bridge it fills on mount
// (`src/stores/native-shell-store.ts`). Not `playbackState()`: that signal
// reads like the app's transport and is not one — its only production writer
// sets 'stopped', and a practice run's real state lives in
// `usePlaybackController`'s own signals, which reach the stage as props. A
// shell derived from the store alone stayed in `browsing` through an entire
// run, with the transport, the chip, the column, the pill and the Keep alert
// all unreachable. The store is kept as the fallback for a surface that has
// registered no controls.
//
// The other fact no signal carries is WHICH tab the run belongs to. Every run
// store in this app is a module-level global, so without an owner the session
// pill lights up in Progress and in the Ear Lab as well.
//
// THE CLOCK IS OURS. There is no elapsed-time source on a phone —
// `SingingStatusBar` computes one and never mounts on a narrow viewport — so
// the transport's mm:ss is a start timestamp plus the paused accumulations,
// kept here.
//
// PARK PAUSES, IT DOES NOT END. A room's `park()` pauses playback and
// releases the microphone on the same frame (REQ-NHR-017). It must not stop:
// a parked run comes back paused, with the singer's place kept, and a stop
// would put the shell in `ended` the moment somebody tapped Progress.

import { createEffect, createMemo, createRoot, createSignal, on, untrack, } from 'solid-js'
import type { ActiveTab } from '@/features/tabs/constants'
import { markRunParked, nativeRunControls } from '@/stores/native-shell-store'
import { playbackState } from '@/stores/playback-state-store'
import { activeTab } from '@/stores/ui-store'

export type RunState = 'browsing' | 'active' | 'paused' | 'ended'

/**
 * Which behaviour the bottom edge has while a run is going. R2 is what the
 * owner locked (band swap plus a corner chip that opens the tabs upward) and
 * the only one implemented. It is a runtime value rather than a constant so a
 * second behaviour can be added without unpicking the components — there is
 * deliberately no UI that changes it.
 */
export type RailVariant = 'r1' | 'r2'

/** A screen pushed over the tab, with its own Back. */
export type PushedScreen = 'settings'

/** How long an untouched tab column stays open (brief §6). */
export const COLUMN_IDLE_MS = 4000

const CLOCK_INTERVAL_MS = 500

const [runOwner, setRunOwner] = createSignal<ActiveTab | null>(null)
// The room's name, captured when the run starts. The pill outlives the room
// that registered the controls — leaving the tab unmounts it — so the label
// cannot be read back off them at the moment it is needed.
const [runLabel, setRunLabel] = createSignal('')
const [takeOnScreen, setTakeOnScreen] = createSignal(false)
const [locked, setLocked] = createSignal(false)
const [columnOpen, setColumnOpen] = createSignal(false)
const [moreOpen, setMoreOpen] = createSignal(false)
const [pushed, setPushed] = createSignal<PushedScreen | null>(null)
const [keepAlertOpen, setKeepAlertOpen] = createSignal(false)
const [variant, setVariant] = createSignal<RailVariant>('r2')
const [announcement, setAnnouncement] = createSignal('')
const [tick, setTick] = createSignal(0)

let startedAt: number | null = null
let accumulatedMs = 0
let clockTimer: ReturnType<typeof setInterval> | null = null
let idleTimer: ReturnType<typeof setTimeout> | null = null
let announcedThisRun = false
/** What a parked run is, for as long as its room is not mounted. See liveRun. */
let parkedLatch: 'paused' | null = null

function stopClockTimer(): void {
  if (clockTimer !== null) clearInterval(clockTimer)
  clockTimer = null
}

function startClockTimer(): void {
  stopClockTimer()
  clockTimer = setInterval(() => {
    setTick((n) => n + 1)
  }, CLOCK_INTERVAL_MS)
}

function beginClock(): void {
  accumulatedMs = 0
  startedAt = Date.now()
  setTick((n) => n + 1)
  startClockTimer()
}

function resumeClock(): void {
  if (startedAt === null) startedAt = Date.now()
  startClockTimer()
}

function holdClock(): void {
  if (startedAt !== null) {
    accumulatedMs += Date.now() - startedAt
    startedAt = null
  }
  stopClockTimer()
  setTick((n) => n + 1)
}

function clearIdleTimer(): void {
  if (idleTimer !== null) clearTimeout(idleTimer)
  idleTimer = null
}

// ── Reads ────────────────────────────────────────────────────

export {
  columnOpen,
  keepAlertOpen,
  locked,
  moreOpen,
  pushed,
  runLabel,
  runOwner,
  variant,
}

/** The announcement the shell's live region reads out, or ''. */
export const shellAnnouncement = announcement

export const currentTab = (): ActiveTab => activeTab()

/**
 * Is a run going, and is it moving? The room answers where there is one; the
 * global store answers for anything that registered nothing.
 *
 * Deliberately separate from `runState`: `ended` is a fact about the SHELL
 * (a take still on screen), and folding it in here would make the effect
 * below watch a value it also writes.
 */
const liveRun = createMemo<'active' | 'paused' | 'idle'>(() => {
  const controls = nativeRunControls()
  if (controls !== null) {
    if (controls.isPlaying()) return 'active'
    if (controls.isPaused()) return 'paused'
    return 'idle'
  }

  // NOBODY REGISTERED IS NOT THE SAME AS NOBODY RUNNING. Leaving a room
  // unmounts it, so a parked run has no controls to read — and reading the
  // global store there answers 'stopped', which the machine settles as an
  // ended run. Measured: the pill appeared on the first tab after parking and
  // was gone by the second, while the room's own controller sat paused
  // mid-run. Brief §6: the pill sits in the dock on every other tab.
  //
  // So parking latches. The latch is only ever consulted while no room is
  // registered, and it is dropped the moment the run's owner is let go of.
  if (parkedLatch !== null && untrack(runOwner) !== null) return parkedLatch

  const state = playbackState()
  if (state === 'playing') return 'active'
  if (state === 'paused') return 'paused'
  return 'idle'
})

export const runState = createMemo<RunState>(() => {
  const live = liveRun()
  if (live !== 'idle') return live
  return takeOnScreen() ? 'ended' : 'browsing'
})

/** The bars before the first note, from the room that is counting them. */
export const countingIn = (): boolean =>
  nativeRunControls()?.isCountingIn?.() ?? false

export const countInBeat = (): number =>
  nativeRunControls()?.countInBeat?.() ?? 0

/** True while a run belongs to a tab the singer is not looking at. */
export const parked = createMemo<boolean>(() => {
  const owner = runOwner()
  return owner !== null && owner !== currentTab()
})

/** Is there a run on this screen that the transport should be driving? */
export const transportVisible = createMemo<boolean>(() => {
  const state = runState()
  return (state === 'active' || state === 'paused') && !parked()
})

/** The full rail is gone exactly while the transport has its slot. */
export const railVisible = createMemo<boolean>(() => !transportVisible())

/** R2's corner chip: present whenever the transport took the rail's place. */
export const chipVisible = createMemo<boolean>(
  () => variant() === 'r2' && transportVisible(),
)

export function elapsedMs(): number {
  tick()
  const running = startedAt === null ? 0 : Date.now() - startedAt
  return accumulatedMs + running
}

/** mm:ss, elapsed only — never a total, because a run does not have one. */
export function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const minutes = Math.floor(total / 60)
  const seconds = total % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

// ── Commands ─────────────────────────────────────────────────

function armColumnIdle(): void {
  clearIdleTimer()
  idleTimer = setTimeout(() => {
    setColumnOpen(false)
  }, COLUMN_IDLE_MS)
}

export function openColumn(): void {
  if (!chipVisible()) return
  setColumnOpen(true)
  armColumnIdle()
}

/**
 * Keep an open column open: four seconds is a timer for a column nobody is
 * using, not a deadline for reading it.
 */
export function touchColumn(): void {
  if (!untrack(columnOpen)) return
  armColumnIdle()
}

export function closeColumn(): void {
  clearIdleTimer()
  setColumnOpen(false)
}

export function toggleColumn(): void {
  if (untrack(columnOpen)) closeColumn()
  else openColumn()
}

export function openMore(): void {
  closeColumn()
  setMoreOpen(true)
}

export function closeMore(): void {
  setMoreOpen(false)
}

export function pushScreen(screen: PushedScreen): void {
  closeColumn()
  closeMore()
  setPushed(screen)
}

export function popScreen(): void {
  setPushed(null)
}

export function toggleLock(): void {
  setLocked((on) => !on)
}

/** Stop sound and release the mic without ending the run (brief §6, Park). */
export function parkRun(): void {
  const state = untrack(runState)
  if (state !== 'active' && state !== 'paused') return
  const owner = untrack(runOwner)
  // Tell the room's tab-transition cleanup that this leave is a park, so it
  // skips the reset that would end the run — and only for THIS tab, so a park
  // that never led anywhere cannot silence an unrelated leave later.
  if (owner !== null) markRunParked(owner)
  nativeRunControls()?.park()
  // What the run is once the room that owns it unmounts. Held until the
  // singer comes back to it, or until the owner is let go of.
  parkedLatch = 'paused'
}

export function pauseRun(): void {
  if (untrack(locked)) return
  nativeRunControls()?.pause()
}

export function resumeRun(): void {
  if (untrack(locked)) return
  nativeRunControls()?.resume()
}

export function togglePlayPause(): void {
  if (untrack(runState) === 'active') pauseRun()
  else resumeRun()
}

/**
 * Stop asks first, but only when there is something to lose.
 *
 * Absent means no. Today no room can answer, so no alert appears — an alert
 * on every Stop whose two answers do the same thing teaches a promise the app
 * does not keep. The component and the hook stay for the room that gains a
 * real take.
 */
export function requestEnd(): void {
  if (untrack(locked)) return
  const state = untrack(runState)
  if (state !== 'active' && state !== 'paused') return
  const controls = nativeRunControls()
  const unsaved = controls?.hasUnsavedTake?.() ?? false
  if (unsaved) {
    setKeepAlertOpen(true)
    return
  }
  finishRun()
}

/** Both answers to the Keep alert end the run; only the copy differs today. */
export function finishRun(): void {
  setKeepAlertOpen(false)
  closeColumn()
  nativeRunControls()?.stop()
}

export function dismissKeepAlert(): void {
  setKeepAlertOpen(false)
}

/** The pill's one control: back to the room the run is in, still paused. */
export function returnTarget(): ActiveTab | null {
  return runOwner()
}

/** Test seam. Production never calls this; a suite between cases does. */
export function resetRunShell(): void {
  clearIdleTimer()
  stopClockTimer()
  settled = 'idle'
  idlePending = false
  parkedLatch = null
  startedAt = null
  accumulatedMs = 0
  announcedThisRun = false
  setRunOwner(null)
  setRunLabel('')
  setTakeOnScreen(false)
  setLocked(false)
  setColumnOpen(false)
  setMoreOpen(false)
  setPushed(null)
  setKeepAlertOpen(false)
  setVariant('r2')
  setAnnouncement('')
  setTick(0)
}

// ── The machine ──────────────────────────────────────────────
//
// One root, created when the module is first imported. Solid warns about a
// computation with no owner, and the shell's state outlives every component
// that reads it, so the root is the module rather than a component.
//
// WHY IDLE IS SETTLED AND NOT ACTED ON AT ONCE. A room's play state is two
// signals, and every transition writes both: pausing is `isPlaying(false)`
// then `isPaused(true)`, and resuming is the same pair the other way round.
// Between those two writes the room reports neither — indistinguishable, for
// one synchronous moment, from a run that just ended. Acting on it there
// cleared the run's owner (losing the session pill), unlocked a locked
// transport, and restarted the elapsed clock at zero on every resume. So an
// idle report waits a microtask: if the other half of the pair arrives in the
// same turn, as it always does for a pause or a resume, nothing happened.

type LiveRun = 'active' | 'paused' | 'idle'

let settled: LiveRun = 'idle'
let idlePending = false

function applyTransition(previous: LiveRun, next: LiveRun): void {
  if (next === 'active') {
    if (previous === 'paused') {
      resumeClock()
    } else {
      beginClock()
      // A fresh run always starts unlocked. Resuming does not touch it: a
      // locked transport refuses the press that would have resumed it anyway.
      setLocked(false)
    }
    setTakeOnScreen(false)
    parkedLatch = null
    if (untrack(runOwner) === null) {
      const controls = nativeRunControls()
      setRunOwner(controls?.tab ?? untrack(activeTab))
      setRunLabel(controls?.roomLabel ?? 'Practice')
    }
    if (!announcedThisRun) {
      announcedThisRun = true
      setAnnouncement('Tabs hidden while you practise')
    }
    return
  }

  if (next === 'paused') {
    holdClock()
    closeColumn()
    return
  }

  // Settled idle: the run is over. The owner is NOT cleared here — `ended`
  // means the take is still on screen, in the room it happened in, and the
  // effect below lets go of it when the singer leaves.
  parkedLatch = null
  holdClock()
  if (previous === 'active' || previous === 'paused') setTakeOnScreen(true)
  setLocked(false)
  closeColumn()
  setKeepAlertOpen(false)
  announcedThisRun = false
  setAnnouncement('')
}

function settle(next: LiveRun): void {
  if (next === settled) return
  const previous = settled
  settled = next
  applyTransition(previous, next)
}

createRoot(() => {
  createEffect(
    on(liveRun, (live) => {
      if (live !== 'idle') {
        idlePending = false
        settle(live)
        return
      }
      if (settled === 'idle') return
      idlePending = true
      queueMicrotask(() => {
        if (!idlePending) return
        idlePending = false
        settle('idle')
      })
    }),
  )

  // Leaving the room an ended run belongs to closes the book on it: there is
  // no take to come back to, so neither the pill nor the `ended` state may
  // follow the singer into Progress.
  createEffect(
    on(activeTab, (tab) => {
      if (untrack(runState) !== 'ended') return
      if (untrack(runOwner) === tab) return
      setTakeOnScreen(false)
      setRunOwner(null)
      setRunLabel('')
      parkedLatch = null
    }),
  )
})

export { setVariant }
