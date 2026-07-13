# Preset: python

A Python app / CLI / API. Ruff (lint) + pytest, tests grow per feature.

## Files this preset installs (when `/setup` applies it)
- `.github/workflows/ci.yml` → the `ci.yml` in this folder (ruff + pytest on push/PR)
- `pyproject.toml` (or `requirements-dev.txt`) with `ruff`, `pytest`
- `tests/` → a starter `test_*.py`
- app code under `src/`

## Engineering-skill rules for this stack
- Python 3.11+ standard library first; no new *runtime* dependency without an ADR.
- Small, single-purpose functions with type hints on public functions.
- Every feature adds its test(s) under `tests/` (pytest); keep them contract-based.
- Format & lint with `ruff`.

## Local commands
```
python -m pip install ruff pytest
ruff check .
pytest -q
```
