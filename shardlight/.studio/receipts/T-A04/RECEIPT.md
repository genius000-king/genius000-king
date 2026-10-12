# T-A04 — Verdant Drift flora, comic/cel redesign (status: submitted)

Sheet (cel preview: 2-tone matcap + inverted-hull ink + screen-space ink approximation): `art/previews/verdant_flora/_sheet.png`
Plain Workbench sheet: `_sheet_workbench.png`. Before (old geometry, same cel preview): `.studio/receipts/T-A04/before_cel_sheet.png`.

Regenerate: `art/packs/verdant_flora/run.sh ""` (all 66 + manifest, ~4 min) or `run.sh "glassbirch|willow"` (subset, no manifest write),
then `python3 make_sheet.py - _sheet.png 9 224`. Cel previews: `cel.py` (Blender side, called from `_h.render_preview`) + `compose_cel.py` (numpy/PIL).
`PROFILE=1` env prints per-part tri counts. 66 assets, ids/files/categories/scatter/collision unchanged.

## Global changes (`_h.py`)
- `lobe()/paint_lobe()/canopy()`: canopies = 1 base + 3 chunky scalloped lobes, flat colour per lobe (3 height-stepped tones), painted darker violet underside band + highlight patch. No noise, no confetti.
- `ribbon_bm`: every leaf/petal/blade is solidified (no single-sided triangles) -> closed shells ink cleanly.
- `bark_fn`/`paint_trunk`: flat height-stepped trunk colour + painted vertical grooves, no noise. `floor_value()` lifts any vertex colour to HSV V >= 0.40 (nothing near-black).
- `tube()` radius floor 0.022 m, `blade()` min half-width 0.06 m: every stem/blade can carry an ink line.
- `bake_ao` capped at 0.12 / 16 samples. Materials: `VC_FOLIAGE` canopies/leaves/flowers, `VC`/`VC_ROUGH` trunks, `EMIT` for glow bits.

## Per family
- **glassbirch a/b/c (rewritten)**: pale lavender-white trunks (`VC`, violet painted grooves), 7-9 / 5 / 8 flat-coloured mint-aqua-lime lobes on branch tips (b = layered flat discs, c = + pendant drop lobes), one EMIT crystal gem on the crown. 4880/2972/4240 tris -> 1878/1046/1640 (confetti gone; under the 2000 min but intentionally low-poly).
- **spiralwillow (rewritten)**: twisted warm-brown/lavender trunk, wide flat crown cap + 2 top lobes, 6-9 long teardrop curtain lobes with painted dark tips. Was 150+ thin ribbons.
- **dandelion (rewritten)**: thick stem, 6 broad toothed leaves, heads = chunky core + 26 thick spokes with bead tips (c: open golden flower with 12+10 wide petals + puff bud). Previously black hair.
- **puffcap / umbrellashroom**: kept shapes; new canopy lobes (puffcap), new flat bark. **balloon**: thicker branches/tethers (r 0.07-0.17), 2 wide tuft leaves, flat bark.
- **flowers**: thick stems (r>=0.028), flat 2-tone petals, max 9 petals per ring, widened petals (>=0.05), bigger daisy/star heads, fountain = 8 fat arcs with big bead tips; leaves 3-seg thick blades. Counts trimmed to meet the 1500 budget (nightbloom 2824->1472, cosmos 2664->1608, wildpatch 3216->1464 ...).
- **bushes**: berry/hedge lumps and berries reduced + flat; fern = 9 broad fronds (was 20 jagged), succulent = fat spikes (11+3x6), hedge flowers bigger.
- **ground**: grass tufts = 8-12 chunky 2-tone blades (3 flat steps by height); reeds/cattails same; moss pad/lily/mushrooms reduced to budget.
- **hanging/floating**: vines r>=0.05 with fewer, bigger heart leaves; glowbell vine r 0.08; wisteria bigger beads; roots chunk = 9 thick roots (r 0.11); petals = 15 big shards; lily-island roots thick, grass fringe halved.
- **logs**: bark flat/comic via `bark_fn`; moss tufts fewer & wider (hollow 3790 -> 2878).

## Tris (final)
trees: puffcap 2972/3628/2980 · willow 1716/1464/2048 · balloon 3418/6050/3400 · glassbirch 1878/1046/1640 · dandelion 1388/1475/2096 · umbrellashroom 6384/4644/5328
flowers: tulip 1392x2 · bellflower 1268 · daisy 1268x2 · lupine 1264 · nightbloom 1472 · star 1108 · lotus 1456 · poppy 1546 · pompom 1032 · cosmos 1608 · trumpet 894 · fountain 1408 · wildpatch 1464 · hero sunbloom 5352 / heartbloom 3566
bushes: berry 2280/3020 · topiary 2778 · fern 984 · hedge 2528 · succulent 1624 · puffball 2064 · broadleaf 2088
ground: tufts 432/540/736 · clover 1102 · reeds 1028 · cattails 1312 · moss 1212 · lilypads 1200 · lily_flower 1272 · tiny_mushrooms 1428
hanging: vines 1792 · glowbell 1658 · wisteria 1840 · seedpods 2394 · petals 684 · roots_chunk 2300 · lily_island 1704 · spore_puff 2184
logs: hollow 2878 · mossy 2620 · stump_shrooms 2018 · stump_cut 1608 · branch_pile 2180

Budget notes: over by <=7%: poppy 1546, cosmos 1608, berry_b 3020. Below the tree minimum (2000, deliberately low-poly): willow a/b, glassbirch a/b/c, dandelion a/b.

## Known weaknesses
- `float_petals` is still a loose cluster of small shards (reads weakest); `bush_succulent` and `flower_fountain` are small/flat.
- Cel preview is an approximation (matcap + ink composite); final look depends on the Godot shader. Bark/trunk values are >= 0.40 so they should no longer go near-black.
- No removals/merges needed: all 66 assets kept.
- Lib bugs: none found. (Collision/scatter untouched; willow/glassbirch trunks are slimmer, cylinder collisions unchanged.)
- Decimation was tried for budget and rejected (it deleted thin stems); budgets met by construction instead.
