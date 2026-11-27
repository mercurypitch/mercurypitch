// =====================================================================
// legend-queue.mjs: the next Legend Attempts, as data
// =====================================================================
//
// What `seed-legends.mjs` posts, and what `src/tests/legend-queue.test.ts`
// checks before anything is posted. Each row continues the run prod already
// has: four-week windows, Monday 00:00 UTC to Monday 00:00 UTC
// (DEFAULT_PERIOD_WEEKS in src/features/challenges/challenge-window.ts),
// back to back, starting when "The Run" (Greensleeves) ends on 21 Dec 2026.
//
// A row shows on Home about 48 hours after its `startsAt`: the outgoing
// Legend keeps late attempts open that long (WEEKLY_GRACE_MS in the db
// worker), and the next one is promoted once it closes. The hooks below are
// dated with that in mind.
//
// The melodies are transcribed from published engravings of each piece, not
// authored shapes: the note names a singer hears are the piece's own. They
// are sung at written pitch (see the TESSITURA note in
// seed-weekly-rotation.mjs), so every line is placed inside G3-C5, one beat
// per note at the stage's 60 BPM, a repeated note being a held one.
//
// Left for the owner, per row: `hearItUrl` (an official upload) and
// `founderScore` (the owner's own take). Both may stay null at seed time
// and be filled in from #/admin/weekly afterwards.
// =====================================================================

/** G3 and C5: the span the challenge type says nearly everyone can sing. */
export const COMFORT_LOW = 55
export const COMFORT_HIGH = 72

export const PERIOD_DAYS = 28
const DAY_MS = 86_400_000

const NOTE_NAMES = [
  'C',
  'C#',
  'D',
  'D#',
  'E',
  'F',
  'F#',
  'G',
  'G#',
  'A',
  'A#',
  'B',
]

/** MIDI number to the app's spelling of it: sharps, octave 4 from middle C. */
export function noteLabel(midi) {
  return `${NOTE_NAMES[midi % 12]}${Math.floor(midi / 12) - 1}`
}

export const LEGENDS = [
  {
    key: 'silent-night-hold-the-night',
    title: 'Hold the Night',
    description:
      'The first line of Gruber’s Silent Night (1818). A small turn from G up to A and back, then a long E. Keep that E level as it fades, without sliding flat.',
    featType: 'sustain',
    difficulty: 'beginner',
    // "Si- lent night, ho- ly night": G A G E, twice; E is the long note.
    notes: [67, 69, 67, 64, 64, 67, 69, 67, 64, 64],
    targetScore: 75,
    startsAt: '2026-12-21T00:00:00.000Z',
    endsAt: '2027-01-18T00:00:00.000Z',
    // A carol, so it should not come back as a summer Encore.
    evergreen: false,
    hearItUrl: null,
    founderScore: null,
    source: {
      piece: 'Silent Night (Stille Nacht)',
      credits:
        'Music Franz Xaver Gruber (d. 1863); German words Joseph Mohr (d. 1848); English words John Freeman Young (1859, d. 1885)',
      publicDomain: 'Every author died before 1890.',
      score:
        'Wikipedia "Silent Night", contemporary melody engraving, read in C before its \\transpose c d',
      lyric: 'Silent night, holy night',
      hook: 'Christmas: on Home from about 23 December',
    },
  },
  {
    key: 'auld-lang-syne-old-acquaintance',
    title: 'Old Acquaintance',
    description:
      'Burns Night is 25 January, and Auld Lang Syne is the song that ends it. Leap up a fourth to “auld”, hold the F through “acquain-”, lift to A on “-tance”, then rock between G and F to “forgot”.',
    featType: 'range',
    difficulty: 'beginner',
    // "Should auld ac- quain- tance be for- got": C F F F A G F G.
    notes: [60, 65, 65, 65, 69, 67, 65, 67],
    targetScore: 75,
    startsAt: '2027-01-18T00:00:00.000Z',
    endsAt: '2027-02-15T00:00:00.000Z',
    // Tied to Burns Night and New Year, so not an Encore.
    evergreen: false,
    hearItUrl: null,
    founderScore: null,
    source: {
      piece: 'Auld Lang Syne',
      credits:
        'Words Robert Burns (1788, d. 1796); traditional Scottish melody',
      publicDomain: 'Burns died in 1796; the tune is traditional.',
      score: 'Wikipedia "Auld Lang Syne", melody engraving in F major',
      lyric: 'Should auld acquaintance be forgot',
      hook: 'Burns Night, 25 January: on Home from about 20 January',
    },
  },
  {
    key: 'habanera-the-rebel-bird',
    title: 'The Rebel Bird',
    description:
      'Carmen’s Habanera (Bizet, 1875) slides down by half steps from D to A on “L’amour est un oiseau rebelle”. Place every half step instead of gliding through them. Written an octave below the score, so most voices can reach it.',
    featType: 'chromatic',
    difficulty: 'intermediate',
    // "L'a- mour est un oi- seau re- bel- le": D C# C C C B Bb A A,
    // an octave below Carmen's written D5 to A4.
    notes: [62, 61, 60, 60, 60, 59, 58, 57, 57],
    targetScore: 72,
    startsAt: '2027-02-15T00:00:00.000Z',
    endsAt: '2027-03-15T00:00:00.000Z',
    evergreen: true,
    hearItUrl: null,
    founderScore: null,
    source: {
      piece: 'Habanera ("L’amour est un oiseau rebelle"), from Carmen',
      credits:
        'Music Georges Bizet (d. 1875), after Sebastián Yradier’s El Arreglito (1863, d. 1865); words Bizet, with Henri Meilhac (d. 1897) and Ludovic Halévy (d. 1908)',
      publicDomain: 'Every author died before 1910.',
      score:
        'Wikipedia "Habanera (aria)", vocal line engraving in D minor, taken an octave down',
      lyric: 'L’amour est un oiseau rebelle',
      hook: 'Valentine’s Day has just passed: on Home from about 17 February',
    },
  },
  {
    key: 'danny-boy-the-pipes-are-calling',
    title: 'The Pipes Are Calling',
    description:
      'Danny Boy, sung to the Londonderry Air, in time for St Patrick’s Day. The line climbs to a B on the second “the pipes”, then falls an octave to “calling”. Keep the top note full and the bottom one steady.',
    featType: 'range',
    difficulty: 'intermediate',
    // "Oh Dan- ny boy, the pipes, the pipes are cal- (l)ing":
    // C# D E F# E F# B A F# E D B. That is the engraving's E-flat major
    // line (D Eb F G F G C Bb G F Eb C), all of it a half step lower, in
    // D major, whose sharps are the note names the app shows.
    notes: [61, 62, 64, 66, 64, 66, 71, 69, 66, 64, 62, 59],
    targetScore: 72,
    startsAt: '2027-03-15T00:00:00.000Z',
    endsAt: '2027-04-12T00:00:00.000Z',
    evergreen: true,
    hearItUrl: null,
    founderScore: null,
    source: {
      piece: 'Danny Boy (Londonderry Air)',
      credits:
        'Words Frederic Weatherly (1913, d. 1929); traditional Irish melody, published by George Petrie (1855)',
      publicDomain:
        'Weatherly died in 1929 (life plus 70 ended 1999); published in 1913, so also public domain in the US.',
      score:
        'Wikipedia "Londonderry Air", melody engraving in E-flat major, taken a half step down to D major',
      lyric: 'Oh Danny boy, the pipes, the pipes are calling',
      hook: 'St Patrick’s Day, 17 March: on Home from that day',
    },
  },
]

/**
 * Everything that would make a row wrong before the server sees it. The
 * worker checks almost nothing (slug and required fields), so this is the
 * gate: the seeder refuses to post while it returns anything.
 *
 * @param {typeof LEGENDS} legends
 * @returns {string[]} one line per problem, empty when the queue is sound
 */
export function legendQueueProblems(legends) {
  const problems = []
  const keys = new Set()
  let previousEnd = null
  for (const [i, row] of legends.entries()) {
    const at = `#${i + 1} ${row.key}`
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(row.key)) {
      problems.push(`${at}: key must be lower-case words joined by hyphens`)
    }
    if (row.key.includes('encore')) {
      problems.push(`${at}: a key containing "encore" reads as an Encore`)
    }
    if (keys.has(row.key)) problems.push(`${at}: key used twice`)
    keys.add(row.key)
    for (const field of ['title', 'description']) {
      const text = row[field]
      if (typeof text !== 'string' || text.trim() === '') {
        problems.push(`${at}: ${field} is empty`)
      } else if (text.includes('—')) {
        problems.push(`${at}: ${field} has an em dash`)
      }
    }
    if (!Array.isArray(row.notes) || row.notes.length < 3) {
      problems.push(`${at}: needs at least three notes`)
    } else {
      for (const midi of row.notes) {
        if (!Number.isInteger(midi)) {
          problems.push(`${at}: ${midi} is not a MIDI number`)
        } else if (midi < COMFORT_LOW || midi > COMFORT_HIGH) {
          problems.push(
            `${at}: ${noteLabel(midi)} is outside ${noteLabel(COMFORT_LOW)}-${noteLabel(COMFORT_HIGH)}`,
          )
        }
      }
    }
    if (
      !Number.isInteger(row.targetScore) ||
      row.targetScore < 50 ||
      row.targetScore > 95
    ) {
      problems.push(`${at}: targetScore ${row.targetScore} is not 50-95`)
    }
    const start = Date.parse(row.startsAt)
    const end = Date.parse(row.endsAt)
    if (!Number.isFinite(start) || !Number.isFinite(end)) {
      problems.push(`${at}: startsAt and endsAt must be ISO dates`)
    } else {
      const startDate = new Date(start)
      if (
        startDate.getUTCDay() !== 1 ||
        start % DAY_MS !== 0 ||
        row.startsAt !== startDate.toISOString()
      ) {
        problems.push(`${at}: startsAt must be a Monday at 00:00:00.000Z`)
      }
      if (end - start !== PERIOD_DAYS * DAY_MS) {
        problems.push(`${at}: window must be ${PERIOD_DAYS} days`)
      }
      if (previousEnd !== null && start !== previousEnd) {
        problems.push(
          `${at}: starts ${row.startsAt}, not where the last one ended`,
        )
      }
      previousEnd = end
    }
    if (typeof row.evergreen !== 'boolean') {
      problems.push(`${at}: evergreen must be true or false`)
    }
    if (
      row.hearItUrl !== null &&
      !/^https:\/\/(www\.youtube\.com\/watch\?v=|youtu\.be\/)[\w-]{11}/.test(
        row.hearItUrl,
      )
    ) {
      problems.push(`${at}: hearItUrl must be null or a YouTube video link`)
    }
    if (
      row.founderScore !== null &&
      !(
        Number.isInteger(row.founderScore) &&
        row.founderScore >= 0 &&
        row.founderScore <= 100
      )
    ) {
      problems.push(`${at}: founderScore must be null or 0-100`)
    }
  }
  return problems
}

/** The slug the server stores: the key plus the start's day number, as before. */
export function legendSlug(row) {
  return `${row.key}-${Math.floor(Date.parse(row.startsAt) / DAY_MS)}`
}
