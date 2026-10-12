extends Node
## Story runtime (autoload `Story`): dialogue graphs, quests, journal, memory echoes, reveals,
## Lumen's companion lines, level events. Data lives in res://data (see data/EVENTS.md).
## Blu is mute: player "choices" are Blu's reactions; Lumen "translates".

signal dialogue_started(npc_id: String, display_name: String)
signal dialogue_line(speaker: String, text: String, choices: Array[String])
signal dialogue_ended(npc_id: String)
signal quest_updated(quest_id: String)
signal journal_added(entry_id: String)
signal echo_played(echo_id: String, title: String, lines: Array)
signal reveal(reveal_id: String)
# --- additions (non-breaking) ---
signal lumen_line(text: String)                 ## non-modal companion line (UI should queue + auto-hide)
signal blu_emote(emote_name: String)            ## Blu reacted: drive SlimeBody.emote()
signal event_fired(event_id: String)
signal flag_changed(flag: String, value)
signal slice_ended()                            ## M1 slice end card
signal travel_requested(world_id: String)

const DATA := "res://data/"
const GROVE_ECHOES := ["echo_trial_1", "echo_trial_2", "echo_trial_3"]
const PARAM_KEYS := ["value", "from", "spawn", "then", "else", "node", "kind"]

var quests := {}                 # id -> {stage:int, done:bool, order:int}
var journal_known: Array = []    # unlocked journal entry ids, in order
var echoes_played: Array = []
var dry_run := false             # tests: never change scenes

var _bound_state = null
var _order := 0
var _quest_defs := {}
var _journal_defs := {}
var _worlds := {}
var _echo_defs := {}
var _event_defs := {}
var _lumen_lines := {}
var _reveal_defs := {}
var _characters := {}
var _dlg_cache := {}
var _rot := {}                   # rotation counters for variant lines
var _last_bark := {}

var _in_dialogue := false
var _cur_npc := ""
var _cur_node := ""
var _cur_data := {}
var _cur_choices: Array = []
var _after_end: Array = []


func _ready() -> void:
	reload_data()
	call_deferred("_hook_game")


func reload_data() -> void:
	_dlg_cache.clear()
	_quest_defs = _load(DATA + "quests.json").get("quests", {})
	var j: Dictionary = _load(DATA + "journal.json")
	_journal_defs = j.get("entries", {})
	_worlds = j.get("worlds", {})
	_echo_defs = _load(DATA + "echoes.json").get("echoes", {})
	_event_defs = _load(DATA + "events.json").get("events", {})
	_lumen_lines = _load(DATA + "lumen_lines.json").get("lines", {})
	_reveal_defs = _load(DATA + "reveals.json").get("reveals", {})
	_characters = _load(DATA + "characters.json").get("characters", {})


func _load(path: String) -> Dictionary:
	if not FileAccess.file_exists(path):
		push_error("Story: missing " + path)
		return {}
	var d = JSON.parse_string(FileAccess.get_file_as_string(path))
	if typeof(d) != TYPE_DICTIONARY:
		push_error("Story: bad JSON " + path)
		return {}
	return d


func _hook_game() -> void:
	if Game and not Game.echo_collected.is_connected(_on_game_echo):
		Game.echo_collected.connect(_on_game_echo)


func _on_game_echo(id: String) -> void:
	if _echo_defs.has(id) and not (id in echoes_played):
		play_echo(id)


# ------------------------------------------------------------------ state sync
func _sync() -> void:
	## A new game (Game.new_game_state) swaps Game.state: drop our per-game data lazily.
	if _bound_state != Game.state:
		_bound_state = Game.state
		quests = {}
		journal_known = []
		echoes_played = []
		_order = 0
		_rot = {}
		_in_dialogue = false
		_cur_npc = ""


func reset() -> void:
	_bound_state = null
	_sync()


func quest_state() -> Dictionary:
	_sync()
	return {"quests": quests, "journal": journal_known, "echoes": echoes_played, "order": _order}


func restore_quests(q: Dictionary) -> void:
	_bound_state = Game.state
	_rot = {}
	_in_dialogue = false
	if q.has("quests"):
		quests = q.get("quests", {})
		journal_known = q.get("journal", [])
		echoes_played = q.get("echoes", [])
		_order = int(q.get("order", quests.size()))
	else:                                   # legacy: plain quest dict
		quests = q
		journal_known = []
		echoes_played = []
		_order = quests.size()
	for id in quests:                       # JSON turns ints into floats
		quests[id]["stage"] = int(quests[id].get("stage", 0))


func _flag(f: String) -> bool:
	return bool(Game.flag(f))


func set_flag(f: String, v = true) -> void:
	_sync()
	Game.set_flag(f, v)
	flag_changed.emit(f, v)


# ------------------------------------------------------------------ text
func t(entry) -> String:
	if entry is String:
		return entry
	if not (entry is Dictionary):
		return ""
	var lang: String = Settings.language
	if lang != "ar":
		lang = "en"
	if Game.flag("reveal_lumen") and entry.has(lang + "_restored"):
		return _fmt(str(entry[lang + "_restored"]))
	var s: String = str(entry.get(lang, ""))
	if s == "":
		s = str(entry.get("en", ""))
	return _fmt(s)


func _loc(d: Dictionary, key: String) -> String:
	return t(d.get(key, ""))


func _fmt(s: String) -> String:
	if s.contains("{trials}"):
		s = s.replace("{trials}", str(_trial_count()))
	return s


func _trial_count() -> int:
	var n := 0
	for f in ["trial_float", "trial_bloom", "trial_echo"]:
		if _flag(f):
			n += 1
	return n


func speaker_name(id: String) -> String:
	var c: Dictionary = _characters.get(id, {})
	if c.has("name"):
		return t(c.name)
	return ""


func display_name(npc_id: String) -> String:
	var d := _dialogue(npc_id)
	if d.has("name"):
		return t(d.name)
	return speaker_name(npc_id)


# ------------------------------------------------------------------ conditions
func check(cond) -> bool:
	if cond == null:
		return true
	if cond is Array:
		for c in cond:
			if not check(c):
				return false
		return true
	if not (cond is Dictionary):
		return false
	for k in cond:
		var v = cond[k]
		match k:
			"flag":
				for f in _arr(v):
					if not _flag(f):
						return false
			"not_flag":
				for f in _arr(v):
					if _flag(f):
						return false
			"quest":
				for q in _arr(v):
					if not _quest_cond(q):
						return false
			"stage":
				for s in _arr(v):
					if not _stage_cond(s):
						return false
			"ability":
				for a in _arr(v):
					if not Game.has_ability(a):
						return false
			"not_ability":
				for a in _arr(v):
					if Game.has_ability(a):
						return false
			"keystone":
				for w in _arr(v):
					if not (w in Game.state.keystones):
						return false
			"not_keystone":
				for w in _arr(v):
					if w in Game.state.keystones:
						return false
			"echo":
				for e in _arr(v):
					if not (e in echoes_played):
						return false
			"world":
				if Game.state.get("world", "hub") != v:
					return false
			"any":
				var ok := false
				for c in v:
					if check(c):
						ok = true
						break
				if not ok:
					return false
			"not":
				if check(v):
					return false
			_:
				push_error("Story: unknown condition '%s'" % k)
				return false
	return true


func _arr(v) -> Array:
	return v if v is Array else [v]


func _quest_cond(s: String) -> bool:
	var p := s.split(":")
	var st := quest_status(p[0])
	var want: String = p[1] if p.size() > 1 else "active"
	return st == want


func _stage_cond(s: String) -> bool:
	for op in [">=", "<=", "==", "<", ">"]:
		var i := s.find(op)
		if i > 0:
			var id := s.substr(0, i)
			var n := int(s.substr(i + op.length()))
			var cur := quest_stage(id)
			match op:
				">=": return cur >= n
				"<=": return cur <= n and cur >= 0
				"==": return cur == n
				"<": return cur < n and cur >= 0
				">": return cur > n
	push_error("Story: bad stage condition " + s)
	return false


# ------------------------------------------------------------------ quests
func quest_status(id: String) -> String:
	_sync()
	if not quests.has(id):
		return "todo"
	return "done" if quests[id].done else "active"


func quest_stage(id: String) -> int:
	_sync()
	return int(quests[id].stage) if quests.has(id) else -1


func start_quest(id: String) -> void:
	_sync()
	if quests.has(id):
		return
	if not _quest_defs.has(id):
		push_error("Story: unknown quest " + id)
		return
	_order += 1
	quests[id] = {"stage": 0, "done": false, "order": _order}
	quest_updated.emit(id)
	Game.message(t(_quest_defs[id].title), "quest")
	_sfx("notify")


func advance_quest(id: String, from := -1) -> void:
	_sync()
	if not quests.has(id) or quests[id].done:
		return
	if from >= 0 and int(quests[id].stage) != from:
		return
	var last: int = _quest_defs[id].stages.size() - 1
	quests[id].stage = mini(int(quests[id].stage) + 1, last)
	quest_updated.emit(id)
	_sfx("notify")


func complete_quest(id: String) -> void:
	_sync()
	if not quests.has(id):
		start_quest(id)
	if not quests.has(id) or quests[id].done:
		return
	quests[id].done = true
	quest_updated.emit(id)
	Game.message(t(_quest_defs[id].title), "quest_done")
	_sfx("quest_complete")


func active_quests() -> Array[Dictionary]:
	_sync()
	var out: Array[Dictionary] = []
	var ids := quests.keys()
	ids.sort_custom(func(a, b): return quests[a].order < quests[b].order)
	for id in ids:
		var def: Dictionary = _quest_defs.get(id, {})
		if def.is_empty():
			continue
		var stages: Array = def.stages
		var st: int = clampi(int(quests[id].stage), 0, stages.size() - 1)
		var done: bool = quests[id].done
		var log: Array[String] = []
		for i in range(0, st + 1):
			log.append(t(stages[i].get("journal", "")))
		out.append({
			"id": id,
			"log": log,
			"title": _loc(def, "title"),
			"objective": "" if done else t(stages[st].objective),
			"done": done,
			"stage": st,
			"main": bool(def.get("main", false)),
		})
	return out


# ------------------------------------------------------------------ journal
func _unlock(id: String) -> void:
	_sync()
	if id in journal_known:
		return
	if not _journal_defs.has(id) and not _echo_defs.has(id):
		push_error("Story: unknown journal entry " + id)
		return
	journal_known.append(id)
	journal_added.emit(id)
	_sfx("journal_page")


func unlock_journal(id: String) -> void:
	_unlock(id)


func journal_entries() -> Array[Dictionary]:
	_sync()
	var out: Array[Dictionary] = []
	for id in journal_known:
		out.append(_build_entry(id))
	return out


func _build_entry(id: String) -> Dictionary:
	if _echo_defs.has(id):
		var e: Dictionary = _echo_defs[id]
		var lines: Array = []
		var ar_l: Array = []
		var en_l: Array = []
		for ln in e.lines:
			lines.append(t(ln))
			ar_l.append(ln.ar)
			en_l.append(ln.en)
		return {"id": id, "kind": "echo", "world": e.get("world", ""), "title": _loc(e, "title"),
			"title_ar": e.title.ar, "title_en": e.title.en, "text": "\n".join(lines),
			"ar": "\n".join(ar_l), "en": "\n".join(en_l), "lines": lines, "versions": [], "restored": false}
	var d: Dictionary = _journal_defs[id]
	var entry := {"id": id, "kind": d.get("kind", "lore"), "world": d.get("world", ""),
		"title": _loc(d, "title"), "title_ar": d.title.ar, "title_en": d.title.en,
		"ar": d.get("ar", ""), "en": d.get("en", ""), "text": t(d), "versions": [], "restored": false}
	if d.has("lines"):                        # Lumen logs: restored lines shown after flag reveal_lumen
		var ls: Array = []
		var texts: Array = []
		var any_restored := false
		for ln in d.lines:
			var rest: bool = Game.flag("reveal_lumen") and ln.has("en_restored")
			any_restored = any_restored or rest
			ls.append({"text": t(ln), "restored": rest})
			texts.append(t(ln))
		entry["lines"] = ls
		entry["text"] = "\n".join(texts)
		entry["restored"] = any_restored
	for v in d.get("versions", []):
		var locked := false
		if v.get("locked", false):
			locked = not check(v.get("if", {"flag": "__never"}))
		elif not check(v.get("if")):
			continue
		var w: Dictionary = _worlds.get(v.world, {})
		entry.versions.append({"world": v.world, "world_name": t(w.get("name", v.world)),
			"locked": locked, "text": "???" if locked else t(v), "ar": v.get("ar", "؟؟؟"), "en": v.get("en", "???")})
	return entry


# ------------------------------------------------------------------ echoes
func play_echo(id: String) -> void:
	_sync()
	if not _echo_defs.has(id):
		push_error("Story: unknown echo " + id)
		return
	if id in echoes_played:
		return
	echoes_played.append(id)
	Game.collect_echo(id)
	_unlock(id)
	_sfx("echo_pickup")
	_emit_echo(id)
	var all_grove := true
	for g in GROVE_ECHOES:
		if not (g in echoes_played):
			all_grove = false
	if all_grove:
		event("trial_echo_done")


func replay_echo(id: String) -> void:
	if _echo_defs.has(id) and id in echoes_played:
		_emit_echo(id)


func _emit_echo(id: String) -> void:
	var e: Dictionary = _echo_defs[id]
	var lines: Array = []
	for ln in e.lines:
		lines.append(t(ln))
	echo_played.emit(id, _loc(e, "title"), lines)


func echo_ids() -> Array:
	return _echo_defs.keys()


# ------------------------------------------------------------------ reveals
func do_reveal(id: String) -> void:
	set_flag("reveal_" + id, true)
	_sting("mus_reveal")
	reveal.emit(id)


func reveal_info(id: String) -> Dictionary:
	var r: Dictionary = _reveal_defs.get(id, {})
	if r.is_empty():
		return {"title": "", "text": ""}
	return {"title": _loc(r, "title"), "text": _loc(r, "text"), "subtitle": _loc(r, "subtitle")}


# ------------------------------------------------------------------ lumen
func lumen_say(key: String) -> void:
	_sync()
	var e = _lumen_lines.get(key)
	if e == null:
		push_error("Story: unknown lumen line " + key)
		return
	var line: Dictionary
	if e is Array:
		var i: int = _rot.get(key, 0)
		_rot[key] = i + 1
		line = e[i % e.size()]
	else:
		line = e
		if line.get("once", false):
			if _flag("lumen_said_" + key):
				return
			set_flag("lumen_said_" + key, true)
	lumen_line.emit(t(line))
	_sfx("talk_blip_robot")


# ------------------------------------------------------------------ events
func event(id: String) -> void:
	_sync()
	var fl := "ev_" + id
	var def: Dictionary = _event_defs.get(id, {})
	if def.is_empty():
		push_warning("Story: event '%s' has no definition (flag set only)" % id)
		set_flag(fl, true)
		event_fired.emit(id)
		return
	if def.get("once", true) and _flag(fl):
		return
	if not check(def.get("if")):
		return
	set_flag(fl, true)
	run_actions(def.get("actions", []))
	event_fired.emit(id)


# ------------------------------------------------------------------ actions
func run_actions(list) -> void:
	for a in _arr(list):
		if a is Dictionary:
			_do(a)


func _do(a: Dictionary) -> void:
	if a.has("if"):
		run_actions(a.get("then", []) if check(a["if"]) else a.get("else", []))
		return
	for k in a.keys():
		var v = a[k]
		match k:
			"set_flag": set_flag(v, a.get("value", true))
			"clear_flag": set_flag(v, false)
			"start_quest": start_quest(v)
			"advance_quest": advance_quest(v, int(a.get("from", -1)))
			"complete_quest": complete_quest(v)
			"give_ability": Game.unlock_ability(v)
			"give_keystone":
				if dry_run:                 # tests: never write the player's save file
					if not (v in Game.state.keystones):
						Game.state.keystones.append(v)
				else:
					Game.collect_keystone(v)
			"give_echo": play_echo(v)
			"play_sound": _sfx(v)
			"sting": _sting(v)
			"reveal": do_reveal(v)
			"lumen_say": lumen_say(v)
			"journal": _unlock(v)
			"event": event(v)
			"emote": blu_emote.emit(v)
			"message": Game.message(t(v), a.get("kind", "info"))
			"start_dialogue":
				if not _in_dialogue:
					start_dialogue(v, a.get("node", ""))
			"travel":
				travel_requested.emit(v)
				if not dry_run:
					Game.change_world(v, a.get("spawn", null))
			"after_end": _after_end.append_array(_arr(v))
			"end":
				_end()
				return
			"slice_end":
				set_flag("slice_end", true)
				slice_ended.emit()
			_:
				if not (k in PARAM_KEYS):
					push_error("Story: unknown action '%s'" % k)


func _sting(ev: String) -> void:
	if not dry_run and Audio.has_event(ev):
		Audio.stinger(ev)


func _sfx(ev: String) -> void:
	if not dry_run and Audio.has_event(ev):
		Audio.play_ui(ev)


# ------------------------------------------------------------------ dialogue
func _dialogue(npc_id: String) -> Dictionary:
	if _dlg_cache.has(npc_id):
		return _dlg_cache[npc_id]
	var path := DATA + "dialogue/%s.json" % npc_id
	var d := {}
	if FileAccess.file_exists(path):
		d = _load(path)
	_dlg_cache[npc_id] = d
	return d


func has_dialogue(npc_id: String) -> bool:
	return not _dialogue(npc_id).is_empty()


func _pick_entry(d: Dictionary) -> String:
	for e in d.get("entries", []):
		if check(e.get("if")):
			return e.node
	return ""


func npc_has_marker(npc_id: String) -> bool:
	_sync()
	var d := _dialogue(npc_id)
	for e in d.get("entries", []):
		if check(e.get("if")):
			return bool(e.get("marker", false))
	return false


func is_in_dialogue() -> bool:
	return _in_dialogue


func current_npc() -> String:
	return _cur_npc


func start_dialogue(npc_id: String, node := "") -> void:
	_sync()
	if _in_dialogue:
		return
	var d := _dialogue(npc_id)
	if d.is_empty():
		push_warning("Story: no dialogue for " + npc_id)
		return
	var start := node if node != "" else _pick_entry(d)
	if start == "":
		return
	_cur_npc = npc_id
	_cur_data = d
	_in_dialogue = true
	_after_end = []
	set_flag("talked_" + npc_id, true)
	if _journal_defs.has("char_" + npc_id):
		_unlock("char_" + npc_id)
	dialogue_started.emit(npc_id, display_name(npc_id))
	_enter(start)


func _enter(id: String) -> void:
	var guard := 0
	while guard < 40:
		guard += 1
		if id == "" or id == "end":
			_end()
			return
		var n: Dictionary = _cur_data.get("nodes", {}).get(id, {})
		if n.is_empty():
			push_error("Story: %s has no node '%s'" % [_cur_npc, id])
			_end()
			return
		_cur_node = id
		run_actions(n.get("actions", []))
		if not _in_dialogue:
			return
		if n.has("branch"):
			var nxt := "end"
			for b in n.branch:
				if check(b.get("if")):
					nxt = b.get("goto", "end")
					break
			id = nxt
			continue
		if not n.has("en"):                   # pure action/route node
			id = n.get("next", "end")
			continue
		_show(n)
		return
	push_error("Story: dialogue loop in " + _cur_npc)
	_end()


func _show(n: Dictionary) -> void:
	_cur_choices = []
	var texts: Array[String] = []
	for c in n.get("choices", []):
		if check(c.get("if")):
			_cur_choices.append(c)
			texts.append(t(c))
	if n.has("emote"):
		blu_emote.emit(n.emote)
	dialogue_line.emit(speaker_name(n.get("speaker", "narrator")), t(n), texts)


func advance() -> void:
	if not _in_dialogue or not _cur_choices.is_empty():
		return
	var n: Dictionary = _cur_data.nodes.get(_cur_node, {})
	_enter(n.get("next", "end"))


func choose(index: int) -> void:
	if not _in_dialogue or index < 0 or index >= _cur_choices.size():
		return
	var c: Dictionary = _cur_choices[index]
	_cur_choices = []
	if c.has("emote"):
		blu_emote.emit(c.emote)
	run_actions(c.get("actions", []))
	if not _in_dialogue:
		return
	_enter(c.get("goto", "end"))


func _end() -> void:
	if not _in_dialogue:
		return
	_in_dialogue = false
	_cur_choices = []
	var id := _cur_npc
	_cur_npc = ""
	var pending := _after_end
	_after_end = []
	dialogue_ended.emit(id)
	run_actions(pending)


func end_dialogue() -> void:
	_end()


# ------------------------------------------------------------------ barks
func bark(npc_id: String) -> String:
	_sync()
	var pool: Array = []
	for b in _dialogue(npc_id).get("barks", []):
		if check(b.get("if")):
			pool.append(b)
	if pool.is_empty():
		return ""
	var pick: Dictionary = pool[randi() % pool.size()]
	if pool.size() > 1 and _last_bark.get(npc_id, null) == pick:
		pick = pool[(pool.find(pick) + 1) % pool.size()]
	_last_bark[npc_id] = pick
	return t(pick)
