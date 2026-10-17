// ============================================================
// Page audio session: one owner for navigator.audioSession.type
// ============================================================
//
// WebKit lets a page name the audio session it wants (Safari 16.4,
// `navigator.audioSession.type`), and the page's word wins over WebKit's own
// choice (MediaSessionManagerCocoa::updateSessionState). Two parts of this
// app ask for one:
//
//   a premium room's visit     'play-and-record' from the door to the way
//                              out, so the mic opening and closing no longer
//                              moves WebKit between two of iOS's stored
//                              volumes (apps/mercurypitch room-visit.ts)
//   a play from behind the app 'playback' for the moment the Now Playing
//                              carrier starts (webkit-now-playing.ts)
//
// Written from two places, each putting back the type it found, the two
// could put back each other's word: a room left while Now Playing held
// 'playback' would write the page's own type under it, and Now Playing
// would then put back the room's 'play-and-record' after the room had gone.
// So each asks here instead. The type is always the newest standing claim's,
// and once none stands, the type the page had before the first of them. A
// claim let go out of order writes nothing while a newer one stands.
//
// Where the page has no audio session (Android's WebView, Chrome, Safari
// before 16.4) a claim answers null and nothing is written. Each change is
// handed to listeners, with who asked and what WebKit kept: a test build's
// audio census writes them into the audio record.
//
// The page API only. Nothing here touches the app's own AVAudioSession,
// which is never changed at runtime under WebKit's audio (#923).

/** The types WebKit's DOMAudioSession takes. */
export type PageAudioSessionType =
  | 'auto'
  | 'playback'
  | 'transient'
  | 'transient-solo'
  | 'ambient'
  | 'play-and-record'

/** One change to the page's type, as the record words it. */
export interface PageAudioSessionChange {
  /** Who asked, as they named themselves: 'room long-note', 'now playing'. */
  readonly who: string
  /**
   * 'set': a claim took the type. 'restore': letting go put the type before
   * it back. 'kept': letting go left a newer claim's type standing.
   * 'refused': WebKit threw on the write, and the claim was not made.
   */
  readonly action: 'set' | 'restore' | 'kept' | 'refused'
  readonly from: string
  readonly to: string
  /** What the page reads after the change: WebKit can keep its own word. */
  readonly reads: string
  /** The claims still standing, newest first. */
  readonly holders: readonly string[]
}

interface PageAudioSession {
  type: string
}

interface Claim {
  readonly who: string
  readonly type: PageAudioSessionType
}

type Listener = (change: PageAudioSessionChange) => void

let claims: Claim[] = []
/** The page's type before the first standing claim; null with none. */
let before: string | null = null
const listeners = new Set<Listener>()

/** WebKit's session for the page, where it has one. */
function pageSession(): PageAudioSession | null {
  const found =
    typeof navigator === 'undefined'
      ? undefined
      : (navigator as { audioSession?: PageAudioSession } | undefined)
          ?.audioSession
  return found !== undefined && typeof found.type === 'string' ? found : null
}

function tell(change: Omit<PageAudioSessionChange, 'holders'>): void {
  const holders = claims.map((claim) => claim.who).reverse()
  for (const listener of [...listeners]) {
    try {
      listener({ ...change, holders })
    } catch {
      // A record that broke must not stop the session changing.
    }
  }
}

/** Write `type` unless the page has it already. Throws what WebKit throws. */
function write(session: PageAudioSession, type: string): void {
  if (session.type !== type) session.type = type
}

function letGo(claim: Claim): void {
  const index = claims.indexOf(claim)
  if (index === -1) return
  const newest = index === claims.length - 1
  claims.splice(index, 1)
  const session = pageSession()
  if (session === null) {
    if (claims.length === 0) before = null
    return
  }
  const from = session.type
  if (!newest) {
    tell({ who: claim.who, action: 'kept', from, to: from, reads: from })
    return
  }
  const to = claims.at(-1)?.type ?? before ?? 'auto'
  if (claims.length === 0) before = null
  try {
    write(session, to)
  } catch {
    // Left as it is: WebKit drops a page's type when the page goes away.
  }
  tell({ who: claim.who, action: 'restore', from, to, reads: session.type })
}

/**
 * Ask WebKit for `type` for as long as the claim stands, and get back what
 * lets it go (safe to call twice). Null where the page has no audio session
 * or WebKit refused the write: nothing was asked, and nothing needs letting
 * go.
 */
export function claimPageAudioSession(
  who: string,
  type: PageAudioSessionType,
): (() => void) | null {
  const session = pageSession()
  if (session === null) return null
  const from = session.type
  try {
    write(session, type)
  } catch {
    tell({ who, action: 'refused', from, to: type, reads: session.type })
    return null
  }
  if (claims.length === 0) before = from
  const claim: Claim = { who, type }
  claims.push(claim)
  tell({ who, action: 'set', from, to: type, reads: session.type })
  let held = true
  return () => {
    if (!held) return
    held = false
    letGo(claim)
  }
}

/** The type the page reads now; null where it has no audio session. */
export function pageAudioSessionType(): string | null {
  return pageSession()?.type ?? null
}

/** Every change made here. Returns the unsubscribe. */
export function onPageAudioSessionChange(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** Tests only: forget every claim, and the page's type before them. */
export function resetPageAudioSessionForTests(): void {
  claims = []
  before = null
}
