extends Node
## Story flow, grid movement and events for Act I, Part 1.

const Kit = preload("res://src/kit.gd")
const Data = preload("res://src/data.gd")

const EYE := 1.65
const STEP_TIME := 0.32
const TURN_TIME := 0.2
const DIRS := [Vector2i(0, -1), Vector2i(1, 0), Vector2i(0, 1), Vector2i(-1, 0)]

var m: Node
var ui: Node
var world: Node
var sfx: Node
var battle: Node

var st := {}
var cell := Vector2i.ZERO
var facing := 0
var yaw := 0.0
var moving := false
var exploring := false
var encounters_on := false
var enc_meter := 0.0
var steps_since_gauntlet := 0
var since_event := 0
var log_index := 0
var idle_t := 0.0
var idle_count := 0
var drift_steps := 0
var last_dist := 999.0
var nudge_cool := 0
var flags := {}
var checkpoint := {}
var explored := {}
var bob := 0.0
var auto := false
var god := false

var fight := {}
var cine := false
var skipping := false
var cine_tweens: Array[Tween] = []
var viewmodel: Node3D
var gun: Node3D
var arm: Node3D
var muzzle: MeshInstance3D
var muzzle_light: OmniLight3D

func setup(main: Node) -> void:
	m = main
	ui = main.ui
	world = main.world
	sfx = main.sfx
	battle = main.battle
	auto = main.args.has("auto")
	god = main.args.has("god")
	ui.auto = auto
	if auto:
		Engine.time_scale = float(main.args.get("speed", "6"))
		ui.auto_delay = float(main.args.get("delay", "0"))
	state_reset()
	_build_viewmodel()
	ui.device.map_rows = Data.MAP
	ui.device.map_size = Vector2i(world.w, world.h)
	ui.device.target = Data.GOAL

func state_reset() -> void:
	st = {
		"hero": {"name": "Takeya", "lv": 1, "hp": 60, "maxhp": 60, "mp": 0, "maxmp": 0, "xp": 0, "str": 6, "mag": 2, "hero": true},
		"demons": [],
		"items": {"Medicine": 0},
	}

func party() -> Array:
	var p := [st["hero"]]
	p.append_array(st["demons"])
	return p

func wait(s: float) -> void:
	await get_tree().create_timer(s).timeout

# ------------------------------------------------------------ entry points

func begin(jump: String) -> void:
	match jump:
		"desert":
			_skip_opening()
			await _ghurub_boot(true)
			_start_explore()
		"boss":
			_skip_opening()
			_jump_to(Vector2i(19, 5), 0, true)
		"gate":
			_skip_opening()
			flags["boss_done"] = true
			_jump_to(Vector2i(20, 2), 0, true)
		_:
			await opening()

func _skip_opening() -> void:
	sfx.start_ambience()
	world.hero_body.visible = false
	m.post.set_shader_parameter("fade", 0.0)
	cell = world.start_cell
	facing = 0
	yaw = 0.0
	_place_cam()

func _jump_to(c: Vector2i, f: int, with_party: bool) -> void:
	cell = c
	facing = f
	yaw = -f * PI * 0.5
	if with_party:
		st["items"]["Medicine"] = 3
		for id in ["pixie", "nekomata", "imp"]:
			st["demons"].append(battle.make_unit(id, true))
	flags["boot"] = true
	flags["gauntlet"] = true
	flags["swept"] = true
	encounters_on = true
	ui.device.visible = true
	ui.device.mode = "nav"
	_place_cam()
	_start_explore()

# ------------------------------------------------------------ the opening

func dolly(p0: Vector3, t0: Vector3, p1: Vector3, t1: Vector3, dur: float) -> Tween:
	var tw := create_tween()
	if cine:
		cine_tweens.append(tw)
	tw.tween_method(func(k: float) -> void: m.look(p0.lerp(p1, k), t0.lerp(t1, k)), 0.0, 1.0, dur) \
		.set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)
	return tw

func fade(to: float, dur: float) -> Tween:
	var tw := create_tween()
	tw.tween_method(func(v: float) -> void: m.post.set_shader_parameter("fade", v),
		float(m.post.get_shader_parameter("fade")), to, dur)
	return tw

## Waits during the opening, cut short if the player skips.
func cwait(s: float) -> bool:
	var t := 0.0
	while t < s and not skipping:
		await get_tree().process_frame
		t += get_process_delta_time()
	return skipping

func try_skip(k: int) -> bool:
	if cine and not skipping and k in [KEY_ESCAPE, KEY_ENTER, KEY_KP_ENTER]:
		skipping = true
		return true
	return false

func _skip_cine() -> void:
	for tw in cine_tweens:
		if tw.is_valid():
			tw.kill()
	cine_tweens.clear()
	cine = false
	m.post.set_shader_parameter("fade", 1.0)
	ui.title_label.modulate.a = 0.0
	ui.sub_label.modulate.a = 0.0
	ui.letterbox(false, 0.01)
	_fight_visible(true)
	fight["grapple"] = true
	await wait(0.4)
	await _wake_up()

func opening() -> void:
	cine = true
	ui.hold(true)
	m.post.set_shader_parameter("fade", 1.0)
	ui.letterbox(true, 0.01)
	sfx.wind.play()
	var s: Vector3 = world.to_world(world.start_cell)
	var hand: Vector3 = world.hero_hand.global_position
	spawn_fight()
	_fight_visible(false)
	if await cwait(2.4):
		await _skip_cine()
		return

	# 2: a gloved hand in the sand
	dolly(hand_cam(0.75, 0.32), hand, hand_cam(0.6, 0.24), hand, 5.0)
	cine_tweens.append(fade(0.0, 2.2))
	if await cwait(4.6):
		await _skip_cine()
		return

	# 3: a few bodies, low and close
	dolly(s + Vector3(7.0, 0.7, 1.0), s + Vector3(-6, 0.0, -1.0), s + Vector3(5.6, 0.8, 0.4), s + Vector3(-6, 0.2, -1.6), 4.4)
	if await cwait(4.2):
		await _skip_cine()
		return

	# 4: pull back and rise until the battlefield shows its size
	dolly(s + Vector3(1.6, 1.3, 2.6), s, s + Vector3(28, 26, 42), s + Vector3(-8, 0, -4), 7.5)
	if await cwait(7.3):
		await _skip_cine()
		return

	# 5: the widest shot, the desert and the far skyline
	dolly(s + Vector3(-24, 46, 64), s + Vector3(70, 4, -70), s + Vector3(-18, 42, 58), s + Vector3(90, 8, -62), 7.0)
	ui.title("TOKYO", "YEAR UNKNOWN", 2.6)
	if await cwait(6.8):
		await _skip_cine()
		return

	# 6: a silver glint
	_fight_visible(true)
	var f: Vector3 = world.fight_spot
	dolly(f + Vector3(-9, 2.4, 12), f + Vector3(0, 1.0, 0), f + Vector3(-4.2, 1.8, 5.4), f + Vector3(0, 1.1, 0), 3.4)
	if await cwait(0.6):
		await _skip_cine()
		return
	_glint_burst()
	if await cwait(2.8):
		await _skip_cine()
		return

	# 7: the only movement in the world
	var orbit := create_tween()
	cine_tweens.append(orbit)
	orbit.tween_method(func(k: float) -> void:
		var a := lerpf(0.9, -0.5, k)
		m.look(f + Vector3(sin(a) * 4.4, 1.5 + k * 0.3, cos(a) * 4.4), f + Vector3(0, 1.15, 0)), 0.0, 1.0, 6.0)
	if await cwait(6.0):
		await _skip_cine()
		return

	# 8: the hand again. The fingers move. It's him.
	m.look(hand_cam(0.5, 0.2), hand)
	if await cwait(0.9):
		await _skip_cine()
		return
	for finger in world.hero_hand.get_children():
		if finger.name.begins_with("finger"):
			var tw := create_tween()
			tw.tween_property(finger, "rotation_degrees:x", -35.0, 0.35).set_trans(Tween.TRANS_SINE)
			tw.tween_property(finger, "rotation_degrees:x", -10.0, 0.5)
	sfx.play("thud", -16.0)
	if await cwait(1.4):
		await _skip_cine()
		return
	if skipping:
		await _skip_cine()
		return
	cine = false
	await fade(1.0, 0.5).finished
	ui.letterbox(false, 0.01)
	await _wake_up()

func hand_cam(dist := 0.62, height := 0.26) -> Vector3:
	return world.hand_cam(dist, height)

func spawn_fight() -> void:
	var f: Vector3 = world.fight_spot
	var angel: Node3D = m.add_actor(Kit.angel())
	angel.position = f + Vector3(0.75, 0, 0)
	var imp: Node3D = m.add_actor(Kit.imp())
	imp.position = f + Vector3(-0.5, 0, 0)
	angel.look_at(imp.position, Vector3.UP)
	imp.look_at(angel.position, Vector3.UP)
	var dev_root := Node3D.new()
	m.stage.add_child(dev_root)
	Kit.device(null, dev_root, Vector3.ZERO, Vector3(70, 0, 0), 3.2)
	dev_root.position = f + Vector3(0.1, 1.0, 0)
	var g: MeshInstance3D = Kit.glint(dev_root, Color(1, 1, 1), 1.4, 0.0)
	fight = {"angel": angel, "imp": imp, "device": dev_root, "glint": g, "grapple": true}

func _fight_visible(on: bool) -> void:
	for k in ["angel", "imp", "device"]:
		fight[k].visible = on

func _glint_burst() -> void:
	if fight.is_empty():
		return
	sfx.play("glint", -4.0)
	var g: MeshInstance3D = fight["glint"]
	var mat: ShaderMaterial = g.material_override
	var tw := create_tween()
	tw.tween_method(func(v: float) -> void:
		mat.set_shader_parameter("intensity", v)
		mat.set_shader_parameter("spin", v * 0.6), 0.0, 2.2, 0.25)
	tw.tween_method(func(v: float) -> void: mat.set_shader_parameter("intensity", v), 2.2, 0.0, 1.2)

func _process(delta: float) -> void:
	if not fight.is_empty() and fight.get("grapple", false):
		var t: float = m.time
		var angel: Node3D = fight["angel"]
		var imp: Node3D = fight["imp"]
		var f: Vector3 = world.fight_spot
		var push := sin(t * 2.3) * 0.18 + sin(t * 5.1) * 0.05
		angel.position = f + Vector3(0.75 + push, 0, 0)
		imp.position = f + Vector3(-0.45 + push, 0.12 + absf(sin(t * 4.0)) * 0.12, 0)
		angel.get_node("body").rotation.z = push * 0.6
		imp.get_node("body").rotation.x = -0.3 + sin(t * 4.0) * 0.15
		fight["device"].position = f + Vector3(0.12 + push, 1.0 + sin(t * 3.0) * 0.06, 0)
		fight["device"].rotation.y = sin(t * 2.0) * 0.4
	if exploring and not moving and ui.mode == "":
		idle_t += delta
		if auto:
			_bot_step()
		else:
			_held_keys()
		if idle_t > 28.0 and encounters_on:
			idle_t = 0.0
			_nudge(Data.NUDGE_IDLE[idle_count % Data.NUDGE_IDLE.size()])
			idle_count += 1
	if exploring and viewmodel != null:
		bob = lerpf(bob, 0.0, delta * 6.0)

func _wake_up() -> void:
	var s: Vector3 = world.to_world(world.start_cell)
	world.hero_body.visible = false
	cell = world.start_cell
	facing = 0
	yaw = 0.0
	m.post.set_shader_parameter("blur", 1.0)
	m.look(s + Vector3(0, 0.3, 0.6), s + Vector3(0.5, 6.0, -2.0))
	sfx.start_ambience()
	await fade(0.0, 2.5).finished
	await wait(0.6)
	# push up out of the sand
	var tw := dolly(s + Vector3(0, 0.3, 0.6), s + Vector3(0.5, 6.0, -2.0), s + Vector3(0, 0.95, 0.3), world.fight_spot + Vector3(0, 1.2, 0), 2.2)
	var bt := create_tween()
	bt.tween_method(func(v: float) -> void: m.post.set_shader_parameter("blur", v), 1.0, 0.55, 2.2)
	await tw.finished
	await wait(0.8)
	await dolly(s + Vector3(0, 0.95, 0.3), world.fight_spot + Vector3(0, 1.2, 0), s + Vector3(0, EYE, 0), world.fight_spot + Vector3(0, 1.3, 0), 1.6).finished
	var bt2 := create_tween()
	bt2.tween_method(func(v: float) -> void: m.post.set_shader_parameter("blur", v), 0.55, 0.12, 2.0)
	await wait(1.2)
	await _first_shots()

func _face_cam(n: Node3D, dur := 0.6) -> void:
	var target: Vector3 = m.cam.global_position
	target.y = n.global_position.y
	var from := n.global_transform
	var to := from.looking_at(target, Vector3.UP)
	var tw := create_tween()
	tw.tween_method(func(k: float) -> void:
		n.global_transform = Transform3D(from.basis.slerp(to.basis, k), n.global_position), 0.0, 1.0, dur)

func _first_shots() -> void:
	var angel: Node3D = fight["angel"]
	var imp: Node3D = fight["imp"]
	# they notice him
	fight["grapple"] = false
	await wait(0.4)
	_face_cam(imp, 0.4)
	_face_cam(angel, 0.9)
	sfx.play("swing", -10.0, 0.6)
	await wait(1.1)
	# the imp lunges
	var cam_pos: Vector3 = m.cam.global_position
	var start := imp.position
	var lunge := start.lerp(Vector3(cam_pos.x, 0, cam_pos.z), 0.55)
	var tw := create_tween()
	tw.tween_property(imp, "position", lunge + Vector3(0, 0.9, 0), 0.45).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_OUT)
	sfx.play("swing", -4.0, 1.3)
	_raise_gun(true)
	await tw.finished
	ui.hold(false)
	await ui.prompt("[SPACE]  FIRE")
	await _fire()
	await _kill(imp, Color(1.0, 0.4, 0.15))
	m.remove_actor(imp)
	await wait(0.5)
	# the angel strikes next
	var a0 := angel.position
	var arm_r: Node3D = angel.get_node("body/arm_r")
	var tw2 := create_tween()
	tw2.tween_property(arm_r, "rotation_degrees:x", -120.0, 0.5)
	tw2.parallel().tween_property(angel, "position", a0.lerp(Vector3(cam_pos.x, 0, cam_pos.z), 0.45), 0.6).set_trans(Tween.TRANS_SINE)
	sfx.play("swing", -2.0, 0.8)
	await tw2.finished
	await ui.prompt("[SPACE]  FIRE")
	await _fire()
	Kit.set_param(angel, "flash", 1.0)
	var tw3 := create_tween()
	tw3.tween_method(func(v: float) -> void: Kit.set_param(angel, "flash", v), 1.0, 0.0, 0.3)
	tw3.tween_property(angel.get_node("body"), "position", Vector3(0, -0.9, 0.2), 0.7).set_trans(Tween.TRANS_BOUNCE).set_ease(Tween.EASE_OUT)
	tw3.parallel().tween_property(angel.get_node("body"), "rotation_degrees:x", 16.0, 0.7)
	tw3.parallel().tween_property(arm_r, "rotation_degrees:x", 10.0, 0.6)
	sfx.play("thud", -2.0)
	await tw3.finished
	# the sword falls into the sand beside it
	var sword: Node3D = arm_r.get_node("sword")
	var sw_pos := sword.global_position
	sword.visible = false
	var fallen := Node3D.new()
	m.stage.add_child(fallen)
	Kit.add(null, fallen, Kit.box(0.05, 0.02, 1.15), Color(0.85, 0.88, 0.92), Vector3(0, 0, -0.55), Vector3.ZERO, {"spec": 1.0, "ol": 0.006})
	Kit.add(null, fallen, Kit.box(0.22, 0.04, 0.05), Kit.GOLD, Vector3.ZERO, Vector3.ZERO, {"spec": 0.8, "ol": 0.006})
	fallen.global_position = Vector3(sw_pos.x + 0.3, 0.04, sw_pos.z + 0.2)
	fallen.rotation.y = 0.8
	sfx.play("hit", -10.0, 1.6)
	_raise_gun(false)
	ui.hold(true)
	# step closer to the fallen angel
	var p: Vector3 = m.cam.global_position
	var near := angel.global_position + (p - angel.global_position).normalized() * 2.5
	await dolly(p, angel.global_position + Vector3(0, 1.2, 0), Vector3(near.x, 1.45, near.z), angel.global_position + Vector3(0, 1.0, 0), 1.8).finished
	m.post.set_shader_parameter("blur", 0.0)
	ui.hold(false)
	await ui.say("ANGEL", "Forgive me... my rashness. That device... it commands what is not of this world.")
	await ui.say("ANGEL", "In the wrong hands... catastrophe. Take it. Restore the order of God.")
	await ui.say("ANGEL", "You were lied to — both sides. Not resources... a machine that crosses time.")
	await ui.say("ANGEL", "Go back... summon allies... undo this. And be warned — even in the past, there are those with power. That relic alone will not be enough.")
	await ui.say("ANGEL", "The machine is—")
	ui.close_dialog()
	ui.hold(true)
	await wait(0.5)
	Kit.set_param(angel, "dissolve_color", Kit.GOLD)
	var tw4 := create_tween()
	tw4.tween_method(func(v: float) -> void: Kit.set_param(angel, "dissolve", v), 0.0, 1.0, 3.0)
	sfx.play("die", -6.0, 0.7)
	await tw4.finished
	var angel_pos := angel.global_position
	m.remove_actor(angel)
	fight["glint"].material_override.set_shader_parameter("intensity", 0.0)
	await wait(0.6)
	# the device in the sand
	var dev: Node3D = fight["device"]
	dev.position = world.fight_spot + Vector3(0.1, 0.06, 0.4)
	dev.rotation = Vector3.ZERO
	var cp: Vector3 = m.cam.global_position
	await dolly(cp, angel_pos + Vector3(0, 1.0, 0), cp + Vector3(0, -0.25, 0), dev.global_position, 1.4).finished
	_glint_burst()
	ui.hold(false)
	await ui.prompt("[SPACE]  Take the device")
	sfx.play("confirm", -4.0)
	dev.queue_free()
	fight = {}
	await _ghurub_boot(false)
	_start_explore()

func _kill(a: Node3D, edge: Color) -> void:
	Kit.set_param(a, "flash", 1.0)
	Kit.set_param(a, "dissolve_color", edge)
	sfx.play("die", -6.0)
	var tw := create_tween()
	tw.tween_method(func(v: float) -> void: Kit.set_param(a, "flash", v), 1.0, 0.0, 0.2)
	tw.tween_method(func(v: float) -> void: Kit.set_param(a, "dissolve", v), 0.0, 1.0, 0.9)
	await tw.finished

# ------------------------------------------------------------ viewmodel

func _build_viewmodel() -> void:
	viewmodel = Node3D.new()
	m.cam.add_child(viewmodel)
	gun = Kit.piv(viewmodel, "gun", Vector3(0.24, -0.62, -0.5), Vector3(0, -14, 0))
	var steel := Color(0.3, 0.31, 0.33)
	Kit.add(null, gun, Kit.box(0.032, 0.042, 0.19), steel, Vector3(0, 0.05, -0.05), Vector3.ZERO, {"spec": 0.8, "rim": 0.6, "ol": 0.003})
	Kit.add(null, gun, Kit.box(0.026, 0.02, 0.17), steel.darkened(0.3), Vector3(0, 0.025, -0.04), Vector3.ZERO, {"ol": 0.002})
	Kit.add(null, gun, Kit.cyl(0.008, 0.008, 0.03, 6), Color(0.05, 0.05, 0.05), Vector3(0, 0.05, -0.155), Vector3(90, 0, 0), {"outline": false})
	Kit.add(null, gun, Kit.box(0.028, 0.085, 0.045), Color(0.2, 0.15, 0.1), Vector3(0, -0.02, 0.02), Vector3(-14, 0, 0), {"ol": 0.003})
	Kit.add(null, gun, Kit.box(0.055, 0.05, 0.07), Kit.GEAR, Vector3(0.004, -0.03, 0.035), Vector3(-14, 0, 0), {"ol": 0.003})
	Kit.add(null, gun, Kit.cap(0.035, 0.24), Kit.SECT_A, Vector3(0.015, -0.08, 0.2), Vector3(-62, 0, 0), {"ol": 0.003})
	muzzle = Kit.glint(gun, Color(1.0, 0.8, 0.45), 0.5, 0.0)
	muzzle.position = Vector3(0, 0.05, -0.2)
	muzzle_light = OmniLight3D.new()
	muzzle_light.light_color = Color(1.0, 0.75, 0.4)
	muzzle_light.light_energy = 0.0
	muzzle_light.omni_range = 6.0
	gun.add_child(muzzle_light)
	muzzle_light.position = Vector3(0, 0.1, -0.4)
	gun.visible = false
	arm = Kit.piv(viewmodel, "arm", Vector3(-0.3, -0.75, -0.42), Vector3(30, 20, 0))
	Kit.add(null, arm, Kit.cap(0.055, 0.42), Kit.SECT_A, Vector3(0, 0, 0.14), Vector3(90, 0, 0), {"ol": 0.004})
	Kit.add(null, arm, Kit.box(0.12, 0.05, 0.16), Color(0.15, 0.13, 0.12), Vector3(0, 0.05, 0.05), Vector3.ZERO, {"ol": 0.004})
	Kit.device(null, arm, Vector3(0, 0.1, 0.04), Vector3(0, 0, 0), 1.0)
	arm.visible = false

func _raise_gun(up: bool) -> void:
	gun.visible = true
	var tw := create_tween()
	tw.tween_property(gun, "position", Vector3(0.17, -0.17, -0.38) if up else Vector3(0.24, -0.62, -0.5), 0.25) \
		.set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	if not up:
		tw.tween_callback(func() -> void: gun.visible = false)

func _fire() -> void:
	sfx.play("gun", 0.0)
	var mat: ShaderMaterial = muzzle.material_override
	mat.set_shader_parameter("intensity", 2.5)
	muzzle_light.light_energy = 6.0
	m.post.set_shader_parameter("flash_color", Color(1.0, 0.85, 0.6))
	var tw := create_tween()
	tw.tween_method(func(v: float) -> void:
		mat.set_shader_parameter("intensity", v * 2.5)
		muzzle_light.light_energy = v * 6.0
		m.post.set_shader_parameter("flash", v * 0.35), 1.0, 0.0, 0.18)
	var kick := create_tween()
	kick.tween_property(gun, "rotation_degrees:x", 22.0, 0.06)
	kick.tween_property(gun, "rotation_degrees:x", 0.0, 0.25)
	await tw.finished

func show_arm(up: bool) -> void:
	arm.visible = true
	var tw := create_tween()
	tw.tween_property(arm, "position", Vector3(-0.2, -0.3, -0.38) if up else Vector3(-0.3, -0.75, -0.42), 0.45) \
		.set_trans(Tween.TRANS_SINE)
	tw.parallel().tween_property(arm, "rotation_degrees", Vector3(52, 30, -10) if up else Vector3(30, 20, 0), 0.45)
	if not up:
		tw.tween_callback(func() -> void: arm.visible = false)
	await tw.finished

# ------------------------------------------------------------ Ghurub

func _ghurub_boot(quick: bool) -> void:
	ui.hold(true)
	if not quick:
		cell = world.start_cell
		await show_arm(true)
	var cp: Vector3 = m.cam.global_position
	ui.device.visible = true
	ui.device.mode = "boot"
	ui.device.boot_lines = []
	sfx.play("boot", -4.0)
	var lines := ["[ SYSTEM RESTORE: 100% ]", "[ LOCAL INTERFACE: CONNECTED ]", "[ PREVIOUS OPERATOR:", "  SIGNAL LOST ]",
		"[ REGISTERING NEW OPERATOR", "  BIOMETRICS... COMPLETED ]"]
	for l in lines:
		ui.device.boot_lines.append(l)
		sfx.play("beep", -16.0)
		await wait(0.05 if quick else 0.45)
	if not quick:
		await wait(0.6)
	ui.hold(false)
	if not quick:
		await ui.say("GHURUB", "Booting sequence initiated. Temporal alignment: unstable. New biometric signature registered.")
		await ui.say("GHURUB", "Welcome, Operator. I am Ghurub — your interface for the Entity Containment System. We have a timeline to rewrite.")
		await ui.say("GHURUB", "Your heart rate is highly elevated and your optic nerves show signs of minor shock. Local threat level: 0%. Please breathe evenly.")
		await ui.say("GHURUB", "Audio logs recorded and archived. The deceased entity instructed us to 'restore the order of God.' I have logged the instruction. I lack the data to evaluate it.")
		ui.close_dialog()
		await ui.choose(["It died asking for God's order. That has to mean something.", "God's order got everyone here killed. I just want to live."])
		await ui.say("GHURUB", "Response logged.")
		await ui.say("GHURUB", "Its statement regarding a time machine has also been noted. My previous operator's records place the survival probability for a single human in this timeline at approximately 0.04%.")
		await ui.say("GHURUB", "Hypothesis: if the time machine exists, it is our only viable path to long-term survival. Recommendation: confirm its existence and leave this timeline immediately.")
		ui.close_dialog()
		await show_arm(false)
	ui.device.mode = "nav"
	flags["boot"] = true
	m.cam.global_position = cp

# ------------------------------------------------------------ exploration

func _place_cam() -> void:
	var p: Vector3 = world.to_world(cell)
	m.cam.position = p + Vector3(0, EYE, 0)
	m.cam.rotation = Vector3(0, yaw, 0)

func _start_explore() -> void:
	if auto:
		print("EXPLORE from ", cell)
	ui.close_dialog()
	ui.hold(false)
	# settle the camera onto the grid
	var p: Vector3 = world.to_world(cell) + Vector3(0, EYE, 0)
	var tw := create_tween().set_parallel(true)
	tw.tween_property(m.cam, "position", p, 0.6)
	tw.tween_property(m.cam, "rotation", Vector3(0, yaw, 0), 0.6)
	await tw.finished
	m.post.set_shader_parameter("blur", 0.0)
	exploring = true
	idle_t = 0.0
	last_dist = _dist()
	_reveal()
	_update_device()
	_save_checkpoint()
	ui.show_party(party() if st["demons"].size() > 0 else [])

func _held_keys() -> void:
	if Input.is_key_pressed(KEY_W) or Input.is_key_pressed(KEY_UP):
		step(0)
	elif Input.is_key_pressed(KEY_S) or Input.is_key_pressed(KEY_DOWN):
		step(2)
	elif Input.is_key_pressed(KEY_A) or Input.is_key_pressed(KEY_LEFT):
		turn(-1)
	elif Input.is_key_pressed(KEY_D) or Input.is_key_pressed(KEY_RIGHT):
		turn(1)
	elif Input.is_key_pressed(KEY_Q):
		step(3)
	elif Input.is_key_pressed(KEY_E):
		step(1)

func handle_key(k: int) -> void:
	if not exploring or moving or ui.mode != "":
		return
	if k in [KEY_TAB, KEY_C, KEY_M]:
		_comp_menu()

func turn(dir: int) -> void:
	moving = true
	idle_t = 0.0
	facing = wrapi(facing + dir, 0, 4)
	yaw -= dir * PI * 0.5
	var tw := create_tween()
	tw.tween_property(m.cam, "rotation:y", yaw, TURN_TIME).set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_OUT)
	await tw.finished
	_update_device()
	moving = false

func step(rel: int) -> void:
	var d: Vector2i = DIRS[wrapi(facing + rel, 0, 4)]
	var target := cell + d
	idle_t = 0.0
	if not world.walkable(target):
		moving = true
		sfx.play("step", -14.0, 0.7)
		var p: Vector3 = m.cam.position
		var tw := create_tween()
		tw.tween_property(m.cam, "position", p + Vector3(d.x, 0, d.y) * 0.35, 0.09)
		tw.tween_property(m.cam, "position", p, 0.14)
		await tw.finished
		moving = false
		if world.is_border(target) and nudge_cool <= 0 and flags.get("boot", false):
			nudge_cool = 6
			_nudge(Data.NUDGE_EDGE[randi() % Data.NUDGE_EDGE.size()])
		return
	moving = true
	cell = target
	var to: Vector3 = world.to_world(cell) + Vector3(0, EYE, 0)
	var from: Vector3 = m.cam.position
	sfx.play("step", -6.0, randf_range(0.85, 1.1))
	var tw := create_tween()
	tw.tween_method(func(k: float) -> void:
		m.cam.position = from.lerp(to, k) + Vector3(0, sin(k * PI) * 0.07, 0), 0.0, 1.0, STEP_TIME)
	await tw.finished
	moving = false
	await _on_step()

func _dist() -> float:
	return Vector2(cell - Data.GOAL).length()

func _reveal() -> void:
	for dy in range(-1, 2):
		for dx in range(-1, 2):
			var c := cell + Vector2i(dx, dy)
			if c.x >= 0 and c.y >= 0 and c.x < world.w and c.y < world.h:
				explored[c] = true

func _update_device() -> void:
	var d := Vector2(Data.GOAL - cell)
	ui.device.bearing = fposmod(rad_to_deg(atan2(d.x, -d.y)), 360.0)
	ui.device.heading = facing
	ui.device.dist_km = d.length() * Data.KM_PER_CELL
	ui.device.signal_level = enc_meter
	ui.device.hp = st["hero"]["hp"]
	ui.device.maxhp = st["hero"]["maxhp"]
	ui.device.cells = explored
	ui.device.player = cell

func _nudge(text: String) -> void:
	exploring = false
	await ui.say("GHURUB", text)
	ui.close_dialog()
	exploring = true

func _on_step() -> void:
	_reveal()
	since_event += 1
	nudge_cool -= 1
	var k: String = world.ch(cell)
	exploring = false
	# leaving the field of the dead
	if flags.get("boot", false) and not flags.get("gauntlet", false):
		if not flags.get("loot", false):
			flags["loot"] = true
			st["items"]["Medicine"] += 3
			await ui.say("GHURUB", "Medical supplies detected on the deceased. Recommendation: take them. They no longer require them.")
			ui.close_dialog()
			ui.toast("MEDICINE x3 OBTAINED")
		elif not flags.get("swept", false):
			flags["swept"] = true
			await ui.say("GHURUB", "Scanning for anomalous temporal signatures... none within a five-kilometer radius. The entity's data was incomplete. We require intelligence from a human population.")
			await ui.say("GHURUB", "I have isolated a low-frequency radio signal north-east, matching coordinates for the underground concourse of Shinjuku Station. Probability of a human settlement: 87.2%. We should proceed.")
			ui.close_dialog()
		if not world.in_battlefield(cell):
			await _gauntlet()
	# landmarks
	if k == "S" and not flags.get("sign", false):
		flags["sign"] = true
		since_event = 0
		await ui.say("GHURUB", "Landmark logged: a road sign. Text reads 'Shinjuku 3 km.' It is approximately accurate.")
		ui.close_dialog()
	elif k == "X" and not flags.get("lone", false):
		flags["lone"] = true
		since_event = 0
		st["items"]["Medicine"] += 2
		await ui.say("GHURUB", "A single body, far from the battlefield. Same unit as yours. Pack contents: medicine, two doses. Taking them.")
		ui.close_dialog()
		ui.toast("MEDICINE x2 OBTAINED")
	elif k == "M" and not flags.get("crate", false):
		flags["crate"] = true
		since_event = 0
		for u in party():
			u["hp"] = u["maxhp"]
			u["mp"] = u["maxmp"]
		sfx.play("heal", -4.0)
		await ui.say("GHURUB", "Military field crate. Seal intact. Applying contents. Operator and contained entities restored to full capacity.")
		await ui.say("GHURUB", "Progress archived. If you die past this point, I will not be able to tell you that you were warned. So: you are warned.")
		ui.close_dialog()
		_save_checkpoint()
		ui.show_party(party() if st["demons"].size() > 0 else [])
	elif _near("B") and not flags.get("bus", false):
		flags["bus"] = true
		since_event = 0
		await ui.say("GHURUB", "A municipal bus. Estimated age: two thousand years, give or take. Route display reads 'SHINJUKU STA. WEST EXIT.' We are on the right road. There is simply no road.")
		ui.close_dialog()
	# the rail yard and the scout
	if world.in_yard(cell) and not flags.get("yard", false):
		flags["yard"] = true
		since_event = 0
		await ui.say("GHURUB", "Structure ahead: a rail yard. Multiple metallic masses. Operator, I am detecting movement among the wreckage. Not demonic. Human.")
		if not flags.get("crate", false):
			await ui.say("GHURUB", "Note: I have logged a sealed military crate at the yard's southern edge. Recommendation: use it before we proceed.")
		await ui.say("GHURUB", "Progress archived.")
		ui.close_dialog()
		_save_checkpoint()
	if world.in_yard(cell) and cell.y <= 3 and not flags.get("boss_done", false):
		await _boss()
		_update_device()
		exploring = true
		return
	if k == "G":
		await _ending()
		return
	# encounters
	if encounters_on and not world.in_battlefield(cell) and not world.in_yard(cell):
		steps_since_gauntlet += 1
		if not flags.get("tutorial", false) and steps_since_gauntlet >= 3:
			flags["tutorial"] = true
			await _encounter(["pixie"], true)
		else:
			enc_meter += randf_range(0.05, 0.14)
			if enc_meter >= 1.0:
				enc_meter = 0.0
				await _encounter(Data.ENCOUNTERS[randi() % Data.ENCOUNTERS.size()], false)
	# guidance
	var d := _dist()
	if encounters_on:
		if d > last_dist + 0.01:
			drift_steps += 1
		else:
			drift_steps = max(drift_steps - 1, 0)
		if drift_steps >= 3 and nudge_cool <= 0:
			drift_steps = 0
			nudge_cool = 8
			await ui.say("GHURUB", Data.NUDGE_DRIFT[randi() % Data.NUDGE_DRIFT.size()])
			ui.close_dialog()
		for mark in [2.0, 1.0, 0.5]:
			var km := d * Data.KM_PER_CELL
			var key := "km%.1f" % mark
			if km <= mark and not flags.get(key, false) and flags.get("gauntlet", false):
				flags[key] = true
				await ui.say("GHURUB", "%s remaining. Signal strength increasing." % ("Two kilometers" if mark == 2.0 else ("One kilometer" if mark == 1.0 else "Five hundred meters")))
				ui.close_dialog()
		if since_event >= 12 and log_index < Data.LOG_FRAGMENTS.size():
			since_event = 0
			await ui.say("GHURUB", Data.LOG_FRAGMENTS[log_index])
			ui.close_dialog()
			log_index += 1
	last_dist = d
	_update_device()
	exploring = true

func _near(kind: String) -> bool:
	for dy in range(-1, 2):
		for dx in range(-1, 2):
			if world.ch(cell + Vector2i(dx, dy)) == kind:
				return true
	return false

func _gauntlet() -> void:
	flags["gauntlet"] = true
	if not flags.get("swept", false):
		flags["swept"] = true
		await ui.say("GHURUB", "Scanning for anomalous temporal signatures... none within five kilometers. I have isolated a radio signal north-east: Shinjuku Station. Probability of a human settlement: 87.2%.")
	await ui.say("GHURUB", "Warning, Operator. Heavy concentrations of hostile spiritual entities detected along the shortest path to the transit hub. Standard human evasion protocol calls for a stealth detour of fourteen hours.")
	await ui.say("GHURUB", "However, the probability that the time machine is compromised rises 7.2% for every hour we delay.")
	await ui.say("GHURUB", "Conclusion: evasion is not viable. We go through the nesting grounds. Initializing the Entity Containment System. We will force a path.")
	ui.close_dialog()
	encounters_on = true
	steps_since_gauntlet = 0
	_save_checkpoint()

func _encounter(ids: Array, tutorial: bool) -> void:
	exploring = false
	if auto:
		print("BATTLE ", ids, " at ", cell)
	ui.device.signal_level = 1.0
	var r: String = await battle.run(ids, {"tutorial": tutorial})
	if auto:
		print("  -> ", r, " hero hp ", st["hero"]["hp"], " demons ", st["demons"].size())
	await _after_battle(r)

func _after_battle(r: String) -> void:
	enc_meter = 0.0
	if r == "lose":
		await _game_over()
		return
	for d in st["demons"]:
		if d["hp"] <= 0:
			d["hp"] = 1
	ui.show_party(party() if st["demons"].size() > 0 else [])
	_update_device()

func _game_over() -> void:
	ui.hold(true)
	await fade(1.0, 1.2).finished
	m.post.set_shader_parameter("battle", 0.0)
	sfx.music("")
	await ui.title("SIGNAL LOST", "Restoring last archived position...", 1.6)
	_load_checkpoint()
	await fade(0.0, 1.0).finished
	ui.hold(false)

func _save_checkpoint() -> void:
	checkpoint = {"st": st.duplicate(true), "cell": cell, "facing": facing, "flags": flags.duplicate(true), "enc": encounters_on}

func _load_checkpoint() -> void:
	st = checkpoint["st"].duplicate(true)
	cell = checkpoint["cell"]
	facing = checkpoint["facing"]
	flags = checkpoint["flags"].duplicate(true)
	encounters_on = checkpoint["enc"]
	yaw = -facing * PI * 0.5
	_place_cam()
	ui.show_party(party() if st["demons"].size() > 0 else [])
	_update_device()

# ------------------------------------------------------------ the scout

func _boss() -> void:
	exploring = false
	if auto:
		print("BOSS at ", cell, " party ", party().map(func(u): return "%s L%d %d/%d" % [u["name"], u["lv"], u["hp"], u["maxhp"]]), " meds ", st["items"]["Medicine"])
	# Face down the open run of track; the scout steps out at the far end.
	var want := 1 if cell.x < 19 else 3
	while facing != want:
		await turn(1 if wrapi(want - facing, 0, 4) <= 2 else -1)
	exploring = false
	var fwd: Vector3 = -m.cam.global_transform.basis.z
	fwd.y = 0
	fwd = fwd.normalized()
	var side: Vector3 = fwd.cross(Vector3.UP)
	var base: Vector3 = m.cam.global_position
	base.y = 0
	var scout: Node3D = m.add_actor(Kit.scout())
	scout.position = base + fwd * 15.0 + side * 3.5
	scout.look_at(Vector3(base.x, 0, base.z), Vector3.UP)
	sfx.play("step", -2.0)
	var tw := create_tween()
	tw.tween_property(scout, "position", base + fwd * 14.0 + side * 0.6, 1.4).set_trans(Tween.TRANS_SINE)
	await tw.finished
	scout.look_at(Vector3(base.x, 0, base.z), Vector3.UP)
	await ui.say("SCOUT", "Stop right there.")
	await ui.say("SCOUT", "That unit on your arm. Where did you get it?")
	ui.close_dialog()
	await ui.choose(["From a dying angel. It told me to take it.", "Off the dead. They don't need it anymore."])
	await ui.say("SCOUT", "...A scavenger. Running straight through the nests like a lunatic, wearing a unit like that.")
	await ui.say("SCOUT", "Hand it over, or I take it off your corpse.")
	ui.close_dialog()
	await ui.choose(["No.", "Come and take it."])
	await ui.say("SCOUT", "Fine. Orthrus!")
	ui.close_dialog()
	# the summon
	var orth: Node3D = Kit.orthrus()
	m.add_actor(orth)
	var spot: Vector3 = base + fwd * 7.0 - side * 0.4
	orth.position = spot
	orth.look_at(Vector3(base.x, 0, base.z), Vector3.UP)
	Kit.set_param(orth, "dissolve", 1.0)
	Kit.set_param(orth, "dissolve_color", Color(1.0, 0.45, 0.1))
	sfx.play("summon", -2.0)
	var tw2 := create_tween()
	tw2.tween_method(func(v: float) -> void: Kit.set_param(orth, "dissolve", v), 1.0, 0.0, 1.6)
	await tw2.finished
	sfx.play("encounter", -4.0, 0.6)
	await ui.say("GHURUB", "Hostile summoner. Entity identified: Orthrus. Classification: Beast. Fire-resistant. Ice is recommended.")
	ui.close_dialog()
	var r: String = await battle.run(["orthrus"], {"boss": true, "scout": scout, "existing": [orth]})
	if r == "lose":
		m.remove_actor(scout)
		await _game_over()
		return
	flags["boss_done"] = true
	# the scout, beaten
	var body: Node3D = scout.get_node("body")
	var tw3 := create_tween()
	tw3.tween_property(body, "position", Vector3(0, -0.55, 0), 0.8).set_trans(Tween.TRANS_BOUNCE).set_ease(Tween.EASE_OUT)
	tw3.parallel().tween_property(body, "rotation_degrees:x", 18.0, 0.8)
	sfx.play("thud", -4.0)
	await tw3.finished
	await ui.say("SCOUT", "You're reckless... running through the nests like that. But I get it. You're hunting it too.")
	await ui.say("SCOUT", "A Ghurub unit... it doesn't matter now. The mission failed. Command lied to us. It was never a resource cache. It was a temporal capsule. They buried it deep under the old city.")
	await ui.say("SCOUT", "If you want in... go to the Shinjuku Underground. Find a man called Kuzuryu. Slippery bastard. Petty, black-market trash...")
	await ui.say("SCOUT", "...but he's the only one left who knows how to open the vault before the demons overrun the lower levels. Go. Before you run out of time.")
	ui.close_dialog()
	await wait(0.4)
	await ui.say("GHURUB", "The subject has lost consciousness. Vital signs: weak, stable. The testimony matches the radio signal. Recommendation: proceed north to the station.")
	ui.close_dialog()
	_save_checkpoint()
	ui.show_party(party())

# ------------------------------------------------------------ the ending

func _ending() -> void:
	exploring = false
	if auto:
		print("ENDING reached")
	ui.hold(true)
	var gate: Vector3 = world.station_pos
	var p: Vector3 = m.cam.global_position
	await dolly(p, p + (-m.cam.global_transform.basis.z) * 10.0, p + Vector3(0, 0.3, 0), gate + Vector3(0, 2.6, 0), 2.0).finished
	ui.hold(false)
	await ui.say("GHURUB", "We have arrived at the Shinjuku transit hub. Beginning background scans for the individual designated 'Kuzuryu.'")
	await ui.say("GHURUB", "Cross-referencing the scout's testimony with local radio traffic: the subject is described as untrustworthy, harshly regarded by the elite factions, and persistently alive.")
	await ui.say("GHURUB", "Expected combat threat: low. Expected negotiation threat: high. Recommendation: proceed with financial and logistical caution. We must secure the vault coordinates.")
	ui.close_dialog()
	ui.hold(true)
	ui.letterbox(true)
	sfx.music("")
	await dolly(p + Vector3(0, 0.3, 0), gate + Vector3(0, 2.6, 0), gate + Vector3(0, 2.2, 9.0), gate + Vector3(0, 1.2, -4.0), 5.0).finished
	await fade(1.0, 2.0).finished
	await ui.title("END OF PART 1", "Act I continues in Shinjuku.", 3.0)
	await ui.title("GHURUB", "Thank you for playing.", 2.5)
	ui.hold(false)
	await ui.prompt("[SPACE]  Play again")
	if auto:
		print("AUTO RUN COMPLETE")
		get_tree().quit()
		return
	get_tree().reload_current_scene()

# ------------------------------------------------------------ field menu

func _comp_menu() -> void:
	exploring = false
	ui.show_party(party())
	while true:
		var i: int = await ui.menu("GHURUB // COMP", ["ITEMS", "DEMONS", "CLOSE"])
		if i == 0:
			var n: int = st["items"]["Medicine"]
			if n <= 0:
				ui.toast("NO ITEMS")
				continue
			var names := []
			for u in party():
				names.append("%s  %d/%d" % [u["name"], u["hp"], u["maxhp"]])
			var t: int = await ui.menu("MEDICINE x%d  // TARGET" % n, names)
			if t >= 0:
				var u: Dictionary = party()[t]
				u["hp"] = mini(u["maxhp"], u["hp"] + 40)
				st["items"]["Medicine"] -= 1
				sfx.play("heal", -6.0)
				ui.toast("%s RECOVERED" % u["name"].to_upper())
				ui.show_party(party())
				_update_device()
		elif i == 1:
			if st["demons"].is_empty():
				await ui.say("GHURUB", "Containment directory: empty.")
				ui.close_dialog()
			for d in st["demons"]:
				await ui.say("GHURUB", "%s // %s  Lv%d   HP %d/%d   MP %d/%d   Skills: %s   Weak: %s" % [d["name"].to_upper(), d["race"], d["lv"],
					d["hp"], d["maxhp"], d["mp"], d["maxmp"], ", ".join(d["skills"]), ", ".join(d["weak"]) if d["weak"].size() > 0 else "none"])
			ui.close_dialog()
		else:
			break
	ui.show_party(party() if st["demons"].size() > 0 else [])
	exploring = true

# ------------------------------------------------------------ test bot

func _bot_step() -> void:
	# Walks toward the goal by breadth-first search; used with --auto to test the whole flow.
	var prev := {cell: cell}
	var q := [cell]
	var found := false
	while not q.is_empty():
		var c: Vector2i = q.pop_front()
		if c == Data.GOAL:
			found = true
			break
		for d in DIRS:
			var n: Vector2i = c + d
			if world.walkable(n) and not prev.has(n):
				prev[n] = c
				q.append(n)
	if not found:
		return
	var c2: Vector2i = Data.GOAL
	while prev[c2] != cell:
		c2 = prev[c2]
	var want := DIRS.find(c2 - cell)
	if want == facing:
		step(0)
	else:
		turn(1 if wrapi(want - facing, 0, 4) <= 2 else -1)
