// The lesson word counter. Each fixture below is a small LESSON.md in the
// forms the packages write, with the words a learner reads counted by hand.
// The golden cases count the real packages and hold each total to the count
// its FACTS and its WEB-SPEC state. Lessons 7, 8 and 10 are left out of them:
// 7 and 8 state their text package's count, from before their pages wrote
// the built page's lines into LESSON.md, and Lesson 10's count takes in its
// two `_Toys:` lines, which this counter leaves out as toy lines.

import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync, } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { capsFrom, countLesson, words } from './lesson-words.mjs'

const SCRIPT = fileURLToPath(new URL('./lesson-words.mjs', import.meta.url))
const LESSONS = fileURLToPath(
  new URL('../docs/plans/find-your-pitch/lessons/', import.meta.url),
)

/** A LESSON.md: a preamble for the team, the rule, then `body`. */
const lesson = (body) =>
  `# Lesson 99: A test (written lesson)\n\nThe team's preamble, never counted.\n\n---\n\n${body}\n`

/** The words of the section titled `title`. */
const sectionWords = (count, title) =>
  count.sections.find((s) => s.title === title)?.words

test("a word is the review counter's: letters, digits, ♯, ♭ and the like", () => {
  // A lone "%" or "·" has no letter or digit, and "–", "—" and ":" split.
  assert.deepEqual(words('F♯ to B♭, 2:1, 35 % · 10–16 — "ooh" don\'t'), [
    'F♯',
    'to',
    'B♭',
    '2',
    '1',
    '35',
    '10',
    '16',
    'ooh',
    "don't",
  ])
})

test('the default line counts and its sound-off alternative does not', () => {
  const count = countLesson(
    lesson(`## Cold open: predict

The hint under the buttons:

- After one: "Locked in. Play both."
- With sound off: "Sound is off, so nothing played. Turn sound on to hear
  them, then press Play."

Stop: "Stopped." With sound off: "Sound is off, so the take didn't start."

(After a choice, Play unlocks. With sound off, the hint reads: "Sound is off.")`),
  )
  // Cold open predict (3); The hint under the buttons (5); After one Locked
  // in. Play both. (6); Stop Stopped. (2).
  assert.equal(count.total, 16)
  assert.ok(!count.lines.some((l) => /sound/i.test(l.text)))
})

test('every branch an answer opens counts: both "You said" lines', () => {
  const count = countLesson(
    lesson(`## Cold open: predict

Reveal, under "You said: most of it" or "You said: less than half": Less than half.`),
  )
  // Cold open predict (3); Reveal under You said most of it or You said less
  // than half Less than half. (16).
  assert.equal(count.total, 19)
})

test('a note is left out, whether it opens "Editorial:" or not', () => {
  const count = countLesson(
    lesson(`## Header

- Title (the hook question): **Why?** _[Editorial: the default since 20 October 2026,
  with an alternative in \`kit/lesson-copy.ts\`.]_
- Meta: 15 minutes

_[The default since 20 October 2026: one question, not two.]_

## Recall from Lesson 2

_[After the cold open since 20 October 2026.]_

Two questions from Lesson 2.`),
  )
  // Header (1); Title the hook question Why (5); Meta 15 minutes (3).
  assert.equal(sectionWords(count, 'Header'), 9)
  // Recall from Lesson 2 (4); Two questions from Lesson 2. (5).
  assert.equal(sectionWords(count, 'Recall from Lesson 2'), 9)
  assert.equal(count.total, 18)
})

test("a table counts by its cells, but not in a step's own text", () => {
  const count = countLesson(
    lesson(`## Step 5 of 5: Do the distances have names?

Five to keep:

| Interval           | Semitones |
| ------------------ | --------- |
| Perfect fifth (P5) | 7         |`),
  )
  const [step] = count.sections
  // The heading (9); Five to keep (3); Interval Semitones (2); the rule row
  // (0); Perfect fifth P5 7 (4).
  assert.equal(step.words, 18)
  assert.equal(step.stepText, 3)
})

test('a list counts its words and a numbered list its numbers, not its dashes', () => {
  const count = countLesson(
    lesson(`## Quick check

1. Which note is mi?
   - F♯ **[correct]** · Feedback: "Do is D."
   - E · Feedback: "E is re."`),
  )
  // Quick check (2); 1. Which note is mi (5); F♯ correct Feedback Do is D.
  // (6); E Feedback E is re. (5).
  assert.equal(count.total, 18)
})

test('inline code is left out without joining the words round it', () => {
  const count = countLesson(
    lesson(`## Wrap

The drill opens at \`/exercises/leap-ladder\` today, two\`code\`words.`),
  )
  // Wrap (1); The drill opens at today two words. (7).
  assert.equal(count.total, 8)
})

test("headings count; the preamble and the team's sections do not", () => {
  const count = countLesson(
    lesson(`## Header

- Kicker: LESSON 99

## Footer

Season 1 · Lesson 99.

## Section headings

| Section | Heading |
| ------- | ------- |

## For the vocal coach and the owner

The voice lines.

### Changed in the plain-language review

Before and after.

## Wrap

Three lines to keep.`),
  )
  assert.deepEqual(
    count.sections.map((s) => [s.title, s.words]),
    [
      // Header (1); Kicker LESSON 99 (3).
      ['Header', 4],
      // Wrap (1); Three lines to keep. (4).
      ['Wrap', 5],
    ],
  )
  assert.equal(count.total, 9)
})

test("Lesson 2's head and footer is the team's, down to the next heading", () => {
  const count = countLesson(
    lesson(`## Wrap

Three lines to keep.

## Head and footer

The page's head, its share text and its footer, exactly.

- \`<title>\`: A test: Find Your Pitch, Lesson 99 | MercuryPitch
- Description: "A ten-minute lesson with live sound toys."
- og:image:alt: Merc beside a keyboard.

## Sing it

Sing one note.`),
  )
  assert.deepEqual(
    count.sections.map((s) => [s.title, s.words]),
    [
      // Wrap (1); Three lines to keep. (4).
      ['Wrap', 5],
      // Sing it (2); Sing one note. (3).
      ['Sing it', 5],
    ],
  )
  assert.equal(count.total, 10)
})

test('toy lines, stage directions, comments and code blocks are left out', () => {
  const count = countLesson(
    lesson(`## Step 1 of 5: What shape is a tune?

Here's the tune's first line. (It goes up, then down.)

**Try:** play the line.

_Toy: the tune line, on C._

_Toys: the tune line; the Step or leap? ear game, a
round of ten._

(Merc sings the line on "ooh", and the beads light
as Merc sings them (one at a time).)

<!-- a comment for the team -->

\`\`\`text
code the learner never sees
\`\`\`

> **Common mix-up:** "A tune is a list of notes."`),
  )
  const [step] = count.sections
  // The heading (9); Here's the tune's first line. It goes up then down.
  // (10); Try play the line. (4); the mix-up card (9).
  assert.equal(step.words, 32)
  // Not the heading or the mix-up card.
  assert.equal(step.stepText, 14)
})

test("the caps come from the WEB-SPEC's Length section", () => {
  assert.deepEqual(
    capsFrom(`## Length

The learner copy is 2,350 words by the review's count (FACTS 5), 29 under the series' cap of 2,379.
Each step's text runs 106 to 120 words, inside § 4.2's 50 to 120 a step.

## Next
`),
    { cap: 2379, stepCap: { min: 50, max: 120 } },
  )
  assert.deepEqual(
    capsFrom(`## Length

The learner copy is 2,258 words by the review's count (FACTS 3), under the series' cap, Lesson 3's
page at 2,355 on the same count. Steps run inside § 4.2's 50 to 120 words a step.
`),
    { cap: 2355, stepCap: { min: 50, max: 120 } },
  )
  assert.deepEqual(capsFrom('## Toys\n\nNo length here.\n'), {
    cap: null,
    stepCap: null,
  })
})

test('the command counts a lesson folder, lists its lines and prints JSON', () => {
  const dir = mkdtempSync(join(tmpdir(), 'lesson-words-'))
  try {
    const folder = join(dir, '99-a-test')
    mkdirSync(folder)
    writeFileSync(
      join(folder, 'LESSON.md'),
      lesson(`## Step 1 of 5: Why?

Because it is.`),
    )
    writeFileSync(
      join(folder, 'WEB-SPEC.md'),
      "## Length\n\nUnder the series' cap of 2,379, and 50 to 120 a step.\n",
    )
    const json = spawnSync('node', [SCRIPT, folder, '--json'], {
      encoding: 'utf8',
    })
    assert.equal(json.status, 0, json.stderr)
    const parsed = JSON.parse(json.stdout)
    assert.equal(parsed.lesson, '99')
    // Step 1 of 5 Why (5); Because it is. (3).
    assert.equal(parsed.total, 8)
    assert.equal(parsed.cap, 2379)
    assert.deepEqual(parsed.stepCap, { min: 50, max: 120 })
    assert.equal(parsed.lines, undefined)
    assert.deepEqual(parsed.sections, [
      { title: 'Step 1 of 5: Why?', line: 7, words: 8, stepText: 3 },
    ])

    const all = spawnSync(
      'node',
      [SCRIPT, join(folder, 'LESSON.md'), '--all'],
      {
        encoding: 'utf8',
      },
    )
    assert.equal(all.status, 0, all.stderr)
    assert.match(all.stdout, /## Step 1 of 5: Why\? \(8, its own text 3\)/)
    assert.match(all.stdout, /^\s+9\s+3 T {2}Because it is\.$/m)
    assert.match(all.stdout, /^\s+8 {2}in all, cap 2,379: 2,371 under$/m)

    const usage = spawnSync('node', [SCRIPT], { encoding: 'utf8' })
    assert.equal(usage.status, 2)
    assert.match(usage.stderr, /Usage:/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// The lessons whose FACTS and WEB-SPEC state the count of today's LESSON.md.
const GOLDEN = ['09', '11', '12', '13', '14']

/** The number in `text` that `pattern` captures, without its commas. */
const stated = (text, pattern) => {
  const match = pattern.exec(text.replace(/\s+/g, ' '))
  return match ? Number(match[1].replace(/,/g, '')) : undefined
}

for (const nn of GOLDEN) {
  test(`Lesson ${nn}'s total is the count its package states`, () => {
    const folder = readdirSync(LESSONS).find((name) =>
      name.startsWith(`${nn}-`),
    )
    assert.ok(folder, `no folder for Lesson ${nn}`)
    const read = (name) => readFileSync(join(LESSONS, folder, name), 'utf8')
    const spec = read('WEB-SPEC.md')
    const length = /^## Length$([\s\S]*?)^## /m.exec(spec)?.[1] ?? ''
    const fromSpec = stated(length, /The learner copy is ([\d,]+) words/)
    const fromFacts = stated(read('FACTS.md'), /([\d,]+) words of learner copy/)
    assert.ok(fromSpec !== undefined, 'WEB-SPEC states no count')
    assert.equal(fromFacts, fromSpec, 'FACTS and WEB-SPEC disagree')

    const count = countLesson(read('LESSON.md'))
    assert.equal(count.total, fromSpec)

    // Each step's own text, as the Length section lists them.
    const steps = /\(Steps 1 to 5: ([\d, and]+)\)/.exec(
      length.replace(/\s+/g, ' '),
    )
    assert.ok(steps, 'WEB-SPEC lists no step counts')
    assert.deepEqual(
      count.sections.filter((s) => s.stepText !== null).map((s) => s.stepText),
      steps[1].split(/, | and /).map(Number),
    )
  })
}
