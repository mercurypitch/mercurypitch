# Voiceprint share link + droppable card

Branch: `feat/voiceprint-share-link`. Planning only — no code in this pass.

## Why

Measured on GA4 property 545453517, last 30 days:

|                                             |                 |
| ------------------------------------------- | --------------- |
| `card_generated`                            | **310 users**   |
| Return sessions tagged `voiceprint / share` | **4**           |
| Average duration of those sessions          | **3.0 seconds** |

310 cards a month return four people, and those four leave in three seconds. The loop
exists, is instrumented, and delivers nothing.

**The cause is known and is in the code.** `src/features/mirror/card-renderer.ts` already
tags the share text and says so in a comment:

> The same destination in share text, where it IS clickable. Tagged so card-driven traffic
> is separable in GA4. **When the short link ships, this constant is the only line that
> changes.**

The share text points at `/mirror` — the _generic_ Mirror page. Someone who receives a
friend's voiceprint lands on an empty instrument that asks them to sing. They did not come
to sing; they came to look at the thing they were sent. Three seconds is exactly what that
mismatch should produce.

## What already exists

Most of this is built. The work is smaller than it looks.

| Piece                        | Where                                     | State                                                                                                                                 |
| ---------------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Short-link service           | `src/share-handler.ts`                    | **Done.** `POST /api/share/shorten`, `GET /api/share/s/:id`. KV-backed, 60-day TTL, base62 10-char ids, 64 KB cap, 20 shortens/IP/min |
| Self-contained payload codec | `src/lib/share-codec.ts`                  | **Done.** base64url `SharePayload {v,t,d}`                                                                                            |
| Routing for both forms       | `src/lib/hash-router.ts:222,229`          | **Done.** `/s/:shortId` and `/share/<payload>` already parse                                                                          |
| Card renderer                | `src/features/mirror/card-renderer.ts`    | **Done.** 1080x1920 + 1080x1080, Web Share API with download fallback                                                                 |
| Stored-record adapter        | `src/features/mirror/voiceprint-share.ts` | **Done.** Rebuilds a card from a `VoiceprintRecord`                                                                                   |
| Funnel + Ads conversion      | `src/features/mirror/funnel.ts`           | **Done.** `card_shared` maps to an Ads conversion                                                                                     |
| UTM capture incl. hash query | `src/lib/acquisition.ts`                  | **Done.**                                                                                                                             |

## What is missing

Exactly three things.

1. **A voiceprint cannot be encoded.** `ShareType` is `'melody' | 'exercise' | 'routine'`
   (`share-codec.ts:20`). There is no voiceprint payload.
2. **There is no recipient view.** Even with a link, nothing renders someone _else's_
   voiceprint.
3. **The PNG carries no data.** It is a flat image, so it cannot be dropped back into the
   app.

---

## Design

### 1. Payload — and a recommendation against the shortener

`share-handler.ts` gives short ids a **60-day TTL**. A voiceprint is a keepsake; a link
someone opens next year should still work. The self-contained form (`/share/<payload>`,
already routed) never expires — which is exactly why chaos-master's `OpenInApp` chose it
for flames.

**Recommendation: self-contained is the source of truth; the shortener is cosmetic.**
A voiceprint payload is roughly a dozen numbers and a name — on the order of 150–200
base64url characters, which is a perfectly ordinary URL. Offer the short link where length
is visible (a spoken URL, a bio), and let it fall back to the self-contained form.

```ts
// share-codec.ts
export type ShareType = 'melody' | 'exercise' | 'routine' | 'voiceprint'

export interface VoiceprintShareData {
  lo: number // lowMidi
  hi: number // highMidi
  st: number // semitones
  tw?: string // twin legend name
  ac?: number // accuracy score, 0-100 -- the number the card prints
  sd?: number // steadiness score, 0-100 -- likewise, and NOT cents
  vb?: [number, number] // vibrato Hz, cents
  on?: number // onset ms
  n?: string // display name — opt-in, absent by default
  d?: number // created, day resolution only
}
```

**Privacy boundary, deliberately narrow:** only the numbers already printed on the card
face. No audio, no F0 frames, no user id, no account link, no exact timestamp. Nothing in
the payload is anything the recipient could not read off the image they were already sent.
The display name is opt-in and absent unless the sender types one.

Widen `hash-router.ts`'s `share-load` union to include `'voiceprint'`, and add the case to
`share-codec.ts:236`.

### 2. Recipient view — the actual fix

`/#/share/<payload>` (and `/#/s/<id>`) renders **that** voiceprint, using the renderer we
already have, and then offers the obvious next thing.

- The sender's card, large, first. Their range, their twin, their numbers.
- Below it: **Meet yours** — straight into the one-note task.
- If the sender opted into a name: _"Marko's voiceprint"_. Otherwise _"A voiceprint"_.
- Tag stays `utm_source=voiceprint&utm_medium=share` so the GA4 series stays continuous
  with the four sessions already recorded.

This is the whole fix for the 3-second bounce. Build it first and alone; it is measurable
on its own.

### 3. PNG metadata and drop-to-app

Inject a `tEXt` chunk keyed `mercurypitch:voiceprint` carrying the same base64url payload.
Canvas `toBlob` will not do this, so splice the chunk in before `IEND` and recompute the
CRC — about 60 lines, no dependency. Read it back in a dropzone on the Mirror.

**Honest caveat, and it changes the priority.** Platforms that re-encode uploads strip
custom PNG chunks. A card sent as a _file_ (Discord, email, AirDrop, Signal, WhatsApp
"send as document") keeps it; a card posted to Instagram or X, or sent through WhatsApp's
default image compression, does not. Verify per platform rather than trusting this table.

So: **the short link is the robust path and the PNG drop is a bonus.** Do not build the
PNG work first, and do not let it justify delaying the recipient view.

---

## Phases

| Phase  | Work                                                  | State                                |
| ------ | ----------------------------------------------------- | ------------------------------------ |
| **P1** | `VoiceprintShareData`, codec case, the recipient view | **Done** — 2026-09-20                |
| **P2** | Share texts carry the encoded link                    | **Done** — 2026-09-20                |
| **P4** | `shared_view` / `shared_start` funnel events          | **Done** — 2026-09-20                |
| **P3** | PNG `tEXt` chunk + Mirror dropzone + "make yours"     | **Backlog** — owner call, 2026-09-20 |

P1, P2 and P4 shipped together because the instrumentation is what turns the fix into a
number. P3 is deliberately deferred: the platforms that matter most for reach re-encode
uploads and strip the chunk, so it is the delightful path rather than the robust one.

### What landed

| File                                              | Change                                                                                   |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `src/lib/share-codec.ts`                          | `'voiceprint'` share type, `VoiceprintShareData`, `encodeVoiceprintForShare`, validation |
| `src/lib/mirror/shared-voiceprint.ts`             | **New.** Link building and reading, `MIRROR_SHARE_URL`, range and span formatters        |
| `src/features/mirror/SharedVoiceprintWelcome.tsx` | **New.** The recipient's first screen                                                    |
| `src/features/mirror/MirrorApp.tsx`               | Reads the link, shows the card, stands the landing down, clears the payload on hand-off  |
| `src/features/mirror/card-renderer.ts`            | `defaultShareText(link)` / `twinShareText(twin, link)`; one URL definition               |
| `src/features/mirror/voiceprint-share.ts`         | A stored record shares its own numbers                                                   |
| `src/lib/funnel-event-catalog.ts`                 | `shared_view`, `shared_start`                                                            |
| `src/features/mirror/mirror.css`                  | Styles for the new screen                                                                |

Tests: `shared-voiceprint.test.ts` (17), `SharedVoiceprintWelcome.test.tsx` (4),
`voiceprint-share-link.spec.ts` (4 e2e, against the production build), and the existing
`share-link-tagging.test.ts` extended to cover payload-carrying links.

## Open questions for maff

1. **Name on the card** — opt-in text field, or always anonymous? Affects the payload and
   the recipient headline.
2. **Does the recipient view need its own OG image?** A link pasted into Discord or
   WhatsApp currently unfurls the generic card. Rendering a per-voiceprint OG image server
   side is a separate and larger job — worth it only if the link gets pasted into chats
   more than it gets clicked directly.
3. **Short link or self-contained as the default copy button?** The recommendation above is
   self-contained, but a 200-character URL looks worse in a bio.

## Out of scope

Server-side OG image generation, any change to what the card _draws_, and the `CARD_URL`
invariant on the card face — `card-renderer.ts` deliberately keeps that bare because it is
read and typed, not clicked. Do not put a query string on the card face.
