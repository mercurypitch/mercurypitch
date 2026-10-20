// ============================================================
// Lesson stage fit — a stuck stage's figure takes the room its toy leaves
// ============================================================
//
// Beside the text the figure stage is sticky under the masthead, and a
// landscape tablet in its browser, or a laptop's window, can leave less room
// than a toy needs: its lowest controls then stayed below the fold for as
// long as their step showed. The stylesheet knows the room (`--stage-room`,
// lesson-stage.css). Only the page knows how much of the stage is not the
// figure: the head, the figure's label and status line, and the rows of
// controls as they wrap at this width. `fitStage` measures that, the stage's
// chrome, and hands it to the stylesheet as `--stage-chrome`, which caps the
// figure at what is left, down to a 180 px floor.
//
// The chrome is read with both caps lifted, the figure at its own height,
// and the caps go back in the same task, so nothing paints in between and a
// cap never feeds into the next reading.

const CHROME = '--stage-chrome'
const MEASURING = 'is-measuring'

/** The stage card's height less its figure's, px, both uncapped; null for a toy with no figure. */
export function stageChrome(stage: HTMLElement): number | null {
  const card = stage.querySelector('.stage-card')
  const figure = stage.querySelector('.toy.is-active .viz')
  if (card === null || figure === null) return null
  stage.classList.add(MEASURING)
  const chrome =
    card.getBoundingClientRect().height - figure.getBoundingClientRect().height
  stage.classList.remove(MEASURING)
  return Math.ceil(chrome)
}

/**
 * Writes the active toy's chrome to the stage. The deck's stage scrolls with
 * the page and sizes its figure by the screen alone, so there it is cleared.
 */
export function fitStage(stage: HTMLElement, deck: boolean): void {
  const chrome = deck ? null : stageChrome(stage)
  const value = chrome === null ? '' : `${chrome}px`
  if (stage.style.getPropertyValue(CHROME) === value) return
  if (value === '') stage.style.removeProperty(CHROME)
  else stage.style.setProperty(CHROME, value)
}

/**
 * Fits the stage again whenever a toy's box changes: the stage grows wider,
 * a font arrives, a toy's content changes. The observer only books the fit
 * for the next frame, since a fit made inside its callback would resize the
 * toys it watches in that same frame (a "ResizeObserver loop" error).
 */
export function watchStageFit(stage: HTMLElement, deck: () => boolean): void {
  let frame = 0
  const refit = new ResizeObserver(() => {
    if (frame !== 0) return
    frame = requestAnimationFrame(() => {
      frame = 0
      fitStage(stage, deck())
    })
  })
  stage.querySelectorAll('.toy').forEach((toy) => refit.observe(toy))
}
