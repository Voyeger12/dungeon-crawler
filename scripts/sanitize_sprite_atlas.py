"""Repack loosely generated character grids into isolated, padded atlas cells.

Image generators place rows and columns visually, but not necessarily on exact
mathematical grid boundaries. Rendering such an image as a regular atlas can
therefore sample a hand, weapon, or shadow from the neighbouring pose. This
script detects the real row bands, separates connected alpha components, assigns
them to the nearest authored direction, and repacks every frame into a clean
fixed-size cell.
"""

from __future__ import annotations

import argparse
from dataclasses import dataclass
from pathlib import Path

import numpy as np
from PIL import Image


@dataclass
class Component:
    area: int = 0
    sum_x: float = 0
    sum_y: float = 0
    left: int = 1 << 30
    top: int = 1 << 30
    right: int = -1
    bottom: int = -1

    @property
    def center_x(self) -> float:
        return self.sum_x / self.area


@dataclass
class Frame:
    image: Image.Image
    left: int
    top: int
    right: int
    bottom: int
    anchor_x: float
    anchor_y: float


class DisjointSet:
    def __init__(self) -> None:
        self.parent: list[int] = []

    def create(self) -> int:
        label = len(self.parent)
        self.parent.append(label)
        return label

    def find(self, label: int) -> int:
        root = label
        while self.parent[root] != root:
            root = self.parent[root]
        while self.parent[label] != label:
            parent = self.parent[label]
            self.parent[label] = root
            label = parent
        return root

    def union(self, first: int, second: int) -> None:
        first_root = self.find(first)
        second_root = self.find(second)
        if first_root != second_root:
            self.parent[second_root] = first_root


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--columns", type=int, default=5)
    parser.add_argument("--rows", type=int, default=7)
    parser.add_argument("--cell-width", type=int, default=320)
    parser.add_argument("--cell-height", type=int, default=256)
    parser.add_argument("--padding", type=int, default=12)
    parser.add_argument("--alpha-threshold", type=int, default=12)
    parser.add_argument("--minimum-component-area", type=int, default=8)
    return parser.parse_args()


def intervals(values: np.ndarray) -> list[tuple[int, int]]:
    indexes = np.flatnonzero(values)
    if indexes.size == 0:
        return []
    cuts = np.flatnonzero(np.diff(indexes) > 1)
    starts = np.concatenate(([indexes[0]], indexes[cuts + 1]))
    ends = np.concatenate((indexes[cuts], [indexes[-1]]))
    return [(int(start), int(end)) for start, end in zip(starts, ends)]


def detect_row_bands(alpha: np.ndarray, rows: int, threshold: int) -> list[tuple[int, int]]:
    nominal_height = alpha.shape[0] / rows
    bands = [
        band
        for band in intervals((alpha > threshold).sum(axis=1) >= 8)
        if band[1] - band[0] + 1 >= nominal_height * .18
    ]
    if len(bands) != rows:
        raise SystemExit(f"Expected {rows} visible row bands, detected {len(bands)}: {bands}")
    return bands


def row_regions(bands: list[tuple[int, int]], height: int) -> list[tuple[int, int]]:
    boundaries = [0]
    for previous, following in zip(bands, bands[1:]):
        boundaries.append((previous[1] + following[0]) // 2 + 1)
    boundaries.append(height)
    return list(zip(boundaries, boundaries[1:]))


def connected_runs(mask: np.ndarray) -> tuple[list[tuple[int, int, int, int]], DisjointSet]:
    """Return (y, x0, x1, label) runs joined with 8-neighbour connectivity."""
    disjoint = DisjointSet()
    all_runs: list[tuple[int, int, int, int]] = []
    previous: list[tuple[int, int, int]] = []

    for y, row in enumerate(mask):
        row_indexes = np.flatnonzero(row)
        current: list[tuple[int, int, int]] = []
        if row_indexes.size:
            cuts = np.flatnonzero(np.diff(row_indexes) > 1)
            starts = np.concatenate(([row_indexes[0]], row_indexes[cuts + 1]))
            ends = np.concatenate((row_indexes[cuts], [row_indexes[-1]]))
            for start_value, end_value in zip(starts, ends):
                start = int(start_value)
                end = int(end_value)
                label = disjoint.create()
                for previous_start, previous_end, previous_label in previous:
                    if previous_end < start - 1:
                        continue
                    if previous_start > end + 1:
                        break
                    disjoint.union(label, previous_label)
                current.append((start, end, label))
                all_runs.append((y, start, end, label))
        previous = current
    return all_runs, disjoint


def component_stats(
    runs: list[tuple[int, int, int, int]],
    disjoint: DisjointSet,
    y_offset: int,
) -> dict[int, Component]:
    components: dict[int, Component] = {}
    for y, start, end, label in runs:
        root = disjoint.find(label)
        length = end - start + 1
        component = components.setdefault(root, Component())
        component.area += length
        component.sum_x += length * (start + end) / 2
        component.sum_y += length * (y + y_offset)
        component.left = min(component.left, start)
        component.right = max(component.right, end)
        component.top = min(component.top, y + y_offset)
        component.bottom = max(component.bottom, y + y_offset)
    return components


def dilate(mask: np.ndarray, iterations: int = 2) -> np.ndarray:
    result = mask.copy()
    for _ in range(iterations):
        padded = np.pad(result, 1, mode="constant")
        expanded = np.zeros_like(result)
        for offset_y in range(3):
            for offset_x in range(3):
                expanded |= padded[
                    offset_y : offset_y + result.shape[0],
                    offset_x : offset_x + result.shape[1],
                ]
        result = expanded
    return result


def extract_frames(
    pixels: np.ndarray,
    bands: list[tuple[int, int]],
    regions: list[tuple[int, int]],
    columns: int,
    threshold: int,
    minimum_area: int,
) -> list[Frame]:
    height, width = pixels.shape[:2]
    alpha = pixels[:, :, 3]
    column_centers = [(column + .5) * width / columns for column in range(columns)]
    frames: list[Frame] = []

    for row, ((region_top, region_bottom), (_, band_bottom)) in enumerate(zip(regions, bands)):
        region_alpha = alpha[region_top:region_bottom]
        runs, disjoint = connected_runs(region_alpha > threshold)
        components = component_stats(runs, disjoint, region_top)
        assignments: dict[int, int] = {}
        for root, component in components.items():
            if component.area >= minimum_area:
                assignments[root] = min(
                    range(columns),
                    key=lambda column: abs(component.center_x - column_centers[column]),
                )

        roots_by_column = [
            {root for root, column in assignments.items() if column == expected_column}
            for expected_column in range(columns)
        ]
        run_roots = [(y, start, end, disjoint.find(label)) for y, start, end, label in runs]

        for column, accepted_roots in enumerate(roots_by_column):
            component_mask = np.zeros_like(region_alpha, dtype=bool)
            for y, start, end, root in run_roots:
                if root in accepted_roots:
                    component_mask[y, start : end + 1] = True
            component_mask = dilate(component_mask) & (region_alpha > 0)
            visible_y, visible_x = np.where(component_mask)
            if visible_x.size == 0:
                raise SystemExit(f"Frame row {row}, column {column} contains no retained pixels.")

            left = int(visible_x.min())
            right = int(visible_x.max())
            local_top = int(visible_y.min())
            local_bottom = int(visible_y.max())
            top = region_top + local_top
            bottom = region_top + local_bottom
            isolated = np.zeros((local_bottom - local_top + 1, right - left + 1, 4), dtype=np.uint8)
            source_crop = pixels[top : bottom + 1, left : right + 1]
            crop_mask = component_mask[local_top : local_bottom + 1, left : right + 1]
            isolated[crop_mask] = source_crop[crop_mask]
            frames.append(
                Frame(
                    image=Image.fromarray(isolated, "RGBA"),
                    left=left,
                    top=top,
                    right=right,
                    bottom=bottom,
                    anchor_x=column_centers[column],
                    anchor_y=band_bottom,
                )
            )
    return frames


def repack(
    frames: list[Frame],
    columns: int,
    rows: int,
    cell_width: int,
    cell_height: int,
    padding: int,
) -> Image.Image:
    if len(frames) != columns * rows:
        raise SystemExit(f"Expected {columns * rows} frames, received {len(frames)}.")

    horizontal_extent = max(
        max(frame.anchor_x - frame.left, frame.right - frame.anchor_x)
        for frame in frames
    )
    vertical_extent = max(frame.anchor_y - frame.top for frame in frames)
    scale = min(
        (cell_width / 2 - padding) / max(1, horizontal_extent),
        (cell_height - padding * 2) / max(1, vertical_extent),
    )

    atlas = Image.new(
        "RGBA",
        (columns * cell_width, rows * cell_height),
        (0, 0, 0, 0),
    )
    for index, frame in enumerate(frames):
        column = index % columns
        row = index // columns
        resized_width = max(1, round(frame.image.width * scale))
        resized_height = max(1, round(frame.image.height * scale))
        resized = frame.image.resize((resized_width, resized_height), Image.Resampling.LANCZOS)
        destination_x = round(
            column * cell_width
            + cell_width / 2
            + (frame.left - frame.anchor_x) * scale
        )
        destination_y = round(
            row * cell_height
            + cell_height
            - padding
            + (frame.top - frame.anchor_y) * scale
        )
        atlas.alpha_composite(resized, (destination_x, destination_y))

    print(f"Repacked {len(frames)} isolated frames at global scale {scale:.3f}.")
    return atlas


def main() -> None:
    args = parse_args()
    source = Image.open(args.source).convert("RGBA")
    pixels = np.asarray(source)
    bands = detect_row_bands(pixels[:, :, 3], args.rows, args.alpha_threshold)
    regions = row_regions(bands, source.height)
    frames = extract_frames(
        pixels,
        bands,
        regions,
        args.columns,
        args.alpha_threshold,
        args.minimum_component_area,
    )
    atlas = repack(
        frames,
        args.columns,
        args.rows,
        args.cell_width,
        args.cell_height,
        args.padding,
    )
    args.output.parent.mkdir(parents=True, exist_ok=True)
    atlas.save(args.output, optimize=True)
    print(f"Wrote {args.output} ({atlas.width}x{atlas.height}).")


if __name__ == "__main__":
    main()
