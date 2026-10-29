"""Build the soundtrack from cues.json: narration, Merc's sung notes, every
musical example and sung run synthesised at its exact frequency (Lesson 4: FACTS
56 to 63 and 67 to 69), transitions and a quiet bed on D.

  python tools/mix.py

Writes assets/audio/full.wav (everything), assets/audio/music-only.wav (the bed,
the room tone and the stings: what the effects are measured against) and
assets/audio/stems/*.wav. Both mixes get the same final gain, so the music-only
render really is the full mix minus the effects and the voice.

Everything is generated here: Merc's and Tavi's sung runs are the demo voice's
synthesised "ooh" (FACTS 67), the voice lines are local Kokoro until the owner's
ElevenLabs takes are imported. No downloaded music or sound. (The Echo samples
below serve only `sing` events, which this film does not use.)
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


def pad(dur, freqs=(146.83, 220.0, 293.66), amp=0.07, seed=11):
    """A quiet open-fifth pad on D (FACTS 69): slow detuned sines, breathing. Lesson 2's
    was the same pad in A."""
    n = int(dur * SR)
    t = np.arange(n) / SR
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


C_MAJ = ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5']
D_MAJ = ['D4', 'E4', 'F#4', 'G4', 'A4', 'B4', 'C#5', 'D5']
MERC, TAVI = 0.32, 0.28                       # the "ooh" levels: Lesson 2's slides, Tavi a little under


def fit(x, dur):
    """Pad or trim a sound to its cue's length."""
    n = int(round(dur * SR))
    return np.pad(x, (0, max(0, n - len(x))))[:n]


def sound_for(name, dur):
    """The musical example or sung run each `sound` event plays, at its exact pitches
    (FACTS 56 to 63 and 68). Times are seconds from the sound's cue."""
    if name == 'stop-c':                     # FACTS 58: Merc, C4 up to B4, B4 held
        x = run(even(C_MAJ[:7], 0.45, 1.2), MERC)
    elif name == 'stop-d':                   # FACTS 59: Tavi, D4 up to C#5, the octave of stop-c
        x = run(even(D_MAJ[:7], 0.45, 1.2), TAVI)
    elif name == 'land-d':                   # FACTS 59
        x = run([('C#5', 0.45), ('D5', 1.2)], TAVI)
    elif name == 'land-c':                   # FACTS 58: Merc
        x = run([('B4', 0.45), ('C5', 1.2)], MERC)
    elif name == 'scale-c':                  # FACTS 57
        x = run(even(C_MAJ, 0.45, 0.9), 0.48, voice=False)
    elif name == 'steps-c':                  # FACTS 68: one step at a time, slower
        x = run(even(C_MAJ, 0.8, 1.2), 0.48, voice=False)
    elif name == 'group-low':                # FACTS 65, 68: the page's Group brackets
        x = run(even(C_MAJ[:4], 0.45, 0.9), 0.48, voice=False)
    elif name == 'group-high':
        x = run(even(C_MAJ[4:], 0.45, 0.9), 0.48, voice=False)
    elif name == 'white-d':                  # FACTS 60: the white keys from D
        x = run(even(['D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5', 'D5'], 0.45, 0.9), 0.48, voice=False)
    elif name == 'major-d':                  # FACTS 60: the pattern from D
        x = run(even(D_MAJ, 0.45, 0.9), 0.48, voice=False)
    elif name == 'slide-g':                  # FACTS 68: G major, one black key
        x = run(even(['G4', 'A4', 'B4', 'C5', 'D5', 'E5', 'F#5', 'G5'], 0.36, 0.72), 0.48, voice=False)
    elif name == 'slide-e':                  # FACTS 68: E major, four black keys
        x = run(even(['E4', 'F#4', 'G#4', 'A4', 'B4', 'C#5', 'D#5', 'E5'], 0.36, 0.72), 0.48, voice=False)
    elif name == 'sing-a':                   # FACTS 63, 68: guide-blue's second half, D3 up to ti, held, home
        x = run([(nm, 0.8) for nm in ['D3', 'E3', 'F#3', 'G3', 'A3', 'B3']] + [('C#4', 2.0), (None, 0.6), ('D4', 1.2)], MERC + 0.02)
    elif name == 'sing-b':                   # FACTS 63, 68: guide-orange's second half, D4 up to ti, held, home
        x = run([(nm, 0.8) for nm in D_MAJ[:6]] + [('C#5', 2.0), (None, 0.6), ('D5', 1.2)], TAVI)
    elif name == 'count-in':                 # FACTS 68: Merc sings the starting note, D3, in his ooh, whose
        x = run([('D3', 0.8), (None, 0.2)], MERC)   # harmonics carry on a phone speaker (script critic 02)
    elif name == 'ti-do':                    # FACTS 68: the recap's step, in the soft tone
        x = run([('B4', 0.45), ('C5', 1.2)], 0.48, voice=False)
    else:
        raise ValueError(name)
    return fit(x, dur)


# Listening silences: the scale hangs on ti, or the viewer sings. A pad on D there would be in the
# wrong key after a C scale, and would sound home before the landing after a D one (script critic
# 01, item 1), so these pauses keep only the room tone (FACTS 69).
NO_BED = {'hang-c', 'predict-d', 'hang-d', 'wait', 'q3', 'your-turn'}


def main():
    cues = json.load(open(os.path.join(ROOT, 'cues.json')))
    total = cues['total']
    C = cues['cues']
    n = int(np.ceil(total * SR))
    stems = {k: np.zeros(n, dtype=np.float32) for k in ('voice', 'merc', 'examples', 'fx', 'bed', 'stings', 'floor')}

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
            place(stems['examples'], sound_for(c['sound'], c['dur']), c['start'])
        elif c['type'] == 'sting':
            if k == 'title':
                place(stems['stings'], chime([220.0, 329.63, 440.0, 554.37, 659.25], 3.0, amp=0.42, stagger=0.09), c['start'] + 0.05)
            else:
                place(stems['stings'], chime([220.0, 329.63, 440.0, 554.37, 880.0], c['dur'], amp=0.38, stagger=0.12), c['start'] + 0.1)
        elif c['type'] == 'mark' and k != 'open':
            place(stems['fx'], noise_whoosh(0.7, seed=sum(map(ord, k)) % 97), max(0, c['start'] - 0.45))

    # The bed: quiet, in the act transitions and under the dressed pauses
    # (predict, hum, the recap questions), so the film never drops to digital
    # silence; its open fifth on A also supports the hum. It is silent under
    # every spoken line, listening example and sung note (playbook rule 12) (playbook rule 12, coherence: no music under explaining or
    # listening). Windows closer than 1.2 s merge, so it never pumps in the
    # short gaps between lines.
    bed = pad(n / SR)[:n]
    bed = np.pad(bed, (0, n - len(bed)))
    duck = np.ones(n, dtype=np.float32)
    quiet = []
    for k, c in C.items():
        # nor under the chimes: their A major chord carries C sharp, this film's ti, over the D
        # pad (script critic 03, item 6); the chimes stay the series' own
        if c['type'] in ('sound', 'sing', 'line', 'sting') or k in NO_BED:
            pre, post = (0.25, 0.35) if c['type'] == 'line' else (0.5, 0.6)
            quiet.append((c['start'] - pre, c['end'] + post))
    quiet.sort()
    merged = []
    for a, b in quiet:
        if merged and a - merged[-1][1] < 1.2:
            merged[-1] = (merged[-1][0], max(merged[-1][1], b))
        else:
            merged.append((a, b))
    for a, b in merged:
        duck[max(0, int(a * SR)):min(n, int(b * SR))] = 0.0
    # smooth the duck so it never clicks
    k = int(0.35 * SR)
    kern = np.hanning(k).astype(np.float32)
    kern /= kern.sum()
    duck = np.convolve(duck, kern, mode='same')
    fade = np.minimum(1, np.arange(n) / (2.0 * SR)) * np.minimum(1, (n - np.arange(n)) / (3.0 * SR))
    stems['bed'] = bed * duck * fade.astype(np.float32)
    # Under it all, the room tone: in from the first 50 ms, out over the last 0.5 s.
    # The bed's duck is total, so without it the mix fell to digital zero in the
    # gaps between lines and around the examples.
    tt = np.arange(n) / SR
    stems['floor'] = room_tone(n) * (np.minimum(1, tt / 0.05) * np.minimum(1, (n / SR - tt) / 0.5)).astype(np.float32)

    # Balance by loudness, with the voice as the reference: examples and Merc's
    # sung notes a little under the speech, stings and whooshes well under, the
    # bed far under (about 16 LU below the voice: present in the gaps, never
    # competing), the room tone 37 LU under the voice (masked by any sound, a
    # faint air in the gaps). Measured per stem (EBU R128, gated), then scaled.
    TARGET = {'voice': -18.0, 'examples': -21.0, 'merc': -20.0, 'stings': -26.0, 'fx': -30.0, 'bed': -34.0, 'floor': -55.0}
    tmp = os.path.join(CACHE, '_stem.wav')
    for name, x in stems.items():
        if not np.any(x):
            continue
        sf.write(tmp, x, SR, subtype='FLOAT')
        r = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', tmp, '-af', 'ebur128', '-f', 'null', '-'], capture_output=True, text=True)
        I = next(float(l.split()[1]) for l in reversed(r.stderr.splitlines()) if l.strip().startswith('I:'))
        g = 10 ** ((TARGET[name] - I) / 20)
        stems[name] = (x * g).astype(np.float32)
        print(f'  {name:9s} {I:6.1f} LUFS -> {TARGET[name]:6.1f}  ({20 * np.log10(g):+.1f} dB)')

    full = sum(stems.values())
    # a soft peak limiter (2 ms attack, 120 ms release, 5 ms look-ahead) so the
    # loudness target is not held hostage by a few example transients
    ceil = 10 ** (-2.0 / 20)
    look = int(0.005 * SR)
    env = np.abs(full)
    env = np.maximum.reduce([np.roll(env, -k) for k in range(0, look, 8)])
    gain = np.minimum(1.0, ceil / np.maximum(env, 1e-9))
    rel = np.exp(-1 / (0.12 * SR))
    g = np.empty_like(gain)
    cur = 1.0
    for i in range(0, len(gain), 64):
        tgt = gain[i:i + 64].min()
        cur = tgt if tgt < cur else cur * rel ** 64 + tgt * (1 - rel ** 64)
        g[i:i + 64] = cur
    full = (full * g).astype(np.float32)
    music = (stems['bed'] + stems['stings'] + stems['floor']) * g
    peak = np.abs(full).max()
    gain = 0.85 / peak if peak > 0.85 else 1.0
    odir = os.path.join(ROOT, 'assets/audio')
    os.makedirs(os.path.join(odir, 'stems'), exist_ok=True)
    for name, x in stems.items():
        sf.write(os.path.join(odir, 'stems', name + '.wav'), np.stack([x * gain] * 2, 1), SR, subtype='PCM_24')
    sf.write(os.path.join(odir, 'full-raw.wav'), np.stack([full * gain] * 2, 1), SR, subtype='PCM_24')
    sf.write(os.path.join(odir, 'music-raw.wav'), np.stack([music * gain] * 2, 1), SR, subtype='PCM_24')

    # One loudness gain for both mixes, measured on the full mix.
    r = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', os.path.join(odir, 'full-raw.wav'), '-af', 'ebur128=peak=true', '-f', 'null', '-'],
                       capture_output=True, text=True)
    lines = r.stderr.splitlines()
    I = next(float(l.split()[1]) for l in reversed(lines) if l.strip().startswith('I:'))
    TP = next(float(l.split()[1]) for l in reversed(lines) if l.strip().startswith('Peak:'))
    target = -16.0
    g_db = min(target - I, -1.2 - TP)
    for src, dst in (('full-raw.wav', 'full.wav'), ('music-raw.wav', 'music-only.wav')):
        subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-i', os.path.join(odir, src), '-af', f'volume={g_db:.2f}dB',
                        '-c:a', 'pcm_s24le', os.path.join(odir, dst)], check=True)
    print(f'mix: {total:.2f}s, integrated {I:.1f} LUFS, true peak {TP:.1f} dBTP before; gain {g_db:+.2f} dB -> target {target} LUFS')


if __name__ == '__main__':
    main()
