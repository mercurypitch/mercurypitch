"""Forced alignment of a script line's own words to its take: the time of every word, from a CTC
model, with no language model and no other service (PRODUCTION-PIPELINE § 3 Voices, trap 19).

  <venv>/bin/python -I tools/ctc_align.py --calibrate          align every Kokoro take, compare with the
                                                               model's own word times, write the constants
  <venv>/bin/python -I tools/ctc_align.py --calibrate --check  the same comparison, writing nothing
  <venv>/bin/python -I tools/ctc_align.py <audio> "<the line>" one take: its words, and what the model hears

tools/import.py uses it (`Aligner`). Recreated for Lesson 5 from the pipeline's description of the
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

Calibration. A CTC model marks a letter somewhere inside its sound, so a word's start comes out a
little late, by about the same amount each time. `--calibrate` measures it on the scratch takes, whose
word times are Kokoro's own phoneme times (assets/voice-kokoro/<id>.words.json): every take is aligned
and the word starts and ends compared, as aligned and then as the importer uses them. The importer's
way is the scratch voice's (tools/tts.py `calibrate`): a word after a silence starts where the sound
starts, and a word before one ends where the sound stops; the words no silence places move back by a
constant. For Kokoro that constant is each take's own median; an aligner's is steadier measured once
over every take, so it is the median of (aligned - Kokoro) over the words no silence places, one for
starts and one for ends, written to tools/ctc-calibration.json. `Aligner.start_lag` and `.end_lag`
hold them; `Aligner.words` takes them off every word when it is used alone, with no envelope.

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

def viterbi(logp, tokens, blank):
    """The best CTC path of `tokens` through logp (frames x vocabulary, log-probabilities).
    Returns [(first frame, last frame, mean log-probability)] per token, or None when the sound has
    fewer frames than the letters need."""
    T, L = logp.shape[0], len(tokens)
    S = 2 * L + 1
    ext = np.full(S, blank, dtype=np.int64)
    ext[1::2] = tokens
    need = L + sum(1 for i in range(1, L) if tokens[i] == tokens[i - 1])
    if T < need:
        return None
    em = logp[:, ext]                                    # frames x states
    skip = np.zeros(S, dtype=bool)                       # a letter may follow the letter before it with no
    skip[3::2] = ext[3::2] != ext[1:-2:2]                # blank between, unless they are the same letter
    NEG = -1e30
    score = np.full(S, NEG)
    score[0], score[1] = em[0, 0], em[0, 1]
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
    s = S - 1 if score[S - 1] >= score[S - 2] else S - 2
    path = np.empty(T, dtype=np.int64)
    for t in range(T - 1, -1, -1):
        path[t] = s
        s -= int(back[t, s])
    out = []
    for i in range(L):
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
        spans = viterbi(logp, np.array(tokens), self.vocab[BLANK])
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

    def words(self, audio, sr, text, logp=None, lags=True):
        """[{w, t, e, score}]: each script word as written, its start and end in seconds from the audio's
        start (the calibration's constants taken off unless lags is False)."""
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


def compare(script_text, heard):
    """The script line (normalised) against what the model heard, word by word:
    [(kind, script words, heard words)] for every stretch that differs, kind 'spelling' when the stretch
    has as many words on each side, give or take one (the model joins and splits words), and letters
    0.6 or more alike (it spells by ear), else 'words'."""
    a, b = normalised(script_text).split(), heard.split()
    out = []
    for op, i0, i1, j0, j1 in difflib.SequenceMatcher(None, a, b, autojunk=False).get_opcodes():
        if op == 'equal':
            continue
        x, y = a[i0:i1], b[j0:j1]
        near = (difflib.SequenceMatcher(None, ''.join(x), ''.join(y), autojunk=False).ratio() >= 0.6
                and abs(len(x) - len(y)) <= 1 and x and y)
        out.append(('spelling' if near else 'words', ' '.join(x), ' '.join(y)))
    return out


# ------------------------------------------------------------------ calibration on the scratch takes

def load_tool(name):
    """A sibling tool as a module (python -I leaves the tools folder off the path)."""
    import importlib.util
    spec = importlib.util.spec_from_file_location(name.replace('-', '_').replace('.py', ''), os.path.join(HERE, name))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


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
    for e in script['events']:
        wpath = os.path.join(KOKORO, e['id'] + '.words.json')
        if e['type'] != 'line' or not os.path.exists(wpath):
            continue
        ref = json.load(open(wpath))['words']
        if [w['w'] for w in ref] != e['text'].split():
            continue
        x, sr = sf.read(os.path.join(KOKORO, e['id'] + '.wav'), dtype='float64')
        raw = [[w['t'], max(w['e'], w['t'] + 0.01)] for w in al.words(x, sr, e['text'], lags=False)]
        takes.append((e['id'], x, ref, raw))
    # as aligned
    s0 = [r[0] - w['t'] for _, _, ref, raw in takes for r, w in zip(raw, ref)]
    e0 = [r[1] - w['e'] for _, _, ref, raw in takes for r, w in zip(raw, ref)]
    # the words no silence places (tts.calibrate leaves them where they are when their lags are 0)
    s1, e1, placed_s, placed_e = [], [], 0, 0
    for _, x, ref, raw in takes:
        w = [list(r) for r in raw]
        tts.calibrate(x, w, lags=(0.0, 0.0))
        for got, r, ref_w in zip(w, raw, ref):
            if got[0] == r[0]:
                s1.append(r[0] - ref_w['t'])
            else:
                placed_s += 1
            if got[1] == r[1]:
                e1.append(r[1] - ref_w['e'])
            else:
                placed_e += 1
    start_lag, end_lag = round(float(np.median(s1)), 4), round(float(np.median(e1)), 4)
    # as the importer uses them: the envelope, and the constants for the rest
    s2, e2, worst = [], [], []
    for lid, x, ref, raw in takes:
        w = [list(r) for r in raw]
        tts.calibrate(x, w, lags=(start_lag, end_lag))
        for got, ref_w in zip(w, ref):
            s2.append(got[0] - ref_w['t'])
            e2.append(got[1] - ref_w['e'])
            worst.append((abs(got[0] - ref_w['t']), lid, ref_w['w']))
    n = len(s0)
    out = {'model': 'Xenova/wav2vec2-base-960h onnx/model_quantized.onnx',
           'model_sha256': hashlib.sha256(open(al.model_path, 'rb').read()).hexdigest(),
           'reference': 'assets/voice-kokoro/<id>.words.json (Kokoro phoneme times, onsets calibrated on the envelope)',
           'takes': len(takes), 'words': n, 'lead': LEAD,
           'start_lag': start_lag, 'end_lag': end_lag,
           'placed_by_a_silence': {'starts': placed_s, 'ends': placed_e},
           'as_aligned': {'starts': stats(s0), 'ends': stats(e0)},
           'unplaced_as_aligned': {'starts': stats(s1), 'ends': stats(e1)},
           'calibrated': {'starts': stats(s2), 'ends': stats(e2)}}
    print(f'ctc_align.py: {len(takes)} Kokoro takes, {n} words; a silence places {placed_s} starts and {placed_e} ends')
    print('  as aligned           ' + show('starts', out['as_aligned']['starts']))
    print('                       ' + show('ends  ', out['as_aligned']['ends']))
    print('  the words no silence places, as aligned')
    print('                       ' + show('starts', out['unplaced_as_aligned']['starts']))
    print('                       ' + show('ends  ', out['unplaced_as_aligned']['ends']))
    print(f'  constants: those words\' starts move back by {start_lag * 1000:+.1f} ms, their ends by {end_lag * 1000:+.1f} ms')
    print('  envelope + constants ' + show('starts', out['calibrated']['starts']))
    print('                       ' + show('ends  ', out['calibrated']['ends']))
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
    al = Aligner()
    x = decode(path, 24000)
    logp = al.emissions(x, 24000)
    for w in al.words(x, 24000, text, logp):
        print(f"  {w['t']:7.3f} {w['e']:7.3f}  {'' if w['score'] is None else format(w['score'], '6.2f')}  {w['w']}")
    print('script:', normalised(text))
    print('heard: ', al.heard(logp))


if __name__ == '__main__':
    main()
