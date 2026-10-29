"""Word-perfect captions from the cue sheet: SRT and VTT for YouTube and the web
player, plus sound descriptions so a viewer with the sound off knows what is
playing.

  python3 tools/captions.py

Writes captions/lesson-04.en.srt, captions/lesson-04.en.vtt. Spoken numbers and
note names are written the way the picture writes them ("220", "A4"). Limits, as in
the usual subtitle guides: at most 42 characters a line and two lines a caption, at
most 20 characters a second, at least 5/6 s on screen, and 5 frames (60 fps) between
captions. A caption may stay up into the silence after its line, and a sound
description may come up to 0.25 s early or 0.3 s late, to keep a caption inside the
reading speed; the speaker label is the host's name, "MERC:" or "TAVI:", only when the
speaker changes (MERC-BIBLE § 8, item 1). The voice spells solfège for Kokoro ("doh,
ray, mee"); captions write it as the picture does ("do, re, mi"; "do-re-mi"). The run prints the peak reading speed and warns on any breach.
"""
import json, os, re

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
C = json.load(open(os.path.join(ROOT, 'cues.json')))['cues']

WORDS = [
    # longest first: what the voice spells for itself, written as the picture writes it
    ('doh ray mee', 'do-re-mi'), ('Doh ray mee', 'Do-re-mi'),
]
SOLFEGE = {'doh': 'do', 'ray': 're', 'mee': 'mi', 'fah': 'fa', 'soh': 'so', 'lah': 'la', 'tee': 'ti'}
SPEAKER = {'blue': 'MERC', 'orange': 'TAVI'}
WIDTH, CPS, MIN_ON, GAP, LEAD, LAG, SPEECH_LAG = 42, 20.0, 5 / 6, 5 / 60, 0.25, 0.3, 0.1
SOUNDS = {
    # what each sound is, never what it means; the recap's listening step names no size
    'stop-c': '[Merc sings up from C and stops on ti]',
    'stop-c-home': '[Merc sings up from C and stops on ti]',
    'stop-d': '[Tavi sings up from D and stops on ti]',
    'land-d': '[Tavi sings the last step, up to do]',
    'land-c': '[Merc sings the last step, up to do]',
    'q0': '[think]', 'q1': '[think]', 'q2': '[think]', 'q3': '[think]', 'q4': '[think]',
    'title': '[chime]', 'end': '[chime]',
    'scale-c': '[the white keys from C up to C]',
    'steps-c': '[the same scale, slowly, step by step]',
    'group-low': '[C, D, E, F]', 'group-high': '[G, A, B, C]',
    'predict': '[pause and predict]', 'predict-d': '[pause and predict]',
    'white-d': '[the white keys from D up to D]',
    'major-d': '[the major pattern from D]',
    'slide-g': '[a major scale from G]', 'slide-e': '[a major scale from E]',
    'sing-a': '[Merc sings up to ti, waits, and lands on do]',
    'sing-b': '[Tavi sings up to ti, waits, and lands on do, an octave higher]',
    'count-in': '[one note: do]',
    'your-turn': '[your turn: up to ti, wait, and do]',
    'ti-do': '[ti, then do]',
}


def tidy(text):
    for a, b in WORDS:
        text = text.replace(a, b)
    text = re.sub(r'\b(doh|ray|mee|fah|soh|lah|tee)\b',
                  lambda m: SOLFEGE[m.group(1).lower()].capitalize() if m.group(1)[0].isupper() else SOLFEGE[m.group(1)],
                  text, flags=re.I)
    # numbers in hertz read as on screen: "440 hertz" -> "440 Hz"
    text = re.sub(r'\b(\d+) hertz\b', r'\1 Hz', text)
    return text


def split_lines(text, width=WIDTH):
    if len(text) <= width:
        return [text]
    # prefer a break after punctuation near the middle, else the space nearest the middle;
    # either way both lines must fit the width
    mid = len(text) // 2
    fits = lambda c: len(text[:c].strip()) <= width and len(text[c:].strip()) <= width
    cands = [m.end() for m in re.finditer(r'[,.?:;] ', text)]
    cands = [c for c in cands if 12 <= c <= len(text) - 8 and fits(c)]
    if not cands:
        cands = [i + 1 for i, ch in enumerate(text) if ch == ' ' and fits(i + 1)]
    if not cands:
        cands = [i + 1 for i, ch in enumerate(text) if ch == ' ']
    cut = min(cands, key=lambda c: abs(c - mid))
    return [text[:cut].strip(), text[cut:].strip()]


def chunks(text):
    """Split a long line into caption-sized chunks of at most 2 lines: by sentence, and a
    sentence too long for two lines at its clause marks (Lesson 2's b5 is 85 characters).
    A chunk too short to read on its own ("Yes.") joins the next when they fit together."""
    sentences = re.split(r'(?<=[.?!])\s+', text)
    pieces = []
    for sen in sentences:
        if len(sen) <= 2 * WIDTH and all(len(l) <= WIDTH for l in split_lines(sen)):
            pieces.append(sen)
            continue
        cur = ''
        for part in re.split(r'(?<=[,:;])\s+', sen):
            trial = (cur + ' ' + part).strip()
            if cur and not (len(trial) <= 2 * WIDTH and all(len(l) <= WIDTH for l in split_lines(trial))):
                pieces.append(cur)
                cur = part
            else:
                cur = trial
        if cur:
            pieces.append(cur)
    out, cur = [], ''
    for sen in pieces:
        trial = (cur + ' ' + sen).strip()
        if len(trial) <= 2 * WIDTH and all(len(l) <= WIDTH for l in split_lines(trial)):
            cur = trial
        else:
            if cur:
                out.append(cur)
            cur = sen
    if cur:
        out.append(cur)
    # a short chunk that cannot take the whole next one takes its first clauses instead:
    # "Yes. Five pairs of neighbouring letters are a tone apart," / "and each gap holds one note."
    for i in range(len(out) - 1):
        if len(out[i]) >= 12:
            continue
        parts = re.split(r'(?<=[,:;])\s+', out[i + 1])
        for n in range(len(parts) - 1, 0, -1):
            head = out[i] + ' ' + ' '.join(parts[:n])
            if len(head) <= 2 * WIDTH and all(len(l) <= WIDTH for l in split_lines(head)):
                out[i], out[i + 1] = head, ' '.join(parts[n:])
                break
    return out


def chars(lines):
    return sum(len(l) for l in lines) + len(lines) - 1


def retime(items):
    """Keep every caption inside the limits, moving no caption off its own speech.

    A caption first ends GAP before the next; then a short one stays up into the
    silence after it; a sound description that is too short for its words starts up
    to LEAD early; and when speech runs into a sound description, that description
    starts up to LAG late, so the speech has room to be read."""
    for i, c in enumerate(items):
        nxt = items[i + 1][0] if i + 1 < len(items) else c[1]
        c[1] = min(c[1], nxt - GAP) if nxt > c[0] else c[1]
    for i, c in enumerate(items):
        if i > 0 and c[2][0].startswith('[') and chars(c[2]) / (c[1] - c[0]) > CPS:
            c[0] = max(items[i - 1][1] + GAP, c[0] - LEAD)
    for i, c in enumerate(items):
        need = max(MIN_ON, chars(c[2]) / CPS)
        if c[1] - c[0] >= need:
            continue
        nxt = items[i + 1] if i + 1 < len(items) else None
        limit = nxt[0] - GAP if nxt else c[0] + need
        # the next caption may start a little late to give this one its minimum: a sound
        # description up to LAG, speech up to SPEECH_LAG (Lesson 2's one-word "Yes.")
        lag = LAG if (nxt and nxt[2][0].startswith('[')) else SPEECH_LAG
        if nxt and c[0] + need > limit:
            shift = min(lag, c[0] + need - limit, nxt[1] - nxt[0] - MIN_ON)
            if shift > 0:
                nxt[0] += shift
                limit += shift
        c[1] = max(c[1], min(c[0] + need, limit))
    return [tuple(c) for c in items]


def ts(t, sep=','):
    h, r = divmod(max(0.0, t), 3600)
    m, s = divmod(r, 60)
    return f'{int(h):02d}:{int(m):02d}:{int(s):02d}{sep}{int(round((s - int(s)) * 1000)) % 1000:03d}'


def main():
    speech, sounds = [], []
    last_who = None
    for k, c in sorted(C.items(), key=lambda kv: kv[1]['start']):
        if c['type'] == 'line':
            text = tidy(c['text'])
            parts = chunks(text)
            # each chunk starts on its own first word: the voice's word times (cues.json `words`,
            # tools/tts.py), so a caption change lands on the word; without them, by length
            spoken = c['text'].split()
            starts, k = [], 0
            for p in parts:
                starts.append(k)
                k += len(p.split())
            W = c.get('words') if c.get('words') and len(c['words']) == len(spoken) and k == len(spoken) else None
            total = sum(len(p) for p in parts)
            t = c['start']
            for i, p in enumerate(parts):
                if W:
                    a = c['start'] if i == 0 else W[starts[i]][1]
                    b = W[starts[i + 1]][1] if i + 1 < len(parts) else c['end']
                else:
                    a = t
                    b = t + (c['end'] - c['start']) * len(p) / total
                # label the speaker only when it changes (the usual caption convention)
                label = f"{SPEAKER[c['who']]}: " if (i == 0 and c['who'] != last_who) else ''
                speech.append((a, b, split_lines(label + p)))
                t = b
            last_who = c['who']
        elif k in SOUNDS:
            s_ = SOUNDS[k]
            if isinstance(s_, list):  # the listen example: three parts
                st = c['start']
                for (a, b), txt in zip([(0.0, 1.4), (1.7, 3.1), (3.4, 5.4)], s_):
                    sounds.append((st + a, st + b, [txt]))
            else:
                # a description longer than a line wraps like speech (Lesson 2 has three over 42)
                sounds.append((c['start'], max(c['end'], c['start'] + 1.2), split_lines(s_)))
    # a sound description goes only where nobody is speaking: the first free
    # window of at least 0.6 s inside the sound's own span, else it is dropped
    busy = sorted((a, b) for a, b, _ in speech)
    placed = []
    for a, b, lines in sounds:
        t = a
        for (sa, sb) in busy:
            if sb <= t or sa >= b:
                continue
            if sa - t >= 0.6:
                break
            t = max(t, sb + 0.05)
        end = b
        for (sa, sb) in busy:
            if sa >= t and sa < end:
                end = sa - 0.05
        if end - t >= 0.6:
            placed.append((t, end, lines))
    items = [list(x) for x in sorted(speech + placed, key=lambda x: x[0])]
    fixed = retime(items)
    os.makedirs(os.path.join(ROOT, 'captions'), exist_ok=True)
    # cues are separated by one blank line and the file ends on a single newline, which is
    # what the repository's `git diff --check` accepts for the committed copies
    with open(os.path.join(ROOT, 'captions/lesson-04.en.srt'), 'w') as f:
        f.write('\n\n'.join(f'{i}\n{ts(a)} --> {ts(b)}\n' + '\n'.join(lines)
                            for i, (a, b, lines) in enumerate(fixed, 1)) + '\n')
    with open(os.path.join(ROOT, 'captions/lesson-04.en.vtt'), 'w') as f:
        f.write('WEBVTT\n\n' + '\n\n'.join(f'{ts(a, ".")} --> {ts(b, ".")}\n' + '\n'.join(lines)
                                          for a, b, lines in fixed) + '\n')
    rates = sorted((chars(lines) / (b - a), a) for a, b, lines in fixed)
    longest = max(len(l) for _, _, ls in fixed for l in ls)
    print(f'{len(fixed)} captions ({len(placed)} sound descriptions), longest line {longest} chars, '
          f'peak {rates[-1][0]:.1f} chars/s at {rates[-1][1]:.1f}s, median {rates[len(rates) // 2][0]:.1f}')
    for rate, at in rates:
        if rate > CPS + 1e-9:
            print(f'warning: {rate:.1f} chars/s at {at:.2f}s is over {CPS:.0f}')
    for a, b, lines in fixed:
        if len(lines) > 2 or any(len(l) > WIDTH for l in lines) or b - a < MIN_ON - 1e-9:
            print(f'warning: caption at {a:.2f}s breaks a limit: {lines} ({b - a:.2f}s)')


if __name__ == '__main__':
    main()
