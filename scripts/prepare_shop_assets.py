from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image


ITEM_NAMES = (
    "grave-iron-longsword",
    "ashfang",
    "patched-wolf-leather",
    "soot-chainmail",
)


def fit_transparent(image: Image.Image, size: tuple[int, int], padding: int) -> Image.Image:
    alpha = image.getchannel("A")
    bounds = alpha.getbbox()
    if bounds is None:
        raise ValueError("asset cell contains no visible pixels")
    cropped = image.crop(bounds)
    available = (size[0] - padding * 2, size[1] - padding * 2)
    cropped.thumbnail(available, Image.Resampling.LANCZOS)
    result = Image.new("RGBA", size)
    offset = ((size[0] - cropped.width) // 2, (size[1] - cropped.height) // 2)
    result.alpha_composite(cropped, offset)
    return result


def main() -> None:
    parser = argparse.ArgumentParser(description="Split and normalize the generated Lydia shop item sheet.")
    parser.add_argument("sheet", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--size", type=int, default=384)
    args = parser.parse_args()

    sheet = Image.open(args.sheet).convert("RGBA")
    args.output.mkdir(parents=True, exist_ok=True)
    cell_width = sheet.width // 2
    cell_height = sheet.height // 2

    for index, name in enumerate(ITEM_NAMES):
        column = index % 2
        row = index // 2
        cell = sheet.crop((
            column * cell_width,
            row * cell_height,
            (column + 1) * cell_width,
            (row + 1) * cell_height,
        ))
        normalized = fit_transparent(cell, (args.size, args.size), max(20, args.size // 14))
        normalized.save(args.output / f"{name}.png", optimize=True)


if __name__ == "__main__":
    main()
