// ============================================================
// lesson-words — count the words a learner reads on a lesson's page
// ============================================================
//
// Each Find Your Pitch package states how many words its page asks a learner
// to read, and its run time rests on that count (FACTS, the run-time fact;
// WEB-SPEC, Length). The packages counted with the review's wc_learner.py,
// which lived outside the repository; this is that counter, brought in, with
// the rules below. They follow what the LESSON.md files actually mark.
//
// What counts: the page's copy as a first visit with sound on shows it, with
// the hook the admin console starts with, and every branch a learner's own
// answer opens, as every package counts it: each quiz answer's feedback, each
// "How did that feel?" line, both "You said" lines, "Just listen today", the
// no-microphone line and the practice card's "Instead" version. One learner
// reads one branch of each, so the count is an upper bound on what one
// reads. The series' cap, Lesson 3's page, counts them too, so a count
// without them would not compare with it. Headings count, and so do the
// labels the files write the copy under ("Kicker:", "Feedback:",
// "**[correct]**"), as the review counted them.
//
// What is left out:
//
// - The preamble, everything down to the file's first `---` rule: it is the
//   package's note to the team.
// - The team's sections, "For the vocal coach" (Lesson 5's "... and the
//   owner" too), "Section headings", "Footer" and Lesson 2's "Head and
//   footer" (its title, meta and share text, llms.txt line and credits), each
//   down to the next `## ` heading.
// - Notes: every italic note in square brackets, `_[...]_`, whether it opens
//   "Editorial:" or not ("_[The default since ...]_", "_[After the cold open
//   since ...]_"). The review's counter left out only the ones that open
//   "Editorial:"; the series' cap is Lesson 3's page less such a note, taken
//   off by hand (Lesson 9 FACTS 5).
// - Toy lines, a paragraph that opens `_Toy:` or `_Toys:`, naming the step's
//   toy for the builder. The review's pattern missed `_Toys:` (Lessons 6 and
//   10 FACTS say so).
// - Stage directions: a passage wholly in parentheses, from a "(" at the
//   start of a line to the ")" that closes it at the end of a line. The text
//   packages put a state's hints here ("With sound off, the hint reads: ...").
// - The sound-off state, which the default path never takes: a line, or a
//   list item, that opens "With sound off" with the page's line quoted after
//   it. Lessons 6 to 8, written down as their pages were built, list a line's
//   states in the open, where the text packages keep them in parentheses.
// - HTML comments, fenced code and inline code: the learner never sees them.
//
// A word is the review's: a run of letters, digits, apostrophes, ♯, ♭, %, "."
// and "-" with a letter or a digit in it, so "F♯", "2:1" (two words) and a
// list's "1." count, and a bare dash, a table's rule row or a "·" does not.
//
// A step's own text, the number § 4.2's 50 to 120 words a step is held to,
// is its section less its heading, its block quotes (the mix-up card and the
// Go deeper drawer) and its tables (Lesson 6's five anchors).
//
// The caps come from the WEB-SPEC.md beside LESSON.md, in its Length section:
// the series' cap ("the series' cap of 2,379", or "the series' cap, Lesson
// 3's page at 2,355") and the words a step may run ("50 to 120 a step").
//
// Usage: node scripts/lesson-words.mjs <lesson folder or LESSON.md> [--all] [--json]
//   --all   list every counted line under its section, to audit the count
//   --json  print the count as JSON

import { existsSync, readFileSync, statSync } from 'node:fs'
import { basename, dirname, join, relative, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const TEAM_SECTIONS = [
  'For the vocal coach',
  'Section headings',
  'Footer',
  'Head and footer',
]
/** Whether a `## ` heading opens one of the team's sections ("For the vocal coach and the owner" too). */
const isTeamSection = (title) =>
  typeof title === 'string' &&
  TEAM_SECTIONS.some((name) => title.startsWith(name))
const WORD = /[A-Za-z0-9À-ɏ'’♯♭%.-]+/g
const HAS_LETTER_OR_DIGIT = /[A-Za-z0-9]/

/** The words in `text`, by the review's pattern. */
export function words(text) {
  return (text.match(WORD) ?? []).filter((w) => HAS_LETTER_OR_DIGIT.test(w))
}

/** `text` with every character but a newline turned to a space, so lines and columns keep their place. */
const blank = (text) => text.replace(/[^\n]/g, ' ')

// What the learner never reads, in the order it is taken out: a comment or a
// code block first, so nothing inside one is read as a note; then the notes,
// the toy lines and the stage directions, in the review's order; then inline
// code, and the sound-off lines the default path never shows.
const LEFT_OUT = [
  /<!--[\s\S]*?-->/g,
  /^ *(```|~~~)[^\n]*\n[\s\S]*?^ *\1[^\n]*$/gm,
  /_\[[\s\S]*?\]_/g,
  /^_Toys?:[\s\S]*?_$/gm,
  /^\((?:[^()]|\([^()]*\))*\)\s*$/gm,
  /`[^`]+`/g,
  /With sound off[^:"\n]*: "[^"]*"\.?/g,
]

/**
 * Counts one LESSON.md's learner words. Returns its sections, each with its
 * words and, for a step, its own text's words; the total; and every counted
 * line, with what is left of it.
 */
export function countLesson(markdown) {
  const lines = markdown.split('\n')
  const rule = lines.findIndex((line, i) => i > 0 && line === '---')
  const start = rule === -1 ? 0 : rule + 1

  // Each line's section: the `## ` heading above it, after the rule.
  const sectionOf = []
  let title = null
  for (let i = 0; i < lines.length; i += 1) {
    const heading = /^## (.*\S)\s*$/.exec(lines[i])
    if (i >= start && heading) title = heading[1]
    sectionOf.push(i < start ? undefined : title)
  }

  // The team's sections and the preamble go first, as the review's counter
  // takes them out, so a note cannot run on into the copy across them.
  let text = lines
    .map((line, i) =>
      sectionOf[i] === undefined || isTeamSection(sectionOf[i])
        ? blank(line)
        : line,
    )
    .join('\n')
  for (const pattern of LEFT_OUT) text = text.replace(pattern, blank)
  const kept = text.split('\n')

  const sections = []
  const counted = []
  for (let i = start; i < kept.length; i += 1) {
    const name = sectionOf[i]
    if (isTeamSection(name)) continue
    const label = name ?? '(before the first heading)'
    let section = sections.at(-1)
    if (section?.title !== label) {
      const step = /^Step \d+ of \d+:/.test(label)
      section = {
        title: label,
        line: i + 1,
        words: 0,
        stepText: step ? 0 : null,
      }
      sections.push(section)
    }
    const n = words(kept[i]).length
    if (n === 0) continue
    section.words += n
    // A step's own text: not its heading, a block quote or a table row.
    const inStepText =
      section.stepText !== null &&
      i + 1 !== section.line &&
      !/^\s*[>|]/.test(kept[i])
    if (inStepText) section.stepText += n
    counted.push({
      line: i + 1,
      section: label,
      words: n,
      stepText: inStepText,
      text: kept[i].replace(/\s+/g, ' ').trim(),
    })
  }
  const total = sections.reduce((sum, s) => sum + s.words, 0)
  return {
    sections: sections.filter((s) => s.words > 0),
    total,
    lines: counted,
  }
}

const toNumber = (digits) => Number(digits.replace(/,/g, ''))

/**
 * The caps a WEB-SPEC.md states in its Length section: the series' cap on the
 * page's words, and the words a step's own text may run.
 */
export function capsFrom(webSpec) {
  const length = /^## Length\s*$([\s\S]*?)(?=^## |(?![\s\S]))/m.exec(webSpec)
  if (!length) return { cap: null, stepCap: null }
  const prose = length[1].replace(/\s+/g, ' ')
  const cap =
    /series' cap(?: of|,? Lesson 3's page(?: on the same counter?)? at) (\d[\d,]*)/.exec(
      prose,
    )
  const step = /(\d+) to (\d+)(?: words)? a step/.exec(prose)
  return {
    cap: cap ? toNumber(cap[1]) : null,
    stepCap: step ? { min: Number(step[1]), max: Number(step[2]) } : null,
  }
}

/** The LESSON.md a folder or a file names. */
export function lessonFile(path) {
  const full = resolve(path)
  return existsSync(full) && statSync(full).isDirectory()
    ? join(full, 'LESSON.md')
    : full
}

/** Counts the lesson at `path` (its folder or its LESSON.md) and reads its caps. */
export function countLessonAt(path) {
  const file = lessonFile(path)
  const result = countLesson(readFileSync(file, 'utf8'))
  const spec = join(dirname(file), 'WEB-SPEC.md')
  const caps = existsSync(spec)
    ? capsFrom(readFileSync(spec, 'utf8'))
    : { cap: null, stepCap: null }
  const lesson = /^(\d{2})-/.exec(basename(dirname(file)))?.[1] ?? null
  return { lesson, file, ...result, ...caps }
}

const grouped = (n) => n.toLocaleString('en-GB')

function report(count, all) {
  const out = []
  const name = count.lesson ? `Lesson ${count.lesson}` : 'Lesson'
  out.push(`${name}: ${relative(process.cwd(), count.file)}`, '')
  if (all) {
    for (const section of count.sections) {
      const own =
        section.stepText === null ? '' : `, its own text ${section.stepText}`
      out.push(`## ${section.title} (${section.words}${own})`)
      for (const line of count.lines.filter((l) => l.section === section.title))
        out.push(
          `${String(line.line).padStart(5)} ${String(line.words).padStart(3)} ${line.stepText ? 'T' : ' '}  ${line.text}`,
        )
      out.push('')
    }
    out.push("T: counted in the step's own text.", '')
  }
  out.push('words  section')
  for (const section of count.sections) {
    let own = ''
    if (section.stepText !== null) {
      const { stepCap } = count
      const over =
        stepCap &&
        (section.stepText < stepCap.min || section.stepText > stepCap.max)
      own = ` (its own text ${section.stepText}${over ? `, outside ${stepCap.min} to ${stepCap.max}` : ''})`
    }
    out.push(`${grouped(section.words).padStart(5)}  ${section.title}${own}`)
  }
  let cap = ''
  if (count.cap !== null) {
    const gap = count.total - count.cap
    const side =
      gap === 0
        ? 'level with it'
        : `${grouped(Math.abs(gap))} ${gap > 0 ? 'over' : 'under'}`
    cap = `, cap ${grouped(count.cap)}: ${side}`
  }
  out.push(`${grouped(count.total).padStart(5)}  in all${cap}`)
  if (count.stepCap)
    out.push(
      `       a step's own text: ${count.stepCap.min} to ${count.stepCap.max} words`,
    )
  return out.join('\n')
}

function main(argv) {
  const flags = new Set(argv.filter((a) => a.startsWith('--')))
  const paths = argv.filter((a) => !a.startsWith('--'))
  const unknown = [...flags].filter((f) => f !== '--all' && f !== '--json')
  if (paths.length !== 1 || unknown.length > 0) {
    console.error(
      'Usage: node scripts/lesson-words.mjs <lesson folder or LESSON.md> [--all] [--json]',
    )
    return 2
  }
  const file = lessonFile(paths[0])
  if (!existsSync(file)) {
    console.error(`No such lesson: ${file}`)
    return 2
  }
  const count = countLessonAt(file)
  if (flags.has('--json')) {
    const { lines: _lines, ...rest } = count
    const json = flags.has('--all') ? count : rest
    console.log(
      JSON.stringify({ ...json, file: relative(process.cwd(), file) }, null, 2),
    )
  } else console.log(report(count, flags.has('--all')))
  return 0
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
)
  process.exitCode = main(process.argv.slice(2))
