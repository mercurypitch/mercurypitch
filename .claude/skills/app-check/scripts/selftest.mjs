#!/usr/bin/env node
// Prove the probes can fail. A probe that never fires is not a check, so run
// this once per session before trusting a sweep: a page with one planted
// defect per probe must trip each of them, and a clean page must trip none.
//
//   node <skill>/scripts/selftest.mjs        (cwd = a MercuryPitch checkout)
// Exit 0 only when every planted defect is caught and the clean page passes.

import { VIEWPORTS, contrastOf, hitBox, onTop, launch, loadPlaywright, probeFocus, probeLayout, } from './lib.mjs'

const BAD = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>
  body { margin: 0; font-family: Georgia, serif; }
  .wide { width: 600px; height: 20px; background: #ccc; }
  .clip { width: 60px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .bar1 { position: fixed; bottom: 0; left: 0; right: 0; height: 60px; background: #333; color: #fff; }
  .bar2 { position: fixed; bottom: 30px; left: 0; right: 0; height: 60px; background: #a00; color: #fff; z-index: 2; }
  .tiny { width: 16px; height: 16px; padding: 0; border: 0; }
  button:focus, a:focus { outline: none; }
  .arial { font-family: Arial; }
  .faint { color: #bbb; background: #fff; }
</style></head><body>
  <div class="wide">wide</div>
  <div class="clip">Melodies and sessions</div>
  <button class="tiny" aria-label="tiny"></button>
  <button class="arial">Arial button</button>
  <a href="#x">Link one</a>
  <p class="faint" id="faint">Faint text</p>
  <div class="bar1">Tab bar</div><div class="bar2">Cookie bar</div>
  <div id="toast" style="position:fixed;bottom:50px;left:8px;right:8px;height:30px;pointer-events:none;z-index:0;background:#060;color:#fff">Toast under the bar</div>
  <div id="round" style="position:fixed;top:300px;left:8px;right:8px;height:56px;border-radius:14.4px;background:#036;color:#fff">Rounded bar</div>
  <div style="position:fixed;top:300px;left:8px;width:28px;height:28px;z-index:3;background:#a00"></div>
</body></html>`

const GOOD = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>
  body { margin: 0; font-family: Georgia, serif; }
  button { font: inherit; min-width: 48px; min-height: 48px; }
  button:focus-visible { outline: 2px solid #06c; outline-offset: 2px; }
  .bar1 { position: fixed; bottom: 0; left: 0; right: 0; height: 60px; background: #333; color: #fff; }
  #ink { color: #111; background: #fff; }
</style></head><body>
  <p id="ink">Readable text that wraps as it needs to on a narrow screen.</p>
  <button>One</button> <button>Two</button>
  <div class="bar1">Tab bar</div>
  <div id="toast" style="position:fixed;bottom:70px;left:8px;right:8px;height:30px;pointer-events:none;z-index:5;background:#060;color:#fff">Toast above the bar</div>
  <div id="round" style="position:fixed;top:300px;left:8px;right:8px;height:56px;border-radius:14.4px;background:#036;color:#fff">Rounded bar</div>
  <div id="pill" style="position:fixed;top:380px;left:8px;width:160px;height:36px;border-radius:9999px;background:#036;color:#fff">Pill</div>
  <div id="dot" style="position:fixed;top:440px;left:8px;width:40px;height:40px;border-radius:50%;background:#036"></div>
  <div id="mixed" style="position:fixed;top:500px;left:8px;width:60px;height:60px;border-radius:calc(50% + 2px);background:#036"></div>
</body></html>`

const pw = loadPlaywright()
const browser = await launch(pw)
const results = []
const expect = (name, ok) => {
  results.push([name, ok])
  console.log(`${ok ? 'ok  ' : 'MISS'} ${name}`)
}
try {
  for (const [label, html, defects] of [
    ['planted', BAD, true],
    ['clean', GOOD, false],
  ]) {
    const ctx = await browser.newContext({ ...VIEWPORTS.phone, hasTouch: true })
    const page = await ctx.newPage()
    await page.setContent(html)
    const m = await probeLayout(page, { phone: true })
    expect(
      `${label}: sideways scroll ${defects ? 'caught' : 'absent'}`,
      m.overflow.scrollsSideways === defects,
    )
    expect(
      `${label}: clipped text ${defects ? 'caught' : 'absent'}`,
      m.clippedCount > 0 === defects,
    )
    expect(
      `${label}: overlapping bars ${defects ? 'caught' : 'absent'}`,
      m.overlaps.length > 0 === defects,
    )
    expect(
      `${label}: tap target under 24 ${defects ? 'caught' : 'absent'}`,
      m.under24Count > 0 === defects,
    )
    expect(
      `${label}: Arial control ${defects ? 'caught' : 'absent'}`,
      m.fontCount > 0 === defects,
    )
    const c = await contrastOf(page.locator(defects ? '#faint' : '#ink'))
    expect(
      `${label}: contrast ${c.ratio}:1 ${defects ? 'below' : 'above'} 4.5`,
      c.ratio < 4.5 === defects,
    )
    const top = await onTop(page.locator('#toast'))
    expect(
      `${label}: pointer-events:none toast ${defects ? 'covered' : 'on top'}`,
      top === !defects,
    )
    // A corner sample 4 px in lies outside a 14.4 px radius, so onTop has to
    // read the radius or a rounded bar that is on top looks covered. Pill,
    // circle and a mixed calc() radius take the other branches of that reading.
    for (const id of defects ? ['round'] : ['round', 'pill', 'dot', 'mixed']) {
      const on = await onTop(page.locator(`#${id}`))
      expect(
        `${label}: rounded #${id} ${defects ? 'covered' : 'on top'}`,
        on === !defects,
      )
    }
    await ctx.close()
    const dctx = await browser.newContext(VIEWPORTS.desktop)
    const dpage = await dctx.newPage()
    await dpage.setContent(html)
    const stops = await probeFocus(dpage, { stops: 4 })
    const unmarked = stops.filter((s) => !s.visible).length
    expect(
      `${label}: focus walk saw ${stops.length} stops, ${unmarked} unmarked`,
      stops.length > 0 && unmarked > 0 === defects,
    )
    await dctx.close()
  }
  // hitBox looks 60 px either way unless told otherwise, so 121 px wide
  // means "at least 121": the result says so (capped) and maxReach looks further.
  const hctx = await browser.newContext(VIEWPORTS.desktop)
  const hpage = await hctx.newPage()
  await hpage.setContent(
    '<!doctype html><body style="margin:0"><button id="wide" style="display:block;margin-top:100px;width:300px;height:40px;padding:0;border:0">Wide</button></body>',
  )
  const hb = await hitBox(hpage.locator('#wide'))
  expect(
    `hitBox: a 300 px button reads ${hb.hit[0]} wide (capped ${hb.capped[0]}), 121 expected`,
    hb.hit[0] === 121 && hb.capped[0] === true && hb.capped[1] === false,
  )
  const far = await hitBox(hpage.locator('#wide'), { maxReach: 200 })
  expect(
    `hitBox: maxReach 200 reads ${far.hit[0]} wide (capped ${far.capped[0]}), 300 expected`,
    far.hit[0] >= 299 && far.hit[0] <= 301 && far.capped[0] === false,
  )
  await hctx.close()
} finally {
  await browser.close()
}
const missed = results.filter(([, ok]) => !ok)
console.log(
  missed.length
    ? `\nSELFTEST FAILED: ${missed.length} probe(s) did not behave`
    : '\nSELFTEST PASSED: every probe fires on its defect and stays quiet on the clean page',
)
process.exit(missed.length ? 1 : 0)
