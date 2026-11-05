// ============================================================
// Lesson glyphs — the engraved clefs, notehead, sharp and flat from Noto Music
// ============================================================
//
// Outlines from Noto Music 2.003 (SIL Open Font Licence 1.1), in font units
// with the baseline at 0 and y pointing down, as the stats site's staff
// engraving uses them (docs/plans/find-your-pitch/research/stats-snippets/
// noto-music-glyph-paths.json): U+1D11E MUSICAL SYMBOL G CLEF, U+1D122 F
// CLEF, U+1D158 BLACK NOTEHEAD, U+266F MUSIC SHARP SIGN and U+266D MUSIC
// FLAT SIGN. Drawn as paths, so the page needs no music font. Every lesson
// page imports the G clef for its section heads (page-chrome.ts
// `engraveClefs`); the rest serve the staff toy (staff-draw.ts), and each is
// an export of its own, so a page that imports only the G clef carries only
// the G clef. NOTO_GLYPHS gives where each sits on Noto Music's own staff.

export const G_CLEF_PATH = [
  'M314 -801Q300 -854 291.0 -906.0Q282 -958 282 -1012',
  'Q282 -1059 288.5 -1100.5Q295 -1142 307 -1177Q320 -1217 341.0 -1252.5',
  'Q362 -1288 385.5 -1311.0Q409 -1334 427 -1334Q451 -1334 493 -1249',
  'Q514 -1206 524.0 -1156.0Q534 -1106 534 -1049Q534 -978 515.0 -907.5',
  'Q496 -837 459.5 -775.0Q423 -713 372 -666L407 -498',
  'Q422 -500 432.0 -501.0Q442 -502 447 -502Q508 -502 556.0 -467.5',
  'Q604 -433 632.5 -377.0Q661 -321 661 -254Q661 -177 621.5 -115.5',
  'Q582 -54 503 -25Q508 -8 532 117Q538 147 541.0 164.5',
  'Q544 182 545.0 195.0Q546 208 546 225Q546 275 521.5 314.5',
  'Q497 354 455.5 376.0Q414 398 363 398Q311 398 271.0 378.5',
  'Q231 359 208.0 324.5Q185 290 185 245Q185 197 211.5 165.0',
  'Q238 133 287 133Q329 133 355.5 163.5Q382 194 382 236',
  'Q382 272 357.0 299.0Q332 326 292 326H282Q308 365 364 365',
  'Q433 365 472.0 320.0Q511 275 511 205Q511 188 507.0 159.5',
  'Q503 131 493 91Q483 51 477.5 25.0Q472 -1 470 -12Q436 -2 390 -2',
  'Q304 -2 222 -52Q142 -102 96.0 -184.0Q50 -266 50 -361Q50 -451 91 -530',
  'Q132 -609 192.5 -675.0Q253 -741 314 -801ZM341 -826',
  'Q364 -838 390.0 -870.5Q416 -903 440.0 -945.0Q464 -987 479.0 -1029.5',
  'Q494 -1072 494 -1106Q494 -1142 483.0 -1163.0Q472 -1184 445 -1184',
  'Q421 -1184 398.5 -1162.0Q376 -1140 358.5 -1103.5',
  'Q341 -1067 331.0 -1022.0Q321 -977 321 -930Q321 -898 327.5 -872.0',
  'Q334 -846 341 -826ZM398 -379Q371 -373 347.0 -353.5',
  'Q323 -334 308.5 -306.5Q294 -279 294 -248Q294 -223 307.0 -196.5',
  'Q320 -170 339 -154Q352 -142 365 -136Q380 -129 380 -123',
  'Q380 -120 370 -117Q332 -126 301.5 -151.0Q271 -176 253.5 -211.5',
  'Q236 -247 236 -287Q236 -330 253.5 -370.0Q271 -410 302.5 -442.0',
  'Q334 -474 374 -490L345 -641Q229 -547 174.5 -456.5Q120 -366 120 -277',
  'Q120 -212 154.0 -156.0Q188 -100 247.0 -65.5Q306 -31 380 -31',
  'Q400 -31 420.5 -35.0Q441 -39 464 -45ZM495 -55Q593 -97 593 -227',
  'Q593 -270 571.0 -305.5Q549 -341 512.0 -362.0Q475 -383 429 -383Z',
].join('')

/** U+1D122 MUSICAL SYMBOL F CLEF: its two dots straddle the F line. */
export const F_CLEF_PATH = [
  'M50 -123Q216 -231 288 -301Q336 -348 373.0 -408.5',
  'Q410 -469 431.5 -536.0Q453 -603 453 -669Q453 -728 435.0 -773.5',
  'Q417 -819 383.0 -845.0Q349 -871 302 -871Q284 -871 264.5 -867.0',
  'Q245 -863 224 -855Q181 -839 158.0 -813.5Q135 -788 135 -765',
  'Q135 -756 143.0 -752.0Q151 -748 158 -748Q168 -748 183 -752',
  'Q190 -754 196.5 -755.0Q203 -756 210 -756Q248 -756 272.0 -733.5',
  'Q296 -711 296 -674Q296 -638 266.0 -612.0Q236 -586 195 -586',
  'Q146 -586 111.0 -617.0Q76 -648 76 -697Q76 -756 109.0 -802.0',
  'Q142 -848 198.5 -874.0Q255 -900 324 -900Q400 -900 460.0 -867.0',
  'Q520 -834 555.5 -776.5Q591 -719 591 -646Q591 -551 538 -464',
  'Q511 -419 476.5 -379.0Q442 -339 389.0 -297.5',
  'Q336 -256 256.0 -208.0Q176 -160 57 -101ZM687 -809',
  'Q710 -809 726.0 -793.0Q742 -777 742 -754Q742 -731 726.0 -715.5',
  'Q710 -700 687 -700Q664 -700 648.0 -715.5Q632 -731 632 -754',
  'Q632 -777 648.0 -793.0Q664 -809 687 -809ZM687 -589',
  'Q710 -589 726.0 -573.0Q742 -557 742 -534Q742 -511 726.0 -495.5',
  'Q710 -480 687 -480Q664 -480 648.0 -495.5Q632 -511 632 -534',
  'Q632 -557 648.0 -573.0Q664 -589 687 -589Z',
].join('')

/** U+1D158 MUSICAL SYMBOL NOTEHEAD BLACK: a filled notehead, with no stem. */
export const NOTEHEAD_PATH = [
  'M159 1Q111 1 80.5 -21.5Q50 -44 50 -90Q50 -141 78.5 -181.5',
  'Q107 -222 153.0 -245.5Q199 -269 251 -269Q295 -269 321.0 -245.5',
  'Q347 -222 347 -179Q347 -130 321.0 -89.0Q295 -48 252.5 -23.5',
  'Q210 1 159 1Z',
].join('')

/** U+266F MUSIC SHARP SIGN. */
export const SHARP_PATH = [
  'M97 -46V-189L50 -177V-277L97 -290V-486H128V-298L195 -314V-509',
  'H226V-322L275 -333V-234L226 -220V-77L275 -89V14L226 26V214H195',
  'V34L128 52V247H97V59L50 71V-32ZM195 -70V-214L128 -197V-54Z',
].join('')

/** U+266D MUSIC FLAT SIGN. */
export const FLAT_PATH = [
  'M50 -615H81V-225Q118 -262 165 -262Q197 -262 223.0 -240.5',
  'Q249 -219 249 -178Q249 -146 230.0 -119.0Q211 -92 179 -65L110 -6',
  'Q91 10 76.0 25.5Q61 41 50 55ZM81 -12Q107 -40 125.0 -63.5',
  'Q143 -87 153 -105Q164 -124 169.5 -140.0Q175 -156 175 -170',
  'Q175 -198 162.0 -210.5Q149 -223 134 -223Q118 -223 102.5 -211.5',
  'Q87 -200 81 -180Z',
].join('')

/**
 * Where the glyphs sit on Noto Music's own staff, in font units: its lines
 * at font y 12, 256, 500, 744 and 988, so a staff space is 244 units and a
 * glyph's baseline sits 12 below the bottom line. The G clef sits on that
 * staff as drawn; the F clef's dots centre at font y 644, not on its F line
 * at 744, so it is set with its bottom line at font y -88, 100 units higher
 * (the stats snippet's calibration). A notehead's centre is 134 up and
 * 198.5 across; an accidental's optical centre is the notehead's height,
 * and `width` is each glyph's right edge.
 */
export const NOTO_GLYPHS = {
  space: 244,
  base: { g: 12, f: -88 },
  head: { cx: 198.5, cy: 134, width: 347 },
  sharp: 275,
  flat: 249,
} as const
