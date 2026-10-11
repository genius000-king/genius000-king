extends Node
## Event-based audio. Event names are the contract in game/assets/audio/manifest.json (task T-AU01).

const MANIFEST := "res://assets/audio/manifest.json"
const BUSES := ["Music", "Ambience", "SFX", "UI", "Voice"]

var events := {}
var _streams := {}
var _pool3d: Array[AudioStreamPlayer3D] = []
var _pool2d: Array[AudioStreamPlayer] = []
var _music_a: AudioStreamPlayer
var _music_b: AudioStreamPlayer
var _amb: AudioStreamPlayer
var _music_event := ""
var _amb_event := ""
var _last_index := {}


func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	for b in BUSES:
		if AudioServer.get_bus_index(b) < 0:
			AudioServer.add_bus()
			var i := AudioServer.bus_count - 1
			AudioServer.set_bus_name(i, b)
			AudioServer.set_bus_send(i, "Master")
	var sfx := AudioServer.get_bus_index("SFX")
	if AudioServer.get_bus_effect_count(sfx) == 0:
		var rv := AudioEffectReverb.new()
		rv.room_size = 0.35
		rv.damping = 0.6
		rv.wet = 0.08
		rv.dry = 1.0
		AudioServer.add_bus_effect(sfx, rv)
		var lim := AudioEffectLimiter.new()
		lim.ceiling_db = -0.5
		AudioServer.add_bus_effect(AudioServer.get_bus_index("Master"), lim)
	if FileAccess.file_exists(MANIFEST):
		var d = JSON.parse_string(FileAccess.get_file_as_string(MANIFEST))
		if typeof(d) == TYPE_DICTIONARY:
			events = d
	for i in 24:
		var p := AudioStreamPlayer3D.new()
		p.bus = "SFX"
		p.unit_size = 6.0
		p.max_distance = 120.0
		p.attenuation_filter_cutoff_hz = 9000.0
		add_child(p)
		_pool3d.append(p)
	for i in 10:
		var p2 := AudioStreamPlayer.new()
		p2.bus = "SFX"
		add_child(p2)
		_pool2d.append(p2)
	_music_a = AudioStreamPlayer.new()
	_music_a.bus = "Music"
	_music_b = AudioStreamPlayer.new()
	_music_b.bus = "Music"
	_amb = AudioStreamPlayer.new()
	_amb.bus = "Ambience"
	add_child(_music_a)
	add_child(_music_b)
	add_child(_amb)
	Settings.apply_audio()


func has_event(ev: String) -> bool:
	return events.has(ev)


func _stream(ev: String, loop_override := false) -> AudioStream:
	var e: Dictionary = events.get(ev, {})
	var files: Array = e.get("files", [])
	if files.is_empty():
		return null
	var i := randi() % files.size()
	if files.size() > 1 and _last_index.get(ev, -1) == i:
		i = (i + 1) % files.size()
	_last_index[ev] = i
	var path: String = files[i]
	if not path.begins_with("res://"):
		path = "res://assets/audio/" + path
	if not _streams.has(path):
		var s = load(path)
		if s is AudioStreamOggVorbis:
			s.loop = bool(e.get("loop", false)) or loop_override
		elif s is AudioStreamWAV and (bool(e.get("loop", false)) or loop_override):
			s.loop_mode = AudioStreamWAV.LOOP_FORWARD
			s.loop_end = int(s.get_length() * s.mix_rate)
		_streams[path] = s
	return _streams[path]


func _params(ev: String) -> Dictionary:
	return events.get(ev, {})


func play(ev: String, at = null, volume_offset := 0.0, pitch := 1.0) -> Node:
	## at: Vector3 (world position) or Node3D (follows) or null (2D)
	var s := _stream(ev)
	if s == null:
		return null
	var p := _params(ev)
	var jitter := float(p.get("pitch_jitter", 0.05))
	var vol := float(p.get("volume_db", 0.0)) + volume_offset
	var bus: String = p.get("bus", "SFX")
	if at == null:
		var pl := _free2d()
		pl.stream = s
		pl.volume_db = vol
		pl.pitch_scale = pitch * (1.0 + randf_range(-jitter, jitter))
		pl.bus = bus
		pl.play()
		return pl
	var p3 := _free3d()
	if p3.get_parent() != self:
		p3.reparent(self)
	if at is Node3D:
		p3.global_position = (at as Node3D).global_position
	else:
		p3.global_position = at
	p3.stream = s
	p3.volume_db = vol
	p3.pitch_scale = pitch * (1.0 + randf_range(-jitter, jitter))
	p3.bus = bus
	p3.play()
	return p3


func play_ui(ev: String) -> void:
	play(ev, null)


func attach_loop(ev: String, node: Node3D, volume_offset := 0.0, max_distance := 60.0) -> AudioStreamPlayer3D:
	var s := _stream(ev, true)
	if s == null:
		return null
	var p := AudioStreamPlayer3D.new()
	p.stream = s
	p.bus = _params(ev).get("bus", "SFX")
	p.volume_db = float(_params(ev).get("volume_db", 0.0)) + volume_offset
	p.max_distance = max_distance
	p.unit_size = 5.0
	p.autoplay = true
	node.add_child(p)
	return p


func loop2d(ev: String, volume_offset := 0.0) -> AudioStreamPlayer:
	var s := _stream(ev, true)
	if s == null:
		return null
	var p := AudioStreamPlayer.new()
	p.stream = s
	p.bus = _params(ev).get("bus", "SFX")
	p.volume_db = float(_params(ev).get("volume_db", 0.0)) + volume_offset
	add_child(p)
	p.play()
	return p


func music(ev: String, fade := 2.5) -> void:
	if ev == _music_event:
		return
	_music_event = ev
	var s := _stream(ev, true)
	var old := _music_a if _music_a.playing else _music_b
	var nw := _music_b if old == _music_a else _music_a
	if old.playing:
		var tw := create_tween()
		tw.tween_property(old, "volume_db", -60.0, fade)
		tw.tween_callback(old.stop)
	if s:
		nw.stream = s
		nw.volume_db = -50.0
		nw.play()
		var target := float(_params(ev).get("volume_db", -6.0))
		create_tween().tween_property(nw, "volume_db", target, fade)


func stinger(ev: String) -> void:
	# duck music briefly under a story sting
	var cur := _music_a if _music_a.playing else _music_b
	var t := create_tween()
	t.tween_property(cur, "volume_db", cur.volume_db - 14.0, 0.6)
	t.tween_interval(6.0)
	t.tween_property(cur, "volume_db", cur.volume_db, 2.5)
	play(ev, null)


func ambience(ev: String, fade := 3.0) -> void:
	if ev == _amb_event:
		return
	_amb_event = ev
	var s := _stream(ev, true)
	if s == null:
		_amb.stop()
		return
	_amb.stream = s
	_amb.volume_db = -50.0
	_amb.play()
	create_tween().tween_property(_amb, "volume_db", float(_params(ev).get("volume_db", -8.0)), fade)


func _free3d() -> AudioStreamPlayer3D:
	for p in _pool3d:
		if not p.playing:
			return p
	return _pool3d[randi() % _pool3d.size()]


func _free2d() -> AudioStreamPlayer:
	for p in _pool2d:
		if not p.playing:
			return p
	return _pool2d[0]
