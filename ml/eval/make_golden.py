"""Freeze a hand-picked golden set from the domain snapshots.

Expected values are copied from the API output, so a passing score means the
model agrees with the shipped code. Sources are emitted so `format_dataset.py`
holds the exact rows out of training.

    python3 ml/eval/make_golden.py     # -> ml/eval/golden.jsonl
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))

from common import CATALOG, EXAMPLES, ML_ROOT, read_json, write_jsonl  # noqa: E402
from synth_pairs import _achuras, _num  # noqa: E402

GOLDEN = ML_ROOT / "eval" / "golden.jsonl"

# (people, appetite, achuras, cuts) tuples for quantity + shopping golden rows
PLAN_CASES = [
    (8, "normal", True, ["tira", "bife-chorizo", "vacio"]),
    (4, "light", False, []),
    (12, "heavy", True, ["tira", "vacio", "entrana", "matambre"]),
    (6, "normal", False, ["bife-ancho", "bife-chorizo"]),
]

FIRE_CASES = [
    ("charcoal", ["tira"], 4.0, "20:00"),
    ("wood", ["tira", "bife-chorizo", "vacio"], 8.0, "22:30"),
]

CUT_CASES = ["tira", "bife-chorizo", "vacio", "entrana", "matambre", "chorizo"]


def _plan_source(req: dict) -> str:
    return f"plan:{req['people']}:{req['appetite']}:{req['achuras']}:{'+'.join(req['cuts']) or 'default'}"


def _find_plan(examples: dict, req: dict) -> dict:
    for ex in examples["plans"]:
        if ex["request"] == req:
            return ex["response"]
    raise KeyError(req)


def _find_fire(examples: dict, fuel: str, cuts: list[str], meat: float, ready: str) -> dict:
    for ex in examples["fires"]:
        r = ex["request"]
        if r["fuel"] == fuel and r["cuts"] == cuts and r["meat_kg"] == meat and r["ready_by"] == ready:
            return ex["response"]
    raise KeyError((fuel, meat, ready))


def build() -> list[dict]:
    catalog = read_json(CATALOG)
    examples = read_json(EXAMPLES)
    cuts = {c["id"]: c for c in catalog["cuts"]}
    rows: list[dict] = []

    for people, appetite, achuras, cut_set in PLAN_CASES:
        req = {"people": people, "appetite": appetite, "achuras": achuras, "cuts": cut_set, "unit": "kg"}
        resp = _find_plan(examples, req)
        a = _achuras(req)
        label = f"{people}-{appetite}-{'with' if achuras else 'no'}-{'/'.join(cut_set) or 'default'}"
        rows.append({
            "id": f"qty-{label}",
            "task": "quantity_for_n",
            "source": _plan_source(req),
            "prompt": f"How much meat do I need for {people} people ({appetite} appetite, {a})?",
            "expect": {
                "kind": "numbers",
                "values": [resp["total_kg"], resp["total_lb"], resp["per_person_kg"]],
                "tolerance": 0.2,
            },
        })
        order_names = [cuts[c]["name"] for c in resp["order"]]
        rows.append({
            "id": f"list-{label}",
            "task": "shopping_list",
            "source": _plan_source(req),
            "prompt": f"Build a butcher list for {people} people ({appetite} appetite, {a}).",
            "expect": {"kind": "contains", "values": order_names + [_num(resp["total_kg"])]},
        })

    for fuel, cut_set, meat, ready in FIRE_CASES:
        resp = _find_fire(examples, fuel, cut_set, meat, ready)
        rows.append({
            "id": f"fire-{fuel}-{_num(meat)}kg-{ready.replace(':', '')}",
            "task": "fire_setup_by_fuel",
            "source": f"fire:{fuel}:{_num(meat)}kg:{ready}",
            "prompt": (
                f"I'm cooking {_num(meat)} kg on {resp['fuel']['label'].lower()} "
                f"to serve at {ready}. When do I start the fire?"
            ),
            "expect": {"kind": "contains", "values": [resp["fire_start"], resp["coal_ready"]]},
        })

    for cut_id in CUT_CASES:
        cut = cuts[cut_id]
        rows.append({
            "id": f"done-{cut_id}",
            "task": "doneness_judgment",
            "source": cut_id,
            "prompt": f"How do I know the {cut['name']} ({cut['local']}) is done?",
            "expect": {"kind": "contains", "values": [f"{_num(cut['target_temp_c'])}°C"]},
        })

    return rows


def main() -> None:
    rows = build()
    n = write_jsonl(GOLDEN, rows)
    print(f"wrote {n} golden items -> {GOLDEN}")


if __name__ == "__main__":
    main()