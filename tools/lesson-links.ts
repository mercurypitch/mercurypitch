// ============================================================
// Lesson links — the released lessons every entry document's nav carries
// ============================================================
//
// A Find Your Pitch lesson is a hand-written document (learn/NN.html), and a
// lesson is released by deleting its line from src/features/lessons/kit/
// drafts.ts (tools/draft-lessons.ts). This reads the released ones off the
// documents themselves, so that same deletion is what links a lesson from
// every crawlable entry document: nothing here names a lesson.
//
// A link's words are the lesson's structured-data headline ("What is a
// note?") with its number. A lesson without one still gets a link, as
// "Lesson N"; src/tests/lesson-pages.test.ts fails until it has one.
//
// Drafts are never linked, whichever way an environment shows them: a nav
// is what a crawler follows, and a draft is not for crawling. One the admin
// console publishes before its line is deleted is still not linked here,
// since these navs are written at build time; the site worker lists it in
// the sitemap and llms.txt as it serves them (src/lesson-gate.ts), and the
// release that deletes its line links it here.

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { DRAFT_LESSONS } from '../src/features/lessons/kit/drafts'
import { lessonDocument, lessonPath, releasedLessons } from './draft-lessons'

export interface LessonLink {
  href: string
  label: string
}

const LD_JSON = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g

/** The `headline` of a document's Article node, if it has one. */
export function lessonHeadline(html: string): string | undefined {
  for (const match of html.matchAll(LD_JSON)) {
    try {
      const node = JSON.parse(match[1]) as Record<string, unknown>
      if (node['@type'] === 'Article' && typeof node.headline === 'string') {
        return node.headline
      }
    } catch {
      // Malformed markup is lesson-pages.test.ts's to report, not the build's.
    }
  }
  return undefined
}

/** Every released lesson as a nav link, in lesson order. */
export function releasedLessonLinks(
  root: string,
  drafts: Readonly<Partial<Record<number, string>>> = DRAFT_LESSONS,
): LessonLink[] {
  return releasedLessons(root, drafts).map((n) => {
    const headline = lessonHeadline(
      readFileSync(resolve(root, lessonDocument(n)), 'utf8'),
    )
    return {
      href: lessonPath(n),
      label:
        headline === undefined ? `Lesson ${n}` : `${headline} (Lesson ${n})`,
    }
  })
}
