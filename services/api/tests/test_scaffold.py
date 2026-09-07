"""Scaffold-level tests. Real pipeline tests arrive with later prompts."""

import katibay_api


def test_package_imports_and_reports_version() -> None:
    assert katibay_api.__version__ == "0.1.0"
