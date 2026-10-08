import pytest

import synth_pairs
from common import CATALOG, EXAMPLES

pytestmark = pytest.mark.skipif(
    not (CATALOG.exists() and EXAMPLES.exists()),
    reason="domain snapshots missing; run snapshot_domain.py",
)


@pytest.fixture(scope="module")
def pairs():
    from common import read_json

    return synth_pairs.build_pairs(read_json(CATALOG), read_json(EXAMPLES))


def test_all_eight_task_types_present(pairs):
    tasks = {p["task"] for p in pairs}
    assert tasks == set(synth_pairs.TASKS)


def test_numbers_match_grounded_example(pairs):
    row = next(
        p
        for p in pairs
        if p["task"] == "quantity_for_n" and p["source"] == "plan:8:normal:True:tira+bife-chorizo+vacio"
    )
    assert "4 kg" in row["assistant"]
    assert "8.8 lb" in row["assistant"]


def test_every_pair_has_system_and_content(pairs):
    for p in pairs:
        assert p["system"]
        assert p["user"] and p["assistant"]
        assert p["source"]


def test_fire_pair_carries_real_times():
    fire = next(p for p in _pairs() if p["task"] == "fire_setup_by_fuel")
    assert "Light it at" in fire["assistant"]


def _pairs():
    from common import read_json

    return synth_pairs.build_pairs(read_json(CATALOG), read_json(EXAMPLES))
