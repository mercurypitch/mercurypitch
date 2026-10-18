// ============================================================
// Audio record: the scenario steps the census does not count
// ============================================================
//
// The owner tests the rooms' sound by walking through scenarios and sends
// the report when something odd happens (17 Oct: "add some good console
// logging so I can test different scenarios and send logs"). The census
// (audio-census.ts) records the page's contexts, mic tracks and the phone's
// output. This records the rest of what a scenario is made of, each step a
// line in the same record (src/lib/audio-diagnostics.ts) and on the console
// under `[audio]`:
//
//   room      a premium room entered and left, with "One volume in rooms"
//             and what the visit asked WebKit for (room-visit.ts), and the
//             type given back as the page went away and asked for again
//             as it came back (`release-hidden`, `reclaim-visible`)
//   session   every change to the page's session type, who asked, from
//             and to (page-audio-session.ts), and WebKit's word on the
//             session's state where it gives one
//   notice    the volume notice shown or gone, with the reading and the
//             cause that decided it (RoomVolumeHint.tsx)
//   demo      each turn of a room's demo, read off the room's `data-demo`,
//             and a first visit's wait before it starts (demo-kit
//             demo-auto.ts): `auto-waiting` with how long, `auto-held` when
//             the app or the page went first, `auto-starting` as it asks
//             for the clock
//   app       launch; the page going behind and coming back (`background`,
//             `foreground`); and iOS's own word on the app (`inactive`,
//             `active`). Control Center and the notification shade make
//             the app inactive and leave the page in front, so a pull over
//             a room shows in this line alone
//
// As a room opens, closes, goes away and comes back, as the app comes back
// or iOS calls it inactive or active, and as WebKit's session changes
// state, the phone's output is read now and once settled (the census's
// readOutputAround), since each is a moment WebKit may move the sound to
// another of iOS's stored volumes, or Control Center's slider may move it.
//
// CHEAP. Nothing runs while nothing happens. The rooms' output is polled
// (the census's watchRoomLevels) and a room's demo watched only while a
// premium room is open; the rest are events.
//
// Installed by the native entry alone, behind VITE_PORTABLE_CONSOLE and
// through a dynamic import (main.tsx), as the census is: a store build
// records none of it.

import type { PageAudioSessionChange } from '@irchiinnuss/mobile-runtime/page-audio-session'
import { onPageAudioSessionChange } from '@irchiinnuss/mobile-runtime/page-audio-session'
import type { AppLifecycleHandler } from '@irchiinnuss/mobile-runtime/platform'
import { onAppState } from '@irchiinnuss/mobile-runtime/platform'
import type { DemoAutoStep } from '@/components/demo-kit/demo-auto'
import { onDemoAuto } from '@/components/demo-kit/demo-auto'
import type { RoomOutputReading } from '@/components/room-kit/room-output'
import { audioReporter } from '@/lib/audio-diagnostics'
import { readOutputAround, watchRoomLevels } from './audio-census'
import type { RoomVisitStep } from './room-visit'
import { onRoomVisit } from './room-visit'
import type { RoomVolumeNotice } from './RoomVolumeHint'
import { onRoomVolumeNotice } from './RoomVolumeHint'

type Subscribe<T> = (listener: (value: T) => void) => () => void

export interface AudioRecordOptions {
  /** The window to record in; the page's own when not given. */
  readonly win?: Window
  /** The rooms' output levels (roomOutputReadings), read in a room. */
  readonly roomLevels?: () => readonly RoomOutputReading[]
  /** The volume notice's decisions; RoomVolumeHint's when not given. */
  readonly notices?: Subscribe<RoomVolumeNotice>
  /** iOS's word on the app, active or not; the platform's when not given. */
  readonly appState?: (handler: AppLifecycleHandler) => () => void
}

const appReport = audioReporter('app')
const roomReport = audioReporter('room')
const sessionReport = audioReporter('session')
const noticeReport = audioReporter('notice')
const demoReport = audioReporter('demo')

/** WebKit's session for the page, where it has one (Safari 16.4). */
interface PageSession extends EventTarget {
  readonly type?: unknown
  readonly state?: unknown
}

function pageSessionOf(win: Window): PageSession | null {
  const found = (win.navigator as { audioSession?: PageSession }).audioSession
  return found !== undefined && typeof found.addEventListener === 'function'
    ? found
    : null
}

function visitDetail(step: RoomVisitStep): Record<string, unknown> {
  if (step.moment === 'release-hidden' || step.moment === 'reclaim-visible') {
    return { room: step.room, on: step.on }
  }
  return {
    room: step.room,
    oneVolume: step.oneVolume ? 'on' : 'off',
    asks: step.asks ? 'play-and-record' : 'nothing',
    ...(step.ms === undefined
      ? {}
      : { after: `${(step.ms / 1000).toFixed(1)} s` }),
  }
}

/** How a step of the visit is named where the output is read around it. */
const VISIT_WORDS: Record<RoomVisitStep['moment'], string> = {
  enter: 'entered',
  'release-hidden': 'hidden',
  'reclaim-visible': 'shown',
  leave: 'left',
}

function sessionDetail(
  change: PageAudioSessionChange,
): Record<string, unknown> {
  return {
    who: change.who,
    from: change.from,
    to: change.to,
    ...(change.reads === change.to ? {} : { reads: change.reads }),
    holders: change.holders.length === 0 ? 'none' : change.holders.join(', '),
  }
}

/** The reading behind a notice, as the record words a volume. */
function noticeDetail(notice: RoomVolumeNotice): Record<string, unknown> {
  const { reading } = notice
  const d = reading.detail
  return {
    ...(notice.text === null ? {} : { text: `"${notice.text}"` }),
    cause: `"${notice.cause}"`,
    volume: reading.volume,
    known: reading.volumeKnown,
    route: reading.route,
    ...(typeof d.systemVolume === 'number'
      ? {
          system: d.systemVolume,
          live: d.systemVolumeLive === true,
          settled: d.systemVolumeSettled === true,
        }
      : {}),
    ...(typeof d.sessionVolume === 'number'
      ? { session: d.sessionVolume }
      : {}),
  }
}

/**
 * Each turn of the open room's demo: every premium room draws its demo's
 * mode on its root as `data-demo` ('idle', 'card', 'playing', 'end').
 * Returns the stop.
 */
function watchDemo(win: Window, room: string): () => void {
  if (typeof MutationObserver !== 'function') return () => undefined
  const observer = new MutationObserver((records) => {
    records.forEach((record, i) => {
      // Two turns can come in one batch: each record holds only the value
      // before it, so the value after it is the next one's before, and the
      // last one's is the attribute as it is now.
      const next = records.slice(i + 1).find((r) => r.target === record.target)
      const to =
        next === undefined
          ? (record.target as Element).getAttribute('data-demo')
          : next.oldValue
      if (to === null || to === record.oldValue) return
      demoReport(to, { room, from: record.oldValue ?? 'none' })
    })
  })
  observer.observe(win.document.body, {
    subtree: true,
    attributes: true,
    attributeFilter: ['data-demo'],
    attributeOldValue: true,
  })
  return () => observer.disconnect()
}

/** The open room's first-visit demo, before it starts. Returns the stop. */
function watchDemoWait(room: string): () => void {
  return onDemoAuto((step: DemoAutoStep) => {
    demoReport(
      `auto-${step.step}`,
      step.step === 'waiting'
        ? { room, in: `${(step.ms / 1000).toFixed(1)} s` }
        : { room },
    )
  })
}

/** Record the scenario steps from now on. Returns the stop. */
export function installAudioRecord(
  options: AudioRecordOptions = {},
): () => void {
  const win = options.win ?? window
  const doc = win.document
  const stops: (() => void)[] = []

  appReport('launch', { page: doc.visibilityState })
  const visibility = (): void => {
    const behind = doc.visibilityState === 'hidden'
    appReport(behind ? 'background' : 'foreground')
    if (!behind) readOutputAround('app foreground')
  }
  doc.addEventListener('visibilitychange', visibility)
  stops.push(() => doc.removeEventListener('visibilitychange', visibility))
  // Apart from the page's: iOS calls the app inactive under Control Center,
  // where the page never hides and a room keeps its type (room-visit.ts).
  stops.push(
    (options.appState ?? onAppState)((state) => {
      const word = state === 'active' ? 'active' : 'inactive'
      appReport(word)
      readOutputAround(`app ${word}`)
    }),
  )

  stops.push(
    onPageAudioSessionChange((change) =>
      sessionReport(
        change.action,
        sessionDetail(change),
        change.action === 'refused',
      ),
    ),
  )
  const pageSession = pageSessionOf(win)
  if (pageSession !== null) {
    const state = (): void => {
      sessionReport('state', {
        state: String(pageSession.state),
        type: String(pageSession.type),
      })
      readOutputAround(`session ${String(pageSession.state)}`)
    }
    pageSession.addEventListener('statechange', state)
    stops.push(() => pageSession.removeEventListener('statechange', state))
  }

  let leaving: (() => void)[] = []
  const leave = (): void => {
    for (const stop of leaving.splice(0)) stop()
  }
  stops.push(leave)
  stops.push(
    onRoomVisit((step) => {
      roomReport(step.moment, visitDetail(step))
      readOutputAround(`room ${step.room} ${VISIT_WORDS[step.moment]}`)
      // The page going and coming back leaves the room's watches running.
      if (step.moment !== 'enter' && step.moment !== 'leave') return
      leave()
      if (step.moment === 'leave') return
      leaving = [watchDemo(win, step.room), watchDemoWait(step.room)]
      if (options.roomLevels !== undefined) {
        leaving.push(watchRoomLevels(options.roomLevels))
      }
    }),
  )

  stops.push(
    (options.notices ?? onRoomVolumeNotice)((notice) =>
      noticeReport(
        notice.text === null ? 'hidden' : 'shown',
        noticeDetail(notice),
      ),
    ),
  )

  return () => {
    for (const stop of stops.splice(0)) stop()
  }
}
