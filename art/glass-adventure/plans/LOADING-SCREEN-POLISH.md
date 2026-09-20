# Loading Screen Polish

**Status:** Design only; implementation deferred.
**Date:** 2026-09-20
**Priority:** Begin after the current enclosed-chamber and already approved milestone tasks

The Glass Adventure should enter through a branded, fully opaque Merc presentation while the real playable scene becomes ready behind it. The loading screen must conceal incomplete geometry, proxy art, texture swaps, and unstable first frames. It should feel intentional without slowing downloads or pretending that time spent on an animation is asset progress.

This plan recommends an initial **two-second minimum presentation**, pending owner acceptance. Asset work starts immediately. The timer controls only when the ready screen may dismiss; it never throttles a request, decode, upload, worker, or renderer task.

## Experience goal

The player should see a small piece of Merc character animation and clear museum copy, followed by a clean reveal into a fully prepared level. On a fast cached visit, the brand moment has enough time to read. On a slow visit, the screen stays useful and honest until the required assets and first stable frame are actually ready.

The loading layer must be opaque from its first frame through dismissal. The game canvas can initialize behind it, but the player should never see:

- fallback blocks being replaced by museum assets;
- untextured or partially textured meshes;
- a camera snapping between provisional and final framing;
- missing floors, walls, gates, encounters, or Merc;
- a playable prompt before input, collision, and state are ready.

## Proposed state flow

### 1. Enter

The host immediately presents an opaque branded surface, blocks game input, and starts every required load in parallel. Merc appears in a lightweight loop or reduced-motion pose. A short line describes the current stage without claiming exact progress.

Candidate copy:

- Opening the gallery
- Polishing the glass
- Tuning the room
- Lighting the exhibits
- Almost ready to sing

Copy should be localized text, not baked into artwork. Rotation may be deterministic by stage; rapid random changes would be distracting and harder for assistive technology.

### 2. Loading

The screen may show a progress bar only when the loader has a reliable denominator. If byte totals or task weights are not trustworthy, use stage labels and an indeterminate treatment rather than a fabricated percentage.

The layer remains fully opaque while the critical scene loads, decodes, installs, composes, and renders. Optional content may continue later only when its absence is an accepted design state and cannot create a visible placeholder swap or physics mismatch.

### 3. Ready and reveal

Dismiss only when both conditions are true:

1. the real readiness contract has completed and one stable game frame has rendered behind the cover; and
2. the minimum presentation timer has elapsed.

The initial policy is:

```text
revealAt = max(realSceneReadyAt, loadingScreenEnteredAt + 2.0 seconds)
```

If real readiness takes 4.6 seconds, reveal at 4.6 seconds with no extra two-second hold. If cached readiness takes 0.4 seconds, keep only the remaining 1.6 seconds of the brand presentation. Downloads and initialization always begin at entry and continue at full speed.

Use a brief, measured fade or cut after the stable frame signal. Do not dismiss on a timer alone.

### 4. Error

Required-load failure replaces the progress state with a readable error while preserving the opaque cover. Offer:

- `Retry` for the failed required work;
- `Cancel` or `Leave` to return safely to the host;
- a concise, friendly reason;
- optional technical details only where they help support and debugging.

The app must not reveal a partially initialized scene beneath the error.

### 5. Cancel

Cancel invalidates the current load token, stops or disposes work where supported, removes pending input, and returns to a known host surface. A stale promise from the canceled visit must never dismiss a later loading screen.

## Real asset-readiness contract

Readiness must be based on the playable slice rather than an arbitrary delay. A future implementation should classify dependencies as **critical** or **optional** for each authored route.

Critical readiness normally includes:

- the level definition and composed initial snapshot;
- player and Merc presentation required for the opening frame;
- all asset bundles visible from the spawn and initial camera range;
- required floors, walls, openings, gates, exhibits, and their textures;
- collision and activation state matching the installed visuals;
- initial camera framing and occluders;
- the first encounter and guidance state;
- a successfully rendered stable frame after installation.

Audio decoding should be classified explicitly. Ambient audio that can fade in safely may be optional; audio required for a first instruction or synchronized opening may be critical. Microphone permission must never be requested by the loading screen.

Optional loading is acceptable only when the later arrival cannot expose a proxy-to-art swap, remove a collision object unexpectedly, change the first camera composition, or leave a reachable room visually incomplete. The authoring manifest, not a level-ID runtime branch, should declare the classification.

### Suggested contract shape

Names are provisional:

```ts
type AdventureLoadPhase =
  | 'idle'
  | 'loading-manifest'
  | 'loading-assets'
  | 'installing-scene'
  | 'awaiting-first-frame'
  | 'ready'
  | 'error'
  | 'cancelled'

interface AdventureLoadStatus {
  phase: AdventureLoadPhase
  visitToken: string
  completedCriticalIds: string[]
  pendingCriticalIds: string[]
  progress?: { loaded: number; total: number; unit: 'bytes' | 'tasks' }
  error?: AdventureLoadError
}

interface AdventureLoadingPresentation {
  brandRecipeId: string
  copySetId: string
  minimumVisibleMs: number
  reducedMotionRecipeId: string
}
```

The renderer or scene host owns the real readiness signal. The UI owns the minimum presentation timer. A small coordinator derives whether dismissal is allowed. Keeping these responsibilities separate prevents a visual preference from slowing the asset pipeline.

## Timing recommendation and decision

The user proposed a two- to three-second minimum. Start with **2.0 seconds** for the first implementation, subject to acceptance in a real-device review.

Reasons to start at the lower bound:

- two seconds is long enough for a short Merc action and one line of copy;
- repeat visits remain less burdensome;
- the readiness contract, rather than a fixed animation, still governs slow loads;
- it is easy to lengthen after observing the composition, while an unnecessarily long forced wait makes every test and replay feel slower.

The implementation must preserve a fast-ready option as a product decision. Candidate policies for later acceptance are:

| Policy               | First visit                | Repeat visit                      | Tradeoff                                                        |
| -------------------- | -------------------------- | --------------------------------- | --------------------------------------------------------------- |
| Recommended pilot    | 2.0 s minimum              | 2.0 s minimum                     | Consistent brand moment; may feel repetitive during retries     |
| First-visit emphasis | 2.0 s minimum              | 0.35–0.60 s transition once ready | Faster revisits; requires a clear session/save rule             |
| Fastest ready        | Only the reveal transition | Only the reveal transition        | Maximum speed; Merc animation may be unreadable on cached loads |

Retry should not replay a gratuitous minimum after the user already waited through the presentation. A reasonable pilot is to apply the two-second minimum to the initial visit and reveal immediately after successful readiness on retry, with only the normal transition. This detail still needs owner acceptance.

Never implement the minimum by slowing network requests, serializing independent work, delaying decode, or holding a ready callback inside the asset system. Never keep the player waiting solely to finish a long decorative animation.

## Merc animation and visual direction

The loading identity should feel like the museum and remain inexpensive enough to appear instantly. Candidate actions include Merc:

- polishing one glass pane;
- carrying or raising a small gallery light;
- listening, then making a tiny tuning gesture;
- opening a curtain or presentation panel;
- arranging one simple exhibit label.

The loop should read at phone and desktop sizes, avoid flashing, and finish cleanly at any point after its minimum readable beat. It should not depend on the same large museum GLBs it is waiting for. Favor a tiny local SVG, sprite, compact animation, or already approved lightweight character asset.

Suggested visual language is warm ivory, petrol, and restrained gold, aligned with the museum rather than a generic game spinner. The final direction requires an art review. No image generation should happen during this planning task; a later concept pass can use the approved Merc identity references and preserve its prompts and source receipts.

No loading voice line or automatic sound is assumed. Loading should remain quiet unless a later audio design explicitly handles user settings, autoplay restrictions, localization, and repetition.

## Opaque concealment and input safety

The loading surface should live above the canvas as a real opaque layer, not a translucent wash. It owns focus while active and blocks pointer, keyboard, controller, and touch input from reaching the game.

Before reveal:

- the player cannot move or trigger an encounter;
- game prompts remain hidden;
- the canvas is inaccessible to pointer events;
- focus cannot fall into hidden game controls;
- orientation and resize changes keep the cover edge-to-edge, including safe areas;
- disposal on route exit removes the cover and its handlers exactly once.

A fallback visual may remain part of an explicitly approved in-game degradation policy. It must not be accidentally exposed as a temporary loading step for required art.

## Error, retry, and slow-load behavior

Handle at least these failure families:

- manifest or route data unavailable;
- required network asset unavailable;
- decode or parse failure;
- corrupted or incompatible asset;
- WebGL or GPU context failure;
- renderer installation failure;
- offline visit without the required cached files.

Do not label a merely slow download as failed after an arbitrary short timeout. A slow state can change the copy to `Still opening the gallery` and expose `Cancel`; an actual retry action should follow a concrete failure or a deliberate owner timeout policy.

Retry must create or advance a visit token so prior callbacks cannot win. Decide during implementation whether it retries only failed resources or reconstructs the scene host after renderer/context errors. In either case, the screen stays opaque until a new stable-frame readiness signal.

## Reduced motion and accessibility

When `prefers-reduced-motion` is active:

- replace the Merc loop with a static approved pose or a very subtle nonessential opacity change;
- avoid parallax, sweeping light, rapid scale, and repeated bounce;
- keep the reveal cut or fade brief;
- preserve readable status and all error actions.

The two-second content minimum can remain for the first pilot while motion is disabled, but whether reduced-motion users should receive a shorter minimum is an explicit acceptance question.

Accessibility requirements for a future implementation:

- sufficient contrast and no flashing content;
- live status updates that are infrequent and meaningful;
- error focus moves to a clear heading or the primary retry action;
- keyboard, switch, controller, and touch access to retry and cancel;
- localized, resizable text that is not baked into art;
- safe-area coverage and no clipped controls at small phone heights;
- status copy that does not promise a microphone is listening.

## Performance rules

- The loading presentation asset must be tiny, local, cached, and available before the large scene assets.
- Start critical requests concurrently where dependencies allow.
- Do not add a heavyweight font, video, or 3D bundle solely for the loading screen.
- Show percentages only from a trustworthy denominator.
- Record real readiness duration separately from the optional presentation hold.
- Measure first stable frame, critical bytes, decode/install time, and repeat-visit behavior.
- Dispose canceled and superseded loaders without retaining geometry, textures, timers, or listeners.

Useful telemetry can remain local during development. Product analytics are a separate decision and must not be assumed by this plan.

## Branded presentation data

The presentation should be campaign- or route-family data rather than runtime checks for individual level IDs. A reusable recipe can declare:

- brand artwork or animation recipe;
- copy set and localization keys;
- minimum visible duration;
- reduced-motion recipe;
- theme colors and logo treatment;
- critical asset manifest reference;
- reveal transition.

The original Glassworks route must continue to function if it uses the default presentation. New museum routes can opt into the branded Merc recipe through data.

## Proposed delivery sequence

- [ ] **Acceptance decision:** approve two seconds, fast-ready behavior, repeat-visit policy, and retry timing.
- [ ] **Readiness inventory:** identify the current scene's real critical assets and first-stable-frame seam.
- [ ] **State contract:** add cancellation-safe loading status and critical/optional manifests without designing final art.
- [ ] **Low-fidelity opaque prototype:** prove concealment, readiness, retry, cancel, and reduced motion with existing primitives.
- [ ] **Merc concept pass:** only after the behavior prototype, approve one lightweight animation direction and copy set. Image generation is a later optional production tool, not part of this plan.
- [ ] **Host integration:** add the branded presentation through route data while preserving the original route.
- [ ] **Real-device acceptance:** review timing and polish on cached, normal, slow, offline, phone, desktop, and reduced-motion cases.

These are future tasks and should remain unchecked until the corresponding work is built and verified.

## Verification matrix for a future implementation

| Scenario                              | Expected result                                                                          |
| ------------------------------------- | ---------------------------------------------------------------------------------------- |
| Cached assets ready in 0.4 s          | Requests start immediately; opaque screen dismisses at about 2.0 s in the pilot policy   |
| Assets ready in 2.8 s                 | Screen dismisses as soon as the stable frame arrives; no extra two-second delay          |
| Required GLB fails                    | Opaque error state with Retry and Cancel; no partial scene flash                         |
| Retry succeeds                        | New load token reaches a stable frame; stale callbacks cannot dismiss it                 |
| User cancels during decode            | Host returns safely; late decode/install cannot reveal or mutate the departed route      |
| Optional ambient audio is late        | Visual scene may reveal only if audio was declared optional and can fade in safely       |
| Required collision installs after art | Readiness remains false until visual and physical states agree                           |
| GPU context is lost                   | Opaque recovery/error path; no frozen partial frame presented as playable                |
| Reduced motion                        | Static Merc treatment and short reveal transition; all status and controls remain usable |
| Small phone with safe areas           | Cover remains edge-to-edge and Retry/Cancel stay visible and reachable                   |
| Original route                        | Uses its declared default or branded recipe without a level-ID workaround                |

Visual verification should include a frame-by-frame recording or targeted screenshots around dismissal to prove there is no placeholder, texture, camera, or collision reveal. This document does not authorize running that browser work today.

## Decisions still open

1. Accept the recommended 2.0-second initial minimum, choose another duration, or prefer fastest-ready dismissal.
2. Apply the minimum on every visit, only the first visit in a session, or only the first visit to a route.
3. Should a retry skip the minimum after the player has already seen the presentation?
4. Which Merc action and copy set best represent the museum?
5. Which exact assets are critical at spawn, and which can arrive later without a visible or physical mismatch?
6. Does any opening audio block readiness?
7. Should reduced-motion preference also shorten the minimum duration?
8. Is honest byte progress available, or should the first release use stage labels only?
9. What slow-load threshold changes the copy or exposes additional recovery help?
10. What lightweight asset format gives Merc enough character without becoming a new loading dependency?

## Explicit non-goals for this plan

- implementing the loading state or readiness contract now;
- generating Merc art or animation now;
- slowing downloads to fill a two- or three-second animation;
- revealing a playable scene because a timer elapsed before required assets were ready;
- adding fake percentage progress;
- changing current route content or claiming current loading polish is complete;
- running browser or visual acceptance during this planning task.
