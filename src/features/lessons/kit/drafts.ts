// ============================================================
// Lesson drafts — the lesson pages that wait on a sign-off
// ============================================================
//
// One list, and the publish default reads it. Every build carries a
// draft's page, as it carries every lesson's; what the list decides is
// whether the site serves it while the admin console has said nothing about
// it (kit/publish.ts). Each environment has its own answer for a draft
// (src/lesson-gate.ts, the LESSON_DRAFTS var in wrangler.jsonc): served
// and linked on the dev site and every PR preview, held back on
// mercurypitch.com, where its address answers the 404 page and every
// page's explorer shows it with no link, as a lesson not written yet.
// Publishing it from the console puts it live there without a release.
// A page no worker served (`pnpm dev`, the e2e bundle) takes its build's
// answer instead (draft-switch.ts), and scripts/assert-draft-lessons.mjs
// checks a finished dist against the build it should be.
//
// Releasing a lesson means deleting its line here. Then, as for any lesson
// going live, list it in public/sitemap.xml and public/llms.txt, which keep
// drafts out: the site worker adds a draft to both only while it is
// published. Lesson 5 joined with its page, and Lesson 7, a voice lesson
// too, joined with its own. The Content Studio's Lessons page
// (/admin/lessons) shows this list as it stands and what the site it runs
// on serves.
//
// An object keyed by lesson number, read in place (`DRAFT_LESSONS[n]`).
// Nothing here may read `import.meta`: vite.config.ts, tools/draft-lessons.ts,
// the site worker and the dist assert read this file outside a Vite bundle.

/** The lessons whose pages wait on a sign-off, each with what it waits on. */
export const DRAFT_LESSONS: Readonly<Partial<Record<number, string>>> = {
  5: "the vocal coach's sign-off (MASTER-PLAN § 12 item 8)",
  6: "the owner's review of the page, and the vocal coach's look at Sing it (MASTER-PLAN § 12 item 8)",
  7: "the owner's review of the page, and the vocal coach's sign-off (MASTER-PLAN § 12 item 8)",
  8: "the vocal coach's sign-off (MASTER-PLAN § 12 item 8)",
  9: "the vocal coach's sign-off (MASTER-PLAN § 12 item 8)",
  10: "Lesson 6's page at /learn/06, and the vocal coach's look at the sung checkpoint",
  11: "the vocal coach's sign-off (MASTER-PLAN § 12 item 8)",
  12: "Lesson 10's page at /learn/10, and the vocal coach's look at the sung checkpoint",
  13: "the vocal coach's sign-off (MASTER-PLAN § 12 item 8)",
  14: "the vocal coach's sign-off (MASTER-PLAN § 12 item 8)",
  15: "the vocal coach's look at Sing it (MASTER-PLAN § 12 item 8)",
  16: "Lessons 9 and 15's pages at /learn/09 and /learn/15, and the vocal coach's sign-off (MASTER-PLAN § 12 item 8)",
  17: "Lesson 8's page at /learn/08, and the vocal coach's look at the sung part",
  18: "Lessons 16 and 17's pages at /learn/16 and /learn/17, and the vocal coach's sign-off (MASTER-PLAN § 12 item 8)",
  19: "Lesson 17's page at /learn/17",
  20: "Lessons 5, 9 and 10's pages, and the vocal coach's sign-off (MASTER-PLAN § 12 item 8)",
  21: "Lessons 6 and 15's pages at /learn/06 and /learn/15, and the vocal coach's look at Sing it (MASTER-PLAN § 12 item 8)",
  22: "the vocal coach's sign-off (MASTER-PLAN § 12 item 8)",
  23: "Lesson 6's page at /learn/06, and the vocal coach's look at Sing it",
  24: "the lab's two tests (its WEB-SPEC, What the kit and the app still need, item 7), and the vocal coach's sign-off (MASTER-PLAN § 12 item 8)",
  25: "Lessons 10, 21 and 23's pages at /learn/10, /learn/21 and /learn/23, and the vocal coach's look at the sung checkpoint and the sung drill",
  26: "Lessons 12 and 24's pages at /learn/12 and /learn/24, the lab test (its WEB-SPEC, What the kit and the app still need, item 8), and the vocal coach's sign-off (MASTER-PLAN § 12 item 8)",
  27: "Lessons 12 and 23's pages at /learn/12 and /learn/23, and the vocal coach's look at the sung checkpoint and the sung drill",
  28: "Lessons 18 and 26's pages at /learn/18 and /learn/26, the lab test (its WEB-SPEC, What the kit and the app still need, item 9), and the vocal coach's sign-off (MASTER-PLAN § 12 item 8)",
}
