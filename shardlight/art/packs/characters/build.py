"""Pack driver:  blender -b --factory-startup --python art/packs/characters/build.py -- [asset ids...]"""
import sys, os, importlib
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from _h import *

ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
ALL = ["marrow", "ilse", "pip", "tansy", "wren", "lumen", "enemy_static_wisp", "enemy_static_warden", "critter_puff", "critter_bird"]


def run(aid):
    mod = importlib.import_module("asset_" + aid if not aid.startswith(("enemy", "critter")) else aid)
    mod.build(MAN)


MAN = sl.Manifest(PACK)
if __name__ == "__main__":
    mf = os.path.join(sl.GAME_MODELS, PACK, "manifest.json")
    if os.path.exists(mf):
        for a in json.load(open(mf))["assets"]:
            MAN.assets.append(a)
    for a in (ARGS or ALL):
        run(a)
    MAN.write()
    if not ARGS:
        sl.contact_sheet(PACK, cols=5, cell=320)
