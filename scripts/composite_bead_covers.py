"""True cutout of real perler pieces onto Bean Land store photos."""
from __future__ import annotations

from pathlib import Path

import cv2
import numpy as np
from PIL import Image

ASSETS = Path(r"C:\Users\ry\.cursor\projects\c-Users-ry-Desktop-Bean-Bean\assets")
OUT = ASSETS / "cutout-composites"
OUT.mkdir(parents=True, exist_ok=True)

STORE = ASSETS / (
    "c__Users_ry_AppData_Roaming_Cursor_User_workspaceStorage_"
    "5c36bb28dfe1c13d244746542a77739f_images_"
    "47c9f1fdaff0af0f6189ced49b6533d9-c92ac09e-b23c-4d1f-9187-8dc1da80c202.png"
)
WINDOW = ASSETS / (
    "c__Users_ry_AppData_Roaming_Cursor_User_workspaceStorage_"
    "5c36bb28dfe1c13d244746542a77739f_images_"
    "d872e68aa97c0648a4b0a62ecbbf8e95-4596191d-e9aa-4c82-ae47-4f44dba54209.png"
)

PRODUCTS = {
    "kitty-witch": ASSETS
    / (
        "c__Users_ry_AppData_Roaming_Cursor_User_workspaceStorage_"
        "5c36bb28dfe1c13d244746542a77739f_images_"
        "image-93808d72-50f0-4045-936e-743bc1921373.png"
    ),
    "st-set": ASSETS
    / (
        "c__Users_ry_AppData_Roaming_Cursor_User_workspaceStorage_"
        "5c36bb28dfe1c13d244746542a77739f_images_"
        "image-a3089faa-e5e2-4b1d-bbad-2ed2425d7c11.png"
    ),
    "bag-girl": ASSETS
    / (
        "c__Users_ry_AppData_Roaming_Cursor_User_workspaceStorage_"
        "5c36bb28dfe1c13d244746542a77739f_images_"
        "image-9915021e-868a-4a6c-804f-ad49da6fdb40.png"
    ),
    "shinchan": ASSETS
    / (
        "c__Users_ry_AppData_Roaming_Cursor_User_workspaceStorage_"
        "5c36bb28dfe1c13d244746542a77739f_images_"
        "image-d46011dc-68a2-44b4-9ef9-ec4f6e700508.png"
    ),
}


def load_bgr(path: Path) -> np.ndarray:
    data = np.fromfile(str(path), dtype=np.uint8)
    img = cv2.imdecode(data, cv2.IMREAD_COLOR)
    if img is None:
        raise RuntimeError(f"cannot read {path}")
    return img


def save_png(path: Path, bgr_or_bgra: np.ndarray) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if bgr_or_bgra.ndim == 2:
        ok, buf = cv2.imencode(".png", bgr_or_bgra)
    elif bgr_or_bgra.shape[2] == 4:
        ok, buf = cv2.imencode(".png", bgr_or_bgra)
    else:
        ok, buf = cv2.imencode(".png", bgr_or_bgra)
    if not ok:
        raise RuntimeError(f"encode failed {path}")
    buf.tofile(str(path))


def square_crop_center(bgr: np.ndarray, size: int = 1080) -> np.ndarray:
    h, w = bgr.shape[:2]
    side = min(h, w)
    y0 = (h - side) // 2
    x0 = (w - side) // 2
    crop = bgr[y0 : y0 + side, x0 : x0 + side]
    return cv2.resize(crop, (size, size), interpolation=cv2.INTER_AREA)


def table_focus_crop(bgr: np.ndarray, size: int = 1080) -> np.ndarray:
    h, w = bgr.shape[:2]
    region = bgr[int(h * 0.22) : int(h * 0.90), int(w * 0.10) : int(w * 0.90)]
    return square_crop_center(region, size)


def flood_bg_mask(bgr: np.ndarray, tol: int = 22) -> np.ndarray:
    """Mark background by flooding from image borders."""
    h, w = bgr.shape[:2]
    flood_img = bgr.copy()
    mask = np.zeros((h + 2, w + 2), np.uint8)
    flags = 4 | cv2.FLOODFILL_MASK_ONLY | (255 << 8)
    seeds = []
    step = max(8, min(h, w) // 40)
    for x in range(0, w, step):
        seeds.append((x, 0))
        seeds.append((x, h - 1))
    for y in range(0, h, step):
        seeds.append((0, y))
        seeds.append((w - 1, y))
    for x, y in seeds:
        if mask[y + 1, x + 1] != 0:
            continue
        cv2.floodFill(
            flood_img,
            mask,
            (x, y),
            (0, 0, 0),
            loDiff=(tol, tol, tol),
            upDiff=(tol, tol, tol),
            flags=flags,
        )
    bg = mask[1:-1, 1:-1] == 255
    return bg


def grabcut_refine(bgr: np.ndarray, fg_hint: np.ndarray) -> np.ndarray:
    h, w = bgr.shape[:2]
    gc = np.full((h, w), cv2.GC_PR_BGD, np.uint8)
    gc[fg_hint] = cv2.GC_PR_FGD
    # Sure background: outer 3% border + flood bg
    border = max(4, int(min(h, w) * 0.03))
    gc[:border, :] = cv2.GC_BGD
    gc[-border:, :] = cv2.GC_BGD
    gc[:, :border] = cv2.GC_BGD
    gc[:, -border:] = cv2.GC_BGD
    bg_flood = flood_bg_mask(bgr, tol=20)
    gc[bg_flood] = cv2.GC_BGD
    # Sure foreground: eroded fg hint core
    core = cv2.erode(fg_hint.astype(np.uint8), np.ones((7, 7), np.uint8), iterations=2)
    gc[core > 0] = cv2.GC_FGD
    bgd = np.zeros((1, 65), np.float64)
    fgd = np.zeros((1, 65), np.float64)
    try:
        cv2.grabCut(bgr, gc, None, bgd, fgd, 4, cv2.GC_INIT_WITH_MASK)
    except cv2.error:
        return fg_hint
    return (gc == cv2.GC_FGD) | (gc == cv2.GC_PR_FGD)


def remove_hand_bottom(alpha: np.ndarray, bgr: np.ndarray) -> np.ndarray:
    """Drop bottom skin/hand blobs common in handheld shots."""
    h, w = alpha.shape
    hsv = cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV)
    # Rough skin / warm hand range
    skin = (
        (hsv[:, :, 0] <= 25)
        & (hsv[:, :, 1] >= 20)
        & (hsv[:, :, 1] <= 180)
        & (hsv[:, :, 2] >= 60)
        & (hsv[:, :, 2] <= 230)
    )
    bottom = np.zeros_like(alpha, dtype=bool)
    bottom[int(h * 0.78) :, :] = True
    drop = skin & bottom & (alpha > 0)
    # Only drop if connected to bottom edge
    drop_u8 = drop.astype(np.uint8)
    num, labels, stats, _ = cv2.connectedComponentsWithStats(drop_u8, 8)
    out = alpha.copy()
    for i in range(1, num):
        ys = np.where(labels == i)[0]
        if ys.max() >= h - 3:
            out[labels == i] = 0
    return out


def largest_components(mask: np.ndarray, keep: int = 10, min_area: int = 600) -> np.ndarray:
    num, labels, stats, _ = cv2.connectedComponentsWithStats(mask.astype(np.uint8), 8)
    order = sorted(range(1, num), key=lambda i: stats[i, cv2.CC_STAT_AREA], reverse=True)
    out = np.zeros_like(mask, dtype=np.uint8)
    taken = 0
    for i in order:
        if stats[i, cv2.CC_STAT_AREA] < min_area:
            break
        out[labels == i] = 255
        taken += 1
        if taken >= keep:
            break
    return out


def cutout(path: Path, mode: str) -> np.ndarray:
    bgr = load_bgr(path)
    h, w = bgr.shape[:2]

    if mode == "fabric":
        # Cream fabric: flood + keep colorful/dark bead blobs
        bg = flood_bg_mask(bgr, tol=16)
        fg = ~bg
        # Also remove near-white/cream leftover
        lab = cv2.cvtColor(bgr, cv2.COLOR_BGR2LAB)
        cream = (lab[:, :, 0] > 170) & (np.abs(lab[:, :, 1].astype(int) - 128) < 12)
        fg = fg & ~cream
        fg = grabcut_refine(bgr, fg)
        alpha = largest_components(fg, keep=12, min_area=500)
    elif mode == "wood":
        # Dark wood: flood from borders (wood is continuous from edges).
        # Do NOT color-kill light beige speech bubbles on the bead piece.
        bg = flood_bg_mask(bgr, tol=26)
        bg = bg | flood_bg_mask(bgr, tol=36)
        hsv = cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV)
        # Only mark saturated mid-tone brown near borders as extra wood
        border = np.zeros((h, w), dtype=bool)
        m = max(10, int(min(h, w) * 0.12))
        border[:m, :] = True
        border[-m:, :] = True
        border[:, :m] = True
        border[:, -m:] = True
        wood_edge = (
            border
            & (hsv[:, :, 0] >= 5)
            & (hsv[:, :, 0] <= 30)
            & (hsv[:, :, 1] >= 35)
            & (hsv[:, :, 2] >= 35)
            & (hsv[:, :, 2] <= 150)
        )
        bg = bg | wood_edge
        fg = ~bg
        fg = grabcut_refine(bgr, fg)
        alpha = largest_components(fg, keep=2, min_area=3000)
    else:
        # wall / handheld
        bg = flood_bg_mask(bgr, tol=18)
        # Extra pass with looser tol for soft wall
        bg2 = flood_bg_mask(bgr, tol=30)
        # Only expand bg where still bright/neutral
        hsv = cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV)
        neutral = (hsv[:, :, 1] < 45) & (hsv[:, :, 2] > 140)
        bg = bg | (bg2 & neutral)
        fg = ~bg
        fg = grabcut_refine(bgr, fg)
        alpha = largest_components(fg, keep=4, min_area=1500)
        alpha = remove_hand_bottom(alpha, bgr)

    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
    alpha = cv2.morphologyEx(alpha, cv2.MORPH_OPEN, kernel)
    alpha = cv2.morphologyEx(alpha, cv2.MORPH_CLOSE, kernel)
    # Feather
    alpha_f = cv2.GaussianBlur(alpha, (3, 3), 0)

    bgra = cv2.cvtColor(bgr, cv2.COLOR_BGR2BGRA)
    bgra[:, :, 3] = alpha_f
    # Trim
    ys, xs = np.where(alpha_f > 15)
    if len(xs):
        pad = 6
        y0, y1 = max(0, ys.min() - pad), min(h, ys.max() + pad)
        x0, x1 = max(0, xs.min() - pad), min(w, xs.max() + pad)
        bgra = bgra[y0:y1, x0:x1]
    return bgra


def paste_rgba(
    base_bgr: np.ndarray,
    overlay_bgra: np.ndarray,
    center_xy: tuple[int, int],
    max_w_ratio: float,
    max_h_ratio: float,
) -> np.ndarray:
    bh, bw = base_bgr.shape[:2]
    oh, ow = overlay_bgra.shape[:2]
    scale = min((bw * max_w_ratio) / ow, (bh * max_h_ratio) / oh)
    nw, nh = max(1, int(ow * scale)), max(1, int(oh * scale))
    overlay = cv2.resize(overlay_bgra, (nw, nh), interpolation=cv2.INTER_AREA)
    cx, cy = center_xy
    x0 = int(cx - nw / 2)
    y0 = int(cy - nh / 2)
    x1, y1 = x0 + nw, y0 + nh
    ox0 = max(0, -x0)
    oy0 = max(0, -y0)
    ox1 = nw - max(0, x1 - bw)
    oy1 = nh - max(0, y1 - bh)
    x0c, y0c = max(0, x0), max(0, y0)
    x1c, y1c = min(bw, x1), min(bh, y1)
    if x1c <= x0c or y1c <= y0c:
        return base_bgr

    piece = overlay[oy0:oy1, ox0:ox1]
    alpha = piece[:, :, 3:4].astype(np.float32) / 255.0
    out = base_bgr.copy()

    # Soft oval shadow under footprint
    shadow = np.zeros((bh, bw), np.float32)
    sy0 = min(bh - 1, y1c - int(nh * 0.08))
    sy1 = min(bh, y1c + 12)
    sx0, sx1 = x0c + int(nw * 0.08), x1c - int(nw * 0.08)
    if sy1 > sy0 and sx1 > sx0:
        shadow[sy0:sy1, sx0:sx1] = 1.0
        shadow = cv2.GaussianBlur(shadow, (51, 51), 0)
        for c in range(3):
            ch = out[:, :, c].astype(np.float32)
            out[:, :, c] = (ch * (1 - shadow * 0.32)).clip(0, 255).astype(np.uint8)

    roi = out[y0c:y1c, x0c:x1c].astype(np.float32)
    fg = piece[:, :, :3].astype(np.float32)
    out[y0c:y1c, x0c:x1c] = (fg * alpha + roi * (1 - alpha)).astype(np.uint8)
    return out


def make_cover(
    name: str,
    product_key: str,
    mode: str,
    bg_path: Path,
    center: tuple[float, float],
    max_w: float,
    max_h: float,
    table_focus: bool,
) -> Path:
    bg = load_bgr(bg_path)
    base = table_focus_crop(bg) if table_focus else square_crop_center(bg)
    piece = cutout(PRODUCTS[product_key], mode)
    save_png(OUT / f"mask-{name}.png", piece)
    # Preview mask on checker for QA
    mh, mw = piece.shape[:2]
    checker = np.zeros((mh, mw, 3), np.uint8)
    for y in range(0, mh, 16):
        for x in range(0, mw, 16):
            if ((x // 16) + (y // 16)) % 2 == 0:
                checker[y : y + 16, x : x + 16] = (220, 220, 220)
            else:
                checker[y : y + 16, x : x + 16] = (180, 180, 180)
    a = piece[:, :, 3:4].astype(np.float32) / 255.0
    prev = (piece[:, :, :3].astype(np.float32) * a + checker.astype(np.float32) * (1 - a)).astype(
        np.uint8
    )
    save_png(OUT / f"mask-preview-{name}.png", prev)

    cx = int(base.shape[1] * center[0])
    cy = int(base.shape[0] * center[1])
    comp = paste_rgba(base, piece, (cx, cy), max_w, max_h)
    out_path = OUT / f"cover-{name}.png"
    Image.fromarray(cv2.cvtColor(comp, cv2.COLOR_BGR2RGB)).save(out_path)
    print(
        "OK",
        name,
        "fg_ratio=",
        round(float((piece[:, :, 3] > 20).mean()), 3),
        "->",
        out_path.name,
    )
    return out_path


def make_detail_16x9() -> Path:
    """Wide detail banner: store table + bag-girl + kitty cutouts."""
    bg = load_bgr(STORE)
    h, w = bg.shape[:2]
    # 16:9 crop centered on table
    target_ratio = 16 / 9
    crop_h = h
    crop_w = int(crop_h * target_ratio)
    if crop_w > w:
        crop_w = w
        crop_h = int(crop_w / target_ratio)
    x0 = (w - crop_w) // 2
    y0 = int((h - crop_h) * 0.35)
    y0 = max(0, min(y0, h - crop_h))
    base = bg[y0 : y0 + crop_h, x0 : x0 + crop_w]
    base = cv2.resize(base, (1600, 900), interpolation=cv2.INTER_AREA)
    bag = cutout(PRODUCTS["bag-girl"], "wood")
    kitty = cutout(PRODUCTS["kitty-witch"], "wall")
    base = paste_rgba(base, bag, (int(1600 * 0.38), int(900 * 0.58)), 0.42, 0.62)
    base = paste_rgba(base, kitty, (int(1600 * 0.68), int(900 * 0.55)), 0.32, 0.55)
    out_path = OUT / "detail-16x9-cutout.png"
    Image.fromarray(cv2.cvtColor(base, cv2.COLOR_BGR2RGB)).save(out_path)
    print("OK detail-16x9 ->", out_path.name)
    return out_path


def main() -> None:
    jobs = [
        # Place on table surface (lower center), smaller = more "object on desk"
        ("duo-kitty", "kitty-witch", "wall", STORE, (0.50, 0.58), 0.55, 0.52, True),
        ("solo-shinchan", "shinchan", "wall", WINDOW, (0.38, 0.58), 0.42, 0.48, False),
        ("hero-bag", "bag-girl", "wood", STORE, (0.50, 0.56), 0.62, 0.58, True),
        ("hero-st", "st-set", "fabric", STORE, (0.50, 0.58), 0.68, 0.55, True),
    ]
    for args in jobs:
        make_cover(*args)
    make_detail_16x9()


if __name__ == "__main__":
    main()
