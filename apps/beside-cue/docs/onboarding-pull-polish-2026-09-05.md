# Pull integration and pre-merge polish

This implements the September 5 intake and the bounded pre-merge polish from
the plans in `personal/besidecue/plans/2026-09-04-next-milestones/` in dotfiles.
The later V1 roadmap, record collection, complete translations, and newly
generated Corky closing reaction are not included.

## Cast and access

The original six remain free: Scroll (`scrolling`), Sugarlump (`snacking`),
Usual (`familiar-ritual`), Ember (`two-minute-pause`), Dinger
(`one-tap-convenience`), and Fog (`avoidance`). Custom text remains free.

Pro adds Thimble, Tab, Bookmark, Match, Pillow, Kettle, Ticker, and Tape. The
native store entitlement already owned by `pro-access.ts` is the only unlock
authority. Missing/loading/expired entitlement is locked. Both pickers show
the extras in a collapsed **Show premium** shelf. Expanded previews use stills,
not eight live movies. A disabled radio remains accompanied by readable name,
description and lock status. Settings remains the purchase/restore entry.

Selection callbacks, continuation, and the App's new-plan persistence boundary
also check access. Revocation before saving clears an uncommitted premium draft
and returns to the free choices. An already authorized in-flight save finishes
normally. Existing saved plans, reminders and history are never deleted by an
entitlement change. The basic cue loop remains usable.

## Media contract

All fourteen built-ins now have present/hold/recede/end entries. The existing
Scroll, Sugarlump and Fog pairs are untouched. Eleven additional pairs are
prepared offline by `scripts/prepare-beside-cue-pull-expansion.py` from the
downloaded Gemini directory in dotfiles. Original raw audio and downloads are
preserved there; app delivery strips the generated audio.

- Opaque 720 × 1280 H.264, High profile, level 3.1, 24 fps, yuv420p, faststart.
- One fixed P02 room. No runtime chroma key, canvas rendering, alpha-video
  compositing, extra AudioContext, or changes to the working playback adapter.
- The entrance endpoint determines shared scale, floor position and hold.
  The first exit frame uses that hold. A bounded edge translation keeps the
  smaller source frame's cutoff outside the room; the exit ends in six P02
  frames. There is no replacement ambient room.
- Paper characters have a tighter chroma matte; Pillow uses a sampled chroma
  window and connected-silhouette cleanup to preserve violet fabric and eyes
  while keeping the gap between its legs open. Other characters use chroma ratio.
  Pillow's two downloads have measurably different backing saturation, so each
  beat uses its measured key window. The audit rejects pink backing in the
  known-empty room and floor; a decodable movie alone is not sufficient.
- `media-source/onboarding/pull-expansion-v1/manifest.json` records exact input
  names and hashes. Public `SHA256SUMS` records every delivery file.
- `scripts/audit-beside-cue-pull-expansion.py` checks hashes, stream count,
  dimensions/profile/frame rate/count, faststart, full decoding and final-plate
  error, and makes cropped motion review sheets. Re-run after media changes.

Known source issue: **Usual's open-eye exit still changes eye shape**. This is
the supplied `v1_eyes_poping_out_…` take, chosen for its matched starting pose.
The alternative begins with shut eyes. Neither has been described as repaired.
A new clean take can replace the two delivery artifacts without another runtime
change. New premium lines are captions only; no unrecorded voice is advertised.
The [24-line premium recording pack](premium-pull-voice-recording-pack-2026-09-05.md)
provides exact caption-matched Meet/Present/Recede scripts, filenames and direction.

The misnamed Bookmark and Tape walk-ins in dotfiles now use `b03-…-present`.
The actual exits remain `b05-the-bookmark-actual-recede-…v0_1` and
`b05-the-tape-recede-…v0_2`. No source bytes were overwritten.

## Interaction and Home polish

`interaction/selection.ts` exports reusable `NoSelect`, `Selectable`, and
`NonCopyableArt` attribute sets. App chrome defaults to no text selection.
User-owned plan text explicitly opts into selection and `dir="auto"`; inputs,
textareas, contenteditable hosts and native select/options retain native
interaction. Only isolated artwork and the dial surface suppress iOS callouts.
There is no global `preventDefault`, `selectstart`, context-menu suppression,
or selection-clearing listener. Global game handlers ignore native controls
before generating new intents; key-up still releases previously held keys.

Home displays one BC-000 companion pressing with an accessible A/B flip.
The pressing uses the approved landing study's turquoise grooves and Corky
label without animated SVG filters or a new per-frame rendering loop. Plan
text stays in stationary copyable HTML, outside the artwork. Cue me now stays
primary, music mute remains top right, and reflection owns the counts. Quiet's
Side B handoff uses the approved Corky rest artwork until a new reaction is
delivered; it does not claim to animate the missing nod.

Onboarding keeps bottom-left mute in a separate safe footer. The six choices
and premium disclosure share one content flow, with native scrolling on small
screens and at enlarged text sizes. The accepted soundtrack loop/quiet Home
continuation, compact reminder clock, and removal of the duplicate title line
are carried forward in this branch.

## Localization boundary

Follow-up: the [Spanish/German voice preview](localization-voice-preview-2026-09-05.md)
supersedes the English-only state below for the core app route. This section
records the earlier polish milestone, not the current language availability.

The app is **not fully localized yet**. `i18n/messages.ts` introduces typed
English keys for touched Home/shared premium/audio copy, explicit supported
locale resolution and a presentation-only local-time formatter. English is
the only available catalog; there is deliberately no public incomplete
language menu. UI, content captions, ARIA, notifications, native purpose text,
and store materials still need the planned full-route migration and review.

Release targets are English, Spanish, Croatian and German. Italian is optional.
Missing target-language recordings must remain caption-only rather than playing
an unrelated English voice. User text, stable IDs and persisted `HH:mm` values
must never be translated. The existing 200% text fixture exercises expansion;
human translation and native-device language acceptance remain later gates.

## Verification and remaining device check

Focused content, access, runtime, audio, App and native-input tests; package
typechecking; real-browser compact onboarding/reminder layout, premium lock,
copyable text, native time input and real-mouse dial capture checks. Media has
a separate full-decode audit. PR CI remains the repository-wide gate.

Desktop Chromium checks are not physical iOS certification. The optional WebKit
run (`BESIDE_CUE_WEBKIT=1`, project `webkit`) could not launch on this host because
its Linux libraries are missing; it is not reported as passing. TestFlight
should confirm all six free entrances/exits, an unlocked premium pair, long
holds/music continuity, a long-press/drag on the reminder record, copied custom
text and mute on a real iPhone. Purchase/restore also needs native store sandbox
validation. Do not declare these device checks complete from desktop tests.
