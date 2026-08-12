# UGC distribution via Noise — integration plan

**Status:** draft, nothing live. No campaign or playbook has been activated.
**Playbook 19290 is built, complete and paused**; §8 lists the product facts a
brief must not get wrong, learned by getting them wrong first.
**Owner decision points are marked** > **DECISION** — everything else is settled.

Noise (getnoise.com) is a pay-per-view UGC marketplace: creators produce short
social content against a brief you write (a "playbook"), you set a CPM and a
budget, and you pay only for views actually delivered.

This document is the operating manual for that channel. It is deliberately
modular — each section stands alone so a single part can be revised without
rewriting the rest.

---

## 1. Connection

| Item | Value |
|---|---|
| MCP endpoint | `https://reporting.getnoise.com/mcp` |
| Transport | Streamable HTTP, OAuth 2.1 with dynamic client registration |
| REST base (read-only) | `https://reporting.getnoise.com` |
| REST auth | `x-noise-org` + `x-noise-token` headers |
| OpenAPI spec | `https://reporting.getnoise.com/openapi.yaml` |
| Org id | 13592 |

Setup, once per assistant/client:

1. Add the MCP endpoint as a custom connector (it is **not** in the MCP
   registry, so searching for it finds nothing).
2. Sign in through the OAuth prompt. The assistant is handed a connection
   code (`org_...`).
3. Paste that code in the Noise portal under **Resources → Reporting API →
   Connect an AI assistant**. Until this step the tools exist but are not
   scoped to the org.

Links are many-to-many: each teammate connects their own client, and a client
linked to more than one brand must pass a `brand` parameter (slug or id) on
every call.

**Gotcha:** if the tool list looks stale after connecting, remove and re-add
the connector. Noise adds tools without versioning the connection.

---

## 2. Tool surface

Read: `get_daily_report`, `get_campaign_details`, `get_playbook_details`,
`get_audit_log`, `list_campaigns`, `list_playbooks`, `list_posts`

Write: `set_campaign_status`, `update_campaign_budget`, `set_daily_target`,
`update_campaign_rates`, `set_playbook_status`, `create_playbook`,
`update_playbook`, `save_playbook`, `generate_slide_image`

Three properties worth internalising:

- **Every write previews by default.** It returns current → proposed plus
  consequences and changes nothing. Only `confirm: true` applies it.
- **`save_playbook` claims to be declarative but does not delete.** Its
  description says omitted slides are removed, and its preview reports
  `1 removed`. Neither is true: the slide survives, and a replacement sent in
  the same call is *added alongside* it. Verified twice on playbook 19290 on
  2026-08-12 — two calls omitting slide 151213, both returning success, and
  the slide still present in `get_playbook_details` afterwards, with no
  deletion in the audit log. Still read-modify-write, but for the opposite
  reason: not to avoid losing slides, but to avoid duplicating them.
- **`generate_slide_image` appends, it does not replace.** Each call adds
  another image to the slide, and the slide then shows them in sequence. It
  returns `imageCount: 1` every time regardless, so the response cannot be
  used to tell an append from a replace. Three calls on slide 151213 produced
  three stacked images.
- **Nothing can delete anything over MCP** — not playbooks, not slides, not
  slide images. `set_playbook_status` deactivates; that is the whole of it.
  Deletion is a portal action.

Together those three make **slide images effectively write-once over MCP**.
Attach an image only when the slide is final: a wrong one cannot be replaced
or removed without opening the portal. Preview the *content* freely, but treat
every `generate_slide_image` call as permanent.

Worth reporting to Noise: a declarative endpoint whose preview reports
deletions it does not perform is the kind of thing that quietly corrupts state
for anyone automating against it.

Everything is audited (`get_audit_log`) and guardrailed — CPM and budget caps,
plus a per-day cap on AI image generation.

---

## 3. Spend control

Current campaign **15773 "My Niche Campaign"** — paused, has never spent.

| Field | Value | Changed by |
|---|---|---|
| Budget | $1,500 | `update_campaign_budget` |
| Window | rolled forward 2026-08-11 | rolls on `set_daily_target` |
| Daily target | **$20/day** | `set_daily_target` |
| Rate | $0.002/view = **$2 CPM** | `update_campaign_rates` |
| Status | paused | `set_campaign_status` |
| Spent | $0 (0% utilisation) | — |

**The $1,500 is a ceiling, not a commitment.** Noise bills per view delivered.
Pausing after three days at target spend costs $150, not $1,500. Both the
campaign and each individual playbook can be paused independently and at any
time, so there are two separate kill switches.

At $2 CPM, $20/day buys roughly 10,000 views/day.

**Changing the daily target rolls the budget period forward**, so pacing
restarts from the moment of the change. That is a useful side effect: the term
had been burning calendar since 2026-08-09 at zero spend, and setting the
target to $20 reset it. Worth knowing before changing the target on a campaign
that is genuinely mid-flight, where a roll is not free.

At $20/day the $1,500 budget spans about 75 days — well past the 31-day term,
so the term, not the budget, is the binding constraint.

---

## 4. Creator selection

Noise is a **marketplace, not a casting service**. Creators browse open brand
offers and opt in; there is no tool — and, as far as the API surface shows, no
mechanism — for hand-picking individuals up front.

The levers that actually shape who shows up:

| Lever | Field | Effect |
|---|---|---|
| Campaign type | `type: "niche"` | Scopes the offer to a content niche rather than open-market |
| Creator cap | `max_creators` (currently `null`) | Bounds how many can participate |
| CPM | `update_campaign_rates` | Higher rates attract more and better creators |
| The brief itself | playbook slide prompts | The strongest filter — a specific brief self-selects |

In practice the playbook is the casting call. A brief that names the format,
the energy, and the payoff filters harder than any targeting parameter.

**Unverified:** whether the portal offers per-creator approval, blocklists, or
content review before a post goes live. The Notion how-to guides are
JavaScript-rendered and the portal needs a login, so neither was readable from
here. Worth ten minutes in the portal before spending — if a review gate
exists, it changes how tight the first brief needs to be.

---

## 5. Attribution — how UGC traffic is separated

**This already works. No code is required.**

`src/lib/acquisition.ts` captures `utm_source`, `utm_medium`, `utm_campaign`,
`utm_content`, `utm_term` and `gclid` on first meaningful touch, stores them in
`localStorage`, and attaches them as `acq` to every funnel event body. It reads
both `location.search` **and** the hash query, because the app is a hash router
and `/#/karaoke?utm_source=…` hides params from `location.search`.

`src/features/mirror/funnel.ts` already tracks the full Voice Mirror funnel —
view → mic granted → tasks → results → **shared** — and maps three milestones
to Google Ads conversion actions:

| Funnel event | Ads conversion |
|---|---|
| `results_view` | `mirror_complete` |
| `cta_app_click` | `app_open` |
| `card_shared` | `card_shared` |

So the loop is already measurable end to end. The only thing missing is a
tagged link.

### The link scheme

```
https://mercurypitch.com/mirror?utm_source=noise&utm_medium=ugc&utm_campaign=voice-mirror&utm_content=<playbook_id>
```

Keep `utm_source=noise` fixed so all Noise traffic is separable in one filter.
Vary `utm_content` per playbook to compare briefs against each other.

### Which surface carries which link

There are **three** places a URL reaches a viewer, and they must not share a
tag. Conflating them is the easiest way to make this channel look better than
it is.

| Surface | Where it lives | Carries | State |
|---|---|---|---|
| UGC post description | the creator's caption / bio | short link with Noise UTMs | pending short link |
| Printed on the card | `CARD_URL` in `card-renderer.ts` | bare `mercurypitch.com/mirror` | shipped |
| Share text | `DEFAULT_SHARE_TEXT` / `twinShareText()` | `utm_source=voiceprint&utm_medium=share` | shipped |

**The printed URL stays clean.** It is pixels, not a link — people read it and
then type or search it. A short code (`/m/n1`) is harder to type, easier to
mistype, and looks like spam on an otherwise premium card.

**Never put the Noise tag on the card.** A viewer who receives a card from a
friend who found us through Noise is *not* Noise traffic. Tagging the card
would attribute the entire downstream organic loop to the paid channel,
permanently and invisibly, which is precisely the wrong signal when deciding
whether to keep spending.

The **share text** is the interesting one: unlike the printed URL it is a real
clickable link when shared into messaging apps, so it carries its own tag and
separates card-driven virality from both paid and direct.

**`utm_medium=share` is the bucket.** It means a human handed this card to
another human, on any surface. `utm_source` then says which card did it, so
the two card surfaces stay tellable apart inside that one bucket:

| Card | Printed | Share link |
|---|---|---|
| Voiceprint | `mercurypitch.com/mirror` | `utm_source=voiceprint&utm_medium=share` |
| Glass | `mercurypitch.com/glass` | `utm_source=glasscard&utm_medium=share` |

Each card's two constants live in its own `card-renderer.ts`, and
`src/tests/share-link-tagging.test.ts` pins the rule across both — including
that no paid-acquisition source may ever appear on a share link. The pair
looks like a duplication begging to be tidied into one; the test exists
because tidying it breaks attribution silently rather than loudly. It is
table-driven, so a new card surface registers itself by adding one row.

Three Mirror call sites (`MirrorApp` ×2, `CosmicMode`) pass no share meta and
pick up the tagged default automatically.

> **NOTE:** the share text currently carries the full UTM URL, which is long
> in a message body. When the short link ships it should replace `SHARE_URL` —
> one line, one place.

### Known limits

- **Attribution is click-only.** Viewers who see the video and later search
  "MercuryPitch" arrive untagged. Expect the tagged number to understate real
  contribution; watch total organic lift alongside it, not instead of it.
- **Long URLs get mangled** in captions and bios. A short branded redirect
  (`mercurypitch.com/m/n1` → the full tagged URL) would measurably help, and
  is small worker work.
- Noise's own `estimated_installs` metric **will not work** — it requires a
  linked App Store / Play Store listing, and there is no shipped native app
  (see `docs/plans/mobile-native/capacitor-readiness.md`). GA4 plus the funnel
  is the source of truth for conversion; Noise reports views and spend.

> **DECISION:** build the short-link redirect, or ship with full UTM URLs for
> the first test.

---

## 6. Asset pipeline

Two asset classes, deliberately kept separate.

### Real product assets

`pnpm marketing:capture --recipe voice-mirror --profile freddie` produces
`voice-mirror-freddie-card.png`, tagged `app-rendered-card` in the manifest.
The script is localhost-only by hard assertion and uses synthetic demo state,
so it can never read production or personal data.

This matters: `docs/branding/BRAND.md` §5 states that the pitch canvas and
piano roll **are** brand assets, and that real product shots should be
preferred over AI imagery. The voiceprint card is the authentic artifact.

Only one Mirror profile (`freddie`) exists today. More profiles would give
slide variety — a small extension to `scripts/capture-marketing.mjs`, not new
architecture.

### Generated brand assets

Higgsfield generates a **text-free plate**; type is composited locally by
`scripts/compose-poster.py`. See
[docs/branding/marketing/README.md](../branding/marketing/README.md) for why
and how.

The short version: letting the model render the headline means every tweak to
its position re-rolls the whole image, and the type comes back subtly wrong —
one variant dropped the full stop from the headline, another appended one to
the URL. Compositing makes position a flag and the copy exact.

Plates are scaled to width and centre-cropped to exactly 1080x1920.
Generators emit ~9:16.1, which letterboxes on a phone.

### Attaching images to slides

`generate_slide_image` accepts three sources: AI generation, an existing
asset, or **a URL**. The URL path is the bridge — Higgsfield returns public
CloudFront URLs that can be handed straight to Noise without an intermediate
upload. There is a per-day cap on the AI-generation path; the URL path avoids
it entirely.

---

## 7. The playbook

**Name:** Voice Mirror — Voiceprint Reveal
**Playbook id:** 19290, on campaign 15773
**Type:** `image_slideshow`
**Status:** built and **inactive**. Activation is a human action, never
automated.

| Slide | id | Type |
|---|---|---|
| 1 hook | 151210 | `ugc` |
| 2 action | 151211 | `ugc` |
| 3 payoff | 151212 | `ugc` |
| 4 CTA | 151213 | `image` — poster attached |

The arc is hook → action → payoff → CTA. Slides 1-3 are the creator's own
footage (`type: "ugc"`); slide 4 is our poster (`type: "image"`).

The payoff is the point: the Voice Mirror card is already a designed,
shareable, socially-sized artifact (1080×1920 story and 1080×1080 square,
rendered by `src/features/mirror/card-renderer.ts`). The creator does not have
to manufacture a reason to show the product — the product hands them one.

### Where the instructions live

A playbook describes **one post by one creator**, not one shot each for
several creators. The slides are the sequence inside that single piece of
content, which is why they are `order`ed and why the playbook has one
`example_url`.

That gives two levels, and putting the right thing at each level matters:

| Level | Field | Carries |
|---|---|---|
| Playbook | `prompt` | Where to go, what the app does, hard rules. Read once. |
| Slide | `prompt` | Direction for that shot only. |
| Slide | `<hook_captions>` | On-screen text options for that shot. |

**The destination URL belongs in the playbook prompt**, not buried in a slide.
A creator reads the brief once before filming; a slide that says "open the
app" without saying where is a brief that produces the wrong video. The first
version of this playbook made exactly that mistake.

### The slides

Live content is in playbook 19290; this is the shape rather than a second copy
to drift out of sync.

1. **Hook** (`ugc`) — you have sung your whole life and have never seen what
   your voice actually does. No product on screen. About three seconds.
2. **The run** (`ugc`) — open `/mirror`, allow the mic, do the three tasks,
   show the trail drawing itself. A cappella, explicitly no music.
3. **The payoff** (`ugc`) — hold up the finished card, react to the twin, say
   the name out loud, end on the card filling the frame.
4. **The CTA** (`image`) — the supplied poster.

**Note on emoji:** captions are written emoji-free because this file lives in
the repo, where AGENTS.md forbids them. Emoji in TikTok hook captions is
platform-native and often helps; adding them in the portal is a reasonable
choice. The repo rule governs this artifact, not the ad copy.

---

## 8. Product facts a brief must not get wrong

The first version of this playbook invented a feature. Writing a brief means
describing what the app *does*, and getting it wrong wastes creator time and
buys views of a video that misrepresents the product. What is actually true:

| Claim | Reality |
|---|---|
| "Hear yourself played back" | **Glass only.** `glass/take-recorder.ts` records the real voice for rep replay and says outright that nothing else in the app did this before. The Mirror does not play your voice back. |
| "Sing a song you know" | Not how the Mirror works, and not needed. |
| Needs an account | No. `/mirror` is a standalone entry, no auth gate. |
| Needs a download | No. Phone browser, mic permission. |

**The Voice Mirror asks for eight vocal actions, and none of them is a song.**
The sequence is fixed in `src/lib/mirror/session.ts`:

```
idle -> mic -> glide-up -> glide-down -> hold -> match(1..5) -> results
```

Glide up like a siren, glide down, hold one note steady — then **five** played
notes to sing back, one at a time, with one free retry each
(`MATCH_NOTE_COUNT = 5`). Call it two to three minutes, not one. A brief that
says "the three things it asks" sends a creator in expecting a third of the
flow.

There is also a Free Sing mode — "sing anything for 40 seconds, your shower
song counts" — which is a cappella by design.

**The twin does not need the match notes.** `singerForRange(result.range)` is
keyed off the detected low and high MIDI alone, and range is computed from the
glides at the `hold-done` transition. The payoff is therefore knowable about
twenty seconds in; the five match notes contribute accuracy, not the twin. See
§11 for why that matters.

### Why that settles the music question

**The Mirror never needs music, so no creator video for it should contain
any.** That removes the exposure rather than managing it.

Worth stating in every brief regardless: platform music libraries generally
license tracks for *personal* posts, and **branded or commercial content is
typically excluded** from that grant. A creator adding a popular track to what
is functionally an ad is a different risk from adding one to their own post,
and it is the brand that carries it. The rule for every MercuryPitch playbook
is therefore: no recorded music, or platform-cleared commercial-use audio
only.

This is a practical marketing rule, not legal advice — worth a real check
before any campaign with music in it.

### Zen exercises has no URL, and what it would take

The "zen exercises" pitch monitor is a genuinely good middle-slide surface —
it is the app visualising live pitch, which is the thing worth filming. It is
not reachable by URL today.

It is launched imperatively, not routed: `openSingingZen({ mode: 'monitor',
source })` in `src/stores/ui-store.ts` sets a `singingZenLaunch` signal, and
the Singing page's starred toolbar widget calls it. Nothing writes a hash, so
there is nothing to link to.

Three ways to give it an address, in ascending cost:

1. **Hash route** — add a `HashRoute` variant, a parse branch, and the
   open/close wiring (`src/lib/hash-router.ts` +
   `src/features/routing/useHashRouter.ts`, per INDEX §5). Yields
   `mercurypitch.com/#/singing/zen`. Two files, contained.
2. **Clean path over the hash route** — the above, plus a redirect mapping
   `/zen` → `/#/singing/zen`, so the typed and printed URL has no `#`.
3. **Standalone entry** like `/mirror` and `/glass` — its own HTML input and
   bundle. Best landing experience, much the largest change.

**For UGC, 1 alone is not enough.** A hash route lands the visitor in the full
app: heavier bundle, tab chrome, and the first-run overlays that the
browser-preview notes in INDEX §7 already call out as blocking. `/mirror` and
`/glass` work as UGC destinations precisely because they are standalone and
land on the thing itself. Option 2 is the pragmatic middle: a clean URL to
type, without building a third entry point.

Until one of those exists, the playbook uses two destinations — Glass for the
hook, Mirror for the visualisation and the card. The Mirror's glide tasks draw
the trail in real time, so the "watch your voice move" beat is already covered
without a third page.

### Glass — the natural second playbook

The "hear yourself back" hook is genuinely strong and it belongs to Glass,
which is the one surface that can actually do it. Glass also has the better
visual spectacle: a pane that shatters when the voice locks on.

Sketch, for when a Glass campaign exists:

1. **Hook** — the moment after hearing your own take replayed. This is the
   hook that was wrong for the Mirror and is exactly right here.
2. **The attempt** — lock the note, the pane stresses and cracks.
3. **The break** — it shatters. The spectacle *is* the payoff.
4. **CTA** — a Glass end card at `/glass`.

Same rules: destination in the playbook prompt, no music, a cappella.

---

## 9. Next actions

| # | Action | Owner | State |
|---|---|---|---|
| 1 | Connect the Noise MCP connector | you | done |
| 2 | Create the playbook, inactive, slides 1-4 | agent | done — 19290 |
| 3 | Attach the poster to slide 4 via URL | agent | done |
| 4 | Review the playbook in the portal, then activate | you | **next** |
| 5 | Check the portal for creator-review / blocklist controls (§4) | you | open |
| 6 | Verify per-slide captions survived the write (§7) | you | open |
| 7 | Set the daily target to $20 (§3) | agent | done — period rolled |
| 8 | Tag the share text as card-viral (§5) | agent | done |
| 9 | Tag the Glass share text (§5) | agent | done |
| 10 | Build the short-link redirect, then swap `SHARE_URL` (§5) | agent | open |
| 11 | Add Mirror capture profiles beyond `freddie` (§6) | agent | open |
| 12 | Ask Noise whether `preview_image` affects creator pickup (§10) | you | open |
| 13 | Build the Glass playbook when a Glass campaign exists (§8) | agent | open |
| 15 | Delete orphan slide 151213 in the portal (§2) | you | **next** |
| 16 | Report the save_playbook / generate_slide_image behaviour to Noise (§2) | you | open |
| 14 | Give zen exercises a URL, if it should be a UGC destination (§8) | decision | open |

Playbooks 19287 / 19288 are orphaned empty scaffolds. They are already
inactive and attached to no campaign, so they are harmless — and there is no
delete tool over MCP, so removing them is a portal action if it is possible at
all.

### Reading results

Once live, `get_daily_report` gives spend, views, posts, creators and CPM by
day, campaign and playbook. `list_posts` drills to individual posts with
engagement rate and per-post spend — useful for spotting which creators and
which hooks actually carried, and for deciding what the second playbook should
be.

Judge the test on GA4 `results_view` and `card_shared` against Noise views.
Views alone say the content was distributed; the funnel says whether it
worked.

---

## 10. Playbook has two views in the portal — and a preview-media question

**Not a bug.** A playbook opened from its link in the dashboard shows the
*posts creators made from it*, which is empty before a campaign runs. The
content lives under **Edit playbook**. Worth knowing before concluding an
MCP-created playbook failed to save — the first read of an empty posts list
looks exactly like a broken write.

Playbook 19290 is verified complete: `get_playbook_details` returns all four
slides with prompts and captions, and the audit log records `Playbook created`
(slides: 4) plus `Slide image added (url)` against slide 151213.

### The open question: `preview_image`

Two fields are `null` on 19290 and populated on 18979, which was made in the
portal:

| Field | 18979 (portal) | 19290 (MCP) |
|---|---|---|
| `preview_image` | a hosted `.jpg` | `null` |
| `example_url` | a hosted `.mp4` | `null` |
| `created_by` | a user uuid | `null` |

Neither is settable through any MCP tool, and on 18979 the portal set
`example_url` in a **separate** update two minutes after creation (audit,
2026-08-09 12:43) — a portal-side step the MCP create path does not trigger.

This no longer explains anything about the dashboard, but it may still matter
in the place that counts: **what a creator sees when browsing open offers.** A
playbook with no preview image and no example video plausibly presents as a
blank card next to brands that have both, and §4 established that creators
choose which offers to take. If so this is a pickup problem, not a display
one — the same missing field, a very different cost.

Worth confirming with Noise support, alongside whether the portal can generate
preview media for a playbook it did not create. If it cannot, the workaround
is to create playbooks in the portal and author their content over MCP, which
keeps nearly all of the benefit.


---

## 11. Improving the landing experience

UGC buys a click from someone who has never heard of us and is holding a
phone. These are ranked by expected effect on that visitor, and each one is
tied to something in the code rather than to general advice.

### Mirror: the payoff arrives far later than it needs to

The twin is the hook — it is what the creator holds up in slide 3 and what a
viewer clicks for. It is also computable about twenty seconds in, and we make
people work for two to three minutes before showing it.

`singerForRange()` keys only off detected low and high MIDI. Range is computed
at the `hold-done` transition, before a single match note is sung. Everything
after that point sharpens *accuracy*, not the twin.

So the flow could be: two sirens, one held note, **twin revealed** — then
"want your accuracy score too? five more notes." A short guaranteed win first,
depth as an opt-in second. For cold paid traffic that is the difference
between a card to share and an abandoned tab.

Worth measuring before building: the funnel already emits `task_hold_done`,
`task_match_done` and `results_view`, so the drop-off between the hold and the
results is answerable from data we are already collecting. If it is small,
leave the flow alone.

### Mirror: Free Sing is the fast path, and nobody finds it

"Sing anything you like for 40 seconds — your shower song counts" is a
gentler, shorter, more obviously fun entry than eight guided vocal actions,
and it produces a shareable card of its own. It is currently a mode inside a
flow rather than a door into one. For UGC arrivals it may simply be the better
landing.

### Mirror: check when the mic is asked, and why

First Light asks at the moment of intent, one tap after the visitor has said
they want to sing, with the reason on screen — see
`src/features/onboarding/beats/BeatFirstLight.tsx`. If the Mirror's `mic`
phase asks cold, before the visitor has committed to anything, that is
probably the single largest drop-off on the whole path, and the fix is copy
rather than engineering.

### Glass: spectacular, but not personal

Glass has the better *spectacle* — a pane shattering is more watchable than a
line being drawn. The voiceprint has the better *artifact*: "this is my voice
twin" is about the person holding it, which is why it gets posted.

The shatter card already carries real data (target note, reps, best lock,
precision in cents, peak resonance). What it lacks is an identity hook — a
"you broke it on an A4, which is where X sings" would make it a thing about
the singer rather than a scoreboard. Same trick the twin plays.

### Karaoke: a different rights posture entirely

Karaoke is the one surface where recorded music is intrinsic, so the rule that
makes the Mirror and Glass campaigns safe — no music, ever — cannot apply.
That needs deciding before any karaoke campaign exists, not during one.
Options are platform-cleared commercial-use audio only, or original and
public-domain songs. It is a real constraint on the format rather than a
detail, and it is the reason Mirror and Glass were the right places to start.

### Cross-cutting

- **Short link** (§5) — cleans up both the creator caption and the share text.
- **A URL for zen exercises** (§8) — would unlock the middle slide.
- **`preview_image` on the playbook** (§10) — may affect whether creators pick
  the offer up at all.
