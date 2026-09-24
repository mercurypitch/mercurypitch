# Encore phone browser integration

This receipt covers the on-demand Merc example flow in the completed Journey
Encore dialog at a 390 x 844 touch viewport. The focused browser run passed all
three cases in 15.1 seconds:

- opening the dialog does not preload the voice bank;
- a nonempty corrupt HTTP 200 response shows the player-facing Retry state,
  evicts the failed decode, and fetches a valid copy on retry;
- an HTTP 503 response also shows Retry and succeeds after a fresh fetch;
- changing pace cancels the delayed request, and pace, starting height, and
  melody shape each request the exact selected variant only when asked;
- normal same-dialog handoff stops Merc's example before creating the
  microphone stream; and
- close, immediate reopen, and microphone start preserve the new dialog's
  lease after the old dialog's 120 ms fade completes.

`voice-request-trace.json` records the corrupt-200 and HTTP-error retries.
`variant-and-audio-order.json` records the selected asset paths, cancellation,
and the normal ordering `one-shot-start`, `get-user-media`,
`one-shot-stopped`, `mic-stream-after-example`.
`reopen-audio-ownership.json` records no museum-audio restart during the
close/reopen race and a final `reference` practice mode.

The close/reopen case intentionally places three DOM clicks in one browser task
so that Playwright action waits cannot hide the 120 ms race. In this artificial
case, the new microphone stream can be acquired during the tail of the old
example fade. The reopened practice remains in `reference` mode, so that tail
cannot be scored or recorded; the full synthesized reference still precedes
singing. The stricter stop-before-stream ordering is separately asserted for
the normal same-dialog handoff.

## Regression mutation

The ownership assertion was checked against the former behavior by temporarily
constructing a new audio-lease owner for each dialog. The focused test failed as
required: it expected zero new museum-audio requests and observed these two
requests when the old fade released over the reopened microphone lease:

```text
/games/adventure-audio-v1/m01-loop.mp3
/games/adventure-audio-v1/a01-loop.mp3
```

The mutation was fully restored. The same focused test then passed with the
persistent parent owner and no museum-audio requests. No mutation remains in
the source tree.

## Commands and results

```text
rtk proxy env BESIDE_CUE_E2E_PORT=5612 pnpm --dir apps/beside-cue exec playwright test e2e/glass-adventure-encore-examples.e2e.ts --project=chromium-adventure --output=test-results-final-melody
Result: 3 tests passed in 15.1 seconds.

# Run after the temporary per-dialog-owner mutation.
rtk proxy env BESIDE_CUE_E2E_PORT=5612 pnpm --dir apps/beside-cue exec playwright test e2e/glass-adventure-encore-examples.e2e.ts --project=chromium-adventure --grep='keeps a reopened microphone lease' --output=test-results-final-melody-mutation
Result: 1 test failed as required; expected 0 ambient requests, received 2.

# Run after restoring the persistent parent owner.
rtk proxy env BESIDE_CUE_E2E_PORT=5612 pnpm --dir apps/beside-cue exec playwright test e2e/glass-adventure-encore-examples.e2e.ts --project=chromium-adventure --grep='keeps a reopened microphone lease' --output=test-results-final-melody-ownership-green
Result: 1 test passed.

rtk proxy pnpm --filter @irchiinnuss/glass-game exec vitest run src/core/melody-judge.test.ts
Result: 1 file passed, 19 tests passed.
```

`encore-example-recovered-phone.png` and
`encore-reopened-microphone-phone.png` are the final run's real dialog pixels;
both are 390 x 844. The harness suppresses WebGL draw calls because scene pixels
are covered by the dedicated render proofs. These images and traces verify UI,
network, decode, selection, and audio ownership behavior. They do not measure
physical-phone audio latency, rendering speed, or frame rate.
