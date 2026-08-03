# Stopping the room from screaming

Two devices in one room, both unmuted, and the jam turns into a howl. It
is not bad luck and it is not the network — the code currently has
nothing in it that could break the loop.

## Why it happens here

**Nothing is cancelling the echo, by design.**
`src/lib/jam/service.ts` asks for the mic with every processor switched
off:

```ts
const AUDIO_CONSTRAINTS = {
  echoCancellation: false,
  noiseSuppression: false,
  autoGainControl: false,
}
```

That is right for pitch analysis — AEC, noise suppression and AGC all
mangle the signal a detector needs — and wrong for a voice room, because
the same stream is *also* what goes to the peers. One capture is doing two
incompatible jobs.

**And the remote audio is invisible to the canceller anyway.**
`jam-store.ts` plays each peer through Web Audio:

```ts
const source = ctx.createMediaStreamSource(stream)
source.connect(ctx.destination)
```

Chrome's echo canceller only cancels audio coming from the *peer
connection*; audio rendered through Web Audio is not considered. Firefox
and Safari do consider all browser audio, which is why this may look
browser-specific in testing. So even switching `echoCancellation: true`
on today would not fix Chrome while the playback path stays as it is.

Speaker → other device's mic → back over the wire → speaker. Gain around
the loop exceeds one, and it screams.

## The shape of the fix

Four layers, cheapest and most effective first. The last one is the
clever bit and also the least important — a room that never howls does not
need a detector.

### 1. Two streams, not one

The professional answer, and it removes the conflict rather than trading
one job off against the other:

| stream | constraints | goes to |
|---|---|---|
| **transmit** | `echoCancellation: true`, `noiseSuppression: true`, `autoGainControl: true` | peers |
| **analysis** | everything off, as today | pitch detection only, never leaves the device |

Two `getUserMedia` calls on the same device. Costs a second capture; buys
a mic that is processed for humans and one that is honest for maths.

### 2. Let the canceller see what is playing

Play remote peers through `<audio srcObject>` rather than Web Audio, so
Chrome's AEC counts it. Web Audio is only needed if we want per-peer gain
— and if we do, an `<audio>` element has `.volume`, which covers it.

This one is nearly free and, on Chrome, is the difference between AEC
working and not.

### 3. Make the safe path the obvious one

- Ask for headphones the first time two people are in a room. One line,
  dismissible, remembered.
- A visible per-peer volume, and a room-wide "everyone quiet" control that
  is faster to reach than the browser's.
- Consider defaulting a second device in the *same room* to muted — two
  peers on the same LAN with correlated audio is a strong hint, though not
  proof.

### 4. Detect a howl and act

Only after the above, because a detector that fires often is a detector
nobody trusts.

Feedback has a signature that a sung note does not, which matters
enormously here — this is a **singing** app, and a held vowel is also a
loud sustained tone. The standard criteria, from the sound-reinforcement
literature:

| metric | what it says | why it separates singing from howling |
|---|---|---|
| **PAPR** peak-to-average power | howling is very loud relative to the rest | a belted note is too — weak on its own |
| **PNPR** peak-to-neighbouring power | howling is a near-zero-bandwidth sinusoid | a voice has vibrato and breath; the peak is wider |
| **PHPR** peak-to-harmonic power | howling has **no harmonic structure** | **the decisive one** — a sung vowel is all harmonics |
| **IPMP** inter-frame peak persistence | the same bin stays hot and grows | a phrase moves; feedback parks |

The rule of thumb from the literature is to require several criteria
together over consecutive frames, not any one of them. `PHPR` plus
`IPMP` is what stops it muting a singer holding a long note — which is,
after all, one of the app's own exercises.

**On detection**, escalate rather than jumping to the nuclear option:

1. Duck the remote output ~12 dB for a second and see if it dies.
2. If it returns, notch the offending bin (feedback parks on one).
3. If it survives both, mute the mic and say so plainly — *"We muted your
   mic: it was picking up the room's speakers. Headphones will fix it."*
   with a one-tap unmute.

Never silently. A mic that mutes itself with no explanation is worse than
a squeal, because the singer does not know why nobody can hear them.

## Order of work

1. **Play remote audio through `<audio>`** — smallest change, unblocks AEC
   on Chrome. **Done.**
2. **Split the streams** — transmit processed, analyse raw. **Done**, by
   cloning the track rather than capturing twice — see below.
3. **Headphone prompt and reachable volume** — the honest fix for two
   devices in one room.
4. **Howling detector** — with `PHPR`/`IPMP` so it does not mute singers,
   and the escalation above.

Steps 1 and 2 together should make this rare. 3 makes it avoidable. 4 is
for when somebody does it anyway.

### Step 1, and what it turned up

Each peer now gets a hidden `<audio srcObject>` instead of a Web Audio
node. Two things fell out of it beyond the AEC point:

- **Everyone with a camera on was playing twice.** The peer video chips
  render the whole `MediaStream`, microphone included, and only the local
  one was muted — so a peer who turned their camera on was audible through
  both their video chip and the Web Audio node. Twice the voice, and twice
  the gain around any feedback loop. Video elements are muted now; sound
  comes from one place.
- **A suspended `AudioContext` can no longer silence the room.** The old
  path needed a running context; an element does not.

### Step 2, as built

Turning `echoCancellation: true` on is not a one-line change, because the
same capture feeds pitch detection, and AEC/NS/AGC all mangle what a
detector needs. Two ways to split it, and they fail differently:

| approach | cost |
|---|---|
| a second `getUserMedia` | iOS Safari has historically stopped the *first* stream when a second capture starts — on the iPad this could take the mic out entirely |
| `track.clone()` + `applyConstraints` on the clone | one capture, no prompt; but per-clone processing is not honoured everywhere, and where it is not, pitch detection quietly degrades |

The clone won, because one of the test devices is an iPhone. Both of its
failure modes end with sending the raw track — today's behaviour, so a
refusal costs nothing — and both name themselves in the console:

- `would not cancel echo on a clone` — the device declined outright.
- `reconfigured the shared source` — the constraint reached the source
  instead of the clone, which would have handed the pitch detector
  processed audio. Detected by reading the raw track's settings back, and
  undone.

### What the first round of testing said

Measured on Android Chrome, an iPhone (Firefox skin, so WebKit) and a
tablet, before step 2 existed:

- Both unmuted in one room: feedback on any noise, building as the volume
  rises. Mute kills it instantly.
- A metre or two apart: very low, and it **rings out rather than
  exploding** — loop gain below one at that distance.
- Cameras on or off: no difference. The duplicate playback path is gone.
- Same on every device, which fits: nothing was cancelling anywhere.

### Still open

Step 3 (headphone prompt) and step 4 (the detector) are unbuilt. The
first-round numbers argue for doing 3 before 4 — a loop that rings out at
a metre is one that a pair of headphones, or simply not sharing a desk,
removes entirely. The detector is for a room that does it anyway, and it
is the expensive one to get right, because a sung vowel and a howl are
both loud sustained tones and only PHPR reliably tells them apart.

What to measure on the next run, with step 2 in:

- Does the console say cancellation is on, on each device?
- Does the same close-range test still build, or does it now settle?
- Is pitch detection unchanged? It should be untouched by construction —
  but the "reconfigured the shared source" line in the log is the one to
  look for if it is not.

## Worth testing before building

Nothing here is worth writing until the current behaviour is measured, and
a two-device rig is exactly what is set up:

- Does a howl start on Chrome only, or on Safari/Firefox too? That
  confirms or kills the Web Audio diagnosis.
- Does `echoCancellation: true` alone fix it while playback stays on Web
  Audio? The research says it will not, on Chrome. Cheap to check.
- How loud does the room have to be, and at what distance? If two devices
  a metre apart are fine and touching is not, the prompt matters more than
  the detector.

## Open questions

| # | Question |
|---|---|
| F1 | Is degraded pitch detection acceptable if we ever have to fall back to a single processed stream — say a device that refuses two captures? |
| F2 | Should a detected howl mute *the mic* or *the room's output*? Muting output keeps you audible to others; muting the mic keeps them audible to you. |
| F3 | Do we prompt for headphones on every multi-peer room, or only after a howl has actually been detected once? |

Sources: [Chrome's AEC ignores Web Audio playback](https://groups.google.com/g/discuss-webrtc/c/NQ0f8MwwegQ) ·
[Echo cancellation with Web Audio and Chromium](https://dev.to/focused_dot_io/echo-cancellation-with-web-audio-api-and-chromium-1f8m) ·
[Acoustic feedback control in sound reinforcement (KU Leuven)](https://ftp.esat.kuleuven.be/pub/stadius/vanwaterschoot/downloads/presentations/oldenburg_20110201.pdf) ·
[Temporal howling detector](https://israelcohen.com/wp-content/uploads/2022/11/acoustics-04-00060.pdf)
