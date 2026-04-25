"""
Test package entrypoint.

Allows running specific test modules programmatically.
"""

import pytest
import sys
from pathlib import Path


def run_tests(test_name: str = None):
    """
    Run pytest programmatically.

    Args:
        test_name (str): Optional test file (without .py), e.g. "test_ocr"
    """
    base_dir = Path(__file__).parent

    if test_name:
        test_path = base_dir / f"{test_name}.py"
        if not test_path.exists():
            raise ValueError(f"Test file {test_name}.py not found")
        args = [str(test_path)]
    else:
        args = [str(base_dir)]

    return pytest.main(args)


if __name__ == "__main__":
    # Default: only run OCR tests for now
    sys.exit(run_tests("test_ocr"))