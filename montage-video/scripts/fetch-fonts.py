"""Download static TTFs from Google Fonts into public/fonts and write src/font-list.json."""
import json, re, subprocess, sys, os
FAMILIES = {
    "Space Mono": [400, 700],
    "Special Elite": [400],
    "Cormorant Garamond": [500],
}
out = []
os.makedirs("public/fonts", exist_ok=True)
for fam, weights in FAMILIES.items():
    q = fam.replace(" ", "+") + ":wght@" + ";".join(map(str, weights))
    css = subprocess.run(["curl", "-sS", "-A", "Mozilla/5.0", f"https://fonts.googleapis.com/css2?family={q}"], capture_output=True, text=True, check=True).stdout
    for block in re.findall(r"@font-face\s*{([^}]*)}", css):
        w = re.search(r"font-weight:\s*(\d+)", block).group(1)
        url = re.search(r"url\((https://[^)]+)\)", block).group(1)
        fn = f"{fam.replace(' ', '')}-{w}.ttf"
        subprocess.run(["curl", "-sS", "-o", f"public/fonts/{fn}", url], check=True)
        out.append({"family": fam, "weight": w, "file": f"fonts/{fn}"})
        print(fam, w, fn)
# Thmanyah Sans (Arabic) is added separately from public/fonts/thmanyah (not redistributed here).
json.dump(out, open("src/font-list.json", "w"), indent=1)
