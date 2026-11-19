"""Speak script lines with the local Kokoro voice: per line a WAV, its loudness envelope and the
time of every word, from the model's own phoneme timing.

  <venv>/bin/python -I tools/tts.py                 speak every line whose text, voice or speed changed
  <venv>/bin/python -I tools/tts.py b7 o4           speak these lines again, changed or not
  <venv>/bin/python -I tools/tts.py --check         list the lines that would be spoken; speak nothing
  <venv>/bin/python -I tools/tts.py --skip=b7,o4    leave these lines alone (cues.py: the imported takes)

tools/cues.py runs it (with TTS_PYTHON) before it builds the clock; run it alone only to re-speak a
line. Recreated for Lesson 5 from Lesson 2's contract (tools/CHANGES.md, 17 October: "tts.py: the
time of every word, from the model"); the original was lost with Lesson 4's project.

Reads
  script.json                     the lines, and the voice and speed of each host (`voices`); a line
                                  may name its own `voice` and `speed`
  tools/scratch-voices.json       the scratch voice and speed of each host, in place of script.json's
                                  `voices` when it exists (the board's script.json is not changed for
                                  the scratch voice; Tavi at 0.78, DECISIONS 126)
  models/kokoro-v1.0.onnx         KOKORO_MODEL overrides it (never changed: see Word times)
  models/voices-v1.0.bin          KOKORO_VOICES overrides it
Writes, in assets/voice-kokoro/ (the scratch takes; tools/cues.py installs them in assets/voice/)
  <id>.wav                        24 kHz mono, 16-bit: the line trimmed to PAD before its first word
                                  and PAD after its last, set to LUFS integrated
  <id>.env.json                   { rate, level: [...] }: the loudness envelope at ENV_RATE a second,
                                  0 to 1 (1 is the line's 95th-percentile voiced frame); merc-pass.mjs
                                  opens Merc's mouth from it (voiced above 0.04)
  <id>.words.json                 { source, lag, words: [{ w, t, e }] }: each word of the script line,
                                  as written, with its start and end in seconds from the WAV's start
  _lines.json                     what each take was made from (text, voice, speed), so an unchanged
                                  line is never spoken twice

Word times. Kokoro predicts a duration for every phoneme before it makes the sound, but the v1.0
graph keeps that tensor (/encoder/Gather_output_0, the rounded durations after the speed divide)
internal. This tool adds it as a second graph output named `duration`, in memory: a second
GraphProto field appended to the ModelProto's bytes, holding one Identity node and one output, which
protobuf merges into the graph on load. The model file is never changed and no package is added.
kokoro-onnx 0.6.1 then turns the durations into phoneme times (`Kokoro.has_timings`).
The audio is the plain model's, sample for sample: the timed session runs kokoro-onnx's `_prepare`
and `_create_batches` without `insert_pauses` (which only acts when the model reports timings, so
the plain model never applies it). Every run checks its first line against the plain model and
falls back to the plain model, with no word times, on any difference (cues.py then estimates that
run's words by letters and says so).
espeak runs some short words together and splits others; the script's words are matched to the
spoken ones by a small alignment on phoneme counts (merges and splits of up to three words), and a
merged word's span is shared by each word's own phoneme count.
The model marks a word a little late (its onset lands near the first vowel). A word that follows a
silence takes its true onset from the envelope, and its end, when a silence follows it; the line's
other words move back by the median of those onset corrections (`lag` in the words file).

Environment: KOKORO_MODEL, KOKORO_VOICES (as Lessons 1 to 4).
"""
import json
import os
import subprocess
import sys

import numpy as np
import onnxruntime as rt
import soundfile as sf

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
MODEL = os.environ.get('KOKORO_MODEL', os.path.join(ROOT, 'models', 'kokoro-v1.0.onnx'))
VOICES = os.environ.get('KOKORO_VOICES', os.path.join(ROOT, 'models', 'voices-v1.0.bin'))
OUT = os.path.join(ROOT, 'assets', 'voice-kokoro')

SR = 24000
LANG = 'en-us'
SENTENCE_PAUSE, CLAUSE_PAUSE = 0.25, 0.1   # kokoro-onnx's create() defaults, so the audio is create()'s
PAD = 0.02           # seconds of the take kept before the first word's onset and after the last word's end
FADE = 0.005         # seconds of fade at each trimmed edge (inside the pad, where the take is near silence)
LUFS = -22.8         # every take's integrated loudness, the level Lesson 4's ElevenLabs import set its takes to
PEAK = 0.97          # never above this sample peak (the gain gives way, and the run says so)
ENV_RATE = 100       # envelope frames a second
FRAME = 0.005        # seconds per frame for the onset search
QUIET_DB = -40.0     # a frame this far under the line's loudest frame is silence (kokoro-onnx's pauses use -40)
MIN_SILENCE = 0.05   # a silence must last this long to count as one before or after a word
SEP = set(' !"(),.:;?—“”…→↓↗↘')   # phoneme-string marks that separate spoken words


# ------------------------------------------------------------------ the timed session

def _varint(n):
    out = bytearray()
    while True:
        b, n = n & 0x7F, n >> 7
        out.append(b | 0x80 if n else b)
        if not n:
            return bytes(out)


def _field(num, payload):
    """A length-delimited protobuf field."""
    return _varint((num << 3) | 2) + _varint(len(payload)) + payload


def _int_field(num, value):
    return _varint(num << 3) + _varint(value)


def timed_model_bytes(path=MODEL):
    """The model's bytes with the phoneme durations as a second output, `duration` (int64, one per token,
    the two pad tokens included). Appending a second ModelProto.graph (field 7) holding only the new node
    (GraphProto.node, field 1) and output (GraphProto.output, field 12) merges them into the graph."""
    s = str.encode
    node = _field(1, s('/encoder/Gather_output_0')) + _field(2, s('duration')) + _field(3, s('tts_duration_out')) + _field(4, s('Identity'))
    shape = _field(1, _field(2, s('tokens')))                       # TensorShapeProto.dim { dim_param }
    tensor = _int_field(1, 7) + _field(2, shape)                    # elem_type INT64, shape
    output = _field(1, s('duration')) + _field(2, _field(1, tensor))  # ValueInfoProto { name, type { tensor_type } }
    return open(path, 'rb').read() + _field(7, _field(1, node) + _field(12, output))


def kokoro_timed():
    from kokoro_onnx import Kokoro
    sess = rt.InferenceSession(timed_model_bytes(), providers=['CPUExecutionProvider'])
    k = Kokoro.__new__(Kokoro)
    k._setup(session=sess, model_path=MODEL, voices_path=VOICES, espeak_config=None, vocab_config=None)
    if not k.has_timings:
        raise RuntimeError('the timed session reports no durations')
    return k


def speak_timed(k, text, voice, speed):
    """(audio, [Timing]) exactly as Kokoro.create() would make the audio."""
    style, _, batches = k._prepare(text, voice, speed, LANG, False, SENTENCE_PAUSE, CLAUSE_PAUSE)
    return k._create_batches(batches, style, speed, True)


# ------------------------------------------------------------------ words

def spoken_words(timings):
    """Runs of phonemes between separators: [(start, end, phoneme count)]."""
    out, cur = [], None
    for p in timings:
        if p.phoneme in SEP:
            if cur:
                out.append(tuple(cur))
                cur = None
            continue
        if cur is None:
            cur = [p.start, p.end, 1]
        else:
            cur[1] = p.end
            cur[2] += 1
    if cur:
        out.append(tuple(cur))
    return out


def phoneme_counts(k, words):
    """Each script word's phoneme count when espeak says it alone (at least 1)."""
    import phonemizer
    from kokoro_onnx.tokenizer import _espeak_lock
    bare = [w.strip('"“”‘’()[]:;,.!?—…').strip("'") or w for w in words]
    with _espeak_lock:
        ph = phonemizer.phonemize(bare, LANG, preserve_punctuation=False, with_stress=True)
    vocab = k.tokenizer.vocab
    return [max(1, sum(1 for c in p if c in vocab and c not in SEP)) for p in ph]


GROUPS = [(1, 1), (2, 1), (3, 1), (1, 2), (1, 3)]
UNEVEN = 1.0   # the cost of a merge or a split, in phonemes


def align(expect, have):
    """Script words to spoken words: [(script slice, spoken slice)], or None."""
    n, m = len(expect), len(have)
    INF = float('inf')
    cost = [[INF] * (m + 1) for _ in range(n + 1)]
    back = [[None] * (m + 1) for _ in range(n + 1)]
    cost[0][0] = 0.0
    for i in range(n + 1):
        for j in range(m + 1):
            if cost[i][j] == INF:
                continue
            for a, b in GROUPS:
                if i + a > n or j + b > m:
                    continue
                c = cost[i][j] + abs(sum(expect[i:i + a]) - sum(have[j:j + b])) + (0 if (a, b) == (1, 1) else UNEVEN)
                if c < cost[i + a][j + b]:
                    cost[i + a][j + b] = c
                    back[i + a][j + b] = (i, j)
    if cost[n][m] == INF:
        return None
    out, i, j = [], n, m
    while (i, j) != (0, 0):
        pi, pj = back[i][j]
        out.append(((pi, i), (pj, j)))
        i, j = pi, pj
    return out[::-1]


# ------------------------------------------------------------------ the envelope

def frame_rms(x, hop):
    n = len(x) // hop
    return np.sqrt((x[: n * hop].reshape(n, hop).astype(np.float64) ** 2).mean(1))


def silences(rms, thr, min_frames):
    """Quiet runs of at least min_frames frames: [(first frame, end frame)]."""
    out, start = [], None
    for i, q in enumerate(rms < thr):
        if q and start is None:
            start = i
        elif not q and start is not None:
            if i - start >= min_frames:
                out.append((start, i))
            start = None
    if start is not None and len(rms) - start >= min_frames:
        out.append((start, len(rms)))
    return out


def calibrate(audio, words):
    """Move each word onto the sound: words = [[t, e]] in seconds from the audio's start (changed in
    place). Returns (lag, first onset, last offset) in seconds.

    Each silence of MIN_SILENCE or more is claimed by the first word the model starts after the
    silence starts (its onset is the silence's end, within 0.3 s of the model's onset) and by the last
    word the model starts before it (its end is the silence's start, from 0.6 s before the model's end,
    which often holds the pause a mark makes, to 0.3 s after it); a word keeps the first silence that
    claims it. The take's leading and trailing quiet count as silences."""
    hop = int(FRAME * SR)
    rms = frame_rms(audio, hop)
    thr = rms.max() * 10 ** (QUIET_DB / 20)
    quiet = [(a * FRAME, b * FRAME) for a, b in silences(rms, thr, int(round(MIN_SILENCE / FRAME)))]
    loud = np.nonzero(rms >= thr)[0]
    first, last = loud[0] * FRAME, (loud[-1] + 1) * FRAME
    if not quiet or quiet[0][0] > 0:
        quiet.insert(0, (0.0, first))
    if quiet[-1][1] < len(rms) * FRAME:
        quiet.append((last, len(audio) / SR))
    model = [tuple(w) for w in words]
    fixes, onset_fixed, end_fixed = [], set(), set()
    for a, b in quiet:
        k = next((i for i, (t, _) in enumerate(model) if t >= a - 1e-9), None)
        if k is not None and k not in onset_fixed and -0.05 <= model[k][0] - b <= 0.3:
            fixes.append(model[k][0] - b)
            words[k][0] = b
            onset_fixed.add(k)
        j = next((i for i in range(len(model) - 1, -1, -1) if model[i][0] + 0.05 < a), None)
        if j is not None and j not in end_fixed and -0.6 <= a - model[j][1] <= 0.3:
            words[j][1] = a
            end_fixed.add(j)
    lag = float(np.median(fixes)) if fixes else 0.0
    for k in range(len(words)):
        if k not in onset_fixed:
            words[k][0] -= lag
        if k not in end_fixed:
            words[k][1] -= lag
    # in order, and no word ending after the next one starts
    for k in range(1, len(words)):
        words[k][0] = max(words[k][0], words[k - 1][0])
    for k in range(len(words) - 1):
        if words[k][1] > words[k + 1][0] > words[k][0]:
            words[k][1] = words[k + 1][0]
    # and every word inside the sound: a last word the model holds past the take's end ends with it
    for w in words:
        w[0] = min(max(w[0], first), last - 0.01)
        w[1] = min(max(w[1], w[0] + 0.01), last)
    return lag, first, last


def envelope(audio):
    hop = SR // ENV_RATE
    rms = frame_rms(np.pad(audio, (0, hop)), hop)
    thr = rms.max() * 10 ** (QUIET_DB / 20)
    voiced = rms[rms >= thr]
    ref = float(np.percentile(voiced, 95)) if len(voiced) else 1.0
    return [round(float(min(1.0, v / ref)), 3) for v in rms]


def loudness(audio):
    """Integrated loudness (EBU R128) through ffmpeg, or None for a take too short to gate."""
    r = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-f', 'f32le', '-ar', str(SR), '-ac', '1', '-i', '-',
                        '-af', 'ebur128', '-f', 'null', '-'], input=audio.astype(np.float32).tobytes(), capture_output=True)
    for line in reversed(r.stderr.decode(errors='replace').splitlines()):
        s = line.strip()
        if s.startswith('I:'):
            v = float(s.split()[1])
            return v if v > -70 else None
    return None


# ------------------------------------------------------------------ one line

def take(k, line, voice, speed, plain=None):
    """Speak one line; write its WAV, envelope and words. Returns a summary dict."""
    text = line['text']
    audio, timings = speak_timed(k, text, voice, speed)
    if plain is not None:
        ref, _ = plain.create(text, voice, speed, LANG)
        if not (len(ref) == len(audio) and np.array_equal(ref, audio)):
            raise ValueError('timed audio differs from the plain model')
    script = text.split()
    words, source = None, 'kokoro phoneme durations, aligned to the script, onsets calibrated on the envelope'
    spoken = spoken_words(timings) if timings else []
    expect = phoneme_counts(k, script) if spoken else None
    pairs = align(expect, [w[2] for w in spoken]) if spoken else None
    if pairs:
        words = []
        for (i0, i1), (j0, j1) in pairs:
            t0, t1 = spoken[j0][0], spoken[j1 - 1][1]
            if i1 - i0 == 1:
                words.append([t0, t1])
            else:   # a merge: share the span by each word's own phoneme count
                tot = sum(expect[i0:i1])
                at = t0
                for i in range(i0, i1):
                    d = (t1 - t0) * expect[i] / tot
                    words.append([at, at + d])
                    at += d
        lag, first, last = calibrate(audio, words)
        uneven = [' '.join(script[i0:i1]) + ('' if i1 - i0 > 1 else f' ({j1 - j0} spoken)')
                  for (i0, i1), (j0, j1) in pairs if (i1 - i0, j1 - j0) != (1, 1)]
    else:
        uneven = []
        lag = 0.0
        hop = int(FRAME * SR)
        rms = frame_rms(audio, hop)
        loud = np.nonzero(rms >= rms.max() * 10 ** (QUIET_DB / 20))[0]
        first, last = loud[0] * FRAME, (loud[-1] + 1) * FRAME
        source = None
    # trim to PAD either side of the speech, with short fades inside the pad
    head = max(0, int(round((first - PAD) * SR)))
    tail = min(len(audio), int(round((last + PAD) * SR)))
    x = audio[head:tail].astype(np.float64)
    f = int(FADE * SR)
    x[:f] *= np.linspace(0, 1, f)
    x[-f:] *= np.linspace(1, 0, f)
    lufs = loudness(x)
    gain = 10 ** ((LUFS - lufs) / 20) if lufs is not None else 0.5 / max(1e-9, np.abs(x).max())
    peak = np.abs(x).max() * gain
    note = ''
    if peak > PEAK:
        gain *= PEAK / peak
        note = f'peak-limited ({20 * np.log10(PEAK / peak):+.1f} dB)'
    x = (x * gain).astype(np.float32)
    lid = line['id']
    sf.write(os.path.join(OUT, lid + '.wav'), x, SR, subtype='PCM_16')
    json.dump({'rate': ENV_RATE, 'level': envelope(x)}, open(os.path.join(OUT, lid + '.env.json'), 'w'), separators=(',', ':'))
    words_path = os.path.join(OUT, lid + '.words.json')
    if words:
        off = head / SR
        out = [{'w': w, 't': round(t - off, 3), 'e': round(e - off, 3)} for w, (t, e) in zip(script, words)]
        json.dump({'source': source, 'lag': round(lag, 3), 'words': out}, open(words_path, 'w'), indent=1)
    elif os.path.exists(words_path):
        os.remove(words_path)
    if uneven:
        note = (note + '  ' if note else '') + 'merged or split: ' + '; '.join(uneven)
    return {'dur': len(x) / SR, 'words': bool(words), 'lag': lag, 'lufs': lufs, 'note': note}


# ------------------------------------------------------------------ main

SCRATCH = os.path.join(HERE, 'scratch-voices.json')


def host_voices(script):
    """Each host's scratch voice: tools/scratch-voices.json, else script.json's `voices`."""
    if os.path.exists(SCRATCH):
        d = json.load(open(SCRATCH))
        return {k: v for k, v in d.items() if isinstance(v, dict)}
    return script['voices']


def voice_of(script, line):
    v = host_voices(script)[line['who']]
    return line.get('voice', v.get('voice')), line.get('speed', v.get('speed', 1.0))


def made_from(script, line):
    voice, speed = voice_of(script, line)
    return {'text': line['text'], 'voice': voice, 'speed': speed}


def todo(script, only=None, skip=()):
    """The lines to speak: those named, or every line whose take is missing or was made from other text,
    voice or speed."""
    os.makedirs(OUT, exist_ok=True)
    have = {}
    path = os.path.join(OUT, '_lines.json')
    if os.path.exists(path):
        have = json.load(open(path))
    lines = [e for e in script['events'] if e['type'] == 'line']
    if only:
        missing = set(only) - {e['id'] for e in lines}
        if missing:
            raise SystemExit(f'tts.py: no such line: {", ".join(sorted(missing))}')
        return [e for e in lines if e['id'] in only], have
    return [e for e in lines if e['id'] not in skip and (have.get(e['id']) != made_from(script, e)
            or not os.path.exists(os.path.join(OUT, e['id'] + '.wav')))], have


def main():
    args = sys.argv[1:]
    check = '--check' in args
    only = [a for a in args if not a.startswith('--')]
    skip = {x for a in args if a.startswith('--skip=') for x in a[len('--skip='):].split(',') if x}
    script = json.load(open(os.path.join(ROOT, 'script.json')))
    lines, have = todo(script, only, skip)
    if check or not lines:
        print(f'tts.py: {len(lines)} line(s) to speak' + (': ' + ' '.join(e['id'] for e in lines) if lines else ''))
        sys.exit(1 if check and lines else 0)
    from kokoro_onnx import Kokoro
    k = kokoro_timed()
    plain = Kokoro(MODEL, VOICES)    # the first line's check, and the fallback
    for e in lines:
        voice, _ = voice_of(script, e)
        if voice not in k.voices.files:
            raise SystemExit(f'tts.py: line {e["id"]}: "{voice}" is not a Kokoro voice')
    timed = True
    for n, e in enumerate(lines):
        voice, speed = voice_of(script, e)
        try:
            r = take(k, e, voice, speed, plain if n == 0 else None)
        except ValueError as err:
            print(f'tts.py: {err} on {e["id"]}: the whole run falls back to the plain model, with no word times')
            k, timed = plain, False
            r = take(k, e, voice, speed)
        if n == 0 and timed:
            plain = None    # the check passed: free the second session
        have[e['id']] = made_from(script, e)
        json.dump(have, open(os.path.join(OUT, '_lines.json'), 'w'), indent=1)
        n_words = len(e['text'].split())
        print(f"  {e['id']:6s} {voice:10s} {speed:4.2f}  {r['dur']:6.2f} s  {60 * n_words / r['dur']:5.0f} wpm  "
              f"lag {r['lag'] * 1000:4.0f} ms  {'words' if r['words'] else 'NO WORDS'}  {r['note']}", flush=True)
    print(f'tts.py: {len(lines)} line(s) spoken into {os.path.relpath(OUT, ROOT)}/')


if __name__ == '__main__':
    main()
