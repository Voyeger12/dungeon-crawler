from pathlib import Path
from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "public/assets/branding/runedeep-crest.png"
OUTPUTS = {
    ROOT / "public/assets/branding/runedeep-mark-256.png": 256,
    ROOT / "public/assets/branding/runedeep-mark-64.png": 64,
}


def fitted_mark(image: Image.Image, size: int) -> Image.Image:
    alpha_box = image.getchannel("A").getbbox()
    if not alpha_box:
        raise ValueError("The Runedeep crest contains no visible pixels.")
    subject = image.crop(alpha_box)
    padding = max(4, round(size * 0.07))
    available = size - padding * 2
    subject.thumbnail((available, available), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    canvas.alpha_composite(subject, ((size - subject.width) // 2, (size - subject.height) // 2))
    return canvas


def main() -> None:
    crest = Image.open(SOURCE).convert("RGBA")
    for output, size in OUTPUTS.items():
        output.parent.mkdir(parents=True, exist_ok=True)
        fitted_mark(crest, size).save(output, optimize=True)
        print(f"Wrote {output.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
