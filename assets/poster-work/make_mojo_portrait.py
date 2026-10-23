# -*- coding: utf-8 -*-
"""Crop landscape MOJO FAMILY work photo to clean 3:4 Xiaohongshu portrait."""
from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image, ImageEnhance, ImageFilter

SRC = Path(__file__).with_name("src-mojo-family-landscape.png")
OUT = Path(__file__).with_name("beanland-xhs-mojo-family-3x4.png")


def main() -> None:
    im = Image.open(SRC).convert("RGB")
    w, h = im.size  # 1024 x 576

    # Tighter around heat-press plate (~229-725), shave desk/shelf leftovers
    left, right = 235, 710
    crop = im.crop((left, 0, right, h))
    cw, ch = crop.size

    tw, th = 1080, 1440  # exact 3:4

    # Scale so the press+art block fills ~92% of canvas height (hero-forward)
    target_h = int(th * 0.92)
    scale = target_h / ch
    nw, nh = int(cw * scale), int(ch * scale)
    # If wider than canvas, fit to width instead
    if nw > tw:
        scale = tw / cw
        nw, nh = int(cw * scale), int(ch * scale)
    resized = crop.resize((nw, nh), Image.Resampling.LANCZOS)

    # Studio fill: sample top plate whites + soft cream (no wood floor)
    top_sample = np.array(resized.crop((nw // 4, 0, nw * 3 // 4, 12))).mean(axis=(0, 1))
    fill_top = tuple(
        int(x)
        for x in np.clip(top_sample * 0.25 + np.array([248, 246, 242]) * 0.75, 0, 255)
    )
    fill_bot = (242, 239, 234)

    yy = np.linspace(0, 1, th)[:, None]
    grad = (1 - yy) * np.array(fill_top) + yy * np.array(fill_bot)
    bg = Image.fromarray(
        np.broadcast_to(grad[:, None, :], (th, tw, 3)).astype(np.uint8)
    )

    paste_x = (tw - nw) // 2
    paste_y = (th - nh) // 2

    # Mild side feather only — avoid dreamy white halo
    mask = np.ones((nh, nw), dtype=np.float32)
    feather = max(6, nw // 60)
    for i in range(feather):
        a = (i + 1) / feather
        # ease-in so edge softens into bg without milky wash
        a = a * a
        mask[:, i] *= a
        mask[:, nw - 1 - i] *= a

    base_arr = np.array(bg, dtype=np.float32)
    out_arr = base_arr.copy()
    src_arr = np.array(resized, dtype=np.float32)
    y0, y1 = paste_y, paste_y + nh
    x0, x1 = paste_x, paste_x + nw
    region = out_arr[y0:y1, x0:x1]
    m = mask[..., None]
    out_arr[y0:y1, x0:x1] = src_arr * m + region * (1 - m)
    out = Image.fromarray(np.clip(out_arr, 0, 255).astype(np.uint8))

    # Very light vignette — keep eyes on beads, not muddy corners
    vig = np.array(out, dtype=np.float32)
    yy, xx = np.mgrid[0:th, 0:tw]
    cx, cy = tw / 2.0, paste_y + nh * 0.50
    rx, ry = tw * 0.78, th * 0.70
    r = ((xx - cx) / rx) ** 2 + ((yy - cy) / ry) ** 2
    vignette = np.clip(1.0 - 0.08 * np.clip(r - 0.65, 0, None), 0.92, 1.0)
    vig *= vignette[..., None]
    out = Image.fromarray(np.clip(vig, 0, 255).astype(np.uint8))

    out = ImageEnhance.Contrast(out).enhance(1.03)
    out = ImageEnhance.Color(out).enhance(1.04)
    out = out.filter(ImageFilter.UnsharpMask(radius=1.2, percent=60, threshold=3))
    out.save(OUT, quality=95)
    print("saved", OUT, out.size, "ratio", round(out.width / out.height, 4))
    print("block", nw, nh, "paste", paste_x, paste_y)


if __name__ == "__main__":
    main()
