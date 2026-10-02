extends RefCounted
## All game data in one place: the map, demons, skills, negotiation, and lines.

const CELL := 6.0

# Rows run north (top) to south. Legend:
#  #  dune (impassable)        .  open sand
#  b  battlefield bodies       T  trench
#  P  start (Takeya)           V  burned-out vehicle
#  B  half-buried bus          S  road sign
#  X  lone body                M  medical crate (heal + checkpoint)
#  R  rail yard                C  wrecked train car
#  G  Shinjuku Station gates
const MAP := [
	"########################",
	"#####.......####RRRGGG##",
	"###....##......#RCCCRR##",
	"##.....##...##.#RRRRRR##",
	"#.........S.###.#RCCCCR#",
	"#...##..........RRRRRR##",
	"#...##.....##......M...#",
	"#.........###.......#..#",
	"##..............##.....#",
	"#....##....BB...###....#",
	"#....##................#",
	"#..........X....##.....#",
	"#bbb..###.......##..#..#",
	"#Tbbbb.##..............#",
	"#Tbbbb........####.....#",
	"#Tbbbb.........##......#",
	"#TbPbb......#.......##.#",
	"#bVbbb.................#",
	"########################",
]

const GOAL := Vector2i(20, 1)
const KM_PER_CELL := 0.13

# Elements: phys, gun, fire, ice, elec, force, heal
const SKILLS := {
	"Attack": {"el": "phys", "pow": 9, "mp": 0, "target": "one"},
	"Rend": {"el": "phys", "pow": 15, "mp": 3, "target": "one"},
	"Gnaw": {"el": "phys", "pow": 14, "mp": 3, "target": "one"},
	"Claw": {"el": "phys", "pow": 16, "mp": 3, "target": "one"},
	"Pick": {"el": "phys", "pow": 19, "mp": 4, "target": "one"},
	"Bite": {"el": "phys", "pow": 17, "mp": 0, "target": "one"},
	"Flare": {"el": "fire", "pow": 15, "mp": 4, "target": "one"},
	"Frost": {"el": "ice", "pow": 15, "mp": 4, "target": "one"},
	"Volt": {"el": "elec", "pow": 15, "mp": 4, "target": "one"},
	"Gale": {"el": "force", "pow": 15, "mp": 4, "target": "one"},
	"Sandstorm": {"el": "force", "pow": 10, "mp": 7, "target": "all"},
	"Hellbreath": {"el": "fire", "pow": 12, "mp": 6, "target": "all"},
	"Mend": {"el": "heal", "pow": 30, "mp": 5, "target": "ally"},
	"Gun": {"el": "gun", "pow": 13, "mp": 0, "target": "one"},
}

const DEMONS := {
	"pixie": {"name": "Pixie", "race": "Fairy", "lv": 2, "hp": 26, "mp": 22, "str": 3, "mag": 7, "agi": 8,
		"skills": ["Volt", "Mend"], "weak": ["gun"], "resist": ["elec"], "talk": "playful"},
	"imp": {"name": "Imp", "race": "Fiend", "lv": 3, "hp": 30, "mp": 16, "str": 5, "mag": 6, "agi": 7,
		"skills": ["Flare"], "weak": ["ice"], "resist": ["fire"], "talk": "wild"},
	"gaki": {"name": "Gaki", "race": "Haunt", "lv": 2, "hp": 34, "mp": 8, "str": 7, "mag": 2, "agi": 4,
		"skills": ["Gnaw"], "weak": ["fire"], "resist": [], "talk": "hungry"},
	"sandman": {"name": "Sandman", "race": "Spirit", "lv": 4, "hp": 34, "mp": 24, "str": 4, "mag": 8, "agi": 5,
		"skills": ["Gale", "Sandstorm"], "weak": ["elec"], "resist": ["force", "phys"], "talk": "gloomy"},
	"kobold": {"name": "Kobold", "race": "Earth", "lv": 3, "hp": 40, "mp": 10, "str": 8, "mag": 2, "agi": 5,
		"skills": ["Pick"], "weak": ["force"], "resist": ["gun"], "talk": "greedy"},
	"nekomata": {"name": "Nekomata", "race": "Beast", "lv": 5, "hp": 40, "mp": 20, "str": 7, "mag": 6, "agi": 10,
		"skills": ["Claw", "Frost"], "weak": ["fire"], "resist": ["ice"], "talk": "proud"},
	"orthrus": {"name": "Orthrus", "race": "Beast", "lv": 9, "hp": 175, "mp": 99, "str": 11, "mag": 9, "agi": 7,
		"skills": ["Bite", "Hellbreath", "Flare"], "weak": ["ice"], "resist": ["fire"], "talk": "none"},
}

const ENCOUNTERS := [
	["pixie"], ["pixie", "pixie"], ["imp"], ["gaki"], ["gaki", "gaki"], ["sandman"],
	["kobold"], ["imp", "gaki"], ["kobold", "pixie"], ["nekomata"], ["sandman", "imp"],
]

# Negotiation. Each question has three answers scored +1 / 0 / -1.
const TALK := {
	"playful": [
		{"q": "Hey, human! Running straight through the nests? You got a death wish or what?",
			"a": [["I'm in a hurry.", 1], ["Something like that.", 0], ["Get out of my way.", -1]]},
		{"q": "Ooh, shiny thing on your arm. Can I touch it? Just once?",
			"a": [["Maybe if you come with me.", 1], ["No.", -1], ["...Why?", 0]]},
	],
	"wild": [
		{"q": "Grrrah... you stink of gunpowder. You here to kill me?",
			"a": [["Only if you make me.", 1], ["Yes.", -1], ["I just want to pass.", 0]]},
		{"q": "Everything out here eats or gets eaten. Which are you?",
			"a": [["I'm the one still walking.", 1], ["Neither.", 0], ["Please don't eat me.", -1]]},
	],
	"gloomy": [
		{"q": "Everything out here is dead. Why are you still walking?",
			"a": [["Because I'm not done yet.", 1], ["I don't know.", 0], ["Leave me alone.", -1]]},
		{"q": "The sand buries everything in the end. Even you. Doesn't that scare you?",
			"a": [["Then I'll keep ahead of it.", 1], ["Not really.", 0], ["Shut up.", -1]]},
	],
	"greedy": [
		{"q": "Heh. A human with gear. What's in it for me if I don't crack your skull?",
			"a": [["A share of what I find.", 1], ["Nothing.", -1], ["We'll see.", 0]]},
	],
	"proud": [
		{"q": "A human, binding demons? Ridiculous. Prove you're worth serving.",
			"a": [["Watch me.", 1], ["Please?", 0], ["I don't need you.", -1]]},
		{"q": "Kneel, and I might let you live.",
			"a": [["No. You walk with me instead.", 1], ["...Fine.", -1], ["Not today.", 0]]},
	],
}

const JOIN_LINES := {
	"playful": "Fine, fine! I'm %s. Don't get me killed out here, okay?",
	"wild": "Hrrh. I'm %s. Point me at something worth biting.",
	"gloomy": "...I'm %s. Walking beats waiting, I suppose.",
	"greedy": "Deal. I'm %s. Don't forget my share.",
	"proud": "I am %s. Try to keep up.",
	"hungry": "...I'm %s. I'll follow the one with food.",
}

const LEAVE_LINES := ["Hmph. Not interested.", "Forget it, human.", "You're boring. Bye.", "Waste of my time."]

const NUDGE_IDLE := [
	"We have been stationary for ninety seconds. The heat index does not favor waiting.",
	"Operator, standing still is not a strategy. Continue north-east.",
	"Your hydration is declining at an estimated 0.4 liters per hour. Recommendation: walk.",
]

const NUDGE_DRIFT := [
	"Operator, you have deviated from the bearing. Correcting is recommended.",
	"The dunes are not landmarks. Do not trust them. Follow the bearing.",
	"That heading leads nowhere useful. Shinjuku is north-east.",
]

const NUDGE_EDGE := [
	"Beyond this point there is only sand. Turn back toward the bearing.",
	"No signals in that direction. Only desert.",
]

const LOG_FRAGMENTS := [
	"[ RECOVERED LOG // PREV. OPERATOR ] 'Day 41. The sand took the road again. We walk by the tower now.'",
	"[ RECOVERED LOG // PREV. OPERATOR ] 'Command says the cache is under the old city. Nobody has seen it.'",
	"[ RECOVERED LOG // PREV. OPERATOR ] 'Saw a winged one at dusk. It didn't attack. It just watched.'",
	"[ RECOVERED LOG // PREV. OPERATOR ] 'They issued twelve units. Three of them work. I got lucky.'",
	"[ RECOVERED LOG // PREV. OPERATOR ] 'If anyone finds this: we were told it was for food.'",
]
