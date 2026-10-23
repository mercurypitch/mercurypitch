// ============================================================
// plan-cites/check — read each citation against the lines it cites
// ============================================================
//
// A finding has a kind:
//
// - missing     the cited file is not there (at its pin, or in the working
//               tree), or its pin is not a commit this clone holds;
// - range       the range runs past the file's end, or backwards;
// - quote       a quote attached to the citation is not in the cited lines;
// - unattached  a quote follows the citation in a way the parser cannot
//               attach, so no check read it;
// - section     the cited lines are not all inside the `§` the citation
//               names, or none of them is in the top-level function,
//               interface or const named next to it;
// - ambiguous   a bare file name that two files share;
// - unbound     a bare `:N` with no file named before it in its paragraph,
//               list item or table row.
//
// Text is compared normalised: case, spacing, Markdown emphasis, code ticks
// and quote marks ignored, and a comment marker at the start of a cited
// line dropped, so a quote may run across a wrapped comment.

import { posix } from 'node:path'

const COMMENT = /^\s*(?:\/\/+|\/\*+|\*+\/?|#+|<!--)/
const CODE = /\.(?:ts|tsx|js|jsx|mjs|cjs)$/
// CURIOSITY-MOMENTS numbers its rules as the items of its § 1
const RULES = { 'CURIOSITY-MOMENTS.md': '1' }

export function normalise(s) {
  return s
    .replace(/\\\|/g, '|')
    .replace(/\\(['"`])/g, '$1')
    .replace(/[‘’]/g, "'")
    .replace(/[*_`"“”]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
    .replace(/^[\s.,;:]+|[\s.,;:]+$/g, '')
}

/** The cited lines as one normalised text. */
export function citedText(lines, from, to) {
  return normalise(
    lines
      .slice(from - 1, to)
      .map((l) => l.replace(COMMENT, ''))
      .join('\n'),
  )
}

/** The pieces of a quote that must each be in the cited lines. */
export function pieces(quote) {
  // a quote of a comment may carry the comment's own marker
  return quote
    .replace(COMMENT, '')
    .split(/\[?(?:\.\.\.|…)\]?/)
    .map(normalise)
    .filter((p) => p.length >= 3)
}

const HEAD = /^(#{2,6})\s+(\d+(?:\.\d+)*)\.?\s/
const ITEM = /^(\d+)\.\s/

/** A Markdown file's numbered sections and their numbered items, as line spans. */
export function outline(lines) {
  const heads = []
  lines.forEach((l, i) => {
    const m = HEAD.exec(l)
    if (m) heads.push({ line: i + 1, level: m[1].length, num: m[2] })
  })
  const sections = new Map()
  heads.forEach((h, k) => {
    const next = heads.slice(k + 1).find((x) => x.level <= h.level)
    if (!sections.has(h.num))
      sections.set(h.num, [h.line, next ? next.line - 1 : lines.length])
  })
  const items = new Map()
  for (const [num, [a, b]] of sections) {
    // the section's own items, not its subsections'
    const sub = heads.find((h) => h.line > a && h.line <= b)
    const stop = sub ? sub.line - 1 : b
    const starts = []
    for (let i = a + 1; i <= stop; i++) {
      const m = ITEM.exec(lines[i - 1])
      if (m) starts.push([i, Number(m[1])])
    }
    starts.forEach(([i, n], k) => {
      let end = k + 1 < starts.length ? starts[k + 1][0] - 1 : stop
      // an item ends at a blank line that an unindented line follows
      for (let j = i + 1; j < end; j++)
        if (lines[j - 1].trim() === '' && /^\S/.test(lines[j] ?? '')) {
          end = j - 1
          break
        }
      if (!items.has(`${num}/${n}`)) items.set(`${num}/${n}`, [i, end])
    })
  }
  return { sections, items }
}

/** The line spans of each function, interface or const called `name`, with the comment above it. */
export function declarations(lines, name) {
  const id = name.replace(/\$/g, '\\$')
  const decl = new RegExp(
    String.raw`^(?:export\s+)?(?:default\s+)?(?:declare\s+)?(?:async\s+)?(?:function\s*\*?\s*${id}\s*[(<]|interface\s+${id}\b|const\s+${id}\s*[:=])`,
  )
  const out = []
  lines.forEach((l, i) => {
    if (!decl.test(l)) return
    let top = i
    while (top > 0 && /^\s*(?:\/\/|\/\*|\*)/.test(lines[top - 1])) top--
    out.push([top + 1, statementEnd(lines, i)])
  })
  return out
}

// The line a declaration ends on: where its brackets close and the
// statement does not run on. Strings and comments are skipped.
function statementEnd(lines, i) {
  let depth = 0
  let opened = false
  let block = false
  let str = null
  for (let k = i; k < lines.length; k++) {
    const l = lines[k]
    for (let p = 0; p < l.length; p++) {
      const ch = l[p]
      if (block) {
        if (ch === '*' && l[p + 1] === '/') block = false
        continue
      }
      if (str !== null) {
        if (ch === '\\') p++
        else if (ch === str) str = null
        continue
      }
      if (ch === '/' && l[p + 1] === '/') break
      if (ch === '/' && l[p + 1] === '*') block = true
      else if (ch === '"' || ch === "'" || ch === '`') str = ch
      else if ('({['.includes(ch)) {
        depth++
        opened = true
      } else if (')}]'.includes(ch)) depth--
    }
    if (str !== '`') str = null
    if (depth > 0 || block || str !== null) continue
    const code = l.replace(/\/\/.*$/, '').trim()
    const next =
      lines
        .slice(k + 1)
        .map((x) => x.trim())
        .find((x) => x !== '' && !/^(?:\/\/|\/\*|\*)/.test(x)) ?? ''
    const runsOn =
      /(?:[=,([{+\-*/?:|&.]|=>)$/.test(code) ||
      /^(?:[?:.+\-*|&]|\/(?![/*]))/.test(next)
    if ((opened || code !== '') && !runsOn) return k + 1
  }
  return lines.length
}

const shown = (c) => (c.bare && c.token ? `${c.token}${c.text}` : c.text)
const span = (a, b) => (a === b ? `${a}` : `${a}-${b}`)
const clip = (s) => {
  const one = s.replace(/\s+/g, ' ')
  return one.length > 80 ? `${one.slice(0, 77)}...` : one
}

/**
 * The findings for one citation, read at `from`..`to` (its own numbers,
 * unless re-anchoring has moved them).
 */
export function checkCitation(repo, doc, c, from = c.from, to = c.to) {
  const found = (kind, message) => ({
    doc,
    line: c.line,
    kind,
    cite: shown(c),
    message,
  })
  if (c.token === null)
    return [
      found(
        'unbound',
        'follows no file named in its paragraph, list item or table row',
      ),
    ]
  const rev = c.pin ?? ''
  if (rev !== '' && !repo.isCommit(rev))
    return [
      found(
        'missing',
        `is pinned to ${rev}, which is not a commit in this clone`,
      ),
    ]
  const r = repo.resolve(c.token, doc, rev, c.earlier)
  if (r.pattern) return []
  if (r.ambiguous)
    return [
      found(
        'ambiguous',
        `\`${posix.basename(c.token)}\` names ${r.ambiguous.length} files: ${r.ambiguous.join(', ')}`,
      ),
    ]
  if (r.missing) {
    if (rev !== '')
      return [
        found('missing', `\`${c.token}\` is not in the repository at ${rev}`),
      ]
    const g = repo.gone(c.token)
    const why = g?.renamed
      ? ` (git records it renamed to ${g.renamed} in ${g.commit})`
      : g?.deleted
        ? ` (deleted in ${g.commit})`
        : ''
    return [found('missing', `\`${c.token}\` is not in the working tree${why}`)]
  }
  const lines = repo.read(rev, r.path)
  if (lines === null)
    return [
      found('missing', `${r.path} cannot be read${rev ? ` at ${rev}` : ''}`),
    ]
  const at = rev ? ` at ${rev}` : ''
  if (from < 1 || to < from)
    return [found('range', `${span(from, to)} runs backwards or from line 0`)]
  if (to > lines.length)
    return [
      found(
        'range',
        `${span(from, to)} runs past the end of ${r.path}${at}, which has ${lines.length} lines`,
      ),
    ]
  const out = []
  const cited = citedText(lines, from, to)
  for (const q of c.quotes) {
    const miss = pieces(q).filter((p) => !cited.includes(p))
    if (miss.length > 0)
      out.push(
        found(
          'quote',
          `"${clip(q)}" is not in ${r.path}:${span(from, to)}${at}`,
        ),
      )
  }
  for (const q of c.unattached.filter((u) => pieces(u).length > 0))
    out.push(
      found(
        'unattached',
        `"${clip(q)}" follows it but is not attached to it, so no check read it`,
      ),
    )
  const h = c.heading
  if (
    h !== null &&
    r.path.endsWith('.md') &&
    (h.doc === null || `${h.doc}.md` === posix.basename(r.path))
  ) {
    const o = outline(lines)
    const sec = h.rule ? RULES[posix.basename(r.path)] : h.section
    if (sec !== undefined) {
      let where
      if (h.items === null) where = o.sections.get(sec)
      else {
        const first = o.items.get(`${sec}/${h.items[0]}`)
        const last = o.items.get(`${sec}/${h.items[1]}`)
        where = first && last ? [first[0], last[1]] : undefined
      }
      if (where === undefined)
        out.push(
          found(
            'section',
            `names ${h.label}, which ${r.path}${at} does not have`,
          ),
        )
      else if (from < where[0] || to > where[1])
        out.push(
          found('section', `lies outside ${h.label}, lines ${span(...where)}`),
        )
    }
  }
  // A name is written next to a citation that may take in the lines round
  // it too, so only a citation that misses the declaration entirely is out.
  if (c.name !== null && CODE.test(r.path)) {
    const spans = declarations(lines, c.name)
    if (spans.length > 0 && !spans.some(([a, b]) => a <= to && from <= b))
      out.push(
        found(
          'section',
          `lies outside \`${c.name}\`, lines ${spans.map((s) => span(...s)).join(', ')}`,
        ),
      )
  }
  return out
}

export const format = (f) =>
  `${f.doc}:${f.line}: ${f.kind}: \`${f.cite}\` ${f.message}`
