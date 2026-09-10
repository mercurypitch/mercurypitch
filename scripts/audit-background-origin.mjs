// ============================================================
// audit-background-origin — find gradients that wrap a seam of the
// wrong colour into the 1px strip under a translucent border.
//
// Three defaults compound. background-origin is padding-box, so the
// gradient tile is SIZED to the padding box. background-clip is
// border-box, so it is PAINTED out to the border box. And
// background-repeat is repeat, so the strip between the two boxes is
// not left empty -- it is filled by the neighbouring tile. The result
// is a wrap seam: the top and left strips show the tile's opposite
// edge (the LAST stop) and the bottom and right strips show the FIRST,
// on a corner radius one pixel larger than the fill's. Only a
// translucent or transparent border lets it show, which is why it
// survives review. See docs/agent/MISTAKES.md.
//
// The report is a starting point, not a work list. What it cannot
// decide for you:
//
//   - Whether the seam is visible. It shows where the two ends of the
//     gradient differ most and the radius is tight; it does not show
//     on a wide panel behind a 12-20px radius and a low-contrast wash,
//     and it cannot show at all when the last layer is an opaque
//     colour, since that layer fills the painting area by itself.
//     Render the candidate before changing it.
//   - Whether the split is deliberate. A gradient ring built out of
//     `linear-gradient(...) padding-box, linear-gradient(...)
//     border-box` depends on exactly this behaviour -- see
//     .displayNamePill in src/components/account/AccountSection.module.css.
//     Rules that name a box keyword are reported separately.
//
// Usage: pnpm audit:background-origin
// ============================================================
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const files = execSync('git ls-files -z "*.css"', { encoding: 'utf8' })
  .split('\0')
  .filter(Boolean)

/** Blank comment bodies, preserving length and newlines so offsets and
 *  line numbers stay true. Also stops a brace inside a comment from
 *  desynchronising the walker. */
function blankComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
}

/** Walk balanced braces. Yields every rule with its selector, the line
 *  its selector starts on, and its own declarations (descendant blocks
 *  removed), so nested rules and at-rule blocks are handled correctly. */
function walkRules(src) {
  const blanked = blankComments(src)
  const out = []
  const stack = []
  let line = 1
  let selStart = 0
  let selStartLine = 1
  for (let i = 0; i < blanked.length; i++) {
    const ch = blanked[i]
    if (ch === '\n') {
      line++
    } else if (ch === '{') {
      const raw = blanked.slice(selStart, i)
      const lead = raw.length - raw.trimStart().length
      const skipped = raw.slice(0, lead).split('\n').length - 1
      stack.push({
        selector: raw.trim().replace(/\s+/g, ' '),
        line: selStartLine + skipped,
        bodyStart: i + 1,
        holes: [],
      })
      selStart = i + 1
      selStartLine = line
    } else if (ch === '}') {
      const block = stack.pop()
      if (!block) continue
      const parent = stack[stack.length - 1]
      if (parent) parent.holes.push([block.bodyStart - 1, i + 1])
      let body = blanked.slice(block.bodyStart, i)
      for (const [from, to] of block.holes.reverse()) {
        body =
          body.slice(0, from - block.bodyStart) +
          body.slice(to - block.bodyStart)
      }
      out.push({ selector: block.selector, line: block.line, body })
      selStart = i + 1
      selStartLine = line
    }
  }
  return out
}

/** Split a comma list without breaking inside parentheses. */
function splitTop(text) {
  const parts = []
  let depth = 0
  let current = ''
  for (const ch of text) {
    if (ch === '(') depth++
    else if (ch === ')') depth--
    if (ch === ',' && depth === 0) {
      parts.push(current)
      current = ''
    } else {
      current += ch
    }
  }
  parts.push(current)
  return parts.map((p) => p.trim()).filter(Boolean)
}

/** Every gradient in a declaration, with balanced parentheses. */
function gradients(text) {
  const found = []
  const re = /(?:repeating-)?(?:linear|radial|conic)-gradient\(/gi
  let m
  while ((m = re.exec(text))) {
    let depth = 1
    let i = m.index + m[0].length
    for (; i < text.length && depth > 0; i++) {
      if (text[i] === '(') depth++
      else if (text[i] === ')') depth--
    }
    if (depth === 0) found.push(text.slice(m.index + m[0].length, i - 1))
  }
  return found
}

const GRADIENT_CONFIG =
  /^(to\b|circle\b|ellipse\b|at\b|in\b|from\b|-?[\d.]+(deg|rad|turn|grad)\b|closest|farthest)/i

/** A gradient whose stops are all one colour cannot wrap a visible seam. */
function isFlatGradient(declaration) {
  const found = gradients(declaration)
  if (found.length === 0) return false
  return found.every((g) => {
    const stops = splitTop(g).filter((s) => !GRADIENT_CONFIG.test(s))
    if (stops.length < 2) return true
    // Drop the trailing position, keep the colour, parens intact.
    const colours = stops.map((s) =>
      s.replace(/\s+-?[\d.]+(%|px|em|rem)$/, '').trim(),
    )
    return colours.every((c) => c === colours[0])
  })
}

/** Custom properties, first definition wins. Used to resolve a border
 *  colour delivered through a token rather than spelled inline. */
function collectTokens() {
  const tokens = new Map()
  for (const file of files) {
    for (const m of blankComments(readFileSync(file, 'utf8')).matchAll(
      /(--[\w-]+)\s*:\s*([^;{}]+);/g,
    )) {
      if (!tokens.has(m[1])) tokens.set(m[1], m[2].trim())
    }
  }
  return tokens
}
const TOKENS = collectTokens()

/** 'translucent' | 'opaque' | 'unknown' for a colour value. */
function translucency(value, depth = 0) {
  const v = value.trim()
  if (depth > 4) return 'unknown'
  if (/^transparent$/i.test(v)) return 'translucent'

  const varMatch = v.match(/^var\(\s*(--[\w-]+)\s*(?:,([\s\S]+))?\)$/)
  if (varMatch) {
    const resolved = TOKENS.get(varMatch[1])
    if (resolved) return translucency(resolved, depth + 1)
    if (varMatch[2]) return translucency(varMatch[2], depth + 1)
    return 'unknown'
  }

  // #rgba / #rrggbbaa
  const hex = v.match(/^#([0-9a-f]{4}|[0-9a-f]{8})$/i)
  if (hex) {
    const raw = hex[1]
    const alpha =
      raw.length === 4
        ? parseInt(raw[3] + raw[3], 16)
        : parseInt(raw.slice(6), 16)
    return alpha < 255 ? 'translucent' : 'opaque'
  }

  // rgb/rgba/hsl/hsla/oklch/oklab/lab/lch, comma or slash syntax
  const fn = v.match(/^(rgba?|hsla?|oklch|oklab|lab|lch|hwb)\(([\s\S]*)\)$/i)
  if (fn) {
    const slash = fn[2].split('/')
    const alphaText =
      slash.length > 1 ? slash[slash.length - 1] : splitTop(fn[2])[3]
    if (alphaText === undefined) return 'opaque'
    const n = parseFloat(alphaText)
    if (Number.isNaN(n)) return 'unknown'
    return (alphaText.includes('%') ? n < 100 : n < 1)
      ? 'translucent'
      : 'opaque'
  }

  const mix = v.match(/^color-mix\(([\s\S]*)\)$/i)
  if (mix) {
    const parts = splitTop(mix[1])
    if (parts.some((p) => /\btransparent\b/i.test(p))) return 'translucent'
    // Percentages summing under 100 scale the result's alpha (CSS Color 5).
    const pcts = parts
      .slice(1)
      .map((p) => p.match(/(-?[\d.]+)%/))
      .filter(Boolean)
      .map((m) => parseFloat(m[1]))
    if (pcts.length === 2 && pcts[0] + pcts[1] < 100) return 'translucent'
    const nested = parts
      .slice(1)
      .map((p) => translucency(p.replace(/\s*[\d.]+%\s*$/, ''), depth + 1))
    if (nested.includes('translucent')) return 'translucent'
    if (nested.includes('unknown')) return 'unknown'
    return 'opaque'
  }

  if (/^(#[0-9a-f]{3,6}|[a-z]+)$/i.test(v)) return 'opaque'
  return 'unknown'
}

const BORDER_SIDES =
  'top|right|bottom|left|block|block-start|block-end|inline|inline-start|inline-end'

/** The border a rule draws itself: null when it declares none. */
function ownBorder(body) {
  const shorthand = body.match(/(?:^|;)\s*border\s*:\s*([^;]+)/i)
  if (shorthand && /^\s*(none|0)(\s|$)/i.test(shorthand[1]))
    return { drawn: false }
  // A side set to `0` or `none` draws nothing — keep looking for one that does.
  const sideShorthand = [
    ...body.matchAll(
      new RegExp(`(?:^|;)\\s*border-(?:${BORDER_SIDES})\\s*:\\s*([^;]+)`, 'gi'),
    ),
  ].find((m) => !/^\s*(none|0)(\s|$)/i.test(m[1]))
  const colourDecl = body.match(
    new RegExp(
      `(?:^|;)\\s*border(?:-(?:${BORDER_SIDES}))?-color\\s*:\\s*([^;]+)`,
      'i',
    ),
  )
  const source = colourDecl?.[1] ?? sideShorthand?.[1] ?? shorthand?.[1]
  if (!source) {
    return /(?:^|;)\s*border-width\s*:/i.test(body)
      ? { drawn: true, colour: null }
      : null
  }
  // Strip the width and style tokens off a shorthand to leave the colour.
  const colour = colourDecl
    ? source.trim()
    : splitTop(source)
        .join(',')
        .replace(/^\s*[\d.]+(px|em|rem|%)?\s+/i, '')
        .replace(
          /^\s*(solid|dashed|dotted|double|groove|ridge|inset|outset)\s+/i,
          '',
        )
        .trim()
  return { drawn: true, colour: colour || null }
}

/** Last compound of a selector — the element the rule actually styles. */
function subject(selector) {
  return (
    selector
      .split(',')[0]
      .trim()
      .split(/\s*[>+~]\s*|\s+/)
      .filter(Boolean)
      .pop() ?? ''
  )
}

const hits = []
for (const file of files) {
  const src = readFileSync(file, 'utf8')
  if (!src.includes('gradient(')) continue
  const rules = walkRules(src)

  // Index borders by the classes of each rule's subject, so a state rule
  // that inherits its border from the base rule can still be classified.
  const inherited = new Map()
  for (const rule of rules) {
    const border = ownBorder(rule.body)
    if (!border?.drawn || !border.colour) continue
    for (const cls of subject(rule.selector).match(/\.[\w-]+/g) ?? []) {
      if (!inherited.has(cls)) inherited.set(cls, border)
    }
  }

  for (const rule of rules) {
    if (rule.selector.startsWith('@')) continue
    const declaration = rule.body.match(
      /(?:^|;)\s*background(?:-image)?\s*:[^;]*gradient\([\s\S]*?(?=;|$)/i,
    )
    if (!declaration) continue
    if (/background-origin\s*:\s*border-box/i.test(rule.body)) continue

    let border = ownBorder(rule.body)
    let via = ''
    if (border === null) {
      for (const cls of subject(rule.selector).match(/\.[\w-]+/g) ?? []) {
        if (inherited.has(cls)) {
          border = inherited.get(cls)
          via = ` (border from ${cls})`
          break
        }
      }
    }
    if (!border?.drawn) continue

    const name = rule.selector
    // Only a box keyword inside the background declaration itself counts —
    // `box-sizing: border-box` elsewhere in the rule is not the two-layer trick.
    if (/\b(padding-box|border-box|content-box)\b/i.test(declaration[0])) {
      hits.push({ file, line: rule.line, name, kind: 'deliberate' })
      continue
    }
    if (isFlatGradient(declaration[0])) {
      hits.push({ file, line: rule.line, name, kind: 'flat' })
      continue
    }
    const state = border.colour ? translucency(border.colour) : 'unknown'
    hits.push({
      file,
      line: rule.line,
      name: name + via,
      kind:
        state === 'translucent'
          ? 'candidate'
          : state === 'unknown'
            ? 'unresolved'
            : 'latent',
      swatch: state === 'opaque' ? '' : (border.colour ?? ''),
    })
  }
}

const order = { candidate: 0, unresolved: 1, latent: 2, flat: 3, deliberate: 4 }
hits.sort(
  (a, b) =>
    order[a.kind] - order[b.kind] ||
    a.file.localeCompare(b.file) ||
    a.line - b.line,
)

const counts = {
  candidate: 0,
  unresolved: 0,
  latent: 0,
  flat: 0,
  deliberate: 0,
}
for (const hit of hits) counts[hit.kind]++

console.log(
  `gradient + drawn border, no background-origin: ${hits.length} rules\n` +
    `  candidate  ${counts.candidate}\ttranslucent border: the seam can show\n` +
    `  unresolved ${counts.unresolved}\tborder colour could not be resolved; check by hand\n` +
    `  latent     ${counts.latent}\topaque border hides it today\n` +
    `  flat       ${counts.flat}\tevery stop one colour: no seam possible\n` +
    `  deliberate ${counts.deliberate}\tnames a box keyword: the split is the design\n`,
)
for (const hit of hits) {
  console.log(
    `${hit.kind.toUpperCase().padEnd(10)} ${hit.file}:${hit.line}  ${hit.name}${hit.swatch ? `   ${hit.swatch}` : ''}`,
  )
}
