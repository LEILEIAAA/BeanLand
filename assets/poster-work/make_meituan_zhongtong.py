# -*- coding: utf-8 -*-
"""Meituan 中通 670x220：左侧工位清晰特写 + 右侧 BeanLand 蓝底彩点。"""
from __future__ import annotations

import math
import shutil
from pathlib import Path

from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageFont

SRC = Path(r"C:\Users\ry\.cursor\projects\c-Users-ry-Desktop-Bean\assets\zhongtong-left-sharp.png")
OUT_DIR = Path(r"c:\Users\ry\Desktop\Bean\Bean\assets\poster-work")
OUT_PNG = OUT_DIR / "meituan-zhongtong-670x220.png"
OUT_JPG = OUT_DIR / "meituan-zhongtong-670x220.jpg"

W, H = 670, 220

SKY = (125, 196, 230)
SKY_DEEP = (98, 178, 218)
YELLOW = (240, 196, 64)
ORANGE = (232, 93, 58)
PINK = (245, 160, 192)
GREEN = (61, 139, 92)
NAVY = (44, 74, 140)
WHITE = (255, 255, 255)
BTN_BG = (255, 255, 255)
BTN_FG = (44, 74, 140)

FONT_REG = r"C:\Windows\Fonts\msyh.ttc"
FONT_BD = r"C:\Windows\Fonts\msyhbd.ttc"

PHOTO_W = 360


def crop_table(im: Image.Image, tw: int, th: int) -> Image.Image:
    """切清晰桌面+格垫+椅背（高清横图，避开过曝窗帘）。"""
    im = im.convert("RGB")
    sw, sh = im.size
    # 1536x1024：避开左侧过曝窗帘，取桌面格垫特写
    box = (180, 500, 1120, 940)
    box = (max(0, box[0]), max(0, box[1]), min(sw, box[2]), min(sh, box[3]))
    crop = im.crop(box)
    cw, ch = crop.size
    target_ratio = tw / th
    src_ratio = cw / ch
    if src_ratio > target_ratio:
        nw = int(ch * target_ratio)
        left = max(0, (cw - nw) // 5)
        crop = crop.crop((left, 0, left + nw, ch))
    else:
        nh = int(cw / target_ratio)
        top = max(0, (ch - nh) // 5)
        crop = crop.crop((0, top, cw, top + nh))
    out = crop.resize((tw, th), Image.Resampling.LANCZOS)
    out = ImageEnhance.Contrast(out).enhance(1.08)
    out = ImageEnhance.Color(out).enhance(1.05)
    out = out.filter(ImageFilter.UnsharpMask(radius=1.2, percent=90, threshold=2))
    return out


def sky_polygon() -> list[tuple[int, int]]:
    """右侧铺满蓝，左缘平滑云朵弧（避免锯齿折线）。"""
    pts = [(W, 0), (W, H)]
    # 从底到顶沿左缘走平滑正弦波
    left0 = 328
    for i in range(24, -1, -1):
        y = int(H * i / 24)
        wave = int(16 * math.sin(i / 24 * math.pi * 2.1))
        pts.append((left0 + wave, y))
    pts.append((W, 0))
    return pts


def circle(draw: ImageDraw.ImageDraw, cx: int, cy: int, r: int, fill):
    draw.ellipse((cx - r, cy - r, cx + r, cy + r), fill=fill)


def squiggle(draw: ImageDraw.ImageDraw, x: int, y: int, color):
    pts = [(x + i * 5, y + (7 if i % 2 else 0)) for i in range(9)]
    draw.line(pts, fill=color, width=4, joint="curve")


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    local_src = OUT_DIR / "zhongtong-left-sharp.png"
    if SRC.exists():
        shutil.copy2(SRC, local_src)

    canvas = Image.new("RGB", (W, H), WHITE)
    photo = crop_table(Image.open(SRC), PHOTO_W + 20, H)
    canvas.paste(photo, (0, 0))

    canvas_rgba = canvas.convert("RGBA")
    sky = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    sd = ImageDraw.Draw(sky)
    poly = sky_polygon()
    # 纵向微渐变：先铺色再贴多边形
    grad = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    gd = ImageDraw.Draw(grad)
    for y in range(H):
        t = y / max(H - 1, 1)
        c = (
            int(SKY[0] * (1 - t) + SKY_DEEP[0] * t),
            int(SKY[1] * (1 - t) + SKY_DEEP[1] * t),
            int(SKY[2] * (1 - t) + SKY_DEEP[2] * t),
            255,
        )
        gd.line([(0, y), (W, y)], fill=c)
    mask = Image.new("L", (W, H), 0)
    ImageDraw.Draw(mask).polygon(poly, fill=255)
    mask = mask.filter(ImageFilter.GaussianBlur(1.4))
    sky.paste(grad, (0, 0))
    sky.putalpha(mask)
    canvas_rgba = Image.alpha_composite(canvas_rgba, sky)

    draw = ImageDraw.Draw(canvas_rgba)
    circle(draw, 338, 36, 10, YELLOW)
    circle(draw, 358, 58, 7, ORANGE)
    circle(draw, W - 38, 26, 12, PINK)
    circle(draw, W - 20, 104, 9, GREEN)
    circle(draw, W - 52, H - 26, 8, NAVY)
    squiggle(draw, 372, 24, PINK)

    sub_font = ImageFont.truetype(FONT_REG, 15)
    title_font = ImageFont.truetype(FONT_BD, 34)
    btn_font = ImageFont.truetype(FONT_BD, 14)

    subtitle = "工坊座位已备好"
    title = "到店拼豆体验"
    cta = "立即预约 ›"

    right_pad = 26
    title_bbox = draw.textbbox((0, 0), title, font=title_font)
    title_w = title_bbox[2] - title_bbox[0]
    sub_bbox = draw.textbbox((0, 0), subtitle, font=sub_font)
    sub_w = sub_bbox[2] - sub_bbox[0]
    assert max(title_w, sub_w) < W / 2
    assert title_font.size < 50

    draw.text((W - right_pad - sub_w, 48), subtitle, font=sub_font, fill=WHITE)
    draw.text((W - right_pad - title_w, 76), title, font=title_font, fill=WHITE)

    cta_bbox = draw.textbbox((0, 0), cta, font=btn_font)
    cta_w = cta_bbox[2] - cta_bbox[0]
    btn_h, btn_pad_x = 34, 16
    btn_w = cta_w + btn_pad_x * 2
    btn_x1 = W - right_pad - btn_w
    btn_y1 = 150
    draw.rounded_rectangle((btn_x1, btn_y1, btn_x1 + btn_w, btn_y1 + btn_h), radius=17, fill=BTN_BG)
    tx = btn_x1 + btn_pad_x
    ty = btn_y1 + (btn_h - (cta_bbox[3] - cta_bbox[1])) // 2 - cta_bbox[1]
    draw.text((tx, ty), cta, font=btn_font, fill=BTN_FG)

    rgb = canvas_rgba.convert("RGB")
    rgb.save(OUT_PNG, "PNG", optimize=True)
    rgb.save(OUT_JPG, "JPEG", quality=93, optimize=True, subsampling=0)
    print("png", OUT_PNG, OUT_PNG.stat().st_size, Image.open(OUT_PNG).size)
    print("title_w", title_w)


if __name__ == "__main__":
    main()
