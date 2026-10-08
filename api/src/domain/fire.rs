use serde::Serialize;

use crate::domain::cuts::{CUTS, Fuel, FuelId};

#[derive(Serialize)]
pub struct FireStep {
    pub title: &'static str,
    pub detail: &'static str,
}

#[derive(Serialize)]
pub struct TimelineRow {
    pub label: &'static str,
    pub time: String,
}

#[derive(Serialize)]
pub struct FirePlan {
    pub fuel: &'static Fuel,
    pub cook_min: u32,
    pub fire_start: String,
    pub coal_ready: String,
    pub first_on: String,
    pub serving: String,
    pub fuel_kg: f64,
    pub steps: &'static [FireStep],
    pub checklist: &'static [&'static str],
    pub big_fire: bool,
}

const WOOD_STEPS: [FireStep; 5] = [
    FireStep {
        title: "Stack the firebox",
        detail: "Crosshatch of hardwood, fine tinder built into the middle.",
    },
    FireStep {
        title: "Light it lean",
        detail: "No accelerant. A single match, or a firestarter between the splits.",
    },
    FireStep {
        title: "Feed the beast",
        detail: "Add one split at a time once it catches. Let it eat.",
    },
    FireStep {
        title: "Break to coals",
        detail: "When the wood collapses into chunks, push it apart into a bed.",
    },
    FireStep {
        title: "Rake a full floor",
        detail: "One even layer of embers under the whole grate.",
    },
];

const CHARCOAL_STEPS: [FireStep; 4] = [
    FireStep {
        title: "Build a mound",
        detail: "Heap lump charcoal in a pyramid, window for air at the base.",
    },
    FireStep {
        title: "Light a corner",
        detail: "Chimney or a single lighter cube. The fire spreads itself.",
    },
    FireStep {
        title: "Wait for the ash line",
        detail: "Most pieces rimmed gray. White = past its best.",
    },
    FireStep {
        title: "Spread the bed",
        detail: "Level embers out. A tired corner can be topped back up.",
    },
];

const GAS_STEPS: [FireStep; 3] = [
    FireStep {
        title: "Purge the box",
        detail: "Two minutes lid open before ignition, every single time.",
    },
    FireStep {
        title: "Preheat on high",
        detail: "Five to ten minutes, lid down, to rip the grates.",
    },
    FireStep {
        title: "Drop to game heat",
        detail: "Sear zone high, rest zone low — two heat zones even on gas.",
    },
];

const CHECKLIST: &[&str] = &[
    "Embers are ash-gray, no visible flames",
    "The grate is hot — salt sizzles on contact",
    "Palm test: 3–5 s at 15 cm above the grate is dinner time",
];

const BASE_MEAT_KG: f64 = 5.0;

fn to_minutes(hhmm: &str) -> u32 {
    let mut parts = hhmm.split(':');
    let h: u32 = parts.next().and_then(|p| p.parse().ok()).unwrap_or(18);
    let m: u32 = parts.next().and_then(|p| p.parse().ok()).unwrap_or(0);
    h * 60 + m
}

fn to_hhmm(total: i64) -> String {
    let wrapped = total.rem_euclid(1440);
    let h = wrapped / 60;
    let m = wrapped % 60;
    format!("{h:02}:{m:02}")
}

fn round_to_half(n: f64) -> f64 {
    (n * 2.0).round() / 2.0
}

/// Mirrors `app/src/lib/fire.ts` — keep in lockstep with the client.
pub fn build_fire(
    fuel_id: FuelId,
    cook_min: u32,
    ready_by: &str,
    meat_kg: Option<f64>,
) -> FirePlan {
    let fuel = crate::domain::cuts::fuel(fuel_id);
    let serving = to_minutes(ready_by) as i64;
    let cook_min = cook_min.max(1);
    let build_min = fuel.build_min as i64;
    let total_min = build_min + cook_min as i64;

    let fire_start_min = serving - total_min;
    let coal_ready = fire_start_min + build_min;

    let meat_kg = meat_kg.unwrap_or(BASE_MEAT_KG).max(0.5);
    let weight_factor = (meat_kg / BASE_MEAT_KG).clamp(0.5, 3.0);
    let fuel_kg = if fuel.rate_kg_h > 0.0 {
        round_to_half(fuel.rate_kg_h * (total_min as f64 / 60.0) * weight_factor)
    } else {
        0.0
    };

    let steps: &'static [FireStep] = match fuel_id {
        FuelId::Wood => &WOOD_STEPS,
        FuelId::Gas => &GAS_STEPS,
        FuelId::Charcoal => &CHARCOAL_STEPS,
    };

    FirePlan {
        fuel,
        cook_min,
        fire_start: to_hhmm(fire_start_min),
        coal_ready: to_hhmm(coal_ready),
        first_on: to_hhmm(coal_ready),
        serving: to_hhmm(serving),
        fuel_kg,
        steps,
        checklist: CHECKLIST,
        big_fire: weight_factor > 1.5,
    }
}

impl FirePlan {
    pub fn timeline(&self) -> [TimelineRow; 4] {
        [
            TimelineRow {
                label: "fire start",
                time: self.fire_start.clone(),
            },
            TimelineRow {
                label: "embers ready",
                time: self.coal_ready.clone(),
            },
            TimelineRow {
                label: "meat on",
                time: self.first_on.clone(),
            },
            TimelineRow {
                label: "serve",
                time: self.serving.clone(),
            },
        ]
    }

    pub fn cook_min_for(cuts: &[String]) -> u32 {
        cuts.iter()
            .filter_map(|id| CUTS.iter().find(|c| c.id == id).map(|c| c.minutes))
            .max()
            .unwrap_or(25)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sel(ids: &[&str]) -> Vec<String> {
        ids.iter().map(|s| s.to_string()).collect()
    }

    #[test]
    fn charcoal_weeknight_backwards_from_the_hour() {
        let f = build_fire(FuelId::Charcoal, 40, "20:00", None);
        assert_eq!(f.fire_start, "18:50");
        assert_eq!(f.coal_ready, "19:20");
        assert_eq!(f.first_on, "19:20");
        assert_eq!(f.serving, "20:00");
        assert!((f.fuel_kg - 1.5).abs() < 1e-9); // 1.1 kg/h × 70min ÷ 60, weight factor 1.0, to nearest 0.5
        assert_eq!(f.steps.len(), 4);
        assert!(!f.big_fire);
    }

    #[test]
    fn fuel_scales_with_the_meat_on_the_grate() {
        let small = build_fire(FuelId::Wood, 90, "20:00", Some(2.0));
        let crowd = build_fire(FuelId::Wood, 90, "20:00", Some(18.0));
        assert!(crowd.fuel_kg > small.fuel_kg);
        assert!(crowd.big_fire);
        assert!(!small.big_fire);
    }

    #[test]
    fn gas_has_no_coal_budget_but_builds_fast() {
        let f = build_fire(FuelId::Gas, 40, "20:00", None);
        assert_eq!(f.fuel_kg, 0.0);
        assert_eq!(f.fuel.build_min, 5);
        assert_eq!(f.steps.len(), 3);
        assert!(!f.big_fire);
    }

    #[test]
    fn late_night_serve_wraps_past_midnight() {
        let f = build_fire(FuelId::Charcoal, 30, "01:00", None);
        assert_eq!(f.fire_start, "00:00");
        let wrap = build_fire(FuelId::Charcoal, 120, "00:30", None);
        assert_eq!(wrap.fire_start, "22:00");
    }

    #[test]
    fn cook_min_derives_from_longest_cut() {
        assert_eq!(
            FirePlan::cook_min_for(&sel(&["provoleta", "tira", "vacio"])),
            75
        );
        assert_eq!(FirePlan::cook_min_for(&sel(&[])), 25);
    }
}
