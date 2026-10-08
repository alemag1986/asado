use serde::Serialize;

#[derive(Clone, Copy, PartialEq, Serialize, Debug)]
#[serde(rename_all = "lowercase")]
pub enum FuelId {
    Wood,
    Charcoal,
    Gas,
}

impl FuelId {
    pub fn parse(s: &str) -> Option<Self> {
        match s {
            "wood" => Some(FuelId::Wood),
            "charcoal" => Some(FuelId::Charcoal),
            "gas" => Some(FuelId::Gas),
            _ => None,
        }
    }
}

#[derive(Clone, Copy, PartialEq, Serialize, Debug)]
#[serde(rename_all = "lowercase")]
pub enum Appetite {
    Light,
    Normal,
    Heavy,
}

impl Appetite {
    pub fn kg(self) -> f64 {
        match self {
            Appetite::Light => 0.4,
            Appetite::Normal => 0.55,
            Appetite::Heavy => 0.75,
        }
    }

    pub fn parse(s: &str) -> Option<Self> {
        match s {
            "light" => Some(Appetite::Light),
            "normal" => Some(Appetite::Normal),
            "heavy" => Some(Appetite::Heavy),
            _ => None,
        }
    }
}

#[derive(Clone, Copy, PartialEq, Debug)]
pub enum CutKind {
    Beef,
    Achura,
    Other,
}

#[derive(Clone, Copy, PartialEq, Debug)]
pub enum Tier {
    Fast,
    Medium,
    Slow,
}

#[derive(Clone, Debug)]
pub struct Cut {
    pub id: &'static str,
    pub name: &'static str,
    pub local: &'static str,
    pub kind: CutKind,
    pub tier: Tier,
    pub per_person_kg: f64,
    pub unit_per_people: Option<u32>,
    pub minutes: u32,
    pub target_temp_c: Option<f64>,
    pub prep: &'static str,
    pub signals: &'static [&'static str],
    pub rotate_rule: &'static str,
    pub pull_rule: &'static str,
    pub rest_min: u32,
    pub carve: &'static str,
}

#[derive(Clone, Debug, Serialize)]
pub struct Fuel {
    pub id: FuelId,
    pub label: &'static str,
    pub local: &'static str,
    pub build_min: u32,
    pub rate_kg_h: f64,
    pub hint: &'static str,
}

#[derive(Clone, Copy, Serialize, Debug)]
#[serde(rename_all = "lowercase")]
pub enum CutKindSer {
    Beef,
    Achura,
    Other,
}

#[derive(Clone, Copy, Serialize, Debug)]
#[serde(rename_all = "lowercase")]
pub enum TierSer {
    Fast,
    Medium,
    Slow,
}

#[derive(Serialize)]
pub struct CutDto {
    pub id: &'static str,
    pub name: &'static str,
    pub local: &'static str,
    pub kind: CutKindSer,
    pub tier: TierSer,
    pub per_person_kg: f64,
    pub unit_per_people: Option<u32>,
    pub minutes: u32,
    pub target_temp_c: Option<f64>,
    pub prep: &'static str,
    pub signals: &'static [&'static str],
    pub rotate_rule: &'static str,
    pub pull_rule: &'static str,
    pub rest_min: u32,
    pub carve: &'static str,
}

impl Cut {
    pub fn dto(&self) -> CutDto {
        CutDto {
            id: self.id,
            name: self.name,
            local: self.local,
            kind: kind_ser(self.kind),
            tier: tier_ser(self.tier),
            per_person_kg: self.per_person_kg,
            unit_per_people: self.unit_per_people,
            minutes: self.minutes,
            target_temp_c: self.target_temp_c,
            prep: self.prep,
            signals: self.signals,
            rotate_rule: self.rotate_rule,
            pull_rule: self.pull_rule,
            rest_min: self.rest_min,
            carve: self.carve,
        }
    }
}

fn kind_ser(k: CutKind) -> CutKindSer {
    match k {
        CutKind::Beef => CutKindSer::Beef,
        CutKind::Achura => CutKindSer::Achura,
        CutKind::Other => CutKindSer::Other,
    }
}

fn tier_ser(t: Tier) -> TierSer {
    match t {
        Tier::Fast => TierSer::Fast,
        Tier::Medium => TierSer::Medium,
        Tier::Slow => TierSer::Slow,
    }
}

pub fn cut(id: &str) -> Option<&'static Cut> {
    CUTS.iter().find(|c| c.id == id)
}

pub fn fuel(id: FuelId) -> &'static Fuel {
    FUELS.iter().find(|f| f.id == id).unwrap_or(&FUELS[1])
}

/// Mirrors `app/src/lib/cuts.ts` — keep in lockstep with the client.
pub static CUTS: &[Cut] = &[
    Cut {
        id: "tira",
        name: "Short Ribs",
        local: "Tira de asado",
        kind: CutKind::Beef,
        tier: Tier::Slow,
        per_person_kg: 0.4,
        unit_per_people: None,
        minutes: 75,
        target_temp_c: Some(68.0),
        prep: "Thick coarse salt 40 min before. Room temp. Never wash.",
        signals: &[
            "Fat turns glassy",
            "Meat pulls back off the bone",
            "Bark is dark, no sheen",
        ],
        rotate_rule: "Do not touch for the first 20 min. Turn when the underside releases on its own.",
        pull_rule: "Around 68°C and the bones show — probe-tender. It keeps cooking off the fire.",
        rest_min: 10,
        carve: "Cut across the bones into strips, short side up.",
    },
    Cut {
        id: "bife-chorizo",
        name: "Sirloin Strip",
        local: "Bife de chorizo",
        kind: CutKind::Beef,
        tier: Tier::Medium,
        per_person_kg: 0.3,
        unit_per_people: None,
        minutes: 40,
        target_temp_c: Some(55.0),
        prep: "Salt right before the fire. Thick cut, NY-strip shape.",
        signals: &[
            "Surface seared, juicing slows",
            "Edges curl up from the grate",
        ],
        rotate_rule: "Sear one side until it releases, then rotate a quarter turn for crosshatch.",
        pull_rule: "55°C center for medium-rare before rest. Carry-over adds ~3°C.",
        rest_min: 8,
        carve: "Slice against the grain, thumb-thick, across the strip.",
    },
    Cut {
        id: "bife-ancho",
        name: "Ribeye",
        local: "Bife ancho",
        kind: CutKind::Beef,
        tier: Tier::Medium,
        per_person_kg: 0.3,
        unit_per_people: None,
        minutes: 40,
        target_temp_c: Some(57.0),
        prep: "Rest at room temp, salt it 30 min out.",
        signals: &[
            "Cap feels soft yet springs back",
            "Fat at the edge renders, starts to crisp",
        ],
        rotate_rule: "Roll it on its fat edge for 1–2 min once the faces are seared.",
        pull_rule: "57°C center. The cap should be tender, not wobbly.",
        rest_min: 8,
        carve: "Slice against the grain across the eye.",
    },
    Cut {
        id: "entrana",
        name: "Skirt Steak",
        local: "Entraña",
        kind: CutKind::Beef,
        tier: Tier::Medium,
        per_person_kg: 0.25,
        unit_per_people: None,
        minutes: 30,
        target_temp_c: Some(55.0),
        prep: "Dry it well, salt both sides just before fire.",
        signals: &[
            "Crust forms fast — it is thin",
            "Juice beads stop running clear",
        ],
        rotate_rule: "One fast sear per side. Thin cut: no fiddling.",
        pull_rule: "Springy to the poke, 55°C. It tightens quickly past that.",
        rest_min: 5,
        carve: "Along the fibers first, then slice across — it needs the cross-cut.",
    },
    Cut {
        id: "vacio",
        name: "Flank",
        local: "Vacío",
        kind: CutKind::Beef,
        tier: Tier::Slow,
        per_person_kg: 0.35,
        unit_per_people: None,
        minutes: 60,
        target_temp_c: Some(60.0),
        prep: "The membrane side goes down first — leave its fat cap on.",
        signals: &[
            "Crust cracks like glass",
            "Inside stays pink while outside darkens",
        ],
        rotate_rule: "Low heat, patient. Rotate for even browning, never rush it.",
        pull_rule: "60°C and the crust is a hard shell. Rest long.",
        rest_min: 10,
        carve: "Across the grain into wide fajita-style strips.",
    },
    Cut {
        id: "costilla",
        name: "Whole Rib Rack",
        local: "Costillar",
        kind: CutKind::Beef,
        tier: Tier::Slow,
        per_person_kg: 0.35,
        unit_per_people: None,
        minutes: 210,
        target_temp_c: Some(70.0),
        prep: "A full rack is a centerpiece — salt the fat side only.",
        signals: &["Skin crisps gradually", "Bone ends darken and release"],
        rotate_rule: "Indirect heat zone. Rotate the rack every 40 min, thin end toward the glow.",
        pull_rule: "When the short bones bend and the meat sags — 70°C is done, not dry.",
        rest_min: 15,
        carve: "Cut into individual ribs at the table.",
    },
    Cut {
        id: "pollo",
        name: "Chicken Quarters",
        local: "Pollo",
        kind: CutKind::Other,
        tier: Tier::Medium,
        per_person_kg: 0.3,
        unit_per_people: None,
        minutes: 50,
        target_temp_c: Some(75.0),
        prep: "Butterfly or press flat. Salt and olive oil before fire.",
        signals: &[
            "Skin contracts and blisters",
            "Clear juices from the deepest poke",
        ],
        rotate_rule: "Skin side away from the hottest coals first, flip when golden.",
        pull_rule: "75°C at the thickest joint. Never serve pink near the bone.",
        rest_min: 5,
        carve: "Separate thigh and leg at the joint.",
    },
    Cut {
        id: "cordero",
        name: "Lamb Leg",
        local: "Cordero",
        kind: CutKind::Other,
        tier: Tier::Slow,
        per_person_kg: 0.4,
        unit_per_people: None,
        minutes: 120,
        target_temp_c: Some(62.0),
        prep: "Patagonian style: salt crust, rosemary optional.",
        signals: &["Surface turns mahogany", "Leg pulls from the bone tip"],
        rotate_rule: "Rotate continuously over low coals, slow roast wins here.",
        pull_rule: "62°C for pink middle, more if the crowd likes it done.",
        rest_min: 12,
        carve: "Slice thin across the muscle.",
    },
    Cut {
        id: "matambre",
        name: "Rolled Flank",
        local: "Matambre",
        kind: CutKind::Beef,
        tier: Tier::Medium,
        per_person_kg: 0.25,
        unit_per_people: None,
        minutes: 45,
        target_temp_c: Some(65.0),
        prep: "If rolled with stuffing, tie snug and cook indirect.",
        signals: &["Roll tightens and steams", "Outer layer turns deep brown"],
        rotate_rule: "Rotate the roll a quarter turn every 10 min for even walls.",
        pull_rule: "65°C through the center.",
        rest_min: 8,
        carve: "Cut coins, then rest each coin against the grain.",
    },
    Cut {
        id: "chorizo",
        name: "Criollo Sausage",
        local: "Chorizo",
        kind: CutKind::Achura,
        tier: Tier::Fast,
        per_person_kg: 0.0,
        unit_per_people: Some(2),
        minutes: 25,
        target_temp_c: Some(70.0),
        prep: "Place where embers are rippling, not roaring.",
        signals: &[
            "Skin tightens, juices seep out visibly",
            "Char in spots is good",
        ],
        rotate_rule: "Turn every 8 min, no piercing to \"help the fat\".",
        pull_rule: "No pink center — 70°C. Juicy means juicy, not raw.",
        rest_min: 3,
        carve: "Angle-cut coins or split for a sandwich (choripán).",
    },
    Cut {
        id: "morcilla",
        name: "Blood Sausage",
        local: "Morcilla",
        kind: CutKind::Achura,
        tier: Tier::Fast,
        per_person_kg: 0.0,
        unit_per_people: Some(3),
        minutes: 20,
        target_temp_c: Some(70.0),
        prep: "Do not prick it. Dark thin casing, low heat.",
        signals: &["Tiny fat pearls on the skin", "It plumps without splitting"],
        rotate_rule: "Turn gently with tongs — a split casing leaks everything.",
        pull_rule: "Off the fire just before the skin gets ready to crack.",
        rest_min: 2,
        carve: "Halve lengthwise.",
    },
    Cut {
        id: "mollejas",
        name: "Sweetbreads",
        local: "Mollejas",
        kind: CutKind::Achura,
        tier: Tier::Fast,
        per_person_kg: 0.1,
        unit_per_people: None,
        minutes: 25,
        target_temp_c: None,
        prep: "Whole — never cut them up before the fire.",
        signals: &["Crisp caramel shell outside", "Interior still custard-soft"],
        rotate_rule: "Pressure with the spatula for an even crust, flip once.",
        pull_rule: "Dark crust, molten center. Undercooked inside is wrong — it must set.",
        rest_min: 3,
        carve: "Slice thick, serve on warm bread.",
    },
    Cut {
        id: "chinchulines",
        name: "Chitterlings",
        local: "Chinchulines",
        kind: CutKind::Achura,
        tier: Tier::Fast,
        per_person_kg: 0.0,
        unit_per_people: Some(4),
        minutes: 25,
        target_temp_c: None,
        prep: "Best pre-boiled in salted water 30 min — the short path to tender.",
        signals: &["They curl and tighten", "Edges blister and crisp"],
        rotate_rule: "High heat first, rotate until evenly coiled and curled.",
        pull_rule: "Snappy, not leathery. Low heat from then on.",
        rest_min: 2,
        carve: "Serve whole, salted at the table.",
    },
    Cut {
        id: "provoleta",
        name: "Provolone Wheel",
        local: "Provoleta",
        kind: CutKind::Achura,
        tier: Tier::Fast,
        per_person_kg: 0.0,
        unit_per_people: Some(5),
        minutes: 12,
        target_temp_c: None,
        prep: "Slice 2–3 cm thick, oregano + pepper on top.",
        signals: &["Edges blister brown", "Middle goes molten and shrugs"],
        rotate_rule: "Do not move it — the browned base is the point.",
        pull_rule: "Charr base, lava center. Slide off onto bread, do not flip.",
        rest_min: 1,
        carve: "Eat with the spoon straight off the board.",
    },
];

pub static FUELS: &[Fuel] = &[
    Fuel {
        id: FuelId::Wood,
        label: "Wood",
        local: "Leña / quebracho",
        build_min: 50,
        rate_kg_h: 1.8,
        hint: "Hardwood only — quebracho, espinillo. Smokier, slower, worth it.",
    },
    Fuel {
        id: FuelId::Charcoal,
        label: "Charcoal",
        local: "Carbón",
        build_min: 30,
        rate_kg_h: 1.1,
        hint: "The weekday, dependable choice. Lump charcoal, never briquettes.",
    },
    Fuel {
        id: FuelId::Gas,
        label: "Gas",
        local: "Gas",
        build_min: 5,
        rate_kg_h: 0.0,
        hint: "Zero romance, instant control. Fine for steaks and weeknights.",
    },
];

pub const BEEF_DEFAULTS: &[&str] = &["tira", "bife-chorizo", "vacio"];
