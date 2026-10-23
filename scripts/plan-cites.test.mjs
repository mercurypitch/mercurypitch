// The plan's citation tools read Markdown against a repository. The parser's
// cases run on text alone; the checks and the re-anchor run the command in a
// small git repository built for each case, so every finding is named by the
// command itself, and so is every pass.

import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync, } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { citedText, pieces } from './plan-cites/check.mjs'
import { isPattern, parseDoc } from './plan-cites/parse.mjs'
import { parseHunks, shiftRange } from './plan-cites/reanchor.mjs'

const SCRIPT = fileURLToPath(new URL('./plan-cites.mjs', import.meta.url))
const PLAN = 'docs/plans/find-your-pitch'
const DOC = `${PLAN}/FACTS.md`

/** `n` numbered lines of code, `const v1 = 1` and on, unless `line` says otherwise. */
const code = (n, line = (i) => `const v${i} = ${i}`) =>
  `${Array.from({ length: n }, (_, i) => line(i + 1)).join('\n')}\n`

/** A git repository holding `files`, committed as its base. */
function makeRepo(t, files) {
  const dir = mkdtempSync(join(tmpdir(), 'plan-cites-'))
  t.after(() => rmSync(dir, { recursive: true, force: true }))
  const git = (...args) => {
    const r = spawnSync('git', ['-C', dir, ...args], { encoding: 'utf8' })
    if (r.status !== 0) throw new Error(`git ${args.join(' ')}: ${r.stderr}`)
    return r.stdout.trim()
  }
  const write = (more) => {
    for (const [path, body] of Object.entries(more)) {
      if (body === null) rmSync(join(dir, path))
      else {
        mkdirSync(dirname(join(dir, path)), { recursive: true })
        writeFileSync(join(dir, path), body)
      }
    }
  }
  const commit = (more, message = 'change') => {
    write(more)
    git('add', '-A')
    git('commit', '-q', '--no-gpg-sign', '-m', message)
    return git('rev-parse', 'HEAD')
  }
  git('init', '-q')
  git('config', 'user.email', 'test@example.com')
  git('config', 'user.name', 'Test')
  const base = commit(files, 'base')
  const run = (...args) => {
    const r = spawnSync(process.execPath, [SCRIPT, ...args], {
      cwd: dir,
      encoding: 'utf8',
    })
    return { ...r, lines: r.stdout.split('\n').filter(Boolean) }
  }
  const read = (path) => readFileSync(join(dir, path), 'utf8')
  return { dir, git, write, commit, run, read, base }
}

/** The findings `check` prints for `doc`, read against `files`. */
function check(t, files, doc) {
  const r = makeRepo(t, { ...files, [DOC]: doc }).run('check')
  return r.lines.map((l) => l.slice(`${DOC}:`.length))
}

// ---- the parser

test('a bare :N binds to the nearest file named earlier in its paragraph', () => {
  const [a, b, c, d] = parseDoc(
    'See `src/a.ts:3`, `:5` and `src/b.ts:1`, then `:7`.\n' +
      'The same paragraph, `:9`.\n\nA new paragraph, `:11`.\n',
  )
  assert.deepEqual(
    [a.token, b.token, c.token, d.token],
    ['src/a.ts', 'src/a.ts', 'src/b.ts', 'src/b.ts'],
  )
  const [e, f] = parseDoc(
    '`kit/x.ts` holds it (`:4`).\n\nNothing here: `:2`.\n',
  )
  assert.equal(e.token, 'kit/x.ts')
  assert.equal(f.token, null)
})

test('a bare :N never binds across table rows or list items', () => {
  const rows = parseDoc('| a | `src/a.ts:1` |\n| b | `:2` |\n')
  assert.deepEqual(
    rows.map((c) => c.token),
    ['src/a.ts', null],
  )
  const items = parseDoc('- one `src/a.ts:1`\n  and on, `:3`\n- two `:2`\n')
  assert.deepEqual(
    items.map((c) => c.token),
    ['src/a.ts', 'src/a.ts', null],
  )
  // a FACTS line's cells are one row: a bare :N binds across them
  const [, fact] = parseDoc('1. A claim (`src/a.ts:1`) | `:4` | code\n')
  assert.equal(fact.token, 'src/a.ts')
})

test('code fences are not read', () => {
  assert.deepEqual(
    parseDoc('```\n`src/a.ts:1`\n```\n`src/b.ts:2`\n').map((c) => c.token),
    ['src/b.ts'],
  )
})

test('a pattern such as learn/NN.html is no file', () => {
  assert.ok(isPattern('learn/NN.html'))
  assert.ok(isPattern('src/**/*.css'))
  assert.ok(!isPattern('learn/04.html'))
  assert.ok(!isPattern('NOTES.md'))
})

test('a pin right after a citation pins it, and one closing a list pins the list', () => {
  const sha = 'abc1234'
  const pins = (s) => parseDoc(s).map((c) => c.pin)
  assert.deepEqual(pins(`\`src/a.ts:1\` at \`${sha}\`, then \`src/a.ts:2\`.`), [
    sha,
    null,
  ])
  assert.deepEqual(
    pins(`\`src/a.ts:1\`, \`:5\` and \`src/b.ts:2\` at \`${sha}\`; \`:9\``),
    [sha, sha, sha, null],
  )
  assert.deepEqual(
    pins(`(\`src/a.ts:1\`, \`:5\`) at \`${sha}\`, and \`src/a.ts:7\``),
    [sha, sha, null],
  )
  assert.deepEqual(pins(`(\`src/a.ts:1\`, at \`${sha}\`)`), [sha])
  // a file named at a pin is read there by the bare :N that binds to it
  assert.deepEqual(pins(`(\`src/a.ts\` at \`${sha}\`: the rounds, \`:3\`)`), [
    sha,
  ])
  // a read noted in other words is no pin (the README's rule)
  assert.deepEqual(pins(`\`src/a.ts:1\`, read again at \`${sha}\``), [null])
  assert.deepEqual(pins(`\`src/a.ts:1\` | code at \`${sha}\``), [null])
})

test('a quote attaches before its citation, inside its parentheses, or after its colon', () => {
  const quotes = (s) => parseDoc(s).map((c) => [c.quotes, c.unattached])
  assert.deepEqual(quotes('the line "one two three" (`src/a.ts:1`)'), [
    [['one two three'], []],
  ])
  assert.deepEqual(quotes('("one two three", `src/a.ts:1`)'), [
    [['one two three'], []],
  ])
  assert.deepEqual(quotes('"one two" and "three four", `src/a.ts:1`'), [
    [['one two', 'three four'], []],
  ])
  assert.deepEqual(quotes('`src/a.ts:1` (the lock; "one two"; "three four")'), [
    [['one two', 'three four'], []],
  ])
  assert.deepEqual(
    quotes('(`src/a.ts:1` at `abc1234`: "one two"; "three four")'),
    [[['one two', 'three four'], []]],
  )
  assert.deepEqual(quotes('`src/a.ts:1`, "one two", "three four"; more'), [
    [['one two', 'three four'], []],
  ])
  // "at" joins a quote to the citation after it, not the one before
  assert.deepEqual(
    quotes('(`a.ts:1-20`: "one two" at `:5`, "three four" at `:9`)'),
    [
      [[], []],
      [['one two'], []],
      [['three four'], []],
    ],
  )
})

test('a quote written after its citation any other way is not attached, and says so', () => {
  const [c] = parseDoc('`src/a.ts:1` has it: "one two three"')
  assert.deepEqual([c.quotes, c.unattached], [[], ['one two three']])
  const [d] = parseDoc('(`src/a.ts:1`, `name`, "one two three")')
  assert.deepEqual([d.quotes, d.unattached], [[], ['one two three']])
  // "at" leads to the citation after a quote, never back to the one before
  const [g] = parseDoc('`src/a.ts:5`, at "one two three" the loop ends')
  assert.deepEqual([g.quotes, g.unattached], [[], ['one two three']])
  // the document's own words, after the citation's closed parentheses or a
  // clause's end, are neither
  for (const s of [
    'the kit (`src/a.ts:1`), so it says "one two"',
    '`src/a.ts:1`; then "one two"',
  ]) {
    const [e] = parseDoc(s)
    assert.deepEqual([e.quotes, e.unattached], [[], []])
  }
  // a quote far before a citation in its sentence is the document's words too
  const [f] = parseDoc('It reads "one two", a link to the page (`src/a.ts:1`)')
  assert.deepEqual(f.quotes, [])
})

test('a quote may hold a table row, unescaped', () => {
  const [c] = parseDoc(
    '1. A claim | CURRICULUM ("8 Beat | none | T05 fresh", `CURRICULUM.md:4`) | plan\n',
  )
  assert.deepEqual(c.quotes, ['8 Beat | none | T05 fresh'])
})

test('a citation names the § before it, unless a quote or another document owns it', () => {
  const heading = (s) =>
    parseDoc(s).map(
      (c) => c.heading && [c.heading.section, c.heading.items, c.heading.doc],
    )
  assert.deepEqual(heading('CURRICULUM § 2.1, Lesson 9 (`CURRICULUM.md:12`)'), [
    ['2.1', null, 'CURRICULUM'],
  ])
  assert.deepEqual(heading('§ 5 items 1 and 2 (`PLAN.md:30`)'), [
    ['5', [1, 2], null],
  ])
  assert.deepEqual(heading('§ 1 rule 4, "words" (`:3`)'), [['1', [4, 4], null]])
  assert.deepEqual(
    heading('the cards ("rewritten (§ 4)", `CURRICULUM.md:12`)'),
    [null],
  )
  assert.deepEqual(heading('MASTER-PLAN § 12 and (`CURRICULUM.md:12`)'), [
    ['12', null, 'MASTER-PLAN'],
  ])
})

test('a citation names the function, interface or const written next to it', () => {
  const names = (s) => parseDoc(s).map((c) => c.name)
  assert.deepEqual(names('`linkAway`, `src/a.ts:5`'), ['linkAway'])
  assert.deepEqual(names('`TEASE_MAX = 70` (`src/a.ts:5`)'), ['TEASE_MAX'])
  assert.deepEqual(names('`:159-203` (`computeRange`; `:164` sorts)'), [
    'computeRange',
    null,
  ])
  // a list of names, or a name over a list of citations, names none
  assert.deepEqual(names('`A` and `B` (`src/a.ts:1`, `:9`)'), [null, null])
  assert.deepEqual(names('(`slot`, `src/a.ts:1`, `:9`)'), [null, null])
  assert.deepEqual(names('(`axis: { notes }`, `src/a.ts:1`)'), [null])
})

test('a row marked "Superseded by" is history', () => {
  const [a, b] = parseDoc(
    '1. Old (`src/a.ts:1`) | code. Superseded by 1a: since then\n1a. New (`src/a.ts:2`) | code\n',
  )
  assert.deepEqual([a.superseded, b.superseded], [true, false])
})

// ---- the content checks

test('text compares normalised, so a quote runs across a wrapped // comment', () => {
  const lines = [
    '  // the reveal appears only once the',
    '  // sound that answers it has been *heard*',
    'const x = 1',
  ]
  assert.equal(
    citedText(lines, 1, 2),
    'the reveal appears only once the sound that answers it has been heard',
  )
  assert.deepEqual(
    pieces('A `[data-free]` play works ... and never reveals.'),
    ['a [data-free] play works', 'and never reveals'],
  )
  for (const marker of ['/*', ' *', '#', '<!--'])
    assert.equal(citedText([`${marker} one`, `${marker} two`], 1, 2), 'one two')
})

test('check: a missing file is a finding, and a present one passes', (t) => {
  const found = check(
    t,
    { 'src/a.ts': code(3) },
    'Here (`src/a.ts:1`) and gone (`src/gone.ts:1`).\n',
  )
  assert.deepEqual(found, [
    '1: missing: `src/gone.ts:1` `src/gone.ts` is not in the working tree',
  ])
})

test('check: a range past the file end is a finding, and the last line passes', (t) => {
  const found = check(
    t,
    { 'src/a.ts': code(3) },
    '`src/a.ts:3`; `src/a.ts:2-4`; `src/a.ts:3-2`\n',
  )
  assert.equal(found.length, 2)
  assert.match(
    found[0],
    /^1: range: `src\/a.ts:2-4` 2-4 runs past the end of src\/a.ts, which has 3 lines$/,
  )
  assert.match(found[1], /^1: range: `src\/a.ts:3-2` /)
})

test('check: a quote not in the cited lines is a finding, and one in them passes', (t) => {
  const files = {
    'src/a.ts': 'const a = 1\n// Every take is kept\nconst b = 2\n',
  }
  assert.deepEqual(
    check(t, files, 'It says "every take is kept" (`src/a.ts:2`).\n'),
    [],
  )
  const found = check(
    t,
    files,
    'It says "every take is kept" (`src/a.ts:3`).\n',
  )
  assert.deepEqual(found, [
    '1: quote: `src/a.ts:3` "every take is kept" is not in src/a.ts:3',
  ])
})

test('check: a quote across a wrapped // comment passes', (t) => {
  const files = {
    'src/a.ts':
      'const a = 1\n// The reveal appears only once the sound that\n// answers it has actually been heard.\nconst b = 2\n',
  }
  const doc =
    '`src/a.ts:2-3` ("the reveal appears only once the sound that answers it has actually been heard")\n'
  assert.deepEqual(check(t, files, doc), [])
  assert.equal(check(t, files, doc.replace('2-3', '2')).length, 1)
})

test('check: a quote the parser cannot attach is reported, never passed', (t) => {
  const found = check(
    t,
    { 'src/a.ts': code(3) },
    '`src/a.ts:1` has it: "words nowhere in the file"\n',
  )
  assert.deepEqual(found, [
    '1: unattached: `src/a.ts:1` "words nowhere in the file" follows it but is not attached to it, so no check read it',
  ])
  assert.deepEqual(
    check(t, { 'src/a.ts': code(3) }, '`src/a.ts:1` ("const v1")\n'),
    [],
  )
})

test('check: lines outside the § the citation names are a finding, and inside pass', (t) => {
  const plan = `${PLAN}/PLAN.md`
  const files = {
    [plan]:
      '# Plan\n\n## 5. Questions\n\n1. First one.\n2. Second one,\n   wrapped.\n\nAfter.\n\n## 6. Next\n\nText.\n',
  }
  assert.deepEqual(
    check(t, files, 'PLAN § 5 item 2 ("Second one, wrapped", `PLAN.md:6-7`)\n'),
    [],
  )
  assert.deepEqual(
    check(t, files, 'PLAN § 5 (`PLAN.md:3-9`); § 6 (`PLAN.md:13`)\n'),
    [],
  )
  assert.deepEqual(check(t, files, 'PLAN § 5 item 1 (`PLAN.md:6`)\n'), [
    '1: section: `PLAN.md:6` lies outside § 5 item 1, lines 5',
  ])
  assert.deepEqual(check(t, files, 'PLAN § 6 (`PLAN.md:6`)\n'), [
    '1: section: `PLAN.md:6` lies outside § 6, lines 11-13',
  ])
  assert.deepEqual(check(t, files, 'PLAN § 7 (`PLAN.md:6`)\n'), [
    '1: section: `PLAN.md:6` names § 7, which docs/plans/find-your-pitch/PLAN.md does not have',
  ])
})

test('check: a citation that misses the function, interface or const it names is a finding', (t) => {
  const files = {
    'src/a.ts': [
      'import x from "y"',
      '',
      '/** Links away. */',
      'export function linkAway(href: string) {',
      '  return href',
      '}',
      '',
      'export interface Entry {',
      '  n: number',
      '}',
      'export const TEASE_MAX = 70',
      '',
    ].join('\n'),
  }
  const doc =
    '`linkAway`, `src/a.ts:3-6`; `Entry` (`src/a.ts:9`); `TEASE_MAX = 70` (`src/a.ts:11`); `TEASE_MAX`, `src/a.ts:10-11`\n'
  assert.deepEqual(check(t, files, doc), [])
  assert.deepEqual(check(t, files, '`linkAway`, `src/a.ts:8-9`\n'), [
    '1: section: `src/a.ts:8-9` lies outside `linkAway`, lines 3-6',
  ])
})

test('check: a file name two files share is ambiguous, unless a path settles it', (t) => {
  const files = {
    'src/kit/predict.ts': code(5),
    'src/lesson-01/predict.ts': code(5),
  }
  const found = check(t, files, 'One (`predict.ts:2`).\n')
  assert.deepEqual(found, [
    '1: ambiguous: `predict.ts:2` `predict.ts` names 2 files: src/kit/predict.ts, src/lesson-01/predict.ts',
  ])
  assert.deepEqual(check(t, files, 'Its own path (`kit/predict.ts:2`).\n'), [])
  assert.deepEqual(
    check(
      t,
      files,
      'An earlier path (`src/kit/predict.ts:1`),\nthen (`predict.ts:9`).\n',
    ),
    [
      '2: range: `predict.ts:9` 9 runs past the end of src/kit/predict.ts, which has 5 lines',
    ],
  )
})

test('check: a deleted file is a finding, and a renamed one is reported, not guessed', (t) => {
  const r = makeRepo(t, {
    'src/old.ts': code(4),
    'src/moved.ts': code(40),
    [DOC]: '`src/old.ts:2`; `src/moved.ts:30`\n',
  })
  r.commit({ 'src/old.ts': null })
  r.git('mv', 'src/moved.ts', 'src/renamed.ts')
  r.git('commit', '-q', '--no-gpg-sign', '-m', 'rename')
  const found = r
    .run('check')
    .lines.map((l) => l.replace(/[0-9a-f]{9}\)$/, 'SHA)'))
  assert.deepEqual(found, [
    `${DOC}:1: missing: \`src/old.ts:2\` \`src/old.ts\` is not in the working tree (deleted in SHA)`,
    `${DOC}:1: missing: \`src/moved.ts:30\` \`src/moved.ts\` is not in the working tree (git records it renamed to src/renamed.ts in SHA)`,
  ])
})

test('check: a bare :N binds to the file earlier in its paragraph, and not to one in the row above', (t) => {
  const files = { 'src/a.ts': code(3) }
  assert.deepEqual(
    check(t, files, 'Read `src/a.ts:1`, then\nthe next (`:3`).\n'),
    [],
  )
  assert.deepEqual(check(t, files, 'Read `src/a.ts:1`, then (`:9`).\n'), [
    '1: range: `src/a.ts:9` 9 runs past the end of src/a.ts, which has 3 lines',
  ])
  assert.deepEqual(check(t, files, '| a | `src/a.ts:1` |\n| b | `:2` |\n'), [
    '2: unbound: `:2` follows no file named in its paragraph, list item or table row',
  ])
})

test('check: a pattern such as learn/NN.html is never a finding', (t) => {
  assert.deepEqual(
    check(
      t,
      {},
      'Each page, `learn/NN.html:9`, and its head, `learn/NN.html` (`:3-4`).\n',
    ),
    [],
  )
})

test('check: a pinned citation is read at its pin, in both pin forms', (t) => {
  const r = makeRepo(t, { 'src/a.ts': code(10, (i) => `// line ${i} of ten`) })
  const pin = r.git('rev-parse', '--short=9', 'HEAD')
  r.commit({ 'src/a.ts': code(2) })
  const docs = {
    direct: `"line 8 of ten" (\`src/a.ts:8\` at \`${pin}\`)\n`,
    list: `\`src/a.ts:8\`, \`:9\` and \`src/a.ts:10\` at \`${pin}\`\n`,
    group: `(\`src/a.ts:8\`, \`:9-10\`) at \`${pin}\`\n`,
  }
  for (const [form, doc] of Object.entries(docs)) {
    r.write({ [DOC]: doc })
    assert.deepEqual(r.run('check').lines, [], form)
  }
  r.write({ [DOC]: '`src/a.ts:8`\n' })
  assert.match(
    r.run('check').lines[0],
    /range: `src\/a.ts:8` 8 runs past the end of src\/a.ts, which has 2 lines/,
  )
  r.write({ [DOC]: `\`src/a.ts:3\` at \`${pin}\` ("line 4 of ten")\n` })
  assert.match(r.run('check').lines[0], /quote: .* is not in src\/a.ts:3 at /)
  r.write({ [DOC]: '`src/a.ts:1` at `0000000`\n' })
  assert.match(
    r.run('check').lines[0],
    /missing: .* pinned to 0000000, which is not a commit/,
  )
})

test('check: superseded rows and research snapshots are not read; findings exit 1 unless --warn', (t) => {
  const r = makeRepo(t, {
    [DOC]: '1. Old (`src/gone.ts:1`) | code. Superseded by 1a: it moved\n',
    [`${PLAN}/research/notes.md`]: 'At the time, `src/gone.ts:4`.\n',
  })
  const clean = r.run('check')
  assert.equal(clean.status, 0)
  assert.deepEqual(clean.lines, [])
  assert.match(
    clean.stderr,
    /0 citations read .* 1 in superseded rows, 1 in research snapshots/,
  )
  r.write({ [DOC]: '`src/gone.ts:1`\n' })
  assert.equal(r.run('check').status, 1)
  assert.equal(r.run('check', '--warn').status, 0)
})

// ---- re-anchoring

test('shift arithmetic: hunks above move a citation, hunks below do not', () => {
  const diff = [
    '@@ -2,0 +3,3 @@', // three lines inserted after line 2
    '@@ -7,2 +10,0 @@', // lines 7 and 8 deleted
    '@@ -12 +14,2 @@', // line 12 replaced by two
    '@@ -40,3 +43 @@', // below everything cited
  ].join('\n')
  const hunks = parseHunks(diff)
  assert.deepEqual(hunks, [
    [2, 0, 3, 3],
    [7, 2, 10, 0],
    [12, 1, 14, 2],
    [40, 3, 43, 1],
  ])
  assert.deepEqual(shiftRange(hunks, 1, 2), { from: 1, to: 2 })
  assert.deepEqual(shiftRange(hunks, 3, 6), { from: 6, to: 9 })
  assert.deepEqual(shiftRange(hunks, 9, 11), { from: 10, to: 12 })
  assert.deepEqual(shiftRange(hunks, 20, 30), { from: 22, to: 32 })
  // a range over a changed line, or with lines inserted inside it, is rewritten
  assert.equal(shiftRange(hunks, 8, 9), null)
  assert.equal(shiftRange(hunks, 12, 12), null)
  assert.equal(shiftRange(hunks, 1, 3), null)
  assert.equal(shiftRange(hunks, 39, 41), null)
})

test('reanchor: shifts by the hunks above, and --write changes the digits only', (t) => {
  const r = makeRepo(t, {
    'src/a.ts': code(30),
    [DOC]: [
      'Top (`src/a.ts:5`), middle (`src/a.ts:10`, `:20-22`) and "const v28 = 28" (`src/a.ts:28`).',
      '',
      'Untouched: `src/a.ts:1`.',
      '',
    ].join('\n'),
  })
  const lines = code(30).split('\n')
  lines.splice(2, 0, 'const n1 = 0', 'const n2 = 0', 'const n3 = 0') // after line 2
  lines.splice(9, 2) // old lines 7 and 8
  lines[23] = 'const v25 = 2500' // old line 25, below the cited ones
  r.write({ 'src/a.ts': lines.join('\n') })
  // the paragraph's words changed since the base: they must survive the write
  const edited = r.read(DOC).replace('Top (', 'The top (')
  r.write({ [DOC]: edited })
  const out = r.run('reanchor', '--base', r.base)
  assert.deepEqual(out.lines, [
    `${DOC}:1: moved: \`src/a.ts:5\` -> 8`,
    `${DOC}:1: moved: \`src/a.ts:10\` -> 11`,
    `${DOC}:1: moved: \`src/a.ts:20-22\` -> 21-23`,
    `${DOC}:1: moved: \`src/a.ts:28\` -> 29`,
  ])
  assert.equal(out.status, 0)
  assert.equal(r.read(DOC), edited, 'without --write nothing is written')
  assert.equal(r.run('reanchor', '--base', r.base, '--write').status, 0)
  assert.equal(
    r.read(DOC),
    edited
      .replace(':5`', ':8`')
      .replace(':10`', ':11`')
      .replace(':20-22`', ':21-23`')
      .replace(':28`', ':29`'),
  )
  // once written, a second run finds nothing left to move
  assert.deepEqual(r.run('reanchor', '--base', r.base).lines, [])
})

test('reanchor: a citation into rewritten lines is reported, not shifted', (t) => {
  const r = makeRepo(t, {
    'src/a.ts': code(10),
    [DOC]: '`src/a.ts:4-5` and `src/a.ts:8`\n',
  })
  const lines = code(10).split('\n')
  lines[4] = 'const v5 = 500'
  lines.splice(1, 0, 'const n = 0')
  r.write({ 'src/a.ts': lines.join('\n') })
  const out = r.run('reanchor', '--base', r.base, '--write')
  assert.deepEqual(out.lines, [
    `${DOC}:1: rewritten: \`src/a.ts:4-5\` the cited lines changed since ${r.base}; check by hand`,
    `${DOC}:1: moved: \`src/a.ts:8\` -> 9`,
  ])
  assert.equal(out.status, 1)
  assert.equal(r.read(DOC), '`src/a.ts:4-5` and `src/a.ts:9`\n')
})

test('reanchor: a renamed file is reported, and so is a citation new since the base', (t) => {
  const r = makeRepo(t, {
    'src/a.ts': code(10),
    'src/b.ts': code(10),
    [DOC]: '`src/a.ts:4` and `src/b.ts:4`\n',
  })
  r.git('mv', 'src/a.ts', 'src/c.ts')
  r.write({ 'src/b.ts': `const n = 0\n${code(10)}` })
  r.write({
    [DOC]:
      '`src/a.ts:4` and `src/b.ts:4`\n\nNew, written against the working tree: `src/b.ts:5`.\n',
  })
  const out = r.run('reanchor', '--base', r.base)
  assert.deepEqual(out.lines, [
    `${DOC}:1: renamed: \`src/a.ts:4\` src/a.ts was renamed to src/c.ts since ${r.base}; check by hand`,
    `${DOC}:1: moved: \`src/b.ts:4\` -> 5`,
    `${DOC}:3: edited: \`src/b.ts:5\` 0 citations to this file here at ${r.base}, 1 now, so none is paired ` +
      '(the base must be the last commit at which the docs matched the code); check by hand',
  ])
  assert.equal(out.status, 1)
})

test('reanchor: a file gone from the index and a doc new since the base are reported', (t) => {
  const r = makeRepo(t, {
    'src/a.ts': code(10),
    'src/b.ts': code(10),
    [DOC]: '`src/a.ts:4` and `src/b.ts:4`\n',
  })
  // renamed with a plain mv: git sees a.ts deleted and c.ts untracked
  r.write({ 'src/a.ts': null, 'src/c.ts': code(10) })
  r.write({
    'src/b.ts': `const n = 0\n${code(10)}`,
    [`${PLAN}/NEW.md`]: '`src/b.ts:4`\n',
  })
  const out = r.run('reanchor', '--base', r.base)
  assert.deepEqual(out.lines, [
    `${DOC}:1: deleted: \`src/a.ts:4\` src/a.ts was deleted (or renamed and not staged) since ${r.base}; check by hand`,
    `${DOC}:1: moved: \`src/b.ts:4\` -> 5`,
    `${PLAN}/NEW.md:1: edited: \`src/b.ts:4\` ${PLAN}/NEW.md is new since ${r.base}, so nothing there places it; check by hand`,
  ])
  assert.equal(out.status, 1)
})

test('reanchor: a re-run is safe, and a base the docs have moved past is reported', (t) => {
  // the second citation's moved number is the first one's old number
  const r = makeRepo(t, {
    'src/a.ts': code(20),
    [DOC]: '`src/a.ts:10` and `src/a.ts:12`\n',
  })
  const summary = (out) => out.stderr.trim().split('\n').at(-1)
  r.write({ 'src/a.ts': `const n1 = 0\nconst n2 = 0\n${code(20)}` })
  const first = r.run('reanchor', '--base', r.base, '--write')
  assert.equal(first.status, 0)
  assert.equal(
    summary(first),
    `plan-cites: from ${r.base}, 2 moved, 0 already re-anchored, 0 reported; wrote 2`,
  )
  assert.equal(r.read(DOC), '`src/a.ts:12` and `src/a.ts:14`\n')

  // the same base again: both are counted as re-anchored and left
  const again = r.run('reanchor', '--base', r.base, '--write')
  assert.deepEqual(again.lines, [])
  assert.equal(again.status, 0)
  assert.equal(
    summary(again),
    `plan-cites: from ${r.base}, 0 moved, 2 already re-anchored, 0 reported`,
  )
  assert.equal(r.read(DOC), '`src/a.ts:12` and `src/a.ts:14`\n')

  // one more line of code: the old base no longer places either citation
  const written = r.commit({}, 'the first write')
  r.write({ 'src/a.ts': `const n0 = 0\n${r.read('src/a.ts')}` })
  const stale = r.run('reanchor', '--base', r.base, '--write')
  const edited = (cite) =>
    `${DOC}:1: edited: \`${cite}\` its line was written or edited since ${r.base}, so no citation there places it ` +
    '(the base must be the last commit at which the docs matched the code); check by hand'
  assert.deepEqual(stale.lines, [edited('src/a.ts:12'), edited('src/a.ts:14')])
  assert.equal(stale.status, 1)
  assert.equal(
    summary(stale),
    `plan-cites: from ${r.base}, 0 moved, 0 already re-anchored, 2 reported (edited 2)`,
  )
  assert.equal(r.read(DOC), '`src/a.ts:12` and `src/a.ts:14`\n')
  assert.equal(r.run('reanchor', '--base', r.base, '--warn').status, 0)

  // the first write's commit is the base that matches the docs
  const right = r.run('reanchor', '--base', written, '--write')
  assert.equal(right.status, 0)
  assert.equal(r.read(DOC), '`src/a.ts:13` and `src/a.ts:15`\n')
})

test('reanchor: an ambiguous name into a changed file is reported, never dropped', (t) => {
  const r = makeRepo(t, {
    'src/x/util.ts': code(10),
    'src/y/util.ts': code(10),
    'src/b.ts': code(10),
    [DOC]: '`util.ts:4` and `src/b.ts:4`\n',
  })
  r.write({ 'src/x/util.ts': `const n = 0\n${code(10)}` })
  const out = r.run('reanchor', '--base', r.base)
  assert.deepEqual(out.lines, [
    `${DOC}:1: ambiguous: \`util.ts:4\` \`util.ts\` names 2 files, and src/x/util.ts changed since ${r.base}; check by hand`,
  ])
  assert.equal(out.status, 1)
  assert.equal(
    out.stderr.trim(),
    `plan-cites: from ${r.base}, 0 moved, 0 already re-anchored, 1 reported (ambiguous 1)`,
  )
})

test('reanchor: a shift keeps a wrong citation wrong, so a moved one is checked by content', (t) => {
  // the citation was a line out at the base already
  const r = makeRepo(t, {
    'src/a.ts': code(10),
    [DOC]: '"const v5 = 5" (`src/a.ts:4`), "const v8 = 8" (`src/a.ts:8`)\n',
  })
  r.write({ 'src/a.ts': `const n = 0\n${code(10)}` })
  const out = r.run('reanchor', '--base', r.base)
  assert.deepEqual(out.lines, [
    `${DOC}:1: moved: \`src/a.ts:4\` -> 5`,
    `${DOC}:1: moved: \`src/a.ts:8\` -> 9`,
    `${DOC}:1: quote: \`src/a.ts:4\` "const v5 = 5" is not in src/a.ts:5`,
  ])
  assert.equal(out.status, 1)

  // written, then run again from the same base: still checked, still wrong
  r.run('reanchor', '--base', r.base, '--write')
  const again = r.run('reanchor', '--base', r.base)
  assert.deepEqual(again.lines, [
    `${DOC}:1: quote: \`src/a.ts:5\` "const v5 = 5" is not in src/a.ts:5`,
  ])
  assert.equal(again.status, 1)
  assert.equal(
    again.stderr.trim(),
    `plan-cites: from ${r.base}, 0 moved, 2 already re-anchored, 1 reported (quote 1)`,
  )
})
