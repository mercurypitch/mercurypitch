"""Lay out unedited generated masters as one compact Level 2 review sheet."""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


HERE = Path(__file__).resolve().parent
OUTPUT = HERE / "proofs/review-contact-sheet.png"

CONCEPTS = [
    ("Low: Amber Cadence Urn", HERE / "concepts/amber-cadence-urn.png"),
    ("High: Celadon Lark Decanter", HERE / "concepts/celadon-lark-decanter.png"),
    ("Court: Twin-Tone Resonance Harp", HERE / "concepts/twin-tone-resonance-harp.png"),
    ("Optional: Opaline Echo Amphora", HERE / "concepts/opaline-echo-amphora.png"),
]

PAINTINGS = [
    ("The Low Note Keeper", HERE / "paintings/low-note-keeper-master.png"),
    ("The High Note Muse", HERE / "paintings/high-note-muse-master.png"),
    ("The Interval Between", HERE / "paintings/interval-between-master.png"),
]


def font(size: int) -> ImageFont.ImageFont:
    path = Path("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf")
    return ImageFont.truetype(str(path), size) if path.is_file() else ImageFont.load_default()


def fit(image: Image.Image, width: int, height: int) -> Image.Image:
    copy = image.convert("RGB")
    copy.thumbnail((width, height), Image.Resampling.LANCZOS)
    return copy


def place(
    canvas: Image.Image,
    draw: ImageDraw.ImageDraw,
    label: str,
    path: Path,
    box: tuple[int, int, int, int],
) -> None:
    x, y, width, height = box
    art = fit(Image.open(path), width, height - 48)
    px = x + (width - art.width) // 2
    py = y + 40 + (height - 48 - art.height) // 2
    canvas.paste(art, (px, py))
    draw.text((x + width / 2, y + 15), label, font=font(20), fill=(236, 229, 206), anchor="mm")


def run() -> None:
    canvas = Image.new("RGB", (2200, 1820), (15, 22, 32))
    draw = ImageDraw.Draw(canvas)
    draw.text((1100, 44), "MercuryPitch Glassworks: Level 2 Twin Galleries", font=font(34), fill=(245, 239, 219), anchor="mm")
    draw.text((1100, 82), "Generated concept masters and original 2:3 gallery paintings", font=font(20), fill=(147, 182, 179), anchor="mm")

    margin = 48
    concept_gap = 20
    concept_width = (2200 - margin * 2 - concept_gap * 3) // 4
    for index, (label, path) in enumerate(CONCEPTS):
        place(canvas, draw, label, path, (margin + index * (concept_width + concept_gap), 115, concept_width, 650))

    painting_width = 460
    painting_height = 900
    painting_gap = 80
    row_width = painting_width * 3 + painting_gap * 2
    start = (2200 - row_width) // 2
    for index, (label, path) in enumerate(PAINTINGS):
        place(canvas, draw, label, path, (start + index * (painting_width + painting_gap), 830, painting_width, painting_height))

    draw.text((1100, 1780), "Layout only; source PNG pixels remain preserved in concepts/ and paintings/.", font=font(18), fill=(153, 161, 170), anchor="mm")
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(OUTPUT, format="PNG", optimize=True)


if __name__ == "__main__":
    run()
