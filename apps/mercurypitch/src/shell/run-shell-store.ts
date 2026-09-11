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
// WHERE THE TRUTH COMES FROM. `playbackState()` is the app's own transport
// signal and the only thing that knows a run started — the rooms set it, the
// shell never does. Everything else is derived from it plus one fact the
// signal cannot carry: WHICH tab the run belongs to. Every run store in this
// app is a module-level global, so without an owner the session pill lights
// up in Progress and in the Ear Lab as well (build brief §2, the trap).
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
import { nativeRunControls } from '@/stores/native-shell-store'
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

export const runState = createMemo<RunState>(() => {
  const state = playbackState()
  if (state === 'playing') return 'active'
  if (state === 'paused') return 'paused'
  return takeOnScreen() ? 'ended' : 'browsing'
})

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

export function openColumn(): void {
  if (!chipVisible()) return
  setColumnOpen(true)
  clearIdleTimer()
  idleTimer = setTimeout(() => {
    setColumnOpen(false)
  }, COLUMN_IDLE_MS)
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
  nativeRunControls()?.park()
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
 * Stop asks first, but only when there is something to lose. No room can
 * answer that yet, so the default is "there is" and the Keep alert is always
 * shown — the brief's stated fallback, not an oversight.
 */
export function requestEnd(): void {
  if (untrack(locked)) return
  const state = untrack(runState)
  if (state !== 'active' && state !== 'paused') return
  const controls = nativeRunControls()
  const unsaved = controls?.hasUnsavedTake?.() ?? true
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

createRoot(() => {
  createEffect(
    on(playbackState, (state, previous) => {
      if (state === 'playing') {
        if (previous === 'paused') resumeClock()
        else beginClock()
        setTakeOnScreen(false)
        setLocked(false)
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

      if (state === 'paused') {
        holdClock()
        setColumnOpen(false)
        return
      }

      // Stopped. Only a stop that ENDED something leaves a take on screen —
      // the app also rests at 'stopped' before anybody has pressed anything.
      holdClock()
      if (previous === 'playing' || previous === 'paused') {
        setTakeOnScreen(true)
      }
      setLocked(false)
      setColumnOpen(false)
      setKeepAlertOpen(false)
      announcedThisRun = false
      setAnnouncement('')
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
    }),
  )

  // A run that ends releases its owner. Held until here rather than cleared
  // with the take, so `ended` still renders in the room it happened in.
  createEffect(
    on(runState, (state) => {
      if (state === 'browsing') {
        setRunOwner(null)
        setRunLabel('')
      }
      if (state !== 'active' && state !== 'paused') clearIdleTimer()
    }),
  )
})

export { setVariant }
