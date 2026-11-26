"""Why the importer places words itself, shown on the final takes. For every take, tools/tts.py's
`calibrate` (as it is) is run on the aligner's times and compared with tools/ctc_align.py `place`.
Prints the word starts `calibrate` sets on a silence that `place` leaves alone, because the
aligner's letters put that silence inside the word before; and how late the aligner marks the word
after a clear pause, by voice, on the scratch takes and the final ones. Reads only; writes nothing.

  <venv>/bin/python -I lab/voices-import/proofs.py <project>"""
import importlib.util, json, os, sys
import numpy as np
import soundfile as sf
ROOT = sys.argv[1]
def load(name, path):
    spec = importlib.util.spec_from_file_location(name, path); m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m); return m
imp = load('imp', os.path.join(ROOT, 'tools', 'import.py'))
ctc, tts = imp.ctc, imp.tts
al = ctc.Aligner()
batch = json.load(open(os.path.join(ROOT, 'voice-takes', 'batch.json')))
hop = int(tts.FRAME * tts.SR)

def silence_ends(x):
    rms = tts.frame_rms(x, hop); thr = rms.max() * 10 ** (tts.QUIET_DB / 20)
    q = [(a * tts.FRAME, b * tts.FRAME) for a, b in tts.silences(rms, thr, int(round(tts.MIN_SILENCE / tts.FRAME)))]
    loud = np.nonzero(rms >= thr)[0]
    return q, loud[0] * tts.FRAME, (loud[-1] + 1) * tts.FRAME

rows, n_cal, n_place, late = [], 0, 0, {}
for b in batch:
    for kind in ('scratch', 'final'):
        if kind == 'scratch':
            x, _ = sf.read(os.path.join(ROOT, 'assets', 'voice-kokoro', b['id'] + '.wav'), dtype='float64')
        else:
            x = imp.clicks(ctc.decode(os.path.join(ROOT, 'voice-takes', 'takes', b['id'] + '.mp3'), tts.SR).astype(np.float64))[1]
        raw = al.words(x, tts.SR, b['text'])
        quiet, first, last = silence_ends(x)
        # how late the aligner marks the word after a clear pause (0.15 s or more of silence between two words)
        for a, c in quiet:
            if c - a < 0.15 or a <= first or c >= last: continue
            k = next((i for i, r in enumerate(raw) if r['t'] >= a), None)
            j = next((i for i in range(len(raw) - 1, -1, -1) if raw[i]['t'] + 0.05 < a), None)
            if k is not None and j == k - 1:
                late.setdefault((kind, b['who']), []).append(raw[k]['t'] - c)
        if kind == 'scratch':
            continue
        w = [[r['t'], max(r['e'], r['t'] + 0.01)] for r in raw]
        tts.calibrate(x, w)
        p = ctc.place(tts, x, raw, al.start_lag, al.end_lag)
        ends = {round(c, 3) for a, c in quiet} | {round(first, 3)}
        n_place += len(p['starts'])
        for k, (cal, got) in enumerate(zip(w, p['words'])):
            on_silence = round(cal[0], 3) in ends and abs(cal[0] - raw[k]['t']) > 1e-9
            n_cal += on_silence
            if on_silence and k not in p['starts']:
                rows.append((round(raw[k]['t'] - cal[0], 3), b['id'], raw[k - 1]['w'] if k else '(start)', raw[k]['w'], round(cal[0], 3), round(got[0], 3)))
print(f'On the 71 final takes, 1034 words: tts.calibrate sets {n_cal} word starts on a silence\'s end; place sets {n_place}.')
print(f'{len(rows)} starts that calibrate sets and place leaves alone (the silence is inside the word before, by the aligner\'s letters,')
print('or further from the aligner\'s start than 0.3 s). Columns: seconds calibrate moves the start back from the aligner\'s time,')
print('line, the word before, the word, calibrate\'s start, place\'s start (take time, before the trim):')
for r in sorted(rows, reverse=True): print('  ', r)
print()
print('How late the aligner marks the word after a clear pause (ms; aligned start - the sound\'s start):')
for (kind, who), v in sorted(late.items()):
    v = np.array(v)
    print(f'  {kind:7s} {imp.WHO[who]:4s} n {len(v):3d}  median {np.median(v) * 1000:4.0f}  5% {np.percentile(v, 5) * 1000:4.0f}  95% {np.percentile(v, 95) * 1000:4.0f}')
