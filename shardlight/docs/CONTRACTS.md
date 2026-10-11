# Code contracts (Godot 4.7.2, GDScript, typed where practical)

Owners write only their paths. Cross-owner changes go through the coordinator.

## Autoloads (load order)
`Settings` (core/settings.gd) → `Audio` (core/audio.gd) → `Story` (story/story.gd) → `Game` (core/game.gd) → `DevTools`.

## Player (`scripts/player/player.gd`, class `Player`, owner: coordinator)
- Nodes: `head` (Node3D) → `camera` (Camera3D) → `viewmodel_anchor` (Node3D at camera origin).
- `add_shake(amount: float)` 0..1.5 · `look_dir() -> Vector3` · `extra_fov: float` (additive, for zoom/charge)
- `gravity_scale: float` (Lift sets < 1) · `external_velocity: Vector3` (dash/knockback impulses, decays)
- `input_locked`, `look_locked` (dialogue/cutscenes) · `velocity` (CharacterBody3D) · `teleport(pos, yaw)`
- Touch UI writes: `move_input: Vector2` (x right, y back; −1..1), `look_input: Vector2` (pixels, accumulated),
  `touch_sprint: bool`. Touch buttons should call `Input.action_press/action_release` for actions.
- Signals: `footstep(surface, running)`, `landed(impact)`, `interact_target_changed(target)`.
- Plug-ins auto-attached in `Player._ready()` when the script exists:
  `res://scripts/weapons/weapon_system.gd` (child "Weapons", must have `setup(player: Player)`),
  `res://scripts/weapons/ability_system.gd` (child "Abilities", `setup(player)`).

## Input actions (registered in Settings)
move_forward/back/left/right, jump, sprint, crouch, interact, fire, alt_fire, weapon_next, weapon_prev,
ability_1, ability_2, ability_3, dash, journal, pause, photo.

## Physics layers
1 world · 2 player · 3 enemy · 4 projectile · 5 interact · 6 water. (bit values 1, 2, 4, 8, 16, 32)

## Damage
Anything damageable: in group `"damageable"`, method `take_damage(amount: float, hit_pos: Vector3, dir: Vector3, kind: String)`.
`kind`: "plasma", "shard", "pulse", "melee". Enemies also implement `apply_stasis(seconds: float)` and
`apply_lift(seconds: float)` if they react to abilities (optional; check `has_method`).
The player implements `take_damage` too (health in `Game.state.health`, max 100) — owned by weapons/abilities agent
via `scripts/weapons/player_health.gd` attached by WeaponSystem.

## Interaction
Any node with `interact(player: Player)` reachable by the camera ray (collision layer 1 or 5, areas allowed)
can be interacted with. Optional `interact_prompt() -> String` (localized text for the HUD), and
`interact_name() -> String`.

## World (`scripts/world/world.gd`, class `ShardWorld`, owner: coordinator)
`world_id`, `def` (WorldDefs dictionary), `field: TerrainField` (`height_at(x,z)`, `normal_at`, `zone_at`),
`player`, `height_at(x,z)`, `surface_at(pos)`. Per-world content script: `res://scripts/worlds/<id>_content.gd`
(Node; `setup(world: ShardWorld)`). HUD plug-in: `res://scripts/ui/hud.gd` (CanvasLayer, `setup(world)`),
touch: `res://scripts/ui/touch_controls.gd` (CanvasLayer, `setup(player)`), added by World when present.

## Story (`scripts/story/story.gd`, autoload `Story`, owner: narrative agent)
Signals the UI listens to:
- `dialogue_started(npc_id: String, display_name: String)`
- `dialogue_line(speaker: String, text: String, choices: Array[String])`  (choices empty → press to advance)
- `dialogue_ended(npc_id: String)`
- `quest_updated(quest_id: String)` · `journal_added(entry_id: String)`
- `echo_played(echo_id: String, title: String, lines: Array)` (memory echo scene text)
- `reveal(reveal_id: String)` (big story moment — HUD shows a cinematic card)
Methods the UI/game call:
- `start_dialogue(npc_id: String)` · `advance()` · `choose(index: int)` · `is_in_dialogue() -> bool`
- `active_quests() -> Array[Dictionary]` ({id, title, objective, done}) · `journal_entries() -> Array[Dictionary]`
- `t(entry: Dictionary) -> String` (picks `ar`/`en` by `Settings.language`)
- `quest_state() -> Dictionary`, `restore_quests(d)` (save/load)
Dialogue data: `game/data/dialogue/<npc_id>.json`; quests: `game/data/quests.json`; echoes: `game/data/echoes.json`.

## Audio
`Audio.play(event, at=null|Vector3|Node3D, volume_offset_db=0, pitch=1)`, `Audio.attach_loop(event, node)`,
`Audio.loop2d(event)`, `Audio.music(event)`, `Audio.ambience(event)`, `Audio.stinger(event)`,
`Audio.play_ui(event)`. Event names: see `game/assets/audio/manifest.json`.

## Game (`scripts/core/game.gd`, autoload `Game`)
`state` dict (abilities, keystones, echoes, flags, quests, health), `has_ability(a)`, `unlock_ability(a)`,
`flag(f)`, `set_flag(f, v)`, `collect_keystone(world)`, `collect_echo(id)`, `message(text, kind)`
(signal `hud_message`), `change_world(id, spawn)`, `save_game()`, `load_game()`, `to_menu()`.
Ability ids: "plasma", "shards", "dash", "lift", "stasis", "tether", "pulse", "sight", "rewind".

## Assets
`AssetDB.instantiate(id) -> Node3D` (stylized), `AssetDB.entry(id)`, `AssetDB.parts(id)`, `AssetDB.shape(id)`.
`Stylizer.material(kind, params)` for VC / VC_FOLIAGE / VC_ROUGH / EMIT / GLASS / WATER.

## Verification tools
- Screenshot: `tools/shot.sh <out.png> <world> <x,y,z> <yawdeg> <pitchdeg> [waitsec] [--exec=method]`
  (software Vulkan ≈ 1 fps; use `RES=960x540` and wait ≥ 40 s for streaming to settle).
- Headless smoke: `godot --headless --path game --quit-after 400 -- --world=verdant` and grep `SCRIPT ERROR`.
- Import after adding assets: `godot --headless --path game --import`.
