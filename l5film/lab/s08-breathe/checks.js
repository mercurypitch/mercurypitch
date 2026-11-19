// s08-breathe's checks (lab/s05-push/probe.mjs, group B's probe, unchanged): the first frame against S7's last (HANDOFFS
// § The cuts S7 to S8: the parked figure at k 0.5, x0 140, y0 180, 35 %), the dim under the card, the figure whole at
// S8's placement (HANDOFFS § The breath figure, S8), every cue label and leader in its place, LAB-CHECKS 6 ("knees
// unlocked" 16 px or more left of the back arrow's stroke), the breath, overlaps between visible texts, the keep-out,
// the 0.4 s landing rule, and the last frame (S8 to S9). Fix round F-01: the card's "03" 12 px or more from the figure
// while the card shows (DECISIONS 229), the kicker's exit linear over 0.3 s (233), "knees unlocked" settling on
// "unlocked" about its right end (227).
;(function () {
  const H = window.__H, sid = 's08-breathe'
  const S = window.__sceneProbe[sid], A = S.A
  const T = {
    f0: 0, dim: A.ACT + 0.25, card: A.CARD_IN + 0.9, up: A.STAND - 0.3, go: A.STAND + 0.001, go2: A.STAND + 0.3, mid: A.STAND + 0.6, whole: A.STAND + A.STAND_D + 0.05, lungs: A.LUNGS_Q + 0.4,
    tall: A.TALL + 0.6, knees: A.KNEES + 0.6, jaw: A.JAW + 0.8, inq: A.IN_Q + 0.4, held: A.LET + A.IN_D + 0.1, shoulders: A.SHOULDERS + 0.5,
    much: A.TAKING + 0.4, singers: A.SINGERS + 0.5, last: A.D - 0.0005,
    c0: A.STAND - 0.25, c1: A.STAND + 0.1, c2: A.STAND + 0.2, c3: A.STAND + 0.3, c4: A.STAND + 0.35, c5: A.STAND + 0.37,
    unl: A.UNLOCKED + 0.15, kick1: A.KICK_OUT + A.KICK_D / 2, kick2: A.KICK_OUT + A.KICK_D,
  }
  const cardGap = (t) => {
    const f = R(S.fig.g), n = R(S.card.numEl), a = +S.card.g.getAttribute('opacity')
    return { name: `229: the card's "03" (its font box) 12 px or more from the figure while the card shows (+${(t - A.STAND).toFixed(2)} s from the move)`, got: a > 0.01 ? H.gap(f, n) : `card ${a}`, want: '>= 12', pass: a <= 0.01 || H.gap(f, n) >= 12 }
  }
  const root = document.getElementById(sid + '-scene')
  const R = H.R
  const figA = () => +S.fig.g.getAttribute('opacity')
  const overlaps = () => {
    const tx = H.texts(root, 0.5).filter((x) => x.r.width > 0)
    const bad = []
    for (let i = 0; i < tx.length; i++) for (let j = i + 1; j < tx.length; j++) {
      const a = tx[i].r, b = tx[j].r
      const ox = Math.min(a.right, b.right) - Math.max(a.left, b.left), oy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top)
      if (/^Singers|^different/.test(tx[i].text) && /^Singers|^different/.test(tx[j].text)) continue   // one label's two lines, 50 px apart
      if (ox > 0 && oy > 8) bad.push(`"${tx[i].text}" / "${tx[j].text}"`)
    }
    return { name: 'no two visible texts overlap', got: bad.length ? bad.join('; ') : 'none', want: 'none', pass: !bad.length }
  }
  // the ink box of a label (canvas metrics), from its anchor
  const inkOf = (c, size = 36, family = "600 36px 'Outfit'") => {
    const m = H.ink(c.text, family, c.anchor || 'start')
    return { left: c.x + m.l, right: c.x + m.r, top: c.y - m.up, bottom: c.y + m.down }
  }
  // each visible label against every leader and mark it is not attached to: the nearest approach
  const clearOf = (labelEl, pathEl) => {
    const b = R(labelEl)
    const p = pathEl.getTotalLength ? pathEl : null
    if (!p || !p.getAttribute('d')) return Infinity
    const n = Math.max(2, Math.ceil(p.getTotalLength() / 2)), ctm = p.getScreenCTM()
    let d = Infinity
    for (let i = 0; i <= n; i++) {
      const q = p.getPointAtLength((p.getTotalLength() * i) / n), x = ctm.a * q.x + ctm.e, y = ctm.d * q.y + ctm.f
      d = Math.min(d, Math.hypot(Math.max(b.left - x, 0, x - b.right), Math.max(b.top - y, 0, y - b.bottom)))
    }
    return d
  }
  const landings = () => {
    const L8 = [['kicker', A.O9], ['tall but easy', A.TALL], ['knees unlocked', A.KNEES], ['jaw · tongue · neck loose', A.JAW], ['breathe in quietly, low', A.IN_Q], ['diaphragm at work', A.DROP], ['shoulders still', A.SHOULDERS], ['as much as feels easy', A.TAKING], ['Singers breathe in different ways.', A.SINGERS]].sort((a, b) => a[1] - b[1])
    let worst = Infinity, pair = ''
    for (let i = 1; i < L8.length; i++) { const g = L8[i][1] - L8[i - 1][1]; if (g < worst) { worst = g; pair = `${L8[i - 1][0]} / ${L8[i][0]}` } }
    return { name: `0.4 s rule: the closest two landings (${pair})`, got: worst, want: '>= 0.40', pass: worst >= 0.4 - 1e-6 }
  }
  window.__groupB = {
    times: Object.values(T),
    check(t) {
      const out = []
      if (t === T.f0) {
        const crown = S.fig.at('crown'), back = S.fig.at('back')
        out.push({ name: 'first frame (S7\'s last): the parked figure\'s crown at (255, 190)', got: `${crown[0].toFixed(2)}, ${crown[1].toFixed(2)}`, want: '255.00, 190.00' },
          { name: 'its back at x 215', got: back[0], want: 215, tol: 0.01 },
          { name: 'at 35 %', got: figA(), want: 0.35, tol: 0.001 },
          { name: 'no label, leader or mark visible', got: H.texts(root, 0.01).length + (+S.backArrow.g.getAttribute('opacity')), want: 0 },
          { name: 'hosts at 240', got: `${S.boxes.merc && S.boxes.merc.x0}-${S.boxes.merc && S.boxes.merc.x1}; ${S.boxes.tavi && S.boxes.tavi.x0}-${S.boxes.tavi && S.boxes.tavi.x1}`, want: '36.4-163.6; 1756.4-1883.6' },
          landings())
      }
      if ([T.c0, T.c1, T.c2, T.c3, T.c4, T.c5].includes(t)) out.push(cardGap(t))
      if (t === T.unl) {
        const sc = /scale\(([\d.]+)\)/.exec(S.cueL.knees.el.getAttribute('transform') || '')
        out.push({ name: '227: "knees unlocked" settles on "unlocked" (1.08 at 0.15 s, about its right end, 907)', got: `${sc ? sc[1] : 'none'}; right ${R(S.cueL.knees.el).right.toFixed(1)}`, want: '1.0800; 907', pass: !!sc && Math.abs(+sc[1] - 1.08) < 0.002 && Math.abs(R(S.cueL.knees.el).right - 907) < 1 })
      }
      if (t === T.kick1 || t === T.kick2) out.push({ name: `233: the kicker leaves over 0.3 s, linear (${t === T.kick1 ? 'half way' : 'gone'})`, got: +S.kicker.g.getAttribute('opacity'), want: t === T.kick1 ? 0.5 : 0, tol: 0.01 })
      if (t === T.dim) out.push({ name: '8a: the figure dimmed to 25 % under the card', got: figA(), want: 0.25, tol: 0.001 })
      if (t === T.card) {
        const c = S.card.g.getBoundingClientRect()
        out.push({ name: '8a: the card "03 Breathing in" within 1680 px', got: c.width, want: '<= 1680', pass: c.width <= 1680 }, { name: 'the figure still parked and dim under it', got: `${figA().toFixed(2)}, crown ${S.fig.at('crown').map((v) => v.toFixed(1))}`, want: '0.25, crown 255,190', pass: Math.abs(figA() - 0.25) < 0.001 })
      }
      if (t === T.up) out.push({ name: '196: 0.3 s before the move, under the card: the figure still parked and at 25 %', got: `${figA().toFixed(3)}, crown ${S.fig.at('crown').map((v) => v.toFixed(1))}, card ${S.card.g.getAttribute('opacity')}`, want: '0.250, crown 255,190', pass: Math.abs(figA() - 0.25) < 0.001 && Math.abs(S.fig.at('crown')[1] - 190) < 0.01 })
      if (t === T.go) out.push({ name: '196: the move starts as the card starts to leave (the card\'s exit from CARD_OUT), the figure at full strength', got: `${figA().toFixed(3)}; move start ${A.STAND.toFixed(3)}, card out ${A.CARD_OUT.toFixed(3)}`, want: '1.000; equal', pass: Math.abs(figA() - 1) < 0.005 && Math.abs(A.STAND - A.CARD_OUT) < 1e-9 })
      if (t === T.go2) out.push({ name: '196: 0.3 s into the move (info): crown, strength, the card leaving', got: `${S.fig.at('crown').map((v) => v.toFixed(1))}, a ${figA().toFixed(2)}, card ${S.card.g.getAttribute('opacity')}`, want: 'info', pass: true })
      if (t === T.mid) out.push({ name: '8b: mid-stand (info): crown, legs', got: `${S.fig.at('crown').map((v) => v.toFixed(1))}, a ${figA().toFixed(2)}`, want: 'info', pass: true })
      if (t === T.whole) {
        const P8 = (n, x, y) => { const [X, Y] = S.fig.at(n); return [{ name: `8b: S8 ${n} x`, got: X, want: x, tol: 0.6 }, { name: `8b: S8 ${n} y`, got: Y, want: y, tol: 0.6 }] }
        out.push(...P8('head', 991, 199.5), ...P8('chin', 1029.5, 238), ...P8('throat', 1005, 273), ...P8('shoulder', 952.5, 304.5), ...P8('lungs', 998, 374.5), ...P8('domeApex', 998, 444.5), ...P8('knee', 994.5, 686),
          { name: '8b: soles on the floor line (840)', got: S.fig.at('heel')[1], want: 840, tol: 0.1 }, { name: '8b: full strength', got: figA(), want: 1, tol: 0.001 },
          { name: '8b: the figure x 820 to 1100 (its drawn box)', got: (() => { const b = R(S.fig.g.querySelector('g')); return `${b.left.toFixed(0)} to ${b.right.toFixed(0)}, y ${b.top.toFixed(0)} to ${b.bottom.toFixed(0)}` })(), want: 'info', pass: true })
      }
      if (t === T.lungs) out.push({ name: '8b: the lungs glow on "breathe in?"', got: +S.fig.g.querySelectorAll('g[filter] path')[2].getAttribute('opacity'), want: '> 0.5', pass: +S.fig.g.querySelectorAll('g[filter] path')[2].getAttribute('opacity') > 0.5 })
      if (t === T.tall) {
        const r = R(S.cueL.tall.el), ar = R(S.backArrow.shaft)
        out.push({ name: '8c: "tall but easy" right-aligned 900, baseline 200', got: `${r.right.toFixed(1)}`, want: 'about 900', pass: Math.abs(r.right - 900) < 3 },
          { name: '8c: the back arrow x 925, from y 830 up to 150 (its path; the stroke 3 px)', got: `x ${ar.left.toFixed(1)}, y ${ar.top.toFixed(1)} to ${ar.bottom.toFixed(1)}`, want: 'x 925.0, y 150.0 to 830.0', pass: Math.abs(ar.left - 925) < 0.5 && Math.abs(ar.top - 150) < 0.5 && Math.abs(ar.bottom - 830) < 0.5 })
      }
      if (t === T.knees) {
        const ink = inkOf(S.CUE.knees), ar = { left: R(S.backArrow.shaft).left - 1.5 }
        out.push({ name: 'LAB-CHECKS 6: "knees unlocked" (ink) left of the back arrow\'s stroke', got: ar.left - ink.right, want: '>= 16', pass: ar.left - ink.right >= 16 },
          { name: 'its font box right edge (right-aligned 907)', got: R(S.cueL.knees.el).right, want: 907, tol: 1 },
          { name: 'its leader crosses the arrow to the back of the knee', got: (() => { const p = S.lead.knees.shaft.getAttribute('d'); return p })(), want: 'info', pass: true },
          { name: 'the knee softened (2 degrees)', got: S.fig.at('knee')[0] - 994.5, want: '> 0', pass: S.fig.at('knee')[0] > 994.6 })
      }
      if (t === T.jaw) out.push({ name: '8c: the jaw dropped 4 px (the chin)', got: S.fig.at('chin')[1] - 238, want: 4, tol: 0.05 }, { name: '8c: "jaw · tongue · neck loose" set from x 1070 (the j\'s hook reaches 5 px left of it)', got: +S.cueL.jaw.el.getAttribute('x'), want: 1070, tol: 0.01 })
      if (t === T.held) out.push({ name: '8d: breathed in: the belly front at x 1082 (u 360)', got: S.fig.at('belly')[0], want: 830 + 0.7 * 360, tol: 0.5 }, { name: '8d: the dome lowered (apex v 477.5)', got: S.fig.at('domeApex')[1], want: 140 + 0.7 * 477.5, tol: 0.5 })
      if (t === T.shoulders) {
        const sh = S.fig.at('shoulder'), lv = R(S.level.path)
        out.push({ name: '8d: the shoulder does not move (at rest and breathed in)', got: `${sh[0].toFixed(2)}, ${sh[1].toFixed(2)}`, want: '952.50, 304.50' },
          { name: '8d: the level mark (x, y)', got: `${lv.left.toFixed(1)} to ${lv.right.toFixed(1)}, y ${lv.top.toFixed(1)} to ${lv.bottom.toFixed(1)}`, want: 'info', pass: true },
          { name: '8d: the level mark clear of the back arrow\'s stroke (its outer edge 926.5)', got: lv.left - 1.25 - 926.5, want: '>= 4', pass: lv.left - 1.25 - 926.5 >= 4 })
      }
      if (t === T.singers || t === T.last) {
        // every label clear of every leader but its own, and of the arrow
        const names = Object.keys(S.cueL)
        let worst = Infinity, what = ''
        for (const n of names) for (const m of Object.keys(S.lead)) {
          if (m === n) continue
          const d = clearOf(S.cueL[n].el, S.lead[m].shaft)
          if (d < worst) { worst = d; what = `${n} / ${m}'s leader` }
        }
        for (const n of names) { const d = clearOf(S.cueL[n].el, S.backArrow.shaft); if (n !== 'tall' && n !== 'knees' && d < worst) { worst = d; what = `${n} / the arrow` } }
        out.push({ name: `every label 8 px or more from the other leaders and the arrow (nearest: ${what})`, got: worst, want: '>= 8', pass: worst >= 8 })
        out.push(overlaps(), ...H.keepout(root, S.boxes))
      }
      if (t === T.last) {
        const vis = Object.entries(S.cueL).map(([n, l]) => `${n} ${H.alpha(l.el).toFixed(2)}`).join(', ')
        out.push({ name: 'last frame (S8 to S9): the figure whole at S8\'s placement, breathed out to rest (breath 0, DECISIONS 191), the jaw at 4 px', got: `crown ${S.fig.at('crown').map((v) => v.toFixed(1))}, belly ${S.fig.at('belly')[0].toFixed(2)}, chin ${S.fig.at('chin')[1].toFixed(2)}`, want: 'crown 991,154, belly 1061.0 (u 330, rest), chin 242', pass: Math.abs(S.fig.at('belly')[0] - (830 + 0.7 * 330)) < 0.05 && Math.abs(S.fig.at('chin')[1] - 242) < 0.05 },
          { name: 'last frame: every cue label at full', got: vis, want: 'all 1.00', pass: Object.values(S.cueL).every((l) => H.alpha(l.el) > 0.999) && S.singers.every((l) => H.alpha(l.el) > 0.999) },
          { name: 'last frame: the card and kicker gone', got: `${S.card.g.getAttribute('opacity')} / ${S.kicker.g.getAttribute('opacity')}`, want: '0.000 / 0.000' })
      }
      return out
    },
  }
})()
