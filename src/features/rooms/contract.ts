// The room contract.
//
// A room is a place you can be in: Sing, Guitar, Piano, Drums, Karaoke, Ear
// Lab. Today each one is effectively its own application — it owns history,
// creates its own AudioContext, draws its own top chrome and, on the night
// rooms, is reached by navigating the document. That works for a browser tab
// and cannot work inside an app, where a redirect is a white flash and a
// second AudioContext is a step toward the browser's context ceiling.
//
// This file is the seam that lets ONE room module be mounted by THREE hosts:
// a standalone indexable page, a tab inside the web shell, and a screen in
// the native app. The room stops owning the things that belong to a
// document, the host supplies them through RoomEnv, and nothing is copied.
//
// This module is a LEAF, and that is load-bearing rather than tidy. It must
// not import from `src/stores/**`, `src/App.tsx` or `src/index.tsx`, and it
// must not touch `window`. A room that reaches the shell's stores through
// this file would be hosted in name only: the standalone page and the native
// screen would drag the whole application graph in behind it.
//
// Two rules in section 4.3 of the implementation plan are what make hosting
// safe, and both are enforced by the shape below rather than by convention:
// load/create/activate are three separate steps, and there is exactly one
// AudioContext per document.

import type { Component } from 'solid-js'

/** Every place a singer can be. Not every one is hostable yet. */
export type RoomId =
  | 'sing'
  | 'guitar'
  | 'piano'
  | 'drums'
  | 'karaoke'
  | 'ear-lab'

/**
 * How much of its own furniture the room should draw.
 *
 * `own` — a standalone page: the room draws the brand mark, the account chip
 * and its own way back out, because nothing else on the document will.
 *
 * `hosted` — inside the shell or the native app: the host header and the tab
 * bar already carry identity and navigation, so a room that draws its own
 * gives the singer two back buttons and two brand marks.
 */
export type RoomChrome = 'own' | 'hosted'

/**
 * The one AudioContext for this document.
 *
 * Rooms never call `new AudioContext()`. The repository already names the
 * reason in its own words at `src/features/mercury-sing/mercury-sing-engine.ts`:
 * browsers cap live AudioContexts, and leaking a few failed decodes makes
 * `new AudioContext()` start throwing for the entire app. Today every room is
 * its own document so nobody has reached the ceiling; a WebView hosting three
 * rooms will.
 */
export interface AudioBroker {
  /**
   * The shared context, created and resumed if needed.
   *
   * MUST be reached from a user gesture, synchronously, before the first
   * `await` of whatever the tap started — on iOS WKWebView a context is handed
   * back suspended and only a gesture-scoped resume lifts it.
   */
  getContext(): AudioContext
  /** Whether a context exists yet, for hosts that want to avoid creating one. */
  readonly isReady: boolean
}

/**
 * A borrowed microphone.
 *
 * The underlying `micManager` is already a ref-counted singleton with a
 * linger, and it stays that way — this is a thin lease so the host can force
 * a release when a room is parked, without the room knowing it was parked.
 */
export interface MicLease {
  acquire(): Promise<MediaStream>
  release(): void
  readonly held: boolean
}

/** Moving between rooms, without the room knowing how the host does it. */
export interface RoomNav {
  /** Open another room. A hash write, a tab setter, or a document navigation. */
  go(room: RoomId): void
  /** Leave to wherever "out" is for this host: home, the rail, the shell. */
  exit(): void
}

/** One readable identity, whichever source the host happens to have. */
export interface AccountView {
  readonly signedIn: boolean
  readonly userId: string | null
  readonly displayName: string | null
}

/**
 * Where the room's own sub-state lives.
 *
 * Deliberately not `location.search`: the query string is document-global, so
 * a hosted room writing to it leaks its state into every other tab's URL.
 * The host decides between a hash path segment and memory.
 */
export interface RoomStateIO {
  read(key: string): string | null
  write(key: string, value: string | null): void
}

/** Everything a room needs from the outside. Supplied by the host, never imported. */
export interface RoomEnv {
  audio: AudioBroker
  mic: MicLease
  nav: RoomNav
  account: AccountView
  chrome: RoomChrome
  persist: RoomStateIO
}

/**
 * The room's lifecycle, owned by the host.
 *
 * `activate()` is the ONLY place a microphone lease may be taken or an
 * AudioContext resumed, and it is always reached from a user gesture.
 * `createSession()` must not do either — see the note on RoomModule.
 */
export interface RoomSession {
  /** First time on screen. Reached from a gesture path. */
  activate(): void | Promise<void>
  /** Off screen but still alive: stop sound, release the mic, keep state. */
  park(): void
  /** Back on screen after a park. */
  resume(): void
  /** Really gone. */
  dispose(): void
}

/** What a room's Stage is handed. Note what is absent: history, window, document. */
export interface RoomStageProps {
  session: RoomSession
  chrome: RoomChrome
}

/**
 * A room, as the hosts see it.
 *
 * `createSession(env)` builds signals and controllers. It MUST NOT call
 * `env.mic.acquire()` or `env.audio.getContext()` — a controller that
 * acquires in its constructor is an invisible regression whose symptom is a
 * microphone permission prompt on a screen the singer never opened, which is
 * the worst kind to meet during a store review. This is testable: give a fake
 * RoomEnv whose `mic.acquire` and `audio.getContext` throw, and assert that
 * `createSession` does not.
 */
export interface RoomModule<TStage extends RoomStageProps = RoomStageProps> {
  id: RoomId
  Stage: Component<TStage>
  createSession(env: RoomEnv): RoomSession
}
