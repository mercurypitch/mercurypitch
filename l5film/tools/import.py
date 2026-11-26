"""Bring the owner's ElevenLabs takes into the film: per line a WAV at the scratch takes' edges and
loudness, its loudness envelope and the time of every word (PRODUCTION-PIPELINE § 3 Voices).

  <venv>/bin/python -I tools/import.py                  every take voice-takes/batch.json lists
  <venv>/bin/python -I tools/import.py o1 b7            these lines
  <venv>/bin/python -I tools/import.py --who=orange     one host's lines (blue is Merc, orange is Tavi)
  <venv>/bin/python -I tools/import.py --dry [...]      measure and print; write nothing

Then `tools/cues.py --no-tts` re-times the film: a line listed in assets/voice/_elevenlabs.json is
never re-spoken and never replaced by a Kokoro take. It calls no service: the takes are given.
Recreated for Lesson 5 from the pipeline's description of the director's `voice-elevenlabs/import.py`
and from tools/tts.py, whose take format and functions it uses; the original was lost with Lesson
4's machine.

Reads
  voice-takes/batch.json           the lines: id, who, host, voice, voice_id, text (the text must be
                                   script.json's, word for word, or the line is refused)
  voice-takes/takes/<id>.mp3       one take a line, as the service gave it
  voice-takes/ledger.jsonl         the generation calls: id, flow, node, session
  tools/ctc-calibration.json       the aligner's constants (tools/ctc_align.py --calibrate)
  assets/voice-kokoro/<id>.wav     the scratch take, for the report's lengths and the words check's control
Writes
  assets/voice/<id>.wav            24 kHz mono, 16-bit: the take from PAD before its first sound to PAD
                                   after its last, FADE at each edge, at LUFS under PEAK (tools/tts.py's)
  assets/voice/<id>.env.json       the loudness envelope, as tools/tts.py computes it
  assets/voice/<id>.words.json     { source, lag, end_lag, take_lag, words: [{ w, t, e }] }: each script
                                   word as written; `source` names the take and the aligner; `lag` and
                                   `end_lag` are the calibration's constants, which the words no silence
                                   places moved back by; `take_lag` is this take's own median (a check)
  assets/voice/_elevenlabs.json    { id: { take, sha256, voice, voice_id, model, generation: { flow, node,
                                   session }, imported } }: the lines whose take stands in assets/voice/
                                   (tools/cues.py reads the ids)
  voice-takes/import.json          what each import measured, kept across runs
  voice-takes/IMPORT.md            the import report: edges, lengths against the scratch takes, levels
  voice-takes/ASR.md               the words check: every line whose words differ, with both texts

The steps, per take:
  1. decode to 24 kHz mono (ffmpeg);
  2. the clicks that are not speech count as no sound (`clicks`): a loud run under BLIP that stands FAR
     or more from any other sound (PRODUCTION-PIPELINE trap 18: a lone click after a silence), and one
     that touches the file's first or last sample with a silence of tts.MIN_SILENCE or more between it
     and the rest (these takes often carry a 1 to 2 ms step at the file's last samples);
  3. the script's words aligned to the sound (tools/ctc_align.py), then moved onto the envelope with
     tools/tts.py `calibrate` and the calibration's constants;
  4. trimmed from PAD before the first sound to PAD after the last, faded over FADE at each cut; a take
     that gives less than PAD of silence at an edge (the service cuts some in the sound) is filled up
     to PAD with silence after the fade, so every take starts PAD before its first sound;
  5. set to LUFS, under PEAK; the envelope; the files.

The words check costs no other service: the aligner's model also gives a greedy transcript, compared
with the script line as the model would spell it (and with what it hears in the scratch take of the
same line, as a control: a word it mishears in both is its ear, not the take). It spells by ear,
without a dictionary, so a difference is a prompt for a person to listen, not a verdict.
"""
import datetime
import difflib
import hashlib
import importlib.util
import json
import os
import sys

import numpy as np
import soundfile as sf

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
TAKES = os.path.join(ROOT, 'voice-takes')
VOICE = os.path.join(ROOT, 'assets', 'voice')
KOKORO = os.path.join(ROOT, 'assets', 'voice-kokoro')
MODEL = 'eleven_v3'      # voice-takes/BATCH.md: the model every take was made with
BLIP = 0.06              # seconds: a loud run shorter than this may be a click (trap 18)
FAR = 0.3                # seconds: a click this far from any other sound is no sound (trap 18)
CUT_DB = -30.0           # a take whose sound at a file edge is above this (under its loudest frame) is
                         # reported as cut in the sound
WHO = {'blue': 'Merc', 'orange': 'Tavi'}


def load_tool(name):
    """A sibling tool as a module (python -I leaves the tools folder off the path)."""
    spec = importlib.util.spec_from_file_location(name.replace('-', '_').replace('.py', ''), os.path.join(HERE, name))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


tts = load_tool('tts.py')
ctc = load_tool('ctc_align.py')
SR, PAD, FADE = tts.SR, tts.PAD, tts.FADE


# ------------------------------------------------------------------ the take's sound

def islands(loud):
    """Runs of loud frames: [(first frame, end frame)]."""
    out, start = [], None
    for i, q in enumerate(loud):
        if q and start is None:
            start = i
        elif not q and start is not None:
            out.append((start, i))
            start = None
    if start is not None:
        out.append((start, len(loud)))
    return out


def clicks(audio):
    """The loud runs that are no sound: [(start s, length s, why)], and the audio with them silenced
    (a copy, for the envelope's calibration and the trim; the take itself is not changed by this)."""
    hop = int(tts.FRAME * SR)
    rms = tts.frame_rms(audio, hop)
    runs = islands(rms >= rms.max() * 10 ** (tts.QUIET_DB / 20))
    n, out, quiet = len(rms), [], audio.copy()
    for k, (a, b) in enumerate(runs):
        if (b - a) * tts.FRAME >= BLIP or len(runs) == 1:
            continue
        before = (a - runs[k - 1][1]) * tts.FRAME if k else None            # None: the file's edge
        after = (runs[k + 1][0] - b) * tts.FRAME if k + 1 < len(runs) else None
        why = None
        if (before is None or before >= FAR) and (after is None or after >= FAR):
            why = 'a lone click'
        elif a == 0 and after >= tts.MIN_SILENCE:
            why = "the file's first samples"
        elif b == n and before >= tts.MIN_SILENCE:
            why = "the file's last samples"
        if why:
            out.append((round(a * tts.FRAME, 3), round((b - a) * tts.FRAME, 3), why))
            quiet[a * hop: len(audio) if b == n else b * hop] = 0.0
    return out, quiet


def edge_db(audio, first, last):
    """The level of the first and the last FRAME of the sound, in dB under the take's loudest frame."""
    hop = int(tts.FRAME * SR)
    rms = tts.frame_rms(audio, hop)
    i, j = int(round(first / tts.FRAME)), int(round(last / tts.FRAME)) - 1
    db = lambda v: float(20 * np.log10(max(v, 1e-9) / rms.max()))
    return db(rms[min(i, len(rms) - 1)]), db(rms[max(0, min(j, len(rms) - 1))])


def voiced_db(x):
    """The mean level of the take's voiced frames, dBFS (a second look at its loudness)."""
    rms = tts.frame_rms(x, SR // tts.ENV_RATE)
    v = rms[rms >= rms.max() * 10 ** (tts.QUIET_DB / 20)]
    return float(20 * np.log10(np.sqrt((v ** 2).mean()))) if len(v) else float('nan')


# ------------------------------------------------------------------ one take

def import_take(al, line, ledger, dry):
    lid, text = line['id'], line['text']
    src = os.path.join(TAKES, 'takes', lid + '.mp3')
    audio = ctc.decode(src, SR).astype(np.float64)
    blips, quiet = clicks(audio)
    logp = al.emissions(audio, SR)
    raw = al.words(audio, SR, text, logp, lags=False)
    words = [[w['t'], max(w['e'], w['t'] + 0.01)] for w in raw]
    before = [list(w) for w in words]
    take_lag, first, last = tts.calibrate(quiet, words, lags=(al.start_lag, al.end_lag))
    placed = sum(1 for w, b in zip(words, before) if abs(w[0] - (b[0] - al.start_lag)) > 1e-9)
    # the trim: PAD either side of the sound, faded inside what the take gives, filled up to PAD
    head, tail = int(round((first - PAD) * SR)), int(round((last + PAD) * SR))
    x = audio[max(0, head): min(len(audio), tail)].copy()
    f = int(FADE * SR)
    x[:f] *= np.linspace(0, 1, f)
    x[-f:] *= np.linspace(1, 0, f)
    fill_in, fill_out = max(0, -head), max(0, tail - len(audio))
    x = np.concatenate([np.zeros(fill_in), x, np.zeros(fill_out)])
    # a lone click inside the take (not at an edge, where the trim removes it): silenced, and reported
    inside = [b for b in blips if b[2] == 'a lone click' and first < b[0] < last]
    for t, d, _ in inside:
        i, j = int(round(t * SR)) - head, int(round((t + d) * SR)) - head     # the click, in the trimmed take
        x[i:j] = 0.0
        x[i - f:i] *= np.linspace(1, 0, f)
        x[j:j + f] *= np.linspace(0, 1, f)
    lufs = tts.loudness(x)
    gain = 10 ** ((tts.LUFS - lufs) / 20) if lufs is not None else 0.5 / max(1e-9, np.abs(x).max())
    peak = np.abs(x).max() * gain
    limited = 0.0
    if peak > tts.PEAK:
        limited = float(20 * np.log10(tts.PEAK / peak))
        gain *= tts.PEAK / peak
    x = (x * gain).astype(np.float32)
    off = head / SR
    out_words = [{'w': w, 't': round(t - off, 3), 'e': round(e - off, 3)} for w, (t, e) in zip(text.split(), words)]
    cut_in, cut_out = edge_db(quiet, first, last)
    heard = al.heard(logp)
    scores = [w['score'] for w in raw if w['score'] is not None]
    weakest = min(((w['score'], w['w']) for w in raw if w['score'] is not None), default=(None, None))
    kok = os.path.join(KOKORO, lid + '.wav')
    kok_dur = kok_heard = None
    if os.path.exists(kok):
        k, ksr = sf.read(kok, dtype='float64')
        kok_dur = len(k) / ksr
        kok_heard = al.heard(al.emissions(k, ksr))
    rec = {
        'id': lid, 'who': line['who'], 'text': text, 'take': os.path.relpath(src, ROOT),
        'source_dur': round(len(audio) / SR, 3), 'lead': round(first, 3), 'tail': round(len(audio) / SR - last, 3),
        'fill_in': round(fill_in / SR, 3), 'fill_out': round(fill_out / SR, 3),
        'cut_in_db': round(cut_in, 1) if first < PAD else None,
        'cut_out_db': round(cut_out, 1) if len(audio) / SR - last < PAD else None,
        'clicks': [list(b) for b in blips], 'clicks_silenced_inside': [list(b) for b in inside],
        'dur': round(len(x) / SR, 3), 'kokoro_dur': round(kok_dur, 3) if kok_dur else None,
        'words': len(out_words), 'placed_by_silence': placed, 'take_lag': round(take_lag, 3),
        'lufs_in': None if lufs is None else round(lufs, 1), 'gain_db': round(float(20 * np.log10(gain)), 1),
        'limited_db': round(limited, 1), 'peak': round(float(np.abs(x).max()), 3), 'voiced_db': round(voiced_db(x), 1),
        'score': round(float(np.mean(scores)), 2) if scores else None,
        'weakest': [round(weakest[0], 2), weakest[1]] if weakest[0] is not None else None,
        'script_spelled': ctc.normalised(text), 'heard': heard, 'kokoro_heard': kok_heard,
    }
    if not dry:
        os.makedirs(VOICE, exist_ok=True)
        sf.write(os.path.join(VOICE, lid + '.wav'), x, SR, subtype='PCM_16')
        json.dump({'rate': tts.ENV_RATE, 'level': tts.envelope(x)}, open(os.path.join(VOICE, lid + '.env.json'), 'w'),
                  separators=(',', ':'))
        source = (f"ElevenLabs take {rec['take']} ({line['voice']}, {MODEL}); words by {al.name()} "
                  f"(tools/ctc_align.py), onsets calibrated on the envelope (tools/tts.py calibrate)")
        json.dump({'source': source, 'lag': al.start_lag, 'end_lag': al.end_lag, 'take_lag': round(take_lag, 3),
                   'words': out_words}, open(os.path.join(VOICE, lid + '.words.json'), 'w'), indent=1)
        rec['listed'] = {
            'take': rec['take'], 'sha256': hashlib.sha256(open(src, 'rb').read()).hexdigest(),
            'voice': line['voice'], 'voice_id': line['voice_id'], 'model': MODEL,
            'generation': {k: ledger[lid][k] for k in ('flow', 'node', 'session')} if lid in ledger else None,
            'imported': datetime.date.today().isoformat()}
    return rec


# ------------------------------------------------------------------ the reports

def differences(rec):
    """compare()'s stretches, each with whether the scratch take was heard the same way."""
    diffs = ctc.compare(rec['text'], rec['heard'])
    control = {(a, b) for _, a, b in ctc.compare(rec['text'], rec['kokoro_heard'])} if rec.get('kokoro_heard') else set()
    return [(kind, a, b, (a, b) in control) for kind, a, b in diffs]


def grade(rec):
    """'same', 'spelling' (every stretch near, or heard the same in the scratch take) or 'words'."""
    d = differences(rec)
    if not d:
        return 'same'
    return 'words' if any(kind == 'words' and not both for kind, _, _, both in d) else 'spelling'


def cell(s):
    return s.replace('|', '\\|')


def asr_md(recs, order):
    rows = [recs[i] for i in order if i in recs]
    by = {g: [r for r in rows if grade(r) == g] for g in ('words', 'spelling', 'same')}
    out = ['# Words check: the final takes against the script', '',
           'Written by `tools/import.py`. Each take was transcribed by the aligner\'s own model '
           '(wav2vec2-base-960h, greedy CTC: the likeliest letter of every 20 ms, with no dictionary and no '
           'language model) and set beside its script line as that model spells it (capitals, the '
           'apostrophe, a numeral as its word). No other service heard the takes.', '',
           '**A difference is a prompt for a person to listen, not a verdict.** The model spells by ear '
           '("DIAPHRAM", "TAVY"), so most differences are its spelling. Two things sort them: a stretch '
           'counts as spelling when it has as many words on each side, give or take one (the model often '
           'joins or splits a word), and letters 0.6 or more alike; and "scratch too" marks a stretch the '
           'model heard the very same way in the '
           'Kokoro take of the line, which speaks the script by construction. "Weakest word" is the '
           'script word the forced alignment found least support for (mean log-probability of its '
           'letters; nearer 0 is surer).', '',
           f'- Lines checked: {len(rows)}.',
           f'- Words differ, to listen to first: {len(by["words"])}'
           + (' (' + ', '.join(r['id'] for r in by['words']) + ')' if by['words'] else '') + '.',
           f'- Differ in spelling only: {len(by["spelling"])}.',
           f'- Heard exactly as written: {len(by["same"])}'
           + (' (' + ', '.join(r['id'] for r in by['same']) + ')' if by['same'] else '') + '.', '']
    for g, title, note in (
            ('words', 'Listen to these first: a word missing, added or far from the script',
             'A stretch here has more or fewer words than the script, or letters far from it, and the '
             'scratch take was not heard the same way.'),
            ('spelling', 'Differ in spelling only',
             'Every stretch is near the script\'s letters, or was heard the same way in the scratch take.')):
        out += [f'## {title}', '', note, '']
        if not by[g]:
            out += ['None.', '']
            continue
        for r in by[g]:
            d = differences(r)
            out += [f"### {r['id']} ({WHO[r['who']]})", '',
                    f"- Script: {r['text']}",
                    f"- As the model spells it: `{r['script_spelled']}`",
                    f"- Heard: `{r['heard']}`",
                    '- Differs: ' + '; '.join(
                        f"`{a or '(nothing)'}` heard as `{b or '(nothing)'}`"
                        + (' (words' if kind == 'words' else ' (spelling') + (', scratch too)' if both else ')')
                        for kind, a, b, both in d),
                    (f"- Weakest word: \"{r['weakest'][1]}\" ({r['weakest'][0]:.2f}); the line's mean {r['score']:.2f}."
                     if r['weakest'] else '- Weakest word: none scored.'), '']
    return '\n'.join(out) + '\n'


def import_md(recs, order, al):
    rows = [recs[i] for i in order if i in recs]
    cal = al.calibration or {}
    tot, ktot = sum(r['dur'] for r in rows), sum(r['kokoro_dur'] or 0 for r in rows)
    out = ['# Import report: the final takes in assets/voice/', '',
           'Written by `tools/import.py`. One row a take: what the service gave, what the film now holds, and '
           'the scratch take it replaces. Every take is 24 kHz mono 16-bit, from 0.02 s before its first '
           f'sound to 0.02 s after its last, faded over 5 ms at each cut, at {tts.LUFS} LUFS under a peak of {tts.PEAK}.', '',
           f'- Takes imported: {len(rows)}' + ''.join(
               f"; {WHO[w]} {sum(1 for r in rows if r['who'] == w)}" for w in WHO if any(r['who'] == w for r in rows)) + '.',
           f'- Speech: {tot:.1f} s against the scratch takes\' {ktot:.1f} s ({tot / ktot:.2f} times).' if ktot else '',
           f"- Aligner: {al.name()}; constants {al.start_lag * 1000:+.0f} ms (starts) and {al.end_lag * 1000:+.0f} ms (ends) "
           f"from {cal.get('takes', '?')} Kokoro takes, {cal.get('words', '?')} words (`tools/ctc-calibration.json`).", '']
    cut = [r for r in rows if (r['cut_in_db'] is not None and r['cut_in_db'] > CUT_DB)
           or (r['cut_out_db'] is not None and r['cut_out_db'] > CUT_DB)]
    out += ['## Takes the service cut in the sound', '',
            f'A take that gives no silence at an edge, with the voice above {CUT_DB:.0f} dB (under the take\'s '
            'loudest 5 ms) at the cut. The importer fades 5 ms there and fills the pad with silence; whether '
            'the word sounds whole is for the ear.', '']
    if cut:
        out += ['| Line | Host | Edge | Level at the cut (dB) | Word |', '| --- | --- | --- | --- | --- |']
        for r in cut:
            w = r['text'].split()
            if r['cut_in_db'] is not None and r['cut_in_db'] > CUT_DB:
                out.append(f"| {r['id']} | {WHO[r['who']]} | start | {r['cut_in_db']:.0f} | {cell(w[0])} |")
            if r['cut_out_db'] is not None and r['cut_out_db'] > CUT_DB:
                out.append(f"| {r['id']} | {WHO[r['who']]} | end | {r['cut_out_db']:.0f} | {cell(w[-1])} |")
    else:
        out.append('None.')
    clicked = [r for r in rows if r['clicks']]
    out += ['', '## Clicks counted as no sound', '',
            f'A loud run under {BLIP * 1000:.0f} ms that stands {FAR} s or more from any other sound (trap 18), or '
            f'that touches the file\'s first or last sample with {tts.MIN_SILENCE * 1000:.0f} ms or more of silence '
            'between it and the rest. The trim leaves them out; one inside a take would be silenced and listed here.', '']
    if clicked:
        out += ['| Line | At (s) | Length (ms) | Why | Silenced inside the take |', '| --- | --- | --- | --- | --- |']
        for r in clicked:
            for t, d, why in r['clicks']:
                inside = any(abs(t - b[0]) < 1e-6 for b in r['clicks_silenced_inside'])
                out.append(f"| {r['id']} | {t:.3f} | {d * 1000:.0f} | {why} | {'yes' if inside else 'no'} |")
    else:
        out.append('None.')
    out += ['', '## Every take', '',
            'Lead and tail: the silence the service gave before the first sound and after the last. Fill: '
            'silence added to make up the 0.02 s pad. Placed: word starts set by a silence, of the line\'s '
            'words. Take lag: this take\'s own median of (aligned start - the sound\'s start) at those words; '
            'the calibration expects about 55 ms. Voiced: the mean level of the voiced frames after the gain.', '',
            '| Line | Host | Source (s) | Lead | Tail | Fill in/out | Take (s) | Scratch (s) | Ratio | Words a minute | '
            'LUFS in | Gain (dB) | Peak | Voiced (dBFS) | Placed | Take lag (ms) | Notes |',
            '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |']
    for r in rows:
        notes = []
        if r['limited_db']:
            notes.append(f"peak-limited ({r['limited_db']:+.1f} dB)")
        if r['lufs_in'] is None:
            notes.append('too short to gate: set by peak')
        k = r['kokoro_dur']
        out.append(
            f"| {r['id']} | {WHO[r['who']]} | {r['source_dur']:.2f} | {r['lead']:.2f} | {r['tail']:.2f} | "
            f"{r['fill_in'] * 1000:.0f}/{r['fill_out'] * 1000:.0f} ms | {r['dur']:.2f} | "
            + (f"{k:.2f} | {r['dur'] / k:.2f}" if k else '- | -')
            + f" | {60 * r['words'] / r['dur']:.0f} | {'-' if r['lufs_in'] is None else format(r['lufs_in'], '.1f')} | "
            f"{r['gain_db']:+.1f} | {r['peak']:.2f} | {r['voiced_db']:.1f} | {r['placed_by_silence']}/{r['words']} | "
            f"{r['take_lag'] * 1000:.0f} | {'; '.join(notes)} |")
    return '\n'.join(l for l in out if l is not None) + '\n'


# ------------------------------------------------------------------ main

def main():
    args = sys.argv[1:]
    dry = '--dry' in args
    who = next((a[6:] for a in args if a.startswith('--who=')), None)
    only = [a for a in args if not a.startswith('--')]
    batch = json.load(open(os.path.join(TAKES, 'batch.json')))
    script = {e['id']: e for e in json.load(open(os.path.join(ROOT, 'script.json')))['events'] if e['type'] == 'line'}
    order = [b['id'] for b in batch]
    missing = set(only) - set(order)
    if missing:
        raise SystemExit(f'import.py: not in batch.json: {", ".join(sorted(missing))}')
    lines = [b for b in batch if (not only or b['id'] in only) and (not who or b['who'] == who)]
    for b in lines:
        e = script.get(b['id'])
        if e is None or e['text'] != b['text'] or e['who'] != b['who']:
            raise SystemExit(f'import.py: {b["id"]}: batch.json does not hold script.json\'s line')
        if not os.path.exists(os.path.join(TAKES, 'takes', b['id'] + '.mp3')):
            raise SystemExit(f'import.py: no take for {b["id"]} in voice-takes/takes/')
    ledger = {}
    lpath = os.path.join(TAKES, 'ledger.jsonl')
    if os.path.exists(lpath):
        for row in open(lpath):
            if row.strip():
                d = json.loads(row)
                ledger[d['id']] = d
    al = ctc.Aligner()
    if al.calibration is None:
        raise SystemExit('import.py: no tools/ctc-calibration.json: run tools/ctc_align.py --calibrate first')
    rpath, lpath = os.path.join(TAKES, 'import.json'), os.path.join(VOICE, '_elevenlabs.json')
    recs = json.load(open(rpath)) if os.path.exists(rpath) else {}
    listed = json.load(open(lpath)) if os.path.exists(lpath) else {}
    for b in lines:
        r = import_take(al, b, ledger, dry)
        if not dry:
            listed[b['id']] = r.pop('listed')
            recs[b['id']] = r
            json.dump(recs, open(rpath, 'w'), indent=1, ensure_ascii=False)
            json.dump({i: listed[i] for i in order if i in listed}, open(lpath, 'w'), indent=1, ensure_ascii=False)
        flags = []
        if r['clicks']:
            flags.append(f"{len(r['clicks'])} click(s) left out")
        if r['fill_in'] or r['fill_out']:
            flags.append(f"filled {r['fill_in'] * 1000:.0f}/{r['fill_out'] * 1000:.0f} ms")
        if r['limited_db']:
            flags.append(f"peak-limited {r['limited_db']:+.1f} dB")
        g = grade(r)
        print(f"  {r['id']:5s} {WHO[r['who']]:4s} {r['source_dur']:6.2f} -> {r['dur']:6.2f} s  (scratch {r['kokoro_dur'] or 0:6.2f})  "
              f"{60 * r['words'] / r['dur']:4.0f} wpm  {r['gain_db']:+5.1f} dB  placed {r['placed_by_silence']:2d}/{r['words']:2d}  "
              f"take lag {r['take_lag'] * 1000:4.0f} ms  words {g:8s} {'; '.join(flags)}", flush=True)
    if dry:
        print(f'import.py: {len(lines)} take(s) measured; nothing written')
        return
    open(os.path.join(TAKES, 'ASR.md'), 'w').write(asr_md(recs, order))
    open(os.path.join(TAKES, 'IMPORT.md'), 'w').write(import_md(recs, order, al))
    print(f'import.py: {len(lines)} take(s) imported into {os.path.relpath(VOICE, ROOT)}/; {len(listed)} listed in _elevenlabs.json; '
          f'voice-takes/ASR.md and IMPORT.md written for {len(recs)}')


if __name__ == '__main__':
    main()
