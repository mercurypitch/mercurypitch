# Studio inputs — each lane records from its own input

Owner-approved plan, 7 November 2026, with the channel model added on
8 November, and MIDI lanes moved ahead of several lanes at once the same day:
the owner asked for MIDI by name, not for several lanes at once. Seven pull
requests, each one a separate owner decision to merge, the last of them in
two parts. The first two change no behaviour; the rest add what a musician
sees, except the first part of the last, which readies the recorder for it.

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

Its MIDI section, beside the audio inputs, came with MIDI lanes (PR 6,
below).

A panel the Studio opens in place of another (Inputs from deep in the Sound
panel) now starts at its top, and focus lost with the button that opened it
comes to the panel (`StudioPanel.tsx`).

### MIDI lanes (PR 6)

A lane can be played from a MIDI keyboard or pads. The page makes its sound
(no microphone opens for it), records that sound as an ordinary take, and
keeps the notes played into the take beside its audio.

| File                                                      | What it does                                                                                                                                              |
| --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/studio/record/lane-inputs.ts`                    | A lane's input is a union: an audio input `{ deviceId, label, channel, pair }`, or `{ kind: 'midi', portId, label }`. A row kept before reads as audio.   |
| `src/lib/studio/record/armed-input.ts`                    | What an arm opens for its lane: a microphone's source and channels, or an instrument's sound (`StudioInstrumentHold`), one node for the take and monitor. |
| `src/lib/studio/record/take-notes.ts`                     | A note `{ midi, velocity, startFrame, endFrame }`, the log of notes as they sound, and a take's notes placed on the song as its audio is.                 |
| `src/db/services/studio-take-notes.ts`                    | The notes kept on this device by the take's id (`studioTakeNotes`, database v15), gone with the take's audio and its song.                                |
| `src/features/studio/record/midi/studio-midi-access.ts`   | The Studio's one MIDI access, asked for from a press only: its state and its ports.                                                                       |
| `src/features/studio/record/midi/studio-midi-sound(s).ts` | Which sound a lane plays, from its instrument, and the sounds themselves, loaded with import() and made for each arm (PR 7).                              |
| `src/features/studio/record/midi/studio-midi-arm.ts`      | A MIDI lane's arm: its port, its sound on the clock, every note logged.                                                                                   |
| `src/features/studio/record/midi/studio-midi-lanes.ts`    | The recorder hook's MIDI side: the arm, which MIDI lane is armed, and a kept take's notes.                                                                |
| `src/features/studio/inputs/StudioMidiInputs.tsx`         | The Inputs view's MIDI section: each port with a light while it plays and the lanes it plays.                                                             |
| `src/lib/timing/performance-clock.ts`                     | An event's performance-clock timestamp on an audio clock: the arithmetic Guitar and Drum Night each had, now one.                                         |

- **Choosing it.** A lane's input picker, in Track details and in Inputs,
  lists MIDI ports as a group of their own after the audio inputs, once MIDI
  is allowed from a press ("Show MIDI keyboards and pads"). A lane on one
  has no channels, its header chip says "MIDI", and its words say what it
  plays as. A browser without Web MIDI (Safari, every browser on iOS) says
  so in the group, and a denial reads apart from any other failure, as Drum
  Night tells them apart.
- **Its sound follows its instrument** (`studioLaneInstrument`): the drum
  kit (Drum Night's player, General MIDI keys 35 to 81) for drums and
  percussion, and the piano for every other lane: the fallback synth at
  once, and the sampled grand from cdn.jsdelivr.net note by note as its
  samples load (the piano's router). A piano lane says "Plays the piano.",
  any other "Plays as piano until this instrument has its own sound.". A
  key with no drum plays nothing on a drum lane, and its note is kept.
- **Arming it** never asks MicManager for anything: the recorder asks for
  the lane's instrument first (`acquireInstrument`), inside the press, and
  a lane that has one never reaches the microphone. MIDI is asked for in
  the press; the sounds and the Piano room's port and input state load
  alongside with import(), never with the page. A port that is gone
  refuses the arm in its own name, "Connect Keystation 49, then arm
  again.", rather than record the room in place of the keyboard. One lane
  is armed at a time, as before.
- **Hearing it.** The instrument plays through the lane's monitor, at its
  volume and pan, whatever the monitoring switch says: the switch guards
  against a microphone's feedback, and a MIDI lane has none. The same node
  is the take's capture input. The mic icon stays off (no microphone is
  held; the sentinel would otherwise force the arm off), and a port
  unplugged while armed or mid-take ends the arm or the take in its own
  words.
- **Notes and audio line up.** A note sounds at the clock time its message
  arrived, mapped onto the Studio's clock by `performanceToAudioSeconds`
  (one already past sounds at once), and is logged at that time. The take
  is moved by the output path alone (`studioInstrumentShift`): the player
  plays to what they hear, late by the output path, and the sound reaches
  the take inside the page, with no input path, no measured round trip and
  no line-up. A kept take keeps the notes it captured, on the song as its
  audio sits before any cut; a note still held at the end of the take ends
  with it.
- **How close.** A note whose message is already past is started at the
  audio's next callback, so its sound can begin up to one callback after
  the time its note is kept at (up to 12 ms apart in headless Chromium).
  The piano adds its own rise (8 ms) and limiter lookahead (6 ms). The
  browser test measured the sound 12.8 to 24.8 ms after its note. Exact
  alignment would need every live note started a fixed time ahead, which
  the player would hear as latency.
- **The Inputs view's MIDI section** asks for MIDI from a press, then lists
  each port with the lanes played from it, a lane's port that is gone as
  not connected, and a light that comes on for a moment when the port sends
  a note, a pedal or a reset (read with the Piano room's
  `parseWebMidiMessage`, not a second parser).

**What it does not do.** Other instruments wait for sound banks; there is
no MIDI clip, and the notes have no viewer yet. A take kept from the
journal after a closed tab has no notes: the notes are kept only when the
take is kept on the spot. Duplicate song and a restored backup give their
takes new ids, so the copy has no notes, and a backup file carries none.

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
interface's, the Inputs view and MIDI lanes are built (PR 3 to PR 6,
above). What follows is still to come.

### Several lanes at once

**The recorder's lane arms (PR 7, part 1).** The recorder holds every armed
lane, though the Studio still arms one at a time, so nothing a musician sees
has changed: the recorder's existing tests pass unchanged.

| File                                       | What it does                                                                                                                                         |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/studio/record/lane-arms.ts`       | Every armed lane: its input opened in its own press, a capture and a monitor of its own, on the one clock and its one click track.                   |
| `src/lib/studio/record/armed-input.ts`     | Lanes on one microphone share it: one source and one split, each lane taking its own pick, both gone with the last lane on it.                       |
| `src/lib/studio/record/take-run.ts`        | One Record press across every armed lane: the start frame, count-in, song start, punch and loop they share.                                          |
| `src/lib/studio/record/lane-take.ts`       | One lane's take: its audio, its own round trip and journal, and what it says when it ends.                                                           |
| `src/lib/studio/record/studio-recorder.ts` | The run: Record starts every armed lane's capture on the same frame, Stop ends them all, and a lost input ends only the takes that recorded from it. |

- **One start frame.** Every lane's capture starts on the same clock frame,
  under one count-in and one song start, and a punch or a loop applies to
  every lane. Stop ends every take, each one round trip of its own lane past
  the press.
- **Its own path.** Each take is moved by its own lane's path, read as the
  take starts: a microphone's round trip, an instrument's output path.
- **Its own journal.** Each take is journaled under its own id, so a closed
  tab keeps every lane.
- **Memory for every lane, or none.** Record holds memory for every lane's
  take before any starts, and refuses the press, saying why, when one lane
  cannot have it: it never records some lanes and drops others.
- **Losses.** A lost input ends only the takes that recorded from it: the
  microphone ends every lane on it and leaves an instrument lane recording; a
  port ends its own lane. Each of those lanes keeps what it had and says so
  (`notices`). A lane lost in a count-in drops its take, and the others
  count on; alone, it ends the count-in, as before.
- **The view.** The recorder's view keeps its one-lane fields, read from the
  first armed lane, and adds `lanes` (each armed lane's level and live take)
  and `notices`.
- **Size.** `studio-recorder.ts` went from 765 lines to 643, with the lane
  arms, the run and a lane's take in modules of their own.

**Arming several lanes and recording them (PR 7, part 2).** The Studio
works as a DAW does: each lane's arm is its own, one Record press records
every armed lane on the one song clock, and each lane keeps its own take as a
clip on its own lane. These are the design decisions, and why each was
chosen.

| File                                                   | What it does                                                                                                  |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| `src/features/studio/record/studio-mic-share.ts`       | The one audio input every armed audio lane records from, opened once and held until its last lane lets go.    |
| `src/features/studio/record/record-lanes.ts`           | Each armed lane as the timeline and the arm buttons read it: its level and take, woken by its own lane alone. |
| `src/features/studio/record/midi/studio-midi-lanes.ts` | Each MIDI lane's arm, with a sound and a note log of its own, and one lane per port.                          |

1. **One audio input at a time, for every armed audio lane.** Reaper, Logic
   and Ableton record from one audio device, or from an aggregate the
   operating system makes of several: two devices run on clocks of their own
   and drift apart, and WebKit keeps one capture anyway. So every armed audio
   lane is handed the one stream MicManager opened, and they share one split,
   each lane taking its own input or pair. A lane whose input is another
   device is refused in words that name both: "Lane 3 records from Webcam,
   and Lane 1 is armed on Scarlett 2i2. Studio records from one audio input
   at a time: disarm Lane 1, or choose Scarlett 2i2 for Lane 3." Devices are
   compared as the arm plans them, so a lane that follows the Studio's input
   and a lane set to that same input are one device. MicManager keeps its
   one scoped hold, held until the last lane on the input lets it go: what is
   written below, that this work changes that hold, no longer applies.
2. **MIDI lanes need no capture.** Any number can be armed beside the audio
   lanes, in any browser.
   - A port plays one lane at a time. A second lane armed on a port is
     refused, naming the lane on it.
   - Each armed MIDI lane plays a sound of its own (`studio-midi-sounds.ts`
     makes one for each arm), so its take holds only its own notes, and logs
     what it plays in a log of its own.
   - The cost: each piano lane's sampled grand decodes its own samples as it
     plays them, up to the instrument's 96 MiB cap; the browser's cache
     serves the files again. The kit does the same with its own. Sharing
     decoded samples between two instruments would need the sampled grand's
     cache, budget and eviction reworked, so they are not shared.
3. **Arming.**
   - A lane's arm button toggles that lane alone; arming one lane never
     disarms another.
   - R and Record work as before for zero or one armed lane. With several
     armed, they record them all.
   - Moving the arm (`retarget`) is gone, from the hook and the recorder:
     each lane's arm is its own. What it gave, the input staying open, now
     comes from the share. A lane armed or disarmed beside others on the
     device never reopens it, and a lane whose channel changes re-arms with
     the device held open across the change (`retain`).
   - Lane headers show every armed lane, and one still opening as opening.
     The armed card lists each armed lane with what it records, then says
     "Press Record to start." once, and its Disarm becomes Disarm all.
4. **Recording**, as part 1 built it. Every lane's take starts on the same
   frame; punch, loop, count-in and click apply to all of them, and Stop ends
   them all. Each take shifts by its own lane's path, and is journaled on its
   own. Memory is held for every lane before the take starts; with several
   lanes, a refusal says "Studio needs more memory to record every armed
   lane, so none started.", and no lane records.
5. **Losses**, as part 1 built them. A lost input ends only the takes that
   recorded from it: the microphone every lane on it, leaving MIDI lanes
   recording; a port its own lane. Each lane that kept what it had says so.
   Where the lanes' takes said different things, the card names each lane
   before its words.
6. **The mic icon** is on while any armed lane holds the microphone.
7. **The Inputs view** keeps its one tap, since there is one capture: the
   meters follow the armed device, and MIDI lanes have none. Check stays off
   while anything is armed. The view reads the tap again only when the
   capture changes (`inputCapture`, a new number each time the microphone
   opens), not as lanes are armed and disarmed on it.
8. **Size.** `studio-recorder.ts` stays under the ratchet's 800 lines, the
   lane arms in a module of their own, and no function is over cognitive
   complexity 15.
9. **Two parts.** The whole passed 3,000 changed lines, so the recorder came
   first, with no change a musician sees, and this part second.

**What it does not do.**

- Record from two audio devices at once. That is the first decision.
- Tell that the system default is the device it stands for: a lane on the
  default and a lane set to the default's own device are two inputs, since
  the browser lists them under different ids.
- Play one MIDI port into two lanes, or split a port's channels across
  lanes.
- Arm a lane while a take runs: every arm button waits for the take.
- Share decoded piano samples between lanes.

What follows is what PR 3, PR 5 and PR 6 left for this work, written before
it. The decisions above answer each point.

Lanes on channels of one interface share one capture and one split, which any
browser can do. Lanes on different devices need a capture each, and WebKit
(Safari, and every browser on iOS) keeps one capture at a time: it mutes the
earlier one as another opens (`src/lib/mic-input-loss.ts`). There a second
device cannot record beside the first, and the Studio has to say so.
`MicManager.acquireFrom` holds one input per consumer today, so this PR
changes that hold (it did not: see the first decision above). The recorder
arms several lanes and records them on the one song clock.

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

From PR 6, MIDI lanes assume one arm too:

- The recorder holds one armed input (`armed-input.ts`), a microphone or an
  instrument. With several lanes armed it holds several, and an instrument
  lane needs no capture of the browser's: a MIDI lane can be armed beside a
  microphone lane even in WebKit.
- `createStudioMidiLanes` keeps which MIDI lane is armed (`armed`), and the
  hook reads it to keep the mic icon off and to ignore the shared
  microphone's goings. With several lanes, the icon is on while any armed
  lane holds a microphone.
- Each sound is made once per clock (`studio-midi-sounds.ts`), and an arm
  takes it through a node of its own. Two lanes playing the piano at once
  would share one piano and hear each other; give each arm a sound of its
  own, or the router a voice range per lane.
- The note log is the hook's one log. Notes are kept for a take by the
  time window it captured, so two lanes recording at once would each keep
  the other's notes: log per arm.
- A MIDI port is routed to one lane at a time (`createWebMidiInputPort`
  selects one input). Two lanes on one keyboard want the port's events
  split by channel, or both lanes fed.

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
   latency wizard per input.
6. **MIDI lanes kept as audio**, with the played notes kept beside them, and
   MIDI inputs in the Inputs view. Moved ahead of several lanes at once on
   8 November: the owner asked for MIDI by name.
7. **Several lanes recording at once**, in two parts: the recorder holds
   several lane arms with no change a musician sees, then the Studio arms
   several lanes and records them.

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
- MIDI lanes (PR 6) are tested on a fake access with ports that send and
  can be plugged and unplugged (`midi/fake-midi.fixture.ts`).
  - The lane input union and its rows kept before: `lane-inputs.test.ts`.
  - The recorder on an instrument, with no microphone, moved by what the
    hook gives for no stream, and a lost port in its own words:
    `studio-recorder.instrument.test.ts`.
  - Routing by instrument family: `studio-midi-sound.test.ts`.
  - The sounds: a sound of its own for each arm (two pianos for two piano
    lanes, since PR 7), the kit's velocity, and the piano on its synth until
    the grand loads: `studio-midi-sounds.test.ts`.
  - The arm: each note at the clock time its message arrived and logged
    there, a drum key with no drum still kept, a port by its name, refusals
    in words, an unplug, and the release: `studio-midi-arm.test.ts`.
  - The hook: no microphone asked for, the monitor on whatever the switch
    says, the shift pinned to the output path alone, the mic icon off, a
    kept take's notes by its id, and a gone port refused in its name:
    `useStudioRecorder.midi.test.ts`.
  - The notes, their placement and their store: `take-notes.test.ts`,
    `studio-take-notes.test.ts`.
  - The picker's MIDI group and words: `studio-midi-choices.test.ts`,
    `StudioLaneInputField.test.tsx`.
  - The Inputs view's MIDI section and its lights: `midi-inputs-model.test.ts`,
    `studio-midi-activity.test.ts`, `StudioInputsPanel.test.tsx`.

  In a browser, `studio-midi-lanes.spec.ts` puts a fake keyboard in the page
  with addInitScript, refuses the sampled grand's samples so the synth plays
  and every run is the same, and fails on any request to the live site. A
  take recorded while middle C is held:
  - asked for no microphone;
  - holds the piano's middle C;
  - keeps one note, about 0.6 s long, whose sound begins 12.8 to 24.8 ms
    after its frame and never before it.

  Inputs lists the keyboard with its lane and lights it while it plays.

- Several lanes at once (PR 7) are tested in two parts.
  - The recorder holds several lanes, on its fake graph
    (`studio-recorder.lanes.test.ts`):
    - two lanes on one stereo input share its split and start on the same
      frame, each keeping only its own side;
    - an instrument lane records beside a microphone lane, each take placed
      by its own path, and two instrument lanes each keep their own sound;
    - each lane's take is journaled on its own;
    - memory is held for every lane, or Record is refused for all;
    - a lost microphone or port ends only its own lanes' takes, mid-take
      and in a count-in;
    - the shared microphone opens once, drops each lane as it leaves, and
      goes with the last.
  - The one input every armed audio lane shares, opened once and refused for
    another device in words that name both: `studio-mic-share.test.ts`,
    with the hook's side in `useStudioRecorder.lane-input.test.ts`.
  - Two MIDI lanes on two ports, each a sound and a log of its own, and a
    second lane refused on a port: `useStudioRecorder.midi.test.ts` and
    `studio-midi-sounds.test.ts`.
  - The arm buttons, each its own lane's: `StudioLaneHeader.test.tsx` and
    `useStudioRecorder.test.ts`. Each lane's record for the timeline:
    `record-lanes.test.ts`. The card's words for several lanes:
    `StudioRecordNotices.test.tsx`.

  In a browser, `studio-several-lanes.spec.ts` plays the stereo fake capture,
  a loud tone on the left and a quiet one on the right. Lane 2 on Input 1 and
  Lane 3 on Input 2 record from one press, and each take is a clip on its own
  lane, holding its own side alone, from the same frame. A fake MIDI
  keyboard's lane then records beside a microphone lane: the microphone opens
  once, each take holds only its own sound, and the note is kept with the
  keyboard's take alone.
