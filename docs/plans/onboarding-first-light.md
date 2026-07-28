# First Light — onboarding

Status: **in progress** — Phase 1 started 2026-07-28. Phases 2–4 not started.

The first-run experience: a branded, two-track onboarding that replaces the
setup-first welcome modal. Design artifact (beats, Map, art direction):
published separately; this file is the implementation source of truth.

## Why

A new visitor's first thirty seconds currently look like this: a modal appears
(`src/components/WelcomeScreen.tsx`) and asks them to grant microphone access,
pick their singing voice range from a dropdown, and choose an accuracy tier —
before they have heard a single note, seen anything move, or been given any
reason to care. It is a settings dialog wearing a welcome's clothes.

Three specific problems:

1. **Configuration before value.** Range and accuracy tier are questions a
   first-timer cannot answer ("am I a baritone?") and does not yet want to.
2. **The best asset in the building is behind a 90px pill.** `/mirror` (the
   Voice Mirror) is a complete, instrumented, 60-second experience that listens
   to you and reports your range, steadiness, and which legendary singer you
   overlap with. It is a separate HTML entry, so the welcome screen's "Voice
   Mirror" pill is a *full-page navigation out of the app*. Our strongest first
   impression currently doubles as an exit.
3. **No account moment.** Sign-up exists only in Settings → Account and a header
   pill. There is no point in the product where a user has just made something
   and is asked to keep it.

Plus a bug: `showWelcome` is `welcomeSeen() !== APP_VERSION`
(`src/stores/ui-store.ts`), so the welcome modal re-imposes itself on returning
users after **every version bump**. A seen flag should be a seen flag; version
news belongs in the existing `ChangelogModal`.

## The concept

The brand is *Liquid Precision* — quicksilver, obsidian, a spectrum meniscus
([BRAND.md](../branding/BRAND.md)). The Voice Mirror already extends that into a
night sky ("Sing the Universe", legend constellations). First Light is the
bridge:

> **The sky starts dark. Your voice lights it.**

Seven beats. Every beat is the same branded frame: an obsidian field, a radially
symmetric composition centred on the quicksilver meniscus, one headline, one
stage, one primary action.

| # | Beat | What the user sees | Track | Time |
|---|---|---|---|---|
| 1 | **Sky** | Dark field, dead constellation, Merc drifts in. *"Your voice, made visible."* One button: **Sing one note** | spine | ~5s |
| 2 | **First light** | Mic asked here, framed by what it buys → they sing → a star ignites at their pitch, the meniscus ripples, note + Hz resolve | spine | ~20s |
| 3 | **Fork** | *"That's a G3. Want the whole map?"* → **Map my whole voice** or **Take me in** | spine | — |
| 4 | **Voiceprint** | Glide → Hold → Match 5 (the existing Mirror tasks, restaged). Range draws as a constellation arc | fork | ~90s |
| 5 | **Twin** | *"Your range overlaps Freddie Mercury's."* Portrait, numbers, share card | fork | ~10s |
| 6 | **Map** | Every room, with **your** first stop lit. The screen they keep | spine | ~15s |
| 7 | **Keep** | The twin offer, portrait still on screen. Skipped when there is nothing to keep | fork | ~20s |

Spine ≈ 25s. The fork is self-selected depth, never a toll. Everyone lands on
Home with Ascent week 1 armed and today's session generated.

### Design language

- **Symmetry.** Radially symmetric about the meniscus at optical centre; the
  stage grows outward, copy sits above and below on the same axis. Rotating a
  beat 180° should still balance.
- **Sky.** Obsidian `#0d1117` ground, quicksilver nebula, spectrum particle
  constellation. Stars ignite; they never twinkle.
- **Accents.** Spectrum `#58a6ff → #2dd4bf → #bc8cff` for anything live. Chrome
  family for the meniscus and bevels. Never more than one spectrum element
  active at a time.
- **Type.** Outfit 600–700 at marketing scale (Display L 48/56 desktop, H1 36/44
  mobile); Inter for body; tabular numerics for Hz and cents.
- **Motion.** Liquid: 400–700ms, `cubic-bezier(.22,.61,.36,1)`, weighted, never
  bouncy. Beat transitions cross-dissolve with a 2% scale settle. Under
  `prefers-reduced-motion` every transition becomes an instant state change and
  the ambient loop is replaced by its poster frame.
- **Mobile.** Same seven beats, one column, stage above the fold, primary action
  in the bottom third. No beat requires a scroll.

## The Map (beat 6)

The answer to *"what can I actually do here?"* — a constellation of rooms,
personalized. Six primary rooms, each a card with a plate, one verb-led line and
a direct entry:

| Room | Line | Target |
|---|---|---|
| **Practice** | See every note as you sing it, with per-note accuracy | `TAB_SINGING` |
| **Exercises** | 14 drills for range, agility, intervals and control | `TAB_EXERCISES` |
| **The Ascent** | A seven-week guided path — one orb at a time | `TAB_PATH` |
| **Karaoke** | Load any song, split the vocal out, sing it with lyrics and scoring | `/karaoke` |
| **Jam** | Sing together in real time — share a room code | `TAB_JAM` |
| **Analysis** | Pitch traces, harmonics and consistency, in plain language | `TAB_ANALYSIS` |

Plus one "and also" strip: Challenges, Leaderboard, Community, Compose, Guitar,
Piano, Voice Mirror, Glass.

**Constraint:** the Map must render a 4-, 6- or 8-room set without reflowing.
PR #359 adds two more home cards (Jam Rooms, "Hear Yourself"); when it merges,
absorbing them must be a data change, not a layout change.

**Your first stop is lit** — a pure module `first-stop.ts` reading the
`MirrorResult` shape from `src/lib/mirror/metrics.ts`:

| Signal | Room | Reason shown |
|---|---|---|
| Low steadiness | Exercises · Long Note | Your tone wavers — let's steady it |
| Low accuracy | Exercises · Interval Trainer | Your ear is close but not locked |
| Narrow range | The Ascent · Range week | There's more voice up there than you're using |
| All strong | Karaoke | You're ready to sing a real song |
| No voiceprint | Practice | Start here — everything else branches off it |

**Replayable** from the header `?`, Settings → Guide, and `#/guide` — the overlay
pattern `showAdminWeekly` / `#/admin/weekly` already uses. Replaying re-runs the
first-stop logic against the *latest* practice data, so it stays useful at week
six. It also becomes the natural home for `PAGE_TOUR_CATALOG`: each room card
gets a "take the tour" affordance calling `startPageTour(tab)`.

## The twin is the incentive

Today a voiceprint is disposable: `mirror.baseline.v1` and `mirror.attempts.v1`
are localStorage only (`src/lib/mirror/baseline.ts`, `attempts.ts`), capped at
12 takes, and gone with the browser, the device, or a cache clear. Nobody is
told this.

So the offer is specific rather than generic "save your progress":

> **Freddie Mercury is your twin.** Keep him — and every voiceprint you make
> from here, so you can watch your range grow.

What an account persists:

- **Your twin**, on your profile, permanently — not a modal that disappears.
- **Voiceprint history**, uncapped, on every device.
- **Share cards**, re-generatable any time from any past voiceprint.
- **The growth story.** `computeDelta` (`metrics.ts`) already computes
  range/accuracy/steadiness deltas — it is just anchored to a single local
  baseline. With an account it becomes a real timeline: *"+3 semitones since
  March."* This is the retention hook, and it is mostly already written.

Work implied (Phase 3): a `voiceprints` table on the db-worker (`userId`,
`createdAt`, `summary` JSON, `twin`, `source`) plus a migration following the
`scripts/migrate-*.sql` convention; a sync path on sign-in that uploads local
takes so nothing is lost in the upgrade; and a **Profile → Voice** section
rendering the twin portrait (`src/features/mirror/LegendCaricature.tsx`), the
range arc, the take history, and re-share (`card-renderer.ts`). Anonymous users
keep working exactly as they do now — local, capped, no nagging.

## Account CTA — earned moments, never a wall

Nothing is ever locked, and every ask follows something the user just did.

1. **After the voiceprint** (beat 7) — the twin offer, portrait on screen.
   "Not now" is the same size and keeps the local voiceprint and card.
2. **First streak day 2** — *"Two days. Don't lose the streak."* In the streak
   card on `HomePage.tsx`.
3. **First challenge score** — *"Ranked #14 this week. Sign in to hold your
   place."*
4. **First share** — offered, never required.

Copy always names what an account buys, concretely. A dismissed ask does not
return for 7 days (one persisted timestamp).

## Architecture

New feature folder `src/features/onboarding/`:

```
FirstLight.tsx            beat orchestrator + shared frame (lazy-loaded)
beats/BeatSky.tsx         beat 1
beats/BeatFirstLight.tsx  beat 2 — mic + single-note ignition
beats/BeatFork.tsx        beat 3
beats/BeatVoiceprint.tsx  beat 4 — wraps the Mirror task engine
beats/BeatTwin.tsx        beat 5
beats/BeatMap.tsx         beat 6 — also mounted standalone for replay
beats/BeatKeep.tsx        beat 7 — account CTA
StarField.tsx             the sky: canvas particles + star ignition
first-stop.ts             pure: MirrorResult → recommended room + reason
funnel.ts                 onboarding_* telemetry
onboarding.module.css
```

Plus `src/stores/onboarding-store.ts` (beat index, chosen track, captured
`MirrorResult`, completion + replay flags) on `createPersistedSignal`
(`src/lib/storage.ts`).

### Reuse — a presentation shell, not a new engine

| Need | Already exists |
|---|---|
| Mic acquisition, device fallback, error states | `src/lib/mic-manager.ts` (`micManager`) |
| Live f0 frames | `src/lib/pitch-f0-stream.ts` (`createF0Stream`) |
| Range / accuracy / steadiness maths | `src/lib/mirror/metrics.ts` (`computeMirrorResult`) |
| Task ordering state machine | `src/lib/mirror/session.ts` (`reduceSession`) |
| Legend twin | `src/lib/mirror/singer-match.ts`, `src/features/mirror/LegendCaricature.tsx` |
| Share card render / copy / download | `src/features/mirror/card-renderer.ts` |
| Live pitch visualisation | `src/features/mirror/LiveViz.tsx` |
| Mascot, six states, pointer-follow | `src/components/Mascot.tsx` |
| Room cards + artwork | `src/features/home/DestinationGallery.tsx` (`HOME_DESTINATIONS`) |
| Spotlight tours | `startPageTour`, `PAGE_TOUR_CATALOG` in `src/stores/app-store.ts` |
| Funnel telemetry pattern | `src/features/mirror/funnel.ts` |

All `src/lib/mirror/*` modules are pure and unit-tested; they import cleanly
into the main bundle. `FirstLight` is `lazy()`-loaded (matching `SessionBrowser`
et al. in `src/App.tsx`) so it costs returning users nothing.

### Changes to existing files

- **`src/components/WelcomeScreen.tsx`** — reduced to a minimal branded door:
  wordmark, one line, **Show me around** / **Skip — take me in**, and the
  Terms/Privacy consent line. The mic pill, Find my voice, range selector, tier
  selector and Mirror/Glass pills are removed here and live in the flow or the
  Map.
- **`src/stores/ui-store.ts`** — `showWelcome` stops keying off `APP_VERSION`.
- **`src/App.tsx`** — mounts `<FirstLight>` alongside the existing
  `<WelcomeScreen>` / `<GuideSelection>` / `<Walkthrough>` block; registers
  `#/guide`.
- **`src/stores/settings-store.ts`** — the voiceprint writes `vocalRangePreset`
  directly, replacing the dropdown. Accuracy tier defaults to `singer` and stays
  in Settings.
- **`src/pages/HomePage.tsx`** — the day-2 streak account nudge.

### Telemetry

An `onboarding_*` event set mirroring `src/features/mirror/funnel.ts`: one event
per beat entered, `mic_granted` / `mic_denied`, `track_short` / `track_full`,
`map_room_clicked` (which room), `account_created` / `account_dismissed`.
Beaconed to the db-worker like the Mirror events, degrading silently with no API
configured. Without this we cannot tell whether any of it worked.

## Art

Higgsfield, same rules and budget as the Jam stills in PR #359 — brand palette,
**no people, no text**, webp. Assets land in `public/onboarding/`.

| Asset | Spec | Budget |
|---|---|---|
| Sky hero — desktop | 1920×1080, obsidian field, quicksilver nebula, spectrum particle constellation, wide dark centre held for the meniscus | ≤ 60 KB |
| Sky hero — mobile | 1080×1920 recomposition (not a crop) | ≤ 45 KB |
| Room plates ×6 | 1600×900, one per Map room, echoing each room's visual language | ≤ 45 KB ea. |
| Ambient loop | 5s seamless, 1920×1080, slow nebula drift only — no camera move | ≤ 600 KB + poster |

Generate the hero first and reuse its style reference across the plates so the
set is coherent (BRAND.md §6 workflow). The loop is progressively enhanced:
poster frame first, video only on fine-pointer / non-`save-data` /
no-`prefers-reduced-motion`.

## Phases

**Phase 1 — Spine.** Store, `FirstLight` shell, the shared branded frame, beats
1/3/6 with placeholder art, minimal `WelcomeScreen` door, `#/guide` replay
route, telemetry. Runs end to end with no mic and no generated art.

**Phase 2 — Voice.** Beat 2 (mic + single-note ignition), beat 4 (voiceprint via
the Mirror engine), beat 5 (twin + share). The mic-denied path is built here as
a first-class route.

**Phase 3 — Map & account.** Real Map content, `first-stop.ts` + tests, per-room
tour hooks, the `voiceprints` table and sync, Profile → Voice, beat 7, and the
three later earned-moment nudges.

**Phase 4 — Art & polish.** Higgsfield generation, the ambient loop and its
fallbacks, motion pass, reduced-motion pass, mobile pass, then the tour walker
(the Map adds `data-tour` targets and a new Home tour step).

## Verification

- `pnpm check` clean after every phase.
- `pnpm test:run` — unit tests for `first-stop.ts` (every branch plus the
  no-voiceprint fallback) and the onboarding store's resume/skip/replay
  transitions.
- `src/e2e/onboarding.spec.ts`: fresh profile → door → short track → Map → Home;
  and fresh profile → full track with a synthetic mic → voiceprint → twin → Map.
  Assert the mic-denied path reaches the Map.
- Manual: 1440×900 and 390×844, dark and light, plus one forced reduced-motion
  run.
- `pnpm run test:tours` — required once Phase 4 adds a tour step.
- Lighthouse on the first-run route: the added assets must not push LCP past
  2.5s on a throttled 4G profile.

## Settled

- Branch `feat/onboarding-first-light`, based on `main`.
- Two-track first run: ~25s spine, ~90s optional fork.
- Account CTA is earned-moment and dismissible; the twin is the offer.
- The old welcome becomes a minimal door (onboard, or skip straight in).
- Art: backdrops, six room plates, and the ambient loop with fallbacks.
