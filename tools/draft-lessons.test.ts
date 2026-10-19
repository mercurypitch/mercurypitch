// ============================================================
// Draft lessons tests — a lesson waiting on a sign-off stays off mercurypitch.com
// ============================================================
//
// The switch's rules run on a fixture of lesson pages; the rest runs against
// the real env files, scripts, documents and listings, so a change to any of
// them fails here before it fails a release build. Releasing a lesson changes
// no test: it deletes the lesson's line from drafts.ts and lists the page in
// the sitemap and llms.txt, which the last test below then requires. The
// folded season entry is season.test.ts's; the finished dist is
// scripts/assert-draft-lessons.mjs's.

import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync, } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { DRAFT_LESSONS } from '../src/features/lessons/kit/drafts'
import { builtLessons, draftLessons, isDraftLessonsShown, lessonDocument, lessonInputs, lessonPages, lessonPath, lessonPaths, resolveLessonStates, } from './draft-lessons'

const ROOT = resolve(__dirname, '..')

const repoFile = (path: string): string =>
  readFileSync(resolve(ROOT, path), 'utf8')

const scripts = (): Record<string, string> =>
  (JSON.parse(repoFile('package.json')) as { scripts: Record<string, string> })
    .scripts

const temporary: string[] = []

/** A repository root whose learn/ holds these files. */
function fixture(names: readonly string[]): string {
  const root = mkdtempSync(resolve(tmpdir(), 'draft-lessons-'))
  temporary.push(root)
  mkdirSync(resolve(root, 'learn'))
  for (const name of names) writeFileSync(resolve(root, 'learn', name), '')
  return root
}

afterEach(() => {
  for (const root of temporary.splice(0))
    rmSync(root, { recursive: true, force: true })
})

// Lesson 1 live, Lesson 3 waiting on a sign-off.
const WAITING = { 3: 'the vocal coach' }

describe('the draft lessons switch', () => {
  it('shows the drafts only on an explicit "1" or "true"', () => {
    expect(isDraftLessonsShown('1')).toBe(true)
    expect(isDraftLessonsShown('true')).toBe(true)
    expect(isDraftLessonsShown(' TRUE ')).toBe(true)
    for (const value of [undefined, '', '0', 'false', 'no', 'yes'])
      expect(isDraftLessonsShown(value)).toBe(false)
  })

  it('sets it on for development mode and off for production mode', () => {
    expect(repoFile('.env.development')).toMatch(/^VITE_DRAFT_LESSONS=1$/m)
    expect(repoFile('.env.production')).toMatch(/^VITE_DRAFT_LESSONS=0$/m)
  })

  it('asserts the matching state on every build that writes a deploy or a test bundle', () => {
    const s = scripts()
    expect(s.build).toContain('assert-draft-lessons.mjs dist --hidden')
    expect(s['build:tours']).toContain('assert-draft-lessons.mjs dist --hidden')
    expect(s['build:dev']).toContain('assert-draft-lessons.mjs dist --shown')
    expect(s['build:e2e']).toContain('VITE_DRAFT_LESSONS=1')
    expect(s['build:e2e']).toContain('assert-draft-lessons.mjs dist --shown')
  })
})

describe('the lesson pages', () => {
  it('are the learn/NN.html documents, in lesson order', () => {
    // Arrange
    const root = fixture(['03.html', '01.html', '1.html', '01.md', 'x.html'])

    // Act + Assert
    expect(lessonPages(root)).toEqual([1, 3])
    expect(lessonPages(resolve(root, 'nowhere'))).toEqual([])
  })

  it('include Lessons 1, 3 and 5 in this repository', () => {
    expect(lessonPages(ROOT)).toEqual(expect.arrayContaining([1, 3, 5]))
  })
})

describe('a build that shows the drafts', () => {
  it('builds every lesson page and rewrites every clean path, drafts included', () => {
    // Arrange
    const root = fixture(['01.html', '03.html'])

    // Act
    const inputs = lessonInputs(root, true, WAITING)
    const paths = lessonPaths(root, true, WAITING)

    // Assert
    expect(inputs).toEqual({
      lesson01: resolve(root, 'learn/01.html'),
      lesson03: resolve(root, 'learn/03.html'),
    })
    expect(paths).toEqual(['/learn/01', '/learn/03'])
  })
})

describe('a build that hides the drafts', () => {
  it('builds and routes the live lessons only', () => {
    // Arrange
    const root = fixture(['01.html', '03.html'])

    // Act
    const inputs = lessonInputs(root, false, WAITING)
    const paths = lessonPaths(root, false, WAITING)

    // Assert
    expect(inputs).toEqual({ lesson01: resolve(root, 'learn/01.html') })
    expect(paths).toEqual(['/learn/01'])
  })

  it('builds a lesson once its line leaves drafts.ts: releasing is deleting the line', () => {
    // Arrange
    const root = fixture(['01.html', '03.html'])

    // Act + Assert
    expect(builtLessons(root, false, {})).toEqual([1, 3])
    expect(lessonPaths(root, false, {})).toEqual(['/learn/01', '/learn/03'])
  })
})

describe('the list of drafts', () => {
  it('names lessons in order, and none once a line is deleted', () => {
    expect(draftLessons({ 7: 'x', 5: 'y' })).toEqual([5, 7])
    expect(draftLessons({})).toEqual([])
  })

  it('says what each draft waits on', () => {
    for (const n of draftLessons())
      expect(DRAFT_LESSONS[n], `${n}`).toMatch(/\w/)
  })

  it('has a document in the repository for every draft, so a shown build can build it', () => {
    for (const n of draftLessons())
      expect(existsSync(resolve(ROOT, lessonDocument(n))), `${n}`).toBe(true)
  })

  it('keeps every draft out of the sitemap and llms.txt until its sign-off', () => {
    for (const n of draftLessons()) {
      const path = lessonPath(n)
      expect(repoFile('public/sitemap.xml'), `${n}`).not.toContain(path)
      expect(repoFile('public/llms.txt'), `${n}`).not.toContain(path)
    }
  })

  it('leaves every other lesson page live: in the sitemap and llms.txt', () => {
    // A line deleted from drafts.ts without the listings fails here: a release
    // is all three, and a slip that drops the line alone does not ship.
    const drafts = draftLessons()
    for (const n of lessonPages(ROOT).filter((m) => !drafts.includes(m))) {
      const url = `https://mercurypitch.com${lessonPath(n)}`
      expect(repoFile('public/sitemap.xml'), `${n}`).toContain(url)
      expect(repoFile('public/llms.txt'), `${n}`).toContain(url)
    }
  })
})

describe("a page's words about which lessons are ready", () => {
  const LINE =
    'Next: Lesson 5 <span data-if-live="5">ready to read</span\n  ><span data-if-planned="5">Coming later</span>.'

  /** A document's text, its whitespace runs closed up as a browser lays it out. */
  const words = (html: string): string => html.replace(/\s+/g, ' ')

  it('keeps the reading that is true of the build, unwrapped, and drops the other', () => {
    // Act
    const live = resolveLessonStates(LINE, [1, 2, 4, 5])
    const planned = resolveLessonStates(LINE, [1, 2, 4])

    // Assert
    expect(live).toBe('Next: Lesson 5 ready to read.')
    expect(planned).toBe('Next: Lesson 5 Coming later.')
  })

  it('refuses a reading that holds a span of its own, which would end it early', () => {
    const nested = '<span data-if-live="3">a <span>b</span> c</span>'

    expect(() => resolveLessonStates(nested, [3])).toThrow(/holds a span/)
  })

  it("says Lesson 5 is coming later on Lesson 4's next-lesson card until a build carries its page", () => {
    // Arrange
    const html = repoFile('learn/04.html')
    const card = (live: readonly number[]): string => {
      const text = words(resolveLessonStates(html, live))
      const at = text.indexOf('05 · Breath and a steady note')
      return text.slice(at, at + 140)
    }
    const reading = (shown: boolean): string =>
      builtLessons(ROOT, shown).includes(5) ? 'ready to read' : 'Coming later'

    // Act and assert
    expect(card(builtLessons(ROOT, true))).toContain(reading(true))
    expect(card(builtLessons(ROOT, false))).toContain(reading(false))
    expect(card([1, 2, 4, 5])).toContain('ready to read')
    expect(card([1, 2, 4])).toContain('Coming later')
    expect(words(resolveLessonStates(html, [1, 2, 4]))).not.toMatch(/data-if-/)
  })
})
