from chunk import chunk_document, split_sections

MD = """# Asado

Intro paragraph about fire and meat.

## The fire

Build it early. Let it burn down to embers.

### Embers

Ash-gray and glowing.

## The cuts

Short ribs, flank, skirt.
"""


def test_split_sections_heading_path():
    sections = split_sections(MD)
    paths = [s["heading"] for s in sections]
    assert "Asado" in paths
    assert "Asado › The fire" in paths
    assert "Asado › The fire › Embers" in paths


def test_chunk_ids_and_tokens():
    chunks = chunk_document(MD, "book1")
    assert chunks
    for c in chunks:
        assert c["id"].startswith("book1#")
        assert c["tokens"] > 0
        assert c["source"] == "book1"
    assert chunks[0]["id"] == "book1#0000"


def test_long_section_is_split():
    big = "# Big\n\n" + "\n\n".join(f"Paragraph {i} " + "word " * 400 for i in range(10))
    chunks = chunk_document(big, "d")
    assert len(chunks) > 1
    assert all(c["tokens"] <= 2600 for c in chunks)
