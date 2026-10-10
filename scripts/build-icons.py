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

It also writes the dev icon, the tile in green so a `tauri dev` build is told
apart from a release at a glance: the files `bundle.icon` of
src-tauri/tauri.dev.conf.json names (apps/desktop/src-tauri/icons/dev) and
src/assets/app-icon-dev.png.
"""
import json
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
DEV_ICONS = ICONS / "dev"
DEV_DESKTOP_ASSET = ROOT / "apps/desktop/src/assets/app-icon-dev.png"
WEB = ROOT / "apps/web/public"

SIZE = 1024
# Apple's macOS icon grid: the tile is 824 of the 1024 canvas, centred.
GRID_TILE = 824
# The Windows files `tauri icon` writes; every other file follows the macOS grid.
# The dev icon: the tile's blue (OKLCH hue about 255) turned to green, its
# chroma a little lower, so the green stays in sRGB without going flat.
DEV_HUE = 155
DEV_CHROMA = 0.85
BLUE_HUE = 255
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


SRGB_TO_LMS = np.array(
    [
        [0.4122214708, 0.5363325363, 0.0514459929],
        [0.2119034982, 0.6806995451, 0.1073969566],
        [0.0883024619, 0.2817188376, 0.6299787005],
    ]
)
LMS_TO_OKLAB = np.array(
    [
        [0.2104542553, 0.7936177850, -0.0040720468],
        [1.9779984951, -2.4285922050, 0.4505937099],
        [0.0259040371, 0.7827717662, -0.8086757660],
    ]
)


def oklab_to_linear(lab: np.ndarray) -> np.ndarray:
    return (lab @ np.linalg.inv(LMS_TO_OKLAB).T) ** 3 @ np.linalg.inv(SRGB_TO_LMS).T


def green(master: Image.Image) -> Image.Image:
    """The tile in green: hue turned in OKLCH at the same lightness.

    Near-grey pixels (the white A and its shading) keep their colour; the
    turn fades in with chroma. Colours outside sRGB lose chroma until they fit.
    """
    pixels = np.asarray(master).astype(np.float64) / 255
    rgb, alpha = pixels[..., :3], pixels[..., 3:]
    linear = np.where(rgb <= 0.04045, rgb / 12.92, ((rgb + 0.055) / 1.055) ** 2.4)
    lab = np.cbrt(linear @ SRGB_TO_LMS.T) @ LMS_TO_OKLAB.T
    lightness = lab[..., 0]
    chroma = np.hypot(lab[..., 1], lab[..., 2])
    weight = np.clip((chroma - 0.02) / 0.04, 0, 1)
    weight = weight * weight * (3 - 2 * weight)
    hue = np.arctan2(lab[..., 2], lab[..., 1]) + weight * np.deg2rad(DEV_HUE - BLUE_HUE)
    chroma = chroma * (1 + weight * (DEV_CHROMA - 1))

    def to_linear(c: np.ndarray) -> np.ndarray:
        return oklab_to_linear(np.stack([lightness, c * np.cos(hue), c * np.sin(hue)], -1))

    def in_gamut(c: np.ndarray) -> np.ndarray:
        out = to_linear(c)
        return np.all((out >= -1e-6) & (out <= 1 + 1e-6), -1)

    low, high = np.zeros_like(chroma), chroma.copy()
    for _ in range(20):
        mid = (low + high) / 2
        fits = in_gamut(mid)
        low, high = np.where(fits, mid, low), np.where(fits, high, mid)
    chroma = np.where(in_gamut(chroma), chroma, low)

    linear = np.clip(to_linear(chroma), 0, 1)
    rgb = np.where(linear <= 0.0031308, linear * 12.92, 1.055 * linear ** (1 / 2.4) - 0.055)
    out = np.concatenate([rgb, alpha], -1) * 255
    return Image.fromarray(np.clip(out + 0.5, 0, 255).astype(np.uint8), "RGBA")


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


def tauri_icons(master: Image.Image, icons: Path, names: list[str]) -> None:
    with tempfile.TemporaryDirectory() as tmp:
        grid, bleed = Path(tmp, "grid"), Path(tmp, "bleed")
        grid.mkdir()
        bleed.mkdir()
        tauri_icon(on_grid(master), grid)
        tauri_icon(master, bleed)
        icons.mkdir(parents=True, exist_ok=True)
        for name in sorted(names):
            source = bleed if name in WINDOWS_FILES else grid
            shutil.copyfile(source / "icons" / name, icons / name)
    print(f"wrote {len(names)} files in {icons.relative_to(ROOT)}")


def build() -> None:
    master = Image.open(MASTER).convert("RGBA")
    # Only the files the app already ships: `tauri icon` also writes the
    # iOS and Android sets, which this app has no use for.
    tauri_icons(master, ICONS, [f.name for f in ICONS.iterdir() if f.is_file()])
    dev = green(master)
    dev_config = json.loads((ICONS.parent / "tauri.dev.conf.json").read_text())
    tauri_icons(dev, DEV_ICONS, [Path(icon).name for icon in dev_config["bundle"]["icon"]])

    outputs = {
        DESKTOP_ASSET: resized(master, 256),
        DEV_DESKTOP_ASSET: resized(dev, 256),
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
