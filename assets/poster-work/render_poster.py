from pathlib import Path
from playwright.sync_api import sync_playwright
from PIL import Image

here = Path(__file__).resolve().parent
html = here.joinpath("accessory-fee-poster.html").as_uri()
raw = here / "_poster_raw.png"
out = here / "配件收费标准-A4.png"
desk = Path(r"c:\Users\ry\Desktop\配件收费标准-A4.png")

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page(viewport={"width": 900, "height": 1400}, device_scale_factor=4)
    page.add_init_script("window.addEventListener('DOMContentLoaded',()=>{document.body.style.transform='none';document.body.style.position='relative';document.body.style.left='0';document.body.style.top='0';})")
    page.goto(html, wait_until="networkidle", timeout=60000)
    page.wait_for_timeout(1600)
    page.locator("body").screenshot(path=str(raw), type="png")
    page.pdf(
        path=str(here / "配件收费标准-A4.pdf"),
        format="A4",
        print_background=True,
        margin={"top": "0", "right": "0", "bottom": "0", "left": "0"},
    )
    browser.close()

im = Image.open(raw).convert("RGB")
im = im.resize((2480, 3508), Image.Resampling.LANCZOS)
im.save(out, "PNG", dpi=(300, 300))
im.save(desk, "PNG", dpi=(300, 300))
raw.unlink(missing_ok=True)
print("raw-to", im.size)
print(out)
print(desk)
