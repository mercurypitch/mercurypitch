async function measure() {
  const cv = document.createElement('canvas'); const cx = cv.getContext('2d')
  const m = (font, s, spacing) => { cx.font = font; cx.letterSpacing = spacing || '0px'; const r = cx.measureText(s); return { s, w: +r.width.toFixed(1), left: +r.actualBoundingBoxLeft.toFixed(1), right: +r.actualBoundingBoxRight.toFixed(1), asc: +r.actualBoundingBoxAscent.toFixed(1), desc: +r.actualBoundingBoxDescent.toFixed(1) } }
  const out = {}
  out.breathe = m("600 28px 'Outfit'", 'Breathe in, low and quiet')
  out.breathePart = ['Breathe', 'Breathe in,', 'Breathe in, low and q'].map((s) => m("600 28px 'Outfit'", s))
  out.nothing = m("600 30px 'Outfit'", 'Nothing listens')
  out.rowCaps = m("500 28px 'JetBrains Mono'", 'LISTEN · BREATHE · SING', '5.04px')
  out.rowLines = ['at about speaking volume', 'stop sooner if you need to'].map((s) => m("500 30px 'Outfit'", s))
  out.feel = ['rest for a few easy breaths', 'rest a few easy breaths', 'rest before you sing again', 'enough singing for today'].map((s) => m("500 30px 'Outfit'", s))
  out.feel28 = m("500 28px 'Outfit'", 'rest for a few easy breaths')
  const D = 'If hoarseness or discomfort lasts more than a couple of weeks, see a doctor (a GP or an ear, nose and throat specialist). If it’s very painful, or breathing or swallowing is hard, get help straight away.'
  const cands = ['If hoarseness or discomfort lasts', 'If hoarseness or discomfort lasts more', 'more than a couple of weeks,', 'more than a couple of weeks, see a doctor', 'see a doctor (a GP or an ear,', 'see a doctor (a GP or an ear, nose', 'nose and throat specialist).', 'If it’s very painful,', 'If it’s very painful, or breathing', 'or breathing or swallowing is hard,', 'or swallowing is hard,', 'swallowing is hard, get help straight away.', 'get help straight away.', 'or swallowing is hard, get help straight away.']
  out.doc = cands.map((s) => m("400 40px 'Inter'", s))
  out.docAuto = L.TURN.breakLines(document.querySelector('svg') || (() => { const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); document.body.appendChild(s); return s })(), D, { size: 40, family: 'inter', width: 700 })
  return out
}
