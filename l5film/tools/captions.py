"""Word-perfect captions from the cue sheet: SRT and VTT for YouTube and the web
player, plus sound descriptions so a viewer with the sound off knows what is
playing.

  python3 tools/captions.py

Writes captions/lesson-05.en.srt, captions/lesson-05.en.vtt. Reads cues.json. What the voice
spells for itself is written the way the picture writes it (the address, FACTS 78). Limits, as in
the usual subtitle guides: at most 42 characters a line and two lines a caption, at
most 20 characters a second, at least 5/6 s on screen, and 5 frames (60 fps) between
captions. A caption may stay up into the silence after its line, and a sound
description may come up to 0.25 s early or 0.3 s late, to keep a caption inside the
reading speed (a long sound's, a tenth of its length late: "[your ten seconds]" waits for
"[tick: start]"); the speaker label is the host's name, "MERC:" or "TAVI:", only when the
speaker changes (MERC-BIBLE § 8, item 1). The run prints the peak reading speed and warns on any breach.

Lesson 5: WORDS, SOUNDS, QUIET and SUNG are this film's (STORYBOARD § Sounds and captions); a
sound or pause with no entry stops the run.
"""
import json, os, re

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
C = json.load(open(os.path.join(ROOT, 'cues.json')))['cues']

WORDS = [
    # longest first: what the voice spells for itself, written as the picture writes it (FACTS 78;
    # tools/script-draft.py, SAY). No line of this film says "A three" or "A four"; they are here
    # in case a re-voice does.
    ('mercurypitch dot com slash mirror', 'mercurypitch.com/mirror'),
    ('A three', 'A3'), ('A four', 'A4'),
]
SPEAKER = {'blue': 'MERC', 'orange': 'TAVI'}
# Words no caption may part: a title in quotation marks, and a speaker's label from its first
# word. Inside the chunker their space is JOIN, a character no rule treats as a space.
KEEP = ['"Twinkle, Twinkle"']
JOIN = '\ue000'
WIDTH, CPS, MIN_ON, GAP, LEAD, LAG, SPEECH_LAG = 42, 20.0, 5 / 6, 5 / 60, 0.25, 0.3, 0.1
SOUNDS = {
    # what each sound is, never what it means, so a predict gives nothing away
    # (STORYBOARD § Sounds and captions, word for word)
    'easy': '[a note, sung easily]',
    'pushed': '[the same note, pushed harder and harder]',
    'push': '[a held note: the push rises, holds, eases off]',
    'gauge': '[Merc holds an A, 220 Hz, for ten seconds]',
    'start-air': '[a start: air first]', 'start-catch': '[a start: a catch]', 'start-together': '[a start: together]',
    'starts': '[the three starts, back to back]',
    'demo': '[Tavi holds an A, 440 Hz, for ten seconds]',
    'listen': '[Merc and Tavi sing their A together]',
    'tick-in': '[tick: start]', 'tick-out': '[tick: stop]',
    'hold': '[your ten seconds]',
    'twinkle': '[Merc sings the first line of a tune]',
    'predict': '[pause and predict]', 'predict2': '[pause and predict]',
    'q0': '[think]', 'q1': '[think]', 'q3': '[think]', 'q4': '[think]', 'feel': '[think]',
    'title': '[chime]', 'end': '[chime]',
}
# events the picture holds, with no caption (STORYBOARD § Sounds and captions). `break` is not in
# the board's table (it came with DECISIONS 190): Merc's two hops are its subject, and they are seen.
QUIET = {'heard', 'breathe', 'hook', 'card', 'break'}
# Who sings each sung sound (FACTS 80): the sound is that host's turn, so the next line names its
# speaker when it is the other host. Both sing `listen`, so the line after it is always named.
SUNG = {'gauge': 'blue', 'twinkle': 'blue', 'demo': 'orange', 'listen': None}


def tidy(text):
    for a, b in WORDS:
        text = text.replace(a, b)
    for k in KEEP:
        text = text.replace(k, k.replace(' ', JOIN))
    # numbers in hertz read as on screen: "440 hertz" -> "440 Hz"
    text = re.sub(r'\b(\d+) hertz\b', r'\1 Hz', text)
    return text


LITTLE = {'a', 'an', 'the', 'of', 'to', 'and', 'or', 'in', 'on', 'at', 'for', 'with', 'from', 'by', 'up'}


def orphan(text, c):
    """True when a break at c leaves one word of a sentence alone on its line."""
    before, after = text[:c].strip(), text[c:].strip()
    if re.search(r'[.?!]$', before):
        return False
    head = re.split(r'(?<=[.?!])\s+', before)[-1]
    tail = re.split(r'(?<=[.?!])\s+', after)[0]
    return len(head.split()) < 2 or len(tail.split()) < 2


def best_break(text, width=WIDTH):
    """Where to break a two-line caption, and whether that is at a punctuation mark: after a
    sentence first, then after a clause mark, near the middle, never leaving one word of a
    sentence alone on its line; else the space nearest the middle that fits."""
    mid = len(text) // 2
    fits = lambda c: len(text[:c].strip()) <= width and len(text[c:].strip()) <= width
    for marks in (r'[.?!] ', r'[,:;] '):
        cands = [m.end() for m in re.finditer(marks, text)]
        cands = [c for c in cands if 12 <= c <= len(text) - 8 and fits(c) and not orphan(text, c)]
        if cands:
            return min(cands, key=lambda c: abs(c - mid)), True
    cands = [i + 1 for i, ch in enumerate(text) if ch == ' ' and fits(i + 1)]
    # nor a line that ends on a little word ("wherever a" / "major scale")
    cands = [c for c in cands if not orphan(text, c) and
             text[:c].split()[-1].lower() not in LITTLE] or [c for c in cands if not orphan(text, c)] or cands
    if not cands:
        cands = [i + 1 for i, ch in enumerate(text) if ch == ' ']
    return min(cands, key=lambda c: abs(c - mid)), False


def tidy_break(text):
    return best_break(text)[1]


def split_lines(text, width=WIDTH):
    if len(text) <= width:
        return [text]
    cut, _ = best_break(text, width)
    return [text[:cut].strip(), text[cut:].strip()]


def fits2(text):
    """True when the text fits one caption: two lines of at most WIDTH."""
    return len(text) <= 2 * WIDTH and all(len(l) <= WIDTH for l in split_lines(text))


def tidy2(text):
    """True when it fits and its first line does not end on a little word ("... talk at: a")."""
    lines = split_lines(text)
    return fits2(text) and not (len(lines) == 2 and lines[0].split()[-1].lower() in LITTLE)


def halves(text):
    """A sentence with no clause mark that cannot fit one caption, in two (or more) at the space
    nearest its middle that leaves no little word at an end: Lesson 5's o15, 85 characters with
    its label and a title no caption may part."""
    if fits2(text):
        return [text]
    cuts = [i for i, ch in enumerate(text) if ch == ' ']
    good = [i for i in cuts if text[:i].split()[-1].lower() not in LITTLE] or cuts
    if not good:
        return [text]
    i = min(good, key=lambda i: abs(i - len(text) / 2))
    return halves(text[:i].strip()) + halves(text[i:].strip())


def chunks(text):
    """Split a long line into caption-sized chunks of at most 2 lines: by sentence, and a
    sentence too long for two lines at its clause marks (Lesson 2's b5 is 85 characters).
    A chunk too short to read on its own ("Yes.") joins the next when they fit together."""
    sentences = re.split(r'(?<=[.?!])\s+', text)
    pieces = []
    for sen in sentences:
        if tidy2(sen):
            pieces.append(sen)
            continue
        cur = ''
        for part in re.split(r'(?<=[,:;])\s+', sen):
            trial = (cur + ' ' + part).strip()
            if cur and not tidy2(trial):
                pieces.append(cur)
                cur = part
            else:
                cur = trial
        if cur:
            pieces.append(cur)
    pieces = [h for p in pieces for h in halves(p)]
    out, cur = [], ''
    for sen in pieces:
        trial = (cur + ' ' + sen).strip()
        # two pieces share a caption only where its line break falls at a punctuation mark and
        # leaves no word alone with its line ("MERC: Now you. Sore," / "hoarse ...")
        if len(trial) <= 2 * WIDTH and all(len(l) <= WIDTH for l in split_lines(trial)) and \
                (len(trial) <= WIDTH or tidy_break(trial) or min(len(cur), len(sen)) < 12):
            cur = trial
        else:
            if cur:
                out.append(cur)
            cur = sen
    if cur:
        out.append(cur)
    # a short chunk that cannot take the whole next one takes its first clauses instead:
    # "Yes. Five pairs of neighbouring letters are a tone apart," / "and each gap holds one note."
    # Of the splits that fit, the most even one that leaves the next caption at least 12
    # characters: taking the most clauses left "tone." alone for 0.83 s (storyboard critic 01).
    for i in range(len(out) - 1):
        if len(out[i]) >= 12:
            continue
        parts = re.split(r'(?<=[,:;])\s+', out[i + 1])
        fit = []
        for n in range(1, len(parts)):
            head, rest = out[i] + ' ' + ' '.join(parts[:n]), ' '.join(parts[n:])
            if len(head) <= 2 * WIDTH and all(len(l) <= WIDTH for l in split_lines(head)):
                fit.append((len(rest) < 12, abs(len(head) - len(rest)), head, rest))
        if fit:
            _, _, out[i], out[i + 1] = min(fit)
    # and a short last chunk of a sentence takes the clauses before it, as evenly as fits:
    # "... still: they can begin with a short slide," / "a scoop." (0.83 s alone) becomes
    # "... still:" / "they can begin with a short slide, a scoop." (Lesson 5's b30)
    for i in range(1, len(out)):
        if len(out[i]) >= 12 or re.search(r'[.?!]$', out[i - 1]):
            continue
        parts = re.split(r'(?<=[,:;])\s+', out[i - 1])
        fit = []
        for n in range(1, len(parts)):
            head, rest = ' '.join(parts[:n]), ' '.join(parts[n:]) + ' ' + out[i]
            if len(head) >= 12 and fits2(head) and fits2(rest):
                fit.append((abs(len(head) - len(rest)), head, rest))
        if fit:
            _, out[i - 1], out[i] = min(fit)
    return out


def chars(lines):
    return sum(len(l) for l in lines) + len(lines) - 1


def retime(items):
    """Keep every caption inside the limits, moving no caption off its own speech.

    A caption first ends GAP before the next; then a short one stays up into the
    silence after it; a sound description that is too short for its words starts up
    to LEAD early; and when speech runs into a sound description, that description
    starts up to LAG late, so the speech has room to be read. Lesson 5: a long sound's
    description gives way by up to a tenth of its length ("[your ten seconds]" comes
    up when "[tick: start]" has had its time), and a description still short of its
    minimum starts early by what it lacks, the description before it ending sooner."""
    need_of = lambda c: max(MIN_ON, chars(c[2]) / CPS)
    is_sound = lambda c: c[2][0].startswith('[')
    # how late the next caption may start to give this one its time
    gives = lambda nxt: (max(LAG, 0.1 * (nxt[1] - nxt[0])) if is_sound(nxt) else SPEECH_LAG)
    for i, c in enumerate(items):
        nxt = items[i + 1][0] if i + 1 < len(items) else c[1]
        c[1] = min(c[1], nxt - GAP) if nxt > c[0] else c[1]
    for i, c in enumerate(items):
        if i > 0 and is_sound(c) and chars(c[2]) / (c[1] - c[0]) > CPS:
            nxt = items[i + 1] if i + 1 < len(items) else None
            if nxt and need_of(c) - (c[1] - c[0]) <= gives(nxt):
                continue                      # the caption after it can give it the time: it starts on its sound
            c[0] = max(items[i - 1][1] + GAP, c[0] - LEAD)
    for i, c in enumerate(items):
        need = need_of(c)
        if c[1] - c[0] >= need:
            continue
        nxt = items[i + 1] if i + 1 < len(items) else None
        limit = nxt[0] - GAP if nxt else c[0] + need
        # the next caption may start a little late to give this one its minimum: a sound
        # description up to LAG (a long one, a tenth of its length), speech up to SPEECH_LAG
        # (Lesson 2's one-word "Yes.")
        if nxt and c[0] + need > limit:
            shift = min(gives(nxt), c[0] + need - limit, nxt[1] - nxt[0] - MIN_ON)
            if shift > 0:
                nxt[0] += shift
                limit += shift
        c[1] = max(c[1], min(c[0] + need, limit))
    for i, c in enumerate(items):
        short = need_of(c) - (c[1] - c[0])
        if i == 0 or short <= 1e-9 or not is_sound(c):
            continue
        prev = items[i - 1]
        lead = min(LEAD, short)
        spare = (prev[1] - prev[0]) - need_of(prev)
        if is_sound(prev) and spare > 0:
            prev[1] -= min(spare, max(0.0, lead - (c[0] - GAP - prev[1])))
        c[0] = max(prev[1] + GAP, c[0] - lead)
    return [tuple(c) for c in items]


def ts(t, sep=','):
    h, r = divmod(max(0.0, t), 3600)
    m, s = divmod(r, 60)
    return f'{int(h):02d}:{int(m):02d}:{int(s):02d}{sep}{int(round((s - int(s)) * 1000)) % 1000:03d}'


def main():
    unknown = sorted(k for k, c in C.items() if c['type'] in ('sound', 'pause', 'sting') and k not in SOUNDS
                     and k not in QUIET)
    if unknown:
        raise SystemExit('captions.py: no caption for ' + ' '.join(unknown) + " (add it to SOUNDS or QUIET: "
                         'this film\'s, from STORYBOARD § Sounds and captions)')
    speech, sounds = [], []
    last_who = None
    for k, c in sorted(C.items(), key=lambda kv: kv[1]['start']):
        if c['type'] == 'line':
            text = tidy(c['text'])
            # label the speaker only when it changes (the usual caption convention); the label
            # is chunked with its line, so it counts towards the 42 characters
            label = f"{SPEAKER[c['who']]}:{JOIN}" if c['who'] != last_who else ''
            parts = chunks(label + text)
            # each chunk starts on its own first word: the voice's word times (cues.json `words`,
            # tools/tts.py), so a caption change lands on the word; without them, by length.
            # The label is not one of the voice's words.
            spoken = c['text'].split()
            starts, k = [], 0
            for i, p in enumerate(parts):
                starts.append(k)
                k += len(p.replace(JOIN, ' ').split()) - (1 if (i == 0 and label) else 0)
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
                speech.append((a, b, [l.replace(JOIN, ' ') for l in split_lines(p)]))
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
            if k in SUNG:
                last_who = SUNG[k]
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
    os.makedirs(os.path.join(ROOT, 'captions'), exist_ok=True)
    with open(os.path.join(ROOT, 'captions/lesson-05.en.srt'), 'w') as f:
        f.write('\n\n'.join(f'{i}\n{ts(a)} --> {ts(b)}\n' + '\n'.join(lines)
                            for i, (a, b, lines) in enumerate(fixed, 1)) + '\n')
    with open(os.path.join(ROOT, 'captions/lesson-05.en.vtt'), 'w') as f:
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
