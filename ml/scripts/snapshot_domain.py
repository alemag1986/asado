"""Snapshot the API's deterministic domain output into JSON the dataset scripts read.

Run the API first (mock mode is fine):

    cd api && BIND=127.0.0.1:4000 cargo run
    python3 ml/scripts/snapshot_domain.py

This keeps instruction pairs numerically identical to what the app ships:
numbers come from the tested code, never re-derived in Python.
"""

from __future__ import annotations

import json
import os
import urllib.request

from common import CATALOG, EXAMPLES, write_json

API = os.environ.get("ASADO_API", "http://127.0.0.1:4000").rstrip("/")

PEOPLE = [2, 4, 6, 8, 10, 12, 16, 20]
APPETITES = ["light", "normal", "heavy"]
CUT_SETS = [
    [],  # defaults chosen by the API
    ["tira"],
    ["tira", "bife-chorizo", "vacio"],
    ["tira", "vacio", "entrana", "matambre"],
    ["bife-ancho", "bife-chorizo"],
    ["pollo", "chorizo"],
]
MEAT_KG = [2.0, 4.0, 8.0, 16.0]
READY_BY = ["13:00", "20:00", "22:30"]


def get(path: str) -> dict:
    with urllib.request.urlopen(f"{API}{path}", timeout=15) as resp:
        return json.loads(resp.read().decode("utf-8"))


def post(path: str, payload: dict) -> dict:
    req = urllib.request.Request(
        f"{API}{path}",
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=15) as resp:
        return json.loads(resp.read().decode("utf-8"))


def build_catalog() -> dict:
    cuts = get("/api/cuts")["cuts"]
    styles = get("/api/styles")
    fuels = []
    seen = set()
    for fuel in ("wood", "charcoal", "gas"):
        spec = post("/api/fire", {"fuel": fuel, "cuts": ["tira"], "ready_by": "20:00"})["fuel"]
        if spec["id"] not in seen:
            fuels.append(spec)
            seen.add(spec["id"])
    return {
        "cuts": cuts,
        "fuels": fuels,
        "styles": styles["styles"],
        "markers": styles["markers"],
        "appetites": APPETITES,
    }


def build_examples(catalog: dict) -> dict:
    plans = []
    for people in PEOPLE:
        for appetite in APPETITES:
            for achuras in (True, False):
                for cuts in CUT_SETS:
                    req = {"people": people, "appetite": appetite, "achuras": achuras, "cuts": cuts, "unit": "kg"}
                    plans.append({"request": req, "response": post("/api/plan", req)})

    fires = []
    for fuel in [f["id"] for f in catalog["fuels"]]:
        for cuts in CUT_SETS:
            for meat_kg in MEAT_KG:
                for ready_by in READY_BY:
                    req = {"fuel": fuel, "cuts": cuts, "meat_kg": meat_kg, "ready_by": ready_by}
                    fires.append({"request": req, "response": post("/api/fire", req)})

    timings = [{"request": {"cut": c["id"]}, "response": post("/api/cook/timing", {"cut": c["id"]})} for c in catalog["cuts"]]
    return {"plans": plans, "fires": fires, "timings": timings}


def main() -> None:
    catalog = build_catalog()
    write_json(CATALOG, catalog)
    print(f"catalog: {len(catalog['cuts'])} cuts, {len(catalog['fuels'])} fuels, {len(catalog['styles'])} styles -> {CATALOG}")

    examples = build_examples(catalog)
    write_json(EXAMPLES, examples)
    print(f"examples: {len(examples['plans'])} plans, {len(examples['fires'])} fires, {len(examples['timings'])} timings -> {EXAMPLES}")


if __name__ == "__main__":
    main()