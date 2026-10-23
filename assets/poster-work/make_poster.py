# -*- coding: utf-8 -*-
"""Cut out bead works via light-bg threshold, stroke, compose BeanLand poster."""
from __future__ import annotations

import os
import random
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont

BASE = Path(r"C:\Users\ry\.cursor\projects\c-Users-ry-Desktop-Bean-Bean\assets")
OUT = Path(r"c:\Users\ry\Desktop\Bean\Bean\assets\poster-work")
ASSETS = Path(r"c:\Users\ry\Desktop\Bean\Bean\assets")
OUT.mkdir(parents=True, exist_ok=True)

SRC = {
    "guitar": BASE
    / "c__Users_ry_AppData_Roaming_Cursor_User_workspaceStorage_5c36bb28dfe1c13d244746542a77739f_images_9ccb174a4ed95f99438a2b2c9b092dea-d79db3b5-4f26-46ae-9bf9-7e09ad58fc24.png",
    "cloud_girl": BASE
    / "c__Users_ry_AppData_Roaming_Cursor_User_workspaceStorage_5c36bb28dfe1c13d244746542a77739f_images_dc410b1858362b5ae825de712707b37c-85103799-3e41-4fd5-ae41-8bfca5d4ec89.png",
    "pearl": BASE
    / "c__Users_ry_AppData_Roaming_Cursor_User_workspaceStorage_5c36bb28dfe1c13d244746542a77739f_images_2b4a7c5bd63ec14e4b7ffb9a7e377dc6-36d62a58-d948-4ec6-94cb-8921eb7b1127.png",
    "angel": BASE
    / "c__Users_ry_AppData_Roaming_Cursor_User_workspaceStorage_5c36bb28dfe1c13d244746542a77739f_images_d0f715af38ac55429dce1e7d63be0db9-5297c4d8-2a43-4b3f-97ff-43b0e9eb7bbd.png",
    "suki": BASE
    / "c__Users_ry_AppData_Roaming_Cursor_User_workspaceStorage_5c36bb28dfe1c13d244746542a77739f_images_4dbfe0ba27df460bcf0a1dfb87af3cc6-73c806e0-50d7-4c51-8f5e-3a02f9ce00c5.png",
    "keychain": BASE
    / "c__Users_ry_AppData_Roaming_Cursor_User_workspaceStorage_5c36bb28dfe1c13d244746542a77739f_images_c7fcd9a101582537d6675d8c4f6e3078-79e0f115-5c14-40c1-bb50-4cd925140679.png",
    "hearts": BASE
    / "c__Users_ry_AppData_Roaming_Cursor_User_workspaceStorage_5c36bb28dfe1c13d244746542a77739f_images_34fec7e85bf2ddf0c7ba4ff4c21a8f2a-71be0a7e-313c-4f51-880e-a5987541bdc1.png",
    "logo": BASE
    / "c__Users_ry_AppData_Roaming_Cursor_User_workspaceStorage_5c36bb28dfe1c13d244746542a77739f_images_12e673c89103de98fa78469bee854149-4de58825-add2-4022-8fbb-a817e14e04fa.png",
}


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


def sample_bg_color(im: Image.Image) -> tuple[int, int, int]:
    """Average corner pixels as background estimate."""
    rgb = im.convert("RGB")
    w, h = rgb.size
    pts = [
        (2, 2),
        (w - 3, 2),
        (2, h - 3),
        (w - 3, h - 3),
        (w // 2, 2),
        (2, h // 2),
        (w - 3, h // 2),
        (w // 2, h - 3),
    ]
    acc = [0, 0, 0]
    for p in pts:
        c = rgb.getpixel(p)
        acc[0] += c[0]
        acc[1] += c[1]
        acc[2] += c[2]
    n = len(pts)
    return (acc[0] // n, acc[1] // n, acc[2] // n)


def _color_dist(c, bg) -> int:
    return abs(c[0] - bg[0]) + abs(c[1] - bg[1]) + abs(c[2] - bg[2])


def remove_light_bg(im: Image.Image, threshold: int = 48) -> Image.Image:
    """Flood-fill from edges so light beads inside the subject stay intact."""
    im = im.convert("RGBA")
    rgb = im.convert("RGB")
    bg = sample_bg_color(im)
    w, h = rgb.size
    data = list(rgb.getdata())

    def is_bg(i: int) -> bool:
        c = data[i]
        if _color_dist(c, bg) <= threshold * 3:
            return True
        # marble / glare near white only when close to sampled bg hue
        bright = (c[0] + c[1] + c[2]) / 3
        return bright > 232 and _color_dist(c, bg) <= threshold * 5

    visited = bytearray(w * h)
    stack: list[int] = []

    def try_push(x: int, y: int):
        if x < 0 or y < 0 or x >= w or y >= h:
            return
        i = y * w + x
        if visited[i]:
            return
        if is_bg(i):
            visited[i] = 1
            stack.append(i)

    # seed from full border
    for x in range(w):
        try_push(x, 0)
        try_push(x, h - 1)
    for y in range(h):
        try_push(0, y)
        try_push(w - 1, y)

    while stack:
        i = stack.pop()
        x, y = i % w, i // w
        try_push(x + 1, y)
        try_push(x - 1, y)
        try_push(x, y + 1)
        try_push(x, y - 1)

    out = im.copy()
    px = out.load()
    for i, flag in enumerate(visited):
        if flag:
            x, y = i % w, i // w
            r, g, b, _ = px[x, y]
            px[x, y] = (r, g, b, 0)

    alpha = out.split()[-1]
    # mild cleanup: remove speckles, keep subject holes filled lightly
    alpha = alpha.point(lambda p: 255 if p > 20 else 0)
    alpha = alpha.filter(ImageFilter.MaxFilter(3)).filter(ImageFilter.MinFilter(3))
    out.putalpha(alpha)
    return trim_alpha(out)


def remove_white_bg_logo(im: Image.Image) -> Image.Image:
    """Logo sits on pure white — stricter cut."""
    im = im.convert("RGBA")
    pixels = im.load()
    w, h = im.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = pixels[x, y]
            if r > 245 and g > 245 and b > 245:
                pixels[x, y] = (r, g, b, 0)
            elif r > 230 and g > 230 and b > 230:
                # soft near white
                t = ((r + g + b) / 3 - 230) / 25
                pixels[x, y] = (r, g, b, int(255 * (1 - min(1, max(0, t)))))
    return trim_alpha(im)


def keep_largest_components(im: Image.Image, min_area_ratio: float = 0.02, keep_top: int = 3) -> Image.Image:
    """Drop tiny floating fragments; keep largest opaque regions."""
    im = im.convert("RGBA")
    alpha = im.split()[-1]
    w, h = alpha.size
    data = list(alpha.getdata())
    visited = bytearray(w * h)
    components: list[list[int]] = []

    for start in range(w * h):
        if visited[start] or data[start] < 16:
            continue
        stack = [start]
        visited[start] = 1
        comp: list[int] = []
        while stack:
            i = stack.pop()
            comp.append(i)
            x, y = i % w, i // w
            for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                if nx < 0 or ny < 0 or nx >= w or ny >= h:
                    continue
                j = ny * w + nx
                if visited[j] or data[j] < 16:
                    continue
                visited[j] = 1
                stack.append(j)
        components.append(comp)

    if not components:
        return im
    components.sort(key=len, reverse=True)
    total = w * h
    keep = set()
    for comp in components[:keep_top]:
        if len(comp) / total >= min_area_ratio or comp is components[0]:
            keep.update(comp)
    # always keep the biggest even if small ratio
    keep.update(components[0])

    out = im.copy()
    px = out.load()
    for i in range(w * h):
        if i not in keep:
            x, y = i % w, i // w
            r, g, b, _ = px[x, y]
            px[x, y] = (r, g, b, 0)
    return trim_alpha(out)


def cutout(path: Path, name: str) -> Image.Image:
    cache = OUT / f"cut_{name}.png"
    # always rebuild when script changes cut logic
    print(f"cut {name}...")
    src = Image.open(path).convert("RGBA")
    max_side = 1000
    if max(src.size) > max_side:
        src.thumbnail((max_side, max_side), Image.Resampling.LANCZOS)
    if name == "logo":
        out = remove_white_bg_logo(src)
    elif name == "suki":
        out = remove_light_bg(src, threshold=55)
    elif name in ("angel", "pearl", "cloud_girl"):
        out = remove_light_bg(src, threshold=40)
    else:
        out = remove_light_bg(src, threshold=48)
    if name in ("keychain", "hearts", "suki"):
        out = keep_largest_components(out, min_area_ratio=0.015, keep_top=4 if name == "hearts" else 2)
    out.save(cache)
    print(f"  -> {cache.name} {out.size}")
    return out


def add_stroke(im: Image.Image, width: int = 14, color=(255, 255, 255, 255)) -> Image.Image:
    if im.mode != "RGBA":
        im = im.convert("RGBA")
    pad = width + 6
    canvas = Image.new("RGBA", (im.width + pad * 2, im.height + pad * 2), (0, 0, 0, 0))
    canvas.paste(im, (pad, pad), im)
    a = canvas.split()[-1]
    outline = a
    for _ in range(max(1, width // 2)):
        outline = outline.filter(ImageFilter.MaxFilter(3))
    outline = outline.filter(ImageFilter.GaussianBlur(0.5))
    stroke = Image.new("RGBA", canvas.size, color)
    stroke.putalpha(outline)
    result = Image.alpha_composite(stroke, canvas)
    # thin dark rim
    dark_w = max(2, width // 5)
    dark_outline = a
    for _ in range(max(1, dark_w // 2)):
        dark_outline = dark_outline.filter(ImageFilter.MaxFilter(3))
    ring = ImageChops.subtract(dark_outline, a)
    dark = Image.new("RGBA", canvas.size, (45, 60, 90, 220))
    dark.putalpha(ring)
    result = Image.alpha_composite(result, dark)
    result = Image.alpha_composite(result, canvas)
    return trim_alpha(result, pad=2)


def fit(im: Image.Image, max_w: int, max_h: int) -> Image.Image:
    out = im.copy()
    out.thumbnail((max_w, max_h), Image.Resampling.LANCZOS)
    return out


def paste_center(base: Image.Image, im: Image.Image, cx: int, cy: int):
    x = int(cx - im.width / 2)
    y = int(cy - im.height / 2)
    base.alpha_composite(im, (x, y))


def load_font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    candidates = [
        r"C:\Windows\Fonts\msyhbd.ttc" if bold else r"C:\Windows\Fonts\msyh.ttc",
        r"C:\Windows\Fonts\simhei.ttf",
        r"C:\Windows\Fonts\msyh.ttc",
    ]
    for p in candidates:
        if os.path.exists(p):
            try:
                return ImageFont.truetype(p, size=size)
            except OSError:
                continue
    return ImageFont.load_default()


def make_gradient_bg(w: int, h: int) -> Image.Image:
    top = (255, 246, 230)
    mid = (230, 244, 255)
    bot = (255, 236, 220)
    im = Image.new("RGBA", (w, h))
    px = im.load()
    for y in range(h):
        t = y / (h - 1)
        if t < 0.45:
            u = t / 0.45
            r = int(top[0] + (mid[0] - top[0]) * u)
            g = int(top[1] + (mid[1] - top[1]) * u)
            b = int(top[2] + (mid[2] - top[2]) * u)
        else:
            u = (t - 0.45) / 0.55
            r = int(mid[0] + (bot[0] - mid[0]) * u)
            g = int(mid[1] + (bot[1] - mid[1]) * u)
            b = int(mid[2] + (bot[2] - mid[2]) * u)
        for x in range(w):
            wobble = int(6 * ((x / w) - 0.5))
            px[x, y] = (max(0, min(255, r + wobble)), max(0, min(255, g)), max(0, min(255, b)), 255)
    return im


def soft_dots(im: Image.Image, n: int = 40):
    draw = ImageDraw.Draw(im)
    rnd = random.Random(42)
    colors = [
        (255, 196, 90, 90),
        (120, 190, 230, 80),
        (255, 140, 140, 70),
        (160, 220, 160, 70),
        (255, 170, 200, 70),
    ]
    for _ in range(n):
        x = rnd.randint(20, im.width - 20)
        y = rnd.randint(20, int(im.height * 0.55))
        r = rnd.randint(4, 14)
        c = colors[rnd.randint(0, len(colors) - 1)]
        draw.ellipse((x - r, y - r, x + r, y + r), fill=c)


def main():
    pieces = {}
    for name, path in SRC.items():
        if not path.exists():
            raise FileNotFoundError(path)
        raw = cutout(path, name)
        if name == "logo":
            pieces[name] = trim_alpha(raw)
        else:
            stroked = add_stroke(raw, width=16 if name != "hearts" else 12)
            stroked.save(OUT / f"stroke_{name}.png")
            pieces[name] = stroked

    W, H = 1080, 1440
    poster = make_gradient_bg(W, H)
    soft_dots(poster)

    logo = fit(pieces["logo"], 520, 230)
    paste_center(poster, logo, W // 2, 130)

    layout = [
        ("guitar", 300, 340, 210, 400, -8),
        ("cloud_girl", 270, 310, 530, 370, 6),
        ("pearl", 260, 260, 860, 410, -4),
        ("angel", 250, 300, 200, 700, 5),
        ("suki", 250, 290, 500, 680, -6),
        ("keychain", 380, 260, 840, 690, 2),
        ("hearts", 320, 300, 560, 900, -2),
    ]

    for name, mw, mh, cx, cy, rot in layout:
        im = fit(pieces[name], mw, mh)
        if rot:
            im = im.rotate(rot, expand=True, resample=Image.Resampling.BICUBIC)
        paste_center(poster, im, cx, cy)

    panel = Image.new("RGBA", (W - 80, 360), (255, 255, 255, 0))
    pd = ImageDraw.Draw(panel)
    pd.rounded_rectangle(
        (0, 0, panel.width - 1, panel.height - 1),
        radius=28,
        fill=(255, 255, 255, 215),
        outline=(90, 160, 210, 180),
        width=3,
    )
    poster.alpha_composite(panel, (40, H - 400))

    title_font = load_font(42, bold=True)
    body_font = load_font(26)
    small_font = load_font(22)
    tag_font = load_font(24, bold=True)

    draw = ImageDraw.Draw(poster)
    tx, ty = 72, H - 370
    draw.text((tx, ty), "BeanLand 拼豆馆", font=title_font, fill=(45, 70, 100, 255))
    ty += 52
    draw.text((tx, ty), "一颗豆子，一块童年，一间可以慢慢拼的小天地", font=tag_font, fill=(70, 130, 180, 255))
    ty += 42
    body_lines = [
        "杭州拱墅 · 新青年广场｜线下拼豆手作体验店",
        "材料齐全 · 图纸灵感 · 新手友好 · 可带走成品",
        "适合：闺蜜约会 / 亲子手作 / 独处放空 / 定制礼物",
        "欢迎来做客人们的拼豆墙——每一颗豆子，都是心情。",
    ]
    for line in body_lines:
        draw.text((tx, ty), line, font=body_font, fill=(70, 85, 100, 255))
        ty += 34
    draw.text(
        (tx, ty + 6),
        "预约到店 · 小程序 BeanLand · 欢迎打卡分享",
        font=small_font,
        fill=(130, 150, 170, 255),
    )

    badge = Image.new("RGBA", (200, 56), (0, 0, 0, 0))
    bd = ImageDraw.Draw(badge)
    bd.rounded_rectangle((0, 0, 199, 55), radius=28, fill=(255, 170, 70, 230))
    bf = load_font(22, bold=True)
    bd.text((28, 14), "客户作品墙", font=bf, fill=(255, 255, 255, 255))
    poster.alpha_composite(badge, (W - 230, 40))

    out_path = OUT / "beanland-xhs-poster-customer-works.png"
    root_out = ASSETS / "beanland-xhs-poster-customer-works.png"
    poster.convert("RGB").save(out_path, quality=95)
    poster.convert("RGB").save(root_out, quality=95)
    print("POSTER", root_out, poster.size)

    # blank text version
    poster2 = make_gradient_bg(W, H)
    soft_dots(poster2)
    paste_center(poster2, logo, W // 2, 130)
    for name, mw, mh, cx, cy, rot in layout:
        im = fit(pieces[name], mw, mh)
        if rot:
            im = im.rotate(rot, expand=True, resample=Image.Resampling.BICUBIC)
        paste_center(poster2, im, cx, cy)
    panel2 = Image.new("RGBA", (W - 80, 360), (255, 255, 255, 0))
    pd2 = ImageDraw.Draw(panel2)
    pd2.rounded_rectangle(
        (0, 0, panel2.width - 1, panel2.height - 1),
        radius=28,
        fill=(255, 255, 255, 200),
        outline=(90, 160, 210, 160),
        width=3,
    )
    hint = load_font(28)
    pd2.text((40, 140), "【预留文案区】在此填写店铺介绍", font=hint, fill=(160, 180, 200, 255))
    poster2.alpha_composite(panel2, (40, H - 400))
    poster2.alpha_composite(badge, (W - 230, 40))
    blank = ASSETS / "beanland-xhs-poster-text-blank.png"
    poster2.convert("RGB").save(blank, quality=95)
    print("BLANK", blank)

    # also save copy markdown
    copy_path = ASSETS / "beanland-shop-intro-copy.md"
    copy_path.write_text(
        """# BeanLand 拼豆馆 · 店铺介绍文案

## 海报主标题
BeanLand 拼豆馆

## 一句话
一颗豆子，一块童年，一间可以慢慢拼的小天地

## 短介绍（小红书简介 / 海报正文）
杭州拱墅 · 新青年广场｜线下拼豆手作体验店  
材料齐全 · 图纸灵感 · 新手友好 · 可带走成品  
适合：闺蜜约会 / 亲子手作 / 独处放空 / 定制礼物  
欢迎来做客人们的拼豆墙——每一颗豆子，都是心情。

## 行动提示
预约到店 · 小程序 BeanLand · 欢迎打卡分享

## 小红书店铺简介（可直接粘贴）
BeanLand 拼豆馆｜杭州拱墅新青年广场

不是赶时间的流水线手工课，而是一间可以慢慢坐下来、把心情一颗颗拼出来的小店。

店里有齐全的豆子和图纸灵感，新手也能轻松上手；拼完带走自己的成品，顺便在作品墙打个卡。

来这里可以：
- 和闺蜜约会拼一局
- 带孩子做亲子手作
- 一个人安静放空
- 定制一份有心意的小礼物

欢迎预约到店，也欢迎把你的作品分享给我们——BeanLand，拼的是豆子，留下的是心情。

## 更短版（50字内）
BeanLand 拼豆馆｜拱墅新青年广场  
线下拼豆手作，新手友好，成品可带走。闺蜜、亲子、独处都适合。预约到店，慢慢拼一颗好心情。
""",
        encoding="utf-8",
    )
    print("COPY", copy_path)


if __name__ == "__main__":
    main()
