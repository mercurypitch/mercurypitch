// WIDTHS.md from window.__kitWidths()'s result (lab/kit-src/type.html, run by probe.mjs).
const f = (v) => (typeof v === 'number' ? (Math.round(v * 10) / 10).toFixed(1) : String(v))
export default function render({ labels, checks }) {
  let md = `# Real widths and clearances (LAB-CHECKS lines 4 to 15 and 21)\n\n`
  md += `Measured in Chromium with the film's own fonts (assets/fonts, as fonts.css.txt loads them) by\n`
  md += `\`lab/kit-src/probe.mjs\` running \`window.__kitWidths()\` in \`lab/kit-src/type.html\`: canvas text metrics,\n`
  md += `so "ink" is the glyphs' own extent (descenders and side bearings included), and "advance" is the width\n`
  md += `\`text-anchor\` aligns (JetBrains Mono's trailing .18em left out, as L.tag sets it). World labels are\n`
  md += `measured at F0 and mapped through the framing a line names. Re-run after any type change:\n`
  md += `\`$S/bin/heavy node lab/kit-src/probe.mjs type\`.\n\n`
  const low = checks.filter((c) => c.measured < 12)
  md += `## Clearances under 12 px\n\n`
  md += low.length ? `| Line | What | Measured | Needs | Board | Pass | Note |\n| - | - | - | - | - | - | - |\n` + low.map((c) => `| ${c.line} | ${c.what} | ${f(c.measured)} | ${f(c.need)} | ${f(c.board)} | ${c.pass ? 'yes' : '**no**'} | ${c.note} |`).join('\n') + '\n\n' : 'None.\n\n'
  md += `## Every clearance\n\n| Line | What | Measured (screen px) | Needs | Board | Pass | Note |\n| - | - | - | - | - | - | - |\n`
  md += checks.map((c) => `| ${c.line} | ${c.what} | ${f(c.measured)} | ${f(c.need)} | ${f(c.board)} | ${c.pass ? 'yes' : '**no**'} | ${c.note} |`).join('\n') + '\n\n'
  md += `## Real widths (line 21)\n\n| Group | Label | Font | Advance | Ink x | Ink y (at its baseline) |\n| - | - | - | - | - | - |\n`
  md += labels.map((l) => `| ${l.group} | ${l.text.replace(/\|/g, '/')} | ${l.font} | ${f(l.w)} | ${f(l.l)} to ${f(l.r)} | ${f(l.t)} to ${f(l.b)} |`).join('\n') + '\n'
  return md
}
