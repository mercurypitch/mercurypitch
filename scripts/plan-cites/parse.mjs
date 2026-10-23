// ============================================================
// plan-cites/parse — read the `file:line` citations out of a plan document
// ============================================================
//
// The parser knows nothing of the repository: it finds each citation in a
// Markdown document and says what the document attaches to it, and
// ./repo.mjs then resolves the names. For each citation it gives:
//
// - the file it names, or for a bare `:N` the file it binds to: the nearest
//   file named earlier in the same paragraph, list item or table row, never
//   one in another row;
// - its pin: "at `<sha>`" right after it, or after a list of citations it
//   closes (the README's rule), or after the file a bare `:N` binds to;
// - the words it quotes: a quote before it in its clause, or inside the
//   parentheses that follow it, or after a colon that follows it. A quote
//   written after a citation in any other way cannot be attached, and the
//   parser says so rather than drop it;
// - the section it names: a `§` heading before it, or a function, interface
//   or const name written next to it;
// - whether it sits in a row marked "Superseded by", which is history.
//
// A block is a paragraph, a list item or a table row. Inside a block, cells
// are split at unescaped `|`; a clause ends at `;`, at a sentence's end and
// at its cell's or parentheses' edge. Code fences are skipped.

const EXT =
  'ts|tsx|js|jsx|mjs|cjs|css|html|md|json|jsonc|txt|py|toml|yml|yaml|svg|xml|sh|webmanifest'
const CH = String.raw`[\w.@*<>{}-]`
// A file token: a name with an extension, or a path with a folder in it
// (`public/_headers`). The pattern characters `*<>{}` are kept, so that a
// pattern reads as one token and is then ignored.
const FILE = String.raw`(?:${CH}+\/)*${CH}+\.[A-Za-z][A-Za-z0-9]*|(?:${CH}+\/)+${CH}+`
const CITE = new RegExp(String.raw`^(${FILE})?:(\d+)(?:-(\d+))?$`)
// A file named with no line, which a bare `:N` after it cites. The extension
// list keeps identifiers such as `.viz.tall` or `hints.again` out.
const MENTION = new RegExp(String.raw`^((?:${CH}+\/)*${CH}+\.(?:${EXT}))$`)
const SHA = /^[0-9a-f]{7,40}$/
const IDENT =
  /^(?:(?:export|async|function|interface|const)\s+)*([A-Za-z_$][\w$]*)(?:\(\))?(?:\s*=.*)?$/
const PIN = /^\s*,?\s*at\s+`([0-9a-f]{7,40})`/
const SEPARATOR = /^\s*,?\s*(?:(?:and|or)\s+)?$/
// what may stand between a quote and its citation: `"q" at \`:5\`` too
const CONNECT = /^[\s,]*(?:(?:and|or|at)\s+)?$/
const SECTION =
  /§\s*(\d+(?:\.\d+)*)(?:,?\s+items?\s+(\d+)(?:(?:,\s*\d+)*,?\s*(?:and|to|-)\s*(\d+))?)?|\brules?\s+(\d+)(?:(?:,\s*\d+)*,?\s*(?:and|to|-)\s*(\d+))?/g
const SUPERSEDED = /\bSuperseded by \d+[a-z]?\b/

/** Whether a file token is a pattern (`learn/NN.html`, `src/**\/*.css`), not a file. */
export function isPattern(token) {
  return (
    /[*<>{}]/.test(token) || /(?:^|[/._-])(?:N+|X+)(?=[/._-]|$)/.test(token)
  )
}

/** Every citation in a Markdown document, in order. */
export function parseDoc(text) {
  const lines = text.split('\n')
  const out = []
  let block = []
  let fence = null
  const flush = () => {
    if (block.length > 0) parseBlock(lines, block, out)
    block = []
  }
  lines.forEach((line, i) => {
    const f = /^\s*(`{3,}|~{3,})/.exec(line)
    if (fence !== null) {
      if (f && f[1][0] === fence[0] && f[1].length >= fence.length) fence = null
      return
    }
    if (f) {
      flush()
      fence = f[1]
      return
    }
    if (line.trim() === '') return flush()
    const own = /^#{1,6}\s/.test(line) || /^\s*\|/.test(line)
    if (own || /^\s*(?:[-*+]|\d+[a-z]?[.)])\s/.test(line)) flush()
    block.push(i)
    if (own) flush()
  })
  flush()
  return out
}

function classify(start, end, inner) {
  const span = { start, end, inner }
  let m = CITE.exec(inner)
  if (m) {
    const from = Number(m[2])
    return Object.assign(span, {
      kind: m[1] === undefined ? 'bare' : 'cite',
      token: m[1] ?? null,
      from,
      to: m[3] === undefined ? from : Number(m[3]),
      range: m[3] !== undefined,
      numStart: start + 1 + (m[1]?.length ?? 0) + 1,
      numEnd: end - 1,
    })
  }
  if ((m = MENTION.exec(inner)))
    return Object.assign(span, { kind: 'mention', token: m[1] })
  if (SHA.test(inner)) return Object.assign(span, { kind: 'sha' })
  if ((m = IDENT.exec(inner.trim())))
    return Object.assign(span, { kind: 'name', ident: m[1] })
  return Object.assign(span, { kind: 'code' })
}

const masked = (s, a, b) => s.slice(0, a) + '\0'.repeat(b - a) + s.slice(b)
const isCite = (it) => it.kind === 'cite' || it.kind === 'bare'

function parseBlock(lines, idx, out) {
  const starts = []
  let text = ''
  for (const i of idx) {
    starts.push(text.length)
    text += `${lines[i]}\n`
  }
  const spans = [...text.matchAll(/`([^`\n]+)`/g)].map((m) =>
    classify(m.index, m.index + m[0].length, m[1]),
  )
  // mask1 hides code spans; mask2 hides quotes as well
  let mask1 = text
  for (const s of spans) mask1 = masked(mask1, s.start, s.end)
  // Quotes pair across the whole block, since a FACTS line quotes a table
  // row's `|` unescaped; cells are then split at the `|` outside them.
  const quotes = []
  let open = null
  for (let p = 0; p < mask1.length; p++) {
    const ch = mask1[p]
    if (open === null) {
      if (ch === '"' || ch === '“') open = { p, close: ch === '"' ? '"' : '”' }
    } else if (ch === open.close) {
      quotes.push({ kind: 'quote', start: open.p, end: p + 1 })
      open = null
    }
  }
  let mask2 = mask1
  for (const q of quotes) mask2 = masked(mask2, q.start, q.end)
  const cuts = [-1]
  for (let p = 0; p < mask2.length; p++)
    if (mask2[p] === '|' && mask2[p - 1] !== '\\') cuts.push(p)
  cuts.push(text.length)
  const cells = cuts.slice(1).map((end, k) => [cuts[k] + 1, end])
  for (const [a, b] of cells) parseCell(text, mask2, a, b, spans, quotes)
  bindBlock(spans, SUPERSEDED.test(mask2))
  const where = (pos) => {
    let k = starts.length - 1
    while (starts[k] > pos) k--
    return [idx[k] + 1, pos - starts[k]]
  }
  for (const s of spans) {
    if (!isCite(s)) continue
    const [line, col] = where(s.start)
    out.push({
      line,
      col,
      numStart: s.numStart - (s.start - col),
      numEnd: s.numEnd - (s.start - col),
      text: s.inner,
      bare: s.kind === 'bare',
      token: s.bound ?? null,
      from: s.from,
      to: s.to,
      range: s.range,
      pin: s.pin ?? null,
      quotes: (s.quotes ?? []).map((q) => text.slice(q.start + 1, q.end - 1)),
      unattached: (s.unattached ?? []).map((q) =>
        text.slice(q.start + 1, q.end - 1),
      ),
      heading: s.heading ?? null,
      name: s.name ?? null,
      superseded: s.superseded,
      earlier: s.earlier,
    })
  }
}

/** Gives each bare `:N` its file, and every citation the names before it. */
function bindBlock(spans, superseded) {
  const named = []
  for (const s of spans) {
    if (s.kind === 'mention') named.push(s)
    if (!isCite(s)) continue
    s.superseded = superseded
    s.earlier = named.map((n) => n.token).reverse()
    if (s.kind === 'cite') {
      s.bound = s.token
      named.push(s)
      continue
    }
    const last = named.at(-1)
    if (last === undefined) continue
    s.bound = last.token
    // a file named at a pin is read there by the bare `:N`s that bind to it
    if (
      last.kind === 'mention' &&
      s.pin === undefined &&
      last.pin !== undefined
    )
      s.pin = last.pin
  }
}

function parseCell(text, mask2, a, b, allSpans, allQuotes) {
  const inCell = (it) => it.start >= a && it.end <= b
  const groups = []
  const stack = []
  for (let p = a; p < b; p++) {
    if (mask2[p] === '(') {
      const g = {
        kind: 'group',
        start: p,
        end: b,
        parent: stack.at(-1) ?? null,
      }
      groups.push(g)
      stack.push(g)
    } else if (mask2[p] === ')' && stack.length > 0) stack.pop().end = p + 1
  }
  const items = [
    ...allSpans.filter(inCell),
    ...allQuotes.filter(inCell),
    ...groups,
  ]
  for (const m of mask2.slice(a, b).matchAll(/;|[.!?](?=\s+[A-Z])/g))
    items.push({
      kind: m[0] === ';' ? 'semi' : 'stop',
      start: a + m.index,
      end: a + m.index + 1,
    })
  const levelOf = (it) => {
    let best = null
    for (const g of groups)
      if (g !== it && g.start < it.start && it.end <= g.end) {
        if (best === null || g.start > best.start) best = g
      }
    return best
  }
  const levels = new Map([[null, []]])
  for (const g of groups) levels.set(g, [])
  for (const it of items) {
    it.level = levelOf(it)
    levels.get(it.level).push(it)
  }
  for (const list of levels.values()) list.sort((x, y) => x.start - y.start)
  for (const g of groups)
    g.hasCites = items.some(
      (it) => isCite(it) && g.start < it.start && it.end <= g.end,
    )
  const startOf = (level) => (level === null ? a : level.start + 1)
  const blank = (x, y) => /^[\s\0]*$/.test(text.slice(x, y))
  const first = (g) => levels.get(g)[0]
  const leads = (g) => {
    const f = first(g)
    return f !== undefined && isCite(f) && blank(g.start + 1, f.start)
  }
  const cites = items.filter(isCite)
  const mentions = items.filter((it) => it.kind === 'mention')

  for (const s of [...cites, ...mentions]) {
    const pin = PIN.exec(text.slice(s.end))
    if (pin) {
      s.pin = pin[1]
      s.after = s.end + pin[0].length
    } else s.after = s.end
  }
  // a list of citations that closes with a pin is pinned whole
  for (const c of cites) {
    if (c.pin === undefined || c.listed) continue
    const list = levels.get(c.level)
    for (let i = list.indexOf(c) - 1, cur = c; i >= 0; i--) {
      const prev = list[i]
      if (!isCite(prev) || prev.pin !== undefined) break
      if (!SEPARATOR.test(text.slice(prev.end, cur.start))) break
      prev.pin = c.pin
      prev.listed = true
      cur = prev
    }
  }
  for (const g of groups) {
    const pin = /^\s*,?\s*at\s+`([0-9a-f]{7,40})`/.exec(text.slice(g.end))
    const inner = levels.get(g)
    if (!pin || inner.length === 0 || !inner.every(isCite)) continue
    const gaps = inner
      .slice(1)
      .map((it, k) => text.slice(inner[k].end, it.start))
    if (
      !blank(g.start + 1, inner[0].start) ||
      !gaps.every((s) => SEPARATOR.test(s))
    )
      continue
    if (!blank(inner.at(-1).end, g.end - 1)) continue
    for (const it of inner) it.pin ??= pin[1]
  }

  for (const c of cites) {
    const list = levels.get(c.level)
    let k = c.after
    while (k < b && /\s/.test(mask2[k])) k++
    if (mask2[k] === '(') {
      const g = groups.find((x) => x.start === k)
      if (g !== undefined) g.afterOf = c
    } else if (mask2[k] === ':') {
      let end = c.level === null ? b : c.level.end - 1
      for (const it of list)
        if (
          it.start > k &&
          (isCite(it) ||
            it.kind === 'stop' ||
            (it.kind === 'group' && leads(it)))
        ) {
          end = it.start
          break
        }
      c.colon = [k + 1, end]
    }
  }

  for (const q of items.filter((it) => it.kind === 'quote')) {
    const owner = nextOwner(q) ?? backOwner(q)
    if (owner === null) continue
    const [key, c] = owner
    ;(c[key] ??= []).push(q)
  }

  // A quote right before a citation, or before the parentheses it leads,
  // with nothing but commas, "and", "or", "at" or other quotes between:
  // the citation quotes it.
  function nextOwner(q) {
    const list = levels.get(q.level)
    let prev = q
    for (let i = list.indexOf(q) + 1; i < list.length; i++) {
      const it = list[i]
      if (!CONNECT.test(text.slice(prev.end, it.start))) return null
      if (isCite(it)) return ['quotes', it]
      if (it.kind === 'group') return leads(it) ? ['quotes', first(it)] : null
      if (it.kind !== 'quote') return null
      prev = it
    }
    return null
  }

  // The citation whose parentheses or colon hold the quote, or that it
  // follows as closely as nextOwner's; else the one it follows further on in
  // the same clause, at the same depth, which cannot claim it. A quote after
  // a citation's own closed parentheses, or in parentheses of its own, is
  // the document's next words.
  function backOwner(q) {
    const list = levels.get(q.level)
    let crossed = false
    let adjacent = true
    let next = q
    for (let i = list.indexOf(q) - 1; i >= 0; i--) {
      const it = list[i]
      if (!CONNECT.test(text.slice(isCite(it) ? it.after : it.end, next.start)))
        adjacent = false
      if (isCite(it)) {
        if (adjacent || (it.colon !== undefined && q.start < it.colon[1]))
          return ['quotes', it]
        return crossed ? null : ['unattached', it]
      }
      if (it.kind === 'group' && it.hasCites) return null
      if (it.kind === 'semi' || it.kind === 'stop') crossed = true
      if (it.kind !== 'quote') adjacent = false
      next = it
    }
    return q.level?.afterOf === undefined ? null : ['quotes', q.level.afterOf]
  }

  for (const c of cites) {
    c.name = nameOf(c)
    c.heading = headingOf(c)
  }

  // A function, interface or const name written right before the citation,
  // before the parentheses it alone fills, or first inside the parentheses
  // after it. A name in a list of names ("`A` and `B` (`f.ts:1`, `:9`)")
  // does not say which citation is its own, so it names none.
  function nameOf(c) {
    const list = levels.get(c.level)
    const i = list.indexOf(c)
    const alone = (items, k) => {
      const before = items[k - 1]
      return !(
        before?.kind === 'name' &&
        SEPARATOR.test(text.slice(before.end, items[k].start))
      )
    }
    const prev = list[i - 1]
    const next = list[i + 1]
    const listed =
      next !== undefined &&
      isCite(next) &&
      SEPARATOR.test(text.slice(c.end, next.start))
    if (
      prev?.kind === 'name' &&
      /^[\s,]*$/.test(text.slice(prev.end, c.start)) &&
      alone(list, i - 1) &&
      !listed
    )
      return prev.ident
    if (
      c.level !== null &&
      i === 0 &&
      list.filter(isCite).length === 1 &&
      blank(c.level.start + 1, c.start)
    ) {
      const outer = levels.get(c.level.parent)
      const k = outer.indexOf(c.level)
      const pp = outer[k - 1]
      if (
        pp?.kind === 'name' &&
        blank(pp.end, c.level.start) &&
        alone(outer, k - 1)
      )
        return pp.ident
    }
    const g = groups.find((x) => x.afterOf === c)
    const f = g === undefined ? undefined : first(g)
    if (
      f?.kind === 'name' &&
      blank(g.start + 1, f.start) &&
      /^\s*[,;:)]/.test(text.slice(f.end))
    )
      return f.ident
    return null
  }

  // The last `§` (or rule) named in the clause before the citation, read
  // outward through the parentheses round it. Quotes are masked, so a `§`
  // inside quoted words is the quoted document's, not this citation's.
  function headingOf(c) {
    let level = c.level
    let from = c
    let clause = ''
    for (;;) {
      const list = levels.get(level)
      let stop = startOf(level)
      let i = list.indexOf(from) - 1
      for (; i >= 0; i--) {
        const it = list[i]
        if (
          isCite(it) ||
          it.kind === 'semi' ||
          it.kind === 'stop' ||
          (it.kind === 'group' && it.hasCites)
        ) {
          stop = it.end
          break
        }
      }
      clause = `${mask2.slice(stop, from.start)} ${clause}`
      if (i >= 0 || level === null) break
      from = level
      level = level.parent
    }
    const refs = [...clause.matchAll(SECTION)]
    const r = refs.at(-1)
    if (r === undefined) return null
    // "MASTER-PLAN § 12": a § another document's name owns is not this file's
    const doc = /([A-Z][A-Z0-9]+(?:-[A-Z0-9]+)*)(?:'s|')?[\s,]*$/.exec(
      clause.slice(0, r.index),
    )
    const range = (x, y) => [Number(x), Number(y ?? x)]
    if (r[4] !== undefined)
      return {
        doc: doc?.[1] ?? null,
        label: r[0].trim().replace(/\s+/g, ' '),
        section: '1',
        items: range(r[4], r[5]),
        rule: true,
      }
    return {
      doc: doc?.[1] ?? null,
      label: r[0].trim().replace(/\s+/g, ' '),
      section: r[1],
      items: r[2] === undefined ? null : range(r[2], r[3]),
      rule: false,
    }
  }
}
