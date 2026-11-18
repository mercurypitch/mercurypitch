// A local look at one artboard's static markup before it is sent: node preview.cjs <file.dc.html> <out.png> [scale]
// Takes the <helmet> content as the head and what follows it inside <x-dc> as the body, points the
// canvas's asset addresses at the local copies, and screenshots at the size in $preview.
const { chromium } = require('/opt/node22/lib/node_modules/playwright')
const fs = require('fs')
const [FILE, OUT, SCALE = '1'] = process.argv.slice(2)
const W = '/home/user/mercurypitch/.claude/worktrees/fix'
const ASSETS = {
  '3d25fb55f2d965ae40245482943ec2c6': `${W}/apps/mercurypitch/src/shell/legend/stills/merc-listen.webp`,
  d0793554dafc7e38897f499f2cffe5f9: `${W}/apps/mercurypitch/src/shell/legend/stills/merc-celebrate.webp`,
  cbbcae31021f99e6922c2591b07b2ee1: `${W}/dist/_mock/booth-portrait.webp`,
  '8d1ca25444889004a56e14f3841e1bf7': `${W}/dist/_mock/booth-wide.webp`,
  ad60480dd84e4a7058060f1397db7efa: `${W}/public/ear-lab/regulator-room-portrait.webp`,
  e7da9d819d7a7bb8a857eb4631a96b52: `${W}/dist/_mock/it-today-active.png`,
}
const src = fs.readFileSync(FILE, 'utf8')
const helmet = (src.match(/<helmet>([\s\S]*?)<\/helmet>/) || [, ''])[1]
const body = (src.match(/<\/helmet>([\s\S]*?)<\/x-dc>/) || [, ''])[1]
const size = (src.match(/"\$preview":\{"width":(\d+),"height":(\d+)\}/) || [, '1280', '800']).slice(1).map(Number)
const fix = (s) => s.replace(/\/_blob\/([0-9a-f]{32})/g, (m, id) => (ASSETS[id] ? `file://${ASSETS[id]}` : m))
const left = [...body.matchAll(/\{\{[^}]*\}\}|<sc-(for|if)|<dc-import/g)].map((m) => m[0])
if (left.length) console.log(`note: ${left.length} holes or loops the preview cannot draw: ${[...new Set(left)].slice(0, 5).join(' ')}`)
const html = `<!doctype html><html><head><meta charset="utf-8">${fix(helmet)}</head><body>${fix(body)}</body></html>`
const tmp = `${OUT}.html`
fs.writeFileSync(tmp, html)
;(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
  const page = await browser.newPage({ viewport: { width: size[0], height: size[1] }, deviceScaleFactor: Number(SCALE) })
  const errs = []
  page.on('pageerror', (e) => errs.push(e.message))
  page.on('requestfailed', (r) => errs.push(`failed ${r.url().slice(0, 90)}`))
  await page.goto(`file://${tmp}`)
  await page.waitForTimeout(1800)
  const over = await page.evaluate(() => ({ w: document.documentElement.scrollWidth, h: document.documentElement.scrollHeight }))
  // text that overflows its box, and controls under 44 px, the two things a still cannot show
  const issues = await page.evaluate(() => {
    const out = []
    for (const b of document.querySelectorAll('button, a[href]')) {
      const r = b.getBoundingClientRect()
      if (r.width < 44 || r.height < 44) out.push(`small target ${Math.round(r.width)}x${Math.round(r.height)} "${(b.textContent || b.getAttribute('aria-label') || '').trim().slice(0, 24)}"`)
    }
    for (const e of document.querySelectorAll('div, span, p, button, a')) {
      if (e.children.length === 0 && e.textContent.trim() && (e.scrollWidth > e.clientWidth + 1 || e.scrollHeight > e.clientHeight + 1) && getComputedStyle(e).overflow !== 'visible')
        out.push(`clipped text "${e.textContent.trim().slice(0, 30)}"`)
    }
    return out
  })
  await page.screenshot({ path: OUT })
  console.log(`${FILE.split('/').pop()}: ${size[0]}x${size[1]}, page ${over.w}x${over.h}; ${errs.length} errors; ${issues.length} issues`)
  for (const i of [...errs, ...issues].slice(0, 14)) console.log(`  ! ${i}`)
  await browser.close()
})()
