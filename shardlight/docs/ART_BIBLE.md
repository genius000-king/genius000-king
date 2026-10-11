# SHARDLIGHT — Art bible & asset contract

Every model, shader and VFX in the game follows this file. If something here blocks good work, report it to the
coordinator — do not silently diverge.

## 1. Look — COMIC BOOK 3D, CEL SHADED (user direction, supersedes the earlier painterly look)
Reference game: **Hi-Fi Rush**. The world must look like a living comic book.
- **Cel shading**: hard light/shadow terminator, 2 tones per surface (lit / colored shadow), optional hard spec.
  Shadows are hue-shifted (violet/blue), never grey. Screen-space **halftone dots** deepen shadows.
- **Ink outlines** on everything: inverted-hull outlines per mesh + screen-space ink pass for interior lines.
  Modeling must give the ink something to draw: clear silhouettes, crisp creases, separated shapes
  (a leaf clump is a few big readable lobes, not hundreds of tiny triangles).
- **Flat, rich, saturated color areas**. Color variation comes from *designed color blocking* (distinct parts
  painted distinct flat colors, accent stripes, panel lines), not from noise or smooth gradients. Gradients
  in vertex colors are posterized by the shader — so paint deliberate 2–3-step bands if you want variation.
- **Cartoon proportions**: chunky, exaggerated, appealing. Big shapes; few but crisp details: bolts, seams,
  rims, trims, stitches, cracks drawn as geometry or darker painted lines.
- **Painted, not plastic**: never glossy-smooth blobs. Add drawn detail (painted line accents, cross-hatch
  bands on undersides, highlight shapes painted as flat light color).
- **Comic VFX**: speed lines, graphic star-burst explosions with outlines, flat-color smoke puffs with ink,
  halftone dissolves, impact frames, onomatopoeia text (Arabic + English: «بووم!» KA-BOOM, «طَخ!» ZAP…),
  colored energy auras. Every action has VFX: walking, landing, attacking, charging, abilities, pickups.
- Reference images in docs/refs remain useful for color harmony only (warm key / cool violet shadow).

## 2. Units, axes, origin
- 1 Blender unit = 1 meter. Blender Z-up; glTF exporter converts to Godot Y-up.
- Origin: bottom-center of the asset where it touches the ground (trees: base of trunk; buildings: floor center).
- Characters/creatures face **Blender −Y** (front view), which becomes Godot **+Z** (Godot model-front convention).
- Scale anchors: Rae 1.62 m · player eye 1.6 m · doorway 2.2 m · stair step 0.2 m · small tree 4–6 m ·
  large tree 9–16 m · giant world landmarks 30–120 m.
- Apply all transforms before export.

## 3. Material naming contract (Godot swaps these by name)
| Blender material name | Godot shader | Use |
|---|---|---|
| `VC` | stylized opaque, vertex-color albedo | default for everything |
| `VC_FOLIAGE` | stylized + wind sway (sway increases with local height), double-sided | leaves, grass tufts, flowers, hanging vines |
| `VC_ROUGH` | stylized, stronger brush breakup | rock, bark, ground props |
| `EMIT` | emissive; vertex color × 3.5 energy → glow | crystals, lamps, runes, energy veins |
| `GLASS` | transparent fresnel crystal, tinted by vertex color | windows, ice, prism crystals |
| `WATER` | stylized water (only for small water props) | fountains, puddles |
Material base color in Blender should be white (vertex color carries the color). Use as few materials per asset as
possible (ideally 1–2).

## 4. Vertex color painting (comic: paint flat color *blocks*; `bake_ao` strength ≤ 0.2 or skip)
Use `art/lib/sl_common.py`:
- `paint_gradient(obj, bottom, top, noise=…)` — height gradient + hue/value jitter.
- `paint_faces(obj, fn)` — per-face color by rule.
- `bake_ao(obj, strength)` — Cycles AO baked into vertex colors (multiplies, keeps colors painterly; strength 0.3–0.6).
- Darkest values never pure black; brightest never pure white. Keep saturation high in mid-tones.

## 5. Budgets (Android-aware; Godot auto-generates LODs on import)
| Kind | Triangles |
|---|---|
| small prop / flower / rock | 100 – 1,500 |
| bush / medium prop | 500 – 3,000 |
| tree | 2,000 – 7,000 |
| building / ruin piece | 1,500 – 12,000 |
| side character / creature | 3,000 – 15,000 |
| hero landmark | up to 30,000 |

## 6. Files & naming
- Source script (the editable source): `art/packs/<pack>/<pack>.py` (regenerates every asset of the pack
  deterministically; seed per asset).
- Export: `game/assets/models/<pack>/<asset_id>.glb`
- Preview render: `art/previews/<pack>/<asset_id>.png` (Workbench, 512×512) and a contact sheet
  `art/previews/<pack>/_sheet.png`.
- Asset id: `snake_case`, `<world>_<category>_<name>[_<variant>]`, worlds: `hub`, `verdant`, `amber`, `tide`,
  `ember`, `glass`, `hollow`, `seam`, `common`.
- Pack manifest: `game/assets/models/<pack>/manifest.json`:
```json
{"pack":"verdant_flora","assets":[
 {"id":"verdant_tree_puffcap_a","file":"verdant_tree_puffcap_a.glb","category":"tree","worlds":["verdant"],
  "height":11.2,"radius":3.0,"collision":{"type":"cylinder","radius":0.45,"height":4.0},
  "scatter":{"density":1.0,"slope_max":28,"min_spacing":6.0,"cluster":0.4,"zone":"meadow"},
  "tris":4210}
]}
```
`collision.type`: `none` | `cylinder` (radius,height) | `box` (size [x,y,z]) | `convex` | `trimesh` (buildings only).
`scatter` may be omitted for hand-placed assets (`"scatter":null`). `zone` values: `meadow`, `forest`, `shore`,
`cliff`, `cave`, `plaza`, `any`.

## 7. Per-world palettes (hex)
| World | Key colors | Shadow tint | Sky (top → horizon) |
|---|---|---|---|
| hub — Meridian Crater | lab white #EDEFF7, steel #8C93B5, rift violet #9D6BFF, hazard orange #FF8A3D, dusk grass #6FBF73 | #5B4BB0 | #3A3F8F → #FFB38A |
| verdant — Verdant Drift | grass #7ED957→#C6F57E, leaf #4CC38A, soil #8A5A44, rock lavender #A3A9D6, petals #FF7AA8 #FFD166 #7AE7FF, bark #9B6A4F | #6B5BD6 | #4FB2FF → #FFE7B8 |
| amber — Amber Hours | sand #F5B971 #E8935A, rock #C4644F, teal #2A9D8F, rose gold #F2A7A0, crystal #7DF9E0 | #7A4A8C | #FF9E7A → #FFE0A8 |
| tide — Tidewell | aqua #3FE0D0, deep #1B3B8F, pearl #F2EBFF, coral #FF6F91, kelp #2FBF71 | #2D3C9E | #7FC4FF → #E8F3FF |
| ember — Ember Choir | basalt #2B2238, magma #FF5A1F, magenta #E0218A, gold #FFC23D, ash #6E6077 | #3A1E4D | #3A1E4D → #FF7A59 |
| glass — Glasswake Archive | ice #BDEBFF, lilac #C9B6FF, white #F7FAFF, aurora #6CFFC8 #B46CFF | #4656A8 | #1C2A5A → #8FA8FF |
| hollow — Hollowbloom | violet #4B2A7B, glow #3DFFD8, pink #FF8AD8, dark #1A1030, moss #5B8F4F | #24113F | #120B1F → #3B2466 |

## 8. Preview & review checklist (every asset)
1. Silhouette reads at 30 m (squint test on the contact sheet).
2. No default primitives visible; no flat single-color faces across large areas (gradient/AO present).
3. Origin at base, faces correct direction, transforms applied, within tri budget.
4. Fits its world palette.
5. glb loads in Godot (coordinator check) with materials mapped by name.
