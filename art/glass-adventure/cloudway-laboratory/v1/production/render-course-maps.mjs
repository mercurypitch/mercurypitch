// Course review maps — derive overhead diagrams from the same compiled contacts used in play.

import { mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { CLOUDWAY_CRYSTAL_PROMENADE_MECHANICS_PREVIEW, CLOUDWAY_CRYSTAL_PROMENADE_STUDY, } from '../../../../../packages/glass-game/src/content/cloudway-laboratory.ts'

const output = new URL('../course-maps/', import.meta.url)
mkdirSync(output, { recursive: true })
const escape = (text) =>
  String(text)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('"', '&quot;')
const centre = (platform) => ({
  x: (platform.minX + platform.maxX) / 2,
  z: (platform.minZ + platform.maxZ) / 2,
})
const palette = (platform) =>
  platform.surface?.kind === 'frost'
    ? '#a8d6e6'
    : platform.behavior?.kind === 'scroll'
      ? '#edce76'
      : platform.behavior?.kind === 'glide'
        ? '#78d7c5'
        : platform.renderId?.includes('rose')
          ? '#e4a9bc'
          : platform.renderId?.includes('amethyst')
            ? '#b7a4d8'
            : '#f5ead1'

for (const level of [
  CLOUDWAY_CRYSTAL_PROMENADE_STUDY,
  CLOUDWAY_CRYSTAL_PROMENADE_MECHANICS_PREVIEW,
]) {
  const extents = level.presentation.worldBounds
  const scale = Math.min(
    36,
    740 / (extents.maxX - extents.minX),
    970 / (extents.maxZ - extents.minZ),
  )
  const drawingWidth = (extents.maxX - extents.minX) * scale
  const drawingHeight = (extents.maxZ - extents.minZ) * scale
  const width = Math.ceil(drawingWidth + 380)
  const height = Math.ceil(
    Math.max(drawingHeight, level.platforms.length * 24) + 160,
  )
  const x = (value) => 30 + (value - extents.minX) * scale
  const y = (value) => 100 + (extents.maxZ - value) * scale
  const rectangle = (bounds, attributes) =>
    `<rect x="${x(bounds.minX)}" y="${y(bounds.maxZ)}" width="${(bounds.maxX - bounds.minX) * scale}" height="${(bounds.maxZ - bounds.minZ) * scale}" ${attributes}/>`
  const parts = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escape(level.title)} compiled course map">`,
    '<defs><marker id="arrow" markerWidth="7" markerHeight="7" refX="5" refY="3" orient="auto"><path d="M0 0 L6 3 L0 6" fill="none" stroke="#518a88"/></marker></defs>',
    `<rect width="${width}" height="${height}" fill="#faf8f0"/>`,
    `<g font-family="system-ui,sans-serif" fill="#244b49"><text x="30" y="36" font-size="23" font-weight="650">${escape(level.title)}</text><text x="30" y="62" font-size="13">Compiled landing bounds · arrows show course order · dashed outlines show raft end pose</text>`,
  ]
  for (const gap of level.intentionalGaps ?? [])
    parts.push(
      rectangle(
        gap,
        'fill="#bf675f" fill-opacity=".1" stroke="#bf675f" stroke-dasharray="3 3" stroke-width=".7"',
      ),
    )
  for (let i = 0; i < level.platforms.length - 1; i++) {
    const from = centre(level.platforms[i]),
      to = centre(level.platforms[i + 1])
    parts.push(
      `<path d="M${x(from.x)} ${y(from.z)} L${x(to.x)} ${y(to.z)}" fill="none" stroke="#518a88" stroke-opacity=".35" marker-end="url(#arrow)"/>`,
    )
  }
  level.platforms.forEach((platform, i) => {
    parts.push(
      rectangle(
        platform,
        `fill="${palette(platform)}" stroke="#61736f" rx="2"`,
      ),
    )
    const middle = centre(platform)
    parts.push(
      `<text x="${x(middle.x)}" y="${y(middle.z) + 4}" font-size="11" text-anchor="middle" font-weight="700">${i + 1}</text>`,
    )
    if (platform.behavior?.kind === 'glide') {
      const motion = platform.behavior.translation
      parts.push(
        rectangle(
          {
            minX: platform.minX + motion.x,
            maxX: platform.maxX + motion.x,
            minZ: platform.minZ + motion.z,
            maxZ: platform.maxZ + motion.z,
          },
          'fill="#78d7c5" fill-opacity=".12" stroke="#289688" stroke-dasharray="5 3"',
        ),
      )
      parts.push(
        `<path d="M${x(middle.x)} ${y(middle.z)} L${x(middle.x + motion.x)} ${y(middle.z + motion.z)}" stroke="#289688" stroke-dasharray="4 3" marker-end="url(#arrow)"/>`,
      )
    }
    const legendX = drawingWidth + 66
    parts.push(
      `<rect x="${legendX}" y="${101 + i * 24}" width="13" height="13" rx="2" fill="${palette(platform)}" stroke="#61736f"/><text x="${legendX + 22}" y="${112 + i * 24}" font-size="12">${i + 1}. ${escape(platform.id)}</text>`,
    )
  })
  for (const solid of level.solids ?? []) {
    if (solid.shape !== 'box') continue
    parts.push(
      rectangle(
        solid,
        `fill="${solid.presentation?.role === 'gate' ? '#3985b5' : '#7d6848'}"`,
      ),
    )
  }
  for (const target of level.breakables)
    parts.push(
      `<circle cx="${x(target.anchor.x)}" cy="${y(target.anchor.z)}" r="5" fill="#225e59" stroke="white" stroke-width="2"><title>${escape(target.label)} singing anchor</title></circle>`,
    )
  for (const checkpoint of level.checkpoints)
    parts.push(
      `<circle cx="${x(checkpoint.position.x)}" cy="${y(checkpoint.position.z)}" r="9" fill="none" stroke="#917023" stroke-width="1.4"><title>${escape(checkpoint.id)}</title></circle>`,
    )
  parts.push(
    rectangle(level.exit, 'fill="#e9c75e" stroke="#8c6b16" stroke-width="2"'),
  )
  parts.push(
    `<text x="30" y="${height - 22}" font-size="12">Green dots: singing anchors · gold rings: checkpoints · blue bar: shatterable wall · gold box: exit</text></g></svg>`,
  )
  const file = new URL(`${level.id}.svg`, output)
  writeFileSync(file, parts.join('\n'))
  console.log(fileURLToPath(file))
}
