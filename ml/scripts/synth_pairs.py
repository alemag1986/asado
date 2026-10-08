"""Synthesize instruction pairs from the API-grounded domain snapshots.

Eight task types (plan.md Phase 4 step 5). Every number is copied from
`data/domain_examples.json`, which `snapshot_domain.py` pulled from the tested
Rust domain — nothing is re-derived here.

    python3 ml/scripts/synth_pairs.py            # -> ml/data/synth_pairs.jsonl
"""

from __future__ import annotations

import argparse

from common import CATALOG, DATA_DIR, EXAMPLES, read_json, write_jsonl

SYSTEM = (
    "You are ASADO.MAKER's grill assistant for Argentine and Uruguayan asado. "
    "Be concise and practical. All quantities, temperatures and timelines are "
    "validated — never invent numbers."
)

TASKS = [
    "quantity_for_n",
    "fire_setup_by_fuel",
    "doneness_judgment",
    "rotate_troubleshoot",
    "timing",
    "cut_glossary",
    "shopping_list",
    "tips",
]


def _num(v) -> str:
    if isinstance(v, float):
        return str(int(v)) if v.is_integer() else f"{v:.1f}"
    return str(v)


def _achuras(ex: dict) -> str:
    return "with achuras" if ex["achuras"] else "no achuras"


def _qty_variants(n: int, appetite: str, achuras: str) -> list[str]:
    return [
        f"How much meat do I need for {n} people ({appetite} appetite, {achuras})?",
        f"Shopping for {n} ({appetite} eaters, {achuras}). How many kilos total?",
        f"Planning an asado for {n} guests — {achuras}. What's the total quantity?",
    ]


def _plan_pairs(cuts: dict, examples: dict) -> list[dict]:
    out: list[dict] = []
    for i, ex in enumerate(examples["plans"]):
        req, resp = ex["request"], ex["response"]
        n, appetite, achuras = req["people"], req["appetite"], _achuras(req)
        pp_kg, pp_lb = resp["per_person_kg"], resp["per_person_lb"]
        total_kg, total_lb = resp["total_kg"], resp["total_lb"]

        out.append({
            "task": "quantity_for_n",
            "source": f"plan:{n}:{appetite}:{req['achuras']}:{'+'.join(req['cuts']) or 'default'}",
            "user": _qty_variants(n, appetite, achuras)[i % 3],
            "assistant": (
                f"About {_num(total_kg)} kg ({_num(total_lb)} lb) of meat in total — "
                f"roughly {_num(pp_kg)} kg ({_num(pp_lb)} lb) per person."
            ),
        })

        lines = []
        for item in resp["items"]:
            cut = cuts.get(item["cut"], {})
            label = cut.get("name", item["cut"])
            lines.append(f"- {label} ({cut.get('local', '')}): {item['qty']} — {item['note']}")
        order = " → ".join(cuts.get(c, {}).get("name", c) for c in resp["order"])
        out.append({
            "task": "shopping_list",
            "source": f"plan:{n}:{appetite}:{req['achuras']}:{'+'.join(req['cuts']) or 'default'}",
            "user": f"Build a butcher list for {n} people ({appetite} appetite, {achuras}).",
            "assistant": (
                "Shopping list:\n" + "\n".join(lines)
                + f"\n\nCook order: {order}."
                + f"\nTotal: {_num(total_kg)} kg ({_num(total_lb)} lb). Tip: {resp['tip']}"
            ),
        })
    return out


def _fire_pairs(examples: dict) -> list[dict]:
    out: list[dict] = []
    for i, ex in enumerate(examples["fires"]):
        req, resp = ex["request"], ex["response"]
        fuel = resp["fuel"]
        meat = _num(req["meat_kg"])
        if fuel["id"] == "gas":
            fuel_line = f"{fuel['label']} builds in {fuel['build_min']} min; no fuel to weigh."
        else:
            fuel_line = f"Use about {_num(resp['fuel_kg'])} kg of {fuel['label'].lower()}."
        prompt = [
            f"I'm cooking {meat} kg on {fuel['label'].lower()} to serve at {req['ready_by']}. When do I start the fire?",
            f"Timeline check: {meat} kg on {fuel['local']}, table at {req['ready_by']}?",
            f"Planning {fuel['label'].lower()} for a {meat} kg cook served {req['ready_by']} — walk me through it.",
        ][i % 3]
        out.append({
            "task": "fire_setup_by_fuel",
            "source": f"fire:{fuel['id']}:{meat}kg:{req['ready_by']}",
            "user": prompt,
            "assistant": (
                f"Light it at {resp['fire_start']}; coals ready by {resp['coal_ready']}. "
                f"Cook {resp['cook_min']} min, first meat on at {resp['first_on']}. {fuel_line} "
                f"{'Build a bigger fire than usual. ' if resp['big_fire'] else ''}"
                f"Check: {resp['checklist'][0]}."
            ),
        })
    return out


def _cut_pairs(cuts: dict) -> list[dict]:
    out: list[dict] = []
    for cut in cuts.values():
        name, local = cut["name"], cut["local"]
        signals = "; ".join(s.lower() for s in cut["signals"])
        out.append({
            "task": "doneness_judgment",
            "source": cut["id"],
            "user": f"How do I know the {name} ({local}) is done?",
            "assistant": (
                f"{cut['pull_rule']} Read the signals: {signals}. "
                f"Target about {_num(cut['target_temp_c'])}°C internally."
            ),
        })
        out.append({
            "task": "rotate_troubleshoot",
            "source": cut["id"],
            "user": f"When should I turn the {name} — and what if it sticks?",
            "assistant": cut["rotate_rule"],
        })
        out.append({
            "task": "timing",
            "source": cut["id"],
            "user": f"How long does {name} ({local}) take to grill?",
            "assistant": (
                f"About {cut['minutes']} min on the grill for a {cut['kind']} cut, "
                f"then rest {cut['rest_min']} min before carving."
            ),
        })
        out.append({
            "task": "cut_glossary",
            "source": cut["id"],
            "user": f"What is {local}?",
            "assistant": (
                f"{name} ({local}) is a {cut['kind']} cut ({cut['tier']} tier). "
                f"Prep: {cut['prep']}"
            ),
        })
        out.append({
            "task": "tips",
            "source": cut["id"],
            "user": f"Give me a tip for grilling {name}.",
            "assistant": f"{cut['prep']} {cut['carve']}",
        })
    return out


def _fuel_tips(catalog: dict) -> list[dict]:
    out: list[dict] = []
    for fuel in catalog["fuels"]:
        out.append({
            "task": "tips",
            "source": f"fuel:{fuel['id']}",
            "user": f"Any advice for cooking with {fuel['label'].lower()} ({fuel['local']})?",
            "assistant": (
                f"{fuel['hint']} Build time about {fuel['build_min']} min"
                + (
                    f", roughly {_num(fuel['rate_kg_h'])} kg per hour."
                    if fuel["rate_kg_h"]
                    else " (no fuel to weigh)."
                )
            ),
        })
    return out


def build_pairs(catalog: dict, examples: dict) -> list[dict]:
    cuts = {c["id"]: c for c in catalog["cuts"]}
    pairs = (
        _plan_pairs(cuts, examples)
        + _fire_pairs(examples)
        + _cut_pairs(cuts)
        + _fuel_tips(catalog)
    )
    for p in pairs:
        p["system"] = SYSTEM
    return pairs


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--out", default=str(DATA_DIR / "synth_pairs.jsonl"))
    args = ap.parse_args()

    catalog = read_json(CATALOG)
    examples = read_json(EXAMPLES)
    pairs = build_pairs(catalog, examples)
    n = write_jsonl(args.out, pairs)

    by_task: dict[str, int] = {}
    for p in pairs:
        by_task[p["task"]] = by_task.get(p["task"], 0) + 1
    print(f"wrote {n} pairs -> {args.out}")
    for task in TASKS:
        print(f"  {task:20s} {by_task.get(task, 0)}")


if __name__ == "__main__":
    main()