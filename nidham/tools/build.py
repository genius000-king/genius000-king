#!/usr/bin/env python3
"""Inline CSS/JS into a single file.

  dist/index.html     standalone page — works from file:// with no server
  dist/embed.html     body-only fragment for hosts that supply their own <head>
"""
import pathlib, re, sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
DIST = ROOT / "dist"


def build() -> None:
    html = (ROOT / "index.html").read_text(encoding="utf-8")
    css = (ROOT / "assets/css/app.css").read_text(encoding="utf-8")
    js = "\n".join(
        (ROOT / f"assets/js/{name}.js").read_text(encoding="utf-8")
        for name in ("core", "ui", "app")
    )

    single = html.replace(
        '<link rel="stylesheet" href="assets/css/app.css">',
        "<style>\n" + css + "\n</style>",
    )
    single = re.sub(r'\s*<script src="assets/js/[^"]+"></script>', "", single)
    single = single.replace("</body>", "<script>\n" + js + "\n</script>\n</body>")
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
        kb = (DIST / f).stat().st_size / 1024
        print(f"dist/{f}  {kb:.1f} KB")


if __name__ == "__main__":
    build()
