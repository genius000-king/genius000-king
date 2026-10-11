# Decisions log

| ID | Date | Decision | Why | Reversible |
|---|---|---|---|---|
| D-001 | 10-11 | Godot 4.7.2 (Forward+ desktop / Mobile on Android), Blender 4.5.3 scripted assets | Only engine/tools reachable; exports both targets from Linux | yes |
| D-002 | 10-11 | **Art pivot (user steering 17:20):** Hi-Fi-Rush-style comic-book cel shading: hard 2–3 band ramps, inked outlines (inverted hull + screen-space edge pass on desktop), halftone in shadows, flat saturated color, comic VFX (speed lines, graphic bursts, onomatopoeia). Painterly/soft-gradient look retired. | User requirement | no (user-set) |
| D-003 | 10-11 | **Protagonist = blue slime** ("Blu"); human Rae model retired as protagonist | User requirement | no (user-set) |
| D-004 | 10-11 | Camera: third-person default, first-person toggle (setting) | A slime hero's charm (squash/stretch, VFX on the body) is invisible in first person; user originally asked for FP, so FP stays available. Flagged to user. | yes (one setting) |
| D-005 | 10-11 | Story kept; new twist: the lab slime IS Rae — her consciousness poured into Specimen 7 at 04:17 | Preserves all reveals, makes the slime hero meaningful | yes |
| D-006 | 10-11 | Existing ~290 agent-built meshes kept as geometry; recolored to flat cel palettes via material/vertex-color pass + outlines; replaced where they don't fit | Geometry is reusable; shading defines the style | yes |
