# -*- coding: utf-8 -*-
"""A4 accessory-fee poster using BeanLand rabbit/carrot assets."""
from __future__ import annotations

import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ASSETS = Path(r"c:\Users\ry\Desktop\Bean\Bean\assets")
OUT_DIR = Path(r"c:\Users\ry\Desktop\Bean\Bean\assets\poster-work")
DESKTOP = Path(r"c:\Users\ry\Desktop")

W, H = 2480, 3508
PAPER = (247, 241, 228)
INK = (62, 42, 30)
INK_SOFT = (120, 96, 78)
CARROT = (232, 88, 18)
LEAF = (86, 148, 78)
FRAME = (154, 204, 226)
CARD = (255, 252, 246)
CREAM_LINE = (232, 214, 188)

TITLE_COLORS = [
    (70, 168, 230),
    (255, 142, 176),
    (255, 198, 42),
    (255, 92, 70),
    (86, 196, 108),
    (255, 132, 42),
]


def trim_alpha(im: Image.Image, pad: int = 4) -> Image.Image:
    if im.mode != "RGBA":
        im = im.convert("RGBA")
    bbox = im.getbbox()
    if not bbox:
        return im
    l, t, r, b = bbox
    l = max(0, l - pad)
    t = max(0, t - pad)
    r = min(im.width, r + pad)
    b = min(im.height, b + pad)
    return im.crop((l, t, r, b))


def knock_cream(im: Image.Image, threshold: int = 42) -> Image.Image:
    im = im.convert("RGBA")
    rgb = im.convert("RGB")
    w, h = rgb.size
    corners = [
        rgb.getpixel((2, 2)),
        rgb.getpixel((w - 3, 2)),
        rgb.getpixel((2, h - 3)),
        rgb.getpixel((w - 3, h - 3)),
    ]
    bg = tuple(sum(c[i] for c in corners) // 4 for i in range(3))
    data = list(rgb.getdata())

    def is_bg(i: int) -> bool:
        c = data[i]
        d = abs(c[0] - bg[0]) + abs(c[1] - bg[1]) + abs(c[2] - bg[2])
        if d <= threshold * 3:
            return True
        return (c[0] + c[1] + c[2]) / 3 > 236 and d <= threshold * 6

    visited = bytearray(w * h)
    stack: list[int] = []

    def push(x: int, y: int) -> None:
        if x < 0 or y < 0 or x >= w or y >= h:
            return
        i = y * w + x
        if visited[i] or not is_bg(i):
            return
        visited[i] = 1
        stack.append(i)

    for x in range(w):
        push(x, 0)
        push(x, h - 1)
    for y in range(h):
        push(0, y)
        push(w - 1, y)
    while stack:
        i = stack.pop()
        x, y = i % w, i // w
        push(x + 1, y)
        push(x - 1, y)
        push(x, y + 1)
        push(x, y - 1)

    out = im.copy()
    px = out.load()
    for i, flag in enumerate(visited):
        if flag:
            x, y = i % w, i // w
            r, g, b, _ = px[x, y]
            px[x, y] = (r, g, b, 0)
    a = out.split()[-1].point(lambda p: 255 if p > 18 else 0)
    a = a.filter(ImageFilter.MaxFilter(3)).filter(ImageFilter.MinFilter(3))
    out.putalpha(a)
    return trim_alpha(out)


def fit(im: Image.Image, mw: int, mh: int) -> Image.Image:
    out = im.copy()
    out.thumbnail((mw, mh), Image.Resampling.LANCZOS)
    return out


def paste(base: Image.Image, im: Image.Image, xy: tuple[int, int]) -> None:
    base.alpha_composite(im, xy)


def paste_center(base: Image.Image, im: Image.Image, cx: int, cy: int) -> None:
    paste(base, im, (int(cx - im.width / 2), int(cy - im.height / 2)))


def font(path: str, size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(path, size)


YOU = r"C:\Windows\Fonts\SIMYOU.TTF"
YAH = r"C:\Windows\Fonts\msyh.ttc"
YAHB = r"C:\Windows\Fonts\msyhbd.ttc"


def stroke_text(draw: ImageDraw.ImageDraw, xy, text, fnt, fill, stroke, sw: int) -> None:
    draw.text(xy, text, font=fnt, fill=fill, stroke_width=sw, stroke_fill=stroke)


def rounded_rect(draw, box, r, fill=None, outline=None, width=4):
    draw.rounded_rectangle(box, radius=r, fill=fill, outline=outline, width=width)


def sparkle(draw, cx, cy, s, color=(248, 196, 64, 255)):
    pts = []
    for i in range(8):
        ang = math.radians(i * 45 - 90)
        rad = s if i % 2 == 0 else s * 0.32
        pts.append((cx + rad * math.cos(ang), cy + rad * math.sin(ang)))
    draw.polygon(pts, fill=color)


def paper_texture(im: Image.Image) -> None:
    draw = ImageDraw.Draw(im, "RGBA")
    cols = [(255, 170, 190, 80), (255, 220, 120, 80), (160, 210, 230, 80), (170, 210, 140, 80), (255, 190, 140, 80)]
    for i in range(48):
        x = (i * 173 + 90) % (W - 200) + 100
        y = (i * 251 + 120) % (H - 240) + 110
        r = 7 + (i % 4) * 4
        draw.ellipse((x, y, x + r, y + r), fill=cols[i % 5])


def load_cuts():
    a = knock_cream(Image.open(ASSETS / "shop-avatar-A-mascot-only.png"))
    n1 = knock_cream(Image.open(ASSETS / "number-1-yellow.png"), threshold=30)
    n2 = knock_cream(Image.open(ASSETS / "number-2-pink.png"), threshold=30)
    carrot = knock_cream(Image.open(ASSETS / "shop-avatar-A-mascot-only.png").crop((170, 290, 840, 530)))
    bunny = knock_cream(Image.open(ASSETS / "shop-avatar-B-solo-hero.png").crop((360, 560, 680, 900)))
    return a, n1, n2, carrot, bunny


def draw_bubble_title(canvas, y0: int, deco_l, deco_r) -> int:
    chars = list("配件收费标准")
    fnt = font(YOU, 168)
    draw = ImageDraw.Draw(canvas)
    gap = 8
    widths = []
    for ch in chars:
        bbox = draw.textbbox((0, 0), ch, font=fnt, stroke_width=10)
        widths.append(bbox[2] - bbox[0])
    total = sum(widths) + gap * (len(chars) - 1)
    x = (W - total) // 2
    paste_center(canvas, fit(deco_l, 210, 100), x - 130, y0 + 90)
    paste_center(canvas, fit(deco_r, 150, 150), x + total + 110, y0 + 92)
    for ch, col, tw in zip(chars, TITLE_COLORS, widths):
        draw.text((x + 4, y0 + 6), ch, font=fnt, fill=(255, 255, 255, 120), stroke_width=10, stroke_fill=(255, 255, 255, 120))
        stroke_text(draw, (x, y0), ch, fnt, col, (255, 255, 255), 10)
        x += tw + gap
    return y0 + 200


def main():
    a, n1, n2, carrot, bunny = load_cuts()
    canvas = Image.new("RGBA", (W, H), PAPER + (255,))
    paper_texture(canvas)
    draw = ImageDraw.Draw(canvas, "RGBA")

    rounded_rect(draw, (72, 72, W - 72, H - 72), 48, outline=FRAME, width=8)
    rounded_rect(draw, (96, 96, W - 96, H - 96), 36, outline=(255, 255, 255, 180), width=3)

    y = 150
    y = draw_bubble_title(canvas, y, carrot, bunny)

    f_lead = font(YAHB, 54)
    f_body = font(YAH, 48)
    f_body_b = font(YAHB, 48)
    f_small = font(YAH, 36)
    f_kicker = font(YOU, 72)

    # lead
    lead1 = "到店每人赠配件"
    lead2 = "1 个"
    bx = draw.textbbox((0, 0), lead1, font=f_lead)
    tw1 = bx[2] - bx[0]
    bunny_s = fit(bunny, 92, 92)
    cx = (W - (tw1 + 20 + bunny_s.width + 16 + 140)) // 2
    draw.text((cx, y + 18), lead1, font=f_lead, fill=INK)
    paste(canvas, bunny_s, (cx + tw1 + 16, y))
    stroke_text(draw, (cx + tw1 + 16 + bunny_s.width + 10, y + 10), lead2, font(YAHB, 64), CARROT, (255, 255, 255), 4)

    y += 110
    # second line with 1.5
    line_a = "超出部分可点评加赠，或"
    line_b = "1.5 元 / 个"
    line_c = "单独购买。"
    carrot_s = fit(carrot, 150, 70)
    ta = draw.textbbox((0, 0), line_a, font=f_body)
    tb = draw.textbbox((0, 0), line_b, font=f_body_b)
    tc = draw.textbbox((0, 0), line_c, font=f_body)
    pill_w = (tb[2] - tb[0]) + 70
    total_w = (ta[2] - ta[0]) + 16 + carrot_s.width + 12 + pill_w + 16 + (tc[2] - tc[0])
    x = (W - total_w) // 2
    draw.text((x, y + 18), line_a, font=f_body, fill=INK)
    x += ta[2] - ta[0] + 12
    paste(canvas, carrot_s, (x, y + 8))
    x += carrot_s.width + 8
    pill = (x, y + 6, x + pill_w, y + 78)
    rounded_rect(draw, pill, 40, fill=(255, 236, 214), outline=CARROT, width=5)
    draw.text((x + 18, y + 14), line_b, font=f_body_b, fill=CARROT)
    x += pill_w + 14
    draw.text((x, y + 18), line_c, font=f_body, fill=INK)

    # instruction card on the left; brand rabbits on the right, carrot pointing in
    card = (140, 640, 1320, 1760)
    rounded_rect(draw, card, 56, fill=CARD, outline=INK, width=6)

    bunny_k = fit(bunny, 128, 128)
    paste(canvas, bunny_k, (190, 680))
    stroke_text(draw, (340, 700), "点评加赠", f_kicker, INK, (255, 255, 255), 6)

    n1s = fit(n1, 118, 118)
    n2s = fit(n2, 118, 118)
    paste(canvas, n1s, (200, 900))
    draw.text((350, 918), "团购核销后评价，加赠", font=f_body, fill=INK)
    stroke_text(draw, (350, 988), "1 个。", f_body_b, CARROT, (255, 255, 255), 3)

    paste(canvas, n2s, (200, 1180))
    draw.text((350, 1190), "美团、抖音、大众点评", font=f_body, fill=INK)
    draw.text((350, 1264), "发布店铺评价（无需消费），", font=f_body, fill=INK)
    t = "每条加赠"
    draw.text((350, 1338), t, font=f_body, fill=INK)
    tw = draw.textbbox((0, 0), t, font=f_body)[2]
    stroke_text(draw, (350 + tw + 8, 1334), "1 个。", f_body_b, CARROT, (255, 255, 255), 3)

    hero = fit(a, 1120, 1120)
    paste(canvas, hero, (1260, 780))

    sparkles = ImageDraw.Draw(canvas, "RGBA")
    sparkle(sparkles, 2220, 760, 26)
    sparkle(sparkles, 2360, 1680, 20)
    sparkle(sparkles, 180, 600, 16)

    bar = (140, 2040, W - 140, 2460)
    rounded_rect(draw, bar, 40, fill=(232, 242, 220), outline=LEAF, width=6)
    carrot_b = fit(carrot, 300, 130)
    paste(canvas, carrot_b, (190, 2160))
    f_std = font(YAHB, 56)
    draw.text((530, 2130), "评价标准", font=f_std, fill=LEAF)
    f_std2 = font(YAH, 50)
    x = 530
    yb = 2260
    def put(txt, f, col):
        nonlocal x
        draw.text((x, yb), txt, font=f, fill=col)
        x += draw.textbbox((0, 0), txt, font=f)[2] + 6
    put("配图", f_std2, INK)
    put("3", font(YAHB, 52), LEAF)
    put("张，正文不少于", f_std2, INK)
    put("50", font(YAHB, 52), LEAF)
    put("字，出示后领取。", f_std2, INK)

    foot = "配件以店内现货为准，当天领取，不累计、不转赠。同一评价不重复加赠。"
    fb = draw.textbbox((0, 0), foot, font=f_small)
    draw.text(((W - (fb[2] - fb[0])) // 2, 2580), foot, font=f_small, fill=INK_SOFT)

    rgb = canvas.convert("RGB")
    out1 = OUT_DIR / "配件收费标准-A4.png"
    out2 = DESKTOP / "配件收费标准-A4.png"
    rgb.save(out1, "PNG", dpi=(300, 300))
    rgb.save(out2, "PNG", dpi=(300, 300))
    print("saved", out1)
    print("saved", out2)


if __name__ == "__main__":
    main()
