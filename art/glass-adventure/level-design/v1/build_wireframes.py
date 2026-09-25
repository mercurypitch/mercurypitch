"""Render the Cloudway design-review wireframes; these are not runtime levels."""

from html import escape
from pathlib import Path

OUT = Path(__file__).resolve().parent
INK = "#183e3b"
GOLD = "#ac8141"
ICE = "#a9dce3"


def text(x, y, value, size=16, color=INK, anchor="start", extra=""):
    return f'<text x="{x}" y="{y}" font-size="{size}" fill="{color}" text-anchor="{anchor}" {extra}>{escape(value)}</text>'


def start(title, subtitle):
    return [f'''<svg xmlns="http://www.w3.org/2000/svg" width="1100" height="740" viewBox="0 0 1100 740" role="img" aria-labelledby="title desc">
<title id="title">{escape(title)}</title><desc id="desc">{escape(subtitle)}</desc>
<defs>
 <pattern id="grid" width="24" height="24" patternUnits="userSpaceOnUse"><path d="M24 0H0V24" fill="none" stroke="#e4dfcf" stroke-width=".5"/></pattern>
 <pattern id="ice" width="9" height="9" patternUnits="userSpaceOnUse"><rect width="9" height="9" fill="#c8e8eb"/><path d="M0 9L9 0" stroke="#79b4bf" stroke-width="1"/></pattern>
 <marker id="arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0 0L6 3L0 6" fill="none" stroke="{GOLD}"/></marker>
</defs>
<rect width="1100" height="740" rx="16" fill="#f8f5eb"/>
<rect x="24" y="90" width="1052" height="554" fill="url(#grid)" rx="10"/>
<g font-family="Arial, sans-serif">''', text(32, 41, title, 28, extra='font-family="Georgia, serif"'), text(32, 68, subtitle, 14, "#5f7065")]


def save(name, parts, footer):
    parts += [text(32, 683, footer, 15), text(32, 713, "GLASSWORKS  /  DESIGN STUDY  /  25 SEPTEMBER 2026", 11, GOLD), "</g></svg>"]
    (OUT / f"{name}.svg").write_text("\n".join(parts) + "\n")


def deck(x, y, w=70, h=44, kind="stone"):
    fill = "url(#ice)" if kind == "frost" else "#ede5cd" if kind == "crackle" else "#fffdf5"
    return f'<rect x="{x-w/2}" y="{y-h/2}" width="{w}" height="{h}" rx="7" fill="{fill}" stroke="{GOLD}" stroke-width="2"/><rect x="{x-w/2+5}" y="{y-h/2+5}" width="{w-10}" height="{h-10}" rx="4" fill="none" stroke="#d4c4a4"/>'


def route(d, optional=False):
    dash = 'stroke-dasharray="6 7"' if optional else ''
    return f'<path d="{d}" fill="none" stroke="{GOLD}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" {dash} marker-end="url(#arrow)"/>'


def station(x, y, number, pitch, title, gate=False):
    parts = [deck(x, y, 146, 76), f'<circle cx="{x-61}" cy="{y-28}" r="16" fill="{INK}"/>', text(x-61, y-22, str(number), 16, "#fffaf0", "middle"), text(x, y-5, title, 15, anchor="middle"), text(x, y+19, pitch, 13, "#6b715f", "middle")]
    if gate:
        parts += [f'<rect x="{x-64}" y="{y-47}" width="128" height="10" rx="3" fill="url(#ice)" stroke="#548a97" stroke-width="2"/>', text(x, y-61, "VOICE-OPENED FROST WALL", 10, "#417b87", "middle")]
    return "\n".join(parts)


def finale(x, y, exit_below=False):
    exit_y = y + 68 if exit_below else y - 68
    return "\n".join([deck(x, y, 170, 96), text(x, y-14, "Portrait pavilion", 17, anchor="middle", extra='font-family="Georgia, serif"'), text(x, y+9, "Sing the whole phrase", 12, "#6b715f", "middle"), text(x, y+31, "0  /  +2  /  +4  /  +2  /  0", 13, GOLD, "middle"), f'<ellipse cx="{x}" cy="{exit_y}" rx="25" ry="15" fill="none" stroke="{GOLD}" stroke-width="4"/>', text(x+39, exit_y+4, "Exit opens", 12)])


def garden(x, y, rx, ry, label, label_offset=0):
    return "\n".join([f'<ellipse cx="{x}" cy="{y}" rx="{rx}" ry="{ry}" fill="#dae4d3" stroke="#adbe9e" stroke-width="2"/>', f'<ellipse cx="{x}" cy="{y}" rx="{rx-16}" ry="{ry-16}" fill="none" stroke="#b9c9ad" stroke-dasharray="4 8"/>', text(x, y-3+label_offset, label, 19, "#4d6b51", "middle", 'font-family="Georgia, serif"'), text(x, y+20+label_offset, "Planting + screens hide the next turn", 12, "#62795e", "middle") if rx >= 160 and label else ""])


# Current platform footprints copied from Cloudway trial + crescent centers at c4632528.
current = [
    ("Arrival", -2.6, 0, 3.4, 3.4, "stone"),
    ("Frost 1", -2.45, 3.9, 5.65, 2.4, "frost"),
    ("Frost 2", -1.85, 6.2, 7.95, 2.4, "frost"),
    ("Recovery", -1.25, 8.5, 11.4, 3.4, "stone"),
    ("Raft dock", -.72, 11.4, 13, 2.8, "stone"),
    ("Raft (origin)", -.25, 13.6, 15.2, 1.8, "stone"),
    ("Singing dock", .82, 17.65, 20.45, 2.8, "stone"),
    ("Crackle 1", 1.38, 21, 22.65, 1.8, "crackle"),
    ("Recovery", 1.88, 23.2, 25.8, 3, "stone"),
    ("Crackle 2", 2.38, 26.35, 28, 1.8, "crackle"),
    ("Finale", 2.72, 28.55, 33, 4, "stone"),
]
p = start("Current Cloudway / measured footprint", "Actual X/Z proportions. Travel is upward on this sheet; decorative overhangs are omitted.")
for name, cx, lo, hi, width, kind in current:
    x, y = 265 + cx*15, 610-(lo+hi)/2*15
    p += [deck(x, y, width*15, (hi-lo)*15, kind), text(x+width*7.5+14, y+5, name, 13)]
    if name in ("Arrival", "Singing dock", "Finale"):
        p += [f'<circle cx="{x}" cy="{y}" r="8" fill="{INK}"/>']
p += [route("M164 590V140"), text(150, 373, "+Z", 14, GOLD, "end"), text(555, 148, "What the playtest is revealing", 24, extra='font-family="Georgia, serif"')]
for i, line in enumerate([
    "11 platforms, all available before singing.",
    "Three required voice stops: the same comfortable note.",
    "Only the final portrait opens access: the exit.",
    "Crescent changes X position, not platform orientation.",
    "Frost steps: 2.40 wide x 1.75 along travel.",
    "Safe broad pads are useful; repetition is the issue.",
]):
    p.append(text(555, 195+i*40, line, 16))
p += [deck(624, 519, 105, 65, "frost"), text(704, 517, "Current frost footprint", 16), text(704, 542, "Wide landing, short forward run", 14, "#62795e")]
save("route-current", p, "Source baseline, not a new design. Same scale on X and Z; raft shown at its authored origin.")

p = start("A / The Thawing Song", "Recommended: learn a five-note phrase around a garden, then sing it to the portrait. Schematic, not to scale.")
p += [garden(530, 364, 191, 121, "The frosted garden"), route("M166 557L137 475L160 377L185 301L263 237L350 198L484 159L584 158L704 180L819 229L893 342L884 491L815 540L745 550")]
for x,y,w,h,k in [(140,478,64,82,"stone"),(153,383,83,39,"frost"),(171,326,83,39,"frost"),(277,234,90,43,"stone"),(470,163,99,42,"stone"),(709,181,80,44,"stone"),(852,282,49,77,"stone"),(895,405,52,81,"stone")]:
    p.append(deck(x,y,w,h,k))
p += [station(169,557,1,"Root / 0","Arrival goblet"), station(356,200,2,"Up / +2","Garden entry",True), station(599,158,3,"Peak / +4","Lantern vase"), station(894,346,4,"Down / +2","Pavilion entry",True), station(884,491,5,"Home / 0","Home-note goblet"), finale(654,550), text(462,539,"Final reveal",12,GOLD,"end"), text(529,629,"Look back: the learned phrase lights the route.",13,"#62795e","middle")]
save("route-thawing-song",p,"Two real barriers. Broad singing pads. Long runs and short crossing steps. No timed singing.")

p = start("B / The Switchback Conservatory", "Stronger left/right changes, with space to turn before jumping. Schematic, not to scale.")
p += [route("M159 554H360V363H734V180H968"), garden(500,520,120,59,"Lower garden"), garden(503,264,132,59,"Upper garden")]
for x,y,w,h,k in [(258,554,72,46,"stone"),(360,478,57,70,"stone"),(467,363,62,45,"frost"),(547,363,62,45,"frost"),(733,268,56,73,"stone"),(845,180,65,42,"stone")]:
    p.append(deck(x,y,w,h,k))
p += [station(145,554,1,"Root / 0","Arrival goblet"),station(360,363,2,"Up / +2","First screen",True),station(735,363,3,"Peak / +4","Upper court vase"),station(735,170,4,"Down / +2","Second screen",True),station(965,178,5,"Home / 0","Home-note goblet"),route("M965 225V425"),deck(965,292,54,76),finale(965,485,True),text(182,168,"Wide court → turn → visible landing",20,extra='font-family="Georgia, serif"'),text(182,198,"More spatial variety; more camera and wall-clearance QA.",14,"#62795e")]
save("route-switchback",p,"The phrase rises and returns; physical height is authored independently from pitch.")

p = start("C / The Braided Garden", "A safe main melody path plus one clearly optional discovery. Schematic, not to scale.")
p += [garden(529,400,186,117,"",-70),route("M153 552L218 363L343 217L570 167L806 226L920 406L851 551L725 566"),route("M571 164L450 399L609 399L806 226",True)]
for x,y,w,h,k in [(196,440,55,84,"stone"),(280,297,83,43,"frost"),(450,182,94,44,"stone"),(681,192,87,41,"stone"),(863,313,51,79,"stone"),(498,305,55,43,"crackle"),(706,322,67,43,"stone")]:
    p.append(deck(x,y,w,h,k))
p += [station(145,552,1,"Root / 0","Arrival goblet"),station(341,215,2,"Up / +2","First frost wall",True),station(571,164,3,"Peak / +4","Lantern vase"),station(807,226,4,"Down / +2","Second frost wall",True),station(920,443,5,"Home / 0","Home-note goblet"),finale(651,567),deck(532,399,137,69),text(532,394,"Optional vase",15,anchor="middle"),text(532,415,"No melody / gate key",11,"#62795e","middle"),text(446,458,"Dashed spur: one crackle step, then a safe rest.",12,"#62795e")]
save("route-braided",p,"Main route remains complete without the spur. A later variation if exploration is the preferred focus.")

p=start("Platform roles / gate readability","Concept families for the selected route. Candidate dimensions require collision, camera and device proof.")
for x,y,w,h,k in [(165,256,128,128,"stone"),(440,256,80,170,"stone"),(731,256,150,80,"frost")]:
    p.append(deck(x,y,w,h,k))
p += [text(165,160,"Singing + turn pad",19,anchor="middle",extra='font-family="Georgia, serif"'),text(440,140,"Long causeway",19,anchor="middle",extra='font-family="Georgia, serif"'),text(731,183,"Cross-step",19,anchor="middle",extra='font-family="Georgia, serif"'),route("M165 355V195"),route("M440 364V178"),route("M731 326V212"),text(931,250,"Travel",15,anchor="middle"),text(931,275,"direction",15,anchor="middle"),route("M930 224V171")]
p += [text(66,430,"A wall that is a real encounter",23,extra='font-family="Georgia, serif"'), '<path d="M100 594V491Q229 427 358 491V594" stroke="#b4a78b" stroke-width="22" fill="none"/>', '<rect x="115" y="496" width="228" height="92" rx="4" fill="url(#ice)" stroke="#548a97" stroke-width="2"/>', '<circle cx="229" cy="542" r="18" fill="#f6ead0" stroke="#ac8141" stroke-width="3"/>', '<path d="M74 598H384" stroke="#ac8141" stroke-width="5"/>',text(464,473,"Safe singing deck before the pane.",16),text(464,506,"Side returns + overhead arch prevent jumping around it.",16),text(464,539,"Gate parts share a reference, with unique runtime IDs.",16),text(464,572,"Only after that gate opens may Merc say a path opened.",16),text(464,605,"Wall elevation is a diagram; final height follows jump clearance.",12,"#62795e")]
save("platform-roles",p,"Never rotate art alone. Keep its collision, visible edges, gaps and landing space consistent.")
