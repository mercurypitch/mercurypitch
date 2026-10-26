Search engines and answer engines that run no script could not get from one lesson to the next, or back to the season page, and the room pages never named the lessons that practise in them. This adds those links to the HTML every lesson page and room page is served with, and moves the lesson tour's question mark off the page content. It is polish for 0.9.22.

## What changes

**A trail back to the hub on every lesson page.** `MercuryPitch > Find Your Pitch > What is a note?` sits under the masthead, in a nav named "Breadcrumb" with the lesson as the current page. The build writes it from each page's own BreadcrumbList (`tools/lesson-ways.ts`, a Vite plugin beside the hub's), so the visible trail and the structured data cannot disagree and a new lesson page needs no edit. MercuryPitch links home because the masthead's logo goes to the top of the lesson. On a narrow phone the lesson's name ends in an ellipsis; the hero starts 8 px lower on a phone and where it did on a desktop.

**The lessons either side, in the served HTML.** Each lesson page's foot links the lesson before and the lesson after (`rel="prev"`, `rel="next"`), the next under "Next lesson". They sit in the foot, not the Wrap, so inside the lesson a reader meets the next lesson once, in the card the script draws. Drafts are linked at build time and taken out per request, as every nav link to a lesson that is not live already is: on mercurypitch.com Lesson 1 keeps its link to Lesson 2 and Lesson 2's foot loses Lesson 3; on dev, previews and local both stay. The worker test now serves lesson pages as the build writes them and proves both states; the page-state test proves the same for a page no worker served.

**The room pages link their lessons.** The entry model gains `lessonsPractised`, holding the table in SEARCH.md § 8, and each room's document links its released lessons under the lede: "Find Your Pitch lesson: What is a note? (Lesson 1)". Today `/mirror` and `/vocal-range-test` link Lesson 1 and `/ear-lab` links Lesson 2; every other row writes nothing until its lesson is released, and that release links it.

**The tour's question mark covers nothing.** Under 1181 px it hung under the masthead over the page (the hero's Sound chip on Lesson 1 at 390 px, the kicker elsewhere). It now ends the masthead's row at every width, still a 44 px target at the top right where the tour's last step says it is. To make the room, the masthead's logo gives way to it under 561 px and from 821 to 1020 px, and the wordmark from 1021 to 1180 px; the trail just under the masthead names and links MercuryPitch at every width, and a page whose script never ran keeps its logo.

**Hub stays as light as it was.** The trail's and foot's styles live in `lesson-sections.css`, which the hub does not import (+16 bytes on the hub, one shared selector).

## Words

New: "Breadcrumb" (the trail's accessible name) and, on the room pages, "Find Your Pitch lesson:" / "Find Your Pitch lessons:" before the links. Everything else comes from the pages and the kit: the trail's names from each BreadcrumbList, "Next lesson" from the next-lesson card, "Season 1 lessons" from the lesson menu, lesson names as the hub writes them.

## Checks

- `pnpm check`: 0 errors, 11 warnings (as on main).
- Unit: 761 files, 9920 passed, 1 skipped (lessons, tests, seo, the gate, tools); the trail, gate and page-state files again on this head, 102 passed.
- `pnpm test:scripts` 255 pass; `pnpm pr:validate`; `pnpm metrics:check` no regressions; `pnpm docs:index:check` current; plan citations 157 findings, as on main.
- `build:e2e` to the Glassworks LFS step (expected in this checkout); first-paint budgets pass, no budget changed (Lessons 1 to 8 +1506 bytes of CSS each; Lesson 1 has 2940 bytes left); draft lessons shown as expected; lesson pages' stylesheet links unchanged.
- Browser, `--retries=0`: all 34 `learn-*` specs and the ear-lab, mirror and lesson-marker entry specs, 430 passed, 2 skipped; the tour spec again after its last change, 25/25.
- A measured check of the question mark on Lessons 1 to 8 at 320x568, 360x740, 390x844, 844x390, 768x1024, 820x1180, 1024x768 and 1180x820: 64 overlaps on main, 0 here.
- Mutations, each caught: a page without its trail, or a trail that disagrees with its BreadcrumbList; a next link to a held-back draft left linked in production state; the next lesson shown twice in the Wrap; a room linking a draft; the question mark back over the page.

## Notes

- Two layout faults found on the way, both on draft lessons and left for a later fix: Lesson 6's tune keeps the note buttons it laid out at the first width when the window narrows, and Lesson 7's hero "Play" button is 1 px wider than its card at 320 px.
- `ear-lab.html` lists `ConfirmDialog.css` a few places earlier in its stylesheet links after this build; the file is a CSS module (hashed class names), so the order cannot change what it styles.
