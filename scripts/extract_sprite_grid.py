"""Extract and alpha-trim named cells from a regular sprite grid."""

from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--columns", type=int, required=True)
    parser.add_argument("--rows", type=int, required=True)
    parser.add_argument("--names", nargs="+", required=True)
    parser.add_argument("--padding", type=int, default=4)
    parser.add_argument("--output-width", type=int)
    parser.add_argument("--output-height", type=int)
    parser.add_argument("--anchor", choices=("center", "bottom"), default="center")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    expected = args.columns * args.rows
    if len(args.names) != expected:
        raise SystemExit(f"Expected {expected} names, received {len(args.names)}.")

    source = Image.open(args.source).convert("RGBA")
    args.output.mkdir(parents=True, exist_ok=True)
    if (args.output_width is None) != (args.output_height is None):
        raise SystemExit("--output-width and --output-height must be provided together.")

    for index, name in enumerate(args.names):
        column = index % args.columns
        row = index // args.columns
        left = round(column * source.width / args.columns)
        top = round(row * source.height / args.rows)
        right = round((column + 1) * source.width / args.columns)
        bottom = round((row + 1) * source.height / args.rows)
        cell = source.crop((left, top, right, bottom))
        if name == "-":
            continue
        alpha_box = cell.getchannel("A").getbbox()
        if alpha_box is None:
            raise SystemExit(f"Cell {index} ({name}) contains no visible pixels.")

        cropped = cell.crop(alpha_box)
        if args.output_width is not None and args.output_height is not None:
            available_width = args.output_width - args.padding * 2
            available_height = args.output_height - args.padding * 2
            if available_width <= 0 or available_height <= 0:
                raise SystemExit("Output size must be larger than twice the padding.")
            scale = min(available_width / cropped.width, available_height / cropped.height)
            resized = cropped.resize(
                (max(1, round(cropped.width * scale)), max(1, round(cropped.height * scale))),
                Image.Resampling.LANCZOS,
            )
            padded = Image.new("RGBA", (args.output_width, args.output_height), (0, 0, 0, 0))
            paste_x = (args.output_width - resized.width) // 2
            paste_y = (
                args.output_height - args.padding - resized.height
                if args.anchor == "bottom"
                else (args.output_height - resized.height) // 2
            )
            padded.alpha_composite(resized, (paste_x, paste_y))
            padded.save(args.output / f"{name}.png", optimize=True)
            print(f"{name}: {padded.width}x{padded.height}")
            continue
        padded = Image.new(
            "RGBA",
            (cropped.width + args.padding * 2, cropped.height + args.padding * 2),
            (0, 0, 0, 0),
        )
        padded.alpha_composite(cropped, (args.padding, args.padding))
        padded.save(args.output / f"{name}.png", optimize=True)
        print(f"{name}: {padded.width}x{padded.height}")


if __name__ == "__main__":
    main()
