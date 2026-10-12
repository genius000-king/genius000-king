# Decisions log

| ID | Date | Decision | Why | Reversible |
|---|---|---|---|---|
| D-001 | 10-11 | Godot 4.7.2 (Forward+ desktop / Mobile on Android), Blender 4.5.3 scripted assets | Only engine/tools reachable; exports both targets from Linux | yes |
| D-002 | 10-11 | **Art pivot (user steering 17:20):** Hi-Fi-Rush-style comic-book cel shading: hard 2–3 band ramps, inked outlines (inverted hull + screen-space edge pass on desktop), halftone in shadows, flat saturated color, comic VFX (speed lines, graphic bursts, onomatopoeia). Painterly/soft-gradient look retired. | User requirement | no (user-set) |
| D-003 | 10-11 | **Protagonist = blue slime** ("Blu"); human Rae model retired as protagonist | User requirement | no (user-set) |
| D-004 | 10-11 | Camera: third-person default, first-person toggle (setting) | A slime hero's charm (squash/stretch, VFX on the body) is invisible in first person; user originally asked for FP, so FP stays available. Flagged to user. | yes (one setting) |
| D-005 | 10-11 | Story kept; new twist: the lab slime IS Rae — her consciousness poured into Specimen 7 at 04:17 | Preserves all reveals, makes the slime hero meaningful | yes |
| D-006 | 10-11 | Existing ~290 agent-built meshes kept as geometry; recolored to flat cel palettes via material/vertex-color pass + outlines; replaced where they don't fit | Geometry is reusable; shading defines the style | yes |
| D-007 | 10-12 | `sl_common.tapered_tube` winding fixed (was 100 % inward → ink hull covered trunks/stems). Flora + Blu regenerated. Audit tool `tools/normals_audit.py` (signed volume + inward-area). | Root-cause fix; evidence `.studio/evidence/blu/fix_tube_normals_before_after.png` | yes |
| D-008 | 10-12 | `hub_ruin_pillar_broken`, `verdant_ground_moss_pad` normals repaired post-export with `tools/fix_normals.py`. FOLLOW-UP: fix in their pack sources, or rerun fix_normals after regenerating those packs. | Unblocks the look now | yes |
| D-009 | 10-12 | Grass drawn in the transparent pass after the screen ink pass (flat painted strokes, no scribble). Depth-only distance fog (height fog washed the comic colors). Linear tonemap. | Comic readability | yes |
