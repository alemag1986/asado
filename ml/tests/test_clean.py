from clean import clean_document, running_headers, split_pages


def test_dehyphenate_via_clean():
    text = "<!-- page:1 -->\nque-\nbracho fire"
    assert "quebracho fire" in clean_document(text)


def test_split_pages_counts_markers():
    text = "<!-- page:1 -->\na\n<!-- page:2 -->\nb\n<!-- page:3 -->\nc"
    assert len(split_pages(text)) == 3


def test_running_headers_detected():
    pages = [["TITLE", f"body {i}", str(i)] for i in range(4)]
    headers = running_headers(pages)
    assert "TITLE" in headers
    assert "body 0" not in headers


def test_clean_document_strips_headers_and_footers():
    text = "\n".join(
        [f"<!-- page:{i} -->\nASADO BOOK\nBody page {i}.\n{i}\n" for i in range(1, 5)]
    )
    out = clean_document(text)
    assert "ASADO BOOK" not in out
    assert "Body page 1." in out
    assert "\n1\n" not in out
