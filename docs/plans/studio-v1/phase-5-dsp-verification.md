# Phase 5 DSP verification

Date: 26 October 2026. Implemented above Phase 4 commit `8f1c18d4d`; the Phase 5 commit identifies the final source. This receipt separates pure DSP checks, actual browser output, independent measurement and remaining device/listening acceptance.

## Meter repair and reference scope

The original true-peak estimate skipped interpolation intervals according to endpoint levels. The retained adversarial regression failed against that implementation: it reported 0 dB although its own reconstruction exceeded 3.12 dB. The repair evaluates every fractional phase and both padded boundaries. The current `hann64-8x-v1` estimator uses seven interpolated phases and the original samples, with a fixed 64-tap Hann-sinc ring. It measures finite reconstruction, not certified true-peak compliance.

The loudness implementation uses stateful K-weighting filters, 400 ms blocks at 100 ms steps, an absolute −70 LUFS gate and a relative −10 LU gate. The reference is [ITU-R BS.1770-5](https://www.itu.int/dms_pubrec/itu-r/rec/bs/R-REC-BS.1770-5-202311-I!!PDF-E.pdf). A bounded ring holds the 400 ms and 3 s live windows; integrated analysis stores only admitted block powers, not full-song filtered copies. Raw mono preparation retains its documented dual-mono convention. Live/output analysis receives the actual two-channel bus.

An independent FFmpeg `ebur128=peak=true` run (`n9.0.2`) received the exact same fixture WAV bytes: 87 cases cover 44.1/48 kHz, tones and phase shifts, single-channel energy, silence gating, abrupt boundaries, near-Nyquist signals and the original adversarial sequence.

| Observed difference from FFmpeg                                                           | Result                            |
| ----------------------------------------------------------------------------------------- | --------------------------------- |
| Maximum absolute integrated-loudness difference for programme fixtures of at least 400 ms | 0.057902 LU                       |
| Greatest true-peak under-read                                                             | 0.507676 dB                       |
| Greatest true-peak over-read                                                              | 3.586841 dB                       |
| Adversarial sequence                                                                      | Studio 4.951947 dB; FFmpeg 4.1 dB |

FFmpeg's receipt rounds to 0.1 dB. The worst over-read occurs at a deliberately abrupt near-Nyquist boundary; this can cause conservative attenuation. The 100 ms boundary fixtures test peaks only: Studio retains a short-clip loudness fallback for preparation, whereas FFmpeg reports −70 LUFS before a complete programme block. They are excluded from the programme loudness agreement above.

Studio reserves an additional 0.75 dB export peak margin. It covers the observed under-read, FFmpeg rounding and a small engineering allowance on these fixtures. It does not prove a universal error bound or standards conformance. Four exact 16-bit files targeting an estimated −2.25 dB peak were independently measured at −1.7, −2.2, −3.1 and −1.9 dB by FFmpeg, all below their selected −1.5 dB ceiling.

## Delivered browser WAV

The local Chromium UI imported two four-second synthetic PCM takes, applied and undid a Tone edit, then explicitly exported and downloaded the current revision. The actual downloaded file was subsequently measured independently, without browser decoding or processing:

| Property                   | Result                                                             |
| -------------------------- | ------------------------------------------------------------------ |
| Encoding                   | Stereo 48 kHz, 16-bit PCM WAV                                      |
| Duration                   | 272,160 frames / 5.67 seconds, including lane FX tail              |
| Studio integrated loudness | −14.00026555 LUFS                                                  |
| FFmpeg integrated loudness | −14.0 LUFS                                                         |
| Studio estimated true peak | −9.38686602 dB                                                     |
| FFmpeg true peak           | −9.4 dB                                                            |
| SHA-256                    | `617bd152a041a1c41832701e397c95ff014486411648646f43369a58dff3e681` |

This proves one genuine browser-native export, with measured delivered bytes. It does not substitute for listening to vocals/instruments, physical devices or all browser engines. The exact JSON measurement is [retained here](evidence/studio-native-export-measurement.json). The 1.04 MiB WAV and complete FFmpeg log are preserved outside the repository in registered run `65ec899582844d85b822516ac60d308e`, under `evidence/studio-native-export.wav` and `evidence/studio-native-export-ffmpeg.txt`.

## Live and export contract

Live playback and export share the resolved role, macro, EQ and master effects. Offline arrangement rendering includes the same clip/source envelopes, lane gains, measured latency compensation and lane tails. Master rendering consumes that bus exactly once, then performs at most three target-gain trials from the unchanged bus. Gain remains within the original limiting cap and the actual gain-node range, −24 to +36 dB.

The delivered WAV is encoded first and then measured directly from its strict RIFF/PCM bytes. If estimated true peak exceeds the ceiling minus the margin, at most two additional renders apply monotonically greater post-limiter attenuation. Target gain is never restored after safety attenuation; achieved LUFS may therefore differ from the target. An unverifiable result is rejected.

Ordinary Play starts with the shared chain but without whole-song normalization. The interface calls these **Preview levels**. Export or Compare explicitly measures the current revision and supplies its gain/safety token to the transport; paused playback stays paused. Editing invalidates that token. Applying measured settings during playback retires the old graph through the existing release envelope and starts a fresh graph. Live output includes the transport's attack/release envelope; file export does not add that playback-only envelope. Fresh seeking initializes FX state rather than reconstructing earlier reverb history. These distinctions prevent a claim of exact sample parity.

The continuous meter runs in an AudioWorklet after the final audible transport envelope. Every render quantum contributes to the 400 ms momentary / 3 s short-term windows and sample-peak holds; numeric summaries update at 10 Hz, peak summaries at 30 Hz. Unsupported worklets retain honestly labelled analyser sample snapshots. Estimated true peak and whole-song integrated LUFS belong to the exact exported revision, not the live display.

Compare explicitly prepares two retained WAVs and never autoplays. Before bypasses role and master FX while retaining source preparation, edits and lane balance/faders/pan. After is the verified export. Playback matches the quieter integrated level using attenuation only, and switches at the same playback position. Dry audio is padded to the mastered tail duration.

## Bounds, cancellation and reproduction

Rendering, analysis, encoding and retained results participate in the shared 512 MiB admission budget. Sources retain the 384 MiB PCM-cache limit; durable project assets have a separate 480 MiB limit. There is no promise that every project fitting durable storage can render in one pass. Each stage admits its actual output/working allowance before allocation; a rejected render leaves the project unchanged. Browser-private allocations are estimated, not enforceable process RSS limits.

An independent lifecycle review reproduced three cleanup defects and their regression tests now pass. A borrowed context's reverb cache is retained only while a reverb unit owns it; final disposal clears the cache and convolver buffer references. Cancellation after a latency probe prevents the full-song native stage from starting. Disconnecting an AudioWorklet alone does not stop its processor: Studio now sends a shutdown message, clears its meter state, returns false and holds its reservation until the acknowledgement or context closure.

A separate native Chromium probe loaded the freshly bundled Studio processor and counted actual render callbacks against an independent clock worklet. After shutdown acknowledgement the meter completed one final callback, then stayed at 133 while the clock advanced from 264 to 396. This confirms processor shutdown rather than merely silence. The [shutdown receipt](evidence/studio-worklet-shutdown.json) preserves the counters; the isolated probe source and bundle are retained in the registered run's `scratch/phase5-worklet-shutdown.mjs` and `scratch/worklet-native/`.

One export/balance job is admitted at a time. Native `OfflineAudioContext.startRendering()` cannot be cancelled mid-call: cancellation rejects its result and prevents subsequent passes, but reservations remain held until native work settles. Worker analysis transfers one 4096-frame chunk at a time and terminates on cancellation. Stale revisions never become downloadable results. A retained export/Compare Blob holds its reservation until its owner releases it.

The combined focused DSP/master/meter/export/playback run passed 245 tests across 18 files. A real Chromium test also passed M/S window readiness, visible peak-hold reset, paused measured-master persistence without autoplay and invalidation after a saved edit. Scoped lint and the owned-file cognitive-complexity audit passed.

Focused regressions cover the original skipped peak, padded FIR edges, both live sample rates, chunk equivalence, exact window readiness, between-paint peak holds and reset, malformed/over-budget input, strict WAV parsing, final-file correction limits, native cancellation, frozen revision rejection, retained-result release, attenuation-only comparison, and master-token invalidation without autoplay.

Reproduce the independent matrix with Node 25 and FFmpeg, passing a pre-existing registered output directory:

```sh
node docs/plans/studio-v1/evidence/meter-reference-check.mjs "$PWD" /absolute/registered/output
ffmpeg -hide_banner -nostats -i /absolute/registered/output/studio-native-export.wav -af ebur128=peak=true -f null -
```

The deterministic [fixture generator](evidence/meter-reference-check.ts) and [full reference results](evidence/meter-reference-results.json) are source-controlled. Synthetic WAVs and logs remain in registered output; no LFS hydration is required. Full-song target/quality listening, phone/tablet and Safari/WebKit acceptance remain Phase 6.

## Native fade-boundary regression found during acceptance

A legal real-MP3 trim (source 0.25–11.5 seconds, fade-in 0.05 seconds, fade-out 0.3 seconds) exposed native AudioParam rejection when independently computed curve durations rounded across the following event timestamp. A native matrix reproduced 1,154 failures among 4,096 fractional playback epochs before correction, and zero afterward. Curve duration now comes from the exact pair of absolute boundary timestamps; all fade samples and source anchors remain unchanged. No epsilon or skipped fade is used.

Five focused envelope tests pass. The source-controlled `studio-audio-envelope.spec.ts` also passes: it submits actual scheduler output at 512 epochs to native AudioParams and renders the retained envelope through a real OfflineAudioContext, checking gain within 0.00035 and exact start/end silence. This probe is independent of the app bundle; full real-MP3 UI acceptance must run again on the rebuilt bundle. Raw native red/green receipts are `evidence/studio-native-fade-red.json` and `evidence/studio-native-fade-green.json` in the registered run.
