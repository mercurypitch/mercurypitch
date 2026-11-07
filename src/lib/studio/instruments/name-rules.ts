// ============================================================
// Instrument name rules — what a track or file name says it plays, first rule to match wins
// ============================================================
//
// Multitrack sessions are named by engineers: "Kick_In.wav", "OH L.aif",
// "BGV 2", "Bass DI". A name is normalised first (the extension and a
// trailing take number go, camelCase splits, _ and . become spaces, all lower
// case), then the rules run in order. Order matters: backing vocals before
// vocals, synth bass before bass, harmonica before harp.
import type { InstrumentGlyphId } from './glyph-catalog'

export const INSTRUMENT_NAME_RULES: readonly (readonly [
  RegExp,
  InstrumentGlyphId,
])[] = [
  [/\b(bgv|bvs?|backing ?vo(x|cals?)|harmon(y|ies)|doubles?|dbl)\b/i, 'mics'],
  [/\b(choir|chorus vox|ensemble vox|satb)\b/i, 'choir'],
  [/\b(vox|vocals?|voc|lead vo(x|cal)|ld ?vx|singer|voice)\b/i, 'mic'],
  [/\b(kick|kik|bd|bass ?drum)\b/i, 'kick'],
  [/\b(snare|snr|sd)\b/i, 'snare'],
  [/\b(toms?|rack|floor ?tom)\b/i, 'toms'],
  [/\b(hi-?hats?|hh|hats?)\b/i, 'hi-hat'],
  [/\b(overheads?|ohs?|cymbals?|ride|crash|china|splash)\b/i, 'cymbal'],
  [/\b(808|909|drum ?machine|beat ?box|beats?)\b/i, 'drum-machine'],
  [/\b(drums?|kit|drum ?bus|room ?mics?|perc(ussion)? bus)\b/i, 'drums'],
  [
    /\b(congas?|bongos?|cajon|djembe|timbales?|taiko|hand ?drums?)\b/i,
    'hand-drum',
  ],
  [/\b(shakers?|maracas?|cabasa|guiro|egg)\b/i, 'shaker'],
  [/\b(tambo?u?rine|tamb)\b/i, 'tambourine'],
  [/\b(cowbell|agogo)\b/i, 'cowbell'],
  [/\b(claps?|handclaps?|snaps?)\b/i, 'clap'],
  [/\b(wood ?block|claves)\b/i, 'woodblock'],
  [/\b(triangle)\b/i, 'triangle'],
  [/\b(perc(ussion)?)\b/i, 'hand-drum'],
  [/\b(synth ?bass|sub ?bass|808 ?bass|moog ?bass)\b/i, 'synth-bass'],
  [/\b(upright|double ?bass|contrabass|acoustic ?bass)\b/i, 'upright-bass'],
  [/\b(bass|bass ?di|bass ?amp)\b/i, 'electric-bass'],
  [
    /\b(acoustic|ac ?gtr|nylon|classical ?gtr|steel ?string|ukulele|uke)\b/i,
    'acoustic-guitar',
  ],
  [
    /\b(e-?gtr|elec(tric)?|dist(orted)?|crunch|clean ?gtr|amp|lead ?gtr|rhythm ?gtr)\b/i,
    'electric-guitar',
  ],
  [/\b(gtrs?|guitars?)\b/i, 'acoustic-guitar'],
  [/\b(banjo)\b/i, 'banjo'],
  [/\b(sitar|oud|mandolin|bouzouki|shamisen|pipa|balalaika|lute)\b/i, 'lute'],
  [/\b(koto|zither|dulcimer|guzheng|autoharp)\b/i, 'zither'],
  [/\b(harmonica|blues ?harp)\b/i, 'harmonica'],
  [/\b(harp)\b/i, 'harp'],
  [/\b(piano|pno|grand|upright ?piano)\b/i, 'grand-piano'],
  [
    /\b(rhodes|wurli(tzer)?|e-?piano|ep|stage ?piano|clav(inet)?)\b/i,
    'keyboard',
  ],
  [/\b(pipe ?organ|church ?organ)\b/i, 'pipe-organ'],
  [/\b(organ|hammond|b-?3|leslie)\b/i, 'organ'],
  [/\b(accordion|bandoneon|concertina)\b/i, 'accordion'],
  [/\b(lead ?synth|synth ?lead|saw ?lead|arp(eggio)?)\b/i, 'synth-lead'],
  [/\b(pads?|atmos(phere)?|drone|texture)\b/i, 'synth-pad'],
  [/\b(keys|keyboards?|synths?|moog|prophet|juno|polysynth)\b/i, 'synth-keys'],
  [/\b(risers?|sweeps?|impacts?|whoosh|downlifter|uplifter)\b/i, 'synth-fx'],
  [/\b(cello|vc|vlc)\b/i, 'cello'],
  [/\b(strings?|violins?|vln|viola|vla|fiddle)\b/i, 'violin'],
  [/\b(french ?horn|fr ?hn)\b/i, 'french-horn'],
  [/\b(trombones?|tbn|bones)\b/i, 'trombone'],
  [/\b(tuba|sousaphone|euphonium)\b/i, 'tuba'],
  [/\b(trumpets?|tpt|flugel(horn)?|cornet|brass|horns?)\b/i, 'trumpet'],
  [/\b(sax(ophone)?|alto ?sax|tenor ?sax|bari ?sax)\b/i, 'saxophone'],
  [/\b(clarinet|clar|oboe|bassoon|cor ?anglais|english ?horn)\b/i, 'clarinet'],
  [/\b(pan ?flute|pan ?pipes?)\b/i, 'pan-flute'],
  [/\b(flute|fl|piccolo|recorder|whistle)\b/i, 'flute'],
  [/\b(ocarina)\b/i, 'ocarina'],
  [/\b(bagpipes?)\b/i, 'bagpipe'],
  [
    /\b(mallets?|marimba|vibes|vibraphone|xylophone|glock(enspiel)?)\b/i,
    'mallets',
  ],
  [/\b(bells?|chimes?|celesta|tubular)\b/i, 'bells'],
  [/\b(kalimba|mbira)\b/i, 'kalimba'],
  [/\b(steel ?pan|steel ?drums?)\b/i, 'steel-drum'],
  [/\b(timpani|timps?)\b/i, 'timpani'],
  [/\b(click|metronome|count-?in)\b/i, 'metronome'],
  [/\b(sfx|fx|foley|noise)\b/i, 'sound-fx'],
  [
    /\b(mix|master|bounce|full ?mix|stereo ?mix|2-?track|original|reference|ref)\b/i,
    'song',
  ],
  [/\b(backing|instrumental|karaoke|minus ?one|playback)\b/i, 'record'],
]

/** A name as the rules read it: no extension, words apart, lower case. */
export function normaliseInstrumentName(name: string): string {
  return name
    .replace(/\.(wav|aiff?|flac|mp3|m4a|ogg|webm|caf)$/i, '')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_.]+/g, ' ')
    .replace(/\s+\d+$/, '')
    .toLowerCase()
    .trim()
}

/** The glyph a name's first matching rule draws, or null when no rule speaks for it. */
export function instrumentFromName(name: string): InstrumentGlyphId | null {
  const normal = normaliseInstrumentName(name)
  if (normal === '') return null
  for (const [rule, glyph] of INSTRUMENT_NAME_RULES)
    if (rule.test(normal)) return glyph
  return null
}
