# Studio inputs — each lane records from its own input

Owner-approved plan, 7 November 2026, with the channel model added on
8 November. Seven pull requests, each one a separate owner decision to merge.
The first two change no behaviour; the rest add what a musician sees.

## Goal

A Studio lane records from the input that lane is played on: a microphone, one
input of an audio interface (a guitar plugged straight in), a pair of them, or
later a MIDI keyboard or pad. The singer sees every input in one Inputs view
and picks one per lane. Before this plan the Studio had one input for every
lane, and an interface's inputs arrived summed.

## What exists

### Shared input code: `src/lib/audio-input/`

PR 2 gathered the generic input code the rooms had grown separately into one
headless module, by moving it, not copying it. Every consumer imports from
there; nothing is re-exported from the old places.

| File                      | What it answers                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Moved from                                                                                                  |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `mic-roster.ts`           | Every connected input once, with Chromium's `default` and `communications` entries folded into flags, a kind guessed from the name (loopback, USB, Bluetooth...), which input a live track hears, and what changed between two lists. `isPseudoEntry` names the browser's role entries.                                                                                                                                                                                                                                                                                           | `src/features/mic-check/`                                                                                   |
| `device-watch.ts`         | The device list (`listDevices`, and `listAudioInputDevices` for the audio inputs alone), `devicechange` read once a burst settles or at every event, and what a track says it opened (`trackIdentity`).                                                                                                                                                                                                                                                                                                                                                                           | `src/features/mic-check/`; Studio's own `devicechange` listener and Jam's own enumeration now go through it |
| `input-choices.ts`        | A picker's rows: the null row first ("Default input" in the Sound panel, "Studio's input (its name)" for a lane), each input by name or as "Device N" until the browser names it, and a chosen input that is gone kept as "(not connected)". `channelChoices` gives a channel picker's rows as a DAW's record input lists them: the default (null) first, named for what it takes once the count is known ("Default: Inputs 1 + 2"), then each input ("Input 1"...), each aligned pair ("Inputs 1 + 2"...), and a kept one the input does not have, marked "(not on this input)". | Studio's `studio-inputs.ts`                                                                                 |
| `saved-input.ts`          | A remembered input found again: exact id, then the same name (never a loopback's), then nothing, so the caller takes the default. `isLoopbackLabel` spots PipeWire and PulseAudio monitors.                                                                                                                                                                                                                                                                                                                                                                                       | `src/lib/jam/jam-audio-source.ts`                                                                           |
| `input-channels.ts`       | One channel of a multichannel capture, or an aligned pair of them: `splitChannels` (open, send a channel to a node, take a channel alone as mono, take a pair as one mono node at half each (`pair`, `take`), close only its own edge), `ChannelPick` and `defaultChannelPick` (PR 4), `isAvailablePick`, `channelPicks`, `captureChannelCount` (the track's count, else the source's, clamped at 32), `isAvailableChannel`, `loudestChannel`.                                                                                                                                    | `src/lib/guitar/recording-capture.ts`, `src/lib/jam/jam-input-monitor.ts`                                   |
| `level-health.ts`         | How a block peak reads (clipping, hot, good, quiet, silent, noisy) against a noise floor that falls at once and rises over seconds.                                                                                                                                                                                                                                                                                                                                                                                                                                               | `src/lib/guitar/input-events.ts`                                                                            |
| `fake-devices.fixture.ts` | A device list a test can plug into, and a capture track that fires `mute` and `ended`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | `src/features/mic-check/fake-capture.fixture.ts`                                                            |

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
- The recorder worklet hears one channel (`capture-input.ts`), and the Studio
  chooses it (`lane-channel.ts`): one input of the capture, or an aligned pair
  summed at half each, as a DAW's record input does. Nothing mixes every
  channel. A lane with no choice takes the default its input's channel count
  makes (below). Before PR 4 that default was Web Audio's speaker fold, which
  mixes only 2, 4 and 6 channels (stereo at half each side, four channels at
  a quarter each, six as 5.1: the front pair at √½, the centre whole, the
  surrounds at half, the fourth channel, its LFE, left out) and keeps input 1
  alone of any other count. So the default changed for four- and six-channel
  inputs only, which now record input 1. Where the browser does not say how
  many channels it opened, the input still reaches the worklet as it is, and
  the fold applies there.
- Monitoring is the dry input at the lane's volume and pan, off unless asked
  for (`input-monitor.ts`); a lane hears what it records, from the same node
  as its take.
- Each take is lined up by the round trip measured for its input
  (`micLatencyMsForDevice`, `micLatencyPathMsForDevice`), which the latency
  wizard measures (`src/features/mic-feedback/MicLatencyWizard.tsx`): the
  input its track names, else the one the arm asked for, the lane's own where
  it has one. Since PR 5 the wizard measures the input its host names
  (`deviceId`; null for the system default) and keeps the result under the
  id the opened track names, `default` for the system default, which is the
  key a lane that follows the default is lined up by. The Inputs view opens
  it per input.
- The song validator rejects any field it does not know
  (`src/lib/studio/model/validation-values.ts`), so a song carrying a new lane
  field would not open in an older build.

### A lane's own input and channels

PR 3 gave each lane an input of its own and one channel of it. PR 4 made its
channels a DAW's: one input, or an aligned pair mixed to mono, and a default
that says what it takes.

- **The choice** is `{ deviceId, label, channel, pair }`
  (`src/lib/studio/record/lane-inputs.ts`). A null `deviceId` follows the
  Studio's input. A null `channel` takes the default the input's count
  makes; a channel is 0-based and shown 1-based ("Input 2"); with `pair`, the
  channel and the next are mixed to mono at half each ("Inputs 1 + 2"), the
  channel even. A row kept before pairs reads as one input, and a pair that
  is not aligned reads as the default. The choice is the device's, never the
  song's: kept under `mercurypitch.studio.lane-inputs` by song id and lane
  id, the 200 chosen last, and a song opened again forgets its lanes that are
  gone. A lane with no choice records as every lane did before, and its
  header looks as it did.
- **Arming** (`planStudioLaneInput`, called by `useStudioRecorder`'s
  `acquireMic`) finds the lane's input with `resolveDeviceId` (id, then name)
  in the device list the Studio already holds, refreshed at every
  `devicechange` and after each arm. The plan said to read the list afresh
  with `listAudioInputDevices()`, but awaiting it would open the input outside
  the press, which WebKit refuses. Before the browser names its inputs, the
  kept id is opened as it is. The input opens through the existing
  `MicManager.acquireFrom`; there is no new `getUserMedia`.
- **The channels.** The recorder reads the capture's channel count from its
  track (`getSettings().channelCount`) and takes the lane's pick where the
  capture has it, else the default (`studioLaneRoute` and
  `openStudioLaneChannel` in `lane-channel.ts`): the shared `splitChannels`,
  `open()`, then `take(pick)`, which is `alone(channel)` for
  one input and `pair(channel)` for two at half each. That one mono node
  feeds both the recorder worklet and the lane's monitor: the guitar raw,
  the monitor dry. The split closes with the arm. Every capture the arm
  opens, including the fresh one after each take, listens on that node
  (`armed.lane.input`), never on the whole source. One channel goes as it
  is, with nothing split.
- **The default**, from the count the capture reports at the arm
  (`defaultChannelPick`):

  | Channels     | A lane with no choice records                                 |
  | ------------ | ------------------------------------------------------------- |
  | 1            | Input 1, as it is                                             |
  | 2            | Inputs 1 + 2, at half each: what the speaker fold gave before |
  | 3 or more    | Input 1: the fold gave this for 3, 5, 7 and 8 or more before  |
  | Not reported | The input as it is, folded by the worklet's input as before   |

  Four channels were mixed at a quarter each before, and six as 5.1; both
  now record input 1, as a DAW's default input would.

- **Channel counts** are known only once an input has opened. The arm keeps
  the count by the input's id, with its name as the second key
  (`mercurypitch.studio.input-channels`, the 50 opened last), and the lane's
  picker offers channels once its input is known to have more than one. The
  picker does not open the input to count them: that would end the Studio's
  other hold on the microphone, and WebKit keeps one capture at a time. It
  says "Arm this lane once, or check its input in Inputs, to see this
  input's channels." instead. A check in the Inputs view (below) opens an
  input while nothing is armed and keeps its count the same way.
- **What records, and the fallbacks**, each said on the armed lane's card
  (`armedWords` in `StudioRecordNotices.tsx`). On an input of more than one
  channel the card says what records: "Armed on Lane 2 with Input 2 of
  Scarlett 2i2. Press Record to start.", or "with Inputs 1 + 2 of Scarlett
  2i2, mixed."

  | What happened                                                  | What the lane records        | The card says                                                                                    |
  | -------------------------------------------------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------ |
  | The lane's own input is not in the list                        | The Studio's input's default | "Armed on Lane 2 with the Studio's input: Scarlett 2i2 is not connected."                        |
  | The input asked for was gone as it opened (the default opened) | The default's default        | "Armed on Lane 2 with the default input: Scarlett 2i2 is not connected."                         |
  | Both                                                           | The default's default        | "Armed on Lane 2 with the default input: Scarlett 2i2 and Desk mic are not connected."           |
  | The input has no such input                                    | Its default                  | "Armed on Lane 2. Scarlett 2i2 has no Input 3, so Inputs 1 + 2 record, mixed."                   |
  | The input has no such pair                                     | Its default                  | "Armed on Lane 2. Desk mic has no Inputs 1 + 2, so Input 1 records."                             |
  | The browser does not say how many channels it opened           | The input as it is           | "Armed on Lane 2. The browser does not say which inputs Scarlett 2i2 has, so all of it records." |

  A channel belongs to the input it was chosen on, so a lane that falls back
  to another input takes that one's default. While a lane's own input is gone,
  its Track details say "Scarlett 2i2 is not connected. Takes on Lane 2 record
  from the Studio's input until it is back."

- **Where it is chosen.** Track details has an Input section
  (`src/features/studio/record/StudioLaneInputField.tsx`): the input, its
  first row "Studio's input (Desk mic)", and a Channel select once the count
  is known and more than one: "Default: Inputs 1 + 2" (or "Default: Input 1",
  and plain "Default" before the count is known), "Input 1", "Input 2"...,
  then "Inputs 1 + 2"... for the pairs the input has. On a computer and a
  tablet, a lane with an input or channels of its own shows a chip in its
  header ("In 2", "In 1+2", or the input's first word), which opens Track
  details at the Input section; a phone shows none, and its lanes' inputs are
  in their details. A new input or pick for the armed lane re-arms it. The
  arm moves to another lane with the input still open only when that lane's
  input and channels are the same; otherwise it reopens. Track details links
  to the Inputs view ("See every input, its channels and levels"), where
  every lane has the same field.

### Why a DAW's channels (PR 4)

PR 3 offered "All inputs, mixed" beside each input, and its browser test found
that Web Audio's fold, which made that mix, mixes only stereo, quad and 5.1
and keeps input 1 of any other count. On 8 November 2026 the owner asked for
robust input handling, as Reaper or a similar DAW does it. What DAWs do:

- **Reaper.** The record input menu lists "Input: Mono > Input 1..N" and
  "Input: Stereo > pairs". A track records exactly the input chosen, and its
  button reads "Record input: Input 1".
- **Ableton Live.** "Ext. In" offers mono channels "1", "2" and stereo pairs
  "1/2", "3/4". A known pitfall: a single microphone on a stereo pair lands on
  one side only, and the fix is the mono input.
- **No DAW offers "all inputs mixed".**

A Studio take is mono, so a lane takes one input, or an aligned pair mixed to
mono at half each, and the routing is the Studio's own (`splitChannels` and
its `pair`), never Web Audio's fold. The default is what a DAW user expects of
each count, and what the Studio already did for 1, 2, 3, 5, 7 and 8 or more
channels.

### The Inputs view (PR 5)

The Studio's I/O view: every audio input, what is on each of its channels,
and which lane records what, in one panel. It opens from "Inputs and
channels" in the Sound panel's Recording section and from "See every input,
its channels and levels" in a lane's Track details: a side panel on a
computer, a sheet on a phone, like Sound and Mix (`'inputs'` in
`studio-panels.ts`). It has no top-bar button, since `studio-top-bar.spec.ts`
measures where the bar folds. The top bar moved out of `StudioWorkspace.tsx`
into `StudioTopBar.tsx` first, so the workspace stays under 800 lines.

| File                                                                      | What it does                                                                                                                          |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `src/features/studio/inputs/inputs-view-model.ts`                         | The view's content from plain values: each input, its kind, channels, round trip, warning, lanes and rows. Tested without a browser.  |
| `src/features/studio/inputs/input-check.ts`                               | Opening one input to check it, and letting it go: the hold rules below, with its dependencies injected.                               |
| `src/features/studio/inputs/useStudioInputs.ts`                           | Which input is metered and how, its meters, its check and the latency check.                                                          |
| `src/features/studio/inputs/StudioInputsPanel.tsx`, `StudioInputCard.tsx` | The panel: the permission step, a card per audio input, then the lanes.                                                               |
| `src/lib/audio-input/channel-meters.ts`                                   | A peak and a level reading per input and aligned pair of a capture, on a tap: a split's `send` and `unsend`, or the capture as it is. |
| `src/lib/audio-input/input-kinds.ts`, `src/components/input-kind-icon.ts` | A kind's tag ("USB", "Bluetooth"...) and icon, moved out of the mic check so the mic check, First Light and the Studio share them.    |

- **Each input** is a card: its name, its kind as an icon and a tag, "System
  default", its channel count ("Not known until it is opened" before an arm
  or a check has opened it), its round trip ("12 ms round trip", or "Not
  measured", with "Measure latency" opening the latency wizard for that
  input in the card), the lanes that record from it, and what to know:
  Bluetooth adds delay and drops to call quality while its microphone is
  open; a loopback records what the computer plays; a virtual input passes on
  only what its app sends. The list follows the roster, so it changes as
  inputs are plugged in and out.
- **Its rows**, once the count is known: the default, named for what it
  takes ("Default: Inputs 1 + 2"), each input and each aligned pair
  (`channelChoices`), each with the lanes that record it. A lane's pick that
  the input does not have lands on the default row, as the take would.
  While the input is open each row has a meter, a peak bar from -60 dB to
  full scale and a word for clipping, hot, quiet or silent
  (`describeInputHealth`, with a noise floor per row), and the card says
  "Signal on Input 2" (`loudestChannel`). A row for a pair reads the pair as
  a take hears it, both at half. "Noisy" is not shown: a steady tone reads
  noisy once the floor has risen to it.
- **The lanes**, below the inputs: every lane with the same input and
  channel field as its Track details (`StudioLaneInputField`), so a choice
  there is the lane's own and re-arms an armed lane.
- **Before the browser names its inputs**, the view offers one thing to do,
  "Allow the microphone to see your inputs". It opens the default through
  `MicManager.acquireFrom`, lets it go at once, and lists the inputs again.
  It never lists "Device N".

**One hold and one capture.** `MicManager.acquireFrom` holds one input of
its own at a time, and a later one ends the earlier; WebKit keeps one
capture at a time. The view meters one input, two ways, and never opens a
capture beside a take:

- While a lane holds the microphone (armed, counting in, recording or
  keeping a take), it meters the input that arm opened, on the arm's own
  split: `StudioRecorder.inputTap()` gives the split's `send` and `unsend`
  (`studioInputTap` in `lane-channel.ts`), or the capture as it is when
  nothing is split. The card is found by the track the arm opened
  (`trackIdentity`, `listeningInput`). A re-arm passes through idle, so the
  meters follow the new split.
- Otherwise a card's Check opens that input through
  `MicManager.acquireFrom('studio-inputs', id)`, with no `getUserMedia` of
  its own, and meters it until Inputs closes, Stop checking is pressed, or a
  lane arms. Check is off while a lane is armed, since its hold would end the
  arm's. An arm ends a check: the arm's `acquireFrom` takes the hold over,
  which `subscribe` reports, and the check also lets go as the recorder
  leaves idle. The microphone indicator shows while a check holds the input
  (`registerMicIndicator`). A check keeps the count it finds
  (`rememberInputChannels`), so the input's rows and the lanes' channel
  pickers show without an arm.
- The latency wizard opens its input as a hold of its own, so Measure
  latency is off while a lane is armed, a check lets go before it opens, and
  an arm closes it.
- The meters read every 50 ms on a timer, not on animation frames: the
  Studio asks for no frames while a lane is armed (`studio-perf.spec.ts`).

**What it cannot show.**

- An input's channels before it has opened: the browser says how many
  only once a capture opens, so an input not yet armed or checked has no
  rows.
- The channels of an input whose browser does not report
  `getSettings().channelCount`. A take records such an input as it is, so
  the view meters it whole, on one row, "Whole input", and says the count is
  "Not reported by this browser".
- Two inputs at once, or any input but the armed one while a lane is armed:
  one hold, one capture.
- MIDI inputs, which come with MIDI lanes (PR 7). The view's sections are
  the audio inputs, then the lanes, and a MIDI section can sit beside the
  audio inputs.

A panel the Studio opens in place of another (Inputs from deep in the Sound
panel) now starts at its top, and focus lost with the button that opened it
comes to the panel (`StudioPanel.tsx`).

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

An input per lane, kept on the device, one input or an aligned pair of an
interface's, and the Inputs view are built (PR 3 to PR 5, above). What
follows is still to come.

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
lane taking its own mono node from it (`take`: an input or a pair) for its
take and its monitor.
Every capture an arm reopens must listen on the lane's node, not the whole
source (`armed.lane.input` in `studio-recorder.ts`): while PR 3 was written, the
fresh capture after a take took the source and would have recorded every
channel, which `studio-recorder.channel.test.ts` now catches. Moving the arm
between lanes on different inputs already reopens the microphone, so with
several lanes armed the hold has to know which lanes share an input.

From PR 5, the Inputs view assumes one arm:

- `StudioRecorder.inputTap()` gives the one armed capture's tap, and
  `useStudioInputs` meters the one input it finds by that capture's track.
  With several captures, it wants a tap per capture, and the view a metered
  input per tap; the cards are already keyed by the roster's id.
- A check is offered only while nothing is armed, and stays so: a check's
  hold beside several arms' would end one of them.
- The phases in which the arm's split is live are `HOLDING` in
  `useStudioInputs.ts`. The view reads the tap once as a lane starts to hold
  the microphone, and again only after the recorder has left those phases,
  as a re-arm does through idle and arming. A recorder that swaps a capture
  while staying armed has to make the view read the tap again.
- A tap's `unsend` takes off only the view's own edges, so meters come and
  go beside a take without touching what it records.

### MIDI lanes

Notes played on a keyboard or pads become audio in the lane's sound: drums on a
drum lane, the piano on a keyboard lane; other instruments wait for sound
banks. The lane keeps that audio as an ordinary take. The played notes are kept
too, in a plain shape (MIDI number, velocity, start and end on the song clock)
from which a future notes viewer can make the beats Compose's piano roll and
the stem mixer's note editor already edit. Where those notes are stored is
decided in that PR; it cannot be a song field older builds reject. Editable
MIDI clips are a much later feature. MIDI inputs, with their activity, get a
section of their own in the Inputs view, beside the audio inputs.

## Pull requests

1. **Jam remembers its chosen input.** Done separately.
2. **One shared audio-input module**, built by moving the code listed above,
   with no behaviour change.
3. **An input per lane, kept on the device, and one interface channel** picked
   for a lane's capture and monitoring.
4. **A DAW's channels**: one input or an aligned pair mixed to mono per lane,
   the Studio's own routing in place of Web Audio's fold, and a default that
   says what it takes.
5. **The Inputs view**: every audio input with its kind, channels, round trip
   and what to know about it, a row per input and aligned pair with a live
   meter and level words, which lane records what, each lane's input, and the
   latency wizard per input. MIDI activity moved to PR 7.
6. **Several lanes recording at once.**
7. **MIDI lanes kept as audio**, with the played notes kept beside them, and
   MIDI inputs in the Inputs view.

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
  (`lane-inputs.test.ts`, old rows included), the default table from 1 to 8
  channels twice over (`input-channels.test.ts`, `lane-channel.test.ts`),
  and the Input section, the header chip and the armed card's words as
  components.
- In a browser, Chromium's fake capture (`--use-file-for-fake-audio-capture`,
  `src/e2e/helpers/tone-wav.ts`) gives one input playing a known file, as
  `studio-record.spec.ts` uses it. A stereo file comes through as a
  two-channel input while the browser's voice processing is off, as the
  Studio asks: measured in Chrome for Testing 153 (Nov 2026),
  `getSettings().channelCount` 2, deviceId `default`, and each side's tone
  alone on its channel. So `studio-lane-input.spec.ts` plays 440 Hz on the
  left and 660 Hz on the right, and records a lane on Input 2 (the right-hand
  tone at its full level, the left 275 dB down), on Inputs 1 + 2 and on the
  default (each at half), with the armed card's words. The spec checks the
  count first, so a browser that hands the file over folded fails there, not
  on the tones. It passes on CI's Playwright Chromium too.
- What a take hears of a wider input is pinned on an `OfflineAudioContext`,
  with the Studio's own split, default and worklet input settings: at 1 to 8
  channels, each input alone, each aligned pair at half each, and the
  default each count makes.
- The Inputs view (PR 5) is tested in layers. Its content is tested on plain
  values (`inputs-view-model.test.ts`: the rows, where each lane lands, the
  counts by id, name and `default`, the warnings). The hold rules are tested
  with injected dependencies (`input-check.test.ts`: off while armed, an arm
  ending a check, a check made stale by an arm while it opens, the
  indicator). The meters run on a fake graph (`channel-meters.test.ts`), and
  the arm's tap on the recorder's own (`lane-channel.test.ts`,
  `studio-recorder.channel.test.ts`). The panel is tested as a component
  (`StudioInputsPanel.test.tsx`: the permission step, the cards, a check's
  meters, a whole input, Check off while armed, the lanes).
  `studio-inputs-view.spec.ts` plays the stereo file with the left side
  loud and the right side quiet (half and an eighth of full scale), so the
  rows tell the sides apart by level. Input 1 reads 0.397, Input 2 0.099,
  and the pair and the default 0.238, on a check and on the armed lane's
  split, and again after a channel chosen there re-arms the lane. The chosen
  channel shows in Track details, and Check is off while the lane is armed.
  The view fits at 390 by 844 and 1440 by 900 with no sideways scroll, and
  every control is 44 px tall on touch.
- The fake capture cannot be more than two channels or a second device, so
  those are unit-tested on fake lists and graphs and checked by the owner on
  real hardware: a guitar on one input of an interface and a microphone on
  another.
- Web MIDI is faked where access is asked for, as the existing adapters' tests
  do: a fake access handed to the adapter (`guitar-midi-input.test.ts`,
  `drum-input.test.ts`), or `navigator.requestMIDIAccess` stubbed
  (`web-midi-input-port.test.ts`).
