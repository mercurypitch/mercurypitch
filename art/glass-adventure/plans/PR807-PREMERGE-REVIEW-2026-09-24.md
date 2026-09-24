# PR807 pre-merge review and recovery pass

Scope: the owner's intermittent Chrome GPU failure, microphone recovery, and an
independent review before ending this large PR. Baseline reviewed:
`66b2dac22d2ece57431170d8b562f090ad337c7d`, which had 43 passing checks and one
expected production-only skip. That earlier result does not certify the new fixes.
No merge or release has been requested yet; normal store builds keep games off.

## Working checklist

- [x] Reproduce the zero-size framebuffer failure with installed Three r185.1 and real WebGL.
- [x] Prevent hidden/tiny main and map views from allocating half-resolution zero-size glass targets.
- [x] Preserve two physical pixels on each axis of scaled planar reflection targets.
- [x] Keep the loading cover until a usable frame is drawn; failed first GPU uploads enter fresh-scene Retry.
- [x] Renderer/map/mirror regressions pass; all seven loading browser cases pass, including real WebGL and injected upload failure/retry.
- [x] Shared game/encore microphone takeover and honest permission/device-busy recovery; two-tab browser and phone-layout proof pass.
- [x] One-shot recording consent and Encore audio ownership races fixed; lifecycle regressions and real Encore flow pass.
- [x] iOS archive guard rejects stale games-enabled assets under the store plist; 22 native tests pass. Actual Xcode execution remains CI-owned.
- [x] Bounded progression/persistence/integration review complete; no additional concrete blocker found in those paths.
- [x] Scoped code fixes committed: `1c82975d` (iOS pairing), `746393ec` (graphics/mic recovery), `0b38de25` (Encore consent/audio).
- [ ] Merge gate: final pushed revision must pass CI and the owner's recovery playtest. Final CI evidence is saved with the dotfiles task checkpoint; never substitute baseline CI.
- [ ] Owner: retry real singing, cold Chrome opening, and tablet play before merge decision.

## Graphics findings and limits

The two main renderers formerly clamped hidden containers to 1x1 CSS pixels while
using `transmissionResolutionScale = 0.5`. At DPR 1, Three allocates a half-pixel
transmission target that WebGL truncates to a zero-size attachment. A standalone
real Chromium/SwiftShader experiment returned GL error 1286 at size 1 and 0 at
sizes 2 and 640. Regression tests now cover hidden/show/resized views and DPR
0.5, 1 and 1.5. Narrow mirror targets have the same minimum-size requirement.

This establishes a real application defect capable of producing the reported
framebuffer errors. It does **not** establish that every intermittent failure on
the owner's hardware followed that path.

The `invalid mailbox name` and `texture is not a shared image` strings originate
in Chromium's shared-image/texture machinery. They are not evidence of a missing
GLB or broken model file by themselves. See the
[Chromium decoder source](https://chromium.googlesource.com/chromium/src/%2B/fcb832590a2167f44c150cfa7a6ed68f93ed645d/gpu/command_buffer/service/gles2_cmd_decoder_passthrough_doers.cc),
`DoCreateAndTexStorage2DSharedImageINTERNAL` and
`DoBeginSharedImageAccessDirectCHROMIUM`. Browser/driver/resource failures remain
possible; the specific hardware cause was not reproduced here. No global browser
flags, OS permissions, or GPU driver settings were changed.

WebGL can record an error without throwing or emitting context loss. A bounded
first-frame check now routes a detected upload/render failure through the existing
fresh-renderer Retry, preserving checkpoints. It runs at the loading boundary,
not on every gameplay frame. The browser regression injects GL_INVALID_OPERATION
and verifies the error cover, successful retry, and preserved saved progress.
The genuine WebGL regression renders glass without stubbing draw/clear calls;
separate UI cases use the existing lightweight raster mocks.

## Review findings being resolved

1. **Microphone ownership/recovery:** offer the shared manager's cooperative
   takeover for another same-origin app tab. Distinguish that from denied
   permission and a hardware/browser busy error; those offer retry with the
   correct explanation. Web code cannot revoke another application's OS mic lock.
2. **One-shot recording consent:** “record my next melody” must authorize one
   attempt, not every subsequent Sing again. Consume the opt-in only when recording successfully starts
   and retain a separate active-attempt token through recording completion.
3. **Encore audio ownership:** backgrounding and delayed soft stops must release
   only their own audio pause, never a newer capture or playback session's pause.
4. **iOS archive pairing:** an ignored Capacitor `public` directory can retain a
   games-enabled preview. Reject store archives containing those assets, and
   require the games plist, profile receipt and matching checksums together.

## Verification and review coverage

Focused checks passed: renderer/map/mirror/loading-lifecycle (40 tests), native
asset/profile (22 tests), microphone classification/host/challenge/controller
checks, and the Encore/progression/privacy review suite (84 tests). These suites
overlap; counts must not be added into a fictional unique total. Glass Game and
BesideCue TypeScript passed. Changed-file lint/format and diff checks passed.

Real-browser checks passed: all seven loading cases, map retry/context-loss,
desktop/touch blur cases, two-tab microphone handoff, stale-claim/device-busy
recovery, and the complete Encore PCM/record/save/reload/listen/delete flow.
The microphone visual proof also checks 44px targets, computed button colors,
no horizontal overflow, and no overlap with the phone camera controls.
Screenshots are in `../proofs/pr807-premerge-2026-09-24/`.

The review covered graphics/resource lifecycle; shared web/native hosting,
games-off defaults and offline asset delivery; microphone recovery; progression,
checkpoint/replay tiers, discoveries and portrait persistence; and optional
recording/privacy/audio ownership. No unresolved GitHub review threads existed
at review time. All 115 baseline branch commits were authored by the owner.
This bounded review is not proof that an application of this size has no defects.

## Follow-ups for the next PR

- One further Floating Museum art pass: compare close-up source and runtime
  silhouettes, visible triangulation, planting and architectural joins against
  the approved image. Preserve dense sources; use deliberate retopology and
  normal/detail baking where measured budgets justify reduction. This is visual
  polish, separate from GPU corruption and this PR's recovery fixes.
- Native provenance hardening: extend the existing asset checksum inventory to
  Vite's hashed JS/CSS chunks and the older B-side hardcoded assets. Clean builds
  and Capacitor sync currently copy these, but the checksum guard does not yet
  detect their corruption after sync. This is not an observed missing-file bug.
- Measure actual tablet loading, frame rate, memory/heat and real-singing fairness.
  The current platform kit is deliberately dense; desktop/SwiftShader tests do
  not establish a mobile performance budget.
- Tune configurable melodies from the owner's singing feedback. Keep existing
  roadmap 9 expansion behind owner acceptance; items 10–11 remain later.

Recommendation: merge this implementation after final CI and the owner's short
Chrome/microphone recovery check. Keep the next art pass, melody tuning and
campaign expansion in a new PR. The original hardware-specific mailbox failure
is not claimed to be cured; the reproduced framebuffer defect is fixed and
failed first uploads now have a tested recovery path. Do not add further islands
or mechanics to PR807.
