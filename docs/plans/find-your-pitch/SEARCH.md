# Find Your Pitch in search and answer engines

**Plan, 2026-10-19.** How the lessons get found on Google, Bing and the answer
engines (ChatGPT, Perplexity, Copilot, Gemini, AI Overviews), and how articles
beside them should work. Status keys: **[shipped]**, **[in review]** (an open
PR), **[next]** (ready to build), **[open]** (needs the owner). Claims marked
_(verified)_ were checked against Google's own documentation on 2026-10-19.

It sits beside two other documents:

- the YouTube upload guide, [youtube/YOUTUBE.md](youtube/YOUTUBE.md);
- the site-wide plan,
  [docs/plans/search-and-answer-engines.md](../search-and-answer-engines.md).

---

## 0. The short version

1. **No lesson is on mercurypitch.com yet.** Lessons 1 and 2 are released on
   `main`, and Lesson 3 is a draft (`src/features/lessons/kit/drafts.ts`), but
   no release tag carries them; v0.9.21 predates all three. They can therefore
   launch search-ready, and #1109 did that (§1).
2. **The lessons answer informational questions.** "What is a note", "how to
   match pitch", "intervals explained": AI Overviews already answer the generic
   form of each. Google's advice for its AI features is "valuable,
   non-commodity content" _(verified)_. That describes what these pages
   already have and a text article cannot copy:
   - toys that make the sound;
   - a sung check that measures you;
   - facts traced to primary sources.

   The work is to make sure the page around them is found and read correctly.

3. **Structure:**
   - one lesson per topic, at `/learn/NN`;
   - a hub at `/learn/` once there are two lessons;
   - links both ways between each lesson and the room that practises it;
   - titles in the words people search;
   - articles only where a real question has no lesson.
4. **Distribution:**
   - YouTube (`YOUTUBE.md`);
   - teachers and choirs, who link from school pages;
   - honest answers in communities.

   Answer engines cite YouTube and third-party pages far more than a brand's own
   site (site-wide plan § 5).

---

## 1. This PR **[in review]**

- **Structured data for Lessons 1 and 2.** An `Article` node each: a free
  beginner lesson in the Find Your Pitch series, published by the
  organization. Plus a `BreadcrumbList` from the home page. Every value
  repeats what the page says.
- **`max-image-preview:large`** in both robots tags. Discover uses a large
  image only when the page allows one _(verified)_. The share cards are
  1200×630, which meets its 1200-pixel width.
- **Descriptions that fit.** They were 206 and 272 characters, and Google cuts
  near 160, so each result lost its end. They are 156 and 159 now, with the
  same facts. These are the PR's only copy changes; drop them if the lessons'
  own process should own them.
- **Linked from every crawlable document.** Every released lesson is now in the
  prelude nav of every generated entry document, and index.html and 404.html
  link Lesson 1, which links onward to the next. Before, nothing a crawler
  reaches first linked a lesson; only the sitemap, llms.txt and the app's Home
  did, and Home only after JavaScript runs.
- **Nothing names a lesson.** `tools/lesson-links.ts` reads the released
  lessons off `learn/` the way `tools/draft-lessons.ts` does, less the drafts,
  and labels each with its structured-data headline. So releasing a lesson is
  still deleting its line from `drafts.ts`: that alone links it from every
  entry document. `src/tests/lesson-pages.test.ts` then holds it to:
  - a self-canonical head, the image directive and a description under 160
    characters;
  - the structured data;
  - the sitemap, llms.txt and the service worker;
  - links from the generated entry documents;
  - the legal links.

---

## 2. What Google supports, October 2026

- **Article** markup is supported, for `Article`, `NewsArticle` and
  `BlogPosting` _(verified)_. Recommended properties:
  - `headline`;
  - `image`, in 16x9, 4x3 and 1x1;
  - `datePublished` and `dateModified`;
  - `author`, with a `url`, and every author the page names.

  There is no special rich result for lessons.

- **Gone:**
  - Course info and Learning Video rich results (phased out from June 2025);
  - practice problems (January 2026);
  - FAQ rich results (May 2026) _(verified)_.

  Old markup does no harm, but none of these is a reason to add any.

- **Breadcrumbs** still show, on desktop only, from two items up. The last item
  needs no URL _(verified)_.
- **Video features need a watch page.** That is a page whose "main purpose is to
  show users a single video". A lesson page where the film supports the text is
  not one, and its video will not get video results. Previews and key moments
  also need Google to fetch the video file itself (`contentUrl`), and the watch
  page must already do well in Search _(verified)_ (§6).
- **Discover** needs images at least 1200 px wide, over 300,000 pixels, 16:9 if
  possible, and `max-image-preview:large` _(verified)_.
- **llms.txt** is ignored by Google Search _(verified)_. Keep it short and
  honest for the others.
- **Scale is penalized.** Pages made for "every possible variation of how
  people might search" fall under the scaled content abuse policy _(verified)_.
  One lesson per topic, not a page per phrasing.

---

## 3. The lesson page template

Every lesson document follows this, in addition to its WEB-SPEC.

### 3.1 The head

- **Title, at most 60 characters,** in the words people type, then
  `| MercuryPitch`.
  - The page teaches question first and term last (the playbook). The title is
    where the terms go, because that is what people search for.
  - The series name belongs in the kicker, the breadcrumb, `og:title` and the
    structured data. Spent in the title, it costs 25 characters that
    searchers do not type.
  - Drafts for Season 1 are in §4.
- **Description, 80 to 160 characters:** the hook, then what the lesson covers
  and how ("a ten-minute lesson with sound toys"). The test holds the length.
- **Canonical, `og:url` and robots.** The canonical and `og:url` are the clean
  path. Robots is `index, follow, max-image-preview:large`.
- **Share card.** 1200×630 as now (`learn/lesson-NN-og.jpg`). It doubles as the
  Discover image.
- **Language.** `<html lang="en">` today. The lessons are British English
  (MASTER-PLAN § 12 item 5), so `en-GB` would be exact. The structured data
  already says `en-GB`.

### 3.2 Structured data

- **Copy Lesson 1's two blocks.** Change the number, headline,
  `alternativeHeadline` (the hook), description, image, `timeRequired`,
  `teaches` and `position`.
- **`datePublished`** is the day the lesson first goes live on
  mercurypitch.com. The admin console publishes a draft at run time, and
  nothing then writes the date: the site worker changes the page state, the
  hook's copies and the links (`src/lesson-gate.ts:10-21`), never a date, so a
  published draft is served without one. It is set either in the commit that
  deletes the lesson's `drafts.ts` line or in a commit straight after the
  console publishes it; the owner picks which. `dateModified` when its
  teaching changes (the LEDGER says when).
- **`author`.** A `Person` with a `url` once the page shows a byline (§3.3).
  Until then, the organization.
- **Once the hub exists,** the breadcrumb gains its middle step (Home, then Find
  Your Pitch, then the lesson), and `isPartOf` gains the hub's URL.
- **No `VideoObject` on a lesson page.** It belongs on the watch page (§6).

### 3.3 On the page

What a reader, a crawler and an answer engine all need:

- **Keep the glossary near the top.** Lesson 1's "Pitch, hertz and the octave"
  is exactly what answer engines quote: short, defined, plain text.
- **Keep "Three lines to keep".** It is the best passage on the page for a
  quoted answer.
- **Question-shaped headings where they read naturally.** For example, "Why do
  220 Hz and 440 Hz share a name?". Answer engines retrieve passages by
  question. Do not force it where the lesson's voice says it better.
- **A Sources section from FACTS.md.** Each claim already has a primary source.
  Showing the main ones is the strongest trust signal a teaching page can give,
  for readers and for the engines that check.
- **A byline and dates.** Who wrote it, and for voice lessons who reviewed it:
  the vocal coach, MASTER-PLAN § 12 item 8. "Published" and "Updated" dates too.
  Google asks who created a page, and answer engines prefer fresh, attributed
  pages.
- **Links out:**
  - the home page;
  - the hub;
  - previous and next lesson;
  - the room that practises it (§8).

  Lessons 1 and 2 link their practise room and the season map today.

- **Words for every figure.** The toys explain by sound and motion; their
  captions and alt text are all a crawler gets.

### 3.4 Being found

- **Publishing it in the admin console** puts a draft live on
  mercurypitch.com with no release. The site worker serves the page and adds
  it to the sitemap and llms.txt it serves (`src/lesson-gate.ts:22-24`), so
  search can find it from that moment.
- **Releasing the lesson** (deleting its line from `drafts.ts`) makes that
  permanent in the repository, and links it from every entry document. The
  test then asks for the rest:
  - the head and the two structured-data blocks;
  - the sitemap;
  - llms.txt, as one bullet with its one-line answer;
  - the service worker's document list.
- **Sitemap `lastmod`:** the day it first went live, then the date its
  content changes. `/learn/01` says 2026-10-20 today; set it to its release day.
- **On the day the console publishes it**, not at the release:
  - request indexing in Search Console;
  - submit the URL in Bing Webmaster Tools.
- **Past four lessons,** the nav links give way to one "Lessons" link to the
  hub.

---

## 4. Season 1: what each lesson answers

Each title is counted at 60 characters or fewer. They are drafts for the
owner, not decisions.

| #   | People search                                        | Title draft                                                   | Practises in                   |
| --- | ---------------------------------------------------- | ------------------------------------------------------------- | ------------------------------ |
| 1   | what is a note, what is an octave, what does A4 mean | What is a note? Pitch, hertz and the octave \| MercuryPitch   | Voice Mirror                   |
| 2   | why 12 notes, sharps and flats, what is a semitone   | Why twelve notes? Sharps, flats and semitones \| MercuryPitch | Ear Lab                        |
| 3   | how to match pitch, am I tone deaf, sing in tune     | How to match pitch, and why most people can \| MercuryPitch   | Pitch training, Voice Mirror   |
| 4   | major scale explained, do re mi, tonic               | The major scale: why do sounds like home \| MercuryPitch      | Pitch training (scales)        |
| 5   | breath support singing, how to hold a note longer    | Breath support: how to hold a steady note \| MercuryPitch     | Pitch training (long note)     |
| 6   | intervals explained, interval songs                  | Intervals: the distance between two notes \| MercuryPitch     | Ear Lab (intervals)            |
| 7   | how to find my vocal range, vocal sirens             | Your vocal range: slides, sirens and comfort \| MercuryPitch  | Vocal range test, voice type   |
| 8   | what is a backbeat, clap on 2 and 4, tempo           | Beat, tempo and the backbeat, explained \| MercuryPitch       | Drum Night                     |
| 9   | how to sing big intervals in tune                    | Landing a leap: singing big intervals in tune \| MercuryPitch | Pitch training (intervals)     |
| 10  | major vs minor, why minor sounds sad                 | Major and minor: the one note that changes \| MercuryPitch    | Ear Lab (chords), Piano Night  |
| 11  | voice cracks when singing, chest and head voice      | Registers and the break: why voices flip \| MercuryPitch      | Voice type test                |
| 12  | four chord song, I V vi IV                           | The four-chord song: how chords work \| MercuryPitch          | Piano Night, Guitar Night      |
| 13  | singing vowels, resonance, formants                  | Resonance and vowels: why ee and ah differ \| MercuryPitch    | (no drill yet: CURRICULUM § 4) |
| 14  | how to sing with emotion, phrasing                   | Phrasing in singing: breath, swell and shape \| MercuryPitch  | Karaoke Night, Jam Rooms       |

Notes on the table:

- **Lessons 3, 5, 7 and 11** make voice claims. Their titles go through the
  same FACTS and coach sign-off as the copy.
- **Lesson 7 and the vocal range test** must not compete for the same search.
  The test answers "vocal range test". The lesson answers why the comfortable
  middle matters and how to use sirens. Each links the other.
- **The trailer** is a YouTube piece. Its web home is the hub.

---

## 5. The hub: `/learn/` **[open]**

A crawlable index of the series is worth building when Lesson 2 ships.

- **Path.** `learn/index.html`, served at `/learn/`; Cloudflare's `html_handling`
  redirects `/learn` there. Add a dev rewrite beside the lessons'.
- **Title.** `Free singing and music theory lessons | MercuryPitch` (52). The
  h1 is "Find Your Pitch".
- **Content:**
  - who it is for: no theory needed;
  - how a lesson works: ten minutes, sound toys, a sung check, a quick check
    and the episode;
  - the Season 1 map in its two lanes, Theory and Voice. Published lessons are
    links; planned ones show their hook question and "coming".

  The explorer that sits at the foot of Lesson 1 can move here.

- **Structured data.** A `BreadcrumbList`, and a node for the series with
  `hasPart` pointing at each published lesson's `#lesson`. `Course` or
  `CreativeWorkSeries`; neither earns a rich result any more, so it is a
  wording choice.
- **Not the "Series blueprint"** (the pipeline, the plan files). It left
  Lesson 1's page for the Content Studio's Lessons page, because the owner
  keeps the plan off public pages, the hub and the about site included. A
  lesson page reads best when everything on it teaches its topic.

---

## 6. Episodes: YouTube first, watch pages second

- **YouTube is where video search happens.** It is also 18.2% of the AI
  Overview citations that come from pages outside the top 100 results
  (Ahrefs, 2026). `YOUTUBE.md` already
  covers it: searcher-language titles, a description that links the lesson
  first, chapters, captions, end screens and Shorts.
- **Watch pages, later. [open]**
  - One page per episode, for example `/learn/01/watch`: the self-hosted MP4
    from R2 as the main content, the transcript (the VTT already exists), the
    chapters as seek links, and a link to the interactive lesson.
  - It carries a `VideoObject`:
    - `name`, `description`, `thumbnailUrl` (the poster) and `uploadDate`;
    - `duration`, e.g. `PT5M14S`;
    - `contentUrl` (the MP4);
    - the transcript;
    - a `Clip` per chapter.
  - The MP4 host must let Googlebot fetch the file.
  - Google picks one copy of a video to show, and may prefer YouTube's. So
    build these only after the YouTube uploads, and only if Search Console
    shows the lessons ranking: a watch page must do well in Search before its
    video is considered at all.

---

## 7. Articles beside the lessons **[open]**

Lessons are the backbone. An article is worth writing only when all three hold:

1. **A real question.** There is evidence people ask it: a Search Console
   query, "People also ask", a recurring Reddit thread.
2. **No lesson answers it.** For example: "why does my voice crack", before
   Lesson 11 exists; "what is a cent"; "how accurate is a phone at hearing
   pitch".
3. **A first-hand angle.** Something only MercuryPitch can show: a toy, a
   measurement, the app's own data.

Rules:

- **One article per question.**
- **The answer in the first two sentences,** then the depth.
- **A byline, dates and sources,** as for lessons.
- **Links to the lesson and the room.**
- **No generated or spun copy.** Google's scaled content abuse policy is aimed
  at exactly that, and it is cheap to spot.

The strongest article type for citations and links is original data. For
example: "How close do people sing to the note? What N thousand attempts show",
from anonymous aggregates. Whether aggregates can be published is a privacy
decision (§13).

Articles live under `/learn/<slug>`, with descriptive slugs; numbers stay for
lessons. Past three articles, a small generator pays for itself: Markdown in,
the same head, structured data and checks out. It would work the way
`src/seo/entry-pages.ts` generates the room documents.

---

## 8. Links between the lessons and the rooms

Each lesson links the room that practises it (the CURRICULUM § 4 practise
links). Each room's entry document should link back once the lesson is out,
which is a field on the entry model (**[next]**, when Lesson 2 ships):

| Room page                                              | Lessons to link                         |
| ------------------------------------------------------ | --------------------------------------- |
| `/mirror`, `/vocal-range-test`                         | 1 (note names), 3 (matching), 7 (range) |
| `/voice-type-test`, `/which-singer-has-my-vocal-range` | 7, 11                                   |
| `/pitch-training`                                      | 3, 4, 5, 9                              |
| `/ear-lab`                                             | 2, 6, 10                                |
| `/drum-night`                                          | 8                                       |
| `/piano-night`, `/guitar-night`                        | 10, 12                                  |
| `/karaoke-night`, `/jam`                               | 14                                      |

These links are what turn the rooms and the lessons into one topic the engines
recognize:
the rooms gain relevance from the teaching, and the lessons gain a reason to
exist beyond a definition.

---

## 9. Answer engines

- **They retrieve passages, not pages.** A short definition under a plain
  heading gets quoted; an answer spread across six interactive steps does not.
  Lesson 1's glossary and summary are the model.
- **llms.txt:** one bullet per published lesson, with its one-line answer, as
  Lesson 1's already is.
- **Bing's AI Performance report** shows which lesson was cited for which
  grounding query. It is the closest thing to a list of the questions the
  lessons answer for assistants.
- **Freshness counts with assistants.** Keep the dates real (§3.2) rather than
  bumping them.

---

## 10. Distribution beyond YouTube

- **Teachers and choirs.**
  - A one-page note offering the series free for classes. A school or choir
    page that links a lesson is the most valuable link the site can earn.
  - Listing in open-education directories would help further. That depends on
    the licence (§13).
- **Communities.** r/musictheory (strict on self-promotion), r/singing and
  r/learnmusic. Answer the question asked; link the lesson when it is the best
  answer.
- **The newsletter,** one issue per lesson (`docs/plans/newsletter-registered-users.md`).
- **The about site.** A Lessons section linking the hub.

---

## 11. Measurement

| Where                  | What to read                                                                         |
| ---------------------- | ------------------------------------------------------------------------------------ |
| Search Console         | Pages under `/learn/`: queries, impressions, click rate per lesson; Discover, if any |
| Bing Webmaster Tools   | AI Performance: citations and grounding queries per lesson                           |
| First-party            | Lesson-to-room clicks (`?lesson=NN`, CURRICULUM § 4 item 6); the lesson telemetry    |
| YouTube Studio         | As `YOUTUBE.md`; the description link's clicks arrive as youtube.com referrals       |
| A monthly prompt check | "why do 220 Hz and 440 Hz share a name", "how to match pitch", "intervals explained" |

---

## 12. Checklist for each new lesson

1. The head, as in §3.1.
2. The two structured-data blocks, from Lesson 1's.
3. Publish it in the admin console: that puts it live with no release
   (§3.4). Release it by deleting its line from `drafts.ts`. Run
   `src/tests/lesson-pages.test.ts`, and fix what it names:
   - the sitemap;
   - llms.txt;
   - `STANDALONE_DOCUMENT_PATHS`;
   - the first-paint budget, which `scripts/assert-first-paint-budgets.mjs`
     asks for at build.

   No other lesson's page needs an edit: the previous lesson's next-lesson
   card (`kit/next-card.ts`) and every explorer read the season, so the card
   turns from "Coming later" to "Start lesson" and links the new page.

4. Links out: home, hub, previous and next lesson, the room. Links in: the room
   pages in §8.
5. The day it goes live, which is the day the console publishes it:
   - request indexing in Search Console and Bing;
   - publish the episode on YouTube with the lesson link first.
6. Set `datePublished` and the sitemap date to that day, in the commit that
   deletes its `drafts.ts` line or in one straight after the console publishes
   it (§3.2).

---

## 13. Owner decisions

1. **Titles.** Query-led (the §4 drafts), or "Find Your Pitch, Lesson N" as
   now. Recommended: query-led, with the series in the kicker, breadcrumb and
   card.
2. **Bylines.** Who is named as author, and the vocal coach as reviewer on
   voice lessons.
3. **The hub** at `/learn/` when Lesson 2 ships. Recommended: yes.
4. **Watch pages.** After YouTube, if Search Console shows the lessons
   ranking.
5. **Articles.** Whether to write them, how often, and who writes them; the
   Markdown generator past three.
6. **Licence for the lesson text and figures.** An open licence (for example CC
   BY-NC-SA) opens open-education directories and school links. All rights
   reserved keeps control.
7. **Aggregate data.** Whether anonymous aggregates from the app may be
   published in an article (the privacy plan decides).

---

## Sources

Checked on 2026-10-19.

- [Article structured data](https://developers.google.com/search/docs/appearance/structured-data/article)
- [Breadcrumb structured data](https://developers.google.com/search/docs/appearance/structured-data/breadcrumb)
- [Video SEO best practices](https://developers.google.com/search/docs/appearance/video)
- [Google Discover](https://developers.google.com/search/docs/appearance/google-discover)
- [Optimizing for generative AI features](https://developers.google.com/search/docs/fundamentals/ai-optimization-guide)
- [Search Central updates](https://developers.google.com/search/updates):
  FAQ rich results ended 7 May 2026, practice problems January 2026, the
  llms.txt note on 15 June 2026.
- [Simplifying the search results page](https://developers.google.com/search/blog/2025/06/simplifying-search-results)
  (12 June 2025): Course info and Learning Video among the features phased
  out.
