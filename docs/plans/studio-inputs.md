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

| File                      | What it answers                                                                                                                                                                                                                                                                         | Moved from                                                                                                  |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `mic-roster.ts`           | Every connected input once, with Chromium's `default` and `communications` entries folded into flags, a kind guessed from the name (loopback, USB, Bluetooth...), which input a live track hears, and what changed between two lists. `isPseudoEntry` names the browser's role entries. | `src/features/mic-check/`                                                                                   |
| `device-watch.ts`         | The device list (`listDevices`, and `listAudioInputDevices` for the audio inputs alone), `devicechange` read once a burst settles or at every event, and what a track says it opened (`trackIdentity`).                                                                                 | `src/features/mic-check/`; Studio's own `devicechange` listener and Jam's own enumeration now go through it |
| `input-choices.ts`        | A picker's rows: "Default input" (null) first, each input by name or numbered until the browser names it, and a chosen input that is gone kept as "(not connected)".                                                                                                                    | Studio's `studio-inputs.ts`                                                                                 |
| `saved-input.ts`          | A remembered input found again: exact id, then the same name (never a loopback's), then nothing, so the caller takes the default. `isLoopbackLabel` spots PipeWire and PulseAudio monitors.                                                                                             | `src/lib/jam/jam-audio-source.ts`                                                                           |
| `input-channels.ts`       | One channel of a multichannel capture: `splitChannels` (open, send a channel to a node, take a channel alone as mono, close only its own edge), `captureChannelCount` (the track's count, else the source's, clamped at 32), `isAvailableChannel`, `loudestChannel`.                    | `src/lib/guitar/recording-capture.ts`, `src/lib/jam/jam-input-monitor.ts`                                   |
| `level-health.ts`         | How a block peak reads (clipping, hot, good, quiet, silent, noisy) against a noise floor that falls at once and rises over seconds.                                                                                                                                                     | `src/lib/guitar/input-events.ts`                                                                            |
| `fake-devices.fixture.ts` | A device list a test can plug into, and a capture track that fires `mute` and `ended`.                                                                                                                                                                                                  | `src/features/mic-check/fake-capture.fixture.ts`                                                            |

Where rooms deliberately differ, each keeps its behaviour. Studio's list leaves
the browser's role entries out ("Default input" stands for them) and numbers an
unnamed input "Input N"; Jam keeps Chrome's `default` entry as a row, names an
unnamed device "Device N" (Guitar Night calls channels "Input N") and puts a
loopback last, so Jam lists its inputs itself on top of the shared listing.
Studio reads the device list at every `devicechange`; the mic check and First
Light wait 250 ms for a burst to settle. The level hints still use Guitar
Night's words ("the guitar").

### The Studio today

- One input for every lane, chosen in the Sound panel and kept on the device
  under `mercurypitch.studio.recording` as `inputDeviceId` and `inputLabel`
  (`src/lib/studio/record/record-settings.ts`). An input that is gone is named
  "(not connected)", and takes record from the default meanwhile.
- One armed lane at a time (`src/lib/studio/record/studio-recorder.ts`). Arming
  opens the input through `MicManager.acquireFrom`, which holds one input of
  its own for one consumer at a time, by id only: a gone id opens the default.
- The recorder worklet folds its input to mono (`capture-node.ts`), so a take
  cannot have one input of an interface alone: a guitar on input 1 and a
  microphone on input 2 of a two-input interface record summed.
- Monitoring is the dry input at the lane's volume and pan, off unless asked
  for (`input-monitor.ts`).
- Each take is lined up by the round trip measured for its input
  (`micLatencyMsForDevice`, `micLatencyPathMsForDevice`), which the latency
  wizard measures (`src/features/mic-feedback/MicLatencyWizard.tsx`).
- The song validator rejects any field it does not know
  (`src/lib/studio/model/validation-values.ts`), so a song carrying a new lane
  field would not open in an older build.

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

### An input per lane

Each lane's choice is the device's, not the song's: a device id means nothing
on another machine, and a new song field would make older builds reject the
song. The choice is kept in device storage by song and lane, as an id, the
name it had and a channel, and found again with `resolveDeviceId` (id, then
name), because a Linux profile switch or cleared site data changes the id. A
lane with no choice records from the Studio's input as today, so a song opens
unchanged everywhere.

### One channel of an interface

Arming a lane on an interface channel opens the interface once and takes the
lane's channel alone: `splitChannels(context, source, count)`, `open()`, then
`alone(channel)` gives a mono node that feeds both the recorder worklet and the
lane's monitor in place of the whole source. `captureChannelCount` says how
many channels the capture has, and `isAvailableChannel` refuses one it does not
have before anything is built. A guitar is recorded raw, and its monitor stays
dry.

### The Inputs view

One place that lists the devices from the roster, and under each interface one
row per channel with a live meter (`loudestChannel` points at the live one) and
a clip light from `level-health.ts`. It says which lane uses which input, shows
MIDI activity, and shows each input's latency status, measured or not, with the
existing latency wizard one step away.

### Several lanes at once

Lanes on channels of one interface share one capture and one split, which any
browser can do. Lanes on different devices need a capture each, and WebKit
(Safari, and every browser on iOS) keeps one capture at a time: it mutes the
earlier one as another opens (`src/lib/mic-input-loss.ts`). There a second
device cannot record beside the first, and the Studio has to say so.
`MicManager.acquireFrom` holds one input per consumer today, so this PR
changes that hold. The recorder arms several lanes and records them on the one
song clock.

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
  dependencies, as `studio-recorder.test.ts` and `useStudioRecorder.test.ts`
  do now.
- In a browser, Chromium's fake capture (`--use-file-for-fake-audio-capture`,
  `src/e2e/helpers/tone-wav.ts`) gives one input playing a known tone, as
  `studio-record.spec.ts` uses it. It cannot be an interface with several
  channels or a second device, so those are unit-tested on fake lists and
  graphs and checked by the owner on real hardware: a guitar on one input of
  an interface and a microphone on another.
- Web MIDI is faked where access is asked for, as the existing adapters' tests
  do: a fake access handed to the adapter (`guitar-midi-input.test.ts`,
  `drum-input.test.ts`), or `navigator.requestMIDIAccess` stubbed
  (`web-midi-input-port.test.ts`).
