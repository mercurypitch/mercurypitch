// ============================================================
// audit-background-origin — find gradients that paint a flat 1px
// band out under a translucent border.
//
// background-origin defaults to padding-box while background-clip
// defaults to border-box, so a gradient under a border is SIZED to
// the padding box but PAINTED out to the border box. The 1px
// overhang gets no continuation of the gradient -- it gets the first
// stop's flat colour along the top and left and the last stop's
// along the bottom and right, on a corner radius one pixel larger
// than the fill's. It reads as a second rectangle laid over the
// rounded corners, and only a translucent or transparent border lets
// it show, which is why it survives review.
//
// The report is a starting point, not a work list. Two things it
// cannot decide for you:
//
//   - Whether the band is visible. It shows on a small control with
//     a tight radius and a gradient whose stops actually differ; it
//     does not show on a wide panel behind a 12-20px radius and a
//     low-contrast wash. Render the candidate before changing it.
//   - Whether the split is deliberate. A gradient ring built out of
//     `linear-gradient(...) padding-box, linear-gradient(...)
//     border-box` depends on exactly this behaviour -- see
//     src/components/account/AccountSection.module.css. Rules that
//     name a box keyword are reported separately and left alone.
//
// Usage: pnpm audit:background-origin
// ============================================================
import { readFileSync } from 'node:fs'
import { execSync } from 'node:child_process'

const files = execSync("git ls-files '*.css'", { encoding: 'utf8' })
  .trim()
  .split('\n')

/** A gradient whose stops are all the same colour cannot show a band. */
function isFlatGradient(body) {
  const grads = [
    ...body.matchAll(
      /(?:linear|radial|conic)-gradient\(([^()]*(?:\([^()]*\)[^()]*)*)\)/gi,
    ),
  ]
  if (grads.length === 0) return false
  return grads.every((g) => {
    const stops = g[1]
      .split(',')
      .map((s) => s.trim())
      .filter((s) => !/^(to\b|\d|circle|ellipse|at\b|in\b|from\b)/i.test(s))
    if (stops.length < 2) return true
    const colours = stops.map((s) => s.replace(/\s+[\d.]+%?$/, '').trim())
    return colours.every((c) => c === colours[0])
  })
}

const hits = []
for (const file of files) {
  const src = readFileSync(file, 'utf8')
  const re = /([^{}]+)\{([^{}]*)\}/g
  let match
  while ((match = re.exec(src))) {
    const selector = match[1].trim()
    if (selector.startsWith('@')) continue
    const body = match[2]
    if (!/background(-image)?\s*:[^;]*gradient\(/i.test(body)) continue

    const borderShorthand = body.match(/(^|;)\s*border\s*:\s*([^;]+)/i)
    const drawsBorder =
      (borderShorthand && !/^\s*(none|0)\b/i.test(borderShorthand[2])) ||
      /(^|;)\s*border-(width|color|top|right|bottom|left)\s*:/i.test(body)
    if (!drawsBorder) continue
    if (/background-origin\s*:\s*border-box/i.test(body)) continue

    const line = src.slice(0, match.index).split('\n').length
    const name = selector
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\s+/g, ' ')
      .trim()
    if (
      /background\s*:[^;]*\b(padding-box|border-box|content-box)\b/i.test(body)
    ) {
      hits.push({ file, line, name, kind: 'deliberate' })
      continue
    }
    if (isFlatGradient(body)) {
      hits.push({ file, line, name, kind: 'flat' })
      continue
    }
    const translucent = body.match(
      /border(?:-color)?\s*:[^;]*?(rgba?\([^)]*\/\s*\d+%\)|rgba\([^)]*,[^)]*,[^)]*,[^)]*\)|color-mix\([^)]*transparent[^)]*\)|transparent)/i,
    )
    hits.push({
      file,
      line,
      name,
      kind: translucent ? 'candidate' : 'latent',
      swatch: translucent ? translucent[1] : '',
    })
  }
}

const order = { candidate: 0, latent: 1, flat: 2, deliberate: 3 }
hits.sort(
  (a, b) =>
    order[a.kind] - order[b.kind] ||
    a.file.localeCompare(b.file) ||
    a.line - b.line,
)

const label = {
  candidate: 'CANDIDATE ', // translucent border: the band can show
  latent: 'latent    ', // opaque border hides it today
  flat: 'flat      ', // every stop the same colour: no band possible
  deliberate: 'deliberate', // names a box keyword: the split is the design
}
const counts = hits.reduce(
  (acc, h) => ({ ...acc, [h.kind]: (acc[h.kind] ?? 0) + 1 }),
  {},
)
console.log(
  `gradient + drawn border, no background-origin: ${hits.length} rules ` +
    `(${counts.candidate ?? 0} candidate, ${counts.latent ?? 0} latent, ` +
    `${counts.flat ?? 0} flat, ${counts.deliberate ?? 0} deliberate)\n`,
)
for (const h of hits) {
  console.log(
    `${label[h.kind]} ${h.file}:${h.line}  ${h.name}${h.swatch ? '   ' + h.swatch : ''}`,
  )
}
