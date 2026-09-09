#!/usr/bin/env python3
"""Inline CSS/JS into a single file.

  dist/index.html     standalone page — works from file:// with no server
  dist/embed.html     body-only fragment for hosts that supply their own <head>
"""
import pathlib, re, sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
DIST = ROOT / "dist"


def js_ascii(src: str) -> str:
    """JS source with every non-ASCII char escaped, so it survives any charset."""
    out = []
    for ch in src:
        out.append(ch if ord(ch) < 128 else "".join("\\u%04x" % c for c in _units(ch)))
    return "".join(out)


def _units(ch: str):
    n = ord(ch)
    if n < 0x10000:
        return (n,)
    n -= 0x10000                       # astral plane -> surrogate pair
    return (0xD800 + (n >> 10), 0xDC00 + (n & 0x3FF))


def html_ascii(src: str) -> str:
    """HTML with every non-ASCII char as a numeric entity."""
    return "".join(ch if ord(ch) < 128 else "&#%d;" % ord(ch) for ch in src)


def build() -> None:
    html = (ROOT / "index.html").read_text(encoding="utf-8")
    css = (ROOT / "assets/css/app.css").read_text(encoding="utf-8")
    js = "\n".join(
        (ROOT / f"assets/js/{name}.js").read_text(encoding="utf-8")
        for name in ("core", "app")
    )

    if any(ord(c) > 127 for c in css):
        raise SystemExit("app.css must stay ASCII-only so the bundle can be ASCII-only")

    single = html_ascii(html).replace(
        '<link rel="stylesheet" href="assets/css/app.css">',
        "<style>\n" + css + "\n</style>",
    )
    single = re.sub(r'\s*<script src="assets/js/[^"]+"></script>', "", single)
    single = single.replace("</body>", "<script>\n" + js_ascii(js) + "\n</script>\n</body>")
    # a bundled copy has no sibling files to cache or install from
    single = single.replace('<link rel="manifest" href="manifest.webmanifest">\n', "")
    single = single.replace('<link rel="icon" href="assets/icon.svg" type="image/svg+xml">\n', "")
    single = single.replace("navigator.serviceWorker.register('sw.js')",
                            "Promise.resolve()  /* bundled: no service worker */")

    DIST.mkdir(exist_ok=True)
    (DIST / "index.html").write_text(single, encoding="utf-8")

    body = single.split("<body>", 1)[1].rsplit("</body>", 1)[0]
    head_bits = re.search(r"<title>(.*?)</title>", single, re.S).group(0)
    style = re.search(r"<style>.*?</style>", single, re.S).group(0)
    (DIST / "embed.html").write_text(
        head_bits + "\n" + style + "\n" + body.strip() + "\n", encoding="utf-8"
    )

    for f in ("index.html", "embed.html"):
        text = (DIST / f).read_text(encoding="utf-8")
        bad = [c for c in text if ord(c) > 127]
        kb = (DIST / f).stat().st_size / 1024
        print(f"dist/{f}  {kb:.1f} KB  ascii-only={not bad}")
        if bad:
            raise SystemExit(f"{f} still holds non-ASCII: {bad[:5]}")


if __name__ == "__main__":
    build()
