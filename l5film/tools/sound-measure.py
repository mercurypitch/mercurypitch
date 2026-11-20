"""Measure the film's sound against the numbers the picture draws and FACTS 80. Read-only: it
reads cues.json, assets/audio/kit-sound.json (the kit's numbers, tools/sound-kit.mjs),
assets/audio/mix-report.json, the mixes and the stems, and writes only into --out.

  .venv/bin/python tools/sound-measure.py --out review/sound-01
      [--cut renders/film-draft-02-sound.mp4]      the review cut: its decoded sound is measured too
      [--picture renders/film-draft-02.mp4]        the picture: S9's traces against the starts

Writes <out>/SOUND.md (every table) and <out>/tracks/<cue>.csv (each sound's pitch and level
track, one row every 10 ms: the drawn value, the measured one, the error).

How it measures. A sung note's pitch is the instantaneous frequency of its fundamental: the
stem is band-passed round the note (3 semitones each side at full weight, tapering to nothing
at 4, in the frequency domain), made analytic, and the phase's slope read, averaged over 5 ms
round each 10 ms mark. Its level is that fundamental's amplitude. Nothing here shares code with the mixer's synthesis: the
drawn values come from the kit's JSON, the measured ones from the written WAV files.
"""
import argparse, csv, json, os, re, subprocess, sys
import numpy as np
import soundfile as sf

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
SR = 48000
HOP = 0.010
A = os.path.join(ROOT, 'assets/audio')
C = json.load(open(os.path.join(ROOT, 'cues.json')))['cues']
TOTAL = json.load(open(os.path.join(ROOT, 'cues.json')))['total']
K = json.load(open(os.path.join(A, 'kit-sound.json')))
REPORT = json.load(open(os.path.join(A, 'mix-report.json')))
EX, FX, BED, VOICE, STINGS, FLOOR = (os.path.join(A, 'stems', n + '.wav') for n in ('examples', 'fx', 'bed', 'voice', 'stings', 'floor'))
FULL, MUSIC = os.path.join(A, 'full.wav'), os.path.join(A, 'music-only.wav')


def hz(name):
    names = {'C': -9, 'D': -7, 'E': -5, 'F': -4, 'G': -2, 'A': 0, 'B': 2}
    n, rest = names[name[0]], name[1:]
    if rest.startswith('#'):
        n, rest = n + 1, rest[1:]
    return 440.0 * 2 ** ((n + 12 * (int(rest) - 4)) / 12)


def seg(path, a, b):
    """Seconds a to b of a file, its first channel, as float64 (silence outside the file)."""
    i0, i1 = int(round(a * SR)), int(round(b * SR))
    info = sf.info(path)
    assert info.samplerate == SR, path
    lo, hi = max(0, i0), min(info.frames, i1)
    x, _ = sf.read(path, start=lo, stop=hi, dtype='float64', always_2d=True)
    return np.pad(x[:, 0], (lo - i0, i1 - hi))


def db(v, floor=-200.0):
    return float(20 * np.log10(v)) if v > 10 ** (floor / 20) else floor


def analytic(x, lo, hi):
    """x band-passed from lo to hi hertz (a brick wall) as an analytic signal."""
    n = len(x)
    X = np.fft.fft(x)
    f = np.fft.fftfreq(n, 1 / SR)
    X[(f < lo) | (f > hi)] = 0
    return np.fft.ifft(2 * X)


def fundamental(x, base):
    """The analytic signal of x round `base`: full weight within 3 semitones, a raised-cosine
    taper to nothing at 4, so a neighbouring note's partial near the edge cannot ring into it."""
    n = len(x)
    X = np.fft.fft(x)
    f = np.fft.fftfreq(n, 1 / SR)
    with np.errstate(divide='ignore', invalid='ignore'):
        semis = np.abs(12 * np.log2(np.where(f > 0, f, 1e-9) / base))
    w = np.where(f > 0, 0.5 * (1 + np.cos(np.pi * np.clip(semis - 3, 0, 1))), 0.0)
    return np.fft.ifft(2 * X * w)


def kit_at(samples, t):
    return np.interp(t, np.arange(len(samples)) * K['step'], np.asarray(samples, dtype=np.float64), left=0.0)


def mean_round(v, i, half):
    return float(np.mean(v[max(0, i - half):i + half + 1]))


PRE = 0.3


def track(path, t0, length, base, drawn, drawn_db=None, a=0.03, b=None, level_ref=None, level_span=None):
    """The pitch (cents from `base`) and level of the tone in path from t0 to t0 + length,
    every 10 ms from a to b seconds into the sound, against drawn(t) cents and drawn_db(t).
    Returns rows of (t, drawn cents, measured cents, error, drawn dB, measured dB, error)."""
    b = length - 0.03 if b is None else b
    x = seg(path, t0 - PRE, t0 + length + PRE)
    z = fundamental(x, base)
    amp = np.abs(z)
    f = np.gradient(np.unwrap(np.angle(z))) * SR / (2 * np.pi)
    with np.errstate(divide='ignore', invalid='ignore'):
        cents = 1200 * np.log2(np.maximum(f, 1e-9) / base)
    idx = lambda t: int(round((t + PRE) * SR))
    half = int(0.0025 * SR)
    ref_a, ref_b = level_ref or (0.12, min(length - 0.2, 0.6))
    ref = float(np.median(amp[idx(ref_a):idx(ref_b)]))
    rows = []
    for k in range(int(np.ceil(a / HOP - 1e-9)), int(np.floor(b / HOP + 1e-9)) + 1):
        t = k * HOP
        m = mean_round(cents, idx(t), half)
        d = float(drawn(t))
        lv = db(mean_round(amp, idx(t), half) / ref)
        dd = float(drawn_db(t)) if drawn_db else 0.0
        in_level = level_span is None or level_span[0] - 1e-9 <= t <= level_span[1] + 1e-9
        rows.append((round(t, 3), d, m, m - d, dd, lv, (lv - dd) if in_level else None))
    return rows


def full_level(rows):
    """The rows between the voice's attack and its release (where its level is judged)."""
    return [r for r in rows if r[6] is not None]


def stats(rows):
    e = np.array([r[3] for r in rows])
    le = np.array([r[6] for r in rows if r[6] is not None])
    return {'n': len(rows), 'from': rows[0][0], 'to': rows[-1][0], 'mean': float(np.mean(e)), 'max': float(np.abs(e).max()), 'rms': float(np.sqrt(np.mean(e ** 2))),
            'lmax': float(np.abs(le).max()) if len(le) else None, 'lrms': float(np.sqrt(np.mean(le ** 2))) if len(le) else None}


def write_track(out, name, rows):
    os.makedirs(os.path.join(out, 'tracks'), exist_ok=True)
    with open(os.path.join(out, 'tracks', name + '.csv'), 'w', newline='') as fh:
        w = csv.writer(fh)
        w.writerow(['t_s', 'drawn_cents', 'measured_cents', 'error_cents', 'drawn_db', 'measured_db', 'error_db'])
        for r in rows:
            w.writerow([f'{r[0]:.2f}'] + [f'{v:.3f}' for v in r[1:6]] + ['' if r[6] is None else f'{r[6]:.3f}'])


def at(rows, t):
    """The row nearest t, its values under 0.005 written as 0 (never "-0.00")."""
    r = min(rows, key=lambda r: abs(r[0] - t))
    return tuple(0.0 if isinstance(v, float) and abs(v) < 0.005 else v for v in r)


ATTACK, RELEASE = 0.09, 0.18          # the voice's own, as the mixer has them: the level is judged between them


def pitch_table(out):
    """Item 1: every sung sound's pitch track against the drawn contour, and its level."""
    L = ['## 1. Pitch and level against the drawn contours (FACTS 80, 98)', '',
         'Each sound is tracked in `assets/audio/stems/examples.wav`, the stem as delivered, every 10 ms '
         'from 0.03 s after it starts to 0.03 s before it ends. "Drawn" is the kit\'s own function, read in node '
         '(`tools/sound-kit.mjs`): `L.CONTOUR.<name>.c(t)` for the takes, the Push note and Tavi\'s hold; '
         '`L.CONTOUR.vib(t, 0)` round the note for the held notes the kit draws no line for. The level is the '
         'fundamental\'s, against `L.CONTOUR.<name>.db(t)`, between the voice\'s attack (0.09 s) and its release '
         '(the last 0.18 s), which the strip does not draw. "Mean" is the track\'s mean error: how far the note\'s centre '
         'sits from its pitch. The last column is the same track read from `full.wav`, between the attack and the '
         'release (the room tone is in it, 37 LU under the voice, and blurs the reading where the note is faint).', '',
         '| Sound | Cue | Note | Points | Pitch error: mean | max | RMS | Level error: max | RMS | Read at | In full.wav: RMS, max |',
         '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |']
    wave = lambda t0=0.0: (lambda t: kit_at(K['wave'], t - t0) if t >= t0 else 0.0)
    jobs = []
    for name, cue, base, note in (('easy', 'easy', 220.0, 'A3'), ('pushed', 'pushed', 220.0, 'A3'), ('push', 'push', 220.0, 'A3'), ('demo', 'demo', 440.0, 'A4')):
        c = K['contours'][name]
        jobs.append((cue, cue, C[cue]['start'], c['len'], base, note, (lambda t, c=c: kit_at(c['c'], t)), (lambda t, c=c: kit_at(c['db'], t)), None))
    jobs.append(('gauge', 'gauge', C['gauge']['start'], K['gauge']['len'], 220.0, 'A3', wave(), None, None))
    jobs.append(('listen (Merc)', 'listen', C['listen']['start'], C['listen']['dur'], 220.0, 'A3', wave(), None, None))
    jobs.append(('listen (Tavi)', 'listen', C['listen']['start'], C['listen']['dur'], 440.0, 'A4', wave(), None, None))
    ends = K['tease']['onset'][1:] + [C['twinkle']['dur']]
    for i, (nm, on, end) in enumerate(zip(K['tease']['notes'], K['tease']['onset'], ends)):
        jobs.append((f'twinkle {i + 1}', 'twinkle', C['twinkle']['start'] + on, end - on, hz(nm), nm, wave(), None, None))
    S = K['starts']
    tone0 = {'air': S['onset']['air'], 'catch': S['onset']['catch'] + 0.003, 'together': 0.0}
    full_at = {'air': 0.5, 'catch': S['onset']['catch'] + 0.013, 'together': 0.06}
    for kind in ('air', 'catch', 'together'):
        cue = 'start-' + kind
        jobs.append((cue, cue, C[cue]['start'], S['len'], 220.0, 'A3', wave(tone0[kind]), None, (full_at[kind] + 0.05, None)))
    for kind, row in zip(('air', 'catch', 'together'), S['rows']):
        jobs.append((f'starts: {kind}', 'starts', C['starts']['start'] + row, S['len'], 220.0, 'A3', wave(tone0[kind]), None, (full_at[kind] + 0.05, None)))
    seen, means = {}, {}
    for label, cue, t0, length, base, note, drawn, drawn_db, span in jobs:
        a = 0.03 if span is None else span[0]
        lspan = (max(a, ATTACK + 0.01), length - RELEASE - 0.01)
        ref = (lspan[0] + 0.02, min(lspan[1], lspan[0] + 0.5)) if span is None else (span[0], span[0] + 0.5)
        rows = track(EX, t0, length, base, drawn, drawn_db, a=a, level_ref=ref, level_span=lspan)
        st = stats(rows)
        fst = stats(full_level(track(FULL, t0, length, base, drawn, drawn_db, a=a, level_ref=ref, level_span=lspan)))
        fname = re.sub(r'[^a-z0-9]+', '-', label.lower()).strip('-')
        write_track(out, fname, rows)
        seen[label] = rows
        read = f'{a:.2f} to {rows[-1][0]:.2f} s'
        means[label] = st['mean']
        L.append(f"| `{label}` | {t0:.3f} | {note} {base:.2f} Hz | {st['n']} | {st['mean']:+.2f} c | {st['max']:.2f} c | {st['rms']:.2f} c | "
                 f"{st['lmax']:.2f} dB | {st['lrms']:.2f} dB | {read} | {fst['rms']:.2f} c, {fst['max']:.2f} c |")
    L += ['', 'What the tracks read at the moments FACTS 80 names (measured, then drawn in brackets):', '']
    r = seen['easy']
    L.append(f"- `easy`: {at(r, 0.03)[2]:+.1f} c at 0.03 s ({at(r, 0.03)[1]:+.1f}; the line starts at -40), {at(r, 0.25)[2]:+.1f} c at 0.25 s ({at(r, 0.25)[1]:+.1f}), "
             f"{at(r, 0.5)[2]:+.1f} c at 0.50 s ({at(r, 0.5)[1]:+.1f}); the wave's first peak {max(x[2] for x in r if 0.5 <= x[0] <= 0.75):+.1f} c "
             f"({max(x[1] for x in r if 0.5 <= x[0] <= 0.75):+.1f}), its largest from 0.85 s {max(abs(x[2]) for x in r if x[0] >= 0.85):.1f} c "
             f"({max(abs(x[1]) for x in r if x[0] >= 0.85):.1f}); the level stays within {max(abs(x[6]) for x in r if x[6] is not None):.2f} dB of even.")
    r = seen['pushed']
    cen = lambda rows, a, b: float(np.mean([x[2] for x in rows if a - 1e-9 <= x[0] <= b + 1e-9]))
    cend = lambda rows, a, b: float(np.mean([x[1] for x in rows if a - 1e-9 <= x[0] <= b + 1e-9]))
    cyc = 2 / K['vib']['hz']                                   # two whole waves: their mean is the centre
    L.append(f"- `pushed`: as `easy` to 1.0 s ({at(r, 0.03)[2]:+.1f} c at 0.03 s); its centre, the mean over two whole waves, is "
             f"{cen(r, 2.75 - cyc / 2, 2.75 + cyc / 2 - HOP):+.1f} c round 2.75 s ({cend(r, 2.75 - cyc / 2, 2.75 + cyc / 2 - HOP):+.1f}: it leaves the band, 35) and "
             f"{cen(r, 3.97 - cyc, 3.97 - HOP):+.1f} c over the last two waves ({cend(r, 3.97 - cyc, 3.97 - HOP):+.1f}; 60 at 4.0 s); the level is "
             f"{at(r, 2.5)[5]:+.2f} dB at 2.5 s ({at(r, 2.5)[4]:+.2f}) and {at(r, 3.8)[5]:+.2f} dB at 3.8 s ({at(r, 3.8)[4]:+.2f}), where the release starts; "
             f"the line draws +6 dB at 4.0 s, inside the voice's release.")
    r = seen['push']
    L.append(f"- `push`: centre {cen(r, 0.24, 0.24 + cyc - HOP):+.1f} c at 50 ({cend(r, 0.24, 0.24 + cyc - HOP):+.1f}), {cen(r, 2.6, 2.6 + 2 * cyc - HOP):+.1f} c held at 100 "
             f"({cend(r, 2.6, 2.6 + 2 * cyc - HOP):+.1f}; 2.1 to 3.6 s), {cen(r, 4.9, 4.9 + cyc - HOP):+.1f} c back at 50 ({cend(r, 4.9, 4.9 + cyc - HOP):+.1f}); level {at(r, 0.3)[5]:+.2f} dB at 50, "
             f"{float(np.mean([x[5] for x in r if 2.2 <= x[0] <= 3.5])):+.2f} dB at 100 ({K['push']['top']['db']:+.2f}), {at(r, 5.2)[5]:+.2f} dB back at 50; "
             f"a step is {K['push']['centsAStep']} c and {K['push']['dbAStep']} dB by the kit.")
    r = seen['demo']
    pts = ', '.join(f"{t:.2f} s {at(r, t)[2]:+.1f} ({at(r, t)[1]:+.1f})" for t in (0.03, 0.18, 0.34, 0.5, 0.66, 0.8, 0.9))
    L.append(f"- `demo` (Tavi, A4): {pts}; from 1.25 s the wave swings {min(x[2] for x in r if x[0] >= 1.25):+.1f} to {max(x[2] for x in r if x[0] >= 1.25):+.1f} c "
             f"({min(x[1] for x in r if x[0] >= 1.25):+.1f} to {max(x[1] for x in r if x[0] >= 1.25):+.1f}), centre {cen(r, 2.0, 2.0 + 20 * cyc - HOP):+.2f} c.")
    for label in ('gauge', 'listen (Merc)', 'listen (Tavi)'):
        r = seen[label]
        L.append(f"- `{label}`: the note unchanged, its centre {means[label]:+.2f} c from its pitch; its own wave swings {min(x[2] for x in r if x[0] >= 0.45):+.1f} to "
                 f"{max(x[2] for x in r if x[0] >= 0.45):+.1f} c.")
    L.append('- `twinkle`: each note\'s centre from its pitch: ' +
             ', '.join(f"{nm} {hz(nm):.2f} Hz {means[f'twinkle {i + 1}']:+.2f} c" for i, nm in enumerate(K['tease']['notes'])) +
             '; onsets ' + ', '.join(f'{o:.1f}' for o in K['tease']['onset']) + ' s (`L.TEASE.onset`), the last note 1.0 s.')
    L.append('')
    return L


def peak_env(x, win):
    """Sliding maximum of |x| over `win` samples, centred."""
    a = np.abs(x)
    n = len(a) - win + 1
    idx = np.arange(win)[None, :] + np.arange(0, n, 8)[:, None]
    return a[idx].max(axis=1), np.arange(0, n, 8) + win // 2


def true_peak(x):
    """The largest value of x resampled 8 times (through its spectrum)."""
    n = len(x)
    X = np.fft.rfft(x)
    y = np.fft.irfft(np.concatenate([X, np.zeros(len(X) * 7)]), n * 8) * 8
    return float(np.abs(y).max())


def decoded(cut, out):
    """The review cut's sound as a WAV (48 kHz), in a scratch file under --out, removed by main."""
    path = os.path.join(out, '_cut.wav')
    subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-i', cut, '-vn', '-ar', str(SR), '-c:a', 'pcm_f32le', path], check=True)
    return path


def aac_offset(cutwav):
    """Samples the decoded cut lags full.wav by (an AAC decoder's delay, if the container does
    not take it out), found on the title chime."""
    t0 = C['title']['start']
    a = seg(FULL, t0, t0 + 1.0)
    b = seg(cutwav, t0 - 0.1, t0 + 1.1)
    corr = np.correlate(b, a, mode='valid')
    return int(np.argmax(corr)) - int(0.1 * SR)


def ticks_table(cutwav, lag):
    L = ['## 2. The ticks against `listen` (FACTS 97, LAB-CHECKS 16)', '']
    lis = (C['listen']['start'], C['listen']['end'])
    rows = []
    for label, path, off in (('full.wav', FULL, 0),) + ((('review cut (AAC, decoded)', cutwav, lag),) if cutwav else ()):
        o = off / SR
        lp = seg(path, lis[0] + o, lis[1] + o)
        l_s, l_t = np.abs(lp).max(), true_peak(lp)
        for k in ('tick-in', 'tick-out'):
            x = seg(path, C[k]['start'] + o - 0.02, C[k]['end'] + o + 0.02)
            t_s, t_t = np.abs(x).max(), true_peak(x)
            rows.append(f"| {label} | `{k}` {C[k]['start']:.3f} s | {db(t_s):.1f} dBFS | {db(l_s):.1f} dBFS | {db(l_s) - db(t_s):.1f} dB | "
                        f"{db(t_t):.1f} dBTP | {db(l_t):.1f} dBTP | {db(l_t) - db(t_t):.1f} dB |")
    L += ['| In | Tick | Tick peak | `listen` peak | Tick under | Tick true peak | `listen` true peak | Under |', '| --- | --- | --- | --- | --- | --- | --- | --- |'] + rows
    # the tick alone, from the effects stem
    k = 'tick-in'
    x = seg(FX, C[k]['start'] - 0.05, C[k]['end'] + 0.05)
    env, at_i = peak_env(x, 48)
    pk = env.max()
    over = at_i[env >= pk * 10 ** (-20 / 20)]
    heard = at_i[env >= pk * 10 ** (-60 / 20)]
    nz = np.nonzero(np.abs(x) > 10 ** (-90 / 20))[0]
    X = np.abs(np.fft.rfft(x * 1.0)) ** 2
    f = np.fft.rfftfreq(len(x), 1 / SR)
    cum = np.cumsum(X) / X.sum()
    edge = lambda q: float(f[np.searchsorted(cum, q)])
    # periodicity: the largest normalised autocorrelation at any lag a pitch from 80 Hz to 1 kHz would give
    def periodicity(y):
        y = y - y.mean()
        ac = np.correlate(y, y, mode='full')[len(y) - 1:]
        lo, hi = int(SR / 1000), int(SR / 80)
        return float((ac[lo:hi] / (ac[0] + 1e-20)).max())
    tk = x[int(0.05 * SR):int(0.08 * SR)]
    note = seg(EX, C['listen']['start'] + 0.5, C['listen']['start'] + 0.53)
    L += ['', f"The tick alone (`stems/fx.wav`, `tick-in`): within 20 dB of its peak for {(over[-1] - over[0]) / SR * 1000:.0f} ms and gone (60 dB down) "
          f"{(heard[-1] - heard[0]) / SR * 1000:.0f} ms after it starts; its first sample over -90 dBFS is {(nz[0] / SR - 0.05) * 1000:.1f} ms after its cue; half its energy lies between "
          f"{edge(0.25):.0f} and {edge(0.75):.0f} Hz, 90 % between {edge(0.05):.0f} and {edge(0.95):.0f} Hz (centre {edge(0.5):.0f} Hz); "
          f"{100 * float(X[f < 1900].sum() / X.sum()):.2f} % of it lies under 1.9 kHz, where the A3 voice's eight partials are (220 to 1,760 Hz). "
          f"No pitch: over 30 ms its largest autocorrelation at any lag from 1 to 12.5 ms (a pitch from 1 kHz down to 80 Hz) is {periodicity(tk):.2f}, "
          f"against {periodicity(note):.2f} for 30 ms of `listen`. `tick-out` is the same samples at the same level.", '']
    return L


def first_cross(env, at_i, level, start=0):
    idx = np.nonzero(env[start:] >= level)[0]
    return None if not len(idx) else at_i[start + idx[0]] / SR


def last_cross(env, at_i, level):
    idx = np.nonzero(env >= level)[0]
    return None if not len(idx) else at_i[idx[-1]] / SR


def starts_onsets():
    """Item 7: each start's onsets, measured in the examples stem, against FACTS 80."""
    S = K['starts']
    L = ['## 3. The starts\' onsets against FACTS 80 (and 75, 96)', '',
         'Measured in `stems/examples.wav`, in seconds from each start\'s own beginning (its cue, or its row in `starts`: '
         f"{', '.join(str(r) for r in S['rows'])} s by s09's own `ROW_T`). The puff and the click are read above 4 kHz, where the A3 "
         'voice has nothing (a 1 ms sliding peak, against that burst\'s own top); the tone is read on its fundamental (165 to 293 Hz), whose '
         'envelope cannot turn faster than about 8 ms, so the catch\'s 10 ms rise reads a little slower than it is. The kit draws: air, the '
         "tone's level rising from 0.25 to 0.5 s (a smoothstep); a catch, the mark at 0.15 s and the wave at full from there; together, the "
         'level rising over the first 0.06 s (`L.TRACE.level`).', '',
         '| Start | At (film) | First sound at | Burst from (10 %) | Burst to (10 %) | Tone at 10 % | 50 % | 90 % | FACTS 80 |',
         '| --- | --- | --- | --- | --- | --- | --- | --- | --- |']
    facts = {'air': 'noise 0 to 0.35 s; tone rising from 0.25 s over 0.25 s (10 % 0.299, 50 % 0.375, 90 % 0.451 on the drawn level)',
             'catch': 'silence to 0.15 s; a 3 ms click; tone at full within 10 ms (by 0.163 s)',
             'together': 'tone rising over 60 ms (10 % 0.012, 50 % 0.030, 90 % 0.048 on the drawn level); no noise, no click'}
    places = [(f'start-{k}', C[f'start-{k}']['start'], k) for k in ('air', 'catch', 'together')] + \
             [(f'starts: {k}', C['starts']['start'] + r, k) for k, r in zip(('air', 'catch', 'together'), S['rows'])]
    out = {}
    M = 0.19                                               # each side of a start: inside the 0.2 s between the rows
    for label, t0, kind in places:
        x = np.pad(seg(EX, t0 - M, t0 + S['len'] + M), int((PRE - M) * SR))
        hf = np.real(analytic(x, 4000, 20000))
        henv, hat = peak_env(hf, 48)
        z = np.abs(analytic(x, 165, 293))
        full = float(np.median(z[int((PRE + 0.8) * SR):int((PRE + 1.2) * SR)]))
        tt = np.arange(len(z)) / SR - PRE
        cross = lambda lv: float(tt[np.nonzero(z >= lv * full)[0][0]])
        quiet = np.nonzero(np.abs(x) > 10 ** (-90 / 20))[0]
        first = quiet[0] / SR - PRE
        if henv.max() > 10 ** (-70 / 20):
            b0 = first_cross(henv, hat, 0.1 * henv.max()) - PRE
            b1 = last_cross(henv, hat, 0.1 * henv.max()) - PRE
            burst = (f'{b0:.4f} s', f'{b1:.4f} s')
        else:
            b0 = b1 = None
            burst = (f'none (under {db(henv.max()):.0f} dBFS)', 'none')
        out[label] = {'t0': t0, 'kind': kind, 'first': first, 'burst': (b0, b1), 'tone': (cross(0.1), cross(0.5), cross(0.9))}
        L.append(f"| `{label}` | {t0:.3f} | {first:.4f} s | {burst[0]} | {burst[1]} | {cross(0.1):.3f} s | {cross(0.5):.3f} s | {cross(0.9):.3f} s | {facts[kind]} |")
    L += ['', '"First sound at" is the first sample over -90 dBFS: before it the stem is silent. The puff is the page\'s burst on the page\'s envelope (an exponential rise over 40 ms, '
          'held to 0.35 s, a 20 ms decay), so its 10 % points sit about 0.03 s inside its 0 and just past its 0.35 s. The tone ends inside each start: '
          'its release closes at 1.6 s, so the 0.2 s between the rows of `starts` is silent.', '']
    gaps = []
    for r in S['rows'][:-1]:
        g = seg(EX, C['starts']['start'] + r + S['len'], C['starts']['start'] + r + S['len'] + 0.2)
        gaps.append(db(np.abs(g).max(), -999))
    L += ['Between the rows of `starts` the stem is ' + ('digital silence both times' if all(g <= -999 for g in gaps) else ', '.join(f'{g:.0f} dBFS' for g in gaps)) +
          ' (the room tone is in its own stem).', '']
    return L, out


def bed_table():
    L = ['## 5. The bed and the silences (FACTS 81, DECISIONS 215)', '',
         'From `stems/bed.wav` as delivered. A window is the gap between two lines, sounds or stings that holds an act mark or a dressed pause, '
         'less 0.35 s after a line and 0.25 s before one (0.6 and 0.5 round a sound), the pad swelling across each edge over 0.35 s.', '',
         '| Holds | After, before | Pad sounds | At full level | RMS at full | Peak |', '| --- | --- | --- | --- | --- | --- |']
    for w in REPORT['bed']:
        x = seg(BED, w['full'][0], w['full'][1])
        y = seg(BED, w['sounds'][0] - 0.2, w['sounds'][1] + 0.2)
        nz = np.nonzero(np.abs(y) > 0)[0]
        a, b = w['sounds'][0] - 0.2 + nz[0] / SR, w['sounds'][0] - 0.2 + nz[-1] / SR
        L.append(f"| {', '.join('`' + h + '`' for h in w['holds'])} | `{w['after']}`, `{w['before']}` | {a:.2f} to {b:.2f} s | {w['full'][0]:.2f} to {w['full'][1]:.2f} s | "
                 f"{db(np.sqrt(np.mean(x ** 2))):.1f} dBFS | {db(np.abs(y).max()):.1f} dBFS |")
    worst = {'line': (-999, ''), 'sound': (-999, ''), 'sting': (-999, '')}
    for k, c in C.items():
        if c['type'] in worst and c['end'] > c['start']:
            v = db(np.abs(seg(BED, c['start'], c['end'])).max(), -999)
            if v > worst[c['type']][0]:
                worst[c['type']] = (v, k)
    sil = {k: db(np.abs(seg(BED, C[k]['start'], C[k]['end'])).max(), -999) for k in ('heard', 'breathe', 'hold', 'tick-in', 'tick-out')}
    fmt = lambda v: 'digital silence' if v <= -999 else f'{v:.1f} dBFS'
    L += ['', f"Under the lines the bed's largest sample is {fmt(worst['line'][0])}" + (f" (`{worst['line'][1]}`)" if worst['line'][0] > -999 else '') +
          f"; under the sounds, {fmt(worst['sound'][0])}" + (f" (`{worst['sound'][1]}`)" if worst['sound'][0] > -999 else '') +
          f"; under the chimes, {fmt(worst['sting'][0])}" + (f" (`{worst['sting'][1]}`: the pad's last 0.18 s under the title's first note)" if worst['sting'][0] > -999 else '') +
          '. In ' + ', '.join(f'`{k}` {fmt(v)}' for k, v in sil.items()) + '.', '']
    # the room tone, and the quietest the full mix ever gets
    hold = seg(FULL, C['hold']['start'] + 0.2, C['hold']['end'] - 0.2)
    L.append(f"The room tone: `hold`'s ten seconds read {db(np.sqrt(np.mean(hold ** 2))):.1f} dBFS RMS in `full.wav` (peak {db(np.abs(hold).max()):.1f} dBFS), "
             'and nothing else sounds there.')
    x, _ = sf.read(FULL, dtype='float32', always_2d=True)
    x = x[:, 0]
    w = int(0.05 * SR)
    m = len(x) // w
    rms = np.sqrt(np.mean(x[:m * w].reshape(m, w).astype(np.float64) ** 2, axis=1))
    inner = rms[2:int((TOTAL - 0.5) / 0.05)]
    L += [f"Over the whole film the quietest 50 ms of `full.wav` (from 0.1 s to 0.5 s before the end) reads {db(inner.min()):.1f} dBFS RMS: it never falls to digital silence.", '']
    return L


def landings():
    H = REPORT['landings']
    L = ['## 6. The landings, the whooshes and the chimes', '',
         f"Merc's landings come from s13's rule, read by `tools/sound-kit.mjs`: `HOP1 = at('break', 'start', {H['rule']['offsets'][0]})`, "
         f"`HOP2 = at('break', 'start', {H['rule']['offsets'][1]})`, each move `at: HOPn + L.HOP.crouch` ({H['rule']['crouch']} s) for `L.HOP.air` "
         f"({H['rule']['air']} s): take-off {H['rule']['takeoff'][0]:.2f} and {H['rule']['takeoff'][1]:.2f}, landing {H['at'][0]:.2f} and {H['at'][1]:.2f} s.", '',
         '| Landing | Onset in `stems/fx.wav` | Peak | Pad peak in `break` | Against the pad | Gone (40 dB down) after |', '| --- | --- | --- | --- | --- | --- |']
    padp = db(np.abs(seg(BED, C['break']['start'], C['break']['end'])).max())
    for t in H['at']:
        x = seg(FX, t - 0.1, t + 0.5)
        env, ai = peak_env(x, 48)
        on = first_cross(env, ai, 0.1 * env.max()) - 0.1
        gone = last_cross(env, ai, 0.01 * env.max()) - 0.1
        L.append(f"| {t:.3f} s | {t + on:.4f} s ({on * 1000:+.1f} ms) | {db(np.abs(x).max()):.1f} dBFS | {padp:.1f} dBFS | {db(np.abs(x).max()) - padp:+.1f} dB | {gone * 1000:.0f} ms |")
    def loud50(x):
        """The loudest 50 ms of x, RMS in dBFS (a 50 ms window every 5 ms)."""
        w, h = int(0.05 * SR), int(0.005 * SR)
        c = np.concatenate([[0.0], np.cumsum(x.astype(np.float64) ** 2)])
        e = (c[w::h] - c[:-w:h]) / w
        return db(float(np.sqrt(e.max()))) if len(e) else -200.0
    def band(x, lo, hi):
        return np.real(analytic(x, lo, hi))
    said = [seg(VOICE, c['start'], c['end']) for k, c in sorted(C.items(), key=lambda kv: kv[1]['start']) if c['type'] == 'line']
    v50 = sorted(loud50(x) for x in said)
    v28 = sorted(loud50(band(x, 2000, 8000)) for x in said)
    med = lambda a: a[len(a) // 2]
    L += ['', f"For scale, the narration: a line's loudest 50 ms reads {v50[0]:.1f} to {v50[-1]:.1f} dBFS RMS (median {med(v50):.1f}), and {v28[0]:.1f} to {v28[-1]:.1f} "
          f"(median {med(v28):.1f}) in 2 to 8 kHz, over the film's {len(said)} lines (`stems/voice.wav`).", '',
          '| Whoosh | From, to | Peak at | Cut (mark - 0.15) | Next line | Sample peak | Loudest 50 ms | Under the narration\'s | In 2-8 kHz, under the narration\'s | Under 150 Hz | Over 6 kHz | Rise (10 to 90 %) |',
          '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |']
    for k, w in REPORT['whooshes'].items():
        x = seg(FX, w['from'], w['to'])
        env, ai = peak_env(x, 480)
        pk = ai[np.argmax(env)] / SR
        X = np.abs(np.fft.rfft(x)) ** 2
        f = np.fft.rfftfreq(len(x), 1 / SR)
        sm = np.convolve(np.abs(x), np.ones(2400) / 2400, mode='same')
        r10, r90 = np.nonzero(sm >= 0.1 * sm.max())[0][0] / SR, np.nonzero(sm >= 0.9 * sm.max())[0][0] / SR
        L.append(f"| `{k}` | {w['from']:.3f} to {w['to']:.3f} s | {w['from'] + pk:.2f} s | {w['mark'] - 0.15:.3f} s | {w['next_line']:.3f} s | "
                 f"{db(np.abs(x).max()):.1f} dBFS | {loud50(x):.1f} dBFS | {med(v50) - loud50(x):.1f} dB | {med(v28) - loud50(band(x, 2000, 8000)):.1f} dB | "
                 f"{100 * X[f < 150].sum() / X.sum():.2f} % | {100 * X[f > 6000].sum() / X.sum():.2f} % | {(r90 - r10) * 1000:.0f} ms |")
    others = []
    for label, path, a, b in [('a tick', FX, C['tick-in']['start'] - 0.02, C['tick-in']['end'] + 0.02), ('a landing', FX, H['at'][0] - 0.02, H['at'][0] + 0.4),
                              ('the pad at a swell\'s top', BED, (REPORT['bed'][0]['from'] + REPORT['bed'][0]['to']) / 2 - 0.2, (REPORT['bed'][0]['from'] + REPORT['bed'][0]['to']) / 2 + 0.2),
                              ('the title chime', STINGS, C['title']['start'], C['title']['end']), ('`listen`', EX, C['listen']['start'], C['listen']['end']),
                              ('`gauge`', EX, C['gauge']['start'], C['gauge']['end']), ('`demo`', EX, C['demo']['start'], C['demo']['end']),
                              ('`pushed` (its last second)', EX, C['pushed']['end'] - 1.0, C['pushed']['end'])]:
        x = seg(path, a, b)
        others.append(f"{label} {loud50(x):.1f} dBFS ({med(v50) - loud50(x):.1f} dB under)")
    L += ['', 'The same reading, loudest 50 ms, for the rest: ' + '; '.join(others) + '.']
    L += ['', '| Chime | First note | Notes | Stagger | Peak in full.wav | Rings to (60 dB down) |', '| --- | --- | --- | --- | --- | --- |']
    for k, s in REPORT['stings'].items():
        x = seg(STINGS, C[k]['start'], min(TOTAL, C[k]['end'] + 0.5))
        env, ai = peak_env(x, 480)
        gone = last_cross(env, ai, 0.001 * env.max())
        L.append(f"| `{k}` | {s['first']:.3f} s | {s['notes']} | {s['stagger']} s | {db(np.abs(x).max()):.1f} dBFS | {C[k]['start'] + gone:.2f} s |")
    L.append('')
    return L


def overlaps():
    L = ['## 4. No voice over a sound (BRIEF § Audio)', '',
         'On the cue sheet, and in the stems: for every example, sung note and the hold, the nearest line each side, and the voice stem\'s '
         'largest sample inside the sound (the room tone is in its own stem, so silence there is digital).', '',
         '| Sound | From, to | Line before ends | Gap | Line after starts | Gap | Voice stem inside | Examples stem 0.1 s each side |', '| --- | --- | --- | --- | --- | --- | --- | --- |']
    lines = sorted((c['start'], c['end'], k) for k, c in C.items() if c['type'] == 'line')
    hits = []
    for k, c in sorted(C.items(), key=lambda kv: kv[1]['start']):
        if not (c['type'] == 'sound' or k == 'hold'):
            continue
        before = max((l for l in lines if l[1] <= c['start'] + 1e-9), key=lambda l: l[1], default=None)
        after = min((l for l in lines if l[0] >= c['end'] - 1e-9), key=lambda l: l[0], default=None)
        over = [l[2] for l in lines if l[0] < c['end'] - 1e-9 and l[1] > c['start'] + 1e-9]
        hits += [(k, o) for o in over]
        v = db(np.abs(seg(VOICE, c['start'], c['end'])).max(), -999)
        e0 = db(np.abs(seg(EX, c['start'] - 0.1, c['start'])).max(), -999)
        e1 = db(np.abs(seg(EX, c['end'], c['end'] + 0.1)).max(), -999)
        z = lambda q: 'silent' if q <= -999 else f'{q:.0f} dBFS'
        L.append(f"| `{k}` | {c['start']:.3f} to {c['end']:.3f} | `{before[2]}` {before[1]:.3f} | {c['start'] - before[1]:.2f} s | `{after[2]}` {after[0]:.3f} | "
                 f"{after[0] - c['end']:.2f} s | {z(v)} | {z(e0)}, {z(e1)} |" if before and after else
                 f"| `{k}` | {c['start']:.3f} to {c['end']:.3f} | {'`' + before[2] + '` ' + format(before[1], '.3f') if before else 'none'} | "
                 f"{format(c['start'] - before[1], '.2f') + ' s' if before else ''} | {'`' + after[2] + '` ' + format(after[0], '.3f') if after else 'none'} | "
                 f"{format(after[0] - c['end'], '.2f') + ' s' if after else ''} | {z(v)} | {z(e0)}, {z(e1)} |")
    L += ['', ('**No line overlaps a sound or the hold on the cue sheet.**' if not hits else '**Overlaps:** ' + ', '.join(f'`{a}` with `{b}`' for a, b in hits)), '']
    # each take's own length against its cue, and anything else that sounds under a line
    long = []
    for s, e, k in lines:
        info = sf.info(os.path.join(ROOT, 'assets/voice', k + '.wav'))
        if info.frames / info.samplerate > e - s + 0.002:
            long.append(f'`{k}` ({info.frames / info.samplerate - (e - s):+.3f} s)')
    L.append('Every take is as long as its cue (no take runs past its line\'s end).' if not long else 'Takes longer than their cue: ' + ', '.join(long) + '.')
    spill = []
    for s, e, k in lines:
        for name, path in (('examples', EX), ('fx', FX), ('bed', BED), ('stings', STINGS)):
            v = np.abs(seg(path, s, e)).max()
            if v > 0:
                spill.append((k, name, db(v), s, e))
    if spill:
        L += ['', 'What else sounds under a line (each stem\'s largest sample inside the line; the room tone is under everything):', '',
              '| Line | Stem | Largest sample | Where |', '| --- | --- | --- | --- |']
        for k, name, v, s, e in spill:
            x = np.abs(seg({'examples': EX, 'fx': FX, 'bed': BED, 'stings': STINGS}[name], s, e))
            nz = np.nonzero(x > 10 ** (-80 / 20))[0]
            where = f'{s + nz[0] / SR:.3f} to {s + nz[-1] / SR:.3f} s over -80 dBFS' if len(nz) else 'all under -80 dBFS'
            L.append(f'| `{k}` {s:.3f} to {e:.3f} | {name} | {v:.1f} dBFS | {where} |')
    else:
        L.append('No example, effect, pad or chime sounds under any line: under the lines, only the room tone.')
    L.append('')
    return L


def ebur(path):
    r = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', path, '-vn', '-af', 'ebur128=peak=true', '-f', 'null', '-'], capture_output=True, text=True)
    lines = r.stderr.splitlines()
    val = lambda key: next(float(l.split()[1]) for l in reversed(lines) if l.strip().startswith(key))
    return val('I:'), val('LRA:'), val('Peak:')


def levels(cut):
    L = ['## 7. The stems and the mix', '',
         'Each file as delivered (48 kHz, 24 bit, the same on both channels), by FFmpeg\'s `ebur128` (EBU R128, gated; true peak 4 times oversampled). '
         'The mixer balances each stem on a one-channel reading, 3.0 LU under these (Lesson 4\'s targets: voice -18, examples -21, stings -26, '
         'whooshes -30, bed -34, room tone -55), then sets one gain for everything.', '',
         '| File | Integrated | Against the voice | Range | True peak | Sample peak | Balance (one channel): measured, target, gain |', '| --- | --- | --- | --- | --- | --- | --- |']
    res = {}
    for name in ('voice', 'examples', 'stings', 'fx', 'bed', 'floor'):
        path = os.path.join(A, 'stems', name + '.wav')
        I, LRA, TP = ebur(path)
        x, _ = sf.read(path, dtype='float32', always_2d=True)
        res[name] = I
        bal = REPORT['balance'].get(name)
        L.append(f"| `stems/{name}.wav` | {I:.1f} LUFS | {I - res['voice']:+.1f} LU | {LRA:.1f} LU | {TP:.1f} dBTP | {db(float(np.abs(x).max())):.1f} dBFS | "
                 f"{bal['measured']:.1f} LUFS, {bal['target']:.1f}, {bal['gain_db']:+.1f} dB |")
        del x
    L += ['', '| Mix | Integrated | Range | True peak |', '| --- | --- | --- | --- |']
    for label, path in (('`assets/audio/full.wav`', FULL), ('`assets/audio/music-only.wav`', MUSIC)) + ((('the review cut (AAC 256k)', cut),) if cut else ()):
        I, LRA, TP = ebur(path)
        L.append(f'| {label} | {I:.1f} LUFS | {LRA:.1f} LU | {TP:.1f} dBTP |')
    # the stems add up
    total = music = None
    for name in ('voice', 'examples', 'stings', 'fx', 'bed', 'floor'):
        x, _ = sf.read(os.path.join(A, 'stems', name + '.wav'), dtype='float32', always_2d=True)
        total = x[:, 0].astype(np.float64) if total is None else total + x[:, 0]
        if name in ('stings', 'bed', 'floor'):
            music = x[:, 0].astype(np.float64) if music is None else music + x[:, 0]
        del x
    f, _ = sf.read(FULL, dtype='float32', always_2d=True)
    same = bool(np.array_equal(f[:, 0], f[:, 1]))
    n1 = db(float(np.abs(total - f[:, 0]).max()))
    del f, total
    m, _ = sf.read(MUSIC, dtype='float32', always_2d=True)
    n2 = db(float(np.abs(music - m[:, 0]).max()))
    del m
    M, Lm = REPORT['master'], REPORT['limiter']
    L += ['', f"The six stems add up to `full.wav` within {n1:.0f} dBFS, and bed + stings + floor to `music-only.wav` within {n2:.0f} dBFS (24-bit rounding); "
          f"both channels of `full.wav` are {'identical' if same else 'NOT identical'}.",
          '', f"Before the last gain the mix read {M['before']['integrated']:.1f} LUFS, {M['before']['true_peak']:.1f} dBTP; the gain is {M['gain_db']:+.2f} dB "
          f"(target {M['target']:.1f} LUFS, true peak -1.2 dBTP or lower). The peak limiter (ceiling {Lm['ceiling_dbfs']:.0f} dBFS before that gain, 5 ms look-ahead, "
          f"120 ms release) takes at most {abs(Lm['most_db']):.1f} dB, at {Lm['at']:.2f} s, and is at work for {Lm['seconds_under']:.0f} s of the film's {TOTAL:.0f} "
          f"(its release included); section 8 says where.", '']
    return L


def limiter_detail():
    """Where the limiter works: the full mix against the stems' plain sum cannot be had from the files (the stems carry its
    gain), so it is read from the voice stem's own peaks: the limiter holds the mix to its ceiling."""
    x, _ = sf.read(FULL, dtype='float32', always_2d=True)
    x = np.abs(x[:, 0])
    ceil = 10 ** ((-2.0 + REPORT['master']['gain_db']) / 20)
    w = int(0.05 * SR)
    m = len(x) // w
    pk = x[:m * w].reshape(m, w).max(axis=1)
    at_ceiling = np.nonzero(pk >= ceil * 0.985)[0]
    L = ['## 8. The limiter', '',
         f"`full.wav`'s samples reach the limiter's ceiling ({db(ceil):.1f} dBFS after the last gain) in {len(at_ceiling)} of its {m} 50 ms windows "
         f"({len(at_ceiling) * 0.05:.1f} s)."]
    by = {}
    for i in at_ceiling:
        t = i * 0.05
        k = next((k for k, c in C.items() if c['type'] in ('line', 'sound', 'sting') and c['start'] - 0.05 <= t <= c['end'] + 0.05), 'elsewhere')
        by[k] = by.get(k, 0) + 1
    typ = {}
    for k, n in by.items():
        t = C[k]['type'] if k in C else 'elsewhere'
        typ[t] = typ.get(t, 0) + n
    L.append('By kind: ' + ', '.join(f'{t} {n}' for t, n in sorted(typ.items(), key=lambda kv: -kv[1])) + '. The most in one cue: ' +
             ', '.join(f'`{k}` {n}' for k, n in sorted(by.items(), key=lambda kv: -kv[1])[:6]) + '.')
    Lm = REPORT['limiter']
    if 'seconds_over_1db' in Lm:
        peaks = {}
        for name in ('examples', 'stings', 'fx', 'bed'):
            y, _ = sf.read(os.path.join(A, 'stems', name + '.wav'), dtype='float32', always_2d=True)
            peaks[name] = db(float(np.abs(y[:, 0]).max()))
            del y
        top = max(peaks, key=peaks.get)
        L.append(f"By the mixer's own count it holds the mix down by more than 1 dB for {Lm['seconds_over_1db']:.1f} s and by more than 3 dB for {Lm['seconds_over_3db']:.1f} s "
                 f"(its 120 ms release included); the most is {abs(Lm['most_db']):.1f} dB at {Lm['at']:.2f} s. Only narration reaches it: of the other stems the highest "
                 f"sample is the {top} stem's, {peaks[top]:.1f} dBFS, {db(ceil) - peaks[top]:.1f} dB under the ceiling.")
    L.append('')
    return L


# ---------------------------------------------------------------- the picture: S9's traces against the starts
def frames(film, n0, count, box):
    """`count` frames of the film from frame n0, cropped to box (x, y, w, h), as gray arrays."""
    x, y, w, h = box
    r = subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=r_frame_rate', '-of', 'csv=p=0', film], capture_output=True, text=True)
    num, den = r.stdout.strip().split('/')
    fps = float(num) / float(den)
    # -fps_mode passthrough: without it FFmpeg repeats the first frame after a seek to fill its constant frame rate, and
    # every frame after it reads one late (the first run of this table read the picture 33 ms behind for that reason)
    p = subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-ss', f'{(n0 - 0.5) / fps:.6f}', '-i', film, '-frames:v', str(count),
                        '-vf', f'crop={w}:{h}:{x}:{y},format=gray', '-fps_mode', 'passthrough', '-f', 'rawvideo', '-'], capture_output=True, check=True)
    got = np.frombuffer(p.stdout, dtype=np.uint8).reshape(-1, h, w)
    # the proof: the first frame alone, asked for by itself, is the same picture
    one = subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-ss', f'{(n0 + 1 - 0.5) / fps:.6f}', '-i', film, '-frames:v', '1',
                          '-vf', f'crop={w}:{h}:{x}:{y},format=gray', '-fps_mode', 'passthrough', '-f', 'rawvideo', '-'], capture_output=True, check=True)
    if not np.array_equal(np.frombuffer(one.stdout, dtype=np.uint8).reshape(h, w), got[1]):
        raise SystemExit(f'sound-measure: frame {n0 + 1} read in a run is not frame {n0 + 1} read alone: the frame numbers cannot be trusted')
    return got, fps


def picture_sync(film, onsets):
    S = K['starts']
    r = subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=r_frame_rate', '-of', 'csv=p=0', film], capture_output=True, text=True)
    num, den = r.stdout.strip().split('/')
    fps = float(num) / float(den)
    X0, X1 = 700, 1600                                   # the strip and every row of the stack: x(t) = 700 + 562.5 t (L.TRACE)
    px = (X1 - X0) / S['len']
    X = lambda tau: X0 + px * tau
    rows_y = {'start-air': (430, 110), 'start-catch': (430, 110), 'start-together': (430, 110),
              'starts: air': (250, 70), 'starts: catch': (450, 70), 'starts: together': (650, 70)}
    # where the drawn level passes 10 % of full (L.TRACE.level, the kit's samples)
    ten = {k: float(np.nonzero(np.asarray(S['level'][k]) >= 0.1)[0][0]) * K['step'] for k in ('air', 'together')}
    L = ['## 9. The starts against S9\'s drawn traces (DECISIONS 194)', '',
         f"The picture is `{os.path.relpath(film, ROOT)}` ({fps:g} frames a second; frame n shows the film at n / {fps:g} s, the video stream starting at 0 like "
         'the sound). In each frame the trace\'s head is the rightmost bright stroke in the strip (the wave is drawn up to the head, flat until its tone starts; a '
         f"finished trace behind it is a 30 % ghost and is not counted). The trace draws at x = 700 + {px:g} t (`L.TRACE`), so the head's place is the picture's own "
         'time for that start, and the frame\'s time less the start\'s cue (or its row in `starts`) is the sound\'s.', '',
         '**The picture\'s clock against the sound\'s**, over each start\'s first 0.5 s:', '',
         '| Start | Cue (film) | Frames read | Picture - sound, mean | Worst | In pixels of the head (mean) |', '| --- | --- | --- | --- | --- | --- |']
    ev = ['', '**Each onset, in the sound and in the picture.** The picture can show an onset only in the first frame at or after it, so it follows the sound by '
          f'up to one frame ({1000 / fps:.1f} ms here; 16.7 ms in the 60-frame final) and never leads it. Where a cue falls 3 ms before a frame, that frame holds a '
          'line under 2 px long, which cannot be read, and the next frame is counted (36.7 ms). "Passed x" allows the 3 px the head reads short.', '',
          '| Start | Onset | Sound (film) | During frame | Picture: first frame showing it | Picture after sound |', '| --- | --- | --- | --- | --- | --- |']
    detail = []
    SHORT = 3                                            # px the head reads short of its drawn place, at most (the table above)
    for label, o in onsets.items():
        t0, kind = o['t0'], o['kind']
        yc, h = rows_y[label]
        n0 = int(np.floor(t0 * fps)) - 3
        count = int(0.75 * fps) + 5
        box = (X0 - 20, yc - h - 6, X1 - X0 + 40, 2 * h + 12)
        fr, _ = frames(film, n0, count, box)
        heads, marks = [], []
        xm = int(round(X(S['onset']['catch']))) - box[0]
        for f in fr:
            bright = f >= 150
            cols = np.nonzero(bright.any(axis=0))[0]
            heads.append((cols.max() + box[0]) if len(cols) else None)
            marks.append(int(bright[:, xm - 2:xm + 3].any(axis=1).sum()))
        tf = [(n0 + i) / fps for i in range(len(fr))]
        first = lambda test: next((i for i in range(len(fr)) if tf[i] >= t0 - 1e-6 and test(i)), None)
        diffs = [(hd - 1.25 - X0) / px - (tf[i] - t0) for i, hd in enumerate(heads)
                 if hd is not None and t0 < tf[i] <= t0 + 0.5 and hd > X0 + 2]
        mean, worst = float(np.mean(diffs)) * 1000, float(max(diffs, key=abs)) * 1000
        L.append(f"| `{label}` | {t0:.3f} s | {len(diffs)} | {mean:+.1f} ms | {worst:+.1f} ms | {mean / 1000 * px:+.1f} px |")
        fno = lambda t: int(np.floor(t * fps + 1e-9))
        span = lambda t: f"{fno(t)} ({fno(t) / fps:.3f} to {(fno(t) + 1) / fps:.3f} s)"
        row = lambda what, ts, i, how: ev.append(
            f"| `{label}` | {what} | {ts:.3f} s | {span(ts)} | " + (f"{n0 + i} ({tf[i]:.3f} s): {how} | {(tf[i] - ts) * 1000:+.1f} ms |" if i is not None else 'not found | |'))
        begun = first(lambda i: heads[i] is not None and heads[i] > X0 + 2)
        if kind == 'air':
            row('the puff begins (0 s)', t0, begun, 'the first dots and the line, more than 2 px long')
            i = first(lambda i: heads[i] is not None and heads[i] - 1.25 + SHORT >= X(ten['air']))
            row(f"the tone at 10 % ({ten['air']:.3f} s on the drawn level; {o['tone'][0]:.3f} s measured)", t0 + o['tone'][0], i,
                f"its head has passed x {X(ten['air']):.0f}, where the wave is drawn at 10 %")
        elif kind == 'catch':
            row('the trace begins (0 s: silence, a flat line)', t0, begun, 'the line, more than 2 px long')
            i = first(lambda i: marks[i] >= h)
            row(f"the click ({S['onset']['catch']} s; {o['burst'][0]:.4f} s measured)", t0 + o['burst'][0], i, f'the mark stands, {marks[i] if i is not None else 0} px tall')
        else:
            row('the tone begins (0 s)', t0, begun, 'the wave from the gold tick, more than 2 px long')
            i = first(lambda i: heads[i] is not None and heads[i] - 1.25 + SHORT >= X(ten['together']))
            row(f"the tone at 10 % ({ten['together']:.3f} s on the drawn level; {o['tone'][0]:.3f} s measured)", t0 + o['tone'][0], i,
                f"its head has passed x {X(ten['together']):.0f}, where the wave is drawn at 10 %")
        detail.append((label, [(n0 + i, tf[i], heads[i]) for i in range(len(fr))]))
    L += ['', f'One pixel of the head is {1000 / px:.1f} ms. The head reads 1 to 3 px short of its drawn place in every frame (the stroke\'s tip is anti-aliased and '
          'the encoder softens it; a tip counts from luma 150), which is the whole of the mean above: the trace is drawn on the sound\'s clock.']
    return L + ev + [''], detail


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--out', required=True)
    ap.add_argument('--cut')
    ap.add_argument('--picture')
    ap.add_argument('--only', help='development: sections to run, e.g. 1,3 (nothing is written)')
    args = ap.parse_args()
    out = os.path.join(ROOT, args.out) if not os.path.isabs(args.out) else args.out
    os.makedirs(out, exist_ok=True)
    cut = (os.path.join(ROOT, args.cut) if not os.path.isabs(args.cut) else args.cut) if args.cut else None
    film = (os.path.join(ROOT, args.picture) if not os.path.isabs(args.picture) else args.picture) if args.picture else None
    cutwav, lag = None, 0
    if cut:
        cutwav = decoded(cut, out)
        lag = aac_offset(cutwav)
    doc = ['# Lesson 5: the sound, measured', '',
           f"`tools/sound-measure.py`, from `assets/audio/` (mixed by `tools/mix.py` from `cues.json`, {TOTAL:.3f} s) and the kit's numbers in "
           '`assets/audio/kit-sound.json` (`tools/sound-kit.mjs`). Every number here is read from a written file; none is the mixer\'s own claim. '
           'What a person has to listen to is listed in the hand-back, not here.', '',
           'Beside this file: `tracks/` (each sound\'s pitch and level track), `starts-picture.csv` (the traces\' heads, frame by frame), `audio.md` '
           '(the skill\'s `measure.py audio` on the review cut against `music-only.wav`: there every line and example counts as an effect, as in Lesson 4), '
           '`effects/audio.md` (the same measure on the effects alone, `music-only.wav` + `stems/fx.wav`, against `music-only.wav`) and `check.json` '
           '(the root\'s `check` with the full mix).', '']
    if args.only:
        todo = set(args.only.split(','))
        import tempfile
        tmp = tempfile.mkdtemp()
        parts = []
        if '1' in todo: parts += pitch_table(tmp)
        if '2' in todo: parts += ticks_table(cutwav, lag)
        onsets = None
        if '3' in todo or '9' in todo:
            s_lines, onsets = starts_onsets()
            parts += s_lines if '3' in todo else []
        if '4' in todo: parts += overlaps()
        if '5' in todo: parts += bed_table()
        if '6' in todo: parts += landings()
        if '7' in todo: parts += levels(cut)
        if '8' in todo: parts += limiter_detail()
        if '9' in todo and film: parts += picture_sync(film, onsets)[0]
        if cutwav: os.remove(cutwav)
        print('\n'.join(parts))
        return
    doc += pitch_table(out)
    doc += ticks_table(cutwav, lag)
    if cutwav:
        doc += [f"The review cut's sound was decoded and lined up with `full.wav` on the title chime ({lag} samples apart).", '']
    s_lines, onsets = starts_onsets()
    doc += s_lines
    doc += overlaps()
    doc += bed_table()
    doc += landings()
    doc += levels(cut)
    doc += limiter_detail()
    if film:
        p_lines, detail = picture_sync(film, onsets)
        doc += p_lines
        with open(os.path.join(out, 'starts-picture.csv'), 'w', newline='') as fh:
            w = csv.writer(fh)
            w.writerow(['start', 'frame', 'frame_time_s', 'head_x_px'])
            for label, rows in detail:
                for n, t, hd in rows:
                    w.writerow([label, n, f'{t:.4f}', '' if hd is None else hd])
    if cutwav:
        os.remove(cutwav)
    with open(os.path.join(out, 'SOUND.md'), 'w') as fh:
        fh.write('\n'.join(doc) + '\n')
    print('\n'.join(doc))


if __name__ == '__main__':
    main()
