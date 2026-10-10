#!/usr/bin/env python3
"""Builds every app icon from the icon master.

    uv run --with pillow --with numpy --with scipy python scripts/build-icons.py
    uv run --with pillow --with numpy --with scipy python scripts/build-icons.py --clean <logo.png>

The master (apps/desktop/src-tauri/icons/source/angaria-icon.png) is the blue
tile alone: 1024x1024, the tile touching all four edges, its corners
transparent. `--clean` makes it from a raw export first: it drops the faint
stray pixels left around the tile, makes the tile fully opaque (the export
has it at 98%), and squares the tile, which the export draws a little wider
than tall.

From the master it writes:

- the Tauri icons (apps/desktop/src-tauri/icons) through `tauri icon`: the
  macOS and Linux ones on Apple's icon grid (the tile 824 of 1024, centred),
  the Windows ones full-bleed, as Windows draws them;
- the icon the desktop app shows in its own screens (src/assets/app-icon.png);
- the site's favicon, manifest icons and app icon (apps/web/public), and the
  apple-touch-icon, which iOS rounds itself, so it is a full square: the tile
  scaled up, its rim cut off and its blue carried out to the edges.
"""
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = Path(__file__).resolve().parent.parent
ICONS = ROOT / "apps/desktop/src-tauri/icons"
MASTER = ICONS / "source/angaria-icon.png"
DESKTOP_ASSET = ROOT / "apps/desktop/src/assets/app-icon.png"
WEB = ROOT / "apps/web/public"

SIZE = 1024
# Apple's macOS icon grid: the tile is 824 of the 1024 canvas, centred.
GRID_TILE = 824
# The Windows files `tauri icon` writes; every other file follows the macOS grid.
WINDOWS_FILES = ["icon.ico", "StoreLogo.png", *(f.name for f in ICONS.glob("Square*Logo.png"))]


def clean(raw_path: Path) -> None:
    raw = np.asarray(Image.open(raw_path).convert("RGBA")).astype(np.float32)
    alpha = raw[..., 3]
    # The tile is the largest blob of clearly visible pixels. Anything more
    # than 2px outside it is residue of the export's background removal.
    labels, _ = ndimage.label(alpha > 16)
    sizes = np.bincount(labels.ravel())
    sizes[0] = 0
    tile = ndimage.binary_fill_holes(labels == sizes.argmax())
    near = ndimage.distance_transform_edt(~tile) <= 2
    alpha = np.where(near, alpha, 0)
    # Inside, everything 2px past the anti-aliased edge is opaque.
    inner = ndimage.distance_transform_edt(alpha >= 240) > 2
    alpha = np.where(inner, 255, alpha)
    rgba = raw.copy()
    rgba[..., 3] = alpha
    rgba[alpha == 0] = 0

    ys, xs = np.where(alpha > 0)
    box = (xs.min(), ys.min(), xs.max() + 1, ys.max() + 1)
    image = Image.fromarray(np.clip(rgba + 0.5, 0, 255).astype(np.uint8), "RGBA")
    # Resampled in premultiplied form, so the transparent pixels around the
    # edge carry no colour into it.
    master = image.convert("RGBa").resize((SIZE, SIZE), Image.LANCZOS, box=box).convert("RGBA")
    MASTER.parent.mkdir(parents=True, exist_ok=True)
    master.save(MASTER, optimize=True)
    print(f"wrote {MASTER.relative_to(ROOT)} from {raw_path}")


def resized(image: Image.Image, size: int) -> Image.Image:
    return image.convert("RGBa").resize((size, size), Image.LANCZOS).convert("RGBA")


def on_grid(master: Image.Image) -> Image.Image:
    canvas = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    offset = (SIZE - GRID_TILE) // 2
    canvas.alpha_composite(resized(master, GRID_TILE), (offset, offset))
    return canvas


def full_square(master: Image.Image, size: int) -> Image.Image:
    """The tile filling a square: rim cut off, blue carried out to the corners."""
    work = 2048
    pixels = np.asarray(resized(master, work)).astype(np.float32)
    rgb, alpha = pixels[..., :3], pixels[..., 3]
    keep = ndimage.distance_transform_edt(alpha > 250) > 0.03 * work
    dist, nearest = ndimage.distance_transform_edt(~keep, return_indices=True)
    fill = rgb[nearest[0], nearest[1]]
    soft = np.stack([ndimage.gaussian_filter(fill[..., c], work * 0.02) for c in range(3)], -1)
    weight = np.clip(dist / (work * 0.03), 0, 1)[..., None]
    weight = weight * weight * (3 - 2 * weight)
    out = np.where(keep[..., None], rgb, fill * (1 - weight) + soft * weight)
    # Scaled up a little, so the cut rim leaves the frame.
    image = Image.fromarray(np.clip(out + 0.5, 0, 255).astype(np.uint8), "RGB")
    inset = work * 0.03
    return image.resize((size, size), Image.LANCZOS, box=(inset, inset, work - inset, work - inset))


def tauri_icon(source: Image.Image, out: Path) -> None:
    src = out / "source.png"
    source.save(src)
    result = subprocess.run(
        ["pnpm", "--filter", "desktop", "exec", "tauri", "icon", str(src), "-o", str(out / "icons")],
        capture_output=True,
        cwd=ROOT,
        text=True,
    )
    if result.returncode != 0:
        sys.exit(f"tauri icon failed:\n{result.stdout}{result.stderr}")


def build() -> None:
    master = Image.open(MASTER).convert("RGBA")
    existing = {f.name for f in ICONS.iterdir() if f.is_file()}
    with tempfile.TemporaryDirectory() as tmp:
        grid, bleed = Path(tmp, "grid"), Path(tmp, "bleed")
        grid.mkdir()
        bleed.mkdir()
        tauri_icon(on_grid(master), grid)
        tauri_icon(master, bleed)
        # Only the files the app already ships: `tauri icon` also writes the
        # iOS and Android sets, which this app has no use for.
        for name in sorted(existing):
            source = bleed if name in WINDOWS_FILES else grid
            shutil.copyfile(source / "icons" / name, ICONS / name)
    print(f"wrote {len(existing)} files in {ICONS.relative_to(ROOT)}")

    outputs = {
        DESKTOP_ASSET: resized(master, 256),
        WEB / "favicon.png": resized(master, 32),
        WEB / "icon-192.png": resized(master, 192),
        WEB / "icon-512.png": resized(master, 512),
        WEB / "app-icon.png": resized(master, 256),
        WEB / "apple-touch-icon.png": full_square(master, 180),
    }
    for path, image in outputs.items():
        path.parent.mkdir(parents=True, exist_ok=True)
        image.save(path, optimize=True)
        print(f"wrote {path.relative_to(ROOT)} ({image.width}x{image.height})")


if __name__ == "__main__":
    if len(sys.argv) == 3 and sys.argv[1] == "--clean":
        clean(Path(sys.argv[2]).expanduser())
    elif len(sys.argv) != 1:
        sys.exit(__doc__)
    build()
