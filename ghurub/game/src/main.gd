extends Node
## Ghurub, Act I Part 1. Sets up the low-res 3D view and post pass, builds the
## desert, and runs the story from the field of the dead to the Shinjuku gates.

const Kit = preload("res://src/kit.gd")
const Data = preload("res://src/data.gd")
const World = preload("res://src/world.gd")
const Ui = preload("res://src/ui.gd")
const Battle = preload("res://src/battle.gd")
const Sfx = preload("res://src/sfx.gd")
const Game = preload("res://src/game.gd")

const RES := Vector2i(640, 360)
const EYE := 1.65

var args := {}
var vp: SubViewport
var screen: TextureRect
var post: ShaderMaterial
var stage: Node3D
var cam: Camera3D
var sun: DirectionalLight3D
var env: Environment
var sky_mat: ShaderMaterial
var world: World
var ui: Ui
var battle: Battle
var sfx: Sfx
var game: Game
var actors: Array[Node3D] = []
var time := 0.0

func _ready() -> void:
	randomize()
	_parse_args()
	_build_render()
	world = World.new()
	stage.add_child(world)
	world.build()
	sfx = Sfx.new()
	add_child(sfx)
	ui = Ui.new()
	ui.sfx = sfx
	$Overlay.add_child(ui)
	battle = Battle.new()
	add_child(battle)
	game = Game.new()
	add_child(game)
	game.setup(self)
	battle.setup(self)
	if args.has("view"):
		_test_view(args["view"])
	else:
		game.begin(args.get("jump", ""))
	if args.has("shot"):
		_shot(float(args.get("at", "1.0")), args["shot"])
	if args.has("skipat"):
		await get_tree().create_timer(float(args["skipat"])).timeout
		game.try_skip(KEY_ESCAPE)
	if args.has("count"):
		await get_tree().process_frame
		var n := [0]
		_count(stage, n)
		print("MESHES ", n[0], "  build ms ", Time.get_ticks_msec())
	if args.has("probe"):
		await get_tree().process_frame
		_probe(stage, cam.global_position)

func _count(n: Node, acc: Array) -> void:
	for c in n.get_children():
		if c is MeshInstance3D:
			acc[0] += 1
		_count(c, acc)

func _probe(n: Node, at: Vector3) -> void:
	for c in n.get_children():
		if c is MeshInstance3D and c.global_position.distance_to(at) < 1.6:
			print("NEAR ", c.get_path(), " ", c.mesh.get_class(), " d=", c.global_position.distance_to(at))
		_probe(c, at)

func _parse_args() -> void:
	for a in OS.get_cmdline_user_args():
		var s: String = a.trim_prefix("--")
		var i := s.find("=")
		if i >= 0:
			args[s.substr(0, i)] = s.substr(i + 1)
		else:
			args[s] = "1"

func _build_render() -> void:
	var overlay := CanvasLayer.new()
	overlay.name = "Overlay"
	overlay.layer = 2
	add_child(overlay)
	var base := CanvasLayer.new()
	base.name = "Base"
	base.layer = 0
	add_child(base)
	vp = SubViewport.new()
	vp.size = RES
	vp.render_target_update_mode = SubViewport.UPDATE_ALWAYS
	vp.msaa_3d = Viewport.MSAA_DISABLED
	vp.positional_shadow_atlas_size = 1024
	add_child(vp)
	stage = Node3D.new()
	stage.name = "Stage"
	vp.add_child(stage)
	screen = TextureRect.new()
	screen.texture = vp.get_texture()
	screen.set_anchors_preset(Control.PRESET_FULL_RECT)
	screen.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	screen.stretch_mode = TextureRect.STRETCH_SCALE
	screen.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
	post = ShaderMaterial.new()
	post.shader = preload("res://shaders/post.gdshader")
	screen.material = post
	base.add_child(screen)

	cam = Camera3D.new()
	cam.fov = 68.0
	cam.near = 0.05
	cam.far = 1600.0
	stage.add_child(cam)
	cam.current = true
	var sm2: bool = args.get("look", "") == "sm2"
	var ink: bool = args.get("look", "") == "ink"
	post.set_shader_parameter("sm2", 1.0 if sm2 else 0.0)
	post.set_shader_parameter("ink", 1.0 if ink else 0.0)
	if ink:
		# illustration look renders at full resolution with no dithering
		vp.size = Vector2i(1280, 720)
		vp.msaa_3d = Viewport.MSAA_4X
		screen.texture_filter = CanvasItem.TEXTURE_FILTER_LINEAR
		post.set_shader_parameter("res", Vector2(1280, 720))
		post.set_shader_parameter("levels", 255.0)
		post.set_shader_parameter("grain", 0.0)
		post.set_shader_parameter("haze", 0.0)
		RenderingServer.global_shader_parameter_set("g_ink", 1.0)

	sun = DirectionalLight3D.new()
	sun.light_color = Color(1.0, 0.86, 0.64)
	sun.light_energy = 0.92
	sun.shadow_bias = 0.08
	sun.shadow_normal_bias = 1.6
	sun.shadow_enabled = true
	sun.shadow_blur = 1.5
	sun.directional_shadow_mode = DirectionalLight3D.SHADOW_PARALLEL_2_SPLITS
	sun.directional_shadow_max_distance = 120.0
	sun.basis = Basis.looking_at(Vector3(1.0, -0.34, -0.45).normalized(), Vector3.UP)
	stage.add_child(sun)

	env = Environment.new()
	env.background_mode = Environment.BG_SKY
	var sky := Sky.new()
	sky_mat = ShaderMaterial.new()
	sky_mat.shader = preload("res://shaders/sky.gdshader")
	sky.sky_material = sky_mat
	env.sky = sky
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.ambient_light_color = Color(0.52, 0.46, 0.52)
	env.ambient_light_energy = 0.55
	env.tonemap_mode = Environment.TONE_MAPPER_LINEAR
	env.glow_enabled = true
	env.glow_intensity = 0.5
	env.glow_bloom = 0.05
	env.glow_hdr_threshold = 1.1
	if sm2:
		sun.light_color = Color(1.0, 0.98, 0.9)
		sun.light_energy = 0.8
		sun.basis = Basis.looking_at(Vector3(0.6, -0.75, -0.3).normalized(), Vector3.UP)
		env.ambient_light_color = Color(0.7, 0.7, 0.62)
		env.ambient_light_energy = 0.45
		RenderingServer.global_shader_parameter_set("g_fog_color", Color(0.62, 0.62, 0.45))
		RenderingServer.global_shader_parameter_set("g_fog_near", 10.0)
		RenderingServer.global_shader_parameter_set("g_fog_far", 300.0)
		RenderingServer.global_shader_parameter_set("g_fog_max", 0.9)
		sky_mat.set_shader_parameter("top_color", Color(0.74, 0.74, 0.58))
		sky_mat.set_shader_parameter("mid_color", Color(0.66, 0.66, 0.48))
	if ink:
		sun.light_color = Color(1.0, 0.97, 0.9)
		sun.light_energy = 0.75
		sun.shadow_blur = 3.0
		sun.basis = Basis.looking_at(Vector3(0.55, -0.7, -0.45).normalized(), Vector3.UP)
		env.ambient_light_color = Color(0.82, 0.8, 0.74)
		env.ambient_light_energy = 0.6
		env.glow_enabled = false
		RenderingServer.global_shader_parameter_set("g_fog_color", Color(0.93, 0.91, 0.84))
		RenderingServer.global_shader_parameter_set("g_fog_near", 14.0)
		RenderingServer.global_shader_parameter_set("g_fog_far", 340.0)
		RenderingServer.global_shader_parameter_set("g_fog_max", 0.94)
		sky_mat.set_shader_parameter("top_color", Color(0.86, 0.85, 0.78))
		sky_mat.set_shader_parameter("mid_color", Color(0.91, 0.89, 0.82))
		sky_mat.set_shader_parameter("ground_color", Color(0.9, 0.88, 0.8))
	var we := WorldEnvironment.new()
	we.environment = env
	stage.add_child(we)

func _process(delta: float) -> void:
	time += delta
	for a in actors:
		if is_instance_valid(a):
			Kit.animate(a, time)

func add_actor(a: Node3D) -> Node3D:
	stage.add_child(a)
	actors.append(a)
	return a

func remove_actor(a: Node3D) -> void:
	actors.erase(a)
	if is_instance_valid(a):
		a.queue_free()

func look(pos: Vector3, target: Vector3) -> void:
	cam.position = pos
	cam.look_at(target, Vector3.UP)

func set_fog(color: Color, near: float, far: float) -> void:
	RenderingServer.global_shader_parameter_set("g_fog_color", color)
	RenderingServer.global_shader_parameter_set("g_fog_near", near)
	RenderingServer.global_shader_parameter_set("g_fog_far", far)

func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventKey and event.pressed and not event.echo:
		if game.try_skip(event.keycode):
			get_viewport().set_input_as_handled()
			return
		if ui.handle_key(event.keycode):
			get_viewport().set_input_as_handled()
			return
		game.handle_key(event.keycode)

# ------------------------------------------------------------ testing helpers

func _shot(at: float, path: String) -> void:
	await get_tree().create_timer(at).timeout
	await RenderingServer.frame_post_draw
	get_viewport().get_texture().get_image().save_png(path)
	print("SHOT ", path)
	get_tree().quit()

func _test_view(v: String) -> void:
	var s := world.to_world(world.start_cell)
	ui.visible = args.has("ui")
	if args.has("novm"):
		game.viewmodel.visible = false
	match v:
		"hand":
			var hp: Vector3 = world.hero_hand.global_position
			look(game.hand_cam(), hp)
		"low":
			look(s + Vector3(7.0, 0.7, 1.0), s + Vector3(-6, 0.0, -1.0))
		"crane":
			look(s + Vector3(25, 20, 35), s + Vector3(-4, 0, -2))
		"wide":
			look(s + Vector3(-20, 45, 60), s + Vector3(60, 0, -60))
		"fight":
			game.spawn_fight()
			look(world.fight_spot + Vector3(0.9, 1.6, 4.3), world.fight_spot + Vector3(0, 1.15, 0))
		"pov":
			look(s + Vector3(0, EYE, 0), s + Vector3(0, EYE, -10))
		"desert":
			var c := world.to_world(Vector2i(10, 10))
			look(c + Vector3(0, EYE, 0), c + Vector3(10, EYE, -10))
		"yard":
			var c := world.to_world(Vector2i(19, 6))
			look(c + Vector3(0, EYE, 0), c + Vector3(0, EYE, -10))
		"gate":
			var c := world.to_world(Vector2i(20, 2))
			look(c + Vector3(0, EYE, 0), c + Vector3(0, EYE, -10))
		"lineup", "lineup2":
			var ids := ["angel", "imp", "pixie", "gaki", "sandman"] if v == "lineup" else ["kobold", "nekomata", "orthrus", "scout"]
			var base := world.to_world(Vector2i(8, 7))
			var x := -10.0
			for id in ids:
				var d := Kit.demon(id)
				add_actor(d)
				d.position = base + Vector3(x, 0, 0)
				d.rotation_degrees.y = 180
				x += 2.6 if id != "orthrus" else 4.0
				if id == "orthrus":
					d.position.x += 1.0
			look(base + Vector3(-4.5, 1.4, 5.2), base + Vector3(-4.5, 1.0, 0))
		"inkangel", "inkfar":
			var sp := Sprite3D.new()
			sp.texture = load("res://art/angel.png")
			sp.pixel_size = 2.9 / 1521.0
			sp.billboard = BaseMaterial3D.BILLBOARD_FIXED_Y
			sp.alpha_cut = SpriteBase3D.ALPHA_CUT_DISCARD
			sp.shaded = false
			sp.double_sided = true
			sp.position = world.fight_spot + Vector3(0.2, 1.45, 0)
			stage.add_child(sp)
			if v == "inkangel":
				look(s + Vector3(0.9, EYE, -3.2), world.fight_spot + Vector3(0.2, 1.5, 0))
			else:
				look(s + Vector3(-5.0, 2.6, 7.0), world.fight_spot + Vector3(0, 1.0, 0))
		"battle":
			game.state_reset()
			battle.debug_stage(args.get("ids", "pixie,imp").split(","))
