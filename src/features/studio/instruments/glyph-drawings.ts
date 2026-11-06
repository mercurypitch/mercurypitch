// ============================================================
// Instrument glyph drawings — the SVG inside each glyph's 24-unit frame
// ============================================================
//
// Data only: no runtime imports, so scripts/instrument-glyph-sheet.mjs loads
// this file as it is to draw the contact sheet. Each value is the markup inside
// <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
// stroke-linecap="round" stroke-linejoin="round">, drawn to the rules in
// docs/studio-instrument-glyphs.md: 1 unit clear at every edge, centred on
// (12, 12), solid where a counter would close below 2 units. `$k` stands for
// the glyph's own mask id, made unique per drawing (InstrumentGlyph.tsx).
// Parts marked data-fine are detail that drops out at 16 px. The comment over
// each glyph says what it draws and what it is drawn to avoid reading as.
import type { InstrumentGlyphId } from '@/lib/studio/instruments/glyph-catalog'

export const INSTRUMENT_DRAWINGS: Readonly<Record<InstrumentGlyphId, string>> =
  {
    // A handheld vocal mic, upright. The ball's seam curves as seen from a little above, so it reads as a grille, never as a sign.
    mic: '<g transform="translate(0 0.25)"><circle cx="12" cy="7" r="5"/><path d="M7 7c3 1.9 7 1.9 10 0"/><path d="M9.3 11.2 10.9 20.4a1.1 1.1 0 0 0 2.2 0l1.6-9.2"/></g>',
    // Two mics, the second behind the first (the people-icon convention for more than one), knocked out where they overlap.
    mics: '<g transform="translate(-0.2 0.15)"><defs><mask id="$k" maskUnits="userSpaceOnUse" x="-6" y="-6" width="36" height="36"><rect x="-6" y="-6" width="36" height="36" fill="#fff" stroke="none"/><circle cx="9.2" cy="9.2" r="6.4" fill="#000" stroke="none"/><path d="M6.8 12.9 8.3 20.8a.9.9 0 0 0 1.8 0l1.5-7.9" fill="#000" stroke="#000" stroke-width="4.5"/></mask></defs><g mask="url(#$k)"><circle cx="15.6" cy="6" r="4"/><path data-fine="" d="M11.6 6c2.4 1.6 5.6 1.6 8 0"/><path d="M13.4 9.3 14.8 17.4a.8.8 0 0 0 1.6 0l1.4-8.1"/></g><circle cx="9.2" cy="9.2" r="4.4"/><path d="M4.8 9.2c2.6 1.7 6.2 1.7 8.8 0"/><path d="M6.8 12.9 8.3 20.8a.9.9 0 0 0 1.8 0l1.5-7.9"/></g>',
    // Three singers, the front one in the middle and two behind, knocked out where it passes.
    choir:
      '<g transform="translate(0 -.75)"><defs><mask id="$k" maskUnits="userSpaceOnUse" x="-6" y="-6" width="36" height="36"><rect x="-6" y="-6" width="36" height="36" fill="#fff" stroke="none"/><circle cx="12" cy="10" r="4.6" fill="#000" stroke="none"/><path d="M5.5 22v-2.5a4.5 4.5 0 0 1 4.5-4.5h4a4.5 4.5 0 0 1 4.5 4.5V22Z" fill="#000" stroke="#000" stroke-width="3.5"/></mask></defs><g mask="url(#$k)"><circle cx="5.6" cy="6.6" r="2.6"/><path d="M2 16v-1a3.4 3.4 0 0 1 3.4-3.4h.4a3.4 3.4 0 0 1 3.4 3.4"/><circle cx="18.4" cy="6.6" r="2.6"/><path d="M22 16v-1a3.4 3.4 0 0 0-3.4-3.4h-.4a3.4 3.4 0 0 0-3.4 3.4"/></g><circle cx="12" cy="10" r="3"/><path d="M6.5 21.5v-2a4 4 0 0 1 4-4h3a4 4 0 0 1 4 4v2"/></g>',
    // A grand from above: the bentside curve is the silhouette, the keys run along the front.
    'grand-piano':
      '<path d="M3.5 21V9.5C3.5 5.6 6.3 3 9.7 3c2.6 0 4.1 1.4 5 3.1.8 1.5 1.9 2.4 3.4 2.9 1.5.5 2.4 1.8 2.4 3.4V21Z"/><path d="M3.5 16.5h17"/><path d="M12 16.5V21"/><path data-fine="" d="M7.75 16.5V21M16.25 16.5V21"/>',
    // A stage piano: keys only, the black keys solid in their two-then-one rhythm.
    keyboard:
      '<rect x="2.5" y="6" width="19" height="12" rx="2.5"/><rect x="5.25" y="6" width="2.1" height="6.6" rx="0.5" fill="currentColor" stroke="none"/><rect x="9.05" y="6" width="2.1" height="6.6" rx="0.5" fill="currentColor" stroke="none"/><rect x="16.65" y="6" width="2.1" height="6.6" rx="0.5" fill="currentColor" stroke="none"/><path d="M6.3 12.6V18M10.1 12.6V18M13.9 6V18M17.7 12.6V18"/>',
    // A synth: short keys under a panel of two knobs and a slider.
    'synth-keys':
      '<rect x="2.5" y="5.5" width="19" height="13" rx="2.5"/><path d="M2.5 10.6h19"/><path d="M13.7 10.6V18.5"/><path d="M6.1 14.6V18.5M9.9 14.6V18.5M17.5 14.6V18.5"/><rect x="5.15" y="10.6" width="1.9" height="4.2" rx=".5" fill="currentColor" stroke="none"/><rect x="8.95" y="10.6" width="1.9" height="4.2" rx=".5" fill="currentColor" stroke="none"/><rect x="16.55" y="10.6" width="1.9" height="4.2" rx=".5" fill="currentColor" stroke="none"/><circle cx="6.1" cy="8.05" r="1.1" fill="currentColor" stroke="none"/><circle data-fine="" cx="9.7" cy="8.05" r="1.1" fill="currentColor" stroke="none"/><path data-fine="" d="M13.4 8.05h4.6"/>',
    // Two manuals, the upper one set back. Drawbars over them read as candles on a cake.
    organ:
      '<g transform="translate(0 0.25)"><rect x="5" y="5" width="14" height="5.5" rx="1.5"/><rect x="7.7" y="5" width="1.6" height="3" rx="0.5" fill="currentColor" stroke="none"/><rect x="10.5" y="5" width="1.6" height="3" rx="0.5" fill="currentColor" stroke="none"/><rect x="14.7" y="5" width="1.6" height="3" rx="0.5" fill="currentColor" stroke="none"/><rect x="2.5" y="12.5" width="19" height="6" rx="1.5"/><rect x="5.4" y="12.5" width="1.8" height="3.3" rx="0.5" fill="currentColor" stroke="none"/><rect x="9.2" y="12.5" width="1.8" height="3.3" rx="0.5" fill="currentColor" stroke="none"/><rect x="16.8" y="12.5" width="1.8" height="3.3" rx="0.5" fill="currentColor" stroke="none"/></g>',
    // Pipes rising to a peak from the console, so they never read as level bars.
    'pipe-organ':
      '<g transform="translate(0 -0.25)"><path d="M4 13V9M8 13V6.5M12 13V3.5M16 13V6.5M20 13V9"/><rect x="2.5" y="13" width="19" height="8" rx="2"/><path d="M2.5 17h19"/></g>',
    // The keyboard board with its keys, three bellows panels and the button board.
    accordion:
      '<rect x="15" y="3" width="6.5" height="18" rx="1.5"/><rect x="15" y="5.6000000000000005" width="3.4" height="1.6" rx=".5" fill="currentColor" stroke="none"/><rect x="15" y="9.299999999999999" width="3.4" height="1.6" rx=".5" fill="currentColor" stroke="none"/><rect x="15" y="13.1" width="3.4" height="1.6" rx=".5" fill="currentColor" stroke="none"/><rect x="15" y="16.8" width="3.4" height="1.6" rx=".5" fill="currentColor" stroke="none"/><path d="M15 6.5 11 4.5 7 6.5l-4.5-2v15L7 17.5l4 2 4-2"/><path d="M7 6.5v11M11 4.5v15"/>',
    // Figure-eight body, an open sound hole, a one-stroke neck and a solid head, on the diagonal.
    'acoustic-guitar':
      '<g transform="rotate(45 12 12)"><path d="M9.31 13.47A3.4 3.4 0 1 1 14.69 13.47 4.6 4.6 0 1 1 9.31 13.47Z"/><circle cx="12" cy="15.4" r="1.45"/><path d="M12 8V3.4"/><rect x="10.5" y="-.2" width="3" height="4" rx="1" fill="currentColor" stroke="none"/></g>',
    // An offset double-cutaway body with two horns, a pickup, the bridge and a hooked head.
    'electric-guitar':
      '<g transform="translate(0 -.5) rotate(45 12 12)"><path d="M10.7 12.4C10.4 10.9 9.7 9.4 8.6 9.1 7.6 8.9 7.2 9.9 7.4 11.1 7.6 12.3 8.3 13.4 8 14.6 7.7 15.8 6.7 16.6 6.7 18.4 6.7 20.9 9 22.3 12 22.3S17.3 20.9 17.3 18.4C17.3 16.8 16.3 16 16 14.9 15.7 13.8 16.4 12.8 16.2 11.7 16 10.6 15.1 10.4 14.4 10.9 13.9 11.3 13.5 11.9 13.3 12.4"/><path d="M12 12.4V3.2"/><path d="M10.4 16.4h3.2"/><path data-fine="" d="M10.6 19.4h2.8"/><path d="M11.1 3.4 10.9.6C10.9-.1 11.3-.5 11.9-.6L13.6-.8C14.3-.8 14.5-.3 14.2.3L12.9 3.4Z" fill="currentColor" stroke="none"/></g>',
    // A round drum body with no waist, a bridge across the head and a long neck.
    banjo:
      '<g transform="rotate(45 12 12)"><circle cx="12" cy="16.2" r="5.4"/><path d="M10.2 17.8h3.6"/><path d="M12 10.8V3.4"/><rect x="10.5" y="-.2" width="3" height="4" rx="1" fill="currentColor" stroke="none"/><circle data-fine="" cx="13.9" cy="7.6" r=".9" fill="currentColor" stroke="none"/></g>',
    // A pointed pear and the pegbox bent sharply back: sitar, oud, mandolin and shamisen.
    lute: '<g transform="translate(0.1 -0.45)"><g transform="translate(-.5 -.9) rotate(45 12 12)"><path d="M12 8.4C14 10 17.4 13.2 17.4 16.8 17.4 19.7 15 21.8 12 21.8S6.6 19.7 6.6 16.8C6.6 13.2 10 10 12 8.4Z"/><circle cx="12" cy="15.6" r="1.3"/><path d="M10.2 18.8h3.6" data-fine=""/><path d="M12 8.4V3.6"/><path d="M11.2 4.6 15.8 2.2a1.1 1.1 0 0 1 1 2l-4.8 2.4Z" fill="currentColor" stroke="none"/></g></g>',
    // The swan-neck S, the pillar, the soundboard and two strings between.
    harp: '<g transform="translate(0.3 -0.4)"><g transform="translate(-.3 .2)"><path d="M6.5 21V4.6"/><path d="M6.5 4.6C9 2.4 11.6 3.6 13.4 6c1.6 2.1 3.8 2.7 6.1.8"/><path d="M7.8 21 19.5 6.8"/><path d="M10.5 3.9v13.8M14.5 7.1v5.8"/><path d="M4.5 21h5"/></g></g>',
    // A trapezoid box with a string and its sound hole: koto, dulcimer, zither.
    zither:
      '<path d="M7 4.5h10l4.5 15h-19Z"/><path d="M5.6 9.3h12.8"/><circle cx="12" cy="14.6" r="2.2"/>',
    // The guitar's family told apart by a neck half as long again and pegs along its head.
    'electric-bass':
      '<g transform="translate(0.65 0)"><g transform="translate(-.3 .3) rotate(45 12 12)"><path d="M10.9 15.6C10.4 14.6 9.6 14 8.9 14 8.1 14 7.8 15 8.1 16 8.4 17 7.6 17.9 7.6 19.5 7.6 21.7 9.4 22.8 12 22.8S16.4 21.7 16.4 19.7C16.4 18.2 15.6 17.5 15.8 16.6 16 15.7 15.6 15.2 15 15.3 14.3 15.5 13.8 15.9 13.4 16.3"/><path d="M12 16V2.8"/><path d="M10.6 19.8h2.8"/><rect x="10.8" y="-1" width="2.4" height="4.6" rx="1" fill="currentColor" stroke="none"/><circle cx="9.4" cy=".3" r=".95" fill="currentColor" stroke="none"/><circle cx="9.4" cy="2.7" r=".95" fill="currentColor" stroke="none"/></g></g>',
    // Sloped shoulders with real bouts, the scroll on top and the endpin under it.
    'upright-bass':
      '<path d="M12 7.4C13.7 7.7 15.2 9 15.6 10.8 15.8 11.8 14.8 12.4 14.8 13.4 14.8 14.4 17.4 15 17.4 17.5 17.4 19.4 15.2 20.4 12 20.4S6.6 19.4 6.6 17.5C6.6 15 9.2 14.4 9.2 13.4 9.2 12.4 8.2 11.8 8.4 10.8 8.8 9 10.3 7.7 12 7.4Z"/><path d="M12 7.4V3.7"/><circle cx="12" cy="2.4" r="1.4" fill="currentColor" stroke="none"/><path d="M12 20.4V22"/><rect data-fine="" x="9.6" y="15.3" width="1.2" height="3" rx=".6" fill="currentColor" stroke="none"/><rect data-fine="" x="13.2" y="15.3" width="1.2" height="3" rx=".6" fill="currentColor" stroke="none"/>',
    // A slow square wave over a low baseline.
    'synth-bass':
      '<g transform="translate(0 -1)"><path d="M2.5 14.5h3.75V6.5h5.75v8h5.75v-8h3.75"/><path d="M2.5 19.5h19"/></g>',
    // Upright: C-bouts, f-holes, a solid scroll. On the diagonal it read as a guitar; every bow across it read as disabled.
    violin:
      '<path d="M12 7.6C14.6 7.6 16.3 8.7 16.3 10.6 16.3 11.6 15.8 12.2 15.4 12.6 14.5 13.3 14.4 14.6 15.4 15.2 16.6 16 17.3 17 17.3 18.5 17.3 20.6 15 21.9 12 21.9 9 21.9 6.7 20.6 6.7 18.5 6.7 17 7.4 16 8.6 15.2 9.6 14.6 9.5 13.3 8.6 12.6 8.2 12.2 7.7 11.6 7.7 10.6 7.7 8.7 9.4 7.6 12 7.6Z"/><path d="M12 7.6V4.2"/><circle cx="12" cy="2.7" r="1.5" fill="currentColor" stroke="none"/><rect x="9.45" y="16.1" width="1.3" height="3.6" rx=".65" fill="currentColor" stroke="none"/><rect x="13.25" y="16.1" width="1.3" height="3.6" rx=".65" fill="currentColor" stroke="none"/>',
    // Broader and lower than the violin, standing on its endpin.
    cello:
      '<g transform="translate(0 -0.4)"><path d="M12 7.2c3.4 0 5.4 1.3 5.4 3.4 0 1-.5 1.6-1 2-.9.7-1 1.8-.1 2.4 1.5.9 2.3 2 2.3 3.4 0 1.9-2.6 2.9-6.6 2.9s-6.6-1-6.6-2.9c0-1.4.8-2.5 2.3-3.4.9-.6.8-1.7-.1-2.4-.5-.4-1-1-1-2 0-2.1 2-3.4 5.4-3.4Z"/><path d="M12 7.2V4"/><circle cx="12" cy="2.7" r="1.3" fill="currentColor" stroke="none"/><path d="M12 21.3V22.4"/><rect data-fine="" x="9.2" y="15.2" width="1.2" height="3" rx=".6" fill="currentColor" stroke="none"/><rect data-fine="" x="13.6" y="15.2" width="1.2" height="3" rx=".6" fill="currentColor" stroke="none"/></g>',
    // Three pistons with their finger buttons (what says trumpet, not bugle), the slide below, the bell flaring right.
    trumpet:
      '<g transform="translate(0.2 -0.25)"><path d="M2 9v3"/><path d="M2 10.5h12.6"/><path d="M14.6 10.5c2.8-.4 5.1-2.1 7-4.6V18.6c-1.9-2.5-4.2-4.2-7-4.6"/><path d="M14.6 14H7.4A2.4 2.4 0 0 1 5 11.6"/><path d="M7.6 10.5V8.4M11 10.5V8.4M14.4 10.5V8.4"/><circle cx="7.6" cy="6.9" r="1.15" fill="currentColor" stroke="none"/><circle cx="11" cy="6.9" r="1.15" fill="currentColor" stroke="none"/><circle cx="14.4" cy="6.9" r="1.15" fill="currentColor" stroke="none"/></g>',
    // The bell over a long slide whose crook runs out past it, and no valves.
    trombone:
      '<g transform="translate(-0.25 -0.25)"><g transform="translate(.5 1.2) scale(.94) translate(.3 0)"><path d="M13.2 7.5c3-.2 5.5-1.4 8.3-3.5v7c-2.8-2.1-5.3-3.3-8.3-3.5"/><path d="M13.2 7.5H5a3 3 0 0 0 0 6h15.2a2.25 2.25 0 0 1 0 4.5H9"/><path d="M10.5 7.5v6"/><path d="M9 16.5v3"/></g></g>',
    // The trumpet stood on end and broadened: bell up, a round bow at the foot, two valves.
    tuba: '<g transform="translate(0 0.85)"><path d="M10 9.5c-.4-2.9-2-5.2-4.5-7h13c-2.5 1.8-4.1 4.1-4.5 7"/><path d="M10 9.5v6.3a4 4 0 0 0 8 0V12"/><path d="M14 9.5V18"/><path d="M10 12H7.8M10 15H7.8" data-fine=""/><circle cx="6.6" cy="12" r="1.15" fill="currentColor" stroke="none"/><circle cx="6.6" cy="15" r="1.15" fill="currentColor" stroke="none"/></g>',
    // The round coil with the trumpet's bell tipped down out of it, the leadpipe running in at the top.
    'french-horn':
      '<g transform="translate(-0.15 0.3)"><circle cx="8.4" cy="11" r="5.6"/><path d="M13.2 13.8c2.9 1.1 5.9.8 8.8-1L19 20.6c-1.9-2.5-4.4-3.9-7.3-4.4"/><path d="M5.6 6.2 4.2 2.8M6.1 3.2H2.3"/></g>',
    // Crook and mouthpiece, a J body widening to the bow, a flared bell and key cups.
    saxophone:
      '<g transform="translate(-0.5 -0.15)"><path d="M4.2 3.4C6.2 2.2 8.8 2.4 9.9 4.6"/><path d="M8 4.6V15.6C8 19.2 10.4 21.6 13.4 21.6S18.6 19.4 18.8 16.2L20.8 10.6H14.8L15.2 15.4C15.4 17.2 14.6 18 13.4 18S11.4 17.2 11.4 15.6V4.6"/><circle cx="9.7" cy="8.4" r=".95" fill="currentColor" stroke="none"/><circle cx="9.7" cy="11.6" r=".95" fill="currentColor" stroke="none"/><circle data-fine="" cx="9.7" cy="14.8" r=".95" fill="currentColor" stroke="none"/></g>',
    // Held at a slant: a solid tube with its holes knocked out, a beak and a small bell.
    clarinet:
      '<g transform="translate(-1.05 -0.7)"><g transform="translate(-1.1 -.4) rotate(-22 12 12) scale(.96) translate(.5 .5)"><defs><mask id="$k" maskUnits="userSpaceOnUse" x="-6" y="-6" width="36" height="36"><rect x="-6" y="-6" width="36" height="36" fill="#fff" stroke="none"/><circle cx="12" cy="9.6" r="1.05" fill="#000" stroke="none"/><circle cx="12" cy="12.8" r="1.05" fill="#000" stroke="none"/><circle cx="12" cy="16" r="1.05" fill="#000" stroke="none"/></mask></defs><path mask="url(#$k)" d="M12 6.6V18.6" stroke-width="4"/><path d="M10.9 6.2 11.3 2.4a.7.7 0 0 1 1.4 0l.4 3.8Z" fill="currentColor" stroke="none"/><path d="M10 18.6c0 1.6-1.1 2.6-2.4 3.3h8.8c-1.3-.7-2.4-1.7-2.4-3.3"/></g></g>',
    // A solid tube on the diagonal, because an outline closes up, its holes and lip plate knocked out large enough to survive 16 px.
    flute:
      '<defs><mask id="$k" maskUnits="userSpaceOnUse" x="-6" y="-6" width="36" height="36"><rect x="-6" y="-6" width="36" height="36" fill="#fff" stroke="none"/><circle cx="8.3" cy="15.7" r="1.1" fill="#000" stroke="none"/><circle cx="10.9" cy="13.1" r="1.1" fill="#000" stroke="none"/><circle cx="13.5" cy="10.5" r="1.1" fill="#000" stroke="none"/><ellipse cx="18" cy="6" rx="1.4" ry=".9" transform="rotate(-45 18 6)" fill="#000" stroke="none"/></mask></defs><path mask="url(#$k)" d="M3.4 20.6 20.6 3.4" stroke-width="4.4"/>',
    // A row of tubes, tops level, stepping shorter to the right.
    'pan-flute':
      '<path d="M4 4h16v7h-4v3h-4v3H8v3H4Z"/><path d="M8 4v13M12 4v10M16 4v7"/>',
    // A sweet-potato vessel, a square mouthpiece on top, holes along it.
    ocarina:
      '<g transform="translate(-0.35 0.35)"><g transform="translate(0 .8)"><path d="M9.5 8.2C12 6.8 15 6.7 17.6 7.8c2.8 1.2 4.2 3.4 3.7 5.6-.6 2.7-3.9 4.4-8.1 4.1C9 17.2 5.3 15.6 3.6 12.9c-.7-1.1 0-2.3 1.2-2.6Z"/><path d="M9.5 8.2 8.6 4.8a.8.8 0 0 0-1-.6l-2.3.6a.8.8 0 0 0-.6 1l1.2 4.2"/><circle cx="11.6" cy="11.2" r="1" fill="currentColor" stroke="none"/><circle cx="14.6" cy="10.4" r="1" fill="currentColor" stroke="none"/><circle cx="17.6" cy="10.8" r="1" fill="currentColor" stroke="none"/></g></g>',
    // A bag, three drones over it and the chanter falling straight down with its flare.
    bagpipe:
      '<g transform="translate(-1.7 0.2)"><path d="M8.6 13.4c0-3 2.8-5.1 6.4-5.1s6.4 2.2 6.4 5.1-2.9 5.3-6.5 5.3-6.3-2.2-6.3-5.3Z"/><path d="M11.4 9.3 6.6 3.4M14.6 8.4l-3.8-5.6M17.8 8.8 15 3"/><circle cx="6.3" cy="3" r="1.3" fill="currentColor" stroke="none"/><circle cx="10.6" cy="2.4" r="1.3" fill="currentColor" stroke="none"/><circle cx="14.8" cy="2.6" r="1.3" fill="currentColor" stroke="none"/><path d="M10.5 17.4v4M9 21.5h3"/></g>',
    // Covers and a comb of square holes, set at a slant so it is never a password field.
    harmonica:
      '<g transform="rotate(-18 12 12)"><rect x="2.5" y="7.5" width="19" height="9" rx="2"/><path d="M2.5 11h19"/><rect x="4.9" y="12.6" width="2.2" height="2" rx=".4" fill="currentColor" stroke="none"/><rect x="8.9" y="12.6" width="2.2" height="2" rx=".4" fill="currentColor" stroke="none"/><rect x="12.9" y="12.6" width="2.2" height="2" rx=".4" fill="currentColor" stroke="none"/><rect x="16.9" y="12.6" width="2.2" height="2" rx=".4" fill="currentColor" stroke="none"/></g>',
    // Bars falling in length, and one mallet clear of them.
    mallets:
      '<g transform="translate(-0.3 -0.4)"><g transform="translate(-.5 -.6)"><rect x="3.1" y="4" width="2.8" height="16" rx="1.4" fill="currentColor" stroke="none"/><rect x="7.1" y="5.5" width="2.8" height="13" rx="1.4" fill="currentColor" stroke="none"/><rect x="11.1" y="7" width="2.8" height="10" rx="1.4" fill="currentColor" stroke="none"/><path d="M15.5 21 19.8 9.5"/><circle cx="20.3" cy="7.2" r="2.2" fill="currentColor" stroke="none"/></g></g>',
    // A hand bell rung on its handle, the clapper at its rim.
    bells:
      '<g transform="translate(-0.45 0.05)"><g transform="translate(-1.6 .3) rotate(-22 12 12)"><rect x="10.6" y="1.4" width="2.8" height="5.2" rx="1.2" fill="currentColor" stroke="none"/><path d="M12 6.6c-3.2 0-4.6 2.6-4.8 5.8-.2 2.9-1.1 4.6-2.4 5.6h14.4c-1.3-1-2.2-2.7-2.4-5.6-.2-3.2-1.6-5.8-4.8-5.8Z"/><circle cx="12" cy="20.4" r="1.5" fill="currentColor" stroke="none"/></g></g>',
    // Tines held under a clamp bar, their tips falling in a V.
    kalimba:
      '<path d="M3 6.5A3.5 3.5 0 0 1 6.5 3h11A3.5 3.5 0 0 1 21 6.5v8.2a6.3 6.3 0 0 1-6.3 6.3H9.3A6.3 6.3 0 0 1 3 14.7Z"/><rect x="5.75" y="5.6" width="1.5" height="6" rx=".75" fill="currentColor" stroke="none"/><rect x="8.5" y="5.6" width="1.5" height="8.5" rx=".75" fill="currentColor" stroke="none"/><rect x="11.25" y="5.6" width="1.5" height="11" rx=".75" fill="currentColor" stroke="none"/><rect x="14" y="5.6" width="1.5" height="8.5" rx=".75" fill="currentColor" stroke="none"/><rect x="16.75" y="5.6" width="1.5" height="6" rx=".75" fill="currentColor" stroke="none"/><path d="M5 8.3h14"/>',
    // The pan from a little above, its sunken middle, one stick with its rubber tip.
    'steel-drum':
      '<g transform="translate(0.55 -0.85)"><g transform="translate(0 .4)"><ellipse cx="11" cy="8" rx="8.5" ry="3.9"/><ellipse cx="11" cy="8.8" rx="4" ry="1.6"/><path d="M2.5 8v3.2c0 2.2 3.8 3.9 8.5 3.9s8.5-1.7 8.5-3.9V8"/><path d="M13 20.8 18.6 16.6"/><circle cx="19.8" cy="15.7" r="1.6" fill="currentColor" stroke="none"/></g></g>',
    // A kettle on short legs with its tuning lugs, which no grill has.
    timpani:
      '<g transform="translate(0 -0.5)"><g transform="translate(0 -.2)"><ellipse cx="12" cy="7.4" rx="8.5" ry="2.6"/><path d="M3.5 7.4c0 5.4 3.8 9.3 8.5 9.3s8.5-3.9 8.5-9.3"/><path d="M7 10.6v2.4M12 11.2v2.6M17 10.6v2.4"/><path d="M8.2 15.9 6.8 20.6M15.8 15.9l1.4 4.7"/></g></g>',
    // A snare from a little above with two sticks, the sign people read as drums. A whole kit at 20 px read as a face.
    drums:
      '<ellipse cx="12" cy="12" rx="8.4" ry="3.4"/><path d="M3.6 12v5.4c0 1.9 3.8 3.4 8.4 3.4s8.4-1.5 8.4-3.4V12"/><path data-fine="" d="M7.6 15.2v5M16.4 15.2v5"/><path d="M5.2 3.2 11 9.2M18.8 3.2 13 9.2"/>',
    // The big front head, closed all round, on its spurs, the pedal's beater in front.
    kick: '<g transform="translate(0 -0.25)"><circle cx="12" cy="10.5" r="7.5"/><path d="M6.9 16 4.5 20.5M17.1 16l2.4 4.5"/><path d="M12 21.5v-5.6"/><circle cx="12" cy="14.6" r="2.1" fill="currentColor" stroke="none"/></g>',
    // A snare from the side, its wires under the bottom head.
    snare:
      '<g transform="translate(0 -1.2)"><ellipse cx="12" cy="8" rx="8.5" ry="3"/><path d="M3.5 8v6c0 1.7 3.8 3 8.5 3s8.5-1.3 8.5-3V8"/><path data-fine="" d="M8 10.8v6M16 10.8v6"/><path d="M5 20.5c1.2-1.2 2.3-1.2 3.5 0s2.3 1.2 3.5 0 2.3-1.2 3.5 0 2.3 1.2 3.5 0"/></g>',
    // A rack tom up high, the floor tom below it on its legs.
    toms: '<g transform="translate(0.25 -0.25)"><defs><mask id="$k" maskUnits="userSpaceOnUse" x="-6" y="-6" width="36" height="36"><rect x="-6" y="-6" width="36" height="36" fill="#fff" stroke="none"/><path d="M8.5 11.3h13v11h-13Z" fill="#000" stroke="#000" stroke-width="2.5"/></mask></defs><g mask="url(#$k)"><ellipse cx="8" cy="5" rx="5.5" ry="2"/><path d="M2.5 5v4.2c0 1.1 2.5 2 5.5 2s5.5-.9 5.5-2V5"/></g><ellipse cx="15" cy="12" rx="6" ry="2.2"/><path d="M9 12v5.5c0 1.2 2.7 2.2 6 2.2s6-1 6-2.2V12"/><path data-fine="" d="M10.2 19 9.5 21.5M19.8 19l.7 2.5"/></g>',
    // Two cymbals closed together on their stand, the clutch above.
    'hi-hat':
      '<g transform="translate(0 -0.5)"><path d="M3 8.5c3-1.4 6-2 9-2s6 .6 9 2"/><path d="M3 10.5c3 1.4 6 2 9 2s6-.6 9-2"/><path d="M12 3v3.5M12 12.5v7"/><path d="M12 19.5 8 22M12 19.5l4 2.5"/></g>',
    // One tilted disc with its bell, on a stand.
    cymbal:
      '<g transform="translate(0 -1.25)"><ellipse cx="12" cy="7.5" rx="9" ry="2.6" transform="rotate(-10 12 7.5)"/><circle cx="12" cy="7.5" r="1" fill="currentColor" stroke="none"/><path d="M12 10.2v9.3"/><path d="M12 19.5 8 22M12 19.5l4 2.5"/></g>',
    // A tall barrel with its head and tuning lugs: conga, bongo, djembe, cajon.
    'hand-drum':
      '<g transform="translate(0 0.3)"><ellipse cx="12" cy="4.2" rx="5.2" ry="1.8"/><path d="M6.8 4.2c-1.6 4.5-1.4 9.6 1.4 14.4.4.8.6 1.6.7 2.4M17.2 4.2c1.6 4.5 1.4 9.6-1.4 14.4-.4.8-.6 1.6-.7 2.4"/><path d="M8.9 21h6.2"/><path data-fine="" d="M9.6 7.3v3.2M14.4 7.3v3.2"/></g>',
    // A pair of maracas in a V. One alone read as a magnifier.
    shaker:
      '<g transform="translate(0 -0.75)"><g transform="rotate(-15 8.5 21)"><ellipse cx="8.5" cy="8.4" rx="3.2" ry="4.2"/><path d="M8.5 12.6v8.2"/></g><g transform="rotate(15 15.5 21)"><ellipse cx="15.5" cy="8.4" rx="3.2" ry="4.2"/><path d="M15.5 12.6v8.2"/></g></g>',
    // Tilted, its frame deep enough to show three jingles.
    tambourine:
      '<g transform="translate(0 0.95)"><defs><mask id="$k" maskUnits="userSpaceOnUse" x="-6" y="-6" width="36" height="36"><rect x="-6" y="-6" width="36" height="36" fill="#fff" stroke="none"/><ellipse cx="6.4" cy="15.6" rx="2.6" ry="2.3" fill="#000" stroke="none"/><ellipse cx="12" cy="17.1" rx="2.6" ry="2.3" fill="#000" stroke="none"/><ellipse cx="17.6" cy="15.6" rx="2.6" ry="2.3" fill="#000" stroke="none"/></mask></defs><ellipse cx="12" cy="9" rx="9" ry="4.6"/><path mask="url(#$k)" d="M3 9v4c0 2.7 4 4.8 9 4.8s9-2.1 9-4.8V9"/><ellipse cx="6.4" cy="15.6" rx="1.6" ry="1.3" fill="currentColor" stroke="none"/><ellipse cx="12" cy="17.1" rx="1.6" ry="1.3" fill="currentColor" stroke="none"/><ellipse cx="17.6" cy="15.6" rx="1.6" ry="1.3" fill="currentColor" stroke="none"/></g>',
    // A flat-topped flaring bell on its loop, the clapper at its mouth.
    cowbell:
      '<path d="M8.5 6.5h7l2.5 12H6Z"/><path d="M10 6.5V5a2 2 0 0 1 4 0v1.5"/><circle cx="12" cy="20.6" r="1.5" fill="currentColor" stroke="none"/>',
    // A block with its slot, struck on top by a stick's tip.
    woodblock:
      '<g transform="translate(0 0.35)"><g transform="translate(0 1.4)"><rect x="2.5" y="10" width="19" height="8.5" rx="2.5"/><path d="M6.5 14.25h11"/><path d="M5 2 10.6 7.4"/><circle cx="11.6" cy="8.3" r="1.5" fill="currentColor" stroke="none"/></g></g>',
    // Open at one corner, its beater beside it.
    triangle:
      '<g transform="translate(-0.3 1)"><path d="M7 19.5h12.5L11.5 5 3.6 17.8"/><path d="M15.5 8.5 21 3"/><path data-fine="" d="M11.5 5V2.5"/></g>',
    // Two hands meeting, thumbs out, the moment marked above.
    clap: '<g transform="translate(0 -0.3)"><g transform="translate(12 12.6) scale(.92) translate(-12 -12)"><g transform="rotate(14 9 15)"><path d="M6.2 21.5V9.8a2.8 2.8 0 0 1 5.6 0v11.7"/><path d="M6.2 16.3 4.3 14a1.5 1.5 0 0 0-2.3 1.9l4.2 5"/></g><g transform="rotate(-14 15 15)"><path d="M17.8 21.5V9.8a2.8 2.8 0 0 0-5.6 0v11.7"/><path d="M17.8 16.3l1.9-2.3a1.5 1.5 0 0 1 2.3 1.9l-4.2 5"/></g><path d="M12 1.4v2.4M8.4 2.3l1 1.9M15.6 2.3l-1 1.9"/></g></g>',
    // A sawtooth: sharp teeth where the pad is calm.
    'synth-lead':
      '<g transform="translate(0.5 0)"><path d="M2.5 17 8.5 7v10l6-10v10l6-10v5"/></g>',
    // One sustained tone, a sine whose swell rises and falls.
    'synth-pad':
      '<g transform="translate(0 0.35)"><path d="M2.4 12C2.51 11.96 2.86 11.9 3.09 11.73C3.31 11.57 3.54 11.26 3.77 11C4 10.74 4.23 10.38 4.46 10.17C4.69 9.96 4.91 9.76 5.14 9.75C5.37 9.75 5.6 9.87 5.83 10.16C6.06 10.45 6.29 10.94 6.51 11.5C6.74 12.06 6.97 12.83 7.2 13.51C7.43 14.2 7.66 15.01 7.89 15.6C8.11 16.19 8.34 16.78 8.57 17.06C8.8 17.34 9.03 17.45 9.26 17.29C9.49 17.12 9.71 16.67 9.94 16.06C10.17 15.45 10.4 14.53 10.63 13.62C10.86 12.71 11.09 11.56 11.31 10.6C11.54 9.64 11.77 8.6 12 7.86C12.23 7.13 12.46 6.5 12.69 6.19C12.91 5.89 13.14 5.85 13.37 6.05C13.6 6.25 13.83 6.79 14.06 7.41C14.29 8.04 14.51 8.97 14.74 9.81C14.97 10.66 15.2 11.68 15.43 12.48C15.66 13.29 15.89 14.1 16.11 14.65C16.34 15.2 16.57 15.59 16.8 15.77C17.03 15.94 17.26 15.87 17.49 15.69C17.71 15.5 17.94 15.08 18.17 14.68C18.4 14.28 18.63 13.71 18.86 13.28C19.09 12.84 19.31 12.38 19.54 12.08C19.77 11.78 20 11.56 20.23 11.47C20.46 11.38 20.69 11.46 20.91 11.54C21.14 11.63 21.49 11.92 21.6 12"/></g>',
    // A riser: a wave that grows and quickens. Sparkles read as the app's own magic.
    'synth-fx':
      '<g transform="translate(0 0.3)"><path d="M2.5 12C2.57 11.93 2.76 11.74 2.9 11.6C3.03 11.46 3.16 11.3 3.29 11.16C3.42 11.02 3.56 10.88 3.69 10.76C3.82 10.64 3.95 10.52 4.08 10.44C4.22 10.35 4.35 10.29 4.48 10.26C4.61 10.23 4.74 10.23 4.88 10.27C5.01 10.31 5.14 10.39 5.27 10.5C5.4 10.61 5.53 10.76 5.67 10.94C5.8 11.12 5.93 11.34 6.06 11.58C6.19 11.81 6.33 12.08 6.46 12.34C6.59 12.6 6.72 12.89 6.85 13.14C6.99 13.4 7.12 13.66 7.25 13.88C7.38 14.1 7.51 14.3 7.65 14.44C7.78 14.58 7.91 14.68 8.04 14.72C8.17 14.75 8.31 14.73 8.44 14.64C8.57 14.55 8.7 14.39 8.83 14.18C8.97 13.97 9.1 13.68 9.23 13.36C9.36 13.05 9.49 12.66 9.63 12.27C9.76 11.89 9.89 11.45 10.02 11.05C10.15 10.65 10.28 10.22 10.42 9.87C10.55 9.52 10.68 9.18 10.81 8.94C10.94 8.7 11.08 8.51 11.21 8.43C11.34 8.36 11.47 8.36 11.6 8.48C11.74 8.59 11.87 8.82 12 9.13C12.13 9.43 12.26 9.86 12.4 10.32C12.53 10.78 12.66 11.35 12.79 11.9C12.92 12.44 13.06 13.06 13.19 13.6C13.32 14.14 13.45 14.7 13.58 15.12C13.72 15.54 13.85 15.92 13.98 16.14C14.11 16.35 14.24 16.47 14.38 16.41C14.51 16.35 14.64 16.14 14.77 15.8C14.9 15.46 15.03 14.94 15.17 14.37C15.3 13.79 15.43 13.04 15.56 12.33C15.69 11.62 15.83 10.8 15.96 10.11C16.09 9.41 16.22 8.69 16.35 8.17C16.49 7.66 16.62 7.21 16.75 7.02C16.88 6.82 17.01 6.79 17.15 6.99C17.28 7.19 17.41 7.62 17.54 8.2C17.67 8.78 17.81 9.61 17.94 10.45C18.07 11.29 18.2 12.34 18.33 13.23C18.47 14.13 18.6 15.13 18.73 15.84C18.86 16.55 18.99 17.2 19.13 17.51C19.26 17.82 19.39 17.9 19.52 17.68C19.65 17.45 19.78 16.89 19.92 16.15C20.05 15.42 20.18 14.32 20.31 13.26C20.44 12.21 20.58 10.87 20.71 9.81C20.84 8.75 20.97 7.61 21.1 6.91C21.24 6.21 21.43 5.82 21.5 5.6"/></g>',
    // A box of sixteen big pads and no display, so it is never a calculator.
    'drum-machine':
      '<rect x="2.5" y="2.5" width="19" height="19" rx="3"/><rect x="5" y="5" width="2.6" height="2.6" rx=".7" fill="currentColor" stroke="none"/><rect x="8.8" y="5" width="2.6" height="2.6" rx=".7" fill="currentColor" stroke="none"/><rect x="12.6" y="5" width="2.6" height="2.6" rx=".7" fill="currentColor" stroke="none"/><rect x="16.4" y="5" width="2.6" height="2.6" rx=".7" fill="currentColor" stroke="none"/><rect x="5" y="8.8" width="2.6" height="2.6" rx=".7" fill="currentColor" stroke="none"/><rect x="8.8" y="8.8" width="2.6" height="2.6" rx=".7" fill="currentColor" stroke="none"/><rect x="12.6" y="8.8" width="2.6" height="2.6" rx=".7" fill="currentColor" stroke="none"/><rect x="16.4" y="8.8" width="2.6" height="2.6" rx=".7" fill="currentColor" stroke="none"/><rect x="5" y="12.6" width="2.6" height="2.6" rx=".7" fill="currentColor" stroke="none"/><rect x="8.8" y="12.6" width="2.6" height="2.6" rx=".7" fill="currentColor" stroke="none"/><rect x="12.6" y="12.6" width="2.6" height="2.6" rx=".7" fill="currentColor" stroke="none"/><rect x="16.4" y="12.6" width="2.6" height="2.6" rx=".7" fill="currentColor" stroke="none"/><rect x="5" y="16.4" width="2.6" height="2.6" rx=".7" fill="currentColor" stroke="none"/><rect x="8.8" y="16.4" width="2.6" height="2.6" rx=".7" fill="currentColor" stroke="none"/><rect x="12.6" y="16.4" width="2.6" height="2.6" rx=".7" fill="currentColor" stroke="none"/><rect x="16.4" y="16.4" width="2.6" height="2.6" rx=".7" fill="currentColor" stroke="none"/>',
    // A record, its label and spindle, one groove catching the light.
    record:
      '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3"/><circle data-fine="" cx="12" cy="12" r=".8" fill="currentColor" stroke="none"/><path data-fine="" d="M6.3 9.5a6.4 6.4 0 0 1 3.2-3.2"/>',
    // A full mix: a stereo pair of waveforms, one over the other.
    song: '<g transform="translate(0 0.25)"><path d="M4 7h1.5l1.5-3 2 6 2-6.5 2 7 2-5 1.5 3 1.5-1.5H20"/><path d="M4 17h1.5l1.5-2.5 2 5 2-6 2 6.5 2-4.5 1.5 2.5 1.5-1H20"/></g>',
    // Plain audio, five bars: the honest "we do not know".
    audio: '<path d="M4 10v4M8 6.5v11M12 3.5v17M16 7.5v9M20 10.5v3"/>',
    // An uneven burst. A regular star read as a badge.
    'sound-fx':
      '<g transform="translate(-0.65 0.05)"><path d="M11 2.65L13.55 7.87L17.61 6.68L16.35 10.71L21.72 13.37L15.88 14.68L16.54 19.55L12.48 16.77L8.76 21.24L8.72 15.43L4.19 14.87L7.43 11.65L3.59 6.83L9.58 8.29Z"/></g>',
    // A metronome, its pendulum swung out with its weight: click and count-in lanes.
    metronome:
      '<g transform="translate(0 0.25)"><defs><mask id="$k" maskUnits="userSpaceOnUse" x="-6" y="-6" width="36" height="36"><rect x="-6" y="-6" width="36" height="36" fill="#fff" stroke="none"/><path d="M12 16.5 18.4 3" fill="none" stroke="#000" stroke-width="5"/></mask></defs><path mask="url(#$k)" d="M9 3h6l4.5 17.5h-15Z"/><path d="M12 16.5 18.4 3"/><path d="M5.5 16.5h13"/><rect x="14" y="8.4" width="3" height="2.2" rx=".6" transform="rotate(25 15.5 9.5)" fill="currentColor" stroke="none"/></g>',
  }
