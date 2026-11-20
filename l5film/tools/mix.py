"""Build the soundtrack from cues.json: narration, every sung note and example synthesised at
its exact pitch on the contour the picture draws (Lesson 5: FACTS 79, 80 and 96 to 98), the ticks,
one whoosh an act, Merc's two landings, the chimes and a quiet bed on A (FACTS 81).

  python tools/mix.py            (the project's Python: .venv/bin/python, numpy and soundfile)

Writes assets/audio/full.wav (everything), assets/audio/music-only.wav (the bed, the room tone
and the stings: what the effects are measured against), assets/audio/stems/*.wav and
assets/audio/mix-report.json (every level and time it chose). The stems carry the limiter's gain
and the final gain, so they add up to full.wav sample for sample, and bed + stings + floor is
music-only.wav. Reads cues.json, assets/voice/<line>.wav and, through tools/sound-kit.mjs (run
here first), the film kit's own numbers: assets/audio/kit-sound.json.

Every time is a cue's, so a re-voice re-times the sound with the picture: no second is typed
here but a sound's own shape (an attack, a release, a margin round a line). Every contour, the
three starts' levels and onsets, the tune's notes, the title's chime times and Merc's landings
come from the kit the scenes draw with (FACTS 98), read in node, never copied by hand.

Everything is generated here: the "ooh" is the demo voice's synthesis (FACTS 79), the starts
are the page's (FACTS 75), the voice lines are local Kokoro until the owner's ElevenLabs takes
are imported. No downloaded music or sound. (The Echo samples below serve only `sing` events,
which this film does not use.)
"""
import json, os, subprocess
import numpy as np
import soundfile as sf

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
SR = 48000
# The MercuryPitch checkout the Echo notes come from. MERCURYPITCH_REPO overrides it.
REPO = os.environ.get('MERCURYPITCH_REPO', '/home/user/mercurypitch')
SAMPLES = {
    'A3': f'{REPO}/src/features/echo/voice/echo-merc-ooh-57-A3.mp3',
    'A4': f'{REPO}/src/features/echo/voice/echo-merc-ooh-69-A4.mp3',
}
CACHE = os.path.join(ROOT, 'assets/audio/cache')


def hz(name):
    names = {'C': -9, 'D': -7, 'E': -5, 'F': -4, 'G': -2, 'A': 0, 'B': 2}
    n = names[name[0]]
    rest = name[1:]
    if rest.startswith('#'):
        n += 1
        rest = rest[1:]
    octave = int(rest)
    return 440.0 * 2 ** ((n + 12 * (octave - 4)) / 12)


def load(path, tempo=None):
    """Any audio file, as mono float32 at SR, through ffmpeg (cached)."""
    os.makedirs(CACHE, exist_ok=True)
    key = os.path.basename(path) + (f'.t{tempo}' if tempo else '') + '.wav'
    out = os.path.join(CACHE, key)
    if not os.path.exists(out) or os.path.getmtime(out) < os.path.getmtime(path):
        af = ['-af', f'atempo={tempo}'] if tempo else []
        subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-i', path, *af, '-ac', '1', '-ar', str(SR), out], check=True)
    x, _ = sf.read(out, dtype='float32')
    return x


def env_adsr(n, a=0.02, r=0.12, sustain=1.0):
    t = np.arange(n) / SR
    dur = n / SR
    e = np.minimum(1.0, t / max(a, 1e-4)) * sustain
    rel = np.clip((dur - t) / max(r, 1e-4), 0, 1)
    return (e * rel).astype(np.float32)


def tone(f, dur, amp=0.5, a=0.03, r=0.18, partials=(1.0, 0.28, 0.1, 0.04)):
    """A soft glass/flute tone: the fundamental at f plus a few harmonics."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    x = np.zeros(n, dtype=np.float64)
    for k, p in enumerate(partials, start=1):
        x += p * np.sin(2 * np.pi * f * k * t)
    x /= sum(partials)
    return (amp * x * env_adsr(n, a, r)).astype(np.float32)


def voice_tone(f, dur, amp=0.3):
    """Merc's synthesised "ooh" (src/lib/demo-audio.ts): OOH_PARTIALS, a soft
    lowpass, attack 0.09 s, release 0.18 s, vibrato 5.5 Hz +-14 cents grown in
    over 0.35 s."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    vib = 14 * np.minimum(1, t / 0.35) * np.sin(2 * np.pi * 5.5 * t)
    fi = f * 2 ** (vib / 1200)
    phase = 2 * np.pi * np.cumsum(fi) / SR
    parts = [0, 1, 0.62, 0.38, 0.24, 0.14, 0.08, 0.045, 0.025]
    x = np.zeros(n)
    for k, p in enumerate(parts):
        if p and f * k < 2600 * 1.6:
            roll = 1 / (1 + (f * k / 2600) ** 2)
            x += p * roll * np.sin(k * phase)
    x /= np.abs(x).max() + 1e-9
    return (amp * x * env_adsr(n, 0.09, 0.18)).astype(np.float32)


def sweep(f0, f1, dur, amp=0.45):
    n = int(dur * SR)
    t = np.arange(n) / SR
    # exponential glide: equal pitch steps per second, like the dial
    f = f0 * (f1 / f0) ** (t / dur)
    phase = 2 * np.pi * np.cumsum(f) / SR
    x = np.sin(phase) + 0.25 * np.sin(2 * phase) + 0.08 * np.sin(3 * phase)
    x /= 1.33
    return (amp * x * env_adsr(n, 0.15, 0.4)).astype(np.float32)


def pluck(f, dur, amp=0.6, seed=7):
    """Karplus-Strong string at f, seeded so every render is the same."""
    n = int(dur * SR)
    p = int(round(SR / f))
    rng = np.random.default_rng(seed)
    buf = rng.uniform(-1, 1, p).astype(np.float64)
    out = np.zeros(n, dtype=np.float64)
    for i in range(n):
        out[i] = buf[i % p]
        buf[i % p] = 0.996 * 0.5 * (buf[i % p] + buf[(i + 1) % p])
    out /= np.abs(out).max() + 1e-9
    return (amp * out * env_adsr(n, 0.002, 0.3)).astype(np.float32)


def noise_whoosh(dur=0.7, amp=0.12, seed=3, lo=300.0, hi=2400.0):
    """A soft, rumble-free whoosh: band-limited noise with a swelling envelope."""
    n = int(dur * SR)
    rng = np.random.default_rng(seed)
    x = rng.standard_normal(n)
    X = np.fft.rfft(x)
    fr = np.fft.rfftfreq(n, 1 / SR)
    band = np.exp(-0.5 * (np.log(np.maximum(fr, 1) / np.sqrt(lo * hi)) / 0.55) ** 2)
    band[fr < 120] = 0
    x = np.fft.irfft(X * band, n)
    x /= np.abs(x).max() + 1e-9
    t = np.arange(n) / dur / SR
    e = np.sin(np.pi * np.clip(t, 0, 1)) ** 2.2 * (0.6 + 0.4 * t)
    return (amp * x * e).astype(np.float32)


def chime(freqs, dur, amp=0.32, stagger=0.06):
    n = int(dur * SR)
    out = np.zeros(n, dtype=np.float32)
    for i, f in enumerate(freqs):
        d0 = int(i * stagger * SR)
        t = np.arange(n - d0) / SR
        x = (np.sin(2 * np.pi * f * t) + 0.18 * np.sin(2 * np.pi * 2.001 * f * t) + 0.06 * np.sin(2 * np.pi * 3.0 * f * t)) / 1.24
        e = np.exp(-t * 1.6) * np.minimum(1, t / 0.008)
        out[d0:] += (amp / len(freqs) ** 0.6) * x * e
    return out * env_adsr(n, 0.002, 0.6)


def pad(t, freqs=(110.0, 164.81, 220.0), amp=0.07):
    """A quiet open-fifth pad on A, A2, E3 and A3 (FACTS 81): slow detuned sines, breathing.
    Lesson 2's pad; Lesson 4's was the same on D. `t` is an array of seconds: the pad's own
    time, whose zero is where its three detuned sines of each note meet (its swell's top; they
    part and meet again every 1.5 s or so)."""
    n = len(t)
    x = np.zeros(n)
    for i, f in enumerate(freqs):
        for d in (-0.6, 0.0, 0.7):
            x += np.sin(2 * np.pi * (f + d) * t + i)
    x /= len(freqs) * 3
    lfo = 0.75 + 0.25 * np.sin(2 * np.pi * t / 9.0)
    return (amp * x * lfo).astype(np.float32)


def room_tone(n, seed=29, lo=150.0, hi=3000.0):
    """A quiet room tone under the whole film: steady pink noise between lo and hi
    (no rumble, no hiss) at a fixed seed. It is not music: no pitch, nothing to
    hear against a listening example. It keeps the mix from dropping to digital
    zero between lines, where the bed is ducked out (critic 06 counted 78 such
    stretches of 0.15 s or more)."""
    rng = np.random.default_rng(seed)
    X = np.fft.rfft(rng.standard_normal(n))
    fr = np.maximum(np.fft.rfftfreq(n, 1 / SR), 1.0)
    shape = fr ** -0.5 / (1 + (lo / fr) ** 4) / (1 + (fr / hi) ** 4)
    x = np.fft.irfft(X * shape, n)
    x /= np.sqrt(np.mean(x ** 2)) + 1e-12
    return x.astype(np.float32)


def place(buf, x, t, gain=1.0):
    i = int(round(t * SR))
    if i >= len(buf):
        return
    j = min(len(buf), i + len(x))
    buf[i:j] += gain * x[: j - i]


def voice_contour(base, keys, dur, amp=0.3):
    """Merc's synthesised "ooh" (src/lib/demo-audio.ts: OOH_PARTIALS, the 2600 Hz
    lowpass, attack 0.09 s, release 0.18 s) following a contour of [t, cents] keys
    (linear in cents between keys, so each glide is exponential in hertz), with the
    demos' vibrato: 5.5 Hz, +-14 cents, grown in over 0.35 s (FACTS 50). The vibrato
    swings around the exact centre, so a held note sits on its pitch."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    kt = np.array([k[0] for k in keys])
    kc = np.array([k[1] for k in keys], dtype=np.float64)
    cents = np.interp(t, kt, kc)
    vib = 14 * np.minimum(1, t / 0.35) * np.sin(2 * np.pi * 5.5 * t)
    fi = base * 2 ** ((cents + vib) / 1200)
    phase = 2 * np.pi * np.cumsum(fi) / SR
    parts = [0, 1, 0.62, 0.38, 0.24, 0.14, 0.08, 0.045, 0.025]
    x = np.zeros(n)
    for k, p in enumerate(parts):
        if p and base * k < 2600 * 1.6:
            roll = 1 / (1 + (base * k / 2600) ** 2)
            x += p * roll * np.sin(k * phase)
    x /= np.abs(x).max() + 1e-9
    return (amp * x * env_adsr(n, 0.09, 0.18)).astype(np.float32)


def glide(f0, keys, dur, amp=0.45):
    """A soft tone on a contour of [t, cents above f0] keys: the cents glide holds,
    glides at a steady 40 cents a second, and holds (FACTS 25)."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    cents = np.interp(t, [k[0] for k in keys], [k[1] for k in keys])
    f = f0 * 2 ** (cents / 1200)
    phase = 2 * np.pi * np.cumsum(f) / SR
    x = (np.sin(phase) + 0.28 * np.sin(2 * phase) + 0.1 * np.sin(3 * phase)) / 1.38
    return (amp * x * env_adsr(n, 0.06, 0.3)).astype(np.float32)


def notes(dur, seq, amp=0.48, r=0.14):
    """Notes [(name, onset, length)] at their exact pitches (FACTS 6), Lesson 1's tone()."""
    out = np.zeros(int(dur * SR), dtype=np.float32)
    for nm, at, ln in seq:
        place(out, tone(hz(nm), ln, amp=amp, r=r), at)
    return out


def run(seq, amp, voice=True):
    """A sung or played run: [(name, length)] back to back, each note its own
    envelope, so a run of the "ooh" is sung note by note as the page's is (FACTS 67)."""
    total = sum(ln for _, ln in seq)
    out = np.zeros(int(round(total * SR)) + 1, dtype=np.float32)
    at = 0.0
    for nm, ln in seq:
        if nm is not None:
            x = voice_tone(hz(nm), ln, amp=amp) if voice else tone(hz(nm), ln, amp=amp, r=0.14)
            place(out, x, at)
        at += ln
    return out


def even(names, each, last):
    """Names at `each` seconds a note, the last held for `last`."""
    return [(nm, each) for nm in names[:-1]] + [(names[-1], last)]


MERC, TAVI = 0.32, 0.28                       # the "ooh" levels: Lesson 2's slides, Tavi a little under


def fit(x, dur):
    """Pad or trim a sound to its cue's length."""
    n = int(round(dur * SR))
    return np.pad(x, (0, max(0, n - len(x))))[:n]


# ---------------------------------------------------------------- Lesson 5: the kit's numbers
KIT_JSON = os.path.join(ROOT, 'assets/audio/kit-sound.json')
_KIT = None


def kit():
    """The film kit's own numbers (tools/sound-kit.mjs): the contours the scenes draw, the three
    starts' levels and onsets, the tune, the title's chime times, Merc's landings."""
    global _KIT
    if _KIT is None:
        _KIT = json.load(open(KIT_JSON))
    return _KIT


def kit_curve(samples, n, t0=0.0):
    """A function the kit sampled every `step` seconds, at the mixer's rate: n samples, the
    function's own time 0 at t0 seconds (0 before it), linear between the kit's samples (1 ms
    apart: under 0.01 cent on the wave)."""
    t = np.arange(n) / SR - t0
    return np.interp(t, np.arange(len(samples)) * kit()['step'], np.asarray(samples, dtype=np.float64), left=0.0)


# ---------------------------------------------------------------- Lesson 5: the "ooh" on a contour
OOH_PARTIALS = (1, 0.62, 0.38, 0.24, 0.14, 0.08, 0.045, 0.025)   # FACTS 79 (the app's MERC_PARTIALS)
OOH_LOWPASS = 2600.0
ATTACK, RELEASE = 0.09, 0.18                  # the films' "ooh" (voice_tone above; Lesson 4 film FACTS 67)


def ooh(base, cents, amp, db=None, level=None, attack=ATTACK, release=RELEASE):
    """The one timbre of every sung note (FACTS 79): the "ooh"'s partials through its 2,600 Hz
    lowpass, on `base` hertz, following `cents` (an array: the drawn line, its wave included, so
    the wave heard is the wave drawn), at `db` decibels over `amp` (an array, or none), under
    `level` (0..1, an array: a start's drawn level) or the voice's own attack. It ends inside
    its own length: the release closes on the last sample, so no tail runs under the next line."""
    n = len(cents)
    t = np.arange(n) / SR
    fi = base * 2 ** (np.asarray(cents, dtype=np.float64) / 1200)
    phase = 2 * np.pi * (np.cumsum(fi) - fi) / SR
    parts = [(k, p / (1 + (base * k / OOH_LOWPASS) ** 2)) for k, p in enumerate(OOH_PARTIALS, start=1) if base * k < OOH_LOWPASS * 1.6]
    theta = np.linspace(0, 2 * np.pi, 4096, endpoint=False)
    peak = np.abs(sum(a * np.sin(k * theta) for k, a in parts)).max()   # one cycle's peak: every note at the same level
    x = sum(a * np.sin(k * phase) for k, a in parts) / peak
    e = np.minimum(1.0, t / max(attack, 1e-4)) if level is None else np.asarray(level, dtype=np.float64)
    e = e * np.clip((n / SR - t) / max(release, 1e-4), 0, 1)
    if db is not None:
        e = e * 10 ** (np.asarray(db, dtype=np.float64) / 20)
    return (amp * x * e).astype(np.float32)


def contour_note(name, base, amp):
    """A sound the kit draws a contour for (L.CONTOUR: easy, pushed, push, demo): the drawn line
    c(t), its wave where the board starts it (DECISIONS 155), and its level db(t)."""
    c = kit()['contours'][name]
    n = int(round(c['len'] * SR))
    return ooh(base, kit_curve(c['c'], n), amp, db=kit_curve(c['db'], n))


def held_note(base, dur, amp, level=None, t0=0.0):
    """A plain held "ooh": the note unchanged, with the voice's own wave from its start (the
    kit's L.CONTOUR.vib from 0; `t0` when the tone starts inside the sound)."""
    n = int(round(dur * SR))
    return ooh(base, kit_curve(kit()['wave'], n, t0), amp, level=level)


# ---------------------------------------------------------------- Lesson 5: the three starts (FACTS 75, 80, 96)
# The page's own bursts (lesson-05/starts.ts, kit/sound.ts): their lengths and levels against the
# voice's 0.2 are the page's; the kit holds the onsets and the tone's drawn level, and FACTS 80
# these lengths.
PAGE_VOICE = 0.2                              # MERC_GAIN: the page's "ooh" against its bursts
PUFF = {'dur': 0.35, 'gain': 0.07, 'hz': 1500.0, 'q': 0.7, 'attack': 0.04, 'release': 0.1}
CLICK = {'dur': 0.003, 'gain': 0.12, 'attack': 0.0005, 'release': 0.002}
CATCH_RISE = 0.010                            # the tone at full level within 10 ms of the click


def page_noise(n):
    """The page's noise (kit/sound.ts, noiseBuffer): one second of white noise from its fixed
    seed, looped, each burst from the buffer's start."""
    m = SR
    buf = np.empty(m)
    seed = 0x2F6B
    for i in range(m):
        seed = (seed * 1664525 + 1013904223) & 0xFFFFFFFF
        buf[i] = seed / 2147483648 - 1
    return np.resize(buf, n)


def page_burst(spec, amp):
    """One of the page's noise bursts on the house envelope: an exponential rise from the 1e-4
    floor over `attack`, held to `dur`, then a decay of time constant release / 5; band-passed
    like the page's (a biquad at hz, Q q) when it has a band. `amp` is the voice's level here."""
    tail = spec['release'] * 2.5
    n = int(round((spec['dur'] + tail) * SR))
    x = page_noise(n)
    if 'hz' in spec:
        m = n + SR // 10
        w = 2 * np.pi * np.fft.rfftfreq(m, 1 / SR) / SR
        w0 = 2 * np.pi * spec['hz'] / SR
        al = np.sin(w0) / (2 * spec['q'])
        z1, z2 = np.exp(-1j * w), np.exp(-2j * w)
        H = (al - al * z2) / ((1 + al) - 2 * np.cos(w0) * z1 + (1 - al) * z2)
        x = np.fft.irfft(np.fft.rfft(np.pad(x, (0, m - n))) * H, m)[:n]
    t = np.arange(n) / SR
    floor, peak = 1e-4, spec['gain']
    held = max(spec['attack'], spec['dur'])
    e = np.where(t < spec['attack'], floor * (peak / floor) ** (t / spec['attack']), peak)
    e = np.where(t >= held, peak * np.exp(-(t - held) / (spec['release'] / 5)), e)
    e *= np.clip((n / SR - t) / 0.005, 0, 1)                  # the last 5 ms to zero (under -100 dB by then)
    return (amp / PAGE_VOICE * x * e).astype(np.float32)


def smoothstep(e0, e1, x):
    u = np.clip((x - e0) / (e1 - e0), 0, 1)
    return u * u * (3 - 2 * u)


def start_sound(kind):
    """One start on A3 (FACTS 75, 80), 1.6 s: the tone's level is the level its trace draws
    (L.TRACE.level), its onset the kit's (L.TRACE.ONSET), so the strip and the sound are one.
    air: the page's "h" from 0, the tone rising under it; catch: silence, the page's 3 ms click
    at the onset, then the tone at full within 10 ms; together: the tone alone, rising."""
    K = kit()['starts']
    n = int(round(K['len'] * SR))
    t = np.arange(n) / SR
    on = K['onset'][kind]
    out = np.zeros(n, dtype=np.float32)
    if kind == 'catch':
        tone0 = on + CLICK['dur']
        level = smoothstep(tone0, tone0 + CATCH_RISE, t)       # the drawn wave is at full from the click
        place(out, page_burst(CLICK, MERC), on)
    else:
        tone0 = on
        level = kit_curve(K['level'][kind], n)
        if kind == 'air':
            place(out, page_burst(PUFF, MERC), 0.0)
    out += held_note(hz('A3'), K['len'], MERC, level=level, t0=tone0)
    return out


START_KINDS = ('air', 'catch', 'together')


def tune(dur):
    """The tease's tune (FACTS 99): the kit's notes on the kit's onsets (L.TEASE), each sung as
    its own note, the last to the cue's end."""
    K = kit()['tease']
    if dur <= K['onset'][-1]:
        raise SystemExit(f"mix.py: twinkle is {dur:.3f} s on the cue sheet, and its last note starts at {K['onset'][-1]}")
    out = np.zeros(int(round(dur * SR)), dtype=np.float32)
    ends = K['onset'][1:] + [dur]
    for nm, at, end in zip(K['notes'], K['onset'], ends):
        place(out, held_note(hz(nm), end - at, MERC), at)
    return out


# ---------------------------------------------------------------- Lesson 5: the effects
def tick(dur=0.03, decay=0.02, centre=3000.0, width=0.25, seed=97):
    """The tick (FACTS 97, 80): a soft click with no pitch, band-passed noise centred near 3 kHz
    (half power from about 2.2 to 4.0 kHz, clear of the voice's partials), about 30 ms with a
    20 ms decay. Peak 1; the mix sets it against `listen`."""
    n, m = int(dur * SR), 8192
    X = np.fft.rfft(np.random.default_rng(seed).standard_normal(m))
    fr = np.maximum(np.fft.rfftfreq(m, 1 / SR), 1.0)
    x = np.fft.irfft(X * np.exp(-0.5 * (np.log(fr / centre) / width) ** 2), m)[m // 2:m // 2 + n]
    t = np.arange(n) / SR
    e = smoothstep(0, 0.002, t) * (1 - smoothstep(dur - decay, dur, t))
    x = x * e
    return (x / (np.abs(x).max() + 1e-12)).astype(np.float32)


def landing(f=329.63, dur=0.4):
    """Merc's landing (DECISIONS 215): a soft wooden tap on E4, the pad's fifth, so it sits in
    the open fifth without sounding home: a quick-dying tone with its double octave, and 6 ms
    of soft contact noise. Peak 1; the mix sets it against the pad."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    x = np.sin(2 * np.pi * f * t) * np.exp(-t / 0.06) + 0.22 * np.sin(2 * np.pi * 4 * f * t) * np.exp(-t / 0.018)
    m, nc = 4096, int(0.02 * SR)
    X = np.fft.rfft(np.random.default_rng(41).standard_normal(m))
    fr = np.maximum(np.fft.rfftfreq(m, 1 / SR), 1.0)
    c = np.fft.irfft(X * np.exp(-0.5 * (np.log(fr / 1200.0) / 0.45) ** 2), m)[m // 2:m // 2 + nc]
    x[:nc] += 0.18 * c / (np.abs(c).max() + 1e-12) * np.exp(-t[:nc] / 0.002)
    x = x * smoothstep(0, 0.003, t) * (1 - smoothstep(dur - 0.05, dur, t))
    return (x / (np.abs(x).max() + 1e-12)).astype(np.float32)


SOUNDS = ('easy', 'pushed', 'push', 'gauge', 'start-air', 'start-catch', 'start-together', 'starts', 'demo', 'listen', 'tick', 'twinkle')


def sound_for(name, dur):
    """The sound each `sound` event plays (FACTS 80), from the kit's numbers. Times are seconds
    from the sound's cue; a sound whose own length is not its cue's stops the run."""
    K = kit()
    if name in ('easy', 'pushed', 'push'):   # FACTS 72, 73: the "ooh", belonging to no host
        x = contour_note(name, hz('A3'), MERC)
    elif name == 'demo':                     # FACTS 76: Tavi's hold, an octave up, on the drawn line to the cent
        x = contour_note('demo', hz('A4'), TAVI)
    elif name == 'gauge':                    # FACTS 74, 93: Merc's A3, unchanged, as long as the gauge's axis
        x = held_note(hz('A3'), K['gauge']['len'], MERC)
    elif name == 'listen':                   # FACTS 56, 77: the model note in both voices
        x = held_note(hz('A3'), dur, MERC) + held_note(hz('A4'), dur, TAVI)
    elif name in ('start-air', 'start-catch', 'start-together'):
        x = start_sound(name[len('start-'):])
    elif name == 'starts':                   # FACTS 96: the three back to back, on s09's own row times
        x = np.zeros(int(round((K['starts']['rows'][-1] + K['starts']['len']) * SR)), dtype=np.float32)
        for kind, at in zip(START_KINDS, K['starts']['rows']):
            place(x, start_sound(kind), at)
    elif name == 'twinkle':                  # FACTS 99
        x = tune(dur)
    elif name == 'tick':                     # FACTS 97: its level is set in the mix, against `listen`
        x = tick()
    else:
        raise ValueError(name)
    if name != 'tick' and abs(len(x) / SR - dur) > 0.001:
        raise SystemExit(f'mix.py: {name} is {len(x) / SR:.3f} s by the kit and {dur:.3f} s on the cue sheet')
    return fit(x, dur)


# The bed (FACTS 81): only in the eight act transitions and under the dressed pauses, and through
# `break` (DECISIONS 215). Everywhere else, the room tone alone: under every line and sound, in
# `heard`, `breathe`, the ticks and `hold`.
ACT_MARKS = ('act1', 'act2', 'act3', 'act4', 'act5', 'sing', 'recap', 'next')
BED_PAUSES = ('predict', 'hook', 'q0', 'predict2', 'q1', 'q3', 'q4', 'feel', 'card', 'break')
LINE_MARGIN, SOUND_MARGIN = (0.35, 0.25), (0.6, 0.5)   # seconds of no pad after and before a line; a sound
BED_FADE = 0.35                                        # the pad's swell: a raised cosine across each edge
TICK_UNDER_LISTEN = 13.0      # dB: each tick's peak under `listen`'s (FACTS 97 and LAB-CHECKS 16 ask 12 or more)
LANDING_OVER_PAD = -3.0       # dB: each landing's peak against the pad's in `break`: 3 dB under it. By the skill's
                              # measure the first then reads +5.1 dB in its own band (its body +3.2; the target is
                              # +3 to +4, a small sound peaking at the music's peak or under); at +2 dB it read +9.0
WHOOSH = 0.7                  # seconds; it peaks 0.39 s in, 0.09 s after the cut


def bed_windows(C):
    """Where the pad sounds: each gap between two lines, sounds or stings that holds an act mark
    or a dressed pause, less the margins. The pad runs up to a chime's first note (the chimes'
    A major sits with it, FACTS 81) and never under a line or a sound."""
    solid = sorted((c['start'], c['end'], k, c['type']) for k, c in C.items() if c['type'] in ('line', 'sound', 'sing', 'sting'))
    wins = []
    for (_, b0, k0, t0), (a1, _, k1, t1) in zip(solid, solid[1:]):
        inside = [k for k in ACT_MARKS + BED_PAUSES if k in C and b0 - 1e-6 <= C[k]['start'] and C[k]['end'] <= a1 + 1e-6]
        if not inside:
            continue
        a = b0 + (LINE_MARGIN[0] if t0 == 'line' else SOUND_MARGIN[0])
        b = a1 - (LINE_MARGIN[1] if t1 == 'line' else 0.0 if t1 == 'sting' else SOUND_MARGIN[1])
        if b - a < BED_FADE:
            raise SystemExit(f'mix.py: no room for the pad in {" ".join(inside)} ({b0:.2f} to {a1:.2f}, after {k0}, before {k1})')
        wins.append({'from': round(a, 3), 'to': round(b, 3), 'holds': inside, 'after': k0, 'before': k1})
    missing = [k for k in ACT_MARKS + BED_PAUSES if not any(k in w['holds'] for w in wins)]
    if missing:
        raise SystemExit('mix.py: the pad has no window for ' + ' '.join(missing))
    return wins


def lufs(x, peak=False):
    """Integrated loudness (EBU R128, gated) by ffmpeg. A stem is read as one channel, as Lesson
    4's targets were; with `peak` the signal is read as the file carries it, the same on both
    channels (3.0 LU over the one-channel reading), with the loudness range and true peak."""
    tmp = os.path.join(CACHE, '_measure.wav')
    sf.write(tmp, np.stack([x, x], 1) if peak else x, SR, subtype='FLOAT')
    r = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', tmp, '-af', 'ebur128=peak=true' if peak else 'ebur128', '-f', 'null', '-'],
                       capture_output=True, text=True)
    os.remove(tmp)
    lines = r.stderr.splitlines()
    val = lambda key: next(float(l.split()[1]) for l in reversed(lines) if l.strip().startswith(key))
    return (val('I:'), val('LRA:'), val('Peak:')) if peak else val('I:')


def dbfs(v):
    return round(float(20 * np.log10(max(float(v), 1e-12))), 2)


def main():
    subprocess.run(['node', os.path.join(HERE, 'sound-kit.mjs')], check=True)   # the kit's numbers, fresh
    cues = json.load(open(os.path.join(ROOT, 'cues.json')))
    total = cues['total']
    C = cues['cues']
    K = kit()
    os.makedirs(CACHE, exist_ok=True)
    unknown = sorted({c['sound'] for c in C.values() if c['type'] == 'sound'} - set(SOUNDS))
    if unknown:
        raise SystemExit('mix.py: no sound for ' + ' '.join(unknown))
    marks = sorted(k for k, c in C.items() if c['type'] == 'mark' and k != 'open')
    if marks != sorted(ACT_MARKS):
        raise SystemExit(f'mix.py: the act marks are {marks}, not {sorted(ACT_MARKS)}')
    n = int(np.ceil(total * SR))
    stems = {k: np.zeros(n, dtype=np.float32) for k in ('voice', 'merc', 'examples', 'fx', 'bed', 'stings', 'floor')}
    report = {'total': total, 'sounds': {}, 'whooshes': {}, 'stings': {}}
    ticks = np.zeros(n, dtype=np.float32)
    lines = sorted((c['start'], k) for k, c in C.items() if c['type'] == 'line')

    for k, c in C.items():
        if c['type'] == 'line':
            x = load(os.path.join(ROOT, 'assets/voice', k + '.wav'))
            place(stems['voice'], x, c['start'], 0.9)
        elif c['type'] == 'sing':
            src = load(SAMPLES[c['note']], tempo=round(1.5 / c['dur'], 3) if c['dur'] > 1.5 else None)
            x = src[: int(c['dur'] * SR)]
            x = x * env_adsr(len(x), 0.01, 0.25)
            place(stems['merc'], x / (np.abs(x).max() + 1e-9) * 0.5, c['start'])
        elif c['type'] == 'sound':
            place(ticks if c['sound'] == 'tick' else stems['examples'], sound_for(c['sound'], c['dur']), c['start'])
            report['sounds'][k] = {'sound': c['sound'], 'start': c['start'], 'end': c['end']}
        elif c['type'] == 'sting':
            # Lesson 1's chimes, an A major chord; the title's five on the times s02 hops its notes in (L.TITLE.CHIME)
            if k == 'title':
                at, gap = K['title']['chime'][0], K['title']['chime'][1] - K['title']['chime'][0]
                place(stems['stings'], chime([220.0, 329.63, 440.0, 554.37, 659.25], 3.0, amp=0.42, stagger=gap), c['start'] + at)
                report['stings'][k] = {'first': round(c['start'] + at, 3), 'stagger': round(gap, 3), 'notes': 'A3 E4 A4 C#5 E5'}
            else:
                place(stems['stings'], chime([220.0, 329.63, 440.0, 554.37, 880.0], c['dur'], amp=0.38, stagger=0.12), c['start'] + 0.1)
                report['stings'][k] = {'first': round(c['start'] + 0.1, 3), 'stagger': 0.12, 'notes': 'A3 E4 A4 C#5 A5'}
        elif c['type'] == 'mark' and k in ACT_MARKS:
            # one soft whoosh an act: it leads the mark by 0.45 s, as the cut does by 0.15, and is
            # over before the next line starts (`next`'s line comes 0.2 s after its mark)
            nxt = min((s for s, _ in lines if s > c['start']), default=total)
            at = max(0.0, min(c['start'] - 0.45, nxt - WHOOSH))
            w = noise_whoosh(WHOOSH, seed=sum(map(ord, k)) % 97)
            w *= 0.03 / np.sqrt(np.mean(w.astype(np.float64) ** 2))   # the eight at one level, whatever their seeds
            place(stems['fx'], w, at)
            report['whooshes'][k] = {'from': round(at, 3), 'to': round(at + WHOOSH, 3), 'mark': c['start'], 'next_line': round(nxt, 3)}

    # The bed: quiet, only in its windows (FACTS 81), swelling in and out over BED_FADE so it
    # never clicks; silent to the sample under every line and sound. Each window holds the same
    # pad on its own time, zero at the window's middle, where the pad's swell tops: so every
    # pause swells alike, whatever the voices' clock (on the film's clock the pad's slow beating
    # put one pause 9 dB under another).
    wins = bed_windows(C)
    edge = lambda u: np.clip(u, 0, 1) - np.sin(2 * np.pi * np.clip(u, 0, 1)) / (2 * np.pi)   # a Hann kernel's running sum
    for w in wins:
        i0, i1 = max(0, int((w['from'] - BED_FADE) * SR)), min(n, int((w['to'] + BED_FADE) * SR))
        t = np.arange(i0, i1) / SR
        gate = edge((t - w['from']) / BED_FADE + 0.5) - edge((t - w['to']) / BED_FADE + 0.5)
        stems['bed'][i0:i1] = pad(t - (w['from'] + w['to']) / 2, freqs=(hz('A2'), hz('E3'), hz('A3'))) * gate
        w['sounds'] = [round(w['from'] - BED_FADE / 2, 3), round(w['to'] + BED_FADE / 2, 3)]
        w['full'] = [round(w['from'] + BED_FADE / 2, 3), round(w['to'] - BED_FADE / 2, 3)]
    report['bed'] = wins
    # Under it all, the room tone: in from the first 50 ms, out over the last 0.5 s, so the mix
    # never falls to digital zero between lines, in the hold or round the examples.
    tt = np.arange(n) / SR
    stems['floor'] = room_tone(n) * (np.minimum(1, tt / 0.05) * np.minimum(1, (n / SR - tt) / 0.5)).astype(np.float32)
    del tt

    # Balance by loudness, with the voice as the reference (Lesson 4's targets, unchanged): the
    # examples a little under the speech, stings and whooshes well under, the bed far under
    # (16 LU below the voice: present in the gaps, never competing), the room tone 37 LU under
    # the voice. Measured per stem (EBU R128, gated), then scaled.
    TARGET = {'voice': -18.0, 'examples': -21.0, 'merc': -20.0, 'stings': -26.0, 'fx': -30.0, 'bed': -34.0, 'floor': -55.0}
    report['balance'] = {}
    for name, x in stems.items():
        if not np.any(x):
            continue
        I = lufs(x)
        g = 10 ** ((TARGET[name] - I) / 20)
        stems[name] = (x * g).astype(np.float32)
        report['balance'][name] = {'measured': I, 'target': TARGET[name], 'gain_db': round(20 * np.log10(g), 2)}
        print(f'  {name:9s} {I:6.1f} LUFS -> {TARGET[name]:6.1f}  ({20 * np.log10(g):+.1f} dB)')

    # Two effects are set against what they sit beside, after the balance, so the whooshes'
    # level does not move with them. The ticks: each peak TICK_UNDER_LISTEN under the model
    # note's (FACTS 97). The landings: on the times s13 lands Merc's hops (the kit's L.HOP and
    # the scene's own offsets), each peak LANDING_OVER_PAD from the pad's in `break`.
    win = lambda k: slice(int(round(C[k]['start'] * SR)), int(round(C[k]['end'] * SR)))
    listen_peak = float(np.abs(stems['examples'][win('listen')]).max())
    tick_peak = listen_peak * 10 ** (-TICK_UNDER_LISTEN / 20)
    stems['fx'] += ticks * tick_peak
    pad_peak = float(np.abs(stems['bed'][win('break')]).max())
    land_peak = pad_peak * 10 ** (LANDING_OVER_PAD / 20)
    tap = landing()
    for at in K['hops']['landing']:
        if not C['break']['start'] <= at <= C['break']['end']:
            raise SystemExit(f'mix.py: a landing at {at} is outside `break`')
        place(stems['fx'], tap, at, land_peak)
    report['ticks'] = {'listen_peak_dbfs': dbfs(listen_peak), 'tick_peak_dbfs': dbfs(tick_peak), 'under_listen_db': TICK_UNDER_LISTEN,
                       'at': [C[k]['start'] for k in ('tick-in', 'tick-out')]}
    report['landings'] = {'at': K['hops']['landing'], 'rule': K['hops'], 'pad_peak_dbfs': dbfs(pad_peak), 'peak_dbfs': dbfs(land_peak),
                          'over_pad_db': LANDING_OVER_PAD}

    full = sum(stems.values())
    # a soft peak limiter (2 ms attack, 120 ms release, 5 ms look-ahead) so the
    # loudness target is not held hostage by a few example transients
    ceil = 10 ** (-2.0 / 20)
    look = int(0.005 * SR)
    env = np.abs(full)
    ahead = env.copy()
    for k in range(8, look, 8):
        np.maximum(ahead[:-k], env[k:], out=ahead[:-k])
    gain = np.minimum(1.0, ceil / np.maximum(ahead, 1e-9))
    del env, ahead
    rel = np.exp(-1 / (0.12 * SR))
    g = np.empty_like(gain)
    cur = 1.0
    for i in range(0, len(gain), 64):
        tgt = gain[i:i + 64].min()
        cur = tgt if tgt < cur else cur * rel ** 64 + tgt * (1 - rel ** 64)
        g[i:i + 64] = cur
    report['limiter'] = {'ceiling_dbfs': -2.0, 'most_db': dbfs(g.min()), 'seconds_under': round(float((g < 0.999).sum()) / SR, 3),
                         'seconds_over_1db': round(float((g < 10 ** (-1 / 20)).sum()) / SR, 3),
                         'seconds_over_3db': round(float((g < 10 ** (-3 / 20)).sum()) / SR, 3),
                         'at': round(float(np.argmin(g)) / SR, 3)}
    full = (full * g).astype(np.float32)

    # One loudness gain for everything, measured on the full mix: the target, or as near as a
    # true peak of -1.2 dBTP allows.
    I, LRA, TP = lufs(full, peak=True)
    target = -16.0
    g_db = min(target - I, -1.2 - TP)
    out = 10 ** (g_db / 20)
    odir = os.path.join(ROOT, 'assets/audio')
    os.makedirs(os.path.join(odir, 'stems'), exist_ok=True)
    stereo = lambda x: np.stack([x, x], 1)
    for name in stems:
        stems[name] = (stems[name] * g * out).astype(np.float32)
        path = os.path.join(odir, 'stems', name + '.wav')
        if np.any(stems[name]):
            sf.write(path, stereo(stems[name]), SR, subtype='PCM_24')
        elif os.path.exists(path):
            os.remove(path)                   # a stem with nothing in it (`merc`: this film has no `sing` event)
    sf.write(os.path.join(odir, 'full.wav'), stereo(full * out), SR, subtype='PCM_24')
    sf.write(os.path.join(odir, 'music-only.wav'), stereo(stems['bed'] + stems['stings'] + stems['floor']), SR, subtype='PCM_24')
    report['master'] = {'before': {'integrated': I, 'range': LRA, 'true_peak': TP}, 'target': target, 'gain_db': round(g_db, 2),
                        'expected': {'integrated': round(I + g_db, 1), 'true_peak': round(TP + g_db, 1)}}
    report['kit'] = {'file': 'assets/audio/kit-sound.json', 'sources': K['sources']}
    with open(os.path.join(odir, 'mix-report.json'), 'w') as f:
        json.dump(report, f, indent=1)
        f.write('\n')
    print(f'mix: {total:.2f}s, integrated {I:.1f} LUFS, range {LRA:.1f} LU, true peak {TP:.1f} dBTP before; gain {g_db:+.2f} dB -> '
          f'{I + g_db:.1f} LUFS, {TP + g_db:.1f} dBTP (target {target} LUFS, -1.2 dBTP or lower)')


if __name__ == '__main__':
    main()
