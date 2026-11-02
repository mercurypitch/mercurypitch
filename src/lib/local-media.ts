// ============================================================
// Local media — a media element that plays here, never on a TV
// ============================================================
//
// An element whose sound goes through Web Audio (a MediaElementAudioSource
// node) makes no sound of its own: its output is the graph's. If AirPlay
// takes the element as remote playback, the TV is asked to play it (a blob:
// URL it cannot fetch, or one stem without the rest of the song) and the
// graph goes silent, with no error anywhere. The silent unlock clip
// (audio-unlock.ts) is the same kind of thing: a tool for the page's audio
// session, never content for a TV, and the likeliest thing iOS offers a TV
// as the app opens (owner, 1 Nov 2026: "AirPlay ... pop up on opening the
// app").
//
// So each of them is kept local. WebKit asks two things before it lets an
// element play to AirPlay (MediaElementSession::wirelessVideoPlaybackDisabled):
// on iOS the legacy `x-webkit-airplay="deny"`, which it reads whatever its
// settings, and the Remote Playback API's `disableremoteplayback`, which it
// reads only while that API is on. The API is on by default and off in
// Lockdown Mode, which is why both are set. Chrome's cast button reads
// `disableRemotePlayback` as well.
//
// What this cannot do: keep the sound itself off the TV. AirPlay chosen as
// the phone's output in Control Center is a route, not an element, and Web
// Audio follows the route like every other sound (audio-route-store.ts says
// when it moves).
//
// It never throws. A test double or an odd embed that cannot take the
// attribute plays on as it was: keeping an element local is never worth not
// playing it.

/** WebKit's own AirPlay attribute (iOS). 'deny' keeps the element off. */
export const AIRPLAY_ATTRIBUTE = 'x-webkit-airplay'

/** Keep `element` off AirPlay and every other remote playback. Returns it. */
export function keepMediaLocal<T extends HTMLMediaElement>(element: T): T {
  try {
    element.disableRemotePlayback = true
    element.setAttribute(AIRPLAY_ATTRIBUTE, 'deny')
  } catch {
    // An element that cannot be told plays on as it was.
  }
  return element
}
