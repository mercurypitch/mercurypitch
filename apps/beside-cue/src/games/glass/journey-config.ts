// ============================================================
// Merc's Journey — every gameplay tunable in one place.
//
// Same philosophy as GLASS_CONFIG: nothing in the journey code hard-codes
// a number that belongs to game feel. Tweak freely between playtests.
// ============================================================

export const JOURNEY_CONFIG = {
  /** Voice → control mapping. */
  voice: {
    /** Consecutive voiced frames required before pitch is trusted. */
    debounceFrames: 3,
    /** Max sprite movement per 60fps frame, semitones (slew clamp). */
    slewSemisPerFrame: 0.45,
    /** Silence longer than this = intentional stop → Merc rests. */
    restGraceMs: 280,
    /** Release-glide filter: a stopping voice collapses in pitch for its
     * last ~150 ms and drags Merc down. When silence lands, his height is
     * restored to the median pitch over the releaseSpanMs window that
     * ENDED releaseTailMs before the cut — the intent, not the tail. */
    releaseTailMs: 140,
    releaseSpanMs: 320,
    /** Jitter calm: pitch wobble smaller than jitterSemis moves Merc at a
     * reduced rate (jitterCalm fraction at zero, ramping to full slew at
     * jitterSemis) — a wavey half-note flutter stops bouncing him while
     * real note changes stay snappy. */
    jitterSemis: 0.5,
    jitterCalm: 0.18,
  },

  /** Vertical pitch window and motion feel. */
  view: {
    /** Window bottom, semitones relative to the ground note. */
    windowLoOffset: -3,
    /** Window top, semitones relative to the ground note. */
    windowHiOffset: 9,
    /** World units visible across the screen width. */
    viewUnits: 10,
    /** Camera x follow lerp per frame. */
    cameraLerp: 0.06,
    /** Merc y lerp while flying / while settling onto a rest. */
    flyLerp: 0.22,
    restLerp: 0.15,
    /** Merc x follow lerp toward the active objective. */
    xLerp: 0.045,
  },

  /** Landing on a platform (climb + bridge steps). */
  land: {
    /** In-band tolerance, semitones. */
    bandSemis: 0.6,
    /** Continuous in-band time to land/crystallize, ms. */
    dwellMs: 700,
    /** Out-of-band dwell decay multiplier (dwell -= dt * decay). */
    decay: 2,
    /** Rest may snap UP onto a platform at most this far above Merc,
     * world-y fractions — silence pops him back onto the slab a release
     * glide dragged him under. */
    restSnapUpUnits: 0.25,
  },

  /** Glass (icy) platforms crack under a resting Merc. */
  glass: {
    /** Time from first rest contact to shatter, ms. */
    crackMs: 3200,
    /** Broken platform regrows after, ms. */
    respawnMs: 2600,
  },

  /** The mid-stage gate pane (hold its note to shatter). */
  gate: {
    tolSemis: 0.5,
    /** Full resonance build time in-band, ms. */
    riseMs: 1600,
    /** Full decay time out-of-band, ms. */
    fallMs: 900,
  },

  /** The final wall pane — bigger, slower to charge. */
  /** Resonance Ring pane — vibrato as the verb (research doc: never
   * shipped as a game verb anywhere). Hold the note steady to make the
   * pane ring up to holdCap; past that, only a WAVING voice (vibrato)
   * pumps it to the burst. */
  ring: {
    /** Forgiving pitch band — the skill here is the wave, not cents. */
    tolSemis: 1.2,
    /** Rise to holdCap while simply held in-band, ms. */
    riseMs: 1500,
    /** Resonance the steady hold can reach; the rest is vibrato's. */
    holdCap: 0.55,
    /** Full-strength vibrato pump time from holdCap to burst, ms. */
    pumpMs: 1600,
    /** Extra pitch band while ringing — the wave itself must never
     * fall out of tolerance. */
    pumpTolBonus: 1.0,
    /** Decay when neither held nor waved, ms (slow — no punishment). */
    fallMs: 2600,
  },

  wall: {
    tolSemis: 0.5,
    riseMs: 2400,
    fallMs: 900,
  },

  /** Shared pane feel (gate, wall, hidden door). */
  pane: {
    /** Merc hovers this far before a pane while charging it, world units.
     * Every approach spot must sit over a platform — breathing while
     * charging is always safe. */
    approachBack: 0.7,
    /** Post-burst grace: for this long after a pane shatters, silence
     * glides Merc to the nearest perch instead of dropping him into the
     * void. The perch stays unlit — its note still must be sung. */
    rescueMs: 2600,
    /** Rescue glide x lerp per frame. */
    rescueLerp: 0.1,
  },

  /** Melody bridge over the void. */
  bridge: {
    /** Step notes, semitones above the ground note (sung in order). */
    stepOffsets: [3, 5, 7],
    /** Hum the active step's note as a guide when it activates. */
    humSeconds: 1.4,
  },

  /** Act C — the melodic stairway (a literal scale climbed step by step). */
  stairway: {
    /** Scale degrees above the ground note, climbed in order. */
    stepOffsets: [0, 2, 4, 5, 7],
    /** Hum each stair's note as it becomes the objective. */
    hum: true,
  },

  /** Act D — the whisper passage (a sleeping guardian; sing QUIETLY). */
  whisper: {
    /** RMS above this counts as loud inside the zone. */
    rmsLoud: 0.12,
    /** Continuous loud time to fully wake the guardian, ms. */
    wakeMs: 900,
    /** Stir decay multiplier while quiet (stir -= dt/wakeMs * decay). */
    decay: 0.6,
    /** Woken: the platform under Merc shatters after this beat, ms. */
    crumbleDelayMs: 350,
    /** Drift drag inside the zone (xLerp multiplier) — a loud dash cannot
     * outrun the wake; a soft voice just takes a patient moment. */
    dragXLerpScale: 0.28,
    /** How far before the zone loudness starts to matter, world units.
     * Keep smaller than the gap to the checkpoint so resting there is safe. */
    approachMargin: 0.1,
  },

  /** Act E — the hidden door (find the frequency; no label, sweep for it). */
  hidden: {
    /** Charge tolerance once found, semitones. */
    tolSemis: 0.5,
    /** Proximity range for the hot–cold glow, semitones. */
    revealSemis: 2.5,
    /** Full resonance build time in-band, ms. */
    riseMs: 1800,
    fallMs: 800,
  },

  /** Act F — the chandelier mini-boss (break all crystals before they
   * re-anneal). */
  boss: {
    /** Crystal notes, semitones above ground. */
    crystalOffsets: [4, 7, 8],
    /** Charge tolerance, semitones. */
    tolSemis: 0.6,
    /** Per-crystal charge time in-band, ms. */
    riseMs: 1000,
    fallMs: 700,
    /** A broken crystal re-anneals after this, unless all are broken. */
    reannealMs: 6500,
    /** Merc drifts under the crystal his voice is charging (else nearest
     * unbroken to the sung note) instead of hovering at arena center. */
    trackCharging: true,
    /** Glowing voice beam from Merc to the crystal currently in band. */
    beam: true,
  },

  /** Platformer play mode (Jump Trials): keys walk, the voice is the jump —
   * the jump's apex is the sung note's height, so a higher note is a
   * higher, longer leap. The flow mode (voice = position) is untouched. */
  control: {
    /** Walk speed, world units per second. */
    walkSpeed: 2.3,
    /** Air steering as a fraction of walk speed. */
    airControlScale: 0.6,
    /** Gravity while unvoiced and airborne, canvas fractions/s^2. */
    gravity: 1.7,
    /** Terminal fall speed, canvas fractions/s. */
    maxFall: 1.4,
    /** Lift lerp toward the sung note's height (the jump itself). */
    liftLerp: 0.16,
    /** Max voice-driven vertical speed, canvas fractions per second — a
     * really high note is a BIG leap, not an instant one: the energy
     * averages out over the arc instead of teleporting Merc. */
    liftMaxPerSec: 0.8,
    /** After walking off an edge, the ground counts for this long, ms. */
    coyoteMs: 130,
    /** Merc's feet: x overhang tolerance for standing and landing, units. */
    footUnits: 0.12,
    /** Going silent settles Merc onto a top within this vertical range. */
    settleUnits: 0.1,
    /** An intact pane is a physical glass wall: Merc stops this far from
     * it, walking or airborne, until it is sung open. */
    paneBlockUnits: 0.22,
    /** Panes charge by proximity in this mode — singing an intact pane's
     * note within this many units makes it resonate, node order aside. */
    paneChargeUnits: 1.3,
    /** Voiced ONSETS allowed while airborne (re-lifts) before the voice
     * stops lifting until Merc lands. The default is effectively
     * unlimited flutter; hard tiers set 0-1 so a jump must be sung as
     * ONE note — its apex is the commitment. */
    airReliftMax: 99,
    /** Vertical camera. Standing, the view re-centers so Merc keeps this
     * screen-y (0.5 = equal air above and below). Airborne, the camera
     * only follows once Merc enters the top/bottom camAirBand of the
     * screen — a single jump never yanks the view. The pan itself is a
     * lerp; it never scrolls below the baseline framing, and never above
     * centering the highest platform. Flow mode keeps its fixed window
     * (there the pitch ruler IS the frame). */
    camCenterY: 0.5,
    camAirBand: 0.24,
    camYLerp: 0.055,
  },

  /** Melody-level compiler pacing (compileLevel): how level DATA becomes
   * stage GEOMETRY, per play mode. Flow reads as a contour to trace;
   * platformer needs real, jumpable gaps. World units per beat etc. */
  melody: {
    /** Starting slab width (lit; the calibrated ground note). */
    groundWidth: 3.5,
    /** Minimum platform width, world units (short notes stay landable). */
    minWidth: 1.1,
    /** Platform width per beat of note duration. In rhythm mode geometry
     * IS time: near-adjacent slabs make x a straight beat axis. */
    unitsPerBeat: { flow: 1.4, platformer: 1.5, rhythm: 1.5, listen: 1.4 },
    /** Gap before each next note platform. */
    noteGap: { flow: 0.45, platformer: 1.25, rhythm: 0.12, listen: 0.45 },
    /** Wider gap opening a new phrase/segment — a written-in breath
     * (in rhythm: about a beat of musical rest). */
    phraseGap: { flow: 1.1, platformer: 1.8, rhythm: 1.5, listen: 1.1 },
    /** Road consumed per beat of musical rest. */
    restUnit: { flow: 1, platformer: 1.4, rhythm: 1.5, listen: 1 },
    /** Pane distance past the previous platform edge. Flow: approach spot
     * (wx − pane.approachBack) must sit over that platform. Platformer:
     * must stay within control.paneChargeUnits of its edge. Rhythm
     * compiles encounters as rests, so its value is never used. */
    paneGap: { flow: 0.6, platformer: 1.2, rhythm: 0.6, listen: 0.6 },
    /** Road resuming after a pane. */
    paneAfter: 0.8,
    /** Center each song's range on the calibrated ground note (the
     * melody's midpoint lands on the hummed note instead of the tonic,
     * so a 0..+9 tune no longer sits entirely above the voice). */
    centerRange: true,
    /** Semitones the range setting shifts songs by ("Lower"/"Higher"
     * on the games list move every song down/up this much). */
    rangeBiasSemis: 3,
    /** Pitch window padding around the melody's range, semitones. */
    windowLoPad: 3,
    windowHiPad: 2,
    /** Road after the final note. */
    endPad: 1.5,
  },

  /** Rhythm play mode (tap driver): the road scrolls at tempo, a tap as
   * Merc crosses each slab lands the note — the taps perform the song,
   * no microphone involved. */
  tap: {
    /** Tempo when the melody data does not declare one. */
    bpmDefault: 80,
    /** Hit window around a slab, ms of travel (also never smaller than
     * the slab itself — tapping anywhere over it counts). */
    windowMs: 200,
    /** Input-latency compensation default, ms — the tap tuner on the
     * games list measures and stores the real per-device offset
     * (localStorage), which overrides this when present. */
    inputLatencyMs: 0,
    /** The tap tuner: metronome ticks to tap along with. */
    calBpm: 90,
    calBeats: 16,
    /** Fewest on-grid taps that make a trustworthy measurement. */
    calMinTaps: 8,
    /** Taps further than this fraction of a beat from the nearest tick
     * are wild — dropped, not averaged. */
    calMaxOffFrac: 0.45,
    /** Largest offset the tuner will save, ms either way. */
    calClampMs: 400,
    /** Metronome count-in beats before the road starts moving. */
    countInBeats: 4,
    /** 0 = forgiving: missed slabs just light late. Above 0, that many
     * misses end the run — the rhythm tier's fail state. */
    maxMisses: 0,
    /** Merc's glide toward each note's height, lerp per frame. */
    yLerp: 0.12,
    /** Haptic tick on a judged hit, ms (mobile). */
    vibrateMs: 15,
  },

  /** Listen play mode (ear training, no mic): the game hums the next
   * note; two candidate slabs light up; tap the one you heard. */
  listen: {
    /** Candidates per question: the true note plus fanSize−1 phantom
     * slabs, a ladder stacked at the same road position — the true
     * note lands on a random rung. */
    fanSize: 2,
    /** Semitones between neighboring rungs — the ear-gap. Songs
     * tighten it per level via feel (octave → fifth → third →
     * semitone, the classic staircase). */
    gapSemis: 7,
    /** The prompt hum's length, seconds. */
    promptSeconds: 0.9,
    /** A tap outside both candidates replays the prompt — but no more
     * often than this. */
    replayGapMs: 700,
    /** Wrong pick: the decoy shakes this long, then the prompt replays. */
    wrongShakeMs: 380,
    /** Pause between a right answer's hop and the next question. */
    hopDelayMs: 650,
  },

  /** The guided range-finder on the games list: hum a comfortable note,
   * then your lowest, then your highest — the range setting is computed
   * from the measured range instead of picked as a preference. */
  /** The vibrato detector (vibrato.ts) — the Resonance Ring's ear. */
  vibrato: {
    windowSec: 1.0,
    minHz: 3.5,
    maxHz: 8.5,
    minDepthCents: 15,
    maxDepthCents: 140,
    /** One sample per frame: 12 leaves a 30 fps device with dropped
     *  frames able to fill the window (20 never could), and still
     *  samples the 8.5 Hz ceiling well above twice over. */
    minSamples: 12,
    resetGapMs: 250,
  },

  /** Steady Beam — a light-bridge held up by one steady note. Stability
   * is the verb; wobble narrows the beam and flakes shards (score, not
   * failure). Silence over the gap sinks (existing grace applies). */
  beam: {
    /** Stay within this of the beam note to be carried. */
    tolSemis: 0.9,
    /** Cents-variance window for the beam's width/flakes, ms. */
    varWindowMs: 600,
    /** Mean |cents| that thins the beam to its narrowest. */
    varThinCents: 45,
    /** Above this instantaneous |cents|, shards flake off the beam. */
    flakeCents: 35,
  },

  /** Improv Atrium — the open room: any note in the key raises a step
   * at its own height; the route IS the player's melody. No fail. */
  atrium: {
    /** Major-scale degrees offered as steps (relative to the tonic). */
    scaleDegrees: [0, 2, 4, 5, 7, 9, 11, 12],
    /** Snap window around a scale tone, semitones. */
    snapSemis: 0.6,
    /** Hold a tone this long to raise its step, ms. */
    stableMs: 170,
    /** New step lands this far ahead of Merc, world units. */
    spawnAhead: 0.85,
    stepWidth: 1.15,
    /** Steps are glass thoughts — they fade after this long, ms. */
    stepTtlMs: 7000,
    /** Cap on live steps (oldest fades first past it). */
    maxSteps: 14,
    /** In-key share of voiced time that already counts as a perfect
     * crossing — improv means some out-of-key searching is free. */
    inKeyFullRatio: 0.7,
    /** Merc stands this far back from his furthest step's edge — the
     * floor you have sung IS how far the room lets you walk. */
    stepReachBack: 0.25,
  },

  /** Run scoring (score.ts): real units first, pass band not finish
   * line — melody-levels.md §8. Feel-overridable per level. */
  score: {
    /** The pass band floor — maff's "70–80%" call. */
    passPct: 75,
    /** The polished-run line. */
    greatPct: 90,
    /** The bronze floor — below it a run gets no medal, just the units. */
    bronzePct: 55,
    /** Sung note quality: mean cents-off at/below this scores 1.0… */
    centsPerfect: 10,
    /** …and at this it scores 0 (linear between). */
    centsZero: 70,
    /** Each fall costs this many points off the run. */
    fallPenaltyPct: 4,
    /** Listen: each wrong pick costs this fraction of its question. */
    listenWrongPenalty: 0.5,
  },

  rangeFinder: {
    /** A note must hold this long inside tolSemis to lock. */
    holdMs: 700,
    /** Wobble tolerance around the emerging note, semitones. */
    tolSemis: 0.75,
    /** Silence required between steps, ms — so a held note cannot lock
     * two steps in a row. */
    stepSilenceMs: 350,
    /** Locked-note confirmation hum, seconds. */
    humSeconds: 0.7,
    /** Largest computed bias the finder will apply, semitones either
     * way (a wild measurement never flings songs off the ruler). */
    clampSemis: 12,
  },

  /** Game-emitted audio (all of it gated by the corner toggles too). */
  sound: {
    /** Hum every new objective's note as it activates (hidden door and
     * whisper excepted). Tier overlays can turn this off. */
    humOnObjective: true,
    /** Seconds each objective hum lasts. */
    humSeconds: 1.2,
    /** The chandelier introduces itself: its crystals hum as an arpeggio
     * during the boss thought-bubble pause. */
    bossArpeggio: true,
    arpeggioNoteSec: 0.55,
    arpeggioGapMs: 640,
  },

  /** Falling + game over. */
  fall: {
    /** Silence over a void first SINKS slowly (recoverable) — any voiced
     * note lifts Merc out. Only after the grace does the real fall start. */
    sinkSpeed: 0.14,
    sinkGraceMs: 1500,
    /** While true, a voiced note catches Merc mid-fall (on screen only).
     * Hard tiers can turn this off. */
    catchable: true,
    /** Downward speed while falling, canvas fractions per second. */
    speed: 0.9,
    /** Below this canvas-y fraction, the run is lost. */
    yGone: 1.2,
    /** Pause before the game-over card, ms. */
    cardDelayMs: 700,
  },

  /** In-world HUD helpers. */
  hud: {
    /** Show up/down chevrons at Merc when the objective note is more than
     * this many semitones away (never for the hidden door or whisper). */
    arrowSemis: 1.5,
    /** Horizontal guide line at the objective note's height — where the
     * voice must sit. Hidden door and whisper stay exempt. */
    guideLine: true,
    /** Labels of platforms/panes that are NOT the objective dim to this. */
    inactiveLabelAlpha: 0.35,
    /** Faint ghost trail of the RAW detected pitch (before smoothing) —
     * shows what the voice really did vs where Merc went. */
    pitchGhost: true,
  },

  /** Visual dressing — parallax, materials, Merc sprite feel. */
  art: {
    /** Horizontal scroll factor per layer (0 = pinned, 1 = world speed). */
    parallaxFar: 0.1,
    parallaxMid: 0.28,
    parallaxNear: 0.55,
    /** Screen-blend opacity of the nebula / dust layers. */
    nebulaAlpha: 0.34,
    dustAlpha: 0.5,
    /** Platform slab thickness, world units (clamped in px below). */
    platformUnits: 0.13,
    platformMinPx: 10,
    platformMaxPx: 20,
    /** Texture pattern scale (image pixels → screen pixels). */
    texScale: 0.35,
    /** Merc sprite height, world units (clamped in px below). */
    mercUnits: 0.48,
    mercMinPx: 38,
    mercMaxPx: 72,
    /** Squash & stretch: scale = 1 + min(squashMax, |vy| * squashVelScale). */
    squashMax: 0.22,
    squashVelScale: 2.4,
    /** Lean into horizontal motion, radians cap + velocity scale. */
    tiltMax: 0.3,
    tiltVelScale: 5,
    /** Wobble while falling, radians. */
    fallWobble: 0.4,
    /** Mercury beads shed while falling (count alive at once). */
    fallBeads: 10,
    /** World units visible across the width in portrait (narrow) view. */
    viewUnitsPortrait: 7,
    /** Merc's alpha while his flight path passes through a slab (he is
     * incorporeal while flying; only rest makes him solid). */
    phaseAlpha: 0.55,
    /** Melody ribbon: the upcoming contour drawn as one flowing curve
     * through the next platforms — the tune's shape, visible before it
     * is sung. Sung modes only (rhythm has the approach rings). */
    ribbon: true,
    ribbonAlpha: 0.16,
    /** Land nodes ahead of the objective the ribbon flows through. */
    ribbonAhead: 6,
    /** Rhythm: slab top edges breathe with the beat once the road
     * rolls — the whole world keeps the pulse, not just the rings. */
    beatPulse: true,
    beatPulseAmt: 0.3,
  },
} as const

export type JourneyConfig = typeof JOURNEY_CONFIG

/** World units across the screen width: portrait sees fewer so platforms
 *  keep a playable size. The one rule for drawing, the camera clamp and
 *  the tap hit-test. Three readings of it once disagreed: the camera
 *  clamped to the landscape width while portrait drew seven units, so on
 *  a phone held upright the last three units of the journey were never
 *  on screen. */
export function viewUnitsFor(width: number, height: number): number {
  return width / height < 0.8
    ? JOURNEY_CONFIG.art.viewUnitsPortrait
    : JOURNEY_CONFIG.view.viewUnits
}
