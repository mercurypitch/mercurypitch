"""Forced alignment of a script line's own words to its take: the time of every word, from a CTC
model, with no language model and no other service (PRODUCTION-PIPELINE § 3 Voices, trap 19).

  <venv>/bin/python -I tools/ctc_align.py --calibrate          align every Kokoro take, compare with the
                                                               model's own word times, write the constants
  <venv>/bin/python -I tools/ctc_align.py --calibrate --check  the same comparison, writing nothing
  <venv>/bin/python -I tools/ctc_align.py <audio> "<the line>" one take: its words, and what the model hears

tools/import.py uses it (`Aligner`, `place`, `compare`). Recreated for Lesson 5 from the pipeline's description of the
director's `voice-elevenlabs/ctc_align.py`; the original was lost with Lesson 4's machine.

The model is wav2vec2-base-960h as ONNX (the Xenova export, quantised: models/w2v/vocab.json and
models/w2v/onnx/model_quantized.onnx, from huggingface.co/Xenova/wav2vec2-base-960h; W2V_MODEL names
another folder). It hears 16 kHz sound and gives, every 20 ms, the probability of each of 26
capitals, the apostrophe, a word boundary and a blank.

Alignment. The line's words are spelled for that vocabulary (`spoken`): capitals, the apostrophe
kept inside a word, every other mark dropped, a hyphenated word as its parts, a numeral as its words
("3" as THREE, "3's" as THREE'S). The best path of those letters through the frames (the CTC trellis
and its Viterbi path, in numpy) gives each letter its frames; a script word runs from its first
letter's first frame to its last letter's last frame, and the output keeps the word as written. A
script word with no letter in it (a bare mark) takes no time, at the end of the word before it.

Placing the words on the sound (`place`). A CTC model marks a letter somewhere inside its sound, so a
word's start comes out a little late, by about the same amount each time, and no nearer than its
20 ms frames. Two steps set that right, the scratch voice's own two (tools/tts.py `calibrate`):
  - a silence of tts.MIN_SILENCE or more that parts two words sets the end of the first where the
    sound stops and the start of the second where it starts again (the envelope, to 5 ms), and the
    take's first and last words take the sound's own start and stop;
  - every other word start and end moves back by a constant.
tts.py's function itself is not used: it lets a silence claim the first word the model starts
within 0.3 s after it, whichever word the silence is in, which suits Kokoro's phoneme durations
but not natural speech, where the closure of a p, t or k inside a word is a silence too (on
Lesson 5's final takes it put "back" in "spring back" on the p of "spring", 0.27 s early). Here
the aligner's letters say which two words a silence parts (the last letter of one ends before it,
give or take BETWEEN; the first letter of the next starts after it): a silence inside a word sets
nothing. A silence between two words sets their edges when the aligner's own time is within
NEAR_START or NEAR_END of it (tts.py's own 0.3 s: a soft start, the w of "one", is marked up to
0.25 s late), the last such silence before a word and the first after one; otherwise the edge
keeps the aligner's time less the constant.

Calibration (`--calibrate`). The constants are measured on the scratch takes, whose word times are
Kokoro's own phoneme times (assets/voice-kokoro/<id>.words.json): every take is aligned and its word
starts and ends compared, as aligned and then as placed. A Kokoro take's own constant is its median
at the silences; an aligner's is steadier measured once over every take, so each is the median of
(aligned - Kokoro) over the word edges no silence places, written to tools/ctc-calibration.json.
`Aligner.start_lag` and `.end_lag` hold them.

A words check comes free with the model: `heard` is its greedy transcript (the likeliest letter of
every frame, repeats merged, blanks dropped), and `compare` sets it beside the script line. The model
spells by ear with no dictionary ("DIAPHRAM"), so a difference is a prompt to listen, not a verdict.

Reads the audio through ffmpeg (any format; resampled to 16 kHz there). Writes nothing but
tools/ctc-calibration.json, and that only with `--calibrate`.
"""
import difflib
import hashlib
import json
import os
import re
import subprocess
import sys
import unicodedata

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
W2V = os.environ.get('W2V_MODEL', os.path.join(ROOT, 'models', 'w2v'))
CALIBRATION = os.path.join(HERE, 'ctc-calibration.json')
KOKORO = os.path.join(ROOT, 'assets', 'voice-kokoro')

SR16 = 16000         # the model's sample rate
HOP = 320            # samples between frames (20 ms): the product of the feature encoder's strides
WIN = 400            # samples one frame sees (25 ms): frame i is samples 320 i to 320 i + 400
LEAD = 0.5           # seconds of silence put before and after the sound, so the first and last words
                     # are heard with something round them (a trimmed take starts 0.02 s before its word)
BLANK, BAR = '<pad>', '|'
THREADS = 2          # the machine is shared
BETWEEN = 0.02       # seconds: a word's last letter may end this far into the silence that follows the word
NEAR_START = (-0.03, 0.3)    # a silence's end sets the next word's start when the aligner's start is this near it
                             # (after a clear pause the aligner is 40 to 55 ms late, 131 ms for 19 in 20, and up
                             # to 0.25 s on a soft start, the w of "one", an l, a vowel; 0.3 is tools/tts.py's reach)
NEAR_END = (0.0, 0.3)        # a silence's start sets a word's end when it comes this long after the aligner's end
                             # (the sound runs on 115 to 135 ms past the last letter, 230 ms for 19 in 20; 0.3 is
                             # tools/tts.py's own reach)


# ------------------------------------------------------------------ the script's words, as the model spells

ONES = ('zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen '
        'sixteen seventeen eighteen nineteen').split()
TENS = 'twenty thirty forty fifty sixty seventy eighty ninety'.split()


def number_words(n):
    """A whole number as it is said: 3 three, 440 four hundred and forty, 2026 two thousand and twenty six."""
    if n < 20:
        return ONES[n]
    if n < 100:
        return TENS[n // 10 - 2] + ('' if n % 10 == 0 else ' ' + ONES[n % 10])
    if n < 1000:
        return ONES[n // 100] + ' hundred' + ('' if n % 100 == 0 else ' and ' + number_words(n % 100))
    if n < 1000000:
        rest = n % 1000
        return (number_words(n // 1000) + ' thousand'
                + ('' if rest == 0 else (' and ' if rest < 100 else ' ') + number_words(rest)))
    return ' '.join(ONES[int(d)] for d in str(n))


def spoken(word):
    """A script word as the model's words: 'dome-shaped' ['DOME', 'SHAPED'], '"h",' ['H'], "3's" ["THREE'S"],
    '(a' ['A'], a bare mark []."""
    w = unicodedata.normalize('NFKD', word.replace('’', "'").replace('‘', "'"))
    w = ''.join(c for c in w if not unicodedata.combining(c))
    w = re.sub(r'(\d+)\.(\d+)', lambda m: number_words(int(m.group(1))) + ' point '
               + ' '.join(ONES[int(d)] for d in m.group(2)), w)
    w = re.sub(r'\d+', lambda m: number_words(int(m.group())), w)
    out = []
    for part in re.split(r'[\s\-–—/]+', w):
        part = re.sub(r"[^A-Za-z']", '', part).upper().strip("'")
        if part:
            out.append(part)
    return out


def normalised(text):
    """A line as the model would spell it: its words in capitals, one space apart."""
    return ' '.join(p for w in text.split() for p in spoken(w))


# ------------------------------------------------------------------ sound in

def decode(path, sr):
    """Any audio file as mono float32 at sr, through ffmpeg."""
    r = subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-i', path, '-ac', '1', '-ar', str(sr),
                        '-f', 'f32le', '-'], capture_output=True)
    if r.returncode:
        raise RuntimeError(f'ffmpeg could not read {path}: {r.stderr.decode(errors="replace").strip()}')
    return np.frombuffer(r.stdout, dtype=np.float32).copy()


def resample(audio, sr, to):
    """Mono float audio at another rate, through ffmpeg's resampler (it keeps the sound in place)."""
    if sr == to:
        return np.asarray(audio, dtype=np.float32)
    r = subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-f', 'f32le', '-ar', str(sr), '-ac', '1',
                        '-i', '-', '-ar', str(to), '-f', 'f32le', '-'],
                       input=np.asarray(audio, dtype=np.float32).tobytes(), capture_output=True)
    if r.returncode:
        raise RuntimeError('ffmpeg could not resample: ' + r.stderr.decode(errors='replace').strip())
    return np.frombuffer(r.stdout, dtype=np.float32).copy()


# ------------------------------------------------------------------ the trellis

def viterbi(logp, tokens, blank, edge=None):
    """The best CTC path of `tokens` through logp (frames x vocabulary, log-probabilities).
    Returns [(first frame, last frame, mean log-probability)] per token, or None when the sound has
    fewer frames than the letters need. `edge` is a token the path may also pass through before the
    first token and after the last, or not: the model writes a word boundary at the end of a line
    (and sometimes at its start), and a path with nowhere to put it would spend the last word's
    letters on it."""
    T, L = logp.shape[0], len(tokens)
    seq = list(tokens) if edge is None else [edge] + list(tokens) + [edge]
    n = len(seq)
    S = 2 * n + 1
    ext = np.full(S, blank, dtype=np.int64)
    ext[1::2] = seq
    need = L + sum(1 for i in range(1, L) if tokens[i] == tokens[i - 1])
    if T < need:
        return None
    em = logp[:, ext]                                    # frames x states
    skip = np.zeros(S, dtype=bool)                       # a letter may follow the letter before it with no
    skip[3::2] = ext[3::2] != ext[1:-2:2]                # blank between, unless they are the same letter
    NEG = -1e30
    score = np.full(S, NEG)
    score[0], score[1] = em[0, 0], em[0, 1]
    if edge is not None:                                 # or start past the leading edge token
        score[2], score[3] = em[0, 2], em[0, 3]
    back = np.zeros((T, S), dtype=np.int8)
    idx = np.arange(S)
    for t in range(1, T):
        cand = np.full((3, S), NEG)
        cand[0] = score
        cand[1, 1:] = score[:-1]
        cand[2, 2:] = np.where(skip[2:], score[:-2], NEG)
        k = cand.argmax(0)
        score = cand[k, idx] + em[t]
        back[t] = k
    ends = [S - 1, S - 2] if edge is None else [S - 1, S - 2, S - 3, S - 4]   # or end before the trailing one
    s = max(ends, key=lambda i: score[i])
    path = np.empty(T, dtype=np.int64)
    for t in range(T - 1, -1, -1):
        path[t] = s
        s -= int(back[t, s])
    out = []
    first = 0 if edge is None else 1
    for i in range(first, first + L):
        f = np.nonzero(path == 2 * i + 1)[0]
        out.append((int(f[0]), int(f[-1]), float(em[f, 2 * i + 1].mean())))
    return out


# ------------------------------------------------------------------ the aligner

class Aligner:
    def __init__(self, model=W2V, calibration=CALIBRATION):
        import onnxruntime as rt
        self.vocab = json.load(open(os.path.join(model, 'vocab.json')))
        self.letters = {v: k for k, v in self.vocab.items()}
        self.model_path = os.path.join(model, 'onnx', 'model_quantized.onnx')
        opts = rt.SessionOptions()
        opts.intra_op_num_threads = THREADS
        opts.inter_op_num_threads = 1
        opts.log_severity_level = 3
        self.sess = rt.InferenceSession(self.model_path, opts, providers=['CPUExecutionProvider'])
        self.start_lag, self.end_lag, self.calibration = 0.0, 0.0, None
        if calibration and os.path.exists(calibration):
            self.calibration = json.load(open(calibration))
            self.start_lag, self.end_lag = self.calibration['start_lag'], self.calibration['end_lag']

    def name(self):
        return 'wav2vec2-base-960h (ONNX, quantised), CTC forced alignment'

    def emissions(self, audio, sr):
        """Log-probabilities, frames x vocabulary, of the audio with LEAD of silence either side.
        Frame i is the sound from i * 0.02 - LEAD to that + 0.025 s."""
        x = resample(audio, sr, SR16).astype(np.float64)
        pad = int(LEAD * SR16)
        x = np.concatenate([np.zeros(pad), x, np.zeros(pad)])
        x = (x - x.mean()) / np.sqrt(x.var() + 1e-7)     # the feature extractor's do_normalize
        logits = self.sess.run(None, {'input_values': x[None].astype(np.float32)})[0][0].astype(np.float64)
        logits -= logits.max(1, keepdims=True)
        return logits - np.log(np.exp(logits).sum(1, keepdims=True))

    def raw(self, logp, text):
        """Each script word's frames on the best path: [{w, f0, f1, score}] with f0 the first frame of its
        first letter, f1 the last frame of its last letter and score the mean log-probability of its
        letters' frames; a word with no letter gets f0 = f1 = None."""
        script = text.split()
        parts = [spoken(w) for w in script]
        tokens, owner = [], []                 # owner: (script word, is a letter)
        for k, ps in enumerate(parts):
            for p in ps:
                if tokens:
                    tokens.append(self.vocab[BAR])
                    owner.append((k, False))
                for c in p:
                    tokens.append(self.vocab[c])
                    owner.append((k, True))
        if not tokens:
            raise ValueError('no word of the line has a letter the model knows')
        spans = viterbi(logp, np.array(tokens), self.vocab[BLANK], edge=self.vocab[BAR])
        if spans is None:
            raise ValueError('the take is too short for the line\'s letters')
        out = []
        for k, w in enumerate(script):
            mine = [spans[i] for i, (j, letter) in enumerate(owner) if j == k and letter]
            if mine:
                n = sum(f1 - f0 + 1 for f0, f1, _ in mine)
                out.append({'w': w, 'f0': mine[0][0], 'f1': mine[-1][1],
                            'score': sum(s * (f1 - f0 + 1) for f0, f1, s in mine) / n})
            else:
                out.append({'w': w, 'f0': None, 'f1': None, 'score': None})
        return out

    def words(self, audio, sr, text, logp=None, lags=False):
        """[{w, t, e, score}]: each script word as written, as aligned: its start (its first letter's
        frame) and end (its last letter's frame's end) in seconds from the audio's start. `place`
        moves them onto the sound; lags=True takes the calibration's constants off every word instead
        (for a look at one take with no envelope)."""
        if logp is None:
            logp = self.emissions(audio, sr)
        a, b = (self.start_lag, self.end_lag) if lags else (0.0, 0.0)
        dur = len(audio) / sr
        out = []
        for r in self.raw(logp, text):
            if r['f0'] is None:
                at = out[-1]['e'] if out else 0.0
                out.append({'w': r['w'], 't': at, 'e': at, 'score': None})
                continue
            t = r['f0'] * HOP / SR16 - LEAD - a
            e = (r['f1'] * HOP + WIN) / SR16 - LEAD - b
            t = min(max(t, 0.0), dur)
            out.append({'w': r['w'], 't': t, 'e': min(max(e, t), dur), 'score': r['score']})
        return out

    def heard(self, logp):
        """The greedy transcript: the likeliest letter of every frame, repeats merged, blanks dropped."""
        ids = logp.argmax(1)
        keep = ids[np.concatenate(([True], ids[1:] != ids[:-1]))]
        s = ''.join(self.letters[i] for i in keep if i != self.vocab[BLANK])
        s = re.sub(r'<[^>]*>', '', s)
        return ' '.join(s.replace(BAR, ' ').split())


def load_tool(name):
    """A sibling tool as a module (python -I leaves the tools folder off the path)."""
    import importlib.util
    spec = importlib.util.spec_from_file_location(name.replace('-', '_').replace('.py', ''), os.path.join(HERE, name))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def place(tts, audio, aligned, start_lag, end_lag):
    """Move aligned words onto the sound. `audio` is mono at tts.SR, `aligned` is Aligner.words' list.
    Returns { words: [[t, e]], starts, ends (the indices a silence placed), first, last (the sound's
    start and stop), take_lag (the median of aligned start - the sound's start at the placed starts) }.
    The silences are tools/tts.py's: frames of tts.FRAME under tts.QUIET_DB for tts.MIN_SILENCE or more."""
    hop = int(tts.FRAME * tts.SR)
    rms = tts.frame_rms(audio, hop)
    thr = rms.max() * 10 ** (tts.QUIET_DB / 20)
    quiet = [(a * tts.FRAME, b * tts.FRAME) for a, b in tts.silences(rms, thr, int(round(tts.MIN_SILENCE / tts.FRAME)))]
    loud = np.nonzero(rms >= thr)[0]
    first, last = loud[0] * tts.FRAME, (loud[-1] + 1) * tts.FRAME
    t, e, n = [w['t'] for w in aligned], [w['e'] for w in aligned], len(aligned)
    words = [[a - start_lag, b - end_lag] for a, b in zip(t, e)]
    starts, ends, fixes = set(), set(), {}

    def start_at(k, b):                         # the last silence before a word's first letter wins
        if NEAR_START[0] <= t[k] - b <= NEAR_START[1]:
            words[k][0] = b
            starts.add(k)
            fixes[k] = t[k] - b

    def end_at(j, a):                           # the first silence after a word's last letter wins
        if j not in ends and NEAR_END[0] <= a - e[j] <= NEAR_END[1]:
            words[j][1] = a
            ends.add(j)

    start_at(0, first)
    end_at(n - 1, last)
    for a, b in quiet:
        if a <= first or b >= last:
            continue
        j = max((i for i in range(n) if e[i] <= a + BETWEEN), default=None)        # the last word wholly before it
        k = min((i for i in range(n) if t[i] >= b + NEAR_START[0]), default=None)  # the first word after it
        if j is None or k is None or k != j + 1:
            continue                                # the silence is inside a word, by the aligner's letters
        start_at(k, b)
        end_at(j, a)
    # in order, no word ending after the next one starts, and every word inside the sound (as tts.calibrate)
    for k in range(1, n):
        words[k][0] = max(words[k][0], words[k - 1][0])
    for k in range(n - 1):
        if words[k][1] > words[k + 1][0] > words[k][0]:
            words[k][1] = words[k + 1][0]
    for w in words:
        w[0] = min(max(w[0], first), last - 0.01)
        w[1] = min(max(w[1], w[0] + 0.01), last)
    return {'words': words, 'starts': starts, 'ends': ends, 'first': first, 'last': last,
            'take_lag': float(np.median(list(fixes.values()))) if fixes else 0.0}


def compare(script_text, heard):
    """The script line (normalised) against what the model heard, word by word:
    [(kind, script words, heard words)] for every stretch that differs, kind 'spelling' when the
    stretch's letters, spaces aside, are 0.6 or more alike (the model spells by ear, and joins and
    splits words), else 'words'."""
    a, b = normalised(script_text).split(), heard.split()
    out = []
    for op, i0, i1, j0, j1 in difflib.SequenceMatcher(None, a, b, autojunk=False).get_opcodes():
        if op == 'equal':
            continue
        x, y = a[i0:i1], b[j0:j1]
        near = x and y and difflib.SequenceMatcher(None, ''.join(x), ''.join(y), autojunk=False).ratio() >= 0.6
        out.append(('spelling' if near else 'words', ' '.join(x), ' '.join(y)))
    return out


# ------------------------------------------------------------------ calibration on the scratch takes

def stats(d):
    d = np.asarray(d, dtype=np.float64)
    return {'n': int(len(d)), 'median': round(float(np.median(d)), 4),
            'median_abs': round(float(np.median(np.abs(d))), 4),
            'p90_abs': round(float(np.percentile(np.abs(d), 90)), 4), 'worst_abs': round(float(np.abs(d).max()), 4)}


def show(name, st):
    return (f"{name}: median {st['median'] * 1000:+6.1f} ms; |error| median {st['median_abs'] * 1000:5.1f} ms, "
            f"90th percentile {st['p90_abs'] * 1000:5.1f} ms, worst {st['worst_abs'] * 1000:4.0f} ms ({st['n']} words)")


def calibrate(write=True):
    """Every Kokoro take aligned, against its own word file (errors are aligner minus Kokoro, seconds)."""
    import soundfile as sf
    tts = load_tool('tts.py')
    al = Aligner(calibration=None)
    script = json.load(open(os.path.join(ROOT, 'script.json')))
    takes = []
    for ev in script['events']:
        wpath = os.path.join(KOKORO, ev['id'] + '.words.json')
        if ev['type'] != 'line' or not os.path.exists(wpath):
            continue
        ref = json.load(open(wpath))['words']
        if [w['w'] for w in ref] != ev['text'].split():
            continue
        x, sr = sf.read(os.path.join(KOKORO, ev['id'] + '.wav'), dtype='float64')
        takes.append((ev['id'], x, ref, al.words(x, sr, ev['text'])))
    # as aligned
    s0 = [g['t'] - r['t'] for _, _, ref, got in takes for g, r in zip(got, ref)]
    e0 = [g['e'] - r['e'] for _, _, ref, got in takes for g, r in zip(got, ref)]
    # the edges no silence places: their medians are the constants
    s1, e1, n_s, n_e = [], [], 0, 0
    for _, x, ref, got in takes:
        p = place(tts, x, got, 0.0, 0.0)
        n_s, n_e = n_s + len(p['starts']), n_e + len(p['ends'])
        s1 += [g['t'] - r['t'] for k, (g, r) in enumerate(zip(got, ref)) if k not in p['starts']]
        e1 += [g['e'] - r['e'] for k, (g, r) in enumerate(zip(got, ref)) if k not in p['ends']]
    start_lag, end_lag = round(float(np.median(s1)), 4), round(float(np.median(e1)), 4)
    # as placed: the silences, and the constants for the rest
    s2, e2, s2p, s2u, worst = [], [], [], [], []
    for lid, x, ref, got in takes:
        p = place(tts, x, got, start_lag, end_lag)
        for k, (w, r) in enumerate(zip(p['words'], ref)):
            s2.append(w[0] - r['t'])
            e2.append(w[1] - r['e'])
            (s2p if k in p['starts'] else s2u).append(w[0] - r['t'])
            worst.append((abs(w[0] - r['t']), lid, r['w']))
    n = len(s0)
    out = {'model': 'Xenova/wav2vec2-base-960h onnx/model_quantized.onnx',
           'model_sha256': hashlib.sha256(open(al.model_path, 'rb').read()).hexdigest(),
           'reference': 'assets/voice-kokoro/<id>.words.json (Kokoro phoneme times, onsets calibrated on the envelope)',
           'takes': len(takes), 'words': n, 'lead': LEAD,
           'between': BETWEEN, 'near_start': list(NEAR_START), 'near_end': list(NEAR_END),
           'start_lag': start_lag, 'end_lag': end_lag,
           'placed_by_a_silence': {'starts': n_s, 'ends': n_e},
           'as_aligned': {'starts': stats(s0), 'ends': stats(e0)},
           'unplaced_as_aligned': {'starts': stats(s1), 'ends': stats(e1)},
           'placed': {'starts': stats(s2), 'ends': stats(e2),
                      'starts_at_a_silence': stats(s2p), 'starts_elsewhere': stats(s2u)}}
    print(f'ctc_align.py: {len(takes)} Kokoro takes, {n} words; a silence places {n_s} starts and {n_e} ends')
    print('  as aligned           ' + show('starts', out['as_aligned']['starts']))
    print('                       ' + show('ends  ', out['as_aligned']['ends']))
    print('  the edges no silence places, as aligned')
    print('                       ' + show('starts', out['unplaced_as_aligned']['starts']))
    print('                       ' + show('ends  ', out['unplaced_as_aligned']['ends']))
    print(f'  constants: those starts move back by {start_lag * 1000:+.1f} ms, those ends by {end_lag * 1000:+.1f} ms')
    print('  as placed            ' + show('starts', out['placed']['starts']))
    print('                       ' + show('ends  ', out['placed']['ends']))
    print('    starts at a silence ' + show('', out['placed']['starts_at_a_silence']))
    print('    starts elsewhere    ' + show('', out['placed']['starts_elsewhere']))
    print('  the five starts furthest out: ' + ', '.join(f'{lid} "{w}" {d * 1000:.0f} ms' for d, lid, w in sorted(worst)[-5:]))
    if write:
        json.dump(out, open(CALIBRATION, 'w'), indent=1)
        print(f'ctc_align.py: wrote {os.path.relpath(CALIBRATION, ROOT)}')
    return out


def main():
    args = sys.argv[1:]
    if '--calibrate' in args:
        calibrate(write='--check' not in args)
        return
    if len(args) != 2:
        raise SystemExit(__doc__)
    path, text = args
    tts = load_tool('tts.py')
    al = Aligner()
    x = decode(path, tts.SR).astype(np.float64)
    logp = al.emissions(x, tts.SR)
    got = al.words(x, tts.SR, text, logp)
    p = place(tts, x, got, al.start_lag, al.end_lag)
    for k, (g, w) in enumerate(zip(got, p['words'])):
        print(f"  {w[0]:7.3f}{'*' if k in p['starts'] else ' '} {w[1]:7.3f}{'*' if k in p['ends'] else ' '}  "
              f"{'' if g['score'] is None else format(g['score'], '6.2f')}  {g['w']}")
    print('(* set by a silence)')
    print('script:', normalised(text))
    print('heard: ', al.heard(logp))


if __name__ == '__main__':
    main()
