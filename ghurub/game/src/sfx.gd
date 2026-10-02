extends Node
## Every sound is synthesized at startup, so the project has no audio files.

const RATE := 22050

var _sfx := {}
var _music := {}
var _pool: Array[AudioStreamPlayer] = []
var _next := 0
var wind: AudioStreamPlayer
var drone: AudioStreamPlayer
var music_player: AudioStreamPlayer
var current_music := ""

func _ready() -> void:
	for i in 10:
		var p := AudioStreamPlayer.new()
		add_child(p)
		_pool.append(p)
	wind = AudioStreamPlayer.new()
	add_child(wind)
	drone = AudioStreamPlayer.new()
	add_child(drone)
	music_player = AudioStreamPlayer.new()
	add_child(music_player)
	_build_sfx()
	wind.stream = _wind()
	wind.volume_db = -8.0
	drone.stream = _drone()
	drone.volume_db = -14.0

func play(sname: String, vol_db := 0.0, pitch := 1.0) -> void:
	if not _sfx.has(sname):
		return
	var p := _pool[_next]
	_next = (_next + 1) % _pool.size()
	p.stream = _sfx[sname]
	p.volume_db = vol_db
	p.pitch_scale = pitch
	p.play()

func start_ambience() -> void:
	if not wind.playing:
		wind.play()
	if not drone.playing:
		drone.play()

func music(mname: String, vol_db := -9.0) -> void:
	if mname == current_music:
		return
	current_music = mname
	music_player.stop()
	if mname == "":
		return
	if not _music.has(mname):
		_music[mname] = _make_music(mname)
	music_player.stream = _music[mname]
	music_player.volume_db = vol_db
	music_player.play()

# ------------------------------------------------------------ synthesis

func _wav(samples: PackedFloat32Array, loop := false) -> AudioStreamWAV:
	var bytes := PackedByteArray()
	bytes.resize(samples.size() * 2)
	for i in samples.size():
		bytes.encode_s16(i * 2, int(clampf(samples[i], -1.0, 1.0) * 32000.0))
	var w := AudioStreamWAV.new()
	w.format = AudioStreamWAV.FORMAT_16_BITS
	w.mix_rate = RATE
	w.stereo = false
	w.data = bytes
	if loop:
		w.loop_mode = AudioStreamWAV.LOOP_FORWARD
		w.loop_begin = 0
		w.loop_end = samples.size()
	return w

func _buf(seconds: float) -> PackedFloat32Array:
	var b := PackedFloat32Array()
	b.resize(int(seconds * RATE))
	return b

func _build_sfx() -> void:
	_sfx["blip"] = _tone(0.025, 980.0, 0.18, "square", 0.0)
	_sfx["beep"] = _tone(0.08, 1320.0, 0.35, "sine", 0.0)
	_sfx["confirm"] = _two(1040.0, 1560.0, 0.05, 0.3)
	_sfx["cancel"] = _two(700.0, 460.0, 0.05, 0.3)
	_sfx["move"] = _tone(0.03, 760.0, 0.15, "square", 0.0)
	_sfx["boot"] = _boot()
	_sfx["gun"] = _gun()
	_sfx["hit"] = _hit()
	_sfx["crit"] = _hit(1.4)
	_sfx["step"] = _step()
	_sfx["glint"] = _glint()
	_sfx["die"] = _sweep(0.9, 700.0, 60.0, 0.4)
	_sfx["thud"] = _thud()
	_sfx["encounter"] = _encounter()
	_sfx["fire"] = _whoosh(0.6, 0.55, 1)
	_sfx["force"] = _whoosh(0.6, 0.5, 0)
	_sfx["ice"] = _shimmer()
	_sfx["elec"] = _crackle()
	_sfx["heal"] = _sweep(0.6, 400.0, 1400.0, 0.25)
	_sfx["summon"] = _sweep(0.8, 120.0, 900.0, 0.35)
	_sfx["levelup"] = _arp([523.0, 659.0, 784.0, 1046.0], 0.09, 0.3)
	_sfx["swing"] = _whoosh(0.35, 0.4, 0)

func _osc(kind: String, ph: float) -> float:
	match kind:
		"square":
			return 1.0 if fmod(ph, 1.0) < 0.5 else -1.0
		"tri":
			return 4.0 * abs(fmod(ph, 1.0) - 0.5) - 1.0
		"saw":
			return fmod(ph, 1.0) * 2.0 - 1.0
	return sin(ph * TAU)

func _tone(len_s: float, freq: float, amp: float, kind: String, slide: float) -> AudioStreamWAV:
	var b := _buf(len_s)
	var ph := 0.0
	for i in b.size():
		var t := float(i) / RATE
		ph += (freq + slide * t) / RATE
		b[i] = _osc(kind, ph) * amp * (1.0 - t / len_s)
	return _wav(b)

func _two(f1: float, f2: float, each: float, amp: float) -> AudioStreamWAV:
	var b := _buf(each * 2.0)
	var ph := 0.0
	for i in b.size():
		var t := float(i) / RATE
		var f := f1 if t < each else f2
		ph += f / RATE
		b[i] = sin(ph * TAU) * amp * (1.0 - fmod(t, each) / each * 0.6)
	return _wav(b)

func _arp(notes: Array, each: float, amp: float) -> AudioStreamWAV:
	var b := _buf(each * notes.size() + 0.3)
	var ph := 0.0
	for i in b.size():
		var t := float(i) / RATE
		var k := mini(int(t / each), notes.size() - 1)
		ph += notes[k] / RATE
		var env := exp(-(t - k * each) * 6.0) if k < notes.size() - 1 else exp(-(t - k * each) * 3.0)
		b[i] = _osc("tri", ph) * amp * env
	return _wav(b)

func _sweep(len_s: float, f0: float, f1: float, amp: float) -> AudioStreamWAV:
	var b := _buf(len_s)
	var ph := 0.0
	for i in b.size():
		var t := float(i) / RATE / len_s
		ph += lerpf(f0, f1, t) / RATE
		b[i] = (sin(ph * TAU) * 0.7 + _osc("tri", ph * 2.0) * 0.3) * amp * sin(t * PI)
	return _wav(b)

func _boot() -> AudioStreamWAV:
	var b := _buf(1.1)
	var ph := 0.0
	for i in b.size():
		var t := float(i) / RATE
		var f := 300.0 + t * 900.0
		if t > 0.55:
			f = [1200.0, 1600.0, 1200.0, 2000.0][mini(int((t - 0.55) / 0.12), 3)]
		ph += f / RATE
		var env := 0.25 if t < 0.55 else 0.3 * (1.0 - fmod(t - 0.55, 0.12) / 0.12)
		b[i] = _osc("square", ph) * env * 0.6
	return _wav(b)

func _gun() -> AudioStreamWAV:
	var b := _buf(0.5)
	var lp := 0.0
	var ph := 0.0
	for i in b.size():
		var t := float(i) / RATE
		var n := randf() * 2.0 - 1.0
		lp += (n - lp) * (0.9 - t)
		ph += (140.0 - t * 200.0) / RATE
		b[i] = (lp * exp(-t * 18.0) * 0.9 + sin(ph * TAU) * exp(-t * 9.0) * 0.6)
	return _wav(b)

func _hit(k := 1.0) -> AudioStreamWAV:
	var b := _buf(0.3)
	var lp := 0.0
	var ph := 0.0
	for i in b.size():
		var t := float(i) / RATE
		lp += (randf() * 2.0 - 1.0 - lp) * 0.35
		ph += (220.0 * k - t * 500.0) / RATE
		b[i] = (lp * 0.8 + sin(ph * TAU) * 0.5) * exp(-t * 14.0) * 0.8
	return _wav(b)

func _step() -> AudioStreamWAV:
	var b := _buf(0.16)
	var lp := 0.0
	for i in b.size():
		var t := float(i) / RATE
		lp += (randf() * 2.0 - 1.0 - lp) * 0.12
		b[i] = lp * sin(t / 0.16 * PI) * 0.9
	return _wav(b)

func _thud() -> AudioStreamWAV:
	var b := _buf(0.5)
	var ph := 0.0
	var lp := 0.0
	for i in b.size():
		var t := float(i) / RATE
		ph += (80.0 - t * 60.0) / RATE
		lp += (randf() * 2.0 - 1.0 - lp) * 0.08
		b[i] = (sin(ph * TAU) * 0.8 + lp * 0.6) * exp(-t * 7.0)
	return _wav(b)

func _glint() -> AudioStreamWAV:
	var b := _buf(0.9)
	for i in b.size():
		var t := float(i) / RATE
		var s := sin(t * 2637.0 * TAU) * 0.5 + sin(t * 3520.0 * TAU) * 0.35 + sin(t * 5274.0 * TAU) * 0.2
		b[i] = s * exp(-t * 5.0) * 0.25
	return _wav(b)

func _encounter() -> AudioStreamWAV:
	var b := _buf(0.7)
	var ph := 0.0
	for i in b.size():
		var t := float(i) / RATE
		var f := 880.0 if t < 0.12 else (660.0 if t < 0.24 else 440.0)
		ph += f / RATE
		b[i] = _osc("square", ph) * 0.22 * (1.0 - t / 0.7)
	return _wav(b)

func _whoosh(len_s: float, amp: float, bright: int) -> AudioStreamWAV:
	var b := _buf(len_s)
	var lp := 0.0
	var lp2 := 0.0
	for i in b.size():
		var t := float(i) / RATE / len_s
		var cut := lerpf(0.02, 0.4 if bright == 1 else 0.15, sin(t * PI))
		lp += (randf() * 2.0 - 1.0 - lp) * cut
		lp2 += (lp - lp2) * cut
		b[i] = (lp - lp2 * (0.5 if bright == 1 else 0.0)) * amp * 2.0 * sin(t * PI)
	return _wav(b)

func _shimmer() -> AudioStreamWAV:
	var b := _buf(0.8)
	for i in b.size():
		var t := float(i) / RATE
		var s := 0.0
		for k in 5:
			s += sin(t * (1800.0 + k * 637.0) * TAU + k) * (1.0 if fmod(t * 30.0 + k, 2.0) < 1.0 else 0.3)
		b[i] = s * 0.07 * exp(-t * 3.0)
	return _wav(b)

func _crackle() -> AudioStreamWAV:
	var b := _buf(0.6)
	var v := 0.0
	for i in b.size():
		var t := float(i) / RATE
		if randf() < 0.02:
			v = randf() * 2.0 - 1.0
		b[i] = v * 0.5 * exp(-t * 4.0) * (1.0 if randf() < 0.7 else 0.0)
	return _wav(b)

func _wind() -> AudioStreamWAV:
	var len_s := 8.0
	var b := _buf(len_s)
	var lp := 0.0
	var lp2 := 0.0
	for i in b.size():
		var t := float(i) / RATE
		var gust := 0.55 + 0.3 * sin(t / len_s * TAU) + 0.15 * sin(t / len_s * TAU * 3.0 + 1.0)
		var cut := 0.012 + 0.03 * gust
		lp += (randf() * 2.0 - 1.0 - lp) * cut
		lp2 += (lp - lp2) * cut
		b[i] = lp2 * 6.0 * gust
	return _wav(b, true)

func _drone() -> AudioStreamWAV:
	var len_s := 8.0
	var b := _buf(len_s)
	for i in b.size():
		var t := float(i) / RATE
		var s := sin(t * 55.0 * TAU) * 0.5 + sin(t * 82.5 * TAU) * 0.25 + sin(t * 110.25 * TAU) * 0.12
		b[i] = s * (0.6 + 0.4 * sin(t / len_s * TAU * 2.0)) * 0.5
	return _wav(b, true)

func _make_music(mname: String) -> AudioStreamWAV:
	var bpm := 132.0 if mname == "battle" else 148.0
	var root := 110.0 if mname == "battle" else 98.0
	var step := 60.0 / bpm / 2.0
	var bass := [0, 0, 12, 0, 10, 0, 7, 10, 0, 0, 12, 0, 15, 12, 10, 7,
		-4, -4, 8, -4, 7, -4, 3, 7, -2, -2, 10, -2, 12, 10, 7, 5]
	var lead := [12, 15, 19, 15, 24, 19, 15, 19, 12, 15, 19, 22, 24, 22, 19, 15,
		8, 12, 15, 12, 20, 15, 12, 15, 10, 14, 17, 14, 22, 17, 14, 10]
	var steps := bass.size()
	var len_s := steps * step
	var b := _buf(len_s)
	var ph_b := 0.0
	var ph_l := 0.0
	var lp := 0.0
	var nlp := 0.0
	for i in b.size():
		var t := float(i) / RATE
		var k := mini(int(t / step), steps - 1)
		var lt := t - k * step
		var fb := root * pow(2.0, bass[k] / 12.0) * 0.5
		var fl := root * pow(2.0, lead[k] / 12.0) * 2.0
		ph_b += fb / RATE
		ph_l += fl / RATE
		var bs := _osc("saw", ph_b) * 0.5 + _osc("square", ph_b * 0.5) * 0.3
		lp += (bs - lp) * 0.08
		var ls := _osc("tri", ph_l) * 0.18 * exp(-lt * 7.0)
		var kick := 0.0
		if k % 2 == 0:
			kick = sin(lt * (60.0 + 140.0 * exp(-lt * 30.0)) * TAU) * exp(-lt * 12.0) * 0.6
		nlp += (randf() * 2.0 - 1.0 - nlp) * 0.6
		var hat := (randf() * 2.0 - 1.0 - nlp) * exp(-lt * 60.0) * 0.12
		var snare := 0.0
		if k % 4 == 2:
			snare = (randf() * 2.0 - 1.0) * exp(-lt * 18.0) * 0.25
		b[i] = (lp * 0.55 + ls + kick + hat + snare) * 0.8
	return _wav(b, true)
