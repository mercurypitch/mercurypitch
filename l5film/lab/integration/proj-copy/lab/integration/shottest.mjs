import { createServer } from 'node:http'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
const HERE = dirname(fileURLToPath(import.meta.url)), ROOT = join(HERE, '../..')
const require = createRequire(import.meta.url)
const { chromium } = require('/opt/node-tools/node_modules/playwright')
const server = createServer((req, res) => { const f = join(ROOT, normalize(decodeURIComponent(req.url.split('?')[0]))); if (!existsSync(f)) { res.writeHead(404); res.end(); return }; res.writeHead(200, { 'content-type': { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.ttf': 'font/ttf', '.webm': 'video/webm' }[extname(f)] || 'application/octet-stream' }); res.end(readFileSync(f)) })
await new Promise((r) => server.listen(0, '127.0.0.1', r))
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1243/chrome-linux64/chrome' })
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } })
const url = process.argv[2]
console.log('goto', url)
await page.goto(`http://127.0.0.1:${server.address().port}/${url}`, { waitUntil: 'load', timeout: 30000 })
console.log('loaded')
const t0 = Date.now()
if (process.env.PROF) { const r = await page.evaluate(() => { const sid = Object.keys(window.__timelines)[0]; const cam = window.__sceneProbe[sid].cam, tl = window.__timelines[sid]; const a = performance.now(); let n = 0; for (const m of cam.moves) { if (m.kind !== 'to' || m.dur > 20) continue; for (let k = 0; k <= 40; k++) { const t = m.at + m.dur * k / 40; tl.seek(t, false); cam.slide(t); n++ } } return [n, performance.now() - a] }); console.log('prof', r) }
for (const t of process.argv.slice(3)) { const r = await Promise.race([page.evaluate((t) => { const id = Object.keys(window.__timelines)[0]; const a = performance.now(); window.__timelines[id].seek(+t, false); return performance.now() - a }, t), new Promise((r) => setTimeout(() => r('TIMEOUT'), 15000))]); console.log('seek', t, r); if (r === 'TIMEOUT') break }
try { await page.screenshot({ path: join(HERE, 'shottest.png'), timeout: 20000 }); console.log('shot ok', Date.now() - t0) } catch (e) { console.log('shot failed', e.message.slice(0, 300)) }
await browser.close(); server.close()
