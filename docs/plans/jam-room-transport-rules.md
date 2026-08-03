# Who controls a jam room, and when

Written after a bug nobody could describe: the song stopped a few seconds
in, for everyone, with no explanation. The cause was not a race or a
network fault. It was that a room runs **two playback engines** — a drill
on a beat grid and a song on a seconds timeline — and they shared one pair
of transport signals with nothing on the wire to tell them apart.

A drill's beat timer, on finishing, did this:

```js
setJamExercisePlaying(false)                     // the song reads this too
jamService?.sendPlaybackCommand('stop', 0, bpm)  // no positionSec
```

Every peer applied that `stop` to whatever it happened to be running. So a
guest whose five-second scale ended killed the room's song — and because
the drill runs locally on every peer, the guest did not even have to be
the one in charge.

## The rules

Stated so they can be tested. Each has a test in
`src/tests/jam-song-store.test.ts`.

### Who drives

- **R1.** The host is the only device that broadcasts transport. Guests
  run their local playhead so it stays smooth, but never tell the room.
- **R2.** The host ignores transport addressed to it. It is the driver;
  obeying a peer would let the room fight over the playhead.
- **R3.** Only the host may load a song, assign parts, change mode or
  tempo, or send the audio.

### What a command refers to

- **R4.** Every transport command carries a `scope`: `drill` or `song`.
- **R5.** A device applies a command only when the scope matches what it
  is running. A `drill` stop never stops a song, and a `song` stop never
  stops a drill.
- **R6.** A command with no scope is treated as `drill` — that is all an
  older client could have meant.

### One thing at a time

- **R7.** A room runs a drill **or** a song, never both. Loading one
  clears the other, on every device.
- **R8.** A peer that has not been given the room's song does not pretend
  to play it. It follows the words, the target notes and everyone's pitch,
  and says plainly that it has no audio yet.

### Sending

- **R9.** Sending is explicit and host-only. Encoding costs CPU and the
  transfer costs somebody's data, so it happens when asked.
- **R10.** While a send is in flight the host may not start another, nor
  swap the song underneath it. Everything else — playing, scrubbing,
  assigning parts — stays available.
- **R11.** One peer failing never cancels the others. A dropped link is
  that person's problem.
- **R12.** A peer that cannot receive is told why. Silence is
  indistinguishable from a fault.
- **R13.** Every device reports whether it can actually play the loaded
  song, and the host can re-send to anyone who cannot.

### Stopping

- **R14.** Playback never stops without saying why. Reaching the end, a
  decode failure, a stall and a host command are four different things and
  the room is told which.

## Still open

These are judgement calls rather than mechanics, and are worth agreeing
before more is built on them.

| # | Question | Current behaviour |
|---|---|---|
| Q1 | Should the host be able to press play before every peer has the audio? | Yes — the others follow the words and notes. The alternative is one slow device holding up the room. |
| Q2 | Should swapping the song be blocked during a send, or should it cancel the send? | Blocked (R10). Cancelling silently loses work somebody waited for. |
| Q3 | When the host leaves and returns, should the room's song survive? | It does not today: the manifest is re-sent on rejoin, but a peer that never had the audio still needs a re-send. |
| Q4 | Should a guest be able to request the song rather than wait to be sent it? | Not today. The host sees who is missing it and can re-send. |
