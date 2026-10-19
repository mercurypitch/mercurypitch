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

import type { StoreListings } from '../lib/store-listings'
import { STORE_LISTINGS, storeLinks } from '../lib/store-listings'
import { OG_IMAGE_VERSIONS } from './og-image-versions.ts'

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
  /**
   * `image` defaults to the shared OG card; most rooms ship their own.
   * `imageAlt` is required: it is emitted as both og:image:alt and
   * twitter:image:alt. `imageSize` defaults to OG_IMAGE_SIZE and must be the
   * file's real size (entry-page-og.test.ts reads the file to check).
   */
  og: {
    title: string
    description: string
    image?: string
    imageAlt: string
    imageSize?: { width: number; height: number }
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
  /** The browser chrome's color. Defaults to DEFAULT_THEME_COLOR; the Voice
   *  Mirror's documents use the ground their start screen stands on. */
  themeColor?: string
}

export const DEFAULT_THEME_COLOR = '#0b1026'
/** The onboarding's ground (--ob-ground in src/features/mirror/mirror.css). */
const MIRROR_THEME_COLOR = '#0d1117'

export const SITE_ORIGIN = 'https://mercurypitch.com'

/**
 * A card's public URL, stamped with the hash of its own bytes.
 *
 * Social platforms cache an Open Graph image against its URL for days or
 * weeks, and nothing we can do reaches their caches. Regenerating a card in
 * place therefore leaves every link ever shared showing the old art — which is
 * what the 2026-09-10 refresh ran into: Guitar Night had gained Free play and
 * the shared card still offered "I know my way around". The stamp comes from
 * `scripts/gen-og-versions.mjs`, so new art is a new link.
 */
export function ogImage(file: string): string {
  const version = OG_IMAGE_VERSIONS[file]
  return version === undefined
    ? `${SITE_ORIGIN}/${file}`
    : `${SITE_ORIGIN}/${file}?v=${version}`
}

export const OG_IMAGE = ogImage('og-image.png')
/** What every generated card measures, unless its entry says otherwise. */
export const OG_IMAGE_SIZE = { width: 1200, height: 630 } as const
export const ABOUT_URL = 'https://about.mercurypitch.com/'

/**
 * The structured-data identities the documents share. index.html defines the
 * organization, the website and the studio; an entry document links to them
 * by `@id`, with the name and URL repeated so the page still describes itself
 * to a reader that does not follow the link. The landing
 * (about.mercurypitch.com) uses the same organization `@id`, so a search
 * engine reads one MercuryPitch rather than two.
 */
export const ORGANIZATION_ID = `${SITE_ORIGIN}/#organization`
export const WEBSITE_ID = `${SITE_ORIGIN}/#website`
export const STUDIO_APP_ID = `${SITE_ORIGIN}/#app`

export const ENTRY_PAGES: readonly EntryPage[] = [
  {
    slug: 'mirror',
    paths: ['/mirror', '/free-sing'],
    navLabel: 'Voice Mirror',
    boot: '/src/features/mirror/main.tsx',
    themeColor: MIRROR_THEME_COLOR,
    title: 'Voice Mirror: See Your Voice in 60 Seconds | MercuryPitch',
    description:
      'See your voice in 60 seconds: your vocal range, pitch accuracy and steadiness as a shareable voiceprint. Free, in your browser.',
    og: {
      title: 'Voice Mirror — See Your Voice in 60 Seconds',
      description:
        'Your range, accuracy and steadiness as a voiceprint to share, plus a famous singer of your voice type.',
      image: ogImage('mirror-og.png'),
      imageAlt:
        'A pitch contour rising, holding level, then falling — two glides around one steady note.',
    },
    twitter: {
      title: 'Voice Mirror — See Your Voice in 60 Seconds',
      description:
        'Your vocal range, accuracy and steadiness as a shareable voiceprint. Free, in your browser.',
    },
    h1: 'Voice Mirror — see your voice in 60 seconds',
    lede: 'Sing two sirens and hold one note. Voice Mirror reads back your vocal range, your pitch accuracy in cents and how steady you held, then places your range in one of six voice types and names a famous singer of that type. Free, no account, and only you can hear you.',
    app: {
      name: 'Voice Mirror',
      category: 'MusicApplication',
      description:
        'A browser vocal check: two sirens and one held note give back your vocal range, pitch accuracy in cents and steadiness as a shareable voiceprint, with a broad voice type.',
    },
    faq: [
      {
        q: 'What is my vocal range?',
        a: 'Your vocal range is the span from the lowest to the highest note you can comfortably sing. Voice Mirror measures it in under a minute from a glide up and a glide down, in your browser.',
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
    noscript:
      'Voice Mirror needs JavaScript — your voice is analyzed right here in your browser.',
  },
  {
    slug: 'vocal-range-test',
    paths: ['/vocal-range-test'],
    navLabel: 'Vocal Range Test',
    boot: '/src/features/mirror/main.tsx',
    themeColor: MIRROR_THEME_COLOR,
    title: 'Free Vocal Range Test: Lowest & Highest Note | MercuryPitch',
    description:
      'Glide from your lowest note to your highest and get both notes, your span in semitones and a voice-type guide. Free, in your browser.',
    og: {
      title: 'Free Vocal Range Test — Find Your Lowest & Highest Note',
      description:
        'Glide from your lowest note to your highest and get both notes, your span in semitones and a broad voice-type guide.',
      image: ogImage('vocal-range-test-og.png'),
      imageAlt:
        'A measured vocal span marked on a pitch ruler, with the lowest and highest notes lit at each end.',
    },
    twitter: {
      title: 'Free Vocal Range Test — Find Your Lowest & Highest Note',
      description:
        'Get your measured notes, semitone span and a broad voice-type guide. Free, in your browser.',
    },
    h1: 'Free vocal range test',
    lede: 'Glide from your lowest comfortable note to your highest and get both notes, your span in semitones and a broad voice-type guide. It runs in your browser and needs no piano and no teacher. The timed part takes about a minute, and each step waits until you are ready.',
    app: {
      name: 'MercuryPitch Vocal Range Test',
      category: 'MusicApplication',
      description:
        'A browser vocal range test: a glide from the lowest comfortable note to the highest gives both notes, the span in semitones and a broad voice-type guide.',
    },
    faq: [
      {
        q: 'How do I test my vocal range?',
        a: 'Sing a comfortable siren glide from low to high and back down. MercuryPitch measures sustained notes from both glides and reports the lowest and highest notes that were heard reliably.',
      },
      {
        q: 'Does vocal range determine my voice type?',
        a: 'Not by itself. MercuryPitch shows the broad voice type whose range overlaps yours most, but voice type also depends on comfortable tessitura, tone and training. Treat the label as a guide, not a verdict.',
      },
      {
        q: 'Is this vocal range test free?',
        a: 'Yes. The test runs in your browser, and your result is built from the notes and pitch it measures.',
      },
    ],
    noscript:
      'The vocal range test needs JavaScript — your voice is analyzed here in your browser.',
  },
  {
    slug: 'karaoke',
    paths: ['/karaoke-night', '/karaoke'],
    navLabel: 'Karaoke Night',
    boot: '/src/features/karaoke-night/main.tsx',
    title: 'Karaoke Night: Turn Your Songs Into Karaoke | MercuryPitch',
    description:
      'Upload any song, the vocals lift away, and you sing with synced lyrics and live pitch scoring — right in your browser. Try the example song free.',
    og: {
      title: 'Karaoke Night: Turn any song into karaoke',
      description:
        'The vocals lift away and you sing with synced lyrics and live pitch scoring. In your browser — try the example song free.',
      image: ogImage('karaoke-og.png'),
      imageAlt:
        'MercuryPitch Karaoke Night — turn any song into karaoke on a theater stage, with the demo song Goodbye to Spring ready to sing.',
    },
    twitter: {
      title: 'Karaoke Night: Turn any song into karaoke',
      description:
        'Vocal removal + synced lyrics + live pitch scoring, in your browser. Try the example song free.',
    },
    h1: 'Karaoke Night — turn any song into karaoke',
    lede: 'Bring any song. The vocals lift away, the lyrics arrive in time, and every note you sing is drawn against the one you were aiming for. Loop the bar you keep missing, slow it down, and hear your own take back. The example song is free.',
    app: {
      name: 'Karaoke Night',
      category: 'MusicApplication',
      description:
        'Browser karaoke from songs the singer owns or the free example songs: vocal separation, synced lyrics, live pitch scoring against the original melody, key change and playlists.',
    },
    faq: [
      {
        q: 'How do I make a karaoke version of a song?',
        a: 'Upload any song and MercuryPitch separates the vocals from the instruments. You get a karaoke-ready mix with adjustable vocal level, synced lyrics and live pitch scoring, all in your browser.',
      },
      {
        q: 'Does it work with any song?',
        a: 'It works with audio files from your own library. A free on-device mode runs entirely in your browser; a studio-quality server mode is available for the cleanest separation.',
      },
      {
        q: 'Can it score my singing?',
        a: 'Yes. Enable your microphone and MercuryPitch tracks your pitch against the original vocal melody in real time, drawing every note you sing and scoring your performance.',
      },
      {
        q: 'Can I change the key of a song?',
        a: 'Yes. The key chip beside Speed moves a song up or down by up to six semitones at the same tempo, and Find my key picks a key from your vocal range. This device remembers the key you chose for each song, and a playlist entry can carry a key of its own.',
      },
    ],
    noscript:
      'Karaoke Night needs JavaScript — the mixing, lyrics and scoring all run right here in your browser.',
  },
  {
    slug: 'glass-game',
    paths: ['/glass-game'],
    navLabel: 'Glassworks',
    boot: '/src/features/glass-adventure/main.tsx',
    title: 'Glassworks: Explore a Museum With Your Voice | MercuryPitch',
    description:
      'Explore a floating glass museum, discover your comfortable notes, and open each gallery by singing. Free, with microphone audio processed on your device.',
    og: {
      title: 'Glassworks — A Museum That Opens to Your Voice',
      description:
        'Walk the galleries, listen for the note, and sing the glass open. A free voice-controlled museum adventure.',
      imageAlt:
        'MercuryPitch Glassworks, a floating museum whose glass exhibits open when you sing their notes.',
    },
    twitter: {
      title: 'Glassworks — A Museum That Opens to Your Voice',
      description:
        'Explore the galleries and sing the glass open. Free in your browser, with audio processed on your device.',
    },
    h1: 'Glassworks — a museum that listens',
    lede: 'Walk through a floating museum with Merc, listen to each glass exhibit, and answer with your own voice. Every gallery teaches one small musical idea, saves independently, and lets you return at your own pace.',
    app: {
      name: 'Glassworks',
      category: 'GameApplication',
      description:
        'A browser museum adventure controlled by movement and sung notes, with microphone audio processed on the player’s device.',
    },
    noscript:
      'Glassworks needs JavaScript for its museum, movement and on-device voice analysis.',
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
    title: 'Break Glass With Your Voice: Free Challenge | MercuryPitch',
    description:
      'Sing up to the note the glass rings at, hold it, and shatter it. A free challenge in your browser, tuned to your own range.',
    og: {
      title: 'Break Glass With Your Voice — Free 60-Second Challenge',
      description:
        'The glass is tuned to YOUR range. Land the note, hold it, and watch it shatter — with real physics, in your browser.',
      image: ogImage('glass/og.jpg'),
      imageSize: { width: 1200, height: 670 },
      imageAlt:
        'A wine glass ringing at its resonant note, one held voice note away from shattering.',
    },
    twitter: {
      title: 'Break Glass With Your Voice',
      description:
        'Can you hold the note that breaks the glass? Free, in your browser, tuned to your own range.',
    },
    h1: 'Break glass with your voice',
    lede: 'The pane rings at a note picked from your own range. Sing up to it, hold it, and watch the cracks spread. A free in-browser challenge that plays your take back to you between attempts, with your audio never leaving your device.',
    app: {
      name: 'Break Glass',
      category: 'GameApplication',
      description:
        'A sixty-second browser challenge: sing up to the note a glass rings at, picked from your own range, and hold it steady enough to shatter it.',
    },
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
    noscript:
      'Glass needs JavaScript — your voice is analyzed right here in your browser.',
  },
  {
    slug: 'piano-night',
    paths: ['/piano-night'],
    navLabel: 'Piano Night',
    boot: '/src/features/piano-night/main.tsx',
    title: 'Piano Night: Practice Piano Phrase by Phrase | MercuryPitch',
    description:
      'Slow a phrase down, loop the bar that will not sit, and play it back up to tempo — in your browser, with your own MIDI keyboard or the keys on screen.',
    og: {
      title: 'Piano Night — shape every phrase',
      description:
        'A focused piano room for practicing and performing. Slow a phrase down, loop the bar that will not sit, and play it back up to tempo.',
      image: ogImage('piano-night-og.png'),
      imageAlt:
        'MercuryPitch Piano Night — a low-lit studio with a grand piano at dusk, and the panel offering the rooms to play in.',
    },
    twitter: {
      title: 'Piano Night — shape every phrase',
      description:
        'A focused piano room for practicing and performing. Loop the bar that will not sit, and play it back up to tempo.',
    },
    h1: 'Piano Night — practice piano, phrase by phrase',
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
    title: 'Guitar Night: A Room That Reads Your Playing | MercuryPitch',
    description:
      'A guitar rehearsal room in your browser. Begin on one open string or bring a song of your own — the room listens and reads the bar back to you as tab.',
    og: {
      title: 'Guitar Night — your room is ready',
      description:
        'Begin with one string, bring a song, or step straight into the full workspace. The room listens and reads the bar back to you.',
      image: ogImage('guitar-night-og.png'),
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
    noscript: 'Guitar Night needs JavaScript to open the rehearsal room.',
  },
  {
    slug: 'drum-night',
    paths: ['/drum-night'],
    navLabel: 'Drum Night',
    boot: '/src/features/drum-night/main.tsx',
    title: 'Drum Night: Play Drums in Your Browser | MercuryPitch',
    description:
      'A drum room for touch, keys and e-kits, with synth and sampled kits, MIDI and Guitar Pro percussion, and Pocket, Drummer Seat and Score views.',
    og: {
      title: 'Drum Night — find the center',
      description:
        'Play synth and sampled kits from touch, keys or an e-kit, then follow imported percussion from the Pocket, Drummer Seat or written Score.',
      image: ogImage('drum-night-og.png'),
      imageAlt:
        'MercuryPitch Drum Night — an oxblood drum kit in a quiet late-night tracking room, framed by a circular pocket guide.',
    },
    twitter: {
      title: 'Drum Night — find the center',
      description:
        'Play synth and sampled kits from touch, keys or an e-kit, then follow imported percussion from the Pocket, Drummer Seat or written Score.',
    },
    h1: 'Drum Night — play the kit, then find the center of the beat',
    lede: 'A drum room for touch, keys and electronic kits. Import MIDI or Guitar Pro percussion, read the part as a pocket guide, from the drummer’s seat or as notation, and find the center of the beat with timing evidence rather than a grade.',
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
    title: 'Ear Lab: Ear Training Measured in Real Units | MercuryPitch',
    description:
      'An ear-training bench that reads in cents, milliseconds and notes — real units, not a grade. Calibrate once, then practice whichever faculty is neediest.',
    og: {
      title: 'Ear Lab — an ear you can measure',
      description:
        'Thresholds in cents and milliseconds, chords named — one number that moves only when your ear does. Calibrate, then practice where the reading says.',
      image: ogImage('ear-lab-og.png'),
      imageAlt:
        'MercuryPitch Ear Lab — a chronometer workshop at night, the Mercury Column standing at 618, and three readings: Hairline 6.4 cents, the Grid 18 ms, Mercury Index 618.',
    },
    twitter: {
      title: 'Ear Lab — an ear you can measure',
      description:
        'Thresholds in cents and milliseconds, chords named — one number that moves only when your ear does.',
    },
    h1: 'Ear Lab — ear training measured in real units',
    lede: 'A bench that reads in cents, milliseconds and notes — real units, not a grade. Calibrate once, then practice at whichever faculty is neediest: pitch resolution, harmony, melody, timbre and time. Everything is measured, nothing is guessed.',
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
    title: 'Jam Rooms: Sing Together From Anywhere | MercuryPitch',
    description:
      'Open a room, share the link, and sing a song together. Lyrics down the left, a live pitch lane for every singer in their own color, and one shared transport.',
    og: {
      title: 'Jam Rooms — sing it together, from anywhere',
      description:
        'Open a room, share the link, and take a part. Lyrics down the left and a live pitch lane for every singer.',
      image: ogImage('jam-og.png'),
      imageAlt:
        'MercuryPitch Jam Rooms: a rehearsal room with a mic and drum kit, and a panel showing three singers, each on their own pitch lane, above your own take score.',
    },
    twitter: {
      title: 'Jam Rooms — sing it together, from anywhere',
      description:
        'Take a part and sing it with friends, each on a live pitch lane of their own. In your browser.',
    },
    h1: 'Jam Rooms — sing together from anywhere',
    lede: 'Open a room, share the link, and sing a song together. Lyrics down the left, a live pitch lane for every singer in their own color, and one transport that keeps every room in step.',
    app: {
      name: 'Jam Rooms',
      category: 'MusicApplication',
      description:
        'Peer-to-peer browser rooms for singing together, with a live pitch lane for every singer and one shared transport.',
    },
    faq: [
      {
        q: 'How do I sing karaoke with friends online?',
        a: 'Open a Jam Room and share its link. Everyone who opens it joins the same room in their own browser, with the lyrics down the left, a pitch lane of their own, and one shared transport that keeps the room in step.',
      },
      {
        q: 'How many people can sing in one room?',
        a: 'Up to twelve. Every singer sings in their own color on a pitch lane of their own, every line is scored as it goes past, and the room shares one scoreboard.',
      },
      {
        q: 'Can we sing our own songs together?',
        a: "Yes. Songs you separated in Karaoke Night and songs of your own are in the room's picker and stream to everyone in it. The host can hand lines out to each singer, so a duet or a chorus splits the way you want it to.",
      },
    ],
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
    title: 'Vocal Pitch Practice: Free Pitch Training | MercuryPitch',
    description:
      'Practice singing on pitch and watch the note you are making against the note you meant. Free, runs in your browser, and scores every finished run out of 100.',
    og: {
      title: 'Vocal Pitch Practice — Free Pitch Training with Live Feedback',
      description:
        'See the note you are making against the note you meant, then where you drifted furthest after each run, in cents. Free, in your browser.',
      image: ogImage('pitch-training-og.png'),
      imageAlt:
        'A pitch readout: the note being sung tracked against its target line, the gap between them lit where they meet.',
    },
    twitter: {
      title: 'Vocal Pitch Practice — Free Pitch Training with Live Feedback',
      description:
        'Practice on pitch with live feedback, then see where you drifted furthest after each run, in cents. Free, in your browser.',
    },
    h1: 'Practice singing on pitch, and see the proof',
    lede: 'Most pitch practice ends with a feeling. This ends with a number. Hold a note, run a scale or chase a moving target, and MercuryPitch draws what you actually sang against what you meant. After each run you get a score out of 100 and the spot where you drifted furthest, in cents, rather than being told it was close.',
    app: {
      name: 'MercuryPitch Pitch Training',
      category: 'MusicApplication',
      description:
        'Browser pitch-training exercises with live feedback: sustained notes, sirens, slides, intervals, scales, staccato and vibrato, each finished run scored out of 100, with the furthest drift from the target shown in cents.',
    },
    faq: [
      {
        q: 'How do I practice singing on pitch?',
        a: 'Start with one sustained note and hold it steady, because everything else is built on that. MercuryPitch shows your pitch as a live line against the target, so you can hear and see the correction at the same time. From there the exercises move on to sirens and slides, intervals, scales, staccato attacks and vibrato control.',
      },
      {
        q: 'What counts as good pitch accuracy?',
        a: 'Pitch distance is measured in cents, hundredths of a semitone. Most listeners stop hearing a note as out of tune somewhere under about 20 cents on a sustained tone, and trained singers hold much tighter than that. After each run MercuryPitch shows where you drifted furthest from the target, in cents, next to a score out of 100, so you can see a small gain.',
      },
      {
        q: 'Do I need an instrument or a teacher?',
        a: 'No. The target notes are generated for you and the scoring is automatic, so a microphone and a browser are enough. It does not replace a singing teacher, and does not claim to — it gives you something specific to bring to one.',
      },
    ],
    noscript:
      'Pitch training needs JavaScript — your voice is analyzed here in your browser.',
  },
  {
    slug: 'voice-type-test',
    paths: ['/voice-type-test'],
    navLabel: 'Voice Type Test',
    boot: '/src/features/mirror/main.tsx',
    themeColor: MIRROR_THEME_COLOR,
    title: 'Voice Type Test: Soprano, Alto, Tenor, Bass | MercuryPitch',
    description:
      'Find your range with a low-to-high glide and see which voice type it overlaps most: soprano, mezzo, alto, tenor, baritone or bass. Free, in your browser.',
    og: {
      title: 'Voice Type Test — Soprano, Alto, Tenor or Bass?',
      description:
        'Glide from your lowest note to your highest and see which voice type your measured range overlaps most. A guide, not a verdict.',
      image: ogImage('voice-type-test-og.png'),
      imageAlt:
        'Voice types stacked from bass to soprano on a pitch scale, with one lit to show the measured range.',
    },
    twitter: {
      title: 'Voice Type Test — Soprano, Alto, Tenor or Bass?',
      description:
        'Find your range and see which voice type it overlaps most. Free, in your browser.',
    },
    h1: 'Voice type test',
    lede: 'Sing one comfortable glide from your lowest note to your highest. MercuryPitch measures the notes you actually reached and shows which of six voice types (soprano, mezzo-soprano, alto, tenor, baritone or bass) your range overlaps most.',
    app: {
      name: 'MercuryPitch Voice Type Test',
      category: 'MusicApplication',
      description:
        'A browser voice-type test: measures your sung range and shows the standard voice type whose range it overlaps most, presented as a guide rather than a classification.',
    },
    faq: [
      {
        q: 'How do I find out my voice type?',
        a: 'Sing a comfortable siren from low to high and back down. MercuryPitch takes the lowest and highest notes it heard reliably and compares that span with the typical ranges of six voice types. The timed part takes about a minute, each step waits until you are ready, and you need no piano.',
      },
      {
        q: 'Is voice type the same as vocal range?',
        a: 'No, and this is the thing most tests get wrong. Range is the notes you can produce; voice type also depends on tessitura — where your voice sits comfortably for a long time — as well as timbre, register transitions and training. Two singers with the same range can be different voice types.',
      },
      {
        q: 'Can a test really tell me if I am a soprano or an alto?',
        a: 'Not on its own, and MercuryPitch does not pretend otherwise. What it gives you is the measured evidence — your real notes, in real units — and the voice type whose range best overlaps them. Treat the label as a starting point for a conversation with a teacher, not a verdict.',
      },
    ],
    noscript:
      'The voice type test needs JavaScript — your voice is analyzed here in your browser.',
  },
  {
    slug: 'vocal-remover',
    paths: ['/vocal-remover'],
    navLabel: 'Vocal Remover',
    boot: '/src/features/karaoke-night/main.tsx',
    title: 'Free Vocal Remover: Vocals and Instrumental | MercuryPitch',
    description:
      'Take out the vocal and keep the backing track, or keep the vocal alone. Separate a song you already own in your own browser, then sing over the result.',
    og: {
      title: 'Free Vocal Remover — Vocals and Instrumental, Split Apart',
      description:
        'Separate a song you already own into vocal and instrumental, in your own browser, then sing over it with live pitch scoring.',
      image: ogImage('karaoke-og.png'),
      imageAlt:
        'MercuryPitch Karaoke Night showing a separated instrumental track with timed lyrics.',
    },
    twitter: {
      title: 'Free Vocal Remover — Vocals and Instrumental, Split Apart',
      description:
        'Split any song into vocal and instrumental, then sing over the backing track with live scoring.',
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
        a: 'Music you already own. Apart from the few example songs in Karaoke Night, MercuryPitch does not host, supply or download music, and there is no catalog to search: you bring the file. What you do with the result is subject to the rights on the original recording.',
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
    themeColor: MIRROR_THEME_COLOR,
    title: 'Which Singer Has My Vocal Range? | MercuryPitch',
    description:
      'Find your range in 60 seconds, see which voice type it overlaps most, and meet a famous singer of that type. Free, in your browser.',
    og: {
      title: 'Which Singer Has My Vocal Range?',
      description:
        'Find your range, see which voice type it overlaps most, and meet a famous singer of that type.',
      image: ogImage('which-singer-has-my-vocal-range-og.png'),
      imageAlt:
        'Two vocal ranges drawn as spans on a scale, the stretch they share lit between them.',
    },
    twitter: {
      title: 'Which Singer Has My Vocal Range?',
      description:
        'Your measured range, the voice type it overlaps most, and a famous singer of that type. Free, in your browser.',
    },
    h1: 'Which singer has my vocal range?',
    lede: 'Glide from your lowest comfortable note to your highest and back. MercuryPitch measures the notes you actually reached, places your range in one of six voice types and introduces a famous singer of that type, on a card you can keep or share.',
    app: {
      name: 'MercuryPitch Singer Match',
      category: 'MusicApplication',
      description:
        'Measures a vocal range in the browser, places it in one of six broad voice types and pairs it with a famous singer of that type, producing a shareable card.',
    },
    faq: [
      {
        q: 'How does the match work?',
        a: 'MercuryPitch compares the lowest and highest notes it measured from your glide with the typical ranges of six voice types, from bass to soprano, and picks the type your range overlaps most. You then meet a famous singer of that type, and the same range always meets the same singer. Picking the type is arithmetic on notes, not an opinion about your voice.',
      },
      {
        q: 'Does matching a singer mean I sound like them?',
        a: 'No. It means your range points to the broad voice type that singer is listed under. Timbre, weight, vibrato, accent and technique are what make a voice recognizable, and none of those are being compared here. Someone can share a voice type with a singer and sound nothing like them.',
      },
      {
        q: 'Do I need to sing well to get a result?',
        a: 'No. The measurement is of which notes you reached, not how good they sounded, so a rough glide still gives a usable range. Sing at a comfortable volume and do not push for extra notes at either end — a strained note is not part of your working range.',
      },
    ],
    noscript:
      'The singer match needs JavaScript — your voice is analyzed here in your browser.',
  },
  {
    slug: 'karaoke-app',
    paths: ['/karaoke-app'],
    navLabel: 'Karaoke App',
    boot: '/src/features/karaoke-night/main.tsx',
    title: 'Free Karaoke App: Lyrics and Live Scoring | MercuryPitch',
    description:
      'Sing karaoke in your browser on a phone, tablet or computer: synced lyrics, live pitch scoring, key change and playlists, with the example songs or your own.',
    og: {
      title: 'A free karaoke app with lyrics and live scoring',
      description:
        'Sing the example songs or songs you own, with synced lyrics, live pitch scoring, key change and playlists. In your browser, with nothing to install.',
      image: ogImage('karaoke-og.png'),
      imageAlt:
        'MercuryPitch Karaoke Night — turn any song into karaoke on a theater stage, with the demo song Goodbye to Spring ready to sing.',
    },
    twitter: {
      title: 'A free karaoke app with lyrics and live scoring',
      description:
        'Synced lyrics, live pitch scoring, key change and playlists, in your browser. Try an example song free.',
    },
    h1: 'A free karaoke app with lyrics and live scoring',
    lede: 'MercuryPitch is a free karaoke app that runs in your browser on a phone, a tablet or a computer, with nothing to install. Sing one of the example songs, or bring a song you own: the original vocal is separated out, synced lyrics are looked up for it, and every note you sing is scored live against the original melody. Change the key, slow a hard line down, and line up a whole night of songs in a playlist.',
    app: {
      name: 'MercuryPitch Karaoke',
      category: 'MusicApplication',
      description:
        'A free browser karaoke app: example songs or songs the singer owns, vocal separation, synced lyrics, live pitch scoring against the original melody, key change, playlists with a singer per song, and Jam Rooms for singing together.',
    },
    faq: [
      {
        q: 'Is there a free karaoke app that scores your singing?',
        a: 'Yes. MercuryPitch is free and runs in your browser. Turn on your microphone and it follows your pitch against the original vocal melody as you sing, draws every note against the one you were aiming for, and scores the song. The example songs and the on-device vocal separation cost nothing; an optional server pass for the cleanest separation uses credits.',
      },
      {
        q: 'Can I sing my own songs?',
        a: 'Yes, from audio files you own. MercuryPitch separates the vocal from the instruments so you can turn the original singer down or off, and looks up synced lyrics for the song. It is not a music service: apart from a few example songs it hosts no catalog, so you bring the file.',
      },
      {
        q: 'Can friends sing with me?',
        a: 'Yes, in two ways. In a playlist each song can have its own singer, and the night steps from one song to the next with a score after each. Jam Rooms put up to twelve singers, each on their own device, in one room with a live pitch lane apiece.',
      },
      {
        q: 'Does it work on a TV?',
        a: "A TV's browser can play songs you prepared on a phone or computer while signed in, with the lyrics on the big screen, and the example songs play there too. Most TV browsers cannot use a microphone, so singing with live scoring needs a phone, a tablet or a computer for now.",
      },
      {
        q: 'Is there a MercuryPitch app for iPhone or Android?',
        a: nativeAppsAnswer(),
      },
    ],
    noscript:
      'The karaoke app needs JavaScript — the stage, the lyrics and the scoring all run in your browser.',
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

/**
 * The cross-links shown on `page`: Home, the released lessons, every other
 * entry, then About. The lessons come from the build (tools/lesson-links.ts),
 * which reads them off learn/; this file stays free of the file system.
 * With no page (the error pages, src/error-kit/), every entry is linked.
 *
 * `unlisted` names entries this build serves but does not advertise — today
 * only Glassworks on the production web build (tools/glassworks-listing.ts).
 * Nothing links to them; they still link out to everything else.
 */
export function navLinksFor(
  page: EntryPage | null,
  unlisted: readonly string[] = [],
  lessons: readonly { href: string; label: string }[] = [],
): { href: string; label: string }[] {
  return [
    { href: '/', label: 'Home' },
    ...lessons,
    ...ENTRY_PAGES.filter(
      (other) => other.slug !== page?.slug && !unlisted.includes(other.slug),
    ).map((other) => ({
      href: canonicalPath(other),
      label: other.navLabel,
    })),
    { href: ABOUT_URL, label: 'About MercuryPitch' },
  ]
}

/**
 * The answer to "is there an app for iPhone or Android?", worked out from the
 * store listings rather than typed into a page. The day a listing goes live
 * (src/lib/store-listings.ts), every document that asks says so, and none
 * keeps promising an app that has already shipped. A listing counts only once
 * it can be linked, the same rule the store chips follow.
 */
export function nativeAppsAnswer(
  listings: StoreListings = STORE_LISTINGS,
): string {
  const links = storeLinks(listings)
  const iphone = links.appStore !== undefined
  const android = links.googlePlay !== undefined
  if (iphone && android)
    return 'Yes. MercuryPitch is on the App Store for iPhone and on Google Play for Android, and the browser version still works everywhere with nothing to install.'
  if (iphone)
    return 'MercuryPitch is on the App Store for iPhone. An Android app is on the way; until it arrives, the browser version works on Android with nothing to install.'
  if (android)
    return 'MercuryPitch is on Google Play for Android. An iPhone app is on the way; until it arrives, the browser version works on iPhone with nothing to install.'
  return 'Apps for iPhone and Android are on the way. Until they arrive, the browser version works on both with nothing to install, and you can add it to your home screen.'
}
