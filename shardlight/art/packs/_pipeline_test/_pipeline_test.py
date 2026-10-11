import sys, os, random, math
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "lib"))
import sl_common as sl
sl.reset()
PACK = "_pipeline_test"
man = sl.Manifest(PACK)
# tree: curved trunk + 3 puff canopies
trunk = sl.tapered_tube("trunk", sl.curve_path((0,0,0),(0.6,0.2,5),(0.8,0,0),8,0.08,1), [0.55,0.45,0.38,0.33,0.3,0.27,0.24,0.22,0.2], sides=10, material="VC_ROUGH")
sl.paint_gradient(trunk, "#6E4A3A", "#B07A5A", 0.05)
puffs=[]
for i,(p,r) in enumerate([((0.6,0.2,5.6),2.2),((1.8,0.4,4.8),1.5),((-0.6,0.0,5.0),1.6),((0.4,1.0,6.6),1.4)]):
    b = sl.blob(f"puff{i}", r, seed=i, squash=(1,1,0.8), noise_amt=0.18, material="VC_FOLIAGE")
    b.location = p; sl.apply_transforms_and_location(b)
    sl.paint_gradient(b, "#2E9E6E", "#B8F27C", 0.07, seed=i, curve=0.8)
    puffs.append(b)
tree = sl.join([trunk]+puffs, "verdant_tree_test")
e = sl.finalize(tree, "verdant_tree_test", PACK, man, "tree", ["verdant"], {"type":"cylinder","radius":0.45,"height":4.5}, {"density":1,"slope_max":25,"min_spacing":6,"cluster":0.4,"zone":"meadow"})
print("TREE", e)
sl.clear_scene_objects()
rock = sl.blob("rock", 1.0, seed=5, squash=(1.3,1,0.7), noise_amt=0.35, subdiv=2, material="VC_ROUGH")
sl.shade_flat(rock)
sl.paint_gradient(rock, "#7C7FB8", "#C3C8EE", 0.08)
sl.tint_top(rock, "#7ED957", 0.7, 0.8)
e = sl.finalize(rock, "verdant_rock_test", PACK, man, "rock", ["verdant"], {"type":"convex"}, {"density":1,"slope_max":40,"min_spacing":3,"cluster":0.6,"zone":"any"})
print("ROCK", e)
man.write()
sl.contact_sheet(PACK)
