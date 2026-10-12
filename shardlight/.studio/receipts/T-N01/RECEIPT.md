# T-N01 receipt: narrative systems + bilingual content (M1 slice)

Result: complete. `godot --headless --path game -s res://scripts/story/story_tests.gd` -> 3921 checks, 0 failures, exit 0.

## Delivered
- `game/scripts/story/story.gd` (autoload `Story`): contract API exactly (signals, `start_dialogue/advance/choose/is_in_dialogue`, `active_quests`, `journal_entries`, `t`, `quest_state/restore_quests`), plus `event(id)`, `bark(npc_id)`, `play_echo(id)` (emits `echo_played`), `lumen_say(key)` + `lumen_line` signal, `blu_emote` signal (choice/node `emote`), conditions/actions DSL, staged quests with per-stage journal log, journal "versions" per character, reveals, `[—DATA LOST—]` lines restored after flag `reveal_lumen`, save/restore (survives JSON round trip), `dry_run` for tests (no audio, no save writes, no scene change).
- `game/scripts/npc/npc.gd` (`class_name NPC`, group "npc", interact collider on layer bit 16, `interact()`, `interact_prompt()`, `interact_name()`, faces Blu while talking, idle/talk anim or procedural bob, Label3D name + bouncing "!" marker driven by `Story.npc_has_marker`, ambient barks as a speech bubble, placeholder model when `AssetDB.has(npc_id)` is false). Smoke-tested in headless Godot.
- `game/data/`: 14 dialogue graphs (marrow, ilse, pip, tansy, wren, lumen, loom, gate_verdant, 6 signs), quests (First Light, The Bloom Bell), journal (characters with versions, places, lore, Lumen logs with restored lines), 12 echoes (2 hub, 7 verdant, 3 grove `echo_trial_1..3`, 3-6 lines each), 26 Lumen line keys (once-only or rotating), reveals (r1, loom_vision, slice_end), events, `EVENTS.md` (event table + API + formats).
- Event ids match `verdant_content.gd` (arrive_verdant, enter_village, trial_*_start/done, enter_sanctum, keystone_verdant; `echo:` fallback handled by `play_echo`). The test parses verdant_content.gd and fails if any event id there is undefined.
- Blu is mute: all player "choices" are reactions (`[curious tilt]`, `[happy chirp]`...) with an `emote`; Lumen translates and jokes about it.
- Fixed this session: grove echo wiring (trial_echo_done now triggers on `echo_trial_1..3`), added missing events/echoes/Lumen line, renamed events to level-script ids, gender-neutral Lumen journal text (Lumen is Idris), dry-run safety.

## Tests (story_tests.gd)
Static: valid JSON; every `ar`/`en` pair present, non-empty, <= 200 chars (longest 147), `ar` contains Arabic script, `en` contains none; restored variants paired; all quest/event/journal/reveal/echo/dialogue/node/lumen references resolve; unknown condition/action keys rejected; no unreachable nodes; echoes 3-6 lines. Simulation (run in both ar and en): hub prologue -> gulp -> gate -> Verdant -> Pip/Tansy/Marrow/Ilse/Wren/signs -> 3 trials (grove via echoes) -> sanctum -> Keystone + Lift -> 7 echoes -> R1 reveal -> Loom vision -> slice end, asserting quest stages, flags, reveals, emotes, markers. Plus save/restore round-trip, barks for every NPC in both languages, every Lumen key speaks, Lumen log restoration.

## Revision pass
Cut redundant clauses in 14 of the longest lines (journal pages, Marrow's greeting, Wren's grove/honey lines, Ilse). Honest note: the content was already terse (about 3.3k English words total), so the net cut is ~5%, not 20%; most trimming was in the lines over 105 chars.

## 10 best lines
1. Pip: "Tansy says 'almost' is a lie. I say it's a place, and I live there." / تانزي تقول إنّ «تقريبًا» كذبة. وأنا أقول إنها مكان، وأنا أسكن فيه.
2. Wren: "Everyone says 'ten minutes'. It's the longest unit of time I know." / الكلّ يقول «عشر دقائق». إنها أطول وحدة زمن عرفتُها.
3. Lumen: "Objection logged as 'bloop'. The name stays." / اعتراضك مسجَّل كـ«بلوب». الاسم باقٍ.
4. Lumen: "(Actual: it said 'squeak'. My version is nicer.)" / (الحقيقة: قال «زِق». لكنّ نسختي أجمل.)
5. Ilse: "Don't believe my husband. The Bell hasn't gone silent. It's holding its breath." / لا تصدّق زوجي: الجرس لم يصمت، بل حبس أنفاسه.
6. Marrow (echo): "'Soon' is a long word, Doctor." / «قريبًا»... كلمة طويلة يا دكتور.
7. Tansy: "Obviously we go to the edge." / طبعًا نقترب من الحافّة.
8. Lumen: "A Warden. Ten metres of Static in a terrible hat. Move!" / حارس. عشرة أمتار من التشويش في قبّعة سيّئة. تحرّك!
9. Marrow: "We all carry names heavier than we are. Come, the soup's getting cold." / كلّنا نحمل أسماء أثقل منّا. تعال، الحساء يبرد.
10. Noor (echo): "It echoes twice. Once is physics. Twice is a question." / الصدى يتردّد مرّتين. مرّة واحدة فيزياء؛ مرّتان سؤال.

## Integration notes
- Hub content must fire: `hub_wake` (new game), `plasma_first_gulp`, `plasma_first_shot`, `gate_verdant_awake`, optionally `tut_jump`, `hub_vent_near`, `loom_near`. NPC nodes needed in hub: `lumen` (optional), `loom`, `gate_verdant`, `sign_hub_crater`, `sign_hub_case`; verdant: `sign_verdant_*`.
- HUD should connect `lumen_line` (toast), `blu_emote` (-> `player.slime.emote`), `slice_ended` (card via `Story.reveal_info("slice_end")`), `reveal`.
- `Game.collect_keystone` already saves; Story does not double-grant. `Story` is loaded before `Game`; it touches `Game` only at runtime.
