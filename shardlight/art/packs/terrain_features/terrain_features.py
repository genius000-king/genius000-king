"""terrain_features pack (T-A02) — geological / landform assets shared across the seven worlds.

Regenerate everything:
    blender -b --factory-startup --python art/packs/terrain_features/terrain_features.py
Subsets (args after `--`):
    ... -- --only boulders,caves          # families: boulders cliffs arches caves islands crystals misc
    ... -- --only caves --ids tunnel      # only assets whose id contains a substring
    ... -- --merge                        # only (re)merge partial manifests + sheets
Each family writes art/packs/terrain_features/_partial/<family>.json; the merge step writes
game/assets/models/terrain_features/manifest.json and the preview sheets.
"""
import os
import sys
import json
import subprocess

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

import tf_core as tc  # noqa: E402

FAMILIES = ["boulders", "cliffs", "arches", "caves", "islands", "crystals", "misc"]


def parse_args():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    opts = {"only": FAMILIES, "ids": None, "merge_only": False}
    i = 0
    while i < len(argv):
        if argv[i] == "--only":
            opts["only"] = argv[i + 1].split(",")
            i += 2
        elif argv[i] == "--ids":
            opts["ids"] = argv[i + 1].split(",")
            i += 2
        elif argv[i] == "--merge":
            opts["merge_only"] = True
            i += 1
        else:
            i += 1
    return opts


def run_family(fam, ids):
    rec = tc.Recorder(fam)
    # keep entries from a previous (partial) run when only a subset is rebuilt
    prev = os.path.join(tc.PARTIAL_DIR, fam + ".json")
    if ids and os.path.exists(prev):
        with open(prev) as f:
            rec.entries = json.load(f)
    if fam == "boulders":
        import tf_rocks as m
        m.build_boulders(rec, ids)
    elif fam == "cliffs":
        import tf_cliffs as m
        m.build_cliffs(rec, ids)
    elif fam == "arches":
        import tf_arches as m
        m.build_arches(rec, ids)
    elif fam == "caves":
        import tf_caves as m
        m.build_caves(rec, ids)
    elif fam == "islands":
        import tf_islands as m
        m.build_islands(rec, ids)
    elif fam == "crystals":
        import tf_crystals as m
        m.build_crystals(rec, ids)
    elif fam == "misc":
        import tf_misc as m
        m.build_misc(rec, ids)
    rec.write()


def merge():
    assets = []
    for fam in FAMILIES:
        p = os.path.join(tc.PARTIAL_DIR, fam + ".json")
        if os.path.exists(p):
            with open(p) as f:
                assets += json.load(f)
    os.makedirs(tc.MODEL_DIR, exist_ok=True)
    with open(os.path.join(tc.MODEL_DIR, "manifest.json"), "w") as f:
        json.dump({"pack": tc.PACK, "assets": assets}, f, indent=1)
    print("manifest: %d assets" % len(assets))
    try:
        subprocess.run(["python3", os.path.join(HERE, "tf_sheet.py")], check=False)
    except Exception as e:  # pragma: no cover
        print("sheet step skipped:", e)
        import sl_common as sl
        sl.contact_sheet(tc.PACK)


if __name__ == "__main__":
    o = parse_args()
    if not o["merge_only"]:
        for fam in FAMILIES:
            if fam in o["only"]:
                print("== family", fam)
                run_family(fam, o["ids"])
    merge()
