# Search, answer engines and the app stores: karaoke, native and TV

**Plan, 2026-10-19.** Nothing here is built unless marked **[shipped]**. It
covers how people looking for a karaoke app find MercuryPitch: in Google and
Bing, in answer engines (ChatGPT, Perplexity, Copilot, Gemini, AI Overviews),
and in the App Store and Google Play once the native apps launch. It also
covers the TV apps after them. It continues the SEO audit and recheck of 12
and 14 Oct 2026 (decisions D5 and on, pinned in `launch-entry-seo.test.ts`).
The TV platform research in
[tv-apps-and-phone-mic.md](tv-apps-and-phone-mic.md) still holds.

Status keys: **[shipped]**, **[in review]** (an open PR), **[next]** (ready to
build), **[open]** (needs the owner, a decision or a store account). Claims
marked _(verified)_ were checked against the primary source on 2026-10-19.
Sources are at the end.

---

## 0. The short version

1. **Check Cloudflare first (§3.1).** Since 15 Sep 2026, a zone that blocks AI
   _training_ crawlers also blocks Googlebot, Bingbot and Applebot, unless the
   owner opted out _(verified)_. This includes the old "Block AI bots" switch.
   The robots.txt the zone serves looks clean, but a firewall-level block cannot
   be seen from outside.
2. **The site itself is in good shape.** Every room has a crawlable document, a
   share card and visible FAQs, and the tests keep them honest. This series
   adds three things:
   - a linked entity graph (#1105);
   - a karaoke front door that answers the questions searchers ask (#1106);
   - store-driven app signals, so the launch is one flag per store (#1107).
3. **Most answer-engine visibility is earned off the site (§5).** Answer
   engines cite "best karaoke app" lists, YouTube, Reddit and directories far
   more than a product's own pages. For a recommendation query, the brand's own
   site gets about 1% of citations.
4. **The native launch needs work the website cannot do (§6).** Deep links need
   a Team ID, a signing fingerprint and native changes. The listing copy needs
   long-tail keywords, because "karaoke app" itself is owned by apps with
   hundreds of thousands of reviews. App Review will ask about Jam's chat
   (guideline 1.2).
5. **TV (§7).** Google TV first, from the same Play listing. A "karaoke on your
   TV" page goes live only when the phone works as the microphone. Until then
   the honest answer is in the karaoke page's FAQ.

---

## 1. Where the site stands

Strong already, and guarded by tests:

- **A document per room and per search intent.** Every entry document comes
  from one model (`src/seo/entry-pages.ts`). Each has a self-canonical,
  title and description limits, a prelude a crawler reads before JavaScript,
  and cross-links to every sibling.
- **Real 404s.** Unknown paths answer 404 instead of the shell.
- **No index outside production.** Dev and previews are kept out of the index
  (`nonProductionNoindexPlugin`).
- **One organization.** It has one `@id`, shared with the landing.
- **Share cards stamped with their own hash,** so a refreshed card is a new
  link.
- **An llms.txt** that states what the app does not do.

Gaps the audit found:

| Gap                                                                                               | Now                         |
| ------------------------------------------------------------------------------------------------- | --------------------------- |
| No `WebSite` node, so no declared site name; app nodes not linked by `@id`                        | **[shipped]** #1105         |
| Karaoke Night, Voice Mirror, the range test and Break Glass had no app markup                     | **[shipped]** #1105         |
| Manifest description still described the pitch trainer of a year ago                              | **[shipped]** #1105         |
| Nothing answered "karaoke app", "karaoke with friends online", "karaoke on TV", "is there an app" | **[shipped]** #1106         |
| Jam Rooms had no FAQ                                                                              | **[shipped]** #1106         |
| Nothing on the site follows the store listings except the chips                                   | **[shipped]** #1107         |
| Sitemap `lastmod` dates are stale (2026-09-08 on pages edited since), four pages have none        | **[shipped]** #1122         |
| `/exercises/<slug>` deep links are `noindex` (they serve the shell)                               | **[open]** needs real heads |
| No IndexNow                                                                                       | **[shipped]** §3.4          |
| No Bing Webmaster Tools                                                                           | **[done]** owner, §3.3      |
| No `.well-known` app-link files                                                                   | **[open]** §6.2             |

---

## 2. This series

- **#1105, entity graph.**
  - The home page gains a `WebSite` node (`#website`, alternate name "Mercury
    Pitch"). That is where Google takes the result's site name from.
  - The studio's `WebApplication` gets `#app`.
  - Every room's app node gets its own `@id` and links to the studio
    (`isPartOf`) and the organization (`publisher`).
  - Four rooms gain app markup, and the manifest description is new.
- **#1106, karaoke front door.**
  - `/karaoke-app` (_Free Karaoke App: Lyrics and Live Scoring_) boots Karaoke
    Night. Its five FAQs cover scoring, your own songs, friends, TV, and
    iPhone/Android.
  - The iPhone/Android answer comes from `STORE_LISTINGS`
    (`nativeAppsAnswer()`), so it changes on launch day by itself.
  - Jam Rooms gets its first FAQ, and Karaoke Night answers key changes.
  - llms.txt gains _Where it runs_. Its test fails on launch day until the live
    listing is linked.
- **#1107, store presence.**
  - Generated documents carry Safari's Smart App Banner once the App Store
    listing is live.
  - The tests then demand three hand-written additions, naming the exact text:
    index.html's banner tag, a `MobileApplication` node per store, and the
    manifest's `related_applications`.

---

## 3. Owner actions, now

None of these is code. They are listed in order of urgency.

### 3.1 Cloudflare's AI crawler settings **[open, urgent]**

Cloudflare split AI traffic into three categories on 1 Jul 2026: Search, Agent
and Training. It changed the defaults on 15 Sep 2026. The rule that matters:
"multi-purpose crawlers such as Googlebot, Applebot, and BingBot will be blocked
by customers who have selected to block Training", including through the legacy
"Block AI bots" service _(verified)_.

GPTBot is the largest crawler on this domain, which suggests training is not
blocked. That is a guess, not a check.

In the dashboard, under the zone's Security settings:

1. **Search: Allow. Agent: Allow.**
2. **Training: Allow** if the owner wants the model knowledge that comes from
   training. That is the only route into answers given without a live search.
   Blocking it now also blocks Google, Bing and Apple's search crawlers unless
   the zone opted out.
3. Make sure the legacy "Block AI bots" switch is off.
4. Turn off the managed robots.txt. It prepends `Disallow` lines for GPTBot,
   ClaudeBot, Google-Extended and others.

The robots.txt served on dev.mercurypitch.com on 2026-10-19 was our own file,
with nothing prepended. The managed robots.txt therefore looks off. A firewall
rule would not show there.

Optional: a `Content-Signal: search=yes, ai-input=yes, ai-train=yes` line in
`public/robots.txt`. It states a preference and blocks nothing. It is the
owner's policy to state, so it is not in any PR.

### 3.2 Google Search Console **[open]**

- Verify the property if it is not already, and submit
  `https://mercurypitch.com/sitemap.xml`.
- Leave the new **"Search generative AI"** setting on Include. Excluding takes
  the site out of AI Overviews and AI Mode.
- AI Overviews and AI Mode traffic is counted in the Performance report's Web
  search type. Google's AI optimization guide also points to a Generative AI
  performance report.
- Once a production release carries #1106, test each live URL in URL
  Inspection, then request indexing for `/karaoke-app`, `/jam` and
  `/karaoke-night`. Requested before the release, Google fetches the 404 page.

### 3.3 Bing Webmaster Tools **[done]**

Copilot answers from Bing. A 2025 study found ChatGPT's search citations
matched Bing's top 10 far more often than Google's. Newer reports dispute this
and say OpenAI now runs its own index, so treat it as likely, not settled.

- Verify the site. It can be imported from Search Console. Done by the owner
  in October 2026, for this site and the about site.
- Submit the sitemap.
- Its first SEO findings had two likely causes, both fixed: Piano Night had no
  h1 once the room mounted, and a comment in every entry document spelled out
  an image tag with no alt. IndexNow is §3.4.
- Watch the **AI Performance** report: citations in Copilot and Bing's AI
  summaries, per page and by grounding query. Public preview since February
  2026 _(verified)_.

### 3.4 IndexNow **[shipped]**

IndexNow tells Bing, Yandex, Seznam, Naver, Yep, the Internet Archive and
Amazonbot the moment a URL changes. Google does not use it.

- The key file is `public/<key>.txt`. `scripts/indexnow.mjs` finds the key by
  that file, so the key is written down once.
- After each production deploy, the release workflow's "Notify IndexNow" step
  sends the sitemap URLs added, removed or given a new `<lastmod>` since the
  previous tag. The first release with the key sends every URL. The step
  never fails a release.
- It sends the sitemap as production lists it: `/glass-game` stays out while
  `.env.production` keeps Glassworks unlisted, and a listing that flips is
  sent as an addition or a removal.
- So `<lastmod>` is the record of change: bump it when a page's words change
  (§4.3). Re-sending unchanged URLs on every release is noise.
- By hand, `pnpm indexnow <url> ...` sends exactly those URLs, and
  `--dry-run` prints the request instead.

### 3.5 Measurement **[open]**

- **First-party.** The funnel's first-touch record (`src/lib/acquisition.ts`)
  already keeps the referrer origin and UTM tags.
  - ChatGPT appends `utm_source=chatgpt.com` to the links it cites.
  - Perplexity, Copilot, Gemini and Claude arrive as referrer origins.
  - Reading the data by AI source is a query, not new tracking.
- **GA4.** A custom channel group "AI assistants" matching chatgpt.com,
  perplexity.ai, copilot.microsoft.com, gemini.google.com and claude.ai.
  Without it they land in Referral.
- **Cloudflare.** The AI crawl analytics show which bots fetch what.
- **A monthly prompt check.** Ask ChatGPT, Perplexity, Gemini and Copilot the
  same five questions and log whether MercuryPitch is named and which page is
  cited:
  - "free karaoke app that scores your singing"
  - "free vocal remover online"
  - "sing karaoke with friends online"
  - "karaoke on my TV with my phone"
  - "vocal range test"

---

## 4. On the site

### 4.1 One page per real intent

Google's AI optimization guide (July 2026) warns against "separate content for
every possible variation of how people might search". Pages made mainly to
catch AI fan-out queries fall under its scaled-content-abuse policy
_(verified)_. So the rule is:

- one page per intent that a room really serves;
- the answer in its opening lines;
- FAQs a reader can see.

| Intent                                                              | Page                   | Status          |
| ------------------------------------------------------------------- | ---------------------- | --------------- |
| karaoke app, free karaoke app, karaoke app with scoring             | `/karaoke-app`         | **[shipped]**   |
| make karaoke from a song, karaoke version of a song                 | `/karaoke-night`       | **[shipped]**   |
| vocal remover, remove vocals from a song                            | `/vocal-remover`       | **[shipped]**   |
| sing karaoke with friends online, online karaoke party              | `/jam` (FAQ)           | **[shipped]**   |
| change a song's key, karaoke in my key                              | `/karaoke-night` (FAQ) | **[shipped]**   |
| karaoke on smart TV, phone as karaoke microphone                    | `/karaoke-on-tv`       | **[open]** §7.3 |
| free alternative to the paid karaoke apps                           | one comparison page    | **[open]** §4.4 |
| vocal range, voice type, pitch practice, singer match, ear training | existing pages         | **[shipped]**   |

### 4.2 Structured data

What it does and does not buy, as of October 2026:

- **FAQ rich results are gone for every site since 7 May 2026** _(verified)_.
  The FAQ markup stays because it is harmless and the visible FAQs are what
  readers and answer engines use.
- **SoftwareApplication rich results** (stars and price) need `aggregateRating`
  or `review`. Ratings copied from the stores are not allowed. There will be no
  stars until ratings are collected on the site, and none should be borrowed.
- **The `WebSite` node** sets the site name in results. That is #1105.
- **The effect on AI answers is small.** Google: structured data is not
  required for generative AI search. Bing: markup helps its models. A 2026
  study of 1,885 pages found no significant change in ChatGPT or AI Mode
  citations after adding markup.

So keep the graph accurate and small. Add `VideoObject` only on a page that
really shows the video, and only once consent allows a YouTube embed (§5.3).

### 4.3 Freshness and an honest `lastmod` **[next]**

Answer engines cite noticeably fresher pages than search results do. Google
trusts `lastmod` only when it is "consistently and verifiably accurate". Today
it is neither. Ten URLs still carry 2026-09-08, which is older than the 12 Oct
title pass (decision D5) and the 14 Oct recheck. Four pages have no date at
all.

The fix fits a pattern the repo already uses for share cards
(`og-image-versions.ts`):

1. A script hashes each entry's crawlable content (title, description, h1,
   lede, FAQ).
2. It records `{ hash, date }` per page.
3. A test fails when a page's content no longer matches its recorded hash,
   like the OG version stamp.

That date then feeds three things:

- the sitemap's `lastmod`;
- a `dateModified` on the page's markup;
- the IndexNow list in §3.4, as the pages whose stamp moved since the last
  release.

Drop `changefreq` and `priority` at the same time; neither Google nor Bing reads
them.

### 4.4 A comparison page **[open]**

"Best karaoke app" answers are built from comparisons. One honest page could
make the case: a table of what MercuryPitch does next to the paid apps.

- Columns: free scoring, songs you own, a catalog, TV, live group singing,
  open source.
- Sourced and dated, written to the gaps in §8.

It names competitors, so it is the owner's call. Google's spam rules allow one
honest comparison. They do not allow fifty "X alternative" pages.

### 4.5 The landing (about.mercurypitch.com) **[open]**

It lives in another repo. Recommendations:

- Keep the organization `@id` identical.
- Link `/karaoke-app` from the karaoke section.
- Dated posts: one per release highlight, in plain words. They are fresh pages
  that answer engines can cite.
- A press-kit page: logo, screenshots, a 50-word and a 150-word description,
  and a contact. List writers ask for one.

---

## 5. Off the site, where answer engines look

Research on what drives citations, 2025–26:

- **"Best X" lists** are 43.8% of the pages ChatGPT cites, and rank on them
  predicts being recommended.
- **Mentions on other websites** have the strongest link to appearing in AI
  Overviews (correlation 0.664, across 75k brands).
- **Each engine has favorite sources.** ChatGPT leans on Wikipedia. AI
  Overviews and Perplexity lean on Reddit and YouTube. YouTube is 18.2% of AI
  Overview citations for pages outside the top 100.

### 5.1 Lists and directories **[open]**

- **Pitch the round-ups that answer engines cite** for "best karaoke apps",
  "best free vocal remover" and "karaoke on TV". The pitch is the four gaps in
  §8, with a screenshot each.
- **Open-source directories:** OpenAlternative, which lists open-source
  alternatives to commercial apps (Nightingale, an open karaoke app, is there),
  and AlternativeTo.
- **Product Hunt,** once the native apps launch. It is a launch-day event, so
  save it.
- **PeerPush** is already linked from the home page.
- **GitHub:** repository topics (`karaoke`, `vocal-remover`, `pitch-detection`,
  `singing`, `web-audio`) and a README whose first lines say what the app is.
  Coding agents are most of llms.txt's readers, and they read READMEs too.

### 5.2 Reddit and forums **[open]**

Honest participation only, under each subreddit's rules: r/karaoke, r/singing
and r/WeAreTheMusicMakers. Answer the question asked, and mention the app where
it is the answer. Astroturfing is against the rules and gets found out.

### 5.3 YouTube **[open]**

The channel exists (`@mercurypitch`). Three demos would cover the searches
above:

1. A song you own, turned into karaoke and scored.
2. A TV signed in by phone, playing a song with the lyrics up.
3. A full Jam Room.

Each needs a descriptive title, chapters and a link back. Embedding one on
`/karaoke-app` with `VideoObject` markup needs a consent-gated player first:
the site keeps Google requests off the first paint until consent.

### 5.4 Wikidata **[open]**

A Wikidata item needs published third-party references. Revisit after the
first press coverage. Wikipedia notability is further off.

---

## 6. The native launch

### 6.1 The switch

Flip `live` in `src/lib/store-listings.ts` per store.

**Follows on its own:**

- the store chips;
- the karaoke page's "is there an app" answer;
- Safari's banner on every generated document.

**The tests then demand three hand edits, naming the exact text:**

- index.html's banner and `MobileApplication` nodes;
- the manifest's `related_applications` (`prefer_related_applications` stays
  false);
- llms.txt's link to the listing, and removing its "not yet in the stores"
  line.

### 6.2 Links that open the app **[open]**

Nothing on the website can do this alone.

1. **Decide the paths first.** Universal links and App Links match on the
   _path_. The TV sign-in and sync codes are hash routes (`#/link:CODE`,
   `#/sync:CODE`), so they cannot open the app as they stand. Give them path
   forms (`/link/CODE`, `/sync/CODE`) that the web also answers. Claim only
   those at first, not the marketing pages.
2. **iOS: `/.well-known/apple-app-site-association`.**
   - No extension, served as `application/json` (set in `public/_headers`),
     with no redirect.
   - Fetched by Apple's CDN within about 24 hours.
   - `{"applinks":{"details":[{"appIDs":["<TEAM_ID>.com.irchiinnuss.mercurypitch"],"components":[{"/":"/link/*"},{"/":"/sync/*"}]}]}}`
   - The Team ID is not in the repo (the Xcode project carries no
     `DEVELOPMENT_TEAM`).
   - Then the Associated Domains capability (`applinks:mercurypitch.com`). It
     needs a provisioning profile with the capability first, or CI signing
     breaks.
3. **Android: `/.well-known/assetlinks.json`.**
   - Use the SHA-256 of the Play App Signing key (Play Console, App signing),
     plus the upload key's for test builds.
   - Add an `autoVerify` intent filter for the same paths.
4. **Capacitor:** route `appUrlOpen` events.
5. **Once the app handles links:** add `app-argument` to the Smart App Banner
   (`src/seo/store-presence.ts`).

### 6.3 Store listing drafts **[open]**

Limits:

| Field             | App Store                            | Google Play                                  |
| ----------------- | ------------------------------------ | -------------------------------------------- |
| Name / title      | 30 characters                        | 30 characters; no "Free", "Best", "#1"       |
| Subtitle / short  | 30 characters                        | 80 characters (shown in search)              |
| Keywords          | 100 bytes, comma-separated           | none: the text is indexed                    |
| Promotional text  | 170 characters, not used for ranking | none                                         |
| Description       | 4,000 characters                     | 4,000 characters                             |
| Screenshots       | up to 10, plus 3 preview videos      | up to 8, a 1024×500 feature graphic, a video |
| Use-case variants | 70 custom product pages              | 50 custom store listings, 2-variant tests    |

The drafts below were counted against those limits. Apple indexes the name,
subtitle and keyword field together. A word in one is wasted in another, and so
are competitor names (guideline 2.3.7).

- **Name (both stores):** `MercuryPitch: Karaoke & Voice` (29).
- **iOS subtitle:** `Sing, see your pitch, improve` (29), or
  `Karaoke with live pitch scores` (30).
- **iOS keywords:**
  `singing,vocal,range,lyrics,remover,stems,duet,jam,tuner,ear,training,lessons,piano,guitar,drums`
  (95 bytes).
  - Keep only what the native build ships. Drop `lessons` and the instruments
    if they are not in it.
- **Play short description:**
  `Sing karaoke with live pitch scoring, find your vocal range, jam with friends.`
  (78).
- **Description, opening lines:**
  - what it is;
  - free pitch scoring;
  - your own songs, separated on the device;
  - friends in Jam Rooms.
  - Then the rest of the studio. Then plain words about the subscription and
    credits.
  - Say "songs you own", never "any song": guideline 5.2.3 bars helping users
    take media from other services.
- **Screenshots:** the first three carry the message:
  1. a lyrics stage with the pitch ribbon;
  2. the separation result;
  3. a Jam Room with lanes.
- **Variants:**
  - one custom product page and one custom store listing per use case:
    karaoke, vocal range, jam, instruments;
  - a monthly "Jam night" in-app event (up to 31 days, shown in search).
- **"karaoke app" is a hard keyword.** The top Play results average about
  902,000 reviews. Aim at the long tail: karaoke with scoring, karaoke with
  your own songs, vocal remover karaoke, karaoke with friends.

### 6.4 Review risks to clear before submitting **[open]**

- **4.2, minimum functionality.** A repackaged website is rejected. Lead with
  what is native: the floating lyrics window, background playback and file
  import.
- **5.2.3.** "Files you own"; no downloading from other services.
- **1.2, user-generated content.** Jam's chat has no report, block or mute
  today (`JamChatWidget.tsx`). If Jam ships in the iOS app, Apple asks for a
  way to report and block, and a published contact.
- **2.3.10, other platforms.** Handled: the store chips are compiled out of the
  native build (`StoreChips.tsx`).
- **Purchases.** Review uses sandbox purchases; see
  [mobile-native/store-review-purchases.md](mobile-native/store-review-purchases.md).

---

## 7. TV

### 7.1 Google TV / Android TV first **[open]**

- **Same listing.** The same Play listing serves TV once opted in to the TV
  form factor. It is reviewed against the TV quality checklist.
- **The Android manifest needs:**
  - a `LEANBACK_LAUNCHER` intent;
  - a 320×180 `android:banner`;
  - `android.software.leanback` with `required="false"`;
  - `android.hardware.touchscreen` with `required="false"`. That one is missing
    today, and Play hides an app from TVs when it seems to require a
    touchscreen.
  - The microphone is already `required="false"`
    (`apps/mercurypitch/android/app/src/main/AndroidManifest.xml`).
- **The listing needs** a TV screenshot, a 1280×720 TV banner, and "Android TV"
  in the description.
- **Since 1 August 2026,** a TV app must support 64-bit and 16 KB pages
  _(verified)_.
- **D-pad navigation** has started (remote arrows move between rows, per the
  CHANGELOG). The TV checklist asks for all of it.
- **Fire TV (Fire OS) next.** It takes the same Android build in the Amazon
  Appstore, which stopped taking web apps in October 2024.

### 7.2 Everything else

From the platform research in
[tv-apps-and-phone-mic.md](tv-apps-and-phone-mic.md) §1, plus three new points:

- **Samsung** says hosted web apps are "basically… not allowed".
- **A packaged Samsung app** cannot use `unsafe-inline` or `unsafe-eval`, and
  this site's policy uses both.
- **LG** publishes an official template for hosted web apps, so that route is
  supported.

The order stays:

1. Google TV and Fire TV (one Capacitor build).
2. LG.
3. Samsung (US only without a partner contract).
4. A native Apple TV app last.

### 7.3 The TV page **[open]**

A "karaoke on your TV" page should go live the day the phone works as the
microphone (tv-apps-and-phone-mic.md §4), and not before, because that is the
page's whole promise. The mainstream phone-mic options are tied to hardware:
Stingray on recent Samsungs, or Apple Music Sing on an Apple TV 4K. Let's Sing
needs a console. AllKaraoke.Party is the one browser rival. Until then the
karaoke page's FAQ says what a TV browser does today. Draft head, counted:

- Title: `Karaoke on Your TV, Phone as the Mic | MercuryPitch` (51).
- Description:
  `Sing karaoke on your TV with your phone as the microphone: lyrics on the big screen, live pitch scoring, and a room for your friends to join.`
  (141).
- FAQs:
  - Which TVs work?
  - How does the phone connect, and what about delay?
  - Do I need an app on the TV?
  - Can several phones sing at once?

---

## 8. Where MercuryPitch stands among karaoke apps

From current round-ups. Answer engines lean on these lists, but we did not
query the engines themselves.

| App              | Model and TV                                             |
| ---------------- | -------------------------------------------------------- |
| Smule            | Social duets; solo singing needs a subscription          |
| StarMaker        | VIP membership from $7.99 a week                         |
| KaraFun          | Catalog subscription; Apple TV, Fire TV and Android apps |
| Stingray Karaoke | Samsung, LG and Vizio TVs; phone mic on recent Samsungs  |
| Apple Music Sing | Needs Apple Music; iPhones as mics on tvOS 26            |
| Let's Sing 2026  | Consoles; up to four phones as mics                      |
| AllKaraoke.Party | Free, in the browser, phones as mics                     |
| Nightingale      | Open source, self-hosted, with separation and scoring    |

Gaps MercuryPitch can claim honestly, and the pitch for §5:

1. **Free pitch scoring** with no paywall.
2. **Private karaoke from your own songs,** separated on your device by
   default.
3. **Any TV browser, signed in with a phone,** to play prepared songs with the
   lyrics up.
4. **Live group singing for up to twelve,** with a lane each. Smule's duets are
   not live.
5. **Open source** (AGPL-3.0).

Do not claim the phone as a TV microphone until it works.

---

## 9. Not worth doing

- **`llms-full.txt` or Markdown copies of pages.**
  - Google Search ignores llms.txt _(verified)_, and no study found an effect
    on citations.
  - 97% of llms.txt files saw no requests in May 2026; GPTBot and coding agents
    made most of the rest.
  - Keep the one file honest, and nothing more.
- **Chasing FAQ rich results.** The feature is gone.
- **Ratings in markup** before real on-site reviews exist.
- **Intent pages by the dozen.** One per real intent (§4.1).
- **Meta keywords.** Removed in 0.9.18; Bing reads a stuffed list as spam.

---

## Sources

Checked on 2026-10-19 unless dated otherwise.

- Cloudflare:
  [Block AI bots (docs)](https://developers.cloudflare.com/bots/additional-configurations/block-ai-bots/),
  [AI options and new defaults (blog)](https://blog.cloudflare.com/content-independence-day-ai-options/),
  [managed robots.txt](https://developers.cloudflare.com/bots/additional-configurations/managed-robots-txt/),
  [Content Signals](https://blog.cloudflare.com/content-signals-policy/).
- Google:
  [Search Central updates](https://developers.google.com/search/updates) (FAQ
  rich results ended 7 May 2026; llms.txt note 15 Jun 2026),
  [AI optimization guide](https://developers.google.com/search/docs/fundamentals/ai-optimization-guide),
  [AI features](https://developers.google.com/search/docs/appearance/ai-features),
  [site names](https://developers.google.com/search/docs/appearance/site-names),
  [software app markup](https://developers.google.com/search/docs/appearance/structured-data/software-app),
  [review snippet rules](https://developers.google.com/search/docs/appearance/structured-data/review-snippet),
  [Search generative AI setting](https://support.google.com/webmasters/answer/16908024).
- Bing:
  [AI Performance in Bing Webmaster Tools](https://blogs.bing.com/webmaster/February-2026/Introducing-AI-Performance-in-Bing-Webmaster-Tools-Public-Preview),
  [IndexNow](https://www.indexnow.org/documentation).
- Crawlers:
  [OpenAI](https://developers.openai.com/api/docs/bots),
  [Anthropic](https://support.claude.com/en/articles/8896518),
  [Perplexity](https://docs.perplexity.ai/docs/resources/perplexity-crawlers.md),
  [Apple](https://support.apple.com/en-us/119829).
- Citation research (vendor studies, read as directional):
  [Ahrefs: AI Overview citations and the top 10](https://ahrefs.com/blog/ai-overview-citations-top-10/),
  [Ahrefs: best-of lists](https://ahrefs.com/blog/best-lists-research/),
  [Ahrefs: brand mentions](https://ahrefs.com/blog/ai-overview-brand-correlation/),
  [Ahrefs: freshness](https://ahrefs.com/blog/do-ai-assistants-prefer-to-cite-fresh-content/),
  [Ahrefs: schema and AI citations](https://ahrefs.com/blog/schema-ai-citations/),
  [Ahrefs: llms.txt](https://ahrefs.com/blog/llmstxt-study/),
  [Profound: platform citation patterns](https://www.tryprofound.com/blog/ai-platform-citation-patterns),
  [Seer: ChatGPT and Bing](https://www.seerinteractive.com/insights/87-percent-of-searchgpt-citations-match-bings-top-results),
  [Microsoft: content for AI answers](https://about.ads.microsoft.com/en/blog/post/october-2025/optimizing-your-content-for-inclusion-in-ai-search-answers).
- Apps and stores:
  [Apple associated domains](https://developer.apple.com/documentation/xcode/supporting-associated-domains),
  [Smart App Banners](https://developer.apple.com/documentation/webkit/promoting-apps-with-smart-app-banners),
  [App Store product page](https://developer.apple.com/app-store/product-page/),
  [custom product pages](https://developer.apple.com/app-store/custom-product-pages/),
  [in-app events](https://developer.apple.com/app-store/in-app-events/),
  [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/),
  [Android App Links](https://developer.android.com/training/app-links/configure-assetlinks),
  [Play store listing](https://support.google.com/googleplay/android-developer/answer/13393723),
  [Play custom store listings](https://support.google.com/googleplay/android-developer/answer/9867158),
  [getInstalledRelatedApps](https://developer.chrome.com/docs/capabilities/get-installed-related-apps),
  [Chrome on related_applications](https://developer.chrome.com/blog/app-install-banners-native),
  [Capacitor deep links](https://capacitorjs.com/docs/guides/deep-links).
- TV:
  [Android TV distribution](https://developer.android.com/training/tv/publishing/distribute),
  [TV hardware features](https://developer.android.com/training/tv/get-started/hardware),
  [Samsung hosted apps FAQ](https://developer.samsung.com/smarttv/develop/faq/hosted-applications.html),
  [LG web app template](https://webostv.developer.lge.com/develop/getting-started/app-template),
  [Amazon web apps](https://developer.amazon.com/zh/docs/html5-web-apps/webapp-setup-environment.html),
  [Apple Music Sing on tvOS 26](https://9to5mac.com/2025/06/10/tvos-26-apple-music-sing-iphone-karaoke/).
- Market:
  [karaoke app round-up](https://www.musicindustryhowto.com/karaoke-apps/),
  ["karaoke app" keyword difficulty](https://trysonar.app/keyword-difficulty/karaoke-app/android/us),
  [OpenAlternative: Nightingale](https://openalternative.co/nightingale).
