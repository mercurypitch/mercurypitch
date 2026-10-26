# Resolve #1214's three Lesson 10 doc conflicts on top of #1213 (rebased): keep #1213's
# score facts (ceiling 80, richness dropped) and #1214's corrected copy (equal-tempered).
import sys, re, difflib
D = sys.argv[1]
def blocks(text):
    m = re.search(r'^<<<<<<< [^\n]*\n(.*?)^\|\|\|\|\|\|\| [^\n]*\n(.*?)^=======\n(.*?)^>>>>>>> [^\n]*\n', text, re.S | re.M)
    assert m, 'no conflict block'
    return m, m.group(1), m.group(2), m.group(3)
def toks(s): return re.findall(r'\S+|\s+', s)
def wmerge(base, o, t):
    B = toks(base)
    def ops(X):
        sm = difflib.SequenceMatcher(None, B, toks(X), autojunk=False)
        return [(i1, i2, toks(X)[j1:j2]) for op, i1, i2, j1, j2 in sm.get_opcodes() if op != 'equal']
    eo, et = ops(o), ops(t)
    for a1, a2, _ in eo:
        for b1, b2, _ in et:
            assert a2 <= b1 or b2 <= a1, 'overlap'
    for i1, i2, rep in sorted(eo + et, key=lambda e: (e[0], e[1]), reverse=True):
        B[i1:i2] = rep
    return ''.join(B)
def rep(s, old, new):
    assert s.count(old) == 1, ('not once', old[:60])
    return s.replace(old, new)

# FACTS.md: line 48 word-merges cleanly; line 49 by hand.
p = f'{D}/FACTS.md'; text = open(p).read(); m, ours, base, theirs = blocks(text)
O, Bs, T = ours.split('\n'), base.split('\n'), theirs.split('\n')
assert len(O) == len(Bs) == len(T) == 3 and O[2] == Bs[2] == T[2] == ''
l48 = wmerge(Bs[0], O[0], T[0])
l49 = O[1]
l49 = rep(l49, 'its idle line says "Sing intervals against a sustained drone. Train your ear to lock into just intonation.", and its help speaks of "pure intonation" and of the sounds that "lock together and stop beating", while every target is equal-tempered',
               'its idle line says "Sing intervals against a sustained drone. Each target is an equal-tempered note, in the same tuning as the rest of the app.", and its help says the targets "use the same twelve equal steps to the octave as the rest of the app"; every target is equal-tempered')
l49 = rep(l49, 'the page says nothing else about its score and never repeats "just intonation" or "pure intonation". The score\'s ceiling of 80, and the just-intonation copy, are on the App content list',
               'the page says nothing else about its score. The score\'s ceiling of 80 is on the App content list')
l49 = rep(l49, 'so the page and WEB-SPEC say only that the targets are equal-tempered',
               'so the page, WEB-SPEC and the app\'s own Drone Intonation copy say only that the targets are equal-tempered')
open(p, 'w').write(text[:m.start()] + l48 + '\n' + l49 + '\n' + text[m.end():])

# LESSON.md
p = f'{D}/LESSON.md'; text = open(p).read(); m, ours, base, theirs = blocks(text)
new = ('  octave, scored in cents against the octave it asks for. One thing for the coach and the App\n'
       '  content track: its score cannot reach 100, since the fifth of it that was a "richness" reading of\n'
       '  the voice was dropped without reweighting the rest (FACTS 48, 49, 55).\n')
open(p, 'w').write(text[:m.start()] + new + text[m.end():])

# WEB-SPEC.md
p = f'{D}/WEB-SPEC.md'; text = open(p).read(); m, ours, base, theirs = blocks(text)
new = ('  score, the coach: its score cannot reach 100, since the fifth of it that was a "richness" reading\n'
       '  was dropped without reweighting the rest. The Learn chapter "Common Musical Scales" now gives\n'
       '  minor\'s mood as a tendency and E♭ major as C minor\'s relative major, and Drone Intonation\'s copy\n'
       '  says its targets are equal-tempered (FACTS 55). And\n')
open(p, 'w').write(text[:m.start()] + new + text[m.end():])
print('resolved')
