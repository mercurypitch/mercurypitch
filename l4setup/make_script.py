"""Write output/motion/lesson-04/script.json (Lesson 4 film, draft 1).
Lines are spelled for the voice: doh ray mee fah soh lah tee (captions and picture write do re mi fa so la ti)."""
import json
E = []
def mark(i, gap=0.6): E.append({"id": i, "type": "mark", "gap": gap})
_n = {"blue": 0, "orange": 0}
def line(i, who, text, gap=None):
    _n[who] += 1
    i = ("b" if who == "blue" else "o") + str(_n[who])
    e = {"id": i, "type": "line", "who": who, "text": text}
    if gap is not None: e["gap"] = gap
    E.append(e)
def sound(i, name, dur, gap=None):
    e = {"id": i, "type": "sound", "sound": name, "dur": dur}
    if gap is not None: e["gap"] = gap
    E.append(e)
def pause(i, dur, gap=None):
    e = {"id": i, "type": "pause", "dur": dur}
    if gap is not None: e["gap"] = gap
    E.append(e)
def sting(i, dur, gap=0.4): E.append({"id": i, "type": "sting", "dur": dur, "gap": gap})
B, O = "blue", "orange"

# s01 cold open: seven stairs, one short of home
mark("open", 0.6)
sound("stop-c", "stop-c", 3.9, 0.0)
pause("hang-c", 0.9, 0.0)
line("o1", O, "It just hangs there, waiting. Is that because we started on C?", 0.2)
line("b1", B, "Start somewhere else, and listen.", 0.35)
sound("stop-d", "stop-d", 3.9, 0.4)
pause("hang-d", 0.9, 0.0)
line("b2", B, "Still waiting. Now take the last step.", 0.2)
sound("land-d", "land-d", 1.65, 0.35)
line("o2", O, "Home. So why does doh ray mee sound finished when it lands on doh, and restless when it stops on tee?", 0.4)
line("b3", B, "Let's find out, one step at a time.", 0.35)
sting("title", 3.2)
# s03 promise
line("b4", B, "By the end, you'll build a major scale from its steps, start it on any note, name its notes, and hear tee lean towards home.", 0.2)
# s04 recall from Lesson 2
line("b5", B, "First, one from Lesson 2. How many semitones make an octave?", 0.6)
pause("q0", 1.8, 0.35)
line("b6", B, "Twelve. Seven letters, and five notes between them.")
line("b7", B, "But a major scale climbs that octave in just seven steps.", 0.35)
line("o3", O, "Twelve semitones in seven steps? Then some steps must be bigger than others?", 0.5)
line("b8", B, "Let's measure them.", 0.35)
# s05 act 1: count the steps
mark("act1", 0.6)
line("b9", B, "Here's the scale from C, on the white keys, up to the next C.", 0.5)
sound("scale-c", "scale-c", 4.05, 0.35)
line("b10", B, "Now measure each step, as in Lesson 2. With a black key in between, it's a tone.", 0.4)
line("o4", O, "And with no black key in between, like E to F, it's a semitone?", 0.5)
line("b11", B, "Yes. Watch each step as you listen.", 0.35)
sound("steps-c", "steps-c", 6.8, 0.35)
line("b12", B, "Tone, tone, semitone. Tone, tone, tone, semitone.", 0.4)
line("b13", B, "The steps aren't equal. The two short ones are E to F, and B to C.", 0.35)
# s06 two groups and a joint
line("o5", O, "The short steps look scattered. Is there a pattern to them?", 0.6)
line("b14", B, "Split the scale in two, and listen to each half.", 0.35)
sound("group-low", "group-low", 2.25, 0.35)
sound("group-high", "group-high", 2.25, 0.5)
line("b15", B, "Both halves climb the same way: tone, tone, semitone. One more tone joins them.", 0.4)
line("b16", B, "Now count it in semitones. Two, two, one. Two. Two, two, one.", 0.35)
line("o6", O, "That's twelve. Is that why it ends on C again, an octave up?", 0.5)
line("b17", B, "Exactly. Seven steps that add up to twelve semitones: one octave.", 0.35)
line("b18", B, "Books often write the pattern with W and H, for whole steps and half steps.", 0.35)
# s07 act 2: predict, the white keys from D
mark("act2", 0.6)
line("o7", O, "Same white keys, just starting on D. Surely that's the same scale?", 0.5)
line("b19", B, "Before you listen, predict. Start on D, play only white keys, up to the next D. Is it still doh ray mee?", 0.4)
pause("predict", 3.0, 0.4)
line("b20", B, "First, the white keys from D.", 0.35)
sound("white-d", "white-d", 4.05, 0.35)
line("b21", B, "Now the major pattern, from D.", 0.5)
sound("major-d", "major-d", 4.05, 0.35)
line("b22", B, "It changes. The white keys climb tone, semitone, tone, tone, tone, semitone, tone.", 0.5)
line("b23", B, "The short steps fall in different places, and the third and seventh notes come out a semitone low.", 0.35)
line("b24", B, "Keeping the pattern takes two black keys: F sharp and C sharp. That's D major, named after its first note.", 0.4)
# s08 a pattern, not a set of keys
line("o8", O, "So a major scale isn't a set of keys at all. It's the pattern?", 0.6)
line("b25", B, "Yes. Start the pattern on any of the twelve notes, and you get a major scale.", 0.35)
sound("slide-g", "slide-g", 3.24, 0.4)
sound("slide-e", "slide-e", 3.24, 0.5)
line("b26", B, "The shape never changes. Only the keys under it do.", 0.4)
line("b27", B, "Every start except C needs at least one black key. C is just the one that fits the white keys alone.", 0.35)
# s09 act 3: name the stairs
mark("act3", 0.6)
line("b28", B, "Now, names for the stairs. A scale's first note is its tonic: its home.", 0.5)
line("b29", B, "Musicians number the notes up from home, one to seven: the scale degrees. And they sing them with these names.", 0.4)
line("b30", B, "Doh, ray, mee, fah, soh, lah, tee, and doh again.", 0.35)
line("o9", O, "So doh is always C?", 0.6)
line("b31", B, "In one system, called fixed doh, it is. We'll use movable doh: the names belong to the stairs, not the keys.", 0.35)
line("b32", B, "Slide to D, and doh is D, ray is E, mee is F sharp.", 0.5)
line("b33", B, "Home moves, and the names move with it.", 0.35)
# s10 why ti leans home
line("b34", B, "Now, back to the question we started with.", 0.7)
line("b35", B, "Tee is the seventh note, and it sits just a semitone below doh: the last step is a short one.", 0.35)
line("b36", B, "Back on C. Climb to tee, and stop.", 0.5)
sound("stop-c-home", "stop-c", 3.9, 0.35)
pause("wait", 1.2, 0.0)
line("b37", B, "Most listeners hear it waiting for one more note. Take that step.", 0.2)
sound("land-c", "land-c", 1.65, 0.35)
line("o10", O, "But why does doh feel like home, and not tee?", 0.6)
line("b38", B, "In one experiment, listeners heard a C major scale, then one more note, and rated how well it finished the scale.", 0.35)
line("b39", B, "Doh came out on top. Trained musicians show the order most sharply, but listeners without training show it too, so that sense of home seems to be learned, just by hearing music.", 0.4)
line("o11", O, "So tee always sits a semitone under home, wherever the scale starts?", 0.6)
line("b41", B, "Always: the pattern's last step is a semitone. Tee is called the leading note, because it's thought of as leading to the tonic.", 0.35)
line("b42", B, "It leads wherever home is. From D, tee is C sharp, and it leans up to D.", 0.35)
# s11 act 4: sing it
mark("act4", 0.6)
line("b43", B, "Let's sing it. Listen first: up to soh, and back down to doh.", 0.5)
sound("sing-a", "sing-a", 7.6, 0.4)
line("o12", O, "Then all the way up to tee, and wait? I'll try that part, an octave up.", 0.6)
sound("sing-b", "sing-b", 8.6, 0.4)
line("b44", B, "Now you. Sore, hoarse or unwell today? Just listen along.", 0.6)
line("b45", B, "Otherwise, sing on doh, ray, mee, or on ooh, at about speaking volume. Start on my note, or an octave up.", 0.35)
line("b46", B, "When you stop on tee, wait a moment, and notice where it wants to go.", 0.35)
line("b47", B, "Stop immediately if anything feels uncomfortable.", 0.35)
sound("count-in", "count-in", 1.0, 0.6)
pause("your-turn", 18.2, 0.0)
# s12 recap
mark("recap", 0.6)
line("b48", B, "Quick check.", 0.5)
line("b49", B, "What pattern of steps makes a major scale?", 0.35)
pause("q1", 2.5, 0.35)
line("b50", B, "Tone, tone, semitone, tone, tone, tone, semitone. Two groups, joined by a tone.")
line("b51", B, "Start a major scale on D. Which two black keys does it need?", 0.6)
pause("q2", 1.8, 0.35)
line("b52", B, "F sharp and C sharp.")
line("b53", B, "From tee up to doh: a tone, or a semitone?", 0.6)
sound("ti-do", "ti-do", 1.65, 0.35)
pause("q3", 1.8, 0.35)
line("b54", B, "A semitone. Tee sits just under home, and most listeners hear it lean up.")
line("o13", O, "And in a scale that starts on G, which note is doh?", 0.5)
pause("q4", 1.8, 0.35)
line("b55", B, "G. Doh is wherever the scale starts: its home.")
line("b56", B, "In MercuryPitch's Scale Runner, sing a major scale back, one note at a time.", 0.5)
# s13 next
mark("next", 0.7)
line("b57", B, "Next time.", 0.3)
line("b58", B, "Singers are told to support a long note.", 0.35)
line("o14", O, "If that doesn't mean pushing, what keeps it steady?", 0.4)
sting("end", 5.0, 0.4)

out = {"title": "Find Your Pitch, Lesson 4: The major scale and home",
       "voices": {"blue": {"voice": "am_michael", "speed": 0.84}, "orange": {"voice": "af_heart", "speed": 0.9}},
       "gap": 0.3, "events": E}
ids = [e["id"] for e in E]
assert len(ids) == len(set(ids)), [i for i in ids if ids.count(i) > 1]
json.dump(out, open("/home/user/mercurypitch/output/motion/lesson-04/script.json", "w"), indent=1, ensure_ascii=False)
from collections import Counter
print(Counter(e["type"] for e in E))
w = {"blue": 0, "orange": 0}
for e in E:
    if e["type"] == "line": w[e["who"]] += len(e["text"].split())
print(w)
# rough clock at Lesson 2's voiced rates (blue 2.32, orange 3.08 w/s)
t = 0.0
for e in E:
    g = e.get("gap", 0.3)
    d = len(e["text"].split()) / (2.32 if e["who"] == "blue" else 3.08) if e["type"] == "line" else e.get("dur", 0.0)
    t += g + d
    if e["id"] in ("o2", "title", "act1", "act2", "act3", "b34", "act4", "recap", "next", "end"):
        print(f"{e['id']:8s} ends {int(t // 60)}:{t % 60:04.1f}")
print(f"total ~{int(t // 60)}:{t % 60:04.1f}")

# facts each line rests on (Lesson 4 FACTS 1-65 and the film's 66+); written into script.json, which cues.py ignores
F = {
 "o1": "87 (her guess)", "b1": "87", "b2": "59, 87", "o2": "17, 28, 66, 87", "b3": "-",
 "b4": "LESSON.md promise; 23 (\"hear ti lean towards home\", no reason given)",
 "b5": "30, 70", "b6": "70", "b7": "71", "o3": "71 (her guess)", "b8": "-",
 "b9": "6, 57", "b10": "6, 72", "o4": "72 (her guess)", "b11": "-", "b12": "2", "b13": "6",
 "o5": "- (a question)", "b14": "3, 65", "b15": "3, 73", "b16": "4", "o6": "4, 74 (her guess)", "b17": "4, 74", "b18": "2, 75",
 "o7": "mix-up card (her belief)", "b19": "LESSON.md step 3", "b20": "60", "b21": "10, 60", "b22": "11, 76", "b23": "11, 76", "b24": "9, 10, 76",
 "o8": "mix-up card's better idea (her words)", "b25": "8, 77", "b26": "77", "b27": "12, 77",
 "b28": "16, 17, 78", "b29": "18, 19, 78", "b30": "19, 20, 66, 78", "o9": "79 (her guess)", "b31": "19, 79", "b32": "21, 79", "b33": "19, 79",
 "b34": "-", "b35": "22, 80", "b36": "58, 80", "b37": "23, 80 (on C)", "o10": "- (a question)",
 "b38": "24, 81", "b39": "23a, 24, 25, 81", "o11": "2, 22, 82 (her guess)", "b40": "2, 22, 82", "b41": "26, 82 (textbook terms)",
 "b42": "63, 83", "o12": "63, 83", "b43": "50, 83", "b44": "51, 52, 83", "b45": "83; LESSON.md Sing it", "b46": "53, 83",
 "b47": "-", "b48": "2, 84", "b49": "2, 3, 84", "b50": "10, 84", "b51": "10, 84", "b52": "22, 84", "b53": "22, 23, 84 (on C)",
 "o13": "19, 84", "b54": "9, 19, 84", "b55": "36-38, 85", "b56": "-", "b57": "31, 86", "o14": "31, 86",
}
miss = [e["id"] for e in E if e["type"] == "line" and e["id"] not in F]
assert not miss, miss
for e in E:
    if e["type"] == "line":
        e["facts"] = F[e["id"]]
json.dump(out, open("/home/user/mercurypitch/output/motion/lesson-04/script.json", "w"), indent=1, ensure_ascii=False)
print("facts written for", sum(1 for e in E if "facts" in e), "lines")
