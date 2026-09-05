"""The separation worker's billing gate -- no GPU, no audio stack.

The bridge debits on the CLIENT-declared song length and the handler's
probe is the only check on it. These pin the three cases of
`_billing_refusal`: a failed probe fails open, a declaration is held to
its billing block, and a job that declared nothing runs only inside the
base window (an undeclared job used to skip the check entirely).

Run:  python -m pytest runpod/test_billing_gate.py
"""

from __future__ import annotations

import importlib.util
import os
import sys
import types

import pytest

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


@pytest.fixture(scope="module")
def handler():
    # The RunPod SDK is not installed outside the worker image, and the
    # handler only needs it at __main__ time.
    sys.modules.setdefault("runpod", types.ModuleType("runpod"))
    sys.modules["runpod"].serverless = types.SimpleNamespace(
        start=lambda *a, **k: None
    )
    path = os.path.join(REPO, "runpod", "handler.py")
    spec = importlib.util.spec_from_file_location("_mp_handler_billing", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def _minutes(m: float) -> float:
    return m * 60.0


def test_a_failed_probe_fails_open(handler):
    assert handler._billing_refusal(None, 0.0) is None
    assert handler._billing_refusal(_minutes(3), 0.0) is None


def test_a_declaration_inside_its_block_runs(handler):
    base = handler.BILLING_BASE_MINUTES
    assert handler._billing_refusal(_minutes(base - 1), _minutes(base - 0.5)) is None
    # Declared long, probed long, same block.
    block = handler.BILLING_BLOCK_MINUTES
    assert (
        handler._billing_refusal(_minutes(base + 1), _minutes(base + block - 0.5))
        is None
    )


def test_a_declaration_below_the_probed_block_is_refused(handler):
    base = handler.BILLING_BASE_MINUTES
    block = handler.BILLING_BLOCK_MINUTES
    refusal = handler._billing_refusal(_minutes(base - 1), _minutes(base + block + 1))
    assert refusal is not None
    assert "submitted as" in refusal


def test_an_undeclared_short_song_runs(handler):
    base = handler.BILLING_BASE_MINUTES
    for declared in (None, "", 0, "garbage"):
        assert handler._billing_refusal(declared, _minutes(base - 1)) is None


def test_an_undeclared_long_song_is_refused(handler):
    base = handler.BILLING_BASE_MINUTES
    for declared in (None, "", 0, "garbage"):
        refusal = handler._billing_refusal(declared, _minutes(base + 1))
        assert refusal is not None, declared
        assert "without its length" in refusal
