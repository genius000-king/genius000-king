# Story events

`Story.event(id)` runs `events.json` entries (flag `ev_<id>` makes them fire once unless `"once": false`). Unknown ids only set the flag (warning).

Also: `Story.play_echo(echo_id)` (EchoPickup calls it; `Game.echo_collected` is also hooked), `Story.start_dialogue(npc_id)` (NPC.interact), `Story.bark(npc_id)`, `Story.lumen_say(key)`, `Story.do_reveal(id)`.

| Event id | Fired by | Effects |
|---|---|---|
| `hub_wake` | Hub content: when the crater scene starts (new game) | start_quest=first_light; journal=place_hub; journal=lore_fracture; start_dialogue=lumen |
| `hub_control` | Called by the Lumen prologue after the dialogue ends | lumen_say=tut_move |
| `tut_jump` | Hub: trigger zone at the 0.8 m ledge | lumen_say=tut_jump |
| `tut_interact` | Fired by the crater sign dialogue | lumen_say=tut_interact |
| `hub_vent_near` | Hub: trigger zone at the plasma vent | lumen_say=vent_hint |
| `plasma_first_gulp` | Weapons: first time Blu absorbs plasma | set_flag=gulped; advance_quest=first_light@0; lumen_say=gulp |
| `plasma_first_shot` | Weapons: first plasma shot | set_flag=shot_fired; lumen_say=shot |
| `gate_verdant_awake` | Hub: plasma hits the Verdant gate (or gate wake) | set_flag=gate_verdant_awake; advance_quest=first_light@1; sting=mus_reveal; lumen_say=gate_awake |
| `loom_near` | Hub: zone around the Loom (also fired by the Loom dialogue) | lumen_say=loom_near |
| `arrive_verdant` | verdant_content: zone at the arrival gate | set_flag=in_verdant; advance_quest=first_light@2; journal=place_verdant; lumen_say=verdant_arrive |
| `enter_village` | verdant_content: village zone | lumen_say=village_arrive |
| `verdant_first_jump` | Player: first airborne jump in Verdant (optional) | lumen_say=lowg |
| `static_first_seen` | Enemies: first Static in view (optional) | lumen_say=static_seen |
| `trial_float_start` | verdant_content zone | lumen_say=trial_float_start |
| `trial_float_done` | verdant_content zone (top shrine) | set_flag=trial_float; play_sound=quest_complete; lumen_say=float_done; event=sanctum_open |
| `trial_bloom_start` | verdant_content zone | lumen_say=bloom_start |
| `trial_bloom_wave` | Static spawner: each new wave (optional) | lumen_say=bloom_wave |
| `trial_bloom_done` | Static spawner `cleared` | set_flag=trial_bloom; play_sound=quest_complete; lumen_say=bloom_done; event=sanctum_open |
| `trial_echo_start` | verdant_content zone / grove sign | lumen_say=echo_start |
| `trial_echo_done` | Auto: Story, after echo_trial_1..3 are collected | set_flag=trial_echo; play_sound=quest_complete; lumen_say=grove_done; event=sanctum_open |
| `sanctum_open` | Auto: re-evaluated by every trial_*_done | set_flag=sanctum_open; advance_quest=bloom_bell@2; lumen_say=sanctum_open |
| `enter_sanctum` | verdant_content zone | lumen_say=sanctum_enter |
| `warden_wake` | Static Warden: aggro (optional) | lumen_say=warden_wake |
| `warden_down` | Static Warden: defeated (optional) | set_flag=warden_down; lumen_say=warden_down |
| `keystone_verdant` | Keystone pickup (`Story.event("keystone_"+world_id)`) | set_flag=keystone_taken; give_keystone=verdant; give_ability=lift; sting=mus_keystone; play_sound=keystone_pickup; advance_quest=first_light@3; advance_quest=bloom_bell@3; journal=lore_keystones; journal=lore_lift; lumen_say=lift_get |
| `player_down` | Player health: respawn | lumen_say=down |
| `slice_end` | Auto: fired after the Loom vision dialogue ends | slice_end=True |

## Echoes
`echo_hub_1..2`, `echo_verdant_1..7`, `echo_trial_1..3` (grove; collecting all three fires `trial_echo_done`). Total: 12.

## Signals added to the contract (all optional for UI)
- `lumen_line(text)`: non-modal companion line, queue and auto-hide (~4 s).
- `blu_emote(name)`: drive `player.slime.emote(name)`; names: happy, surprised, angry, sad, blink, determined.
- `event_fired(id)`, `flag_changed(flag, value)`, `slice_ended()` (show the end card using `Story.reveal_info("slice_end")`), `travel_requested(world)`.

## Reveal cards
`reveal(id)` ids: `r1`, `loom_vision` (text via `Story.reveal_info(id)` -> {title, subtitle, text}).

## Other API
`npc_has_marker(npc_id)`, `display_name(npc_id)`, `unlock_journal(id)`, `replay_echo(id)`, `echo_ids()`, `reveal_info(id)`, `check(cond)`, `reset()`, `dry_run` (tests: no scene change, audio or save writes).
Story state is saved via `quest_state()` / `restore_quests(d)` (quests, journal, echoes). Flags live in `Game.state.flags`.

## Story flags other systems may read
`prologue_done`, `gate_verdant_awake`, `trial_float|bloom|echo`, `sanctum_open`, `keystone_taken`, `r1_seen`, `loom_installed`, `slice_end`, `gate_amber_awake`, `reveal_lumen` (future: restores Lumen's `[—DATA LOST—]` lines).

## Dialogue JSON format
See top of `dialogue/lumen.json`-style files: `entries` (first matching `if` wins, `marker:true` shows the "!"), `barks`, `nodes{ id: {speaker, ar, en, next | choices[{ar,en,emote,goto,if,actions}] | branch[{if,goto}], actions, emote} }`.
Conditions: flag, not_flag, quest (`id:done|active|todo`), stage (`id>=2`), ability, keystone, echo, world, any, not.
Actions: set_flag, clear_flag, start/advance/complete_quest, give_ability/keystone/echo, play_sound, sting, reveal, lumen_say, journal, event, emote, message, start_dialogue, travel, after_end, end, slice_end.
Run tests: `godot --headless --path . -s res://scripts/story/story_tests.gd`.
