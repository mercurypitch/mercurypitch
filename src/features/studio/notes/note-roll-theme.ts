// ============================================================
// Studio note roll theme — the roll's colours read from the editor's stylesheet, so the canvas follows the Studio's tokens, its theme and the lane's hue
// ============================================================
//
// The colours live in StudioNoteEditor.module.css as custom properties on
// the editor (--roll-*), built from the Studio's tokens and the lane's
// colour (--studio-track), dark and light. A canvas cannot read a custom
// property, so each is resolved through a hidden probe's `color`, which
// gives a colour the canvas takes. It is read again when the theme or the
// lane's colour changes, never on a draw.
import type { StudioRollTheme } from './note-roll-draw'

/** Each colour of the theme and the custom property that holds it. */
const TOKENS: Readonly<Record<Exclude<keyof StudioRollTheme, 'font'>, string>> =
  {
    background: '--roll-background',
    rowShade: '--roll-row-shade',
    gridLine: '--roll-grid-line',
    gridBeat: '--roll-grid-beat',
    gridBar: '--roll-grid-bar',
    dim: '--roll-dim',
    keyWhite: '--roll-key-white',
    keyBlack: '--roll-key-black',
    keyLine: '--roll-key-line',
    keyLabel: '--roll-key-label',
    kitRow: '--roll-kit-row',
    kitShade: '--roll-kit-shade',
    kitText: '--roll-kit-text',
    ruler: '--roll-ruler',
    rulerText: '--roll-ruler-text',
    divider: '--roll-divider',
    note: '--roll-note',
    noteTop: '--roll-note-top',
    noteRing: '--roll-note-ring',
    noteText: '--roll-note-text',
    noteGlow: '--roll-note-glow',
    selection: '--roll-selection',
    marquee: '--roll-marquee',
    playhead: '--roll-playhead',
    playheadGlow: '--roll-playhead-glow',
    velocity: '--roll-velocity',
    muted: '--roll-muted',
  }

/** The roll's theme as the element `host` sees it, through a probe placed inside it for the read. */
export function readStudioRollTheme(host: HTMLElement): StudioRollTheme {
  const probe = document.createElement('span')
  probe.setAttribute('aria-hidden', 'true')
  probe.style.position = 'absolute'
  probe.style.visibility = 'hidden'
  host.append(probe)
  try {
    const colours = Object.fromEntries(
      Object.entries(TOKENS).map(([key, token]) => {
        probe.style.color = `var(${token})`
        return [key, globalThis.getComputedStyle(probe).color]
      }),
    ) as Omit<StudioRollTheme, 'font'>
    const font = globalThis.getComputedStyle(host).fontFamily || 'sans-serif'
    return { ...colours, font }
  } finally {
    probe.remove()
  }
}

/** The custom properties the theme reads, for the stylesheet's test. */
export const STUDIO_ROLL_THEME_TOKENS: readonly string[] = Object.values(TOKENS)
