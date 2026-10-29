"""Write output/motion/lesson-04/script.json (Lesson 4 film).

Draft 2: script critic round 1's nine items (review/script-01/REPORT.md), Lesson 2's 2.2 s
chapter breaths after the act 2, 3 and 4 marks, and three cuts for length (DECISIONS 5): Merc's
tag after the hook, the W and H line (the letters stay on screen) and the "back to the question"
signpost, folded into the next line.

Lines are spelled for the voice: doh ray mee fah soh lah tee (captions and the picture write
do re mi fa so la ti). Each line carries the facts it rests on (Lesson 4 FACTS 1-65, the film's
66+); cues.py ignores the key.
"""
import json
from collections import Counter

E = []
_n = {"blue": 0, "orange": 0}


def mark(i, gap=0.6):
    E.append({"id": i, "type": "mark", "gap": gap})


def line(who, text, gap=None, facts="-"):
    _n[who] += 1
    e = {"id": ("b" if who == "blue" else "o") + str(_n[who]), "type": "line", "who": who, "text": text, "facts": facts}
    if gap is not None:
        e["gap"] = gap
    E.append(e)


def sound(i, name, dur, gap=None):
    e = {"id": i, "type": "sound", "sound": name, "dur": dur}
    if gap is not None:
        e["gap"] = gap
    E.append(e)


def pause(i, dur, gap=None):
    e = {"id": i, "type": "pause", "dur": dur}
    if gap is not None:
        e["gap"] = gap
    E.append(e)


def sting(i, dur, gap=0.4):
    E.append({"id": i, "type": "sting", "dur": dur, "gap": gap})


B, O = "blue", "orange"
BREATH = 2.2   # Lesson 2's chapter breath: the first line after an act 2, 3 or 4 mark

# s01 cold open: seven stairs, one short of home
mark("open", 0.6)
sound("stop-c", "stop-c", 3.9, 0.0)
pause("hang-c", 0.9, 0.0)
line(O, "It just hangs there, waiting. Is that because we started on C?", 0.2, "87 (her guess)")
line(B, "Start on D, and listen. Will it still hang?", 0.35, "87; LESSON.md cold-open predict")
pause("predict-d", 1.5, 0.3)
sound("stop-d", "stop-d", 3.9, 0.3)
pause("hang-d", 0.9, 0.0)
line(B, "Still waiting. Now the last step.", 0.2, "59, 87")
sound("land-d", "land-d", 1.65, 0.35)
line(O, "So home moved with the start. Then why does doh ray mee sound finished when it lands on doh, and restless when it stops on tee?", 0.4, "17, 26, 28, 66, 87")
sting("title", 3.2)
# s03 promise
line(B, "By the end, you'll build a major scale from its steps, start it on any note, name its notes, and hear tee lean towards home.", 0.2, "LESSON.md promise; 23")
# s04 recall from Lesson 2
line(B, "First, one from Lesson 2. How many semitones make an octave?", 0.6, "30, 70")
pause("q0", 1.8, 0.35)
line(B, "Twelve. Seven letters, and five notes between them.", None, "70")
line(B, "But a major scale climbs that octave in just seven steps.", 0.35, "71")
line(O, "Twelve semitones in seven steps? Then some steps must be bigger than others?", 0.5, "71 (her guess)")
line(B, "Let's measure them.", 0.35)
# s05 act 1: count the steps
mark("act1", 0.6)
line(B, "Here's that doh ray mee, from C, on the white keys: a major scale.", 0.5, "1, 6, 7, 57")
sound("scale-c", "scale-c", 4.05, 0.35)
line(B, "Now measure each step, as in Lesson 2. With a black key in between, it's a tone.", 0.4, "6, 72")
line(O, "And with no black key in between, like E to F, it's a semitone?", 0.5, "72 (her guess)")
line(B, "Yes. Watch each step as you listen.", 0.35)
sound("steps-c", "steps-c", 6.8, 0.35)
line(B, "Tone, tone, semitone. Tone, tone, tone, semitone.", 0.4, "2")
line(B, "The steps aren't equal. The two short ones are E to F, and B to C.", 0.35, "6")
# s06 two groups and a joint
line(O, "The short steps look scattered. Is there a pattern to them?", 0.6, "- (a question)")
line(B, "Split the scale in two, and listen to each half.", 0.35, "3, 65")
sound("group-low", "group-low", 2.25, 0.35)
sound("group-high", "group-high", 2.25, 0.5)
line(B, "Both halves climb the same way: tone, tone, semitone. One more tone joins them.", 0.4, "3, 73")
line(B, "Now count it in semitones. Two, two, one. Two. Two, two, one.", 0.35, "4")
line(O, "That's twelve. Is that why it ends on C again, an octave up?", 0.5, "4, 74 (her guess)")
line(B, "Exactly. Seven steps that add up to twelve semitones: one octave.", 0.35, "4, 74")
# s07 act 2: predict, the white keys from D
mark("act2", 0.7)
line(O, "Same white keys, just starting on D. Surely that's the same scale?", BREATH, "mix-up card (her belief)")
line(B, "Before you listen, predict. Start on D, play only white keys, up to the next D. Is it still doh ray mee?", 0.4, "LESSON.md step 3")
pause("predict", 3.0, 0.4)
line(B, "First, the white keys from D.", 0.35, "60")
sound("white-d", "white-d", 4.05, 0.35)
line(B, "Now the major pattern, from D.", 0.5, "10, 60")
sound("major-d", "major-d", 4.05, 0.35)
line(B, "It changes. The white keys climb tone, semitone, tone, tone, tone, semitone, tone.", 0.5, "11, 76")
line(B, "The short steps fall in different places, and the third and seventh notes come out a semitone low.", 0.35, "11, 76")
line(B, "Keeping the pattern takes two black keys: F sharp and C sharp. That's D major, named after its first note.", 0.4, "9, 10, 76")
# s08 a pattern, not a set of keys
line(O, "So a major scale isn't a set of keys at all. It's the pattern?", 0.6, "mix-up card's better idea (her words)")
line(B, "Yes. Start the pattern on any of the twelve notes, and you get a major scale.", 0.35, "8, 77")
sound("slide-g", "slide-g", 3.24, 0.4)
sound("slide-e", "slide-e", 3.24, 0.5)
line(B, "The shape never changes. Only the keys under it change.", 0.4, "77")
line(B, "Every start except C needs at least one black key. C is just the one that fits the white keys alone.", 0.35, "12, 77")
# s09 act 3: name the stairs
mark("act3", 0.7)
line(B, "Now, names for the stairs. A scale's first note is its tonic: its home.", BREATH, "16, 17, 78")
line(B, "Musicians number the notes up from home, one to seven: the scale degrees. And they sing them with these names.", 0.4, "18, 19, 78")
line(B, "Doh, ray, mee, fah, soh, lah, tee, and doh again.", 0.35, "19, 20, 66, 78")
line(O, "In the opening, doh moved up to D. But isn't doh always C?", 0.6, "79 (her doubt: what she saw against what she has heard)")
line(B, "In one system, called fixed doh, it is. We'll use movable doh: the names belong to the stairs, not the keys.", 0.35, "19, 79")
line(B, "Slide to D, and doh is D, ray is E, mee is F sharp.", 0.5, "21, 79")
line(B, "Home moves, and the names move with it.", 0.35, "19, 79")
# s10 ti, one short of home
line(B, "Back to the opening question. Tee is the seventh note, and it sits just a semitone below doh: the last step is a short one.", 0.7, "22, 80")
line(B, "Climb to tee from C, and stop.", 0.5, "58, 80")
sound("stop-c-home", "stop-c", 3.9, 0.35)
pause("wait", 1.2, 0.0)
line(B, "Most listeners hear it waiting for one more note. Take that step.", 0.2, "23, 80 (on C)")
sound("land-c", "land-c", 1.65, 0.35)
line(O, "But why does doh feel like home, and not tee?", 0.6, "- (a question)")
# s11 why do is home
line(B, "In one experiment, listeners heard a C major scale, then one more note, and rated how well it finished the scale.", 0.35, "24, 81")
line(B, "Doh came out on top. Later studies found the same kind of order in listeners without training too, only weaker. So that sense of home seems to be learned, just by hearing music.", 0.35, "23a, 24, 25, 81")
line(O, "So doh sounds finished because we've learned to hear it as home, and tee stops one short step under it?", 0.6, "22, 23a, 82 (her synthesis)")
line(B, "That's how it seems. Tee is called the leading note, because it's thought of as leading to the tonic.", 0.35, "22, 23a, 82")
line(B, "It leads wherever home is. From D, tee is C sharp, and it leans up to D.", 0.35, "26, 82 (textbook terms)")
# s12 act 4: sing it, Merc then Tavi
mark("act4", 0.7)
line(B, "Let's sing it. Listen first: up to tee, a wait, and home.", BREATH, "63, 83")
sound("sing-a", "sing-a", 8.6, 0.4)
line(O, "So on tee, I just wait, and listen for where it wants to go?", 0.6, "63, 83 (her re-explanation)")
line(B, "Yes. Try it, an octave up.", 0.35, "52, 83")
sound("sing-b", "sing-b", 8.6, 0.4)
# s13 your turn
line(B, "Now you. Sore, hoarse or unwell today? Just listen along.", 0.6, "50, 83")
line(B, "Otherwise, sing on doh, ray, mee, or on ooh, at about speaking volume. Start on my note, or an octave up.", 0.35, "51, 52, 83")
line(B, "Wait on tee, and notice where it wants to go.", 0.35, "83; LESSON.md Sing it")
line(B, "Stop immediately if anything feels uncomfortable.", 0.35, "53, 83")
sound("count-in", "count-in", 1.0, 0.6)
pause("your-turn", 8.6, 0.0)
# s14 recap
mark("recap", 0.7)
line(B, "Quick check.", 0.5)
line(B, "What pattern of steps makes a major scale?", 0.35, "2, 84")
pause("q1", 2.5, 0.35)
line(B, "Tone, tone, semitone, tone, tone, tone, semitone. Two groups, joined by a tone.", None, "2, 3, 84")
line(B, "Start a major scale on D. Which two black keys does it need?", 0.6, "10, 84")
pause("q2", 1.8, 0.35)
line(B, "F sharp and C sharp.", None, "10, 84")
line(B, "From tee up to doh: a tone, or a semitone?", 0.6, "22, 84")
sound("ti-do", "ti-do", 1.65, 0.35)
pause("q3", 1.8, 0.35)
line(B, "A semitone. Tee sits just under home, and most listeners hear it lean up.", None, "22, 23, 84 (on C)")
line(O, "And in a scale that starts on G, which note is doh?", 0.5, "19, 84")
pause("q4", 1.8, 0.35)
line(B, "G. Doh is wherever the scale starts: its home.", None, "9, 19, 84")
line(B, "In MercuryPitch's Scale Runner, sing a major scale back, one note at a time, in the octave it plays.", 0.5, "36-38, 40, 85")
# s15 next
mark("next", 0.7)
line(B, "Next time.", 0.3)
line(B, "Singers are told to support a long note.", 0.35, "31, 86")
line(O, "If that doesn't mean pushing, what keeps it steady?", 0.4, "31, 86")
sting("end", 5.0, 0.4)

out = {"title": "Find Your Pitch, Lesson 4: The major scale and home",
       "voices": {"blue": {"voice": "am_michael", "speed": 0.84}, "orange": {"voice": "af_heart", "speed": 0.9}},
       "gap": 0.3, "events": E}
ids = [e["id"] for e in E]
assert len(ids) == len(set(ids)), [i for i in ids if ids.count(i) > 1]
json.dump(out, open("/home/user/mercurypitch/output/motion/lesson-04/script.json", "w"), indent=1, ensure_ascii=False)
print(Counter(e["type"] for e in E))
w = {"blue": 0, "orange": 0}
for e in E:
    if e["type"] == "line":
        w[e["who"]] += len(e["text"].split())
print(w, "lines", _n)
t = 0.0
for e in E:
    g = e.get("gap", 0.3)
    d = len(e["text"].split()) / (2.32 if e["who"] == "blue" else 3.08) if e["type"] == "line" else e.get("dur", 0.0)
    t += g + d
    if e["id"] in ("o2", "title", "act1", "act2", "act3", "act4", "recap", "next", "end"):
        print(f"{e['id']:8s} ends {int(t // 60)}:{t % 60:04.1f}")
print(f"total ~{int(t // 60)}:{t % 60:04.1f} at Lesson 2's voiced pace")
