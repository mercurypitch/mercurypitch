// ============================================================
// Name filter word list — what name-filter.ts refuses
// ============================================================
//
// English only, and a starting point the owner extends. A word is written
// here as a reader would spell it; name-filter.ts folds it the same way it
// folds a name, so "nigger" also catches "N1GGER" and "n i g g e r".
//
// Two tiers, by where a word is refused. EVERYWHERE words (the slurs no song
// needs) are refused in names, titles and a melody's lyrics. NAMES words only
// in names and titles: songs carry crude words, and some of these are
// innocent in other languages ("kys" is Danish for a kiss, "en retard" is
// French for late), which a lyric may be and a name rarely is.
//
// Three shapes. INSIDE words are refused inside any one word
// ("DickheadSinger"), never across two: "Rabbit Chase" holds no word.
// ALONE words only as a word of their own, because ordinary words and names
// contain them ("class", "grape", "Scunthorpe", "Yamashita", "Siriporn"),
// with the endings it may carry after a colon ("rape:s,d" also refuses
// "rapes" and "raped", and nothing else: "Cumming", "Spices" and "Coons" are
// names and words). PHRASES are refused as words in a row.
//
// Some slurs are left off because a common name or idiom is spelled the same:
// "Kike" (Enrique), "Van Dyke", "Coon" (a surname). Reports catch those.

export interface WordTier {
  readonly inside: readonly string[]
  readonly alone: readonly string[]
  readonly phrases: readonly string[]
  /**
   * INSIDE words a melody may split over two notes ("nig" "ger"), so they
   * are also read across two words in a row. Only words no two ordinary
   * words make: "wet back" and "rag head" are innocent apart.
   */
  readonly split?: readonly string[]
}

export const EVERYWHERE: WordTier = {
  inside: [
    'nigger',
    'faggot',
    'wetback',
    'raghead',
    'towelhead',
    'jigaboo',
    'porchmonkey',
    'junglebunny',
    'golliwog',
  ],
  alone: [],
  phrases: ['sieg heil'],
  split: ['nigger', 'faggot'],
}

export const NAMES: WordTier = {
  inside: [
    'fuck',
    'bitch',
    'bullshit',
    'shithead',
    'shitface',
    'asshole',
    'arsehole',
    'dickhead',
    'cocksucker',
    'jizz',
    'whore',
    'pornhub',
    'dildo',
    'blowjob',
    'handjob',
    'rimjob',
    'gangbang',
    'cumshot',
    'bollocks',
    'wanker',
    'masturbat',
    'pedophile',
    'paedophile',
    'incest',
    'bestiality',
    'nigga',
    'shemale',
    'hitler',
  ],
  alone: [
    'shit:s',
    'shitty',
    'porn:o,s',
    'fck',
    'fcuk',
    'fuk:s',
    'fuq',
    'cunt:s',
    'twat:s',
    'penis:es',
    'vagina:s',
    'cum',
    'slut:s',
    'slutty',
    'wank:s,ed,ing',
    'anal',
    'anus',
    'rape:s,d',
    'raping',
    'rapist:s',
    'tits',
    'titty',
    'titties',
    'milf:s',
    'piss:ed,es,ing',
    'pedo:s',
    'paedo:s',
    'ass:es',
    'arse:s',
    'bastard:s',
    'creampie:s',
    'fag:s',
    'spic:s',
    'spick',
    'chink:s',
    'gook:s',
    'paki:s',
    'wog:s',
    'kaffir:s',
    'tranny',
    'trannies',
    'retard:s,ed',
    'spaz',
    'nazi:s',
    'kkk',
    'kys',
  ],
  phrases: ['white power', 'kill yourself', 'kill urself', 'heil hitler'],
}

/** Words that hold an INSIDE word and are not it. */
export const INNOCENT_WORDS: readonly string[] = [
  'snigger',
  'sniggers',
  'sniggered',
  'sniggering',
  'niggard',
  'niggards',
  'niggardly',
  'niggardliness',
]

/** Phrases whose words are innocent together: Latin honours, idioms. */
export const INNOCENT_PHRASES: readonly string[] = [
  'cum laude',
  'spick and span',
  'en retard',
]
