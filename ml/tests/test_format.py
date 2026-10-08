from format_dataset import format_dataset, to_sharegpt


def _row(i, source="s", image=None):
    return {"task": "t", "source": source, "system": "sys", "user": f"u{i}", "assistant": f"a{i}", "image": image}


def test_to_sharegpt_text_only():
    msg = to_sharegpt(_row(0))
    assert "images" not in msg
    assert msg["messages"][1]["content"][0] == {"type": "text", "text": "u0"}
    assert msg["messages"][2]["content"][0]["text"] == "a0"


def test_to_sharegpt_with_image():
    msg = to_sharegpt(_row(0, image="data/x.jpg"))
    assert msg["images"] == ["data/x.jpg"]
    assert {"type": "image", "image": "data/x.jpg"} in msg["messages"][1]["content"]


def test_golden_holdout_drops_sources():
    rows = [_row(i, source=("gold" if i < 3 else "keep")) for i in range(20)]
    train, val = format_dataset(rows, holdout={"gold"})
    assert len(train) + len(val) == 17


def test_split_is_deterministic_and_roughly_95_5():
    rows = [_row(i, source=f"s{i}") for i in range(100)]
    a = format_dataset(rows, holdout=set())
    b = format_dataset(rows, holdout=set())
    assert a == b
    assert 3 <= len(a[1]) <= 8
