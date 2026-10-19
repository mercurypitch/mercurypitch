// ============================================================
// Lesson drafts — the lesson pages that wait on a sign-off
// ============================================================
//
// One list, and the whole switch reads it. A lesson on it has a page that
// is built, routed and linked only where drafts are shown: `pnpm dev`, the
// dev site and every PR preview (development mode, .env.development), and
// the e2e bundle (`build:e2e` sets VITE_DRAFT_LESSONS=1, as it lists
// Glassworks). A production build (`pnpm build`, every release tag) leaves
// the document out of the build, routes nothing to it and links nothing to
// it: the lesson's season entry folds to a planned lesson (season.ts), so
// Lesson 1's explorer, and every other page's, shows it with no link, and
// scripts/assert-draft-lessons.mjs proves all of that on the finished dist.
//
// Releasing a lesson means deleting its line here. Then, as for any lesson
// going live, list it in public/sitemap.xml and public/llms.txt, which keep
// drafts out. Lesson 5 joined with its page, its season entry under the
// same gate; Lesson 7, a voice lesson too, joins when its page is built.
//
// An object keyed by lesson number, not an array, so that a season entry's
// `DRAFT_LESSONS[3]` is a constant the bundler folds away. Nothing here may
// read `import.meta`: vite.config.ts, tools/draft-lessons.ts and the dist
// assert read this file in plain Node. The build's own answer, whether
// drafts are shown, is draft-switch.ts.

/** The lessons whose pages wait on a sign-off, each with what it waits on. */
export const DRAFT_LESSONS: Readonly<Partial<Record<number, string>>> = {
  3: "the vocal coach's sign-off (MASTER-PLAN § 12 item 8)",
  5: "the vocal coach's sign-off (MASTER-PLAN § 12 item 8)",
}
