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
  3: "the vocal coach's sign-off (MASTER-PLAN § 12 item 8)",
  4: "the owner's go-ahead", // Lessons 1 and 2 launch first, with their films
  5: "the vocal coach's sign-off (MASTER-PLAN § 12 item 8)",
  6: "the owner's review of the page, and the vocal coach's look at Sing it (MASTER-PLAN § 12 item 8)",
  7: "the owner's review of the page, and the vocal coach's sign-off (MASTER-PLAN § 12 item 8)",
  8: "the vocal coach's sign-off (MASTER-PLAN § 12 item 8)",
  9: "the vocal coach's sign-off (MASTER-PLAN § 12 item 8)",
  10: "Lesson 6's page at /learn/06, and the vocal coach's look at the sung checkpoint",
  12: "Lesson 10's page at /learn/10, and the vocal coach's look at the sung checkpoint",
}
