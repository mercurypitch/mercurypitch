# @irchiinnuss/audio-io

Choosing an audio input, and knowing whether it is carrying anything.

This package exists because of a specific afternoon. A microphone was
plugged in, permitted and lit — recording dot on, audio context running,
capture frames arriving on schedule — and every frame was `0.0001`. The
stream had opened on an audio interface's other channel. That is silence
with every light green, and the app could neither say so nor do anything
about it, because it never asked which input to use: it took the browser
default and hoped.

Everything here is one of the three answers to that.

| Module           | Answers                                    |
| ---------------- | ------------------------------------------ |
| `input-device`   | _Which_ input, remembered, and still valid |
| `silence-watch`  | Is an open stream carrying anything        |
| `solid/MicInput` | Both of the above, on screen               |

`@irchiinnuss/pitch-engine` owns the microphone itself — the stream, the
cross-tab lock, the error taxonomy. This package owns the _choice_ of
device and the reporting of it, which is UI-adjacent and does not belong
in a detection engine.

The Solid component is a separate entry point (`@irchiinnuss/audio-io/solid`)
so the logic can be used without a framework.

## Consumers

- **Beside Cue** — the 3D stages and the range finder.
- **MercuryPitch** — not yet. Its `AudioDeviceSettings` predates this and
  is the better UI in some respects (input _and_ output, `devicechange`
  refresh); migrating it is deliberately left until after the next
  release. See the TODO in `src/components/guitar/AudioDeviceSettings.tsx`.
