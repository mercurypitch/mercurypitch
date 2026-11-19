// Group B: print a scene's anchors in scene and film time (node, no browser): the cue sheet's cues and words through the
// kit's own L.at / L.word, for the build notes. node lab/s05-push/anchors.mjs <sid> '<name>=<expr>' ...
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
const ROOT = new URL('../..', import.meta.url).pathname
const ctx = { window: {}, document: { fonts: null }, console }
ctx.window = ctx
vm.createContext(ctx)
for (const f of ['assets/cues.js', 'assets/scenes.js', 'assets/lib/lesson.js']) vm.runInContext(readFileSync(ROOT + f, 'utf8'), ctx)
const [sid, ...exprs] = process.argv.slice(2)
const T0 = vm.runInContext(`L.scene('${sid}').start`, ctx)
const pre = `const at = (c, e, o) => L.at('${sid}', c, e, o); const word = (l, w, e, o) => L.word('${sid}', l, w, e, o);`
for (const e of exprs) {
  const [name, expr] = e.split('=')
  const v = vm.runInContext('(() => { ' + pre + ' return (' + expr + ') })()', ctx)
  console.log(`${name.padEnd(12)} ${v.toFixed(3).padStart(8)}  film ${(v + T0).toFixed(3)}`)
}
