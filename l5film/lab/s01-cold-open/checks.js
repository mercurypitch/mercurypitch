// s01-cold-open's checks (lab/s01-cold-open/probe.mjs): framings, the check right of the second pill and its clearances, LAB-CHECKS 7 and 9, the hook's frame
// against Lesson 4's S15, the pass into the bead, the last frame's field, the keep-out.
;(function () {
  const H = window.__H, sid = 's01-cold-open'
  const S = window.__sceneProbe[sid], A = S.A
  const at = (c, e, o) => L.at(sid, c, e, o)
  const T = {
    f0: 0, wave: L.at(sid, 'easy', 'end', 0.5), l9a: at('pushed', 'start', 3.52), tick: A.HIGHER + 0.5, drift: at('o2', 'start', -0.05),
    s0: A.SUPPORT, s1: A.SUPPORT + 0.2, pull: A.PULL_END, hook: A.PULL_END + 0.5, steady: L.word(sid, 'o2', 'steady', 'start', 0.3),
    bead: A.PUSH + A.PUSH_D, last: A.D - 0.001,
    // the fix round (critic A-01): the guess (DECISIONS 170), the pull (173), the hook's exits (171)
    g1: A.GUESS + 0.25, g2: A.GUESS + 0.6, g3: at('o1', 'end', 0.6), g4: A.HIGHER + 0.7,
    lineOut0: A.HOOK + 0.35, lineOut1: A.HOOK + 0.65,
    pull50: A.PULL + 0.5 * A.PULL_D, pull80: A.PULL + 0.8 * A.PULL_D, linesGone: A.LINES_OUT + A.LINES_D, slid: A.SLIDE + A.SLIDE_D,
  }
  // every frame from '"support"' landing to the cut: no line under the word (DECISIONS 173); and every frame of the
  // approach (171): the bead's radius, its blur, how much it grows a frame
  const frames = (a, b) => { const out = []; for (let k = Math.ceil(a * 30 - 1e-6); k / 30 <= b + 1e-9; k++) out.push(k / 30); return out }
  const LINESWEEP = frames(A.SUPPORT, A.D), APPROACH = frames(A.PUSH, A.PUSH + A.PUSH_D + 1 / 30)   // to the first frame after it
  const lineMax = { v: 0, what: '', t: null }
  const ap = []
  const op = (el) => (el ? +(el.getAttribute('opacity') ?? 1) : 0)
  const easyLine = () => S.ch.g.querySelector('.lines').children[0]
  // the tick's sweep (DECISIONS 166): every frame from "higher." until the pills have gone, the check's ink to the
  // "ILLUSTRATION" and "LISTEN ONLY" chips under it (both ride the drift), wherever both are on screen
  const SWEEP = []
  for (let k = 0; A.HIGHER + k / 30 <= at('o2', 'start', 1.0); k++) SWEEP.push(A.HIGHER + k / 30)
  const tickInk = () => { const b = S.tick.path.getBBox(), m = S.tick.g.getCTM(); return { left: m.e + b.x - 2, right: m.e + b.x + b.width + 2, top: m.f + b.y - 2, bottom: m.f + b.y + b.height + 2 } }
  const near = { ill: { gap: Infinity, t: null }, lis: { gap: Infinity, t: null }, frames: 0 }
  const root = document.getElementById(sid + '-scene')
  const plot = (t) => { const a = S.cam.map(400, 400, t), b = S.cam.map(1520, 400, t); return { x0: a[0], x1: b[0], y: a[1] } }
  const supportInk = () => H.ink('“support”', "italic 400 160px 'Instrument Serif'", 'middle')   // measured once the fonts are in
  window.__groupA = {
    times: [...new Set([...Object.values(T), ...SWEEP, ...LINESWEEP, ...APPROACH])].sort((a, b) => a - b),
    check(t) {
      const out = []
      const ko = () => H.keepout(root, S.boxes)
      if (t === T.f0) {
        const p = plot(t), a3 = H.R(S.lab.A3.el), lv = S.lab.level.el
        out.push({ name: 'frame 0 at F-cold: plot from x 456', got: p.x0, want: 456 }, { name: 'plot to x 1464', got: p.x1, want: 1464 }, { name: "Merc's line y 405", got: p.y, want: 405 },
          { name: '"A3" right edge 425 (its advance)', got: S.cam.map(366, 0, t)[0], want: 425 }, { name: '"level" from x 456', got: S.cam.map(400, 0, t)[0], want: 456 }, { name: '"level" baseline 745', got: S.cam.map(0, 778, t)[1], want: 745.2, tol: 1 },
          { name: 'frame 0 is finished: kicker, chart, row, chip, A3, level all at full', got: [H.alpha(S.lab.row.el), H.alpha(S.lab.A3.el), H.alpha(lv), H.alpha(S.ill.g)].map((v) => v.toFixed(2)).join(' '), want: '1.00 x 4', pass: [S.lab.row.el, S.lab.A3.el, lv, S.ill.g].every((e) => H.alpha(e) > 0.99) }, ...ko())
      }
      if (t === T.wave) {
        // the wave rule (HANDOFFS): at F-cold a cycle 45.8 px and 63 px peak to peak on screen, ratio 1.375
        const pts = S.ch.lastLine('easy').filter((p) => p[0] >= S.ch.x(1.0)), sc = S.cam.scale(t)
        const peaks = []
        for (let i = 1; i < pts.length - 1; i++) if (pts[i][1] < pts[i - 1][1] && pts[i][1] <= pts[i + 1][1]) peaks.push(pts[i][0])
        const cyc = (peaks[peaks.length - 1] - peaks[0]) / (peaks.length - 1) * sc
        const ys = pts.map((p) => p[1]), pp = (Math.max(...ys) - Math.min(...ys)) * sc
        out.push({ name: 'the wave rule at F-cold: one cycle on screen (px)', got: cyc, want: 45.8, tol: 4.6 }, { name: 'peak to peak on screen (px)', got: pp, want: 63, tol: 6.3 }, { name: 'ratio', got: pp / cyc, want: '1.30 to 1.45', pass: pp / cyc >= 1.3 && pp / cyc <= 1.45 })
      }
      if (t === T.l9a || t === T.drift) {
        const il = H.R(S.ill.box), li = H.R(S.lis.box)
        out.push({ name: `LAB-CHECKS 9: "ILLUSTRATION" to "LISTEN ONLY" (t ${t.toFixed(2)})`, got: li.left - il.right, want: '>= 12', pass: li.left - il.right >= 12 },
          { name: '"LISTEN ONLY" on screen x (board 1488 to 1720)', got: `${li.left.toFixed(1)} to ${li.right.toFixed(1)}, y ${li.top.toFixed(1)} to ${li.bottom.toFixed(1)}`, want: '1488-1720, 146-184', pass: Math.abs(li.left - 1488) < 3 && Math.abs(li.top - 146) < 3 })
        if (t === T.drift) {
          const p = plot(t), pill = H.R(S.pills[1].box)
          out.push({ name: 'LAB-CHECKS 9: the chip 12 px under the second pill at the drift\'s end', got: il.top - pill.bottom, want: '>= 12', pass: il.top - pill.bottom >= 12 },
            { name: 'F-cold end: plot from x 444.8', got: p.x0, want: 444.8, tol: 0.5 }, { name: 'plot to x 1475.2', got: p.x1, want: 1475.2, tol: 0.5 }, { name: 'line y 404', got: p.y, want: 404, tol: 0.5 }, ...ko())
        }
      }
      if (SWEEP.includes(t) && H.alpha(S.tick.g) > 0.01) {
        const k = tickInk()
        near.frames++
        for (const [id, chip] of [['ill', S.ill], ['lis', S.lis]]) {
          if (H.alpha(chip.g) <= 0.01) continue
          const g = H.gap(k, H.R(chip.box))
          if (g < near[id].gap) { near[id].gap = g; near[id].t = t }
        }
      }
      if (t === SWEEP[SWEEP.length - 1]) {
        out.push({ name: `the check's ink to the "ILLUSTRATION" chip, nearest over its ${near.frames} frames (t ${near.ill.t == null ? '-' : near.ill.t.toFixed(3)})`, got: near.ill.gap, want: '>= 12', pass: near.ill.gap >= 12 },
          { name: `the check's ink to the "LISTEN ONLY" chip, nearest over the same frames (t ${near.lis.t == null ? '-' : near.lis.t.toFixed(3)})`, got: near.lis.gap, want: '>= 12', pass: near.lis.gap >= 12 })
      }
      if (t === T.g1 || t === T.g2 || t === T.g3 || t === T.g4) {
        const merc = op(S.ch.merc.g), easy = op(easyLine()), head = op(S.guessHead), gd = op(S.guess.g)
        const tag = t === T.g1 ? 'the guess half drawn' : t === T.g2 ? 'the guess drawn, its "?" landing' : t === T.g3 ? 'o1 over, the "?" landed' : 'the reveal ("higher.")'
        const want = t === T.g1 ? [0.5, null, 1] : t === T.g2 ? [0, 0.5, null] : t === T.g3 ? [0, 1, 0] : [1, null, 0]
        out.push({ name: `DECISIONS 170, ${tag} (t ${t.toFixed(2)}): Merc's line / the easy take / the guess's head / the guess`, got: `${merc.toFixed(2)} / ${easy.toFixed(2)} / ${head.toFixed(2)} / ${gd.toFixed(2)}`,
          want: want.map((v) => (v == null ? '-' : v.toFixed(2))).join(' / ') + (t === T.g4 ? ' / 0.00' : ''),
          pass: (want[0] == null || Math.abs(merc - want[0]) < 0.02) && (want[1] == null || Math.abs(easy - want[1]) < 0.02) && (want[2] == null || Math.abs(head - want[2]) < 0.02) && (t !== T.g4 || gd < 0.01) })
        if (t === T.g1) {
          const hb = H.R(S.guessHead.lastChild), front = S.cam.map(L.lerp(S.ch.x(0.5), 1520, 0.5), 400, t)
          out.push({ name: 'the guess\'s head on its drawing end (screen x, y)', got: `${((hb.left + hb.right) / 2).toFixed(1)}, ${((hb.top + hb.bottom) / 2).toFixed(1)}`, want: `${front[0].toFixed(1)}, ${front[1].toFixed(1)}`,
            pass: Math.abs((hb.left + hb.right) / 2 - front[0]) < 1 && Math.abs((hb.top + hb.bottom) / 2 - front[1]) < 1 },
          { name: 'its size: r 7 world (the takes\' head dot), on screen', got: hb.width / 2, want: 7 * S.cam.scale(t), tol: 0.3 })
        }
      }
      if (t === T.pull50 || t === T.pull80) {
        const band = op(S.ch.g.querySelector('.band')), edges = S.bandEdges.map((e) => +e.getAttribute('fill-opacity'))
        out.push({ name: `DECISIONS 173, the pull at ${t === T.pull50 ? '50' : '80'} % (t ${t.toFixed(2)}): the band's fill / its edges / "A3" / the label row / the chip`,
          got: `${band.toFixed(2)} / ${Math.max(...edges).toFixed(2)} / ${H.alpha(S.lab.A3.el).toFixed(2)} / ${H.alpha(S.lab.row.el).toFixed(2)} / ${H.alpha(S.ill.g).toFixed(2)}`,
          want: t === T.pull50 ? '1.00 / 0.00 / 1.00 / 0.00 / 0.00' : 'fading (last third) / 0.00 / fading / 0.00 / 0.00',
          pass: (t === T.pull50 ? band > 0.99 && H.alpha(S.lab.A3.el) > 0.99 : band > 0.05 && band < 0.95) && Math.max(...edges) < 0.005 && H.alpha(S.lab.row.el) < 0.01 && H.alpha(S.ill.g) < 0.01 })
      }
      if (LINESWEEP.includes(t)) {
        const cands = [['the band\'s edges', Math.max(...S.bandEdges.map((e) => +e.getAttribute('fill-opacity')))], ['the takes', Math.max(...[...S.ch.g.querySelector('.lines').children].map(op))],
          ['the strip', op(S.ch.g.querySelector('.strip'))], ['the arrow', op(S.arrow.g)], ['the guess', op(S.guess.g)]]
        for (const [what, v] of cands) if (v > lineMax.v) { lineMax.v = v; lineMax.what = what; lineMax.t = t }
        if (t === LINESWEEP[LINESWEEP.length - 1]) out.push({ name: `DECISIONS 173: no line under '"support"' from its landing to the cut (${LINESWEEP.length} frames; the band's edges, the takes, the strip, the arrow, the guess): the most seen`, got: lineMax.v, want: 0, tol: 0.005 })
      }
      if (t === T.lineOut0 || t === T.lineOut1) out.push({ name: `DECISIONS 178: Merc's amber line at hook + ${t === T.lineOut0 ? '0.35 (its fade starts, linear, 0.3 s)' : '0.65 (gone, before the disc softens)'}`, got: op(S.ch.merc.g), want: t === T.lineOut0 ? 1 : 0, tol: 0.0005 })
      if (t === T.linesGone) out.push({ name: 'DECISIONS 171: the hook\'s two lines gone at hook + 0.24', got: `${H.alpha(S.support).toFixed(2)} / ${H.alpha(S.steady).toFixed(2)}`, want: '0.00 / 0.00', pass: H.alpha(S.support) < 0.01 && H.alpha(S.steady) < 0.01 })
      if (t === T.slid) {
        const b = S.boxes
        out.push({ name: 'DECISIONS 171: the hosts slid out by hook + 0.45: Merc\'s body box right edge / Tavi\'s left edge', got: `${b.merc ? b.merc.x1.toFixed(1) : 'gone'} / ${b.tavi ? b.tavi.x0.toFixed(1) : 'gone'}`, want: '<= 0 / >= 1920',
          pass: (!b.merc || b.merc.x1 <= 0) && (!b.tavi || b.tavi.x0 >= 1920) })
      }
      if (APPROACH.includes(t)) {
        const f = S.critLayer.style.filter, blur = f && f !== 'none' ? parseFloat(f.replace(/[^\d.]/g, '')) : 0
        ap.push({ t, rb: S.rb, blur, line: op(S.ch.merc.g) })
        if (t === APPROACH[APPROACH.length - 1]) {
          const small = ap.filter((p, i) => i > 0 && p.rb < 300).map((p, i) => p.rb / ap[ap.indexOf(p) - 1].rb)
          const firstSoft = ap.find((p) => p.blur > 0)
          out.push({ name: `DECISIONS 171: the approach (${A.PUSH.toFixed(2)} to ${(A.PUSH + A.PUSH_D).toFixed(2)}, ${ap.length} frames to the first after it): the bead's r on screen on its first frame / after it (the frame's half-diagonal is 1101)`, got: `${ap[0].rb.toFixed(1)} / ${ap[ap.length - 1].rb.toFixed(1)}`, want: '22 to 25 / >= 1101', pass: ap[0].rb >= 21.5 && ap[0].rb < 25 && ap[ap.length - 1].rb >= 1101 },
            { name: 'log scale while the disc is small (r < 300): its growth a frame, least / most', got: `${Math.min(...small).toFixed(2)}x / ${Math.max(...small).toFixed(2)}x`, want: 'one steady ratio, eased from rest', pass: Math.max(...small) < 1.6 },
            { name: 'crisp until r 300: the radius on the first frame with any blur', got: firstSoft ? firstSoft.rb : 'none', want: '>= 300', pass: !!firstSoft && firstSoft.rb >= 300 },
            { name: 'DECISIONS 178: Merc\'s amber line on the frames where the disc has softened (any blur): its most opacity', got: Math.max(...ap.filter((p) => p.blur > 0).map((p) => p.line)), want: 0, tol: 0.0005 })
        }
      }
      if (t === T.tick) {
        const k = tickInk()
        const p2 = H.R(S.pills[1].box), outer = p2.right + 1                  // the 2 px stroke's outer edge
        out.push({ name: 'the check right of the second pill: its ink 12 px clear of the capsule\'s outer stroke', got: k.left - outer, want: 12, tol: 0.5 },
          { name: 'its ink x (about 1442 to 1469)', got: `${k.left.toFixed(1)} to ${k.right.toFixed(1)}`, want: '1443.0 to 1470.0' },
          { name: 'centred y 108 (its ink\'s middle)', got: (k.top + k.bottom) / 2, want: 108, tol: 1 },
          { name: 'the first pill\'s stroke dimmed, the second\'s bright', got: `${S.pills[0].box.getAttribute('stroke-opacity')} / ${S.pills[1].box.getAttribute('stroke-opacity')}`, want: '0.28 / 1', pass: +S.pills[0].box.getAttribute('stroke-opacity') < 0.3 && +S.pills[1].box.getAttribute('stroke-opacity') > 0.99 }, ...ko())
      }
      if (t === T.s0 || t === T.s1 || t === T.pull) {
        const base = 406 + H.dyOf(S.support), foot = base + supportInk().down
        const lineTop = plot(t).y - 2
        out.push({ name: `LAB-CHECKS 7: '"support"' descenders over the top of Merc's line's stroke (t ${t.toFixed(2)})`, got: lineTop - foot, want: '>= 12', pass: lineTop - foot >= 12 })
        if (t === T.pull) out.push({ name: '"support" on Lesson 4\'s baseline 420 as the pull lands', got: base, want: 420, tol: 1 })
      }
      if (t === T.hook || t === T.steady) {
        const p = plot(t), b = H.R(S.bead.core)
        out.push({ name: 'F-hook: the long note from x 560', got: p.x0, want: 560, tol: 0.5 }, { name: 'to x 1360', got: p.x1, want: 1360, tol: 0.5 }, { name: 'at y 520', got: p.y, want: 520, tol: 0.5 },
          { name: 'its stroke 4 px on screen (Lesson 4\'s weight)', got: S.cam.scale(t) * +S.ch.merc.path.getAttribute('stroke-width'), want: 4, tol: 0.05 },
          { name: 'head bead centre (560, 520): x', got: b.x + b.width / 2, want: 560, tol: 1 }, { name: 'y', got: b.y + b.height / 2, want: 520, tol: 1 },
          { name: 'head bead r 22 on screen (when not pulsing)', got: b.width / 2, want: t === T.hook ? 22 : '22 x pulse', pass: t !== T.hook || Math.abs(b.width / 2 - 22) < 0.6 },
          { name: '"support" 160 px centred x 960, baseline 420', got: `${S.support.getAttribute('x')}, ${(406 + H.dyOf(S.support)).toFixed(1)}`, want: '960, 420.0' },
          { name: '"what keeps it steady?" 96 px centred x 960, baseline 680', got: `${S.steady.getAttribute('x')}, ${S.steady.getAttribute('y')}`, want: '960, 680' }, ...ko())
      }
      if (t === T.bead) {
        const c = S.cam.map(400, 400, t)
        out.push({ name: 'F-bead: the head bead at the frame\'s centre (x)', got: c[0], want: 960, tol: 0.5 }, { name: '(y)', got: c[1], want: 540, tol: 0.5 }, { name: 'its radius 68 on screen', got: 30.8 * S.cam.scale(t), want: 68, tol: 0.5 },
          { name: 'the field fills the frame: r', got: +S.field.disc.getAttribute('r'), want: L.FIELD.R, tol: 0.5 })
      }
      if (t === T.last) {
        out.push({ name: 'last frame: the field centred (960, 540), r 1500, opaque (S2\'s first frame)', got: `${S.field.disc.getAttribute('cx')}, ${S.field.disc.getAttribute('cy')}, ${S.field.disc.getAttribute('r')}, ${S.field.disc.getAttribute('opacity')}`, want: '960.00, 540.00, 1500.00, 1.000' })
      }
      return out
    },
  }
})()
