# UGC distribution via Noise — integration plan

**Status:** draft, nothing live. No campaign or playbook has been activated.
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
- **`save_playbook` is declarative, not a patch.** It replaces the entire
  slide list. Any existing slide you omit is **deleted**. Always
  read-modify-write via `get_playbook_details` first. This is the main
  footgun in the whole API.
- **There is no delete tool.** Playbooks can be deactivated
  (`set_playbook_status`) but not removed over MCP. Deletion, if it exists at
  all, is a portal action.

Everything is audited (`get_audit_log`) and guardrailed — CPM and budget caps,
plus a per-day cap on AI image generation.

---

## 3. Spend control

Current campaign **15773 "My Niche Campaign"** — paused, has never spent.

| Field | Value | Changed by |
|---|---|---|
| Budget | $1,500 | `update_campaign_budget` |
| Window | 2026-08-09 → 2026-09-09 | portal |
| Daily target | $50/day | `set_daily_target` |
| Rate | $0.002/view = **$2 CPM** | `update_campaign_rates` |
| Status | paused | `set_campaign_status` |
| Spent | $0 (0% utilisation) | — |

**The $1,500 is a ceiling, not a commitment.** Noise bills per view delivered.
Pausing after three days at target spend costs $150, not $1,500. Both the
campaign and each individual playbook can be paused independently and at any
time, so there are two separate kill switches.

At $2 CPM, $50/day buys roughly 25,000 views/day.

Note the window is already running — it opened 2026-08-09 against a 31-day
term. Calendar is burning at zero spend, which costs nothing but does shrink
the runway for a test inside this term.

> **DECISION:** whether to shorten the window or lower the daily target before
> going live. A $20/day target extends the learning period at the same total
> risk.

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

Higgsfield, using the palette and shape language from BRAND.md §3 and §6
verbatim: obsidian `#0d1117`, Signal Blue `#58a6ff`, Aqua `#2dd4bf`, Violet
`#bc8cff`, chrome family, Outfit-style geometric display type.

Model `nano_banana_pro` at 9:16 / 2K renders baked headline text reliably,
which most image models do not. Generate 2 variants and check the text.

### Attaching images to slides

`generate_slide_image` accepts three sources: AI generation, an existing
asset, or **a URL**. The URL path is the bridge — Higgsfield returns public
CloudFront URLs that can be handed straight to Noise without an intermediate
upload. There is a per-day cap on the AI-generation path; the URL path avoids
it entirely.

---

## 7. The playbook

**Name:** Voice Mirror — Voiceprint Reveal
**Type:** `image_slideshow`
**Status:** create as inactive. Activation is a human action, never automated.

The arc is hook → action → payoff → CTA. Slides 1-3 are the creator's own
footage (`type: "ugc"`); slide 4 is our poster (`type: "image"`).

The payoff is the point: the Voice Mirror card is already a designed,
shareable, socially-sized artifact (1080×1920 story and 1080×1080 square,
rendered by `src/features/mirror/card-renderer.ts`). The creator does not have
to manufacture a reason to show the product — the product hands them one.

### Slide 1 — the hook (`ugc`)

```
<creator_instructions>
Film yourself the moment after hearing your own singing played back. You
thought it sounded fine in your head. It did not. React honestly — wince,
laugh, cover your face, look away. First person, handheld, unpolished. No
product yet. Three seconds of pure recognition.
</creator_instructions>
<hook_captions>
{{I thought I sounded better than that}}
{{Not me hearing my own voice back}}
{{All that practice for THIS}}
{{why does my voice sound like that}}
</hook_captions>
```

### Slide 2 — the action (`ugc`)

```
<creator_instructions>
Open MercuryPitch and sing one line of a song you already know. Show the
screen while the live pitch visualisation moves with your voice. Keep singing
through it — the point is that you can see the note drift in real time.
Casual, not a tutorial. Do not explain the app, just use it.
</creator_instructions>
<hook_captions>
{{ok this is actually showing me every note}}
{{watching my voice miss in real time}}
</hook_captions>
```

### Slide 3 — the payoff (`ugc`)

```
<creator_instructions>
Hold up your finished voiceprint card to camera — the star trail of your
actual voice, your range, and the famous singer you matched. React to who you
got. This is the reveal, so give it the beat it deserves. Say the twin's name
out loud. End on the card filling the frame.
</creator_instructions>
<hook_captions>
{{apparently this is my voice twin}}
{{my voice as a constellation}}
{{no way this is who I matched}}
</hook_captions>
```

### Slide 4 — the CTA (`image`)

Our poster, attached via `generate_slide_image` with `source: "url"`.
Headline "Find your pitch.", URL `mercurypitch.com/mirror`.

**Note on emoji:** the captions above are emoji-free because this file lives in
the repo, where AGENTS.md forbids them. Emoji in TikTok hook captions is
platform-native and often helps. Adding them in the Noise portal is a
reasonable choice — the repo rule governs this artifact, not the ad copy.

---

## 8. Next actions

| # | Action | Owner | Blocked by |
|---|---|---|---|
| 1 | Reconnect the Noise MCP connector | you | — |
| 2 | Check the portal for creator-review / blocklist controls (§4) | you | — |
| 3 | Create the playbook, inactive, slides 1-4 | agent | 1 |
| 4 | Attach the poster to slide 4 via URL | agent | 3 |
| 5 | Deactivate orphaned playbooks 19287 / 19288 | agent | 1 |
| 6 | Review the playbook, then activate manually | you | 3, 4 |
| 7 | Decide daily target and window (§3) | you | — |
| 8 | Short-link redirect, or ship full UTM URLs (§5) | agent | decision |
| 9 | Add Mirror capture profiles beyond `freddie` (§6) | agent | — |

### Reading results

Once live, `get_daily_report` gives spend, views, posts, creators and CPM by
day, campaign and playbook. `list_posts` drills to individual posts with
engagement rate and per-post spend — useful for spotting which creators and
which hooks actually carried, and for deciding what the second playbook should
be.

Judge the test on GA4 `results_view` and `card_shared` against Noise views.
Views alone say the content was distributed; the funnel says whether it
worked.
