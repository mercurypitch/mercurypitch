// ============================================================
// Season 2 figures — the drawings its explorer cards carry
// ============================================================
//
// The card figures Season 2's lessons name that the kit's explorer does
// not draw (explorer-figures.ts `cardFigure`), loaded with Season 2's data,
// so a Season 1 page carries none until its Season 2 tab opens. Lesson
// 17's is a bar of four quarter notes on one line over Lesson 8's four beat
// pads, as its rhythm bar writes them, the 4/4 at the line's start and no
// reading in seconds, so the card answers nothing (Lesson 17 WEB-SPEC,
// Explorer and season data). Its look is its own <style>, whose rules only
// its marks meet, since no stylesheet loads with the data.

import type { SeasonFigures } from './season'

const RHYTHM_STYLE =
  '.ex-rhythm .line{stroke:rgba(195,204,214,.62);stroke-width:1.6px}' +
  '.ex-rhythm rect{fill:rgba(195,204,214,.04);stroke:var(--hair-2)}' +
  '.ex-rhythm ellipse{fill:var(--ink)}' +
  '.ex-rhythm .stem{stroke:var(--ink);stroke-width:1.8px;stroke-linecap:round}' +
  '.ex-rhythm text{fill:var(--chrome);font:600 18px/1 var(--f-display);text-anchor:middle}' +
  '.ex-rhythm .metre{fill:var(--ink);font-size:17px;font-weight:700}'

/** Four quarter notes on one line over four numbered pads, the 4/4 before them. */
export function rhythmSVG(): string {
  let beats = ''
  for (let b = 0; b < 4; b++) {
    const x = 28 + b * 45
    const head = x + 12
    beats += `<rect x="${x}" y="6" width="41" height="92" rx="9"/><ellipse cx="${head}" cy="40" rx="6.1" ry="4.6" transform="rotate(-22 ${head} 40)"/><path class="stem" d="M${head + 5.4} 39V12"/><text x="${x + 20.5}" y="86">${b + 1}</text>`
  }
  return `<svg class="ex-rhythm" viewBox="0 0 210 104" aria-hidden="true"><style>${RHYTHM_STYLE}</style><path class="line" d="M4 40H206"/><text class="metre" x="14" y="36">4</text><text class="metre" x="14" y="56">4</text>${beats}</svg>`
}

export const SEASON_2_FIGURES: SeasonFigures = {
  rhythm: () =>
    `${rhythmSVG()}<figcaption>A bar of four quarter notes, written over Lesson 8's beat pads</figcaption>`,
}
