# Third-party notices

MercuryPitch uses the following third-party media and code when a user
explicitly loads the corresponding feature. These notices supplement the project's own
[AGPL-3.0 license](../LICENSE).

## Salamander Grand Piano V3

- Work: Salamander Grand Piano V3
- Author: Alexander Holm
- Source: <https://github.com/sfzinstruments/SalamanderGrandPiano>
- License: [Creative Commons Attribution 3.0 Unported](https://creativecommons.org/licenses/by/3.0/)
- MP3 adaptation: [Jan Forst's `samples-piano-mp3`](https://github.com/darosh/samples-piano-mp3)

Piano Night requests a version-pinned subset of the MP3 adaptation: velocity
layers 4, 8, 12, and 16, key-release samples, and pedal samples. MercuryPitch
changes the original presentation by selecting a compact set of layers,
mapping samples into three-semitone zones, applying runtime gain and tone
controls, and preparing only the current performance window. No endorsement by
the original author or the MP3 distributor is implied.

## Signalsmith Stretch

- Work: Signalsmith Stretch, Web Audio release (npm `signalsmith-stretch` 1.3.2)
- Author: Geraint Luff / Signalsmith Audio Ltd.
- Source: <https://github.com/Signalsmith-Audio/signalsmith-stretch>
- License: MIT License

The karaoke mixer and Jam rooms change a song's key with this library, run in
an AudioWorklet (`src/workers/pitch-shift.worklet.ts`). It is bundled from npm
and served from MercuryPitch's own origin, and it is fetched the first time a
song's key is moved. The npm package declares the MIT License but ships no
license file, so the text is reproduced here:

```text
MIT License

Copyright (c) 2022 Geraint Luff / Signalsmith Audio Ltd.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
