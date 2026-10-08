import json

from score import check, extract_numbers, mock_answer


def test_extract_numbers():
    assert extract_numbers("about 4 kg (8.8 lb)") == [4.0, 8.8]


def test_check_numbers_within_tolerance():
    item = {"expect": {"kind": "numbers", "values": [4.0, 8.8], "tolerance": 0.2}}
    assert check(item, "roughly 4 kg or 8.8 lb")[0]
    assert not check(item, "roughly 5 kg")[0]


def test_check_contains_case_insensitive():
    item = {"expect": {"kind": "contains", "values": ["18:15", "short ribs"]}}
    assert check(item, "Light at 18:15 for the Short Ribs")[0]
    assert not check(item, "Light at 18:15")[0]


def test_check_json_keys():
    item = {"expect": {"kind": "json", "keys": ["action", "minutes"]}}
    assert check(item, json.dumps({"action": "flip", "minutes": 2}))[0]
    assert not check(item, "{not json")[0]


def test_mock_answer_scores_all_kinds():
    for item in [
        {"expect": {"kind": "numbers", "values": [4.0], "tolerance": 0.2}},
        {"expect": {"kind": "contains", "values": ["x"]}},
        {"expect": {"kind": "json", "keys": ["a"]}},
    ]:
        assert check(item, mock_answer(item))[0]
