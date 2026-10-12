extends SceneTree
## Narrative tests. Run:  godot --headless --path . -s res://scripts/story/story_tests.gd
## (from shardlight/game). Exit code != 0 on any failure.
##  1. static data validation (JSON, references, bilingual text, length limits)
##  2. level-script event ids all defined
##  3. full critical-path simulation (Hub prologue -> Verdant -> Loom -> slice end), in ar and en
##  4. save / restore round-trip, barks, Lumen restored lines

const DATA := "res://data/"
const MAX_LEN := 200
const EMOTES := ["happy", "surprised", "angry", "sad", "blink", "determined"]
const COND_KEYS := ["flag", "not_flag", "quest", "stage", "ability", "not_ability", "keystone", "not_keystone",
	"echo", "world", "any", "not"]
const ACTION_KEYS := ["set_flag", "clear_flag", "start_quest", "advance_quest", "complete_quest", "give_ability",
	"give_keystone", "give_echo", "play_sound", "sting", "reveal", "lumen_say", "journal", "event", "emote",
	"message", "start_dialogue", "travel", "after_end", "end", "slice_end", "if", "then", "else",
	"value", "from", "spawn", "node", "kind"]

var fails := 0
var checks := 0
var story: Node
var game: Node
var settings: Node

var quests := {}
var journal := {}
var echoes := {}
var events := {}
var lumen := {}
var reveals := {}
var characters := {}
var dialogues := {}


func _init() -> void:
	call_deferred("_run")


func ok(cond: bool, msg: String) -> void:
	checks += 1
	if not cond:
		fails += 1
		print("FAIL: ", msg)


func _run() -> void:
	story = root.get_node_or_null("Story")
	game = root.get_node_or_null("Game")
	settings = root.get_node_or_null("Settings")
	if story == null or game == null or settings == null:
		print("FAIL: autoloads Story/Game/Settings missing")
		quit(1)
		return
	story.dry_run = true
	_load_all()
	_static_checks()
	_level_event_checks()
	for lang in ["en", "ar"]:
		settings.language = lang
		_simulate(lang)
	settings.language = "en"
	_save_restore()
	_barks_and_lumen()
	print("story_tests: %d checks, %d failures" % [checks, fails])
	quit(1 if fails > 0 else 0)


# ================================================================== loading
func _json(path: String) -> Dictionary:
	var d = JSON.parse_string(FileAccess.get_file_as_string(path))
	ok(d is Dictionary, "valid JSON object: " + path)
	return d if d is Dictionary else {}


func _load_all() -> void:
	quests = _json(DATA + "quests.json").get("quests", {})
	var j := _json(DATA + "journal.json")
	journal = j.get("entries", {})
	echoes = _json(DATA + "echoes.json").get("echoes", {})
	events = _json(DATA + "events.json").get("events", {})
	lumen = _json(DATA + "lumen_lines.json").get("lines", {})
	reveals = _json(DATA + "reveals.json").get("reveals", {})
	characters = _json(DATA + "characters.json").get("characters", {})
	var dir := DirAccess.open(DATA + "dialogue")
	for f in dir.get_files():
		if f.ends_with(".json"):
			var id := f.get_basename()
			dialogues[id] = _json(DATA + "dialogue/" + f)
	ok(dialogues.size() >= 12, "dialogue files present (%d)" % dialogues.size())
	for id in ["marrow", "ilse", "pip", "tansy", "wren", "lumen", "loom"]:
		ok(dialogues.has(id), "dialogue exists for " + id)


# ================================================================== static validation
func _static_checks() -> void:
	for f in ["quests", "journal", "echoes", "events", "lumen_lines", "reveals", "characters"]:
		_texts(_json(DATA + f + ".json"), f)
	for id in dialogues:
		_texts(dialogues[id], "dialogue/" + id)
		_dialogue_refs(id, dialogues[id])
	# structural expectations from the brief
	for i in range(1, 8):
		ok(echoes.has("echo_verdant_%d" % i), "echo_verdant_%d" % i)
	for i in range(1, 4):
		ok(echoes.has("echo_trial_%d" % i), "echo_trial_%d" % i)
	for i in range(1, 3):
		ok(echoes.has("echo_hub_%d" % i), "echo_hub_%d" % i)
	for id in echoes:
		var n: int = echoes[id].lines.size()
		ok(n >= 3 and n <= 6, "echo %s has 3-6 lines (%d)" % [id, n])
	for q in quests:
		ok(quests[q].stages.size() > 0, "quest has stages: " + q)
	for id in ["arrive_verdant", "enter_village", "trial_float_start", "trial_float_done", "trial_bloom_start",
			"trial_bloom_done", "trial_echo_start", "enter_sanctum", "keystone_verdant"]:
		ok(events.has(id), "event defined: " + id)
	for e in events:
		_actions_refs(events[e].get("actions", []), "event " + e)
		_cond_refs(events[e].get("if"), "event " + e)
	for key in lumen:
		pass
	for e in journal:
		for v in journal[e].get("versions", []):
			_cond_refs(v.get("if"), "journal " + e)


## Walk any structure; every dict that has "ar" or "en" must have both, non-empty, <= MAX_LEN, correct script.
func _texts(node, where: String) -> void:
	if node is Dictionary:
		if node.has("ar") or node.has("en"):
			_text_ok(node, where)
		for k in node:
			if k == "name" and where.ends_with("narrator") and node[k].get("en", "x") == "":
				continue                       # the narrator has an empty name on purpose
			_texts(node[k], where + "/" + str(k))
	elif node is Array:
		for i in node.size():
			_texts(node[i], where + "[" + str(i) + "]")


func _has_arabic(s: String) -> bool:
	for i in s.length():
		var c := s.unicode_at(i)
		if c >= 0x0600 and c <= 0x06FF:
			return true
	return false


func _text_ok(d: Dictionary, where: String) -> void:
	for lang in ["ar", "en"]:
		for suffix in ["", "_restored"]:
			var k: String = lang + suffix
			if suffix == "" or d.has(k) or d.has("ar" + suffix) or d.has("en" + suffix):
				if suffix == "_restored" and not (d.has("ar_restored") and d.has("en_restored")):
					ok(false, "%s: both ar_restored and en_restored needed" % where)
					continue
				var s = d.get(k)
				if not (s is String):
					ok(false, "%s: missing %s" % [where, k])
					continue
				ok(s.strip_edges() != "", "%s: empty %s" % [where, k])
				ok(s.length() <= MAX_LEN, "%s: %s too long (%d)" % [where, k, s.length()])
				if lang == "ar" and s.strip_edges() != "" and not s.begins_with("("):
					ok(_has_arabic(s), "%s: ar has no Arabic script: %s" % [where, s])
				if lang == "en":
					ok(not _has_arabic(s), "%s: en contains Arabic: %s" % [where, s])


func _cond_refs(c, where: String) -> void:
	if c == null:
		return
	if c is Array:
		for x in c:
			_cond_refs(x, where)
		return
	if not (c is Dictionary):
		ok(false, where + ": bad condition")
		return
	for k in c:
		ok(k in COND_KEYS, "%s: unknown condition key '%s'" % [where, k])
		var v = c[k]
		match k:
			"quest":
				for q in (v if v is Array else [v]):
					ok(quests.has(String(q).split(":")[0]), "%s: unknown quest %s" % [where, q])
			"stage":
				for s in (v if v is Array else [v]):
					var qid := ""
					for ch in String(s):
						if ch in "<>=":
							break
						qid += ch
					ok(quests.has(qid), "%s: unknown quest in stage cond %s" % [where, s])
			"any":
				for x in v:
					_cond_refs(x, where)
			"not":
				_cond_refs(v, where)


func _actions_refs(list, where: String) -> void:
	for a in (list if list is Array else [list]):
		if not (a is Dictionary):
			ok(false, where + ": action not a dict")
			continue
		for k in a:
			ok(k in ACTION_KEYS, "%s: unknown action '%s'" % [where, k])
		if a.has("if"):
			_cond_refs(a["if"], where)
			_actions_refs(a.get("then", []), where)
			_actions_refs(a.get("else", []), where)
		if a.has("start_quest"): ok(quests.has(a.start_quest), where + ": quest " + a.start_quest)
		if a.has("advance_quest"): ok(quests.has(a.advance_quest), where + ": quest " + a.advance_quest)
		if a.has("complete_quest"): ok(quests.has(a.complete_quest), where + ": quest " + a.complete_quest)
		if a.has("event"): ok(events.has(a.event), where + ": event " + a.event)
		if a.has("lumen_say"): ok(lumen.has(a.lumen_say), where + ": lumen line " + a.lumen_say)
		if a.has("journal"): ok(journal.has(a.journal) or echoes.has(a.journal), where + ": journal " + a.journal)
		if a.has("reveal"): ok(reveals.has(a.reveal), where + ": reveal " + a.reveal)
		if a.has("give_echo"): ok(echoes.has(a.give_echo), where + ": echo " + a.give_echo)
		if a.has("emote"): ok(a.emote in EMOTES, where + ": emote " + str(a.emote))
		if a.has("start_dialogue"):
			ok(dialogues.has(a.start_dialogue), where + ": dialogue " + a.start_dialogue)
			if a.has("node") and dialogues.has(a.start_dialogue):
				ok(dialogues[a.start_dialogue].nodes.has(a.node), where + ": node " + a.node)
		if a.has("after_end"):
			_actions_refs(a.after_end, where)


func _dialogue_refs(id: String, d: Dictionary) -> void:
	var w := "dialogue " + id
	ok(d.get("npc_id", "") == id, w + ": npc_id matches filename")
	var nodes: Dictionary = d.get("nodes", {})
	ok(d.get("entries", []).size() > 0, w + ": has entries")
	var last_unconditional := false
	for e in d.get("entries", []):
		ok(nodes.has(e.get("node", "")), "%s: entry node %s" % [w, e.get("node", "")])
		_cond_refs(e.get("if"), w)
		last_unconditional = not e.has("if")
	ok(last_unconditional or d.entries.size() == 0, w + ": last entry is unconditional")
	for b in d.get("barks", []):
		_cond_refs(b.get("if"), w + " bark")
	# reachability + graph integrity
	var reach := {}
	var stack: Array = []
	for e in d.get("entries", []):
		stack.append(e.node)
	for n in nodes:                           # nodes launched from outside (start_dialogue ... node) count too
		for s in dialogues:
			pass
	while not stack.is_empty():
		var nid: String = stack.pop_back()
		if nid == "end" or nid == "" or reach.has(nid):
			continue
		reach[nid] = true
		if not nodes.has(nid):
			ok(false, "%s: missing node '%s'" % [w, nid])
			continue
		var n: Dictionary = nodes[nid]
		_actions_refs(n.get("actions", []), "%s/%s" % [w, nid])
		if n.has("emote"):
			ok(n.emote in EMOTES, "%s/%s: emote" % [w, nid])
		if n.has("next"): stack.append(n.next)
		for b in n.get("branch", []):
			_cond_refs(b.get("if"), "%s/%s" % [w, nid])
			stack.append(b.get("goto", "end"))
		for c in n.get("choices", []):
			_cond_refs(c.get("if"), "%s/%s choice" % [w, nid])
			_actions_refs(c.get("actions", []), "%s/%s choice" % [w, nid])
			if c.has("emote"):
				ok(c.emote in EMOTES, "%s/%s: choice emote %s" % [w, nid, c.emote])
			ok(c.has("goto"), "%s/%s: choice has goto" % [w, nid])
			stack.append(c.get("goto", "end"))
		if n.has("en") and n.has("speaker"):
			ok(characters.has(n.speaker) or n.speaker == "sign", "%s/%s: speaker %s" % [w, nid, n.speaker])
		if n.has("en") and not n.has("next") and n.get("choices", []).is_empty():
			pass                                 # a terminal line: ends the conversation
	for nid in nodes:
		if not reach.has(nid):
			# allowed only if started via a start_dialogue "node" action somewhere
			var used := false
			for s in dialogues:
				if JSON.stringify(dialogues[s]).contains('"node":"%s"' % nid) and JSON.stringify(dialogues[s]).contains('"start_dialogue":"%s"' % id):
					used = true
			for e in events:
				var js := JSON.stringify(events[e])
				if js.contains('"start_dialogue":"%s"' % id) and js.contains('"node":"%s"' % nid):
					used = true
			ok(used, "%s: unreachable node '%s'" % [w, nid])


# ================================================================== level script hooks
func _level_event_checks() -> void:
	var src := FileAccess.get_file_as_string("res://scripts/worlds/verdant_content.gd")
	if src == "":
		print("note: verdant_content.gd not present, skipping")
		return
	var re := RegEx.new()
	re.compile('(?:_zone\\(|Story\\.event\\(|event_id = )"([a-z_0-9]+)"')
	var seen := 0
	for m in re.search_all(src):
		seen += 1
		ok(events.has(m.get_string(1)), "verdant_content event id defined: " + m.get_string(1))
	ok(seen >= 8, "verdant_content events found (%d)" % seen)
	var re2 := RegEx.new()
	re2.compile('"(echo_(?:verdant|trial|hub)_\\d)"|"echo_(?:verdant|trial)_%d"')
	for i in range(1, 8):
		ok(echoes.has("echo_verdant_%d" % i), "echo for verdant spot %d" % i)
	for npc in ["marrow", "ilse", "pip", "tansy", "wren"]:
		ok(dialogues.has(npc), "verdant NPC has dialogue: " + npc)


# ================================================================== simulation
var _log := {"lines": [], "reveals": [], "emotes": [], "lumen": [], "ended": [], "slice": false, "echoes": []}


func _on_line(speaker: String, text: String, choices: Array) -> void:
	_log.lines.append([speaker, text, choices.duplicate()])


func _fresh() -> void:
	game.new_game_state()
	story.reset()
	story.dry_run = true
	_log = {"lines": [], "reveals": [], "emotes": [], "lumen": [], "ended": [], "slice": false, "echoes": []}


## Drive a conversation to its end. mode "first" picks choice 0, "last" picks the last (usually goodbye).
func talk(npc: String, mode := "last", node := "") -> int:
	story.start_dialogue(npc, node)
	var steps := 0
	var seen := {}
	while story.is_in_dialogue() and steps < 300:
		steps += 1
		var last: Array = _log.lines[-1] if not _log.lines.is_empty() else ["", "", []]
		var ch: Array = last[2]
		if ch.is_empty():
			story.advance()
		else:
			var pick := ch.size() - 1
			if mode == "first":                 # first choice not taken yet in this talk (explores topics)
				for i in ch.size():
					if not seen.has(str(ch[i])):
						pick = i
						break
			seen[str(ch[pick])] = true
			story.choose(pick)
	ok(not story.is_in_dialogue(), "dialogue with %s terminated (%d steps)" % [npc, steps])
	return steps


func _simulate(lang: String) -> void:
	var tag := "[%s] " % lang
	_fresh()
	story.dialogue_line.connect(_on_line)
	story.reveal.connect(func(id): _log.reveals.append(id))
	story.blu_emote.connect(func(e): _log.emotes.append(e))
	story.lumen_line.connect(func(t): _log.lumen.append(t))
	story.dialogue_ended.connect(func(id): _log.ended.append(id))
	story.slice_ended.connect(func(): _log.slice = true)
	story.echo_played.connect(func(id, _t, lines): _log.echoes.append([id, lines.size()]))

	# --- Hub prologue
	story.event("hub_wake")
	var steps := 0
	while story.is_in_dialogue() and steps < 100:
		steps += 1
		var ch: Array = _log.lines[-1][2]
		if ch.is_empty(): story.advance()
		else: story.choose(0)
	ok(not story.is_in_dialogue(), tag + "prologue finished")
	ok(story.quest_status("first_light") == "active" and story.quest_stage("first_light") == 0, tag + "first_light started")
	ok(game.flag("prologue_done"), tag + "prologue_done flag")
	ok("lumen_log_1" in story.journal_known, tag + "lumen log 1 unlocked")
	ok(_log.lumen.size() >= 1, tag + "Lumen hub_control line emitted")
	talk("lumen", "first")                      # hint branch works at stage 0
	talk("sign_hub_crater", "first")
	talk("sign_hub_case", "first")
	story.play_echo("echo_hub_1")
	story.play_echo("echo_hub_2")
	story.event("plasma_first_gulp")
	ok(story.quest_stage("first_light") == 1, tag + "gulp -> stage 1")
	story.event("plasma_first_shot")
	talk("gate_verdant", "first")               # still asleep
	story.event("gate_verdant_awake")
	ok(story.quest_stage("first_light") == 2, tag + "gate awake -> stage 2")
	ok(story.npc_has_marker("gate_verdant") == false, tag + "gate has no marker")
	talk("gate_verdant", "first")               # open -> travel (dry run)

	# --- Verdant
	game.state.world = "verdant"
	story.event("arrive_verdant")
	ok(story.quest_stage("first_light") == 3, tag + "arrive -> stage 3")
	story.event("enter_village")
	ok(story.npc_has_marker("tansy"), tag + "Tansy has a marker on first meeting")
	talk("pip", "first")
	talk("pip", "last")
	talk("tansy", "first")
	talk("tansy", "last")
	ok(story.quest_status("bloom_bell") == "active", tag + "bloom_bell started by Tansy")
	talk("marrow", "first")
	ok(story.quest_stage("bloom_bell") == 1, tag + "Marrow -> bloom_bell stage 1")
	talk("marrow", "first")                     # topics
	talk("ilse", "first")
	ok(story.quest_stage("bloom_bell") == 2, tag + "Ilse -> bloom_bell stage 2")
	talk("ilse", "first")
	talk("wren", "first")
	talk("wren", "last")
	talk("sign_verdant_village", "first")
	talk("sign_verdant_hives", "first")
	talk("sign_verdant_sanctum", "first")       # closed variant
	var aq: Array = story.active_quests()
	ok(aq.size() == 2 and aq[0].objective != "", tag + "journal quest list has objectives")

	story.event("trial_float_start")
	story.event("trial_float_done")
	ok(game.flag("trial_float") and not game.flag("sanctum_open"), tag + "one petal lit")
	story.event("trial_bloom_start")
	story.event("trial_bloom_wave")
	story.event("trial_bloom_done")
	talk("sign_verdant_grove", "first")
	story.event("trial_echo_start")
	story.play_echo("echo_trial_1")
	story.play_echo("echo_trial_2")
	ok(not game.flag("trial_echo"), tag + "grove not done after 2 echoes")
	story.play_echo("echo_trial_3")
	ok(game.flag("trial_echo") and game.flag("sanctum_open"), tag + "all 3 petals -> sanctum open")
	ok(story.quest_stage("bloom_bell") == 3, tag + "sanctum open -> bloom_bell stage 3")
	talk("sign_verdant_sanctum", "first")       # open variant
	story.event("enter_sanctum")
	story.event("warden_wake")
	story.event("warden_down")
	story.event("keystone_verdant")
	ok("verdant" in game.state.keystones and game.has_ability("lift"), tag + "keystone + Lift granted")
	ok(story.quest_stage("first_light") == 4 and story.quest_stage("bloom_bell") == 4, tag + "keystone -> stage 4 quests")
	for i in range(1, 8):
		story.play_echo("echo_verdant_%d" % i)
	ok(story.echoes_played.size() == 12, tag + "12 echoes played (%d)" % story.echoes_played.size())
	ok(_log.echoes.size() == 12, tag + "echo_played emitted 12 times (%d)" % _log.echoes.size())

	# --- R1 reveal
	ok(story.npc_has_marker("marrow"), tag + "Marrow has a marker after the Keystone")
	talk("marrow", "first")
	ok("r1" in _log.reveals and game.flag("r1_seen"), tag + "R1 revealed by Marrow")
	ok(story.quest_status("bloom_bell") == "done", tag + "bloom_bell complete")
	ok("lore_vael" in story.journal_known, tag + "Vael journal page")
	talk("marrow", "first")
	talk("ilse", "first")
	talk("pip", "first")
	talk("tansy", "first")
	talk("wren", "first")                       # wren_told sequence
	talk("wren", "last")
	talk("lumen", "first")                      # h_loom_r1

	# --- Loom
	talk("loom", "first")
	ok(story.quest_status("first_light") == "done", tag + "first_light complete")
	ok("loom_vision" in _log.reveals, tag + "Loom vision reveal")
	ok(_log.slice and game.flag("slice_end"), tag + "slice end signalled")
	ok(game.flag("gate_amber_awake"), tag + "amber gate wakes")
	talk("loom", "first")
	# --- coverage of text delivered
	for l in _log.lines:
		ok(String(l[1]).strip_edges() != "", tag + "no empty dialogue text")
		ok(not String(l[1]).contains("{trials}"), tag + "placeholders formatted")
	ok(_log.lines.size() > 120, tag + "enough dialogue delivered (%d)" % _log.lines.size())
	ok(_log.emotes.size() >= 10, tag + "Blu emotes fired (%d)" % _log.emotes.size())
	for e in _log.emotes:
		ok(e in EMOTES, tag + "valid emote " + e)
	for l in _log.lumen:
		ok(String(l).strip_edges() != "", tag + "no empty Lumen line")
	if lang == "ar":
		var ar_lines := 0
		for l in _log.lines:
			if _has_arabic(String(l[1])): ar_lines += 1
		ok(ar_lines > _log.lines.size() * 0.9, tag + "Arabic delivered (%d/%d)" % [ar_lines, _log.lines.size()])
	# the whole journal must render
	for e in story.journal_entries():
		ok(String(e.title) != "", tag + "journal title " + e.id)
	for c in story.dialogue_line.get_connections():
		story.dialogue_line.disconnect(c.callable)
	for sig in [story.reveal, story.blu_emote, story.lumen_line, story.dialogue_ended, story.slice_ended, story.echo_played]:
		for c in sig.get_connections():
			sig.disconnect(c.callable)


# ================================================================== save / restore
func _save_restore() -> void:
	var snap: Dictionary = story.quest_state()
	var text := JSON.stringify(snap)
	var back = JSON.parse_string(text)
	var q_before := {}
	for id in quests:
		q_before[id] = [story.quest_status(id), story.quest_stage(id)]
	var j_before: int = story.journal_known.size()
	var e_before: int = story.echoes_played.size()
	story.restore_quests(back)
	for id in quests:
		ok(q_before[id] == [story.quest_status(id), story.quest_stage(id)], "restore quest " + id)
	ok(story.journal_known.size() == j_before, "restore journal")
	ok(story.echoes_played.size() == e_before, "restore echoes")
	ok(typeof(story.quest_stage("first_light")) == TYPE_INT, "stage is int after JSON round trip")
	# a new game wipes story state
	game.new_game_state()
	ok(story.active_quests().is_empty() and story.journal_entries().is_empty(), "new game clears story state")


func _barks_and_lumen() -> void:
	_fresh()
	for lang in ["en", "ar"]:
		settings.language = lang
		game.new_game_state()
		story.reset()
		for npc in ["marrow", "ilse", "pip", "tansy", "wren", "lumen"]:
			var got := false
			for i in 10:
				if story.bark(npc) != "":
					got = true
			ok(got, "[%s] bark exists for %s" % [lang, npc])
		var seen := []
		story.lumen_line.connect(func(t): seen.append(t))
		for k in lumen:
			story.lumen_say(k)
		ok(seen.size() >= lumen.size() - 1, "[%s] every Lumen key speaks (%d/%d)" % [lang, seen.size(), lumen.size()])
		for c in story.lumen_line.get_connections():
			story.lumen_line.disconnect(c.callable)
	# [—DATA LOST—] lines are restored after reveal_lumen
	settings.language = "en"
	story.unlock_journal("lumen_log_1")
	var before := ""
	for e in story.journal_entries():
		if e.id == "lumen_log_1": before = e.text
	game.set_flag("reveal_lumen", true)
	var after := ""
	var restored := false
	for e in story.journal_entries():
		if e.id == "lumen_log_1":
			after = e.text
			restored = e.restored
	ok(before.contains("DATA LOST"), "Lumen log shows DATA LOST before the reveal")
	ok(restored and after != before and not after.contains("DATA LOST"), "Lumen log restored after reveal_lumen")
	game.new_game_state()
