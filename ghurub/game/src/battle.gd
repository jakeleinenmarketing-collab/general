extends Node
## First-person, turn-based battles. Enemies appear right in front of the player,
## in the same world, lit by the same sun. The party lives on Ghurub's screen.

const Kit = preload("res://src/kit.gd")
const Data = preload("res://src/data.gd")

const EL_COLORS := {
	"phys": Color(1.0, 0.9, 0.8), "gun": Color(1.0, 0.85, 0.5), "fire": Color(1.0, 0.45, 0.12),
	"ice": Color(0.55, 0.9, 1.0), "elec": Color(1.0, 0.95, 0.3), "force": Color(0.7, 1.0, 0.6),
	"heal": Color(0.5, 1.0, 0.7),
}

var m: Node
var ui: Node
var sfx: Node
var game: Node
var enemies: Array = []
var opts := {}
var turn_no := 0

func setup(main: Node) -> void:
	m = main
	ui = main.ui
	sfx = main.sfx
	game = main.game

func make_unit(id: String, ally: bool) -> Dictionary:
	var d: Dictionary = Data.DEMONS[id]
	var u := {
		"id": id, "name": d["name"], "race": d["race"], "lv": d["lv"],
		"hp": d["hp"], "maxhp": d["hp"], "mp": d["mp"], "maxmp": d["mp"],
		"str": d["str"], "mag": d["mag"], "agi": d["agi"],
		"skills": d["skills"].duplicate(), "weak": d["weak"].duplicate(), "resist": d["resist"].duplicate(),
		"talk": d["talk"], "xp": 0,
	}
	if not ally:
		u["dead"] = false
	return u

# ------------------------------------------------------------ setup / teardown

func _spawn(ids: Array, existing: Array) -> void:
	enemies.clear()
	var cam: Camera3D = m.cam
	var fwd := -cam.global_transform.basis.z
	fwd.y = 0.0
	fwd = fwd.normalized()
	var side := fwd.cross(Vector3.UP).normalized()
	var base := cam.global_position
	base.y = 0.0
	var counts := {}
	for id in ids:
		counts[id] = counts.get(id, 0) + 1
	var seen := {}
	for i in ids.size():
		var id: String = ids[i]
		var u := make_unit(id, false)
		if counts[id] > 1:
			seen[id] = seen.get(id, 0) + 1
			u["name"] = "%s %s" % [u["name"], ["A", "B", "C"][seen[id] - 1]]
		var node: Node3D
		if i < existing.size():
			node = existing[i]
		else:
			node = Kit.demon(id)
			m.add_actor(node)
			var spread := (i - (ids.size() - 1) * 0.5) * 2.1
			var dist := 4.4 if id != "pixie" else 3.6
			node.position = base + fwd * dist + side * spread
			node.look_at(Vector3(base.x, node.position.y, base.z), Vector3.UP)
			Kit.set_param(node, "dissolve", 1.0)
			Kit.set_param(node, "dissolve_color", Color(0.4, 0.95, 1.0))
		u["node"] = node
		enemies.append(u)

func _alive_enemies() -> Array:
	return enemies.filter(func(e: Dictionary) -> bool: return not e["dead"])

func _alive_party() -> Array:
	return game.party().filter(func(u: Dictionary) -> bool: return u["hp"] > 0)

func _enemy_lines() -> Array:
	var out := []
	for e in _alive_enemies():
		out.append("%-12s Lv%d" % [e["name"].to_upper(), e["lv"]])
	return out

func _refresh(active: Dictionary = {}) -> void:
	var units := []
	for u in game.party():
		var c: Dictionary = u.duplicate()
		c["active"] = u == active
		units.append(c)
	ui.show_party(units)
	ui.show_enemies(_enemy_lines())
	game._update_device()

func debug_stage(ids: Array) -> void:
	var c: Vector3 = m.world.to_world(Vector2i(10, 10))
	m.look(c + Vector3(0, 1.65, 0), c + Vector3(0, 1.65, -10))
	game.state_reset()
	for id in ["pixie", "nekomata", "imp"]:
		game.st["demons"].append(make_unit(id, true))
	_spawn(ids, [])
	for e in enemies:
		Kit.set_param(e["node"], "dissolve", 0.0)
	m.post.set_shader_parameter("battle", 1.0)
	ui.device.visible = true
	ui.device.mode = "battle"
	_refresh(game.st["hero"])
	ui.menu("TAKEYA  //  COMMAND", ["GUN", "NEGOTIATE", "ITEM", "RUN"])
	ui.toast("PIXIE / IMP APPEARED", 30.0)

# ------------------------------------------------------------ main loop

func run(ids: Array, o: Dictionary = {}) -> String:
	opts = o
	turn_no = 0
	ui.hold(true)
	sfx.play("encounter", -2.0)
	sfx.music("boss" if o.get("boss", false) else "battle")
	var tw := create_tween()
	tw.tween_method(func(v: float) -> void: m.post.set_shader_parameter("warp", v), 0.0, 1.0, 0.35)
	tw.tween_method(func(v: float) -> void: m.post.set_shader_parameter("warp", v), 1.0, 0.0, 0.45)
	tw.parallel().tween_method(func(v: float) -> void: m.post.set_shader_parameter("battle", v), 0.0, 1.0, 0.6)
	_spawn(ids, o.get("existing", []))
	await tw.finished
	ui.device.mode = "battle"
	for e in enemies:
		if not o.get("existing", []).has(e["node"]):
			var t2 := create_tween()
			var n: Node3D = e["node"]
			t2.tween_method(func(v: float) -> void: Kit.set_param(n, "dissolve", v), 1.0, 0.0, 0.7)
	sfx.play("summon", -10.0, 1.4)
	await game.wait(0.7)
	_refresh()
	ui.hold(false)
	var names := []
	for e in enemies:
		names.append(e["name"])
	ui.toast("%s APPEARED" % " / ".join(names).to_upper(), 1.2)
	if o.get("tutorial", false):
		await ui.say("GHURUB", "Hostile entity approaching. Engaging containment frequencies. Operator: select NEGOTIATE, or draw your firearm.")
		await ui.say("GHURUB", "A note: entities bound by negotiation will fight for us. Bullets do not make friends.")
		ui.close_dialog()

	var result := ""
	while result == "":
		turn_no += 1
		if ui.auto:
			print("   turn ", turn_no, " enemies ", _alive_enemies().map(func(e): return [e["name"], e["hp"]]))
		# --- party phase
		for u in game.party():
			if u["hp"] <= 0:
				continue
			_refresh(u)
			var r: String = await _party_action(u)
			if r != "":
				result = r
				break
			if _alive_enemies().is_empty():
				result = "win"
				break
		if result != "":
			break
		# --- enemy phase
		_refresh()
		for e in _alive_enemies():
			await _enemy_action(e)
			if game.st["hero"]["hp"] <= 0:
				result = "lose"
				break
		if result == "" and opts.has("scout") and turn_no % 3 == 2:
			await _scout_fires()
			if game.st["hero"]["hp"] <= 0:
				result = "lose"
	return await _finish(result)

func _finish(result: String) -> String:
	ui.hold(true)
	if result == "win":
		var xp := 0
		for e in enemies:
			if e.get("killed", false):
				xp += int(e["lv"]) * 7
		if opts.get("boss", false):
			xp += 60
		if xp > 0:
			ui.toast("VICTORY   +%d EXP" % xp, 1.4)
			await game.wait(0.9)
			await _grant_xp(xp)
	for e in enemies:
		if is_instance_valid(e["node"]) and not e["dead"]:
			m.remove_actor(e["node"])
	enemies.clear()
	ui.show_enemies([])
	var tw := create_tween()
	tw.tween_method(func(v: float) -> void: m.post.set_shader_parameter("battle", v), 1.0, 0.0, 0.8)
	sfx.music("")
	ui.device.mode = "nav"
	ui.close_dialog()
	await tw.finished
	ui.hold(false)
	return result

func _grant_xp(xp: int) -> void:
	var hero: Dictionary = game.st["hero"]
	hero["xp"] += xp
	while hero["xp"] >= hero["lv"] * 24:
		hero["xp"] -= hero["lv"] * 24
		hero["lv"] += 1
		hero["maxhp"] += 8
		hero["hp"] = mini(hero["hp"] + 8, hero["maxhp"])
		sfx.play("levelup", -4.0)
		ui.toast("TAKEYA  LEVEL %d" % hero["lv"], 1.2)
		await game.wait(1.0)
	for d in game.st["demons"]:
		if d["hp"] <= 0:
			continue
		d["xp"] += xp
		while d["xp"] >= d["lv"] * 20:
			d["xp"] -= d["lv"] * 20
			d["lv"] += 1
			d["maxhp"] += 5
			d["maxmp"] += 3
			d["str"] += 1
			d["mag"] += 1
			d["hp"] = mini(d["hp"] + 5, d["maxhp"])
			sfx.play("levelup", -6.0, 1.2)
			ui.toast("%s  LEVEL %d" % [d["name"].to_upper(), d["lv"]], 1.2)
			await game.wait(1.0)
	_refresh()

# ------------------------------------------------------------ party actions

func _target_enemy(title: String) -> Dictionary:
	var alive := _alive_enemies()
	if alive.size() == 1 and not ui.auto:
		return alive[0]
	var names := []
	for e in alive:
		names.append(e["name"].to_upper())
	var i: int = await ui.menu(title, names)
	if i < 0:
		return {}
	return alive[i]

func _party_action(u: Dictionary) -> String:
	while true:
		if u.get("hero", false):
			if ui.auto:
				var want_talk: bool = game.st["demons"].size() < 3 and not opts.get("boss", false)
				var hurt: bool = u["hp"] < u["maxhp"] * 0.4 and game.st["items"]["Medicine"] > 0
				ui.auto_next = 2 if hurt else (1 if want_talk else 0)
			var c: int = await ui.menu("TAKEYA  //  COMMAND", ["GUN", "NEGOTIATE", "ITEM", "RUN"], false)
			match c:
				0:
					var t := await _target_enemy("GUN  //  TARGET")
					if t.is_empty():
						continue
					await _hero_gun(t)
					return ""
				1:
					var t := await _target_enemy("NEGOTIATE  //  TARGET")
					if t.is_empty():
						continue
					return await _negotiate(t)
				2:
					var n: int = game.st["items"]["Medicine"]
					if n <= 0:
						ui.toast("NO ITEMS")
						continue
					var p: Array = game.party()
					var names := []
					for x in p:
						names.append("%s  %d/%d" % [x["name"].to_upper(), x["hp"], x["maxhp"]])
					var i: int = await ui.menu("MEDICINE x%d  //  TARGET" % n, names)
					if ui.auto:
						i = 0
					if i < 0:
						continue
					var who: Dictionary = p[i]
					game.st["items"]["Medicine"] -= 1
					who["hp"] = mini(who["maxhp"], maxi(who["hp"], 0) + 40)
					sfx.play("heal", -4.0)
					ui.toast("%s RECOVERED" % who["name"].to_upper())
					_refresh()
					await game.wait(0.6)
					return ""
				3:
					if opts.get("boss", false):
						await ui.say("GHURUB", "Escape is not possible. The summoner has us pinned.")
						ui.close_dialog()
						continue
					if randf() < 0.6 or opts.get("tutorial", false) == false and ui.auto:
						sfx.play("cancel", -2.0)
						ui.toast("ESCAPED")
						await game.wait(0.5)
						return "run"
					ui.toast("COULDN'T ESCAPE")
					await game.wait(0.7)
					return ""
		else:
			var opts_list := ["ATTACK"]
			for s in u["skills"]:
				opts_list.append("%-9s %2dMP" % [s.to_upper(), Data.SKILLS[s]["mp"]])
			if ui.auto:
				ui.auto_next = opts_list.size() - 1 if u["skills"].size() > 0 and u["mp"] >= 4 else 0
			var c: int = await ui.menu("%s  //  COMMAND" % u["name"].to_upper(), opts_list, false)
			var skill: String = "Attack" if c == 0 else u["skills"][c - 1]
			var sk: Dictionary = Data.SKILLS[skill]
			if u["mp"] < sk["mp"]:
				ui.toast("NOT ENOUGH MP")
				await game.wait(0.4)
				continue
			if sk["target"] == "ally":
				var p: Array = game.party()
				var names := []
				for x in p:
					names.append("%s  %d/%d" % [x["name"].to_upper(), x["hp"], x["maxhp"]])
				var i: int = await ui.menu("%s  //  TARGET" % skill.to_upper(), names)
				if i < 0:
					continue
				u["mp"] -= sk["mp"]
				await _heal(u, p[i], sk)
				return ""
			var t := await _target_enemy("%s  //  TARGET" % skill.to_upper())
			if t.is_empty():
				continue
			u["mp"] -= sk["mp"]
			await _use_skill(u, t, skill)
			return ""
	return ""

func _hero_gun(t: Dictionary) -> void:
	game._raise_gun(true)
	await game.wait(0.25)
	await game._fire()
	await _hit(game.st["hero"], t, "Gun")
	game._raise_gun(false)

func _use_skill(u: Dictionary, t: Dictionary, skill: String) -> void:
	var sk: Dictionary = Data.SKILLS[skill]
	ui.toast(skill.to_upper(), 0.7, EL_COLORS[sk["el"]])
	if sk["target"] == "all":
		_effect(sk["el"], null)
		await game.wait(0.35)
		for e in _alive_enemies():
			await _hit(u, e, skill)
	else:
		_effect(sk["el"], t["node"])
		await game.wait(0.35)
		await _hit(u, t, skill)

func _effect(el: String, node: Node3D) -> void:
	var snd := {"phys": "swing", "gun": "gun", "fire": "fire", "ice": "ice", "elec": "elec", "force": "force", "heal": "heal"}
	sfx.play(snd.get(el, "swing"), -4.0)
	m.post.set_shader_parameter("flash_color", EL_COLORS.get(el, Color.WHITE))
	var tw := create_tween()
	tw.tween_method(func(v: float) -> void: m.post.set_shader_parameter("flash", v), 0.28, 0.0, 0.35)
	if node != null and is_instance_valid(node):
		var g: MeshInstance3D = Kit.glint(m.stage, EL_COLORS.get(el, Color.WHITE), 2.4, 0.0)
		g.global_position = node.global_position + Vector3(0, 1.0, 0)
		var mat: ShaderMaterial = g.material_override
		var t2 := create_tween()
		t2.tween_method(func(v: float) -> void:
			mat.set_shader_parameter("intensity", v)
			mat.set_shader_parameter("spin", (1.0 - v) * 1.5), 2.0, 0.0, 0.5)
		t2.tween_callback(g.queue_free)

func _calc(att: Dictionary, def: Dictionary, skill: String) -> Dictionary:
	var sk: Dictionary = Data.SKILLS[skill]
	var el: String = sk["el"]
	var stat: float = att.get("str", 6) if el in ["phys", "gun"] else att.get("mag", 2)
	if skill == "Gun":
		stat = 6.0 + att.get("lv", 1) * 0.5
	var mult := 1.0
	var tag := ""
	if def.get("weak", []).has(el):
		mult = 1.5
		tag = "WEAK"
	elif def.get("resist", []).has(el):
		mult = 0.5
		tag = "RESIST"
	var dmg := float(sk["pow"]) * (1.0 + stat * 0.08) * randf_range(0.9, 1.1) * mult - float(def.get("lv", 1)) * 0.6
	if randf() < 0.06 and el in ["phys", "gun"]:
		dmg *= 1.5
		tag = "CRITICAL"
	return {"dmg": maxi(1, roundi(dmg)), "tag": tag}

func _screen_pos(node: Node3D, h := 1.2) -> Vector2:
	return m.cam.unproject_position(node.global_position + Vector3(0, h, 0)) * 2.0

func _hit(att: Dictionary, t: Dictionary, skill: String) -> void:
	if t["dead"]:
		return
	var r := _calc(att, t, skill)
	t["hp"] -= r["dmg"]
	var node: Node3D = t["node"]
	sfx.play("crit" if r["tag"] in ["WEAK", "CRITICAL"] else "hit", -2.0)
	var sp := _screen_pos(node)
	ui.popup(sp, str(r["dmg"]), Color(1, 1, 1))
	if r["tag"] != "":
		ui.popup(sp + Vector2(0, -40), r["tag"] + "!", Color(1.0, 0.85, 0.3) if r["tag"] != "RESIST" else Color(0.6, 0.7, 0.8), true)
	Kit.set_param(node, "flash", 1.0)
	var p0 := node.position
	var tw := create_tween()
	tw.tween_method(func(v: float) -> void:
		Kit.set_param(node, "flash", v)
		node.position = p0 + Vector3(sin(v * 40.0) * 0.12 * v, 0, 0), 1.0, 0.0, 0.35)
	await tw.finished
	if t["hp"] <= 0:
		t["dead"] = true
		t["killed"] = true
		await game._kill(node, Color(1.0, 0.5, 0.15))
		m.remove_actor(node)
	_refresh()

func _heal(u: Dictionary, who: Dictionary, sk: Dictionary) -> void:
	ui.toast("MEND", 0.7, EL_COLORS["heal"])
	_effect("heal", null)
	var amount := int(sk["pow"] + u["mag"] * 2)
	who["hp"] = mini(who["maxhp"], maxi(who["hp"], 0) + amount)
	ui.popup(Vector2(260, 60 + 34 * game.party().find(who)), "+%d" % amount, Color(0.5, 1.0, 0.7))
	_refresh()
	await game.wait(0.6)

# ------------------------------------------------------------ enemy actions

func _enemy_action(e: Dictionary) -> void:
	var choices := ["Attack"]
	for s in e["skills"]:
		if e["mp"] >= Data.SKILLS[s]["mp"]:
			choices.append(s)
	var skill: String = choices[randi() % choices.size()]
	var sk: Dictionary = Data.SKILLS[skill]
	e["mp"] -= sk["mp"]
	var node: Node3D = e["node"]
	var targets := _alive_party()
	if targets.is_empty():
		return
	ui.toast("%s  //  %s" % [e["name"].to_upper(), skill.to_upper()], 0.8, Color(1.0, 0.6, 0.5))
	# lunge
	var p0 := node.position
	var to_cam: Vector3 = (m.cam.global_position - node.global_position)
	to_cam.y = 0
	var tw := create_tween()
	tw.tween_property(node, "position", p0 + to_cam.normalized() * 1.6, 0.18).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_OUT)
	tw.tween_property(node, "position", p0, 0.3)
	_effect(sk["el"], null)
	await game.wait(0.25)
	var hit_list := targets if sk["target"] == "all" else [_pick_target(targets)]
	for t in hit_list:
		await _hurt(e, t, skill)
	if tw.is_valid() and tw.is_running():
		await tw.finished

func _pick_target(targets: Array) -> Dictionary:
	for t in targets:
		if t.get("hero", false) and randf() < 0.4:
			return t
	return targets[randi() % targets.size()]

func _hurt(att: Dictionary, t: Dictionary, skill: String) -> void:
	var r := _calc(att, t, skill)
	if game.god and t.get("hero", false):
		r["dmg"] = 0
	t["hp"] = maxi(0, t["hp"] - r["dmg"])
	sfx.play("hit", -1.0, 0.8)
	var idx: int = game.party().find(t)
	ui.popup(Vector2(300, 40 + 34 * idx), "-%d" % r["dmg"], Color(1.0, 0.45, 0.4))
	if r["tag"] == "WEAK":
		ui.popup(Vector2(420, 40 + 34 * idx), "WEAK!", Color(1.0, 0.85, 0.3))
	# shake the view
	var c0: Vector3 = m.cam.position
	var tw := create_tween()
	tw.tween_method(func(v: float) -> void:
		m.cam.position = c0 + Vector3(sin(v * 50.0), cos(v * 37.0), 0) * 0.05 * v
		m.post.set_shader_parameter("flash", v * 0.25), 1.0, 0.0, 0.3)
	m.post.set_shader_parameter("flash_color", Color(0.9, 0.15, 0.1))
	await tw.finished
	m.cam.position = c0
	if t["hp"] <= 0:
		ui.toast("%s IS DOWN" % t["name"].to_upper(), 1.0, Color(1.0, 0.4, 0.35))
		await game.wait(0.5)
	_refresh()

func _scout_fires() -> void:
	var scout: Node3D = opts["scout"]
	if not is_instance_valid(scout):
		return
	ui.toast("SCOUT  //  OPENS FIRE", 0.9, Color(1.0, 0.6, 0.3))
	var g: MeshInstance3D = Kit.glint(m.stage, Color(1.0, 0.8, 0.45), 1.0, 2.0)
	g.global_position = scout.global_position + Vector3(0.3, 1.4, 0)
	sfx.play("gun", -3.0, 1.15)
	await game.wait(0.15)
	g.queue_free()
	var targets := _alive_party()
	if targets.is_empty():
		return
	await _hurt({"str": 5, "lv": 6}, _pick_target(targets), "Gun")

# ------------------------------------------------------------ negotiation

func _negotiate(e: Dictionary) -> String:
	var who: String = e["name"].to_upper()
	var kind: String = e["talk"]
	if kind == "none":
		await ui.say("GHURUB", "The entity is bound to its summoner. Negotiation frequency rejected.")
		ui.close_dialog()
		return ""
	if game.st["demons"].size() >= 3:
		await ui.say("GHURUB", "Containment capacity reached. This prototype holds three entities.")
		ui.close_dialog()
		return ""
	var score := 0
	if kind == "hungry":
		await ui.say(who, "Food... do you have food...? Anything... anything...")
		score = 1
	else:
		var qs: Array = Data.TALK[kind]
		var q: Dictionary = qs[randi() % qs.size()]
		await ui.say(who, q["q"])
		ui.close_dialog()
		var answers: Array = q["a"].duplicate()
		answers.shuffle()
		var texts := []
		for a in answers:
			texts.append(a[0])
		var i: int = await ui.choose(texts)
		score = answers[i][1]
		if opts.get("tutorial", false) and score < 0:
			score = 0
		if opts.get("tutorial", false):
			score = maxi(score, 1)
	if score < 0:
		await ui.say(who, "Wrong answer, human!")
		ui.close_dialog()
		await _hurt(e, game.st["hero"], "Attack")
		return ""
	if score == 0:
		await ui.say(who, "Hmm... I'm not convinced. Not yet.")
		ui.close_dialog()
		return ""
	# the ask
	var meds: int = game.st["items"]["Medicine"]
	var wants_item := kind == "hungry" or (meds > 0 and randf() < 0.5)
	var paid := false
	if wants_item and meds > 0:
		await ui.say(who, "Give me one of those medicines. Then we'll talk.")
		ui.close_dialog()
		var c: int = await ui.choose(["Hand over a Medicine.", "No."])
		if c == 0:
			game.st["items"]["Medicine"] -= 1
			paid = true
	else:
		await ui.say(who, "Let me have a little of your life. Just a taste.")
		ui.close_dialog()
		var c: int = await ui.choose(["Fine. Take it. (-10 HP)", "No."])
		if c == 0 and game.st["hero"]["hp"] > 10:
			game.st["hero"]["hp"] -= 10
			paid = true
		elif c == 0:
			await ui.say(who, "You're nearly dead already. Pass.")
	if not paid:
		await ui.say(who, Data.LEAVE_LINES[randi() % Data.LEAVE_LINES.size()])
		ui.close_dialog()
		await _depart(e, Color(0.8, 0.8, 0.8))
		return "talked" if _alive_enemies().is_empty() else ""
	await ui.say(who, Data.JOIN_LINES[kind] % e["name"].split(" ")[0])
	ui.close_dialog()
	var ally := make_unit(e["id"], true)
	ally["lv"] = e["lv"]
	game.st["demons"].append(ally)
	sfx.play("summon", -2.0)
	await _depart(e, Color(0.4, 0.95, 1.0))
	ui.toast("%s  CONTAINED" % ally["name"].to_upper(), 1.4)
	if opts.get("tutorial", false):
		await game.wait(0.6)
		await ui.say("GHURUB", "Entity contained. It will now fight on our behalf. Recommendation: continue acquiring allies. We will need them.")
		ui.close_dialog()
	_refresh()
	return "talked" if _alive_enemies().is_empty() else ""

func _depart(e: Dictionary, edge: Color) -> void:
	e["dead"] = true
	var node: Node3D = e["node"]
	Kit.set_param(node, "dissolve_color", edge)
	var tw := create_tween()
	tw.tween_method(func(v: float) -> void: Kit.set_param(node, "dissolve", v), 0.0, 1.0, 0.8)
	await tw.finished
	m.remove_actor(node)
	_refresh()
