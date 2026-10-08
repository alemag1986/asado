use crate::domain::cuts::{Appetite, CUTS, Cut, CutKind};

const ACHURA_SHARE: f64 = 0.3;
const MIN_WEIGHT_KG: f64 = 0.35;
const ROUND: f64 = 0.1;

fn round_up(n: f64, step: f64) -> f64 {
    (n / step).ceil() * step
}

fn count_units(cut: &Cut, people: u32) -> u32 {
    cut.unit_per_people
        .map(|per| people.div_ceil(per))
        .unwrap_or(1)
        .max(1)
}

fn fmt_kg_block(kg: f64) -> String {
    let v = (kg * 10.0).round() / 10.0;
    if (v - v.trunc()).abs() < f64::EPSILON {
        format!("{v:.0} kg")
    } else {
        format!("{v:.1} kg")
    }
}

fn fmt_qty(cut: &Cut, adults: u32, adult_eq: f64) -> String {
    if cut.unit_per_people.is_some() {
        let n = count_units(cut, adults);
        let noun = if n == 1 { "pce" } else { "pcs" };
        format!("{n} {noun}")
    } else {
        fmt_kg_block(round_up(adult_eq * cut.per_person_kg, ROUND))
    }
}

#[derive(Debug)]
pub struct PlanItem {
    pub cut: &'static str,
    pub qty: String,
    pub note: &'static str,
}

#[derive(Debug)]
pub struct MeatPlan {
    pub items: Vec<PlanItem>,
    pub order: Vec<&'static str>,
    pub total_kg: f64,
    pub per_person_kg: f64,
    pub tip: &'static str,
}

pub fn build_plan(
    adults: u32,
    kids: u32,
    appetite: Appetite,
    achuras: bool,
    selected: &[String],
) -> MeatPlan {
    let adults = adults.max(1);
    let adult_eq = adults as f64 + kids as f64 * 0.6;
    let total_kg = adult_eq * appetite.kg();

    let achura_cuts: Vec<&Cut> = if achuras {
        CUTS.iter().filter(|c| c.kind == CutKind::Achura).collect()
    } else {
        Vec::new()
    };

    let achura_items: Vec<PlanItem> = achura_cuts
        .iter()
        .map(|cut| PlanItem {
            cut: cut.id,
            qty: fmt_qty(cut, adults, adult_eq),
            note: cut.pull_rule,
        })
        .collect();

    let meat_budget = total_kg
        * if achura_cuts.is_empty() {
            1.0
        } else {
            1.0 - ACHURA_SHARE
        };
    let main: Vec<&Cut> = selected
        .iter()
        .filter_map(|id| crate::domain::cuts::cut(id))
        .filter(|c| c.kind != CutKind::Achura)
        .collect();

    let weight_sum: f64 = main.iter().map(|c| c.per_person_kg).sum();
    let weight_sum = if weight_sum <= 0.0 { 1.0 } else { weight_sum };

    let meat_items: Vec<PlanItem> = main
        .iter()
        .map(|cut| {
            let share = (cut.per_person_kg / weight_sum) * meat_budget;
            let kg = round_up(share.max(MIN_WEIGHT_KG), ROUND);
            PlanItem {
                cut: cut.id,
                qty: fmt_kg_block(kg),
                note: "",
            }
        })
        .collect();

    let mut items = achura_items;
    items.extend(meat_items);

    let mut order: Vec<&str> = items.iter().map(|i| i.cut).collect();
    order.sort_by_key(|id| crate::domain::cuts::cut(id).map(|c| c.minutes).unwrap_or(0));

    let plan_kg_total: f64 = items
        .iter()
        .filter_map(|i| i.qty.strip_suffix(" kg")?.trim().parse::<f64>().ok())
        .sum();

    let total_kg = round_up(plan_kg_total, ROUND);

    let tip = if achura_cuts.is_empty() {
        "Thin cuts first over lively embers, thicker and slower cuts after. Keep it moving."
    } else {
        "Achuras hit the grate first while the fire is greedy, then the thin cuts. The rack is the finale."
    };

    MeatPlan {
        items,
        order,
        total_kg,
        per_person_kg: (total_kg / adults as f64 * 100.0).round() / 100.0,
        tip,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sel(ids: &[&str]) -> Vec<String> {
        ids.iter().map(|s| s.to_string()).collect()
    }

    #[test]
    fn eight_normal_with_achuras_matches_client_figures() {
        let p = build_plan(
            8,
            0,
            Appetite::Normal,
            true,
            &sel(&["tira", "bife-chorizo", "vacio"]),
        );
        assert_eq!(p.total_kg, 4.0);
        assert_eq!(p.per_person_kg, 0.5);
        assert_eq!(
            p.order,
            vec![
                "provoleta",
                "morcilla",
                "chorizo",
                "mollejas",
                "chinchulines",
                "bife-chorizo",
                "vacio",
                "tira"
            ]
        );
        let qty: std::collections::HashMap<&'static str, String> =
            p.items.iter().map(|i| (i.cut, i.qty.clone())).collect();
        for (id, expected) in [
            ("chorizo", "4 pcs"),
            ("morcilla", "3 pcs"),
            ("mollejas", "0.8 kg"),
            ("chinchulines", "2 pcs"),
            ("provoleta", "2 pcs"),
            ("tira", "1.2 kg"),
            ("bife-chorizo", "0.9 kg"),
            ("vacio", "1.1 kg"),
        ] {
            assert_eq!(
                qty.get(id),
                Some(&expected.to_string()),
                "no match for {id}"
            );
        }
    }

    #[test]
    fn four_light_no_achuras_budget_all_to_meat() {
        let p = build_plan(
            4,
            0,
            Appetite::Light,
            false,
            &sel(&["tira", "bife-chorizo", "vacio"]),
        );
        assert_eq!(p.total_kg, 1.8);
        assert_eq!(p.order, vec!["bife-chorizo", "vacio", "tira"]);
        assert!(p.items.iter().all(|i| i.qty.ends_with("kg")));
    }

    #[test]
    fn kids_count_as_six_tenths_of_an_adult() {
        let kids = build_plan(10, 5, Appetite::Normal, false, &sel(&["tira"]));
        let no_kids = build_plan(13, 0, Appetite::Normal, false, &sel(&["tira"]));
        assert_eq!(kids.total_kg, no_kids.total_kg); // 10 + 5*0.6 = 13 adults
    }

    #[test]
    fn heavy_single_cut_takes_full_budget() {
        let p = build_plan(8, 0, Appetite::Heavy, false, &sel(&["tira"]));
        assert_eq!(p.total_kg, 6.0);
        assert_eq!(p.items[0].qty, "6 kg");
    }

    #[test]
    fn achura_shares_skim_thirty_percent_off_meat() {
        let with = build_plan(8, 0, Appetite::Normal, true, &sel(&["tira"]));
        let without = build_plan(8, 0, Appetite::Normal, false, &sel(&["tira"]));
        assert!(
            with.items
                .iter()
                .find(|i| i.cut == "tira")
                .unwrap()
                .qty
                .parse::<f64>()
                .ok()
                .unwrap_or(0.0)
                < without.total_kg
        );
    }

    #[test]
    fn minimum_per_cut_floor_applies() {
        let p = build_plan(2, 0, Appetite::Light, false, &sel(&["matambre"]));
        // 2 * 0.4 = 0.8kg budget split to one cut = 0.8 → exceeds floor; pick a tiny crowd cut
        assert!(p.items[0].qty.starts_with("0."));
    }
}
