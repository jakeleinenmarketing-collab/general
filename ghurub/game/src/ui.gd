extends Control
## Everything drawn over the 3D view: Ghurub's device, dialogue, choices,
## LCD menus, battle panels, prompts and title cards. All calls that wait on
## the player are coroutines: `await ui.say(...)`, `var i = await ui.menu(...)`.

signal _confirmed
signal _picked(index: int)

const LCD_BG := Color(0.02, 0.1, 0.11)
const LCD_FG := Color(0.42, 0.96, 1.0)
const LCD_DIM := Color(0.2, 0.55, 0.6)
const NAME_COLORS := {
	"GHURUB": Color(0.45, 0.95, 1.0),
	"ANGEL": Color(1.0, 0.8, 0.35),
	"SCOUT": Color(0.95, 0.6, 0.3),
	"TAKEYA": Color(0.9, 0.9, 0.85),
}

var sfx: Node
var auto := false
var auto_next := -1
var auto_delay := 0.0
var mono: SystemFont
var mode := ""
var _typing := false
var _full_text := ""
var _options: Array = []
var _cursor := 0
var _cancelable := false

var dialog: PanelContainer
var dlg_name: Label
var dlg_text: Label
var dlg_arrow: Label
var choice_box: PanelContainer
var choice_list: VBoxContainer
var menu_box: PanelContainer
var menu_title: Label
var menu_list: VBoxContainer
var prompt_label: Label
var title_label: Label
var sub_label: Label
var bars: Array[ColorRect] = []
var toast_label: Label
var party_box: VBoxContainer
var enemy_box: PanelContainer
var enemy_list: VBoxContainer
var device: Device
var popups: Control

func _ready() -> void:
	set_anchors_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	mono = SystemFont.new()
	mono.font_names = PackedStringArray(["Consolas", "Lucida Console", "DejaVu Sans Mono", "Liberation Mono", "Courier New", "monospace"])
	mono.antialiasing = TextServer.FONT_ANTIALIASING_GRAY

	for i in 2:
		var b := ColorRect.new()
		b.color = Color.BLACK
		b.size = Vector2(1280, 0)
		b.position = Vector2(0, 0 if i == 0 else 720)
		add_child(b)
		bars.append(b)

	popups = Control.new()
	popups.set_anchors_preset(Control.PRESET_FULL_RECT)
	popups.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(popups)

	device = Device.new()
	device.font = mono
	device.position = Vector2(938, 446)
	device.size = Vector2(326, 262)
	device.visible = false
	add_child(device)

	dialog = _panel(Vector2(16, 556), Vector2(906, 150), Color(0.03, 0.03, 0.04, 0.86), Color(0.55, 0.55, 0.5, 0.6))
	var v := VBoxContainer.new()
	dialog.add_child(v)
	dlg_name = _label("", 20, Color.WHITE)
	v.add_child(dlg_name)
	dlg_text = _label("", 22, Color(0.95, 0.94, 0.9))
	dlg_text.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	dlg_text.custom_minimum_size = Vector2(870, 90)
	v.add_child(dlg_text)
	dlg_arrow = _label("▼", 16, Color(0.8, 0.8, 0.75))
	dlg_arrow.position = Vector2(870, 120)
	dialog.add_child(dlg_arrow)
	dialog.visible = false

	choice_box = _panel(Vector2(40, 400), Vector2(620, 0), Color(0.03, 0.03, 0.04, 0.9), Color(0.85, 0.85, 0.8, 0.7))
	choice_list = VBoxContainer.new()
	choice_box.add_child(choice_list)
	choice_box.visible = false

	menu_box = _panel(Vector2(938, 150), Vector2(326, 0), Color(LCD_BG, 0.94), LCD_DIM)
	var mv := VBoxContainer.new()
	menu_box.add_child(mv)
	menu_title = _label("", 16, LCD_DIM, mono)
	mv.add_child(menu_title)
	menu_list = VBoxContainer.new()
	mv.add_child(menu_list)
	menu_box.visible = false

	enemy_box = _panel(Vector2(938, 16), Vector2(326, 0), Color(LCD_BG, 0.9), LCD_DIM)
	enemy_list = VBoxContainer.new()
	enemy_box.add_child(enemy_list)
	enemy_box.visible = false

	party_box = VBoxContainer.new()
	party_box.position = Vector2(16, 16)
	party_box.add_theme_constant_override("separation", 4)
	add_child(party_box)

	prompt_label = _label("", 30, Color(1, 0.96, 0.85))
	prompt_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	prompt_label.size = Vector2(1280, 40)
	prompt_label.position = Vector2(0, 600)
	prompt_label.add_theme_color_override("font_outline_color", Color.BLACK)
	prompt_label.add_theme_constant_override("outline_size", 8)
	add_child(prompt_label)

	toast_label = _label("", 22, LCD_FG, mono)
	toast_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	toast_label.size = Vector2(1280, 40)
	toast_label.position = Vector2(0, 96)
	toast_label.add_theme_color_override("font_outline_color", Color(0, 0.05, 0.06))
	toast_label.add_theme_constant_override("outline_size", 8)
	toast_label.modulate.a = 0.0
	add_child(toast_label)

	title_label = _label("", 44, Color(0.96, 0.92, 0.84))
	title_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	title_label.size = Vector2(1280, 60)
	title_label.position = Vector2(0, 300)
	title_label.add_theme_color_override("font_outline_color", Color(0, 0, 0, 0.8))
	title_label.add_theme_constant_override("outline_size", 6)
	title_label.modulate.a = 0.0
	add_child(title_label)
	sub_label = _label("", 22, Color(0.85, 0.82, 0.75))
	sub_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	sub_label.size = Vector2(1280, 40)
	sub_label.position = Vector2(0, 362)
	sub_label.modulate.a = 0.0
	add_child(sub_label)

func _panel(pos: Vector2, sz: Vector2, bg: Color, border: Color) -> PanelContainer:
	var p := PanelContainer.new()
	var sb := StyleBoxFlat.new()
	sb.bg_color = bg
	sb.border_color = border
	sb.set_border_width_all(2)
	sb.set_corner_radius_all(6)
	sb.content_margin_left = 16
	sb.content_margin_right = 16
	sb.content_margin_top = 10
	sb.content_margin_bottom = 10
	p.add_theme_stylebox_override("panel", sb)
	p.position = pos
	p.size = sz
	p.custom_minimum_size = Vector2(sz.x, 0)
	add_child(p)
	return p

func _label(text: String, size_px: int, color: Color, font: Font = null) -> Label:
	var l := Label.new()
	l.text = text
	l.add_theme_font_size_override("font_size", size_px)
	l.add_theme_color_override("font_color", color)
	if font != null:
		l.add_theme_font_override("font", font)
	l.mouse_filter = Control.MOUSE_FILTER_IGNORE
	return l

func _process(_delta: float) -> void:
	if dialog.visible:
		dlg_arrow.visible = not _typing and mode == "say" and fmod(Time.get_ticks_msec() / 400.0, 2.0) < 1.3
	if mode == "prompt":
		prompt_label.modulate.a = 0.55 + 0.45 * sin(Time.get_ticks_msec() / 180.0)
	if device.visible:
		device.queue_redraw()

func is_busy() -> bool:
	return mode != ""

# ------------------------------------------------------------ input

func handle_key(k: int) -> bool:
	if mode == "":
		return false
	var confirm := k in [KEY_SPACE, KEY_ENTER, KEY_KP_ENTER, KEY_Z]
	var cancel := k in [KEY_ESCAPE, KEY_X, KEY_BACKSPACE]
	var up := k in [KEY_UP, KEY_W]
	var down := k in [KEY_DOWN, KEY_S]
	match mode:
		"say":
			if confirm:
				if _typing:
					_typing = false
					dlg_text.text = _full_text
				else:
					_beep("confirm", -10.0)
					_confirmed.emit()
		"prompt":
			if confirm:
				_confirmed.emit()
		"choose", "menu":
			if up or down:
				_cursor = wrapi(_cursor + (1 if down else -1), 0, _options.size())
				_beep("move", -8.0)
				_refresh_options()
			elif confirm:
				_beep("confirm", -6.0)
				_picked.emit(_cursor)
			elif cancel and _cancelable:
				_beep("cancel", -6.0)
				_picked.emit(-1)
		"wait":
			pass
	return true

func _beep(n: String, db := 0.0) -> void:
	if sfx != null:
		sfx.play(n, db)

# ------------------------------------------------------------ dialogue

func say(who: String, text: String) -> void:
	mode = "say"
	dialog.visible = true
	dlg_name.text = who
	dlg_name.add_theme_color_override("font_color", NAME_COLORS.get(who, Color(0.85, 0.85, 0.8)))
	dlg_name.visible = who != ""
	_full_text = text
	dlg_text.text = ""
	_typing = true
	var speed := 70.0 if who == "GHURUB" else 55.0
	var shown := 0.0
	var i := 0
	while _typing and i < text.length():
		shown += get_process_delta_time() * speed
		var target := mini(int(shown), text.length())
		if target > i:
			if who == "GHURUB" and sfx != null and i % 3 == 0:
				sfx.play("blip", -20.0, 1.0 + randf() * 0.1)
			i = target
			dlg_text.text = text.substr(0, i)
		await get_tree().process_frame
		if auto:
			break
	_typing = false
	dlg_text.text = text
	if auto:
		await get_tree().create_timer(0.02 + auto_delay).timeout
	else:
		await _confirmed
	mode = ""

func close_dialog() -> void:
	dialog.visible = false

func choose(options: Array) -> int:
	dialog.visible = true
	mode = "choose"
	_options = options
	_cursor = 0
	_cancelable = false
	choice_box.visible = true
	_refresh_options()
	choice_box.position.y = 548 - 46 * options.size() - 20
	var r := 0
	if auto:
		await get_tree().create_timer(0.02 + auto_delay).timeout
	else:
		r = await _picked
	choice_box.visible = false
	mode = ""
	return r

func menu(title: String, options: Array, cancelable := true, start := 0) -> int:
	mode = "menu"
	_options = options
	_cursor = clampi(start, 0, max(options.size() - 1, 0))
	_cancelable = cancelable
	menu_title.text = title
	menu_box.visible = true
	_refresh_options()
	menu_box.position.y = 440 - menu_box.size.y
	var r := 0
	if auto:
		await get_tree().create_timer(0.01 + auto_delay * 0.5).timeout
		if auto_next >= 0:
			r = auto_next
			auto_next = -1
	else:
		r = await _picked
	menu_box.visible = false
	mode = ""
	return r

func _refresh_options() -> void:
	var list := choice_list if mode == "choose" else menu_list
	for c in list.get_children():
		list.remove_child(c)
		c.queue_free()
	for i in _options.size():
		var sel := i == _cursor
		var text: String = _options[i]
		var l: Label
		if mode == "choose":
			l = _label(("▶  " if sel else "    ") + text, 22, Color(1, 0.95, 0.8) if sel else Color(0.7, 0.7, 0.66))
		else:
			l = _label(("> " if sel else "  ") + text, 20, LCD_FG if sel else LCD_DIM, mono)
		list.add_child(l)
	if mode == "menu":
		menu_box.size.y = 0
		menu_box.reset_size()
		menu_box.position.y = 440 - menu_box.get_combined_minimum_size().y

func prompt(text: String) -> void:
	mode = "prompt"
	prompt_label.text = text
	prompt_label.visible = true
	if auto:
		await get_tree().create_timer(0.05 + auto_delay).timeout
	else:
		await _confirmed
	prompt_label.visible = false
	mode = ""

func hold(on: bool) -> void:
	# Swallow input during scripted moments.
	mode = "wait" if on else ""

# ------------------------------------------------------------ cinematic bits

func letterbox(on: bool, dur := 0.8) -> void:
	var tw := create_tween().set_parallel(true)
	tw.tween_property(bars[0], "size:y", 74.0 if on else 0.0, dur)
	tw.tween_property(bars[1], "size:y", 74.0 if on else 0.0, dur)
	tw.tween_property(bars[1], "position:y", 720.0 - (74.0 if on else 0.0), dur)

func title(text: String, sub := "", hold_s := 2.5) -> void:
	title_label.text = text
	sub_label.text = sub
	var tw := create_tween()
	tw.tween_property(title_label, "modulate:a", 1.0, 1.0)
	tw.parallel().tween_property(sub_label, "modulate:a", 1.0, 1.4)
	tw.tween_interval(hold_s)
	tw.tween_property(title_label, "modulate:a", 0.0, 1.0)
	tw.parallel().tween_property(sub_label, "modulate:a", 0.0, 1.0)
	await tw.finished

func toast(text: String, dur := 1.6, color := LCD_FG) -> void:
	toast_label.text = text
	toast_label.add_theme_color_override("font_color", color)
	var tw := create_tween()
	tw.tween_property(toast_label, "modulate:a", 1.0, 0.12)
	tw.tween_interval(dur)
	tw.tween_property(toast_label, "modulate:a", 0.0, 0.4)

func popup(pos: Vector2, text: String, color: Color, big := false) -> void:
	var l := _label(text, 34 if big else 28, color)
	l.add_theme_color_override("font_outline_color", Color(0, 0, 0, 0.9))
	l.add_theme_constant_override("outline_size", 8)
	l.position = pos - Vector2(60, 20)
	l.size = Vector2(120, 40)
	l.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	popups.add_child(l)
	var tw := l.create_tween()
	tw.tween_property(l, "position:y", l.position.y - 46.0, 0.9).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_OUT)
	tw.parallel().tween_property(l, "modulate:a", 0.0, 0.9).set_delay(0.45)
	tw.tween_callback(l.queue_free)

# ------------------------------------------------------------ battle panels

func show_party(units: Array) -> void:
	for c in party_box.get_children():
		party_box.remove_child(c)
		c.queue_free()
	if units.is_empty():
		return
	for u in units:
		var row := PanelContainer.new()
		var sb := StyleBoxFlat.new()
		sb.bg_color = Color(LCD_BG, 0.85)
		sb.border_color = LCD_FG if u.get("active", false) else Color(LCD_DIM, 0.6)
		sb.set_border_width_all(2)
		sb.set_corner_radius_all(4)
		sb.content_margin_left = 10
		sb.content_margin_right = 10
		sb.content_margin_top = 4
		sb.content_margin_bottom = 4
		row.add_theme_stylebox_override("panel", sb)
		row.custom_minimum_size = Vector2(380, 0)
		var h := HBoxContainer.new()
		row.add_child(h)
		var dead: bool = u["hp"] <= 0
		var name_l := _label("%-9s" % u["name"].to_upper(), 18, Color(0.5, 0.3, 0.3) if dead else LCD_FG, mono)
		name_l.custom_minimum_size = Vector2(110, 0)
		h.add_child(name_l)
		h.add_child(_bar(float(u["hp"]) / float(u["maxhp"]), Color(0.45, 1.0, 0.6), 110))
		h.add_child(_label(" %3d" % u["hp"], 16, LCD_FG, mono))
		if u.has("maxmp") and u["maxmp"] > 0:
			h.add_child(_bar(float(u["mp"]) / float(u["maxmp"]), Color(0.55, 0.6, 1.0), 60))
			h.add_child(_label(" %2d" % u["mp"], 16, LCD_DIM, mono))
		party_box.add_child(row)

func _bar(frac: float, color: Color, width: int) -> Control:
	var bg := ColorRect.new()
	bg.color = Color(0.0, 0.18, 0.2)
	bg.custom_minimum_size = Vector2(width, 10)
	bg.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	var fg := ColorRect.new()
	fg.color = color
	fg.size = Vector2(width * clampf(frac, 0.0, 1.0), 10)
	bg.add_child(fg)
	return bg

func show_enemies(lines: Array) -> void:
	for c in enemy_list.get_children():
		enemy_list.remove_child(c)
		c.queue_free()
	enemy_box.visible = not lines.is_empty()
	for t in lines:
		enemy_list.add_child(_label(t, 18, LCD_FG, mono))
	enemy_box.reset_size()

# ------------------------------------------------------------ Ghurub's device

class Device extends Control:
	var font: Font
	var mode := "nav"
	var boot_lines: Array = []
	var bearing := 0.0
	var dist_km := 0.0
	var signal_level := 0.0
	var hp := 60
	var maxhp := 60
	var heading := 0
	var cells: Dictionary = {}
	var map_size := Vector2i(24, 19)
	var player := Vector2i.ZERO
	var target := Vector2i.ZERO
	var map_rows: Array = []

	func _draw() -> void:
		var s := size
		var t := Time.get_ticks_msec() / 1000.0
		# silver housing with chipped corners
		var body := StyleBoxFlat.new()
		body.bg_color = Color(0.66, 0.68, 0.71)
		body.border_color = Color(0.84, 0.85, 0.87)
		body.set_border_width_all(3)
		body.set_corner_radius_all(20)
		body.shadow_color = Color(0, 0, 0, 0.45)
		body.shadow_size = 8
		draw_style_box(body, Rect2(Vector2.ZERO, s))
		for p in [Vector2(10, 8), Vector2(s.x - 22, s.y - 18), Vector2(6, s.y - 30)]:
			draw_rect(Rect2(p, Vector2(10, 6)), Color(0.18, 0.17, 0.16))
		draw_line(Vector2(40, 12), Vector2(90, 16), Color(0.5, 0.5, 0.5, 0.6), 1.0)
		draw_line(Vector2(s.x - 70, s.y - 8), Vector2(s.x - 30, s.y - 12), Color(0.5, 0.5, 0.5, 0.6), 1.0)
		draw_string(font, Vector2(22, 19), "GHURUB", HORIZONTAL_ALIGNMENT_LEFT, -1, 11, Color(0.35, 0.36, 0.38))
		draw_string(font, Vector2(s.x - 92, 19), "ECS-07", HORIZONTAL_ALIGNMENT_LEFT, -1, 11, Color(0.35, 0.36, 0.38))
		# side button, labeled by a previous owner
		draw_rect(Rect2(Vector2(-6, 96), Vector2(8, 46)), Color(0.5, 0.14, 0.12))
		draw_set_transform(Vector2(-12, 140), -PI / 2.0, Vector2.ONE)
		draw_string(font, Vector2.ZERO, "SUMMON", HORIZONTAL_ALIGNMENT_LEFT, -1, 10, Color(0.85, 0.85, 0.8, 0.8))
		draw_set_transform(Vector2.ZERO, 0.0, Vector2.ONE)
		# the screen
		var scr := Rect2(Vector2(16, 26), Vector2(s.x - 32, 156))
		draw_rect(scr.grow(3), Color(0.12, 0.13, 0.14))
		var flick := 1.0 - 0.06 * float(fmod(t * 0.37, 1.0) > 0.94)
		draw_rect(scr, Color(0.02, 0.12, 0.13) * flick)
		var fg := Color(0.42, 0.96, 1.0) * flick
		var dim := Color(0.2, 0.55, 0.6) * flick
		if mode == "boot":
			var y := scr.position.y + 18
			for line in boot_lines:
				draw_string(font, Vector2(scr.position.x + 8, y), line, HORIZONTAL_ALIGNMENT_LEFT, scr.size.x - 12, 12, fg)
				y += 16
		elif mode == "nav":
			_nav(scr, fg, dim, t)
		elif mode == "battle":
			draw_string(font, scr.position + Vector2(8, 18), "ECS // CONTAINMENT ACTIVE", HORIZONTAL_ALIGNMENT_LEFT, -1, 12, fg)
			for i in 6:
				var h := 20.0 + 30.0 * absf(sin(t * 3.0 + i * 1.3))
				draw_rect(Rect2(scr.position + Vector2(16 + i * 46, scr.size.y - 14 - h), Vector2(30, h)), dim)
			draw_string(font, scr.position + Vector2(8, 40), "FREQ LOCK  %03d.%d" % [int(t * 7.0) % 1000, int(t * 50.0) % 10], HORIZONTAL_ALIGNMENT_LEFT, -1, 12, fg)
		# scanlines
		var yy := scr.position.y
		while yy < scr.end.y:
			draw_line(Vector2(scr.position.x, yy), Vector2(scr.end.x, yy), Color(0, 0, 0, 0.22), 1.0)
			yy += 3.0
		# keyboard
		var ky := scr.end.y + 12
		for row in 3:
			var n := 10 - row
			var kw := (s.x - 40) / 10.0
			for i in n:
				var kx := 20 + row * kw * 0.5 + i * kw
				draw_rect(Rect2(Vector2(kx, ky + row * 20), Vector2(kw - 4, 15)), Color(0.24, 0.25, 0.27))
				draw_rect(Rect2(Vector2(kx + 1, ky + row * 20 + 1), Vector2(kw - 6, 4)), Color(0.33, 0.34, 0.36))

	func _nav(scr: Rect2, fg: Color, dim: Color, t: float) -> void:
		var p := scr.position
		draw_string(font, p + Vector2(8, 17), "BEARING %03d" % int(fposmod(bearing, 360.0)), HORIZONTAL_ALIGNMENT_LEFT, -1, 13, fg)
		draw_string(font, p + Vector2(8, 34), "SHINJUKU %.1f KM" % dist_km, HORIZONTAL_ALIGNMENT_LEFT, -1, 13, fg)
		# relative arrow
		var c := p + Vector2(52, 92)
		draw_arc(c, 36, 0, TAU, 32, dim, 1.5)
		var rel := deg_to_rad(bearing - heading * 90.0)
		var dir := Vector2(sin(rel), -cos(rel))
		var perp := Vector2(-dir.y, dir.x)
		var tip := c + dir * 30.0
		draw_colored_polygon(PackedVector2Array([tip, c - dir * 10.0 + perp * 12.0, c - dir * 2.0, c - dir * 10.0 - perp * 12.0]), fg)
		draw_string(font, c + Vector2(-4, -40), "N", HORIZONTAL_ALIGNMENT_LEFT, -1, 10, dim) if heading == 0 else null
		# signal meter
		draw_string(font, p + Vector2(8, scr.size.y - 10), "SIG", HORIZONTAL_ALIGNMENT_LEFT, -1, 12, dim)
		for i in 5:
			var on := signal_level * 5.0 > i + 0.1
			var col := (Color(1.0, 0.45, 0.35) if signal_level > 0.75 else fg) if on else Color(dim, 0.4)
			draw_rect(Rect2(p + Vector2(40 + i * 12, scr.size.y - 22 - i * 2), Vector2(9, 12 + i * 2)), col)
		draw_string(font, p + Vector2(110, scr.size.y - 10), "HP %d/%d" % [hp, maxhp], HORIZONTAL_ALIGNMENT_LEFT, -1, 12, fg)
		# automap of explored cells
		var cs := 5.0
		var mo := p + Vector2(scr.size.x - map_size.x * cs - 8, 10)
		for key in cells.keys():
			var cell: Vector2i = key
			var k: String = map_rows[cell.y][cell.x] if map_rows.size() > 0 else "."
			var col := dim
			if k in ["#", "T", "V", "B", "C"]:
				col = Color(dim, 0.35)
			draw_rect(Rect2(mo + Vector2(cell.x, cell.y) * cs, Vector2(cs - 1, cs - 1)), col)
		var blink := fmod(t * 2.0, 1.0) < 0.6
		if blink:
			draw_rect(Rect2(mo + Vector2(player.x, player.y) * cs - Vector2(1, 1), Vector2(cs + 1, cs + 1)), fg)
		draw_rect(Rect2(mo + Vector2(target.x, target.y) * cs, Vector2(cs - 1, cs - 1)), Color(1.0, 0.85, 0.3) if blink else dim)
