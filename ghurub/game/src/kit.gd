extends RefCounted
## The demon kit. Every demon, body and prop is assembled here from primitive
## meshes and the same toon + outline shaders, so they all belong to one world.

const TOON := preload("res://shaders/toon.gdshader")
const TOON_DOUBLE := preload("res://shaders/toon_double.gdshader")
const OUTLINE := preload("res://shaders/outline.gdshader")
const SAND := preload("res://shaders/sand.gdshader")
const GLINT := preload("res://shaders/glint.gdshader")

# Palette
const SAND_COL := Color(0.88, 0.66, 0.3)
const SECT_A := Color(0.36, 0.4, 0.47)   # slate coats, red patch
const SECT_A_PATCH := Color(0.62, 0.12, 0.1)
const SECT_B := Color(0.29, 0.29, 0.2)   # dark olive, pale patch
const SECT_B_PATCH := Color(0.85, 0.82, 0.7)
const SKIN := Color(0.62, 0.45, 0.34)
const GEAR := Color(0.2, 0.19, 0.17)
const SILVER := Color(0.74, 0.76, 0.79)
const LCD := Color(0.37, 0.95, 1.0)
const GOLD := Color(1.0, 0.76, 0.26)
const CONCRETE := Color(0.6, 0.58, 0.54)
const RUST := Color(0.46, 0.25, 0.14)

# ---------------------------------------------------------------- materials

static func mat(color: Color, o: Dictionary = {}) -> ShaderMaterial:
	var m := ShaderMaterial.new()
	m.shader = TOON_DOUBLE if o.get("double", false) else TOON
	m.set_shader_parameter("albedo", color)
	if o.has("emit"):
		m.set_shader_parameter("emission_color", o["emit"])
		m.set_shader_parameter("emission_energy", o.get("emit_e", 1.6))
	if o.has("spec"):
		m.set_shader_parameter("spec_amount", o["spec"])
	m.set_shader_parameter("rim_amount", o.get("rim", 0.35))
	if o.has("fog"):
		m.set_shader_parameter("fog_mult", o["fog"])
	if o.has("wave"):
		m.set_shader_parameter("wave", o["wave"])
	if o.get("outline", true):
		var ol := ShaderMaterial.new()
		ol.shader = OUTLINE
		ol.set_shader_parameter("thickness", o.get("ol", 0.018))
		if o.has("line"):
			ol.set_shader_parameter("line_color", o["line"])
		if o.has("wave"):
			ol.set_shader_parameter("wave", o["wave"])
		m.next_pass = ol
	return m

static func sand_mat() -> ShaderMaterial:
	var m := ShaderMaterial.new()
	m.shader = SAND
	m.set_shader_parameter("rim_amount", 0.0)
	return m

static func glint_mat(color: Color, intensity := 1.0) -> ShaderMaterial:
	var m := ShaderMaterial.new()
	m.shader = GLINT
	m.set_shader_parameter("color", color)
	m.set_shader_parameter("intensity", intensity)
	return m

# ---------------------------------------------------------------- meshes

static func sph(r: float, h := -1.0, seg := 10, rings := 6) -> SphereMesh:
	var m := SphereMesh.new()
	m.radius = r
	m.height = r * 2.0 if h < 0.0 else h
	m.radial_segments = seg
	m.rings = rings
	return m

static func hemi(r: float, seg := 10) -> SphereMesh:
	var m := sph(r, r, seg, 4)
	m.is_hemisphere = true
	return m

static func cap(r: float, h: float, seg := 8) -> CapsuleMesh:
	var m := CapsuleMesh.new()
	m.radius = r
	m.height = max(h, r * 2.0 + 0.01)
	m.radial_segments = seg
	m.rings = 2
	return m

static func cyl(top: float, bottom: float, h: float, seg := 8) -> CylinderMesh:
	var m := CylinderMesh.new()
	m.top_radius = top
	m.bottom_radius = bottom
	m.height = h
	m.radial_segments = seg
	m.rings = 1
	return m

static func cone(r: float, h: float, seg := 6) -> CylinderMesh:
	return cyl(0.0, r, h, seg)

static func box(x: float, y: float, z: float) -> BoxMesh:
	var m := BoxMesh.new()
	m.size = Vector3(x, y, z)
	return m

static func prism(x: float, y: float, z: float) -> PrismMesh:
	var m := PrismMesh.new()
	m.size = Vector3(x, y, z)
	return m

static func torus(inner: float, outer: float) -> TorusMesh:
	var m := TorusMesh.new()
	m.inner_radius = inner
	m.outer_radius = outer
	m.rings = 10
	m.ring_segments = 6
	return m

# ---------------------------------------------------------------- assembly

static func actor(kind: String) -> Node3D:
	var n := Node3D.new()
	n.name = kind
	n.set_meta("kind", kind)
	n.set_meta("mats", [])
	n.set_meta("anims", [])
	return n

static func piv(parent: Node3D, pname: String, pos := Vector3.ZERO, rot := Vector3.ZERO) -> Node3D:
	var p := Node3D.new()
	p.name = pname
	p.position = pos
	p.rotation_degrees = rot
	parent.add_child(p)
	return p

static func add(a: Node3D, parent: Node3D, mesh: Mesh, color: Color, pos := Vector3.ZERO, rot := Vector3.ZERO, o: Dictionary = {}) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	mi.mesh = mesh
	var m := mat(color, o)
	mi.material_override = m
	mi.position = pos
	mi.rotation_degrees = rot
	if o.has("scale"):
		mi.scale = o["scale"]
	if not o.get("shadow", true):
		mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	parent.add_child(mi)
	if a != null and a.has_meta("mats"):
		a.get_meta("mats").append(m)
	return mi

## A box stretched between two points (for lattices, legs, poles).
static func beam(a: Node3D, parent: Node3D, from: Vector3, to: Vector3, t: float, color: Color, o: Dictionary = {}) -> MeshInstance3D:
	var len := from.distance_to(to)
	var mi := add(a, parent, box(t, len, t), color, Vector3.ZERO, Vector3.ZERO, o)
	var up := (to - from).normalized()
	var side := up.cross(Vector3.FORWARD)
	if side.length() < 0.01:
		side = up.cross(Vector3.RIGHT)
	side = side.normalized()
	var fwd := side.cross(up).normalized()
	mi.transform = Transform3D(Basis(side, up, fwd), (from + to) * 0.5)
	return mi

## Register a looping motion on a pivot. kind: "bob" moves along axis, "rot" rotates around it.
static func anim(a: Node3D, node: Node3D, kind: String, axis: Vector3, amp: float, freq: float, phase := 0.0) -> void:
	a.get_meta("anims").append({"node": node, "kind": kind, "axis": axis, "amp": amp, "freq": freq,
		"phase": phase, "p": node.position, "r": node.rotation})

static func animate(a: Node3D, t: float) -> void:
	if not a.has_meta("anims"):
		return
	for e in a.get_meta("anims"):
		var n: Node3D = e["node"]
		var s: float = sin(t * e["freq"] + e["phase"]) * e["amp"]
		if e["kind"] == "bob":
			n.position = e["p"] + e["axis"] * s
		else:
			n.rotation = e["r"] + e["axis"] * s

static func set_param(a: Node3D, pname: String, value: Variant) -> void:
	for m in a.get_meta("mats", []):
		m.set_shader_parameter(pname, value)
		if m.next_pass != null and (pname == "dissolve" or pname == "wave"):
			m.next_pass.set_shader_parameter(pname, value)

static func glint(parent: Node3D, color: Color, size := 0.6, intensity := 1.0) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	var q := QuadMesh.new()
	q.size = Vector2(size, size)
	mi.mesh = q
	mi.material_override = glint_mat(color, intensity)
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	parent.add_child(mi)
	return mi

# ---------------------------------------------------------------- baking

## Merge every static mesh under `root` into a few big meshes, chunked by area and
## grouped by look. Same pixels, a tiny fraction of the draw calls.
static func bake(root: Node3D, chunk: float, keep: Array) -> void:
	var groups := {}
	var doomed: Array[Node] = []
	_bake_collect(root, root, chunk, keep, groups, doomed)
	for key in groups.keys():
		var g: Dictionary = groups[key]
		var arr := []
		arr.resize(Mesh.ARRAY_MAX)
		arr[Mesh.ARRAY_VERTEX] = g["v"]
		arr[Mesh.ARRAY_NORMAL] = g["n"]
		arr[Mesh.ARRAY_COLOR] = g["c"]
		arr[Mesh.ARRAY_INDEX] = g["i"]
		var am := ArrayMesh.new()
		am.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arr)
		var mi := MeshInstance3D.new()
		mi.mesh = am
		var m: ShaderMaterial = g["mat"]
		if m.shader == TOON:
			var nm := mat(Color.WHITE, {"rim": g["rim"], "fog": g["fog"], "outline": g["ol"] > 0.0, "ol": g["ol"]})
			nm.set_shader_parameter("use_vertex_color", true)
			nm.set_shader_parameter("spec_amount", g["spec"])
			mi.material_override = nm
		else:
			mi.material_override = m
		root.add_child(mi)
	for n in doomed:
		n.get_parent().remove_child(n)
		n.free()

static func _bake_collect(root: Node3D, n: Node, chunk: float, keep: Array, groups: Dictionary, doomed: Array[Node]) -> void:
	for c in n.get_children():
		if keep.has(c):
			continue
		if c is MeshInstance3D:
			var mi: MeshInstance3D = c
			var m := mi.material_override as ShaderMaterial
			if m == null or mi.mesh == null or not (m.shader == TOON or m.shader == SAND):
				continue
			if mi.mesh is PlaneMesh and (mi.mesh as PlaneMesh).size.x > 100.0:
				continue
			var xf: Transform3D = root.global_transform.affine_inverse() * mi.global_transform
			var pos := xf.origin
			var ol := 0.0
			if m.next_pass != null:
				ol = snappedf(float(m.next_pass.get_shader_parameter("thickness")), 0.01)
			var rim := snappedf(float(m.get_shader_parameter("rim_amount")), 0.1)
			var fog := float(m.get_shader_parameter("fog_mult")) if m.get_shader_parameter("fog_mult") != null else 1.0
			var spec := snappedf(float(m.get_shader_parameter("spec_amount")) if m.get_shader_parameter("spec_amount") != null else 0.0, 0.5)
			var cell := Vector2i(floori(pos.x / chunk), floori(pos.z / chunk))
			var key := "%s|%d,%d|%.2f|%.1f|%.2f|%.1f" % ["sand" if m.shader == SAND else "toon", cell.x, cell.y, ol, rim, fog, spec]
			if not groups.has(key):
				groups[key] = {"v": PackedVector3Array(), "n": PackedVector3Array(), "c": PackedColorArray(),
					"i": PackedInt32Array(), "mat": m, "ol": ol, "rim": rim, "fog": fog, "spec": spec}
			var g: Dictionary = groups[key]
			var col: Color = m.get_shader_parameter("albedo") if m.shader == TOON else Color.WHITE
			var nb := xf.basis.inverse().transposed()
			for s in mi.mesh.get_surface_count():
				var a := mi.mesh.surface_get_arrays(s)
				var verts: PackedVector3Array = a[Mesh.ARRAY_VERTEX]
				var norms: PackedVector3Array = a[Mesh.ARRAY_NORMAL]
				var idx = a[Mesh.ARRAY_INDEX]
				var base: int = g["v"].size()
				var v: PackedVector3Array = g["v"]
				var nn: PackedVector3Array = g["n"]
				var cc: PackedColorArray = g["c"]
				var ii: PackedInt32Array = g["i"]
				for k in verts.size():
					v.append(xf * verts[k])
					nn.append((nb * norms[k]).normalized())
					cc.append(col)
				if idx == null or (idx as PackedInt32Array).is_empty():
					for k in verts.size():
						ii.append(base + k)
				else:
					for k in (idx as PackedInt32Array):
						ii.append(base + k)
				g["v"] = v
				g["n"] = nn
				g["c"] = cc
				g["i"] = ii
			doomed.append(mi)
		elif c is Node3D:
			_bake_collect(root, c, chunk, keep, groups, doomed)

# ---------------------------------------------------------------- the device

static func device(a: Node3D, parent: Node3D, pos := Vector3.ZERO, rot := Vector3.ZERO, s := 1.0) -> Node3D:
	var d := piv(parent, "device", pos, rot)
	add(a, d, box(0.17 * s, 0.035 * s, 0.12 * s), SILVER, Vector3.ZERO, Vector3.ZERO, {"spec": 0.9, "ol": 0.006})
	add(a, d, box(0.13 * s, 0.01 * s, 0.07 * s), LCD, Vector3(0, 0.02 * s, -0.018 * s), Vector3.ZERO,
		{"emit": LCD, "emit_e": 1.4, "outline": false})
	add(a, d, box(0.14 * s, 0.01 * s, 0.03 * s), GEAR, Vector3(0, 0.02 * s, 0.038 * s), Vector3.ZERO, {"outline": false})
	add(a, d, box(0.02 * s, 0.02 * s, 0.03 * s), Color(0.55, 0.12, 0.1), Vector3(-0.092 * s, 0, 0), Vector3.ZERO, {"outline": false})
	return d

# ---------------------------------------------------------------- humans

## A fallen soldier, lying in the sand. Never graphic: just stillness.
static func corpse(rng: RandomNumberGenerator, uni: Color, patch: Color, buried := 0.3) -> Node3D:
	var r := Node3D.new()
	var gear := uni.darkened(0.35)
	add(null, r, cap(0.2, 0.78), uni, Vector3(0, 0.17, 0), Vector3(0, 0, 90), {"ol": 0.014})
	add(null, r, box(0.12, 0.04, 0.12), patch, Vector3(0.12, 0.36, 0.1), Vector3.ZERO, {"outline": false})
	add(null, r, box(0.3, 0.12, 0.34), gear, Vector3(0.05, 0.08, 0), Vector3.ZERO, {"ol": 0.01})
	var head_turn := rng.randf_range(-40, 40)
	var head := piv(r, "head", Vector3(0.56, 0.15, 0), Vector3(0, head_turn, 0))
	add(null, head, sph(0.13), SKIN, Vector3.ZERO, Vector3.ZERO, {"ol": 0.012})
	if rng.randf() < 0.8:
		add(null, head, hemi(0.17), gear, Vector3(0.02, 0.02, 0), Vector3(0, 0, -75), {"ol": 0.012})
	# arms
	limb(r, Vector3(0.28, 0.16, 0.22), rng.randf_range(-10, 70), 0.62, 0.075, uni, GEAR)
	limb(r, Vector3(0.28, 0.16, -0.22), rng.randf_range(110, 190), 0.62, 0.075, uni, GEAR)
	# legs
	limb(r, Vector3(-0.32, 0.14, 0.1), rng.randf_range(-115, -70), 0.85, 0.09, uni.darkened(0.15), GEAR, true)
	limb(r, Vector3(-0.32, 0.14, -0.1), rng.randf_range(-110, -65) - 20.0, 0.85, 0.09, uni.darkened(0.15), GEAR, true)
	# sand drifted over part of the body
	if rng.randf() < buried:
		var mound := add(null, r, sph(0.55, 0.32, 10, 4), SAND_COL, Vector3(-0.75, 0.0, rng.randf_range(-0.2, 0.2)),
			Vector3.ZERO, {"outline": false, "rim": 0.1})
		mound.scale = Vector3(1.4, 1.0, 1.0)
	r.rotation_degrees.y = rng.randf_range(0, 360)
	return r

static func limb(parent: Node3D, joint: Vector3, yaw: float, length: float, radius: float, color: Color, end_col: Color, boot := false) -> Node3D:
	var p := piv(parent, "limb", joint, Vector3(0, yaw, 0))
	add(null, p, cap(radius, length), color, Vector3(0, 0, length * 0.5), Vector3(90, 0, 0), {"ol": 0.012})
	if boot:
		add(null, p, box(0.13, 0.15, 0.24), end_col, Vector3(0, 0.02, length + 0.02), Vector3.ZERO, {"ol": 0.01})
	else:
		add(null, p, sph(0.07), end_col, Vector3(0, 0, length + 0.02), Vector3.ZERO, {"ol": 0.01})
	return p

static func rifle(rng: RandomNumberGenerator) -> Node3D:
	var r := Node3D.new()
	add(null, r, box(1.0, 0.07, 0.06), GEAR, Vector3(0, 0.05, 0), Vector3.ZERO, {"ol": 0.008})
	add(null, r, box(0.28, 0.12, 0.06), Color(0.3, 0.22, 0.15), Vector3(-0.45, 0.06, 0), Vector3(0, 0, -8), {"ol": 0.008})
	add(null, r, box(0.06, 0.18, 0.05), GEAR, Vector3(0.05, -0.03, 0), Vector3(0, 0, 12), {"ol": 0.008})
	r.rotation_degrees = Vector3(0, rng.randf_range(0, 360), rng.randf_range(-6, 6))
	return r

static func helmet(rng: RandomNumberGenerator, col: Color) -> Node3D:
	var r := Node3D.new()
	add(null, r, hemi(0.17), col.darkened(0.35), Vector3.ZERO, Vector3(rng.randf_range(-100, 100), 0, rng.randf_range(60, 110)), {"ol": 0.01})
	r.position.y = 0.1
	return r

## The scout: an elite summoner from the other sect, standing.
static func scout() -> Node3D:
	var a := actor("scout")
	var body := piv(a, "body")
	var coat := SECT_B
	add(a, body, cyl(0.22, 0.36, 1.1, 10), coat, Vector3(0, 0.62, 0))
	add(a, body, cap(0.21, 0.6), coat.lightened(0.05), Vector3(0, 1.25, 0))
	add(a, body, torus(0.18, 0.27), Color(0.55, 0.15, 0.12), Vector3(0, 1.5, 0), Vector3(0, 0, 0), {"ol": 0.01})
	var head := piv(body, "head", Vector3(0, 1.66, 0))
	add(a, head, sph(0.14), SKIN.darkened(0.1))
	add(a, head, sph(0.18, 0.34, 10, 6), coat.darkened(0.2), Vector3(0, 0.03, 0.05))
	add(a, head, box(0.24, 0.07, 0.06), Color(0.95, 0.6, 0.2), Vector3(0, 0.02, -0.13), Vector3.ZERO,
		{"emit": Color(1.0, 0.55, 0.15), "emit_e": 2.0, "ol": 0.008})
	for side in [-1.0, 1.0]:
		var arm := piv(body, "arm", Vector3(0.27 * side, 1.42, 0), Vector3(0, 0, 8.0 * side))
		add(a, arm, cap(0.07, 0.62), coat, Vector3(0, -0.3, 0))
		add(a, arm, sph(0.07), GEAR, Vector3(0, -0.62, 0))
		if side < 0.0:
			device(a, arm, Vector3(0, -0.42, -0.07), Vector3(90, 0, 0), 1.0)
	for side in [-1.0, 1.0]:
		add(a, body, box(0.14, 0.16, 0.26), GEAR, Vector3(0.12 * side, 0.08, -0.04))
	anim(a, body, "bob", Vector3.UP, 0.015, 1.6)
	return a

# ---------------------------------------------------------------- angel & demons

static func angel() -> Node3D:
	var a := actor("angel")
	var body := piv(a, "body")
	var white := Color(0.94, 0.92, 0.87)
	add(a, body, cyl(0.2, 0.62, 1.9, 12), white, Vector3(0, 0.95, 0), Vector3.ZERO, {"rim": 0.5})
	add(a, body, torus(0.56, 0.66), GOLD, Vector3(0, 0.08, 0), Vector3.ZERO, {"spec": 0.8, "ol": 0.012})
	add(a, body, sph(0.36, 0.5, 12, 6), white, Vector3(0, 1.88, 0))
	# hood and mask
	var head := piv(body, "head", Vector3(0, 2.15, 0))
	add(a, head, sph(0.27, 0.62, 12, 6), white.darkened(0.05), Vector3(0, 0.06, 0.06))
	add(a, head, sph(0.22, 0.4, 12, 6), Color(0.08, 0.06, 0.06), Vector3(0, 0.02, -0.08), Vector3.ZERO, {"outline": false, "rim": 0.0})
	add(a, head, sph(0.18, 0.3, 12, 6), GOLD, Vector3(0, 0.0, -0.2), Vector3.ZERO,
		{"spec": 1.0, "rim": 0.6, "emit": Color(0.5, 0.33, 0.05), "emit_e": 0.6, "ol": 0.01})
	add(a, head, box(0.07, 0.014, 0.02), Color(0.15, 0.08, 0.02), Vector3(-0.065, 0.03, -0.37), Vector3(0, 0, 8), {"outline": false})
	add(a, head, box(0.07, 0.014, 0.02), Color(0.15, 0.08, 0.02), Vector3(0.065, 0.03, -0.37), Vector3(0, 0, -8), {"outline": false})
	add(a, body, torus(0.2, 0.3), GOLD, Vector3(0, 1.92, 0), Vector3.ZERO, {"spec": 0.8, "ol": 0.01})
	# wings
	for side in [-1.0, 1.0]:
		var w := piv(body, "wing", Vector3(0.18 * side, 1.85, 0.25), Vector3(0, -25.0 * side, 0))
		add(a, w, sph(0.22, 1.25, 10, 6), white.lightened(0.04), Vector3(0.38 * side, 0.1, 0.1), Vector3(0, 0, -38.0 * side),
			{"scale": Vector3(1.0, 1.0, 0.28)})
		add(a, w, sph(0.16, 0.9, 10, 6), white, Vector3(0.6 * side, -0.25, 0.12), Vector3(0, 0, -62.0 * side),
			{"scale": Vector3(1.0, 1.0, 0.25)})
		anim(a, w, "rot", Vector3(0, 0, 1.0 * side), 0.08, 2.2, 0.0)
	# arms and the sword
	var arm_r := piv(body, "arm_r", Vector3(0.36, 1.78, 0), Vector3(0, 0, 18))
	add(a, arm_r, cap(0.09, 0.75), white, Vector3(0, -0.36, 0))
	add(a, arm_r, sph(0.07), GOLD, Vector3(0, -0.74, 0), Vector3.ZERO, {"spec": 0.6, "ol": 0.008})
	var sword := piv(arm_r, "sword", Vector3(0, -0.76, -0.05), Vector3(-80, 0, 0))
	add(a, sword, box(0.05, 1.15, 0.015), Color(0.85, 0.88, 0.92), Vector3(0, 0.62, 0), Vector3.ZERO, {"spec": 1.0, "ol": 0.006})
	add(a, sword, box(0.22, 0.04, 0.05), GOLD, Vector3(0, 0.04, 0), Vector3.ZERO, {"spec": 0.8, "ol": 0.006})
	var arm_l := piv(body, "arm_l", Vector3(-0.36, 1.78, 0), Vector3(0, 0, -18))
	add(a, arm_l, cap(0.09, 0.75), white, Vector3(0, -0.36, 0))
	add(a, arm_l, sph(0.07), GOLD, Vector3(0, -0.74, 0), Vector3.ZERO, {"spec": 0.6, "ol": 0.008})
	# gold blood on the cloak
	add(a, body, box(0.05, 0.5, 0.02), GOLD, Vector3(0.12, 1.2, -0.42), Vector3(14, 0, 6),
		{"emit": GOLD, "emit_e": 0.5, "outline": false})
	add(a, body, box(0.04, 0.3, 0.02), GOLD, Vector3(-0.2, 0.9, -0.48), Vector3(18, 0, -10),
		{"emit": GOLD, "emit_e": 0.5, "outline": false})
	anim(a, body, "bob", Vector3.UP, 0.04, 1.4)
	return a

static func imp() -> Node3D:
	var a := actor("imp")
	var red := Color(0.78, 0.14, 0.09)
	var body := piv(a, "body", Vector3(0, 0.0, 0))
	add(a, body, cap(0.17, 0.46), red, Vector3(0, 0.55, 0), Vector3(12, 0, 0))
	add(a, body, sph(0.13, 0.2), red.lightened(0.15), Vector3(0, 0.5, -0.1))
	var head := piv(body, "head", Vector3(0, 0.9, -0.04))
	add(a, head, sph(0.22, 0.4, 12, 6), red)
	add(a, head, sph(0.14, 0.12, 10, 4), Color(0.12, 0.02, 0.02), Vector3(0, -0.07, -0.17), Vector3.ZERO, {"outline": false})
	for i in 5:
		var x := -0.08 + i * 0.04
		add(a, head, prism(0.025, 0.05, 0.02), Color(0.98, 0.95, 0.85), Vector3(x, -0.04, -0.21), Vector3(180, 0, 0), {"outline": false})
	for side in [-1.0, 1.0]:
		add(a, head, sph(0.04), Color(1.0, 0.85, 0.2), Vector3(0.09 * side, 0.05, -0.18), Vector3.ZERO,
			{"emit": Color(1.0, 0.8, 0.1), "emit_e": 2.5, "outline": false})
		add(a, head, cone(0.045, 0.22), Color(0.1, 0.07, 0.07), Vector3(0.12 * side, 0.22, 0.02), Vector3(-15, 0, -28.0 * side))
		add(a, head, prism(0.12, 0.14, 0.03), red.darkened(0.15), Vector3(0.22 * side, 0.05, 0.0), Vector3(0, 0, -70.0 * side))
		var arm := piv(body, "arm", Vector3(0.18 * side, 0.7, -0.02), Vector3(-30, 0, 25.0 * side))
		add(a, arm, cap(0.05, 0.42), red, Vector3(0, -0.2, 0))
		for k in 3:
			add(a, arm, cone(0.018, 0.09), Color(0.1, 0.07, 0.07), Vector3(-0.03 + k * 0.03, -0.43, 0), Vector3(180, 0, 0), {"outline": false})
		anim(a, arm, "rot", Vector3(1, 0, 0), 0.25, 5.0, side)
		var leg := piv(body, "leg", Vector3(0.1 * side, 0.36, 0), Vector3(-20, 0, 6.0 * side))
		add(a, leg, cap(0.06, 0.4), red.darkened(0.1), Vector3(0, -0.18, 0))
		add(a, leg, box(0.09, 0.05, 0.16), Color(0.1, 0.07, 0.07), Vector3(0, -0.37, -0.04))
	var tail := piv(body, "tail", Vector3(0, 0.38, 0.14), Vector3(-40, 0, 0))
	var seg := tail
	for i in 5:
		add(a, seg, sph(0.045 - i * 0.006), red, Vector3(0, 0.08, 0))
		seg = piv(seg, "t", Vector3(0, 0.1, 0), Vector3(-14, 0, 0))
		anim(a, seg, "rot", Vector3(0, 0, 1), 0.25, 3.0, i * 0.6)
	add(a, seg, prism(0.1, 0.12, 0.03), Color(0.1, 0.07, 0.07), Vector3(0, 0.04, 0))
	anim(a, body, "bob", Vector3.UP, 0.05, 3.0)
	return a

static func pixie() -> Node3D:
	var a := actor("pixie")
	var body := piv(a, "body", Vector3(0, 1.25, 0))
	var skin := Color(0.98, 0.84, 0.72)
	add(a, body, cap(0.07, 0.3), Color(0.35, 0.55, 0.42), Vector3(0, 0, 0))
	add(a, body, sph(0.12, 0.12, 8, 4), Color(0.3, 0.48, 0.36), Vector3(0, -0.12, 0))
	var head := piv(body, "head", Vector3(0, 0.26, 0))
	add(a, head, sph(0.12), skin)
	for i in 7:
		var ang := -1.4 + i * 0.47
		add(a, head, cone(0.04, 0.16), Color(0.15, 0.55, 0.6), Vector3(sin(ang) * 0.09, 0.08, cos(ang) * 0.06 + 0.02),
			Vector3(cos(ang) * 30.0, 0, -sin(ang) * 40.0))
	for side in [-1.0, 1.0]:
		add(a, head, sph(0.025), Color(0.1, 0.25, 0.3), Vector3(0.045 * side, 0.01, -0.1), Vector3.ZERO, {"outline": false})
		var w := piv(body, "wing", Vector3(0.04 * side, 0.1, 0.06), Vector3(0, 30.0 * side, 0))
		add(a, w, sph(0.1, 0.42, 8, 4), Color(0.7, 0.98, 1.0), Vector3(0.18 * side, 0.12, 0), Vector3(0, 0, -50.0 * side),
			{"scale": Vector3(1, 1, 0.15), "emit": LCD, "emit_e": 0.6, "ol": 0.006})
		add(a, w, sph(0.07, 0.3, 8, 4), Color(0.7, 0.98, 1.0), Vector3(0.14 * side, -0.1, 0), Vector3(0, 0, -110.0 * side),
			{"scale": Vector3(1, 1, 0.15), "emit": LCD, "emit_e": 0.6, "ol": 0.006})
		anim(a, w, "rot", Vector3(0, 1.0 * side, 0), 0.6, 24.0)
		var arm := piv(body, "arm", Vector3(0.08 * side, 0.08, 0), Vector3(0, 0, 30.0 * side))
		add(a, arm, cap(0.025, 0.2), skin, Vector3(0, -0.1, 0))
		var leg := piv(body, "leg", Vector3(0.04 * side, -0.16, 0), Vector3(-20.0 if side > 0 else 30.0, 0, 6.0 * side))
		add(a, leg, cap(0.03, 0.24), skin, Vector3(0, -0.12, 0))
	anim(a, body, "bob", Vector3.UP, 0.12, 2.4)
	return a

static func gaki() -> Node3D:
	var a := actor("gaki")
	var gray := Color(0.52, 0.55, 0.48)
	var body := piv(a, "body")
	add(a, body, sph(0.32, 0.56, 12, 6), gray.lightened(0.05), Vector3(0, 0.45, -0.05))
	add(a, body, cap(0.13, 0.5), gray, Vector3(0, 0.62, 0.18), Vector3(-60, 0, 0))
	var head := piv(body, "head", Vector3(0, 0.82, -0.32))
	add(a, head, sph(0.2, 0.36, 10, 6), gray)
	add(a, head, sph(0.11, 0.16, 8, 4), Color(0.08, 0.05, 0.05), Vector3(0, -0.08, -0.15), Vector3.ZERO, {"outline": false})
	for side in [-1.0, 1.0]:
		add(a, head, sph(0.04), Color(0.85, 0.95, 0.4), Vector3(0.08 * side, 0.05, -0.16), Vector3.ZERO,
			{"emit": Color(0.8, 1.0, 0.3), "emit_e": 2.0, "outline": false})
	for i in 9:
		var ang := -1.5 + i * 0.37
		add(a, head, cyl(0.012, 0.012, 0.55, 4), Color(0.08, 0.08, 0.07), Vector3(sin(ang) * 0.16, -0.1, cos(ang) * 0.1 + 0.08),
			Vector3(0, 0, sin(ang) * 10.0), {"outline": false})
	for side in [-1.0, 1.0]:
		var arm := piv(body, "arm", Vector3(0.2 * side, 0.68, -0.25), Vector3(30, 0, 10.0 * side))
		add(a, arm, cap(0.04, 0.7), gray, Vector3(0, -0.33, 0))
		anim(a, arm, "rot", Vector3(1, 0, 0), 0.15, 2.5, side)
		var leg := piv(body, "leg", Vector3(0.18 * side, 0.36, 0.2), Vector3(40, 0, 0))
		add(a, leg, cap(0.045, 0.5), gray, Vector3(0, -0.22, 0))
	anim(a, body, "bob", Vector3.UP, 0.03, 4.0)
	anim(a, head, "rot", Vector3(0, 1, 0), 0.25, 1.3)
	return a

static func sandman() -> Node3D:
	var a := actor("sandman")
	var s := Color(0.84, 0.66, 0.36)
	var body := piv(a, "body")
	add(a, body, sph(0.32, 0.7, 10, 6), s, Vector3(0, 1.25, 0), Vector3.ZERO, {"line": Color(0.45, 0.3, 0.12)})
	add(a, body, sph(0.24, 0.46, 10, 6), s.darkened(0.08), Vector3(0, 0.82, 0), Vector3.ZERO, {"line": Color(0.45, 0.3, 0.12)})
	var head := piv(body, "head", Vector3(0, 1.75, 0))
	add(a, head, sph(0.22, 0.4, 10, 6), s.lightened(0.05), Vector3.ZERO, Vector3.ZERO, {"line": Color(0.45, 0.3, 0.12)})
	add(a, head, cone(0.22, 0.4, 8), Color(0.42, 0.28, 0.5), Vector3(0, 0.25, 0.02), Vector3(-12, 0, 8))
	for side in [-1.0, 1.0]:
		add(a, head, sph(0.05, 0.03, 8, 4), Color(1.0, 0.7, 0.2), Vector3(0.08 * side, 0.02, -0.19), Vector3.ZERO,
			{"emit": Color(1.0, 0.62, 0.15), "emit_e": 3.0, "outline": false})
		var arm := piv(body, "arm", Vector3(0.32 * side, 1.4, 0), Vector3(0, 0, 25.0 * side))
		add(a, arm, cap(0.08, 0.6), s, Vector3(0, -0.28, 0), Vector3.ZERO, {"line": Color(0.45, 0.3, 0.12)})
		anim(a, arm, "rot", Vector3(1, 0, 0), 0.2, 1.4, side)
	add(a, body, sph(0.22, 0.34, 8, 4), Color(0.45, 0.32, 0.2), Vector3(0.38, 1.6, 0.18))
	# a drifting skirt of sand that blurs into dust
	var dust := piv(body, "dust", Vector3(0, 0.45, 0))
	for i in 9:
		var ang := i * 0.7
		var r := 0.12 + (i % 3) * 0.12
		add(a, dust, sph(0.16 - (i % 3) * 0.035), s.lightened(0.1), Vector3(cos(ang) * r, -0.12 * (i % 3), sin(ang) * r),
			Vector3.ZERO, {"outline": false, "rim": 0.6})
	anim(a, dust, "rot", Vector3.UP, 3.14, 0.4)
	anim(a, body, "bob", Vector3.UP, 0.06, 1.1)
	return a

static func kobold() -> Node3D:
	var a := actor("kobold")
	var hide := Color(0.55, 0.42, 0.3)
	var cloth := Color(0.36, 0.38, 0.42)
	var body := piv(a, "body")
	add(a, body, cap(0.25, 0.7), cloth, Vector3(0, 0.62, 0))
	add(a, body, box(0.44, 0.08, 0.3), Color(0.35, 0.22, 0.12), Vector3(0, 0.45, 0))
	var head := piv(body, "head", Vector3(0, 1.1, 0))
	add(a, head, sph(0.22, 0.4, 10, 6), hide)
	add(a, head, sph(0.1, 0.12, 8, 4), hide.lightened(0.1), Vector3(0, -0.06, -0.19))
	add(a, head, hemi(0.25), Color(0.85, 0.7, 0.15), Vector3(0, 0.05, 0), Vector3.ZERO, {"spec": 0.5})
	add(a, head, cyl(0.06, 0.06, 0.06, 8), Color(1.0, 0.8, 0.4), Vector3(0, 0.18, -0.2), Vector3(70, 0, 0),
		{"emit": Color(1.0, 0.65, 0.2), "emit_e": 2.5, "outline": false})
	for side in [-1.0, 1.0]:
		add(a, head, prism(0.22, 0.24, 0.04), hide, Vector3(0.27 * side, 0.0, 0), Vector3(0, 0, -75.0 * side))
		add(a, head, sph(0.03), Color(0.95, 0.85, 0.3), Vector3(0.08 * side, 0.03, -0.18), Vector3.ZERO,
			{"emit": Color(1.0, 0.8, 0.2), "emit_e": 1.5, "outline": false})
		var leg := piv(body, "leg", Vector3(0.12 * side, 0.35, 0))
		add(a, leg, cap(0.08, 0.36), cloth.darkened(0.15), Vector3(0, -0.16, 0))
		add(a, leg, box(0.14, 0.08, 0.22), Color(0.25, 0.16, 0.1), Vector3(0, -0.33, -0.04))
	var arm := piv(body, "arm_r", Vector3(0.3, 0.85, 0), Vector3(0, 0, 30))
	add(a, arm, cap(0.07, 0.5), hide, Vector3(0, -0.22, 0))
	var pick := piv(arm, "pick", Vector3(0, -0.45, 0), Vector3(-20, 0, -60))
	add(a, pick, box(0.04, 0.9, 0.04), Color(0.45, 0.3, 0.18), Vector3(0, 0.35, 0))
	add(a, pick, prism(0.5, 0.08, 0.05), Color(0.5, 0.5, 0.55), Vector3(0, 0.8, 0), Vector3(0, 0, 0), {"spec": 0.6})
	anim(a, arm, "rot", Vector3(1, 0, 0), 0.12, 1.8)
	var arm_l := piv(body, "arm_l", Vector3(-0.3, 0.85, 0), Vector3(0, 0, -20))
	add(a, arm_l, cap(0.07, 0.5), hide, Vector3(0, -0.22, 0))
	anim(a, body, "bob", Vector3.UP, 0.025, 2.0)
	return a

static func nekomata() -> Node3D:
	var a := actor("nekomata")
	var fur := Color(0.95, 0.9, 0.82)
	var body := piv(a, "body")
	add(a, body, cap(0.16, 0.7), fur, Vector3(0, 0.95, 0))
	add(a, body, box(0.36, 0.3, 0.24), Color(0.22, 0.2, 0.28), Vector3(0, 0.85, 0))
	var head := piv(body, "head", Vector3(0, 1.45, 0))
	add(a, head, sph(0.2, 0.34, 12, 6), fur)
	add(a, head, sph(0.08, 0.08, 8, 4), fur.darkened(0.08), Vector3(0, -0.06, -0.16))
	for side in [-1.0, 1.0]:
		add(a, head, prism(0.14, 0.18, 0.05), fur, Vector3(0.12 * side, 0.2, 0), Vector3(0, 0, -15.0 * side))
		add(a, head, prism(0.08, 0.1, 0.03), Color(0.85, 0.5, 0.5), Vector3(0.12 * side, 0.19, -0.02), Vector3(0, 0, -15.0 * side), {"outline": false})
		add(a, head, box(0.07, 0.02, 0.02), Color(0.6, 1.0, 0.4), Vector3(0.075 * side, 0.03, -0.17), Vector3(0, 0, 12.0 * side),
			{"emit": Color(0.6, 1.0, 0.3), "emit_e": 2.5, "outline": false})
	add(a, body, sph(0.06), Color(0.8, 0.08, 0.1), Vector3(0, 1.25, -0.16))
	add(a, body, cyl(0.02, 0.05, 0.16, 6), Color(0.8, 0.08, 0.1), Vector3(0, 1.13, -0.17))
	for side in [-1.0, 1.0]:
		var arm := piv(body, "arm", Vector3(0.18 * side, 1.18, 0), Vector3(-25, 0, 18.0 * side))
		add(a, arm, cap(0.05, 0.5), fur, Vector3(0, -0.24, 0))
		for k in 3:
			add(a, arm, cone(0.015, 0.08), Color(0.15, 0.12, 0.12), Vector3(-0.025 + k * 0.025, -0.5, -0.02), Vector3(180, 0, 0), {"outline": false})
		anim(a, arm, "rot", Vector3(1, 0, 0), 0.15, 2.0, side)
		var leg := piv(body, "leg", Vector3(0.09 * side, 0.62, 0), Vector3(-10, 0, 4.0 * side))
		add(a, leg, cap(0.065, 0.62), fur.darkened(0.05), Vector3(0, -0.3, 0))
		# two tails
		var tail := piv(body, "tail", Vector3(0.06 * side, 0.7, 0.14), Vector3(-50, 0, 20.0 * side))
		var seg := tail
		for i in 6:
			add(a, seg, sph(0.05 - i * 0.004), fur if i < 4 else Color(0.25, 0.22, 0.25), Vector3(0, 0.08, 0))
			seg = piv(seg, "t", Vector3(0, 0.12, 0), Vector3(-18, 0, 6.0 * side))
			anim(a, seg, "rot", Vector3(0, 0, 1), 0.22, 2.6, i * 0.5 + side)
	anim(a, body, "bob", Vector3.UP, 0.03, 2.2)
	return a

static func orthrus() -> Node3D:
	var a := actor("orthrus")
	var black := Color(0.16, 0.13, 0.15)
	var body := piv(a, "body")
	add(a, body, cap(0.55, 2.4), black, Vector3(0, 1.25, 0.2), Vector3(90, 0, 0), {"ol": 0.03, "rim": 0.55})
	add(a, body, sph(0.7, 1.2, 12, 6), black.lightened(0.05), Vector3(0, 1.45, -0.7), Vector3.ZERO, {"ol": 0.03, "rim": 0.55})
	for side in [-1.0, 1.0]:
		for fz in [-0.8, 1.1]:
			var leg := piv(body, "leg", Vector3(0.42 * side, 1.0, fz), Vector3(0, 0, 4.0 * side))
			add(a, leg, cap(0.16, 1.1), black, Vector3(0, -0.45, 0), Vector3.ZERO, {"ol": 0.025})
			for k in 3:
				add(a, leg, cone(0.04, 0.14), Color(0.85, 0.8, 0.7), Vector3(-0.08 + k * 0.08, -1.0, -0.14), Vector3(-100, 0, 0), {"outline": false})
			anim(a, leg, "rot", Vector3(1, 0, 0), 0.06, 2.0, fz + side)
		# a head on each side of the twin neck
		var neck := piv(body, "neck", Vector3(0.38 * side, 1.95, -1.05), Vector3(-25, 18.0 * side, 0))
		add(a, neck, cap(0.24, 0.8), black, Vector3(0, 0.25, 0), Vector3.ZERO, {"ol": 0.025})
		var head := piv(neck, "head", Vector3(0, 0.6, -0.1))
		add(a, head, sph(0.34, 0.56, 12, 6), black.lightened(0.04), Vector3.ZERO, Vector3.ZERO, {"ol": 0.025, "rim": 0.6})
		add(a, head, box(0.3, 0.2, 0.5), black, Vector3(0, -0.06, -0.38), Vector3.ZERO, {"ol": 0.02})
		var jaw := piv(head, "jaw", Vector3(0, -0.18, -0.2), Vector3(18, 0, 0))
		add(a, jaw, box(0.26, 0.08, 0.46), Color(0.35, 0.08, 0.08), Vector3(0, 0, -0.2), Vector3.ZERO, {"ol": 0.015})
		for k in 4:
			add(a, jaw, cone(0.025, 0.09), Color(0.95, 0.92, 0.82), Vector3(-0.09 + k * 0.06, 0.06, -0.36), Vector3.ZERO, {"outline": false})
		anim(a, jaw, "rot", Vector3(1, 0, 0), 0.18, 3.0, side)
		for e in [-1.0, 1.0]:
			add(a, head, sph(0.05), Color(1.0, 0.5, 0.1), Vector3(0.12 * e, 0.08, -0.26), Vector3.ZERO,
				{"emit": Color(1.0, 0.45, 0.05), "emit_e": 3.5, "outline": false})
			add(a, head, prism(0.16, 0.26, 0.05), black, Vector3(0.18 * e, 0.3, 0.05), Vector3(-10, 0, -20.0 * e), {"ol": 0.015})
		anim(a, neck, "rot", Vector3(0, 1, 0), 0.12, 1.1, side * 1.3)
		# spiked collar
		for k in 5:
			var ang := k * 1.256
			add(a, neck, cone(0.05, 0.16), Color(0.7, 0.68, 0.62), Vector3(cos(ang) * 0.26, 0.05, sin(ang) * 0.26),
				Vector3(0, 0, 0).lerp(Vector3(sin(ang) * 90.0, 0, -cos(ang) * 90.0), 1.0), {"spec": 0.5, "ol": 0.008})
	# the serpent tail
	var tail := piv(body, "tail", Vector3(0, 1.45, 1.4), Vector3(-60, 0, 0))
	var seg := tail
	for i in 7:
		add(a, seg, sph(0.13 - i * 0.012), Color(0.25, 0.4, 0.22), Vector3(0, 0.12, 0), Vector3.ZERO, {"ol": 0.012})
		seg = piv(seg, "t", Vector3(0, 0.2, 0), Vector3(-12, 0, 0))
		anim(a, seg, "rot", Vector3(0, 0, 1), 0.2, 2.2, i * 0.5)
	add(a, seg, sph(0.1, 0.16, 8, 4), Color(0.28, 0.45, 0.25), Vector3(0, 0.1, -0.04))
	anim(a, body, "bob", Vector3.UP, 0.04, 1.6)
	return a

static func demon(id: String) -> Node3D:
	match id:
		"pixie": return pixie()
		"imp": return imp()
		"gaki": return gaki()
		"sandman": return sandman()
		"kobold": return kobold()
		"nekomata": return nekomata()
		"orthrus": return orthrus()
		"angel": return angel()
		"scout": return scout()
	return imp()

# ---------------------------------------------------------------- props & ruins

static func dune(rng: RandomNumberGenerator, size: float, height: float) -> Node3D:
	var r := Node3D.new()
	var m := sand_mat()
	for i in 2:
		var mi := MeshInstance3D.new()
		var s := sph(size * rng.randf_range(0.85, 1.15), height * rng.randf_range(1.6, 2.0), 16, 8)
		mi.mesh = s
		mi.material_override = m
		mi.position = Vector3(rng.randf_range(-size, size) * 0.4, -height * 0.35, rng.randf_range(-size, size) * 0.4)
		mi.scale = Vector3(rng.randf_range(1.8, 2.6), 1.0, rng.randf_range(1.0, 1.5))
		mi.rotation.y = rng.randf_range(0, TAU)
		r.add_child(mi)
	return r

static func concrete_chunk(rng: RandomNumberGenerator) -> Node3D:
	var r := Node3D.new()
	var s := Vector3(rng.randf_range(0.8, 2.6), rng.randf_range(0.5, 1.6), rng.randf_range(0.8, 2.2))
	add(null, r, box(s.x, s.y, s.z), CONCRETE.darkened(rng.randf_range(0.0, 0.2)), Vector3(0, s.y * 0.25, 0),
		Vector3(rng.randf_range(-20, 20), rng.randf_range(0, 360), rng.randf_range(-20, 20)), {"ol": 0.02})
	for i in rng.randi_range(1, 3):
		var p := Vector3(rng.randf_range(-0.4, 0.4), s.y * 0.5, rng.randf_range(-0.4, 0.4))
		beam(null, r, p, p + Vector3(rng.randf_range(-0.6, 0.6), rng.randf_range(0.6, 1.4), rng.randf_range(-0.6, 0.6)), 0.04, RUST, {"outline": false})
	return r

static func sandbags(length: float) -> Node3D:
	var r := Node3D.new()
	var n := int(length / 0.55)
	for row in 2:
		for i in n:
			var mi := add(null, r, cap(0.17, 0.6, 6), Color(0.62, 0.55, 0.38), Vector3(-length * 0.5 + i * 0.55 + row * 0.27, 0.15 + row * 0.26, 0),
				Vector3(0, 0, 90), {"ol": 0.01})
			mi.scale = Vector3(1, 1, 0.7)
	return r

static func trench(length: float) -> Node3D:
	var r := Node3D.new()
	add(null, r, box(1.6, 0.04, length), Color(0.24, 0.16, 0.08), Vector3(0, 0.02, 0), Vector3.ZERO, {"outline": false, "rim": 0.0})
	for side in [-1.0, 1.0]:
		var b := sandbags(length)
		b.rotation_degrees.y = 90
		b.position.x = 1.05 * side
		r.add_child(b)
	return r

static func banner(color: Color) -> Node3D:
	var r := Node3D.new()
	add(null, r, cyl(0.025, 0.03, 3.0, 6), Color(0.3, 0.27, 0.22), Vector3(0, 1.3, 0), Vector3(0, 0, 9), {"ol": 0.008})
	var cloth := PlaneMesh.new()
	cloth.size = Vector2(1.2, 0.8)
	cloth.subdivide_width = 8
	cloth.orientation = PlaneMesh.FACE_Z
	add(null, r, cloth, color, Vector3(0.82, 2.25, 0), Vector3.ZERO, {"wave": 0.12, "double": true, "outline": false})
	return r

static func vehicle() -> Node3D:
	var r := Node3D.new()
	var burnt := Color(0.2, 0.17, 0.15)
	add(null, r, box(4.2, 1.2, 2.2), burnt, Vector3(0, 0.75, 0), Vector3(0, 0, 4), {"ol": 0.025})
	add(null, r, box(2.2, 0.9, 2.0), burnt.lightened(0.05), Vector3(-0.6, 1.7, 0), Vector3(0, 0, 4), {"ol": 0.025})
	add(null, r, box(1.0, 0.5, 1.6), RUST, Vector3(1.4, 1.4, 0), Vector3(0, 0, -20), {"ol": 0.02})
	for x in [-1.4, 1.4]:
		for z in [-1.15, 1.15]:
			add(null, r, cyl(0.45, 0.45, 0.35, 10), Color(0.08, 0.08, 0.08), Vector3(x, 0.35, z), Vector3(90, 0, 0), {"ol": 0.015})
	r.position.y = -0.25
	return r

static func bus() -> Node3D:
	var r := Node3D.new()
	var paint := Color(0.72, 0.7, 0.6)
	add(null, r, box(10.5, 2.8, 2.5), paint, Vector3(0, 1.4, 0), Vector3.ZERO, {"ol": 0.03})
	add(null, r, box(10.52, 0.35, 2.52), Color(0.3, 0.55, 0.36), Vector3(0, 0.7, 0), Vector3.ZERO, {"outline": false})
	add(null, r, box(9.6, 0.9, 2.54), Color(0.1, 0.12, 0.14), Vector3(0.2, 1.95, 0), Vector3.ZERO, {"outline": false, "spec": 0.4})
	add(null, r, box(2.0, 1.0, 2.54), RUST, Vector3(-3.0, 1.0, 0), Vector3.ZERO, {"outline": false})
	add(null, r, box(1.4, 0.5, 2.54), RUST.darkened(0.2), Vector3(3.5, 2.6, 0), Vector3.ZERO, {"outline": false})
	r.rotation_degrees = Vector3(0, 0, 9)
	r.position.y = -0.9
	return r

static func road_sign(text: String) -> Node3D:
	var r := Node3D.new()
	add(null, r, cyl(0.07, 0.07, 3.4, 8), Color(0.55, 0.56, 0.55), Vector3(0, 1.7, 0), Vector3(0, 0, -7), {"ol": 0.01})
	var board := piv(r, "board", Vector3(0.25, 3.2, 0), Vector3(0, 0, -7))
	add(null, board, box(2.4, 1.2, 0.06), Color(0.13, 0.3, 0.6), Vector3.ZERO, Vector3.ZERO, {"ol": 0.012})
	add(null, board, box(2.3, 1.1, 0.065), Color(0.85, 0.88, 0.9), Vector3.ZERO, Vector3.ZERO, {"outline": false})
	add(null, board, box(2.2, 1.0, 0.07), Color(0.13, 0.3, 0.6), Vector3.ZERO, Vector3.ZERO, {"outline": false})
	var lab := Label3D.new()
	lab.text = text
	lab.font_size = 64
	lab.pixel_size = 0.006
	lab.modulate = Color(0.95, 0.96, 0.98)
	lab.outline_size = 0
	lab.position = Vector3(0, 0, -0.05)
	lab.rotation_degrees.y = 180
	board.add_child(lab)
	return r

static func med_crate() -> Node3D:
	var r := Node3D.new()
	add(null, r, box(1.2, 0.8, 0.9), Color(0.33, 0.36, 0.24), Vector3(0, 0.3, 0), Vector3(0, 0, 3), {"ol": 0.015})
	add(null, r, box(0.5, 0.14, 0.92), Color(0.92, 0.92, 0.88), Vector3(0, 0.45, 0), Vector3.ZERO, {"outline": false})
	add(null, r, box(0.14, 0.5, 0.92), Color(0.92, 0.92, 0.88), Vector3(0, 0.45, 0), Vector3.ZERO, {"outline": false})
	add(null, r, box(1.25, 0.08, 0.95), Color(0.25, 0.27, 0.18), Vector3(0, 0.72, 0), Vector3(0, 0, 3), {"outline": false})
	return r

static func train_car(length: float, rng: RandomNumberGenerator) -> Node3D:
	var r := Node3D.new()
	var steel := Color(0.46, 0.48, 0.5)
	var green := Color(0.42, 0.68, 0.25)
	add(null, r, box(length, 3.0, 2.9), steel, Vector3(0, 1.9, 0), Vector3.ZERO, {"ol": 0.03, "spec": 0.1, "rim": 0.15})
	add(null, r, box(length + 0.02, 0.32, 2.92), green, Vector3(0, 2.05, 0), Vector3.ZERO, {"outline": false})
	add(null, r, box(length - 0.6, 0.9, 2.94), Color(0.1, 0.12, 0.13), Vector3(0, 2.75, 0), Vector3.ZERO, {"outline": false, "spec": 0.5})
	add(null, r, box(length + 0.1, 0.25, 2.6), steel.darkened(0.3), Vector3(0, 3.5, 0), Vector3.ZERO, {"outline": false})
	var doors := int(length / 4.5)
	for i in doors:
		var x := -length * 0.5 + (i + 0.5) * length / doors
		add(null, r, box(1.1, 2.3, 2.96), steel.darkened(0.12), Vector3(x, 1.7, 0), Vector3.ZERO, {"outline": false})
	for i in 4:
		add(null, r, box(rng.randf_range(0.6, 2.4), rng.randf_range(0.4, 1.4), 2.97), RUST.lightened(rng.randf_range(0, 0.2)),
			Vector3(rng.randf_range(-length * 0.45, length * 0.45), rng.randf_range(0.8, 2.6), 0), Vector3.ZERO, {"outline": false})
	for x in [-length * 0.35, length * 0.35]:
		add(null, r, box(2.2, 0.5, 2.4), Color(0.15, 0.13, 0.12), Vector3(x, 0.35, 0), Vector3.ZERO, {"outline": false})
	return r

static func rails(length: float) -> Node3D:
	var r := Node3D.new()
	for z in [-0.75, 0.75]:
		add(null, r, box(length, 0.12, 0.1), RUST.lightened(0.15), Vector3(0, 0.06, z), Vector3.ZERO, {"outline": false, "spec": 0.3})
	var n := int(length / 1.2)
	for i in n:
		add(null, r, box(0.25, 0.08, 2.3), Color(0.35, 0.28, 0.2), Vector3(-length * 0.5 + i * 1.2, 0.03, 0), Vector3.ZERO, {"outline": false})
	return r

static func catenary() -> Node3D:
	var r := Node3D.new()
	add(null, r, box(0.25, 6.5, 0.25), Color(0.4, 0.38, 0.36), Vector3(0, 3.25, 0), Vector3(0, 0, 3), {"ol": 0.012})
	add(null, r, box(0.18, 0.18, 4.5), Color(0.4, 0.38, 0.36), Vector3(0, 6.2, 1.8), Vector3(-6, 0, 0), {"ol": 0.01})
	return r

static func overpass(rng: RandomNumberGenerator, length: float) -> Node3D:
	var r := Node3D.new()
	add(null, r, box(length, 1.6, 12.0), CONCRETE, Vector3(0, 7.0, 0), Vector3.ZERO, {"ol": 0.05})
	add(null, r, box(length, 0.9, 0.5), CONCRETE.darkened(0.1), Vector3(0, 8.2, 5.8), Vector3.ZERO, {"outline": false})
	var x := -length * 0.5 + 8.0
	while x < length * 0.5:
		add(null, r, cyl(1.2, 1.4, 7.0, 10), CONCRETE.darkened(0.08), Vector3(x, 3.0, 0), Vector3.ZERO, {"ol": 0.04})
		x += 22.0
	var broken := piv(r, "broken", Vector3(length * 0.5, 7.0, 0), Vector3(0, 0, -24))
	add(null, broken, box(18.0, 1.6, 12.0), CONCRETE.darkened(0.04), Vector3(9.0, 0, 0), Vector3.ZERO, {"ol": 0.05})
	for i in 6:
		beam(null, r, Vector3(length * 0.5, 7.0, rng.randf_range(-5, 5)),
			Vector3(length * 0.5 + rng.randf_range(0.5, 2.5), 7.0 + rng.randf_range(-2, 1), rng.randf_range(-5, 5)), 0.12, RUST, {"outline": false})
	return r

static func skyscraper(rng: RandomNumberGenerator, w: float, h: float, snapped: bool) -> Node3D:
	var r := Node3D.new()
	var col := Color(0.42, 0.44, 0.5).darkened(rng.randf_range(0.0, 0.2))
	add(null, r, box(w, h, w * 0.85), col, Vector3(0, h * 0.5, 0), Vector3.ZERO, {"outline": false, "rim": 0.2, "fog": 0.72})
	var y := 8.0
	while y < h - 4.0:
		add(null, r, box(w + 0.3, 0.9, w * 0.85 + 0.3), col.darkened(0.45), Vector3(0, y, 0), Vector3.ZERO, {"outline": false, "rim": 0.0, "fog": 0.72})
		y += 6.0
	if snapped:
		var top := piv(r, "top", Vector3(w * 0.4, h, 0), Vector3(0, 0, -32))
		add(null, top, box(w * 0.9, h * 0.35, w * 0.8), col.lightened(0.05), Vector3(-w * 0.2, h * 0.17, 0), Vector3.ZERO, {"outline": false, "rim": 0.2, "fog": 0.72})
	return r

static func tokyo_tower() -> Node3D:
	var r := Node3D.new()
	var orange := Color(0.82, 0.32, 0.16)
	var white := Color(0.9, 0.88, 0.84)
	var h := 250.0
	var lerp_w := func(t: float) -> float: return lerpf(42.0, 3.0, pow(t, 0.7))
	var levels := 10
	for i in levels:
		var t0 := float(i) / levels
		var t1 := float(i + 1) / levels
		var c := orange if i % 2 == 0 else white
		var w0: float = lerp_w.call(t0)
		var w1: float = lerp_w.call(t1)
		for sx in [-1.0, 1.0]:
			for sz in [-1.0, 1.0]:
				beam(null, r, Vector3(w0 * sx * 0.5, t0 * h, w0 * sz * 0.5), Vector3(w1 * sx * 0.5, t1 * h, w1 * sz * 0.5), 1.6, c, {"outline": false, "rim": 0.2, "fog": 0.8})
		# cross bracing
		for sx in [-1.0, 1.0]:
			beam(null, r, Vector3(w0 * sx * 0.5, t0 * h, -w0 * 0.5), Vector3(w1 * sx * 0.5, t1 * h, w1 * 0.5), 0.8, c, {"outline": false, "fog": 0.8})
			beam(null, r, Vector3(-w0 * 0.5, t0 * h, w0 * sx * 0.5), Vector3(w1 * 0.5, t1 * h, w1 * sx * 0.5), 0.8, c, {"outline": false, "fog": 0.8})
	for t in [0.32, 0.6]:
		var w: float = lerp_w.call(t)
		add(null, r, box(w + 4.0, 5.0, w + 4.0), white.darkened(0.1), Vector3(0, t * h, 0), Vector3.ZERO, {"outline": false, "fog": 0.8})
	var tip := piv(r, "tip", Vector3(0, h, 0), Vector3(0, 0, 28))
	add(null, tip, box(1.6, 40.0, 1.6), orange, Vector3(0, 20, 0), Vector3.ZERO, {"outline": false, "fog": 0.8})
	r.rotation_degrees.z = -6
	return r

static func station_gate() -> Node3D:
	var r := Node3D.new()
	add(null, r, box(16.0, 6.0, 7.0), CONCRETE.darkened(0.25), Vector3(0, 2.2, 0), Vector3.ZERO, {"ol": 0.04, "rim": 0.15})
	for i in 5:
		var mound := MeshInstance3D.new()
		mound.mesh = sph(2.5 + i * 0.4, 2.0, 12, 5)
		mound.material_override = sand_mat()
		mound.position = Vector3(-8.5 + i * 4.2, -0.2, 4.0 + (i % 2) * 1.2)
		mound.scale = Vector3(1.6, 1.0, 1.0)
		r.add_child(mound)
	add(null, r, box(2.4, 1.6, 0.4), Color(0.12, 0.1, 0.09), Vector3(5.2, 3.6, 3.52), Vector3(0, 0, 18), {"outline": false})
	add(null, r, box(1.4, 2.2, 0.4), Color(0.12, 0.1, 0.09), Vector3(-5.6, 2.2, 3.52), Vector3(0, 0, -8), {"outline": false})
	add(null, r, box(18.0, 0.7, 9.0), CONCRETE.darkened(0.35), Vector3(0, 5.4, 0.8), Vector3(0, 0, 3), {"ol": 0.03, "rim": 0.1})
	add(null, r, box(6.0, 4.0, 7.2), Color(0.04, 0.04, 0.05), Vector3(0, 1.6, 0), Vector3.ZERO, {"outline": false})
	for i in 6:
		add(null, r, box(5.6, 0.2, 0.7), CONCRETE.lightened(0.05), Vector3(0, 0.1 - i * 0.12, 3.2 - i * 0.6), Vector3.ZERO, {"outline": false})
	add(null, r, box(7.0, 1.1, 0.25), Color(0.1, 0.12, 0.14), Vector3(0, 4.55, 3.6), Vector3.ZERO, {"ol": 0.01})
	var lab := Label3D.new()
	lab.text = "SHINJUKU  STA."
	lab.font_size = 96
	lab.pixel_size = 0.008
	lab.modulate = Color(0.95, 0.93, 0.85)
	lab.position = Vector3(0, 4.55, 3.75)
	r.add_child(lab)
	for x in [-7.0, 7.0]:
		add(null, r, box(1.0, 5.0, 1.0), CONCRETE.darkened(0.3), Vector3(x, 2.5, 4.2), Vector3(0, 0, x * 0.4), {"ol": 0.02, "rim": 0.1})
	return r
