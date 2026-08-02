# Sharing your own song with the room

Today a room can load a song only one device holds, and everybody else gets
the words, the target notes and the pitch lanes — but silence where the
backing track should be. This is the plan that closes that, and it is
deliberately **not** a second mechanism: it is Phase 5 of
[device-sync.md](device-sync.md), scoped to the case where both devices are
already awake and connected, because that is what a jam room *is*.

## What the room already does

Everything except the audio. `selectJamSong` broadcasts a manifest — stem
URLs, lyrics, target notes, the singer allocation — and every peer resolves
it. For a song with public URLs that is the whole feature. For one of your
own separations the URLs are `blob:` handles, meaningful only in the browser
that made them, so `songPlayableInRoom` refuses the song when anyone else is
in the room rather than handing them a silent screen.

The manifest is already the right shape. Notes and lyrics are kilobytes and
travel fine; only the audio does not.

## The thing that actually blocks it

**Stems are stored as WAV.** `uvr-service` reads duration straight off the
WAV header, and the blobs are the separator's raw output. A four-minute
song, both stems, is 100–400 MB.

That is not a transfer problem, it is a *format* problem. Sending it as-is
would take minutes on a good link and fail outright on a phone. So the first
piece of work is not the transport at all:

| 4-minute song, both stems | To one peer |
|---|---|
| WAV, as stored | 100–400 MB — minutes, or never |
| **AAC 128k** | **~7.6 MB — around 5 s** |

(128 kbps over 240 seconds is 3.8 MB a stem, so both stems together are
7.6 MB. Sending the guide vocal as well as the instrumental therefore costs
nothing over instrumental-only — an earlier draft of this file double-counted
and claimed 15 MB.)

**There is no encoder in the codebase yet.** `take-recorder` picks a
MediaRecorder MIME type and `guided-exercise-service` maps extensions to
MIME strings, but nothing transcodes. This has to be built, and it is the
bulk of the work here.

### The encode/playback bind

Checking WebCodecs *encode* support rather than playback support turns up
the awkward part, and it points the opposite way to the decision that was
already locked:

| | Chrome | Firefox | Safari | Linux desktop |
|---|---|---|---|---|
| Encode Opus | yes | yes | yes | **yes** |
| Encode AAC (`mp4a.40.2`) | yes | **no** | 26+ only | **no, in any browser** |
| Play AAC | yes | yes | yes | yes |
| Play Opus | yes | yes | patchy — CAF only before 18.4 | yes |

The codec that encodes everywhere plays worst on Safari; the codec that
plays everywhere cannot be encoded on Firefox or Linux. AAC encoding is
missing on desktop Linux in *every* browser, which is an OS-level codec
licensing matter and not something a library can argue with — so the
development machine is one of the platforms that cannot encode natively.

That rules out shipping bare WebCodecs, and rules out switching to Opus:
a jam room's second device is usually a phone, and a silent iPhone is a
worse failure than a slow encode.

Encoding runs on the **sending** side, so a phone only ever decodes — the
same rule device-sync sets, for the same reason.

## Decided

| # | Decision | Why |
|---|---|---|
| Codec | **AAC-in-MP4, 128 kbps** | Locked in device-sync D2. AAC over Opus because Safari's Opus support is patchier, and a room that only plays on Chrome is a bad trade for a smaller file. |
| Payload | **Instrumental + guide vocal** | Both stems are the 7.6 MB above, so this is free. The guide-vocal slider is how somebody learns a song they do not know, and the remote peer needs it most. |
| Relay peers | **Refuse, and say why** | Song audio never goes over TURN — it would eat the free 1,000 GB. A relay-only peer keeps lyrics, notes and lanes; they just cannot hear the backing track. |
| Fan-out | **Host to each peer, sequentially** | Predictable, and kind to a phone uplink. Five peers is five uploads; doing them one at a time with visible progress beats saturating the link and making everyone wait. |

Compression costs nothing musically, which is worth being explicit about
because it looks like a tradeoff and is not: pitch detection runs on each
singer's live microphone, never on the stem. The stem is a playback
reference, and where the vocal line is already extracted to notes the audio
does not enter scoring at all.

## Phases

### Phase 1 — Encode a stem (the real work)

**[mediabunny](https://mediabunny.dev/)** (MPL-2.0, zero dependencies,
tree-shakes to a few kB) for both the encode and the MP4 muxing. It is by
the author of `mp4-muxer`, which is now deprecated in its favour, and it
wraps WebCodecs rather than reimplementing it — so hardware encoding where
the platform has it.

For the platforms in the table above that do not, it ships
**`@mediabunny/aac-encoder`**, a wasm AAC encoder built for precisely this
gap. That turns Firefox and Linux from a blocker into a slower path behind
a dynamic import: the extra weight only loads where WebCodecs cannot do the
job.

Decode the stored WAV through an `AudioContext`, encode, mux to MP4. Faster
than real time, which is what rules out the MediaRecorder approach —
recording a four-minute song takes four minutes.

Cache the encoded bundle against the session, so sharing the same song to a
second room is instant.

Rejected alternatives: **ffmpeg.wasm** (~8.5 MB and roughly 8x slower than
WebCodecs, for one format we need), and **MP3** via `@mediabunny/mp3-encoder`
(software everywhere and universally playable, but ~50% larger for matching
quality and no upside over AAC once the AAC fallback exists).

### Phase 2 — Chunked transfer over the DataChannel

The channel already exists and already carries the manifest. Audio needs
what a manifest does not: backpressure (`bufferedAmountLowThreshold`, or a
phone's memory goes), resumability, an integrity check, and progress the
sender and receiver can both see.

Refuse before starting when the candidate pair is relayed — check once, up
front, rather than discovering it 12 MB in.

### Phase 3 — Receive, store, play

Reassemble to a Blob, store it against a synthetic session on the receiving
device, mint a `blob:` URL and rewrite that peer's copy of the manifest to
point at it. From there the room is a normal song room: the existing stage,
lanes, scoring and guide vocal all work unchanged.

### Phase 4 — Lift the refusal

`songPlayableInRoom` stops refusing a local song once transfer exists;
instead the room offers to send it. The refusal message this whole plan
exists to delete is in `jam-song.ts`.

## What this is not

Not a general file-sharing feature, and not a route for anything but the
user's own separations. Audio never touches our servers — that is a
copyright posture, not an optimisation, and it is why this is peer-to-peer
rather than an upload.

Not the Drive transport. device-sync argues Drive before P2P because two
devices are rarely awake together — a fair point for syncing your own
library, and moot here, since a jam room already requires exactly that.
