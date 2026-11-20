// A lab clip of copies of the film's scenes with a lab's chunks in place of the film's passes. The
// film's own scenes, passes and root are only read.
//
//   node lab/passes-proto/protolab.mjs <name> --scenes=s08-breathe[,s15-end] [--proto=s08-breathe,...]
//        [--merc=lab/passes-proto/merc] [--shots=lab/passes-proto/shots] [--fps=30] [--film]
//        [--from=<s>] [--len=<s>] [--mix=full|voice|none] [--quality=draft]
//
//   <name>      the lab's folder, lab/passes-proto/<name>/: proj/ (the temporary project), clip.mp4
//   --scenes    the scenes hosted, in film order
//   --proto     which of them take the lab's chunks (default: all): their tags are rewritten by
//               tools/merc-tags.py --shots --scenes --src (so a 60 fps chunk gets its own timing);
//               the others keep the film's tags and chunks
//   --film      the film's own frame grid: each scene at its film start, less a whole number of
//               render frames so the first scene starts within one frame of 0 (as the film cuts
//               it; lab/integration/film-hops-fix proved a root moved by whole frames renders the
//               film's frames). Without it, one scene from its own time 0, as tools/lab.mjs hosts it
//   --from, --len   cut the clip to this window of the render (seconds of the clip), re-encoded
//   --replace=<scene>::<text>::<text>   in the lab's copy of that scene only, the first text becomes
//               the second (every occurrence; it must occur): a scene change tried in the lab
//
// Reads the film's compositions/<scene>.html, assets/ (linked), assets/lib/scripts.txt, fonts.css.txt,
// the lab's shots and chunks. Writes only under lab/passes-proto/<name>/. One HyperFrames process:
// run it through the scratchpad's heavy helper.
import { spawnSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..', '..')
const HF = ['--yes', 'hyperframes@0.8.97']
const env = { ...process.env, HYPERFRAMES_SKIP_SKILLS: '1', HYPERFRAMES_NO_TELEMETRY: '1', HYPERFRAMES_RENDER_DETACHED: '1' }
const args = process.argv.slice(2)
const name = args.find((a) => !a.startsWith('--'))
const opt = (k, d) => {
  const a = args.find((x) => x.startsWith(`--${k}=`))
  return a ? a.slice(k.length + 3) : d
}
if (!name || !opt('scenes')) {
  console.error('usage: node lab/passes-proto/protolab.mjs <name> --scenes=<id,...> [--proto=<id,...>] [--merc=<dir>] [--shots=<dir>] [--fps=30] [--film] [--from=s --len=s]')
  process.exit(2)
}
const scenes = opt('scenes').split(',')
const proto = (opt('proto', opt('scenes')) || '').split(',').filter(Boolean)
const merc = resolve(ROOT, opt('merc', 'lab/passes-proto/merc'))
const shots = resolve(ROOT, opt('shots', 'lab/passes-proto/shots'))
const fps = Number(opt('fps', 30))
const film = args.includes('--film')
const mix = opt('mix', 'full')
const run = (cmd, argv, what, o = {}) => {
  const r = spawnSync(cmd, argv, { stdio: 'inherit', env, ...o })
  if (r.status !== 0) throw new Error(`${what} failed (exit ${r.status})`)
}

const js = readFileSync(join(ROOT, 'assets/scenes.js'), 'utf8')
const SC = JSON.parse(js.slice(js.indexOf('=') + 1).trim().replace(/;\s*$/, ''))
for (const s of scenes) if (!SC[s]) throw new Error(`${s} is not in assets/scenes.js`)
if (!film && scenes.length !== 1) throw new Error('several scenes need --film (the film\'s own timing)')

const LAB = join(HERE, name)
const PROJ = join(LAB, 'proj')
rmSync(PROJ, { recursive: true, force: true })
mkdirSync(join(PROJ, 'compositions'), { recursive: true })
symlinkSync(relative(PROJ, join(ROOT, 'assets')), join(PROJ, 'assets'))
symlinkSync(relative(PROJ, merc), join(PROJ, 'merc'))
for (const f of ['hyperframes.json', 'package.json']) if (existsSync(join(ROOT, f))) copyFileSync(join(ROOT, f), join(PROJ, f))
writeFileSync(join(PROJ, 'meta.json'), JSON.stringify({ id: `proto-${name}`, name: `proto-${name}` }, null, 2) + '\n')
for (const s of scenes) copyFileSync(join(ROOT, 'compositions', `${s}.html`), join(PROJ, 'compositions', `${s}.html`))
for (const r of args.filter((a) => a.startsWith('--replace='))) {
  const [scene, from, to] = r.slice('--replace='.length).split('::')
  const f = join(PROJ, 'compositions', `${scene}.html`)
  const text = readFileSync(f, 'utf8')
  if (!text.includes(from)) throw new Error(`--replace: ${scene} has no "${from}"`)
  writeFileSync(f, text.split(from).join(to))
  console.log(`lab copy of ${scene}: "${from}" -> "${to}" (${text.split(from).length - 1} places)`)
}
// the lab's chunks: the copies' tags from the lab's shots, their src under the project's merc/ link
if (proto.length) {
  run('python3', [join(ROOT, 'tools/merc-tags.py'), ...proto, `--shots=${shots}`, `--scenes=${join(PROJ, 'compositions')}`, '--src=merc/'], 'merc-tags')
}

// the root: the scenes at their film starts less a whole number of render frames, or one scene from 0
const t0 = film ? Math.floor(SC[scenes[0]].start * fps - 1e-6) / fps : SC[scenes[0]].start
const at = (s) => Math.round((SC[s].start - t0) * 1e6) / 1e6
const len = (s) => Math.round((SC[s].end - SC[s].start) * 1000) / 1000
const total = Math.round((SC[scenes[scenes.length - 1]].end - t0) * 1000) / 1000
const audio = mix !== 'none' && existsSync(join(ROOT, `assets/audio/${mix}.wav`))
  ? `      <audio id="soundtrack" src="assets/audio/${mix}.wav" data-start="0" data-duration="${total.toFixed(3)}" data-media-start="${t0.toFixed(6)}" data-volume="1"></audio>\n`
  : ''
// the lab's roots table when the lab's chunks have one (a chunk at another fps), else the film's
const roots = existsSync(join(merc, 'roots.js')) ? 'merc/roots.js' : 'assets/merc/roots.js'
const scripts = readFileSync(join(ROOT, 'assets/lib/scripts.txt'), 'utf8')
  .split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#'))
  .map((p) => `    <script src="${p === 'assets/merc/roots.js' ? roots : p}"></script>`).join('\n')
const fonts = readFileSync(join(ROOT, 'assets/lib/fonts.css.txt'), 'utf8')
const hosts = scenes.map((s) => `      <div id="host-${s}" class="clip" data-composition-id="${s}" data-composition-src="compositions/${s}.html" data-start="${at(s).toFixed(6)}" data-duration="${len(s).toFixed(3)}"></div>`).join('\n')
writeFileSync(join(PROJ, 'index.html'), `<!doctype html>
<!-- Lab ${name}, written by lab/passes-proto/protolab.mjs: ${scenes.join(', ')}; root time 0 is film time ${t0.toFixed(6)}. -->
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=1920, height=1080" />
${scripts}
    <link rel="stylesheet" href="assets/lib/lesson.css" />
    <style>
${fonts}
    </style>
  </head>
  <body>
    <div id="root" data-composition-id="lab" data-start="0" data-duration="${total.toFixed(3)}" data-width="1920" data-height="1080">
${hosts}
${audio}    </div>
    <script>
      const tl = gsap.timeline({ paused: true })
      tl.set({}, {}, ${total.toFixed(3)})
      window.__timelines = window.__timelines || {}
      window.__timelines['lab'] = tl
    </script>
  </body>
</html>
`)
console.log(`project ${relative(ROOT, PROJ)}: ${scenes.map((s) => `${s} at ${at(s).toFixed(3)}`).join(', ')}; ${total.toFixed(3)} s at ${fps} fps; root 0 = film ${t0.toFixed(6)}; roots ${roots}`)
if (args.includes('--no-render')) process.exit(0)
const from = opt('from') !== undefined ? Number(opt('from')) : null
const raw = join(LAB, from !== null ? '_render.mp4' : 'clip.mp4')
run('npx', [...HF, 'render', PROJ, '--quality', opt('quality', 'draft'), '--fps', String(fps), '--output', raw], 'render')
if (from !== null) {
  const out = join(LAB, 'clip.mp4')
  run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-ss', String(from), '-i', raw, '-t', String(Number(opt('len', 4))),
    '-c:v', 'libx264', '-crf', '14', '-preset', 'veryfast', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', out], 'cut')
  rmSync(raw, { force: true })
}
console.log('clip', relative(ROOT, join(LAB, 'clip.mp4')))
