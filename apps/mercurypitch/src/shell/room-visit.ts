// ============================================================
// Room visit: one iOS volume from a premium room's door to its way out
// ============================================================
//
// iOS keeps a stored volume for each kind of audio session, and WebKit
// moves a page between two of them by what the page does: playing only, it
// is a media session at the media level; the moment the mic opens it
// becomes play-and-record with VideoChat, at the call level, and back again
// when the mic closes (WebKit bug 236219). A premium room opens and closes
// the mic for every take, so the side buttons set one level during a take
// and another between takes, and a level left at zero in either one made
// the room fall silent with nobody touching the volume (owner, 17 Oct).
//
// So a room asks WebKit for play-and-record at the door, through the page's
// own API (page-audio-session.ts in packages/mobile-runtime), and gives the
// page its type back on the way out. WebKit's engineer suggests exactly
// this in that bug: "To make sure "play-and-record" is consistently being
// used, you can set navigator.audioSession.type" (Youenn Fablet, 1 Mar
// 2023). The switch now happens once, at the door, and the singer sets the
// level once. The app's own AVAudioSession is not touched (#923).
//
// What it costs, from the audit (REPORT option A): AirPods are hands-free
// for the whole visit, and the call level's voice processing applies to the
// demos too. The Developer screen's "One volume in rooms" switches it off
// to compare (room-volume-switch.ts); a store build always has it on. Where
// the page has no audio session (Android, the web) nothing is asked.
//
// ShellScreens mounts a RoomVisit with each premium room, before the room,
// so the session is asked for before the room's first sound, and given back
// after the room has torn down. Each step is handed to `onRoomVisit`
// listeners: a test build's audio census writes it into the audio record.

import { claimPageAudioSession, pageAudioSessionType, } from '@irchiinnuss/mobile-runtime/page-audio-session'
import { onCleanup } from 'solid-js'
import { oneVolumeInRooms } from './room-volume-switch'

/** A room entered or left, as the audio record words it. */
export interface RoomVisitStep {
  /** The room's screen: 'long-note', 'echo', 'lip-roll', 'ng-slides'. */
  readonly room: string
  readonly entering: boolean
  /** "One volume in rooms", as the visit found it at the door. */
  readonly oneVolume: boolean
  /** Whether the visit asks WebKit for play-and-record. */
  readonly asks: boolean
  /** On the way out: how long the visit lasted, in ms. */
  readonly ms?: number
}

export interface RoomVisitOptions {
  /** The switch; the Developer screen's when not given. */
  readonly oneVolume?: () => boolean
}

type Listener = (step: RoomVisitStep) => void

const listeners = new Set<Listener>()

function tell(step: RoomVisitStep): void {
  for (const listener of [...listeners]) {
    try {
      listener(step)
    } catch {
      // A record that broke must not keep a room from opening or closing.
    }
  }
}

/** Every room entered and left. Returns the unsubscribe. */
export function onRoomVisit(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/**
 * The visit to `room` begins: play-and-record is asked for where the switch
 * is on and the page has an audio session. Returns what ends it (safe to
 * call twice).
 */
export function beginRoomVisit(
  room: string,
  options: RoomVisitOptions = {},
): () => void {
  const oneVolume = (options.oneVolume ?? oneVolumeInRooms)()
  const asks = oneVolume && pageAudioSessionType() !== null
  const started = Date.now()
  tell({ room, entering: true, oneVolume, asks })
  const giveBack = asks
    ? claimPageAudioSession(`room ${room}`, 'play-and-record')
    : null
  let open = true
  return () => {
    if (!open) return
    open = false
    tell({ room, entering: false, oneVolume, asks, ms: Date.now() - started })
    giveBack?.()
  }
}

/** One premium room's visit, for as long as it is mounted. Draws nothing. */
export function RoomVisit(props: { room: string }): null {
  // eslint-disable-next-line solid/reactivity -- read once: keyed on the screen
  onCleanup(beginRoomVisit(props.room))
  return null
}
