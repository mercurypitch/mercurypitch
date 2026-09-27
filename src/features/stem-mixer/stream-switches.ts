// ============================================================
// Karaoke audio switches: the no-streaming path, on demand
// ============================================================
//
// Streaming a stem needs WebCodecs' AudioDecoder, which Safari has had only
// since 26.0 ("WebKit Features in Safari 26.0"; MDN browser-compat-data,
// api/AudioDecoder: Safari 26, with Safari on iOS and the iOS WebView
// mirroring it). A WKWebView on iOS 16 to 18 has none, so there every song
// takes the room's fallback. These two switches let a tester take that path
// on a phone that could stream (owner, 28 Sep):
//
//   Force the no-streaming path    the hosted room behaves as if
//                                  AudioDecoder were undefined:
//                                  canStreamStems() answers false.
//   Allow full decode past the     a song the guard would refuse is decoded
//   guard (a crash test)           whole, to learn whether this phone
//                                  survives it.
//
// Both persist on the phone. They are read only in a build with the portable
// console, and read inline (portable-console.ts says why): a store build
// folds both to off, whatever a TestFlight build before it left in storage.
// The signals are made on first read for the same reason: a module-level
// call is one a bundler has to keep, and the web and the store build must
// not carry a line of this. The Developer screen's Karaoke audio section is
// where they are flipped.

import type { Accessor, Setter } from 'solid-js'
import { createSignal } from 'solid-js'

export const FORCE_NO_STREAM_KEY = 'mp:dev-karaoke-force-no-stream'
export const DECODE_PAST_GUARD_KEY = 'mp:dev-karaoke-decode-past-guard'

function stored(key: string): boolean {
  try {
    return localStorage.getItem(key) === '1'
  } catch {
    return false
  }
}

function store(key: string, on: boolean): void {
  try {
    if (on) localStorage.setItem(key, '1')
    else localStorage.removeItem(key)
  } catch {
    // Storage refused: the switch holds for this session only.
  }
}

interface Switch {
  read: Accessor<boolean>
  write: Setter<boolean>
}

function made(key: string): Switch {
  const [read, write] = createSignal(stored(key))
  return { read, write }
}

let forceNoStream: Switch | undefined
let pastGuard: Switch | undefined

function forceSwitch(): Switch {
  forceNoStream ??= made(FORCE_NO_STREAM_KEY)
  return forceNoStream
}

function pastGuardSwitch(): Switch {
  pastGuard ??= made(DECODE_PAST_GUARD_KEY)
  return pastGuard
}

/** The hosted room is to behave as if this phone had no AudioDecoder. */
export function noStreamForced(): boolean {
  return (
    import.meta.env.VITE_PORTABLE_CONSOLE === 'true' && forceSwitch().read()
  )
}

/** A song too big to decode whole is decoded whole anyway: a crash test. */
export function decodePastGuard(): boolean {
  return (
    import.meta.env.VITE_PORTABLE_CONSOLE === 'true' && pastGuardSwitch().read()
  )
}

export function setNoStreamForced(on: boolean): void {
  store(FORCE_NO_STREAM_KEY, on)
  forceSwitch().write(on)
}

export function setDecodePastGuard(on: boolean): void {
  store(DECODE_PAST_GUARD_KEY, on)
  pastGuardSwitch().write(on)
}

/** Both switches as storage has them, for a test that changed storage. */
export function reloadStreamSwitchesForTests(): void {
  forceSwitch().write(stored(FORCE_NO_STREAM_KEY))
  pastGuardSwitch().write(stored(DECODE_PAST_GUARD_KEY))
}
