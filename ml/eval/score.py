"""Score a model against the golden set.

    python3 ml/eval/score.py --mock                                   # validate logic, no model
    python3 ml/eval/score.py --base-url http://127.0.0.1:8080/v1 \
        --model asado-v0 --api-key $KEY

Scoring is deterministic: JSON validity, numbers within tolerance of the code
tables, and required substrings. A pass means the model agrees with the app.
"""

from __future__ import annotations

import argparse
import json
import re
import urllib.request
from pathlib import Path

GOLDEN = Path(__file__).resolve().parent / "golden.jsonl"
REPORT = Path(__file__).resolve().parent / "score_report.json"
_NUM = re.compile(r"-?\d+(?:\.\d+)?")


def extract_numbers(text: str) -> list[float]:
    return [float(m) for m in _NUM.findall(text)]


def check(item: dict, answer: str) -> tuple[bool, str]:
    expect = item["expect"]
    kind = expect["kind"]
    if kind == "json":
        try:
            obj = json.loads(answer)
        except json.JSONDecodeError as exc:
            return False, f"invalid json: {exc}"
        missing = [k for k in expect.get("keys", []) if k not in obj]
        return (not missing), (f"missing keys {missing}" if missing else "ok")
    if kind == "numbers":
        got = extract_numbers(answer)
        tol = expect.get("tolerance", 0.2)
        for want in expect["values"]:
            if not any(abs(want - g) <= tol for g in got):
                return False, f"missing {want} (tol {tol}); got {got}"
        return True, "ok"
    if kind == "contains":
        low = answer.lower()
        missing = [v for v in expect["values"] if v.lower() not in low]
        return (not missing), (f"missing {missing}" if missing else "ok")
    return False, f"unknown kind {kind}"


def load_golden(path: Path = GOLDEN) -> list[dict]:
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]


def mock_answer(item: dict) -> str:
    """Return a textually faithful answer from the expectations (no model)."""
    if item["expect"]["kind"] == "json":
        return json.dumps({k: 0 for k in item["expect"].get("keys", [])})
    return " ".join(str(v) for v in item["expect"]["values"])


def ask(base_url: str, model: str, api_key: str | None, prompt: str) -> str:
    body = json.dumps({
        "model": model,
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0.0,
        "max_tokens": 256,
    }).encode("utf-8")
    headers = {"Content-Type": "application/json"}
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"
    req = urllib.request.Request(f"{base_url.rstrip('/')}/chat/completions", data=body, headers=headers, method="POST")
    with urllib.request.urlopen(req, timeout=60) as resp:
        data = json.loads(resp.read().decode("utf-8"))
    return data["choices"][0]["message"]["content"]


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--base-url", default="http://127.0.0.1:8080/v1")
    ap.add_argument("--model", default="asado")
    ap.add_argument("--api-key", default=None)
    ap.add_argument("--golden", default=str(GOLDEN))
    ap.add_argument("--mock", action="store_true", help="score against expected values, no model call")
    ap.add_argument("--report", default=str(REPORT))
    args = ap.parse_args()

    items = load_golden(Path(args.golden))
    results = []
    for item in items:
        answer = mock_answer(item) if args.mock else ask(args.base_url, args.model, args.api_key, item["prompt"])
        passed, reason = check(item, answer)
        results.append({"id": item["id"], "task": item["task"], "passed": passed, "reason": reason})

    passed = sum(1 for r in results if r["passed"])
    total = len(results)
    Path(args.report).write_text(json.dumps({"passed": passed, "total": total, "results": results}, indent=2) + "\n")

    print(f"{passed}/{total} passed  ({passed / total:.0%})  -> {args.report}")
    for r in results:
        if not r["passed"]:
            print(f"  FAIL {r['id']}: {r['reason']}")


if __name__ == "__main__":
    main()