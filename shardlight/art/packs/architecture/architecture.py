"""Pack `architecture` — Meridian Institute ruins kit, the Loom, and Harrow's Reach town.

Regenerate everything:   blender -b --factory-startup --python art/packs/architecture/architecture.py
Subset (names or groups): blender -b --factory-startup --python art/packs/architecture/architecture.py -- loom
                          ... -- hub_loom_core harrow_lighthouse   |   groups: loom ruins town all
"""
import os
import sys
import traceback

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from _kit import *  # noqa
import loom  # noqa
import ruins  # noqa
import town  # noqa


def main():
    args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else ["all"]
    reg = {}
    groups = {}
    for gname, mod in (("loom", loom), ("ruins", ruins), ("town", town)):
        reg.update(mod.REGISTRY)
        groups[gname] = list(mod.REGISTRY.keys())
    groups["all"] = [k for g in ("loom", "ruins", "town") for k in groups[g]]
    sel = []
    for a in args:
        if a in groups:
            sel += groups[a]
        elif a == "sheet":
            pass
        else:
            sel += [k for k in reg if k == a or (a.endswith("*") and k.startswith(a[:-1]))]
    man = sl.Manifest(PACK)
    load_manifest(man)
    ok, failed = 0, []
    for aid in sel:
        sl.reset()
        try:
            tris = reg[aid](man)
            print(f"OK   {aid:36s} tris={tris}")
            ok += 1
        except Exception:
            traceback.print_exc()
            failed.append(aid)
            print(f"FAIL {aid}")
    # keep manifest sorted & consistent
    man.assets.sort(key=lambda a: a["id"])
    man.write()
    sl.reset()
    out_dir = os.path.join(sl.PREVIEWS, PACK)
    allpng = sorted(f for f in os.listdir(out_dir) if f.endswith(".png") and not f.startswith("_"))
    sl.contact_sheet(PACK, cols=8, cell=256)
    for gname in ("loom", "ruins", "town"):
        files = [k + ".png" for k in groups[gname] if k + ".png" in allpng]
        sheet(PACK, files, "_sheet_" + gname, cols=8 if gname != "loom" else 4, cell=256)
    print(f"DONE ok={ok} failed={failed}")


main()
