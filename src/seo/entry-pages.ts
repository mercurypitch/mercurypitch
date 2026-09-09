// Every crawlable entry document on mercurypitch.com, as data.
//
// The app is a single-page application: a crawler that does not run JavaScript
// sees an empty shell. Each entry below is a real HTML document, generated at
// build time, that answers one search intent in text — and then hands over to
// the app in place, on the same URL, once it boots (the prelude hides itself
// via `#root:not(:empty) ~ .entry-prelude` in styles/entry-prelude.css). There
// is no redirect: the URL a searcher lands on is the URL they keep.
//
// This file is the single source of truth for four things that used to be kept
// in step by hand across eleven near-identical HTML files:
//   1. the documents themselves      (scripts/generate-entry-pages.mjs)
//   2. the Vite build inputs         (vite.config.ts)
//   3. the dev/preview path rewrites (vite.config.ts)
//   4. the production path routing   (src/worker.ts)
// Adding a page here adds it to all four, and cross-links it from every other
// entry's nav automatically.
//
// The generated files are written to the project root as <slug>.html and are
// git-ignored. They MUST land at the root rather than in a subdirectory:
// production resolves /vocal-range-test through Cloudflare's asset-layer
// html_handling, which only maps a clean path to a document beside it.

export interface FaqItem {
  q: string
  a: string
}

export interface EntryPage {
  /** Output document, written as `<slug>.html` at the dist root. */
  slug: string
  /** Clean paths that serve this document. The first is the canonical one. */
  paths: readonly string[]
  /** Label in the shared cross-links nav. Every other entry links here. */
  navLabel: string
  /** Module that boots the app for this entry. */
  boot: string
  title: string
  description: string
  keywords?: string
  /** `image` defaults to the shared OG card; most rooms ship their own. */
  og: {
    title: string
    description: string
    image?: string
    imageAlt?: string
  }
  /**
   * Studio-tab entries only. The tab is a URL fragment, which never reaches
   * the server, so the document sets it client-side on arrival — that is what
   * lets /ear-lab, /jam and /pitch-training be real indexable pages rather
   * than redirects into the shell.
   */
  bootHash?: string
  twitter: { title: string; description: string }
  h1: string
  /** The paragraph under the h1. The first thing a crawler reads as prose. */
  lede: string
  /** Emits WebApplication JSON-LD with a free Offer. */
  app?: { name: string; category: string; description: string }
  /** Emits both the visible FAQ section and FAQPage JSON-LD. */
  faq?: readonly FaqItem[]
  noscript: string
}

export const SITE_ORIGIN = 'https://mercurypitch.com'
export const OG_IMAGE = `${SITE_ORIGIN}/og-image.png`
export const ABOUT_URL = 'https://about.mercurypitch.com/'

export const ENTRY_PAGES: readonly EntryPage[] = [
  {
    slug: 'mirror',
    paths: ['/mirror', '/free-sing'],
    navLabel: 'Voice Mirror',
    boot: '/src/features/mirror/main.tsx',
    title: 'Voice Mirror — See Your Voice in 60 Seconds | MercuryPitch',
    description:
      'Sing for 60 seconds and get your vocal range, pitch accuracy and steadiness as a shareable voiceprint. Free, and your audio never leaves your device.',
    keywords:
      'vocal range test, tone deaf test, pitch accuracy test, voice type, singing test, free vocal test',
    og: {
      title: 'Voice Mirror — See Your Voice in 60 Seconds',
      description:
        'Sing for 60 seconds, get your vocal range, accuracy and steadiness as a shareable voiceprint. Analyzed entirely in your browser.',
      imageAlt:
        'MercuryPitch Voice Mirror voiceprint showing a measured vocal range and pitch results.',
    },
    twitter: {
      title: 'Voice Mirror — See Your Voice in 60 Seconds',
      description:
        'Your vocal range, accuracy and steadiness as a shareable voiceprint. Audio never leaves your device.',
    },
    h1: 'Voice Mirror — see your voice in 60 seconds',
    lede: 'Sing two sirens and hold one note. Voice Mirror reads back your vocal range, your pitch accuracy in cents and how steady you held, then names the legendary singer whose range matches yours. Free, no account, and your audio never leaves your device.',
    faq: [
      {
        q: 'What is my vocal range?',
        a: 'Your vocal range is the span from the lowest to the highest note you can comfortably sing. Voice Mirror measures it in under a minute by analyzing a low-to-high siren glide directly in your browser.',
      },
      {
        q: 'Am I tone deaf?',
        a: "True tone deafness (amusia) is rare. Most people who worry about it simply haven't trained pitch matching. Voice Mirror measures how close you sing to five reference notes, in cents, so you get a real number instead of a label.",
      },
      {
        q: 'How accurate is a browser pitch test?',
        a: 'Modern pitch detection (YIN/MPM) running on raw, unprocessed microphone input resolves pitch to within a few cents — far finer than a semitone. Voice Mirror disables echo cancellation and noise suppression so the detector sees your true voice.',
      },
    ],
    noscript: '',
  },
  {
    slug: 'vocal-range-test',
    paths: ['/vocal-range-test'],
    navLabel: 'Vocal Range Test',
    boot: '/src/features/mirror/main.tsx',
    title: 'Free Vocal Range Test — Lowest & Highest Note | MercuryPitch',
    description:
      'Glide from your lowest note to your highest and get both notes, your span in semitones and a voice-type guide. Free, and your audio stays on your device.',
    keywords:
      'vocal range test, singing range test, lowest note, highest note, voice type, free vocal test',
    og: {
      title: 'Free Vocal Range Test — Find Your Lowest & Highest Note',
      description:
        'Sing a low-to-high glide and get your measured notes, semitone span and a broad voice-type guide. Analyzed entirely in your browser.',
      imageAlt:
        'MercuryPitch Voice Mirror voiceprint showing a measured vocal range and pitch results.',
    },
    twitter: {
      title: 'Free Vocal Range Test — Find Your Lowest & Highest Note',
      description:
        'Get your measured notes, semitone span and a broad voice-type guide. Audio stays on your device.',
    },
    h1: 'Free vocal range test',
    lede: 'Glide from your lowest comfortable note to your highest and get both notes, your span in semitones and a broad voice-type guide. It runs in your browser, takes about ninety seconds, and needs no piano and no teacher.',
    faq: [
      {
        q: 'How do I test my vocal range?',
        a: 'Sing a comfortable siren glide from low to high and back down. MercuryPitch measures sustained notes from both glides and reports the lowest and highest notes that were heard reliably.',
      },
      {
        q: 'Does vocal range determine my voice type?',
        a: 'Not by itself. MercuryPitch shows the broad voice band that overlaps your measured range most, but voice type also depends on comfortable tessitura, tone and training. Treat the label as a guide, not a verdict.',
      },
      {
        q: 'Is this vocal range test free?',
        a: 'Yes. The test runs in your browser and your microphone audio stays on your device. Only the derived note and pitch measurements are used to build your result.',
      },
    ],
    noscript: '',
  },
  {
    slug: 'karaoke',
    paths: ['/karaoke-night', '/karaoke'],
    navLabel: 'Karaoke Night',
    boot: '/src/features/karaoke-night/main.tsx',
    title: 'Karaoke Night — Turn Your Songs Into Karaoke | MercuryPitch',
    description:
      'Upload a song you own, the vocals lift away, and you sing with synced lyrics and live pitch scoring — right in your browser. Try the example song free.',
    keywords:
      'karaoke maker, remove vocals from song, vocal remover, karaoke with scoring, sing along with lyrics, karaoke night at home',
    og: {
      title: 'Karaoke Night — Turn Any Song You Own Into Karaoke',
      description:
        'The vocals lift away and you sing with synced lyrics and live pitch scoring. In your browser — try the example song free.',
      image: 'https://mercurypitch.com/karaoke-og.png',
      imageAlt:
        'MercuryPitch Karaoke Night — turn any song you own into karaoke on a theatre stage, with the demo song Goodbye to Spring ready to sing.',
    },
    twitter: {
      title: 'Karaoke Night — Turn Any Song You Own Into Karaoke',
      description:
        'Vocal removal + synced lyrics + live pitch scoring, in your browser. Try the example song free.',
    },
    h1: 'Karaoke Night — turn any song you own into karaoke',
    lede: 'Bring a song you own. The vocals lift away, the lyrics arrive in time, and every note you sing is drawn against the one you were aiming for. Loop the bar you keep missing, slow it down, and hear your own take back. The example song is free.',
    faq: [
      {
        q: 'How do I make a karaoke version of a song?',
        a: 'Upload a song you own and MercuryPitch separates the vocals from the instruments. You get a karaoke-ready mix with adjustable vocal level, synced lyrics and live pitch scoring, all in your browser.',
      },
      {
        q: 'Does it work with any song?',
        a: 'It works with audio files from your own library. A free on-device mode runs entirely in your browser; a studio-quality server mode is available for the cleanest separation.',
      },
      {
        q: 'Can it score my singing?',
        a: 'Yes. Enable your microphone and MercuryPitch tracks your pitch against the original vocal melody in real time, drawing every note you sing and scoring your performance.',
      },
    ],
    noscript: '',
  },
  {
    slug: 'glass',
    paths: [
      '/glass',
      '/break-glass-with-your-voice',
      '/high-note-test',
      '/shatter',
    ],
    navLabel: 'Break Glass',
    boot: '/src/features/glass/main.tsx',
    title: 'Break Glass With Your Voice — Free Challenge | MercuryPitch',
    description:
      'Sing up to the note the glass rings at, hold it, and shatter it. A free in-browser challenge tuned to your own range, with your audio never leaving your device.',
    keywords:
      'break glass with your voice, shatter glass by singing, high note test, how high can I sing, resonant frequency voice, vocal challenge',
    og: {
      title: 'Break Glass With Your Voice — Free 60-Second Challenge',
      description:
        'The glass is tuned to YOUR range. Land the note, hold it, and watch it shatter — with real physics, in your browser.',
      image: 'https://mercurypitch.com/glass/og.jpg',
      imageAlt:
        'A wine glass ringing at its resonant note, one held voice note away from shattering.',
    },
    twitter: {
      title: 'Break Glass With Your Voice',
      description:
        'Can you hold the note that breaks the glass? Free, in your browser, tuned to your own range. Audio never leaves your device.',
    },
    h1: 'Break glass with your voice',
    lede: 'The pane rings at a note picked from your own range. Sing up to it, hold it, and watch the cracks spread. A free in-browser challenge that plays your take back to you between attempts, with your audio never leaving your device.',
    faq: [
      {
        q: 'Can a human voice really break glass?',
        a: 'Yes. Every glass has a resonant frequency; a voice that matches it, loudly and steadily enough, pumps more energy into the glass than it can absorb — until it fractures. That takes pitch accuracy and sustain, which is exactly what this challenge trains.',
      },
      {
        q: 'What note breaks glass?',
        a: 'Whatever note the glass rings at — its resonant frequency, usually somewhere in the soprano range for a wine glass. Here the glass tunes itself to the top of YOUR comfortable range, so the breaking note is always yours to reach.',
      },
      {
        q: 'How do opera singers shatter glass?',
        a: "They find the glass's ringing note by ear, then sing that exact pitch with enough volume and steadiness for the resonance to build. Amplification helps in demonstrations, but the physics is pitch matching plus sustain — skills any singer can practice.",
      },
    ],
    noscript: '',
  },
  {
    slug: 'piano-night',
    paths: ['/piano-night'],
    navLabel: 'Piano Night',
    boot: '/src/features/piano-night/main.tsx',
    title: 'Piano Night — Practise Piano Phrase by Phrase | MercuryPitch',
    description:
      'Slow a phrase down, loop the bar that will not sit, and play it back up to tempo — in your browser, with your own MIDI keyboard or the keys on screen.',
    keywords:
      'piano practice app, practise piano online, piano practice room, midi keyboard practice, loop a bar piano, play piano in browser',
    og: {
      title: 'Piano Night — shape every phrase',
      description:
        'A focused piano room for practising and performing. Slow a phrase down, loop the bar that will not sit, and play it back up to tempo.',
      image: 'https://mercurypitch.com/piano-night-og.png',
      imageAlt:
        'MercuryPitch Piano Night — a low-lit studio with a grand piano at dusk, and the panel offering the rooms to play in.',
    },
    twitter: {
      title: 'Piano Night — shape every phrase',
      description:
        'A focused piano room for practising and performing. Loop the bar that will not sit, and play it back up to tempo.',
    },
    h1: 'Piano Night — practise piano, phrase by phrase',
    lede: 'A focused room for the keyboard. Slow a phrase down, loop the bar that will not sit, and play it back up to tempo, reading it as falling notes, as a staff or as hands on the keys. Works with a MIDI keyboard or the keys on screen.',
    app: {
      name: 'Piano Night',
      category: 'MusicApplication',
      description:
        'A browser piano room: slow a phrase down, loop the bar that will not sit, and read it as falling notes, a staff or hands on the keys.',
    },
    noscript: 'Piano Night needs JavaScript to open the room.',
  },
  {
    slug: 'guitar-night',
    paths: ['/guitar-night'],
    navLabel: 'Guitar Night',
    boot: '/src/features/guitar-night/main.tsx',
    title: 'Guitar Night — A Room That Reads Your Playing | MercuryPitch',
    description:
      'A guitar rehearsal room in your browser. Begin on one open string or bring a song of your own — the room listens and reads the bar back to you as tab.',
    keywords:
      'guitar practice room, practise guitar online, guitar tab reader, learn guitar in browser, guitar rehearsal room, play guitar along to a song',
    og: {
      title: 'Guitar Night — your room is ready',
      description:
        'Begin with one string, bring a song, or step straight into the full workspace. The room listens and reads the bar back to you.',
      image: 'https://mercurypitch.com/guitar-night-og.png',
      imageAlt:
        'MercuryPitch Guitar Night — a lamplit velvet rehearsal room with a drum kit and amps, and the panel offering three ways to begin.',
    },
    twitter: {
      title: 'Guitar Night — your room is ready',
      description:
        'Begin with one string, bring a song, or step straight into the full Guitar workspace.',
    },
    h1: 'Guitar Night — a rehearsal room that reads your playing',
    lede: 'Start on one open string, or bring a song and mute the guitarist on it. The room listens through a microphone, an interface or MIDI, reads the bar back to you as tab, and loops the four bars you keep missing.',
    app: {
      name: 'Guitar Night',
      category: 'MusicApplication',
      description:
        'A browser guitar rehearsal room that listens through mic, interface or MIDI and reads the bar back to you as tab.',
    },
    noscript: '',
  },
  {
    slug: 'drum-night',
    paths: ['/drum-night'],
    navLabel: 'Drum Night',
    boot: '/src/features/drum-night/main.tsx',
    title: 'Drum Night — A Room for Touch, Keys and E-Kits | MercuryPitch',
    description:
      'A drum room for touch, keys and e-kits, with synth and sampled kits, MIDI and Guitar Pro percussion, and Pocket, Drummer Seat and Score views.',
    keywords:
      'online drums, virtual drum kit, play drums in your browser, drum practice, e-kit MIDI drums, Guitar Pro drum tab, drum notation, drum timing practice',
    og: {
      title: 'Drum Night — find the centre',
      description:
        'Play synth and sampled kits from touch, keys or an e-kit, then follow imported percussion from the Pocket, Drummer Seat or written Score.',
      image: 'https://mercurypitch.com/drum-night-og.png',
      imageAlt:
        'MercuryPitch Drum Night — an oxblood drum kit in a quiet late-night tracking room, framed by a circular pocket guide.',
    },
    twitter: {
      title: 'Drum Night — find the centre',
      description:
        'Play synth and sampled kits from touch, keys or an e-kit, then follow imported percussion from the Pocket, Drummer Seat or written Score.',
    },
    h1: 'Drum Night — play the kit, then find the centre of the beat',
    lede: 'A drum room for touch, keys and electronic kits. Import MIDI or Guitar Pro percussion, read the part as a pocket guide, from the drummer’s seat or as notation, and find the centre of the beat with timing evidence rather than a grade.',
    app: {
      name: 'Drum Night',
      category: 'MusicApplication',
      description:
        'A browser drum room for touch, keys and e-kits that follows imported MIDI or Guitar Pro percussion and shows where every hit lands against the beat.',
    },
    noscript: 'Drum Night needs JavaScript to open the room.',
  },
  {
    slug: 'ear-lab',
    paths: ['/ear-lab'],
    navLabel: 'Ear Lab',
    boot: '/src/index.tsx',
    bootHash: '#/ear-lab',
    title: 'Ear Lab — Ear Training Measured in Real Units | MercuryPitch',
    description:
      'An ear-training bench that reads in cents, milliseconds and notes — real units, not a grade. Calibrate once, then practise whichever faculty is neediest.',
    keywords:
      'ear training online, ear training app, relative pitch practice, interval ear training, pitch discrimination test, rhythm ear training, ear training in browser',
    og: {
      title: 'Ear Lab — an ear you can measure',
      description:
        'Thresholds in cents and milliseconds, chords named — one number that moves only when your ear does. Calibrate, then practise where the reading says.',
      image: 'https://mercurypitch.com/ear-lab-og.png',
      imageAlt:
        'MercuryPitch Ear Lab — a chronometer workshop at night, the Mercury Column standing at 618, and three readings: Hairline 6.4 cents, the Grid 18 ms, Mercury Index 618.',
    },
    twitter: {
      title: 'Ear Lab — an ear you can measure',
      description:
        'Thresholds in cents and milliseconds, chords named — one number that moves only when your ear does.',
    },
    h1: 'Ear Lab — ear training measured in real units',
    lede: 'A bench that reads in cents, milliseconds and notes — real units, not a grade. Calibrate once, then practise at whichever faculty is neediest: pitch resolution, harmony, melody, timbre and time. Everything is measured, nothing is guessed.',
    app: {
      name: 'Ear Lab',
      category: 'MusicApplication',
      description:
        'A browser ear-training bench measured in cents, milliseconds and notes — real units rather than a grade.',
    },
    noscript:
      'Ear Lab needs JavaScript — the instruments, the readings and the audio all run right here in your browser.',
  },
  {
    slug: 'jam',
    paths: ['/jam', '/jam-rooms'],
    navLabel: 'Jam Rooms',
    boot: '/src/index.tsx',
    bootHash: '#/jam',
    title: 'Jam Rooms — Sing Together From Anywhere | MercuryPitch',
    description:
      'Open a room, share the link, and sing a song together. Lyrics down the left, a live pitch lane for every singer in their own colour, and one shared transport.',
    keywords:
      'sing together online, online jam room, group karaoke online, harmony practice, sing with friends remotely',
    og: {
      title: 'Jam Rooms — sing it together, from anywhere',
      description:
        'Open a room, share the link, and take a part. A live pitch lane for every singer, and one scoreboard for the whole room.',
      image: 'https://mercurypitch.com/jam-og.png',
      imageAlt:
        'MercuryPitch Jam Rooms — a rehearsal room with a mic and drum kit, and a panel showing three singers, each with their own pitch lane and a shared score.',
    },
    twitter: {
      title: 'Jam Rooms — sing it together, from anywhere',
      description:
        'A live pitch lane for every singer, and one scoreboard for the whole room. In your browser.',
    },
    h1: 'Jam Rooms — sing together from anywhere',
    lede: 'Open a room, share the link, and sing a song together. Lyrics down the left, a live pitch lane for every singer in their own colour, and one transport that keeps every room in step.',
    app: {
      name: 'Jam Rooms',
      category: 'MusicApplication',
      description:
        'Peer-to-peer browser rooms for singing together, with a live pitch lane for every singer and one shared transport.',
    },
    noscript:
      'Jam Rooms needs JavaScript — the room, the lyrics and the live scoring all run right here in your browser.',
  },
  // ---------------------------------------------------------------------------
  // Search-intent pages. Each answers one query cluster the studio already
  // serves but had no document for, so the intent had nowhere to land. They
  // boot the same rooms as the entries above — these are front doors, not
  // new features.
  // ---------------------------------------------------------------------------
  {
    slug: 'pitch-training',
    paths: ['/pitch-training'],
    navLabel: 'Pitch Training',
    boot: '/src/index.tsx',
    bootHash: '#/exercises',
    title:
      'Vocal Pitch Practice — Free Pitch Training with Live Feedback | MercuryPitch',
    description:
      'Practise singing on pitch and watch the note you are making against the note you meant. Free, runs in your browser, and scores every attempt in cents.',
    keywords:
      'vocal pitch practice, pitch training, pitch trainer, sing on pitch, pitch accuracy, vocal pitch monitor, pitch matching',
    og: {
      title: 'Vocal Pitch Practice — Free Pitch Training with Live Feedback',
      description:
        'See the note you are making against the note you meant, and how far apart they are in cents. Free, in your browser.',
      imageAlt:
        'MercuryPitch pitch practice showing a sung note tracked against its target.',
    },
    twitter: {
      title: 'Vocal Pitch Practice — Free Pitch Training with Live Feedback',
      description:
        'Practise on pitch with live feedback measured in cents. Free, in your browser, audio stays on your device.',
    },
    h1: 'Practise singing on pitch, and see the proof',
    lede: 'Most pitch practice ends with a feeling. This ends with a number. Hold a note, run a scale or chase a moving target, and MercuryPitch draws what you actually sang against what you meant, measuring the gap in cents rather than telling you it was close.',
    app: {
      name: 'MercuryPitch Pitch Training',
      category: 'MusicApplication',
      description:
        'Browser pitch-training exercises with live feedback: sustained notes, sirens, slides, intervals, scales, staccato and vibrato, each scored against a target in cents.',
    },
    faq: [
      {
        q: 'How do I practise singing on pitch?',
        a: 'Start with one sustained note and hold it steady, because everything else is built on that. MercuryPitch shows your pitch as a live line against the target, so you can hear and see the correction at the same time. From there the exercises move on to sirens and slides, intervals, scales, staccato attacks and vibrato control.',
      },
      {
        q: 'What counts as good pitch accuracy?',
        a: 'It is measured in cents — hundredths of a semitone. Most listeners stop hearing a note as out of tune somewhere under about 20 cents on a sustained tone, and trained singers hold much tighter than that. MercuryPitch reports the real figure instead of a percentage, so progress is visible even when it is small.',
      },
      {
        q: 'Do I need an instrument or a teacher?',
        a: 'No. The target notes are generated for you and the scoring is automatic, so a microphone and a browser are enough. It does not replace a singing teacher, and does not claim to — it gives you something specific to bring to one.',
      },
    ],
    noscript:
      'Pitch training needs JavaScript — your voice is analyzed here in your browser and never uploaded.',
  },
  {
    slug: 'voice-type-test',
    paths: ['/voice-type-test'],
    navLabel: 'Voice Type Test',
    boot: '/src/features/mirror/main.tsx',
    title:
      'Voice Type Test — Am I a Soprano, Alto, Tenor or Bass? | MercuryPitch',
    description:
      'Sing a low-to-high glide and see which voice band your measured range overlaps most: soprano, mezzo, alto, tenor, baritone or bass. Free, in your browser.',
    keywords:
      'voice type test, what is my voice type, am i a soprano or alto, tenor or baritone, singing voice type, voice classification',
    og: {
      title: 'Voice Type Test — Soprano, Alto, Tenor or Bass?',
      description:
        'Sing one glide and see which voice band your measured range overlaps most. A guide, not a verdict.',
      imageAlt:
        'MercuryPitch voice type result showing a measured range against the standard voice bands.',
    },
    twitter: {
      title: 'Voice Type Test — Soprano, Alto, Tenor or Bass?',
      description:
        'See which voice band your measured range overlaps most. Free, and your audio stays on your device.',
    },
    h1: 'Voice type test',
    lede: 'Sing one comfortable glide from your lowest note to your highest. MercuryPitch measures the notes you actually reached and shows which of the standard bands — soprano, mezzo-soprano, alto, tenor, baritone or bass — your range overlaps most.',
    app: {
      name: 'MercuryPitch Voice Type Test',
      category: 'MusicApplication',
      description:
        'A browser voice-type test: measures your sung range and shows the standard voice band it overlaps most, presented as a guide rather than a classification.',
    },
    faq: [
      {
        q: 'How do I find out my voice type?',
        a: 'Sing a comfortable siren from low to high and back down. MercuryPitch takes the lowest and highest notes it heard reliably and compares that span against the standard bands. It takes about ninety seconds and needs no piano.',
      },
      {
        q: 'Is voice type the same as vocal range?',
        a: 'No, and this is the thing most tests get wrong. Range is the notes you can produce; voice type also depends on tessitura — where your voice sits comfortably for a long time — as well as timbre, register transitions and training. Two singers with the same range can be different voice types.',
      },
      {
        q: 'Can a test really tell me if I am a soprano or an alto?',
        a: 'Not on its own, and MercuryPitch does not pretend otherwise. What it gives you is the measured evidence — your real notes, in real units — and the band that best overlaps them. Treat the label as a starting point for a conversation with a teacher, not a verdict.',
      },
    ],
    noscript:
      'The voice type test needs JavaScript — your voice is analyzed here in your browser and never uploaded.',
  },
  {
    slug: 'vocal-remover',
    paths: ['/vocal-remover'],
    navLabel: 'Vocal Remover',
    boot: '/src/features/karaoke-night/main.tsx',
    title:
      'Free Vocal Remover — Split a Song into Vocals and Instrumental | MercuryPitch',
    description:
      'Take out the vocal and keep the backing track, or keep the vocal alone. Separate a song you already own in your own browser, then sing over the result.',
    keywords:
      'vocal remover, remove vocals from song, karaoke maker, instrumental maker, voice isolator, stem separation, acapella extractor',
    og: {
      title: 'Free Vocal Remover — Vocals and Instrumental, Split Apart',
      description:
        'Separate a song you already own into vocal and instrumental, in your own browser, then sing over it with live pitch scoring.',
      imageAlt:
        'MercuryPitch Karaoke Night showing a separated instrumental track with timed lyrics.',
    },
    twitter: {
      title: 'Free Vocal Remover — Vocals and Instrumental, Split Apart',
      description:
        'Split a song you own into vocal and instrumental, then sing over the backing track with live scoring.',
    },
    h1: 'Vocal remover — take the voice out, keep the song',
    lede: 'Drop in a song you already own and MercuryPitch separates it into a vocal track and an instrumental one. Keep the instrumental as a backing track, or keep the vocal on its own to study how the line is actually sung. Then sing over it, with your pitch scored live against the original melody.',
    app: {
      name: 'MercuryPitch Vocal Remover',
      category: 'MultimediaApplication',
      description:
        'Browser vocal removal and stem separation: splits a song the visitor already owns into vocal and instrumental tracks, in the browser or optionally on a server, and feeds the result into karaoke practice with live pitch scoring.',
    },
    faq: [
      {
        q: 'How do I remove the vocals from a song?',
        a: 'Open a file you already own and choose separation. MercuryPitch splits it into a vocal track and an instrumental one and keeps both, so you can mute either side. The separated stems are stored in your own browser, not on a server.',
      },
      {
        q: 'Does the separation happen on my device?',
        a: 'By default yes — it runs in your browser and the file never leaves your machine. There is also an optional server-side pass using a higher-quality model for the times a laptop cannot manage it, and that one is a deliberate choice you make per song, not the default.',
      },
      {
        q: 'What can I use it on?',
        a: 'Music you already own. MercuryPitch does not host, supply or download music, and there is no catalogue to search — you bring the file. What you do with the result is subject to the rights on the original recording.',
      },
    ],
    noscript:
      'The vocal remover needs JavaScript — separation and playback both run right here in your browser.',
  },
  {
    slug: 'which-singer-has-my-vocal-range',
    paths: ['/which-singer-has-my-vocal-range'],
    navLabel: 'Singer Match',
    boot: '/src/features/mirror/main.tsx',
    title: 'Which Singer Has My Vocal Range? Match Your Voice | MercuryPitch',
    description:
      'Sing one glide, get your measured range, and see which famous singer covers the same notes. Free, about ninety seconds, and your audio stays on your device.',
    keywords:
      'which singer has my vocal range, singer with my voice, vocal range match, famous singer vocal ranges, what singer do i sound like',
    og: {
      title: 'Which Singer Has My Vocal Range?',
      description:
        'Sing one glide and see which famous singer covers the same notes you do. Free, and your audio never leaves your device.',
      imageAlt:
        'MercuryPitch reveal card showing a measured vocal range beside a matched singer.',
    },
    twitter: {
      title: 'Which Singer Has My Vocal Range?',
      description:
        'One glide, your measured range, and the singer who covers the same notes. Free, in your browser.',
    },
    h1: 'Which singer has my vocal range?',
    lede: 'Sing one glide from your lowest comfortable note to your highest. MercuryPitch measures the notes you actually reached and shows you a singer whose range covers the same ground, on a card you can keep or share.',
    app: {
      name: 'MercuryPitch Singer Match',
      category: 'MusicApplication',
      description:
        'Measures a vocal range in the browser and matches it against the ranges of well-known singers, producing a shareable card.',
    },
    faq: [
      {
        q: 'How does the match work?',
        a: 'It compares the lowest and highest notes MercuryPitch measured from your glide against the ranges well-known singers are documented as covering, and shows the closest fit. The comparison is arithmetic on notes, not an opinion about your voice.',
      },
      {
        q: 'Does matching a singer mean I sound like them?',
        a: 'No. It means you cover similar notes. Timbre, weight, vibrato, accent and technique are what make a voice recognisable, and none of those are being compared here. Someone can share a range with a singer and sound nothing like them.',
      },
      {
        q: 'Do I need to sing well to get a result?',
        a: 'No. The measurement is of which notes you reached, not how good they sounded, so a rough glide still gives a usable range. Sing at a comfortable volume and do not push for extra notes at either end — a strained note is not part of your working range.',
      },
    ],
    noscript:
      'The singer match needs JavaScript — your voice is analyzed here in your browser and never uploaded.',
  },
]

/** Canonical path for a page — what its <link rel="canonical"> points at. */
export function canonicalPath(page: EntryPage): string {
  return page.paths[0]
}

/** Every clean path the whole set answers, for the dev and worker route tables. */
export function allEntryPaths(): string[] {
  return ENTRY_PAGES.flatMap((page) => [...page.paths])
}

/** The cross-links shown on `page`: Home, every other entry, then About. */
export function navLinksFor(
  page: EntryPage,
): { href: string; label: string }[] {
  return [
    { href: '/', label: 'Home' },
    ...ENTRY_PAGES.filter((other) => other.slug !== page.slug).map((other) => ({
      href: canonicalPath(other),
      label: other.navLabel,
    })),
    { href: ABOUT_URL, label: 'About MercuryPitch' },
  ]
}
