// ============================================================
// plan-cites/reanchor — move citations across a change to the code they cite
// ============================================================
//
// A citation written against <base> follows its lines into the working tree
// by the lines added and removed above it, hunk by hunk, from
// `git diff --unified=0 <base>`. When the cited lines themselves changed,
// or new lines landed inside the range, no shift is right, so it is
// reported for a person to read. A file renamed, deleted or added since the
// base is reported too, never guessed at.
//
// The base must be the last commit at which the documents matched the code.
// Each citation in the working tree's document is paired with the one it
// was at the base by position: within each of the document's own hunks (an
// unchanged line is a hunk of its own), the citations into each changed
// file are taken in order on both sides, and they pair only when both sides
// hold the same number. A paired citation that still reads as at the base
// is moved. One that reads as the base's moved by the code's hunks was
// re-anchored already, so it is left and counted. Any other citation into a
// changed file was written or edited since the base, so nothing places it:
// it is left as it is and reported. So a run is safe to repeat, and a run
// with a base the documents have since moved past says so.
//
// The rewrite changes each moved citation's digits and nothing else on its
// line, so words edited since the base stay as they are now.

import { readFileSync, writeFileSync } from 'node:fs'
import { join, posix } from 'node:path'
import { parseDoc } from './parse.mjs'

/** The -U0 hunks of a diff: [old start, old count, new start, new count]. */
export function parseHunks(diff) {
  const out = []
  for (const m of diff.matchAll(
    /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/gm,
  ))
    out.push([Number(m[1]), Number(m[2] ?? 1), Number(m[3]), Number(m[4] ?? 1)])
  return out
}

/**
 * Where old lines `from`..`to` sit after the hunks, or null when any of
 * them changed or new lines landed between them.
 */
export function shiftRange(hunks, from, to) {
  let delta = 0
  for (const [a, b, , d] of hunks) {
    if (b === 0) {
      // an insertion after old line a
      if (a >= from && a < to) return null
      if (a < from) delta += d
    } else {
      if (a <= to && a + b - 1 >= from) return null
      if (a + b - 1 < from) delta += d - b
    }
  }
  return { from: from + delta, to: to + delta }
}

/**
 * A file's lines in runs that match across its -U0 hunks, as
 * [old from, old to, new from, new to]; a side with no lines has to below
 * from. Each unchanged line is a run of its own.
 */
export function runs(hunks, oldCount) {
  const out = []
  let o = 1
  let n = 1
  const same = (until) => {
    for (; o < until; o++, n++) out.push([o, o, n, n])
  }
  for (const [a, b, c, d] of hunks) {
    const oldStart = b === 0 ? a + 1 : a
    const newStart = d === 0 ? c + 1 : c
    same(oldStart)
    out.push([oldStart, oldStart + b - 1, newStart, newStart + d - 1])
    o = oldStart + b
    n = newStart + d
  }
  same(oldCount + 1)
  return out
}

const shown = (c) => (c.bare && c.token ? `${c.token}${c.text}` : c.text)
const same = (x, y) => x.from === y.from && x.to === y.to
const lineCount = (text) => text.split('\n').length

/**
 * Re-anchors the citations in `docs` from `base` to the working tree.
 * Returns the report's events, the citations moved and those already
 * re-anchored, each with the lines it cites now, for a check by content;
 * with `write`, the documents are rewritten.
 */
export function reanchor(
  repo,
  base,
  docs,
  { write = false, skip = () => false } = {},
) {
  // each file changed since the base, by its path there; the new name of a
  // renamed file, like an added one, has nothing at the base to follow
  const changed = new Map()
  for (const line of repo
    .git(['diff', '--name-status', '-M', base])
    .split('\n')) {
    const [status, from, to] = line.split('\t')
    if (!from) continue
    changed.set(from, { kind: status[0], to })
    if (to) changed.set(to, { kind: 'A', from })
  }
  const hunks = new Map()
  const hunksOf = (path) => {
    if (!hunks.has(path))
      hunks.set(
        path,
        parseHunks(
          repo.git(['diff', '--unified=0', '--no-color', base, '--', path]),
        ),
      )
    return hunks.get(path)
  }
  // The changed file a citation cites, as { path } or { ambiguous }; null
  // for one into a file unchanged since the base, or into none. The base's
  // tree places a name; a name it lacks is read in the working tree.
  const target = (c, doc, side) => {
    if (c.token === null || c.pin !== null || c.superseded) return null
    let r = repo.resolve(c.token, doc, base, c.earlier)
    if (r.missing && side === 'work')
      r = repo.resolve(c.token, doc, '', c.earlier)
    if (r.path !== undefined)
      return changed.has(r.path) ? { path: r.path } : null
    if (r.ambiguous?.some((p) => changed.has(p)))
      return { ambiguous: r.ambiguous }
    return null
  }

  const events = []
  const moved = []
  const already = []
  const writes = []
  for (const doc of docs) {
    if (skip(doc)) continue
    const text = readFileSync(join(repo.root, doc), 'utf8')
    const baseText = repo.git(['show', `${base}:${doc}`], true)
    const docHunks =
      baseText === null
        ? [[0, 0, 1, lineCount(text)]]
        : parseHunks(
            repo.git(['diff', '--unified=0', '--no-color', base, '--', doc]),
          )
    const runOf = [new Map(), new Map()]
    runs(docHunks, baseText === null ? 0 : lineCount(baseText)).forEach(
      ([a, b, c, d], k) => {
        for (let l = a; l <= b; l++) runOf[0].set(l, k)
        for (let l = c; l <= d; l++) runOf[1].set(l, k)
      },
    )
    const groups = new Map()
    const groupOf = (run, path) => {
      const key = `${run}\0${path}`
      if (!groups.has(key)) groups.set(key, { base: [], work: [] })
      return groups.get(key)
    }
    for (const c of baseText === null ? [] : parseDoc(baseText)) {
      const t = target(c, doc, 'base')
      if (t?.path !== undefined)
        groupOf(runOf[0].get(c.line), t.path).base.push(c)
    }
    const cites = []
    for (const c of parseDoc(text)) {
      const t = target(c, doc, 'work')
      if (t === null) continue
      const g =
        t.path === undefined ? null : groupOf(runOf[1].get(c.line), t.path)
      g?.work.push(c)
      cites.push({ c, t, g })
    }

    const edits = []
    for (const { c, t, g } of cites) {
      const at = { doc, line: c.line, cite: shown(c) }
      const hand = (kind, message) =>
        events.push({ ...at, kind, message: `${message}; check by hand` })
      if (t.ambiguous) {
        const name = posix.basename(c.token)
        const moving = t.ambiguous.filter((p) => changed.has(p))
        hand(
          'ambiguous',
          `\`${name}\` names ${t.ambiguous.length} files, and ${moving.join(', ')} changed since ${base}`,
        )
        continue
      }
      const st = changed.get(t.path)
      if (st.kind === 'D') {
        hand(
          'deleted',
          `${t.path} was deleted (or renamed and not staged) since ${base}`,
        )
        continue
      }
      if (st.kind === 'R') {
        hand('renamed', `${t.path} was renamed to ${st.to} since ${base}`)
        continue
      }
      if (st.kind === 'A') {
        hand(
          'added',
          st.from
            ? `${t.path} was ${st.from} at ${base}`
            : `${t.path} is new since ${base}`,
        )
        continue
      }
      const code = hunksOf(t.path)
      const p =
        g.base.length === g.work.length ? g.base[g.work.indexOf(c)] : undefined
      const s = p === undefined ? null : shiftRange(code, p.from, p.to)
      if (p !== undefined && same(c, p)) {
        if (s === null) {
          hand('rewritten', `the cited lines changed since ${base}`)
          continue
        }
        if (same(s, c)) continue
        const digits = c.range ? `${s.from}-${s.to}` : `${s.from}`
        events.push({ ...at, kind: 'moved', message: `-> ${digits}` })
        moved.push({ doc, cite: c, ...s })
        edits.push({ line: c.line, start: c.numStart, end: c.numEnd, digits })
      } else if (s !== null && same(s, c))
        already.push({ doc, cite: c, from: c.from, to: c.to })
      else if (baseText === null)
        hand(
          'edited',
          `${doc} is new since ${base}, so nothing there places it`,
        )
      else
        hand(
          'edited',
          (p === undefined
            ? `${g.base.length} citations to this file here at ${base}, ${g.work.length} now, so none is paired `
            : `its line was written or edited since ${base}, so no citation there places it `) +
            '(the base must be the last commit at which the docs matched the code)',
        )
    }
    if (edits.length > 0) writes.push({ doc, text, edits })
  }
  // Written once every document is read, so that no diff above saw a
  // document half rewritten.
  for (const { doc, text, edits } of write ? writes : []) {
    const lines = text.split('\n')
    edits.sort((x, y) => y.line - x.line || y.start - x.start)
    for (const e of edits) {
      const l = lines[e.line - 1]
      lines[e.line - 1] = l.slice(0, e.start) + e.digits + l.slice(e.end)
    }
    writeFileSync(join(repo.root, doc), lines.join('\n'))
  }
  return { events, moved, already }
}
