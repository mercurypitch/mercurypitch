# Speech recognition: what we run, and what else exists

Reference note, August 2026. Written because "Whisper" now names a model, a
company, several runtimes and a handful of unrelated products, and it is
worth being able to tell them apart before choosing anything.

Everything about our own stack is checked against the repository and the
npm registry. Everything about other companies' products is marked with
how well it could be verified — some of it could not be, and that is said
plainly rather than guessed at.

## 1. What MercuryPitch runs today

| Piece                               | Exact identifier                                    | Where                                                     |
| ----------------------------------- | --------------------------------------------------- | --------------------------------------------------------- |
| Voice-command STT (default)         | `Xenova/whisper-tiny`                               | `src/features/voice-control/voice-stt-service.ts`         |
| Voice-command STT (alternative)     | `onnx-community/moonshine-tiny-ONNX`                | `src/features/voice-control/useVoiceControlController.ts` |
| Song transcription (karaoke lyrics) | `Xenova/whisper-tiny`                               | `src/workers/whisper-worker.ts`                           |
| Runtime                             | `@huggingface/transformers` **4.2.0**               | `package.json`                                            |
| Execution backend                   | `onnxruntime-web` 1.26, WebGPU with a WASM fallback | pulled in by the above                                    |
| Third engine                        | The browser's own Web Speech API                    | `webspeech-listener.ts`                                   |

Two of those three engines are ours to choose; the third (Web Speech) is
whatever Chrome, Edge or Safari decides to use — in Chrome's case a Google
cloud service, which is why it needs a network connection and why it
capitalises "sing" into the surname "Singh".

## 2. Whisper — yes, it is OpenAI's, and it is genuinely open source

**Whisper** is OpenAI's automatic speech recognition model, released
September 2022 under the **MIT licence**, weights included. That is unusual
for OpenAI and is why the whole local-transcription ecosystem is built on
it. The reference implementation lives at
[github.com/openai/whisper](https://github.com/openai/whisper).

The family, smallest first: `tiny` (39M parameters), `base` (74M), `small`
(244M), `medium` (769M), `large` (1.55B). Each except the large ones has an
English-only `.en` variant that is more accurate at English than the
multilingual model of the same size. The current best is
**`large-v3-turbo`**: large-v3 with the decoder pruned from 32 layers to 4,
which makes it dramatically faster for a minor quality loss
([model card](https://huggingface.co/openai/whisper-large-v3-turbo)).

### The name collisions worth knowing

- **Whisper** (OpenAI) — the model. What we run.
- **Wispr Flow** (Wispr AI) — a commercial dictation product. Different
  spelling, different company, no relation to the model.
- **faster-whisper**, **whisper.cpp**, **WhisperX** — _runtimes_ that
  execute Whisper's weights more efficiently. Not different models.
- **`Xenova/whisper-tiny`** — the ONNX conversion of OpenAI's weights that
  we actually load. "Xenova" is Joshua Lochner, the author of
  transformers.js; `onnx-community` is the Hugging Face organisation that
  now hosts these conversions. The weights are OpenAI's; the packaging is
  theirs.

So: the model we run **is** OpenAI's Whisper, at its smallest size, packaged
for the browser.

## 3. Moonshine — a genuine alternative, not a Whisper repackage

**Moonshine** comes from **Useful Sensors** (now [moonshine-ai on
GitHub](https://github.com/moonshine-ai/moonshine)), released October 2024
under the **MIT licence**. It is its own architecture, not a Whisper
derivative.

The interesting design difference: Whisper always processes a padded
30-second window, so a one-second command costs the same as a
thirty-second one. Moonshine's compute scales with the actual length of the
audio, which is exactly the shape of a voice-command workload. The paper
reports a **5x reduction in compute** for a 10-second segment against
`whisper-tiny.en`, with no increase in word error rate
([arXiv 2410.15608](https://arxiv.org/pdf/2410.15608)).

Sizes: **Tiny** 27.1M parameters, **Base** 61.5M — smaller than Whisper tiny
in both cases. The catch: Moonshine is **English-only**, and it must not be
given Whisper's `language`/`task` generation arguments (our worker already
branches on this — it rejects them).

That matches your field impression, incidentally: Moonshine felt slower to
_start_ (a cold model download and warm-up) but fine once running.

## 4. transformers.js — we are already current

`@huggingface/transformers` **4.2.0**, published 22 April 2026, is the
**latest published version** — checked directly against the npm registry,
not from memory. v4 was a significant release: a WebGPU runtime rewritten
in C++ with the ONNX Runtime team, covering ~200 model architectures, and
the same code path across browsers, Node, Bun and Deno
([release notes](https://huggingface.co/blog/transformersjs-v4)).

There is nothing to upgrade here. Worth knowing about the ecosystem
though: WebGPU with fp16 has had accuracy issues specifically with
Whisper's encoder, and q8 decoders have had WebGPU problems — which is
why our worker loads **fp32 on WebGPU and falls back to q8 on WASM**. That
fallback is not superstition; it is the documented shape of the bugs.

## 5. Could we do better than whisper-tiny?

Options that are real today, in rough order of how much I would recommend
them:

| Option                                      | Size            | Why                                                                                                                    | Cost                                                                              |
| ------------------------------------------- | --------------- | ---------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| **`Xenova/whisper-tiny.en`**                | same as now     | English-only variants beat multilingual ones of the same size at English, and every command phrase we match is English | none — a one-line model id change, but drops non-English dictation                |
| **`onnx-community/moonshine-base-ONNX`**    | 61.5M           | the accuracy step up from Moonshine tiny, still smaller than whisper-base                                              | English only                                                                      |
| **`Xenova/whisper-base`** (or `.en`)        | 74M             | clearly better than tiny, still small enough to download once                                                          | ~2x the weights, slower first load                                                |
| **`onnx-community/whisper-large-v3-turbo`** | ~800M quantised | the best open model available in ONNX form                                                                             | 300–450MB download. Fine for a desktop app, not for a web page someone opens once |

My recommendation for the command engine: **try `whisper-tiny.en` first**
— it is nearly free to test and targets exactly our workload. Keep the
multilingual tiny available for anyone dictating in another language.
`whisper-base` is the next step if tiny.en still mishears.

Cloud APIs (OpenAI's hosted transcription, Google, Deepgram, AssemblyAI)
would all be more accurate than anything we can run locally, but they cost
money per minute, need a network round trip, and send a live microphone
stream off the device — a poor trade for "play", "stop", "forward twenty
seconds".

## 6. What the commercial dictation apps use

Here the honesty matters more than the completeness.

- **Wispr Flow** — publicly they describe using **a set of ASR models,
  choosing per detected language**, plus their own tuned models for some
  cases (a Hinglish model is mentioned). Which base models, or whose, is
  **not disclosed**, and I could not verify it from public sources. Anyone
  claiming to know exactly what Flow runs is guessing.
- **Typeless** — I found **nothing credible** about their model stack. No
  claim either way.
- **Google / Gemini** — Gemini's audio support is real and current, and
  Google now routes speech recognition through it in two places: **ML Kit's
  GenAI Speech Recognition** uses an **on-device Gemini model** in Advanced
  mode on selected Android devices, and **Cloud Speech-to-Text** is
  described as Gemini-powered across 125+ languages
  ([ML Kit](https://developers.google.com/ml-kit/genai/speech-recognition/android),
  [Cloud STT](https://cloud.google.com/speech-to-text)). Neither is a
  browser-local option, so neither replaces what we do — but Chrome's Web
  Speech API is a Google service, which means our "browser" engine is
  already, indirectly, in that family.

The general pattern: dictation companies mostly do not run stock Whisper.
They fine-tune something on their own data, or route to whichever
commercial API wins for the language, and they treat the details as the
product. We are not competing with them — we need six-word commands
recognised offline, which is a much easier problem.

## 7. The practical problem we actually hit

Not accuracy — **delivery**. Models download from Hugging Face at runtime,
and their error responses arrive without CORS headers, so a rate-limited
429 surfaces in the console as a CORS failure. Preview deploys suffer
worst, because every preview is a new origin with a cold browser cache, so
the weights re-download every time.

Two fixes worth considering, neither urgent:

1. **Host the weights ourselves** (Cloudflare R2 or the app's own origin)
   and point `env.remoteHost` at them. Removes the rate limit, the CORS
   confusion and the third-party dependency in one move. Costs a few
   hundred MB of storage and a cache rule.
2. **Ship tiny weights in the service worker's precache** so the second
   visit never fetches at all.

Until then, the retry fix already shipped: a failed load no longer poisons
the session, and toggling voice control off and on re-attempts the
download.

## Sources

- [openai/whisper on GitHub](https://github.com/openai/whisper)
- [openai/whisper-large-v3-turbo model card](https://huggingface.co/openai/whisper-large-v3-turbo)
- [Moonshine on GitHub](https://github.com/moonshine-ai/moonshine)
- [Moonshine paper, arXiv 2410.15608](https://arxiv.org/pdf/2410.15608)
- [Moonshine base model card](https://huggingface.co/UsefulSensors/moonshine-base)
- [Transformers.js v4 announcement](https://huggingface.co/blog/transformersjs-v4)
- [@huggingface/transformers on npm](https://www.npmjs.com/package/@huggingface/transformers)
- [onnx-community/whisper-large-v3-turbo](https://huggingface.co/onnx-community/whisper-large-v3-turbo)
- [ML Kit GenAI Speech Recognition](https://developers.google.com/ml-kit/genai/speech-recognition/android)
- [Google Cloud Speech-to-Text](https://cloud.google.com/speech-to-text)
- [Gemini API audio understanding](https://ai.google.dev/gemini-api/docs/audio)
