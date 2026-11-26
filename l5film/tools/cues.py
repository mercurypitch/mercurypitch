"""The film's one clock: every event of script.json placed in time from the voice, in cues.json.

  <venv>/bin/python tools/cues.py              speak what changed (tools/tts.py), then build the clock
  <venv>/bin/python tools/cues.py --no-tts     build the clock from the WAVs and word files as they are
                                               (after an import of the owner's takes: speaks nothing)

Run it with the TTS venv's Python (numpy and soundfile); TTS_PYTHON names the Python that runs
tools/tts.py (default: this one). Recreated for Lesson 5 from the contract the surviving tools and
documents give it (tools/CHANGES.md; PRODUCTION-PIPELINE § 2 step 4 and § 3; Lesson 4's
tools/board-cues.json, a frozen cues.json, for the exact schema); the original was lost with
Lesson 4's project.

Reads
  script.json                          the events, each `gap` (the silence before it; the script's
                                       `gap` when it has none) and `dur` (sounds, pauses, stings)
  tools/scratch-voices.json            the scratch voices, for the pacing report's header
  assets/voice-kokoro/<id>.*           the scratch takes (tools/tts.py)
  assets/voice/_elevenlabs.json        lines whose imported take stands in assets/voice/ (the
                                       director's import.py writes it): never re-spoken, never
                                       replaced by a Kokoro take
Writes
  assets/voice/<id>.wav, .env.json, .words.json
                                       the take each line uses: the Kokoro take, copied in, unless the
                                       line was imported (mix.py and merc-shots.py read this folder)
  cues.json                            { total, cues: { id: { start, end, dur, type, ... } } } in film
                                       seconds: a line adds who, text and words ([word, start, end] in
                                       film time), a sound adds `sound`; `total` is the last event's end
                                       plus TAIL
  assets/cues.js                       the same, as window.CUES, for the compositions (L.at, L.word)
  assets/audio/voice.wav               the voice alone on the clock, 24 kHz mono: a scratch soundtrack
                                       until tools/mix.py carries this film's sounds (gen-root.py with
                                       MIX=voice puts it under the root)
  PACING.md                            the pacing report (also printed): words a minute while speaking
                                       and overall, by host, against the pipeline's 140 to 165 while
                                       speaking (PRODUCTION-PIPELINE § 3), and every line outside it

A line whose take has no word file (a voice from another engine without word times) gets words
estimated by letters, and the run lists those lines. Environment: TTS_PYTHON, KOKORO_MODEL and
KOKORO_VOICES (passed through to tts.py).
"""
import json
import os
import shutil
import subprocess
import sys

import numpy as np
import soundfile as sf

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
KOKORO = os.path.join(ROOT, 'assets', 'voice-kokoro')
VOICE = os.path.join(ROOT, 'assets', 'voice')
TAIL = 0.2           # seconds after the last event's end (Lesson 4's end sting of 6.0 s sat in a 6.2 s scene)
PAD = 0.02           # a take's lead-in before its first word (tools/tts.py PAD), for estimated words
TARGET = (140, 165)  # words a minute while speaking (PRODUCTION-PIPELINE § 3, Narration pacing)
WHO = {'blue': 'Merc', 'orange': 'Tavi'}


def r3(x):
    return round(x + 0.0, 3)


def imported():
    path = os.path.join(VOICE, '_elevenlabs.json')
    if not os.path.exists(path):
        return set()
    d = json.load(open(path))
    return set(d if isinstance(d, list) else d.keys())


def same(a, b):
    return os.path.exists(b) and os.path.getsize(a) == os.path.getsize(b) and open(a, 'rb').read() == open(b, 'rb').read()


def install(lid):
    """Copy a line's Kokoro take into assets/voice/ (only the files that differ)."""
    for ext in ('.wav', '.env.json', '.words.json'):
        src, dst = os.path.join(KOKORO, lid + ext), os.path.join(VOICE, lid + ext)
        if os.path.exists(src):
            if not same(src, dst):
                shutil.copyfile(src, dst)
        elif os.path.exists(dst):
            os.remove(dst)      # a stale word file from an earlier take


def estimate_words(text, dur):
    """Word spans shared out by letters over the take (less its pads)."""
    words = text.split()
    weights = [len(w) + 1 for w in words]
    span = max(0.01, dur - 2 * PAD)
    out, at = [], PAD
    for w, k in zip(words, weights):
        d = span * k / sum(weights)
        out.append({'w': w, 't': at, 'e': at + d * 0.9})
        at += d
    return out


def main():
    args = sys.argv[1:]
    no_tts = '--no-tts' in args
    script = json.load(open(os.path.join(ROOT, 'script.json')))
    events = script['events']
    lines = [e for e in events if e['type'] == 'line']
    kept = imported()
    os.makedirs(VOICE, exist_ok=True)
    if kept:
        print(f'cues.py: {len(kept)} imported take(s) kept as they are, never re-spoken: {" ".join(sorted(kept))}')
    if not no_tts:
        # tts.py speaks only the lines whose take is missing or was made from other words, voice or speed
        py = os.environ.get('TTS_PYTHON', sys.executable)
        subprocess.run([py, '-I', os.path.join(HERE, 'tts.py'), '--skip=' + ','.join(sorted(kept))], check=True)
    for e in lines:
        if e['id'] in kept:
            if not os.path.exists(os.path.join(VOICE, e['id'] + '.wav')):
                raise SystemExit(f'cues.py: {e["id"]} is listed as imported but assets/voice/{e["id"]}.wav is missing')
            continue
        if not os.path.exists(os.path.join(KOKORO, e['id'] + '.wav')):
            raise SystemExit(f'cues.py: no take for {e["id"]} (run without --no-tts, or import it)')
        install(e['id'])

    cues, t, estimated = {}, 0.0, []
    for e in events:
        gap = e.get('gap', script.get('gap', 0.3))
        start = r3(t + gap)
        c = {'start': start}
        if e['type'] == 'line':
            wav = os.path.join(VOICE, e['id'] + '.wav')
            info = sf.info(wav)
            dur = info.frames / info.samplerate
            wpath = os.path.join(VOICE, e['id'] + '.words.json')
            if os.path.exists(wpath):
                words = json.load(open(wpath))['words']
                if [w['w'] for w in words] != e['text'].split():
                    raise SystemExit(f'cues.py: {e["id"]}: the word file does not hold the script\'s words; re-speak or re-import it')
            else:
                words = estimate_words(e['text'], dur)
                estimated.append(e['id'])
            end = r3(start + dur)
            c.update({'end': end, 'dur': r3(end - start), 'type': 'line', 'who': e['who'], 'text': e['text'],
                      'words': [[w['w'], r3(start + w['t']), r3(start + w['e'])] for w in words]})
        else:
            dur = e.get('dur', 0.0) if e['type'] != 'mark' else 0.0
            end = r3(start + dur)
            c.update({'end': end, 'dur': r3(dur), 'type': e['type']})
            if e['type'] == 'sound':
                c['sound'] = e['sound']
        cues[e['id']] = c
        t = c['end']
    total = r3(t + TAIL)
    json.dump({'total': total, 'cues': cues}, open(os.path.join(ROOT, 'cues.json'), 'w'), indent=0, ensure_ascii=False)
    with open(os.path.join(ROOT, 'assets', 'cues.js'), 'w') as f:
        f.write('// Generated by tools/cues.py from script.json and the voice. Do not edit.\n')
        f.write('window.CUES = ' + json.dumps({'total': total, 'cues': cues}, ensure_ascii=False) + ';\n')
    voice_track(cues, total)
    report = pacing(script, cues, total, kept)
    open(os.path.join(ROOT, 'PACING.md'), 'w').write(report)
    print(report)
    if estimated:
        print(f'cues.py: words estimated by letters (no word file) for: {" ".join(estimated)}')
    print(f'cues.py: cues.json and assets/cues.js written, {len(cues)} events, {total:.3f} s ({fmt(total)})')


def voice_track(cues, total):
    """assets/audio/voice.wav: every line at its place, nothing else."""
    sr = 24000
    out = np.zeros(int(np.ceil(total * sr)) + 1, dtype=np.float32)
    for k, c in cues.items():
        if c['type'] != 'line':
            continue
        x, rate = sf.read(os.path.join(VOICE, k + '.wav'), dtype='float32')
        if x.ndim > 1:
            x = x.mean(1)
        if rate != sr:
            n = int(round(len(x) * sr / rate))
            x = np.interp(np.arange(n) * rate / sr, np.arange(len(x)), x).astype(np.float32)
        i = int(round(c['start'] * sr))
        out[i:i + len(x)] += x[: len(out) - i]
    os.makedirs(os.path.join(ROOT, 'assets', 'audio'), exist_ok=True)
    sf.write(os.path.join(ROOT, 'assets', 'audio', 'voice.wav'), np.clip(out, -1, 1), sr, subtype='PCM_16')


def fmt(t):
    t = round(t, 1)
    return f'{int(t // 60)}:{t % 60:04.1f}'


def pacing(script, cues, total, kept):
    rows, by = [], {}
    for e in script['events']:
        if e['type'] != 'line':
            continue
        c = cues[e['id']]
        n = len(e['text'].split())
        b = by.setdefault(e['who'], {'lines': 0, 'words': 0, 'take': 0.0})
        b['lines'] += 1
        b['words'] += n
        b['take'] += c['dur']
        rows.append((e['id'], e['who'], n, c['dur'], 60 * n / c['dur']))
    words = sum(b['words'] for b in by.values())
    take = sum(b['take'] for b in by.values())
    path = os.path.join(HERE, 'scratch-voices.json')
    voices = ({k: v for k, v in json.load(open(path)).items() if isinstance(v, dict)} if os.path.exists(path)
              else script['voices'])
    src = 'the imported takes and Kokoro' if kept else 'local Kokoro'
    title, said = '# Pacing: the scratch clock', ', '.join(f"{WHO[w]} `{v['voice']}` at {v['speed']}" for w, v in voices.items())
    pauses = 'Kokoro pauses at each'
    if kept >= {r[0] for r in rows}:
        # every line is an imported take: name the voices the import lists, not the scratch voices
        listed = json.load(open(os.path.join(VOICE, '_elevenlabs.json')))
        names = {}
        for e in script['events']:
            if e['type'] == 'line' and isinstance(listed, dict) and isinstance(listed.get(e['id']), dict):
                names.setdefault(e['who'], listed[e['id']].get('voice'))
        title, src = '# Pacing: the voiced clock', 'the imported takes, `assets/voice/_elevenlabs.json`'
        said = ', '.join(f'{WHO[w]} `{n}`' for w, n in names.items() if n) or 'every line imported'
        pauses = 'the voice pauses at each'
    out = [title, '',
           f'Generated by `tools/cues.py` from `cues.json` ({src}: {said}). '
           'A line\'s time is its take, first word to last plus the 0.02 s pads; "speaking" counts only '
           'the takes, "overall" the whole film. Target while speaking: '
           f'{TARGET[0]} to {TARGET[1]} words a minute (PRODUCTION-PIPELINE § 3).', '',
           f'- Running time **{fmt(total)}** ({total:.3f} s); speech {take:.1f} s in {len(rows)} lines, '
           f'{words} words.',
           f'- While speaking: **{60 * words / take:.0f} words a minute** ({words / take:.2f} a second); '
           f'overall {60 * words / total:.0f} words a minute.']
    for w, b in by.items():
        out.append(f"- {WHO[w]}: {b['lines']} lines, {b['words']} words in {b['take']:.1f} s, "
                   f"{60 * b['words'] / b['take']:.0f} words a minute while speaking.")
    gaps = sum(e.get('gap', script.get('gap', 0.3)) for e in script['events'])
    held = sum(c['dur'] for c in cues.values() if c['type'] in ('sound', 'pause', 'sting'))
    out.append(f'- The rest: authored gaps {gaps:.1f} s; sounds, pauses and stings {held:.1f} s.')
    slow = [r for r in rows if r[4] < TARGET[0]]
    fast = [r for r in rows if r[4] > TARGET[1]]
    out += ['', f'## Lines outside {TARGET[0]} to {TARGET[1]} words a minute', '',
            f'{len(fast)} faster, {len(slow)} slower, of {len(rows)}. A line of two or three words swings '
            f'furthest by this count; a line with many marks reads slow ({pauses}).', '',
            '| Line | Host | Words | Take (s) | Words a minute |', '| --- | --- | --- | --- | --- |']
    for lid, who, n, dur, wpm in sorted(fast + slow, key=lambda r: -r[4]):
        out.append(f'| {lid} | {WHO[who]} | {n} | {dur:.2f} | {wpm:.0f} |')
    return '\n'.join(out) + '\n'


if __name__ == '__main__':
    main()
