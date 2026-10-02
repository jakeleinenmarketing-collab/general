extends Node3D
## The desert: grid data plus everything placed on it. Built once from Data.MAP.

const Kit = preload("res://src/kit.gd")
const Data = preload("res://src/data.gd")

const CELL := Data.CELL
const SOLID := "#TVBC"

var w := 0
var h := 0
var rng := RandomNumberGenerator.new()
var start_cell := Vector2i.ZERO
var fight_spot := Vector3.ZERO
var hero_body: Node3D
var hero_hand: Node3D
var scout_spot := Vector3.ZERO
var station_pos := Vector3.ZERO

func build() -> void:
	rng.seed = 2007
	h = Data.MAP.size()
	w = Data.MAP[0].length()
	for y in h:
		assert(Data.MAP[y].length() == w, "Map row %d has the wrong width" % y)
		var x: int = Data.MAP[y].find("P")
		if x >= 0:
			start_cell = Vector2i(x, y)
	_ground()
	for y in h:
		for x in w:
			_cell(Vector2i(x, y), Data.MAP[y][x])
	_battlefield_spill()
	_yard()
	_far_desert()
	_skyline()
	clear_near(hand_cam(0.75, 0.32), 1.9)
	clear_near(hand_cam(0.5, 0.2), 1.9)
	Kit.bake(self, 30.0, [hero_body])
	fight_spot = to_world(start_cell) + Vector3(0.6, 0, -7.0)

## Camera spot for the hand close-up: out past the fingertips, low, looking back up the arm.
func hand_cam(dist := 0.62, height := 0.26) -> Vector3:
	var hb: Basis = hero_hand.global_transform.basis
	return hero_hand.global_position + hb.z.normalized() * dist + hb.x.normalized() * 0.18 + Vector3(0, height, 0)

## Clear props out of a camera's way (used for the opening close-ups).
func clear_near(pos: Vector3, radius: float) -> void:
	for c in get_children():
		if c is Node3D and c != hero_body and not (c is MeshInstance3D and c.mesh is PlaneMesh):
			var d := Vector2(c.global_position.x - pos.x, c.global_position.z - pos.z).length()
			if d < radius and c.global_position.y < 1.0:
				remove_child(c)
				c.free()

func ch(c: Vector2i) -> String:
	if c.x < 0 or c.y < 0 or c.x >= w or c.y >= h:
		return "#"
	return Data.MAP[c.y][c.x]

func walkable(c: Vector2i) -> bool:
	return not SOLID.contains(ch(c))

func is_border(c: Vector2i) -> bool:
	return c.x <= 0 or c.y <= 0 or c.x >= w - 1 or c.y >= h - 1

func to_world(c: Vector2i) -> Vector3:
	return Vector3(c.x * CELL, 0.0, c.y * CELL)

func in_battlefield(c: Vector2i) -> bool:
	return c.x <= 5 and c.y >= 12

func in_yard(c: Vector2i) -> bool:
	return c.x >= 16 and c.y <= 5

func _place(n: Node3D, pos: Vector3, yaw := 0.0) -> Node3D:
	add_child(n)
	n.position += pos
	n.rotation.y += yaw
	return n

func _jit(r: float) -> Vector3:
	return Vector3(rng.randf_range(-r, r), 0, rng.randf_range(-r, r))

func _ground() -> void:
	var g := MeshInstance3D.new()
	var pm := PlaneMesh.new()
	pm.size = Vector2(3000, 3000)
	g.mesh = pm
	g.material_override = Kit.sand_mat()
	g.position = Vector3(w * CELL * 0.5, 0, h * CELL * 0.5)
	g.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(g)

func _corpse_at(pos: Vector3, side := -1) -> void:
	var a := side if side >= 0 else rng.randi_range(0, 1)
	var c := Kit.corpse(rng, Kit.SECT_A if a == 0 else Kit.SECT_B, Kit.SECT_A_PATCH if a == 0 else Kit.SECT_B_PATCH)
	_place(c, pos)

func _cell(c: Vector2i, k: String) -> void:
	var p := to_world(c)
	match k:
		"#":
			if is_border(c):
				if (c.x + c.y) % 2 == 0:
					var d := Kit.dune(rng, rng.randf_range(6.0, 8.0), rng.randf_range(0.5, 0.9))
					d.scale = Vector3(1.0, 0.7, 1.0)
					_place(d, p + _jit(1.5))
			else:
				_place(Kit.dune(rng, rng.randf_range(4.0, 6.0), rng.randf_range(2.6, 4.2)), p + _jit(0.8))
		"b":
			for i in rng.randi_range(2, 3):
				var off := Vector3(rng.randf_range(-2.6, 2.6), 0, rng.randf_range(-2.6, 2.6))
				if off.length() < 1.1:
					off = off.normalized() * 1.6
				_corpse_at(p + off)
			if rng.randf() < 0.6:
				_place(Kit.rifle(rng), p + _jit(2.5))
			if rng.randf() < 0.4:
				_place(Kit.helmet(rng, Kit.SECT_A if rng.randf() < 0.5 else Kit.SECT_B), p + _jit(2.5))
			if rng.randf() < 0.12:
				_place(Kit.banner(Kit.SECT_A_PATCH if rng.randf() < 0.5 else Color(0.3, 0.32, 0.24)), p + Vector3(2.4, 0, -2.2), rng.randf_range(0, TAU))
		"P":
			_hero(p)
			_place(Kit.rifle(rng), p + Vector3(-1.8, 0, -1.0))
			_place(Kit.helmet(rng, Kit.SECT_A), p + Vector3(-1.2, 0, 1.6))
			_corpse_at(p + Vector3(-2.3, 0, 1.6), 1)
			_corpse_at(p + Vector3(-2.4, 0, -2.0), 0)
		"T":
			if ch(c + Vector2i(0, -1)) != "T":
				var n := 0
				while ch(c + Vector2i(0, n)) == "T":
					n += 1
				var t := Kit.trench(n * CELL)
				_place(t, p + Vector3(0, 0, (n - 1) * CELL * 0.5))
			_corpse_at(p + Vector3(rng.randf_range(-0.4, 0.4), 0.05, rng.randf_range(-2, 2)))
		"V":
			_place(Kit.vehicle(), p, 0.6)
			_corpse_at(p + Vector3(2.5, 0, 1.0))
		"B":
			if ch(c + Vector2i(-1, 0)) != "B":
				_place(Kit.bus(), p + Vector3(CELL * 0.5, 0, 0), 0.08)
		"S":
			_place(Kit.road_sign("SHINJUKU  3 km\n<-  YOYOGI"), p + Vector3(2.2, 0, -1.6), 0.15)
		"X":
			_corpse_at(p + Vector3(1.6, 0, -1.4), 0)
			var pack := Kit.add(null, self, Kit.box(0.45, 0.35, 0.3), Color(0.35, 0.3, 0.2), p + Vector3(0.6, 0.18, -2.0), Vector3(0, 30, 10), {"ol": 0.012})
			pack.name = "pack"
		"M":
			_place(Kit.med_crate(), p + Vector3(1.8, 0, -1.8), 0.4)
		".":
			var r := rng.randf()
			if r < 0.07:
				_place(Kit.concrete_chunk(rng), p + _jit(2.6))
			elif r < 0.1 and not in_yard(c):
				_corpse_at(p + Vector3(rng.randf_range(-2.6, 2.6), 0, rng.randf_range(-2.6, 2.6)))
		"G":
			if ch(c + Vector2i(-1, 0)) != "G":
				station_pos = p + Vector3(CELL, 0, -CELL * 1.9)
				_place(Kit.station_gate(), station_pos)

## The battle spilled past the playable cells, so the pull-back shows how big it was.
func _battlefield_spill() -> void:
	var center := to_world(start_cell)
	for i in 70:
		var ang := rng.randf_range(PI * 0.5 - 0.35, PI + 0.45)
		var dist := rng.randf_range(14.0, 75.0)
		var pos := center + Vector3(cos(ang) * dist, 0, sin(ang) * dist * 0.8)
		var cell := Vector2i(roundi(pos.x / CELL), roundi(pos.z / CELL))
		var inside := cell.x >= 0 and cell.y >= 0 and cell.x < w and cell.y < h
		if inside and not is_border(cell):
			continue
		_corpse_at(pos)
		if rng.randf() < 0.3:
			_place(Kit.rifle(rng), pos + _jit(1.5))
	for i in 5:
		_place(Kit.banner(Kit.SECT_A_PATCH if i % 2 == 0 else Color(0.3, 0.32, 0.24)),
			center + Vector3(rng.randf_range(-40, -10), 0, rng.randf_range(5, 40)), rng.randf_range(0, TAU))
	for i in 3:
		_place(Kit.vehicle(), center + Vector3(rng.randf_range(-55, -15), 0, rng.randf_range(12, 45)), rng.randf_range(0, TAU))
	var t := Kit.trench(60.0)
	_place(t, center + Vector3(-20, 0, 30), 1.2)

func _hero(p: Vector3) -> void:
	# Takeya, lying among the dead. His right hand is the first thing we see.
	hero_body = Node3D.new()
	var uni := Kit.SECT_A
	Kit.add(null, hero_body, Kit.cap(0.2, 0.78), uni, Vector3(0, 0.17, 0), Vector3(0, 0, 90), {"ol": 0.014})
	Kit.add(null, hero_body, Kit.box(0.12, 0.04, 0.12), Kit.SECT_A_PATCH, Vector3(0.12, 0.36, 0.1), Vector3.ZERO, {"outline": false})
	var head := Kit.piv(hero_body, "head", Vector3(0.56, 0.15, 0), Vector3(0, 20, 0))
	Kit.add(null, head, Kit.sph(0.13), Kit.SKIN, Vector3.ZERO, Vector3.ZERO, {"ol": 0.012})
	Kit.add(null, head, Kit.sph(0.15, 0.2, 10, 4), Color(0.12, 0.09, 0.07), Vector3(0.03, 0.06, 0), Vector3.ZERO, {"ol": 0.01})
	Kit.limb(hero_body, Vector3(0.28, 0.16, -0.22), 160.0, 0.62, 0.075, uni, Kit.GEAR)
	Kit.limb(hero_body, Vector3(-0.32, 0.14, 0.1), -80.0, 0.85, 0.09, uni.darkened(0.15), Kit.GEAR, true)
	Kit.limb(hero_body, Vector3(-0.32, 0.14, -0.1), -105.0, 0.85, 0.09, uni.darkened(0.15), Kit.GEAR, true)
	var arm := Kit.piv(hero_body, "arm_r", Vector3(0.28, 0.16, 0.22), Vector3(0, 40, 0))
	Kit.add(null, arm, Kit.cap(0.075, 0.62), uni, Vector3(0, 0, 0.31), Vector3(90, 0, 0), {"ol": 0.012})
	hero_hand = Kit.piv(arm, "hand", Vector3(0, 0, 0.66))
	Kit.add(null, hero_hand, Kit.box(0.11, 0.06, 0.13), Kit.GEAR, Vector3.ZERO, Vector3.ZERO, {"ol": 0.008})
	for i in 4:
		var f := Kit.piv(hero_hand, "finger", Vector3(-0.04 + i * 0.027, 0, 0.07), Vector3(0, 0, 0))
		Kit.add(null, f, Kit.cap(0.014, 0.08), Kit.GEAR, Vector3(0, 0, 0.035), Vector3(90, 0, 0), {"ol": 0.004})
	Kit.add(null, hero_hand, Kit.cap(0.016, 0.07), Kit.GEAR, Vector3(0.06, 0, 0.02), Vector3(90, 50, 0), {"ol": 0.004})
	# sand drifted over the wrist
	Kit.add(null, hero_hand, Kit.sph(0.09, 0.05, 8, 4), Kit.SAND_COL, Vector3(0.0, 0.01, -0.09), Vector3.ZERO, {"outline": false, "rim": 0.1})
	hero_body.rotation_degrees.y = -100
	hero_body.position = p + Vector3(0.0, 0.0, 0.4)
	add_child(hero_body)

func _yard() -> void:
	for y in range(1, 6):
		var row: String = Data.MAP[y]
		var x0 := -1
		for x in w:
			var k := row[x]
			if (k == "R" or k == "C" or k == "G") and x0 < 0:
				x0 = x
		if x0 >= 0 and y in [2, 4]:
			var r := Kit.rails(9.0 * CELL)
			_place(r, Vector3((x0 + 3.5) * CELL, 0.0, y * CELL + 1.2))
	for y in h:
		var x := 0
		while x < w:
			if ch(Vector2i(x, y)) == "C":
				var n := 0
				while ch(Vector2i(x + n, y)) == "C":
					n += 1
				var car := Kit.train_car(n * CELL - 0.6, rng)
				car.rotation_degrees = Vector3(0, rng.randf_range(-6, 6), rng.randf_range(-7, 7))
				_place(car, Vector3((x + (n - 1) * 0.5) * CELL, rng.randf_range(-0.9, -0.2), y * CELL + 0.6))
				x += n
			else:
				x += 1
	for c in [Vector2i(16, 3), Vector2i(20, 5), Vector2i(22, 3), Vector2i(17, 1)]:
		_place(Kit.catenary(), to_world(c) + Vector3(-2.8, 0, 2.6), 0.0)
	# a car that left the rails entirely, east of the yard
	var stray := Kit.train_car(16.0, rng)
	stray.rotation_degrees = Vector3(0, 50, 72)
	_place(stray, to_world(Vector2i(23, 7)) + Vector3(10, 0.6, -4))
	scout_spot = to_world(Vector2i(19, 3)) + Vector3(-1.0, 0, -2.0)

func _far_desert() -> void:
	var center := Vector3(w * CELL * 0.5, 0, h * CELL * 0.5)
	for i in 70:
		var ang := rng.randf_range(0, TAU)
		var dist := rng.randf_range(140.0, 620.0)
		var pos := center + Vector3(cos(ang) * dist, 0, sin(ang) * dist)
		var size := rng.randf_range(16.0, 45.0)
		_place(Kit.dune(rng, size, rng.randf_range(5.0, 18.0)), pos)
	for i in 40:
		var ang := rng.randf_range(0, TAU)
		var dist := rng.randf_range(80.0, 200.0)
		_place(Kit.concrete_chunk(rng), center + Vector3(cos(ang) * dist, 0, sin(ang) * dist))
	_place(Kit.overpass(rng, 90.0), center + Vector3(-150, -2.0, -40), 0.5)
	_place(Kit.overpass(rng, 70.0), center + Vector3(170, -3.5, 120), -0.9)
	_place(Kit.overpass(rng, 60.0), center + Vector3(40, -2.5, 190), 0.1)

func _skyline() -> void:
	# Shinjuku's towers to the north-east: the visible compass for the whole walk.
	var base := to_world(Data.GOAL)
	var spots := [
		[Vector3(160, 0, -300), 34.0, 190.0, true],
		[Vector3(250, 0, -230), 28.0, 150.0, false],
		[Vector3(80, 0, -390), 32.0, 220.0, true],
		[Vector3(320, 0, -340), 24.0, 130.0, true],
		[Vector3(10, 0, -280), 22.0, 105.0, false],
	]
	for s in spots:
		var b := Kit.skyscraper(rng, s[1], s[2], s[3])
		_place(b, base + s[0] + Vector3(0, -s[2] * 0.12, 0), rng.randf_range(-0.2, 0.2))
	var tower := Kit.tokyo_tower()
	_place(tower, Vector3(620, -20, -140), 0.4)
