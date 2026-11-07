# Studio inputs — each lane records from its own input

Owner-approved plan, 7 November 2026. Six pull requests, each one a separate
owner decision to merge. The first two change no behaviour; the rest add what
a musician sees.

## Goal

A Studio lane records from the input that lane is played on: a microphone, one
channel of an audio interface (a guitar plugged straight in), or later a MIDI
keyboard or pad. The singer sees every input in one Inputs view and picks one
per lane. Today the Studio has one input for every lane, and an interface's
inputs arrive summed.

## What exists

### Shared input code: `src/lib/audio-input/`

PR 2 gathered the generic input code the rooms had grown separately into one
headless module, by moving it, not copying it. Every consumer imports from
there; nothing is re-exported from the old places.

| File                      | What it answers                                                                                                                                                                                                                                                                                                                                                                                                                          | Moved from                                                                                                  |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `mic-roster.ts`           | Every connected input once, with Chromium's `default` and `communications` entries folded into flags, a kind guessed from the name (loopback, USB, Bluetooth...), which input a live track hears, and what changed between two lists. `isPseudoEntry` names the browser's role entries.                                                                                                                                                  | `src/features/mic-check/`                                                                                   |
| `device-watch.ts`         | The device list (`listDevices`, and `listAudioInputDevices` for the audio inputs alone), `devicechange` read once a burst settles or at every event, and what a track says it opened (`trackIdentity`).                                                                                                                                                                                                                                  | `src/features/mic-check/`; Studio's own `devicechange` listener and Jam's own enumeration now go through it |
| `input-choices.ts`        | A picker's rows: the null row first ("Default input" in the Sound panel, "Studio's input (its name)" for a lane), each input by name or as "Device N" until the browser names it, and a chosen input that is gone kept as "(not connected)". `channelChoices` gives a channel picker's rows: "All inputs, mixed" (null) first, then "Input 1", "Input 2"..., and a chosen channel the input does not have kept as "(not on this input)". | Studio's `studio-inputs.ts`                                                                                 |
| `saved-input.ts`          | A remembered input found again: exact id, then the same name (never a loopback's), then nothing, so the caller takes the default. `isLoopbackLabel` spots PipeWire and PulseAudio monitors.                                                                                                                                                                                                                                              | `src/lib/jam/jam-audio-source.ts`                                                                           |
| `input-channels.ts`       | One channel of a multichannel capture: `splitChannels` (open, send a channel to a node, take a channel alone as mono, close only its own edge), `captureChannelCount` (the track's count, else the source's, clamped at 32), `isAvailableChannel`, `loudestChannel`.                                                                                                                                                                     | `src/lib/guitar/recording-capture.ts`, `src/lib/jam/jam-input-monitor.ts`                                   |
| `level-health.ts`         | How a block peak reads (clipping, hot, good, quiet, silent, noisy) against a noise floor that falls at once and rises over seconds.                                                                                                                                                                                                                                                                                                      | `src/lib/guitar/input-events.ts`                                                                            |
| `fake-devices.fixture.ts` | A device list a test can plug into, and a capture track that fires `mute` and `ended`.                                                                                                                                                                                                                                                                                                                                                   | `src/features/mic-check/fake-capture.fixture.ts`                                                            |

Where rooms deliberately differ, each keeps its behaviour. Studio's list leaves
the browser's role entries out ("Default input" stands for them); Jam keeps
Chrome's `default` entry as a row and puts a loopback last, so Jam lists its
inputs itself on top of the shared listing. Both name an unnamed device
"Device N": PR 3 changed Studio's from "Input N", which now names an
interface's channels, as Guitar Night calls them.
Studio reads the device list at every `devicechange`; the mic check and First
Light wait 250 ms for a burst to settle. The level hints still use Guitar
Night's words ("the guitar").

### The Studio today

- The Studio's input, chosen in the Sound panel and kept on the device under
  `mercurypitch.studio.recording` as `inputDeviceId` and `inputLabel`
  (`src/lib/studio/record/record-settings.ts`), is what a lane records from
  unless it has an input of its own (below). An input that is gone is named
  "(not connected)", and takes record from the default meanwhile.
- One armed lane at a time (`src/lib/studio/record/studio-recorder.ts`). Arming
  opens the lane's input through `MicManager.acquireFrom`, which holds one
  input of its own for one consumer at a time, by id only: a gone id opens the
  default. The input opens inside the press, before anything is awaited,
  because WebKit allows the microphone only there.
- The recorder worklet hears one channel (`capture-input.ts`). A lane on one
  channel of an interface gives it that channel alone. A lane on all of an
  input gives it the whole capture, which Web Audio folds by its speaker
  rules, and those mix only 2, 4 and 6 channels: stereo at half of each side,
  four channels at a quarter each, six as 5.1 (the front pair at √½, the
  centre whole, the surrounds at half, the fourth channel, its LFE, left out).
  Any other count (3, 5, 7, 8 or more) keeps Input 1 alone and drops the rest,
  so on such an interface "All inputs, mixed" records Input 1 only. This was
  so before PR 3, which pins it (`studio-lane-input.spec.ts`) and leaves it
  for the owner to decide.
- Monitoring is the dry input at the lane's volume and pan, off unless asked
  for (`input-monitor.ts`); a lane on one channel hears that channel alone,
  from the same node as its take.
- Each take is lined up by the round trip measured for its input
  (`micLatencyMsForDevice`, `micLatencyPathMsForDevice`), which the latency
  wizard measures (`src/features/mic-feedback/MicLatencyWizard.tsx`): the
  input its track names, else the one the arm asked for, the lane's own where
  it has one.
- The song validator rejects any field it does not know
  (`src/lib/studio/model/validation-values.ts`), so a song carrying a new lane
  field would not open in an older build.

### A lane's own input

PR 3 gave each lane an input of its own and one channel of it.

- **The choice** is `{ deviceId, label, channel }`
  (`src/lib/studio/record/lane-inputs.ts`). A null `deviceId` follows the
  Studio's input; a null `channel` takes all of the input, mixed; a channel is
  0-based and shown 1-based ("Input 2"). It is the device's, never the song's:
  kept under `mercurypitch.studio.lane-inputs` by song id and lane id, the 200
  chosen last, and a song opened again forgets its lanes that are gone. A
  lane with no choice records as every lane did before, and its header looks
  as it did.
- **Arming** (`planStudioLaneInput`, called by `useStudioRecorder`'s
  `acquireMic`) finds the lane's input with `resolveDeviceId` (id, then name)
  in the device list the Studio already holds, refreshed at every
  `devicechange` and after each arm. The plan said to read the list afresh
  with `listAudioInputDevices()`, but awaiting it would open the input outside
  the press, which WebKit refuses. Before the browser names its inputs, the
  kept id is opened as it is. The input opens through the existing
  `MicManager.acquireFrom`; there is no new `getUserMedia`.
- **The channel.** The recorder reads the capture's channel count from its
  track (`getSettings().channelCount`). For a lane on a channel the capture
  has, it splits the source (`openStudioLaneChannel` in `lane-channel.ts`:
  `splitChannels(context, source, count)`, `open()`, `alone(channel)`) and
  gives that mono node to both the recorder worklet and the lane's monitor:
  the guitar raw, the monitor dry. The split closes with the arm. Every
  capture the arm opens, including the fresh one after each take, listens on
  that node (`armed.lane.input`), never on the whole source.
- **Channel counts** are known only once an input has opened. The arm keeps
  the count by the input's id, with its name as the second key
  (`mercurypitch.studio.input-channels`, the 50 opened last), and the lane's
  picker offers channels once its input is known to have more than one. The
  picker does not open the input to count them: that would end the Studio's
  other hold on the microphone, and WebKit keeps one capture at a time. It
  says "Arm this lane once to see this input's channels." instead.
- **Fallbacks**, each said on the armed lane's card (`armedWords` in
  `StudioRecordNotices.tsx`):

  | What happened                                                  | What the lane records     | The card says                                                                          |
  | -------------------------------------------------------------- | ------------------------- | -------------------------------------------------------------------------------------- |
  | The lane's own input is not in the list                        | All of the Studio's input | "Armed on Lane 2 with the Studio's input: Scarlett 2i2 is not connected."              |
  | The input asked for was gone as it opened (the default opened) | All of the default        | "Armed on Lane 2 with the default input: Scarlett 2i2 is not connected."               |
  | Both                                                           | All of the default        | "Armed on Lane 2 with the default input: Scarlett 2i2 and Desk mic are not connected." |
  | The input has no such channel                                  | All of it, mixed          | "Armed on Lane 2. The input has no Input 3, so all of it records, mixed."              |

  A channel belongs to the input it was chosen on, so a lane that falls back
  to another input records all of that one. While a lane's own input is gone,
  its Track details say "Scarlett 2i2 is not connected. Takes on Lane 2 record
  from the Studio's input until it is back."

- **Where it is chosen.** Track details has an Input section
  (`src/features/studio/record/StudioLaneInputField.tsx`): the input, its
  first row "Studio's input (Desk mic)", and a Channel select ("All inputs,
  mixed", "Input 1", "Input 2"...) once the count is known and more than one.
  On a computer and a tablet, a lane with an input or a channel of its own
  shows a chip in its header ("In 2", or the input's first word), which opens
  Track details at the Input section; a phone shows none, and its lanes'
  inputs are in their details. A new input for the armed lane re-arms it. The
  arm moves to another lane with the input still open only when that lane's
  input and channel are the same; otherwise it reopens.

### Left where it is

Input code found while moving the code above, and not moved:

- Guitar Night lists inputs itself through `listAudioInputs` in
  `src/lib/mic-manager.ts`, as do Mirror, Glass, the voice session and the
  legacy `src/components/guitar/AudioDeviceSettings.tsx`, which also follows
  `devicechange` itself.
- Guitar Night's listening counts channels with
  `guitarInputAnalysisChannelCount` (it refuses more than 32, where the shared
  count clamps) and picks `strongestGuitarInputChannel`; its monitor
  (`src/features/guitar-night/guitar-input-monitor.ts`), its live chord tap
  (`src/lib/guitar/live-chord-capture.ts`) and its pitch analysers split
  channels with their own copies of the shared split.
- Two readings of "loopback": the roster's kind rules (Stereo Mix, BlackHole,
  Soundflower...) and `isLoopbackLabel` (PipeWire and PulseAudio monitors
  only). Making them one changes what Jam's list marks.
- Four Web MIDI adapters: `src/lib/midi-engine.ts`,
  `src/features/piano/input/web-midi-input-port.ts`,
  `src/features/drum-night/runtime/drum-input.ts` and
  `src/lib/guitar/guitar-midi-input.ts`.
- Two MicManagers: `src/lib/mic-manager.ts` and
  `packages/pitch-engine/src/mic-manager.ts`.
- The silence watcher, `src/lib/input-health.ts`, already shared: whether
  anything has come in at all since a take asked for input.

## How it will work

An input per lane, kept on the device, and one channel of an interface are
built (PR 3, "A lane's own input" above). What follows is still to come.

### The Inputs view

One place that lists the devices from the roster, and under each interface one
row per channel with a live meter (`loudestChannel` points at the live one) and
a clip light from `level-health.ts`. It says which lane uses which input, shows
MIDI activity, and shows each input's latency status, measured or not, with the
existing latency wizard one step away.

From PR 3: `channelChoices` gives a channel's rows and their names, and
`laneInputChannels` an input's count as an arm last found it. A count is known
only once the input has opened; the view opens nothing on its own while
another consumer holds the microphone. A meter per channel taps the same split
a take uses (`send(channel, node)`), not a second capture. Where "All inputs,
mixed" keeps Input 1 alone (3, 5, 7 or 8 or more channels, above), the view is
the place to say so, or the owner may want that row to sum every channel
evenly instead.

### Several lanes at once

Lanes on channels of one interface share one capture and one split, which any
browser can do. Lanes on different devices need a capture each, and WebKit
(Safari, and every browser on iOS) keeps one capture at a time: it mutes the
earlier one as another opens (`src/lib/mic-input-loss.ts`). There a second
device cannot record beside the first, and the Studio has to say so.
`MicManager.acquireFrom` holds one input per consumer today, so this PR
changes that hold. The recorder arms several lanes and records them on the one
song clock.

From PR 3: the recorder builds one split per arm and closes it with the arm.
Several lanes on one interface will share one capture and one split, each
lane taking its own mono node from it (`alone`) for its take and its monitor.
Every capture an arm reopens must listen on the lane's node, not the whole
source (`armed.lane.input` in `studio-recorder.ts`): while PR 3 was written, the
fresh capture after a take took the source and would have recorded every
channel, which `studio-recorder.channel.test.ts` now catches. Moving the arm
between lanes on different inputs already reopens the microphone, so with
several lanes armed the hold has to know which lanes share an input.

### MIDI lanes

Notes played on a keyboard or pads become audio in the lane's sound: drums on a
drum lane, the piano on a keyboard lane; other instruments wait for sound
banks. The lane keeps that audio as an ordinary take. The played notes are kept
too, in a plain shape (MIDI number, velocity, start and end on the song clock)
from which a future notes viewer can make the beats Compose's piano roll and
the stem mixer's note editor already edit. Where those notes are stored is
decided in that PR; it cannot be a song field older builds reject. Editable
MIDI clips are a much later feature.

## Pull requests

1. **Jam remembers its chosen input.** Done separately.
2. **One shared audio-input module**, built by moving the code listed above,
   with no behaviour change.
3. **An input per lane, kept on the device, and one interface channel** picked
   for a lane's capture and monitoring.
4. **The Inputs view**: devices, a row per channel with a meter and clip light,
   which lane uses what, MIDI activity, latency status with the latency wizard.
5. **Several lanes recording at once.**
6. **MIDI lanes kept as audio**, with the played notes kept beside them.

## Owner's decisions

- Record a guitar raw.
- An effects chain comes later. Monitoring through Guitar Night's amp comes
  with that effects stack; until then the monitor stays dry.
- MIDI in its simplest form first: notes become audio in the lane's sound
  (drums for a drum lane, piano for a keyboard), other instruments wait for
  sound banks, and the notes are kept in a plain shape for a later notes
  viewer. Editable MIDI clips are much later.
- A lane's input choice lives on the device, never in the song.
- Things are made reusable; code is not copied between rooms.

## Testing

- The shared module is tested beside it, without a browser: device lists and
  tracks from `fake-devices.fixture.ts`, splits on a fake graph that records how
  it was wired, the level reading and saved-input matching on plain values.
- The Studio recorder's lane-to-input wiring is tested with its injected
  dependencies: `studio-recorder.channel.test.ts` on a fake graph that can
  split (`studio-recorder.test-fixtures.ts`), and
  `useStudioRecorder.lane-input.test.ts` for the choice, its fallbacks and the
  re-arm. The store and the arm's plan are tested on plain values
  (`lane-inputs.test.ts`), the Input section and the header chip as
  components.
- In a browser, Chromium's fake capture (`--use-file-for-fake-audio-capture`,
  `src/e2e/helpers/tone-wav.ts`) gives one input playing a known file, as
  `studio-record.spec.ts` uses it. A stereo file comes through as a
  two-channel input while the browser's voice processing is off, as the
  Studio asks: measured in Chrome for Testing 153 (Nov 2026),
  `getSettings().channelCount` 2, deviceId `default`, and each side's tone
  alone on its channel. So `studio-lane-input.spec.ts` plays 440 Hz on the
  left and 660 Hz on the right, and records a lane on Input 2 (the right-hand
  tone at its full level, the left 275 dB down) and on all inputs (each at
  half). The spec checks the count first, so a browser that hands the file
  over folded fails there, not on the tones. CI's Playwright Chromium is an
  older build than the one measured; the same spec runs there.
- What the worklet keeps of a wider input is pinned on an
  `OfflineAudioContext`, with the Studio's own split and the worklet's own
  input settings: a chosen channel alone at 2, 3, 4, 5, 6 and 8 channels, and
  the speaker rules' fold of all of them.
- The fake capture cannot be more than two channels or a second device, so
  those are unit-tested on fake lists and graphs and checked by the owner on
  real hardware: a guitar on one input of an interface and a microphone on
  another.
- Web MIDI is faked where access is asked for, as the existing adapters' tests
  do: a fake access handed to the adapter (`guitar-midi-input.test.ts`,
  `drum-input.test.ts`), or `navigator.requestMIDIAccess` stubbed
  (`web-midi-input-port.test.ts`).
